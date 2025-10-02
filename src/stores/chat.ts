import { defineStore } from 'pinia'
import type { Message, Conversation, IntentResult } from '@/types'

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  systemStatus: {
    ollama: boolean
    mcp: boolean
    knowledgeBase: boolean
  }
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    conversations: [],
    currentConversationId: null,
    isLoading: false,
    systemStatus: {
      ollama: false,
      mcp: false,
      knowledgeBase: false,
    },
  }),

  getters: {
    currentConversation: (state) => {
      if (!state.currentConversationId) return null
      return state.conversations.find(c => c.id === state.currentConversationId) || null
    },

    currentMessages: (state) => {
      const conversation = state.conversations.find(c => c.id === state.currentConversationId)
      return conversation?.messages || []
    },

    hasConversations: (state) => state.conversations.length > 0,
  },

  actions: {
    // 初始化
    initialize() {
      this.loadConversations()
      this.checkSystemStatus()
    },

    // 加载对话历史
    loadConversations() {
      try {
        const saved = localStorage.getItem('bor-conversations')
        if (saved) {
          this.conversations = JSON.parse(saved)
        }
        
        const currentId = localStorage.getItem('bor-current-conversation')
        if (currentId && this.conversations.find(c => c.id === currentId)) {
          this.currentConversationId = currentId
        }
      } catch (error) {
        console.error('加载对话历史失败:', error)
      }
    },

    // 保存对话历史
    saveConversations() {
      try {
        localStorage.setItem('bor-conversations', JSON.stringify(this.conversations))
        if (this.currentConversationId) {
          localStorage.setItem('bor-current-conversation', this.currentConversationId)
        }
      } catch (error) {
        console.error('保存对话历史失败:', error)
      }
    },

    // 创建新对话
    createConversation(title?: string): string {
      const conversation: Conversation = {
        id: Date.now().toString(),
        title: title || '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      this.conversations.unshift(conversation)
      this.currentConversationId = conversation.id
      this.saveConversations()

      return conversation.id
    },

    // 添加消息
    addMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
      const fullMessage: Message = {
        ...message,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
      }

      // 如果没有当前对话，创建一个
      if (!this.currentConversationId) {
        this.createConversation()
      }

      const conversation = this.conversations.find(c => c.id === this.currentConversationId)
      if (conversation) {
        conversation.messages.push(fullMessage)
        conversation.updatedAt = Date.now()
        
        // 如果是第一条用户消息，更新对话标题
        if (conversation.messages.length === 1 && message.role === 'user') {
          conversation.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
        }
        
        this.saveConversations()
      }

      return fullMessage
    },

    // 更新消息
    updateMessage(messageId: string, updates: Partial<Message>) {
      const conversation = this.conversations.find(c => c.id === this.currentConversationId)
      if (conversation) {
        const messageIndex = conversation.messages.findIndex(m => m.id === messageId)
        if (messageIndex !== -1) {
          conversation.messages[messageIndex] = {
            ...conversation.messages[messageIndex],
            ...updates,
          }
          conversation.updatedAt = Date.now()
          this.saveConversations()
        }
      }
    },

    // 删除消息
    deleteMessage(messageId: string) {
      const conversation = this.conversations.find(c => c.id === this.currentConversationId)
      if (conversation) {
        const messageIndex = conversation.messages.findIndex(m => m.id === messageId)
        if (messageIndex !== -1) {
          conversation.messages.splice(messageIndex, 1)
          conversation.updatedAt = Date.now()
          this.saveConversations()
        }
      }
    },

    // 切换对话
    switchConversation(conversationId: string) {
      if (this.conversations.find(c => c.id === conversationId)) {
        this.currentConversationId = conversationId
        localStorage.setItem('bor-current-conversation', conversationId)
      }
    },

    // 删除对话
    deleteConversation(conversationId: string) {
      const index = this.conversations.findIndex(c => c.id === conversationId)
      if (index !== -1) {
        this.conversations.splice(index, 1)
        
        // 如果删除的是当前对话，切换到第一个对话或创建新对话
        if (this.currentConversationId === conversationId) {
          if (this.conversations.length > 0) {
            this.currentConversationId = this.conversations[0].id
          } else {
            this.currentConversationId = null
          }
        }
        
        this.saveConversations()
      }
    },

    // 清空所有对话
    clearAllConversations() {
      this.conversations = []
      this.currentConversationId = null
      localStorage.removeItem('bor-conversations')
      localStorage.removeItem('bor-current-conversation')
    },

    // 检查系统状态
    async checkSystemStatus() {
      // 检查 Ollama 连接状态
      try {
        const response = await fetch('http://localhost:11434/api/tags')
        this.systemStatus.ollama = response.ok
      } catch {
        this.systemStatus.ollama = false
      }

      // 这里将添加 MCP 和知识库的状态检查
      this.systemStatus.mcp = false // 暂时设为 false
      this.systemStatus.knowledgeBase = false // 暂时设为 false
    },

    // 意图识别 (临时实现)
    async recognizeIntent(userInput: string): Promise<IntentResult> {
      // 简单的关键词匹配，后续将使用 LLM 进行智能识别
      const input = userInput.toLowerCase()

      if (input.includes('配置') && (input.includes('llm') || input.includes('模型'))) {
        return {
          type: 'llm_management',
          confidence: 0.9,
          params: { action: 'configure' },
          explanation: '用户想要配置 LLM 模型'
        }
      }

      if (input.includes('切换主题') || input.includes('主题')) {
        return {
          type: 'system_config',
          confidence: 0.8,
          params: { action: 'theme_change' },
          explanation: '用户想要切换主题'
        }
      }

      if (input.includes('上传') || input.includes('文档') || input.includes('知识库')) {
        return {
          type: 'knowledge_base',
          confidence: 0.8,
          params: { action: 'upload' },
          explanation: '用户想要管理知识库'
        }
      }

      if (input.includes('工作流') || input.includes('自动化') || input.includes('定时')) {
        return {
          type: 'workflow_creation',
          confidence: 0.8,
          params: { action: 'create' },
          explanation: '用户想要创建工作流'
        }
      }

      return {
        type: 'general_chat',
        confidence: 0.5,
        params: {},
        explanation: '普通对话'
      }
    },
  },
})