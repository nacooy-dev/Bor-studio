/**
 * 通用响应节点
 * 处理不需要工具调用的普通对话
 */

import { FlowNode, FlowInput, FlowOutput } from '../core/FlowNode'

/**
 * 通用响应节点
 */
export class GeneralResponseNode extends FlowNode {
  constructor(config: any) {
    super({
      id: config.id || 'general_response',
      name: config.name || '通用响应节点',
      type: 'GeneralResponseNode',
      successors: config.successors || [],
      errorHandlers: config.errorHandlers || [],
      timeout: config.timeout || 5000,
      params: config.params || {}
    })
  }

  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input for general response',
        recoverable: false,
        retryable: false
      })
    }

    try {
      const intentData = input.data.intent
      const originalInput = input.data.originalInput || ''
      const context = input.context

      console.log('💬 处理通用响应，意图:', intentData.primaryIntent)

      // 创建简单的响应
      const response = {
        content: this.generateResponse(intentData, originalInput),
        format: 'markdown',
        metadata: {
          confidence: intentData.confidence,
          sources: [],
          processingTime: Date.now() - context.startTime,
          toolsUsed: [],
          responseType: 'general'
        },
        suggestions: this.generateSuggestions(intentData),
        followUpActions: []
      }

      console.log('✅ 通用响应生成完成')

      return this.createOutput(
        response,
        this.successors,
        context,
        {
          responseTime: Date.now() - input.context.startTime,
          intentType: intentData.primaryIntent,
          confidence: intentData.confidence
        }
      )

    } catch (error) {
      return this.createErrorOutput({
        code: 'GENERAL_RESPONSE_ERROR',
        message: error instanceof Error ? error.message : 'General response failed',
        details: error,
        recoverable: true,
        retryable: true
      })
    }
  }

  /**
   * 生成响应内容
   */
  private generateResponse(intentData: any, originalInput: string): string {
    const intent = intentData.primaryIntent

    switch (intent) {
      case 'greeting':
        return '您好！我是您的AI助手，很高兴为您服务。我可以帮您搜索信息、进行计算、查询时间等。有什么我可以帮助您的吗？'
      
      case 'farewell':
        return '再见！感谢您的使用，期待下次为您服务。'
      
      case 'help_request':
        return `我可以帮助您：
- 🔍 **搜索信息**：搜索网络内容或本地笔记
- 🧮 **数学计算**：进行各种数学运算
- 🕐 **时间查询**：获取当前时间或时区转换
- 📁 **文件操作**：读取文件内容
- ⚙️ **系统配置**：调整设置和偏好

请告诉我您需要什么帮助！`
      
      case 'clarification':
        return `抱歉，我没有完全理解您的请求。您可以：
- 更具体地描述您的需求
- 使用关键词如"搜索"、"计算"、"时间"等
- 或者说"帮助"来查看我能做什么

请重新表达您的需求。`
      
      case 'conversation':
      default:
        return `我理解您说的是"${originalInput}"。作为AI助手，我更擅长帮您完成具体任务。您可以尝试：
- 搜索相关信息
- 进行计算
- 查询时间
- 或者说"帮助"了解更多功能

有什么具体需要我帮助的吗？`
    }
  }

  /**
   * 生成建议
   */
  private generateSuggestions(intentData: any): string[] {
    const intent = intentData.primaryIntent

    switch (intent) {
      case 'greeting':
        return ['搜索信息', '数学计算', '查询时间', '查看帮助']
      
      case 'help_request':
        return ['搜索人工智能', '计算 2+2', '现在几点', '配置设置']
      
      case 'clarification':
        return ['搜索信息', '帮助', '计算', '时间查询']
      
      default:
        return ['搜索相关信息', '查看帮助', '其他问题']
    }
  }
}