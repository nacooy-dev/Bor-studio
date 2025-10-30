/**
 * 混合意图识别引擎
 * 结合快思维（规则）和慢思维（LLM）的双层机制
 */

export interface IntentResult {
  intent: string
  confidence: number
  tool?: string
  parameters?: Record<string, any>
  reasoning: string
  processingTime: number
  method: 'fast' | 'slow'
}

export interface FastRule {
  pattern: RegExp
  intent: string
  tool: string
  confidence: number
  paramExtractor: (input: string) => Record<string, any>
}

export class HybridIntentEngine {
  private fastRules: FastRule[] = []
  private fastThreshold = 0.8  // 快思维置信度阈值
  private slowFallback = true  // 是否启用慢思维回退

  constructor() {
    this.initializeFastRules()
  }

  /**
   * 🚀 主要意图识别入口
   */
  async recognizeIntent(input: string): Promise<IntentResult> {
    const startTime = Date.now()
    
    // 🏃‍♂️ 快思维：规则匹配
    const fastResult = this.fastThinking(input)
    
    if (fastResult.confidence >= this.fastThreshold) {
      console.log(`⚡ 快思维识别成功: ${fastResult.intent} (${fastResult.confidence})`)
      return {
        ...fastResult,
        processingTime: Date.now() - startTime,
        method: 'fast'
      }
    }

    // 🤔 慢思维：LLM分析（仅在快思维不确定时）
    if (this.slowFallback && fastResult.confidence < 0.6) {
      console.log(`🧠 启用慢思维分析...`)
      const slowResult = await this.slowThinking(input, fastResult)
      
      return {
        ...slowResult,
        processingTime: Date.now() - startTime,
        method: 'slow'
      }
    }

    // 返回快思维结果（即使置信度不高）
    return {
      ...fastResult,
      processingTime: Date.now() - startTime,
      method: 'fast'
    }
  }

  /**
   * ⚡ 快思维：基于规则的快速匹配
   */
  private fastThinking(input: string): Omit<IntentResult, 'processingTime' | 'method'> {
    const lowerInput = input.toLowerCase().trim()
    
    // 遍历快速规则
    for (const rule of this.fastRules) {
      if (rule.pattern.test(lowerInput)) {
        const parameters = rule.paramExtractor(input)
        
        return {
          intent: rule.intent,
          confidence: rule.confidence,
          tool: rule.tool,
          parameters,
          reasoning: `快速规则匹配: ${rule.pattern.source}`
        }
      }
    }

    // 未匹配到规则
    return {
      intent: 'unknown',
      confidence: 0.3,
      reasoning: '未匹配到快速规则'
    }
  }

  /**
   * 🤔 慢思维：LLM驱动的深度分析（包含快思维的5个工具 + 其他MCP工具）
   */
  private async slowThinking(
    input: string, 
    fastResult: Omit<IntentResult, 'processingTime' | 'method'>
  ): Promise<Omit<IntentResult, 'processingTime' | 'method'>> {
    
    console.log('🧠 慢思维启动：深度分析所有可能的工具选择')
    
    // 🔄 慢思维重新评估所有工具，包括快思维的5个核心工具
    // 这样可以避免快思维的判断遗漏
    
    // 1. 重新检查核心工具（更宽松的匹配）
    const coreToolResult = this.recheckCoreTools(input)
    if (coreToolResult.confidence > 0.5) {
      return {
        ...coreToolResult,
        reasoning: `慢思维重新识别核心工具: ${coreToolResult.reasoning}`
      }
    }

    // 2. 分析其他MCP工具的可能性
    const mcpToolResult = this.analyzeMCPTools(input)
    if (mcpToolResult.confidence > 0.4) {
      return {
        ...mcpToolResult,
        reasoning: `慢思维识别MCP工具: ${mcpToolResult.reasoning}`
      }
    }

    // 3. 最终回退到LLM分析
    return {
      intent: 'llm_analysis_required',
      confidence: 0.6,
      reasoning: '需要LLM深度分析来选择合适的工具',
      tool: undefined, // 让LLM来决定
      parameters: { originalInput: input }
    }
  }

  /**
   * 🔄 慢思维重新检查核心工具（更宽松的匹配）
   */
  private recheckCoreTools(input: string): Omit<IntentResult, 'processingTime' | 'method'> {
    const lowerInput = input.toLowerCase()

    // 更宽松的搜索检测
    if (this.containsSearchIntent(input)) {
      return {
        intent: 'web_search',
        tool: 'search',
        confidence: 0.8,
        parameters: { query: this.extractSearchQuery(input) },
        reasoning: '慢思维检测到搜索意图'
      }
    }

    // 更宽松的文档检测
    if (this.containsDocumentIntent(input)) {
      return {
        intent: 'obsidian_doc',
        tool: 'obsidian_operation',
        confidence: 0.7,
        parameters: this.extractDocumentParameters(input),
        reasoning: '慢思维检测到文档操作意图'
      }
    }

    // 更宽松的计算检测
    if (this.containsCalculationIntent(input)) {
      return {
        intent: 'calculation',
        tool: 'advanced_calculator',
        confidence: 0.7,
        parameters: { expression: this.extractCalculationExpression(input) },
        reasoning: '慢思维检测到计算意图'
      }
    }

    // 时间相关检测
    if (this.containsTimeIntent(input)) {
      return {
        intent: 'time_sync',
        tool: 'get_current_time',
        confidence: 0.8,
        parameters: { format: 'full', timezone: 'local' },
        reasoning: '慢思维检测到时间查询意图'
      }
    }

    // 知识库检测
    if (this.containsKnowledgeIntent(input)) {
      return {
        intent: 'knowledge_search',
        tool: 'ultrarag_search',
        confidence: 0.7,
        parameters: { query: input },
        reasoning: '慢思维检测到知识库查询意图'
      }
    }

    return {
      intent: 'unknown',
      confidence: 0.2,
      reasoning: '慢思维未识别到核心工具意图'
    }
  }

  /**
   * 🔧 分析其他MCP工具的可能性
   */
  private analyzeMCPTools(input: string): Omit<IntentResult, 'processingTime' | 'method'> {
    // 这里可以添加对其他MCP工具的分析逻辑
    // 比如检测特定的工具关键词、模式等
    
    return {
      intent: 'other_mcp_tool',
      confidence: 0.3,
      reasoning: '可能需要其他MCP工具处理'
    }
  }

  /**
   * 🔧 初始化快速规则 - 5个核心工具 + 模糊空间
   */
  private initializeFastRules(): void {
    this.fastRules = [
      // 🔧 系统配置 - 精确匹配
      {
        pattern: /^设置\s*bor$/i,
        intent: 'system_config',
        tool: 'navigate_to_config',
        confidence: 1.0,
        paramExtractor: () => ({ page: 'config' })
      },

      // 🔍 DuckDuckGo网络搜索 - 高置信度
      {
        pattern: /^(搜索|search|查找|find)\s+(.+)/i,
        intent: 'web_search',
        tool: 'search',
        confidence: 0.95,
        paramExtractor: (input) => ({
          query: input.replace(/^(搜索|search|查找|find)\s+/i, '').trim()
        })
      },

      // 📝 Obsidian文档管理 - 高置信度
      {
        pattern: /^(创建|新建|写|编辑|打开|删除|列出)\s*(笔记|文档|日记)\s*(.*)$/i,
        intent: 'obsidian_doc',
        tool: 'obsidian_operation',
        confidence: 0.9,
        paramExtractor: (input) => {
          const operation = this.extractObsidianOperation(input)
          const content = input.replace(/^(创建|新建|写|编辑|打开|删除|列出)\s*(笔记|文档|日记)\s*/i, '').trim()
          const isDaily = /日记|diary/i.test(input)
          
          return {
            operation,
            path: isDaily ? `日记/${new Date().toISOString().split('T')[0]}.md` : `笔记_${Date.now()}.md`,
            content: content || (isDaily ? '# 今日日记\n\n' : '# 新笔记\n\n')
          }
        }
      },

      // 🕐 时间查询和对齐 - 高置信度
      {
        pattern: /^(现在几点|当前时间|时间|time|what time)/i,
        intent: 'time_sync',
        tool: 'get_current_time',
        confidence: 0.95,
        paramExtractor: () => ({
          format: 'full',
          timezone: 'local'
        })
      },

      // 🧮 高级计算器 - 高置信度
      {
        pattern: /^(计算|算|calculate|math)\s+(.+)/i,
        intent: 'calculation',
        tool: 'advanced_calculator',
        confidence: 0.9,
        paramExtractor: (input) => ({
          expression: input.replace(/^(计算|算|calculate|math)\s+/i, '').trim()
        })
      },

      // 📚 UltraRAG知识库 - 高置信度
      {
        pattern: /^(知识库|knowledge|查询知识|搜索知识)\s*(.*)$/i,
        intent: 'knowledge_search',
        tool: 'ultrarag_search',
        confidence: 0.9,
        paramExtractor: (input) => ({
          query: input.replace(/^(知识库|knowledge|查询知识|搜索知识)\s*/i, '').trim() || input
        })
      },

      // 🌫️ 模糊空间 - 中等置信度的模糊匹配
      // 搜索相关的模糊匹配
      {
        pattern: /(搜索|查找|找|search|find).*/i,
        intent: 'fuzzy_search',
        tool: 'search',
        confidence: 0.7,
        paramExtractor: (input) => ({
          query: input.replace(/(搜索|查找|找|search|find)\s*/i, '').trim() || input
        })
      },

      // 文档相关的模糊匹配
      {
        pattern: /(笔记|文档|日记|记录|note|document|diary).*/i,
        intent: 'fuzzy_note',
        tool: 'obsidian_operation',
        confidence: 0.6,
        paramExtractor: (input) => ({
          operation: 'create',
          path: `笔记_${Date.now()}.md`,
          content: input
        })
      },

      // 计算相关的模糊匹配
      {
        pattern: /.*(计算|算|数学|math|calculate).*/i,
        intent: 'fuzzy_calc',
        tool: 'advanced_calculator',
        confidence: 0.6,
        paramExtractor: (input) => ({
          expression: input.replace(/.*(计算|算|数学|math|calculate)\s*/i, '').trim()
        })
      }
    ]
  }

  /**
   * 提取Obsidian操作类型
   */
  private extractObsidianOperation(input: string): string {
    const lowerInput = input.toLowerCase()
    if (lowerInput.includes('创建') || lowerInput.includes('新建') || lowerInput.includes('写')) return 'create'
    if (lowerInput.includes('编辑') || lowerInput.includes('修改')) return 'edit'
    if (lowerInput.includes('打开') || lowerInput.includes('查看')) return 'open'
    if (lowerInput.includes('删除') || lowerInput.includes('移除')) return 'delete'
    if (lowerInput.includes('列出') || lowerInput.includes('显示')) return 'list'
    return 'create' // 默认创建
  }

  // 🔍 慢思维的宽松检测方法
  private containsSearchIntent(input: string): boolean {
    return /搜索|查找|找|search|find|查询|询问|问/i.test(input)
  }

  private containsDocumentIntent(input: string): boolean {
    return /笔记|文档|日记|记录|写|创建|新建|保存|note|document|diary|create|write|save/i.test(input)
  }

  private containsCalculationIntent(input: string): boolean {
    return /计算|算|数学|运算|math|calculate|compute|加|减|乘|除|\+|\-|\*|\/|\d+.*[\+\-\*\/].*\d+/i.test(input)
  }

  private containsTimeIntent(input: string): boolean {
    return /时间|几点|现在|当前|today|time|now|clock|日期|date/i.test(input)
  }

  private containsKnowledgeIntent(input: string): boolean {
    return /知识|知识库|学习|了解|解释|说明|knowledge|learn|explain|understand|什么是|how|why/i.test(input)
  }

  private extractSearchQuery(input: string): string {
    return input.replace(/^.*(搜索|查找|找|search|find|查询|询问|问)\s*/i, '').trim() || input
  }

  private extractDocumentParameters(input: string): Record<string, any> {
    const operation = this.extractObsidianOperation(input)
    const content = input.replace(/^.*(创建|新建|写|编辑|打开|删除|列出)\s*(笔记|文档|日记)\s*/i, '').trim()
    const isDaily = /日记|diary/i.test(input)
    
    return {
      operation,
      path: isDaily ? `日记/${new Date().toISOString().split('T')[0]}.md` : `笔记_${Date.now()}.md`,
      content: content || (isDaily ? '# 今日日记\n\n' : '# 新笔记\n\n')
    }
  }

  private extractCalculationExpression(input: string): string {
    // 尝试提取数学表达式
    const mathMatch = input.match(/[\d+\-*/().\s]+/)
    if (mathMatch) {
      return mathMatch[0].trim()
    }
    return input.replace(/^.*(计算|算|数学|math|calculate)\s*/i, '').trim()
  }

  /**
   * 🔧 配置引擎参数
   */
  configure(options: {
    fastThreshold?: number
    slowFallback?: boolean
  }): void {
    if (options.fastThreshold !== undefined) {
      this.fastThreshold = options.fastThreshold
    }
    if (options.slowFallback !== undefined) {
      this.slowFallback = options.slowFallback
    }
  }

  /**
   * 📊 获取引擎统计
   */
  getStats(): { fastRulesCount: number; fastThreshold: number; slowFallback: boolean } {
    return {
      fastRulesCount: this.fastRules.length,
      fastThreshold: this.fastThreshold,
      slowFallback: this.slowFallback
    }
  }
}

// 单例导出
export const hybridIntentEngine = new HybridIntentEngine()