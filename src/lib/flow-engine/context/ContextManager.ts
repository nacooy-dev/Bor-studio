/**
 * 对话上下文管理器
 * 负责维护和分析对话上下文信息
 */

export interface ConversationContext {
  sessionId: string
  userId: string
  messageHistory: ConversationMessage[]
  userProfile: UserProfile
  systemState: SystemState
  activeTopics: Topic[]
  contextWindow: ContextWindow
  metadata: Record<string, any>
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: Record<string, any>
}

export interface UserProfile {
  userId: string
  preferences: Record<string, any>
  recentIntents: IntentHistory[]
  toolUsageHistory: ToolUsage[]
  conversationStyle: string
}

export interface SystemState {
  currentModel?: string
  availableModels: string[]
  mcpTools: MCPToolInfo[]
  systemHealth: Record<string, any>
  activeWorkflows: string[]
}

export interface Topic {
  name: string
  relevance: number
  firstMentioned: number
  lastMentioned: number
  frequency: number
}

export interface ContextWindow {
  recentMessages: ConversationMessage[]
  extractedEntities: EntityMention[]
  activeTopics: Topic[]
  userIntentions: IntentHistory[]
  timeContext: TimeContext
}

export interface EntityMention {
  entity: string
  type: string
  value: string
  confidence: number
  firstMentioned: number
  lastMentioned: number
  frequency: number
}

export interface IntentHistory {
  intent: string
  confidence: number
  timestamp: number
  successful: boolean
  parameters: Record<string, any>
}

export interface ToolUsage {
  toolName: string
  timestamp: number
  successful: boolean
  parameters: Record<string, any>
  result?: any
}

export interface MCPToolInfo {
  name: string
  description: string
  available: boolean
  lastUsed?: number
  usageCount: number
}

export interface TimeContext {
  currentTime: number
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  dayOfWeek: string
  isWeekend: boolean
}

/**
 * 对话上下文管理器
 */
export class ContextManager {
  private contexts: Map<string, ConversationContext> = new Map()
  private maxHistoryLength: number = 50
  private maxContextAge: number = 24 * 60 * 60 * 1000 // 24小时

  constructor(config: { maxHistoryLength?: number; maxContextAge?: number } = {}) {
    this.maxHistoryLength = config.maxHistoryLength || 50
    this.maxContextAge = config.maxContextAge || 24 * 60 * 60 * 1000
  }

  /**
   * 获取或创建对话上下文
   */
  getContext(sessionId: string, userId: string = 'anonymous'): ConversationContext {
    let context = this.contexts.get(sessionId)
    
    if (!context) {
      context = this.createNewContext(sessionId, userId)
      this.contexts.set(sessionId, context)
    }
    
    // 更新时间上下文
    context.contextWindow.timeContext = this.getCurrentTimeContext()
    
    return context
  }

  /**
   * 更新对话上下文
   */
  updateContext(
    sessionId: string,
    message: ConversationMessage,
    intentResult?: any,
    toolUsage?: ToolUsage
  ): ConversationContext {
    const context = this.getContext(sessionId)
    
    // 添加消息到历史
    this.addMessageToHistory(context, message)
    
    // 更新意图历史
    if (intentResult) {
      this.updateIntentHistory(context, intentResult)
    }
    
    // 更新工具使用历史
    if (toolUsage) {
      this.updateToolUsageHistory(context, toolUsage)
    }
    
    // 更新主题和实体
    this.updateTopicsAndEntities(context, message)
    
    // 更新上下文窗口
    this.updateContextWindow(context)
    
    // 清理过期数据
    this.cleanupExpiredData(context)
    
    return context
  }

  /**
   * 分析上下文相关性
   */
  analyzeContextRelevance(
    context: ConversationContext,
    currentInput: string
  ): {
    relevantMessages: ConversationMessage[]
    relevantTopics: Topic[]
    relevantEntities: EntityMention[]
    contextScore: number
  } {
    const relevantMessages = this.findRelevantMessages(context, currentInput)
    const relevantTopics = this.findRelevantTopics(context, currentInput)
    const relevantEntities = this.findRelevantEntities(context, currentInput)
    
    const contextScore = this.calculateContextScore(
      relevantMessages,
      relevantTopics,
      relevantEntities
    )
    
    return {
      relevantMessages,
      relevantTopics,
      relevantEntities,
      contextScore
    }
  }

  /**
   * 获取用户偏好
   */
  getUserPreferences(userId: string): Record<string, any> {
    // 从所有会话中收集用户偏好
    const userContexts = Array.from(this.contexts.values())
      .filter(ctx => ctx.userId === userId)
    
    const preferences: Record<string, any> = {}
    
    // 分析常用工具
    const toolUsage = new Map<string, number>()
    userContexts.forEach(ctx => {
      ctx.userProfile.toolUsageHistory.forEach(usage => {
        toolUsage.set(usage.toolName, (toolUsage.get(usage.toolName) || 0) + 1)
      })
    })
    
    preferences.favoriteTools = Array.from(toolUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool]) => tool)
    
    // 分析对话风格
    preferences.conversationStyle = this.analyzeConversationStyle(userContexts)
    
    // 分析活跃时间
    preferences.activeHours = this.analyzeActiveHours(userContexts)
    
    return preferences
  }

  /**
   * 清理过期上下文
   */
  cleanupExpiredContexts(): void {
    const now = Date.now()
    const expiredSessions: string[] = []
    
    for (const [sessionId, context] of this.contexts.entries()) {
      const lastActivity = Math.max(
        ...context.messageHistory.map(msg => msg.timestamp)
      )
      
      if (now - lastActivity > this.maxContextAge) {
        expiredSessions.push(sessionId)
      }
    }
    
    expiredSessions.forEach(sessionId => {
      this.contexts.delete(sessionId)
    })
    
    console.log(`🧹 清理了 ${expiredSessions.length} 个过期上下文`)
  }

  // 私有方法

  private createNewContext(sessionId: string, userId: string): ConversationContext {
    return {
      sessionId,
      userId,
      messageHistory: [],
      userProfile: {
        userId,
        preferences: {},
        recentIntents: [],
        toolUsageHistory: [],
        conversationStyle: 'neutral'
      },
      systemState: {
        availableModels: [],
        mcpTools: [],
        systemHealth: {},
        activeWorkflows: []
      },
      activeTopics: [],
      contextWindow: {
        recentMessages: [],
        extractedEntities: [],
        activeTopics: [],
        userIntentions: [],
        timeContext: this.getCurrentTimeContext()
      },
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now()
      }
    }
  }

  private addMessageToHistory(context: ConversationContext, message: ConversationMessage): void {
    context.messageHistory.push(message)
    
    // 限制历史长度
    if (context.messageHistory.length > this.maxHistoryLength) {
      context.messageHistory = context.messageHistory.slice(-this.maxHistoryLength)
    }
    
    context.metadata.lastUpdated = Date.now()
  }

  private updateIntentHistory(context: ConversationContext, intentResult: any): void {
    const intentHistory: IntentHistory = {
      intent: intentResult.primaryIntent,
      confidence: intentResult.confidence,
      timestamp: Date.now(),
      successful: true, // 假设成功，实际应该根据后续执行结果更新
      parameters: intentResult.parameters
    }
    
    context.userProfile.recentIntents.push(intentHistory)
    context.contextWindow.userIntentions.push(intentHistory)
    
    // 限制历史长度
    if (context.userProfile.recentIntents.length > 20) {
      context.userProfile.recentIntents = context.userProfile.recentIntents.slice(-20)
    }
  }

  private updateToolUsageHistory(context: ConversationContext, toolUsage: ToolUsage): void {
    context.userProfile.toolUsageHistory.push(toolUsage)
    
    // 限制历史长度
    if (context.userProfile.toolUsageHistory.length > 50) {
      context.userProfile.toolUsageHistory = context.userProfile.toolUsageHistory.slice(-50)
    }
  }

  private updateTopicsAndEntities(context: ConversationContext, message: ConversationMessage): void {
    // 简单的主题提取
    const topics = this.extractTopics(message.content)
    const entities = this.extractEntities(message.content)
    
    // 更新主题
    topics.forEach(topicName => {
      let topic = context.activeTopics.find(t => t.name === topicName)
      if (topic) {
        topic.frequency++
        topic.lastMentioned = message.timestamp
        topic.relevance = this.calculateTopicRelevance(topic)
      } else {
        context.activeTopics.push({
          name: topicName,
          relevance: 1.0,
          firstMentioned: message.timestamp,
          lastMentioned: message.timestamp,
          frequency: 1
        })
      }
    })
    
    // 更新实体
    entities.forEach(entity => {
      let entityMention = context.contextWindow.extractedEntities.find(
        e => e.entity === entity.value && e.type === entity.type
      )
      if (entityMention) {
        entityMention.frequency++
        entityMention.lastMentioned = message.timestamp
      } else {
        context.contextWindow.extractedEntities.push({
          entity: entity.value,
          type: entity.type,
          value: entity.value,
          confidence: entity.confidence,
          firstMentioned: message.timestamp,
          lastMentioned: message.timestamp,
          frequency: 1
        })
      }
    })
  }

  private updateContextWindow(context: ConversationContext): void {
    // 更新最近消息窗口
    context.contextWindow.recentMessages = context.messageHistory.slice(-10)
    
    // 更新活跃主题
    context.contextWindow.activeTopics = context.activeTopics
      .filter(topic => this.isTopicActive(topic))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5)
  }

  private cleanupExpiredData(context: ConversationContext): void {
    const now = Date.now()
    const maxAge = 60 * 60 * 1000 // 1小时
    
    // 清理过期主题
    context.activeTopics = context.activeTopics.filter(
      topic => now - topic.lastMentioned < maxAge
    )
    
    // 清理过期实体
    context.contextWindow.extractedEntities = context.contextWindow.extractedEntities.filter(
      entity => now - entity.lastMentioned < maxAge
    )
  }

  private findRelevantMessages(context: ConversationContext, input: string): ConversationMessage[] {
    const inputLower = input.toLowerCase()
    const keywords = inputLower.split(/\s+/).filter(word => word.length > 2)
    
    return context.messageHistory
      .filter(msg => {
        const contentLower = msg.content.toLowerCase()
        return keywords.some(keyword => contentLower.includes(keyword))
      })
      .slice(-5) // 最多返回5条相关消息
  }

  private findRelevantTopics(context: ConversationContext, input: string): Topic[] {
    const inputLower = input.toLowerCase()
    
    return context.activeTopics
      .filter(topic => inputLower.includes(topic.name.toLowerCase()))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 3)
  }

  private findRelevantEntities(context: ConversationContext, input: string): EntityMention[] {
    const inputLower = input.toLowerCase()
    
    return context.contextWindow.extractedEntities
      .filter(entity => inputLower.includes(entity.value.toLowerCase()))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
  }

  private calculateContextScore(
    messages: ConversationMessage[],
    topics: Topic[],
    entities: EntityMention[]
  ): number {
    let score = 0
    
    // 消息相关性得分
    score += messages.length * 0.2
    
    // 主题相关性得分
    score += topics.reduce((sum, topic) => sum + topic.relevance, 0) * 0.3
    
    // 实体相关性得分
    score += entities.reduce((sum, entity) => sum + entity.confidence, 0) * 0.5
    
    return Math.min(score, 1.0)
  }

  private getCurrentTimeContext(): TimeContext {
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.toLocaleDateString('zh-CN', { weekday: 'long' })
    
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
    if (hour < 6) timeOfDay = 'night'
    else if (hour < 12) timeOfDay = 'morning'
    else if (hour < 18) timeOfDay = 'afternoon'
    else timeOfDay = 'evening'
    
    return {
      currentTime: now.getTime(),
      timeOfDay,
      dayOfWeek,
      isWeekend: now.getDay() === 0 || now.getDay() === 6
    }
  }

  private extractTopics(content: string): string[] {
    // 简单的主题提取逻辑
    const words = content.toLowerCase().split(/\s+/)
    const topics: string[] = []
    
    for (const word of words) {
      if (word.length > 3 && !this.isStopWord(word)) {
        topics.push(word)
      }
    }
    
    return [...new Set(topics)].slice(0, 5)
  }

  private extractEntities(content: string): Array<{ type: string; value: string; confidence: number }> {
    const entities: Array<{ type: string; value: string; confidence: number }> = []
    
    // 数字实体
    const numbers = content.match(/\d+(\.\d+)?/g)
    if (numbers) {
      numbers.forEach(num => {
        entities.push({ type: 'number', value: num, confidence: 0.9 })
      })
    }
    
    // 时间实体
    const times = content.match(/\d{1,2}:\d{2}|\d{1,2}点/g)
    if (times) {
      times.forEach(time => {
        entities.push({ type: 'time', value: time, confidence: 0.8 })
      })
    }
    
    return entities
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', '的', '了', '是', '在', '有', '和', '或', '但是']
    return stopWords.includes(word)
  }

  private calculateTopicRelevance(topic: Topic): number {
    const now = Date.now()
    const timeSinceLastMention = now - topic.lastMentioned
    const ageInHours = timeSinceLastMention / (60 * 60 * 1000)
    
    // 基于频率和时间衰减计算相关性
    const frequencyScore = Math.min(topic.frequency / 10, 1.0)
    const timeDecay = Math.exp(-ageInHours / 24) // 24小时半衰期
    
    return frequencyScore * timeDecay
  }

  private isTopicActive(topic: Topic): boolean {
    const now = Date.now()
    const timeSinceLastMention = now - topic.lastMentioned
    const maxAge = 2 * 60 * 60 * 1000 // 2小时
    
    return timeSinceLastMention < maxAge && topic.relevance > 0.1
  }

  private analyzeConversationStyle(contexts: ConversationContext[]): string {
    // 简化的对话风格分析
    let totalMessages = 0
    let questionCount = 0
    let commandCount = 0
    
    contexts.forEach(ctx => {
      ctx.messageHistory.forEach(msg => {
        if (msg.role === 'user') {
          totalMessages++
          if (msg.content.includes('?') || msg.content.includes('？')) {
            questionCount++
          }
          if (msg.content.match(/^(请|帮|执行|运行|开始)/)) {
            commandCount++
          }
        }
      })
    })
    
    if (totalMessages === 0) return 'neutral'
    
    const questionRatio = questionCount / totalMessages
    const commandRatio = commandCount / totalMessages
    
    if (questionRatio > 0.6) return 'inquisitive'
    if (commandRatio > 0.6) return 'directive'
    return 'conversational'
  }

  private analyzeActiveHours(contexts: ConversationContext[]): number[] {
    const hourCounts = new Array(24).fill(0)
    
    contexts.forEach(ctx => {
      ctx.messageHistory.forEach(msg => {
        const hour = new Date(msg.timestamp).getHours()
        hourCounts[hour]++
      })
    })
    
    // 返回最活跃的3个小时
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour)
  }
}