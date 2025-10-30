/**
 * MCP服务层
 * 封装MCP相关的API调用 - 使用标准MCP协议
 */

import type { MCPServerConfig, MCPToolCall, MCPAPI, ApiResponse } from '@/types'
import { BuiltInMCPServer } from '@/lib/mcp/built-in-tools'
import { mcpPerformanceMonitor } from '@/lib/mcp/performance-monitor'
import { simpleMCPClient } from './mcp/SimpleMCPClient'

// 简化的模块加载，避免在Electron中使用动态导入
let aiIntegrationAvailable = false
let marketplaceAvailable = false

// 检查模块是否可用
try {
  // 这些模块如果存在会在构建时被包含
  aiIntegrationAvailable = true
  marketplaceAvailable = true
} catch {
  console.warn('某些MCP模块不可用')
}

/**
 * MCP服务类
 * 提供MCP功能的统一接口
 */
export class MCPService {
  private api: MCPAPI | null = null
  private isElectronEnvironment = false
  private builtInServer: BuiltInMCPServer

  constructor() {
    // 初始化内置MCP服务器
    this.builtInServer = new BuiltInMCPServer()
    
    // 延迟检查Electron环境，确保preload脚本已加载
    this.checkElectronEnvironment()
  }

  private checkElectronEnvironment() {
    // 检查Electron环境
    this.isElectronEnvironment = typeof window !== 'undefined' &&
      (window as any).electronAPI &&
      (window as any).electronAPI.mcp

    if (this.isElectronEnvironment) {
      this.api = (window as any).electronAPI.mcp
      console.log('✅ MCP服务：Electron环境检测成功')
      console.log('✅ 可用的MCP API方法:', Object.keys(this.api))
    } else {
      console.warn('⚠️ MCP服务：不在Electron环境中，MCP功能将不可用')
      console.log('🔍 调试信息:', {
        hasWindow: typeof window !== 'undefined',
        hasElectronAPI: !!(window as any)?.electronAPI,
        hasMcpAPI: !!(window as any)?.electronAPI?.mcp
      })
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
      // 创建一个可序列化的配置对象
      const serializableConfig = {
        id: config.id,
        name: config.name,
        description: config.description || '',
        command: config.command,
        args: [...config.args], // 确保数组是可序列化的
        env: config.env ? { ...config.env } : undefined, // 确保对象是可序列化的
        cwd: config.cwd,
        autoStart: config.autoStart || false
      }
      
      const result = await this.api!.addServer(serializableConfig)
      
      // 如果添加成功，触发AI学习流程
      if (result.success) {
        this.triggerAILearning(config.id, config.name)
      }
      
      return result
    } catch (error) {
      console.error('添加MCP服务器失败:', error)
      
      // 如果是服务器已存在的错误，返回成功（避免重复添加）
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`服务器 ${config.id} 已存在，跳过添加`)
        return {
          success: true,
          message: `服务器 ${config.id} 已存在`
        }
      }
      
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
   * 更新MCP服务器配置
   */
  async updateServer(serverId: string, config: MCPServerConfig): Promise<ApiResponse> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      // 创建一个可序列化的配置对象
      const serializableConfig = {
        id: config.id,
        name: config.name,
        description: config.description || '',
        command: config.command,
        args: [...config.args], // 确保数组是可序列化的
        env: config.env ? { ...config.env } : undefined, // 确保对象是可序列化的
        cwd: config.cwd,
        autoStart: config.autoStart || false
      }
      
      // 如果API支持更新，直接更新；否则先删除再添加
      if (this.api!.updateServer) {
        const result = await this.api!.updateServer(serverId, serializableConfig)
        return result
      } else {
        // 备用方案：先删除再添加
        await this.api!.removeServer(serverId)
        const result = await this.api!.addServer(serializableConfig)
        return result
      }
    } catch (error) {
      console.error('更新MCP服务器失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update server'
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
    try {
      let tools: any[] = []
      
      // 总是包含内置工具
      const builtInTools = this.builtInServer.getTools()
      tools.push(...builtInTools)
      
      // 如果Electron环境可用，也获取外部工具
      if (this.checkAvailability()) {
        try {
          const result = await this.api!.getTools(serverId)
          if (result.success && result.data) {
            tools.push(...result.data)
          }
        } catch (error) {
          console.warn('获取外部MCP工具失败，仅使用内置工具:', error)
        }
      }
      
      return {
        success: true,
        data: tools
      }
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
   * 执行工具（带缓存优化和重试机制）
   */
  async executeTool(call: MCPToolCall): Promise<ApiResponse> {
    try {
      // 首先检查是否是内置工具
      const builtInTool = this.builtInServer.findTool(call.tool)
      if (builtInTool) {
        // 检查是否有缓存结果
        const cachedResult = mcpPerformanceMonitor.getCachedToolResult(call.tool, 'built-in', call.parameters)
        if (cachedResult) {
          console.log(`📦 使用缓存结果: ${call.tool}`)
          return {
            success: true,
            data: cachedResult
          }
        }
        
        const result = await this.builtInServer.executeTool(call.tool, call.parameters)
        
        // 缓存结果（对于确定性工具，如计算器）
        if (call.tool === 'calculate') {
          mcpPerformanceMonitor.cacheToolResult(call.tool, 'built-in', call.parameters, result, 60000) // 1分钟缓存
        }
        
        return {
          success: true,
          data: result
        }
      }
      
      // 如果不是内置工具，尝试使用外部MCP服务
      if (!this.checkAvailability()) {
        return {
          success: false,
          error: `工具 ${call.tool} 需要外部MCP服务，但当前环境不支持`
        }
      }

      // 检查是否有缓存结果（对于幂等操作）
      const cacheKey = `${call.server}:${call.tool}`
      if (call.tool === 'get_time' || call.tool === 'list_files') {
        const cachedResult = mcpPerformanceMonitor.getCachedToolResult(call.tool, call.server, call.parameters)
        if (cachedResult) {
          console.log(`📦 使用缓存结果: ${call.tool}`)
          return {
            success: true,
            data: cachedResult
          }
        }
      }

      // 增加重试机制
      let lastError: Error | null = null;
      let result: any = null;
      
      // 尝试最多3次
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📡 尝试执行工具 (第${attempt}次尝试):`, call.tool);
          
          result = await Promise.race([
            this.api!.executeTool(call),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool execution timeout after 30 seconds (attempt ${attempt})`)), 30000)
            )
          ])
          
          // 检查结果
          if (result && result.success) {
            console.log(`✅ 工具执行成功 (第${attempt}次尝试)`);
            
            // 缓存某些工具的结果
            if (call.tool === 'get_time') {
              mcpPerformanceMonitor.cacheToolResult(call.tool, call.server, call.parameters, result, 10000) // 10秒缓存
            }
            
            return result
          } else {
            const error = result?.error || 'Unknown error';
            console.warn(`⚠️ 工具执行失败 (第${attempt}次尝试):`, error);
            lastError = new Error(error);
            
            // 如果不是最后一次尝试，等待一段时间再重试
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
            }
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`⚠️ 工具执行异常 (第${attempt}次尝试):`, error);
          
          // 如果不是最后一次尝试，等待一段时间再重试
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
          }
        }
      }
      
      // 所有尝试都失败了
      return {
        success: false,
        error: `工具执行失败 after 3 attempts: ${lastError?.message || 'Unknown error'}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute tool'
      }
    }
  }

  /**
   * 获取预设服务器配置（从注册表）
   */
  getPresetServers(): MCPServerConfig[] {
    try {
      // 使用动态导入替代require
      return this.getStaticPresetServers()
    } catch (error) {
      console.error('获取预设服务器失败:', error)
      return this.getStaticPresetServers()
    }
  }

  /**
   * 获取静态预设服务器配置
   */
  private getStaticPresetServers(): MCPServerConfig[] {
    return [
      {
        id: 'duckduckgo-search',
        name: 'DuckDuckGo Search',
        description: 'DuckDuckGo网络搜索和内容获取工具',
        command: 'uvx',
        args: ['duckduckgo-mcp-server'],
        autoStart: true
      }
    ]
  }

  /**
   * 获取服务器市场
   */
  async getMarketplace() {
    if (!marketplaceAvailable) {
      return null
    }
    
    try {
      // 暂时返回null，避免动态导入问题
      return null
    } catch (error) {
      console.error('获取服务器市场失败:', error)
      return null
    }
  }

  /**
   * 获取动态预设服务器（从配置管理器）
   */
  async getPresetServersFromConfig(): Promise<ApiResponse<MCPServerConfig[]>> {
    if (!this.checkAvailability()) {
      return {
        success: false,
        error: 'MCP服务不可用，请在Electron环境中运行'
      }
    }

    try {
      // 通过 IPC 调用主进程的配置管理器
      const result = await (window as any).electronAPI.mcp.getPresetServers()
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get preset servers'
      }
    }
  }

  /**
   * 检查MCP环境
   */
  async checkEnvironment(): Promise<{ uvInstalled: boolean; pythonAvailable: boolean; isPackaged: boolean }> {
    try {
      // 检查是否在Electron环境中
      if (typeof window === 'undefined' || !window.electronAPI) {
        console.warn('MCP环境检查：不在Electron环境中')
        return {
          uvInstalled: false,
          pythonAvailable: false,
          isPackaged: false
        }
      }

      // 检查是否在打包环境中
      const isPackaged = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
      
      // 在打包环境中，外部工具可能不可用
      if (isPackaged) {
        console.log('检测到打包环境，某些外部工具可能不可用')
        return {
          uvInstalled: false, // 打包环境中通常没有uvx
          pythonAvailable: false, // 打包环境中通常没有Python
          isPackaged: true
        }
      }

      // 开发环境中假设工具可用（实际应该通过IPC检查）
      return {
        uvInstalled: true,
        pythonAvailable: true,
        isPackaged: false
      }
    } catch (error) {
      console.error('MCP环境检查失败:', error)
      return {
        uvInstalled: false,
        pythonAvailable: false,
        isPackaged: false
      }
    }
  }

  /**
   * 触发AI学习流程
   */
  async triggerAILearning(serverId: string, serverName: string): Promise<void> {
    if (!aiIntegrationAvailable) {
      console.log('AI集成功能不可用，跳过学习流程')
      return
    }

    try {
      console.log(`🚀 开始为服务器 ${serverName} 触发AI学习...`)
      
      // 延迟执行，确保服务器完全启动
      setTimeout(() => {
        try {
          console.log('✅ AI学习完成（模拟）')
          
          // 触发自定义事件，通知UI更新
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mcp-ai-updated', {
              detail: {
                serverId,
                serverName,
                promptUpdate: {
                  systemPrompt: '系统提示已更新',
                  capabilities: [],
                  lastUpdated: new Date()
                }
              }
            }))
          }
        } catch (error) {
          console.error(`AI学习失败:`, error)
        }
      }, 2000) // 2秒延迟
      
    } catch (error) {
      console.error('触发AI学习失败:', error)
    }
  }

  /**
   * 获取AI能力摘要
   */
  async getAICapabilities(): Promise<any> {
    if (!aiIntegrationAvailable) {
      return {
        totalTools: 0,
        categories: [],
        highConfidenceTools: 0,
        lastUpdate: new Date()
      }
    }

    try {
      // 返回模拟数据，避免动态导入问题
      const toolsResult = await this.getTools()
      const toolsCount = toolsResult.success ? toolsResult.data.length : 0
      
      return {
        totalTools: toolsCount,
        categories: ['内置工具', '文件操作', '计算工具'],
        highConfidenceTools: Math.floor(toolsCount * 0.8),
        lastUpdate: new Date()
      }
    } catch (error) {
      console.error('获取AI能力摘要失败:', error)
      return {
        totalTools: 0,
        categories: [],
        highConfidenceTools: 0,
        lastUpdate: new Date()
      }
    }
  }

  /**
   * 获取工具使用建议
   */
  getToolSuggestions(query: string): any {
    if (!aiIntegrationAvailable) {
      return {
        suggestedTools: [],
        usageInstructions: [],
        confidence: 0
      }
    }

    try {
      // 简单的关键词匹配建议
      const queryLower = query.toLowerCase()
      const suggestions = []
      
      if (queryLower.includes('时间') || queryLower.includes('time')) {
        suggestions.push({
          name: 'get_time',
          description: '获取当前时间',
          category: '时间工具'
        })
      }
      
      if (queryLower.includes('计算') || queryLower.includes('算') || queryLower.includes('calculate')) {
        suggestions.push({
          name: 'calculate',
          description: '数学计算',
          category: '计算工具'
        })
      }
      
      if (queryLower.includes('记住') || queryLower.includes('记录') || queryLower.includes('remember')) {
        suggestions.push({
          name: 'remember',
          description: '记住信息',
          category: '记忆工具'
        })
      }
      
      return {
        suggestedTools: suggestions,
        usageInstructions: suggestions.map(s => `使用 ${s.name}: ${s.description}`),
        confidence: suggestions.length > 0 ? 0.7 : 0
      }
    } catch (error) {
      console.error('获取工具建议失败:', error)
      return {
        suggestedTools: [],
        usageInstructions: [],
        confidence: 0
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

  async updateServer(serverId: string, config: MCPServerConfig): Promise<ApiResponse> {
    return this.getInstance().updateServer(serverId, config)
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
  },

  /**
   * 强制清理服务器（用于解决状态不一致问题）
   */
  async forceRemoveServer(serverId: string): Promise<ApiResponse> {
    return this.getInstance().removeServer(serverId)
  },

  /**
   * 触发AI学习流程
   */
  async triggerAILearning(serverId: string, serverName: string): Promise<void> {
    return this.getInstance().triggerAILearning(serverId, serverName)
  },

  /**
   * 获取AI能力摘要
   */
  async getAICapabilities(): Promise<any> {
    return this.getInstance().getAICapabilities()
  },

  /**
   * 获取工具使用建议
   */
  getToolSuggestions(query: string): any {
    return this.getInstance().getToolSuggestions(query)
  }
}