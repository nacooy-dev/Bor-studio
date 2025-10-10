## 🚀 详细技术实现

### Web应用核心 (apps/web)

#### 主应用入口
```vue
<!-- src/App.vue -->
<template>
  <div class="bor-app" :class="{ 'desktop-mode': isDesktop }">
    <!-- Apple风格布局 - 基于Chatbot UI的定制化界面 -->
    <BorSidebar />
    <main class="main-content">
      <router-view />
    </main>
    <BorStatusBar />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const isDesktop = computed(() => appStore.platform === 'desktop')
</script>

<style>
.bor-app {
  @apply h-screen flex bg-white/80 backdrop-blur-xl;
}

.desktop-mode {
  @apply rounded-xl border border-gray-200/50;
}
</style>
```

#### 聊天界面集成 - 基于Chatbot UI实现标准化对话交互
```vue
<!-- src/views/ChatView.vue -->
<template>
  <div class="chat-view">
    <!-- 集成Chatbot UI实现标准化对话交互 -->
    <ChatInterface
      :messages="messages"
      :streaming="isStreaming"
      :theme="appleTheme"
      @send="handleSendMessage"
      @tool-call="handleToolCall"
    />
    
    <!-- 个性化定制界面 -->
    <BorCustomPanel />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChatInterface } from 'chatbot-ui-vue'
import { useMCPClient } from '@/composables/mcp'
import { useLLMChat } from '@/composables/llm'
import { useWorkflowEngine } from '@/composables/workflow'

const messages = ref([])
const isStreaming = ref(false)
const mcpClient = useMCPClient()
const llmChat = useLLMChat()
const workflowEngine = useWorkflowEngine()

// 基于Chatbot UI的Apple风格主题定制
const appleTheme = {
  colors: {
    primary: '#007AFF',
    background: 'rgba(255, 255, 255, 0.8)',
    surface: 'rgba(248, 248, 248, 0.9)'
  },
  effects: {
    blur: 'blur(20px)',
    radius: '12px'
  }
}

// 标准化消息处理流程
const handleSendMessage = async (content: string) => {
  isStreaming.value = true
  try {
    // 通过LLMChat管理的多LLM服务处理消息
    const response = await llmChat.sendMessage(content)
    messages.value.push(response)
  } finally {
    isStreaming.value = false
  }
}

// 标准化工具调用流程
const handleToolCall = async (toolName: string, args: any) => {
  // 通过MCP客户端调用工具（基于Claude Desktop MCP标准）
  return await mcpClient.callTool(toolName, args)
}

// 工作流自动化执行 - 通过对话交互实现自动化脚本调度
const handleWorkflowExecution = async (workflowDefinition: string) => {
  // 通过工作流引擎自动生成并执行脚本
  return await workflowEngine.executeWorkflow(workflowDefinition)
}
</script>
```

#### MCP客户端实现 - 基于Claude Desktop MCP标准
```typescript
// src/composables/mcp.ts
import { ref, reactive } from 'vue'

interface MCPServer {
  name: string
  status: 'connected' | 'disconnected' | 'error'
  tools: MCPTool[]
}

export function useMCPClient() {
  const servers = ref<MCPServer[]>([])
  const isConnecting = ref(false)
  
  // 连接MCP服务器（遵循Claude Desktop MCP标准）
  const connectServer = async (serverConfig: ServerConfig) => {
    isConnecting.value = true
    try {
      // 通过WebSocket连接到后端MCP代理
      const ws = new WebSocket(`ws://localhost:3001/mcp/${serverConfig.name}`)
      
      ws.onopen = () => {
        servers.value.push({
          name: serverConfig.name,
          status: 'connected',
          tools: []
        })
      }
      
      // 获取可用工具（遵循MCP标准协议）
      const tools = await fetch(`/api/mcp/${serverConfig.name}/tools`).then(r => r.json())
      const server = servers.value.find(s => s.name === serverConfig.name)
      if (server) {
        server.tools = tools
      }
    } catch (error) {
      console.error('MCP connection failed:', error)
    } finally {
      isConnecting.value = false
    }
  }
  
  // 调用工具（遵循MCP标准协议）
  const callTool = async (serverName: string, toolName: string, args: any) => {
    const response = await fetch('/api/mcp/call-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName, toolName, args })
    })
    return response.json()
  }
  
  return {
    servers: readonly(servers),
    isConnecting: readonly(isConnecting),
    connectServer,
    callTool
  }
}
```

### 后端API服务 (apps/server)

#### 主服务器
```typescript
// src/app.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { MCPManager } from './services/mcp-manager'
import { LLMService } from './services/llm-service'
import { WorkflowService } from './services/workflow-service'

const fastify = Fastify({ logger: true })

// 注册插件
await fastify.register(cors, { origin: true })
await fastify.register(websocket)

// 初始化服务
const mcpManager = new MCPManager()  // 基于Claude Desktop MCP标准实现
const llmService = new LLMService()  // 集成LLMChat实现多LLM管理
const workflowService = new WorkflowService()  // 工作流自动化脚本调度

// API路由
fastify.post('/api/chat', async (request, reply) => {
  const { message, model } = request.body as any
  // 通过LLMChat管理的多LLM服务处理聊天请求
  const response = await llmService.chat(message, model)
  return response
})

fastify.post('/api/mcp/call-tool', async (request, reply) => {
  const { serverName, toolName, args } = request.body as any
  // 通过MCP管理器调用工具（基于Claude Desktop MCP标准）
  const result = await mcpManager.callTool(serverName, toolName, args)
  return result
})

fastify.post('/api/workflow/execute', async (request, reply) => {
  const { workflowDefinition } = request.body as any
  // 通过工作流服务自动生成并执行脚本
  const result = await workflowService.executeWorkflow(workflowDefinition)
  return result
})

// WebSocket for real-time communication
fastify.register(async function (fastify) {
  fastify.get('/ws/chat', { websocket: true }, (connection, req) => {
    connection.socket.on('message', async (message) => {
      const data = JSON.parse(message.toString())
      
      if (data.type === 'chat') {
        // 通过LLMChat管理的多LLM服务处理流式聊天请求
        const response = await llmService.streamChat(data.content)
        connection.socket.send(JSON.stringify({ type: 'response', data: response }))
      }
      
      if (data.type === 'workflow') {
        // 通过工作流服务处理自动化脚本调度
        const result = await workflowService.executeWorkflow(data.workflowDefinition)
        connection.socket.send(JSON.stringify({ type: 'workflow-result', data: result }))
      }
    })
  })
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 Server running on http://localhost:3000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
```

#### MCP管理服务 - 基于Claude Desktop MCP标准实现
```typescript
// src/services/mcp-manager.ts
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

// MCP服务器进程（遵循Claude Desktop MCP标准）
interface MCPServerProcess {
  name: string
  process: ChildProcess
  status: 'running' | 'stopped' | 'error'
  tools: any[]
}

export class MCPManager extends EventEmitter {
  private servers = new Map<string, MCPServerProcess>()
  
  // 启动MCP服务器（遵循Claude Desktop MCP标准）
  async startServer(config: ServerConfig): Promise<void> {
    const process = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    const serverProcess: MCPServerProcess = {
      name: config.name,
      process,
      status: 'running',
      tools: []
    }
    
    // 处理MCP协议通信（遵循Claude Desktop MCP标准）
    process.stdout.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString())
        this.handleMCPMessage(config.name, message)
      } catch (error) {
        console.error('Failed to parse MCP message:', error)
      }
    })
    
    process.on('exit', (code) => {
      serverProcess.status = code === 0 ? 'stopped' : 'error'
      this.emit('server-exit', config.name, code)
    })
    
    this.servers.set(config.name, serverProcess)
    
    // 初始化：获取可用工具（遵循MCP标准协议）
    await this.discoverTools(config.name)
  }
  
  // 调用工具（遵循Claude Desktop MCP标准）
  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const server = this.servers.get(serverName)
    if (!server || server.status !== 'running') {
      throw new Error(`Server ${serverName} is not available`)
    }
    
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tool call timeout'))
      }, 30000)
      
      const handleResponse = (data: any) => {
        if (data.id === request.id) {
          clearTimeout(timeout)
          if (data.error) {
            reject(new Error(data.error.message))
          } else {
            resolve(data.result)
          }
        }
      }
      
      server.process.stdout.once('data', (data) => {
        try {
          const response = JSON.parse(data.toString())
          handleResponse(response)
        } catch (error) {
          reject(error)
        }
      })
      
      server.process.stdin.write(JSON.stringify(request) + '\n')
    })
  }
  
  // 发现工具（遵循MCP标准协议）
  private async discoverTools(serverName: string): Promise<void> {
    // 发送工具发现请求（遵循MCP标准协议）
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list'
    }
    
    const server = this.servers.get(serverName)
    if (server) {
      server.process.stdin.write(JSON.stringify(request) + '\n')
    }
  }
  
  // 处理MCP消息（遵循Claude Desktop MCP标准）
  private handleMCPMessage(serverName: string, message: any): void {
    const server = this.servers.get(serverName)
    if (!server) return
    
    if (message.method === 'tools/list' && message.result) {
      server.tools = message.result.tools
      this.emit('tools-updated', serverName, server.tools)
    }
  }
}
```

#### LLM服务 - 集成LLMChat实现多LLM管理
```typescript
// src/services/llm-service.ts
import { LLMChat } from 'llmchat-core'

interface LLMConfig {
  providers: {
    openai: {
      apiKey: string
      enabled: boolean
    }
    anthropic: {
      apiKey: string
      enabled: boolean
    }
    local: {
      apiUrl: string
      enabled: boolean
    }
  }
  rag: {
    enabled: boolean
    vectorStore: 'chroma' | 'pinecone' | 'local'
  }
}

export class LLMService {
  private llmChat: LLMChat
  private config: LLMConfig
  
  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || '',
          enabled: true
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || '',
          enabled: true
        },
        local: {
          apiUrl: 'http://localhost:11434',
          enabled: true
        }
      },
      rag: {
        enabled: true,
        vectorStore: 'local'
      },
      ...config
    }
    
    // 集成LLMChat实现多LLM管理
    this.llmChat = new LLMChat({
      providers: this.getEnabledProviders(),
      rag: this.config.rag
    })
  }
  
  /**
   * 聊天功能 - 通过LLMChat管理多LLM服务
   * 集成开源项目: LLMChat (https://github.com/llmchat/llmchat)
   */
  async chat(message: string, model?: string): Promise<any> {
    // 利用LLMChat的多模型管理和RAG功能
    return await this.llmChat.chat(message, { model })
  }
  
  /**
   * 流式聊天功能 - 通过LLMChat管理多LLM服务
   */
  async streamChat(message: string): Promise<any> {
    // 利用LLMChat的流式处理能力
    return await this.llmChat.streamChat(message)
  }
  
  private getEnabledProviders() {
    const providers: any = {}
    
    if (this.config.providers.openai.enabled) {
      providers.openai = {
        apiKey: this.config.providers.openai.apiKey
      }
    }
    
    if (this.config.providers.anthropic.enabled) {
      providers.anthropic = {
        apiKey: this.config.providers.anthropic.apiKey
      }
    }
    
    if (this.config.providers.local.enabled) {
      providers.local = {
        apiUrl: this.config.providers.local.apiUrl
      }
    }
    
    return providers
  }
}
```

#### 工作流服务 - 自动化脚本调度引擎
```typescript
// src/services/workflow-service.ts
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

interface WorkflowConfig {
  scriptDir: string
  timeout: number
}

export class WorkflowService {
  private config: WorkflowConfig
  
  constructor(config?: Partial<WorkflowConfig>) {
    this.config = {
      scriptDir: './scripts',
      timeout: 30000,
      ...config
    }
    
    // 确保脚本目录存在
    if (!fs.existsSync(this.config.scriptDir)) {
      fs.mkdirSync(this.config.scriptDir, { recursive: true })
    }
  }
  
  /**
   * 执行工作流 - 自动生成并执行脚本
   * 通过YAML/JSON工作流定义自动生成脚本并执行
   */
  async executeWorkflow(workflowDefinition: string): Promise<any> {
    try {
      // 解析工作流定义（YAML或JSON格式）
      const workflow = this.parseWorkflowDefinition(workflowDefinition)
      
      // 生成执行脚本
      const scriptPath = await this.generateScript(workflow)
      
      // 执行脚本
      const result = await this.executeScript(scriptPath)
      
      // 清理临时脚本文件
      this.cleanupScript(scriptPath)
      
      return result
    } catch (error) {
      console.error('Workflow execution failed:', error)
      throw new Error(`Workflow execution failed: ${error.message}`)
    }
  }
  
  /**
   * 解析工作流定义
   */
  private parseWorkflowDefinition(definition: string): any {
    try {
      // 尝试解析JSON格式
      return JSON.parse(definition)
    } catch (jsonError) {
      try {
        // 尝试解析YAML格式
        const yaml = require('js-yaml')
        return yaml.load(definition)
      } catch (yamlError) {
        throw new Error('Invalid workflow definition format. Must be valid JSON or YAML.')
      }
    }
  }
  
  /**
   * 生成执行脚本
   */
  private async generateScript(workflow: any): Promise<string> {
    // 根据工作流定义生成相应的脚本
    let scriptContent = ''
    
    if (workflow.steps) {
      // 生成Shell脚本
      scriptContent = '#!/bin/bash\nset -e\n\n'
      
      for (const step of workflow.steps) {
        if (step.command) {
          scriptContent += `${step.command}\n`
        } else if (step.script) {
          scriptContent += `${step.script}\n`
        }
      }
    }
    
    // 将脚本写入临时文件
    const scriptName = `workflow_${Date.now()}.sh`
    const scriptPath = path.join(this.config.scriptDir, scriptName)
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 })
    
    return scriptPath
  }
  
  /**
   * 执行脚本
   */
  private executeScript(scriptPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Script execution timeout'))
      }, this.config.timeout)
      
      const process = spawn(scriptPath, [], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let output = ''
      let errorOutput = ''
      
      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })
      
      process.on('close', (code) => {
        clearTimeout(timeout)
        
        if (code === 0) {
          resolve({
            success: true,
            output,
            exitCode: code
          })
        } else {
          reject(new Error(`Script failed with exit code ${code}: ${errorOutput}`))
        }
      })
      
      process.on('error', (error) => {
        clearTimeout(timeout)
        reject(new Error(`Script execution error: ${error.message}`))
      })
    })
  }
  
  /**
   * 清理临时脚本文件
   */
  private cleanupScript(scriptPath: string): void {
    try {
      fs.unlinkSync(scriptPath)
    } catch (error) {
      console.warn('Failed to cleanup script file:', error)
    }
  }
}
```