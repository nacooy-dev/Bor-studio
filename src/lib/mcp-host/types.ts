/**
 * MCP Host 类型定义
 */

export interface MCPServerConfig {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
  autoStart?: boolean
}

export interface MCPTool {
  name: string
  description: string
  schema: any
  server: string
}

export interface MCPToolCall {
  tool: string
  parameters: Record<string, any>
  server: string
}

export interface MCPMessage {
  jsonrpc: '2.0'
  id?: number | string
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export interface MCPCapabilities {
  tools?: any
  resources?: any
  prompts?: any
}

export interface MCPServerInstance {
  id: string
  config: MCPServerConfig
  process: any // ChildProcess | null，但为了避免Node.js类型依赖，使用any
  status: 'stopped' | 'starting' | 'running' | 'error'
  capabilities: MCPCapabilities
  tools: MCPTool[]
  lastError?: string
  pid?: number
  startTime?: Date
  messageBuffer?: string // 用于累积接收到的消息数据
}