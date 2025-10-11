/**
 * 聊天集成系统 - 在聊天中智能建议和使用MCP工具
 */

import { mcpService } from '@/services/mcp'
import { aiIntegration } from './ai-integration'
import { toolDiscovery } from './tool-discovery'

export interface ChatToolSuggestion {
  tool: string
  confidence: number
  reason: string
  parameters?: Record<string, any>
  example?: string
}

export interface ChatContext {
  userMessage: string
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>
  currentTopic?: string
  userIntent?: string
}

/**
 * 聊天集成管理器
 */
export class ChatIntegrationManager {
  private toolUsageHistory: Map<string, number> = new Map()
  private contextKeywords: Map<string, string[]> = new Map()

  constructor() {
    this.initializeContextKeywords()
  }

  /**
   * 初始化上下文关键词映射
   */
  private initializeContextKeywords(): void {
    this.contextKeywords.set('文件操作', [
      '文件', '目录', '读取', '写入', '保存', '删除', '创建', '编辑',
      'file', 'directory', 'read', 'write', 'save', 'delete', 'create', 'edit'
    ])
    
    this.contextKeywords.set('搜索工具', [
      '搜索', '查找', '寻找', '搜', '找', '查询',
      'search', 'find', 'look', 'query', 'lookup'
    ])
    
    this.contextKeywords.set('笔记管理', [
      '笔记', '记录', '备忘', '笔记本', '记忆', '保存',
      'note', 'memo', 'record', 'remember', 'notebook'
    ])
    
    this.contextKeywords.set('时间工具', [
      '时间', '日期', '时区', '现在', '当前', '什么时候',
      'time', 'date', 'timezone', 'now', 'current', 'when'
    ])
    
    this.contextKeywords.set('计算工具', [
      '计算', '算', '数学', '公式', '表达式', '结果',
      'calculate', 'compute', 'math', 'formula', 'expression'
    ])
    
    this.contextKeywords.set('数据库', [
      '数据库', '查询', '数据', '表', '记录', 'sql',
      'database', 'query', 'data', 'table', 'record', 'sql'
    ])
  }

  /**
   * 分析用户消息并提供工具建议
   */
  async analyzeMessage(context: ChatContext): Promise<ChatToolSuggestion[]> {
    const suggestions: ChatToolSuggestion[] = []
    
    try {
      // 1. 基于关键词匹配
      const keywordSuggestions = this.getKeywordBasedSuggestions(context.userMessage)
      suggestions.push(...keywordSuggestions)
      
      // 2. 基于意图分析
      const intentSuggestions = this.getIntentBasedSuggestions(context)
      suggestions.push(...intentSuggestions)
      
      // 3. 基于历史使用
      const historySuggestions = this.getHistoryBasedSuggestions(context)
      suggestions.push(...historySuggestions)
      
      // 4. 去重和排序
      const uniqueSuggestions = this.deduplicateAndRank(suggestions)
      
      return uniqueSuggestions.slice(0, 3) // 最多返回3个建议
      
    } catch (error) {
      console.error('分析消息失败:', error)
      return []
    }
  }

  /**
   * 基于关键词的工具建议
   */
  private getKeywordBasedSuggestions(message: string): ChatToolSuggestion[] {
    const suggestions: ChatToolSuggestion[] = []
    const messageLower = message.toLowerCase()
    
    for (const [category, keywords] of this.contextKeywords) {
      let matchCount = 0
      const matchedKeywords: string[] = []
      
      for (const keyword of keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          matchCount++
          matchedKeywords.push(keyword)
        }
      }
      
      if (matchCount > 0) {
        const tools = this.getToolsByCategory(category)
        
        for (const tool of tools) {
          suggestions.push({
            tool: tool.name,
            confidence: Math.min(matchCount * 0.3, 0.9),
            reason: `检测到${category}相关关键词: ${matchedKeywords.slice(0, 2).join(', ')}`,
            example: tool.examples?.[0]?.description
          })
        }
      }
    }
    
    return suggestions
  }

  /**
   * 基于意图分析的工具建议
   */
  private getIntentBasedSuggestions(context: ChatContext): ChatToolSuggestion[] {
    const suggestions: ChatToolSuggestion[] = []
    const message = context.userMessage.toLowerCase()
    
    // 检测常见意图模式
    const intentPatterns = [
      {
        pattern: /帮我(.*)(文件|目录)/,
        category: '文件操作',
        confidence: 0.8,
        reason: '检测到文件操作意图'
      },
      {
        pattern: /(搜索|查找|找)(.*)/,
        category: '搜索工具',
        confidence: 0.7,
        reason: '检测到搜索意图'
      },
      {
        pattern: /(记录|记住|保存)(.*)/,
        category: '笔记管理',
        confidence: 0.7,
        reason: '检测到记录意图'
      },
      {
        pattern: /(现在|当前)(.*)(时间|几点)/,
        category: '时间工具',
        confidence: 0.9,
        reason: '检测到时间查询意图'
      },
      {
        pattern: /(计算|算)(.*)/,
        category: '计算工具',
        confidence: 0.8,
        reason: '检测到计算意图'
      }
    ]
    
    for (const intent of intentPatterns) {
      if (intent.pattern.test(message)) {
        const tools = this.getToolsByCategory(intent.category)
        
        for (const tool of tools) {
          suggestions.push({
            tool: tool.name,
            confidence: intent.confidence,
            reason: intent.reason,
            example: tool.examples?.[0]?.description
          })
        }
      }
    }
    
    return suggestions
  }

  /**
   * 基于历史使用的工具建议
   */
  private getHistoryBasedSuggestions(context: ChatContext): ChatToolSuggestion[] {
    const suggestions: ChatToolSuggestion[] = []
    
    // 分析对话历史中的工具使用模式
    const recentMessages = context.conversationHistory.slice(-5) // 最近5条消息
    
    for (const message of recentMessages) {
      if (message.role === 'assistant' && message.content.includes('工具')) {
        // 提取可能使用的工具名称
        const toolMatches = message.content.match(/使用\s*(\w+)\s*工具/g)
        
        if (toolMatches) {
          for (const match of toolMatches) {
            const toolName = match.replace(/使用\s*|\s*工具/g, '')
            const usageCount = this.toolUsageHistory.get(toolName) || 0
            
            if (usageCount > 0) {
              suggestions.push({
                tool: toolName,
                confidence: Math.min(usageCount * 0.1, 0.6),
                reason: `基于历史使用记录 (${usageCount}次)`
              })
            }
          }
        }
      }
    }
    
    return suggestions
  }

  /**
   * 去重和排序建议
   */
  private deduplicateAndRank(suggestions: ChatToolSuggestion[]): ChatToolSuggestion[] {
    const toolMap = new Map<string, ChatToolSuggestion>()
    
    // 合并相同工具的建议，取最高置信度
    for (const suggestion of suggestions) {
      const existing = toolMap.get(suggestion.tool)
      
      if (!existing || suggestion.confidence > existing.confidence) {
        toolMap.set(suggestion.tool, suggestion)
      }
    }
    
    // 按置信度排序
    return Array.from(toolMap.values())
      .sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 根据类别获取工具
   */
  private getToolsByCategory(category: string): any[] {
    const allTools = toolDiscovery.getAllKnownTools()
    return allTools.filter(tool => tool.category === category)
  }

  /**
   * 生成工具使用提示
   */
  generateToolPrompt(suggestions: ChatToolSuggestion[]): string {
    if (suggestions.length === 0) {
      return ''
    }
    
    let prompt = '\n\n💡 **建议使用的工具**:\n'
    
    for (const suggestion of suggestions) {
      prompt += `- **${suggestion.tool}** (置信度: ${(suggestion.confidence * 100).toFixed(0)}%)\n`
      prompt += `  ${suggestion.reason}\n`
      
      if (suggestion.example) {
        prompt += `  示例: ${suggestion.example}\n`
      }
      
      prompt += '\n'
    }
    
    prompt += '你可以说"使用 [工具名] 来..."让我帮你执行相应的操作。'
    
    return prompt
  }

  /**
   * 执行工具并记录使用
   */
  async executeToolWithContext(
    toolName: string, 
    parameters: Record<string, any>,
    context: ChatContext
  ): Promise<any> {
    try {
      // 执行工具
      const result = await mcpService.executeTool({
        tool: toolName,
        parameters
      })
      
      // 记录使用历史
      if (result.success) {
        const currentCount = this.toolUsageHistory.get(toolName) || 0
        this.toolUsageHistory.set(toolName, currentCount + 1)
      }
      
      return result
      
    } catch (error) {
      console.error(`执行工具 ${toolName} 失败:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '执行失败'
      }
    }
  }

  /**
   * 生成智能回复建议
   */
  generateSmartReply(context: ChatContext, toolResults?: any[]): string {
    let reply = ''
    
    // 基于工具执行结果生成回复
    if (toolResults && toolResults.length > 0) {
      const successfulResults = toolResults.filter(r => r.success)
      const failedResults = toolResults.filter(r => !r.success)
      
      if (successfulResults.length > 0) {
        reply += '✅ 已成功执行以下操作:\n'
        
        for (const result of successfulResults) {
          reply += `- ${result.tool}: ${this.formatToolResult(result.data)}\n`
        }
      }
      
      if (failedResults.length > 0) {
        reply += '\n❌ 以下操作执行失败:\n'
        
        for (const result of failedResults) {
          reply += `- ${result.tool}: ${result.error}\n`
        }
      }
    }
    
    // 添加后续建议
    const suggestions = this.getFollowUpSuggestions(context, toolResults)
    if (suggestions.length > 0) {
      reply += '\n💡 你还可以:\n'
      
      for (const suggestion of suggestions) {
        reply += `- ${suggestion}\n`
      }
    }
    
    return reply
  }

  /**
   * 获取后续操作建议
   */
  private getFollowUpSuggestions(context: ChatContext, toolResults?: any[]): string[] {
    const suggestions: string[] = []
    
    // 基于执行的工具类型提供建议
    if (toolResults) {
      for (const result of toolResults) {
        if (result.success) {
          switch (result.tool) {
            case 'search':
              suggestions.push('进一步搜索相关内容')
              suggestions.push('保存搜索结果到笔记')
              break
            case 'read_file':
              suggestions.push('编辑文件内容')
              suggestions.push('搜索文件中的特定内容')
              break
            case 'calculate':
              suggestions.push('进行更复杂的计算')
              suggestions.push('保存计算结果')
              break
          }
        }
      }
    }
    
    return suggestions.slice(0, 3) // 最多3个建议
  }

  /**
   * 格式化工具执行结果
   */
  private formatToolResult(data: any): string {
    if (typeof data === 'string') {
      return data.length > 100 ? data.substring(0, 100) + '...' : data
    }
    
    if (typeof data === 'object') {
      try {
        const jsonStr = JSON.stringify(data, null, 2)
        return jsonStr.length > 200 ? '执行成功，结果较长' : jsonStr
      } catch {
        return '执行成功'
      }
    }
    
    return String(data)
  }

  /**
   * 获取工具使用统计
   */
  getUsageStatistics(): Record<string, number> {
    return Object.fromEntries(this.toolUsageHistory)
  }

  /**
   * 清除使用历史
   */
  clearUsageHistory(): void {
    this.toolUsageHistory.clear()
  }
}

// 单例实例
export const chatIntegration = new ChatIntegrationManager()