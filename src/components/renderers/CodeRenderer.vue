<template>
  <div class="code-renderer">
    <div class="code-block">
      <div class="code-header">
        <span class="language-label">{{ metadata?.language || 'text' }}</span>
        <button @click="copyCode" class="copy-button" :class="{ 'copied': isCopied }">
          <svg v-if="!isCopied" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ isCopied ? '已复制' : '复制' }}
        </button>
      </div>
      <pre class="code-content"><code v-html="highlightedCode"></code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'

// 注册语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', html)

interface Props {
  content: string
  metadata?: Record<string, any>
}

const props = defineProps<Props>()
const isCopied = ref(false)

const highlightedCode = computed(() => {
  const language = props.metadata?.language
  
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(props.content, { language }).value
    } catch (err) {
      console.warn('代码高亮失败:', err)
    }
  }
  
  return hljs.highlightAuto(props.content).value
})

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.content)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}
</script>

<style scoped>
.code-renderer {
  @apply my-4;
}

.code-block {
  @apply rounded-lg overflow-hidden bg-gray-900 dark:bg-gray-800;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.code-header {
  @apply flex justify-between items-center px-4 py-2 bg-gray-800 dark:bg-gray-700 border-b border-gray-700;
}

.language-label {
  @apply text-sm font-mono text-gray-300 dark:text-gray-400;
}

.copy-button {
  @apply flex items-center gap-2 px-3 py-1 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors;
}

.copy-button.copied {
  @apply text-green-400 bg-green-900;
}

.code-content {
  @apply p-4 overflow-x-auto text-sm;
  background: #1a1a1a;
}

.code-content code {
  @apply font-mono text-gray-100;
  line-height: 1.5;
}

/* 代码高亮样式 */
:deep(.hljs-keyword) { color: #c792ea; }
:deep(.hljs-string) { color: #c3e88d; }
:deep(.hljs-number) { color: #f78c6c; }
:deep(.hljs-comment) { color: #546e7a; font-style: italic; }
:deep(.hljs-function) { color: #82aaff; }
:deep(.hljs-variable) { color: #eeffff; }
:deep(.hljs-attr) { color: #ffcb6b; }
:deep(.hljs-tag) { color: #f07178; }
</style>