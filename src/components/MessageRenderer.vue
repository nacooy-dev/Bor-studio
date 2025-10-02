<template>
  <div class="message-renderer">
    <!-- 渲染不同类型的消息内容 -->
    <div v-if="content.type === 'text'" v-html="renderedText" class="prose prose-sm max-w-none" />
    <div v-else-if="content.type === 'code'" class="code-block">
      <div class="code-header">
        <span class="language">{{ content.language || 'text' }}</span>
        <button @click="copyCode" class="copy-btn">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
      <pre><code v-html="highlightedCode"></code></pre>
    </div>
    <div v-else-if="content.type === 'image'" class="image-content">
      <img :src="content.url" :alt="content.alt" class="max-w-full rounded-lg" />
    </div>
    <div v-else-if="content.type === 'file'" class="file-content">
      <div class="file-info">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
        <div>
          <div class="file-name">{{ content.name }}</div>
          <div class="file-size">{{ formatFileSize(content.size) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'

interface MessageContent {
  type: 'text' | 'code' | 'image' | 'file'
  content?: string
  language?: string
  url?: string
  alt?: string
  name?: string
  size?: number
}

interface Props {
  content: MessageContent
}

const props = defineProps<Props>()

// 渲染文本内容
const renderedText = computed(() => {
  if (props.content.type !== 'text' || !props.content.content) return ''
  
  return marked(props.content.content, {
    breaks: true,
    gfm: true,
  })
})

// 高亮代码
const highlightedCode = computed(() => {
  if (props.content.type !== 'code' || !props.content.content) return ''
  
  const language = props.content.language
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(props.content.content, { language }).value
    } catch (err) {
      console.warn('代码高亮失败:', err)
    }
  }
  
  return hljs.highlightAuto(props.content.content).value
})

// 复制代码
const copyCode = async () => {
  if (props.content.content) {
    try {
      await navigator.clipboard.writeText(props.content.content)
      // 这里可以添加复制成功的提示
    } catch (err) {
      console.error('复制失败:', err)
    }
  }
}

// 格式化文件大小
const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.code-block {
  @apply bg-neutral-gray-100 dark:bg-neutral-gray-800 rounded-lg overflow-hidden;
}

.code-header {
  @apply flex justify-between items-center px-4 py-2 bg-neutral-gray-200 dark:bg-neutral-gray-700 text-sm;
}

.language {
  @apply font-mono text-neutral-gray-600 dark:text-neutral-gray-400;
}

.copy-btn {
  @apply text-neutral-gray-500 hover:text-neutral-gray-700 dark:hover:text-neutral-gray-300 transition-colors;
}

.code-block pre {
  @apply p-4 overflow-x-auto;
}

.code-block code {
  @apply font-mono text-sm;
}

.image-content {
  @apply my-2;
}

.file-content {
  @apply p-3 bg-neutral-gray-100 dark:bg-neutral-gray-800 rounded-lg;
}

.file-info {
  @apply flex items-center space-x-3;
}

.file-name {
  @apply font-medium text-neutral-gray-800 dark:text-neutral-gray-200;
}

.file-size {
  @apply text-sm text-neutral-gray-500;
}
</style>