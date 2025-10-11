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
   * 启动 MCP 服务器
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
      console.log(`🚀 启动 MCP 服务器: ${serverId}`)
      console.log(`🔧 服务器配置:`, {
        command: server.config.command,
        args: server.config.args,
        cwd: server.config.cwd || process.cwd()
      })
      
      // 确保环境变量包含系统路径，解决打包应用中找不到 uvx 的问题
      const serverEnv: Record<string, string> = {}
      
      // 复制所有环境变量，过滤掉 undefined 值
      for (const [key, value] of Object.entries({ ...process.env, ...server.config.env })) {
        if (value !== undefined) {
          serverEnv[key] = value
        }
      }
      
      // 在 macOS 打包应用中，扩展 PATH 环境变量以包含系统工具路径
      // 只在打包应用中执行此操作，避免影响开发环境
      if (process.platform === 'darwin' && !process.env.VITE_DEV_SERVER_URL) {
        const additionalPaths = [
          '/usr/local/bin',
          '/opt/homebrew/bin',
          '/opt/homebrew/sbin',
          '/usr/bin',
          '/bin',
          '/usr/sbin',
          '/sbin',
          '/Applications/Xcode.app/Contents/Developer/usr/bin',
          '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin'
        ]
        
        // 扩展 PATH 环境变量
        if (serverEnv.PATH) {
          // 避免重复添加路径
          const currentPaths = serverEnv.PATH.split(':')
          const newPaths = additionalPaths.filter(p => !currentPaths.includes(p))
          serverEnv.PATH = [...newPaths, ...currentPaths].join(':')
        } else {
          serverEnv.PATH = additionalPaths.join(':')
        }
        
        // 确保关键环境变量存在
        if (!serverEnv.HOME) {
          serverEnv.HOME = process.env.HOME || '/Users/' + (process.env.USER || 'unknown')
        }
        
        if (!serverEnv.TMPDIR) {
          serverEnv.TMPDIR = '/tmp'
        }
        
        if (!serverEnv.USER) {
          serverEnv.USER = process.env.USER || 'unknown'
        }
        
        if (!serverEnv.SHELL) {
          serverEnv.SHELL = '/bin/zsh'
        }
        
        // 添加更多可能需要的环境变量
        if (!serverEnv.LOGNAME) {
          serverEnv.LOGNAME = serverEnv.USER
        }
        
        if (!serverEnv.LANG) {
          serverEnv.LANG = 'en_US.UTF-8'
        }
        
        if (!serverEnv.TERM) {
          serverEnv.TERM = 'xterm-256color'
        }
        
        console.log('🔧 为 MCP 服务器设置 PATH 环境变量:', serverEnv.PATH)
        console.log('🔧 为 MCP 服务器设置 HOME 环境变量:', serverEnv.HOME)
        console.log('🔧 为 MCP 服务器设置 TMPDIR 环境变量:', serverEnv.TMPDIR)
        console.log('🔧 为 MCP 服务器设置 USER 环境变量:', serverEnv.USER)
        console.log('🔧 为 MCP 服务器设置 SHELL 环境变量:', serverEnv.SHELL)
        console.log('🔧 为 MCP 服务器设置 LOGNAME 环境变量:', serverEnv.LOGNAME)
        console.log('🔧 为 MCP 服务器设置 LANG 环境变量:', serverEnv.LANG)
        console.log('🔧 为 MCP 服务器设置 TERM 环境变量:', serverEnv.TERM)
      }

      // 创建子进程，使用优化的启动参数
      const childProcess = spawn(server.config.command, server.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: serverEnv,
        cwd: server.config.cwd || process.cwd()
      })

      server.process = childProcess
      server.pid = childProcess.pid

      // 设置超时控制
      const timeout = setTimeout(() => {
        if (childProcess.pid) {
          childProcess.kill()
        }
        console.error(`❌ 进程启动超时: ${serverId}`)
      }, this.config.serverTimeout / 2) // 减少启动超时时间

      childProcess.on('spawn', () => {
        clearTimeout(timeout)
        console.log(`✅ 进程已启动: ${serverId} (PID: ${childProcess.pid})`)
      })

      childProcess.on('error', (error) => {
        clearTimeout(timeout)
        console.error(`❌ 进程启动失败: ${serverId}`, error)
        server.status = 'error'
        server.lastError = error.message
        this.emit('server_error', server, error)
      })

      // 处理stdout消息
      childProcess.stdout?.on('data', (data) => {
        this.handleServerMessage(server, data.toString())
      })

      // 处理stderr错误
      childProcess.stderr?.on('data', (data) => {
        console.error(`[${serverId}] stderr:`, data.toString())
        this.emit('server_stderr', server, data.toString())
      })

      childProcess.on('exit', (code, signal) => {
        console.log(`[${serverId}] 进程退出 (code: ${code}, signal: ${signal})`)
        server.status = 'stopped'
        server.process = null
        server.pid = undefined
        this.emit('server_stopped', server)
      })

      // 等待一小段时间让进程完全启动（减少等待时间）
      await new Promise(resolve => setTimeout(resolve, 500))

      // 初始化MCP协议
      try {
        console.log(`🔄 初始化MCP协议: ${serverId}`)

        // 临时设置状态为running以允许发送消息
        const originalStatus = server.status
        server.status = 'running'

        try {
          // 发送初始化消息，使用更短的超时时间
          console.log(`📤 发送初始化消息到: ${serverId}`)
          const response = await Promise.race([
            this.sendMessage(serverId, {
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
              setTimeout(() => reject(new Error('Initialize timeout after 5 seconds')), 5000)
            )
          ])

          server.capabilities = response.capabilities || {}
          console.log(`✅ MCP协议初始化完成: ${serverId}`, response)

          // 发送初始化完成通知
          console.log(`📤 发送初始化完成通知到: ${serverId}`)
          await this.sendNotification(serverId, {
            method: 'notifications/initialized'
          })

          // 等待一小段时间让服务器处理通知（减少等待时间）
          await new Promise(resolve => setTimeout(resolve, 200))

          // 发现工具
          await this.discoverTools(serverId)

        } catch (error) {
          // 恢复原始状态
          server.status = originalStatus
          console.error(`❌ 初始化失败，恢复状态到: ${originalStatus}`)
          throw error
        }

      } catch (error) {
        console.error(`❌ MCP协议初始化失败 ${serverId}:`, error)
        server.lastError = error instanceof Error ? error.message : 'Initialization failed'
        server.status = 'error'
        this.emit('server_error', server, error)
        throw error
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
   * 发现服务器工具（带缓存优化）
   */
  private async discoverTools(serverId: string): Promise<void> {
    try {
      console.log(`🔍 发现工具: ${serverId}`)
      
      // 检查是否有缓存的工具列表
      const server = this.servers.get(serverId)
      if (server && server.tools.length > 0) {
        console.log(`📦 使用缓存的工具列表: ${serverId}`)
        this.emit('tools_discovered', server, server.tools)
        return
      }
      
      const response = await Promise.race([
        this.sendMessage(serverId, {
          method: 'tools/list'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tools discovery timeout after 3 seconds')), 3000)
        )
      ])

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
   * 执行工具调用（带性能优化）
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
      // 增加超时时间并添加重试机制
      let lastError: Error | null = null;
      
      // 尝试最多3次
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📡 尝试执行工具调用 (第${attempt}次尝试):`, call);
          
          const response = await Promise.race([
            this.sendMessage(call.server, {
              method: 'tools/call',
              params: {
                name: call.tool,
                arguments: call.parameters
              }
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool execution timeout after 25 seconds (attempt ${attempt})`)), 25000)
            )
          ])

          console.log(`✅ 工具调用成功 (第${attempt}次尝试):`, response);
          return response.content || response
        } catch (error) {
          lastError = error as Error;
          console.warn(`⚠️ 工具调用失败 (第${attempt}次尝试):`, error);
          
          // 如果不是最后一次尝试，等待一段时间再重试
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        }
      }
      
      // 所有尝试都失败了
      throw new Error(`Tool execution failed after 3 attempts: ${lastError?.message || 'Unknown error'}`)
    } catch (error) {
      const errorMessage = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error('❌ 工具执行最终失败:', errorMessage)
      throw new Error(errorMessage)
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
    const servers = Array.from(this.servers.values())
    for (const server of servers) {
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
      return server?.tools.find((t: MCPTool) => t.name === name) || null
    }

    const servers = Array.from(this.servers.values())
    for (const server of servers) {
      const tool = server.tools.find((t: MCPTool) => t.name === name)
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