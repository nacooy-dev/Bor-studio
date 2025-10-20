/**
 * 基础流程测试
 * 验证流程引擎的核心功能
 */

import { FlowNode, FlowInput, FlowOutput, defaultFlowEngine, createFlow } from '../index'

/**
 * 简单的测试节点
 */
class TestNode extends FlowNode {
  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input',
        recoverable: false,
        retryable: false,
      })
    }

    const result = {
      message: `Hello from ${this.name}!`,
      input: input.data,
      timestamp: Date.now(),
    }

    return this.createOutput(result, this.successors, input.context, {
      nodeType: this.type,
      executionTime: Date.now() - input.context.startTime,
    })
  }
}

/**
 * 数据处理节点
 */
class DataProcessorNode extends FlowNode {
  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input',
        recoverable: false,
        retryable: false,
      })
    }

    const processed = {
      original: input.data,
      processed: true,
      processedAt: new Date().toISOString(),
      processorName: this.name,
    }

    return this.createOutput(processed, this.successors, input.context)
  }
}

/**
 * 运行基础流程测试
 */
export async function runBasicFlowTest(): Promise<{
  success: boolean
  results: any[]
  errors: string[]
}> {
  const results: any[] = []
  const errors: string[] = []

  try {
    console.log('🧪 开始基础流程测试...')

    // 1. 创建测试节点
    const startNode = new TestNode({
      id: 'start',
      name: '开始节点',
      type: 'TestNode',
      successors: ['processor'],
      errorHandlers: [],
      params: {},
    })

    const processorNode = new DataProcessorNode({
      id: 'processor',
      name: '数据处理节点',
      type: 'DataProcessorNode',
      successors: ['end'],
      errorHandlers: [],
      params: {},
    })

    const endNode = new TestNode({
      id: 'end',
      name: '结束节点',
      type: 'TestNode',
      successors: [],
      errorHandlers: [],
      params: {},
    })

    // 2. 注册节点
    defaultFlowEngine.registerNode(startNode)
    defaultFlowEngine.registerNode(processorNode)
    defaultFlowEngine.registerNode(endNode)

    results.push('✅ 节点注册成功')

    // 3. 创建流程定义
    const flowDefinition = createFlow()
      .flow('test-flow', '基础测试流程', '测试流程引擎的基本功能')
      .startWith('start')
      .addNode('start', '开始节点', 'TestNode').then('processor').done()
      .addNode('processor', '数据处理节点', 'DataProcessorNode').then('end').done()
      .addNode('end', '结束节点', 'TestNode').done()
      .setTimeout(30000)
      .build()

    defaultFlowEngine.registerFlow(flowDefinition)
    results.push('✅ 流程定义创建成功')

    // 4. 执行流程
    const testData = {
      message: 'Hello, Flow Engine!',
      timestamp: Date.now(),
    }

    const execution = await defaultFlowEngine.executeFlow('test-flow', testData, {
      userId: 'test-user',
      sessionId: 'test-session',
    })

    results.push('✅ 流程执行成功')
    results.push(`📊 执行结果: ${JSON.stringify(execution.result, null, 2)}`)
    results.push(`⏱️ 执行时间: ${execution.duration}ms`)
    results.push(`🔄 执行步骤: ${execution.executionPath.length}`)

    // 5. 验证结果
    if (execution.status === 'completed' && execution.result) {
      results.push('✅ 流程状态验证通过')
      
      if (execution.result.processed === true) {
        results.push('✅ 数据处理验证通过')
      } else {
        errors.push('❌ 数据处理验证失败')
      }
    } else {
      errors.push('❌ 流程状态验证失败')
    }

    // 6. 测试统计信息
    const stats = defaultFlowEngine.getStats()
    results.push(`📈 引擎统计: ${JSON.stringify(stats)}`)

    console.log('🎉 基础流程测试完成')
    return {
      success: errors.length === 0,
      results,
      errors,
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    errors.push(`❌ 测试执行失败: ${errorMessage}`)
    console.error('❌ 基础流程测试失败:', error)
    
    return {
      success: false,
      results,
      errors,
    }
  }
}

/**
 * 运行错误处理测试
 */
export async function runErrorHandlingTest(): Promise<{
  success: boolean
  results: any[]
  errors: string[]
}> {
  const results: any[] = []
  const errors: string[] = []

  try {
    console.log('🧪 开始错误处理测试...')

    // 创建会失败的节点
    class FailingNode extends FlowNode {
      async execute(input: FlowInput): Promise<FlowOutput> {
        return this.createErrorOutput({
          code: 'INTENTIONAL_FAILURE',
          message: 'This node always fails for testing',
          recoverable: true,
          retryable: false,
        })
      }
    }

    // 创建错误恢复节点
    class RecoveryNode extends FlowNode {
      async execute(input: FlowInput): Promise<FlowOutput> {
        return this.createOutput({
          message: 'Recovered from error',
          timestamp: Date.now(),
        })
      }
    }

    const failingNode = new FailingNode({
      id: 'failing',
      name: '失败节点',
      type: 'FailingNode',
      successors: [],
      errorHandlers: ['recovery'],
      params: {},
    })

    const recoveryNode = new RecoveryNode({
      id: 'recovery',
      name: '恢复节点',
      type: 'RecoveryNode',
      successors: [],
      errorHandlers: [],
      params: {},
    })

    defaultFlowEngine.registerNode(failingNode)
    defaultFlowEngine.registerNode(recoveryNode)

    const errorFlowDefinition = createFlow()
      .flow('error-test-flow', '错误处理测试流程')
      .startWith('failing')
      .addNode('failing', '失败节点', 'FailingNode').onError('recovery').done()
      .addNode('recovery', '恢复节点', 'RecoveryNode').done()
      .build()

    defaultFlowEngine.registerFlow(errorFlowDefinition)

    const execution = await defaultFlowEngine.executeFlow('error-test-flow', { test: true })

    if (execution.status === 'completed' && execution.result?.message === 'Recovered from error') {
      results.push('✅ 错误处理测试通过')
    } else {
      errors.push('❌ 错误处理测试失败')
    }

    return {
      success: errors.length === 0,
      results,
      errors,
    }

  } catch (error) {
    errors.push(`❌ 错误处理测试异常: ${error}`)
    return {
      success: false,
      results,
      errors,
    }
  }
}