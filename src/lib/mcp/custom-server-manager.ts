/**
 * 自定义MCP服务器管理器
 * 管理用户添加的自定义服务器
 */

import type { MCPServerTemplate } from './server-registry'

export interface CustomServerRecord {
  id: string
  server: MCPServerTemplate
  addedAt: string
  source: string
  verified: boolean
  lastUsed?: string
}

/**
 * 自定义服务器管理器
 */
export class CustomServerManager {
  private readonly STORAGE_KEY = 'mcp_custom_servers'
  private customServers: Map<string, CustomServerRecord> = new Map()
  private initialized = false

  constructor() {
    // 不在构造函数中初始化，等待应用准备就绪
  }

  /**
   * 初始化自定义服务器管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // 尝试从 Electron 数据库加载自定义服务器
      const stored = await this.loadFromDatabase()
      if (stored && Array.isArray(stored)) {
        stored.forEach((record: CustomServerRecord) => {
          this.customServers.set(record.id, record)
        })
        console.log(`✅ 从数据库加载了 ${this.customServers.size} 个自定义服务器`)
      } else {
        // 如果数据库中没有，则尝试从 localStorage 加载（兼容旧版本）
        this.loadFromLocalStorage()
      }
    } catch (error) {
      console.warn('⚠️ 加载自定义服务器失败，尝试从 localStorage 加载:', error)
      try {
        this.loadFromLocalStorage()
      } catch (localStorageError) {
        console.warn('⚠️ 从 localStorage 加载自定义服务器也失败:', localStorageError)
      }
    }
    
    this.initialized = true
  }

  /**
   * 从 Electron 数据库加载自定义服务器
   */
  private async loadFromDatabase(): Promise<CustomServerRecord[] | null> {
    try {
      // 在 Electron 环境中，通过 IPC 调用获取配置
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const result = await (window as any).electronAPI.getConfig(this.STORAGE_KEY, null)
        if (result) {
          return JSON.parse(result)
        }
      }
      return null
    } catch (error) {
      console.warn('从数据库加载自定义服务器失败:', error)
      return null
    }
  }

  /**
   * 从 localStorage 加载自定义服务器（兼容旧版本）
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data && Array.isArray(data)) {
          data.forEach((record: CustomServerRecord) => {
            this.customServers.set(record.id, record)
          })
          console.log(`✅ 从 localStorage 加载了 ${this.customServers.size} 个自定义服务器`)
        }
      }
    } catch (error) {
      console.warn('⚠️ 从 localStorage 加载自定义服务器失败:', error)
    }
  }

  /**
   * 添加自定义服务器
   */
  async addCustomServer(server: MCPServerTemplate, source: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查是否已存在
      if (this.customServers.has(server.id)) {
        return {
          success: false,
          error: '服务器ID已存在，请使用不同的ID'
        }
      }

      // 验证服务器配置
      const validation = this.validateServerConfig(server)
      if (!validation.valid) {
        return {
          success: false,
          error: `服务器配置无效: ${validation.errors.join(', ')}`
        }
      }

      // 创建记录
      const record: CustomServerRecord = {
        id: server.id,
        server: { ...server },
        addedAt: new Date().toISOString(),
        source,
        verified: false
      }

      // 保存到内存和存储
      this.customServers.set(server.id, record)
      await this.saveCustomServers()

      console.log('✅ 自定义服务器已添加:', server.name)
      return { success: true }
    } catch (error) {
      console.error('❌ 添加自定义服务器失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '添加失败'
      }
    }
  }

  /**
   * 更新自定义服务器
   */
  async updateCustomServer(id: string, updates: Partial<MCPServerTemplate>): Promise<{ success: boolean; error?: string }> {
    try {
      const record = this.customServers.get(id)
      if (!record) {
        return {
          success: false,
          error: '服务器不存在'
        }
      }

      // 更新服务器配置
      const updatedServer = { ...record.server, ...updates }
      
      // 验证更新后的配置
      const validation = this.validateServerConfig(updatedServer)
      if (!validation.valid) {
        return {
          success: false,
          error: `更新后的配置无效: ${validation.errors.join(', ')}`
        }
      }

      // 保存更新
      record.server = updatedServer
      record.lastUsed = new Date().toISOString()
      
      await this.saveCustomServers()

      console.log('✅ 自定义服务器已更新:', updatedServer.name)
      return { success: true }
    } catch (error) {
      console.error('❌ 更新自定义服务器失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新失败'
      }
    }
  }

  /**
   * 删除自定义服务器
   */
  async removeCustomServer(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.customServers.has(id)) {
        return {
          success: false,
          error: '服务器不存在'
        }
      }

      this.customServers.delete(id)
      await this.saveCustomServers()

      console.log('✅ 自定义服务器已删除:', id)
      return { success: true }
    } catch (error) {
      console.error('❌ 删除自定义服务器失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败'
      }
    }
  }

  /**
   * 获取所有自定义服务器
   */
  getCustomServers(): MCPServerTemplate[] {
    return Array.from(this.customServers.values()).map(record => record.server)
  }

  /**
   * 获取自定义服务器记录
   */
  getCustomServerRecord(id: string): CustomServerRecord | undefined {
    return this.customServers.get(id)
  }

  /**
   * 获取自定义服务器统计
   */
  getStats(): {
    total: number
    verified: number
    recentlyAdded: number
    recentlyUsed: number
  } {
    const records = Array.from(this.customServers.values())
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    return {
      total: records.length,
      verified: records.filter(r => r.verified).length,
      recentlyAdded: records.filter(r => new Date(r.addedAt) > weekAgo).length,
      recentlyUsed: records.filter(r => r.lastUsed && new Date(r.lastUsed) > weekAgo).length
    }
  }

  /**
   * 标记服务器为已验证
   */
  async markAsVerified(id: string): Promise<void> {
    const record = this.customServers.get(id)
    if (record) {
      record.verified = true
      await this.saveCustomServers()
    }
  }

  /**
   * 更新最后使用时间
   */
  async updateLastUsed(id: string): Promise<void> {
    const record = this.customServers.get(id)
    if (record) {
      record.lastUsed = new Date().toISOString()
      await this.saveCustomServers()
    }
  }

  /**
   * 导出自定义服务器
   */
  exportCustomServers(): string {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      servers: Array.from(this.customServers.values())
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * 导入自定义服务器
   */
  async importCustomServers(jsonData: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const data = JSON.parse(jsonData)
      const errors: string[] = []
      let imported = 0

      if (!data.servers || !Array.isArray(data.servers)) {
        return {
          success: false,
          imported: 0,
          errors: ['无效的导入数据格式']
        }
      }

      for (const record of data.servers) {
        try {
          if (this.customServers.has(record.id)) {
            errors.push(`服务器 ${record.id} 已存在，跳过`)
            continue
          }

          const validation = this.validateServerConfig(record.server)
          if (!validation.valid) {
            errors.push(`服务器 ${record.id} 配置无效: ${validation.errors.join(', ')}`)
            continue
          }

          this.customServers.set(record.id, record)
          imported++
        } catch (error) {
          errors.push(`导入服务器 ${record.id} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
        }
      }

      if (imported > 0) {
        await this.saveCustomServers()
      }

      return {
        success: imported > 0,
        imported,
        errors
      }
    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`解析导入数据失败: ${error instanceof Error ? error.message : '未知错误'}`]
      }
    }
  }

  /**
   * 验证服务器配置
   */
  private validateServerConfig(server: MCPServerTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!server.id || server.id.trim() === '') {
      errors.push('服务器ID不能为空')
    }

    if (!server.name || server.name.trim() === '') {
      errors.push('服务器名称不能为空')
    }

    if (!server.command || server.command.trim() === '') {
      errors.push('启动命令不能为空')
    }

    if (!server.args || !Array.isArray(server.args)) {
      errors.push('命令参数必须是数组')
    }

    if (!server.category || server.category.trim() === '') {
      errors.push('服务器类别不能为空')
    }

    // 验证ID格式
    if (server.id && !/^[a-z0-9-_]+$/.test(server.id)) {
      errors.push('服务器ID只能包含小写字母、数字、连字符和下划线')
    }

    // 验证参数
    if (server.parameters) {
      server.parameters.forEach((param, index) => {
        if (!param.key || param.key.trim() === '') {
          errors.push(`参数 ${index + 1} 的key不能为空`)
        }
        if (!param.type) {
          errors.push(`参数 ${index + 1} 的type不能为空`)
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 保存自定义服务器到 Electron 数据库
   */
  private async saveCustomServers(): Promise<void> {
    try {
      const data = Array.from(this.customServers.values())
      
      // 在 Electron 环境中，通过 IPC 调用保存配置
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        await (window as any).electronAPI.setConfig(this.STORAGE_KEY, JSON.stringify(data), 'mcp')
      } else {
        // 在非 Electron 环境中（如开发环境），使用 localStorage
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
      }
    } catch (error) {
      console.error('❌ 保存自定义服务器失败:', error)
      throw error
    }
  }

  /**
   * 清除所有自定义服务器
   */
  async clearAllCustomServers(): Promise<void> {
    this.customServers.clear()
    
    // 在 Electron 环境中，通过 IPC 调用删除配置
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await (window as any).electronAPI.deleteConfig(this.STORAGE_KEY)
    } else {
      // 在非 Electron 环境中（如开发环境），使用 localStorage
      localStorage.removeItem(this.STORAGE_KEY)
    }
    
    console.log('✅ 已清除所有自定义服务器')
  }
}

// 单例实例
export const customServerManager = new CustomServerManager()
