<template>
  <!-- MCP服务器配置对话框 -->
  <div v-if="showDialog" class="config-dialog-overlay" @click="closeDialog">
    <div class="config-dialog" @click.stop>
      <div class="dialog-header">
        <h3>{{ isInstalling ? '安装' : '配置' }} {{ server?.name }}</h3>
        <button class="close-button" @click="closeDialog">×</button>
      </div>

      <div class="dialog-content">
        <!-- 服务器信息 -->
        <div class="server-info">
          <p class="server-description">{{ server?.description }}</p>
          <div class="server-meta">
            <span class="meta-item">
              <strong>命令:</strong> {{ server?.command }} {{ server?.args.join(' ') }}
            </span>
            <span v-if="server?.requirements" class="meta-item">
              <strong>依赖:</strong> {{ server?.requirements.join(', ') }}
            </span>
          </div>
        </div>

        <!-- 参数配置表单 -->
        <div v-if="server?.parameters && server.parameters.length > 0" class="config-form">
          <h4>配置参数</h4>
          <div
            v-for="param in server.parameters"
            :key="param.key"
            class="form-group"
          >
            <label :for="param.key">
              {{ param.description }}
              <span v-if="param.required" class="required">*</span>
            </label>

            <!-- 字符串/路径输入 -->
            <div v-if="param.type === 'string' || param.type === 'path'" class="input-group">
              <input
                :id="param.key"
                v-model="parameters[param.key]"
                :type="param.type === 'path' ? 'text' : 'text'"
                :placeholder="param.placeholder || ''"
                :required="param.required"
                class="form-input"
                @blur="validateParameter(param)"
              />
              <button
                v-if="param.type === 'path'"
                type="button"
                class="path-button"
                @click="selectPath(param.key)"
                title="选择路径"
              >
                📁
              </button>
            </div>

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
              class="form-input"
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
                class="form-checkbox"
              />
              启用此选项
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
                  class="form-input"
                />
                <button
                  type="button"
                  class="remove-button"
                  @click="removeListItem(param.key, index)"
                  title="删除"
                >
                  ×
                </button>
              </div>
              <button
                type="button"
                class="add-button"
                @click="addListItem(param.key)"
              >
                + 添加项目
              </button>
            </div>

            <!-- 参数错误提示 -->
            <div v-if="parameterErrors[param.key]" class="error-message">
              {{ parameterErrors[param.key] }}
            </div>

            <!-- 参数帮助信息 -->
            <div v-if="param.validation?.options" class="help-text">
              可选值: {{ param.validation.options.join(', ') }}
            </div>
          </div>
        </div>

        <!-- 环境变量预览 -->
        <div v-if="hasEnvironmentVariables" class="env-preview">
          <h4>环境变量</h4>
          <div class="env-list">
            <div
              v-for="[key, value] in Object.entries(processedEnv)"
              :key="key"
              class="env-item"
            >
              <code class="env-key">{{ key }}</code>
              <code class="env-value">{{ value }}</code>
            </div>
          </div>
        </div>

        <!-- 安装进度 -->
        <div v-if="installationState?.status === 'installing' || installationState?.status === 'testing'" class="progress-section">
          <div class="progress-info">
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
          <div class="error-alert">
            <strong>安装失败:</strong> {{ installationState.error }}
          </div>
        </div>
      </div>

      <!-- 对话框操作按钮 -->
      <div class="dialog-actions">
        <button
          type="button"
          class="btn-cancel"
          @click="closeDialog"
          :disabled="isInstalling"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="!canProceed"
          class="btn-save"
          @click="handleInstall"
        >
          {{ getActionButtonText() }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import type { MCPServerTemplate, MCPParameter } from '@/lib/mcp/server-registry'
import type { ServerInstallationState } from '@/lib/mcp/server-marketplace'
import { mcpInstaller } from '@/lib/mcp/server-installer'

interface Props {
  server: MCPServerTemplate | null
  installationState: ServerInstallationState | null
  showDialog: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  install: [server: MCPServerTemplate, parameters: Record<string, any>]
  close: []
}>()

// 响应式数据
const parameters = reactive<Record<string, any>>({})
const parameterErrors = reactive<Record<string, string>>({})

// 计算属性
const isInstalling = computed(() => {
  return props.installationState?.status === 'installing' || 
         props.installationState?.status === 'testing'
})

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

const canProceed = computed(() => {
  if (!props.server || isInstalling.value) return false
  
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
  if (props.server) {
    const validation = mcpInstaller.validateParameters(
      { ...props.server, parameters: [param] },
      { [param.key]: value }
    )
    
    if (!validation.valid && validation.errors.length > 0) {
      parameterErrors[param.key] = validation.errors[0]
    }
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
  }
}

const handleInstall = () => {
  if (!props.server || !canProceed.value) return
  
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

const closeDialog = () => {
  if (!isInstalling.value) {
    emit('close')
  }
}

const getActionButtonText = (): string => {
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

watch(() => props.showDialog, (show) => {
  if (show && props.server) {
    initializeParameters()
  }
})
</script>

<style scoped>
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
  background: var(--card-bg);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
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
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.dialog-content {
  padding: 0 24px;
}

.server-info {
  margin-bottom: 24px;
}

.server-description {
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  line-height: 1.4;
}

.server-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
  background: var(--hover-bg);
  padding: 4px 8px;
  border-radius: 4px;
}

.config-form h4,
.env-preview h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text-primary);
}

.required {
  color: #ff3b30;
}

.input-group {
  display: flex;
  gap: 8px;
}

.form-input {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.form-input:focus {
  outline: none;
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

.path-button {
  padding: 12px;
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.path-button:hover {
  background: var(--card-bg);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.form-checkbox {
  margin: 0;
}

.list-input {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--input-bg);
}

.list-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.list-item .form-input {
  margin: 0;
}

.remove-button {
  padding: 12px;
  background: #ff3b30;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}

.add-button {
  background: rgba(52, 199, 89, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.add-button:hover {
  background: rgba(52, 199, 89, 0.9);
}

.error-message {
  color: #ff3b30;
  font-size: 12px;
  margin-top: 4px;
}

.help-text {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 4px;
  font-style: italic;
}

.env-preview {
  margin-bottom: 24px;
}

.env-list {
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
}

.env-item {
  display: flex;
  margin-bottom: 4px;
}

.env-key {
  color: rgba(0, 122, 255, 0.8);
  margin-right: 8px;
  font-weight: 500;
}

.env-value {
  color: rgba(52, 199, 89, 0.8);
}

.progress-section {
  margin-bottom: 24px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--hover-bg);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: rgba(0, 122, 255, 0.8);
  transition: width 0.3s ease;
}

.error-section {
  margin-bottom: 24px;
}

.error-alert {
  padding: 12px;
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 8px;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid var(--border-color);
}

.btn-cancel, .btn-save {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.btn-cancel {
  background: var(--hover-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--card-bg);
  transform: translateY(-1px);
}

.btn-save {
  background: rgba(0, 122, 255, 0.8);
  color: white;
  border: 1px solid rgba(0, 122, 255, 0.5);
}

.btn-save:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.9);
  transform: translateY(-1px);
}

.btn-cancel:disabled,
.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>