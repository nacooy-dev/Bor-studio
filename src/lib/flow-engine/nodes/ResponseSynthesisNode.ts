/**
 * 响应合成节点
 * 将处理后的工具结果合成为用户友好的最终响应
 */

import { FlowNode, FlowInput, FlowOutput } from '../core/FlowNode'
import { ProcessedResult } from './ToolResultProcessingNode'

export interface SynthesizedResponse {
  content: string
  format: 'text' | 'markdown' | 'html'
  metadata: ResponseMetadata
  suggestions: string[]
  followUpActions: any[]
}

export interface ResponseMetadata {
  confidence: number
  sources: string[]
  processingTime: number
  toolsUsed: string[]
  responseType: string
}

/**
 * 响应合成节点
 */
export class ResponseSynthesisNode extends FlowNode {
  constructor(config: any) {
    super({
      id: config.id || 'response_synthesis',
      name: config.name || '响应合成节点',
      type: 'ResponseSynthesisNode',
      successors: config.successors || [],
      errorHandlers: config.errorHandlers || ['synthesis_error'],
      timeout: config.timeout || 10000,
      params: config.params || {}
    })
  }

  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input for response synthesis',
        recoverable: false,
        retryable: false
      })
    }

    try {
      const processedResult = input.data as ProcessedResult
      const context = input.context

      console.log('🎯 开始合成最终响应')

      // 合成响应内容
      const synthesizedResponse: SynthesizedResponse = {
        content: processedResult.formattedOutput,
        format: 'markdown',
        metadata: {
          confidence: processedResult.metadata.confidence,
          sources: processedResult.metadata.sources,
          processingTime: processedResult.metadata.executionTime,
          toolsUsed: processedResult.metadata.toolsUsed,
          responseType: processedResult.metadata.resultType
        },
        suggestions: processedResult.suggestions,
        followUpActions: processedResult.followUpActions
      }

      console.log('✅ 响应合成完成')

      return this.createOutput(
        synthesizedResponse,
        this.successors,
        context,
        {
          synthesisTime: Date.now() - input.context.startTime,
          contentLength: synthesizedResponse.content.length,
          confidence: synthesizedResponse.metadata.confidence
        }
      )

    } catch (error) {
      return this.createErrorOutput({
        code: 'SYNTHESIS_ERROR',
        message: error instanceof Error ? error.message : 'Response synthesis failed',
        details: error,
        recoverable: true,
        retryable: true
      })
    }
  }
}