<template>
  <div class="mcp-server-manager">
    <div class="header">
      <h3>MCP 服务器管理</h3>
      <div class="header-actions">
        <button @click="activeTab = 'marketplace'" class="btn-secondary">
          <Search class="w-4 h-4" />
          服务器市场
        </button>
        <button @click="showAddCustomDialog = true" class="btn-secondary">
          <Plus class="w-4 h-4" />
          添加自定义服务器
        </button>
        <button @click="showAddDialog = true" class="btn-primary">
          <Plus class="w-4 h-4" />
          添加服务器
        </button>
      </div>
    </div>

    <!-- 导航标签 -->
    <div class="nav-tabs">
      <button
        :class="['nav-tab', { active: activeTab === 'servers' }]"
        @click="activeTab = 'servers'"
      >
        已安装服务器
      </button>
      <button
        :class="['nav-tab', { active: activeTab === 'marketplace' }]"
        @click="activeTab = 'marketplace'"
      >
        服务器市场
      </button>
      <button
        :class="['nav-tab', { active: activeTab === 'tools' }]"
        @click="activeTab = 'tools'"
      >
        可用工具
      </button>
      <button
        :class="['nav-tab', { active: activeTab === 'ai' }]"
        @click="activeTab = 'ai'"
      >
        AI 能力
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="tab-content">
      <!-- 已安装服务器 -->
      <div v-if="activeTab === 'servers'" class="servers-tab">
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
            @click="editServer(server)"
            :disabled="loading"
            class="btn-secondary"
          >
            <Settings class="w-4 h-4" />
            编辑
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
      </div>

      <!-- 服务器市场 -->
      <div v-if="activeTab === 'marketplace'" class="marketplace-tab">
        <MCPMarketplace />
      </div>

      <!-- 可用工具 -->
      <div v-if="activeTab === 'tools'" class="tools-tab">
        <div class="section-header">
          <h3>可用的 MCP 工具</h3>
          <button @click="loadTools" class="btn-secondary">
            <Wrench class="w-4 h-4" />
            刷新工具
          </button>
        </div>

        <div v-if="tools.length === 0" class="empty-state">
          <Wrench class="w-8 h-8 text-gray-400" />
          <p>没有发现可用的工具</p>
          <p class="text-sm text-gray-400">请先安装一些 MCP 服务器</p>
        </div>

        <div v-else class="tools-grid">
          <div
            v-for="tool in tools"
            :key="`${tool.server}-${tool.name}`"
            class="tool-card-simple"
          >
            <div class="tool-info">
              <h4>{{ tool.name }}</h4>
              <p>{{ tool.description }}</p>
              <div class="tool-meta">
                <span class="tool-server">{{ tool.server }}</span>
              </div>
            </div>
            <div class="tool-actions">
              <button
                class="btn-test"
                @click="testTool(tool)"
                :disabled="testingTool === tool.name"
              >
                {{ testingTool === tool.name ? '测试中...' : '测试工具' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- AI 能力 -->
      <div v-if="activeTab === 'ai'" class="ai-tab">
        <AICapabilities />
      </div>
    </div>

    <!-- 添加服务器对话框 -->
    <div v-if="showAddDialog" class="dialog-overlay">
      <div class="dialog-backdrop" @click="showAddDialog = false"></div>
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

    <!-- 编辑服务器对话框 -->
    <div v-if="showEditDialog" class="dialog-overlay">
      <div class="dialog-backdrop" @click="cancelEdit"></div>
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>编辑MCP服务器</h3>
          <button @click="cancelEdit" class="close-btn">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-content">
          <div class="form-group">
            <label>服务器ID</label>
            <input 
              v-model="editingServer.id" 
              type="text" 
              disabled
              class="disabled"
            />
            <small class="form-hint">服务器ID不能修改</small>
          </div>
          
          <div class="form-group">
            <label>服务器名称</label>
            <input 
              v-model="editingServer.name" 
              type="text" 
              placeholder="例如: My MCP Server"
              required
            />
          </div>
          
          <div class="form-group">
            <label>描述</label>
            <textarea 
              v-model="editingServer.description" 
              placeholder="服务器描述（可选）"
              rows="2"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label>命令</label>
            <select v-model="editingServer.command">
              <option value="uvx">uvx (Python包)</option>
              <option value="npx">npx (Node.js包)</option>
              <option value="node">node (本地脚本)</option>
              <option value="python">python (Python脚本)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>参数</label>
            <input 
              v-model="argsText" 
              type="text" 
              placeholder="例如: server-name --option value"
            />
            <small class="form-hint">用空格分隔多个参数</small>
          </div>
          
          <div class="form-group">
            <label>工作目录</label>
            <input 
              v-model="editingServer.cwd" 
              type="text" 
              placeholder="例如: /path/to/directory（可选）"
            />
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input 
                v-model="editingServer.autoStart" 
                type="checkbox"
              />
              <span class="checkmark"></span>
              自动启动
            </label>
          </div>
        </div>

        <div class="dialog-actions">
          <button @click="cancelEdit" class="btn-secondary">
            取消
          </button>
          <button @click="updateServer" :disabled="loading" class="btn-primary">
            {{ loading ? '更新中...' : '更新服务器' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 添加自定义服务器对话框 -->
    <AddCustomServerDialog 
      v-if="showAddCustomDialog"
      @close="showAddCustomDialog = false"
      @added="onCustomServerAdded"
    />

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
  Wrench, Trash2, X, FileText, Search, Database, Settings 
} from 'lucide-vue-next'
import { mcpService } from '@/services/mcp'
import type { MCPServerConfig } from '@/types'
import MCPMarketplace from './MCPMarketplace.vue'
import AICapabilities from './AICapabilities.vue'
import AddCustomServerDialog from './AddCustomServerDialog.vue'

// 响应式数据
const activeTab = ref<'servers' | 'marketplace' | 'tools' | 'ai'>('servers')
const servers = ref<any[]>([])
const tools = ref<any[]>([])
const loading = ref(false)
const showAddDialog = ref(false)
const showAddCustomDialog = ref(false)
const showEditDialog = ref(false)
const showToolsDialog = ref(false)
const selectedServer = ref<any>(null)
const editingServer = ref<any>(null)
const testingTool = ref('')

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

const editServer = (server: any) => {
  editingServer.value = { ...server.config }
  argsText.value = server.config.args.join(' ')
  showEditDialog.value = true
}

const updateServer = async () => {
  if (!editingServer.value) return
  
  loading.value = true
  try {
    // 处理参数
    const args = argsText.value.trim() 
      ? argsText.value.trim().split(/\s+/) 
      : []
    
    const updatedConfig = {
      ...editingServer.value,
      args
    }
    
    const result = await mcpService.updateServer(editingServer.value.id, updatedConfig)
    
    if (result.success) {
      showEditDialog.value = false
      editingServer.value = null
      argsText.value = ''
      await loadServers()
    } else {
      alert(result.error || '更新服务器失败')
    }
  } catch (error) {
    console.error('更新服务器失败:', error)
    alert('更新服务器失败')
  } finally {
    loading.value = false
  }
}

const cancelEdit = () => {
  showEditDialog.value = false
  editingServer.value = null
  argsText.value = ''
}

const onCustomServerAdded = async (server: MCPServerConfig) => {
  console.log('✅ 自定义服务器已添加:', server.name)
  await loadServers()
  
  // 可选：自动切换到服务器列表标签
  activeTab.value = 'servers'
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

const testTool = async (tool: any) => {
  testingTool.value = tool.name
  try {
    let testParams = {}
    
    // 根据工具类型生成测试参数
    if (tool.name === 'get_time') {
      testParams = { format: 'local' }
    } else if (tool.name === 'calculate') {
      testParams = { expression: '2 + 2' }
    } else if (tool.name === 'remember') {
      testParams = { key: 'test', value: 'test value' }
    }
    
    const result = await mcpService.executeTool({
      tool: tool.name,
      parameters: testParams
    })
    
    if (result.success) {
      alert(`✅ 工具 ${tool.name} 测试成功！\n结果: ${JSON.stringify(result.data, null, 2)}`)
    } else {
      alert(`❌ 工具 ${tool.name} 测试失败: ${result.error}`)
    }
  } catch (error) {
    alert(`❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    testingTool.value = ''
  }
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
  padding: 0;
  margin: 0;
  min-height: 600px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.nav-tabs {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 24px;
}

:deep(.dark) .nav-tabs,
.dark .nav-tabs {
  background: rgba(255, 255, 255, 0.1);
}

.nav-tab {
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #8e8e93;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.nav-tab:hover {
  background: rgba(255, 255, 255, 0.5);
  color: #1d1d1f;
}

.nav-tab.active {
  background: rgba(255, 255, 255, 0.9);
  color: #1d1d1f;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.dark) .nav-tab:hover,
.dark .nav-tab:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .nav-tab.active,
.dark .nav-tab.active {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.tab-content {
  min-height: 400px;
}

.header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
}

.servers-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: #8e8e93;
}

.server-card {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  transition: all 0.2s ease;
}

.server-card:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.server-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.server-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.server-header h4 {
  font-weight: 500;
  color: #1d1d1f;
  margin: 0;
  font-size: 16px;
}

.server-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.server-status.stopped {
  background: rgba(142, 142, 147, 0.1);
  color: #8e8e93;
}

.server-status.starting {
  background: rgba(255, 149, 0, 0.1);
  color: #ff9500;
}

.server-status.running {
  background: rgba(52, 199, 89, 0.1);
  color: #34c759;
}

/* 深色模式适配 */
:deep(.dark) .header h3,
.dark .header h3 {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .server-card,
.dark .server-card {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dark) .server-card:hover,
.dark .server-card:hover {
  background: rgba(255, 255, 255, 0.15);
}

:deep(.dark) .server-header h4,
.dark .server-header h4 {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .empty-state,
.dark .empty-state {
  color: rgba(255, 255, 255, 0.6);
}

:deep(.dark) .server-status.stopped,
.dark .server-status.stopped {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

:deep(.dark) .server-status.starting,
.dark .server-status.starting {
  background: rgba(255, 149, 0, 0.2);
  color: #ff9f0a;
}

:deep(.dark) .server-status.running,
.dark .server-status.running {
  background: rgba(52, 199, 89, 0.2);
  color: #30d158;
}

.server-status.error {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.server-description {
  font-size: 14px;
  color: #8e8e93;
  line-height: 1.4;
}

.server-details {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #8e8e93;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.1);
  padding: 8px;
  border-radius: 8px;
}

.server-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary, .btn-secondary, .btn-success, .btn-warning, .btn-danger {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  -webkit-app-region: no-drag;
}

.btn-primary {
  background: rgba(0, 122, 255, 0.8);
  color: white;
}

.btn-primary:hover {
  background: rgba(0, 122, 255, 0.9);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(0, 0, 0, 0.05);
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.btn-secondary:hover {
  background: rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.btn-success {
  background: rgba(52, 199, 89, 0.8);
  color: white;
}

.btn-success:hover {
  background: rgba(52, 199, 89, 0.9);
  transform: translateY(-1px);
}

.btn-warning {
  background: rgba(255, 149, 0, 0.8);
  color: white;
}

.btn-warning:hover {
  background: rgba(255, 149, 0, 0.9);
  transform: translateY(-1px);
}

.btn-danger {
  background: rgba(255, 59, 48, 0.8);
  color: white;
}

.btn-danger:hover {
  background: rgba(255, 59, 48, 0.9);
  transform: translateY(-1px);
}

/* 深色模式按钮适配 */
:deep(.dark) .server-status.error,
.dark .server-status.error {
  background: rgba(255, 59, 48, 0.2);
  color: #ff453a;
}

:deep(.dark) .server-description,
.dark .server-description {
  color: rgba(255, 255, 255, 0.6);
}

:deep(.dark) .server-details,
.dark .server-details {
  color: rgba(255, 255, 255, 0.6);
}

:deep(.dark) .error-message,
.dark .error-message {
  color: #ff453a;
  background: rgba(255, 59, 48, 0.2);
}

:deep(.dark) .btn-secondary,
.dark .btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dark) .btn-secondary:hover,
.dark .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.dialog {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 550px;
  width: 90%;
  margin: 16px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.dialog.large {
  max-width: 750px;
  max-height: 90vh;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.dialog-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
}

.close-btn {
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.dialog-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

/* 深色模式对话框适配 */
:deep(.dark) .dialog,
.dark .dialog {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dark) .dialog-header,
.dark .dialog-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

:deep(.dark) .dialog-header h3,
.dark .dialog-header h3 {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .close-btn:hover,
.dark .close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

:deep(.dark) .dialog-actions,
.dark .dialog-actions {
  border-top-color: rgba(255, 255, 255, 0.1);
}

/* 表单和其他组件样式 */
.preset-servers h4, .custom-config h4 {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
  margin: 0 0 12px 0;
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.preset-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.5);
  -webkit-app-region: no-drag;
}

.preset-card:hover {
  background: rgba(255, 255, 255, 0.8);
}

.preset-card.active {
  border-color: rgba(0, 122, 255, 0.5);
  background: rgba(0, 122, 255, 0.1);
}

.preset-info h5 {
  font-weight: 500;
  color: #1d1d1f;
  margin: 0;
}

.preset-info p {
  font-size: 12px;
  color: #8e8e93;
  margin: 4px 0 0 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

.form-group input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  color: #1d1d1f;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

.form-group input.disabled,
.form-group input:disabled {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.5);
  cursor: not-allowed;
  border-color: rgba(0, 0, 0, 0.1);
}

.form-hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  margin-top: 4px;
  display: block;
}

.form-group input[type="checkbox"] {
  margin-right: 8px;
  accent-color: rgba(0, 122, 255, 0.8);
  -webkit-app-region: no-drag;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-card {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.tool-header h5 {
  font-weight: 500;
  color: #1d1d1f;
  margin: 0;
}

.tool-category, .risk-level {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.tool-category {
  background: rgba(0, 122, 255, 0.1);
  color: #007aff;
}

.risk-level.low {
  background: rgba(52, 199, 89, 0.1);
  color: #34c759;
}

.risk-level.medium {
  background: rgba(255, 149, 0, 0.1);
  color: #ff9500;
}

.risk-level.high {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.tool-description {
  font-size: 14px;
  color: #8e8e93;
  line-height: 1.4;
}

.tool-schema details {
  font-size: 12px;
}

.tool-schema summary {
  cursor: pointer;
  color: #8e8e93;
  transition: color 0.2s ease;
}

.tool-schema summary:hover {
  color: #1d1d1f;
}

.tool-schema pre {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  font-size: 11px;
  overflow-x: auto;
}

/* 深色模式适配 */
:deep(.dark) .preset-servers h4,
:deep(.dark) .custom-config h4,
.dark .preset-servers h4,
.dark .custom-config h4 {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .preset-card,
.dark .preset-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

:deep(.dark) .preset-card:hover,
.dark .preset-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

:deep(.dark) .preset-info h5,
.dark .preset-info h5 {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .preset-info p,
.dark .preset-info p {
  color: rgba(255, 255, 255, 0.6);
}

:deep(.dark) .form-group label,
.dark .form-group label {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .form-group input[type="text"],
.dark .form-group input[type="text"] {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dark) .tool-card,
.dark .tool-card {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

:deep(.dark) .tool-header h5,
.dark .tool-header h5 {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .tool-description,
.dark .tool-description {
  color: rgba(255, 255, 255, 0.6);
}

:deep(.dark) .tool-schema pre,
.dark .tool-schema pre {
  background: rgba(255, 255, 255, 0.1);
}

/* 新增的工具标签页样式 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
}

:deep(.dark) .section-header h3,
.dark .section-header h3 {
  color: rgba(255, 255, 255, 0.9);
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.tool-card-simple {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
}

.tool-card-simple:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

:deep(.dark) .tool-card-simple,
.dark .tool-card-simple {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.tool-card-simple .tool-info h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}

.tool-card-simple .tool-info p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #8e8e93;
  line-height: 1.4;
}

:deep(.dark) .tool-card-simple .tool-info h4,
.dark .tool-card-simple .tool-info h4 {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .tool-card-simple .tool-info p,
.dark .tool-card-simple .tool-info p {
  color: rgba(255, 255, 255, 0.6);
}

.tool-card-simple .tool-meta {
  margin-bottom: 12px;
}

.tool-card-simple .tool-server {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  color: #8e8e93;
  padding: 2px 6px;
  border-radius: 8px;
}

:deep(.dark) .tool-card-simple .tool-server,
.dark .tool-card-simple .tool-server {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.tool-card-simple .tool-actions {
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
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
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

@media (max-width: 768px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
  
  .header-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .nav-tabs {
    flex-direction: column;
  }
}
</style>