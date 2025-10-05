<template>
  <div class="mcp-tool-executor">
    <div class="header">
      <h3>MCP 工具执行</h3>
      <div class="tool-count">
        {{ availableTools.length }} 个可用工具
      </div>
    </div>

    <!-- 工具搜索 -->
    <div class="search-section">
      <div class="search-input">
        <Search class="w-4 h-4 text-gray-400" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索工具或描述功能..."
          @input="handleSearch"
        />
      </div>
      
      <div v-if="searchQuery && matchedTools.length > 0" class="search-results">
        <h4>匹配的工具:</h4>
        <div class="tool-suggestions">
          <div 
            v-for="match in matchedTools.slice(0, 5)" 
            :key="`${match.tool.server}:${match.tool.name}`"
            @click="selectTool(match.tool)"
            class="tool-suggestion"
          >
            <div class="tool-info">
              <span class="tool-name">{{ match.tool.name }}</span>
              <span class="tool-server">{{ match.tool.server }}</span>
            </div>
            <div class="confidence">
              {{ Math.round(match.confidence * 100) }}%
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 选中的工具 -->
    <div v-if="selectedTool" class="selected-tool">
      <div class="tool-header">
        <div class="tool-info">
          <h4>{{ selectedTool.name }}</h4>
          <span class="server-badge">{{ selectedTool.server }}</span>
          <span class="risk-badge" :class="selectedTool.riskLevel">
            {{ getRiskText(selectedTool.riskLevel) }}
          </span>
        </div>
        <button @click="clearSelection" class="clear-btn">
          <X class="w-4 h-4" />
        </button>
      </div>
      
      <p class="tool-description">{{ selectedTool.description }}</p>

      <!-- 参数输入 -->
      <div class="parameters-section">
        <h5>参数配置</h5>
        
        <div v-if="Object.keys(toolParameters).length === 0" class="no-parameters">
          此工具无需参数
        </div>
        
        <div v-else class="parameter-inputs">
          <div 
            v-for="(param, name) in toolParameters" 
            :key="name"
            class="parameter-input"
          >
            <label>
              {{ name }}
              <span v-if="isRequired(name)" class="required">*</span>
            </label>
            
            <input 
              v-if="param.type === 'string'"
              v-model="parameterValues[name]"
              type="text" 
              :placeholder="param.description || `输入 ${name}`"
            />
            
            <input 
              v-else-if="param.type === 'number'"
              v-model.number="parameterValues[name]"
              type="number" 
              :placeholder="param.description || `输入 ${name}`"
            />
            
            <input 
              v-else-if="param.type === 'boolean'"
              v-model="parameterValues[name]"
              type="checkbox"
            />
            
            <textarea 
              v-else
              v-model="parameterValues[name]"
              :placeholder="param.description || `输入 ${name}`"
              rows="3"
            ></textarea>
            
            <p v-if="param.description" class="param-description">
              {{ param.description }}
            </p>
          </div>
        </div>
      </div>

      <!-- 执行按钮 -->
      <div class="execution-section">
        <button 
          @click="executeTool"
          :disabled="!canExecute || executing"
          class="execute-btn"
          :class="selectedTool.riskLevel"
        >
          <Play v-if="!executing" class="w-4 h-4" />
          <div v-else class="spinner"></div>
          {{ executing ? '执行中...' : '执行工具' }}
        </button>
        
        <div v-if="missingParams.length > 0" class="missing-params">
          缺少必需参数: {{ missingParams.join(', ') }}
        </div>
      </div>
    </div>

    <!-- 执行历史 -->
    <div v-if="executionHistory.length > 0" class="execution-history">
      <h4>执行历史</h4>
      <div class="history-list">
        <div 
          v-for="(execution, index) in executionHistory.slice().reverse()" 
          :key="index"
          class="history-item"
          :class="{ success: execution.result.success, error: !execution.result.success }"
        >
          <div class="history-header">
            <div class="execution-info">
              <span class="tool-name">{{ execution.tool }}</span>
              <span class="server-name">{{ execution.server }}</span>
              <span class="timestamp">{{ formatTime(execution.timestamp) }}</span>
            </div>
            <div class="execution-status">
              <CheckCircle v-if="execution.result.success" class="w-4 h-4 text-green-500" />
              <XCircle v-else class="w-4 h-4 text-red-500" />
              <span class="duration">{{ execution.result.executionTime }}ms</span>
            </div>
          </div>
          
          <div class="execution-details">
            <details>
              <summary>查看详情</summary>
              <div class="details-content">
                <div class="parameters">
                  <h6>参数:</h6>
                  <pre>{{ JSON.stringify(execution.parameters, null, 2) }}</pre>
                </div>
                <div class="result">
                  <h6>结果:</h6>
                  <pre v-if="execution.result.success">{{ JSON.stringify(execution.result.data, null, 2) }}</pre>
                  <div v-else class="error-result">{{ execution.result.error }}</div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { 
  Search, X, Play, CheckCircle, XCircle 
} from 'lucide-vue-next'
import { mcpService } from '@/services/mcp'
import type { MCPToolCall } from '@/types'

// 响应式数据
const availableTools = ref<any[]>([])
const searchQuery = ref('')
const selectedTool = ref<any>(null)
const parameterValues = ref<Record<string, any>>({})
const executing = ref(false)
const executionHistory = ref<any[]>([])

// 简单的工具匹配逻辑
const matchedTools = computed(() => {
  if (!searchQuery.value.trim()) return []
  
  const query = searchQuery.value.toLowerCase()
  const matches = []
  
  for (const tool of availableTools.value) {
    let confidence = 0
    
    // 工具名称匹配
    if (tool.name.toLowerCase().includes(query)) {
      confidence += 0.8
    }
    
    // 描述匹配
    if (tool.description.toLowerCase().includes(query)) {
      confidence += 0.6
    }
    
    // 分类匹配
    if (tool.category && tool.category.toLowerCase().includes(query)) {
      confidence += 0.4
    }
    
    if (confidence > 0.3) {
      matches.push({ tool, confidence })
    }
  }
  
  return matches.sort((a, b) => b.confidence - a.confidence)
})

// 工具参数
const toolParameters = computed(() => {
  return selectedTool.value?.schema?.properties || {}
})

// 必需参数
const requiredParams = computed(() => {
  return selectedTool.value?.schema?.required || []
})

// 缺少的必需参数
const missingParams = computed(() => {
  return requiredParams.value.filter(param => 
    !parameterValues.value[param] && parameterValues.value[param] !== 0
  )
})

// 是否可以执行
const canExecute = computed(() => {
  return selectedTool.value && missingParams.value.length === 0
})

// 方法
const loadTools = async () => {
  const result = await mcpService.getTools()
  if (result.success && result.data) {
    availableTools.value = result.data
  }
}

const handleSearch = () => {
  // 搜索逻辑已在计算属性中处理
}

const selectTool = (tool: any) => {
  selectedTool.value = tool
  parameterValues.value = {}
  searchQuery.value = ''
  
  // 为参数设置默认值
  for (const [name, param] of Object.entries(toolParameters.value)) {
    const paramSchema = param as any
    if (paramSchema.type === 'boolean') {
      parameterValues.value[name] = false
    }
  }
}

const clearSelection = () => {
  selectedTool.value = null
  parameterValues.value = {}
}

const executeTool = async () => {
  if (!canExecute.value) return
  
  executing.value = true
  
  try {
    const call: MCPToolCall = {
      tool: selectedTool.value.name,
      server: selectedTool.value.server,
      parameters: { ...parameterValues.value },
      requestId: `exec_${Date.now()}`
    }
    
    const result = await mcpService.executeTool(call)
    
    // 记录执行历史
    executionHistory.value.push({
      tool: call.tool,
      server: call.server,
      parameters: call.parameters,
      result: result.data || result,
      timestamp: new Date()
    })
    
    if (result.success) {
      console.log('工具执行成功:', result.data)
    } else {
      console.error('工具执行失败:', result.error)
    }
    
  } catch (error) {
    console.error('执行工具时出错:', error)
    
    // 记录错误
    executionHistory.value.push({
      tool: selectedTool.value.name,
      server: selectedTool.value.server,
      parameters: parameterValues.value,
      result: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      },
      timestamp: new Date()
    })
  } finally {
    executing.value = false
  }
}

const isRequired = (paramName: string) => {
  return requiredParams.value.includes(paramName)
}

const getRiskText = (risk: string) => {
  const riskMap = {
    low: '低风险',
    medium: '中风险', 
    high: '高风险'
  }
  return riskMap[risk] || risk
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString()
}

// 生命周期
onMounted(async () => {
  await loadTools()
})

// 监听工具变化，重新加载
watch(() => availableTools.value.length, () => {
  // 可以在这里添加工具变化的处理逻辑
})
</script>

<style scoped>
.mcp-tool-executor {
  @apply p-6 space-y-6;
}

.header {
  @apply flex items-center justify-between;
}

.header h3 {
  @apply text-xl font-semibold text-gray-900 dark:text-white;
}

.tool-count {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.search-section {
  @apply space-y-4;
}

.search-input {
  @apply relative;
}

.search-input input {
  @apply w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.search-input .lucide {
  @apply absolute left-3 top-1/2 transform -translate-y-1/2;
}

.search-results h4 {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300 mb-2;
}

.tool-suggestions {
  @apply space-y-2;
}

.tool-suggestion {
  @apply flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600;
}

.tool-suggestion .tool-info {
  @apply flex items-center gap-2;
}

.tool-name {
  @apply font-medium text-gray-900 dark:text-white;
}

.tool-server {
  @apply text-xs px-2 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-full;
}

.confidence {
  @apply text-sm text-gray-500 dark:text-gray-400;
}

.selected-tool {
  @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4;
}

.tool-header {
  @apply flex items-start justify-between;
}

.tool-header .tool-info {
  @apply flex items-center gap-2 flex-wrap;
}

.tool-header h4 {
  @apply text-lg font-semibold text-gray-900 dark:text-white;
}

.server-badge {
  @apply text-xs px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-full;
}

.risk-badge {
  @apply text-xs px-2 py-1 rounded-full;
}

.risk-badge.low {
  @apply bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300;
}

.risk-badge.medium {
  @apply bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300;
}

.risk-badge.high {
  @apply bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300;
}

.clear-btn {
  @apply p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded;
}

.tool-description {
  @apply text-gray-600 dark:text-gray-400;
}

.parameters-section h5 {
  @apply text-sm font-medium text-gray-900 dark:text-white mb-3;
}

.no-parameters {
  @apply text-sm text-gray-500 dark:text-gray-400 italic;
}

.parameter-inputs {
  @apply space-y-4;
}

.parameter-input {
  @apply space-y-1;
}

.parameter-input label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.required {
  @apply text-red-500;
}

.parameter-input input, .parameter-input textarea {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.parameter-input input[type="checkbox"] {
  @apply w-auto;
}

.param-description {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.execution-section {
  @apply space-y-2;
}

.execute-btn {
  @apply flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50;
}

.execute-btn.low {
  @apply bg-green-600 text-white hover:bg-green-700;
}

.execute-btn.medium {
  @apply bg-yellow-600 text-white hover:bg-yellow-700;
}

.execute-btn.high {
  @apply bg-red-600 text-white hover:bg-red-700;
}

.spinner {
  @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
}

.missing-params {
  @apply text-sm text-red-600 dark:text-red-400;
}

.execution-history h4 {
  @apply text-lg font-semibold text-gray-900 dark:text-white mb-4;
}

.history-list {
  @apply space-y-3;
}

.history-item {
  @apply border rounded-lg p-3;
}

.history-item.success {
  @apply border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20;
}

.history-item.error {
  @apply border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20;
}

.history-header {
  @apply flex items-center justify-between;
}

.execution-info {
  @apply flex items-center gap-2 text-sm;
}

.execution-info .tool-name {
  @apply font-medium;
}

.execution-info .server-name {
  @apply text-gray-500 dark:text-gray-400;
}

.execution-info .timestamp {
  @apply text-gray-400 dark:text-gray-500;
}

.execution-status {
  @apply flex items-center gap-1 text-sm;
}

.duration {
  @apply text-gray-500 dark:text-gray-400;
}

.execution-details summary {
  @apply cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200;
}

.details-content {
  @apply mt-2 space-y-2;
}

.details-content h6 {
  @apply text-xs font-medium text-gray-700 dark:text-gray-300;
}

.details-content pre {
  @apply text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto;
}

.error-result {
  @apply text-red-600 dark:text-red-400 text-sm;
}
</style>