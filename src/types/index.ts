// 消息类型
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  metadata?: MessageMetadata
  timestamp: number
}

// 附件类型
export interface Attachment {
  name: string
  type: string
  size: number
  url?: string
  data?: ArrayBuffer
}

// 消息元数据
export interface MessageMetadata {
  type?: 'workflow' | 'config' | 'tool-call'
  workflow?: string
  toolCall?: ToolCall
  [key: string]: any
}

// 工具调用
export interface ToolCall {
  name: string
  args: Record<string, any>
  result?: any
}

// 对话类型
export interface Conversation {
  id: string
  title: string
  messages: Message[]
  model?: string
  createdAt: number
  updatedAt: number
}

// LLM 提供商配置
export interface LLMProviderConfig {
  type: 'ollama' | 'openrouter' | 'openai' | 'openai-compatible' | 'zhipu' | 'gemini'
  name: string
  apiKey?: string
  baseURL?: string
  defaultModel?: string
  customName?: string
  enabled: boolean
}

// 意图识别结果
export interface IntentResult {
  type: 'system_config' | 'llm_management' | 'knowledge_base' | 'workflow_creation' | 'mcp_management' | 'general_chat'
  confidence: number
  params: Record<string, any>
  explanation: string
}

// 应用设置
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN' | 'en-US'
  defaultModel: string
  autoSave: boolean
  shortcuts: Record<string, string>
}

// 工作流定义
export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  version: string
  triggers: WorkflowTrigger[]
  steps: WorkflowStep[]
  variables?: Record<string, any>
  createdAt: number
  updatedAt: number
}

// 工作流触发器
export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event'
  config: Record<string, any>
}

// 工作流步骤
export interface WorkflowStep {
  id: string
  name: string
  type: 'llm_call' | 'mcp_tool' | 'condition' | 'loop' | 'parallel'
  config: Record<string, any>
  next?: string | string[]
  errorHandling?: ErrorHandling
}

// 错误处理
export interface ErrorHandling {
  strategy: 'retry' | 'skip' | 'abort'
  maxRetries?: number
  fallback?: string
}

// MCP 服务器配置
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

// MCP 工具定义
export interface MCPTool {
  name: string
  description: string
  server: string
  inputSchema?: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

// MCP 工具调用
export interface MCPToolCall {
  tool: string
  parameters: Record<string, any>
  server: string
  requestId?: string
}

// MCP API 接口
export interface MCPAPI {
  addServer: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string }>
  startServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  stopServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  removeServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  getServers: () => Promise<{ success: boolean; data?: any[]; error?: string }>
  getTools: (serverId?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
  findTool: (name: string, serverId?: string) => Promise<{ success: boolean; data?: any; error?: string }>
  executeTool: (call: MCPToolCall) => Promise<{ success: boolean; data?: any; error?: string }>
  updateServer?: (serverId: string, config: MCPServerConfig) => Promise<{ success: boolean; error?: string }> // 可选方法
}

// 工具信息
export interface ToolInfo {
  name: string
  description: string
  parameters: Record<string, any>
  serverName: string
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 文件处理结果
export interface FileProcessResult {
  success: boolean
  fileName: string
  fileType: string
  content?: string
  error?: string
}

// 知识库文档
export interface Document {
  id: string
  title: string
  content: string
  type: 'pdf' | 'docx' | 'txt' | 'md'
  size: number
  uploadedAt: number
  vectorized: boolean
  chunks?: DocumentChunk[]
}

// 文档分块
export interface DocumentChunk {
  content: string
  index: number
  startIndex: number
  endIndex: number
}

// 搜索结果
export interface SearchResult {
  content: string
  metadata: Record<string, any>
  similarity: number
}

// 系统状态
export interface SystemStatus {
  ollama: {
    connected: boolean
    models: string[]
    currentModel?: string
  }
  mcp: {
    servers: Array<{
      name: string
      status: 'connected' | 'disconnected' | 'error'
      tools: number
    }>
  }
  knowledgeBase: {
    documents: number
    totalSize: number
  }
}