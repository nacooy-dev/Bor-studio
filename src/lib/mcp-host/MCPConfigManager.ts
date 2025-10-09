/**
 * MCP 配置管理器
 * 支持标准 MCP 配置格式和自定义配置
 */

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { MCPServerConfig } from './types'

export interface StandardMCPServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  disabled?: boolean
}

export interface StandardMCPConfig {
  mcpServers: Record<string, StandardMCPServerConfig>
}

export class MCPConfigManager {
  private configPath: string
  private standardConfigPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.configPath = join(userDataPath, 'mcp-config.json')
    this.standardConfigPath = join(userDataPath, 'mcp.json')
  }

  /**
   * 获取预设服务器配置
   */
  getPresetServers(): MCPServerConfig[] {
    const defaultPresets: MCPServerConfig[] = [
      {
        id: 'obsidian',
        name: 'Obsidian',
        description: 'Obsidian 笔记管理工具 - 创建、读取、搜索和管理 Markdown 笔记',
        command: 'uvx',
        args: ['obsidian-mcp'],
        env: {
          OBSIDIAN_VAULT_PATH: this.getObsidianVaultPath()
        },
        autoStart: false
      },
      {
        id: 'duckduckgo-search',
        name: 'DuckDuckGo Search',
        description: '网络搜索工具 - 使用DuckDuckGo搜索引擎，包含搜索和网页内容获取功能',
        command: 'uvx',
        args: ['duckduckgo-mcp-server'],
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
        args: ['-y', '@modelcontextprotocol/server-filesystem', process.env.HOME || '/Users/lvyun'],
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

    // 尝试从配置文件加载
    try {
      if (existsSync(this.configPath)) {
        const config = JSON.parse(readFileSync(this.configPath, 'utf-8'))
        return [...defaultPresets, ...(config.presets || [])]
      }
    } catch (error) {
      console.error('加载配置文件失败:', error)
    }

    return defaultPresets
  }

  /**
   * 从标准 MCP 配置导入
   */
  importFromStandardConfig(configPath?: string): MCPServerConfig[] {
    const path = configPath || this.standardConfigPath
    
    if (!existsSync(path)) {
      return []
    }

    try {
      const config: StandardMCPConfig = JSON.parse(readFileSync(path, 'utf-8'))
      const imported: MCPServerConfig[] = []

      for (const [id, serverConfig] of Object.entries(config.mcpServers)) {
        if (serverConfig.disabled) {
          continue
        }

        imported.push({
          id,
          name: this.generateNameFromId(id),
          description: `从标准 MCP 配置导入: ${id}`,
          command: serverConfig.command,
          args: serverConfig.args,
          env: serverConfig.env,
          autoStart: false
        })
      }

      console.log(`✅ 从标准配置导入 ${imported.length} 个服务器`)
      return imported
    } catch (error) {
      console.error('导入标准配置失败:', error)
      return []
    }
  }

  /**
   * 导出到标准 MCP 配置格式
   */
  exportToStandardConfig(servers: MCPServerConfig[], outputPath?: string): void {
    const path = outputPath || this.standardConfigPath
    
    const config: StandardMCPConfig = {
      mcpServers: {}
    }

    for (const server of servers) {
      config.mcpServers[server.id] = {
        command: server.command,
        args: server.args,
        env: server.env,
        disabled: false
      }
    }

    try {
      writeFileSync(path, JSON.stringify(config, null, 2))
      console.log(`✅ 导出配置到: ${path}`)
    } catch (error) {
      console.error('导出配置失败:', error)
      throw error
    }
  }

  /**
   * 保存自定义预设
   */
  savePresets(presets: MCPServerConfig[]): void {
    try {
      const config = {
        presets,
        updatedAt: new Date().toISOString()
      }
      writeFileSync(this.configPath, JSON.stringify(config, null, 2))
      console.log('✅ 预设配置已保存')
    } catch (error) {
      console.error('保存预设失败:', error)
      throw error
    }
  }

  /**
   * 添加预设
   */
  addPreset(preset: MCPServerConfig): void {
    const presets = this.getPresetServers()
    const existingIndex = presets.findIndex(p => p.id === preset.id)
    
    if (existingIndex >= 0) {
      presets[existingIndex] = preset
    } else {
      presets.push(preset)
    }
    
    this.savePresets(presets)
  }

  /**
   * 删除预设
   */
  removePreset(id: string): void {
    const presets = this.getPresetServers()
    const filtered = presets.filter(p => p.id !== id)
    this.savePresets(filtered)
  }

  /**
   * 获取 Obsidian Vault 路径
   */
  private getObsidianVaultPath(): string {
    // 尝试自动检测 Obsidian vault 路径
    const possiblePaths = [
      '/Users/lvyun/Nextcloud2/奈山堂语2',
      '/Users/lvyun/Documents/Obsidian Vault',
      '/Users/lvyun/obsidian',
      process.env.OBSIDIAN_VAULT_PATH
    ].filter(Boolean)

    for (const path of possiblePaths) {
      if (path && existsSync(path)) {
        return path
      }
    }

    return '/Users/lvyun/Documents/Obsidian Vault' // 默认路径
  }

  /**
   * 从 ID 生成友好的名称
   */
  private generateNameFromId(id: string): string {
    return id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
}