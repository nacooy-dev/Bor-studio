/**
 * 增强的意图分析节点
 * 基于PocketFlow架构，提供智能的意图识别和上下文感知
 */

import { FlowNode, FlowInput, FlowOutput } from '../core/FlowNode'

// 意图类型定义 - 扩展原有类型
export enum IntentType {
  // 对话类型
  CONVERSATION = 'conversation',
  GREETING = 'greeting',
  FAREWELL = 'farewell',
  
  // 工具调用类型
  TOOL_CALL = 'tool_call',
  FILE_OPERATION = 'file_operation',
  WEB_SEARCH = 'web_search',
  CALCULATION = 'calculation',
  TIME_QUERY = 'time_query',
  
  // 知识查询类型
  KNOWLEDGE_QUERY = 'knowledge_query',
  DOCUMENT_SEARCH = 'document_search',
  INFORMATION_REQUEST = 'information_request',
  
  // 系统操作类型
  SYSTEM_OPERATION = 'system_operation',
  CONFIG_CHANGE = 'config_change',
  MODEL_SWITCH = 'model_switch',
  THEME_CHANGE = 'theme_change',
  
  // MCP操作类型
  MCP_OPERATION = 'mcp_operation',
  MCP_TOOL_MANAGEMENT = 'mcp_tool_management',
  MCP_SERVER_CONTROL = 'mcp_server_control',
  
  // 工作流类型
  WORKFLOW_BUILDER = 'workflow_builder',
  WORKFLOW_EXECUTION = 'workflow_execution',
  WORKFLOW_MANAGEMENT = 'workflow_management',
  
  // 澄清和帮助
  CLARIFICATION = 'clarification',
  HELP_REQUEST = 'help_request',
  
  // 未知或无法识别
  UNKNOWN = 'unknown'
}

// 实体类型定义
export interface ExtractedEntity {
  type: string
  value: string
  confidence: number
  startIndex: number
  endIndex: number
  metadata?: Record<string, any>
}

// 意图分析结果
export interface IntentAnalysisResult {
  primaryIntent: IntentType
  confidence: number
  entities: ExtractedEntity[]
  parameters: Record<string, any>
  alternativeIntents: IntentCandidate[]
  contextFactors: ContextFactor[]
  reasoning: string
}

export interface IntentCandidate {
  intent: IntentType
  confidence: number
  reasoning: string
}

export interface ContextFactor {
  type: string
  value: any
  weight: number
  description: string
}

// 规则匹配结果
interface RuleMatch {
  intent: IntentType
  score: number
  matchedPatterns: string[]
  matchedKeywords: string[]
  contextBonus: number
}

/**
 * 增强的意图分析节点
 */
export class IntentAnalysisNode extends FlowNode {
  private intentPatterns: Map<IntentType, RegExp[]> = new Map()
  private intentKeywords: Map<IntentType, string[]> = new Map()
  private entityPatterns: Map<string, RegExp> = new Map()
  private contextWeights: Map<string, number> = new Map()

  constructor(config: any) {
    super({
      id: config.id || 'intent_analysis',
      name: config.name || '意图分析节点',
      type: 'IntentAnalysisNode',
      successors: config.successors || [
        'tool_selection',
        'knowledge_query', 
        'conversation_response',
        'system_execution',
        'mcp_operation',
        'workflow_builder',
        'clarification',
        'no_tools_available',
        'general_response'
      ],
      errorHandlers: config.errorHandlers || ['general_response'],
      timeout: config.timeout || 5000,
      params: config.params || {}
    })

    this.initializePatterns()
    this.initializeEntityPatterns()
    this.initializeContextWeights()
  }

  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input for intent analysis',
        recoverable: false,
        retryable: false
      })
    }

    try {
      const userInput = input.data.message || input.data
      const context = input.context

      // 执行意图分析
      const analysisResult = await this.analyzeIntent(userInput, context)
      
      // 根据意图选择下一个节点
      const nextNode = this.selectNextNode(analysisResult)
      
      // 准备输出数据 - 确保intent不为null
      const outputData = {
        originalInput: userInput,
        intent: analysisResult || {
          primaryIntent: IntentType.CONVERSATION,
          confidence: 0.5,
          entities: [],
          parameters: {},
          alternativeIntents: [],
          contextFactors: [],
          reasoning: '默认意图分析结果'
        },
        nextAction: nextNode,
        timestamp: Date.now()
      }

      return this.createOutput(
        outputData,
        [nextNode],
        context,
        {
          intentType: analysisResult.primaryIntent,
          confidence: analysisResult.confidence,
          entitiesFound: analysisResult.entities.length,
          processingTime: Date.now() - input.context.startTime
        }
      )

    } catch (error) {
      return this.createErrorOutput({
        code: 'INTENT_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Intent analysis failed',
        details: error,
        recoverable: true,
        retryable: true
      })
    }
  }

  /**
   * 核心意图分析方法 - 使用LLM进行智能分析
   */
  private async analyzeIntent(userInput: string, context: any): Promise<IntentAnalysisResult> {
    const startTime = Date.now()
    
    console.log(`🧠 开始LLM意图分析: "${userInput}"`)
    
    // 🚀 使用LLM进行意图分析
    try {
      const llmResult = await this.performLLMIntentAnalysis(userInput, context)
      if (llmResult) {
        console.log(`✅ LLM意图分析成功: ${llmResult.primaryIntent} (${llmResult.confidence})`)
        return llmResult
      }
    } catch (error) {
      console.warn('⚠️ LLM意图分析失败，回退到规则匹配:', error)
    }
    
    // 回退到规则匹配
    console.log('🔄 使用规则匹配进行意图分析')
    
    // 1. 预处理输入
    const normalizedInput = this.normalizeInput(userInput)
    
    // 2. 规则匹配
    const ruleMatches = this.performRuleMatching(normalizedInput)
    
    // 3. 实体提取
    const entities = this.extractEntities(normalizedInput)
    
    // 4. 上下文分析
    const contextFactors = this.analyzeContext(context, normalizedInput)
    
    // 5. 计算最终置信度
    const intentCandidates = this.calculateConfidence(ruleMatches, contextFactors, entities)
    
    // 6. 选择主要意图
    const primaryIntent = intentCandidates[0]
    
    // 7. 提取参数
    const parameters = this.extractParameters(normalizedInput, entities, primaryIntent.intent)
    
    // 8. 生成推理说明
    const reasoning = this.generateReasoning(primaryIntent, ruleMatches, contextFactors, entities)

    return {
      primaryIntent: primaryIntent.intent,
      confidence: primaryIntent.confidence,
      entities,
      parameters,
      alternativeIntents: intentCandidates.slice(1, 4), // 取前3个备选
      contextFactors,
      reasoning
    }
  }

  /**
   * 🧠 使用LLM进行意图分析
   */
  private async performLLMIntentAnalysis(userInput: string, context: any): Promise<IntentAnalysisResult | null> {
    // 构建LLM提示
    const prompt = `请分析以下用户输入的意图，并返回JSON格式的结果：

用户输入: "${userInput}"

可能的意图类型：
- web_search: 网页搜索（搜索、查找信息、新闻等）
- tool_call: 工具调用（计算、文件操作等）
- conversation: 普通对话
- system_operation: 系统操作（设置、配置等）
- knowledge_query: 知识查询（解释、说明等）

请返回JSON格式：
{
  "primaryIntent": "意图类型",
  "confidence": 0.9,
  "reasoning": "分析原因",
  "entities": [],
  "parameters": {}
}

只返回JSON，不要其他内容。`

    try {
      // 这里需要调用LLM API
      // 暂时返回null，让它回退到规则匹配
      return null
    } catch (error) {
      console.error('LLM意图分析失败:', error)
      return null
    }
  }

  /**
   * 初始化意图识别模式
   */
  private initializePatterns(): void {
    // 对话类型
    this.intentPatterns.set(IntentType.CONVERSATION, [
      /^(你好|hello|hi|嗨|您好)/i,
      /^(谢谢|thank|thanks|感谢)/i,
      /^(再见|bye|goodbye|拜拜)/i
    ])
    
    this.intentKeywords.set(IntentType.CONVERSATION, [
      '你好', 'hello', 'hi', '谢谢', 'thanks', '再见', 'bye'
    ])

    // 网络搜索类型 - 简化并修复模式匹配
    this.intentPatterns.set(IntentType.WEB_SEARCH, [
      /搜索.+/i,
      /查找.+/i,
      /search.+/i,
      /find.+/i,
      /搜.+/i,
      /查.+/i
    ])
    
    this.intentKeywords.set(IntentType.WEB_SEARCH, [
      '搜索', 'search', '查找', 'find', '搜', '查'
    ])

    // 工具调用类型
    this.intentPatterns.set(IntentType.TOOL_CALL, [
      /(计算|calculate|算|compute).+/i,
      /(时间|time|现在几点|what time)/i,
      /(文件|file|打开|open|读取|read).+/i
    ])
    
    this.intentKeywords.set(IntentType.TOOL_CALL, [
      '计算', 'calculate', '时间', 'time', '文件', 'file'
    ])

    // 系统操作类型
    this.intentPatterns.set(IntentType.SYSTEM_OPERATION, [
      /(配置|config|设置|setting|管理|manage)/i,
      /(切换|switch|更换|change).+(模型|model|主题|theme)/i,
      /(检查|check|查看|view).+(状态|status|系统|system)/i
    ])
    
    this.intentKeywords.set(IntentType.SYSTEM_OPERATION, [
      '配置', 'config', '设置', '切换', '检查', '状态', '系统'
    ])

    // MCP操作类型
    this.intentPatterns.set(IntentType.MCP_OPERATION, [
      /(mcp|工具|tool).+(管理|manage|配置|config)/i,
      /(启动|start|停止|stop|重启|restart).+(服务|server|工具|tool)/i,
      /(添加|add|删除|delete|移除|remove).+(工具|tool|服务|server)/i
    ])
    
    this.intentKeywords.set(IntentType.MCP_OPERATION, [
      'mcp', '工具', 'tool', '服务', 'server', '管理', '启动', '停止'
    ])

    // 知识查询类型
    this.intentPatterns.set(IntentType.KNOWLEDGE_QUERY, [
      /(什么是|what is|如何|how to|为什么|why|怎么样|how about)/i,
      /(解释|explain|说明|describe|介绍|introduce)/i,
      /(帮助|help|指导|guide|教程|tutorial)/i
    ])
    
    this.intentKeywords.set(IntentType.KNOWLEDGE_QUERY, [
      '什么是', 'what', '如何', 'how', '为什么', 'why', '解释', '帮助', 'help'
    ])

    // 澄清类型
    this.intentPatterns.set(IntentType.CLARIFICATION, [
      /^(什么|what|哪个|which|怎么|how)\?*$/i,
      /^(不明白|不懂|confused|unclear)/i,
      /^(再说一遍|repeat|again)/i
    ])
    
    this.intentKeywords.set(IntentType.CLARIFICATION, [
      '什么', 'what', '哪个', '不明白', 'confused', '再说一遍'
    ])
  }

  /**
   * 初始化实体识别模式
   */
  private initializeEntityPatterns(): void {
    this.entityPatterns.set('number', /\d+(\.\d+)?/g)
    this.entityPatterns.set('time', /\d{1,2}:\d{2}|\d{1,2}点/g)
    this.entityPatterns.set('date', /\d{4}[-/]\d{1,2}[-/]\d{1,2}|今天|明天|昨天/g)
    this.entityPatterns.set('file_path', /[a-zA-Z]:[\\\/][\w\s\\\/.-]+|\/[\w\s\/.-]+/g)
    this.entityPatterns.set('url', /https?:\/\/[^\s]+/g)
    this.entityPatterns.set('email', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
    this.entityPatterns.set('model_name', /(llama|gpt|claude|qwen|mistral|deepseek)[\w-]*/gi)
  }

  /**
   * 初始化上下文权重
   */
  private initializeContextWeights(): void {
    this.contextWeights.set('recent_tool_usage', 0.3)
    this.contextWeights.set('conversation_topic', 0.2)
    this.contextWeights.set('user_preference', 0.2)
    this.contextWeights.set('time_context', 0.1)
    this.contextWeights.set('system_state', 0.2)
  }

  /**
   * 输入预处理
   */
  private normalizeInput(input: string): string {
    return input.toLowerCase().trim()
  }

  /**
   * 规则匹配 - 增加调试日志
   */
  private performRuleMatching(input: string): RuleMatch[] {
    const matches: RuleMatch[] = []
    console.log(`🔍 开始规则匹配，输入: "${input}"`)

    for (const [intent, patterns] of this.intentPatterns.entries()) {
      let score = 0
      const matchedPatterns: string[] = []
      const matchedKeywords: string[] = []

      // 模式匹配
      for (const pattern of patterns) {
        const isMatch = pattern.test(input)
        if (isMatch) {
          score += 0.8
          matchedPatterns.push(pattern.source)
          console.log(`✅ 模式匹配成功: ${intent} - ${pattern.source}`)
        }
      }

      // 关键词匹配
      const keywords = this.intentKeywords.get(intent) || []
      for (const keyword of keywords) {
        if (input.includes(keyword.toLowerCase())) {
          score += 0.5
          matchedKeywords.push(keyword)
          console.log(`✅ 关键词匹配成功: ${intent} - ${keyword}`)
        }
      }

      if (score > 0) {
        matches.push({
          intent,
          score,
          matchedPatterns,
          matchedKeywords,
          contextBonus: 0
        })
        console.log(`📊 意图 ${intent} 得分: ${score}`)
      }
    }

    const sortedMatches = matches.sort((a, b) => b.score - a.score)
    console.log(`🏆 最终匹配结果:`, sortedMatches.map(m => `${m.intent}(${m.score})`).join(', '))
    
    return sortedMatches
  }

  /**
   * 实体提取
   */
  private extractEntities(input: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = []

    for (const [type, pattern] of this.entityPatterns.entries()) {
      const matches = input.matchAll(pattern)
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type,
            value: match[0],
            confidence: 0.9,
            startIndex: match.index,
            endIndex: match.index + match[0].length
          })
        }
      }
    }

    return entities
  }

  /**
   * 上下文分析
   */
  private analyzeContext(context: any, input: string): ContextFactor[] {
    const factors: ContextFactor[] = []

    // 分析对话历史
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentMessages = context.conversationHistory.slice(-3)
      const topics = this.extractTopicsFromHistory(recentMessages)
      
      factors.push({
        type: 'conversation_topic',
        value: topics,
        weight: this.contextWeights.get('conversation_topic') || 0.2,
        description: `最近对话涉及: ${topics.join(', ')}`
      })
    }

    // 分析系统状态
    if (context.systemState) {
      factors.push({
        type: 'system_state',
        value: context.systemState,
        weight: this.contextWeights.get('system_state') || 0.2,
        description: '当前系统状态'
      })
    }

    // 时间上下文
    const currentHour = new Date().getHours()
    factors.push({
      type: 'time_context',
      value: { hour: currentHour, period: this.getTimePeriod(currentHour) },
      weight: this.contextWeights.get('time_context') || 0.1,
      description: `当前时间段: ${this.getTimePeriod(currentHour)}`
    })

    return factors
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    ruleMatches: RuleMatch[],
    contextFactors: ContextFactor[],
    entities: ExtractedEntity[]
  ): IntentCandidate[] {
    const candidates: IntentCandidate[] = []

    for (const match of ruleMatches) {
      let confidence = Math.min(match.score / 2, 1.0) // 基础分数归一化

      // 上下文加成
      let contextBonus = 0
      for (const factor of contextFactors) {
        contextBonus += this.calculateContextBonus(match.intent, factor)
      }
      
      // 实体加成
      const entityBonus = this.calculateEntityBonus(match.intent, entities)
      
      confidence = Math.min(confidence + contextBonus + entityBonus, 1.0)

      candidates.push({
        intent: match.intent,
        confidence,
        reasoning: `规则匹配: ${match.score.toFixed(2)}, 上下文加成: ${contextBonus.toFixed(2)}, 实体加成: ${entityBonus.toFixed(2)}`
      })
    }

    // 如果没有匹配，返回默认意图
    if (candidates.length === 0) {
      candidates.push({
        intent: IntentType.CONVERSATION,
        confidence: 0.6,
        reasoning: '未找到明确匹配，默认为对话意图'
      })
    }

    return candidates.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 选择下一个节点
   */
  private selectNextNode(result: IntentAnalysisResult): string {
    const intent = result.primaryIntent
    const confidence = result.confidence

    // 低置信度时请求澄清
    if (confidence < 0.4) {
      return 'clarification'
    }

    // 根据意图类型选择节点
    switch (intent) {
      case IntentType.TOOL_CALL:
      case IntentType.FILE_OPERATION:
      case IntentType.WEB_SEARCH:
      case IntentType.CALCULATION:
      case IntentType.TIME_QUERY:
      case IntentType.KNOWLEDGE_QUERY:
      case IntentType.INFORMATION_REQUEST:
      case IntentType.DOCUMENT_SEARCH:
      case IntentType.MCP_OPERATION:
      case IntentType.MCP_TOOL_MANAGEMENT:
      case IntentType.MCP_SERVER_CONTROL:
        return 'mcp_tool_selection'
        
      case IntentType.SYSTEM_OPERATION:
      case IntentType.CONFIG_CHANGE:
      case IntentType.MODEL_SWITCH:
      case IntentType.THEME_CHANGE:
      case IntentType.WORKFLOW_BUILDER:
      case IntentType.WORKFLOW_EXECUTION:
      case IntentType.WORKFLOW_MANAGEMENT:
      case IntentType.CLARIFICATION:
      case IntentType.HELP_REQUEST:
      case IntentType.CONVERSATION:
      case IntentType.GREETING:
      case IntentType.FAREWELL:
      default:
        // 对于非工具调用的意图，使用通用响应节点
        return 'general_response'
    }
  }

  // 辅助方法
  private extractTopicsFromHistory(messages: any[]): string[] {
    const topics = new Set<string>()
    for (const msg of messages) {
      if (msg.content) {
        // 简单的主题提取逻辑
        const words = msg.content.toLowerCase().split(/\s+/)
        for (const word of words) {
          if (word.length > 3 && !this.isStopWord(word)) {
            topics.add(word)
          }
        }
      }
    }
    return Array.from(topics).slice(0, 5)
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', '的', '了', '是', '在', '有', '和', '或', '但是']
    return stopWords.includes(word)
  }

  private getTimePeriod(hour: number): string {
    if (hour < 6) return '深夜'
    if (hour < 12) return '上午'
    if (hour < 18) return '下午'
    return '晚上'
  }

  private calculateContextBonus(intent: IntentType, factor: ContextFactor): number {
    // 简化的上下文加成计算
    return factor.weight * 0.1
  }

  private calculateEntityBonus(intent: IntentType, entities: ExtractedEntity[]): number {
    // 根据实体类型和意图的相关性计算加成
    let bonus = 0
    for (const entity of entities) {
      if (this.isEntityRelevantToIntent(entity.type, intent)) {
        bonus += 0.1
      }
    }
    return Math.min(bonus, 0.3)
  }

  private isEntityRelevantToIntent(entityType: string, intent: IntentType): boolean {
    const relevanceMap: Record<string, IntentType[]> = {
      'number': [IntentType.CALCULATION, IntentType.TOOL_CALL],
      'time': [IntentType.TIME_QUERY, IntentType.TOOL_CALL],
      'file_path': [IntentType.FILE_OPERATION, IntentType.TOOL_CALL],
      'url': [IntentType.WEB_SEARCH, IntentType.TOOL_CALL],
      'model_name': [IntentType.SYSTEM_OPERATION, IntentType.MODEL_SWITCH]
    }
    
    return relevanceMap[entityType]?.includes(intent) || false
  }

  private extractParameters(input: string, entities: ExtractedEntity[], intent: IntentType): Record<string, any> {
    const params: Record<string, any> = {}
    
    // 根据意图类型提取相关参数
    switch (intent) {
      case IntentType.CALCULATION:
        const numbers = entities.filter(e => e.type === 'number').map(e => parseFloat(e.value))
        if (numbers.length > 0) params.numbers = numbers
        break
        
      case IntentType.FILE_OPERATION:
        const filePaths = entities.filter(e => e.type === 'file_path').map(e => e.value)
        if (filePaths.length > 0) params.filePaths = filePaths
        break
        
      case IntentType.MODEL_SWITCH:
        const modelNames = entities.filter(e => e.type === 'model_name').map(e => e.value)
        if (modelNames.length > 0) params.modelNames = modelNames
        break
    }
    
    return params
  }

  private generateReasoning(
    primaryIntent: IntentCandidate,
    ruleMatches: RuleMatch[],
    contextFactors: ContextFactor[],
    entities: ExtractedEntity[]
  ): string {
    const parts = []
    
    parts.push(`识别为${primaryIntent.intent}类型`)
    parts.push(`置信度: ${(primaryIntent.confidence * 100).toFixed(1)}%`)
    
    if (ruleMatches.length > 0) {
      const topMatch = ruleMatches[0]
      if (topMatch.matchedKeywords.length > 0) {
        parts.push(`匹配关键词: ${topMatch.matchedKeywords.join(', ')}`)
      }
    }
    
    if (entities.length > 0) {
      parts.push(`提取实体: ${entities.map(e => `${e.type}(${e.value})`).join(', ')}`)
    }
    
    return parts.join('; ')
  }
}