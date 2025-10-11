<template>
  <div class="dialog-overlay">
    <div class="dialog-backdrop" @click="$emit('close')"></div>
    <div class="dialog custom-server-dialog" @click.stop>
      <div class="dialog-header">
        <h3>添加自定义MCP服务器</h3>
        <button @click="$emit('close')" class="close-btn">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="dialog-content">
        <!-- 步骤指示器 -->
        <div class="steps-indicator">
          <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
            <div class="step-number">1</div>
            <div class="step-label">输入地址</div>
          </div>
          <div class="step-line" :class="{ completed: currentStep > 1 }"></div>
          <div class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
            <div class="step-number">2</div>
            <div class="step-label">解析信息</div>
          </div>
          <div class="step-line" :class="{ completed: currentStep > 2 }"></div>
          <div class="step" :class="{ active: currentStep === 3 }">
            <div class="step-number">3</div>
            <div class="step-label">确认配置</div>
          </div>
        </div>

        <!-- 步骤1: 输入地址 -->
        <div v-if="currentStep === 1" class="step-content">
          <div class="form-group">
            <label>服务器地址</label>
            <input 
              v-model="serverUrl" 
              type="text" 
              placeholder="输入GitHub仓库地址、npm包名或PyPI包名"
              @keyup.enter="parseServer"
              :disabled="parsing"
            />
            <div class="input-examples">
              <p>支持的格式：</p>
              <ul>
                <li><code>https://github.com/owner/repo</code> - GitHub仓库</li>
                <li><code>npm:package-name</code> - npm包</li>
                <li><code>pypi:package-name</code> - PyPI包</li>
              </ul>
            </div>
          </div>

          <div v-if="parseError" class="error-message">
            <AlertCircle class="w-4 h-4" />
            {{ parseError }}
          </div>
        </div>

        <!-- 步骤2: 解析中 -->
        <div v-if="currentStep === 2" class="step-content">
          <div class="parsing-status">
            <div class="loading-spinner">
              <Loader2 class="w-8 h-8 animate-spin" />
            </div>
            <h4>正在解析服务器信息...</h4>
            <p>{{ parseStatus }}</p>
          </div>
        </div>

        <!-- 步骤3: 确认配置 -->
        <div v-if="currentStep === 3" class="step-content">
          <div v-if="parsedServer" class="server-config">
            <!-- 解析结果摘要 -->
            <div class="parse-summary">
              <div class="confidence-indicator">
                <div class="confidence-bar">
                  <div 
                    class="confidence-fill" 
                    :style="{ width: `${(parsedInfo?.confidence || 0) * 100}%` }"
                    :class="getConfidenceClass(parsedInfo?.confidence || 0)"
                  ></div>
                </div>
                <span class="confidence-text">
                  解析置信度: {{ Math.round((parsedInfo?.confidence || 0) * 100) }}%
                </span>
              </div>

              <div v-if="parsedInfo?.suggestions" class="suggestions">
                <h5>💡 建议</h5>
                <ul>
                  <li v-for="suggestion in parsedInfo.suggestions" :key="suggestion">
                    {{ suggestion }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- 服务器配置表单 -->
            <div class="config-form">
              <div class="form-group">
                <label>服务器ID *</label>
                <input 
                  v-model="parsedServer.id" 
                  type="text" 
                  placeholder="唯一标识符"
                  required
                />
                <small class="form-hint">只能包含小写字母、数字、连字符和下划线</small>
              </div>

              <div class="form-group">
                <label>服务器名称 *</label>
                <input 
                  v-model="parsedServer.name" 
                  type="text" 
                  placeholder="显示名称"
                  required
                />
              </div>

              <div class="form-group">
                <label>描述</label>
                <textarea 
                  v-model="parsedServer.description" 
                  placeholder="服务器功能描述"
                  rows="2"
                ></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>启动命令 *</label>
                  <select v-model="parsedServer.command">
                    <option value="uvx">uvx (Python包)</option>
                    <option value="npx">npx (Node.js包)</option>
                    <option value="node">node (本地脚本)</option>
                    <option value="python">python (Python脚本)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>类别 *</label>
                  <select v-model="parsedServer.category">
                    <option value="filesystem">📂 文件系统</option>
                    <option value="knowledge">🧠 知识管理</option>
                    <option value="search">🔍 搜索</option>
                    <option value="database">🗄️ 数据库</option>
                    <option value="development">🛠️ 开发工具</option>
                    <option value="communication">💬 通信</option>
                    <option value="utility">🔧 实用工具</option>
                    <option value="cloud">☁️ 云服务</option>
                    <option value="content">📝 内容创作</option>
                    <option value="security">🔒 安全工具</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label>命令参数</label>
                <input 
                  v-model="argsText" 
                  type="text" 
                  placeholder="用空格分隔的参数"
                />
                <small class="form-hint">例如: -y package-name --option value</small>
              </div>

              <!-- 配置参数 -->
              <div v-if="parsedServer.parameters && parsedServer.parameters.length > 0" class="parameters-section">
                <h5>配置参数</h5>
                <div v-for="(param, index) in parsedServer.parameters" :key="index" class="parameter-item">
                  <div class="param-header">
                    <label>{{ param.key }}</label>
                    <span v-if="param.required" class="required-badge">必需</span>
                  </div>
                  <input 
                    v-model="param.placeholder" 
                    type="text" 
                    :placeholder="param.description"
                  />
                  <small class="form-hint">{{ param.description }}</small>
                </div>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    v-model="parsedServer.autoStart" 
                    type="checkbox"
                  />
                  <span class="checkmark"></span>
                  自动启动
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button 
          v-if="currentStep > 1" 
          @click="goBack" 
          class="btn-secondary"
          :disabled="adding"
        >
          上一步
        </button>
        
        <button @click="$emit('close')" class="btn-secondary">
          取消
        </button>
        
        <button 
          v-if="currentStep === 1" 
          @click="parseServer" 
          class="btn-primary"
          :disabled="!serverUrl.trim() || parsing"
        >
          {{ parsing ? '解析中...' : '解析服务器' }}
        </button>
        
        <button 
          v-if="currentStep === 3" 
          @click="addServer" 
          class="btn-primary"
          :disabled="!canAddServer || adding"
        >
          {{ adding ? '添加中...' : '添加服务器' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, AlertCircle, Loader2 } from 'lucide-vue-next'
import { customServerParser, type ParsedServerInfo } from '@/lib/mcp/custom-server-parser'
import { customServerManager } from '@/lib/mcp/custom-server-manager'
import type { MCPServerTemplate } from '@/lib/mcp/server-registry'

// 事件定义
const emit = defineEmits<{
  close: []
  added: [server: MCPServerTemplate]
}>()

// 响应式数据
const currentStep = ref(1)
const serverUrl = ref('')
const parsing = ref(false)
const adding = ref(false)
const parseStatus = ref('')
const parseError = ref('')
const parsedInfo = ref<ParsedServerInfo | null>(null)
const parsedServer = ref<MCPServerTemplate | null>(null)
const argsText = ref('')

// 计算属性
const canAddServer = computed(() => {
  return parsedServer.value && 
         parsedServer.value.id && 
         parsedServer.value.name && 
         parsedServer.value.command
})

// 监听参数文本变化
watch(argsText, (newValue) => {
  if (parsedServer.value) {
    parsedServer.value.args = newValue.trim() 
      ? newValue.trim().split(/\s+/) 
      : []
  }
})

// 方法
const parseServer = async () => {
  if (!serverUrl.value.trim()) return

  parsing.value = true
  parseError.value = ''
  currentStep.value = 2
  
  try {
    parseStatus.value = '正在获取服务器信息...'
    
    const result = await customServerParser.parseServerSource(serverUrl.value.trim())
    
    if (result.success && result.server) {
      parsedInfo.value = result
      parsedServer.value = result.server
      argsText.value = result.server.args.join(' ')
      currentStep.value = 3
      parseStatus.value = '解析完成'
    } else {
      parseError.value = result.error || '解析失败'
      currentStep.value = 1
    }
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : '解析过程中发生错误'
    currentStep.value = 1
  } finally {
    parsing.value = false
  }
}

const addServer = async () => {
  if (!parsedServer.value) return

  adding.value = true
  
  try {
    const result = await customServerManager.addCustomServer(
      parsedServer.value, 
      serverUrl.value
    )
    
    if (result.success) {
      emit('added', parsedServer.value)
      emit('close')
    } else {
      parseError.value = result.error || '添加服务器失败'
    }
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : '添加过程中发生错误'
  } finally {
    adding.value = false
  }
}

const goBack = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    parseError.value = ''
  }
}

const getConfidenceClass = (confidence: number) => {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.6) return 'medium'
  return 'low'
}
</script>

<style scoped>
.custom-server-dialog {
  width: 680px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.1),
    0 8px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  border-radius: 16px;
}

/* 深色模式支持 */
:deep(.dark) .custom-server-dialog,
.dark .custom-server-dialog {
  background: rgba(28, 28, 30, 0.98);
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 8px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.steps-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
  padding: 24px 32px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  position: relative;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.step.active .step-number {
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.9), rgba(64, 156, 255, 0.9));
  color: white;
  border: 2px solid rgba(0, 122, 255, 0.3);
  box-shadow: 
    0 4px 16px rgba(0, 122, 255, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.1);
  transform: scale(1.05);
}

.step.completed .step-number {
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.9), rgba(48, 176, 199, 0.9));
  color: white;
  border: 2px solid rgba(52, 199, 89, 0.3);
  box-shadow: 
    0 4px 16px rgba(52, 199, 89, 0.2),
    0 2px 8px rgba(0, 0, 0, 0.1);
}

.step-label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.step.active .step-label {
  color: rgba(0, 122, 255, 0.9);
  font-weight: 700;
}

.step.completed .step-label {
  color: rgba(52, 199, 89, 0.8);
}

/* 深色模式 - 步骤指示器 */
:deep(.dark) .steps-indicator,
.dark .steps-indicator {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.dark) .step-number,
.dark .step-number {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

:deep(.dark) .step-label,
.dark .step-label {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.dark) .step.active .step-label,
.dark .step.active .step-label {
  color: rgba(64, 156, 255, 0.9);
}

:deep(.dark) .step.completed .step-label,
.dark .step.completed .step-label {
  color: rgba(52, 199, 89, 0.9);
}

.step-line {
  width: 80px;
  height: 3px;
  background: rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.step-line.completed {
  background: linear-gradient(90deg, rgba(52, 199, 89, 0.8), rgba(48, 176, 199, 0.8));
  box-shadow: 0 2px 8px rgba(52, 199, 89, 0.2);
}

.step-line.completed::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

.step-content {
  min-height: 280px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.01);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

/* 深色模式 - 步骤内容 */
:deep(.dark) .step-content,
.dark .step-content {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin-bottom: 8px;
  letter-spacing: 0.3px;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.8);
  color: rgba(0, 0, 0, 0.9);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: rgba(0, 122, 255, 0.4);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 
    0 0 0 4px rgba(0, 122, 255, 0.1),
    0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: rgba(0, 0, 0, 0.4);
  font-weight: 400;
}

.input-examples {
  margin-top: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.03), rgba(64, 156, 255, 0.02));
  border-radius: 12px;
  border: 1px solid rgba(0, 122, 255, 0.1);
  font-size: 13px;
}

.input-examples p {
  margin: 0 0 12px 0;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  font-size: 14px;
}

.input-examples ul {
  margin: 0;
  padding-left: 20px;
}

.input-examples li {
  margin-bottom: 8px;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
}

.input-examples code {
  background: rgba(0, 122, 255, 0.1);
  color: rgba(0, 122, 255, 0.9);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(0, 122, 255, 0.15);
}

/* 深色模式 - 表单 */
:deep(.dark) .form-group label,
.dark .form-group label {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .form-group input,
:deep(.dark) .form-group textarea,
:deep(.dark) .form-group select,
.dark .form-group input,
.dark .form-group textarea,
.dark .form-group select {
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
}

:deep(.dark) .form-group input:focus,
:deep(.dark) .form-group textarea:focus,
:deep(.dark) .form-group select:focus,
.dark .form-group input:focus,
.dark .form-group textarea:focus,
.dark .form-group select:focus {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(64, 156, 255, 0.6);
  box-shadow: 
    0 0 0 4px rgba(64, 156, 255, 0.15),
    0 4px 12px rgba(0, 0, 0, 0.2);
}

:deep(.dark) .form-group input::placeholder,
:deep(.dark) .form-group textarea::placeholder,
.dark .form-group input::placeholder,
.dark .form-group textarea::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

:deep(.dark) .input-examples,
.dark .input-examples {
  background: linear-gradient(135deg, rgba(64, 156, 255, 0.08), rgba(0, 122, 255, 0.05));
  border: 1px solid rgba(64, 156, 255, 0.2);
}

:deep(.dark) .input-examples p,
.dark .input-examples p {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .input-examples li,
.dark .input-examples li {
  color: rgba(255, 255, 255, 0.7);
}

:deep(.dark) .input-examples code,
.dark .input-examples code {
  background: rgba(64, 156, 255, 0.15);
  color: rgba(64, 156, 255, 0.95);
  border: 1px solid rgba(64, 156, 255, 0.25);
}

.parsing-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  text-align: center;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.02), rgba(64, 156, 255, 0.01));
  border-radius: 16px;
  border: 1px solid rgba(0, 122, 255, 0.08);
}

.loading-spinner {
  margin-bottom: 24px;
  color: rgba(0, 122, 255, 0.8);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.parsing-status h4 {
  margin: 0 0 12px 0;
  color: rgba(0, 0, 0, 0.9);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.parsing-status p {
  margin: 0;
  color: rgba(0, 0, 0, 0.7);
  font-size: 15px;
  font-weight: 500;
}

/* 深色模式 - 解析状态 */
:deep(.dark) .parsing-status,
.dark .parsing-status {
  background: linear-gradient(135deg, rgba(64, 156, 255, 0.06), rgba(0, 122, 255, 0.03));
  border: 1px solid rgba(64, 156, 255, 0.15);
}

:deep(.dark) .parsing-status h4,
.dark .parsing-status h4 {
  color: rgba(255, 255, 255, 0.95);
}

:deep(.dark) .parsing-status p,
.dark .parsing-status p {
  color: rgba(255, 255, 255, 0.8);
}

.parse-summary {
  margin-bottom: 32px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.03), rgba(48, 176, 199, 0.02));
  border-radius: 16px;
  border: 1px solid rgba(52, 199, 89, 0.15);
  box-shadow: 0 4px 12px rgba(52, 199, 89, 0.05);
}

/* 深色模式 - 解析摘要 */
:deep(.dark) .parse-summary,
.dark .parse-summary {
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.08), rgba(48, 176, 199, 0.05));
  border: 1px solid rgba(52, 199, 89, 0.2);
}

.confidence-indicator {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.confidence-bar {
  flex: 1;
  height: 12px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.confidence-fill {
  height: 100%;
  border-radius: 8px;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.confidence-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 2s infinite;
}

.confidence-fill.high {
  background: linear-gradient(90deg, rgba(52, 199, 89, 0.9), rgba(48, 176, 199, 0.8));
  box-shadow: 0 2px 8px rgba(52, 199, 89, 0.3);
}

.confidence-fill.medium {
  background: linear-gradient(90deg, rgba(255, 149, 0, 0.9), rgba(255, 193, 7, 0.8));
  box-shadow: 0 2px 8px rgba(255, 149, 0, 0.3);
}

.confidence-fill.low {
  background: linear-gradient(90deg, rgba(255, 59, 48, 0.9), rgba(255, 99, 71, 0.8));
  box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
}

.confidence-text {
  font-size: 14px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.suggestions {
  padding: 20px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.suggestions h5 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestions ul {
  margin: 0;
  padding-left: 20px;
}

.suggestions li {
  margin-bottom: 8px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  font-weight: 500;
}

/* 深色模式 - 置信度和建议 */
:deep(.dark) .confidence-indicator,
.dark .confidence-indicator {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.dark) .confidence-bar,
.dark .confidence-bar {
  background: rgba(255, 255, 255, 0.1);
}

:deep(.dark) .confidence-text,
.dark .confidence-text {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .suggestions,
.dark .suggestions {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.dark) .suggestions h5,
.dark .suggestions h5 {
  color: rgba(255, 255, 255, 0.95);
}

:deep(.dark) .suggestions li,
.dark .suggestions li {
  color: rgba(255, 255, 255, 0.8);
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* 深色模式 - 配置表单 */
:deep(.dark) .config-form,
.dark .config-form {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.parameters-section {
  padding: 24px;
  background: linear-gradient(135deg, rgba(255, 149, 0, 0.03), rgba(255, 193, 7, 0.02));
  border-radius: 16px;
  border: 1px solid rgba(255, 149, 0, 0.15);
  box-shadow: 0 4px 12px rgba(255, 149, 0, 0.05);
}

.parameters-section h5 {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.3px;
}

.parameters-section h5::before {
  content: '⚙️';
  font-size: 18px;
}

/* 深色模式 - 参数部分 */
:deep(.dark) .parameters-section,
.dark .parameters-section {
  background: linear-gradient(135deg, rgba(255, 149, 0, 0.08), rgba(255, 193, 7, 0.05));
  border: 1px solid rgba(255, 149, 0, 0.2);
}

:deep(.dark) .parameters-section h5,
.dark .parameters-section h5 {
  color: rgba(255, 255, 255, 0.95);
}

.parameter-item {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.parameter-item:last-child {
  margin-bottom: 0;
}

.param-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.param-header label {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  letter-spacing: 0.3px;
}

/* 深色模式 - 参数项 */
:deep(.dark) .parameter-item,
.dark .parameter-item {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.dark) .param-header label,
.dark .param-header label {
  color: rgba(255, 255, 255, 0.95);
}

.required-badge {
  background: linear-gradient(135deg, rgba(255, 59, 48, 0.15), rgba(255, 99, 71, 0.1));
  color: rgba(255, 59, 48, 0.9);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid rgba(255, 59, 48, 0.2);
  box-shadow: 0 2px 4px rgba(255, 59, 48, 0.1);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(255, 59, 48, 0.08), rgba(255, 99, 71, 0.05));
  border: 1px solid rgba(255, 59, 48, 0.2);
  border-radius: 12px;
  color: rgba(255, 59, 48, 0.9);
  font-size: 14px;
  font-weight: 600;
  margin-top: 20px;
  box-shadow: 0 4px 12px rgba(255, 59, 48, 0.1);
}

.error-message svg {
  flex-shrink: 0;
}

.form-hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  margin-top: 6px;
  display: block;
  font-weight: 500;
  line-height: 1.4;
}

/* 深色模式 - 表单提示 */
:deep(.dark) .form-hint,
.dark .form-hint {
  color: rgba(255, 255, 255, 0.6);
}

/* 复选框样式 */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  padding: 12px 0;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: rgba(0, 122, 255, 0.8);
  cursor: pointer;
}

/* 深色模式 - 复选框 */
:deep(.dark) .checkbox-label,
.dark .checkbox-label {
  color: rgba(255, 255, 255, 0.9);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .custom-server-dialog {
    width: 95vw;
    margin: 16px;
    max-height: 90vh;
  }
  
  .steps-indicator {
    padding: 16px 20px;
    margin-bottom: 24px;
  }
  
  .step-content {
    padding: 16px;
    min-height: 240px;
  }
  
  .form-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .step-line {
    width: 60px;
  }
  
  .step-number {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
  
  .confidence-indicator {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  
  .confidence-bar {
    order: 2;
  }
  
  .confidence-text {
    order: 1;
  }
}

@media (max-width: 480px) {
  .custom-server-dialog {
    width: 98vw;
    margin: 8px;
    border-radius: 12px;
  }
  
  .steps-indicator {
    padding: 12px 16px;
    flex-direction: column;
    gap: 16px;
  }
  
  .step {
    flex-direction: row;
    gap: 8px;
  }
  
  .step-line {
    display: none;
  }
  
  .step-content {
    padding: 12px;
    min-height: 200px;
  }
  
  .parse-summary,
  .config-form,
  .parameters-section {
    padding: 16px;
  }
  
  .input-examples {
    padding: 12px 16px;
  }
}

/* 动画效果 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-content {
  animation: fadeInUp 0.3s ease-out;
}

/* 滚动条样式 */
.custom-server-dialog::-webkit-scrollbar {
  width: 6px;
}

.custom-server-dialog::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.custom-server-dialog::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.custom-server-dialog::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 深色模式滚动条 */
:deep(.dark) .custom-server-dialog::-webkit-scrollbar-track,
.dark .custom-server-dialog::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

:deep(.dark) .custom-server-dialog::-webkit-scrollbar-thumb,
.dark .custom-server-dialog::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

:deep(.dark) .custom-server-dialog::-webkit-scrollbar-thumb:hover,
.dark .custom-server-dialog::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>