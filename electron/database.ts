import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface ConfigData {
  id?: number
  key: string
  value: string
  category: string
  created_at?: string
  updated_at?: string
}

export interface ChatHistory {
  id?: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: string
}

class ElectronDatabaseService {
  private dataDir: string = ''
  private configFile: string = ''
  private chatHistoryFile: string = ''

  constructor() {
    // 不在构造函数中初始化，等待app ready
  }

  async initialize() {
    try {
      // 获取用户数据目录
      const userDataPath = app.getPath('userData')
      this.dataDir = path.join(userDataPath, 'bor-data')
      
      // 确保目录存在
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true })
      }
      
      this.configFile = path.join(this.dataDir, 'configs.json')
      this.chatHistoryFile = path.join(this.dataDir, 'chat-history.json')
      
      // 初始化文件
      this.initializeFiles()
      
      console.log('✅ 数据库初始化成功:', this.dataDir)
      return true
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error)
      return false
    }
  }

  private initializeFiles() {
    // 初始化配置文件
    if (!fs.existsSync(this.configFile)) {
      fs.writeFileSync(this.configFile, JSON.stringify({}), 'utf8')
    }
    
    // 初始化聊天历史文件
    if (!fs.existsSync(this.chatHistoryFile)) {
      fs.writeFileSync(this.chatHistoryFile, JSON.stringify({}), 'utf8')
    }
  }

  private readConfigFile(): Record<string, any> {
    try {
      const data = fs.readFileSync(this.configFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('读取配置文件失败:', error)
      return {}
    }
  }

  private writeConfigFile(data: Record<string, any>): boolean {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(data, null, 2), 'utf8')
      return true
    } catch (error) {
      console.error('写入配置文件失败:', error)
      return false
    }
  }

  private readChatHistoryFile(): Record<string, ChatHistory[]> {
    try {
      const data = fs.readFileSync(this.chatHistoryFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('读取聊天历史文件失败:', error)
      return {}
    }
  }

  private writeChatHistoryFile(data: Record<string, ChatHistory[]>): boolean {
    try {
      fs.writeFileSync(this.chatHistoryFile, JSON.stringify(data, null, 2), 'utf8')
      return true
    } catch (error) {
      console.error('写入聊天历史文件失败:', error)
      return false
    }
  }

  // 配置管理
  setConfig(key: string, value: any, category: string = 'general'): boolean {
    try {
      const configs = this.readConfigFile()
      configs[key] = {
        value: value,
        category: category,
        updated_at: new Date().toISOString()
      }
      return this.writeConfigFile(configs)
    } catch (error) {
      console.error('设置配置失败:', error)
      return false
    }
  }

  getConfig(key: string, defaultValue: any = null): any {
    try {
      const configs = this.readConfigFile()
      if (configs[key]) {
        return configs[key].value
      }
      return defaultValue
    } catch (error) {
      console.error('获取配置失败:', error)
      return defaultValue
    }
  }

  getConfigsByCategory(category: string): ConfigData[] {
    try {
      const configs = this.readConfigFile()
      const result: ConfigData[] = []
      
      for (const [key, config] of Object.entries(configs)) {
        if ((config as any).category === category) {
          result.push({
            key: key,
            value: JSON.stringify((config as any).value),
            category: (config as any).category,
            updated_at: (config as any).updated_at
          })
        }
      }
      
      return result.sort((a, b) => a.key.localeCompare(b.key))
    } catch (error) {
      console.error('获取分类配置失败:', error)
      return []
    }
  }

  deleteConfig(key: string): boolean {
    try {
      const configs = this.readConfigFile()
      if (configs[key]) {
        delete configs[key]
        return this.writeConfigFile(configs)
      }
      return true
    } catch (error) {
      console.error('删除配置失败:', error)
      return false
    }
  }

  // 聊天历史管理
  saveChatMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, timestamp: number, metadata?: any): boolean {
    try {
      const chatHistory = this.readChatHistoryFile()
      
      if (!chatHistory[sessionId]) {
        chatHistory[sessionId] = []
      }
      
      chatHistory[sessionId].push({
        id: Date.now(),
        session_id: sessionId,
        role: role,
        content: content,
        timestamp: timestamp,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      })
      
      // 限制每个会话的消息数量（保留最近1000条）
      if (chatHistory[sessionId].length > 1000) {
        chatHistory[sessionId] = chatHistory[sessionId].slice(-1000)
      }
      
      return this.writeChatHistoryFile(chatHistory)
    } catch (error) {
      console.error('保存聊天消息失败:', error)
      return false
    }
  }

  getChatHistory(sessionId: string, limit: number = 100): ChatHistory[] {
    try {
      const chatHistory = this.readChatHistoryFile()
      const messages = chatHistory[sessionId] || []
      
      // 返回最近的消息
      return messages.slice(-limit)
    } catch (error) {
      console.error('获取聊天历史失败:', error)
      return []
    }
  }

  getAllSessions(): string[] {
    try {
      const chatHistory = this.readChatHistoryFile()
      const sessions = Object.keys(chatHistory)
      
      // 按最后消息时间排序
      return sessions.sort((a, b) => {
        const aMessages = chatHistory[a] || []
        const bMessages = chatHistory[b] || []
        const aLastTime = aMessages.length > 0 ? aMessages[aMessages.length - 1].timestamp : 0
        const bLastTime = bMessages.length > 0 ? bMessages[bMessages.length - 1].timestamp : 0
        return bLastTime - aLastTime
      })
    } catch (error) {
      console.error('获取会话列表失败:', error)
      return []
    }
  }

  deleteChatHistory(sessionId: string): boolean {
    try {
      const chatHistory = this.readChatHistoryFile()
      if (chatHistory[sessionId]) {
        delete chatHistory[sessionId]
        return this.writeChatHistoryFile(chatHistory)
      }
      return true
    } catch (error) {
      console.error('删除聊天历史失败:', error)
      return false
    }
  }

  // 数据库统计
  getStats(): { configCount: number; messageCount: number; sessionCount: number } {
    try {
      const configs = this.readConfigFile()
      const chatHistory = this.readChatHistoryFile()
      
      const configCount = Object.keys(configs).length
      const sessionCount = Object.keys(chatHistory).length
      let messageCount = 0
      
      for (const messages of Object.values(chatHistory)) {
        messageCount += messages.length
      }

      return {
        configCount: configCount,
        messageCount: messageCount,
        sessionCount: sessionCount
      }
    } catch (error) {
      console.error('获取数据库统计失败:', error)
      return { configCount: 0, messageCount: 0, sessionCount: 0 }
    }
  }

  // 关闭数据库（文件系统不需要特殊关闭）
  close() {
    console.log('数据库服务已关闭')
  }
}

// 导出单例实例
export const electronDatabase = new ElectronDatabaseService()
export default electronDatabase