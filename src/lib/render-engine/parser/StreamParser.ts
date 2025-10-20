/**
 * 流式内容解析器
 * 专门处理实时内容流的解析和缓冲
 */

import {
  ContentType,
  ParseResult,
  ContentSegment,
  RenderError
} from '../types'
import {
  quickDetectContentType,
  generateId,
  hashString,
  debounce
} from '../utils'
import {
  STREAM_RENDER_CONFIG,
  ERROR_CODES
} from '../constants'

/**
 * 流式解析器状态
 */
interface StreamState {
  buffer: string
  lastFlushTime: number
  pendingSegments: ContentSegment[]
  isProcessing: boolean
}

/**
 * 流式内容解析器
 */
export class StreamParser {
  private state: StreamState = {
    buffer: '',
    lastFlushTime: 0,
    pendingSegments: [],
    isProcessing: false
  }

  private flushCallback?: (segments: ContentSegment[]) => void
  private errorCallback?: (error: Error) => void
  
  // 防抖的刷新函数
  private debouncedFlush = debounce(
    () => this.flush(),
    STREAM_RENDER_CONFIG.RENDER_INTERVAL
  )

  /**
   * 设置回调函数
   */
  public setCallbacks(
    onFlush?: (segments: ContentSegment[]) => void,
    onError?: (error: Error) => void
  ): void {
    this.flushCallback = onFlush
    this.errorCallback = onError
  }

  /**
   * 添加内容块到流
   */
  public async addChunk(chunk: string): Promise<void> {
    if (!chunk) return

    try {
      this.state.buffer += chunk
      
      // 检查是否需要立即处理
      if (this.shouldProcessImmediately(chunk)) {
        await this.processBuffer()
      } else {
        // 使用防抖处理
        this.debouncedFlush()
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * 检查是否应该立即处理
   */
  private shouldProcessImmediately(chunk: string): boolean {
    // 如果缓冲区过大
    if (this.state.buffer.length > STREAM_RENDER_CONFIG.BUFFER_SIZE) {
      return true
    }

    // 如果检测到完整的结构（如代码块结束）
    if (chunk.includes('```') || chunk.includes('$$')) {
      return true
    }

    // 如果检测到表格行
    if (/^\|.*\|.*\|\s*$/.test(chunk.trim())) {
      return true
    }

    return false
  }

  /**
   * 处理缓冲区内容
   */
  private async processBuffer(): Promise<void> {
    if (this.state.isProcessing || !this.state.buffer.trim()) {
      return
    }

    this.state.isProcessing = true

    try {
      const segments = await this.parseBufferContent()
      
      if (segments.length > 0) {
        this.state.pendingSegments.push(...segments)
        
        // 如果有足够的段落或超过最大等待时间，则刷新
        if (this.shouldFlush()) {
          await this.flush()
        }
      }
    } catch (error) {
      this.handleError(error)
    } finally {
      this.state.isProcessing = false
    }
  }

  /**
   * 解析缓冲区内容
   */
  private async parseBufferContent(): Promise<ContentSegment[]> {
    const segments: ContentSegment[] = []
    const buffer = this.state.buffer

    // 提取完整的内容块
    const completeBlocks = this.extractCompleteBlocks(buffer)
    
    for (const block of completeBlocks) {
      const segment = await this.createSegmentFromBlock(block)
      if (segment) {
        segments.push(segment)
        
        // 从缓冲区中移除已处理的内容
        this.state.buffer = this.state.buffer.replace(block, '')
      }
    }

    // 如果没有完整块，但缓冲区很大，创建部分段落
    if (segments.length === 0 && buffer.length > STREAM_RENDER_CONFIG.BUFFER_SIZE) {
      const partialSegment = await this.createPartialSegment(buffer)
      if (partialSegment) {
        segments.push(partialSegment)
        this.state.buffer = '' // 清空缓冲区
      }
    }

    return segments
  }

  /**
   * 提取完整的内容块
   */
  private extractCompleteBlocks(buffer: string): string[] {
    const blocks: string[] = []

    // 代码块
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g
    let match
    while ((match = codeBlockRegex.exec(buffer)) !== null) {
      blocks.push(match[0])
    }

    // 数学公式块
    const mathBlockRegex = /\$\$([\s\S]*?)\$\$/g
    while ((match = mathBlockRegex.exec(buffer)) !== null) {
      blocks.push(match[0])
    }

    // 表格块
    const tableBlocks = this.extractTableBlocks(buffer)
    blocks.push(...tableBlocks)

    // 列表块
    const listBlocks = this.extractListBlocks(buffer)
    blocks.push(...listBlocks)

    return blocks
  }

  /**
   * 提取表格块
   */
  private extractTableBlocks(buffer: string): string[] {
    const blocks: string[] = []
    const lines = buffer.split('\n')
    let currentTable: string[] = []

    for (const line of lines) {
      if (/^\|.*\|.*\|/.test(line.trim())) {
        currentTable.push(line)
      } else if (currentTable.length > 0) {
        // 表格结束
        if (currentTable.length >= 2) { // 至少需要表头和一行数据
          blocks.push(currentTable.join('\n'))
        }
        currentTable = []
      }
    }

    // 处理最后一个表格
    if (currentTable.length >= 2) {
      blocks.push(currentTable.join('\n'))
    }

    return blocks
  }

  /**
   * 提取列表块
   */
  private extractListBlocks(buffer: string): string[] {
    const blocks: string[] = []
    const lines = buffer.split('\n')
    let currentList: string[] = []

    for (const line of lines) {
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        currentList.push(line)
      } else if (currentList.length > 0) {
        // 列表结束
        if (currentList.length >= 2) {
          blocks.push(currentList.join('\n'))
        }
        currentList = []
      }
    }

    // 处理最后一个列表
    if (currentList.length >= 2) {
      blocks.push(currentList.join('\n'))
    }

    return blocks
  }

  /**
   * 从内容块创建段落
   */
  private async createSegmentFromBlock(block: string): Promise<ContentSegment | null> {
    if (!block.trim()) return null

    const { type, confidence } = quickDetectContentType(block)
    
    return {
      id: generateId(),
      type,
      content: block,
      metadata: {
        startIndex: 0, // 在流式处理中，位置信息不太重要
        endIndex: block.length,
        confidence,
        cacheKey: hashString(block),
        priority: this.calculatePriority(type, block),
        isComplete: true,
        streamTimestamp: Date.now()
      }
    }
  }

  /**
   * 创建部分段落（用于大缓冲区）
   */
  private async createPartialSegment(buffer: string): Promise<ContentSegment | null> {
    if (!buffer.trim()) return null

    // 尝试在合适的位置分割内容
    const splitPoint = this.findGoodSplitPoint(buffer)
    const content = buffer.substring(0, splitPoint)
    
    if (!content.trim()) return null

    const { type, confidence } = quickDetectContentType(content)
    
    return {
      id: generateId(),
      type,
      content,
      metadata: {
        startIndex: 0,
        endIndex: content.length,
        confidence: confidence * 0.8, // 降低部分内容的置信度
        cacheKey: hashString(content),
        priority: this.calculatePriority(type, content),
        isComplete: false,
        streamTimestamp: Date.now()
      }
    }
  }

  /**
   * 找到合适的分割点
   */
  private findGoodSplitPoint(buffer: string): number {
    const maxLength = STREAM_RENDER_CONFIG.BUFFER_SIZE

    if (buffer.length <= maxLength) {
      return buffer.length
    }

    // 尝试在句号后分割
    let splitPoint = buffer.lastIndexOf('.', maxLength)
    if (splitPoint > maxLength * 0.7) {
      return splitPoint + 1
    }

    // 尝试在换行符后分割
    splitPoint = buffer.lastIndexOf('\n', maxLength)
    if (splitPoint > maxLength * 0.5) {
      return splitPoint + 1
    }

    // 尝试在空格后分割
    splitPoint = buffer.lastIndexOf(' ', maxLength)
    if (splitPoint > maxLength * 0.3) {
      return splitPoint + 1
    }

    // 强制分割
    return maxLength
  }

  /**
   * 计算优先级
   */
  private calculatePriority(type: ContentType, content: string): number {
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

    // 完整内容优先级更高
    const completenessBonus = content.includes('```') || content.includes('$$') ? 2 : 0
    
    return basePriority + completenessBonus
  }

  /**
   * 检查是否应该刷新
   */
  private shouldFlush(): boolean {
    const now = Date.now()
    const timeSinceLastFlush = now - this.state.lastFlushTime

    return (
      this.state.pendingSegments.length >= STREAM_RENDER_CONFIG.BATCH_SIZE ||
      timeSinceLastFlush > STREAM_RENDER_CONFIG.MAX_WAIT_TIME
    )
  }

  /**
   * 刷新待处理的段落
   */
  private async flush(): Promise<void> {
    if (this.state.pendingSegments.length === 0) return

    try {
      const segments = [...this.state.pendingSegments]
      this.state.pendingSegments = []
      this.state.lastFlushTime = Date.now()

      if (this.flushCallback) {
        this.flushCallback(segments)
      }
    } catch (error) {
      this.handleError(error)
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: unknown): void {
    const renderError = error instanceof RenderError 
      ? error 
      : new RenderError(
          `Stream parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ERROR_CODES.PARSE_FAILED,
          { bufferLength: this.state.buffer.length }
        )

    if (this.errorCallback) {
      this.errorCallback(renderError)
    } else {
      console.error('StreamParser error:', renderError)
    }
  }

  /**
   * 强制刷新所有待处理内容
   */
  public async forceFlush(): Promise<void> {
    // 处理剩余缓冲区内容
    if (this.state.buffer.trim()) {
      await this.processBuffer()
    }

    // 刷新所有待处理段落
    await this.flush()
  }

  /**
   * 获取当前状态
   */
  public getState(): {
    bufferSize: number
    pendingSegments: number
    isProcessing: boolean
    lastFlushTime: number
  } {
    return {
      bufferSize: this.state.buffer.length,
      pendingSegments: this.state.pendingSegments.length,
      isProcessing: this.state.isProcessing,
      lastFlushTime: this.state.lastFlushTime
    }
  }

  /**
   * 重置解析器状态
   */
  public reset(): void {
    this.state = {
      buffer: '',
      lastFlushTime: 0,
      pendingSegments: [],
      isProcessing: false
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.reset()
    this.flushCallback = undefined
    this.errorCallback = undefined
  }
}