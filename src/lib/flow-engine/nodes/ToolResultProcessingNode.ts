/**
 * 工具结果处理节点
 * 负责处理、验证和格式化MCP工具的执行结果
 */

import { FlowNode, FlowInput, FlowOutput } from '../core/FlowNode'
import { AggregatedExecutionResult, ToolExecutionResult } from './ParallelToolExecutionNode'

// 处理后的结果
export interface ProcessedResult {
  success: boolean
  data: any
  formattedOutput: string
  metadata: ResultMetadata
  suggestions: string[]
  followUpActions: FollowUpAction[]
}

export interface ResultMetadata {
  toolsUsed: string[]
  executionTime: number
  confidence: number
  dataQuality: number
  resultType: string
  sources: string[]
}

export interface FollowUpAction {
  type: string
  description: string
  parameters?: Record<string, any>
}

// 结果验证规则
interface ValidationRule {
  toolName: string
  validator: (result: any) => ValidationResult
}

interface ValidationResult {
  valid: boolean
  confidence: number
  issues: string[]
  suggestions: string[]
}

/**
 * 工具结果处理节点
 */
export class ToolResultProcessingNode extends FlowNode {
  private validationRules: Map<string, ValidationRule> = new Map()
  private formatters: Map<string, (result: any) => string> = new Map()
  private qualityThreshold: number = 0.7

  constructor(config: any) {
    super({
      id: config.id || 'tool_result_processing',
      name: config.name || '工具结果处理节点',
      type: 'ToolResultProcessingNode',
      successors: config.successors || ['response_synthesis'],
      errorHandlers: config.errorHandlers || ['result_processing_error'],
      timeout: config.timeout || 15000,
      params: config.params || {}
    })

    this.qualityThreshold = config.qualityThreshold || 0.7
    this.initializeValidationRules()
    this.initializeFormatters()
  }

  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input for tool result processing',
        recoverable: false,
        retryable: false
      })
    }

    try {
      const executionResult = input.data as AggregatedExecutionResult
      const originalInput = input.data.originalInput || ''
      const context = input.context

      console.log(`🔍 开始处理 ${executionResult.results.length} 个工具执行结果`)

      // 简化处理：直接返回格式化的结果
      const processedResult: ProcessedResult = {
        success: executionResult.overallSuccess,
        data: {
          originalResults: executionResult.results,
          aggregatedData: executionResult.aggregatedData,
          summary: executionResult.summary
        },
        formattedOutput: this.formatSimpleResults(executionResult.results, originalInput),
        metadata: {
          toolsUsed: executionResult.results.map(r => r.toolName),
          executionTime: executionResult.totalExecutionTime,
          confidence: 0.8,
          dataQuality: 0.8,
          resultType: 'multi_tool',
          sources: []
        },
        suggestions: [],
        followUpActions: []
      }

      console.log(`✅ 结果处理完成`)

      return this.createOutput(
        processedResult,
        this.successors,
        context,
        {
          processingTime: Date.now() - input.context.startTime,
          toolsProcessed: executionResult.results.length
        }
      )

    } catch (error) {
      return this.createErrorOutput({
        code: 'RESULT_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Result processing failed',
        details: error,
        recoverable: true,
        retryable: true
      })
    }
  }

  /**
   * 简化的结果格式化
   */
  private formatSimpleResults(results: ToolExecutionResult[], originalInput: string): string {
    if (results.length === 0) {
      return '抱歉，没有获取到有效的结果。'
    }

    const successfulResults = results.filter(r => r.success)

    if (successfulResults.length === 0) {
      return '工具执行失败，请稍后重试。'
    }

    if (successfulResults.length === 1) {
      const result = successfulResults[0]
      return this.formatSingleResult(result)
    }

    // 多个结果的简单组合
    const parts = [`基于您的请求"${originalInput}"，我找到了以下信息：\n`]

    successfulResults.forEach((result, index) => {
      parts.push(`${index + 1}. ${this.formatSingleResult(result)}`)
    })

    return parts.join('\n\n')
  }

  /**
   * 格式化单个结果
   */
  private formatSingleResult(result: ToolExecutionResult): string {
    switch (result.toolName) {
      case 'web_search':
        if (result.result?.results) {
          const items = result.result.results.slice(0, 5)
          return `🔍 **网络搜索结果**：\n${items.map((item: any, i: number) =>
            `**${i + 1}. ${item.title}**\n🔗 ${item.url}\n${item.snippet || ''}`
          ).join('\n\n')}`
        }
        break

      case 'calculate':
        if (result.result?.result !== undefined) {
          return `🧮 **计算结果**：${result.result.result}`
        }
        break

      case 'get_time':
        if (result.result?.local) {
          return `🕐 **当前时间**：${result.result.local}`
        }
        break
    }

    // 默认格式化
    if (typeof result.result === 'string') {
      return result.result
    }

    return `${result.toolName} 执行成功`
  }

  /**
   * 初始化验证规则（简化版）
   */
  private initializeValidationRules(): void {
    // 简化实现，后续可以扩展
  }

  /**
   * 初始化格式化器（简化版）
   */
  private initializeFormatters(): void {
    // 简化实现，后续可以扩展
  }
}