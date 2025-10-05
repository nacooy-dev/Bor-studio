<template>
  <div class="mcp-server-manager">
    <div class="header">
      <h3>MCP 服务器管理</h3>
      <button @click="showAddDialog = true" class="btn-primary">
        <Plus class="w-4 h-4" />
        添加服务器
      </button>
    </div>

    <!-- 服务器列表 -->
    <div class="servers-list">
      <div v-if="servers.length === 0" class="empty-state">
        <Server class="w-12 h-12 text-gray-400" />
        <p class="text-gray-500">暂无MCP服务器</p>
        <p class="text-sm text-gray-400">点击"添加服务器"开始使用MCP功能</p>
      </div>

      <div v-for="server in servers" :key="server.id" class="server-card">
        <div class="server-info">
          <div class="server-header">
            <h4>{{ server.name }}</h4>
            <div class="server-status" :class="server.status">
              <div class="status-dot"></div>
              {{ getStatusText(server.status) }}
            </div>
          </div>
          
          <p v-if="server.config.description" class="server-description">
            {{ server.config.description }}
          </p>
          
          <div class="server-details">
            <span class="detail-item">
              <Terminal class="w-4 h-4" />
              {{ server.config.command }} {{ server.config.args.join(' ') }}
            </span>
            <span v-if="server.pid" class="detail-item">
              <Hash class="w-4 h-4" />
              PID: {{ server.pid }}
            </span>
          </div>

          <div v-if="server.lastError" class="error-message">
            <AlertCircle class="w-4 h-4" />
            {{ server.lastError }}
          </div>
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
            v-if="server.status === 'running'" 
            @click="viewTools(server.id)"
            class="btn-secondary"
          >
            <Wrench class="w-4 h-4" />
            工具 ({{ getToolCount(server.id) }})
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
          <!-- 预设服务器选择 -->
          <div class="preset-servers">
            <h4>预设服务器</h4>
            <div class="preset-grid">
              <div 
                v-for="preset in presetServers" 
                :key="preset.id"
                @click="selectPreset(preset)"
                class="preset-card"
                :class="{ active: newServer.id === preset.id }"
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
          <div class="custom-config">
            <h4>服务器配置</h4>
            
            <div class="form-group">
              <label>服务器ID</label>
              <input 
                v-model="newServer.id" 
                type="text" 
                placeholder="例如: my-server"
                required
              />
            </div>
            
            <div class="form-group">
              <label>服务器名称</label>
              <input 
                v-model="newServer.name" 
                type="text" 
                placeholder="例如: My MCP Server"
                required
              />
            </div>
            
            <div class="form-group">
              <label>描述</label>
              <input 
                v-model="newServer.description" 
                type="text" 
                placeholder="服务器功能描述"
              />
            </div>
            
            <div class="form-group">
              <label>命令</label>
              <input 
                v-model="newServer.command" 
                type="text" 
                placeholder="例如: uvx"
                required
              />
            </div>
            
            <div class="form-group">
              <label>参数</label>
              <input 
                v-model="argsText" 
                type="text" 
                placeholder="例如: mcp-server-filesystem --allowed-directory ~"
              />
            </div>
            
            <div class="form-group">
              <label>
                <input 
                  v-model="newServer.autoStart" 
                  type="checkbox"
                />
                自动启动
              </label>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button @click="showAddDialog = false" class="btn-secondary">
            取消
          </button>
          <button @click="addServer" :disabled="!canAddServer" class="btn-primary">
            添加服务器
          </button>
        </div>
      </div>
    </div>

    <!-- 工具查看对话框 -->
    <div v-if="showToolsDialog" class="dialog-overlay" @click="showToolsDialog = false">
      <div class="dialog large" @click.stop>
        <div class="dialog-header">
          <h3>{{ selectedServer?.name }} - 可用工具</h3>
          <button @click="showToolsDialog = false" class="close-btn">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-content">
          <div v-if="serverTools.length === 0" class="empty-state">
            <Wrench class="w-8 h-8 text-gray-400" />
            <p>暂无可用工具</p>
          </div>

          <div v-else class="tools-list">
            <div v-for="tool in serverTools" :key="tool.name" class="tool-card">
              <div class="tool-header">
                <h5>{{ tool.name }}</h5>
                <span class="tool-category" :class="tool.category">
                  {{ tool.category }}
                </span>
                <span class="risk-level" :class="tool.riskLevel">
                  {{ getRiskText(tool.riskLevel) }}
                </span>
              </div>
              
              <p class="tool-description">{{ tool.description }}</p>
              
              <div class="tool-schema">
                <details>
                  <summary>参数结构</summary>
                  <pre>{{ JSON.stringify(tool.schema, null, 2) }}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Plus, Server, Terminal, Hash, AlertCircle, Play, Square, 
  Wrench, Trash2, X, FileText, Search, Database 
} from 'lucide-vue-next'
import { mcpService } from '@/services/mcp'
import type { MCPServerConfig } from '@/types'

// 响应式数据
const servers = ref<any[]>([])
const tools = ref<any[]>([])
const loading = ref(false)
const showAddDialog = ref(false)
const showToolsDialog = ref(false)
const selectedServer = ref<any>(null)

// 新服务器表单
const newServer = ref<MCPServerConfig>({
  id: '',
  name: '',
  description: '',
  command: 'uvx',
  args: [],
  autoStart: false
})

const argsText = ref('')

// 预设服务器
const presetServers = computed(() => mcpService.getPresetServers())

// 计算属性
const canAddServer = computed(() => {
  return newServer.value.id && newServer.value.name && newServer.value.command
})

const serverTools = computed(() => {
  return selectedServer.value 
    ? tools.value.filter(tool => tool.server === selectedServer.value.id)
    : []
})

// 方法
const loadServers = async () => {
  const result = await mcpService.getServers()
  if (result.success && result.data) {
    servers.value = result.data
  }
}

const loadTools = async () => {
  const result = await mcpService.getTools()
  if (result.success && result.data) {
    tools.value = result.data
  }
}

const startServer = async (serverId: string) => {
  loading.value = true
  try {
    const result = await mcpService.startServer(serverId)
    if (result.success) {
      await loadServers()
      await loadTools()
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
      await loadServers()
      await loadTools()
    } else {
      console.error('停止服务器失败:', result.error)
    }
  } finally {
    loading.value = false
  }
}

const addServer = async () => {
  if (!canAddServer.value) return
  
  loading.value = true
  try {
    // 解析参数
    const args = argsText.value.trim().split(/\s+/).filter(arg => arg)
    const config = {
      ...newServer.value,
      args
    }
    
    const result = await mcpService.addServer(config)
    if (result.success) {
      showAddDialog.value = false
      resetForm()
      await loadServers()
    } else {
      console.error('添加服务器失败:', result.error)
    }
  } finally {
    loading.value = false
  }
}

const removeServer = async (serverId: string) => {
  if (!confirm('确定要删除这个服务器吗？')) return
  
  loading.value = true
  try {
    // 先停止服务器（如果正在运行）
    const server = servers.value.find(s => s.id === serverId)
    if (server && server.status === 'running') {
      await mcpService.stopServer(serverId)
    }
    
    // 然后删除服务器
    const result = await mcpService.removeServer(serverId)
    if (result.success) {
      await loadServers()
      await loadTools()
      console.log('✅ 服务器已删除:', serverId)
    } else {
      console.error('❌ 删除服务器失败:', result.error)
      alert('删除服务器失败: ' + result.error)
    }
  } catch (error) {
    console.error('❌ 删除服务器时出错:', error)
    alert('删除服务器时出错: ' + error)
  } finally {
    loading.value = false
  }
}

const viewTools = async (serverId: string) => {
  selectedServer.value = servers.value.find(s => s.id === serverId)
  showToolsDialog.value = true
}

const selectPreset = (preset: MCPServerConfig) => {
  newServer.value = { ...preset }
  argsText.value = preset.args.join(' ')
}

const resetForm = () => {
  newServer.value = {
    id: '',
    name: '',
    description: '',
    command: 'uvx',
    args: [],
    autoStart: false
  }
  argsText.value = ''
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

const getToolCount = (serverId: string) => {
  return tools.value.filter(tool => tool.server === serverId).length
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
    'brave-search': Search,
    sqlite: Database
  }
  return iconMap[presetId] || Server
}

// 生命周期
onMounted(async () => {
  await loadServers()
  await loadTools()
})
</script>

<style scoped>
.mcp-server-manager {
  @apply p-6 space-y-6;
}

.header {
  @apply flex items-center justify-between;
}

.header h3 {
  @apply text-xl font-semibold text-gray-900 dark:text-white;
}

.servers-list {
  @apply space-y-4;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.server-card {
  @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4;
  @apply flex items-start justify-between;
}

.server-info {
  @apply flex-1 space-y-2;
}

.server-header {
  @apply flex items-center gap-3;
}

.server-header h4 {
  @apply font-medium text-gray-900 dark:text-white;
}

.server-status {
  @apply flex items-center gap-1 text-sm px-2 py-1 rounded-full;
}

.server-status.stopped {
  @apply bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300;
}

.server-status.starting {
  @apply bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300;
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

.server-description {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.server-details {
  @apply flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400;
}

.detail-item {
  @apply flex items-center gap-1;
}

.error-message {
  @apply flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded;
}

.server-actions {
  @apply flex items-center gap-2;
}

.btn-primary, .btn-secondary, .btn-success, .btn-warning, .btn-danger {
  @apply flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors;
}

.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50;
}

.btn-secondary {
  @apply bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600;
}

.btn-success {
  @apply bg-green-600 text-white hover:bg-green-700 disabled:opacity-50;
}

.btn-warning {
  @apply bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50;
}

.btn-danger {
  @apply bg-red-600 text-white hover:bg-red-700 disabled:opacity-50;
}

.dialog-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
}

.dialog {
  @apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden;
}

.dialog.large {
  @apply max-w-2xl;
}

.dialog-header {
  @apply flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700;
}

.dialog-header h3 {
  @apply text-lg font-semibold text-gray-900 dark:text-white;
}

.close-btn {
  @apply p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded;
}

.dialog-content {
  @apply p-4 overflow-y-auto max-h-[60vh] space-y-6;
}

.dialog-actions {
  @apply flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700;
}

.preset-servers h4, .custom-config h4 {
  @apply text-sm font-medium text-gray-900 dark:text-white mb-3;
}

.preset-grid {
  @apply grid grid-cols-1 gap-2;
}

.preset-card {
  @apply flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700;
}

.preset-card.active {
  @apply border-blue-500 bg-blue-50 dark:bg-blue-900/20;
}

.preset-icon {
  @apply flex-shrink-0;
}

.preset-info h5 {
  @apply font-medium text-gray-900 dark:text-white;
}

.preset-info p {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.form-group {
  @apply space-y-1;
}

.form-group label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.form-group input[type="text"] {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md;
  @apply bg-white dark:bg-gray-700 text-gray-900 dark:text-white;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.form-group input[type="checkbox"] {
  @apply mr-2;
}

.tools-list {
  @apply space-y-4;
}

.tool-card {
  @apply border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3;
}

.tool-header {
  @apply flex items-center gap-2 flex-wrap;
}

.tool-header h5 {
  @apply font-medium text-gray-900 dark:text-white;
}

.tool-category {
  @apply text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300;
}

.risk-level {
  @apply text-xs px-2 py-1 rounded-full;
}

.risk-level.low {
  @apply bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300;
}

.risk-level.medium {
  @apply bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300;
}

.risk-level.high {
  @apply bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300;
}

.tool-description {
  @apply text-sm text-gray-600 dark:text-gray-400;
}

.tool-schema details {
  @apply text-xs;
}

.tool-schema summary {
  @apply cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300;
}

.tool-schema pre {
  @apply mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto;
}
</style>