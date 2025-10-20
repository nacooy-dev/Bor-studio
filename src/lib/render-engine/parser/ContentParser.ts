/**
 * 内容解析器实现
 * 负责解析LLM输出流，识别内容类型和结构
 */

import {
  ContentParser as IContentParser,
  ContentType,
  ParseResult,
  ContentSegment,
  RenderError
} from '../types'
import {
  detectContentType,
  quickDetectContentType,
  generateId,
  hashString,
  isSimpleText
} from '../utils'
import {
  CONTENT_SIZE_LIMITS,
  ERROR_CODES,
  STREAM_RENDER_CONFIG
} from '../constants'

/**
 * 内容解析器实现类
 */
export class ContentParser implements IContentParser {
  private streamBuffer: string = ''
  private segmentCache = new Map<string, ContentSegment[]>()
  private parseHistory: ParseResult[] = []

  /**
   * 流式解析内容
   */
  public async parseStream(chunk: string): Promise<ParseResult[]> {
    try {
      // 将新块添加到缓冲区
      this.streamBuffer += chunk
      
      // 如果缓冲区过大，进行部分解析
      if (this.streamBuffer.length > STREAM_RENDER_CONFIG.BUFFER_SIZE) {
        return this.parseBufferedContent()
      }

      // 检查是否有完整的内容块可以解析
      const completeBlocks = this.extractCompleteBlocks(this.streamBuffer)
      if (completeBlocks.length > 0) {
        return this.parseCompleteBlocks(completeBlocks)
      }

      return []
    } catch (error) {
      throw new RenderError(
        `Stream parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ERROR_CODES.PARSE_FAILED,
        { bufferLength: this.streamBuffer.length, chunk: chunk.substring(0, 100) }
      )
    }
  }

  /**
   * 检测内容类型
   */
  public async detectContentType(content: string): Promise<ContentType> {
    if (!content || content.trim().length === 0) {
      return ContentType.TEXT
    }

    const detected = detectContentType(content)
    return detected || ContentType.TEXT
  }

  /**
   * 分割内容为段落
   */
  public async segmentContent(content: string): Promise<ContentSegment[]> {
    if (!content || content.trim().length === 0) {
      return []
    }

    // 检查缓存
    const cacheKey = hashString(content)
    const cached = this.segmentCache.get(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const segments = await this.performSegmentation(content)
      
      // 缓存结果
      this.segmentCache.set(cacheKey, segments)
      
      return segments
    } catch (error) {
      throw new RenderError(
        `Content segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ERROR_CODES.PARSE_FAILED,
        { contentLength: content.length }
      )
    }
  }

  /**
   * 快速类型检测（前100字符）
   */
  public quickDetect(content: string): { type: ContentType; confidence: number } {
    return quickDetectContentType(content)
  }

  /**
   * 解析缓冲区内容
   */
  private async parseBufferedContent(): Promise<ParseResult[]> {
    const results: ParseResult[] = []
    
    // 尝试解析当前缓冲区内容
    const segments = await this.segmentContent(this.streamBuffer)
    
    for (const segment of segments) {
      const result: ParseResult = {
        type: segment.type,
        content: segment.content,
        metadata: segment.metadata,
        confidence: segment.metadata.confidence,
        position: {
          start: segment.metadata.startIndex,
          end: segment.metadata.endIndex
        }
      }
      
      results.push(result)
      this.parseHistory.push(result)
    }

    // 清空已解析的内容
    this.streamBuffer = ''
    
    return results
  }

  /**
   * 提取完整的内容块
   */
  private extractCompleteBlocks(buffer: string): string[] {
    const blocks: string[] = []
    
    // 检测代码块
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g
    let match
    while ((match = codeBlockRegex.exec(buffer)) !== null) {
      blocks.push(match[0])
    }

    // 检测表格块
    const tableRegex = /^\|.*\|.*\|\s*$/gm
    const tableLines: string[] = []
    const lines = buffer.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (tableRegex.test(line)) {
        tableLines.push(line)
      } else if (tableLines.length > 0) {
        // 表格结束
        blocks.push(tableLines.join('\n'))
        tableLines.length = 0
      }
    }
    
    if (tableLines.length > 0) {
      blocks.push(tableLines.join('\n'))
    }

    // 检测数学公式块
    const mathBlockRegex = /\$\$([\s\S]*?)\$\$/g
    while ((match = mathBlockRegex.exec(buffer)) !== null) {
      blocks.push(match[0])
    }

    return blocks
  }

  /**
   * 解析完整的内容块
   */
  private async parseCompleteBlocks(blocks: string[]): Promise<ParseResult[]> {
    const results: ParseResult[] = []
    
    for (const block of blocks) {
      const type = await this.detectContentType(block)
      const { confidence } = this.quickDetect(block)
      
      const result: ParseResult = {
        type,
        content: block,
        metadata: {
          blockType: 'complete',
          extractedAt: Date.now()
        },
        confidence,
        position: {
          start: this.streamBuffer.indexOf(block),
          end: this.streamBuffer.indexOf(block) + block.length
        }
      }
      
      results.push(result)
      this.parseHistory.push(result)
    }

    return results
  }

  /**
   * 执行内容分割
   */
  private async performSegmentation(content: string): Promise<ContentSegment[]> {
    const segments: ContentSegment[] = []
    const lines = content.split('\n')
    let currentSegment: Partial<ContentSegment> | null = null
    let lineIndex = 0

    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // 跳过空行
      if (!trimmedLine) {
        lineIndex++
        continue
      }

      // 检测新段落的开始
      const detectedType = detectContentType(trimmedLine)
      
      if (currentSegment && currentSegment.type !== detectedType) {
        // 完成当前段落
        if (currentSegment.content) {
          segments.push(this.finalizeSegment(currentSegment, content))
        }
        currentSegment = null
      }

      // 开始新段落或继续当前段落
      if (!currentSegment) {
        currentSegment = {
          id: generateId(),
          type: detectedType || ContentType.TEXT,
          content: line,
          metadata: {
            startIndex: content.indexOf(line),
            endIndex: content.indexOf(line) + line.length,
            confidence: this.quickDetect(line).confidence
          }
        }
      } else {
        // 继续当前段落
        currentSegment.content += '\n' + line
        currentSegment.metadata!.endIndex = content.indexOf(line) + line.length
      }

      lineIndex++
    }

    // 完成最后一个段落
    if (currentSegment && currentSegment.content) {
      segments.push(this.finalizeSegment(currentSegment, content))
    }

    return this.optimizeSegments(segments)
  }

  /**
   * 完成段落构建
   */
  private finalizeSegment(partial: Partial<ContentSegment>, fullContent: string): ContentSegment {
    const segment: ContentSegment = {
      id: partial.id!,
      type: partial.type!,
      content: partial.content!,
      metadata: {
        ...partial.metadata!,
        cacheKey: hashString(partial.content!),
        priority: this.calculatePriority(partial.type!, partial.content!)
      }
    }

    return segment
  }

  /**
   * 计算段落优先级
   */
  private calculatePriority(type: ContentType, content: string): number {
    // 基础优先级
    const basePriority = {
      [ContentType.MATH]: 10,
      [ContentType.CODE]: 9,
      [ContentType.TABLE]: 8,
      [ContentType.CHART]: 7,
      [ContentType.LIST]: 6,
      [ContentType.LINK]: 5,
      [ContentType.TEXT]: 3,
      [ContentType.MIXED]: 4
    }[type] || 3

    // 根据内容长度调整优先级
    const lengthFactor = Math.min(1, content.length / 1000)
    
    return Math.round(basePriority * (1 + lengthFactor * 0.2))
  }

  /**
   * 优化段落列表
   */
  private optimizeSegments(segments: ContentSegment[]): ContentSegment[] {
    const optimized: ContentSegment[] = []
    
    for (let i = 0; i < segments.length; i++) {
      const current = segments[i]
      const next = segments[i + 1]

      // 合并相邻的相同类型段落
      if (next && 
          current.type === next.type && 
          current.type === ContentType.TEXT &&
          current.content.length + next.content.length < CONTENT_SIZE_LIMITS.TEXT_MAX_SIZE) {
        
        // 合并段落
        const merged: ContentSegment = {
          id: generateId(),
          type: current.type,
          content: current.content + '\n\n' + next.content,
          metadata: {
            startIndex: current.metadata.startIndex,
            endIndex: next.metadata.endIndex,
            confidence: Math.max(current.metadata.confidence, next.metadata.confidence),
            cacheKey: hashString(current.content + next.content),
            priority: Math.max(current.metadata.priority || 3, next.metadata.priority || 3)
          }
        }
        
        optimized.push(merged)
        i++ // 跳过下一个段落
      } else {
        optimized.push(current)
      }
    }

    return optimized
  }

  /**
   * 清理解析器状态
   */
  public cleanup(): void {
    this.streamBuffer = ''
    this.segmentCache.clear()
    this.parseHistory = []
  }

  /**
   * 获取解析统计信息
   */
  public getStats(): {
    bufferSize: number
    cacheSize: number
    parseHistorySize: number
    totalParsedContent: number
  } {
    const totalParsedContent = this.parseHistory.reduce(
      (total, result) => total + result.content.length,
      0
    )

    return {
      bufferSize: this.streamBuffer.length,
      cacheSize: this.segmentCache.size,
      parseHistorySize: this.parseHistory.length,
      totalParsedContent
    }
  }

  /**
   * 重置解析器
   */
  public reset(): void {
    this.cleanup()
  }
}