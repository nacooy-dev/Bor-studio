/**
 * MCP核心类型定义
 * 基于5ire项目的MCP实现
 */

// MCP服务器配置
export interface MCPServerConfig {
  id: string
  name: string
  description?: string
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
  autoStart?: boolean
}

// MCP服务器状态
export interface MCPServer {
  id: string
  name: string
  config: MCPServerConfig
  status: 'stopped' | 'starting' | 'running' | 'error'
  pid?: number
  startTime?: Date
  lastError?: string
}

// MCP工具定义
export interface MCPTool {
  name: string
  description: string
  server: string
  schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
  examples?: string[]
  category?: string
  riskLevel?: 'low' | 'medium' | 'high'
}

// MCP工具调用
export interface MCPToolCall {
  tool: string
  parameters: Record<string, any>
  server: string
  requestId?: string
}

// MCP工具执行结果
export interface MCPToolResult {
  success: boolean
  data?: any
  error?: string
  executionTime?: number
  requestId?: string
}

// MCP协议消息
export interface MCPMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

// MCP服务器能力
export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean
  }
  resources?: {
    subscribe?: boolean
    listChanged?: boolean
  }
  prompts?: {
    listChanged?: boolean
  }
  logging?: {}
}

// MCP初始化信息
export interface MCPInitialize {
  protocolVersion: string
  capabilities: MCPCapabilities
  clientInfo: {
    name: string
    version: string
  }
}

// MCP工具上下文（用于智能学习）
export interface MCPToolContext {
  tool: MCPTool
  naturalLanguageTriggers: string[]
  usageExamples: string[]
  parameterDescriptions: Record<string, string>
  lastUsed?: Date
  usageCount: number
}

// MCP管理器事件
export type MCPManagerEvent = 
  | { type: 'server_started'; server: MCPServer }
  | { type: 'server_stopped'; server: MCPServer }
  | { type: 'server_error'; server: MCPServer; error: string }
  | { type: 'tool_discovered'; tool: MCPTool }
  | { type: 'tool_executed'; call: MCPToolCall; result: MCPToolResult }

// MCP管理器配置
export interface MCPManagerConfig {
  maxConcurrentServers?: number
  toolExecutionTimeout?: number
  serverStartTimeout?: number
  enableLogging?: boolean
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

// 导出所有类型
export * from './types'