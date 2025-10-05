<template>
  <div class="markdown-renderer">
    <div 
      ref="contentRef"
      class="prose prose-sm max-w-none dark:prose-invert"
      v-html="renderedContent"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted, watch } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
// 导入常用语言
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
import mermaid from 'mermaid'

interface Props {
  content: string
  enableMermaid?: boolean
  enableMath?: boolean
  enableTables?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enableMermaid: true,
  enableMath: true,
  enableTables: true
})

const contentRef = ref<HTMLElement>()

// 配置marked
const configureMarked = () => {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code: string, lang: string) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value
        } catch (err) {
          console.warn('代码高亮失败:', err)
        }
      }
      return hljs.highlightAuto(code).value
    }
  })
}

// 处理Mermaid图表
const processMermaid = async () => {
  if (!props.enableMermaid || !contentRef.value) return
  
  const mermaidElements = contentRef.value.querySelectorAll('.language-mermaid')
  
  for (const element of mermaidElements) {
    try {
      const code = element.textContent || ''
      const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code)
      
      // 创建容器并替换
      const container = document.createElement('div')
      container.className = 'mermaid-diagram'
      container.innerHTML = svg
      
      element.parentElement?.replaceWith(container)
    } catch (err) {
      console.warn('Mermaid渲染失败:', err)
    }
  }
}

// 处理表格
const processTable = (html: string): string => {
  if (!props.enableTables) return html
  
  // 简单地为表格添加类名，不改变结构
  return html.replace(
    /<table>/g,
    '<table class="markdown-table">'
  )
}

// 处理代码块
const processCodeBlocks = (html: string): string => {
  // 为代码块添加复制按钮
  return html.replace(
    /<pre><code class="language-(\w+)">/g,
    '<div class="code-block-wrapper"><div class="code-header"><span class="language-tag">$1</span><button class="copy-btn" onclick="copyCode(this)">复制</button></div><pre><code class="language-$1">'
  ).replace(
    /<\/code><\/pre>/g,
    '</code></pre></div>'
  )
}

// 渲染内容
const renderedContent = computed(() => {
  if (!props.content) return ''
  
  console.log('MarkdownRenderer: 原始内容:', props.content)
  
  configureMarked()
  
  let html = marked(props.content)
  
  console.log('MarkdownRenderer: marked渲染后:', html)
  
  // 处理表格
  html = processTable(html)
  
  // 处理代码块
  html = processCodeBlocks(html)
  
  console.log('MarkdownRenderer: 最终HTML:', html)
  
  return html
})

// 复制代码功能
const setupCopyFunction = () => {
  if (typeof window !== 'undefined') {
    (window as any).copyCode = (button: HTMLButtonElement) => {
      const codeBlock = button.closest('.code-block-wrapper')?.querySelector('code')
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.textContent || '')
        button.textContent = '已复制'
        setTimeout(() => {
          button.textContent = '复制'
        }, 2000)
      }
    }
  }
}

// 初始化Mermaid
const initMermaid = () => {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit'
  })
}

onMounted(() => {
  initMermaid()
  setupCopyFunction()
})

watch(renderedContent, async () => {
  await nextTick()
  await processMermaid()
}, { flush: 'post' })
</script>

<style scoped>
.markdown-renderer {
  @apply w-full;
}

/* 表格样式 */
.table-wrapper {
  @apply overflow-x-auto my-4;
  max-width: 100%;
}

:deep(.markdown-table) {
  @apply w-full border-collapse border border-gray-300 dark:border-gray-600;
  table-layout: fixed;
  width: 100%;
}

:deep(.markdown-table th) {
  @apply bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold;
  font-size: 0.875rem;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

:deep(.markdown-table td) {
  @apply border border-gray-300 dark:border-gray-600 px-2 py-2;
  font-size: 0.875rem;
  line-height: 1.4;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

:deep(.markdown-table tr:nth-child(even)) {
  @apply bg-gray-50 dark:bg-gray-800;
}

/* 通用表格样式 - 确保所有表格都有样式 */
:deep(table) {
  @apply w-full border-collapse border border-gray-300 dark:border-gray-600 my-4;
  table-layout: fixed;
  width: 100%;
}

:deep(table th) {
  @apply bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold;
  font-size: 0.875rem;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

:deep(table td) {
  @apply border border-gray-300 dark:border-gray-600 px-2 py-2;
  font-size: 0.875rem;
  line-height: 1.4;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

:deep(table tr:nth-child(even)) {
  @apply bg-gray-50 dark:bg-gray-800;
}

/* 特殊处理URL列 */
:deep(table td a) {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300;
  word-break: break-all;
  font-size: 0.75rem;
  line-height: 1.2;
  display: inline-block;
  max-width: 100%;
}

/* 确保表格在prose容器中正确显示 */
:deep(.prose) {
  max-width: none;
}

:deep(.prose table) {
  margin: 1rem 0;
  width: 100%;
  table-layout: fixed;
}

:deep(.prose thead th) {
  vertical-align: bottom;
  padding: 0.5rem;
}

:deep(.prose tbody td) {
  vertical-align: top;
  padding: 0.5rem;
}

/* 代码块样式 */
:deep(.code-block-wrapper) {
  @apply relative my-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800;
}

:deep(.code-header) {
  @apply flex justify-between items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-sm;
}

:deep(.language-tag) {
  @apply font-mono text-gray-600 dark:text-gray-400;
}

:deep(.copy-btn) {
  @apply px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors;
}

:deep(.code-block-wrapper pre) {
  @apply m-0 p-4 overflow-x-auto;
}

/* Mermaid图表样式 */
:deep(.mermaid-diagram) {
  @apply flex justify-center my-4 p-4 bg-white dark:bg-gray-800 rounded-lg;
}

:deep(.mermaid-diagram svg) {
  @apply max-w-full h-auto;
}

/* 基础prose样式增强 */
:deep(.prose) {
  @apply text-gray-900 dark:text-gray-100;
}

:deep(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
  @apply text-gray-900 dark:text-gray-100 font-semibold;
}

:deep(.prose h1) {
  @apply text-2xl mb-4 mt-6 first:mt-0;
}

:deep(.prose h2) {
  @apply text-xl mb-3 mt-5 first:mt-0;
}

:deep(.prose h3) {
  @apply text-lg mb-2 mt-4 first:mt-0;
}

:deep(.prose p) {
  @apply mb-4 leading-relaxed;
}

:deep(.prose ul, .prose ol) {
  @apply mb-4 pl-6;
}

:deep(.prose li) {
  @apply mb-1;
}

:deep(.prose blockquote) {
  @apply border-l-4 border-blue-500 pl-4 italic my-4 text-gray-700 dark:text-gray-300;
}

:deep(.prose code) {
  @apply bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono;
}

:deep(.prose pre) {
  @apply bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto my-4;
}

:deep(.prose pre code) {
  @apply bg-transparent p-0;
}

:deep(.prose a) {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline;
}

:deep(.prose strong) {
  @apply font-semibold text-gray-900 dark:text-gray-100;
}

:deep(.prose em) {
  @apply italic;
}

/* 任务列表样式 */
:deep(.prose input[type="checkbox"]) {
  @apply mr-2;
}

:deep(.prose li:has(input[type="checkbox"])) {
  @apply list-none;
}
</style>