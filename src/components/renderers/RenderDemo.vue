<template>
  <div class="render-demo p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">🚀 智能渲染引擎演示</h1>
    
    <!-- 控制面板 -->
    <div class="controls mb-6 p-4 bg-gray-50 rounded-lg">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2">内容类型</label>
          <select v-model="selectedDemo" class="w-full p-2 border rounded">
            <option value="text">普通文本</option>
            <option value="links">包含链接</option>
            <option value="markdown">Markdown格式</option>
            <option value="mixed">混合内容</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-2">主题</label>
          <select v-model="theme" class="w-full p-2 border rounded">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-2">性能模式</label>
          <select v-model="performance" class="w-full p-2 border rounded">
            <option value="fast">快速</option>
            <option value="balanced">平衡</option>
            <option value="quality">质量</option>
          </select>
        </div>
      </div>
      
      <div class="mt-4">
        <button 
          @click="renderContent" 
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          :disabled="isRendering"
        >
          {{ isRendering ? '渲染中...' : '重新渲染' }}
        </button>
        
        <span class="ml-4 text-sm text-gray-600">
          渲染时间: {{ renderTime }}ms
        </span>
      </div>
    </div>

    <!-- 内容输入 -->
    <div class="mb-6">
      <label class="block text-sm font-medium mb-2">自定义内容</label>
      <textarea 
        v-model="customContent"
        class="w-full h-32 p-3 border rounded-lg font-mono text-sm"
        placeholder="输入要渲染的内容..."
      />
    </div>

    <!-- 渲染结果 -->
    <div class="render-result">
      <h2 class="text-lg font-semibold mb-4">渲染结果</h2>
      
      <div 
        class="border rounded-lg p-4"
        :class="theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'"
      >
        <SmartContentRenderer 
          :content="currentContent"
          :options="renderOptions"
        />
      </div>
    </div>

    <!-- 性能统计 -->
    <div class="mt-6 p-4 bg-blue-50 rounded-lg">
      <h3 class="font-semibold mb-2">性能统计</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div class="text-gray-600">内容长度</div>
          <div class="font-mono">{{ currentContent.length }} 字符</div>
        </div>
        <div>
          <div class="text-gray-600">渲染时间</div>
          <div class="font-mono">{{ renderTime }}ms</div>
        </div>
        <div>
          <div class="text-gray-600">渲染模式</div>
          <div class="font-mono">{{ performance }}</div>
        </div>
        <div>
          <div class="text-gray-600">主题</div>
          <div class="font-mono">{{ theme }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SmartContentRenderer from '../SmartContentRenderer.vue'

// 响应式数据
const selectedDemo = ref('text')
const theme = ref<'light' | 'dark'>('light')
const performance = ref<'fast' | 'balanced' | 'quality'>('balanced')
const customContent = ref('')
const isRendering = ref(false)
const renderTime = ref(0)

// 演示内容
const demoContents = {
  text: `这是一个简单的文本渲染演示。

新的智能渲染引擎可以：
- 快速识别内容类型
- 选择最优渲染器
- 提供高性能渲染体验

渲染速度目标：10ms内完成简单文本渲染。`,

  links: `这里包含一些链接测试：

官方网站：https://www.example.com
GitHub仓库：https://github.com/example/repo
文档地址：https://docs.example.com/guide

这些链接应该是可点击的，并且会在新标签页中打开。`,

  markdown: `# Markdown 渲染测试

## 功能特性

**粗体文本** 和 *斜体文本* 的渲染效果。

### 代码示例

这是一个行内代码：\`console.log('Hello World')\`

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('智能渲染引擎'));
\`\`\`

### 列表

- 项目一
- 项目二
- 项目三

1. 有序列表项一
2. 有序列表项二
3. 有序列表项三`,

  mixed: `# 混合内容渲染测试

这是一个包含多种内容类型的复杂示例。

## 链接和文本
访问我们的网站：https://www.example.com 了解更多信息。

## 代码块
\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
\`\`\`

## 表格
| 功能 | 状态 | 性能 |
|------|------|------|
| 文本渲染 | ✅ | 5ms |
| 链接渲染 | ✅ | 3ms |
| 代码高亮 | 🚧 | 15ms |

## 数学公式（计划中）
当前版本暂不支持，未来将支持 LaTeX 公式渲染。`
}

// 计算属性
const currentContent = computed(() => {
  return customContent.value || demoContents[selectedDemo.value as keyof typeof demoContents]
})

const renderOptions = computed(() => ({
  theme: theme.value,
  performance: performance.value,
  interactive: true
}))

// 渲染内容
const renderContent = async () => {
  isRendering.value = true
  const startTime = performance.now()
  
  // 模拟渲染延迟
  await new Promise(resolve => setTimeout(resolve, 50))
  
  renderTime.value = Math.round(performance.now() - startTime)
  isRendering.value = false
}

// 监听变化自动重新渲染
watch([selectedDemo, theme, performance], () => {
  renderContent()
}, { immediate: true })
</script>

<style scoped>
.render-demo {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 深色主题样式 */
.dark-theme {
  background-color: #1f2937;
  color: #e5e7eb;
}
</style>