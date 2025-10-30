/**
 * MCP管理器 - 基于官方DuckDuckGo MCP服务器的简洁实现
 * 参考: https://github.com/nickclyde/duckduckgo-mcp-server
 */

import { mcpService } from '../mcp'
import type { MCPTool, MCPToolCall } from '@/types'

export interface ToolCallRequest {
  tool: string
  parameters: Record<string, any>
  server?: string
}

export interface ToolCallResult {
  success: boolean
  result?: any
  error?: string
  toolName: string
}

export class MCPManager {
  private availableTools: MCPTool[] = []
  private initialized = false
  private readonly DUCKDUCKGO_SERVER_ID = 'duckduckgo-search'

  /**
   * 初始化MCP管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('🔄 MCP管理器已初始化，跳过')
      return
    }

    try {
      console.log('🚀 初始化MCP管理器...')
      
      // 从electron端获取真实的工具列表
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          // 启动服务器
          console.log('🚀 启动MCP服务器...')
          await window.electronAPI.mcp.startServer('duckduckgo-search')
          await window.electronAPI.mcp.startServer('obsidian')
          
          // 等待服务器启动
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          // 获取工具列表
          const toolsResult = await window.electronAPI.mcp.getTools()
          if (toolsResult.success && toolsResult.data) {
            this.availableTools = toolsResult.data
            console.log(`✅ 从MCP服务器获取到 ${this.availableTools.length} 个工具`)
          } else {
            console.warn('⚠️ 无法获取MCP工具，使用默认工具列表')
            this.availableTools = []
          }
        } catch (error) {
          console.error('❌ 获取MCP工具失败:', error)
          this.availableTools = []
        }
      } else {
        console.warn('⚠️ 不在Electron环境中，无法获取MCP工具')
        this.availableTools = []
      }
      
      this.initialized = true
      console.log(`✅ MCP管理器初始化完成，可用工具: ${this.availableTools.map(t => t.name).join(', ')}`)
      
    } catch (error) {
      console.error('❌ MCP管理器初始化失败:', error)
      throw error
    }
  }

  /**
   * 启动DuckDuckGo MCP服务器
   */
  private async startDuckDuckGoServer(): Promise<void> {
    try {
      console.log('🔧 配置DuckDuckGo MCP服务器...')
      
      // 获取预设服务器配置
      const presetServers = mcpService.getPresetServers()
      const duckduckgoConfig = presetServers.find(s => s.id === this.DUCKDUCKGO_SERVER_ID)
      
      if (!duckduckgoConfig) {
        throw new Error('DuckDuckGo服务器配置未找到')
      }

      // 使用简化客户端
      const { simpleMCPClient } = await import('./SimpleMCPClient')
      
      // 添加服务器配置
      console.log('➕ 添加DuckDuckGo服务器配置...')
      const addResult = await simpleMCPClient.addServer(duckduckgoConfig)
      if (!addResult.success && !addResult.error?.includes('已存在')) {
        throw new Error(`添加服务器配置失败: ${addResult.error}`)
      }

      // 启动服务器
      console.log('🚀 启动DuckDuckGo服务器...')
      const startResult = await simpleMCPClient.startServer(this.DUCKDUCKGO_SERVER_ID)
      if (!startResult.success) {
        throw new Error(`启动服务器失败: ${startResult.error}`)
      }

      console.log('✅ DuckDuckGo服务器启动成功')
      
    } catch (error) {
      console.error('❌ 启动DuckDuckGo服务器失败:', error)
      throw error
    }
  }

  /**
   * 等待服务器准备就绪
   */
  private async waitForServerReady(): Promise<void> {
    console.log('⏳ 等待服务器准备就绪...')
    
    const maxAttempts = 10
    const delayMs = 1000
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { simpleMCPClient } = await import('./SimpleMCPClient')
        const serversResult = await simpleMCPClient.getServers()
        
        if (serversResult.success && serversResult.data) {
          const server = serversResult.data.find(s => s.id === this.DUCKDUCKGO_SERVER_ID)
          if (server && server.status === 'running') {
            console.log('✅ 服务器已准备就绪')
            return
          }
        }
        
        console.log(`⏳ 等待服务器启动... (${attempt}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        
      } catch (error) {
        console.warn(`⚠️ 检查服务器状态失败 (尝试 ${attempt}/${maxAttempts}):`, error)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    
    throw new Error('服务器启动超时')
  }

  /**
   * 发现可用工具
   */
  private async discoverTools(): Promise<void> {
    try {
      console.log('🔍 发现MCP工具...')
      
      // 直接从简化客户端获取工具
      const { simpleMCPClient } = await import('./SimpleMCPClient')
      const toolsResult = await simpleMCPClient.getTools()
      
      if (!toolsResult.success || !toolsResult.data) {
        throw new Error(`获取工具失败: ${toolsResult.error}`)
      }

      this.availableTools = toolsResult.data
      console.log(`✅ 发现 ${this.availableTools.length} 个工具:`, 
        this.availableTools.map(t => `${t.name} (${t.server})`))
      
    } catch (error) {
      console.error('❌ 工具发现失败:', error)
      throw error
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): MCPTool[] {
    return [...this.availableTools]
  }

  /**
   * 检测工具调用意图
   */
  detectToolCall(message: string): ToolCallRequest | null {
    console.log('🔍 检测工具调用意图:', message.substring(0, 100))
    
    // 1. 检测JSON格式的工具调用
    const jsonToolCall = this.detectJSONToolCall(message)
    if (jsonToolCall) {
      return jsonToolCall
    }

    // 2. 智能检测搜索意图
    const searchIntent = this.detectSearchIntent(message)
    if (searchIntent) {
      return searchIntent
    }

    // 3. 检测内容获取意图
    const fetchIntent = this.detectFetchIntent(message)
    if (fetchIntent) {
      return fetchIntent
    }

    console.log('ℹ️ 未检测到工具调用意图')
    return null
  }

  /**
   * 检测JSON格式的工具调用
   */
  private detectJSONToolCall(message: string): ToolCallRequest | null {
    // 检测代码块格式
    const codeBlockMatch = message.match(/```(?:tool|json)\s*\n([\s\S]*?)\n```/)
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1])
        if (parsed.tool && parsed.parameters) {
          console.log('✅ 检测到代码块工具调用:', parsed)
          return {
            tool: parsed.tool,
            parameters: parsed.parameters
          }
        }
      } catch (error) {
        console.error('❌ 代码块解析失败:', error)
      }
    }

    // 检测直接JSON格式
    const jsonMatch = message.match(/\{[\s\S]*?"tool"[\s\S]*?"parameters"[\s\S]*?\}/)
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[0]
        
        // 修复JSON格式错误 - 缺少逗号
        jsonStr = jsonStr.replace(/"tool":\s*"([^"]+)"\s+"parameters"/, '"tool": "$1", "parameters"')
        jsonStr = jsonStr.replace(/"([^"]+)":\s*"([^"]*)"([^,}])/g, '"$1": "$2",$3')
        
        // 如果JSON不完整，尝试修复
        if (!jsonStr.endsWith('}')) {
          const lastCommaIndex = jsonStr.lastIndexOf(',')
          const lastQuoteIndex = jsonStr.lastIndexOf('"')
          
          if (lastCommaIndex > lastQuoteIndex) {
            jsonStr = jsonStr.substring(0, lastCommaIndex) + '}'
          } else {
            jsonStr += '}'
          }
        }
        
        const parsed = JSON.parse(jsonStr)
        if (parsed.tool && parsed.parameters) {
          console.log('✅ 检测到JSON工具调用:', parsed)
          return {
            tool: parsed.tool,
            parameters: parsed.parameters
          }
        }
      } catch (error) {
        console.error('❌ JSON解析失败:', error)
        
        // 尝试从片段重构工具调用
        try {
          const toolMatch = message.match(/"tool":\s*"([^"]+)"/)
          const pathMatch = message.match(/"path":\s*"([^"]+)"/)
          const contentMatch = message.match(/"content":\s*"([^"]*)"/)
          
          if (toolMatch && pathMatch) {
            console.log('🔧 从片段重构工具调用')
            return {
              tool: toolMatch[1],
              parameters: {
                path: pathMatch[1],
                content: contentMatch ? contentMatch[1] : ''
              }
            }
          }
        } catch (reconstructError) {
          console.error('❌ 重构失败:', reconstructError)
        }
      }
    }

    return null
  }

  /**
   * 智能检测搜索意图
   */
  private detectSearchIntent(message: string): ToolCallRequest | null {
    const searchKeywords = [
      '搜索', '查询', '查找', '找', '搜', 
      'search', 'find', 'look up', 'google'
    ]
    
    const lowerMessage = message.toLowerCase()
    const hasSearchKeyword = searchKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    )
    
    if (hasSearchKeyword) {
      let query = message
      
      // 移除搜索关键词
      for (const keyword of searchKeywords) {
        const regex = new RegExp(`^${keyword}\\s*[:：]?\\s*`, 'i')
        query = query.replace(regex, '')
      }
      
      query = query.trim()
      
      if (query.length > 0) {
        console.log('✅ 智能检测到搜索意图:', query)
        return {
          tool: 'search',
          parameters: { 
            query, 
            max_results: 5 
          }
        }
      }
    }
    
    return null
  }

  /**
   * 检测内容获取意图
   */
  private detectFetchIntent(message: string): ToolCallRequest | null {
    const fetchKeywords = ['获取内容', '抓取', 'fetch', 'get content']
    const urlPattern = /https?:\/\/[^\s]+/
    
    const lowerMessage = message.toLowerCase()
    const hasFetchKeyword = fetchKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    )
    const urlMatch = message.match(urlPattern)
    
    if (hasFetchKeyword && urlMatch) {
      console.log('✅ 检测到内容获取意图:', urlMatch[0])
      return {
        tool: 'fetch_content',
        parameters: { 
          url: urlMatch[0] 
        }
      }
    }
    
    return null
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(request: ToolCallRequest): Promise<ToolCallResult> {
    try {
      console.log('🔧 执行工具调用:', request)
      
      // 验证工具是否存在
      const tool = this.availableTools.find(t => t.name === request.tool)
      if (!tool) {
        return {
          success: false,
          error: `工具 "${request.tool}" 未找到。可用工具: ${this.availableTools.map(t => t.name).join(', ')}`,
          toolName: request.tool
        }
      }

      // 确保服务器已启动
      await this.ensureServerRunning(tool.server)

      // 构建MCP工具调用
      const mcpCall: MCPToolCall = {
        tool: request.tool,
        parameters: request.parameters,
        server: tool.server || this.DUCKDUCKGO_SERVER_ID
      }

      // 执行工具调用
      console.log('📡 发送MCP工具调用:', mcpCall)
      
      // 直接通过electron API执行工具调用
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.mcpExecuteTool(mcpCall)
        
        if (result.success) {
          console.log('✅ 工具执行成功')
          return {
            success: true,
            result: result.data,
            toolName: request.tool
          }
        } else {
          console.error('❌ 工具执行失败:', result.error)
          return {
            success: false,
            error: result.error || '工具执行失败',
            toolName: request.tool
          }
        }
      } else {
        return {
          success: false,
          error: 'Electron API 不可用',
          toolName: request.tool
        }
      }
      
    } catch (error) {
      console.error('❌ 工具调用异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        toolName: request.tool
      }
    }
  }

  /**
   * 确保服务器正在运行
   */
  private async ensureServerRunning(serverId: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // 检查服务器状态
        const serversResult = await window.electronAPI.mcpGetServers()
        if (serversResult.success && serversResult.data) {
          const server = serversResult.data.find(s => s.id === serverId)
          if (server && server.status !== 'running') {
            console.log(`🚀 启动服务器: ${serverId}`)
            const startResult = await window.electronAPI.mcpStartServer(serverId)
            if (!startResult.success) {
              throw new Error(`启动服务器失败: ${startResult.error}`)
            }
            
            // 等待服务器启动
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        }
      }
    } catch (error) {
      console.error(`❌ 确保服务器运行失败 (${serverId}):`, error)
      throw error
    }
  }

  /**
   * 格式化工具结果
   */
  formatToolResult(result: ToolCallResult): string {
    if (!result.success) {
      return `❌ **工具执行失败** (${result.toolName})\n\n**错误:** ${result.error}`
    }

    switch (result.toolName) {
      case 'search':
        return this.formatSearchResult(result.result)
      case 'fetch_content':
        return this.formatFetchResult(result.result)
      default:
        return `✅ **工具执行成功** (${result.toolName})\n\n${JSON.stringify(result.result, null, 2)}`
    }
  }

  /**
   * 格式化搜索结果
   */
  private formatSearchResult(result: any): string {
    if (typeof result === 'string') {
      // DuckDuckGo MCP服务器返回格式化的字符串
      return `🔍 **搜索结果**\n\n${result}`
    }
    
    if (Array.isArray(result)) {
      let formatted = `🔍 **搜索结果**\n\n`
      
      result.forEach((item: any, index: number) => {
        formatted += `**${index + 1}. [${item.title || '无标题'}](${item.link || '#'})**\n`
        if (item.snippet) {
          formatted += `${item.snippet}\n`
        }
        formatted += `\n`
      })

      return formatted.trim()
    }

    return `🔍 **搜索结果**\n\n${JSON.stringify(result, null, 2)}`
  }

  /**
   * 格式化内容获取结果
   */
  private formatFetchResult(result: any): string {
    if (typeof result === 'string') {
      const preview = result.length > 500 ? result.substring(0, 500) + '...' : result
      return `📄 **网页内容**\n\n${preview}\n\n*内容长度: ${result.length} 字符*`
    }
    
    return `📄 **网页内容**\n\n${JSON.stringify(result, null, 2)}`
  }

  /**
   * 获取状态信息
   */
  async getStatus(): Promise<{
    initialized: boolean
    toolCount: number
    serverStatus: string
    availableTools: string[]
  }> {
    try {
      const { simpleMCPClient } = await import('./SimpleMCPClient')
      const serversResult = await simpleMCPClient.getServers()
      let serverStatus = '未知'
      
      if (serversResult.success && serversResult.data) {
        const runningServers = serversResult.data.filter(s => s.status === 'running')
        serverStatus = `${runningServers.length}/${serversResult.data.length} 个服务器运行中`
      } else {
        serverStatus = `状态检查失败: ${serversResult.error}`
      }

      return {
        initialized: this.initialized,
        toolCount: this.availableTools.length,
        serverStatus,
        availableTools: this.availableTools.map(t => `${t.name} (${t.server})`)
      }
    } catch (error) {
      return {
        initialized: this.initialized,
        toolCount: this.availableTools.length,
        serverStatus: `状态检查异常: ${error}`,
        availableTools: this.availableTools.map(t => `${t.name} (${t.server})`)
      }
    }
  }

  /**
   * 重启MCP服务
   */
  async restart(): Promise<void> {
    console.log('🔄 重启MCP服务...')
    
    try {
      // 停止服务器
      await mcpService.stopServer(this.DUCKDUCKGO_SERVER_ID)
      
      // 重置状态
      this.initialized = false
      this.availableTools = []
      
      // 重新初始化
      await this.initialize()
      
      console.log('✅ MCP服务重启完成')
    } catch (error) {
      console.error('❌ MCP服务重启失败:', error)
      throw error
    }
  }
}

// 创建单例实例
export const mcpManager = new MCPManager()