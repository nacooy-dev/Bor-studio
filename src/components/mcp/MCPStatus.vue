<template>
  <div class="mcp-status">
    <div class="status-header">
      <div class="status-icon">
        <component :is="getStatusIcon()" :class="getStatusColor()" class="w-4 h-4" />
      </div>
      <span class="status-text">MCP</span>
      <span class="server-count">{{ runningServers.length }}/{{ totalServers }}</span>
    </div>
    
    <div v-if="showDetails" class="status-details">
      <div v-if="runningServers.length === 0" class="no-servers">
        暂无运行中的MCP服务器
      </div>
      
      <div v-else class="server-list">
        <div v-for="server in runningServers" :key="server.id" class="server-item">
          <div class="server-info">
            <span class="server-name">{{ server.name }}</span>
            <span class="tool-count">{{ getToolCount(server.id) }} 工具</span>
          </div>
          <div class="server-status running">
            <div class="status-dot"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Server, AlertCircle, CheckCircle } from 'lucide-vue-next'
import { mcpService } from '@/services/mcp'

// Props
interface Props {
  showDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false
})

// 响应式数据
const servers = ref<any[]>([])
const tools = ref<any[]>([])
const updateInterval = ref<NodeJS.Timeout | null>(null)

// 计算属性
const totalServers = computed(() => servers.value.length)
const runningServers = computed(() => servers.value.filter(s => s.status === 'running'))

const getStatusIcon = () => {
  if (runningServers.value.length === 0) {
    return AlertCircle
  } else if (runningServers.value.length === totalServers.value) {
    return CheckCircle
  } else {
    return Server
  }
}

const getStatusColor = () => {
  if (runningServers.value.length === 0) {
    return 'text-gray-400'
  } else if (runningServers.value.length === totalServers.value) {
    return 'text-green-500'
  } else {
    return 'text-yellow-500'
  }
}

const getToolCount = (serverId: string) => {
  return tools.value.filter(tool => tool.server === serverId).length
}

// 方法
const loadData = async () => {
  try {
    const [serversResult, toolsResult] = await Promise.all([
      mcpService.getServers(),
      mcpService.getTools()
    ])
    
    if (serversResult.success && serversResult.data) {
      servers.value = serversResult.data
    }
    
    if (toolsResult.success && toolsResult.data) {
      tools.value = toolsResult.data
    }
  } catch (error) {
    console.error('加载MCP状态失败:', error)
  }
}

// 生命周期
onMounted(async () => {
  await loadData()
  
  // 每5秒更新一次状态
  updateInterval.value = setInterval(loadData, 5000)
})

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value)
  }
})
</script>

<style scoped>
.mcp-status {
  @apply text-sm;
}

.status-header {
  @apply flex items-center gap-2;
}

.status-icon {
  @apply flex-shrink-0;
}

.status-text {
  @apply font-medium text-gray-700 dark:text-gray-300;
}

.server-count {
  @apply text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full;
}

.status-details {
  @apply mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg;
}

.no-servers {
  @apply text-xs text-gray-500 dark:text-gray-400 italic;
}

.server-list {
  @apply space-y-1;
}

.server-item {
  @apply flex items-center justify-between;
}

.server-info {
  @apply flex items-center gap-2;
}

.server-name {
  @apply text-xs font-medium text-gray-700 dark:text-gray-300;
}

.tool-count {
  @apply text-xs text-gray-500 dark:text-gray-400;
}

.server-status.running {
  @apply flex items-center;
}

.status-dot {
  @apply w-2 h-2 bg-green-500 rounded-full;
}
</style>