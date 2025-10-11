/**
 * MCP服务器市场 - 提供服务器发现和安装界面
 */

import type { MCPServerConfig } from '@/types'
import { MCP_SERVER_REGISTRY, getServersByCategory, getCategories, searchServers, CATEGORY_NAMES, type MCPServerTemplate } from './server-registry'
import { fetchAllExternalServers, externalRegistryCache } from './external-registry'
import { mcpInstaller, type InstallationResult, type EnvironmentCheck } from './server-installer'
import { mcpPerformanceMonitor, PerformanceTimer } from './performance-monitor'
import { customServerManager } from './custom-server-manager'

export interface MarketplaceFilter {
  category?: string
  tags?: string[]
  search?: string
  showInstalled?: boolean
  showDisabled?: boolean
}

export interface ServerInstallationState {
  serverId: string
  status: 'idle' | 'installing' | 'testing' | 'installed' | 'failed'
  progress?: number
  message?: string
  error?: string
}

/**
 * MCP服务器市场管理器
 */
export class MCPServerMarketplace {
  private installedServers: Set<string> = new Set()
  private installationStates: Map<string, ServerInstallationState> = new Map()
  private environmentChecks: EnvironmentCheck[] = []
  private allServers: MCPServerTemplate[] = [...MCP_SERVER_REGISTRY]
  private externalServersLoaded = false
  private initialized = false
  private initPromise: Promise<void> | null = null

  constructor() {
    // 不在构造函数中执行耗时操作，改为懒加载
  }

  /**
   * 懒加载初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.initialize()
    return this.initPromise
  }

  /**
   * 异步初始化
   */
  private async initialize(): Promise<void> {
    return PerformanceTimer.measure('MCP市场初始化', async () => {
      try {
        // 并行执行初始化任务，设置合理的超时
        const initTasks = [
          this.loadInstalledServers(),
          this.checkEnvironment(),
          this.loadExternalServers(),
          this.loadCustomServers()
        ]
        
        // 使用Promise.allSettled确保即使部分任务失败也能继续
        const results = await Promise.allSettled(initTasks)
        
        // 记录失败的任务
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const taskNames = ['加载已安装服务器', '环境检查', '加载外部服务器', '加载自定义服务器']
            console.warn(`${taskNames[index]}失败:`, result.reason)
          }
        })
        
        this.initialized = true
        console.log('✅ MCP服务器市场初始化完成')
      } catch (error) {
        console.error('❌ MCP服务器市场初始化失败:', error)
        this.initialized = true // 即使失败也标记为已初始化，避免重复尝试
      }
    })
  }

  /**
   * 获取所有可用的服务器
   */
  async getAvailableServers(filter?: MarketplaceFilter): Promise<MCPServerTemplate[]> {
    await this.ensureInitialized()
    let servers = [...this.allServers]

    // 应用过滤器
    if (filter) {
      if (filter.category) {
        servers = servers.filter(server => server.category === filter.category)
      }

      if (filter.search) {
        const query = filter.search.toLowerCase()
        servers = servers.filter(server => 
          server.name.toLowerCase().includes(query) ||
          server.description.toLowerCase().includes(query) ||
          server.tags.some(tag => tag.toLowerCase().includes(query))
        )
      }

      if (filter.tags && filter.tags.length > 0) {
        servers = servers.filter(server => 
          filter.tags!.some(tag => server.tags.includes(tag))
        )
      }

      if (filter.showInstalled === false) {
        servers = servers.filter(server => !this.isInstalled(server.id))
      }

      if (filter.showDisabled === false) {
        servers = servers.filter(server => !server.disabled)
      }
    }

    return servers
  }

  /**
   * 获取服务器类别
   */
  async getCategories(): Promise<Array<{ id: string; name: string; count: number }>> {
    await this.ensureInitialized()
    const categoryCounts = new Map<string, number>()
    
    this.allServers.forEach(server => {
      const count = categoryCounts.get(server.category) || 0
      categoryCounts.set(server.category, count + 1)
    })

    return Array.from(categoryCounts.entries()).map(([category, count]) => ({
      id: category,
      name: CATEGORY_NAMES[category] || category,
      count
    })).sort((a, b) => b.count - a.count)
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(): Promise<Array<{ tag: string; count: number }>> {
    await this.ensureInitialized()
    const tagCounts = new Map<string, number>()
    
    this.allServers.forEach(server => {
      server.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  /**
   * 检查服务器是否已安装
   */
  isInstalled(serverId: string): boolean {
    return this.installedServers.has(serverId)
  }

  /**
   * 获取安装状态
   */
  getInstallationState(serverId: string): ServerInstallationState {
    return this.installationStates.get(serverId) || {
      serverId,
      status: this.isInstalled(serverId) ? 'installed' : 'idle'
    }
  }

  /**
   * 安装服务器
   */
  async installServer(
    template: MCPServerTemplate, 
    parameters: Record<string, any>,
    onProgress?: (state: ServerInstallationState) => void
  ): Promise<InstallationResult> {
    const serverId = template.id
    
    // 更新状态
    this.updateInstallationState(serverId, {
      serverId,
      status: 'installing',
      progress: 0,
      message: '开始安装...'
    }, onProgress)

    try {
      // 1. 验证参数
      this.updateInstallationState(serverId, {
        serverId,
        status: 'installing',
        progress: 20,
        message: '验证参数...'
      }, onProgress)

      const validation = mcpInstaller.validateParameters(template, parameters)
      if (!validation.valid) {
        throw new Error(`参数验证失败: ${validation.errors.join(', ')}`)
      }

      // 2. 检查依赖
      this.updateInstallationState(serverId, {
        serverId,
        status: 'installing',
        progress: 40,
        message: '检查依赖...'
      }, onProgress)

      const dependencyResult = await mcpInstaller.installDependencies(template)
      if (!dependencyResult.success) {
        throw new Error(dependencyResult.error || '依赖安装失败')
      }

      // 3. 创建配置
      this.updateInstallationState(serverId, {
        serverId,
        status: 'installing',
        progress: 60,
        message: '创建配置...'
      }, onProgress)

      const config = mcpInstaller.createServerConfig(template, parameters)

      // 4. 测试连接
      this.updateInstallationState(serverId, {
        serverId,
        status: 'testing',
        progress: 80,
        message: '测试连接...'
      }, onProgress)

      const testResult = await mcpInstaller.testServerConnection(config)
      if (!testResult.success) {
        throw new Error(testResult.error || '连接测试失败')
      }

      // 5. 保存配置
      this.updateInstallationState(serverId, {
        serverId,
        status: 'installing',
        progress: 100,
        message: '保存配置...'
      }, onProgress)

      await this.saveServerConfig(config)
      this.installedServers.add(serverId)

      // 完成
      this.updateInstallationState(serverId, {
        serverId,
        status: 'installed',
        message: '安装完成'
      }, onProgress)

      return {
        success: true,
        message: `${template.name} 安装成功`,
        config
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '安装失败'
      
      this.updateInstallationState(serverId, {
        serverId,
        status: 'failed',
        message: '安装失败',
        error: errorMessage
      }, onProgress)

      return {
        success: false,
        message: `${template.name} 安装失败`,
        error: errorMessage
      }
    }
  }

  /**
   * 卸载服务器
   */
  async uninstallServer(serverId: string): Promise<InstallationResult> {
    try {
      // 从MCP服务中移除
      if (typeof window !== 'undefined' && (window as any).electronAPI?.mcp) {
        await (window as any).electronAPI.mcp.removeServer(serverId)
      }

      // 更新本地状态
      this.installedServers.delete(serverId)
      this.installationStates.delete(serverId)

      return {
        success: true,
        message: '卸载成功'
      }
    } catch (error) {
      return {
        success: false,
        message: '卸载失败',
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 获取环境检查结果
   */
  getEnvironmentChecks(): EnvironmentCheck[] {
    return this.environmentChecks
  }

  /**
   * 获取推荐服务器
   */
  async getRecommendedServers(): Promise<MCPServerTemplate[]> {
    await this.ensureInitialized()
    // 基于标签和受欢迎程度推荐
    return this.allServers
      .filter(server => 
        server.tags.includes('official') || 
        server.tags.includes('popular') ||
        ['filesystem', 'knowledge', 'search'].includes(server.category)
      )
      .slice(0, 6)
  }

  /**
   * 获取最近安装的服务器
   */
  async getRecentlyInstalled(): Promise<MCPServerTemplate[]> {
    await this.ensureInitialized()
    // 这里可以基于安装时间排序，暂时返回已安装的服务器
    return this.allServers.filter(server => this.isInstalled(server.id))
  }

  /**
   * 获取外部服务器加载状态
   */
  isExternalServersLoaded(): boolean {
    return this.externalServersLoaded
  }

  /**
   * 手动刷新外部服务器
   */
  async refreshExternalServers(): Promise<void> {
    this.externalServersLoaded = false
    externalRegistryCache.clear()
    await this.loadExternalServers()
  }

  /**
   * 获取服务器统计信息
   */
  async getServerStats(): Promise<{
    total: number
    installed: number
    byCategory: Record<string, number>
    bySource: Record<string, number>
  }> {
    await this.ensureInitialized()
    
    const byCategory: Record<string, number> = {}
    const bySource: Record<string, number> = { builtin: 0, external: 0, custom: 0 }
    
    this.allServers.forEach(server => {
      // 统计类别
      byCategory[server.category] = (byCategory[server.category] || 0) + 1
      
      // 统计来源
      if (MCP_SERVER_REGISTRY.some(s => s.id === server.id)) {
        bySource.builtin++
      } else if (server.tags.includes('custom')) {
        bySource.custom++
      } else {
        bySource.external++
      }
    })

    return {
      total: this.allServers.length,
      installed: this.installedServers.size,
      byCategory,
      bySource
    }
  }

  /**
   * 刷新自定义服务器
   */
  async refreshCustomServers(): Promise<void> {
    await this.loadCustomServers()
  }

  /**
   * 私有方法：更新安装状态
   */
  private updateInstallationState(
    serverId: string, 
    state: ServerInstallationState,
    onProgress?: (state: ServerInstallationState) => void
  ) {
    this.installationStates.set(serverId, state)
    onProgress?.(state)
  }

  /**
   * 私有方法：保存服务器配置
   */
  private async saveServerConfig(config: MCPServerConfig): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.mcp) {
      const result = await (window as any).electronAPI.mcp.addServer(config)
      if (!result.success) {
        throw new Error(result.error || '保存配置失败')
      }
    } else {
      // 在非Electron环境中，保存到localStorage
      const savedConfigs = JSON.parse(localStorage.getItem('mcp_servers') || '[]')
      savedConfigs.push(config)
      localStorage.setItem('mcp_servers', JSON.stringify(savedConfigs))
    }
  }

  /**
   * 私有方法：加载已安装的服务器
   */
  private async loadInstalledServers(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.mcp) {
        const result = await (window as any).electronAPI.mcp.getServers()
        if (result.success && result.data) {
          result.data.forEach((server: MCPServerConfig) => {
            this.installedServers.add(server.id)
          })
        }
      } else {
        // 从localStorage加载
        const savedConfigs = JSON.parse(localStorage.getItem('mcp_servers') || '[]')
        savedConfigs.forEach((config: MCPServerConfig) => {
          this.installedServers.add(config.id)
        })
      }
    } catch (error) {
      console.warn('Failed to load installed servers:', error)
    }
  }

  /**
   * 私有方法：检查环境（轻量化）
   */
  private async checkEnvironment(): Promise<void> {
    try {
      // 使用超时控制，避免长时间阻塞
      const timeoutPromise = new Promise<any[]>((_, reject) => {
        setTimeout(() => reject(new Error('环境检查超时')), 2000) // 2秒超时
      })
      
      const checkPromise = mcpInstaller.checkEnvironment()
      this.environmentChecks = await Promise.race([checkPromise, timeoutPromise])
    } catch (error) {
      // 静默处理错误，提供默认值
      console.warn('环境检查失败，使用默认配置:', error.message)
      this.environmentChecks = []
    }
  }

  /**
   * 私有方法：加载外部服务器（轻量化）
   */
  private async loadExternalServers(): Promise<void> {
    try {
      // 使用超时控制，避免长时间阻塞
      const timeoutPromise = new Promise<MCPServerTemplate[]>((_, reject) => {
        setTimeout(() => reject(new Error('加载外部服务器超时')), 3000) // 3秒超时
      })
      
      const loadPromise = externalRegistryCache.get(
        'all-external-servers',
        fetchAllExternalServers
      )
      
      const externalServers = await Promise.race([loadPromise, timeoutPromise])
      
      if (externalServers.length > 0) {
        // 合并外部服务器，避免重复
        const existingIds = new Set(this.allServers.map(s => s.id))
        const newServers = externalServers.filter(s => !existingIds.has(s.id))
        
        this.allServers.push(...newServers)
        console.log(`✅ 加载 ${newServers.length} 个外部服务器`)
      }
      
      this.externalServersLoaded = true
    } catch (error) {
      // 静默处理错误，不影响主要功能
      console.warn('外部服务器加载失败，使用内置服务器:', error.message)
      this.externalServersLoaded = true
    }
  }

  /**
   * 私有方法：加载自定义服务器
   */
  private async loadCustomServers(): Promise<void> {
    try {
      const customServers = customServerManager.getCustomServers()
      
      if (customServers.length > 0) {
        // 合并自定义服务器，避免重复
        const existingIds = new Set(this.allServers.map(s => s.id))
        const newServers = customServers.filter(s => !existingIds.has(s.id))
        
        this.allServers.push(...newServers)
        console.log(`✅ 加载 ${newServers.length} 个自定义服务器`)
      }
    } catch (error) {
      console.warn('自定义服务器加载失败:', error)
    }
  }
}

// 单例实例
export const mcpMarketplace = new MCPServerMarketplace()