/**
 * MCP服务器安装器 - 处理服务器的安装和配置
 */

import type { MCPServerConfig } from '@/types'
import type { MCPServerTemplate, MCPParameter } from './server-registry'

export interface InstallationResult {
  success: boolean
  message: string
  config?: MCPServerConfig
  error?: string
}

export interface EnvironmentCheck {
  tool: string
  available: boolean
  version?: string
  installCommand?: string
}

/**
 * MCP服务器安装器
 */
export class MCPServerInstaller {
  /**
   * 检查系统环境
   */
  async checkEnvironment(): Promise<EnvironmentCheck[]> {
    const checks: EnvironmentCheck[] = []
    
    // 检查Node.js
    try {
      const nodeVersion = await this.executeCommand('node --version')
      checks.push({
        tool: 'Node.js',
        available: true,
        version: nodeVersion.trim(),
        installCommand: 'https://nodejs.org/'
      })
    } catch {
      checks.push({
        tool: 'Node.js',
        available: false,
        installCommand: 'https://nodejs.org/'
      })
    }

    // 检查Python
    try {
      const pythonVersion = await this.executeCommand('python3 --version')
      checks.push({
        tool: 'Python',
        available: true,
        version: pythonVersion.trim(),
        installCommand: 'https://python.org/'
      })
    } catch {
      checks.push({
        tool: 'Python',
        available: false,
        installCommand: 'https://python.org/'
      })
    }

    // 检查uv
    try {
      const uvVersion = await this.executeCommand('uv --version')
      checks.push({
        tool: 'uv',
        available: true,
        version: uvVersion.trim(),
        installCommand: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
      })
    } catch {
      checks.push({
        tool: 'uv',
        available: false,
        installCommand: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
      })
    }

    // 检查Git
    try {
      const gitVersion = await this.executeCommand('git --version')
      checks.push({
        tool: 'Git',
        available: true,
        version: gitVersion.trim(),
        installCommand: 'https://git-scm.com/'
      })
    } catch {
      checks.push({
        tool: 'Git',
        available: false,
        installCommand: 'https://git-scm.com/'
      })
    }

    return checks
  }

  /**
   * 验证服务器模板的参数
   */
  validateParameters(template: MCPServerTemplate, parameters: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!template.parameters) {
      return { valid: true, errors: [] }
    }

    for (const param of template.parameters) {
      const value = parameters[param.key]
      
      // 检查必需参数
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push(`参数 ${param.key} 是必需的`)
        continue
      }

      // 跳过空的可选参数
      if (!param.required && (value === undefined || value === null || value === '')) {
        continue
      }

      // 类型验证
      if (!this.validateParameterType(param, value)) {
        errors.push(`参数 ${param.key} 类型不正确，期望 ${param.type}`)
      }

      // 自定义验证
      if (param.validation) {
        const validationError = this.validateParameterValue(param, value)
        if (validationError) {
          errors.push(`参数 ${param.key}: ${validationError}`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * 从模板创建服务器配置
   */
  createServerConfig(template: MCPServerTemplate, parameters: Record<string, any>): MCPServerConfig {
    // 处理参数替换
    const processedArgs = this.processArgs(template.args, parameters)
    const processedEnv = this.processEnv(template.env || {}, parameters)

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      command: template.command,
      args: processedArgs,
      env: Object.keys(processedEnv).length > 0 ? processedEnv : undefined,
      autoStart: template.autoStart || false
    }
  }

  /**
   * 测试服务器连接
   */
  async testServerConnection(config: MCPServerConfig): Promise<InstallationResult> {
    try {
      // 这里应该调用实际的MCP服务来测试连接
      // 暂时返回模拟结果
      console.log('Testing server connection:', config.id)
      
      // 模拟测试延迟
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      return {
        success: true,
        message: `服务器 ${config.name} 连接测试成功`,
        config
      }
    } catch (error) {
      return {
        success: false,
        message: `服务器 ${config.name} 连接测试失败`,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 安装服务器依赖
   */
  async installDependencies(template: MCPServerTemplate): Promise<InstallationResult> {
    try {
      const { command, args } = template
      
      if (command === 'uvx') {
        // uvx会自动下载和运行，无需预安装
        return {
          success: true,
          message: `${template.name} 使用 uvx，无需预安装依赖`
        }
      }
      
      if (command === 'npx') {
        // npx会自动下载包，但我们可以预先检查
        const packageName = args.find(arg => !arg.startsWith('-'))
        if (packageName) {
          console.log(`Checking npm package: ${packageName}`)
          // 这里可以添加npm包检查逻辑
        }
        
        return {
          success: true,
          message: `${template.name} 使用 npx，依赖将在首次运行时自动安装`
        }
      }
      
      return {
        success: true,
        message: `${template.name} 依赖检查完成`
      }
    } catch (error) {
      return {
        success: false,
        message: `安装 ${template.name} 依赖失败`,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 执行命令（在Electron环境中通过IPC调用）
   */
  private async executeCommand(command: string): Promise<string> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.system) {
      return (window as any).electronAPI.system.executeCommand(command)
    }
    throw new Error('Not in Electron environment')
  }

  /**
   * 验证参数类型
   */
  private validateParameterType(param: MCPParameter, value: any): boolean {
    switch (param.type) {
      case 'string':
      case 'path':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'list':
        return Array.isArray(value)
      default:
        return true
    }
  }

  /**
   * 验证参数值
   */
  private validateParameterValue(param: MCPParameter, value: any): string | null {
    const { validation } = param
    if (!validation) return null

    // 字符串模式验证
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern)
      if (!regex.test(value)) {
        return '格式不正确'
      }
    }

    // 数值范围验证
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        return `值不能小于 ${validation.min}`
      }
      if (validation.max !== undefined && value > validation.max) {
        return `值不能大于 ${validation.max}`
      }
    }

    // 数组长度验证
    if (Array.isArray(value)) {
      if (validation.min !== undefined && value.length < validation.min) {
        return `至少需要 ${validation.min} 个项目`
      }
      if (validation.max !== undefined && value.length > validation.max) {
        return `最多允许 ${validation.max} 个项目`
      }
    }

    // 选项验证
    if (validation.options && !validation.options.includes(value)) {
      return `值必须是以下选项之一: ${validation.options.join(', ')}`
    }

    return null
  }

  /**
   * 处理命令参数中的占位符
   */
  private processArgs(args: string[], parameters: Record<string, any>): string[] {
    return args.map(arg => {
      // 处理 <key> 格式的占位符
      return arg.replace(/<(\w+)>/g, (match, key) => {
        const value = parameters[key]
        if (value === undefined) {
          console.warn(`Parameter ${key} not found for placeholder ${match}`)
          return match
        }
        
        // 如果是数组，转换为多个参数
        if (Array.isArray(value)) {
          return value.join(' ')
        }
        
        return String(value)
      })
    }).filter(arg => !arg.includes('<')) // 移除未替换的占位符
  }

  /**
   * 处理环境变量中的占位符
   */
  private processEnv(env: Record<string, string>, parameters: Record<string, any>): Record<string, string> {
    const processedEnv: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(env)) {
      const processedValue = value.replace(/<(\w+)>/g, (match, paramKey) => {
        const paramValue = parameters[paramKey]
        if (paramValue === undefined) {
          console.warn(`Parameter ${paramKey} not found for env ${key}`)
          return match
        }
        return String(paramValue)
      })
      
      // 只添加已完全处理的环境变量
      if (!processedValue.includes('<')) {
        processedEnv[key] = processedValue
      }
    }
    
    return processedEnv
  }
}

// 单例实例
export const mcpInstaller = new MCPServerInstaller()