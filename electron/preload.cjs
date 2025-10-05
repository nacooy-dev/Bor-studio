const { contextBridge, ipcRenderer } = require('electron')

// MCP API实现
const mcpAPI = {
  addServer: (config) => ipcRenderer.invoke('mcp:add-server', config),
  startServer: (serverId) => ipcRenderer.invoke('mcp:start-server', serverId),
  stopServer: (serverId) => ipcRenderer.invoke('mcp:stop-server', serverId),
  removeServer: (serverId) => ipcRenderer.invoke('mcp:remove-server', serverId),
  getServers: () => ipcRenderer.invoke('mcp:get-servers'),
  getTools: (serverId) => ipcRenderer.invoke('mcp:get-tools', serverId),
  findTool: (name, serverId) => ipcRenderer.invoke('mcp:find-tool', name, serverId),
  executeTool: (call) => ipcRenderer.invoke('mcp:execute-tool', call)
}

// 暴露安全的 API 给渲染进程
const electronAPI = {
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
  }
}

// 将 API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)