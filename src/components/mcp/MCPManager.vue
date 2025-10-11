<template>
  <div class="mcp-manager">
    <!-- 头部导航 -->
    <div class="manager-header">
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
    </div>

    <!-- 内容区域 -->
    <div class="manager-content">
      <!-- 已安装服务器 -->
      <div v-if="activeTab === 'servers'" class="servers-tab">
        <div class="tab-header">
          <h3>已安装的 MCP 服务器</h3>
          <button class="btn-refresh" @click="refreshServers">
            刷新状态
          </button>
        </div>

        <div v-if="installedServers.length === 0" class="empty-state">
          <p>还没有安装任何 MCP 服务器</p>
          <button class="btn-browse" @click="activeTab = 'marketplace'">
            浏览服务器市场
          </button>
        </div>

        <div v-else class="servers-list">
          <div
            v-for="server in installedServers"
            :key="server.id"
            class="server-item"
          >
            <div class="server-info">
              <h4>{{ server.name }}</h4>
              <p>{{ server.description }}</p>
              <div class="server-status">
                <span :class="['status-dot', getServerStatus(server.id)]"></span>
                <span>{{ getServerStatusText(server.id) }}</span>
              </div>
            </div>
            <div class="server-actions">
              <button
                class="btn-action"
                @click="toggleServer(server.id)"
                :disabled="serverOperations.has(server.id)"
              >
                {{ getServerActionText(server.id) }}
              </button>
              <button
                class="btn-action secondary"
                @click="configureServer(server)"
              >
                配置
              </button>
              <button
                class="btn-action danger"
                @click="removeServer(server.id)"
                :disabled="serverOperations.has(server.id)"
              >
                移除
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
        <div class="tab-header">
          <h3>可用的 MCP 工具</h3>
          <button class="btn-refresh" @click="refreshTools">
            刷新工具
          </button>
        </div>

        <div v-if="availableTools.length === 0" class="empty-state">
          <p>没有发现可用的工具</p>
          <p class="help-text">请先安装一些 MCP 服务器</p>
        </div>

        <div v-else class="tools-grid">
          <div
            v-for="tool in availableTools"
            :key="`${tool.server}-${tool.name}`"
            class="tool-card"
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { mcpService } from '@/services/mcp'
import type { MCPServerConfig } from '@/types'
import MCPMarketplace from './MCPMarketplace.vue'
import AICapabilities from './AICapabilities.vue'

// 响应式数据
const activeTab = ref<'servers' | 'marketplace' | 'tools' | 'ai'>('servers')
const installedServers = ref<MCPServerConfig[]>([])
const availableTools = ref<any[]>([])
const serverOperations = reactive(new Set<string>())
const testingTool = ref<string>('')

// 服务器状态管理
const serverStatuses = reactive(new Map<string, 'running' | 'stopped' | 'error'>())

// 方法
const refreshServers = async () => {
  try {
    const result = await mcpService.getServers()
    if (result.success && result.data) {
      installedServers.value = result.data
      
      // 检查每个服务器的状态
      for (const server of result.data) {
        await checkServerStatus(server.id)
      }
    }
  } catch (error) {
    console.error('刷新服务器列表失败:', error)
  }
}

const refreshTools = async () => {
  try {
    const result = await mcpService.getTools()
    if (result.success && result.data) {
      availableTools.value = result.data
    }
  } catch (error) {
    console.error('刷新工具列表失败:', error)
  }
}

const checkServerStatus = async (serverId: string) => {
  // 这里应该实现实际的状态检查逻辑
  // 暂时设置为随机状态用于演示
  const statuses: ('running' | 'stopped' | 'error')[] = ['running', 'stopped', 'error']
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]
  serverStatuses.set(serverId, randomStatus)
}

const getServerStatus = (serverId: string): string => {
  const status = serverStatuses.get(serverId) || 'stopped'
  return status === 'running' ? 'success' : status === 'error' ? 'error' : 'warning'
}

const getServerStatusText = (serverId: string): string => {
  const status = serverStatuses.get(serverId) || 'stopped'
  switch (status) {
    case 'running': return '运行中'
    case 'stopped': return '已停止'
    case 'error': return '错误'
    default: return '未知'
  }
}

const getServerActionText = (serverId: string): string => {
  const status = serverStatuses.get(serverId) || 'stopped'
  return status === 'running' ? '停止' : '启动'
}

const toggleServer = async (serverId: string) => {
  serverOperations.add(serverId)
  
  try {
    const status = serverStatuses.get(serverId) || 'stopped'
    
    if (status === 'running') {
      const result = await mcpService.stopServer(serverId)
      if (result.success) {
        serverStatuses.set(serverId, 'stopped')
      }
    } else {
      const result = await mcpService.startServer(serverId)
      if (result.success) {
        serverStatuses.set(serverId, 'running')
      } else {
        serverStatuses.set(serverId, 'error')
      }
    }
  } catch (error) {
    console.error('切换服务器状态失败:', error)
    serverStatuses.set(serverId, 'error')
  } finally {
    serverOperations.delete(serverId)
  }
}

const configureServer = (server: MCPServerConfig) => {
  // 打开服务器配置对话框
  console.log('配置服务器:', server.name)
  // 这里可以打开配置对话框或跳转到配置页面
}

const removeServer = async (serverId: string) => {
  if (!confirm('确定要移除这个服务器吗？')) return
  
  serverOperations.add(serverId)
  
  try {
    const result = await mcpService.removeServer(serverId)
    if (result.success) {
      await refreshServers()
      await refreshTools()
    }
  } catch (error) {
    console.error('移除服务器失败:', error)
  } finally {
    serverOperations.delete(serverId)
  }
}

const testTool = async (tool: any) => {
  testingTool.value = tool.name
  
  try {
    // 执行一个简单的工具测试
    const result = await mcpService.executeTool({
      tool: tool.name,
      parameters: {}
    })
    
    if (result.success) {
      alert(`工具 ${tool.name} 测试成功！`)
    } else {
      alert(`工具 ${tool.name} 测试失败: ${result.error}`)
    }
  } catch (error) {
    alert(`工具测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    testingTool.value = ''
  }
}

// 生命周期
onMounted(async () => {
  await refreshServers()
  await refreshTools()
})
</script>

<style scoped>
.mcp-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0;
  background: transparent;
  -webkit-app-region: no-drag;
}

.manager-header {
  margin-bottom: 24px;
}

.nav-tabs {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 4px;
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
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.nav-tab:hover {
  background: rgba(255, 255, 255, 0.5);
  color: var(--text-primary);
}

.nav-tab.active {
  background: rgba(255, 255, 255, 0.9);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.dark) .nav-tab:hover,
.dark .nav-tab:hover {
  background: rgba(255, 255, 255, 0.15);
}

:deep(.dark) .nav-tab.active,
.dark .nav-tab.active {
  background: rgba(255, 255, 255, 0.2);
}

.manager-content {
  min-height: 400px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.tab-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-refresh,
.btn-browse {
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

.btn-refresh:hover,
.btn-browse:hover {
  background: rgba(0, 122, 255, 0.9);
  transform: translateY(-1px);
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0 0 16px 0;
}

.help-text {
  font-size: 14px;
  opacity: 0.8;
}

.servers-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.server-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  transition: all 0.2s ease;
}

:deep(.dark) .server-item,
.dark .server-item {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.server-info {
  flex: 1;
}

.server-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.server-info p {
  margin: 0 0 8px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.server-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.success {
  background: rgba(52, 199, 89, 0.8);
}

.status-dot.warning {
  background: rgba(255, 149, 0, 0.8);
}

.status-dot.error {
  background: rgba(255, 59, 48, 0.8);
}

.server-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.btn-action {
  background: rgba(0, 122, 255, 0.8);
  color: white;
}

.btn-action.secondary {
  background: rgba(0, 0, 0, 0.1);
  color: var(--text-primary);
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.btn-action.danger {
  background: rgba(255, 59, 48, 0.8);
  color: white;
}

.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.tool-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  transition: all 0.2s ease;
}

:deep(.dark) .tool-card,
.dark .tool-card {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.tool-info h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.tool-info p {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.tool-meta {
  margin-bottom: 12px;
}

.tool-server {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 8px;
}

:deep(.dark) .tool-server,
.dark .tool-server {
  background: rgba(255, 255, 255, 0.1);
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

@media (max-width: 768px) {
  .server-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .server-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
  }
}
</style>