<template>
  <div class="mcp-simple-manager">
    <!-- 头部 -->
    <div class="manager-header">
      <h2 class="manager-title">MCP 工具管理</h2>
      <p class="manager-subtitle">管理和配置 MCP 服务器</p>
    </div>

    <!-- 导航标签 -->
    <div class="nav-tabs">
      <button
        :class="['nav-tab', { active: activeTab === 'servers' }]"
        @click="activeTab = 'servers'"
      >
        服务器管理
      </button>
      <button
        :class="['nav-tab', { active: activeTab === 'tools' }]"
        @click="activeTab = 'tools'"
      >
        可用工具
      </button>
      <button
        :class="['nav-tab', { active: activeTab === 'test' }]"
        @click="activeTab = 'test'"
      >
        功能测试
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="tab-content">
      <!-- 服务器管理 -->
      <div v-if="activeTab === 'servers'" class="servers-tab">
        <div class="section-header">
          <h3>预设服务器</h3>
          <button @click="loadPresetServers" class="btn-refresh">
            {{ loading ? '加载中...' : '刷新列表' }}
          </button>
        </div>

        <div v-if="presetServers.length === 0" class="empty-state">
          <p>没有找到预设服务器</p>
          <button @click="loadPresetServers" class="btn-load">加载预设服务器</button>
        </div>

        <div v-else class="servers-grid">
          <div
            v-for="server in presetServers"
            :key="server.id"
            class="server-card"
          >
            <div class="server-info">
              <h4>{{ server.name }}</h4>
              <p>{{ server.description }}</p>
              <div class="server-meta">
                <span class="command">{{ server.command }} {{ server.args.join(' ') }}</span>
              </div>
            </div>
            <div class="server-actions">
              <button
                @click="installServer(server)"
                class="btn-install"
                :disabled="installing === server.id"
              >
                {{ installing === server.id ? '安装中...' : '安装' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 可用工具 -->
      <div v-if="activeTab === 'tools'" class="tools-tab">
        <div class="section-header">
          <h3>可用工具</h3>
          <button @click="loadTools" class="btn-refresh">
            {{ loadingTools ? '加载中...' : '刷新工具' }}
          </button>
        </div>

        <div v-if="tools.length === 0" class="empty-state">
          <p>没有找到可用工具</p>
          <button @click="loadTools" class="btn-load">加载工具</button>
        </div>

        <div v-else class="tools-grid">
          <div
            v-for="tool in tools"
            :key="tool.name"
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
                @click="testTool(tool)"
                class="btn-test"
                :disabled="testingTool === tool.name"
              >
                {{ testingTool === tool.name ? '测试中...' : '测试' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 功能测试 -->
      <div v-if="activeTab === 'test'" class="test-tab">
        <MCPConfigTest />
      </div>
    </div>

    <!-- 状态消息 -->
    <div v-if="statusMessage" class="status-message" :class="statusType">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { mcpService } from '@/services/mcp'
import type { MCPServerConfig } from '@/types'
import MCPConfigTest from './MCPConfigTest.vue'

// 响应式数据
const activeTab = ref<'servers' | 'tools' | 'test'>('servers')
const loading = ref(false)
const loadingTools = ref(false)
const installing = ref('')
const testingTool = ref('')

const presetServers = ref<MCPServerConfig[]>([])
const tools = ref<any[]>([])

const statusMessage = ref('')
const statusType = ref<'success' | 'error' | 'info'>('info')

// 方法
const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, 3000)
}

const loadPresetServers = async () => {
  loading.value = true
  try {
    const servers = mcpService.getPresetServers()
    presetServers.value = servers
    showStatus(`加载了 ${servers.length} 个预设服务器`, 'success')
  } catch (error) {
    console.error('加载预设服务器失败:', error)
    showStatus('加载预设服务器失败', 'error')
  } finally {
    loading.value = false
  }
}

const loadTools = async () => {
  loadingTools.value = true
  try {
    const result = await mcpService.getTools()
    if (result.success) {
      tools.value = result.data || []
      showStatus(`加载了 ${tools.value.length} 个工具`, 'success')
    } else {
      showStatus('加载工具失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('加载工具失败:', error)
    showStatus('加载工具失败', 'error')
  } finally {
    loadingTools.value = false
  }
}

const installServer = async (server: MCPServerConfig) => {
  installing.value = server.id
  try {
    const result = await mcpService.addServer(server)
    if (result.success) {
      showStatus(`服务器 ${server.name} 安装成功`, 'success')
      // 重新加载工具列表
      await loadTools()
    } else {
      showStatus(`安装失败: ${result.error}`, 'error')
    }
  } catch (error) {
    console.error('安装服务器失败:', error)
    showStatus('安装服务器失败', 'error')
  } finally {
    installing.value = ''
  }
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
      showStatus(`工具 ${tool.name} 测试成功`, 'success')
      console.log('工具测试结果:', result.data)
    } else {
      showStatus(`工具测试失败: ${result.error}`, 'error')
    }
  } catch (error) {
    console.error('工具测试失败:', error)
    showStatus('工具测试失败', 'error')
  } finally {
    testingTool.value = ''
  }
}

// 生命周期
onMounted(() => {
  loadPresetServers()
  loadTools()
})
</script>

<style scoped>
.mcp-simple-manager {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  background: transparent;
}

.manager-header {
  text-align: center;
  margin-bottom: 30px;
}

.manager-title {
  font-size: 24px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 8px 0;
}

.manager-subtitle {
  color: #8e8e93;
  margin: 0;
}

.nav-tabs {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 30px;
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

.btn-refresh,
.btn-load,
.btn-install,
.btn-test {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-refresh {
  background: rgba(0, 122, 255, 0.8);
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.9);
  transform: translateY(-1px);
}

.btn-load {
  background: rgba(52, 199, 89, 0.8);
  color: white;
}

.btn-install {
  background: rgba(0, 122, 255, 0.8);
  color: white;
}

.btn-test {
  background: rgba(52, 199, 89, 0.8);
  color: white;
}

.btn-refresh:disabled,
.btn-install:disabled,
.btn-test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #8e8e93;
}

.servers-grid,
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.server-card,
.tool-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.server-card:hover,
.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.server-info h4,
.tool-info h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.server-info p,
.tool-info p {
  margin: 0 0 12px 0;
  color: #8e8e93;
  font-size: 14px;
  line-height: 1.4;
}

.server-meta,
.tool-meta {
  margin-bottom: 16px;
}

.command,
.tool-server {
  font-size: 12px;
  background: rgba(0, 0, 0, 0.05);
  color: #8e8e93;
  padding: 4px 8px;
  border-radius: 8px;
  font-family: monospace;
}

.server-actions,
.tool-actions {
  display: flex;
  justify-content: flex-end;
}

.status-message {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 500;
  z-index: 1000;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.status-message.success {
  background: rgba(52, 199, 89, 0.9);
  color: white;
}

.status-message.error {
  background: rgba(255, 59, 48, 0.9);
  color: white;
}

.status-message.info {
  background: rgba(0, 122, 255, 0.9);
  color: white;
}

@media (max-width: 768px) {
  .servers-grid,
  .tools-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>