<template>
  <div class="text-renderer">
    <div v-html="formattedContent" class="prose prose-sm max-w-none dark:prose-invert" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

interface Props {
  content: string
}

const props = defineProps<Props>()

const formattedContent = computed(() => {
  // 确保输入是字符串
  if (!props.content || typeof props.content !== 'string') {
    console.warn('⚠️ Invalid content:', props.content)
    return ''
  }

  // 使用marked进行Markdown解析，确保链接正确渲染
  let content = String(props.content)
  
  console.log('🔧 Processing content with marked:', content.substring(0, 100))
  
  try {
    // 配置marked选项
    marked.setOptions({
      breaks: true,
      gfm: true,
      sanitize: false,
      smartLists: true,
      smartypants: false
    })

    // 自定义渲染器，确保链接可点击
    const renderer = new marked.Renderer()
    
    // 重写链接渲染器，确保所有链接都可点击
    renderer.link = (href: string, title: string | null, text: string): string => {
      const titleAttr = title ? ` title="${title}"` : ''
      const safeHref = href.startsWith('http') ? href : `https://${href}`
      console.log('🔗 Rendering link:', text, '→', safeHref)
      return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium">${text}</a>`
    }

    // 重写段落渲染器，处理纯URL
    const originalParagraph = renderer.paragraph.bind(renderer)
    renderer.paragraph = (text: string): string => {
      // 在段落中查找并转换纯URL
      const urlRegex = /(^|[^"'>])(https?:\/\/[^\s<>"']+)/g
      const processedText = text.replace(urlRegex, (match, prefix, url) => {
        // 检查URL是否已经在链接标签中
        if (text.includes(`href="${url}"`)) {
          return match
        }
        console.log('🌐 Converting plain URL to link:', url)
        return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium">${url}</a>`
      })
      
      return originalParagraph(processedText)
    }

    // 使用自定义渲染器
    marked.use({ renderer })

    // 解析Markdown
    const result = marked(content)
    console.log('✅ Marked parsing result:', result.substring(0, 200))
    return result

  } catch (error) {
    console.error('❌ Marked parsing failed:', error)
    
    // 降级到手动处理
    console.log('🔄 Falling back to manual processing')
    
    // 1. 处理Markdown链接 [text](url)
    content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const safeUrl = url.startsWith('http') ? url : `https://${url}`
      console.log('🔗 Manual markdown link:', text, '→', safeUrl)
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium">${text}</a>`
    })

    // 2. 处理纯URL (避免重复处理已经在<a>标签中的)
    content = content.replace(/(^|[^"'>])(https?:\/\/[^\s<>"']+)/g, (match, prefix, url) => {
      console.log('🌐 Manual plain URL:', url)
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium">${url}</a>`
    })

    // 3. 处理粗体文本 **text**
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')

    // 4. 处理斜体文本 *text*
    content = content.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>')

    // 5. 处理换行
    content = content.replace(/\n/g, '<br>')

    console.log('✅ Manual processing result:', content.substring(0, 200))
    return content
  }
})
</script>

<style scoped>
.text-renderer {
  @apply my-2;
}

:deep(.prose) {
  @apply text-gray-900 dark:text-gray-100;
}

:deep(.prose p) {
  @apply mb-3 leading-relaxed;
}

:deep(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
  @apply text-gray-900 dark:text-gray-100 font-semibold mb-3 mt-6 first:mt-0;
}

:deep(.prose strong) {
  @apply font-semibold text-gray-900 dark:text-gray-100;
}

:deep(.prose em) {
  @apply italic;
}

:deep(.prose a) {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium;
  pointer-events: auto !important;
  text-decoration: underline !important;
}
</style>