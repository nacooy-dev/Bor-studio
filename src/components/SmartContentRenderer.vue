<template>
  <div class="smart-content-renderer">
    <!-- 使用新的智能渲染引擎 -->
    <div 
      v-if="renderedContent" 
      v-html="renderedContent"
      class="rendered-content"
    />
    
    <!-- 加载状态 -->
    <div v-else-if="isLoading" class="loading-state">
      <div class="flex items-center space-x-2 p-4">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span class="text-sm text-gray-600">正在渲染内容...</span>
      </div>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <div class="p-4 bg-red-50 border border-red-200 rounded-md">
        <div class="text-red-800 font-medium mb-2">渲染失败</div>
        <pre class="text-sm text-red-600 whitespace-pre-wrap">{{ content }}</pre>
      </div>
    </div>
    
    <!-- 空内容 -->
    <div v-else-if="!content || content.trim().length === 0" class="empty-content">
      <!-- 空状态 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

interface Props {
  content: string
  options?: {
    theme?: 'light' | 'dark'
    performance?: 'fast' | 'balanced' | 'quality'
    interactive?: boolean
  }
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({
    theme: 'light',
    performance: 'balanced',
    interactive: true
  })
})

const renderedContent = ref<string>('')
const isLoading = ref(false)
const error = ref<Error | null>(null)

// 动态导入渲染引擎
let renderEngine: any = null

const initializeRenderEngine = async () => {
  try {
    const { globalRenderEngine } = await import('@/lib/render-engine/core/RenderEngine')
    renderEngine = globalRenderEngine
    await renderEngine.initialize()
  } catch (err) {
    console.error('Failed to initialize render engine:', err)
    throw err
  }
}

const renderContent = async () => {
  if (!props.content || props.content.trim().length === 0) {
    renderedContent.value = ''
    return
  }

  isLoading.value = true
  error.value = null

  try {
    // 确保渲染引擎已初始化
    if (!renderEngine) {
      await initializeRenderEngine()
    }

    // 渲染内容
    const element = await renderEngine.render(props.content, {
      theme: props.options?.theme || 'light',
      performance: props.options?.performance || 'balanced',
      interactive: props.options?.interactive !== false
    })

    // 将React元素转换为HTML字符串
    // 注意：这是一个简化的实现，实际项目中可能需要使用react-dom/server
    renderedContent.value = await convertReactElementToHTML(element)

  } catch (err) {
    console.error('Render failed:', err)
    error.value = err instanceof Error ? err : new Error(String(err))
    
    // 降级到简单文本渲染
    renderedContent.value = `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(props.content)}</pre>`
  } finally {
    isLoading.value = false
  }
}

// 简化的React元素到HTML转换
const convertReactElementToHTML = async (element: any): Promise<string> => {
  // 这是一个简化的实现
  // 在实际项目中，你可能需要使用react-dom/server的renderToString
  
  if (typeof element === 'string') {
    return element
  }
  
  if (element && element.props) {
    const { children, dangerouslySetInnerHTML, className, style, ...otherProps } = element.props
    const tag = element.type || 'div'
    
    // 处理dangerouslySetInnerHTML
    if (dangerouslySetInnerHTML && dangerouslySetInnerHTML.__html) {
      return `<${tag} class="${className || ''}" style="${styleObjectToString(style || {})}">${dangerouslySetInnerHTML.__html}</${tag}>`
    }
    
    // 处理普通内容
    const content = Array.isArray(children) 
      ? children.map(child => typeof child === 'string' ? child : '').join('')
      : (typeof children === 'string' ? children : '')
    
    return `<${tag} class="${className || ''}" style="${styleObjectToString(style || {})}">${escapeHtml(content)}</${tag}>`
  }
  
  return escapeHtml(String(element))
}

// 样式对象转CSS字符串
const styleObjectToString = (style: Record<string, any>): string => {
  return Object.entries(style)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
    .join('; ')
}

// HTML转义
const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 监听内容变化
watch(() => props.content, renderContent, { immediate: false })
watch(() => props.options, renderContent, { deep: true })

// 组件挂载时渲染
onMounted(() => {
  nextTick(() => {
    renderContent()
  })
})
</script>

<style scoped>
.smart-content-renderer {
  @apply w-full;
}

.rendered-content {
  @apply space-y-4;
}

/* 渲染内容的样式 */
:deep(.rendered-content) {
  /* 文本样式 */
  @apply text-gray-900 dark:text-gray-100 leading-relaxed;
}

:deep(.rendered-content p) {
  @apply mb-3;
}

:deep(.rendered-content h1),
:deep(.rendered-content h2),
:deep(.rendered-content h3),
:deep(.rendered-content h4),
:deep(.rendered-content h5),
:deep(.rendered-content h6) {
  @apply font-semibold mb-3 mt-6 first:mt-0;
}

:deep(.rendered-content a) {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline;
}

:deep(.rendered-content code) {
  @apply bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono;
}

:deep(.rendered-content pre) {
  @apply bg-gray-100 dark:bg-gray-800 rounded-md p-3 overflow-x-auto;
}

:deep(.rendered-content table) {
  @apply min-w-full border-collapse border border-gray-300 dark:border-gray-600;
}

:deep(.rendered-content th),
:deep(.rendered-content td) {
  @apply border border-gray-300 dark:border-gray-600 px-3 py-2;
}

:deep(.rendered-content th) {
  @apply bg-gray-50 dark:bg-gray-700 font-semibold;
}

/* 加载和错误状态样式 */
.loading-state {
  @apply flex items-center justify-center py-8;
}

.error-state {
  @apply py-4;
}
</style>