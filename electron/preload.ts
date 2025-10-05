const { contextBridge, ipcRenderer } = require('electron')

// MCP相关类型定义
interface MCPServerConfig {
  id: string
  name: string
  description?: string
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
  autoStart?: boolean
}

interface MCPToolCall {
  tool: string
  parameters: Record<string, any>
  server: string
  requestId?: string
}

// MCP API接口
interface MCPAPI {
  addServer: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string }>
  startServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  stopServer: (serverId: string) => Promise<{ success: boolean; error?: string }>
  getServers: () => Promise<{ success: boolean; data?: any[]; error?: string }>
  getTools: (serverId?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
  findTool: (name: string, serverId?: string) => Promise<{ success: boolean; data?: any; error?: string }>
  executeTool: (call: MCPToolCall) => Promise<{ success: boolean; data?: any; error?: string }>
}

// 定义 API 接口
interface ElectronAPI {
  // 应用信息
  getAppVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  
  // 主题控制
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<string>
  
  // 窗口控制
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  
  // 配置管理
  openConfigWindow: (configType: string, params?: any) => Promise<void>
  saveConfig: (configType: string, data: any) => Promise<{ success: boolean }>
  
  // 语音识别
  startSpeechRecognition: () => Promise<{ success: boolean; text?: string; error?: string }>
  
  // MCP功能
  mcp: MCPAPI
  
  // 事件监听
  onThemeChanged: (callback: (theme: string) => void) => void
  onConfigUpdated: (callback: (configType: string, data: any) => void) => void
}

// MCP API实现
const mcpAPI: MCPAPI = {
  addServer: (config) => ipcRenderer.invoke('mcp:add-server', config),
  startServer: (serverId) => ipcRenderer.invoke('mcp:start-server', serverId),
  stopServer: (serverId) => ipcRenderer.invoke('mcp:stop-server', serverId),
  getServers: () => ipcRenderer.invoke('mcp:get-servers'),
  getTools: (serverId) => ipcRenderer.invoke('mcp:get-tools', serverId),
  findTool: (name, serverId) => ipcRenderer.invoke('mcp:find-tool', name, serverId),
  executeTool: (call) => ipcRenderer.invoke('mcp:execute-tool', call)
}

// 暴露安全的 API 给渲染进程
const electronAPI: ElectronAPI = {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // 主题控制
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // 配置管理
  openConfigWindow: (configType, params) => ipcRenderer.invoke('open-config-window', configType, params),
  saveConfig: (configType, data) => ipcRenderer.invoke('save-config', configType, data),
  
  // 语音识别
  startSpeechRecognition: () => ipcRenderer.invoke('start-speech-recognition'),
  
  // MCP功能
  mcp: mcpAPI,
  
  // 事件监听
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme-changed', (_, theme) => callback(theme))
  },
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config-updated', (_, configType, data) => callback(configType, data))
  },
}

// 将 API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型声明（在 CommonJS 中不需要 declare global）