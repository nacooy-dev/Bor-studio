/**
 * Electron端的MCP管理器
 * 简化实现，主要用于启动和管理MCP服务器进程
 */

import { spawn, ChildProcess } from 'child_process'
import { MCPServerConfig, MCPTool, MCPToolCall } from '../src/types'

export interface MCPServerProcess {
  id: string
  name: string
  process: ChildProcess | null
  status: 'stopped' | 'starting' | 'running' | 'error'
  config: MCPServerConfig
  tools: MCPTool[]
  lastError?: string
}

export class ElectronMCPManager {
  private servers: Map<string, MCPServerProcess> = new Map()

  /**
   * 添加服务器配置
   */
  async addServer(config: MCPServerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.servers.has(config.id)) {
        return { success: false, error: '服务器已存在' }
      }

      const serverProcess: MCPServerProcess = {
        id: config.id,
        name: config.name,
        process: null,
        status: 'stopped',
        config,
        tools: []
      }

      this.servers.set(config.id, serverProcess)
      console.log(`✅ 添加MCP服务器配置: ${config.name} (${config.id})`)
      
      return { success: true }
    } catch (error) {
      console.error('添加服务器配置失败:', error)
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
        return { success: true }
      }

      console.log(`🚀 启动MCP服务器: ${server.name} (${serverId})`)
      server.status = 'starting'

      // 启动服务器进程
      const childProcess = spawn(server.config.command, server.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...server.config.env }
      })

      server.process = childProcess
      
      // 监听进程事件
      childProcess.on('spawn', () => {
        console.log(`✅ MCP服务器进程启动: ${serverId}`)
        server.status = 'running'
      })

      childProcess.on('error', (error) => {
        console.error(`❌ MCP服务器进程错误 (${serverId}):`, error)
        server.status = 'error'
        server.lastError = error.message
      })

      childProcess.on('exit', (code, signal) => {
        console.log(`🔄 MCP服务器进程退出 (${serverId}): code=${code}, signal=${signal}`)
        server.status = 'stopped'
        server.process = null
      })

      // 等待进程启动
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('服务器启动超时'))
        }, 10000)

        childProcess.on('spawn', () => {
          clearTimeout(timeout)
          resolve(void 0)
        })

        childProcess.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      // 等待一段时间确保服务器完全启动
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 发送MCP初始化消息
      await this.initializeMCPConnection(server)

      return { success: true }
    } catch (error) {
      console.error('启动服务器失败:', error)
      const server = this.servers.get(serverId)
      if (server) {
        server.status = 'error'
        server.lastError = error instanceof Error ? error.message : '未知错误'
      }
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
          }, 5000)

          server.process!.on('exit', () => {
            clearTimeout(timeout)
            resolve(void 0)
          })
        })
      }

      server.status = 'stopped'
      server.process = null
      
      return { success: true }
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
      const serverList = Array.from(this.servers.values()).map(server => ({
        id: server.id,
        name: server.name,
        status: server.status,
        description: server.config.description,
        toolCount: server.tools.length,
        lastError: server.lastError
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
        const server = this.servers.get(serverId)
        if (server) {
          tools = server.tools
        }
      } else {
        // 获取所有服务器的工具
        for (const server of this.servers.values()) {
          tools.push(...server.tools)
        }
      }

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
      
      const server = this.servers.get(call.server || 'duckduckgo-search')
      if (!server || !server.process || server.status !== 'running') {
        return {
          success: false,
          error: `服务器 ${call.server} 不可用`
        }
      }

      // 构建MCP工具调用消息
      const message = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: call.tool,
          arguments: call.parameters
        }
      }

      console.log('📤 发送MCP消息:', message)

      // 发送消息到服务器
      server.process.stdin.write(JSON.stringify(message) + '\n')

      // 等待响应
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: '工具调用超时'
          })
        }, 30000) // 30秒超时

        const onData = (data: Buffer) => {
          try {
            const lines = data.toString().split('\n').filter(line => line.trim())
            for (const line of lines) {
              try {
                const response = JSON.parse(line)
                
                // 检查是否是我们等待的响应
                if (response.id === message.id && response.result) {
                  clearTimeout(timeout)
                  server.process!.stdout.off('data', onData)
                  
                  console.log('📥 收到工具调用响应:', response)
                  
                  // 提取结果
                  let resultData = response.result
                  if (response.result.content && Array.isArray(response.result.content)) {
                    resultData = response.result.content[0]?.text || response.result
                  }
                  
                  resolve({
                    success: true,
                    data: resultData
                  })
                  return
                }
              } catch (parseError) {
                // 忽略解析错误，可能是部分数据
              }
            }
          } catch (error) {
            console.error('处理响应数据失败:', error)
          }
        }

        server.process!.stdout.on('data', onData)
      })
      
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
   * 初始化MCP连接
   */
  private async initializeMCPConnection(server: MCPServerProcess): Promise<void> {
    try {
      if (!server.process) {
        throw new Error('服务器进程不存在')
      }

      console.log(`🤝 初始化MCP连接: ${server.id}`)

      // 发送初始化消息
      const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'Bor-Agent-Hub',
            version: '1.0.0'
          }
        }
      }

      server.process.stdin.write(JSON.stringify(initMessage) + '\n')

      // 等待初始化响应
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MCP初始化超时'))
        }, 5000)

        const onData = (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString().trim())
            if (response.id === 1 && response.result) {
              clearTimeout(timeout)
              server.process!.stdout.off('data', onData)
              console.log(`✅ MCP连接初始化成功: ${server.id}`)
              
              // 发送initialized通知
              server.process!.stdin.write(JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized'
              }) + '\n')
              
              resolve(void 0)
            }
          } catch (error) {
            // 忽略解析错误
          }
        }

        server.process!.stdout.on('data', onData)
      })

      // 获取工具列表
      await this.discoverServerTools(server)

    } catch (error) {
      console.error(`❌ MCP连接初始化失败 (${server.id}):`, error)
      throw error
    }
  }

  /**
   * 发现服务器工具
   */
  private async discoverServerTools(server: MCPServerProcess): Promise<void> {
    try {
      if (!server.process) {
        return
      }

      console.log(`🔍 发现服务器工具: ${server.id}`)

      const toolsMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      }

      server.process.stdin.write(JSON.stringify(toolsMessage) + '\n')

      // 等待工具列表响应
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ 获取工具列表超时: ${server.id}`)
          resolve(void 0)
        }, 5000)

        const onData = (data: Buffer) => {
          try {
            const lines = data.toString().split('\n').filter(line => line.trim())
            for (const line of lines) {
              try {
                const response = JSON.parse(line)
                if (response.id === 2 && response.result && response.result.tools) {
                  clearTimeout(timeout)
                  server.process!.stdout.off('data', onData)
                  
                  // 转换工具格式
                  server.tools = response.result.tools.map((tool: any) => ({
                    name: tool.name,
                    description: tool.description,
                    server: server.id,
                    inputSchema: tool.inputSchema
                  }))
                  
                  console.log(`✅ 发现 ${server.tools.length} 个工具:`, server.tools.map(t => t.name))
                  resolve(void 0)
                  return
                }
              } catch (parseError) {
                // 忽略解析错误
              }
            }
          } catch (error) {
            console.error('处理工具列表响应失败:', error)
          }
        }

        server.process!.stdout.on('data', onData)
      })

    } catch (error) {
      console.error(`❌ 发现服务器工具失败 (${server.id}):`, error)
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
    console.log('🧹 清理MCP资源...')
    
    for (const server of this.servers.values()) {
      if (server.process) {
        try {
          await this.stopServer(server.id)
        } catch (error) {
          console.error(`清理服务器 ${server.id} 失败:`, error)
        }
      }
    }
    
    this.servers.clear()
    console.log('✅ MCP资源清理完成')
  }
}

// 创建单例实例
export const electronMCPManager = new ElectronMCPManager()