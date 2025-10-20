/**
 * 上下文更新节点
 * 更新对话上下文和历史记录
 */

import { FlowNode, FlowInput, FlowOutput } from '../core/FlowNode'
import { SynthesizedResponse } from './ResponseSynthesisNode'

/**
 * 上下文更新节点
 */
export class ContextUpdateNode extends FlowNode {
  constructor(config: any) {
    super({
      id: config.id || 'context_update',
      name: config.name || '上下文更新节点',
      type: 'ContextUpdateNode',
      successors: config.successors || [],
      errorHandlers: config.errorHandlers || ['context_update_error'],
      timeout: config.timeout || 5000,
      params: config.params || {}
    })
  }

  async execute(input: FlowInput): Promise<FlowOutput> {
    try {
      const response = input.data as SynthesizedResponse
      const context = input.context

      // 简单的上下文更新（后续可以扩展）
      const updatedContext = {
        ...context,
        lastResponse: response,
        lastUpdateTime: Date.now()
      }

      console.log('📝 上下文已更新')

      return this.createOutput(
        response,
        this.successors,
        updatedContext,
        {
          contextUpdated: true,
          updateTime: Date.now() - input.context.startTime
        }
      )

    } catch (error) {
      return this.createErrorOutput({
        code: 'CONTEXT_UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Context update failed',
        details: error,
        recoverable: true,
        retryable: false
      })
    }
  }
}