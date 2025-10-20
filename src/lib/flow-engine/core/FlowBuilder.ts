/**
 * 流程构建器
 * 提供链式API来构建流程定义
 */

import { FlowDefinition, FlowNodeDefinition } from './FlowEngine'

export class FlowBuilder {
  private definition: Partial<FlowDefinition> = {
    nodes: [],
    variables: {},
  }

  /**
   * 设置流程基本信息
   */
  flow(id: string, name: string, description?: string): FlowBuilder {
    this.definition.id = id
    this.definition.name = name
    this.definition.description = description
    return this
  }

  /**
   * 设置起始节点
   */
  startWith(nodeId: string): FlowBuilder {
    this.definition.startNode = nodeId
    return this
  }

  /**
   * 添加节点
   */
  addNode(
    id: string,
    name: string,
    type: string,
    params: Record<string, any> = {}
  ): NodeBuilder {
    const nodeBuilder = new NodeBuilder(this, id, name, type, params)
    return nodeBuilder
  }

  /**
   * 设置流程变量
   */
  setVariables(variables: Record<string, any>): FlowBuilder {
    this.definition.variables = { ...this.definition.variables, ...variables }
    return this
  }

  /**
   * 设置流程超时
   */
  setTimeout(timeout: number): FlowBuilder {
    this.definition.timeout = timeout
    return this
  }

  /**
   * 构建流程定义
   */
  build(): FlowDefinition {
    if (!this.definition.id) {
      throw new Error('Flow ID is required')
    }
    if (!this.definition.name) {
      throw new Error('Flow name is required')
    }
    if (!this.definition.startNode) {
      throw new Error('Start node is required')
    }
    if (!this.definition.nodes || this.definition.nodes.length === 0) {
      throw new Error('At least one node is required')
    }

    return this.definition as FlowDefinition
  }

  /**
   * 内部方法：添加节点定义
   */
  _addNodeDefinition(nodeDefinition: FlowNodeDefinition): void {
    if (!this.definition.nodes) {
      this.definition.nodes = []
    }
    this.definition.nodes.push(nodeDefinition)
  }
}

export class NodeBuilder {
  private flowBuilder: FlowBuilder
  private nodeDefinition: FlowNodeDefinition

  constructor(
    flowBuilder: FlowBuilder,
    id: string,
    name: string,
    type: string,
    params: Record<string, any>
  ) {
    this.flowBuilder = flowBuilder
    this.nodeDefinition = {
      id,
      name,
      type,
      successors: [],
      errorHandlers: [],
      params,
    }
  }

  /**
   * 设置后继节点
   */
  then(...nodeIds: string[]): NodeBuilder {
    this.nodeDefinition.successors = nodeIds
    return this
  }

  /**
   * 设置错误处理节点
   */
  onError(...nodeIds: string[]): NodeBuilder {
    this.nodeDefinition.errorHandlers = nodeIds
    return this
  }

  /**
   * 设置节点参数
   */
  withParams(params: Record<string, any>): NodeBuilder {
    this.nodeDefinition.params = { ...this.nodeDefinition.params, ...params }
    return this
  }

  /**
   * 完成节点构建，返回流程构建器
   */
  done(): FlowBuilder {
    this.flowBuilder._addNodeDefinition(this.nodeDefinition)
    return this.flowBuilder
  }

  /**
   * 完成节点构建并添加新节点
   */
  addNode(
    id: string,
    name: string,
    type: string,
    params: Record<string, any> = {}
  ): NodeBuilder {
    this.flowBuilder._addNodeDefinition(this.nodeDefinition)
    return this.flowBuilder.addNode(id, name, type, params)
  }
}

/**
 * 创建流程构建器的便捷函数
 */
export function createFlow(): FlowBuilder {
  return new FlowBuilder()
}

/**
 * 预定义的流程模板
 */
export class FlowTemplates {
  /**
   * 创建简单的线性流程
   */
  static createLinearFlow(
    id: string,
    name: string,
    nodes: Array<{ id: string; name: string; type: string; params?: Record<string, any> }>
  ): FlowDefinition {
    const builder = createFlow().flow(id, name).startWith(nodes[0].id)

    nodes.forEach((node, index) => {
      const nodeBuilder = builder.addNode(node.id, node.name, node.type, node.params || {})
      
      if (index < nodes.length - 1) {
        nodeBuilder.then(nodes[index + 1].id)
      }
      
      nodeBuilder.done()
    })

    return builder.build()
  }

  /**
   * 创建带条件分支的流程
   */
  static createConditionalFlow(
    id: string,
    name: string,
    startNode: { id: string; name: string; type: string; params?: Record<string, any> },
    conditionNode: { id: string; name: string; type: string; params?: Record<string, any> },
    branches: Array<{ condition: string; nodes: Array<{ id: string; name: string; type: string; params?: Record<string, any> }> }>
  ): FlowDefinition {
    const builder = createFlow().flow(id, name).startWith(startNode.id)

    // 添加起始节点
    builder.addNode(startNode.id, startNode.name, startNode.type, startNode.params || {})
      .then(conditionNode.id)
      .done()

    // 添加条件节点
    const conditionNodeBuilder = builder.addNode(conditionNode.id, conditionNode.name, conditionNode.type, conditionNode.params || {})
    
    // 添加分支节点
    branches.forEach(branch => {
      if (branch.nodes.length > 0) {
        conditionNodeBuilder.then(branch.nodes[0].id)
        
        branch.nodes.forEach((node, index) => {
          const nodeBuilder = builder.addNode(node.id, node.name, node.type, node.params || {})
          
          if (index < branch.nodes.length - 1) {
            nodeBuilder.then(branch.nodes[index + 1].id)
          }
          
          nodeBuilder.done()
        })
      }
    })

    conditionNodeBuilder.done()

    return builder.build()
  }

  /**
   * 创建并行执行流程
   */
  static createParallelFlow(
    id: string,
    name: string,
    startNode: { id: string; name: string; type: string; params?: Record<string, any> },
    parallelNodes: Array<{ id: string; name: string; type: string; params?: Record<string, any> }>,
    aggregateNode: { id: string; name: string; type: string; params?: Record<string, any> }
  ): FlowDefinition {
    const builder = createFlow().flow(id, name).startWith(startNode.id)

    // 添加起始节点
    const startNodeBuilder = builder.addNode(startNode.id, startNode.name, startNode.type, startNode.params || {})
    startNodeBuilder.then(...parallelNodes.map(n => n.id))
    startNodeBuilder.done()

    // 添加并行节点
    parallelNodes.forEach(node => {
      builder.addNode(node.id, node.name, node.type, node.params || {})
        .then(aggregateNode.id)
        .done()
    })

    // 添加聚合节点
    builder.addNode(aggregateNode.id, aggregateNode.name, aggregateNode.type, aggregateNode.params || {})
      .done()

    return builder.build()
  }
}