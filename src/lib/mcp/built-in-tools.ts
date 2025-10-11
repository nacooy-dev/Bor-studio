/**
 * 内置MCP工具 - 不依赖外部进程
 * 用于打包环境中提供基础MCP功能
 */

export interface BuiltInTool {
  name: string
  description: string
  schema: any
  execute: (parameters: any) => Promise<any>
}

/**
 * 简单的记忆工具
 */
export const memoryTool: BuiltInTool = {
  name: 'remember',
  description: '记住重要信息',
  schema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: '记忆的键名' },
      value: { type: 'string', description: '要记住的内容' }
    },
    required: ['key', 'value']
  },
  execute: async (params) => {
    // 使用localStorage存储
    if (typeof window !== 'undefined') {
      const memories = JSON.parse(localStorage.getItem('mcp_memories') || '{}')
      memories[params.key] = {
        value: params.value,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem('mcp_memories', JSON.stringify(memories))
      return { success: true, message: `已记住: ${params.key}` }
    }
    return { success: false, message: '存储不可用' }
  }
}

/**
 * 简单的回忆工具
 */
export const recallTool: BuiltInTool = {
  name: 'recall',
  description: '回忆之前记住的信息',
  schema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: '要回忆的键名' }
    },
    required: ['key']
  },
  execute: async (params) => {
    if (typeof window !== 'undefined') {
      const memories = JSON.parse(localStorage.getItem('mcp_memories') || '{}')
      const memory = memories[params.key]
      if (memory) {
        return { 
          success: true, 
          content: memory.value,
          timestamp: memory.timestamp
        }
      }
      return { success: false, message: `没有找到记忆: ${params.key}` }
    }
    return { success: false, message: '存储不可用' }
  }
}

/**
 * 简单的计算工具
 */
export const calculatorTool: BuiltInTool = {
  name: 'calculate',
  description: '执行简单的数学计算',
  schema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: '数学表达式，如 "2 + 3 * 4"' }
    },
    required: ['expression']
  },
  execute: async (params) => {
    try {
      // 简单的安全计算（只允许基本数学运算）
      const sanitized = params.expression.replace(/[^0-9+\-*/().\s]/g, '')
      if (sanitized !== params.expression) {
        return { success: false, message: '表达式包含不允许的字符' }
      }
      
      const result = Function(`"use strict"; return (${sanitized})`)()
      return { 
        success: true, 
        result: result,
        expression: params.expression
      }
    } catch (error) {
      return { 
        success: false, 
        message: `计算错误: ${error instanceof Error ? error.message : '未知错误'}` 
      }
    }
  }
}

/**
 * 获取当前时间工具
 */
export const timeTool: BuiltInTool = {
  name: 'get_time',
  description: '获取当前时间和日期',
  schema: {
    type: 'object',
    properties: {
      format: { 
        type: 'string', 
        description: '时间格式: "iso", "local", "timestamp"',
        default: 'local'
      }
    }
  },
  execute: async (params) => {
    const now = new Date()
    const format = params.format || 'local'
    
    let timeString: string
    switch (format) {
      case 'iso':
        timeString = now.toISOString()
        break
      case 'timestamp':
        timeString = now.getTime().toString()
        break
      default:
        timeString = now.toLocaleString()
    }
    
    return {
      success: true,
      time: timeString,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }
}

/**
 * 所有内置工具
 */
export const builtInTools: BuiltInTool[] = [
  memoryTool,
  recallTool,
  calculatorTool,
  timeTool
]

/**
 * 内置MCP服务器模拟器
 */
export class BuiltInMCPServer {
  private tools: Map<string, BuiltInTool> = new Map()
  
  constructor() {
    builtInTools.forEach(tool => {
      this.tools.set(tool.name, tool)
    })
  }
  
  /**
   * 获取所有工具
   */
  getTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
      server: 'built-in'
    }))
  }
  
  /**
   * 执行工具
   */
  async executeTool(name: string, parameters: any) {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`工具 ${name} 不存在`)
    }
    
    return await tool.execute(parameters)
  }
  
  /**
   * 查找工具
   */
  findTool(name: string) {
    const tool = this.tools.get(name)
    return tool ? {
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
      server: 'built-in'
    } : null
  }
}