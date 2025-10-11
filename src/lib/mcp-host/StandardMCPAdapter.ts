/**
 * 标准 MCP 适配器
 * 将标准 MCP SDK 适配到现有的接口，保持 UI 不变
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import type { 
  MCPServerConfig, 
  MCPTool, 
  MCPToolCall, 
  MCPCapabilities,
  MCPServerInstance 
} from './types'

export interface StandardMCPConfig {
  maxServers: number
  serverTimeout: number
  toolTimeout: number
  enableLogging: boolean
}

/**
 * 标准 MCP 适配器 - 使用官方 SDK 但保持现有接口
 */
export class StandardMCPAdapter extends EventEmitter {
  private servers = new Map<string, {
    config: MCPServerConfig
    client: Client | null
    transport: StdioClientTransport | null
    process: ChildProcess | null
    status: 'stopped' | 'starting' | 'running' | 'error'
    capabilities: MCPCapabilities
    tools: MCPTool[]
    lastError?: string
    pid?: number
    startTime?: Date
  }>()
  
  private config: StandardMCPConfig

  constructor(config: Partial<StandardMCPConfig> = {}) {
    super()
    this.config = {
      maxServers: 10,
      serverTimeout: 15000,  // 减少服务器超时时间到15秒
      toolTimeout: 20000,    // 减少工具超时时间到20秒
      enableLogging: true,
      ...config
    }
  }

  /**
   * 添加 MCP 服务器
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server ${config.id} already exists`)
    }

    const server = {
      config,
      client: null,
      transport: null,
      process: null,
      status: 'stopped' as const,
      capabilities: {},
      tools: []
    }

    this.servers.set(config.id, server)
    this.emit('server_added', this.convertToLegacyFormat(server))

    // 保存服务器配置（如果在 Electron 环境中）
    if (typeof window !== 'undefined' && (window as any).electronAPI && (window as any).electronAPI.mcp) {
      try {
        await (window as any).electronAPI.mcp.addServer(config)
      } catch (error) {
        console.error('保存服务器配置失败:', error)
      }
    }

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
    this.emit('server_starting', this.convertToLegacyFormat(server))

    try {
      console.log(`🚀 启动标准 MCP 服务器: ${serverId}`)
      console.log(`🔧 服务器配置:`, {
        command: server.config.command,
        args: server.config.args,
        cwd: server.config.cwd || process.cwd()
      })
      
      // 创建标准 MCP 客户端
      const client = new Client({
        name: 'Bor-Studio-Standard-MCP',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
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

      // 创建传输层
      const transport = new StdioClientTransport({
        command: server.config.command,
        args: server.config.args,
        env: serverEnv,  // 使用更新后的环境变量
        cwd: server.config.cwd || process.cwd()
      })

      server.client = client
      server.transport = transport

      // 连接到服务器
      await client.connect(transport)
      
      console.log(`✅ 标准 MCP 连接成功: ${serverId}`)

      // 获取服务器能力
      const capabilities = client.getServerCapabilities()
      server.capabilities = capabilities || {}

      // 发现工具
      if (capabilities?.tools) {
        await this.discoverTools(serverId)
      }

      server.status = 'running'
      this.emit('server_started', this.convertToLegacyFormat(server))
      console.log(`🎉 标准 MCP 服务器启动成功: ${serverId}`)

    } catch (error) {
      server.status = 'error'
      server.lastError = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ 启动标准 MCP 服务器失败 ${serverId}:`, error)
      this.emit('server_error', this.convertToLegacyFormat(server), error)
      throw error
    }
  }

  /**
   * 停止 MCP 服务器
   */
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) {
      return
    }

    try {
      if (server.client) {
        await server.client.close()
      }
    } catch (error) {
      console.error(`停止服务器时出错: ${serverId}`, error)
    }

    server.status = 'stopped'
    server.client = null
    server.transport = null
    server.process = null
    server.pid = undefined
    server.tools = []
    
    this.emit('server_stopped', this.convertToLegacyFormat(server))
  }

  /**
   * 删除 MCP 服务器
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
    this.emit('server_removed', this.convertToLegacyFormat(server))
  }

  /**
   * 发现服务器工具
   */
  private async discoverTools(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server || !server.client) {
      return
    }

    try {
      console.log(`🔍 发现标准 MCP 工具: ${serverId}`)
      
      const response = await server.client.listTools()
      
      if (response.tools) {
        server.tools = response.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          schema: tool.inputSchema,
          server: serverId
        }))
        
        console.log(`✅ 发现 ${server.tools.length} 个工具:`, server.tools.map(t => t.name))
        this.emit('tools_discovered', this.convertToLegacyFormat(server), server.tools)
      }
    } catch (error) {
      console.error(`❌ 工具发现失败 ${serverId}:`, error)
      server.tools = []
    }
  }

  /**
   * 执行工具调用（带性能优化）
   */
  async executeTool(call: MCPToolCall): Promise<any> {
    const server = this.servers.get(call.server)
    if (!server || !server.client) {
      throw new Error(`Server ${call.server} not found or not running`)
    }

    if (server.status !== 'running') {
      throw new Error(`Server ${call.server} is not running`)
    }

    try {
      // 增加超时时间并添加重试机制
      let lastError: Error | null = null;
      
      // 尝试最多3次
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📡 尝试执行工具调用 (第${attempt}次尝试):`, call);
          
          const response = await Promise.race([
            server.client.callTool({
              name: call.tool,
              arguments: call.parameters
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool execution timeout after 25 seconds (attempt ${attempt})`)), 25000)
            )
          ])

          console.log(`✅ 工具调用成功 (第${attempt}次尝试):`, response);
          return (response as any).content || response
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
   * 获取所有服务器（转换为旧格式以兼容现有 UI）
   */
  getServers(): MCPServerInstance[] {
    return Array.from(this.servers.values()).map(server => this.convertToLegacyFormat(server))
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
      return server?.tools.find((t: any) => t.name === name) || null
    }

    const servers = Array.from(this.servers.values())
    for (const server of servers) {
      const tool = server.tools.find((t: any) => t.name === name)
      if (tool) return tool
    }

    return null
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(serverId: string): MCPServerInstance | null {
    const server = this.servers.get(serverId)
    return server ? this.convertToLegacyFormat(server) : null
  }

  /**
   * 转换为旧格式以兼容现有 UI
   */
  private convertToLegacyFormat(server: any): MCPServerInstance {
    return {
      id: server.config.id,
      config: server.config,
      process: server.process,
      status: server.status,
      capabilities: server.capabilities,
      tools: server.tools,
      lastError: server.lastError,
      pid: server.pid,
      startTime: server.startTime
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(id => this.stopServer(id))
    await Promise.all(stopPromises)
    this.servers.clear()
  }
}