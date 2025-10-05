import Database from 'better-sqlite3'
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

class DatabaseService {
  private db: Database.Database | null = null
  private dbPath: string = ''

  constructor() {
    this.initDatabase()
  }

  private initDatabase() {
    try {
      // 获取用户数据目录
      const userDataPath = app.getPath('userData')
      const dbDir = path.join(userDataPath, 'bor-data')
      
      // 确保目录存在
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }
      
      this.dbPath = path.join(dbDir, 'bor.db')
      this.db = new Database(this.dbPath)
      
      // 启用WAL模式以提高性能
      this.db.pragma('journal_mode = WAL')
      
      this.createTables()
      console.log('✅ 数据库初始化成功:', this.dbPath)
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error)
    }
  }

  private createTables() {
    if (!this.db) return

    // 配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 聊天历史表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_configs_key ON configs(key);
      CREATE INDEX IF NOT EXISTS idx_configs_category ON configs(category);
      CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_history(timestamp);
    `)
  }

  // 配置管理
  setConfig(key: string, value: any, category: string = 'general'): boolean {
    if (!this.db) return false

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO configs (key, value, category, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `)
      
      const result = stmt.run(key, JSON.stringify(value), category)
      return result.changes > 0
    } catch (error) {
      console.error('设置配置失败:', error)
      return false
    }
  }

  getConfig(key: string, defaultValue: any = null): any {
    if (!this.db) return defaultValue

    try {
      const stmt = this.db.prepare('SELECT value FROM configs WHERE key = ?')
      const row = stmt.get(key) as { value: string } | undefined
      
      if (row) {
        return JSON.parse(row.value)
      }
      return defaultValue
    } catch (error) {
      console.error('获取配置失败:', error)
      return defaultValue
    }
  }

  getConfigsByCategory(category: string): ConfigData[] {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare('SELECT * FROM configs WHERE category = ? ORDER BY key')
      return stmt.all(category) as ConfigData[]
    } catch (error) {
      console.error('获取分类配置失败:', error)
      return []
    }
  }

  deleteConfig(key: string): boolean {
    if (!this.db) return false

    try {
      const stmt = this.db.prepare('DELETE FROM configs WHERE key = ?')
      const result = stmt.run(key)
      return result.changes > 0
    } catch (error) {
      console.error('删除配置失败:', error)
      return false
    }
  }

  // 聊天历史管理
  saveChatMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, timestamp: number, metadata?: any): boolean {
    if (!this.db) return false

    try {
      const stmt = this.db.prepare(`
        INSERT INTO chat_history (session_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?)
      `)
      
      const result = stmt.run(sessionId, role, content, timestamp, metadata ? JSON.stringify(metadata) : null)
      return result.changes > 0
    } catch (error) {
      console.error('保存聊天消息失败:', error)
      return false
    }
  }

  getChatHistory(sessionId: string, limit: number = 100): ChatHistory[] {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM chat_history 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `)
      
      const rows = stmt.all(sessionId, limit) as ChatHistory[]
      return rows.reverse() // 按时间正序返回
    } catch (error) {
      console.error('获取聊天历史失败:', error)
      return []
    }
  }

  getAllSessions(): string[] {
    if (!this.db) return []

    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT session_id 
        FROM chat_history 
        ORDER BY MAX(timestamp) DESC
      `)
      
      const rows = stmt.all() as { session_id: string }[]
      return rows.map(row => row.session_id)
    } catch (error) {
      console.error('获取会话列表失败:', error)
      return []
    }
  }

  deleteChatHistory(sessionId: string): boolean {
    if (!this.db) return false

    try {
      const stmt = this.db.prepare('DELETE FROM chat_history WHERE session_id = ?')
      const result = stmt.run(sessionId)
      return result.changes > 0
    } catch (error) {
      console.error('删除聊天历史失败:', error)
      return false
    }
  }

  // 清理旧数据
  cleanupOldData(daysToKeep: number = 30): boolean {
    if (!this.db) return false

    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
      const stmt = this.db.prepare('DELETE FROM chat_history WHERE timestamp < ?')
      const result = stmt.run(cutoffTime)
      
      console.log(`清理了 ${result.changes} 条旧聊天记录`)
      return true
    } catch (error) {
      console.error('清理旧数据失败:', error)
      return false
    }
  }

  // 数据库统计
  getStats(): { configCount: number; messageCount: number; sessionCount: number } {
    if (!this.db) return { configCount: 0, messageCount: 0, sessionCount: 0 }

    try {
      const configCount = this.db.prepare('SELECT COUNT(*) as count FROM configs').get() as { count: number }
      const messageCount = this.db.prepare('SELECT COUNT(*) as count FROM chat_history').get() as { count: number }
      const sessionCount = this.db.prepare('SELECT COUNT(DISTINCT session_id) as count FROM chat_history').get() as { count: number }

      return {
        configCount: configCount.count,
        messageCount: messageCount.count,
        sessionCount: sessionCount.count
      }
    } catch (error) {
      console.error('获取数据库统计失败:', error)
      return { configCount: 0, messageCount: 0, sessionCount: 0 }
    }
  }

  // 关闭数据库
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('数据库连接已关闭')
    }
  }

  // 备份数据库
  backup(backupPath: string): boolean {
    if (!this.db) return false

    try {
      this.db.backup(backupPath)
      console.log('数据库备份成功:', backupPath)
      return true
    } catch (error) {
      console.error('数据库备份失败:', error)
      return false
    }
  }
}

// 导出单例实例
export const databaseService = new DatabaseService()
export default databaseService