/**
 * 简化的Electron端MCP客户端
 * 专注于核心功能：启动服务器、发现工具、执行工具调用
 */

import { spawn, ChildProcess } from 'child_process'
// 定义本地类型，避免跨模块导入问题
interface MCPServerConfig {
  id: string
  name: string
  description?: string
  command: string
  args?: string[]
  env?: Record<string, string>
  autoStart?: boolean
}

interface MCPTool {
  name: string
  description: string
  server: string
  inputSchema?: any
}

interface MCPToolCall {
  tool: string
  parameters: Record<string, any>
  server: string
}

interface MCPServer {
  id: string
  name: string
  config: MCPServerConfig
  process: ChildProcess | null
  status: 'stopped' | 'starting' | 'running' | 'error'
  tools: MCPTool[]
  messageId: number
}

export class SimpleMCPClient {
  private servers: Map<string, MCPServer> = new Map()

  /**
   * 添加服务器配置
   */
  async addServer(config: MCPServerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.servers.has(config.id)) {
        console.log(`⚠️ 服务器 ${config.id} 已存在，跳过添加`)
        return { success: true }
      }

      const server: MCPServer = {
        id: config.id,
        name: config.name,
        config,
        process: null,
        status: 'stopped',
        tools: [],
        messageId: 1
      }

      this.servers.set(config.id, server)
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
   * 启动服务器
   */
  async startServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const server = this.servers.get(serverId)
      if (!server) {
        return { success: false, error: '服务器不存在' }
      }

      if (server.status === 'running') {
        console.log(`✅ 服务器 ${serverId} 已在运行`)
        return { success: true }
      }

      console.log(`🚀 启动MCP服务器: ${server.name} (${serverId})`)
      server.status = 'starting'

      // 启动进程
      const childProcess = spawn(server.config.command, server.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...server.config.env }
      })

      server.process = childProcess

      // 监听进程事件
      childProcess.on('error', (error) => {
        console.error(`❌ 服务器进程错误 (${serverId}):`, error)
        server.status = 'error'
      })

      childProcess.on('exit', (code, signal) => {
        console.log(`🔄 服务器进程退出 (${serverId}): code=${code}, signal=${signal}`)
        server.status = 'stopped'
        server.process = null
      })

      // 等待进程启动
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('服务器启动超时'))
        }, 5000)

        childProcess.on('spawn', () => {
          clearTimeout(timeout)
          resolve(void 0)
        })

        childProcess.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      // 初始化MCP连接
      await this.initializeMCPConnection(server)

      server.status = 'running'
      console.log(`✅ MCP服务器启动完成: ${serverId}`)
      
      return { success: true }
    } catch (error) {
      console.error(`❌ 启动服务器失败 (${serverId}):`, error)
      const server = this.servers.get(serverId)
      if (server) {
        server.status = 'error'
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 初始化MCP连接
   */
  private async initializeMCPConnection(server: MCPServer): Promise<void> {
    if (!server.process) {
      throw new Error('服务器进程不存在')
    }

    console.log(`🤝 初始化MCP连接: ${server.id}`)

    // 1. 发送初始化消息并等待响应
    const initMessage = {
      jsonrpc: '2.0',
      id: server.messageId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'Bor-Agent-Hub',
          version: '1.0.0'
        }
      }
    }

    console.log(`📤 发送初始化消息: ${server.id}`)
    const initResponse = await this.sendMessageAndWaitResponse(server, initMessage)
    console.log(`📥 收到初始化响应: ${server.id}`, initResponse)

    // 2. 发送initialized通知
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }

    console.log(`📤 发送initialized通知: ${server.id}`)
    await this.sendMessage(server, initializedNotification)

    // 3. 获取工具列表
    await this.discoverTools(server)
  }

  /**
   * 发现工具
   */
  private async discoverTools(server: MCPServer): Promise<void> {
    if (!server.process) {
      return
    }

    console.log(`🔍 发现服务器工具: ${server.id}`)

    const toolsMessage = {
      jsonrpc: '2.0',
      id: server.messageId++,
      method: 'tools/list'
    }

    try {
      console.log(`📤 发送工具列表请求: ${server.id}`)
      const response = await this.sendMessageAndWaitResponse(server, toolsMessage)
      console.log(`📥 收到工具列表响应: ${server.id}`, response)
      
      if (response && response.result && response.result.tools) {
        server.tools = response.result.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          server: server.id,
          inputSchema: tool.inputSchema
        }))
        
        console.log(`✅ 发现 ${server.tools.length} 个工具:`, server.tools.map(t => t.name))
      } else {
        console.warn(`⚠️ 服务器 ${server.id} 没有返回工具列表，响应:`, response)
      }
    } catch (error) {
      console.error(`❌ 获取工具列表失败 (${server.id}):`, error)
    }
  }

  /**
   * 发送消息并等待响应
   */
  private async sendMessageAndWaitResponse(server: MCPServer, message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!server.process) {
        reject(new Error('服务器进程不存在'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('消息响应超时'))
      }, 10000)

      let buffer = ''
      
      const onData = (data: Buffer) => {
        try {
          // 将新数据添加到缓冲区
          buffer += data.toString()
          
          // 尝试处理完整的JSON消息
          let lines = buffer.split('\n')
          
          // 保留最后一行（可能不完整）
          buffer = lines.pop() || ''
          
          // 处理完整的行
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line.trim())
                console.log(`📥 解析响应 (${server.id}):`, response)
                
                if (response.id === message.id) {
                  clearTimeout(timeout)
                  server.process!.stdout!.off('data', onData)
                  console.log(`✅ 找到匹配响应 (${server.id}):`, response)
                  resolve(response)
                  return
                }
              } catch (parseError) {
                console.log(`⚠️ JSON解析失败 (${server.id}):`, line.substring(0, 100) + '...')
              }
            }
          }
        } catch (error) {
          console.error('处理响应数据失败:', error)
        }
      }

      server.process.stdout!.on('data', onData)
      
      // 发送消息
      const messageStr = JSON.stringify(message)
      console.log(`📤 发送消息 (${server.id}):`, messageStr)
      server.process.stdin!.write(messageStr + '\n')
    })
  }

  /**
   * 发送消息（不等待响应）
   */
  private async sendMessage(server: MCPServer, message: any): Promise<void> {
    if (!server.process) {
      throw new Error('服务器进程不存在')
    }

    server.process.stdin!.write(JSON.stringify(message) + '\n')
    
    // 给服务器一点时间处理
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  /**
   * 执行工具调用
   */
  async executeTool(call: MCPToolCall): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const server = this.servers.get(call.server)
      if (!server || !server.process || server.status !== 'running') {
        return {
          success: false,
          error: `服务器 ${call.server} 不可用`
        }
      }

      console.log(`🔧 执行工具调用: ${call.tool} on ${call.server}`)

      const toolMessage = {
        jsonrpc: '2.0',
        id: server.messageId++,
        method: 'tools/call',
        params: {
          name: call.tool,
          arguments: call.parameters
        }
      }

      const response = await this.sendMessageAndWaitResponse(server, toolMessage)
      
      if (response.result) {
        console.log(`✅ 工具调用成功: ${call.tool}`)
        
        // 提取结果数据
        let resultData = response.result
        if (response.result.content && Array.isArray(response.result.content)) {
          resultData = response.result.content[0]?.text || response.result
        }
        
        return {
          success: true,
          data: resultData
        }
      } else if (response.error) {
        console.error(`❌ 工具调用失败: ${response.error.message}`)
        return {
          success: false,
          error: response.error.message
        }
      } else {
        return {
          success: false,
          error: '工具调用返回了意外的响应格式'
        }
      }
    } catch (error) {
      console.error('执行工具调用失败:', error)
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
      const serverList = Array.from(this.servers.values()).map(server => ({
        id: server.id,
        name: server.name,
        status: server.status,
        description: server.config.description,
        toolCount: server.tools.length
      }))

      return { success: true, data: serverList }
    } catch (error) {
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
        const server = this.servers.get(serverId)
        if (server) {
          tools = server.tools
        }
      } else {
        // 获取所有服务器的工具
        for (const server of Array.from(this.servers.values())) {
          tools.push(...server.tools)
        }
      }

      console.log(`📋 获取工具列表: ${tools.length} 个工具`)
      return { success: true, data: tools }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 停止服务器
   */
  async stopServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const server = this.servers.get(serverId)
      if (!server) {
        return { success: false, error: '服务器不存在' }
      }

      if (server.process) {
        console.log(`🛑 停止MCP服务器: ${server.name} (${serverId})`)
        server.process.kill('SIGTERM')
        
        // 等待进程退出
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (server.process) {
              server.process.kill('SIGKILL')
            }
            resolve(void 0)
          }, 3000)

          server.process!.on('exit', () => {
            clearTimeout(timeout)
            resolve(void 0)
          })
        })
      }

      server.status = 'stopped'
      server.process = null
      server.tools = []
      
      return { success: true }
    } catch (error) {
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
      const server = this.servers.get(serverId)
      if (!server) {
        return { success: false, error: '服务器不存在' }
      }

      // 先停止服务器
      if (server.status === 'running') {
        await this.stopServer(serverId)
      }

      // 移除服务器
      this.servers.delete(serverId)
      console.log(`🗑️ 移除MCP服务器: ${server.name} (${serverId})`)
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 清理所有资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 清理MCP客户端资源...')
    
    for (const server of Array.from(this.servers.values())) {
      if (server.status === 'running') {
        try {
          await this.stopServer(server.id)
        } catch (error) {
          console.error(`清理服务器 ${server.id} 失败:`, error)
        }
      }
    }
    
    this.servers.clear()
    console.log('✅ MCP客户端资源清理完成')
  }
}

// 创建单例实例
export const simpleMCPClient = new SimpleMCPClient()