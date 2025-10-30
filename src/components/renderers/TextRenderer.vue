<template>
  <div class="text-renderer">
    <div v-html="formattedContent" class="prose prose-sm max-w-none dark:prose-invert" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { marked, type Tokens } from 'marked'

// 缓存变量
const lastRenderedContent = ref('')
const lastRenderedResult = ref('')

interface Props {
  content: string | any
}

const props = defineProps<Props>()

const formattedContent = computed(() => {
  // 确保输入是字符串
  let contentStr: string
  if (!props.content) {
    contentStr = ''
  } else if (typeof props.content === 'string') {
    contentStr = props.content
  } else if (typeof props.content === 'object') {
    // 如果是对象，尝试提取文本内容
    if (props.content.text && typeof props.content.text === 'string') {
      contentStr = props.content.text
    } else if (props.content.raw && typeof props.content.raw === 'string') {
      contentStr = props.content.raw
    } else {
      // 尝试转换为字符串
      try {
        contentStr = String(props.content)
      } catch (e) {
        console.warn('⚠️ Failed to convert content to string:', props.content)
        contentStr = ''
      }
    }
  } else {
    // 如果不是字符串，尝试转换为字符串
    try {
      contentStr = String(props.content)
    } catch (e) {
      console.warn('⚠️ Failed to convert content to string:', props.content)
      contentStr = ''
    }
  }

  // 防抖：避免频繁渲染相同内容
  if (contentStr === lastRenderedContent.value) {
    return lastRenderedResult.value
  }
  
  // console.log('🔧 Processing content with marked:', contentStr.substring(0, 50))
  
  try {
    // 配置marked选项
    marked.setOptions({
      breaks: true,
      gfm: true
    })

    // 自定义渲染器，确保链接可点击
    const renderer = new marked.Renderer()
    
    // 重写链接渲染器，确保所有链接都可点击
    renderer.link = ({ href, title, text }: Tokens.Link): string => {
      const titleAttr = title ? ` title="${title}"` : ''
      const safeHref = href.startsWith('http') ? href : `https://${href}`
      console.log('🔗 Rendering link:', text, '→', safeHref)
      return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium">${text}</a>`
    }

    // 重写段落渲染器，处理纯URL
    renderer.paragraph = ({ tokens }: Tokens.Paragraph): string => {
      // 将tokens转换为文本
      let text = ''
      if (tokens && Array.isArray(tokens)) {
        // 使用marked内置的parseInline方法来处理内联标记
        try {
          const rawText = tokens.map(token => token.raw || '').join('')
          // marked.parseInline 可能返回 Promise，所以我们需要处理这种情况
          const parsed = marked.parseInline(rawText)
          if (parsed instanceof Promise) {
            // 如果是 Promise，我们使用简单的方法处理
            text = tokens.map(token => {
              if (token.type === 'text') {
                return (token as Tokens.Text).text || ''
              } else if (token.type === 'link') {
                const linkToken = token as Tokens.Link
                return linkToken.text || ''
              }
              return ''
            }).join('')
          } else {
            text = parsed as string
          }
        } catch (e) {
          // 如果parseInline失败，尝试使用简单的方法
          text = tokens.map(token => {
            if (token.type === 'text') {
              return (token as Tokens.Text).text || ''
            } else if (token.type === 'link') {
              const linkToken = token as Tokens.Link
              return linkToken.text || ''
            }
            return ''
          }).join('')
        }
      }
      
      // 确保text是字符串
      if (typeof text !== 'string') {
        console.warn('⚠️ Paragraph text is not a string:', text)
        text = String(text || '')
      }
      
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
      
      // 直接返回处理后的文本，用<p>标签包装
      return `<p>${processedText}</p>`
    }

    // 使用自定义渲染器
    marked.use({ renderer })

    // 解析Markdown
    const result = marked(contentStr)
    
    // 更新缓存
    lastRenderedContent.value = contentStr
    lastRenderedResult.value = typeof result === 'string' ? result : ''
    
    // console.log('✅ Marked parsing result:', typeof result === 'string' ? result.substring(0, 50) : '[Promise result]')
    return result

  } catch (error) {
    console.error('❌ Marked parsing failed:', error)
    
    // 降级到手动处理
    console.log('🔄 Falling back to manual processing')
    
    // 1. 处理Markdown链接 [text](url)
    contentStr = contentStr.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const safeUrl = url.startsWith('http') ? url : `https://${url}`
      console.log('🔗 Manual markdown link:', text, '→', safeUrl)
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium">${text}</a>`
    })

    // 2. 处理纯URL (避免重复处理已经在<a>标签中的)
    contentStr = contentStr.replace(/(^|[^"'>])(https?:\/\/[^\s<>"']+)/g, (match, prefix, url) => {
      console.log('🌐 Manual plain URL:', url)
      return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer font-medium">${url}</a>`
    })

    // 3. 处理粗体文本 **text**
    contentStr = contentStr.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')

    // 4. 处理斜体文本 *text*
    contentStr = contentStr.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>')

    // 5. 处理换行
    contentStr = contentStr.replace(/\n/g, '<br>')

    console.log('✅ Manual processing result:', contentStr.substring(0, 200))
    return contentStr
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