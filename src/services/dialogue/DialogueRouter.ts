import { IntentRecognizer, IntentType, type IntentResult } from '../intent/IntentRecognizer'
import { SecureConfigManager } from '../config/SecureConfigManager'
import { llmManager } from '../../lib/llm-manager'
import { MCPDialogueHandler } from '../mcp/MCPDialogueHandler'
import { mcpManager } from '../mcp/MCPManager'
import type { Message } from '@/types'

// 对话处理器接口
export interface DialogueHandler {
  canHandle(intent: IntentResult): boolean
  handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse>
}

// 对话上下文
export interface DialogueContext {
  conversationHistory: Message[]
  currentUser?: string
  sessionId: string
  timestamp: number
}

// 对话响应
export interface DialogueResponse {
  message: string
  actions?: DialogueAction[]
  needsConfirmation?: boolean
  followUpQuestions?: string[]
  metadata?: Record<string, any>
}

// 对话动作
export interface DialogueAction {
  type: 'open_config' | 'switch_model' | 'execute_command' | 'show_ui' | 'redirect'
  payload: Record<string, any>
  description: string
}

// 对话路由器
export class DialogueRouter {
  private intentRecognizer: IntentRecognizer
  private configManager: SecureConfigManager
  private handlers: Map<IntentType, DialogueHandler> = new Map()
  private defaultHandler: DialogueHandler

  constructor() {
    this.intentRecognizer = new IntentRecognizer()
    this.configManager = new SecureConfigManager()
    this.defaultHandler = new GeneralChatHandler()
    this.initializeHandlers()
  }

  // 初始化处理器
  private initializeHandlers() {
    // 注册各种意图处理器，传入配置管理器
    this.handlers.set(IntentType.LLM_MANAGEMENT, new LLMManagementHandler(this.configManager))
    this.handlers.set(IntentType.SYSTEM_CONFIG, new SystemConfigHandler(this.configManager))
    this.handlers.set(IntentType.THEME_CHANGE, new ThemeChangeHandler(this.configManager))
    this.handlers.set(IntentType.KNOWLEDGE_BASE, new KnowledgeBaseHandler())
    this.handlers.set(IntentType.WORKFLOW_CREATION, new WorkflowHandler())
    this.handlers.set(IntentType.MCP_MANAGEMENT, new MCPManagementHandler())
    this.handlers.set(IntentType.HELP_REQUEST, new HelpHandler())

    // 默认处理器
    this.defaultHandler = new GeneralChatHandler()
  }

  // 智能路由处理
  async routeDialogue(
    userInput: string, 
    conversationHistory: Message[] = []
  ): Promise<DialogueResponse> {
    try {
      // 1. 意图识别
      const intent = await this.intentRecognizer.recognizeIntent(userInput, conversationHistory)
      
      console.log('🎯 对话路由 - 意图识别结果:', intent)
      console.log('🎯 用户输入长度:', userInput.length, '字符')

      // 2. 创建对话上下文
      const context: DialogueContext = {
        conversationHistory,
        sessionId: this.generateSessionId(),
        timestamp: Date.now()
      }

      // 3. 选择处理器
      const handler = this.selectHandler(intent)
      console.log('🔧 选择的处理器:', handler.constructor.name)

      // 4. 处理对话
      const response = await handler.handle(userInput, intent, context)
      console.log('💬 处理器响应:', response)

      // 5. 添加元数据
      response.metadata = {
        ...response.metadata,
        intent: intent,
        handlerType: handler.constructor.name,
        processingTime: Date.now() - context.timestamp
      }

      return response

    } catch (error) {
      console.error('对话路由处理失败:', error)
      
      // 错误回退
      return {
        message: '抱歉，我在处理您的请求时遇到了问题。请重新描述您的需求，或者尝试更具体的表达。',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          fallback: true
        }
      }
    }
  }

  // 选择处理器
  private selectHandler(intent: IntentResult): DialogueHandler {
    const handler = this.handlers.get(intent.type)
    
    if (handler && handler.canHandle(intent)) {
      return handler
    }

    return this.defaultHandler
  }

  // 生成会话ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加自定义处理器
  addHandler(intentType: IntentType, handler: DialogueHandler) {
    this.handlers.set(intentType, handler)
  }

  // 获取支持的意图类型
  getSupportedIntents(): IntentType[] {
    return Array.from(this.handlers.keys())
  }
}

// LLM 管理处理器
class LLMManagementHandler implements DialogueHandler {
  constructor(private configManager: SecureConfigManager) {}

  // 获取实际的模型状态信息
  private async getModelStatus(): Promise<{
    currentProvider: string
    currentModel: string
    availableModels: string[]
    providerStatus: Record<string, boolean>
  }> {
    try {
      const status = llmManager.getStatus()
      return {
        currentProvider: status.currentProvider,
        currentModel: status.currentModel,
        availableModels: status.availableModels.map(m => m.name),
        providerStatus: Object.fromEntries(
          status.availableProviders.map(p => [p.name, p.isAvailable])
        )
      }
    } catch (error) {
      console.error('获取模型状态失败:', error)
      return {
        currentProvider: '',
        currentModel: '',
        availableModels: [],
        providerStatus: {}
      }
    }
  }

  canHandle(intent: IntentResult): boolean {
    return intent.confidence > 0.3
  }

  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    const { params } = intent

    if (params.action === 'configure' || userInput.includes('配置')) {
      try {
        // 直接跳转到配置页面
        if (typeof window !== 'undefined' && window.location.hash !== '#/config') {
          window.location.hash = '#/config'
        }
        
        // 获取实际的模型状态
        const modelStatus = await this.getModelStatus()
        const statusText = modelStatus.availableModels.length > 0 ? 
          `${modelStatus.availableModels.length} 个可用模型` :
          '未检测到可用模型'

        // 根据用户输入提供更具体的指导
        let specificGuidance = ''
        if (params.provider) {
          specificGuidance = `\n🎯 检测到您想配置 ${params.provider}，我会为您重点展示相关设置。`
        } else if (params.model) {
          specificGuidance = `\n🎯 检测到您想使用 ${params.model} 模型，我会帮您找到对应的配置选项。`
        }
        
        return {
          message: '✅ 正在打开 LLM 配置页面！您可以在配置页面中：\n\n' +
                   '🔧 **供应商管理**\n' +
                   '• OpenAI (GPT-4, GPT-3.5)\n' +
                   '• Anthropic (Claude)\n' +
                   '• Google (Gemini)\n' +
                   `• 当前提供商: ${modelStatus.currentProvider || '未选择'}\n` +
                   `• 可用模型: ${statusText}\n` +
                   '• 国产模型 (智谱、通义、文心等)\n\n' +
                   '🔑 **密钥配置**\n' +
                   '• 安全存储 API 密钥\n' +
                   '• 测试连接状态\n' +
                   '• 管理使用配额\n\n' +
                   '⚙️ **模型设置**\n' +
                   '• 选择默认模型\n' +
                   '• 调整参数 (温度、最大长度等)\n' +
                   '• 设置模型优先级' +
                   specificGuidance + '\n\n' +
                   '配置完成后，新设置将立即生效。',
          actions: [{
            type: 'redirect',
            payload: { url: '#/config', focus: params.provider || params.model },
            description: '跳转到LLM配置页面'
          }],
          followUpQuestions: [
            '配置 OpenAI',
            '设置本地 Ollama',
            '添加国产模型',
            '测试模型连接',
            '查看当前配置'
          ]
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          message: `❌ 打开配置页面失败：${errorMessage}\n\n可能的原因：\n` +
                   '• 系统权限不足\n' +
                   '• 配置文件损坏\n' +
                   '• 窗口管理器异常\n\n' +
                   '请稍后重试，或尝试重启应用。',
          followUpQuestions: [
            '重试打开配置',
            '检查系统状态',
            '重启应用',
            '手动配置帮助'
          ]
        }
      }
    }

    if (params.action === 'switch' && params.model) {
      return {
        message: `正在为您切换到 ${params.model} 模型...`,
        actions: [{
          type: 'switch_model',
          payload: { model: params.model },
          description: `切换到${params.model}模型`
        }],
        needsConfirmation: true
      }
    }

    if (params.action === 'status' || userInput.includes('模型列表') || userInput.includes('查看模型')) {
      const modelStatus = await this.getModelStatus()
      
      let statusMessage = '📊 **当前LLM配置状态**\n\n'
      
      // 模型状态
      if (modelStatus.availableModels.length > 0) {
        statusMessage += '✅ **可用模型**\n'
        statusMessage += `• 当前提供商: ${modelStatus.currentProvider}\n`
        statusMessage += `• 当前模型: ${modelStatus.currentModel}\n`
        statusMessage += `• 可用模型 (${modelStatus.availableModels.length}个):\n`
        modelStatus.availableModels.forEach((model, index) => {
          statusMessage += `  ${index + 1}. ${model}\n`
        })
        statusMessage += '\n'
      } else {
        statusMessage += '⚠️ **模型状态**\n'
        statusMessage += '• 服务状态: 未检测到可用模型\n'
        statusMessage += '• 建议: 配置模型提供商或检查服务状态\n\n'
      }
      
      // 提供商状态
      statusMessage += '🌐 **提供商状态**\n'
      for (const [provider, isAvailable] of Object.entries(modelStatus.providerStatus)) {
        statusMessage += `• ${provider}: ${isAvailable ? '✅ 可用' : '❌ 不可用'}\n`
      }
      statusMessage += '\n💡 说"配置 LLM"来管理模型设置'
      
      return {
        message: statusMessage,
        actions: [{
          type: 'show_ui',
          payload: { component: 'model-status', modelStatus },
          description: '显示详细模型状态'
        }],
        followUpQuestions: modelStatus.availableModels.length > 0 ? [
          `切换到 ${modelStatus.availableModels[0]}`,
          '配置 LLM',
          '测试模型连接',
          '查看模型详情'
        ] : [
          '配置 LLM',
          '检查服务状态'
        ]
      }
    }

    // 获取实际的模型状态用于通用响应
    const modelStatus = await this.getModelStatus()
    let modelInfo = ''
    
    if (modelStatus.availableModels.length > 0) {
      const modelList = modelStatus.availableModels.length <= 3 ? 
        modelStatus.availableModels.join(', ') : 
        `${modelStatus.availableModels.slice(0, 3).join(', ')} 等${modelStatus.availableModels.length}个模型`
      modelInfo = `\n📱 **您的可用模型**\n• ${modelList}\n• 当前提供商: ${modelStatus.currentProvider}\n`
    } else {
      modelInfo = `\n📱 **模型状态**\n• 未检测到可用模型\n• 可以说"配置 LLM"来设置\n`
    }

    // 通用LLM管理响应
    return {
      message: '🤖 我可以帮您管理 LLM 模型！支持以下操作：\n\n' +
               '🔧 **配置管理**\n' +
               '• "配置 OpenAI" - 设置 GPT 模型\n' +
               '• "配置 Ollama" - 设置本地模型\n' +
               '• "配置智谱" - 设置国产模型\n' +
               '• "添加新供应商" - 扩展模型支持\n\n' +
               '🔄 **模型切换**\n' +
               '• "切换到 GPT-4" - 使用指定模型\n' +
               '• "使用本地模型" - 切换到 Ollama\n' +
               '• "推荐模型" - 获取模型建议\n' +
               modelInfo + '\n' +
               '📊 **状态查看**\n' +
               '• "当前模型" - 查看正在使用的模型\n' +
               '• "模型列表" - 查看所有可用模型\n' +
               '• "连接状态" - 检查模型连接\n\n' +
               '直接告诉我您的需求，比如："我想配置 GPT-4" 或 "切换到本地模型"',
      followUpQuestions: modelStatus.availableModels.length > 0 ? [
        '配置 OpenAI GPT-4',
        `切换到 ${modelStatus.availableModels[0]}`,
        '查看所有模型',
        '配置其他提供商',
        '测试模型连接'
      ] : [
        '配置 OpenAI GPT-4',
        '配置 LLM',
        '查看系统状态',
        '测试连接状态'
      ]
    }
  }
}

// 系统配置处理器
class SystemConfigHandler implements DialogueHandler {
  constructor(private configManager: SecureConfigManager) {}

  canHandle(intent: IntentResult): boolean {
    return intent.confidence > 0.5
  }

  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    try {
      // 直接跳转到配置页面
      if (typeof window !== 'undefined' && window.location.hash !== '#/config') {
        window.location.hash = '#/config'
      }
      
      return {
        message: '✅ 正在打开系统设置页面！您可以配置：\n\n' +
                 '• 界面主题（浅色/深色/跟随系统）\n' +
                 '• 语言设置\n' +
                 '• 快捷键配置\n' +
                 '• 自动保存选项\n\n' +
                 '设置会立即生效并自动保存。',
        actions: [{
          type: 'redirect',
          payload: { url: '#/config' },
          description: '跳转到系统配置页面'
        }],
        followUpQuestions: [
          '切换主题',
          '修改语言',
          '配置快捷键',
          '查看当前设置'
        ]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        message: `❌ 打开系统设置失败：${errorMessage}\n\n请稍后重试。`,
        followUpQuestions: [
          '重试打开设置',
          '手动配置帮助'
        ]
      }
    }
  }
}

// 主题切换处理器
class ThemeChangeHandler implements DialogueHandler {
  constructor(private configManager: SecureConfigManager) {}

  canHandle(intent: IntentResult): boolean {
    return intent.confidence > 0.7
  }

  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    const { params } = intent
    
    if (params.theme) {
      try {
        // 保存主题设置
        const currentConfig = this.configManager.getConfig('system-settings') || {}
        currentConfig.theme = params.theme
        this.configManager.saveConfig('system-settings', currentConfig, false)
        
        return {
          message: `✅ 已切换到${params.theme === 'dark' ? '深色' : '浅色'}主题！\n\n主题设置已保存，将在下次启动时生效。`,
          actions: [{
            type: 'execute_command',
            payload: { command: 'setTheme', args: [params.theme] },
            description: `切换到${params.theme}主题`
          }],
          followUpQuestions: [
            '打开系统设置',
            '切换其他主题',
            '查看当前设置'
          ]
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          message: `❌ 主题切换失败：${errorMessage}`,
          followUpQuestions: [
            '重试切换主题',
            '打开系统设置'
          ]
        }
      }
    }

    return {
      message: '请选择您想要的主题：',
      followUpQuestions: [
        '深色主题',
        '浅色主题',
        '跟随系统'
      ]
    }
  }
}

// 知识库处理器
class KnowledgeBaseHandler implements DialogueHandler {
  canHandle(intent: IntentResult): boolean {
    return intent.confidence > 0.6
  }

  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    if (userInput.includes('上传') || userInput.includes('添加')) {
      return {
        message: '您可以通过以下方式上传文档到知识库：\n\n' +
                 '• 直接拖拽文件到聊天框\n' +
                 '• 点击文件上传按钮\n' +
                 '• 说"上传文档"并选择文件\n\n' +
                 '支持的格式：PDF、Word、Markdown、文本文件',
        actions: [{
          type: 'show_ui',
          payload: { component: 'file-upload' },
          description: '显示文件上传界面'
        }]
      }
    }

    if (userInput.includes('搜索') || userInput.includes('查找')) {
      return {
        message: '我来帮您搜索知识库中的文档。请告诉我您要查找什么内容？',
        actions: [{
          type: 'show_ui',
          payload: { component: 'knowledge-search' },
          description: '显示知识库搜索界面'
        }]
      }
    }

    return {
      message: '我可以帮您管理知识库。您可以：\n\n' +
               '• 上传和管理文档\n' +
               '• 搜索已有文档\n' +
               '• 基于文档内容回答问题\n' +
               '• 组织和分类文档\n\n' +
               '请告诉我您需要什么帮助？',
      followUpQuestions: [
        '上传文档',
        '搜索文档',
        '管理文档',
        '基于文档回答问题'
      ]
    }
  }
}

// 工作流处理器
class WorkflowHandler implements DialogueHandler {
  canHandle(intent: IntentResult): boolean {
    return intent.confidence > 0.6
  }

  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    return {
      message: '我来帮您创建自动化工作流。请描述您想要自动化的任务：\n\n' +
               '例如：\n' +
               '• "每天早上9点发送邮件提醒"\n' +
               '• "当收到特定文件时自动处理"\n' +
               '• "定期备份重要文档"\n\n' +
               '请详细描述您的需求？',
      actions: [{
        type: 'show_ui',
        payload: { component: 'workflow-creator' },
        description: '显示工作流创建器'
      }],
      followUpQuestions: [
        '创建定时任务',
        '文件自动处理',
        '邮件自动化',
        '数据同步任务'
      ]
    }
  }
}

// 帮助处理器
class HelpHandler implements DialogueHandler {
  canHandle(intent: IntentResult): boolean {
    return intent.confidence > 0.5
  }

  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    return {
      message: '我是 Bor 智能助手，可以帮您：\n\n' +
               '🤖 **LLM 管理**\n' +
               '• 配置和切换AI模型\n' +
               '• 管理API密钥\n' +
               '• 优化模型性能\n\n' +
               '📚 **知识库**\n' +
               '• 上传和管理文档\n' +
               '• 智能搜索和问答\n' +
               '• 文档分析和总结\n\n' +
               '⚙️ **自动化**\n' +
               '• 创建工作流\n' +
               '• 定时任务\n' +
               '• 批量处理\n\n' +
               '🛠️ **工具调用**\n' +
               '• 文件操作\n' +
               '• 网络搜索\n' +
               '• 系统命令\n\n' +
               '您可以直接用自然语言告诉我您的需求！',
      followUpQuestions: [
        '配置LLM模型',
        '上传文档',
        '创建工作流',
        '查看系统状态'
      ]
    }
  }
}

// MCP管理处理器
class MCPManagementHandler implements DialogueHandler {
  private mcpDialogueHandler: MCPDialogueHandler

  constructor() {
    this.mcpDialogueHandler = new MCPDialogueHandler()
  }

  canHandle(intent: IntentResult): boolean {
    return intent.confidence > 0.4
  }

  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    try {
      const mcpResponse = await this.mcpDialogueHandler.handleMCPDialogue(userInput, context.conversationHistory)
      
      return {
        message: mcpResponse.message,
        actions: mcpResponse.actions,
        followUpQuestions: mcpResponse.followUpQuestions,
        metadata: {
          mcpHandled: true,
          requiresLLM: mcpResponse.requiresLLM || false
        }
      }
    } catch (error) {
      console.error('MCP对话处理失败:', error)
      return {
        message: '❌ MCP工具处理遇到问题，请稍后重试。\n\n您可以说"MCP帮助"了解更多功能。',
        followUpQuestions: [
          'MCP帮助',
          '检查MCP状态'
        ]
      }
    }
  }
}

// 通用对话处理器 - 集成MCP工具调用
class GeneralChatHandler implements DialogueHandler {
  constructor() {
    // MCP管理器将在ChatView中初始化
  }

  canHandle(intent: IntentResult): boolean {
    return true // 总是可以处理
  }



  async handle(userInput: string, intent: IntentResult, context: DialogueContext): Promise<DialogueResponse> {
    // 首先检查是否是直接的工具调用
    const toolCallRequest = mcpManager.detectToolCall(userInput)
    
    if (toolCallRequest) {
      const toolResult = await mcpManager.executeToolCall(toolCallRequest)
      const formattedResult = mcpManager.formatToolResult(toolResult)
      
      return {
        message: formattedResult,
        metadata: {
          toolCall: true,
          toolUsed: toolCallRequest.tool,
          requiresLLM: false
        }
      }
    }

    // 构建包含工具信息的系统提示
    const availableTools = mcpManager.getAvailableTools()
    const toolAwarePrompt = this.buildToolAwarePrompt(availableTools)
    
    return {
      message: '', // 空消息，表示需要转发给LLM处理
      metadata: {
        requiresLLM: true,
        originalInput: userInput,
        systemPrompt: toolAwarePrompt,
        mcpToolsAvailable: availableTools.length > 0
      }
    }
  }

  /**
   * 构建工具感知的系统提示
   */
  private buildToolAwarePrompt(tools: any[]): string {
    if (tools.length === 0) {
      return ''
    }

    const toolList = tools.map(tool => 
      `- ${tool.name}: ${tool.description || '无描述'}`
    ).join('\n')

    return `你有以下工具可用：
${toolList}

当用户需要搜索信息时，请使用search工具。调用格式：
\`\`\`tool
{"tool": "search", "parameters": {"query": "搜索内容", "max_results": 5}}
\`\`\`

当用户需要获取网页内容时，请使用fetch_content工具。调用格式：
\`\`\`tool
{"tool": "fetch_content", "parameters": {"url": "网页URL"}}
\`\`\`

重要：必须严格按照上述JSON格式调用工具。`
  }
}