/**
 * MCP服务层
 * 封装MCP相关的API调用
 */

import type { MCPServerConfig, MCPToolCall, MCPAPI, ApiResponse } from '@/types'

/**
 * MCP服务类
 * 提供MCP功能的统一接口
 */
export class MCPService {
  private api: MCPAPI | null = null
  private isElectronEnvironment = false

  constructor() {
    // 检查Electron环境
    this.isElectronEnvironment = typeof window !== 'undefined' && 
                                 (window as any).electronAPI && 
                                 (window as any).electronAPI.mcp

    if (this.isElectronEnvironment) {
      this.api = (window as any).electronAPI.mcp
    } else {
      console.warn('MCP服务：不在Electron环境中，MCP功能将不可用')
    }
  }

  /**
   * 检查MCP是否可用
   */
  private checkAvailability(): boolean {
    if (!this.isElectronEnvironment || !this.api) {
      console.warn('MCP服务不可用：需要在Electron环境中运行')
      return false
    }
    return true
  }

  /**
   * 添加MCP服务器
   */
  async addServer(config: MCPServerConfig): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.addServer(config)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add server'
      }
    }
  }

  /**
   * 启动MCP服务器
   */
  async startServer(serverId: string): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.startServer(serverId)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start server'
      }
    }
  }

  /**
   * 停止MCP服务器
   */
  async stopServer(serverId: string): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.stopServer(serverId)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop server'
      }
    }
  }

  /**
   * 删除MCP服务器
   */
  async removeServer(serverId: string): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.removeServer(serverId)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove server'
      }
    }
  }

  /**
   * 获取所有服务器
   */
  async getServers(): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.getServers()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get servers'
      }
    }
  }

  /**
   * 获取工具列表
   */
  async getTools(serverId?: string): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.getTools(serverId)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tools'
      }
    }
  }

  /**
   * 查找特定工具
   */
  async findTool(name: string, serverId?: string): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.findTool(name, serverId)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find tool'
      }
    }
  }

  /**
   * 执行工具
   */
  async executeTool(call: MCPToolCall): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      const result = await this.api!.executeTool(call)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute tool'
      }
    }
  }

  /**
   * 获取预设服务器配置
   */
  getPresetServers(): MCPServerConfig[] {
    // 在渲染进程中，我们不能直接访问process.env
    // 使用默认值或通过IPC从主进程获取
    const homeDir = '~' // 默认使用 ~ 作为主目录
    
    return [
      {
        id: 'duckduckgo-search',
        name: 'DuckDuckGo Search',
        description: '网络搜索工具 - 使用DuckDuckGo搜索引擎，包含搜索和网页内容获取功能',
        command: 'uv',
        args: ['run', 'duckduckgo-mcp-server'],
        autoStart: false
      },
      {
        id: 'memory',
        name: 'Memory',
        description: '记忆存储和检索工具 - 保存和查找重要信息',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        autoStart: false
      },
      {
        id: 'filesystem',
        name: 'File System',
        description: '文件系统操作工具 - 读取、写入、列出文件和目录',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/lvyun'],
        autoStart: false
      },
      {
        id: 'sequential-thinking',
        name: 'Sequential Thinking',
        description: '结构化思维和问题解决工具',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
        autoStart: false
      }
    ]
  }

  /**
   * 检查MCP环境
   */
  async checkEnvironment(): Promise<{ uvInstalled: boolean; pythonAvailable: boolean }> {
    try {
      // 检查是否在Electron环境中
      if (typeof window === 'undefined' || !window.electronAPI) {
        console.warn('MCP环境检查：不在Electron环境中')
        return {
          uvInstalled: false,
          pythonAvailable: false
        }
      }
      
      // 这里可以添加更详细的环境检查逻辑
      // 比如通过IPC调用主进程检查uv和Python
      return {
        uvInstalled: true,
        pythonAvailable: true
      }
    } catch (error) {
      console.error('MCP环境检查失败:', error)
      return {
        uvInstalled: false,
        pythonAvailable: false
      }
    }
  }
}

// 延迟创建单例实例
let mcpServiceInstance: MCPService | null = null

export const mcpService = {
  getInstance(): MCPService {
    if (!mcpServiceInstance) {
      mcpServiceInstance = new MCPService()
    }
    return mcpServiceInstance
  },
  
  // 代理所有方法
  async addServer(config: MCPServerConfig): Promise<ApiResponse> {
    return this.getInstance().addServer(config)
  },
  
  async startServer(serverId: string): Promise<ApiResponse> {
    return this.getInstance().startServer(serverId)
  },
  
  async stopServer(serverId: string): Promise<ApiResponse> {
    return this.getInstance().stopServer(serverId)
  },
  
  async removeServer(serverId: string): Promise<ApiResponse> {
    return this.getInstance().removeServer(serverId)
  },
  
  async getServers(): Promise<ApiResponse> {
    return this.getInstance().getServers()
  },
  
  async getTools(serverId?: string): Promise<ApiResponse> {
    return this.getInstance().getTools(serverId)
  },
  
  async findTool(name: string, serverId?: string): Promise<ApiResponse> {
    return this.getInstance().findTool(name, serverId)
  },
  
  async executeTool(call: MCPToolCall): Promise<ApiResponse> {
    return this.getInstance().executeTool(call)
  },
  
  getPresetServers(): MCPServerConfig[] {
    return this.getInstance().getPresetServers()
  },
  
  async checkEnvironment(): Promise<{ uvInstalled: boolean; pythonAvailable: boolean }> {
    return this.getInstance().checkEnvironment()
  }
}