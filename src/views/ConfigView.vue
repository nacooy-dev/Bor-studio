<template>
  <div class="config-view">
    <div class="config-header">
      <button class="back-button" @click="goBack">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        返回聊天
      </button>
      <h1 class="config-title">系统配置</h1>
    </div>

    <div class="config-content">
      <div class="config-tabs">
        <button
          :class="['tab-button', { active: activeTab === 'llm' }]"
          @click="activeTab = 'llm'"
        >
          LLM 模型
        </button>
        <button
          :class="['tab-button', { active: activeTab === 'mcp' }]"
          @click="activeTab = 'mcp'"
        >
          MCP 工具
        </button>
        <button
          :class="['tab-button', { active: activeTab === 'system' }]"
          @click="activeTab = 'system'"
        >
          系统设置
        </button>
        <button
          :class="['tab-button', { active: activeTab === 'data' }]"
          @click="activeTab = 'data'"
        >
          数据管理
        </button>
        <button
          :class="['tab-button', { active: activeTab === 'about' }]"
          @click="activeTab = 'about'"
        >
          关于
        </button>
      </div>

      <div class="tab-content">
        <!-- LLM 配置 -->
        <div v-if="activeTab === 'llm'" class="tab-panel">
          <div :class="{ 'dark-theme': isDark }">
            <LLMConfigPanel />
          </div>
        </div>

        <!-- MCP 配置 -->
        <div v-if="activeTab === 'mcp'" class="tab-panel">
          <MCPConfigPanel />
        </div>

        <!-- 系统设置 -->
        <div v-if="activeTab === 'system'" class="tab-panel">
          <div class="system-settings">
            <h3>界面设置</h3>
            <div class="setting-group">
              <label class="setting-label">
                <span>主题</span>
                <select v-model="theme" @change="updateTheme" class="setting-select">
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                  <option value="auto">跟随系统</option>
                </select>
              </label>
            </div>

            <h3>对话设置</h3>
            <div class="setting-group">
              <label class="setting-label">
                <span>自动保存对话</span>
                <input
                  v-model="autoSave"
                  type="checkbox"
                  class="setting-checkbox"
                  @change="updateAutoSave"
                />
              </label>
            </div>
          </div>
        </div>

        <!-- 数据管理 -->
        <div v-if="activeTab === 'data'" class="tab-panel">
          <div class="data-management">
            <h3>聊天记录管理</h3>
            <div class="data-stats" v-if="dataStats">
              <div class="stat-item">
                <span class="stat-label">会话数量</span>
                <span class="stat-value">{{ dataStats.sessionCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">消息总数</span>
                <span class="stat-value">{{ dataStats.messageCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">配置项数</span>
                <span class="stat-value">{{ dataStats.configCount }}</span>
              </div>
            </div>

            <div class="data-actions">
              <button class="action-button refresh" @click="refreshDataStats">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                刷新统计
              </button>
              
              <button class="action-button export" @click="exportChatHistory">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                导出记录
              </button>
              
              <button class="action-button warning" @click="showClearDialog = true">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                </svg>
                清空记录
              </button>
            </div>

            <h3>会话列表</h3>
            <div class="session-list" v-if="sessions.length > 0">
              <div 
                v-for="session in sessions" 
                :key="session.id"
                class="session-item"
              >
                <div class="session-info">
                  <span class="session-id">{{ session.id }}</span>
                  <span class="session-count">{{ session.messageCount }} 条消息</span>
                  <span class="session-date">{{ formatDate(session.lastMessage) }}</span>
                </div>
                <div class="session-actions">
                  <button class="session-btn view" @click="viewSession(session.id)">
                    查看
                  </button>
                  <button class="session-btn delete" @click="deleteSession(session.id)">
                    删除
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="no-sessions">
              <p>暂无聊天记录</p>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div v-if="activeTab === 'about'" class="tab-panel">
          <div class="about-section">
            <div class="app-info">
              <div class="app-icon">
                <div class="icon-placeholder"></div>
              </div>
              <h2>Bor 智能体中枢</h2>
              <p class="version">版本 1.0.0</p>
              <p class="description">
                瑞士军刀式的个人智能助手平台，通过对话控制一切功能。
              </p>
            </div>

            <div class="features-list">
              <h3>核心功能</h3>
              <ul>
                <li>🤖 多供应商 LLM 支持</li>
                <li>💬 智能对话路由</li>
                <li>📚 知识库管理</li>
                <li>⚙️ 工作流自动化</li>
                <li>🔧 MCP 工具集成</li>
              </ul>
            </div>

            <div class="links-section">
              <a href="#" class="link-button">GitHub</a>
              <a href="#" class="link-button">文档</a>
              <a href="#" class="link-button">反馈</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 清空确认对话框 -->
    <div v-if="showClearDialog" class="dialog-overlay" @click="showClearDialog = false">
      <div class="dialog" @click.stop>
        <h3>确认清空聊天记录</h3>
        <p>此操作将永久删除所有聊天记录，无法恢复。确定要继续吗？</p>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="showClearDialog = false">取消</button>
          <button class="btn-danger" @click="clearAllChatHistory">确认清空</button>
        </div>
      </div>
    </div>

    <!-- 会话查看对话框 -->
    <div v-if="showSessionDialog" class="dialog-overlay" @click="showSessionDialog = false">
      <div class="dialog session-dialog" @click.stop>
        <h3>会话记录 - {{ currentSessionId }}</h3>
        <div class="session-messages">
          <div 
            v-for="message in currentSessionMessages" 
            :key="message.id"
            :class="['message-item', message.role]"
          >
            <div class="message-role">{{ message.role === 'user' ? '用户' : 'AI' }}</div>
            <div class="message-content">{{ message.content }}</div>
            <div class="message-time">{{ formatTime(message.timestamp) }}</div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="showSessionDialog = false">关闭</button>
          <button class="btn-danger" @click="deleteCurrentSession">删除此会话</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import LLMConfigPanel from '@/components/LLMConfigPanel.vue'
import MCPConfigPanel from '@/components/mcp/MCPServerManager.vue'

const $router = useRouter()
const activeTab = ref('llm')
const theme = ref('light')
const autoSave = ref(true)

// 数据管理相关状态
const dataStats = ref(null)
const sessions = ref([])
const showClearDialog = ref(false)
const showSessionDialog = ref(false)
const currentSessionId = ref('')
const currentSessionMessages = ref([])

// 检测当前主题
const isDark = computed(() => {
  return document.documentElement.classList.contains('dark') || 
         theme.value === 'dark' ||
         (theme.value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
})

onMounted(async () => {
  // 加载保存的设置
  const savedTheme = localStorage.getItem('bor-theme') || 'light'
  const savedAutoSave = localStorage.getItem('bor-auto-save') !== 'false'
  
  theme.value = savedTheme
  autoSave.value = savedAutoSave
  
  // 应用当前主题
  updateTheme()
  
  // 加载数据统计
  await refreshDataStats()
})

const updateTheme = async () => {
  localStorage.setItem('bor-theme', theme.value)
  
  // 更新CSS类
  if (theme.value === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  } else {
    document.documentElement.classList.add('light')
    document.documentElement.classList.remove('dark')
  }
  document.documentElement.setAttribute('data-theme', theme.value)
  
  // 如果在 Electron 环境中，通知主进程更新窗口背景
  if (window.electronAPI?.setTheme) {
    try {
      await window.electronAPI.setTheme(theme.value)
    } catch (error) {
      console.error('设置主题失败:', error)
    }
  }
  
  console.log('主题已切换到:', theme.value)
}

const updateAutoSave = () => {
  localStorage.setItem('bor-auto-save', autoSave.value.toString())
}

const goBack = () => {
  // 返回到聊天页面
  $router.push('/')
}

// 数据管理方法
const refreshDataStats = async () => {
  try {
    if (window.electronAPI?.database) {
      // 获取数据统计
      const stats = await window.electronAPI.database.getStats()
      dataStats.value = stats
      
      // 获取会话列表
      const sessionIds = await window.electronAPI.database.getAllSessions()
      const sessionList = []
      
      for (const sessionId of sessionIds) {
        const messages = await window.electronAPI.database.getChatHistory(sessionId, 1)
        if (messages.length > 0) {
          const allMessages = await window.electronAPI.database.getChatHistory(sessionId, 1000)
          sessionList.push({
            id: sessionId,
            messageCount: allMessages.length,
            lastMessage: messages[messages.length - 1]?.timestamp || Date.now()
          })
        }
      }
      
      sessions.value = sessionList.sort((a, b) => b.lastMessage - a.lastMessage)
    }
  } catch (error) {
    console.error('刷新数据统计失败:', error)
    alert('刷新数据统计失败: ' + error.message)
  }
}

const exportChatHistory = async () => {
  try {
    if (window.electronAPI?.database) {
      const sessionIds = await window.electronAPI.database.getAllSessions()
      const allData = {}
      
      for (const sessionId of sessionIds) {
        const messages = await window.electronAPI.database.getChatHistory(sessionId, 1000)
        allData[sessionId] = messages
      }
      
      // 创建下载链接
      const dataStr = JSON.stringify(allData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `bor-chat-history-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      alert('聊天记录已导出')
    }
  } catch (error) {
    console.error('导出聊天记录失败:', error)
    alert('导出聊天记录失败: ' + error.message)
  }
}

const clearAllChatHistory = async () => {
  try {
    if (window.electronAPI?.database) {
      const sessionIds = await window.electronAPI.database.getAllSessions()
      
      for (const sessionId of sessionIds) {
        await window.electronAPI.database.deleteChatHistory(sessionId)
      }
      
      showClearDialog.value = false
      await refreshDataStats()
      alert('所有聊天记录已清空')
    }
  } catch (error) {
    console.error('清空聊天记录失败:', error)
    alert('清空聊天记录失败: ' + error.message)
  }
}

const viewSession = async (sessionId) => {
  try {
    if (window.electronAPI?.database) {
      const messages = await window.electronAPI.database.getChatHistory(sessionId, 1000)
      currentSessionId.value = sessionId
      currentSessionMessages.value = messages
      showSessionDialog.value = true
    }
  } catch (error) {
    console.error('查看会话失败:', error)
    alert('查看会话失败: ' + error.message)
  }
}

const deleteSession = async (sessionId) => {
  if (confirm(`确定要删除会话 ${sessionId} 吗？此操作无法恢复。`)) {
    try {
      if (window.electronAPI?.database) {
        await window.electronAPI.database.deleteChatHistory(sessionId)
        await refreshDataStats()
        alert('会话已删除')
      }
    } catch (error) {
      console.error('删除会话失败:', error)
      alert('删除会话失败: ' + error.message)
    }
  }
}

const deleteCurrentSession = async () => {
  await deleteSession(currentSessionId.value)
  showSessionDialog.value = false
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN')
}
</script>

<style scoped>
/* CSS变量定义 */
.config-view {
  /* 浅色主题变量 */
  --text-primary: #1d1d1f;
  --text-secondary: #8e8e93;
  --border-color: rgba(0, 0, 0, 0.1);
  --border-hover: rgba(0, 0, 0, 0.2);
  --hover-bg: rgba(0, 0, 0, 0.05);
  --tab-active-bg: rgba(255, 255, 255, 0.8);
  --shadow-color: rgba(0, 0, 0, 0.1);
  --input-bg: rgba(255, 255, 255, 0.8);
  --input-border: rgba(0, 0, 0, 0.2);
  --card-bg: rgba(255, 255, 255, 0.6);
  
  min-height: 100vh;
  background: transparent;
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;
  -webkit-app-region: drag;
}

/* 深色主题变量 */
.dark .config-view {
  --text-primary: rgba(255, 255, 255, 0.9);
  --text-secondary: rgba(255, 255, 255, 0.6);
  --border-color: rgba(255, 255, 255, 0.2);
  --border-hover: rgba(255, 255, 255, 0.3);
  --hover-bg: rgba(255, 255, 255, 0.1);
  --tab-active-bg: rgba(255, 255, 255, 0.2);
  --shadow-color: rgba(0, 0, 0, 0.3);
  --input-bg: rgba(255, 255, 255, 0.1);
  --input-border: rgba(255, 255, 255, 0.2);
  --card-bg: rgba(255, 255, 255, 0.1);
}

.config-header {
  display: flex;
  align-items: center;
  margin-bottom: 32px;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

@media (max-width: 768px) {
  .config-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .back-button {
    margin-right: 0;
  }
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  transition: all 0.2s ease;
  margin-right: 24px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  -webkit-app-region: no-drag;
}

.back-button:hover {
  background: var(--hover-bg);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.config-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.config-content {
  max-width: 1200px;
  margin: 0 auto;
  margin-bottom: 40px; /* 确保底部有足够空间 */
}

.config-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 4px;
  border-radius: 16px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  -webkit-app-region: no-drag;
}

.tab-button {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.tab-button.active {
  background: var(--tab-active-bg);
  color: var(--text-primary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4px 16px var(--shadow-color);
}

.tab-button:hover:not(.active) {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.tab-content {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 32px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  -webkit-app-region: no-drag;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}

.tab-panel {
  /* 移除固定高度，让内容自然流动 */
}

.system-settings h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.system-settings h3:not(:first-child) {
  margin-top: 32px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-label span {
  font-weight: 500;
  color: var(--text-secondary);
}

.setting-select {
  padding: 8px 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.setting-select:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.setting-select option {
  background: var(--input-bg);
  color: var(--text-primary);
}

.setting-checkbox {
  width: 20px;
  height: 20px;
  accent-color: rgba(59, 130, 246, 0.8);
}

.about-section {
  text-align: center;
}

.app-info {
  margin-bottom: 48px;
}

.app-icon {
  margin: 0 auto 24px;
}

.icon-placeholder {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #007AFF, #5856D6);
  border-radius: 16px;
  margin: 0 auto;
}

.app-info h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.version {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 16px 0;
}

.description {
  color: var(--text-secondary);
  line-height: 1.5;
  max-width: 400px;
  margin: 0 auto;
}

.features-list {
  margin-bottom: 48px;
}

.features-list h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.features-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: inline-block;
  text-align: left;
}

.features-list li {
  padding: 8px 0;
  color: var(--text-secondary);
}

.links-section {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.link-button {
  padding: 12px 24px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: var(--text-primary);
  text-decoration: none;
  border-radius: 12px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.link-button:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
}

/* 数据管理样式 */
.data-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  text-align: center;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.data-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  -webkit-app-region: no-drag;
}

.action-button.refresh {
  background: rgba(52, 199, 89, 0.8);
  color: white;
}

.action-button.export {
  background: rgba(0, 122, 255, 0.8);
  color: white;
}

.action-button.warning {
  background: rgba(255, 59, 48, 0.8);
  color: white;
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.session-list {
  max-height: 400px;
  overflow-y: auto;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-id {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.session-count, .session-date {
  font-size: 12px;
  color: var(--text-secondary);
}

.session-actions {
  display: flex;
  gap: 8px;
}

.session-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.session-btn.view {
  background: rgba(0, 122, 255, 0.8);
  color: white;
}

.session-btn.delete {
  background: rgba(255, 59, 48, 0.8);
  color: white;
}

.session-btn:hover {
  transform: translateY(-1px);
}

.no-sessions {
  text-align: center;
  padding: 48px;
  color: var(--text-secondary);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  -webkit-app-region: no-drag;
}

.dialog {
  background: var(--card-bg);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.session-dialog {
  max-width: 600px;
  max-height: 80vh;
}

.dialog h3 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.dialog p {
  margin: 0 0 24px 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel, .btn-danger {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.btn-cancel {
  background: var(--hover-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-danger {
  background: rgba(255, 59, 48, 0.8);
  color: white;
}

.btn-cancel:hover, .btn-danger:hover {
  transform: translateY(-1px);
}

.session-messages {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--hover-bg);
  border-radius: 8px;
}

.message-item {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  background: var(--card-bg);
}

.message-item.user {
  margin-left: 20%;
  background: rgba(0, 122, 255, 0.1);
}

.message-item.assistant {
  margin-right: 20%;
}

.message-role {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.message-content {
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 8px;
}

.message-time {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: right;
}

/* 滚动条样式 */
.tab-content::-webkit-scrollbar,
.session-list::-webkit-scrollbar,
.session-messages::-webkit-scrollbar {
  width: 6px;
}

.tab-content::-webkit-scrollbar-track,
.session-list::-webkit-scrollbar-track,
.session-messages::-webkit-scrollbar-track {
  background: transparent;
}

.tab-content::-webkit-scrollbar-thumb,
.session-list::-webkit-scrollbar-thumb,
.session-messages::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.tab-content::-webkit-scrollbar-thumb:hover,
.session-list::-webkit-scrollbar-thumb:hover,
.session-messages::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

/* 确保所有子组件也使用相同的主题变量 */
:deep(.glass) {
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

:deep(.glass-light) {
  background: var(--hover-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
</style>