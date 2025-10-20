/**
 * 流程节点基类
 * 参考PocketFlow设计，提供轻量级的节点抽象
 */

export interface FlowInput {
  data: any
  context: FlowContext
  metadata: Record<string, any>
}

export interface FlowOutput {
  data: any
  nextNodes: string[]
  context: FlowContext
  metadata: Record<string, any>
  error?: FlowError
}

export interface FlowContext {
  sessionId: string
  userId: string
  conversationHistory: any[]
  userProfile: Record<string, any>
  systemState: Record<string, any>
  executionPath: ExecutionStep[]
  startTime: number
  variables: Record<string, any>
}

export interface ExecutionStep {
  nodeId: string
  nodeName: string
  startTime: number
  endTime?: number
  duration?: number
  input: any
  output?: any
  error?: FlowError
  metadata: Record<string, any>
}

export interface FlowError {
  code: string
  message: string
  details?: any
  recoverable: boolean
  retryable: boolean
}

export interface NodeConfig {
  id: string
  name: string
  type: string
  successors: string[]
  errorHandlers: string[]
  timeout?: number
  retryCount?: number
  params: Record<string, any>
}

/**
 * 流程节点抽象基类
 */
export abstract class FlowNode {
  public readonly id: string
  public readonly name: string
  public readonly type: string
  public readonly successors: string[]
  public readonly errorHandlers: string[]
  public readonly timeout: number
  public readonly retryCount: number
  public readonly params: Record<string, any>

  constructor(config: NodeConfig) {
    this.id = config.id
    this.name = config.name
    this.type = config.type
    this.successors = config.successors || []
    this.errorHandlers = config.errorHandlers || []
    this.timeout = config.timeout || 30000 // 30秒默认超时
    this.retryCount = config.retryCount || 0
    this.params = config.params || {}
  }

  /**
   * 节点执行的核心方法，子类必须实现
   */
  abstract execute(input: FlowInput): Promise<FlowOutput>

  /**
   * 节点初始化，可选实现
   */
  async initialize(): Promise<void> {
    // 默认空实现
  }

  /**
   * 节点清理，可选实现
   */
  async cleanup(): Promise<void> {
    // 默认空实现
  }

  /**
   * 验证输入数据
   */
  protected validateInput(input: FlowInput): boolean {
    return input && input.data !== undefined && input.context !== undefined
  }

  /**
   * 创建输出对象
   */
  protected createOutput(
    data: any,
    nextNodes: string[] = [],
    context?: FlowContext,
    metadata: Record<string, any> = {}
  ): FlowOutput {
    return {
      data,
      nextNodes: nextNodes.length > 0 ? nextNodes : this.successors,
      context: context || ({} as FlowContext),
      metadata,
    }
  }

  /**
   * 创建错误输出
   */
  protected createErrorOutput(
    error: FlowError,
    context?: FlowContext,
    metadata: Record<string, any> = {}
  ): FlowOutput {
    return {
      data: null,
      nextNodes: this.errorHandlers,
      context: context || ({} as FlowContext),
      metadata,
      error,
    }
  }

  /**
   * 记录执行步骤
   */
  protected recordExecution(
    input: FlowInput,
    output: FlowOutput,
    startTime: number,
    endTime: number
  ): ExecutionStep {
    return {
      nodeId: this.id,
      nodeName: this.name,
      startTime,
      endTime,
      duration: endTime - startTime,
      input: input.data,
      output: output.data,
      error: output.error,
      metadata: {
        ...input.metadata,
        ...output.metadata,
      },
    }
  }

  /**
   * 带超时和重试的执行包装器
   */
  async executeWithTimeout(input: FlowInput): Promise<FlowOutput> {
    const startTime = Date.now()
    let lastError: FlowError | null = null

    // 重试逻辑
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        // 超时控制
        const executePromise = this.execute(input)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Node ${this.id} execution timeout after ${this.timeout}ms`))
          }, this.timeout)
        })

        const output = await Promise.race([executePromise, timeoutPromise])
        const endTime = Date.now()

        // 记录执行步骤
        const step = this.recordExecution(input, output, startTime, endTime)
        if (input.context.executionPath) {
          input.context.executionPath.push(step)
        }

        return output
      } catch (error) {
        const flowError: FlowError = {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
          recoverable: attempt < this.retryCount,
          retryable: true,
        }

        lastError = flowError

        if (attempt < this.retryCount) {
          console.warn(`Node ${this.id} execution failed, retrying (${attempt + 1}/${this.retryCount})`)
          // 指数退避
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          continue
        }
      }
    }

    // 所有重试都失败了
    const endTime = Date.now()
    const errorOutput = this.createErrorOutput(lastError!, input.context)
    const step = this.recordExecution(input, errorOutput, startTime, endTime)
    if (input.context.executionPath) {
      input.context.executionPath.push(step)
    }

    return errorOutput
  }
}

/**
 * 条件节点基类
 * 用于实现条件分支逻辑
 */
export abstract class ConditionalFlowNode extends FlowNode {
  /**
   * 评估条件，返回下一个节点ID
   */
  abstract evaluateCondition(input: FlowInput): Promise<string>

  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input data',
        recoverable: false,
        retryable: false,
      })
    }

    try {
      const nextNodeId = await this.evaluateCondition(input)
      return this.createOutput(input.data, [nextNodeId], input.context)
    } catch (error) {
      return this.createErrorOutput({
        code: 'CONDITION_EVALUATION_ERROR',
        message: error instanceof Error ? error.message : 'Condition evaluation failed',
        details: error,
        recoverable: false,
        retryable: true,
      })
    }
  }
}

/**
 * 并行节点基类
 * 用于实现并行执行逻辑
 */
export abstract class ParallelFlowNode extends FlowNode {
  /**
   * 获取并行执行的子任务
   */
  abstract getParallelTasks(input: FlowInput): Promise<ParallelTask[]>

  /**
   * 聚合并行执行结果
   */
  abstract aggregateResults(results: ParallelResult[], input: FlowInput): Promise<any>

  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input data',
        recoverable: false,
        retryable: false,
      })
    }

    try {
      const tasks = await this.getParallelTasks(input)
      const results = await Promise.allSettled(
        tasks.map(task => this.executeTask(task))
      )

      const parallelResults: ParallelResult[] = results.map((result, index) => ({
        taskId: tasks[index].id,
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
      }))

      const aggregatedData = await this.aggregateResults(parallelResults, input)
      return this.createOutput(aggregatedData, this.successors, input.context)
    } catch (error) {
      return this.createErrorOutput({
        code: 'PARALLEL_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Parallel execution failed',
        details: error,
        recoverable: false,
        retryable: true,
      })
    }
  }

  private async executeTask(task: ParallelTask): Promise<any> {
    // 实现具体的任务执行逻辑
    return task.execute()
  }
}

export interface ParallelTask {
  id: string
  execute(): Promise<any>
}

export interface ParallelResult {
  taskId: string
  success: boolean
  data: any
  error?: any
}