/**
 * 流程引擎集成服务
 * 将流程引擎集成到ChatView中
 */

import { FlowEngine } from './core/FlowEngine'
import { FlowBuilder } from './core/FlowBuilder'
import { IntentAnalysisNode } from './nodes/IntentAnalysisNode'
import { MCPToolSelectionNode } from './nodes/MCPToolSelectionNode'
import { ParallelToolExecutionNode } from './nodes/ParallelToolExecutionNode'
import { ToolResultProcessingNode } from './nodes/ToolResultProcessingNode'
import { ResponseSynthesisNode } from './nodes/ResponseSynthesisNode'
import { ContextUpdateNode } from './nodes/ContextUpdateNode'
import { GeneralResponseNode } from './nodes/GeneralResponseNode'

export interface FlowResponse {
  success: boolean
  content: string
  metadata: {
    confidence: number
    toolsUsed: string[]
    processingTime: number
    sources: string[]
  }
  suggestions: string[]
  followUpActions: any[]
}

export class FlowIntegration {
  private flowEngine: FlowEngine
  private isInitialized = false

  constructor() {
    this.flowEngine = new FlowEngine()
  }

  /**
   * 初始化流程引擎
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🚀 初始化流程引擎...')

      // 创建流程构建器
      const builder = new FlowBuilder()

      // 构建完整的处理流程
      const flow = builder
        .flow('main_chat_flow', 'Main Chat Flow', 'Complete chat processing flow')
        .startWith('intent_analysis')
        .addNode('intent_analysis', '意图分析节点', 'IntentAnalysisNode')
          .then('mcp_tool_selection')
          .done()
        .addNode('mcp_tool_selection', 'MCP工具选择节点', 'MCPToolSelectionNode')
          .then('parallel_tool_execution')
          .done()
        .addNode('parallel_tool_execution', '并行工具执行节点', 'ParallelToolExecutionNode')
          .then('tool_result_processing')
          .done()
        .addNode('tool_result_processing', '工具结果处理节点', 'ToolResultProcessingNode')
          .then('response_synthesis')
          .done()
        .addNode('response_synthesis', '响应合成节点', 'ResponseSynthesisNode')
          .then('context_update')
          .done()
        .addNode('context_update', '上下文更新节点', 'ContextUpdateNode')
          .done()
        .addNode('general_response', '通用响应节点', 'GeneralResponseNode')
          .done()
        .build()

      // 注册节点实例
      this.flowEngine.registerNode(new IntentAnalysisNode({ id: 'intent_analysis' }))
      this.flowEngine.registerNode(new MCPToolSelectionNode({ id: 'mcp_tool_selection' }))
      this.flowEngine.registerNode(new ParallelToolExecutionNode({ id: 'parallel_tool_execution' }))
      this.flowEngine.registerNode(new ToolResultProcessingNode({ id: 'tool_result_processing' }))
      this.flowEngine.registerNode(new ResponseSynthesisNode({ id: 'response_synthesis' }))
      this.flowEngine.registerNode(new ContextUpdateNode({ id: 'context_update' }))
      this.flowEngine.registerNode(new GeneralResponseNode({ id: 'general_response' }))

      // 注册流程
      this.flowEngine.registerFlow(flow)

      this.isInitialized = true
      console.log('✅ 流程引擎初始化完成')

    } catch (error) {
      console.error('❌ 流程引擎初始化失败:', error)
      throw error
    }
  }

  /**
   * 处理用户输入
   */
  async processUserInput(
    userInput: string,
    conversationHistory: any[] = [],
    options: any = {}
  ): Promise<FlowResponse> {
    console.log('🚀 FlowIntegration.processUserInput 被调用，输入:', userInput)
    
    if (!this.isInitialized) {
      console.log('⚠️ 流程引擎未初始化，开始初始化...')
      await this.initialize()
    }

    try {
      console.log('🔄 开始处理用户输入:', userInput)

      // 创建执行上下文
      const context = {
        sessionId: options.sessionId || 'default',
        userId: options.userId || 'user',
        startTime: Date.now(),
        conversationHistory,
        userProfile: options.userProfile || {}
      }

      // 执行流程
      const execution = await this.flowEngine.executeFlow('main_chat_flow', {
        originalInput: userInput,
        conversationHistory,
        timestamp: Date.now()
      }, context)

      if (execution.status === 'completed' && execution.result) {
        const synthesizedResponse = execution.result
        
        return {
          success: true,
          content: synthesizedResponse.content,
          metadata: synthesizedResponse.metadata,
          suggestions: synthesizedResponse.suggestions || [],
          followUpActions: synthesizedResponse.followUpActions || []
        }
      } else {
        // 流程执行失败，返回错误信息
        return {
          success: false,
          content: execution.error?.message || '处理失败，请稍后重试',
          metadata: {
            confidence: 0,
            toolsUsed: [],
            processingTime: Date.now() - context.startTime,
            sources: []
          },
          suggestions: ['重新尝试', '检查系统状态'],
          followUpActions: []
        }
      }

    } catch (error) {
      console.error('❌ 流程处理失败:', error)
      console.error('❌ 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace')
      
      return {
        success: false,
        content: '系统处理出现错误，请稍后重试',
        metadata: {
          confidence: 0,
          toolsUsed: [],
          processingTime: 0,
          sources: []
        },
        suggestions: ['重新尝试', '检查系统状态'],
        followUpActions: []
      }
    }
  }

  /**
   * 检查流程引擎状态
   */
  getStatus(): { initialized: boolean; flowCount: number } {
    return {
      initialized: this.isInitialized,
      flowCount: 1 // 目前只有一个主流程
    }
  }
}

// 创建全局实例
export const flowIntegration = new FlowIntegration()