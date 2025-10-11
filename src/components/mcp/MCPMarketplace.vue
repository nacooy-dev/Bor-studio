<template>
  <div class="mcp-marketplace">
    <!-- 头部 -->
    <div class="marketplace-header">
      <h2 class="marketplace-title">MCP 服务器市场</h2>
      <p class="marketplace-subtitle">发现和安装各种 MCP 工具扩展</p>
    </div>

    <!-- 搜索和过滤 -->
    <div class="search-section">
      <div class="search-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索服务器名称、描述或标签..."
          class="search-input"
          @input="handleSearch"
        />
        <button @click="showFilters = !showFilters" class="filter-toggle">
          {{ showFilters ? '收起' : '过滤' }}
        </button>
      </div>

      <!-- 过滤器面板 -->
      <div v-if="showFilters" class="filters-panel">
        <div class="filter-row">
          <div class="filter-group">
            <label>类别</label>
            <select v-model="selectedCategory" @change="applyFilters" class="filter-select">
              <option value="">全部类别</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }} ({{ category.count }})
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label>
              <input
                v-model="showInstalled"
                type="checkbox"
                @change="applyFilters"
              />
              显示已安装
            </label>
          </div>
        </div>

        <div class="tags-section">
          <label>热门标签</label>
          <div class="tags-filter">
            <button
              v-for="tag in popularTags.slice(0, 8)"
              :key="tag.tag"
              :class="['tag-button', { active: selectedTags.includes(tag.tag) }]"
              @click="toggleTag(tag.tag)"
            >
              {{ tag.tag }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 环境检查 -->
    <div v-if="environmentChecks.length > 0" class="environment-section">
      <h3 class="section-title">环境状态</h3>
      <div class="environment-grid">
        <div
          v-for="check in environmentChecks"
          :key="check.tool"
          :class="['env-check', { available: check.available }]"
        >
          <div class="env-status">
            <span class="status-dot" :class="{ success: check.available }"></span>
            <span class="tool-name">{{ check.tool }}</span>
          </div>
          <span v-if="check.version" class="version">{{ check.version }}</span>
        </div>
      </div>
    </div>

    <!-- 推荐服务器 -->
    <div v-if="!searchQuery && !selectedCategory" class="recommended-section">
      <h3 class="section-title">推荐服务器</h3>
      <div class="servers-grid">
        <ServerCard
          v-for="server in recommendedServers"
          :key="server.id"
          :server="server"
          :installation-state="getInstallationState(server.id)"
          @install="handleInstall"
          @uninstall="handleUninstall"
          @configure="handleConfigure"
        />
      </div>
    </div>

    <!-- 服务器列表 -->
    <div class="servers-section">
      <div class="section-header">
        <h3 class="section-title">
          {{ searchQuery || selectedCategory ? `搜索结果 (${filteredServers.length})` : '所有服务器' }}
        </h3>
      </div>
      
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="filteredServers.length === 0" class="empty-state">
        <p>没有找到匹配的服务器</p>
        <button v-if="searchQuery || selectedCategory" @click="clearFilters" class="btn-clear">
          清除筛选条件
        </button>
      </div>

      <div v-else class="servers-grid">
        <ServerCard
          v-for="server in filteredServers"
          :key="server.id"
          :server="server"
          :installation-state="getInstallationState(server.id)"
          @install="handleInstall"
          @uninstall="handleUninstall"
          @configure="handleConfigure"
        />
      </div>
    </div>

    <!-- 安装配置对话框 -->
    <MCPServerConfig
      :server="selectedServer"
      :installation-state="selectedInstallationState"
      :show-dialog="showInstallDialog"
      @install="performInstall"
      @close="closeInstallDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { mcpMarketplace } from '@/lib/mcp/server-marketplace'
import type { MCPServerTemplate } from '@/lib/mcp/server-registry'
import type { ServerInstallationState } from '@/lib/mcp/server-marketplace'
import ServerCard from './ServerCard.vue'
import MCPServerConfig from './MCPServerConfig.vue'

// 响应式数据
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedTags = ref<string[]>([])
const showInstalled = ref(true)
const showDisabled = ref(false)
const showFilters = ref(false)
const loading = ref(false)

const selectedServer = ref<MCPServerTemplate | null>(null)
const selectedInstallationState = ref<ServerInstallationState | null>(null)
const showInstallDialog = ref(false)

// 数据
const categories = ref<Array<{ id: string; name: string; count: number }>>([])
const popularTags = ref<Array<{ tag: string; count: number }>>([])
const environmentChecks = ref(mcpMarketplace.getEnvironmentChecks())
const recommendedServers = ref(mcpMarketplace.getRecommendedServers())

// 响应式数据
const allServers = ref<MCPServerTemplate[]>([])

// 计算属性
const filteredServers = computed(() => {
  let servers = [...allServers.value]
  
  // 应用过滤器
  if (selectedCategory.value) {
    servers = servers.filter(server => server.category === selectedCategory.value)
  }
  
  if (selectedTags.value.length > 0) {
    servers = servers.filter(server => 
      selectedTags.value.some(tag => server.tags.includes(tag))
    )
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    servers = servers.filter(server => 
      server.name.toLowerCase().includes(query) ||
      server.description.toLowerCase().includes(query) ||
      server.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }
  
  if (!showInstalled.value) {
    servers = servers.filter(server => !mcpMarketplace.isInstalled(server.id))
  }
  
  if (!showDisabled.value) {
    servers = servers.filter(server => !server.disabled)
  }
  
  return servers
})

// 方法
const loadServers = async () => {
  loading.value = true
  try {
    // 并行加载所有数据
    const [servers, cats, tags] = await Promise.all([
      mcpMarketplace.getAvailableServers(),
      mcpMarketplace.getCategories(),
      mcpMarketplace.getPopularTags()
    ])
    
    allServers.value = servers
    categories.value = cats
    popularTags.value = tags
    
    console.log('✅ 加载了', servers.length, '个服务器')
  } catch (error) {
    console.error('❌ 加载服务器失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  // 搜索逻辑已在计算属性中处理
}

const applyFilters = () => {
  // 过滤逻辑已在计算属性中处理
}

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
  applyFilters()
}

const getInstallationState = (serverId: string): ServerInstallationState => {
  return mcpMarketplace.getInstallationState(serverId)
}

const handleInstall = (server: MCPServerTemplate) => {
  selectedServer.value = server
  selectedInstallationState.value = getInstallationState(server.id)
  showInstallDialog.value = true
}

const handleUninstall = async (server: MCPServerTemplate) => {
  if (confirm(`确定要卸载 ${server.name} 吗？`)) {
    const result = await mcpMarketplace.uninstallServer(server.id)
    if (result.success) {
      // 更新UI
      console.log('卸载成功:', result.message)
    } else {
      console.error('卸载失败:', result.error)
    }
  }
}

const handleConfigure = (server: MCPServerTemplate) => {
  // 打开配置对话框
  console.log('配置服务器:', server.name)
}

const performInstall = async (server: MCPServerTemplate, parameters: Record<string, any>) => {
  try {
    const result = await mcpMarketplace.installServer(
      server,
      parameters,
      (state) => {
        selectedInstallationState.value = state
      }
    )

    if (result.success) {
      console.log('安装成功:', result.message)
      closeInstallDialog()
    } else {
      console.error('安装失败:', result.error)
    }
  } catch (error) {
    console.error('安装过程出错:', error)
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedTags.value = []
  showFilters.value = false
}

const closeInstallDialog = () => {
  showInstallDialog.value = false
  selectedServer.value = null
  selectedInstallationState.value = null
}

// 生命周期
onMounted(() => {
  loadServers()
})
</script>

<style scoped>
.mcp-marketplace {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0;
  background: transparent;
  -webkit-app-region: no-drag;
}

.marketplace-header {
  text-align: center;
  margin-bottom: 32px;
}

.marketplace-title {
  font-size: 24px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 8px 0;
}

.marketplace-subtitle {
  color: #8e8e93;
  margin: 0;
}

/* 深色模式 */
:deep(.dark) .marketplace-title,
.dark .marketplace-title {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .marketplace-subtitle,
.dark .marketplace-subtitle {
  color: rgba(255, 255, 255, 0.6);
}

.search-section {
  margin-bottom: 24px;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: rgba(0, 122, 255, 0.5);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

.filter-toggle {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.filter-toggle:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

/* 深色模式搜索 */
:deep(.dark) .search-input,
.dark .search-input {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

:deep(.dark) .filter-toggle,
.dark .filter-toggle {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.filters-panel {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

:deep(.dark) .filters-panel,
.dark .filters-panel {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.filter-row {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
  white-space: nowrap;
}

:deep(.dark) .filter-group label,
.dark .filter-group label {
  color: rgba(255, 255, 255, 0.9);
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  font-size: 14px;
}

:deep(.dark) .filter-select,
.dark .filter-select {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.tags-section {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 16px;
}

:deep(.dark) .tags-section,
.dark .tags-section {
  border-color: rgba(255, 255, 255, 0.2);
}

.tags-section label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

:deep(.dark) .tags-section label,
.dark .tags-section label {
  color: rgba(255, 255, 255, 0.9);
}

.tags-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-button {
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.tag-button:hover {
  background: rgba(0, 122, 255, 0.1);
  border-color: rgba(0, 122, 255, 0.3);
}

.tag-button.active {
  background: rgba(0, 122, 255, 0.8);
  border-color: rgba(0, 122, 255, 0.8);
  color: white;
}

:deep(.dark) .tag-button,
.dark .tag-button {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.environment-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 16px 0;
}

:deep(.dark) .section-title,
.dark .section-title {
  color: rgba(255, 255, 255, 0.9);
}

.environment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.env-check {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.env-check.available {
  border-color: rgba(52, 199, 89, 0.3);
  background: rgba(52, 199, 89, 0.05);
}

:deep(.dark) .env-check,
.dark .env-check {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dark) .env-check.available,
.dark .env-check.available {
  background: rgba(52, 199, 89, 0.1);
  border-color: rgba(52, 199, 89, 0.3);
}

.env-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 59, 48, 0.8);
}

.status-dot.success {
  background: rgba(52, 199, 89, 0.8);
}

.tool-name {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

:deep(.dark) .tool-name,
.dark .tool-name {
  color: rgba(255, 255, 255, 0.9);
}

.version {
  font-size: 12px;
  color: #8e8e93;
  font-family: monospace;
}

:deep(.dark) .version,
.dark .version {
  color: rgba(255, 255, 255, 0.6);
}

.recommended-section,
.servers-section {
  margin-bottom: 32px;
}

.section-header {
  margin-bottom: 16px;
}

.servers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .servers-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #8e8e93;
}

:deep(.dark) .loading-state,
:deep(.dark) .empty-state,
.dark .loading-state,
.dark .empty-state {
  color: rgba(255, 255, 255, 0.6);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top: 3px solid rgba(0, 122, 255, 0.8);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

:deep(.dark) .loading-spinner,
.dark .loading-spinner {
  border-color: rgba(255, 255, 255, 0.2);
  border-top-color: rgba(0, 122, 255, 0.8);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn-clear {
  margin-top: 16px;
  padding: 8px 16px;
  background: rgba(0, 122, 255, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.btn-clear:hover {
  background: rgba(0, 122, 255, 0.9);
  transform: translateY(-1px);
}
</style>