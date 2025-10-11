<template>
  <div class="mcp-config-test">
    <h2>MCP 配置测试</h2>
    
    <div class="test-section">
      <h3>基础功能测试</h3>
      <button @click="testGetPresetServers" class="test-button">
        测试获取预设服务器
      </button>
      <button @click="testGetTools" class="test-button">
        测试获取工具列表
      </button>
      <button @click="testAICapabilities" class="test-button">
        测试AI能力
      </button>
    </div>
    
    <div class="results-section">
      <h3>测试结果</h3>
      <div class="results">
        <pre>{{ testResults }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { mcpService } from '@/services/mcp'

const testResults = ref('')

const addResult = (test: string, result: any) => {
  const timestamp = new Date().toLocaleTimeString()
  testResults.value += `[${timestamp}] ${test}:\n${JSON.stringify(result, null, 2)}\n\n`
}

const testGetPresetServers = async () => {
  try {
    const result = mcpService.getPresetServers()
    addResult('获取预设服务器', { success: true, count: result.length, servers: result.map(s => s.name) })
  } catch (error) {
    addResult('获取预设服务器', { success: false, error: error.message })
  }
}

const testGetTools = async () => {
  try {
    const result = await mcpService.getTools()
    addResult('获取工具列表', { success: result.success, count: result.data?.length || 0 })
  } catch (error) {
    addResult('获取工具列表', { success: false, error: error.message })
  }
}

const testAICapabilities = async () => {
  try {
    const result = await mcpService.getAICapabilities()
    addResult('获取AI能力', result)
  } catch (error) {
    addResult('获取AI能力', { success: false, error: error.message })
  }
}
</script>

<style scoped>
.mcp-config-test {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-section {
  margin-bottom: 30px;
}

.test-button {
  margin-right: 10px;
  margin-bottom: 10px;
  padding: 10px 15px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.test-button:hover {
  background: #0056b3;
}

.results-section {
  border-top: 1px solid #ddd;
  padding-top: 20px;
}

.results {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
  max-height: 400px;
  overflow-y: auto;
}

.results pre {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
}

h2, h3 {
  color: #333;
}
</style>