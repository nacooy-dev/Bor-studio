/**
 * 并行工具执行节点
 * 支持多个MCP工具的并行执行和结果聚合
 */

import { ParallelFlowNode, FlowInput, FlowOutput, ParallelTask, ParallelResult } from '../core/FlowNode'
import { llmMCPHandler } from '@/services/mcp/LLMBasedMCPHandler'
import type { MCPToolCall } from '@/types'

// 工具执行结果
export interface ToolExecutionResult {
  stepId: string
  toolName: string
  serverId: string
  success: boolean
  result?: any
  error?: string
  executionTime: number
  startTime: number
  endTime: number
  metadata: Record<string, any>
}

// 聚合结果
export interface AggregatedResult {
  primaryResult: any
  allResults: ToolExecutionResult[]
  successCount: number
  failureCount: number
  totalExecutionTime: number
  aggregationStrategy: string
  confidence: number
}

/**
 * 并行工具执行节点
 */
export class ParallelToolExecutionNode extends ParallelFlowNode {
  private maxConcurrentTools: number = 3
  private toolTimeout: number = 30000
  private retryAttempts: number = 2

  constructor(config: any) {
    super({
      id: config.id || 'parallel_tool_execution',
      name: config.name || '并行工具执行节点',
      type: 'ParallelToolExecutionNode',
      successors: config.successors || ['tool_result_processing'],
      errorHandlers: config.errorHandlers || ['tool_execution_fallback'],
      timeout: config.timeout || 60000,
      params: config.params || {}
    })

    this.maxConcurrentTools = config.maxConcurrentTools || 3
    this.toolTimeout = config.toolTimeout || 30000
    this.retryAttempts = config.retryAttempts || 2
  }

  /**
   * 获取并行执行任务
   */
  async getParallelTasks(input: FlowInput): Promise<ParallelTask[]> {
    const executionPlan = input.data.executionPlan
    const toolSelection = input.data.toolSelection
    
    if (!executionPlan || !executionPlan.steps) {
      throw new Error('执行计划不存在或无效')
    }

    const tasks: ParallelTask[] = []
    
    // 创建并行任务
    for (const step of executionPlan.steps) {
      if (step.canRunInParallel) {
        const task = new ToolExecutionTask(
          step.stepId,
          step.toolName,
          step.serverId,
          step.parameters,
          this.toolTimeout,
          this.retryAttempts
        )
        tasks.push(task)
      }
    }

    // 限制并发数量
    if (tasks.length > this.maxConcurrentTools) {
      console.warn(`并行任务数量(${tasks.length})超过限制(${this.maxConcurrentTools})，将按优先级选择`)
      
      // 按优先级排序并选择前N个
      const prioritizedSteps = executionPlan.steps
        .filter(step => step.canRunInParallel)
        .sort((a, b) => a.priority - b.priority)
        .slice(0, this.maxConcurrentTools)
      
      return prioritizedSteps.map(step => new ToolExecutionTask(
        step.stepId,
        step.toolName,
        step.serverId,
        step.parameters,
        this.toolTimeout,
        this.retryAttempts
      ))
    }

    return tasks
  }

  /**
   * 聚合并行执行结果
   */
  async aggregateResults(results: ParallelResult[], input: FlowInput): Promise<AggregatedResult> {
    const toolResults: ToolExecutionResult[] = []
    let successCount = 0
    let failureCount = 0
    let totalExecutionTime = 0

    // 处理每个任务的结果
    for (const result of results) {
      const toolResult = result.data as ToolExecutionResult
      toolResults.push(toolResult)
      
      if (toolResult.success) {
        successCount++
      } else {
        failureCount++
      }
      
      totalExecutionTime += toolResult.executionTime
    }

    // 选择聚合策略
    const aggregationStrategy = this.selectAggregationStrategy(toolResults, input)
    
    // 执行结果聚合
    const primaryResult = await this.performAggregation(toolResults, aggregationStrategy)
    
    // 计算置信度
    const confidence = this.calculateAggregationConfidence(toolResults, successCount, failureCount)

    return {
      primaryResult,
      allResults: toolResults,
      successCount,
      failureCount,
      totalExecutionTime,
      aggregationStrategy,
      confidence
    }
  }

  /**
   * 选择聚合策略
   */
  private selectAggregationStrategy(results: ToolExecutionResult[], input: FlowInput): string {
    const successfulResults = results.filter(r => r.success)
    
    if (successfulResults.length === 0) {
      return 'error_summary'
    }
    
    if (successfulResults.length === 1) {
      return 'single_result'
    }
    
    // 根据工具类型选择策略
    const toolTypes = new Set(successfulResults.map(r => this.getToolType(r.toolName)))
    
    if (toolTypes.has('search') && toolTypes.size > 1) {
      return 'search_merge'
    }
    
    if (toolTypes.has('calculation')) {
      return 'calculation_verify'
    }
    
    if (toolTypes.has('file_operation')) {
      return 'file_operation_summary'
    }
    
    return 'general_merge'
  }

  /**
   * 执行结果聚合
   */
  private async performAggregation(results: ToolExecutionResult[], strategy: string): Promise<any> {
    const successfulResults = results.filter(r => r.success)
    
    switch (strategy) {
      case 'single_result':
        return successfulResults[0].result
        
      case 'search_merge':
        return this.mergeSearchResults(successfulResults)
        
      case 'calculation_verify':
        return this.verifyCalculationResults(successfulResults)
        
      case 'file_operation_summary':
        return this.summarizeFileOperations(successfulResults)
        
      case 'general_merge':
        return this.performGeneralMerge(successfulResults)
        
      case 'error_summary':
        return this.createErrorSummary(results)
        
      default:
        return this.performGeneralMerge(successfulResults)
    }
  }

  /**
   * 合并搜索结果
   */
  private mergeSearchResults(results: ToolExecutionResult[]): any {
    const allResults: any[] = []
    const sources = new Set<string>()
    
    for (const result of results) {
      if (result.result && Array.isArray(result.result)) {
        allResults.push(...result.result)
        sources.add(result.toolName)
      } else if (result.result) {
        allResults.push(result.result)
        sources.add(result.toolName)
      }
    }
    
    // 去重和排序
    const uniqueResults = this.deduplicateResults(allResults)
    const sortedResults = this.sortResultsByRelevance(uniqueResults)
    
    return {
      type: 'search_results',
      results: sortedResults.slice(0, 20), // 限制结果数量
      sources: Array.from(sources),
      totalCount: sortedResults.length,
      aggregatedAt: Date.now()
    }
  }

  /**
   * 验证计算结果
   */
  private verifyCalculationResults(results: ToolExecutionResult[]): any {
    const calculations = results.map(r => ({
      tool: r.toolName,
      result: r.result,
      executionTime: r.executionTime
    }))
    
    // 检查结果一致性
    const values = calculations.map(c => c.result).filter(v => typeof v === 'number')
    const isConsistent = values.length > 1 ? values.every(v => Math.abs(v - values[0]) < 0.0001) : true
    
    return {
      type: 'calculation_result',
      value: values[0],
      isVerified: isConsistent,
      calculations,
      confidence: isConsistent ? 0.95 : 0.7,
      verifiedAt: Date.now()
    }
  }

  /**
   * 汇总文件操作结果
   */
  private summarizeFileOperations(results: ToolExecutionResult[]): any {
    const operations = results.map(r => ({
      tool: r.toolName,
      operation: this.inferFileOperation(r.toolName),
      result: r.result,
      success: r.success,
      executionTime: r.executionTime
    }))
    
    return {
      type: 'file_operation_summary',
      operations,
      successCount: operations.filter(op => op.success).length,
      totalOperations: operations.length,
      summarizedAt: Date.now()
    }
  }

  /**
   * 通用结果合并
   */
  private performGeneralMerge(results: ToolExecutionResult[]): any {
    if (results.length === 1) {
      return results[0].result
    }
    
    return {
      type: 'merged_results',
      results: results.map(r => ({
        tool: r.toolName,
        result: r.result,
        executionTime: r.executionTime
      })),
      mergedAt: Date.now()
    }
  }

  /**
   * 创建错误摘要
   */
  private createErrorSummary(results: ToolExecutionResult[]): any {
    const errors = results.filter(r => !r.success).map(r => ({
      tool: r.toolName,
      error: r.error,
      executionTime: r.executionTime
    }))
    
    return {
      type: 'error_summary',
      message: '所有工具执行都失败了',
      errors,
      totalAttempts: results.length,
      summarizedAt: Date.now()
    }
  }

  /**
   * 计算聚合置信度
   */
  private calculateAggregationConfidence(
    results: ToolExecutionResult[],
    successCount: number,
    failureCount: number
  ): number {
    if (results.length === 0) return 0
    
    const successRate = successCount / results.length
    let confidence = successRate
    
    // 多个成功结果增加置信度
    if (successCount > 1) {
      confidence = Math.min(confidence + 0.1, 1.0)
    }
    
    // 快速执行增加置信度
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length
    if (avgExecutionTime < 5000) { // 5秒以内
      confidence = Math.min(confidence + 0.05, 1.0)
    }
    
    return confidence
  }

  // 辅助方法

  private getToolType(toolName: string): string {
    const name = toolName.toLowerCase()
    
    if (name.includes('search')) return 'search'
    if (name.includes('calc') || name.includes('math')) return 'calculation'
    if (name.includes('file')) return 'file_operation'
    if (name.includes('web') || name.includes('http')) return 'web_request'
    if (name.includes('time') || name.includes('date')) return 'time_service'
    
    return 'general'
  }

  private deduplicateResults(results: any[]): any[] {
    const seen = new Set()
    const unique: any[] = []
    
    for (const result of results) {
      const key = JSON.stringify(result)
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(result)
      }
    }
    
    return unique
  }

  private sortResultsByRelevance(results: any[]): any[] {
    // 简单的相关性排序，实际应用中可以更复杂
    return results.sort((a, b) => {
      // 优先显示有标题的结果
      const aHasTitle = a.title || a.name
      const bHasTitle = b.title || b.name
      
      if (aHasTitle && !bHasTitle) return -1
      if (!aHasTitle && bHasTitle) return 1
      
      return 0
    })
  }

  private inferFileOperation(toolName: string): string {
    const name = toolName.toLowerCase()
    
    if (name.includes('read')) return 'read'
    if (name.includes('write')) return 'write'
    if (name.includes('list')) return 'list'
    if (name.includes('search')) return 'search'
    if (name.includes('delete')) return 'delete'
    
    return 'unknown'
  }
}

/**
 * 工具执行任务类
 */
class ToolExecutionTask implements ParallelTask {
  public readonly id: string
  private toolName: string
  private serverId: string
  private parameters: Record<string, any>
  private timeout: number
  private retryAttempts: number

  constructor(
    id: string,
    toolName: string,
    serverId: string,
    parameters: Record<string, any>,
    timeout: number = 30000,
    retryAttempts: number = 2
  ) {
    this.id = id
    this.toolName = toolName
    this.serverId = serverId
    this.parameters = parameters
    this.timeout = timeout
    this.retryAttempts = retryAttempts
  }

  async execute(): Promise<ToolExecutionResult> {
    const startTime = Date.now()
    let lastError: string | undefined
    
    // 重试逻辑
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`🔧 执行工具: ${this.toolName} (尝试 ${attempt + 1}/${this.retryAttempts + 1})`)
        
        // 🚀 使用新的LLM-MCP处理器执行工具调用
        const result = await Promise.race([
          llmMCPHandler.executeToolCall(this.toolName, this.parameters),
          this.createTimeoutPromise()
        ])
        
        const endTime = Date.now()
        const executionTime = endTime - startTime
        
        if (result.success) {
          console.log(`✅ 工具执行成功: ${this.toolName} (${executionTime}ms)`)
          
          return {
            stepId: this.id,
            toolName: this.toolName,
            serverId: this.serverId,
            success: true,
            result: result.data,
            executionTime,
            startTime,
            endTime,
            metadata: {
              attempt: attempt + 1,
              totalAttempts: this.retryAttempts + 1
            }
          }
        } else {
          lastError = result.error || 'Unknown error'
          console.warn(`⚠️ 工具执行失败: ${this.toolName}, 错误: ${lastError}`)
          
          if (attempt < this.retryAttempts) {
            // 指数退避
            const delay = Math.pow(2, attempt) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Execution error'
        console.error(`❌ 工具执行异常: ${this.toolName}`, error)
        
        if (attempt < this.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
    }
    
    // 所有尝试都失败了
    const endTime = Date.now()
    const executionTime = endTime - startTime
    
    return {
      stepId: this.id,
      toolName: this.toolName,
      serverId: this.serverId,
      success: false,
      error: lastError || 'All retry attempts failed',
      executionTime,
      startTime,
      endTime,
      metadata: {
        attempt: this.retryAttempts + 1,
        totalAttempts: this.retryAttempts + 1,
        allAttemptsFailed: true
      }
    }
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timeout after ${this.timeout}ms`))
      }, this.timeout)
    })
  }
}