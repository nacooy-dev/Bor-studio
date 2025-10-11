# MCP UI 组件集成指南

## 概述

本指南介绍如何将MCP市场和管理组件集成到主应用中，遵循项目的透明玻璃风格设计。

## 组件架构

### 核心组件

1. **MCPManager.vue** - 主管理界面
   - 服务器管理标签页
   - 市场浏览标签页
   - 工具查看标签页

2. **MCPMarketplace.vue** - 服务器市场
   - 服务器搜索和过滤
   - 分类浏览
   - 环境状态检查

3. **MCPServerConfig.vue** - 统一配置对话框
   - 参数配置表单
   - 安装进度跟踪
   - 错误处理

4. **ServerCard.vue** - 服务器卡片
   - 服务器信息展示
   - 状态指示
   - 操作按钮

## 集成方式

### 1. 作为独立页面

```vue
<template>
  <div class="app-container">
    <!-- 其他应用内容 -->
    
    <!-- MCP管理页面 -->
    <MCPManager v-if="currentPage === 'mcp'" />
  </div>
</template>

<script setup>
import MCPManager from '@/components/mcp/MCPManager.vue'
</script>
```

### 2. 作为对话框

```vue
<template>
  <div class="app">
    <!-- 主应用内容 -->
    
    <!-- MCP管理对话框 -->
    <div v-if="showMCPDialog" class="dialog-overlay" @click="closeMCPDialog">
      <div class="dialog-container" @click.stop>
        <MCPManager />
        <button @click="closeMCPDialog" class="close-button">关闭</button>
      </div>
    </div>
  </div>
</template>
```

### 3. 作为侧边栏

```vue
<template>
  <div class="app-layout">
    <div class="main-content">
      <!-- 主要内容 -->
    </div>
    
    <div v-if="showMCPSidebar" class="sidebar">
      <MCPManager />
    </div>
  </div>
</template>
```

## 样式集成

### CSS变量配置

确保在主应用中定义了以下CSS变量：

```css
:root {
  /* 文本颜色 */
  --text-primary: #1d1d1f;
  --text-secondary: #8e8e93;
  
  /* 背景颜色 */
  --card-bg: rgba(255, 255, 255, 0.8);
  --hover-bg: rgba(0, 0, 0, 0.05);
  
  /* 边框颜色 */
  --border-color: rgba(0, 0, 0, 0.1);
  
  /* 输入框 */
  --input-bg: rgba(255, 255, 255, 0.8);
  --input-border: rgba(0, 0, 0, 0.2);
}

/* 深色模式 */
.dark {
  --text-primary: rgba(255, 255, 255, 0.9);
  --text-secondary: rgba(255, 255, 255, 0.6);
  --card-bg: rgba(255, 255, 255, 0.1);
  --hover-bg: rgba(255, 255, 255, 0.1);
  --border-color: rgba(255, 255, 255, 0.2);
  --input-bg: rgba(255, 255, 255, 0.1);
  --input-border: rgba(255, 255, 255, 0.2);
}
```

### 透明玻璃效果

所有组件都使用了透明玻璃效果：

```css
.glass-effect {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}
```

## 事件处理

### 服务器安装事件

```vue
<script setup>
import { mcpService } from '@/services/mcp'

const handleServerInstalled = async (serverId) => {
  // 刷新服务器列表
  await refreshServers()
  
  // 刷新工具列表
  await refreshTools()
  
  // 显示成功消息
  showNotification(`服务器 ${serverId} 安装成功`)
}
</script>
```

### 工具执行事件

```vue
<script setup>
const handleToolExecution = async (toolCall) => {
  try {
    const result = await mcpService.executeTool(toolCall)
    if (result.success) {
      // 处理工具执行结果
      handleToolResult(result.data)
    }
  } catch (error) {
    console.error('工具执行失败:', error)
  }
}
</script>
```

## 状态管理

### 使用Pinia Store

```typescript
// stores/mcp.ts
import { defineStore } from 'pinia'
import { mcpService } from '@/services/mcp'

export const useMCPStore = defineStore('mcp', {
  state: () => ({
    installedServers: [],
    availableTools: [],
    isLoading: false
  }),
  
  actions: {
    async refreshServers() {
      this.isLoading = true
      try {
        const result = await mcpService.getServers()
        if (result.success) {
          this.installedServers = result.data
        }
      } finally {
        this.isLoading = false
      }
    },
    
    async refreshTools() {
      const result = await mcpService.getTools()
      if (result.success) {
        this.availableTools = result.data
      }
    }
  }
})
```

### 在组件中使用

```vue
<script setup>
import { useMCPStore } from '@/stores/mcp'

const mcpStore = useMCPStore()

onMounted(() => {
  mcpStore.refreshServers()
  mcpStore.refreshTools()
})
</script>
```

## 响应式设计

### 移动端适配

```css
@media (max-width: 768px) {
  .servers-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .server-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}
```

### 平板适配

```css
@media (max-width: 1024px) {
  .servers-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}
```

## 性能优化

### 懒加载

```vue
<script setup>
import { defineAsyncComponent } from 'vue'

const MCPMarketplace = defineAsyncComponent(() => 
  import('@/components/mcp/MCPMarketplace.vue')
)
</script>
```

### 虚拟滚动

对于大量服务器列表，可以使用虚拟滚动：

```vue
<template>
  <VirtualList
    :items="servers"
    :item-height="80"
    class="servers-list"
  >
    <template #default="{ item }">
      <ServerCard :server="item" />
    </template>
  </VirtualList>
</template>
```

## 错误处理

### 全局错误处理

```vue
<script setup>
import { onErrorCaptured } from 'vue'

onErrorCaptured((error, instance, info) => {
  console.error('MCP组件错误:', error, info)
  
  // 显示用户友好的错误消息
  showErrorNotification('MCP功能暂时不可用，请稍后重试')
  
  return false // 阻止错误继续传播
})
</script>
```

### 网络错误处理

```typescript
// services/mcp.ts
export class MCPService {
  async addServer(config: MCPServerConfig) {
    try {
      const result = await this.api.addServer(config)
      return result
    } catch (error) {
      if (error instanceof NetworkError) {
        return {
          success: false,
          error: '网络连接失败，请检查网络设置'
        }
      }
      
      return {
        success: false,
        error: error.message || '未知错误'
      }
    }
  }
}
```

## 测试

### 单元测试

```typescript
// tests/components/MCPMarketplace.test.ts
import { mount } from '@vue/test-utils'
import MCPMarketplace from '@/components/mcp/MCPMarketplace.vue'

describe('MCPMarketplace', () => {
  it('应该正确渲染服务器列表', () => {
    const wrapper = mount(MCPMarketplace)
    expect(wrapper.find('.servers-grid').exists()).toBe(true)
  })
  
  it('应该支持搜索功能', async () => {
    const wrapper = mount(MCPMarketplace)
    const searchInput = wrapper.find('.search-input')
    
    await searchInput.setValue('obsidian')
    await searchInput.trigger('input')
    
    // 验证搜索结果
    expect(wrapper.vm.filteredServers.length).toBeGreaterThan(0)
  })
})
```

### 集成测试

```typescript
// tests/integration/mcp-workflow.test.ts
describe('MCP工作流程', () => {
  it('应该能够完成完整的服务器安装流程', async () => {
    // 1. 打开市场
    // 2. 搜索服务器
    // 3. 配置参数
    // 4. 安装服务器
    // 5. 验证安装结果
  })
})
```

## 总结

通过以上集成方式，可以将MCP市场和管理功能无缝集成到主应用中，提供统一的用户体验和一致的视觉风格。

关键要点：
- 遵循项目的透明玻璃风格设计
- 使用统一的CSS变量系统
- 提供灵活的集成方式
- 完善的错误处理和状态管理
- 响应式设计支持各种设备