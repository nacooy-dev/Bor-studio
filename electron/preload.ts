const { contextBridge, ipcRenderer } = require('electron')

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
  
  // 事件监听
  onThemeChanged: (callback: (theme: string) => void) => void
  onConfigUpdated: (callback: (configType: string, data: any) => void) => void
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