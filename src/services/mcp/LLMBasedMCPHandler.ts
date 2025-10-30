/**
 * 基于LLM的MCP处理器
 * 让LLM来决定工具调用，而不是硬编码规则
 */

export interface MCPCallRequest {
  tool: string
  parameters: Record<string, any>
  server?: string
}

export interface MCPCallResult {
  success: boolean
  data?: any
  error?: string
}

export interface MCPTool {
  name: string
  server: string
  description?: string
  inputSchema?: any
}

export class LLMBasedMCPHandler {
  private availableTools: MCPTool[] = []

  /**
   * 🚀 初始化 - 获取所有可用的MCP工具
   */
  async initialize(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.mcp) {
        const toolsResult = await window.electronAPI.mcp.getTools()
        if (toolsResult.success && toolsResult.data) {
          this.availableTools = toolsResult.data
          console.log('🔧 LLM-MCP处理器发现工具:', this.availableTools.map(t => 
            `${t.name} (${t.server})`
          ))
        }
      }
    } catch (error) {
      console.error('❌ LLM-MCP处理器初始化失败:', error)
    }
  }

  /**
   * 📋 获取可用工具列表供LLM使用
   */
  getAvailableTools(): MCPTool[] {
    return this.availableTools
  }

  /**
   * 🎯 检查是否有可用的MCP工具
   */
  hasAvailableTools(): boolean {
    return this.availableTools.length > 0
  }

  /**
   * ⚡ 快速意图检测 - 修复工具选择逻辑
   */
  quickIntentDetection(input: string): { needsTools: boolean; suggestedTool?: string; confidence: number } {
    const lowerInput = input.toLowerCase().trim()
    
    // 🔍 搜索意图检测 - 最高优先级
    const searchPatterns = [
      /^搜索.+/,
      /^查找.+/,
      /^search\s+.+/i,
      /^find\s+.+/i,
      /^搜\s*.+/,
      /^查\s*.+/
    ]
    
    for (const pattern of searchPatterns) {
      if (pattern.test(lowerInput)) {
        // 🔥 修复：正确选择网页搜索工具
        const webSearchTool = this.findBestWebSearchTool()
        console.log(`🎯 为搜索请求选择工具: ${webSearchTool?.name}`)
        
        return {
          needsTools: true,
          suggestedTool: webSearchTool?.name || 'search',
          confidence: 0.9
        }
      }
    }

    // 📝 笔记操作检测 - 增强模式
    const notePatterns = [
      /创建.*笔记/,
      /新建.*笔记/,
      /保存.*笔记/,
      /搜索.*笔记/,
      /查找.*笔记/,
      /创建.*文档/,
      /新建.*文档/,
      /创建.*日记/,
      /新建.*日记/,
      /写.*日记/,
      /记录.*日记/
    ]
    
    for (const pattern of notePatterns) {
      if (pattern.test(lowerInput)) {
        console.log(`📝 检测到笔记操作: ${pattern.source}`)
        const noteTool = this.availableTools.find(t => 
          t.name.includes('create_note') || 
          (t.name.includes('note') && t.name.includes('create')) ||
          t.server === 'obsidian'
        )
        return {
          needsTools: true,
          suggestedTool: noteTool?.name,
          confidence: 0.8
        }
      }
    }

    // 🧮 计算操作检测
    if (/计算|算|数学|math|calculate/.test(lowerInput)) {
      const calcTool = this.availableTools.find(t => 
        t.name.includes('calc') || t.name.includes('math')
      )
      return {
        needsTools: true,
        suggestedTool: calcTool?.name,
        confidence: 0.7
      }
    }

    // 默认不需要工具
    return {
      needsTools: false,
      confidence: 0.3
    }
  }

  /**
   * 🔍 找到最佳的网页搜索工具 - 修复选择逻辑
   */
  private findBestWebSearchTool(): MCPTool | undefined {
    console.log('🔍 所有可用工具:', this.availableTools.map(t => `${t.name} (${t.server})`))

    // 🚀 直接查找DuckDuckGo搜索工具
    const duckduckgoTool = this.availableTools.find(tool => 
      tool.server === 'duckduckgo-search' || 
      tool.name === 'search' && tool.server?.includes('duckduckgo')
    )
    
    if (duckduckgoTool) {
      console.log(`✅ 找到DuckDuckGo搜索工具: ${duckduckgoTool.name}`)
      return duckduckgoTool
    }

    // 查找名为 'search' 的工具（通常是网页搜索）
    const genericSearchTool = this.availableTools.find(tool => 
      tool.name === 'search' && tool.server !== 'obsidian'
    )
    
    if (genericSearchTool) {
      console.log(`✅ 找到通用搜索工具: ${genericSearchTool.name}`)
      return genericSearchTool
    }

    // 🔥 排除Obsidian工具，只选择网页搜索工具
    const webSearchTools = this.availableTools.filter(tool => {
      const name = tool.name.toLowerCase()
      const server = tool.server?.toLowerCase() || ''
      
      // 排除Obsidian相关工具
      if (server.includes('obsidian')) {
        return false
      }
      
      // 排除明确的非网页搜索工具
      if (name.includes('regex') || name.includes('property') || name.includes('date') || name.includes('note')) {
        return false
      }
      
      // 包含网页搜索工具
      return name.includes('search') || name.includes('web') || name.includes('google') || name.includes('bing')
    })

    console.log('🌐 过滤后的网页搜索工具:', webSearchTools.map(t => `${t.name} (${t.server})`))

    if (webSearchTools.length > 0) {
      console.log(`📋 使用第一个网页搜索工具: ${webSearchTools[0].name}`)
      return webSearchTools[0]
    }

    console.warn('❌ 没有找到合适的网页搜索工具')
    return undefined
  }

  /**
   * 📝 为LLM格式化工具信息 - 高效简洁版本
   */
  formatToolsForLLM(): string {
    if (this.availableTools.length === 0) {
      return '当前没有可用的MCP工具。'
    }

    // 🚀 高效格式化 - 只包含关键信息，减少token消耗
    const toolsInfo = this.availableTools.map(tool => {
      const params = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties).slice(0, 3) : []
      return `• ${tool.name}: ${tool.description || '通用工具'}${params.length ? ` (${params.join(', ')})` : ''}`
    }).join('\n')

    return `🔧 可用工具:
${toolsInfo}

💡 调用格式: \`\`\`tool-call
{"tool": "工具名", "parameters": {"参数": "值"}}
\`\`\``
  }

  /**
   * 🔧 执行LLM指定的工具调用
   */
  async executeToolCall(toolName: string, parameters: Record<string, any>): Promise<MCPCallResult> {
    try {
      console.log(`🎯 执行LLM选择的工具: ${toolName}`, parameters)

      // 查找工具信息
      const tool = this.availableTools.find(t => t.name === toolName)
      if (!tool) {
        throw new Error(`工具 "${toolName}" 不存在`)
      }

      const toolCall: MCPCallRequest = {
        tool: toolName,
        parameters: parameters,
        server: tool.server
      }

      console.log('📡 发送工具调用:', toolCall)
      const result = await window.electronAPI.mcp.executeTool(toolCall)
      console.log('📥 工具执行结果:', result)

      return result
    } catch (error) {
      console.error(`❌ 工具执行失败:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 🔍 解析LLM的工具调用意图
   * 这个方法帮助解析LLM可能的工具调用格式
   */
  parseToolCallFromLLMResponse(response: string): { toolName: string; parameters: Record<string, any> } | null {
    try {
      // 尝试匹配常见的工具调用格式
      const patterns = [
        // 格式1: "调用 toolName 工具，参数 {json}"
        /调用\s+(\w+)\s+工具[，,]\s*参数[：:]\s*(\{.*?\})/,
        // 格式2: "使用 toolName {json}"
        /使用\s+(\w+)\s+(\{.*?\})/,
        // 格式3: "toolName({json})"
        /(\w+)\s*\(\s*(\{.*?\})\s*\)/
      ]

      for (const pattern of patterns) {
        const match = response.match(pattern)
        if (match) {
          const toolName = match[1]
          const parametersStr = match[2]
          
          try {
            const parameters = JSON.parse(parametersStr)
            return { toolName, parameters }
          } catch (e) {
            console.warn('参数解析失败:', parametersStr)
          }
        }
      }

      return null
    } catch (error) {
      console.error('解析工具调用失败:', error)
      return null
    }
  }

  /**
   * 📊 获取工具使用统计
   */
  getToolStats(): { totalTools: number; serverCount: Record<string, number> } {
    const serverCount: Record<string, number> = {}
    
    for (const tool of this.availableTools) {
      serverCount[tool.server] = (serverCount[tool.server] || 0) + 1
    }

    return {
      totalTools: this.availableTools.length,
      serverCount
    }
  }
}

// 创建单例实例
export const llmMCPHandler = new LLMBasedMCPHandler()