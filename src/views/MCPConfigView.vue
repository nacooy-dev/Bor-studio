<template>
  <div class="mcp-config-view">
    <!-- 页面头部 -->
    <div class="config-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">MCP 工具管理</h1>
          <p class="page-description">
            管理 Model Context Protocol (MCP) 服务器和工具
          </p>
        </div>
        <div class="header-actions">
          <button @click="refreshAll" :disabled="loading" class="btn-secondary">
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
            刷新状态
          </button>
          <button @click="$router.push('/')" class="btn-primary">
            <ArrowLeft class="w-4 h-4" />
            返回聊天
          </button>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="config-content">
      <div class="config-grid">
        <!-- 左侧：服务器管理 -->
        <div class="config-section">
          <div class="section-header">
            <h2 class="section-title">
              <Server class="w-5 h-5" />
              MCP 服务器
            </h2>
            <div class="section-status">
              <span class="status-badge" :class="getOverallStatusClass()">
                {{ getOverallStatusText() }}
              </span>
            </div>
          </div>
          
          <div class="section-content">
            <!-- 服务器统计 -->
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{{ servers.length }}</div>
                <div class="stat-label">总服务器</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ runningServers.length }}</div>
                <div class="stat-label">运行中</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ availableTools.length }}</div>
                <div class="stat-label">可用工具</div>
              </div>
            </div>

            <!-- 服务器列表 -->
            <div class="server-list">
              <div v-if="servers.length === 0" class="empty-state">
                <Server class="w-12 h-12 text-gray-400" />
                <h3>暂无MCP服务器</h3>
                <p>添加服务器开始使用MCP工具</p>
                <button @click="showAddDialog = true" class="btn-primary">
                  <Plus class="w-4 h-4" />
                  添加服务器
                </button>
              </div>

              <div v-else class="server-cards">
                <div v-for="server in servers" :key="server.id" class="server-card">
                  <div class="server-header">
                    <div class="server-info">
                      <h3 class="server-name">{{ server.name }}</h3>
                      <p class="server-description">{{ server.config.description }}</p>
                    </div>
                    <div class="server-status" :class="server.status">
                      <div class="status-dot"></div>
                      <span>{{ getStatusText(server.status) }}</span>
                    </div>
                  </div>

                  <div class="server-details">
                    <div class="detail-row">
                      <Terminal class="w-4 h-4" />
                      <span>{{ server.config.command }} {{ server.config.args.join(' ') }}</span>
                    </div>
                    <div v-if="server.pid" class="detail-row">
                      <Hash class="w-4 h-4" />
                      <span>PID: {{ server.pid }}</span>
                    </div>
                    <div v-if="getServerTools(server.id).length > 0" class="detail-row">
                      <Wrench class="w-4 h-4" />
                      <span>{{ getServerTools(server.id).length }} 个工具</span>
                    </div>
                  </div>

                  <div v-if="server.lastError" class="server-error">
                    <AlertCircle class="w-4 h-4" />
                    <span>{{ server.lastError }}</span>
                  </div>

                  <div class="server-actions">
                    <button 
                      v-if="server.status === 'stopped'" 
                      @click="startServer(server.id)"
                      :disabled="loading"
                      class="btn-success"
                    >
                      <Play class="w-4 h-4" />
                      启动
                    </button>
                    
                    <button 
                      v-if="server.status === 'running'" 
                      @click="stopServer(server.id)"
                      :disabled="loading"
                      class="btn-warning"
                    >
                      <Square class="w-4 h-4" />
                      停止
                    </button>
                    
                    <button 
                      v-if="server.status === 'error'" 
                      @click="startServer(server.id)"
                      :disabled="loading"
                      class="btn-secondary"
                    >
                      <RotateCcw class="w-4 h-4" />
                      重试
                    </button>
                    
                    <button 
                      @click="removeServer(server.id)"
                      :disabled="loading || server.status === 'running'"
                      class="btn-danger"
                    >
                      <Trash2 class="w-4 h-4" />
                      删除
                    </button>
                  </div>
                </div>
              </div>

              <!-- 添加服务器按钮 -->
              <div v-if="servers.length > 0" class="add-server-section">
                <button @click="showAddDialog = true" class="btn-outline">
                  <Plus class="w-4 h-4" />
                  添加新服务器
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：工具管理 -->
        <div class="config-section">
          <div class="section-header">
            <h2 class="section-title">
              <Wrench class="w-5 h-5" />
              可用工具
            </h2>
            <div class="section-actions">
              <button @click="showToolExecutor = !showToolExecutor" class="btn-secondary">
                <Settings class="w-4 h-4" />
                工具执行器
              </button>
            </div>
          </div>
          
          <div class="section-content">
            <div v-if="availableTools.length === 0" class="empty-state">
              <Wrench class="w-12 h-12 text-gray-400" />
              <h3>暂无可用工具</h3>
              <p>启动MCP服务器后工具将显示在这里</p>
            </div>

            <div v-else class="tools-grid">
              <div v-for="tool in availableTools" :key="`${tool.server}:${tool.name}`" class="tool-card">
                <div class="tool-header">
                  <h4 class="tool-name">{{ tool.name }}</h4>
                  <div class="tool-badges">
                    <span class="server-badge">{{ getServerName(tool.server) }}</span>
                    <span class="risk-badge" :class="tool.riskLevel">
                      {{ getRiskText(tool.riskLevel) }}
                    </span>
                  </div>
                </div>
                
                <p class="tool-description">{{ tool.description }}</p>
                
                <div class="tool-actions">
                  <button @click="executeToolDialog(tool)" class="btn-primary">
                    <Play class="w-4 h-4" />
                    执行
                  </button>
                  <button @click="viewToolSchema(tool)" class="btn-secondary">
                    <Info class="w-4 h-4" />
                    详情
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加服务器对话框 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click="showAddDialog = false">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>添加MCP服务器</h3>
          <button @click="showAddDialog = false" class="close-btn">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-content">
          <!-- 预设服务器 -->
          <div class="preset-section">
            <h4>推荐服务器</h4>
            <div class="preset-grid">
              <div 
                v-for="preset in presetServers" 
                :key="preset.id"
                @click="selectPreset(preset)"
                class="preset-card"
                :class="{ active: selectedPreset?.id === preset.id }"
              >
                <div class="preset-icon">
                  <component :is="getPresetIcon(preset.id)" class="w-6 h-6" />
                </div>
                <div class="preset-info">
                  <h5>{{ preset.name }}</h5>
                  <p>{{ preset.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 自定义配置 -->
          <div v-if="selectedPreset" class="custom-section">
            <h4>服务器配置</h4>
            <div class="form-grid">
              <div class="form-group">
                <label>服务器名称</label>
                <input v-model="selectedPreset.name" type="text" />
              </div>
              <div class="form-group">
                <label>描述</label>
                <input v-model="selectedPreset.description" type="text" />
              </div>
              <div class="form-group">
                <label>命令</label>
                <input v-model="selectedPreset.command" type="text" readonly />
              </div>
              <div class="form-group full-width">
                <label>参数</label>
                <input v-model="argsText" type="text" />
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button @click="showAddDialog = false" class="btn-secondary">
            取消
          </button>
          <button 
            @click="addServer" 
            :disabled="!selectedPreset || loading"
            class="btn-primary"
          >
            添加服务器
          </button>
        </div>
      </div>
    </div>

    <!-- 工具执行器 -->
    <div v-if="showToolExecutor" class="tool-executor-panel">
      <MCPToolExecutor />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Server, Wrench, Plus, Play, Square, Trash2, Settings, Info,
  RefreshCw, ArrowLeft, Terminal, Hash, AlertCircle, RotateCcw,
  X, FileText, Search, Database, Clock
} from 'lucide-vue-next'
import { mcpService } from '@/services/mcp'
import MCPToolExecutor from '@/components/mcp/MCPToolExecutor.vue'
import type { MCPServerConfig } from '@/types'

const router = useRouter()

// 响应式数据
const servers = ref<any[]>([])
const availableTools = ref<any[]>([])
const loading = ref(false)
const showAddDialog = ref(false)
const showToolExecutor = ref(false)
const selectedPreset = ref<MCPServerConfig | null>(null)
const argsText = ref('')

// 预设服务器
const presetServers = computed(() => mcpService.getPresetServers())

// 计算属性
const runningServers = computed(() => servers.value.filter(s => s.status === 'running'))

const getOverallStatusClass = () => {
  if (servers.value.length === 0) return 'status-none'
  if (runningServers.value.length === servers.value.length) return 'status-good'
  if (runningServers.value.length > 0) return 'status-partial'
  return 'status-error'
}

const getOverallStatusText = () => {
  if (servers.value.length === 0) return '未配置'
  if (runningServers.value.length === servers.value.length) return '全部运行'
  if (runningServers.value.length > 0) return '部分运行'
  return '全部停止'
}

// 方法
const loadData = async () => {
  loading.value = true
  try {
    console.log('🔄 开始加载MCP数据...')
    
    const [serversResult, toolsResult] = await Promise.all([
      mcpService.getServers(),
      mcpService.getTools()
    ])
    
    console.log('📊 服务器结果:', serversResult)
    console.log('🛠️ 工具结果:', toolsResult)
    
    if (serversResult.success && serversResult.data) {
      servers.value = serversResult.data
      console.log('✅ 服务器数据已加载:', servers.value.length, '个服务器')
      console.log('📋 服务器详细数据:', JSON.stringify(servers.value, null, 2))
    } else {
      console.warn('⚠️ 服务器数据加载失败:', serversResult.error)
    }
    
    if (toolsResult.success && toolsResult.data) {
      availableTools.value = toolsResult.data
      console.log('✅ 工具数据已加载:', availableTools.value.length, '个工具')
    } else {
      console.warn('⚠️ 工具数据加载失败:', toolsResult.error)
    }
  } catch (error) {
    console.error('❌ 加载MCP数据失败:', error)
  } finally {
    loading.value = false
  }
}

const refreshAll = async () => {
  await loadData()
}

const startServer = async (serverId: string) => {
  loading.value = true
  try {
    const result = await mcpService.startServer(serverId)
    if (result.success) {
      await loadData()
    } else {
      console.error('启动服务器失败:', result.error)
    }
  } finally {
    loading.value = false
  }
}

const stopServer = async (serverId: string) => {
  loading.value = true
  try {
    const result = await mcpService.stopServer(serverId)
    if (result.success) {
      await loadData()
    } else {
      console.error('停止服务器失败:', result.error)
    }
  } finally {
    loading.value = false
  }
}

const removeServer = async (serverId: string) => {
  if (!confirm('确定要删除这个服务器吗？')) return
  
  loading.value = true
  try {
    const result = await mcpService.stopServer(serverId)
    if (result.success) {
      await loadData()
    }
  } finally {
    loading.value = false
  }
}

const selectPreset = (preset: MCPServerConfig) => {
  selectedPreset.value = { ...preset }
  argsText.value = preset.args.join(' ')
}

const addServer = async () => {
  if (!selectedPreset.value) return
  
  loading.value = true
  try {
    const config = {
      ...selectedPreset.value,
      args: argsText.value.trim().split(/\s+/).filter(arg => arg)
    }
    
    const result = await mcpService.addServer(config)
    if (result.success) {
      showAddDialog.value = false
      selectedPreset.value = null
      argsText.value = ''
      await loadData()
    } else {
      console.error('添加服务器失败:', result.error)
    }
  } finally {
    loading.value = false
  }
}

const getStatusText = (status: string) => {
  const statusMap = {
    stopped: '已停止',
    starting: '启动中',
    running: '运行中',
    error: '错误'
  }
  return statusMap[status] || status
}

const getServerTools = (serverId: string) => {
  return availableTools.value.filter(tool => tool.server === serverId)
}

const getServerName = (serverId: string) => {
  const server = servers.value.find(s => s.id === serverId)
  return server?.name || serverId
}

const getRiskText = (risk: string) => {
  const riskMap = {
    low: '低风险',
    medium: '中风险',
    high: '高风险'
  }
  return riskMap[risk] || risk
}

const getPresetIcon = (presetId: string) => {
  const iconMap = {
    filesystem: FileText,
    'duckduckgo-search': Search,
    'web-research': Search,
    'web-fetch': Search,
    sqlite: Database,
    'time-server': Clock,
    'sequential-thinking': Settings
  }
  return iconMap[presetId] || Server
}

const executeToolDialog = (tool: any) => {
  // 这里可以打开工具执行对话框
  console.log('执行工具:', tool)
}

const viewToolSchema = (tool: any) => {
  // 这里可以显示工具的详细信息
  console.log('查看工具详情:', tool)
}

// 生命周期
onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.mcp-config-view {
  @apply h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden;
}

.config-header {
  @apply bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0;
}

.header-content {
  @apply max-w-7xl mx-auto px-6 py-6 flex items-center justify-between;
}

.header-info h1 {
  @apply text-2xl font-bold text-gray-900 dark:text-white;
}

.header-info p {
  @apply text-gray-600 dark:text-gray-400 mt-1;
}

.header-actions {
  @apply flex items-center gap-3;
}

.config-content {
  @apply flex-1 max-w-7xl mx-auto px-6 py-8 overflow-y-auto;
  max-height: calc(100vh - 120px); /* 确保有足够的滚动空间 */
}

.config-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-8;
}

.config-section {
  @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden;
}

.section-header {
  @apply px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between;
}

.section-title {
  @apply flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white;
}

.section-status .status-badge {
  @apply px-2 py-1 text-xs font-medium rounded-full;
}

.status-badge.status-none {
  @apply bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300;
}

.status-badge.status-good {
  @apply bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300;
}

.status-badge.status-partial {
  @apply bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300;
}

.status-badge.status-error {
  @apply bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300;
}

.section-content {
  @apply p-6;
}

.stats-grid {
  @apply grid grid-cols-3 gap-4 mb-6;
}

.stat-card {
  @apply text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg;
}

.stat-value {
  @apply text-2xl font-bold text-gray-900 dark:text-white;
}

.stat-label {
  @apply text-sm text-gray-600 dark:text-gray-400 mt-1;
}

.empty-state {
  @apply text-center py-12;
}

.empty-state h3 {
  @apply text-lg font-medium text-gray-900 dark:text-white mt-4;
}

.empty-state p {
  @apply text-gray-600 dark:text-gray-400 mt-2 mb-6;
}

.server-cards {
  @apply space-y-4;
}

.server-card {
  @apply border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4;
}

.server-header {
  @apply flex items-start justify-between;
}

.server-name {
  @apply font-medium text-gray-900 dark:text-white;
}

.server-description {
  @apply text-sm text-gray-600 dark:text-gray-400 mt-1;
}

.server-status {
  @apply flex items-center gap-2 text-sm px-2 py-1 rounded-full;
}

.server-status.stopped {
  @apply bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300;
}

.server-status.running {
  @apply bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300;
}

.server-status.error {
  @apply bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300;
}

.status-dot {
  @apply w-2 h-2 rounded-full bg-current;
}

.server-details {
  @apply space-y-2;
}

.detail-row {
  @apply flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400;
}

.server-error {
  @apply flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded;
}

.server-actions {
  @apply flex items-center gap-2;
}

.add-server-section {
  @apply mt-6 pt-6 border-t border-gray-200 dark:border-gray-600;
}

.tools-grid {
  @apply grid gap-4;
}

.tool-card {
  @apply border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3;
}

.tool-header {
  @apply flex items-start justify-between;
}

.tool-name {
  @apply font-medium text-gray-900 dark:text-white;
}

.tool-badges {
  @apply flex items-center gap-2;
}

.server-badge {
  @apply text-xs px-2 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-full;
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

.tool-description {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.tool-actions {
  @apply flex items-center gap-2;
}

/* 按钮样式 */
.btn-primary, .btn-secondary, .btn-success, .btn-warning, .btn-danger, .btn-outline {
  @apply flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50;
}

.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}

.btn-secondary {
  @apply bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600;
}

.btn-success {
  @apply bg-green-600 text-white hover:bg-green-700;
}

.btn-warning {
  @apply bg-yellow-600 text-white hover:bg-yellow-700;
}

.btn-danger {
  @apply bg-red-600 text-white hover:bg-red-700;
}

.btn-outline {
  @apply border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700;
}

/* 对话框样式 */
.dialog-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
}

.dialog {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden;
}

.dialog-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
}

.dialog-header h3 {
  @apply text-lg font-semibold text-gray-900 dark:text-white;
}

.close-btn {
  @apply p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded;
}

.dialog-content {
  @apply p-6 overflow-y-auto max-h-[60vh] space-y-6;
}

.dialog-actions {
  @apply flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700;
}

.preset-section h4, .custom-section h4 {
  @apply text-sm font-medium text-gray-900 dark:text-white mb-4;
}

.preset-grid {
  @apply grid grid-cols-1 gap-3;
}

.preset-card {
  @apply flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors;
}

.preset-card.active {
  @apply border-blue-500 bg-blue-50 dark:bg-blue-900/20;
}

.preset-info h5 {
  @apply font-medium text-gray-900 dark:text-white;
}

.preset-info p {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.form-grid {
  @apply grid grid-cols-2 gap-4;
}

.form-group {
  @apply space-y-2;
}

.form-group.full-width {
  @apply col-span-2;
}

.form-group label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.form-group input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.tool-executor-panel {
  @apply fixed inset-0 bg-white dark:bg-gray-900 z-40;
}
</style>