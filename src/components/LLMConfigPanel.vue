<template>
  <div class="llm-config-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h2 class="panel-title">LLM 模型配置</h2>
      <p class="panel-subtitle">管理您的 AI 模型提供商和设置</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="llmManager.isLoading.value" class="loading-state">
      <div class="loading-spinner"></div>
      <p>正在加载配置...</p>
    </div>

    <!-- 主要内容 -->
    <div v-else class="panel-content">
      <!-- 提供商选择 -->
      <div class="config-section">
        <h3 class="section-title">选择提供商</h3>
        <div class="provider-grid">
          <div
            v-for="provider in llmManager.availableProviders.value"
            :key="provider.id"
            :class="[
              'provider-card',
              { 
                'active': llmManager.currentProvider.value === provider.id,
                'available': provider.isAvailable,
                'configured': provider.isConfigured
              }
            ]"
            @click="selectProvider(provider.id)"
          >
            <div class="provider-icon">
              <component :is="getProviderIcon(provider.type)" />
            </div>
            <div class="provider-info">
              <h4 class="provider-name">{{ provider.name }}</h4>
              <p class="provider-status">
                <span v-if="!provider.isConfigured" class="status-badge warning">
                  需要配置
                </span>
                <span v-else-if="provider.isAvailable" class="status-badge success">
                  已连接
                </span>
                <span v-else class="status-badge error">
                  连接失败
                </span>
              </p>
            </div>
            <div class="provider-actions">
              <button
                v-if="!provider.isConfigured"
                class="btn-configure"
                @click.stop="configureProvider(provider.id)"
              >
                配置
              </button>
              <button
                v-else
                class="btn-test"
                @click.stop="testProvider(provider.id)"
                :disabled="testingProvider === provider.id"
              >
                {{ testingProvider === provider.id ? '测试中...' : '测试' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 模型选择 -->
      <div v-if="llmManager.currentProvider.value" class="config-section">
        <h3 class="section-title">选择模型</h3>
        <div class="model-selector">
          <select
            v-model="llmManager.currentModel.value"
            @change="selectModel"
            class="model-select"
          >
            <option value="">请选择模型</option>
            <option
              v-for="model in llmManager.availableModels.value"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }} - {{ model.description }}
            </option>
          </select>
          <button
            v-if="llmManager.currentProvider.value === 'ollama'"
            class="btn-refresh"
            @click="refreshModels"
            :disabled="refreshingModels"
          >
            {{ refreshingModels ? '刷新中...' : '刷新模型' }}
          </button>
        </div>
      </div>

      <!-- 模型设置 -->
      <div v-if="llmManager.currentModel.value" class="config-section">
        <h3 class="section-title">模型参数</h3>
        <div class="settings-grid">
          <div class="setting-item">
            <label for="temperature">温度 (Temperature)</label>
            <input
              id="temperature"
              v-model.number="settings.temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              class="range-input"
              @input="updateSettings"
            />
            <span class="setting-value">{{ settings.temperature }}</span>
          </div>

          <div class="setting-item">
            <label for="maxTokens">最大 Token 数</label>
            <input
              id="maxTokens"
              v-model.number="settings.maxTokens"
              type="number"
              min="1"
              max="32000"
              class="number-input"
              @input="updateSettings"
            />
          </div>

          <div class="setting-item">
            <label for="topP">Top P</label>
            <input
              id="topP"
              v-model.number="settings.topP"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="range-input"
              @input="updateSettings"
            />
            <span class="setting-value">{{ settings.topP }}</span>
          </div>
        </div>
      </div>

      <!-- Ollama 特殊功能 -->
      <div v-if="llmManager.currentProvider.value === 'ollama'" class="config-section">
        <h3 class="section-title">Ollama 管理</h3>
        <div class="ollama-actions">
          <div class="action-item">
            <input
              v-model="newModelName"
              type="text"
              placeholder="输入模型名称，如: llama2, qwen:7b"
              class="model-input"
            />
            <button
              class="btn-pull"
              @click="pullModel"
              :disabled="pullingModel"
            >
              {{ pullingModel ? '下载中...' : '下载模型' }}
            </button>
          </div>
          <div v-if="pullProgress" class="pull-progress">
            <p>{{ pullProgress }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置对话框 -->
    <div v-if="showConfigDialog" class="config-dialog-overlay" @click="closeConfigDialog">
      <div class="config-dialog" @click.stop>
        <h3>配置 {{ getProviderName(configuringProvider) }}</h3>
        
        <div class="dialog-content">
          <div v-if="configuringProvider === 'openai'" class="config-form">
            <div class="form-group">
              <label for="openai-api-key">API 密钥</label>
              <input
                id="openai-api-key"
                v-model="providerConfig.apiKey"
                type="password"
                placeholder="sk-..."
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="openai-base-url">基础 URL (可选)</label>
              <input
                id="openai-base-url"
                v-model="providerConfig.baseUrl"
                type="url"
                placeholder="https://api.openai.com/v1"
                class="form-input"
              />
            </div>
          </div>
          
          <!-- 可以添加其他提供商的配置表单 -->
        </div>

        <div class="dialog-actions">
          <button class="btn-cancel" @click="closeConfigDialog">取消</button>
          <button class="btn-save" @click="saveProviderConfig">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { llmManager } from '../lib/llm-manager'
import type { ChatSettings } from '../lib/models'

// 响应式状态
const testingProvider = ref<string>('')
const refreshingModels = ref(false)
const showConfigDialog = ref(false)
const configuringProvider = ref<string>('')
const providerConfig = reactive<any>({})
const newModelName = ref('')
const pullingModel = ref(false)
const pullProgress = ref('')

// 设置
const settings = reactive<ChatSettings>(llmManager.getSettings())

// 生命周期
onMounted(async () => {
  await llmManager.initialize()
})

// 方法
const selectProvider = async (providerId: string) => {
  try {
    await llmManager.setProvider(providerId)
  } catch (error) {
    console.error('Failed to select provider:', error)
    // 如果提供商未配置，打开配置对话框
    if (error instanceof Error && error.message.includes('not configured')) {
      configureProvider(providerId)
    }
  }
}

const selectModel = () => {
  llmManager.setModel(llmManager.currentModel.value)
}

const testProvider = async (providerId: string) => {
  testingProvider.value = providerId
  try {
    const result = await llmManager.testProvider(providerId)
    alert(result.success ? '连接成功！' : `连接失败: ${result.message}`)
  } catch (error) {
    alert(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    testingProvider.value = ''
  }
}

const configureProvider = (providerId: string) => {
  configuringProvider.value = providerId
  Object.assign(providerConfig, {
    apiKey: '',
    baseUrl: ''
  })
  showConfigDialog.value = true
}

const closeConfigDialog = () => {
  showConfigDialog.value = false
  configuringProvider.value = ''
  Object.assign(providerConfig, {})
}

const saveProviderConfig = async () => {
  try {
    await llmManager.configureProvider(configuringProvider.value, { ...providerConfig })
    closeConfigDialog()
    alert('配置保存成功！')
  } catch (error) {
    alert(`配置保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const refreshModels = async () => {
  refreshingModels.value = true
  try {
    await llmManager.refreshModels()
  } finally {
    refreshingModels.value = false
  }
}

const updateSettings = () => {
  llmManager.updateSettings(settings)
}

const pullModel = async () => {
  if (!newModelName.value.trim()) {
    alert('请输入模型名称')
    return
  }

  const ollamaProvider = llmManager.getProvider('ollama') as any
  if (!ollamaProvider || !ollamaProvider.pullModel) {
    alert('Ollama 提供商不可用')
    return
  }

  pullingModel.value = true
  pullProgress.value = ''

  try {
    await ollamaProvider.pullModel(newModelName.value.trim(), (progress: string) => {
      pullProgress.value = progress
    })
    
    alert('模型下载完成！')
    newModelName.value = ''
    await refreshModels()
  } catch (error) {
    alert(`模型下载失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    pullingModel.value = false
    pullProgress.value = ''
  }
}

// 工具函数
const getProviderIcon = (type: string) => {
  // 这里可以返回不同的图标组件
  return 'div' // 简化处理
}

const getProviderName = (providerId: string) => {
  const provider = llmManager.availableProviders.value.find(p => p.id === providerId)
  return provider?.name || providerId
}
</script>

<style scoped>
.llm-config-panel {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 20px; /* 确保底部有空间 */
}

.panel-header {
  text-align: center;
  margin-bottom: 32px;
}

.panel-title {
  font-size: 24px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 8px 0;
}

.panel-subtitle {
  color: #8e8e93;
  margin: 0;
}

.loading-state {
  text-align: center;
  padding: 48px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007AFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.config-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 16px 0;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .provider-grid {
    grid-template-columns: 1fr;
  }
  
  .llm-config-panel {
    padding: 16px;
    margin: 0 -4px;
  }
}

.provider-card {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #e5e5ea;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.provider-card:hover {
  border-color: #007AFF;
  transform: translateY(-2px);
}

.provider-card.active {
  border-color: #007AFF;
  background: rgba(0, 122, 255, 0.05);
}

.provider-icon {
  width: 40px;
  height: 40px;
  background: #f2f2f7;
  border-radius: 8px;
  margin-right: 12px;
}

.provider-info {
  flex: 1;
}

.provider-name {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 4px 0;
}

.status-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.status-badge.success {
  background: #d1f2eb;
  color: #00875a;
}

.status-badge.warning {
  background: #fff4e6;
  color: #974f0c;
}

.status-badge.error {
  background: #ffebe6;
  color: #de350b;
}

.btn-configure, .btn-test {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-configure {
  background: #007AFF;
  color: white;
}

.btn-test {
  background: #f2f2f7;
  color: #1d1d1f;
}

.model-selector {
  display: flex;
  gap: 12px;
  align-items: center;
}

.model-select {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  font-size: 14px;
}

.btn-refresh {
  padding: 12px 16px;
  background: #f2f2f7;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item label {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

.range-input, .number-input {
  padding: 8px 12px;
  border: 1px solid #d1d1d6;
  border-radius: 6px;
}

.setting-value {
  font-size: 12px;
  color: #8e8e93;
  text-align: center;
}

.config-dialog-overlay {
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
}

.config-dialog {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 0.5px solid #d1d1d6;
  border-radius: 8px;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #007AFF;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.1);
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn-cancel, .btn-save {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel {
  background: #f2f2f7;
  color: #1d1d1f;
}

.btn-save {
  background: #007AFF;
  color: white;
}

.ollama-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-item {
  display: flex;
  gap: 12px;
}

.model-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #d1d1d6;
  border-radius: 8px;
}

.btn-pull {
  padding: 12px 16px;
  background: #34c759;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.pull-progress {
  padding: 8px 12px;
  background: #f2f2f7;
  border-radius: 6px;
  font-size: 12px;
  color: #8e8e93;
}
</style>