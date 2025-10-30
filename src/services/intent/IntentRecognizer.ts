import type { Message } from '@/types'

// 意图类型定义
export interface IntentResult {
  type: IntentType
  confidence: number
  params: Record<string, any>
  explanation: string
}

export enum IntentType {
  // 系统配置相关
  LLM_MANAGEMENT = 'llm_management',
  SYSTEM_CONFIG = 'system_config',
  THEME_CHANGE = 'theme_change',
  
  // 知识库相关
  KNOWLEDGE_BASE = 'knowledge_base',
  DOCUMENT_UPLOAD = 'document_upload',
  DOCUMENT_SEARCH = 'document_search',
  
  // 工作流相关
  WORKFLOW_CREATION = 'workflow_creation',
  WORKFLOW_EXECUTION = 'workflow_execution',
  WORKFLOW_MANAGEMENT = 'workflow_management',
  
  // MCP工具相关
  MCP_MANAGEMENT = 'mcp_management',
  MCP_TOOL_EXECUTION = 'mcp_tool_execution',
  
  // 工具调用相关
  TOOL_CALL = 'tool_call',
  FILE_OPERATION = 'file_operation',
  WEB_SEARCH = 'web_search',
  
  // 通用对话
  GENERAL_CHAT = 'general_chat',
  HELP_REQUEST = 'help_request'
}

// 意图识别器类
export class IntentRecognizer {
  private patterns: Map<IntentType, RegExp[]> = new Map()
  private keywords: Map<IntentType, string[]> = new Map()

  constructor() {
    this.initializePatterns()
  }

  // 初始化意图识别模式
  private initializePatterns() {
    // LLM 管理相关 - 使用精确短语匹配
    this.keywords.set(IntentType.LLM_MANAGEMENT, [
      // 精确的配置短语
      '配置bor的llm设置', '配置bor llm', '配置llm', '配置模型', '配置ai模型',
      '设置llm', '设置模型', '管理llm', '管理模型', 'llm设置', '模型设置',
      '打开llm配置', '打开模型配置', '修改llm设置', '修改模型设置',
      // 切换相关
      '切换模型', '切换llm', '更换模型', '选择模型',
      // 供应商管理
      '配置openai', '配置claude', '配置gemini', '配置ollama',
      '设置openai', '设置claude', '设置gemini', '设置ollama',
      // API相关
      '配置api密钥', '设置api密钥', '添加api密钥', '管理api密钥'
    ])

    // 系统配置相关
    this.keywords.set(IntentType.SYSTEM_CONFIG, [
      '配置系统', '系统设置', '配置bor', 'bor设置', '打开设置',
      '修改系统设置', '系统配置', '应用设置', '偏好设置'
    ])

    // 主题切换
    this.keywords.set(IntentType.THEME_CHANGE, [
      '切换主题', '更换主题', '修改主题', '设置主题',
      '深色模式', '浅色模式', '暗黑模式', '明亮模式', '夜间模式'
    ])

    // 知识库相关
    this.keywords.set(IntentType.KNOWLEDGE_BASE, [
      '管理知识库', '打开知识库', '上传文档', '搜索文档', '查找文档',
      '我的文档', '文档管理', '添加资料', '导入文档'
    ])

    // 工作流相关
    this.keywords.set(IntentType.WORKFLOW_CREATION, [
      '创建工作流', '新建工作流', '设置自动化', '创建定时任务',
      '自动化任务', '批处理任务', '工作流管理'
    ])

    // MCP管理相关
    this.keywords.set(IntentType.MCP_MANAGEMENT, [
      '配置mcp', 'mcp配置', '配置MCP', 'MCP配置',
      'mcp', 'MCP', '工具管理', '管理mcp', '管理工具', 'mcp工具',
      '检查mcp状态', 'mcp状态', '工具状态', '添加工具', '启动工具',
      '打开mcp配置', '管理mcp工具',
      '添加文件系统工具', '添加搜索工具', '添加数据库工具',
      '添加duckduckgo搜索工具', '添加网络研究工具', '添加网页获取工具',
      '添加时间服务器', '删除服务器', '删除duckduckgo服务器',
      '启动文件系统', '启动搜索', '启动数据库', '启动duckduckgo', 
      '启动time server', '启动时间服务器', '启动time', '启动server',
      '启动file system', '启动file', '启动system',
      '停止服务器', '停止time server', '停止file system', 'mcp帮助',
      '有什么工具', '工具列表', '可用工具', 'mcp服务器', '添加mcp服务器',
      'time server', 'file system', 'duckduckgo search', 'file', 'system'
    ])

    // MCP工具执行
    this.keywords.set(IntentType.MCP_TOOL_EXECUTION, [
      '帮我读取', '帮我写入', '帮我搜索', '帮我查找', '帮我创建',
      '读取文件', '写入文件', '搜索信息', '查找信息', '列出文件',
      '创建文件', '删除文件', '修改文件', '执行工具'
    ])

    // 工具调用相关
    this.keywords.set(IntentType.TOOL_CALL, [
      '工具', '调用', '执行', '运行', '命令'
    ])

    // 文件操作
    this.keywords.set(IntentType.FILE_OPERATION, [
      '文件', '读取文件', '写入文件', '删除文件', '创建文件', '目录'
    ])

    // 网络搜索
    this.keywords.set(IntentType.WEB_SEARCH, [
      '搜索', '查找', '网上搜索', '百度', '谷歌', '搜一下'
    ])

    // 帮助请求
    this.keywords.set(IntentType.HELP_REQUEST, [
      '帮助', '怎么', '如何', '教我', '不会', '不知道', '帮我'
    ])
  }

  // 分析用户输入的意图
  async recognizeIntent(userInput: string, conversationHistory?: Message[]): Promise<IntentResult> {
    const input = userInput.toLowerCase().trim()
    console.log('🧠 意图识别 - 输入:', userInput, '处理后:', input)
    
    // 快速关键词匹配
    const keywordResults = this.matchKeywords(input)
    console.log('🔍 关键词匹配结果:', keywordResults)
    
    // 如果有明确的关键词匹配，返回结果
    if (keywordResults.length > 0) {
      const bestMatch = keywordResults[0]
      const result = {
        type: bestMatch.type,
        confidence: bestMatch.confidence,
        params: this.extractParams(input, bestMatch.type),
        explanation: `检测到${this.getIntentDescription(bestMatch.type)}相关的关键词`
      }
      console.log('✅ 意图识别成功:', result)
      return result
    }

    // 上下文分析
    const contextResult = this.analyzeContext(input, conversationHistory)
    if (contextResult) {
      return contextResult
    }

    // 默认为通用对话
    const result = {
      type: IntentType.GENERAL_CHAT,
      confidence: 0.5,
      params: {},
      explanation: '未检测到特定意图，归类为通用对话'
    }
    console.log('⚠️ 未识别到特定意图，使用默认:', result)
    return result
  }

  // 获取核心关键词（高权重关键词）
  private getCoreKeywords(intentType: IntentType): string[] {
    const coreKeywordsMap: Record<IntentType, string[]> = {
      [IntentType.LLM_MANAGEMENT]: ['配置bor的llm设置', '配置llm', '配置模型', 'llm设置', '模型设置'],
      [IntentType.SYSTEM_CONFIG]: ['配置系统', '系统设置', '配置bor'],
      [IntentType.THEME_CHANGE]: ['切换主题', '更换主题', '设置主题'],
      [IntentType.KNOWLEDGE_BASE]: ['管理知识库', '打开知识库', '文档管理'],
      [IntentType.DOCUMENT_UPLOAD]: ['上传文档', '导入文档', '添加资料'],
      [IntentType.DOCUMENT_SEARCH]: ['搜索文档', '查找文档'],
      [IntentType.WORKFLOW_CREATION]: ['创建工作流', '新建工作流', '设置自动化'],
      [IntentType.WORKFLOW_EXECUTION]: ['执行', '运行'],
      [IntentType.WORKFLOW_MANAGEMENT]: ['管理', '工作流管理'],
      [IntentType.MCP_MANAGEMENT]: ['配置mcp', 'mcp配置', 'mcp', '工具管理', '管理mcp', 'mcp状态', '检查mcp状态', 'mcp服务器', '添加mcp服务器', '启动', '停止', 'server', 'time', 'file', 'system'],
      [IntentType.MCP_TOOL_EXECUTION]: ['帮我读取', '帮我搜索', '执行工具'],
      [IntentType.TOOL_CALL]: ['工具', '调用'],
      [IntentType.FILE_OPERATION]: ['文件'],
      [IntentType.WEB_SEARCH]: ['搜索', '查找'],
      [IntentType.HELP_REQUEST]: ['帮助', '怎么'],
      [IntentType.GENERAL_CHAT]: []
    }
    
    return coreKeywordsMap[intentType] || []
  }

  // 智能短语匹配
  private matchKeywords(input: string): Array<{ type: IntentType; confidence: number }> {
    const results: Array<{ type: IntentType; confidence: number }> = []
    console.log('🔍 开始智能短语匹配，输入:', input)

    for (const [intentType, phrases] of this.keywords.entries()) {
      const matchedPhrases: string[] = []
      let bestMatchScore = 0

      for (const phrase of phrases) {
        const phraseScore = this.calculatePhraseMatch(input, phrase)
        if (phraseScore > 0) {
          matchedPhrases.push(phrase)
          bestMatchScore = Math.max(bestMatchScore, phraseScore)
        }
      }
      
      // 为MCP_MANAGEMENT添加特殊调试
      if (intentType === IntentType.MCP_MANAGEMENT && matchedPhrases.length > 0) {
        console.log(`🔍 MCP_MANAGEMENT匹配:`, {
          matchedPhrases,
          bestMatchScore,
          intentType
        })
      }

      if (matchedPhrases.length > 0) {
        // 基于最佳匹配分数计算置信度
        let confidence = bestMatchScore
        
        // 检查是否匹配到核心短语
        const coreKeywords = this.getCoreKeywords(intentType)
        const hasCoreMatch = matchedPhrases.some(phrase => 
          coreKeywords.includes(phrase.toLowerCase())
        )
        
        if (hasCoreMatch) {
          // 核心短语匹配，提升置信度
          confidence = Math.min(0.95, confidence + 0.2)
        }
        
        // 考虑输入长度，避免长句子中的偶然匹配
        const inputLength = input.length
        if (inputLength > 50) {
          // 长句子降低置信度
          confidence *= 0.8
        }
        
        results.push({ type: intentType, confidence })
        console.log(`✅ 匹配到 ${intentType}:`, {
          matchedPhrases,
          bestMatchScore,
          hasCoreMatch,
          inputLength,
          finalConfidence: confidence
        })
      }
    }

    // 按置信度排序
    return results.sort((a, b) => b.confidence - a.confidence)
  }

  // 计算短语匹配分数
  private calculatePhraseMatch(input: string, phrase: string): number {
    const inputLower = input.toLowerCase()
    const phraseLower = phrase.toLowerCase()
    
    // 完全匹配
    if (inputLower.includes(phraseLower)) {
      // 根据短语在输入中的位置和长度计算分数
      const phraseLength = phraseLower.length
      const inputLength = inputLower.length
      
      // 短语越长，匹配越精确，分数越高
      const lengthScore = Math.min(0.4, phraseLength / 20)
      
      // 短语在输入中的比例越大，分数越高
      const ratioScore = Math.min(0.4, phraseLength / inputLength)
      
      // 基础分数
      const baseScore = 0.5
      
      return baseScore + lengthScore + ratioScore
    }
    
    // 部分匹配（单词级别）
    const inputWords = inputLower.split(/\s+/)
    const phraseWords = phraseLower.split(/\s+/)
    
    let matchedWords = 0
    for (const phraseWord of phraseWords) {
      if (inputWords.includes(phraseWord)) {
        matchedWords++
      }
    }
    
    if (matchedWords > 0) {
      // 部分匹配分数较低
      return Math.min(0.4, (matchedWords / phraseWords.length) * 0.3)
    }
    
    return 0
  }

  // 上下文分析
  private analyzeContext(input: string, history?: Message[]): IntentResult | null {
    if (!history || history.length === 0) return null

    // 分析最近的对话上下文
    const recentMessages = history.slice(-3)
    const lastAssistantMessage = recentMessages
      .reverse()
      .find(msg => msg.role === 'assistant')

    if (lastAssistantMessage) {
      const content = lastAssistantMessage.content.toLowerCase()
      
      // 如果上一条消息提到了配置，当前输入可能是配置相关
      if (content.includes('配置') && (input.includes('是') || input.includes('好') || input.includes('确定'))) {
        return {
          type: IntentType.LLM_MANAGEMENT,
          confidence: 0.8,
          params: { contextual: true },
          explanation: '基于上下文判断为配置确认'
        }
      }
    }

    return null
  }

  // 提取参数
  private extractParams(input: string, intentType: IntentType): Record<string, any> {
    const params: Record<string, any> = {}

    switch (intentType) {
      case IntentType.LLM_MANAGEMENT:
        // 提取模型名称（支持中文模型名）
        const modelMatches = input.match(/(gpt-4|gpt-3\.5|claude|gemini|llama|qwen|deepseek|智谱|通义|文心|讯飞|百川|月之暗面|kimi|ollama)/i)
        if (modelMatches) {
          params.model = modelMatches[1].toLowerCase()
        }
        
        // 提取供应商名称
        const providerMatches = input.match(/(openai|anthropic|google|阿里|百度|科大讯飞|baichuan|moonshot)/i)
        if (providerMatches) {
          params.provider = providerMatches[1].toLowerCase()
        }

        // 提取操作类型
        if (input.includes('切换') || input.includes('使用')) {
          params.action = 'switch'
        } else if (input.includes('配置') || input.includes('设置')) {
          params.action = 'configure'
        } else if (input.includes('查看') || input.includes('当前')) {
          params.action = 'status'
        }
        break

      case IntentType.THEME_CHANGE:
        if (input.includes('深色') || input.includes('暗黑') || input.includes('黑色')) {
          params.theme = 'dark'
        } else if (input.includes('浅色') || input.includes('明亮') || input.includes('白色')) {
          params.theme = 'light'
        }
        break

      case IntentType.WORKFLOW_CREATION:
        // 提取时间相关参数
        const timeMatches = input.match(/(\d+)(分钟|小时|天|周)/g)
        if (timeMatches) {
          params.schedule = timeMatches[0]
        }
        break

      case IntentType.FILE_OPERATION:
        // 提取文件路径
        const pathMatches = input.match(/['"](.*?)['"]/g)
        if (pathMatches) {
          params.path = pathMatches[0].replace(/['"]/g, '')
        }
        break
    }

    return params
  }

  // 获取意图描述
  private getIntentDescription(intentType: IntentType): string {
    const descriptions: Record<IntentType, string> = {
      [IntentType.LLM_MANAGEMENT]: 'LLM模型管理',
      [IntentType.SYSTEM_CONFIG]: '系统配置',
      [IntentType.THEME_CHANGE]: '主题切换',
      [IntentType.KNOWLEDGE_BASE]: '知识库管理',
      [IntentType.DOCUMENT_UPLOAD]: '文档上传',
      [IntentType.DOCUMENT_SEARCH]: '文档搜索',
      [IntentType.WORKFLOW_CREATION]: '工作流创建',
      [IntentType.WORKFLOW_EXECUTION]: '工作流执行',
      [IntentType.WORKFLOW_MANAGEMENT]: '工作流管理',
      [IntentType.MCP_MANAGEMENT]: 'MCP工具管理',
      [IntentType.MCP_TOOL_EXECUTION]: 'MCP工具执行',
      [IntentType.TOOL_CALL]: '工具调用',
      [IntentType.FILE_OPERATION]: '文件操作',
      [IntentType.WEB_SEARCH]: '网络搜索',
      [IntentType.HELP_REQUEST]: '帮助请求',
      [IntentType.GENERAL_CHAT]: '通用对话'
    }

    return descriptions[intentType] || '未知意图'
  }

  // 获取意图处理建议
  getHandlingSuggestion(intentResult: IntentResult): string {
    switch (intentResult.type) {
      case IntentType.LLM_MANAGEMENT:
        return '建议打开LLM配置页面或执行模型切换操作'
      
      case IntentType.SYSTEM_CONFIG:
        return '建议打开系统配置页面'
      
      case IntentType.KNOWLEDGE_BASE:
        return '建议打开知识库管理界面或执行文档操作'
      
      case IntentType.WORKFLOW_CREATION:
        return '建议启动工作流创建向导'
      
      default:
        return '建议作为普通对话处理'
    }
  }
}