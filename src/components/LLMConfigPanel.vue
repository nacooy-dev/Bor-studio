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
                class="btn-configure"
                @click.stop="configureProvider(provider.id)"
              >
                {{ provider.isConfigured ? '编辑' : '配置' }}
              </button>
              <button
                v-if="provider.isConfigured"
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
        
        <!-- 当前默认模型显示 -->
        <div v-if="llmManager.currentModel.value" class="current-model-info">
          <div class="current-model-card">
            <div class="model-icon">
              <div class="model-indicator"></div>
            </div>
            <div class="model-details">
              <h4 class="model-name">{{ getModelDisplayName(llmManager.currentModel.value) }}</h4>
              <p class="model-provider">{{ getProviderName(llmManager.currentProvider.value) }}</p>
            </div>
            <div class="model-status">
              <span class="status-badge success">当前默认</span>
            </div>
          </div>
        </div>
        
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
              {{ model.name }}
            </option>
          </select>
          <button
            class="btn-refresh"
            @click="refreshModels"
            :disabled="refreshingModels"
          >
            {{ refreshingModels ? '刷新中...' : '刷新模型' }}
          </button>
          <button
            v-if="llmManager.currentModel.value"
            class="btn-test-model"
            @click="testCurrentModel"
            :disabled="testingModel"
          >
            {{ testingModel ? '测试中...' : '测试可用性' }}
          </button>
          <button
            v-if="llmManager.currentModel.value"
            class="btn-set-default"
            @click="setAsDefault"
          >
            设为默认模型
          </button>
        </div>
        
        <!-- 模型信息 -->
        <div v-if="selectedModelInfo" class="model-info">
          <div class="info-item">
            <span class="info-label">模型 ID:</span>
            <span class="info-value">{{ selectedModelInfo.id }}</span>
          </div>
          <div v-if="selectedModelInfo.description" class="info-item">
            <span class="info-label">描述:</span>
            <span class="info-value">{{ selectedModelInfo.description }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">上下文长度:</span>
            <span class="info-value">{{ selectedModelInfo.contextLength || 'N/A' }} tokens</span>
          </div>
          <div v-if="selectedModelInfo.pricing" class="info-item">
            <span class="info-label">定价:</span>
            <span class="info-value">
              输入: ${{ selectedModelInfo.pricing.prompt || selectedModelInfo.pricing.input || 'N/A' }}/1K tokens,
              输出: ${{ selectedModelInfo.pricing.completion || selectedModelInfo.pricing.output || 'N/A' }}/1K tokens
            </span>
          </div>
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
        <h3>{{ isEditingProvider ? '编辑' : '配置' }} {{ getProviderName(configuringProvider) }}</h3>
        
        <div class="dialog-content">
          <!-- OpenAI 配置 -->
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

          <!-- OpenRouter 配置 -->
          <div v-if="configuringProvider === 'openrouter'" class="config-form">
            <div class="form-group">
              <label for="openrouter-api-key">API 密钥</label>
              <input
                id="openrouter-api-key"
                v-model="providerConfig.apiKey"
                type="password"
                placeholder="sk-or-v1-..."
                class="form-input"
              />
              <small class="form-help">从 <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a> 获取 API 密钥</small>
            </div>
          </div>

          <!-- Gemini 配置 -->
          <div v-if="configuringProvider === 'gemini'" class="config-form">
            <div class="form-group">
              <label for="gemini-api-key">API 密钥</label>
              <input
                id="gemini-api-key"
                v-model="providerConfig.apiKey"
                type="password"
                placeholder="AI..."
                class="form-input"
              />
              <small class="form-help">从 <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a> 获取 API 密钥</small>
            </div>
          </div>

          <!-- 智谱 AI 配置 -->
          <div v-if="configuringProvider === 'zhipu'" class="config-form">
            <div class="form-group">
              <label for="zhipu-api-key">API 密钥</label>
              <input
                id="zhipu-api-key"
                v-model="providerConfig.apiKey"
                type="password"
                placeholder="..."
                class="form-input"
              />
              <small class="form-help">从 <a href="https://open.bigmodel.cn/" target="_blank">智谱 AI 开放平台</a> 获取 API 密钥</small>
            </div>
          </div>



          <!-- 自定义提供商配置 -->
          <div v-if="configuringProvider === 'custom'" class="config-form">
            <div class="form-group">
              <label for="custom-id">提供商 ID</label>
              <input
                id="custom-id"
                v-model="providerConfig.id"
                type="text"
                placeholder="custom-provider-1"
                class="form-input"
                required
              />
            </div>
            <div class="form-group">
              <label for="custom-name">显示名称</label>
              <input
                id="custom-name"
                v-model="providerConfig.name"
                type="text"
                placeholder="我的自定义服务"
                class="form-input"
                required
              />
            </div>
            <div class="form-group">
              <label for="custom-base-url">基础 URL</label>
              <input
                id="custom-base-url"
                v-model="providerConfig.baseUrl"
                type="url"
                placeholder="http://localhost:8000/v1"
                class="form-input"
                required
              />
            </div>
            <div class="form-group">
              <label for="custom-api-key">API 密钥 (可选)</label>
              <input
                id="custom-api-key"
                v-model="providerConfig.apiKey"
                type="password"
                placeholder="如果需要认证请填写"
                class="form-input"
              />
            </div>
          </div>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { llmManager } from '../lib/llm-manager'
import type { ChatSettings } from '../lib/models'

// 响应式状态
const testingProvider = ref<string>('')
const testingModel = ref(false)
const refreshingModels = ref(false)
const showConfigDialog = ref(false)
const configuringProvider = ref<string>('')
const providerConfig = reactive<any>({})
const newModelName = ref('')
const pullingModel = ref(false)
const pullProgress = ref('')

const isEditingProvider = ref(false)


// 设置
const settings = reactive<ChatSettings>(llmManager.getSettings())

// 计算属性
const selectedModelInfo = computed(() => {
  if (!llmManager.currentModel.value) return null
  return llmManager.availableModels.value.find(m => m.id === llmManager.currentModel.value)
})

// 生命周期
onMounted(async () => {
  try {
    await llmManager.initialize()
  } catch (error) {
    console.error('配置面板初始化失败:', error)
    // 即使初始化失败也要显示界面
    alert('配置面板初始化遇到问题，部分功能可能不可用。请检查控制台错误信息。')
  }
})

// 方法
const selectProvider = async (providerId: string) => {
  try {
    await llmManager.setProvider(providerId)
    
    // 检查提供商状态，如果未配置则提示用户配置
    const provider = llmManager.getProvider(providerId)
    if (provider && !provider.isConfigured()) {
      // 自动打开配置对话框
      setTimeout(() => {
        configureProvider(providerId)
      }, 100)
    }
  } catch (error) {
    console.error('Failed to select provider:', error)
    alert(`选择提供商失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const selectModel = () => {
  try {
    // 模型选择后的逻辑，如果需要的话
    llmManager.setModel(llmManager.currentModel.value)
  } catch (error) {
    console.error('模型选择失败:', error)
    alert(`模型选择失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
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
  try {
    configuringProvider.value = providerId
    
    // 获取现有配置
    const provider = llmManager.getProvider(providerId)
    const existingConfig = provider?.getConfig() || {}
    
    // 判断是否为编辑模式
    isEditingProvider.value = provider?.isConfigured() || false
    
    // 根据提供商类型设置默认配置
    const defaultConfig = {
      apiKey: '',
      baseUrl: '',
      name: '',
      models: []
    }
    
    // 为不同提供商设置特定的默认值
    switch (providerId) {
      case 'openai':
        defaultConfig.baseUrl = 'https://api.openai.com/v1'
        break
      case 'openrouter':
        defaultConfig.baseUrl = 'https://openrouter.ai/api/v1'
        break
      case 'gemini':
        defaultConfig.baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
        break
      case 'zhipu':
        defaultConfig.baseUrl = 'https://open.bigmodel.cn/api/paas/v4'
        break
    }
    
    Object.assign(providerConfig, {
      ...defaultConfig,
      ...existingConfig
    })
    
    showConfigDialog.value = true
  } catch (error) {
    console.error('配置提供商失败:', error)
    alert(`配置提供商失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const closeConfigDialog = () => {
  try {
    showConfigDialog.value = false
    configuringProvider.value = ''
    isEditingProvider.value = false
    Object.assign(providerConfig, {})
  } catch (error) {
    console.error('关闭配置对话框失败:', error)
  }
}

const saveProviderConfig = async () => {
  try {
    // 配置现有提供商
    await llmManager.configureProvider(configuringProvider.value, { ...providerConfig })
    
    closeConfigDialog()
    alert('配置保存成功！')
    
    // 刷新提供商列表
    await llmManager.refreshProviders()
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

const getModelDisplayName = (modelId: string) => {
  // 从所有提供商中查找模型
  for (const provider of llmManager.availableProviders.value) {
    const model = provider.models.find(m => m.id === modelId)
    if (model) {
      return model.name || model.id
    }
  }
  return modelId
}



// 测试当前模型
const testCurrentModel = async () => {
  if (!llmManager.currentModel.value) return
  
  testingModel.value = true
  
  try {
    // 测试模型可用性
    const testMessage = [{ 
      id: '1', 
      role: 'user' as const, 
      content: 'Say "Hello" to test the connection', 
      timestamp: Date.now() 
    }]
    
    const response = await llmManager.chat(testMessage, {
      model: llmManager.currentModel.value,
      settings: { ...settings, maxTokens: 50 }
    })
    
    if (response && response.trim()) {
      alert(`✅ 模型测试成功！\n模型: ${getModelDisplayName(llmManager.currentModel.value)}\n响应: ${response.slice(0, 100)}${response.length > 100 ? '...' : ''}`)
    } else {
      alert(`⚠️ 模型连接成功，但没有返回内容\n模型: ${getModelDisplayName(llmManager.currentModel.value)}\n这可能是正常的，取决于模型配置`)
    }
  } catch (error) {
    alert(`❌ 模型测试失败\n模型: ${getModelDisplayName(llmManager.currentModel.value)}\n错误: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    testingModel.value = false
  }
}

// 设为默认模型
const setAsDefault = async () => {
  if (!llmManager.currentModel.value) {
    alert('请先选择一个模型')
    return
  }
  
  try {
    // 保存当前选择为默认
    llmManager.setModel(llmManager.currentModel.value)
    
    // 同时保存提供商选择
    if (llmManager.currentProvider.value) {
      await llmManager.setProvider(llmManager.currentProvider.value)
    }
    
    // 保存配置到本地存储
    await llmManager.save()
    
    alert(`✅ 已设置 ${getModelDisplayName(llmManager.currentModel.value)} 为默认模型和提供商`)
  } catch (error) {
    alert(`❌ 设置默认模型失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
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

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
}

.btn-add-custom {
  padding: 8px 16px;
  background: #007AFF;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-add-custom:hover {
  background: #0056CC;
}

/* 当前模型信息卡片 */
.current-model-info {
  margin-bottom: 20px;
}

.current-model-card {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #007AFF;
  border-radius: 12px;
  background: rgba(0, 122, 255, 0.05);
}

.model-icon {
  width: 40px;
  height: 40px;
  background: #007AFF;
  border-radius: 8px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-indicator {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
}

.model-details {
  flex: 1;
}

.model-name {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 4px 0;
  color: #1d1d1f;
}

.model-provider {
  font-size: 14px;
  color: #8e8e93;
  margin: 0;
}

.model-status {
  display: flex;
  align-items: center;
}

/* 手动模型配置样式 */


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

.btn-configure, .btn-edit {
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

.btn-refresh, .btn-test-model, .btn-set-default {
  padding: 12px 16px;
  background: #f2f2f7;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-test-model {
  background: #34c759;
  color: white;
}

.btn-set-default {
  background: #007AFF;
  color: white;
}

.btn-refresh:hover, .btn-test-model:hover, .btn-set-default:hover {
  transform: translateY(-1px);
}

.model-info {
  margin-top: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 500;
  color: #666;
}

.info-value {
  color: #333;
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

.form-help {
  font-size: 11px;
  color: #8e8e93;
  margin-top: 4px;
  display: block;
}

.form-help a {
  color: #007AFF;
  text-decoration: none;
}

.form-help a:hover {
  text-decoration: underline;
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