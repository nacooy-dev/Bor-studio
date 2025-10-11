<template>
  <div class="ai-capabilities">
    <!-- 头部信息 -->
    <div class="capabilities-header">
      <h3 class="section-title">AI 学习状态</h3>
      <button class="btn-refresh" @click="refreshCapabilities" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新状态' }}
      </button>
    </div>

    <!-- 能力概览 -->
    <div class="capabilities-overview">
      <div class="overview-grid">
        <div class="overview-card">
          <div class="card-icon">🛠️</div>
          <div class="card-content">
            <div class="card-number">{{ summary.totalTools }}</div>
            <div class="card-label">可用工具</div>
          </div>
        </div>
        
        <div class="overview-card">
          <div class="card-icon">📚</div>
          <div class="card-content">
            <div class="card-number">{{ summary.categories.length }}</div>
            <div class="card-label">工具类别</div>
          </div>
        </div>
        
        <div class="overview-card">
          <div class="card-icon">⭐</div>
          <div class="card-content">
            <div class="card-number">{{ summary.highConfidenceTools }}</div>
            <div class="card-label">高置信度工具</div>
          </div>
        </div>
        
        <div class="overview-card">
          <div class="card-icon">🕒</div>
          <div class="card-content">
            <div class="card-time">{{ formatTime(summary.lastUpdate) }}</div>
            <div class="card-label">最后更新</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 学习进度 -->
    <div v-if="learningProgress.length > 0" class="learning-progress">
      <h4>最近学习活动</h4>
      <div class="progress-list">
        <div
          v-for="progress in learningProgress"
          :key="progress.id"
          class="progress-item"
        >
          <div class="progress-icon">
            <span v-if="progress.status === 'learning'" class="status-learning">🧠</span>
            <span v-else-if="progress.status === 'completed'" class="status-completed">✅</span>
            <span v-else-if="progress.status === 'failed'" class="status-failed">❌</span>
          </div>
          <div class="progress-content">
            <div class="progress-title">{{ progress.title }}</div>
            <div class="progress-description">{{ progress.description }}</div>
            <div v-if="progress.status === 'learning'" class="progress-bar">
              <div class="progress-fill" :style="{ width: `${progress.progress}%` }"></div>
            </div>
          </div>
          <div class="progress-time">{{ formatTime(progress.timestamp) }}</div>
        </div>
      </div>
    </div>

    <!-- AI能力列表 -->
    <div class="capabilities-list">
      <h4>AI 当前能力</h4>
      
      <div v-if="capabilities.length === 0" class="empty-state">
        <p>AI 还没有学会任何MCP工具</p>
        <p class="help-text">安装一些MCP服务器后，AI会自动学习如何使用这些工具</p>
      </div>

      <div v-else class="capabilities-grid">
        <div
          v-for="capability in capabilities"
          :key="capability.name"
          class="capability-card"
        >
          <div class="capability-header">
            <h5>{{ capability.name }}</h5>
            <div class="confidence-badge" :class="getConfidenceClass(capability.confidence)">
              {{ (capability.confidence * 100).toFixed(0) }}%
            </div>
          </div>
          
          <p class="capability-description">{{ capability.description }}</p>
          
          <div class="capability-tools">
            <div class="tools-label">可用工具:</div>
            <div class="tools-list">
              <span
                v-for="tool in capability.tools"
                :key="tool"
                class="tool-tag"
              >
                {{ tool }}
              </span>
            </div>
          </div>
          
          <div v-if="capability.examples.length > 0" class="capability-examples">
            <div class="examples-label">使用示例:</div>
            <ul class="examples-list">
              <li
                v-for="example in capability.examples.slice(0, 2)"
                :key="example"
              >
                {{ example }}
              </li>
            </ul>
          </div>
          
          <div class="capability-actions">
            <button
              class="btn-test"
              @click="testCapability(capability)"
              :disabled="testingCapability === capability.name"
            >
              {{ testingCapability === capability.name ? '测试中...' : '测试能力' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具建议 -->
    <div v-if="showSuggestions" class="tool-suggestions">
      <h4>智能建议</h4>
      <div class="suggestion-input">
        <input
          v-model="suggestionQuery"
          type="text"
          placeholder="描述你想要完成的任务..."
          class="suggestion-input-field"
          @input="getSuggestions"
        />
      </div>
      
      <div v-if="suggestions.suggestedTools.length > 0" class="suggestions-list">
        <div class="suggestions-header">
          <span>推荐工具 (置信度: {{ (suggestions.confidence * 100).toFixed(0) }}%)</span>
        </div>
        
        <div class="suggested-tools">
          <div
            v-for="tool in suggestions.suggestedTools"
            :key="tool.name"
            class="suggested-tool"
          >
            <div class="tool-info">
              <strong>{{ tool.name }}</strong>
              <span class="tool-category">{{ tool.category }}</span>
            </div>
            <p class="tool-description">{{ tool.description }}</p>
          </div>
        </div>
        
        <div v-if="suggestions.usageInstructions.length > 0" class="usage-instructions">
          <div class="instructions-label">使用说明:</div>
          <ul>
            <li
              v-for="instruction in suggestions.usageInstructions"
              :key="instruction"
            >
              {{ instruction }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { mcpService } from '@/services/mcp'

// 响应式数据
const loading = ref(false)
const testingCapability = ref('')
const showSuggestions = ref(true)
const suggestionQuery = ref('')

const summary = reactive({
  totalTools: 0,
  categories: [],
  highConfidenceTools: 0,
  lastUpdate: new Date()
})

const capabilities = ref<any[]>([])
const learningProgress = ref<any[]>([])
const suggestions = reactive({
  suggestedTools: [],
  usageInstructions: [],
  confidence: 0
})

// 方法
const refreshCapabilities = async () => {
  loading.value = true
  
  try {
    // 获取AI能力摘要
    const capabilitySummary = await mcpService.getAICapabilities()
    Object.assign(summary, capabilitySummary)
    
    // 获取详细能力信息
    // 这里需要从AI集成模块获取详细信息
    // 暂时使用模拟数据
    capabilities.value = await getMockCapabilities()
    
    console.log('✅ AI能力状态刷新完成')
  } catch (error) {
    console.error('刷新AI能力失败:', error)
  } finally {
    loading.value = false
  }
}

const getMockCapabilities = async () => {
  // 模拟能力数据，实际应该从AI集成模块获取
  return [
    {
      name: '文件操作',
      description: '我可以帮你管理文件和目录，包括读取、写入、搜索和组织文件',
      tools: ['read_file', 'write_file', 'list_directory'],
      examples: ['读取文件内容', '创建新文件', '列出目录内容'],
      confidence: 0.9
    },
    {
      name: '时间工具',
      description: '我可以帮你处理时间相关的任务，如时区转换、日期计算等',
      tools: ['get_time'],
      examples: ['获取当前时间', '时区转换'],
      confidence: 0.95
    },
    {
      name: '计算工具',
      description: '我可以帮你进行各种数学计算和数据处理',
      tools: ['calculate'],
      examples: ['数学计算', '表达式求值'],
      confidence: 0.85
    }
  ]
}

const testCapability = async (capability: any) => {
  testingCapability.value = capability.name
  
  try {
    // 测试能力中的第一个工具
    const toolName = capability.tools[0]
    
    // 根据工具类型生成测试参数
    let testParams = {}
    if (toolName === 'get_time') {
      testParams = { format: 'local' }
    } else if (toolName === 'calculate') {
      testParams = { expression: '2 + 2' }
    }
    
    const result = await mcpService.executeTool({
      tool: toolName,
      parameters: testParams
    })
    
    if (result.success) {
      alert(`✅ ${capability.name} 测试成功！\n结果: ${JSON.stringify(result.data, null, 2)}`)
    } else {
      alert(`❌ ${capability.name} 测试失败: ${result.error}`)
    }
  } catch (error) {
    alert(`❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    testingCapability.value = ''
  }
}

const getSuggestions = () => {
  if (!suggestionQuery.value.trim()) {
    suggestions.suggestedTools = []
    suggestions.usageInstructions = []
    suggestions.confidence = 0
    return
  }
  
  try {
    const result = mcpService.getToolSuggestions(suggestionQuery.value)
    Object.assign(suggestions, result)
  } catch (error) {
    console.error('获取工具建议失败:', error)
  }
}

const getConfidenceClass = (confidence: number): string => {
  if (confidence >= 0.8) return 'confidence-high'
  if (confidence >= 0.6) return 'confidence-medium'
  return 'confidence-low'
}

const formatTime = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

// 监听MCP AI更新事件
const handleAIUpdate = (event: CustomEvent) => {
  console.log('收到AI更新事件:', event.detail)
  
  // 添加学习进度项
  learningProgress.value.unshift({
    id: Date.now(),
    title: `学习服务器: ${event.detail.serverName}`,
    description: '正在分析和学习新工具...',
    status: 'completed',
    progress: 100,
    timestamp: new Date()
  })
  
  // 刷新能力状态
  refreshCapabilities()
}

// 生命周期
onMounted(() => {
  refreshCapabilities()
  
  // 监听AI更新事件
  if (typeof window !== 'undefined') {
    window.addEventListener('mcp-ai-updated', handleAIUpdate as EventListener)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('mcp-ai-updated', handleAIUpdate as EventListener)
  }
})
</script>

<style scoped>
.ai-capabilities {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0;
  background: transparent;
}

.capabilities-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn-refresh {
  padding: 8px 16px;
  background: rgba(0, 122, 255, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.9);
  transform: translateY(-1px);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.capabilities-overview {
  margin-bottom: 32px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.overview-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  transition: all 0.2s ease;
}

:deep(.dark) .overview-card,
.dark .overview-card {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.card-icon {
  font-size: 24px;
  margin-right: 16px;
}

.card-content {
  flex: 1;
}

.card-number {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.card-time {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.card-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.learning-progress {
  margin-bottom: 32px;
}

.learning-progress h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.progress-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

:deep(.dark) .progress-item,
.dark .progress-item {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.progress-icon {
  margin-right: 12px;
  font-size: 16px;
}

.progress-content {
  flex: 1;
}

.progress-title {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.progress-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: rgba(0, 122, 255, 0.8);
  transition: width 0.3s ease;
}

.progress-time {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 12px;
}

.capabilities-list h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0 0 8px 0;
}

.help-text {
  font-size: 14px;
  opacity: 0.8;
}

.capabilities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.capability-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  transition: all 0.2s ease;
}

:deep(.dark) .capability-card,
.dark .capability-card {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.capability-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.capability-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.capability-header h5 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.confidence-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.confidence-high {
  background: rgba(52, 199, 89, 0.2);
  color: #00875a;
}

.confidence-medium {
  background: rgba(255, 149, 0, 0.2);
  color: #974f0c;
}

.confidence-low {
  background: rgba(255, 59, 48, 0.2);
  color: #de350b;
}

.capability-description {
  margin: 0 0 16px 0;
  color: var(--text-secondary);
  line-height: 1.4;
}

.capability-tools,
.capability-examples {
  margin-bottom: 16px;
}

.tools-label,
.examples-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-tag {
  padding: 4px 8px;
  background: rgba(0, 122, 255, 0.1);
  color: rgba(0, 122, 255, 0.8);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.examples-list {
  margin: 0;
  padding-left: 16px;
}

.examples-list li {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.capability-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-test {
  padding: 6px 12px;
  background: rgba(52, 199, 89, 0.8);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-test:hover:not(:disabled) {
  background: rgba(52, 199, 89, 0.9);
  transform: translateY(-1px);
}

.btn-test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.tool-suggestions {
  margin-top: 32px;
}

.tool-suggestions h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.suggestion-input {
  margin-bottom: 16px;
}

.suggestion-input-field {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.suggestion-input-field:focus {
  outline: none;
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

:deep(.dark) .suggestion-input-field,
.dark .suggestion-input-field {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.suggestions-list {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 16px;
}

:deep(.dark) .suggestions-list,
.dark .suggestions-list {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.suggestions-header {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.suggested-tools {
  margin-bottom: 16px;
}

.suggested-tool {
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.suggested-tool:last-child {
  border-bottom: none;
}

:deep(.dark) .suggested-tool,
.dark .suggested-tool {
  border-color: rgba(255, 255, 255, 0.2);
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.tool-category {
  font-size: 12px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 8px;
}

:deep(.dark) .tool-category,
.dark .tool-category {
  background: rgba(255, 255, 255, 0.1);
}

.tool-description {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.usage-instructions {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 12px;
}

:deep(.dark) .usage-instructions,
.dark .usage-instructions {
  border-color: rgba(255, 255, 255, 0.2);
}

.instructions-label {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.usage-instructions ul {
  margin: 0;
  padding-left: 16px;
}

.usage-instructions li {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

@media (max-width: 768px) {
  .overview-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .capabilities-grid {
    grid-template-columns: 1fr;
  }
  
  .progress-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .progress-time {
    margin-left: 0;
  }
}
</style>