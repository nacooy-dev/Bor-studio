import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mcpService } from '@/services/mcp'
import type { MCPServerConfig, ApiResponse } from '@/types'

export const useMCPStore = defineStore('mcp', () => {
  // 状态
  const servers = ref<MCPServerConfig[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const activeServers = computed(() => 
    servers.value.filter(server => server.autoStart)
  )

  const presetServers = computed(() => 
    mcpService.getPresetServers()
  )

  // 操作
  async function loadServers() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await mcpService.getServers()
      if (response.success && response.data) {
        servers.value = response.data
      } else {
        error.value = response.error || '加载服务器列表失败'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
    } finally {
      isLoading.value = false
    }
  }

  async function addServer(config: MCPServerConfig): Promise<boolean> {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await mcpService.addServer(config)
      if (response.success) {
        await loadServers() // 重新加载服务器列表
        return true
      } else {
        error.value = response.error || '添加服务器失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function startServer(serverId: string): Promise<boolean> {
    try {
      const response = await mcpService.startServer(serverId)
      if (response.success) {
        await loadServers() // 重新加载服务器列表
        return true
      } else {
        error.value = response.error || '启动服务器失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
      return false
    }
  }

  async function stopServer(serverId: string): Promise<boolean> {
    try {
      const response = await mcpService.stopServer(serverId)
      if (response.success) {
        await loadServers() // 重新加载服务器列表
        return true
      } else {
        error.value = response.error || '停止服务器失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
      return false
    }
  }

  async function removeServer(serverId: string): Promise<boolean> {
    try {
      const response = await mcpService.removeServer(serverId)
      if (response.success) {
        await loadServers() // 重新加载服务器列表
        return true
      } else {
        error.value = response.error || '删除服务器失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
      return false
    }
  }

  function clearError() {
    error.value = null
  }

  async function forceRemoveServer(serverId: string): Promise<boolean> {
    try {
      const response = await mcpService.forceRemoveServer(serverId)
      if (response.success) {
        await loadServers() // 重新加载服务器列表
        return true
      } else {
        error.value = response.error || '强制删除服务器失败'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
      return false
    }
  }

  return {
    // 状态
    servers,
    isLoading,
    error,
    
    // 计算属性
    activeServers,
    presetServers,
    
    // 操作
    loadServers,
    addServer,
    startServer,
    stopServer,
    removeServer,
    forceRemoveServer,
    clearError
  }
})