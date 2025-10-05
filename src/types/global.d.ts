/**
 * 全局类型声明
 */

import type { MCPAPI } from './index'

declare global {
  interface Window {
    electronAPI: {
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
    
    api: {
      mcp: MCPAPI
    }
  }
}

export {}