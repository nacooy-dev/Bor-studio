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
          :class="['tab-button', { active: activeTab === 'system' }]"
          @click="activeTab = 'system'"
        >
          系统设置
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
          <LLMConfigPanel />
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LLMConfigPanel from '@/components/LLMConfigPanel.vue'

const $router = useRouter()
const activeTab = ref('llm')
const theme = ref('light')
const autoSave = ref(true)

onMounted(() => {
  // 加载保存的设置
  const savedTheme = localStorage.getItem('bor-theme') || 'light'
  const savedAutoSave = localStorage.getItem('bor-auto-save') !== 'false'
  
  theme.value = savedTheme
  autoSave.value = savedAutoSave
})

const updateTheme = () => {
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
  
  // 如果在 Electron 环境中，通知主进程
  if (window.electronAPI?.setTheme) {
    window.electronAPI.setTheme(theme.value)
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
</script>

<style scoped>
.config-view {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;
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
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #1d1d1f;
  transition: all 0.2s ease;
  margin-right: 24px;
}

.back-button:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

.config-title {
  font-size: 28px;
  font-weight: 600;
  color: #1d1d1f;
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
  background: rgba(255, 255, 255, 0.6);
  padding: 4px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.tab-button {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8e8e93;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button.active {
  background: rgba(255, 255, 255, 0.9);
  color: #1d1d1f;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab-content {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 32px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.tab-panel {
  /* 移除固定高度，让内容自然流动 */
}

.system-settings h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
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
  border-bottom: 1px solid #f2f2f7;
}

.setting-label span {
  font-weight: 500;
  color: #1d1d1f;
}

.setting-select {
  padding: 6px 12px;
  border: 0.5px solid #d1d1d6;
  border-radius: 6px;
  background: white;
  transition: all 0.2s ease;
}

.setting-select:focus {
  outline: none;
  border-color: #007AFF;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

.setting-checkbox {
  width: 20px;
  height: 20px;
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
  color: #1d1d1f;
  margin: 0 0 8px 0;
}

.version {
  color: #8e8e93;
  font-size: 14px;
  margin: 0 0 16px 0;
}

.description {
  color: #1d1d1f;
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
  color: #1d1d1f;
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
  color: #1d1d1f;
}

.links-section {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.link-button {
  padding: 12px 24px;
  background: #007AFF;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.link-button:hover {
  background: #0056CC;
  transform: translateY(-1px);
}
</style>