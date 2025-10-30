/**
 * 简化的MCP客户端
 * 实现基本的MCP协议通信功能
 */

import { MCPServerConfig, MCPTool, MCPToolCall } from '@/types'

export interface MCPMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: any
  result?: any
  error?: any
}

export interface MCPServerConnection {
  id: string
  config: MCPServerConfig
  process: any
  tools: MCPTool[]
  status: 'stopped' | 'starting' | 'running' | 'error'
  messageId: number
}

export class SimpleMCPClient {
  private servers: Map<string, MCPServerConnection> = new Map()
  private globalMessageId = 1

  /**
   * 添加服务器
   */
  async addServer(config: MCPServerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.servers.has(config.id)) {
        return { success: false, error: '服务器已存在' }
      }

      const connection: MCPServerConnection = {
        id: config.id,
        config,
        process: null,
        tools: [],
        status: 'stopped',
        messageId: 1
      }

      this.servers.set(config.id, connection)
      console.log(`✅ 添加MCP服务器: ${config.name} (${config.id})`)
      
      return { success: true }
    } catch (error) {
      console.error('添加服务器失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 启动服务器并初始化MCP连接
   */
  async startServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = this.servers.get(serverId)
      if (!connection) {
        return { success: false, error: '服务器不存在' }
      }

      if (connection.status === 'running') {
        return { success: true }
      }

      console.log(`🚀 启动MCP服务器: ${connection.config.name} (${serverId})`)
      connection.status = 'starting'

      // 通过IPC调用electron端启动服务器
      const startResult = await window.electronAPI.mcpStartServer(serverId)
      if (!startResult.success) {
        connection.status = 'error'
        return startResult
      }

      // 等待服务器启动
      await new Promise(resolve => setTimeout(resolve, 3000))

      // 获取工具列表
      await this.discoverTools(serverId)

      connection.status = 'running'
      console.log(`✅ MCP服务器启动完成: ${serverId}`)
      
      return { success: true }
    } catch (error) {
      console.error('启动服务器失败:', error)
      const connection = this.servers.get(serverId)
      if (connection) {
        connection.status = 'error'
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 发现服务器工具
   */
  private async discoverTools(serverId: string): Promise<void> {
    try {
      console.log(`🔍 发现服务器工具: ${serverId}`)
      
      const connection = this.servers.get(serverId)
      if (!connection) {
        throw new Error('服务器连接不存在')
      }

      // 根据已知的DuckDuckGo服务器，手动添加工具定义
      if (serverId === 'duckduckgo-search') {
        connection.tools = [
          {
            name: 'search',
            description: 'Search DuckDuckGo and return formatted results',
            server: serverId,
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'The search query' },
                max_results: { type: 'number', description: 'Maximum number of results', default: 5 }
              },
              required: ['query']
            }
          },
          {
            name: 'fetch_content',
            description: 'Fetch and parse content from a webpage URL',
            server: serverId,
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'The webpage URL to fetch' }
              },
              required: ['url']
            }
          }
        ]
        
        console.log(`✅ 发现 ${connection.tools.length} 个工具:`, connection.tools.map(t => t.name))
      }
    } catch (error) {
      console.error('发现工具失败:', error)
    }
  }

  /**
   * 停止服务器
   */
  async stopServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = this.servers.get(serverId)
      if (!connection) {
        return { success: false, error: '服务器不存在' }
      }

      console.log(`🛑 停止MCP服务器: ${connection.config.name} (${serverId})`)
      
      // 通过IPC调用electron端停止服务器
      const stopResult = await window.electronAPI.mcpStopServer(serverId)
      
      connection.status = 'stopped'
      connection.tools = []
      
      return stopResult
    } catch (error) {
      console.error('停止服务器失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 获取服务器列表
   */
  async getServers(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const serverList = Array.from(this.servers.values()).map(connection => ({
        id: connection.id,
        name: connection.config.name,
        status: connection.status,
        description: connection.config.description,
        toolCount: connection.tools.length
      }))

      return { success: true, data: serverList }
    } catch (error) {
      console.error('获取服务器列表失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 获取工具列表
   */
  async getTools(serverId?: string): Promise<{ success: boolean; data?: MCPTool[]; error?: string }> {
    try {
      let tools: MCPTool[] = []

      if (serverId) {
        const connection = this.servers.get(serverId)
        if (connection) {
          tools = connection.tools
        }
      } else {
        // 获取所有服务器的工具
        for (const connection of this.servers.values()) {
          tools.push(...connection.tools)
        }
      }

      console.log(`📋 获取工具列表: ${tools.length} 个工具`)
      return { success: true, data: tools }
    } catch (error) {
      console.error('获取工具列表失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 执行工具调用
   */
  async executeTool(call: MCPToolCall): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔧 执行工具调用:', call)
      
      // 通过IPC调用electron端执行工具
      const result = await window.electronAPI.mcpExecuteTool(call)
      
      console.log('📨 工具执行结果:', result)
      return result
    } catch (error) {
      console.error('执行工具调用失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 查找工具
   */
  async findTool(name: string, serverId?: string): Promise<{ success: boolean; data?: MCPTool; error?: string }> {
    try {
      const toolsResult = await this.getTools(serverId)
      if (!toolsResult.success || !toolsResult.data) {
        return { success: false, error: toolsResult.error }
      }

      const tool = toolsResult.data.find(t => t.name === name)
      return { success: true, data: tool || null }
    } catch (error) {
      console.error('查找工具失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 移除服务器
   */
  async removeServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = this.servers.get(serverId)
      if (!connection) {
        return { success: false, error: '服务器不存在' }
      }

      // 先停止服务器
      if (connection.status === 'running') {
        await this.stopServer(serverId)
      }

      // 移除服务器
      this.servers.delete(serverId)
      console.log(`🗑️ 移除MCP服务器: ${connection.config.name} (${serverId})`)
      
      return { success: true }
    } catch (error) {
      console.error('移除服务器失败:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 清理MCP客户端资源...')
    
    for (const connection of this.servers.values()) {
      if (connection.status === 'running') {
        try {
          await this.stopServer(connection.id)
        } catch (error) {
          console.error(`清理服务器 ${connection.id} 失败:`, error)
        }
      }
    }
    
    this.servers.clear()
    console.log('✅ MCP客户端资源清理完成')
  }
}

// 创建单例实例
export const simpleMCPClient = new SimpleMCPClient()