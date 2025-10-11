/**
 * MCP stdio协议处理
 * 基于5ire项目的协议实现，轻量化版本
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import type { MCPMessage, MCPServerConfig, MCPCapabilities } from './types'

/**
 * MCP stdio协议客户端
 * 负责与MCP服务器的stdio通信
 */
export class MCPProtocolClient extends EventEmitter {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()
  private buffer = ''
  private isInitialized = false
  private capabilities: MCPCapabilities = {}

  constructor(
    private config: MCPServerConfig,
    private timeout = 15000  // 减少默认超时时间到15秒
  ) {
    super()
  }

  /**
   * 启动MCP服务器进程
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('MCP server already started')
    }

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.config.env },
          cwd: this.config.cwd || process.cwd()
        })

        this.process.on('error', (error) => {
          this.emit('error', error)
          reject(error)
        })

        this.process.on('exit', (code, signal) => {
          this.emit('exit', code, signal)
          this.cleanup()
        })

        // 处理stdout消息
        this.process.stdout?.on('data', (data) => {
          this.handleData(data.toString())
        })

        // 处理stderr错误
        this.process.stderr?.on('data', (data) => {
          this.emit('stderr', data.toString())
        })

        // 初始化MCP协议
        this.initialize().then(() => {
          resolve()
        }).catch(reject)

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 停止MCP服务器
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        this.cleanup()
        resolve()
      }

      if (this.process) {
        this.process.once('exit', cleanup)
        this.process.kill('SIGTERM')

        // 强制终止超时
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
          }
          cleanup()
        }, 5000)
      } else {
        cleanup()
      }
    })
  }

  /**
   * 发送MCP消息（带性能优化）
   */
  async sendMessage(message: Omit<MCPMessage, 'jsonrpc'>): Promise<any> {
    if (!this.process) {
      throw new Error('MCP server not started')
    }
    
    // 允许初始化消息在未初始化状态下发送
    if (!this.isInitialized && message.method !== 'initialize') {
      throw new Error('MCP server not initialized')
    }

    const id = message.id || ++this.messageId
    const fullMessage: MCPMessage = {
      jsonrpc: '2.0',
      id,
      ...message
    }

    return new Promise((resolve, reject) => {
      // 使用更短的超时时间
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout after 10 seconds: ${message.method}`))
      }, 10000)

      this.pendingRequests.set(id, { resolve, reject, timeout })

      const messageStr = JSON.stringify(fullMessage) + '\n'
      this.process!.stdin?.write(messageStr)
    })
  }

  /**
   * 发送MCP通知（不需要响应）
   */
  sendNotification(method: string, params: any = {}): void {
    if (!this.process) {
      throw new Error('MCP server not started')
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params
    }

    const messageStr = JSON.stringify(notification) + '\n'
    this.process.stdin?.write(messageStr)
  }

  /**
   * 列出可用工具
   */
  async listTools(): Promise<any[]> {
    const response = await this.sendMessage({
      method: 'tools/list'
    })
    return response.tools || []
  }

  /**
   * 调用工具（带性能优化）
   */
  async callTool(name: string, arguments_: Record<string, any>): Promise<any> {
    // 使用Promise.race实现更短的超时控制
    const response = await Promise.race([
      this.sendMessage({
        method: 'tools/call',
        params: {
          name,
          arguments: arguments_
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tool call timeout after 12 seconds')), 12000)
      )
    ])
    return response
  }

  /**
   * 获取服务器信息
   */
  async getServerInfo(): Promise<any> {
    return await this.sendMessage({
      method: 'server/info'
    })
  }

  /**
   * 初始化MCP协议
   */
  private async initialize(): Promise<void> {
    try {
      const response = await this.sendMessage({
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          clientInfo: {
            name: 'Bor-Studio-MCP-Client',
            version: '1.0.0'
          }
        }
      })

      this.capabilities = response.capabilities || {}
      this.isInitialized = true
      this.emit('initialized', this.capabilities)

      // 发送initialized通知
      this.sendNotification('notifications/initialized', {})

    } catch (error) {
      throw new Error(`Failed to initialize MCP protocol: ${error}`)
    }
  }

  /**
   * 处理接收到的数据
   */
  private handleData(data: string): void {
    this.buffer += data
    
    let lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: MCPMessage = JSON.parse(line)
          this.handleMessage(message)
        } catch (error) {
          this.emit('error', new Error(`Failed to parse message: ${line}`))
        }
      }
    }
  }

  /**
   * 处理MCP消息
   */
  private handleMessage(message: MCPMessage): void {
    if (message.id !== undefined) {
      // 响应消息
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(message.id)

        if (message.error) {
          pending.reject(new Error(`MCP Error: ${message.error.message}`))
        } else {
          pending.resolve(message.result)
        }
      }
    } else if (message.method) {
      // 通知消息
      this.emit('notification', message.method, message.params)
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.process = null
    this.isInitialized = false
    this.buffer = ''
    
    // 清理待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('MCP server stopped'))
    }
    this.pendingRequests.clear()
  }

  /**
   * 获取服务器状态
   */
  get isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  /**
   * 获取进程ID
   */
  get pid(): number | undefined {
    return this.process?.pid
  }

  /**
   * 获取服务器能力
   */
  getCapabilities(): MCPCapabilities {
    return this.capabilities
  }
}