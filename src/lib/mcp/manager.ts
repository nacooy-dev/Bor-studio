/**
 * MCP管理器
 * 基于5ire项目的管理器实现，轻量化版本
 */

import { EventEmitter } from 'events'
import type {
  MCPServer,
  MCPServerConfig,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPManagerEvent,
  MCPManagerConfig
} from './types'
import { MCPProtocolClient } from './protocol'

/**
 * MCP管理器
 * 负责管理多个MCP服务器的生命周期和工具调用
 */
export class MCPManager extends EventEmitter {
  private servers = new Map<string, MCPServer>()
  private clients = new Map<string, MCPProtocolClient>()
  private tools = new Map<string, MCPTool>()
  private config: MCPManagerConfig

  constructor(config: MCPManagerConfig = {}) {
    super()
    this.config = {
      maxConcurrentServers: 5,
      toolExecutionTimeout: 30000,
      serverStartTimeout: 10000,
      enableLogging: true,
      logLevel: 'info',
      ...config
    }
  }

  /**
   * 添加MCP服务器配置
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server ${config.id} already exists`)
    }

    const server: MCPServer = {
      id: config.id,
      name: config.name,
      config,
      status: 'stopped'
    }

    this.servers.set(config.id, server)
    this.log('info', `Added server: ${config.name} (${config.id})`)

    if (config.autoStart) {
      await this.startServer(config.id)
    }
  }

  /**
   * 启动MCP服务器
   */
  async startServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    if (server.status === 'running') {
      return
    }

    if (this.getRunningServersCount() >= this.config.maxConcurrentServers!) {
      throw new Error('Maximum concurrent servers limit reached')
    }

    server.status = 'starting'
    server.startTime = new Date()
    this.emit('server_starting', server)

    try {
      const client = new MCPProtocolClient(server.config, this.config.toolExecutionTimeout)
      
      // 设置客户端事件监听
      client.on('error', (error) => {
        server.status = 'error'
        server.lastError = error.message
        this.emit('server_error', { type: 'server_error', server, error: error.message })
      })

      client.on('exit', () => {
        server.status = 'stopped'
        this.clients.delete(serverId)
        this.removeServerTools(serverId)
        this.emit('server_stopped', { type: 'server_stopped', server })
      })

      client.on('initialized', async () => {
        server.status = 'running'
        server.pid = client.pid
        this.clients.set(serverId, client)
        this.emit('server_started', { type: 'server_started', server })
        
        // 发现工具
        await this.discoverTools(serverId)
      })

      await client.start()
      
    } catch (error) {
      server.status = 'error'
      server.lastError = error instanceof Error ? error.message : 'Unknown error'
      this.emit('server_error', { type: 'server_error', server, error: server.lastError })
      throw error
    }
  }

  /**
   * 停止MCP服务器
   */
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    const client = this.clients.get(serverId)
    if (client) {
      await client.stop()
    }

    server.status = 'stopped'
    server.pid = undefined
    this.clients.delete(serverId)
    this.removeServerTools(serverId)
    
    this.emit('server_stopped', { type: 'server_stopped', server })
    this.log('info', `Stopped server: ${server.name} (${serverId})`)
  }

  /**
   * 移除MCP服务器
   */
  async removeServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) {
      return
    }

    if (server.status === 'running') {
      await this.stopServer(serverId)
    }

    this.servers.delete(serverId)
    this.log('info', `Removed server: ${server.name} (${serverId})`)
  }

  /**
   * 发现服务器工具
   */
  private async discoverTools(serverId: string): Promise<void> {
    const client = this.clients.get(serverId)
    if (!client) {
      return
    }

    try {
      const tools = await client.listTools()
      
      for (const toolData of tools) {
        const tool: MCPTool = {
          name: toolData.name,
          description: toolData.description || '',
          server: serverId,
          schema: toolData.inputSchema || { type: 'object', properties: {} },
          category: this.categorizeTools(toolData.name),
          riskLevel: this.assessRiskLevel(toolData.name)
        }

        const toolKey = `${serverId}:${tool.name}`
        this.tools.set(toolKey, tool)
        this.emit('tool_discovered', { type: 'tool_discovered', tool })
      }

      this.log('info', `Discovered ${tools.length} tools from server ${serverId}`)
    } catch (error) {
      this.log('error', `Failed to discover tools from server ${serverId}: ${error}`)
    }
  }

  /**
   * 执行工具调用
   */
  async executeTool(call: MCPToolCall): Promise<MCPToolResult> {
    const startTime = Date.now()
    const client = this.clients.get(call.server)
    
    if (!client) {
      return {
        success: false,
        error: `Server ${call.server} not running`,
        executionTime: Date.now() - startTime,
        requestId: call.requestId
      }
    }

    try {
      const result = await client.callTool(call.tool, call.parameters)
      const executionTime = Date.now() - startTime
      
      const toolResult: MCPToolResult = {
        success: true,
        data: result,
        executionTime,
        requestId: call.requestId
      }

      this.emit('tool_executed', { type: 'tool_executed', call, result: toolResult })
      this.log('info', `Executed tool ${call.tool} in ${executionTime}ms`)
      
      return toolResult
    } catch (error) {
      const executionTime = Date.now() - startTime
      const toolResult: MCPToolResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        requestId: call.requestId
      }

      this.emit('tool_executed', { type: 'tool_executed', call, result: toolResult })
      this.log('error', `Tool execution failed: ${toolResult.error}`)
      
      return toolResult
    }
  }

  /**
   * 获取所有服务器
   */
  getServers(): MCPServer[] {
    return Array.from(this.servers.values())
  }

  /**
   * 获取运行中的服务器
   */
  getRunningServers(): MCPServer[] {
    return this.getServers().filter(server => server.status === 'running')
  }

  /**
   * 获取运行中的服务器数量
   */
  private getRunningServersCount(): number {
    return this.getRunningServers().length
  }

  /**
   * 获取所有工具
   */
  getTools(serverId?: string): MCPTool[] {
    const tools = Array.from(this.tools.values())
    return serverId ? tools.filter(tool => tool.server === serverId) : tools
  }

  /**
   * 根据名称查找工具
   */
  findTool(name: string, serverId?: string): MCPTool | undefined {
    if (serverId) {
      return this.tools.get(`${serverId}:${name}`)
    }
    
    // 在所有服务器中查找
    for (const tool of this.tools.values()) {
      if (tool.name === name) {
        return tool
      }
    }
    
    return undefined
  }

  /**
   * 移除服务器的所有工具
   */
  private removeServerTools(serverId: string): void {
    const keysToRemove = []
    for (const [key, tool] of this.tools) {
      if (tool.server === serverId) {
        keysToRemove.push(key)
      }
    }
    
    for (const key of keysToRemove) {
      this.tools.delete(key)
    }
  }

  /**
   * 工具分类
   */
  private categorizeTools(toolName: string): string {
    const name = toolName.toLowerCase()
    if (name.includes('file') || name.includes('read') || name.includes('write')) {
      return 'filesystem'
    }
    if (name.includes('search') || name.includes('web') || name.includes('http')) {
      return 'web'
    }
    if (name.includes('db') || name.includes('sql') || name.includes('database')) {
      return 'database'
    }
    return 'general'
  }

  /**
   * 评估工具风险等级
   */
  private assessRiskLevel(toolName: string): 'low' | 'medium' | 'high' {
    const name = toolName.toLowerCase()
    if (name.includes('delete') || name.includes('remove') || name.includes('exec')) {
      return 'high'
    }
    if (name.includes('write') || name.includes('create') || name.includes('modify')) {
      return 'medium'
    }
    return 'low'
  }

  /**
   * 日志记录
   */
  private log(level: string, message: string): void {
    if (!this.config.enableLogging) {
      return
    }

    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.logLevel!)
    const messageLevelIndex = levels.indexOf(level)

    if (messageLevelIndex >= currentLevelIndex) {
      console.log(`[MCP-${level.toUpperCase()}] ${message}`)
    }
  }

  /**
   * 关闭管理器
   */
  async close(): Promise<void> {
    const stopPromises = []
    for (const serverId of this.servers.keys()) {
      stopPromises.push(this.stopServer(serverId))
    }
    
    await Promise.all(stopPromises)
    this.servers.clear()
    this.clients.clear()
    this.tools.clear()
    
    this.log('info', 'MCP Manager closed')
  }
}