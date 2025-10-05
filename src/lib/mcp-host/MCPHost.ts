/**
 * MCP Host 实现
 * 参考5ire项目，实现完整的MCP主机功能
 */

import { EventEmitter } from 'events'
// 注意：在Electron渲染进程中不能直接使用child_process
// 需要通过IPC与主进程通信
import type { 
  MCPServerConfig, 
  MCPTool, 
  MCPToolCall, 
  MCPMessage, 
  MCPCapabilities,
  MCPServerInstance 
} from './types'

// MCPServerInstance 现在从 types.ts 导入

export interface MCPHostConfig {
  maxServers: number
  serverTimeout: number
  toolTimeout: number
  enableLogging: boolean
}

/**
 * MCP主机 - 管理多个MCP服务器实例
 */
export class MCPHost extends EventEmitter {
  private servers = new Map<string, MCPServerInstance>()
  private messageId = 0
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
    serverId: string
  }>()
  private config: MCPHostConfig

  constructor(config: Partial<MCPHostConfig> = {}) {
    super()
    this.config = {
      maxServers: 10,
      serverTimeout: 30000,
      toolTimeout: 60000,
      enableLogging: true,
      ...config
    }
  }

  /**
   * 添加MCP服务器
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server ${config.id} already exists`)
    }

    const server: MCPServerInstance = {
      id: config.id,
      config,
      process: null,
      status: 'stopped',
      capabilities: {},
      tools: []
    }

    this.servers.set(config.id, server)
    this.emit('server_added', server)

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

    if (this.getRunningServersCount() >= this.config.maxServers) {
      throw new Error('Maximum number of servers reached')
    }

    server.status = 'starting'
    server.startTime = new Date()
    this.emit('server_starting', server)

    try {
      // 启动子进程
      const process = spawn(server.config.command, server.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...server.config.env },
        cwd: server.config.cwd || process.cwd()
      })

      server.process = process
      server.pid = process.pid

      // 设置进程事件监听
      this.setupProcessListeners(server)

      // 初始化MCP协议
      await this.initializeServer(server)

      server.status = 'running'
      this.emit('server_started', server)

    } catch (error) {
      server.status = 'error'
      server.lastError = error instanceof Error ? error.message : 'Unknown error'
      this.emit('server_error', server, error)
      throw error
    }
  }

  /**
   * 停止MCP服务器
   */
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server || !server.process) {
      return
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        server.status = 'stopped'
        server.process = null
        server.pid = undefined
        server.tools = []
        this.emit('server_stopped', server)
        resolve()
      }

      if (server.process) {
        server.process.once('exit', cleanup)
        server.process.kill('SIGTERM')

        // 强制终止超时
        setTimeout(() => {
          if (server.process && !server.process.killed) {
            server.process.kill('SIGKILL')
          }
          cleanup()
        }, 5000)
      } else {
        cleanup()
      }
    })
  }

  /**
   * 删除MCP服务器
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
    this.emit('server_removed', server)
  }

  /**
   * 设置进程事件监听
   */
  private setupProcessListeners(server: MCPServerInstance): void {
    if (!server.process) return

    server.process.on('error', (error) => {
      server.status = 'error'
      server.lastError = error.message
      this.emit('server_error', server, error)
    })

    server.process.on('exit', (code, signal) => {
      server.status = 'stopped'
      server.process = null
      server.pid = undefined
      this.emit('server_stopped', server)
    })

    // 处理stdout消息
    server.process.stdout?.on('data', (data) => {
      this.handleServerMessage(server, data.toString())
    })

    // 处理stderr错误
    server.process.stderr?.on('data', (data) => {
      if (this.config.enableLogging) {
        console.error(`[${server.id}] stderr:`, data.toString())
      }
    })
  }

  /**
   * 初始化服务器MCP协议
   */
  private async initializeServer(server: MCPServerInstance): Promise<void> {
    if (!server.process) {
      throw new Error('Server process not started')
    }

    // 发送初始化消息
    const response = await this.sendMessage(server.id, {
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        clientInfo: {
          name: 'Bor-Studio-MCP-Host',
          version: '1.0.0'
        }
      }
    })

    server.capabilities = response.capabilities || {}

    // 发送初始化完成通知
    await this.sendNotification(server.id, {
      method: 'notifications/initialized'
    })

    // 发现工具
    await this.discoverTools(server.id)
  }

  /**
   * 发现服务器工具
   */
  private async discoverTools(serverId: string): Promise<void> {
    try {
      const response = await this.sendMessage(serverId, {
        method: 'tools/list'
      })

      const server = this.servers.get(serverId)
      if (server && response.tools) {
        server.tools = response.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          schema: tool.inputSchema,
          server: serverId
        }))
        this.emit('tools_discovered', server, server.tools)
      }
    } catch (error) {
      console.error(`Failed to discover tools for server ${serverId}:`, error)
    }
  }

  /**
   * 发送消息到服务器
   */
  private async sendMessage(serverId: string, message: Omit<MCPMessage, 'jsonrpc' | 'id'>): Promise<any> {
    const server = this.servers.get(serverId)
    if (!server || !server.process || server.status !== 'running') {
      throw new Error(`Server ${serverId} is not running`)
    }

    const id = ++this.messageId
    const fullMessage: MCPMessage = {
      jsonrpc: '2.0',
      id,
      ...message
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${message.method}`))
      }, this.config.serverTimeout)

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
        serverId
      })

      const messageStr = JSON.stringify(fullMessage) + '\n'
      server.process!.stdin?.write(messageStr)
    })
  }

  /**
   * 发送通知到服务器
   */
  private async sendNotification(serverId: string, notification: Omit<MCPMessage, 'jsonrpc'>): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server || !server.process || server.status !== 'running') {
      throw new Error(`Server ${serverId} is not running`)
    }

    const fullMessage = {
      jsonrpc: '2.0',
      ...notification
    }

    const messageStr = JSON.stringify(fullMessage) + '\n'
    server.process.stdin?.write(messageStr)
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(server: MCPServerInstance, data: string): void {
    const lines = data.split('\n').filter(line => line.trim())

    for (const line of lines) {
      try {
        const message = JSON.parse(line)
        
        if (message.id && this.pendingRequests.has(message.id)) {
          const request = this.pendingRequests.get(message.id)!
          this.pendingRequests.delete(message.id)
          clearTimeout(request.timeout)

          if (message.error) {
            request.reject(new Error(message.error.message || 'Server error'))
          } else {
            request.resolve(message.result)
          }
        } else {
          // 处理通知或其他消息
          this.emit('server_message', server, message)
        }
      } catch (error) {
        console.error(`Failed to parse message from ${server.id}:`, error)
      }
    }
  }

  /**
   * 执行工具调用
   */
  async executeTool(call: MCPToolCall): Promise<any> {
    const server = this.servers.get(call.server)
    if (!server) {
      throw new Error(`Server ${call.server} not found`)
    }

    if (server.status !== 'running') {
      throw new Error(`Server ${call.server} is not running`)
    }

    // 验证工具是否存在
    const tool = server.tools.find(t => t.name === call.tool)
    if (!tool) {
      throw new Error(`Tool ${call.tool} not found on server ${call.server}`)
    }

    try {
      const response = await this.sendMessage(call.server, {
        method: 'tools/call',
        params: {
          name: call.tool,
          arguments: call.parameters
        }
      })

      return response.content || response
    } catch (error) {
      throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 获取所有服务器
   */
  getServers(): MCPServerInstance[] {
    return Array.from(this.servers.values())
  }

  /**
   * 获取运行中的服务器数量
   */
  private getRunningServersCount(): number {
    return Array.from(this.servers.values()).filter(s => s.status === 'running').length
  }

  /**
   * 获取所有工具
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = []
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        tools.push(...server.tools)
      }
    }
    return tools
  }

  /**
   * 查找工具
   */
  findTool(name: string, serverId?: string): MCPTool | null {
    if (serverId) {
      const server = this.servers.get(serverId)
      return server?.tools.find(t => t.name === name) || null
    }

    for (const server of this.servers.values()) {
      const tool = server.tools.find(t => t.name === name)
      if (tool) return tool
    }

    return null
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(serverId: string): MCPServerInstance | null {
    return this.servers.get(serverId) || null
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(id => this.stopServer(id))
    await Promise.all(stopPromises)
    this.servers.clear()
    this.pendingRequests.clear()
  }
}

// 创建全局MCP主机实例
export const mcpHost = new MCPHost({
  maxServers: 10,
  serverTimeout: 30000,
  toolTimeout: 60000,
  enableLogging: true
})