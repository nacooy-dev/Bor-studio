<template>
  <div class="install-dialog-overlay" @click="handleOverlayClick">
    <div class="install-dialog" @click.stop>
      <!-- 对话框头部 -->
      <div class="dialog-header">
        <h3>安装 {{ server?.name }}</h3>
        <button class="close-button" @click="$emit('cancel')">
          <i class="icon-close"></i>
        </button>
      </div>

      <!-- 服务器信息 -->
      <div class="server-info-section">
        <div class="server-basic-info">
          <p class="description">{{ server?.description }}</p>
          <div class="tech-info">
            <span class="tech-item">
              <i class="icon-command"></i>
              {{ server?.command }} {{ server?.args.join(' ') }}
            </span>
            <span v-if="server?.requirements" class="tech-item">
              <i class="icon-requirements"></i>
              需要: {{ server?.requirements.join(', ') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 参数配置 -->
      <div v-if="server?.parameters && server.parameters.length > 0" class="parameters-section">
        <h4>配置参数</h4>
        <div class="parameters-form">
          <div
            v-for="param in server.parameters"
            :key="param.key"
            class="parameter-group"
          >
            <label :for="param.key" class="parameter-label">
              {{ param.description }}
              <span v-if="param.required" class="required">*</span>
            </label>

            <!-- 字符串/路径输入 -->
            <input
              v-if="param.type === 'string' || param.type === 'path'"
              :id="param.key"
              v-model="parameters[param.key]"
              :type="param.type === 'path' ? 'text' : 'text'"
              :placeholder="param.placeholder || ''"
              :required="param.required"
              class="parameter-input"
              @blur="validateParameter(param)"
            />

            <!-- 数字输入 -->
            <input
              v-else-if="param.type === 'number'"
              :id="param.key"
              v-model.number="parameters[param.key]"
              type="number"
              :placeholder="param.placeholder || ''"
              :required="param.required"
              :min="param.validation?.min"
              :max="param.validation?.max"
              class="parameter-input"
              @blur="validateParameter(param)"
            />

            <!-- 布尔值选择 -->
            <label
              v-else-if="param.type === 'boolean'"
              class="checkbox-label"
            >
              <input
                :id="param.key"
                v-model="parameters[param.key]"
                type="checkbox"
                class="parameter-checkbox"
              />
              启用
            </label>

            <!-- 列表输入 -->
            <div v-else-if="param.type === 'list'" class="list-input">
              <div
                v-for="(item, index) in (parameters[param.key] || [])"
                :key="index"
                class="list-item"
              >
                <input
                  v-model="parameters[param.key][index]"
                  type="text"
                  :placeholder="param.placeholder || ''"
                  class="parameter-input"
                />
                <button
                  type="button"
                  class="remove-item-btn"
                  @click="removeListItem(param.key, index)"
                >
                  <i class="icon-minus"></i>
                </button>
              </div>
              <button
                type="button"
                class="add-item-btn"
                @click="addListItem(param.key)"
              >
                <i class="icon-plus"></i>
                添加项目
              </button>
            </div>

            <!-- 路径选择按钮 -->
            <button
              v-if="param.type === 'path'"
              type="button"
              class="path-select-btn"
              @click="selectPath(param.key)"
            >
              <i class="icon-folder"></i>
              选择路径
            </button>

            <!-- 参数错误 -->
            <div v-if="parameterErrors[param.key]" class="parameter-error">
              {{ parameterErrors[param.key] }}
            </div>

            <!-- 参数帮助 -->
            <div v-if="param.validation?.options" class="parameter-help">
              可选值: {{ param.validation.options.join(', ') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 环境变量预览 -->
      <div v-if="hasEnvironmentVariables" class="env-preview-section">
        <h4>环境变量</h4>
        <div class="env-preview">
          <div
            v-for="[key, value] in Object.entries(processedEnv)"
            :key="key"
            class="env-item"
          >
            <span class="env-key">{{ key }}</span>
            <span class="env-value">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- 安装进度 -->
      <div v-if="installationState?.status === 'installing' || installationState?.status === 'testing'" class="progress-section">
        <div class="progress-header">
          <span>{{ installationState.message }}</span>
          <span v-if="installationState.progress">{{ installationState.progress }}%</span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${installationState.progress || 0}%` }"
          ></div>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="installationState?.status === 'failed'" class="error-section">
        <div class="error-message">
          <i class="icon-error"></i>
          <span>{{ installationState.error }}</span>
        </div>
      </div>

      <!-- 对话框底部 -->
      <div class="dialog-footer">
        <button
          type="button"
          class="btn btn-secondary"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="!canInstall"
          class="btn btn-primary"
          @click="handleInstall"
        >
          <i v-if="isInstalling" class="icon-loading spinning"></i>
          <i v-else class="icon-download"></i>
          {{ getInstallButtonText() }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import type { MCPServerTemplate, MCPParameter } from '@/lib/mcp/server-registry'
import type { ServerInstallationState } from '@/lib/mcp/server-marketplace'
import { mcpInstaller } from '@/lib/mcp/server-installer'

interface Props {
  server: MCPServerTemplate | null
  installationState: ServerInstallationState | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  install: [server: MCPServerTemplate, parameters: Record<string, any>]
  cancel: []
}>()

// 响应式数据
const parameters = reactive<Record<string, any>>({})
const parameterErrors = reactive<Record<string, string>>({})

// 计算属性
const hasEnvironmentVariables = computed(() => {
  return props.server?.env && Object.keys(props.server.env).length > 0
})

const processedEnv = computed(() => {
  if (!props.server?.env) return {}
  
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(props.server.env)) {
    env[key] = value.replace(/<(\w+)>/g, (match, paramKey) => {
      const paramValue = parameters[paramKey]
      return paramValue !== undefined ? String(paramValue) : match
    })
  }
  return env
})

const canInstall = computed(() => {
  if (!props.server) return false
  if (isInstalling.value) return false
  
  // 检查必需参数
  if (props.server.parameters) {
    for (const param of props.server.parameters) {
      if (param.required && !parameters[param.key]) {
        return false
      }
    }
  }
  
  // 检查参数错误
  return Object.keys(parameterErrors).length === 0
})

const isInstalling = computed(() => {
  return props.installationState?.status === 'installing' || 
         props.installationState?.status === 'testing'
})

// 方法
const initializeParameters = () => {
  if (!props.server?.parameters) return
  
  // 清空现有参数
  Object.keys(parameters).forEach(key => {
    delete parameters[key]
  })
  Object.keys(parameterErrors).forEach(key => {
    delete parameterErrors[key]
  })
  
  // 初始化参数默认值
  props.server.parameters.forEach(param => {
    if (param.default !== undefined) {
      parameters[param.key] = param.default
    } else if (param.type === 'list') {
      parameters[param.key] = []
    } else if (param.type === 'boolean') {
      parameters[param.key] = false
    }
  })
}

const validateParameter = (param: MCPParameter) => {
  const value = parameters[param.key]
  
  // 清除之前的错误
  delete parameterErrors[param.key]
  
  // 必需参数检查
  if (param.required && (value === undefined || value === null || value === '')) {
    parameterErrors[param.key] = '此参数是必需的'
    return
  }
  
  // 跳过空的可选参数
  if (!param.required && (value === undefined || value === null || value === '')) {
    return
  }
  
  // 使用安装器验证
  const validation = mcpInstaller.validateParameters(
    { ...props.server!, parameters: [param] },
    { [param.key]: value }
  )
  
  if (!validation.valid && validation.errors.length > 0) {
    parameterErrors[param.key] = validation.errors[0]
  }
}

const addListItem = (paramKey: string) => {
  if (!parameters[paramKey]) {
    parameters[paramKey] = []
  }
  parameters[paramKey].push('')
}

const removeListItem = (paramKey: string, index: number) => {
  if (parameters[paramKey] && Array.isArray(parameters[paramKey])) {
    parameters[paramKey].splice(index, 1)
  }
}

const selectPath = async (paramKey: string) => {
  // 在Electron环境中调用文件选择对话框
  if (typeof window !== 'undefined' && (window as any).electronAPI?.dialog) {
    try {
      const result = await (window as any).electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择目录'
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        parameters[paramKey] = result.filePaths[0]
      }
    } catch (error) {
      console.error('选择路径失败:', error)
    }
  } else {
    // 非Electron环境，提示用户手动输入
    alert('请手动输入路径')
  }
}

const handleInstall = () => {
  if (!props.server || !canInstall.value) return
  
  // 验证所有参数
  if (props.server.parameters) {
    for (const param of props.server.parameters) {
      validateParameter(param)
    }
  }
  
  // 如果有错误，不继续安装
  if (Object.keys(parameterErrors).length > 0) {
    return
  }
  
  emit('install', props.server, { ...parameters })
}

const handleOverlayClick = () => {
  if (!isInstalling.value) {
    emit('cancel')
  }
}

const getInstallButtonText = (): string => {
  if (!props.installationState) return '安装'
  
  switch (props.installationState.status) {
    case 'installing':
      return '安装中...'
    case 'testing':
      return '测试中...'
    case 'failed':
      return '重试安装'
    default:
      return '安装'
  }
}

// 监听器
watch(() => props.server, (newServer) => {
  if (newServer) {
    initializeParameters()
  }
}, { immediate: true })

// 生命周期
onMounted(() => {
  initializeParameters()
})
</script>

<style scoped>
.install-dialog-overlay {
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

.install-dialog {
  background: var(--card-bg);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0 24px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
  color: #666;
}

.close-button:hover {
  color: #333;
}

.server-info-section {
  padding: 0 20px;
  margin-bottom: 20px;
}

.description {
  margin: 0 0 10px 0;
  color: #666;
  line-height: 1.4;
}

.tech-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tech-item {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: monospace;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
}

.parameters-section {
  padding: 0 20px;
  margin-bottom: 20px;
}

.parameters-section h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.parameter-group {
  margin-bottom: 20px;
}

.parameter-label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #333;
}

.required {
  color: #dc3545;
}

.parameter-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.2s ease;
  background: var(--input-bg);
  color: var(--text-primary);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.parameter-input:focus {
  outline: none;
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.parameter-checkbox {
  margin: 0;
}

.list-input {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}

.list-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.list-item .parameter-input {
  flex: 1;
  margin: 0;
}

.remove-item-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-item-btn {
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.path-select-btn {
  margin-top: 5px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.parameter-error {
  color: #dc3545;
  font-size: 12px;
  margin-top: 4px;
}

.parameter-help {
  color: #666;
  font-size: 12px;
  margin-top: 4px;
  font-style: italic;
}

.env-preview-section {
  padding: 0 20px;
  margin-bottom: 20px;
}

.env-preview-section h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
}

.env-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
}

.env-item {
  display: flex;
  margin-bottom: 4px;
}

.env-key {
  color: #007bff;
  margin-right: 8px;
  font-weight: 500;
}

.env-value {
  color: #28a745;
}

.progress-section {
  padding: 0 20px;
  margin-bottom: 20px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.error-section {
  padding: 0 20px;
  margin-bottom: 20px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 14px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--hover-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--card-bg);
  transform: translateY(-1px);
}

.btn-primary {
  background: rgba(0, 122, 255, 0.8);
  color: white;
  border: 1px solid rgba(0, 122, 255, 0.5);
}

.btn-primary:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.9);
  transform: translateY(-1px);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 图标样式 */
.icon-close::before { content: "✕"; }
.icon-command::before { content: "$"; }
.icon-requirements::before { content: "📋"; }
.icon-loading::before { content: "⟳"; }
.icon-download::before { content: "⬇"; }
.icon-error::before { content: "✗"; }
.icon-plus::before { content: "+"; }
.icon-minus::before { content: "−"; }
.icon-folder::before { content: "📁"; }
</style>