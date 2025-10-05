/**
 * MCP Host 主进程实现
 * 在Electron主进程中运行，管理MCP服务器
 */

import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import type { 
  MCPServerConfig, 
  MCPTool, 
  MCPToolCall, 
  MCPMessage, 
  MCPCapabilities,
  MCPServerInstance 
} from './types'

export interface MCPHostConfig {
  maxServers: number
  serverTimeout: number
  toolTimeout: number
  enableLogging: boolean
}

/**
 * MCP主机 - 在主进程中管理多个MCP服务器实例
 */
export class MCPHostMain extends EventEmitter {
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
      console.log(`🚀 启动MCP服务器: ${serverId}`)
      console.log(`命令: ${server.config.command} ${server.config.args.join(' ')}`)

      // 启动子进程
      const childProcess = spawn(server.config.command, server.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...server.config.env },
        cwd: server.config.cwd || process.cwd()
      })

      server.process = childProcess
      server.pid = childProcess.pid

      // 设置进程事件监听
      this.setupProcessListeners(server)

      // 等待进程启动
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server startup timeout'))
        }, 5000)

        childProcess.on('spawn', () => {
          clearTimeout(timeout)
          console.log(`✅ 进程已启动: ${serverId} (PID: ${childProcess.pid})`)
          resolve()
        })

        childProcess.on('error', (error) => {
          clearTimeout(timeout)
          console.error(`❌ 进程启动失败: ${serverId}`, error)
          reject(error)
        })
      })

      // 等待一小段时间让进程完全启动
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 初始化MCP协议
      try {
        await this.initializeServer(server)
        server.status = 'running'
        this.emit('server_started', server)
        console.log(`🎉 MCP服务器启动成功: ${serverId}`)
      } catch (initError) {
        console.error(`❌ MCP协议初始化失败: ${serverId}`, initError)
        // 如果初始化失败，停止进程
        childProcess.kill()
        throw initError
      }

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

    const childProcess = server.process as ChildProcess

    childProcess.on('error', (error) => {
      console.error(`❌ MCP服务器进程错误 ${server.id}:`, error)
      server.status = 'error'
      server.lastError = error.message
      this.emit('server_error', server, error)
    })

    childProcess.on('exit', (code, signal) => {
      console.log(`⏹️ MCP服务器进程退出 ${server.id}: code=${code}, signal=${signal}`)
      server.status = 'stopped'
      server.process = null
      server.pid = undefined
      this.emit('server_stopped', server)
    })

    // 处理stdout消息
    childProcess.stdout?.on('data', (data) => {
      this.handleServerMessage(server, data.toString())
    })

    // 处理stderr错误
    childProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString().trim()
      if (this.config.enableLogging) {
        console.error(`[${server.id}] stderr:`, errorMsg)
      }
      
      // 如果是启动阶段的错误，更新服务器状态
      if (server.status === 'starting' || server.status === 'running') {
        server.lastError = errorMsg
        
        // 如果是严重错误，标记服务器为错误状态
        if (errorMsg.includes('Error') || errorMsg.includes('error') || 
            errorMsg.includes('ENOENT') || errorMsg.includes('command not found')) {
          server.status = 'error'
          this.emit('server_error', server, new Error(errorMsg))
        }
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

    try {
      console.log(`🔄 初始化MCP协议: ${server.id}`)

      // 临时设置状态为running以允许发送消息
      const originalStatus = server.status
      server.status = 'running'

      try {
        // 发送初始化消息，增加超时时间
        console.log(`📤 发送初始化消息到: ${server.id}`)
        const response = await Promise.race([
          this.sendMessage(server.id, {
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
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Initialize timeout after 10 seconds')), 10000)
          )
        ])

        server.capabilities = response.capabilities || {}
        console.log(`✅ MCP协议初始化完成: ${server.id}`, response)

        // 发送初始化完成通知
        console.log(`📤 发送初始化完成通知到: ${server.id}`)
        await this.sendNotification(server.id, {
          method: 'notifications/initialized'
        })

        // 等待一小段时间让服务器处理通知
        await new Promise(resolve => setTimeout(resolve, 500))

        // 发现工具
        await this.discoverTools(server.id)

      } catch (error) {
        // 恢复原始状态
        server.status = originalStatus
        console.error(`❌ 初始化失败，恢复状态到: ${originalStatus}`)
        throw error
      }

    } catch (error) {
      console.error(`❌ MCP协议初始化失败 ${server.id}:`, error)
      server.lastError = error instanceof Error ? error.message : 'Initialization failed'
      throw error
    }
  }

  /**
   * 发现服务器工具
   */
  private async discoverTools(serverId: string): Promise<void> {
    try {
      console.log(`🔍 发现工具: ${serverId}`)
      
      const response = await Promise.race([
        this.sendMessage(serverId, {
          method: 'tools/list'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tools discovery timeout after 5 seconds')), 5000)
        )
      ])

      const server = this.servers.get(serverId)
      if (server && response && response.tools) {
        server.tools = response.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          schema: tool.inputSchema,
          server: serverId
        }))
        
        console.log(`✅ 发现 ${server.tools.length} 个工具:`, server.tools.map(t => t.name))
        this.emit('tools_discovered', server, server.tools)
      } else {
        console.log(`ℹ️ 服务器 ${serverId} 没有返回工具列表`)
        if (server) {
          server.tools = []
        }
      }
    } catch (error) {
      console.error(`❌ 工具发现失败 ${serverId}:`, error)
      // 工具发现失败不应该导致整个服务器启动失败
      const server = this.servers.get(serverId)
      if (server) {
        server.tools = []
      }
    }
  }

  /**
   * 发送消息到服务器
   */
  private async sendMessage(serverId: string, message: Omit<MCPMessage, 'jsonrpc' | 'id'>): Promise<any> {
    const server = this.servers.get(serverId)
    if (!server || !server.process) {
      throw new Error(`Server ${serverId} is not available`)
    }
    
    // 允许在starting状态下发送初始化消息
    if (server.status !== 'running' && server.status !== 'starting') {
      throw new Error(`Server ${serverId} is not running (status: ${server.status})`)
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
      console.log(`[${serverId}] 发送消息:`, fullMessage)
      
      const childProcess = server.process as ChildProcess
      if (childProcess.stdin?.writable) {
        childProcess.stdin.write(messageStr)
      } else {
        throw new Error(`Server ${serverId} stdin is not writable`)
      }
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
    const childProcess = server.process as ChildProcess
    childProcess.stdin?.write(messageStr)
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(server: MCPServerInstance, data: string): void {
    // 累积数据，因为可能收到部分消息
    if (!server.messageBuffer) {
      server.messageBuffer = ''
    }
    server.messageBuffer += data

    // 按行分割消息
    const lines = server.messageBuffer.split('\n')
    // 保留最后一行（可能是不完整的）
    server.messageBuffer = lines.pop() || ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // 跳过非JSON消息（如启动信息）
      if (!trimmedLine.startsWith('{')) {
        console.log(`[${server.id}] 服务器消息:`, trimmedLine)
        continue
      }

      try {
        const message = JSON.parse(trimmedLine)
        console.log(`[${server.id}] 收到JSON消息:`, message)
        
        if (message.id && this.pendingRequests.has(message.id)) {
          const request = this.pendingRequests.get(message.id)!
          this.pendingRequests.delete(message.id)
          clearTimeout(request.timeout)

          if (message.error) {
            console.error(`[${server.id}] 服务器返回错误:`, message.error)
            request.reject(new Error(message.error.message || 'Server error'))
          } else {
            console.log(`[${server.id}] 服务器返回结果:`, message.result)
            request.resolve(message.result)
          }
        } else {
          // 处理通知或其他消息
          console.log(`[${server.id}] 收到通知消息:`, message)
          this.emit('server_message', server, message)
        }
      } catch (error) {
        console.error(`[${server.id}] 解析消息失败:`, error, '原始数据:', trimmedLine)
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