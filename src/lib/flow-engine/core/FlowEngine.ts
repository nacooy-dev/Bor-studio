/**
 * 流程执行引擎
 * 参考PocketFlow设计，提供轻量级的流程编排能力
 */

import { FlowNode, FlowInput, FlowOutput, FlowContext, FlowError } from './FlowNode'

export interface FlowDefinition {
  id: string
  name: string
  description?: string
  startNode: string
  nodes: FlowNodeDefinition[]
  variables?: Record<string, any>
  timeout?: number
}

export interface FlowNodeDefinition {
  id: string
  name: string
  type: string
  successors: string[]
  errorHandlers: string[]
  params: Record<string, any>
}

export interface FlowExecution {
  flowId: string
  flowName: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  currentNode?: string
  executionPath: any[]
  context: FlowContext
  result?: any
  error?: FlowError
}

export interface FlowEngineConfig {
  maxConcurrentFlows?: number
  defaultTimeout?: number
  enableLogging?: boolean
  enableMetrics?: boolean
}

/**
 * 流程执行引擎
 */
export class FlowEngine {
  private nodeRegistry: Map<string, FlowNode> = new Map()
  private flowDefinitions: Map<string, FlowDefinition> = new Map()
  private activeExecutions: Map<string, FlowExecution> = new Map()
  private config: FlowEngineConfig

  constructor(config: FlowEngineConfig = {}) {
    this.config = {
      maxConcurrentFlows: 100,
      defaultTimeout: 300000, // 5分钟
      enableLogging: true,
      enableMetrics: false,
      ...config,
    }
  }

  /**
   * 注册流程节点
   */
  registerNode(node: FlowNode): void {
    this.nodeRegistry.set(node.id, node)
    if (this.config.enableLogging) {
      console.log(`✅ 注册流程节点: ${node.id} (${node.type})`)
    }
  }

  /**
   * 注册流程定义
   */
  registerFlow(definition: FlowDefinition): void {
    this.flowDefinitions.set(definition.id, definition)
    if (this.config.enableLogging) {
      console.log(`✅ 注册流程定义: ${definition.id} - ${definition.name}`)
    }
  }

  /**
   * 执行流程
   */
  async executeFlow(
    flowId: string,
    initialData: any,
    context: Partial<FlowContext> = {}
  ): Promise<FlowExecution> {
    const flowDefinition = this.flowDefinitions.get(flowId)
    if (!flowDefinition) {
      throw new Error(`Flow definition not found: ${flowId}`)
    }

    // 检查并发限制
    if (this.activeExecutions.size >= this.config.maxConcurrentFlows!) {
      throw new Error('Maximum concurrent flows exceeded')
    }

    // 创建执行上下文
    const executionId = `${flowId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fullContext: FlowContext = {
      sessionId: context.sessionId || executionId,
      userId: context.userId || 'anonymous',
      conversationHistory: context.conversationHistory || [],
      userProfile: context.userProfile || {},
      systemState: context.systemState || {},
      executionPath: [],
      startTime: Date.now(),
      variables: { ...flowDefinition.variables, ...context.variables },
    }

    // 创建执行实例
    const execution: FlowExecution = {
      flowId: executionId,
      flowName: flowDefinition.name,
      startTime: Date.now(),
      status: 'running',
      currentNode: flowDefinition.startNode,
      executionPath: [],
      context: fullContext,
    }

    this.activeExecutions.set(executionId, execution)

    if (this.config.enableLogging) {
      console.log(`🚀 开始执行流程: ${flowDefinition.name}`)
    }

    try {
      const result = await this.executeFlowInternal(execution, initialData)
      execution.status = 'completed'
      execution.endTime = Date.now()
      execution.duration = execution.endTime - execution.startTime
      execution.result = result

      if (this.config.enableLogging) {
        console.log(`🎉 流程执行完成: ${flowDefinition.name}，耗时 ${execution.duration}ms，共 ${execution.executionPath.length} 步`)
      }

      return execution
    } catch (error) {
      execution.status = 'failed'
      execution.endTime = Date.now()
      execution.duration = execution.endTime - execution.startTime
      execution.error = {
        code: 'FLOW_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Flow execution failed',
        details: error,
        recoverable: false,
        retryable: false,
      }

      if (this.config.enableLogging) {
        console.error(`❌ 流程执行失败: ${flowDefinition.name}`, error)
      }

      throw error
    } finally {
      this.activeExecutions.delete(executionId)
    }
  }

  /**
   * 内部流程执行逻辑
   */
  private async executeFlowInternal(execution: FlowExecution, data: any): Promise<any> {
    let currentData = data
    let currentNodeId = execution.currentNode!
    const visitedNodes = new Set<string>()
    const maxIterations = 100 // 防止无限循环

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // 检查是否已访问过此节点（简单的循环检测）
      if (visitedNodes.has(currentNodeId)) {
        console.warn(`⚠️ 检测到可能的循环: ${currentNodeId}`)
      }
      visitedNodes.add(currentNodeId)

      // 获取当前节点
      const currentNode = this.nodeRegistry.get(currentNodeId)
      if (!currentNode) {
        throw new Error(`Node not found: ${currentNodeId}`)
      }

      if (this.config.enableLogging) {
        console.log(`🚀 执行节点: ${currentNode.name}`)
      }

      // 更新执行状态
      execution.currentNode = currentNodeId

      // 准备输入
      const input: FlowInput = {
        data: currentData,
        context: execution.context,
        metadata: {
          flowId: execution.flowId,
          nodeId: currentNodeId,
          iteration,
        },
      }

      // 执行节点
      const startTime = Date.now()
      const output = await currentNode.executeWithTimeout(input)
      const endTime = Date.now()

      if (this.config.enableLogging) {
        console.log(`⏱️ ${currentNode.name} 完成，耗时 ${endTime - startTime}ms，下一步: ${output.nextNodes.join(', ') || '结束'}`)
      }

      // 更新执行路径
      execution.executionPath.push({
        step: iteration,
        node: {
          id: currentNode.id,
          name: currentNode.name,
          type: currentNode.type,
          successors: currentNode.successors,
          params: currentNode.params,
        },
        timestamp: startTime,
      })

      // 处理错误
      if (output.error) {
        if (output.error.recoverable && output.nextNodes.length > 0) {
          // 有错误处理节点，继续执行
          currentNodeId = output.nextNodes[0]
          currentData = output.data
          continue
        } else {
          // 不可恢复的错误，终止执行
          throw new Error(`Node execution failed: ${output.error.message}`)
        }
      }

      // 更新数据和上下文
      currentData = output.data
      execution.context = output.context

      // 检查是否有下一个节点
      if (!output.nextNodes || output.nextNodes.length === 0) {
        // 流程结束
        if (this.config.enableLogging) {
          console.log(`🔚 未找到后继节点 '${output.nextNodes?.[0] || 'undefined'}'，流程结束`)
        }
        break
      }

      // 选择下一个节点（简单选择第一个）
      currentNodeId = output.nextNodes[0]
    }

    if (visitedNodes.size >= maxIterations) {
      throw new Error('Flow execution exceeded maximum iterations, possible infinite loop')
    }

    return currentData
  }

  /**
   * 取消流程执行
   */
  async cancelFlow(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId)
    if (!execution) {
      return false
    }

    execution.status = 'cancelled'
    execution.endTime = Date.now()
    execution.duration = execution.endTime - execution.startTime

    this.activeExecutions.delete(executionId)

    if (this.config.enableLogging) {
      console.log(`🛑 流程已取消: ${execution.flowName}`)
    }

    return true
  }

  /**
   * 获取活跃的流程执行
   */
  getActiveExecutions(): FlowExecution[] {
    return Array.from(this.activeExecutions.values())
  }

  /**
   * 获取流程执行状态
   */
  getExecutionStatus(executionId: string): FlowExecution | null {
    return this.activeExecutions.get(executionId) || null
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 取消所有活跃的执行
    const cancelPromises = Array.from(this.activeExecutions.keys()).map(id => this.cancelFlow(id))
    await Promise.all(cancelPromises)

    // 清理节点
    for (const node of this.nodeRegistry.values()) {
      try {
        await node.cleanup()
      } catch (error) {
        console.error(`Error cleaning up node ${node.id}:`, error)
      }
    }

    this.nodeRegistry.clear()
    this.flowDefinitions.clear()

    if (this.config.enableLogging) {
      console.log('🧹 流程引擎已清理')
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    registeredNodes: number
    registeredFlows: number
    activeExecutions: number
    totalExecutions: number
  } {
    return {
      registeredNodes: this.nodeRegistry.size,
      registeredFlows: this.flowDefinitions.size,
      activeExecutions: this.activeExecutions.size,
      totalExecutions: this.activeExecutions.size, // 简化实现
    }
  }
}