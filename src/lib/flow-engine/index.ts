/**
 * 流程引擎入口文件
 * 导出所有核心组件和工具
 */

// 核心组件
export { FlowNode, ConditionalFlowNode, ParallelFlowNode } from './core/FlowNode'
export { FlowEngine } from './core/FlowEngine'
export { FlowBuilder, NodeBuilder, createFlow, FlowTemplates } from './core/FlowBuilder'

// 类型定义
export type {
  FlowInput,
  FlowOutput,
  FlowContext,
  FlowError,
  ExecutionStep,
  NodeConfig,
  ParallelTask,
  ParallelResult,
} from './core/FlowNode'

export type {
  FlowDefinition,
  FlowNodeDefinition,
  FlowExecution,
  FlowEngineConfig,
} from './core/FlowEngine'

// 创建默认的流程引擎实例
export const defaultFlowEngine = new FlowEngine({
  maxConcurrentFlows: 50,
  defaultTimeout: 300000, // 5分钟
  enableLogging: true,
  enableMetrics: false,
})

/**
 * 便捷的流程执行函数
 */
export async function executeFlow(
  flowId: string,
  initialData: any,
  context: Partial<FlowContext> = {}
) {
  return defaultFlowEngine.executeFlow(flowId, initialData, context)
}

/**
 * 便捷的节点注册函数
 */
export function registerNode(node: FlowNode) {
  defaultFlowEngine.registerNode(node)
}

/**
 * 便捷的流程注册函数
 */
export function registerFlow(definition: FlowDefinition) {
  defaultFlowEngine.registerFlow(definition)
}