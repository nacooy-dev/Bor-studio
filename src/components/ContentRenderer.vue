<template>
  <div class="content-renderer">
    <!-- 检测并渲染不同类型的内容 -->
    <component 
      :is="getRendererComponent(block)" 
      v-for="(block, index) in contentBlocks" 
      :key="index"
      :content="block.content"
      :type="block.type"
      :metadata="block.metadata"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TextRenderer from './renderers/TextRenderer.vue'
import TableRenderer from './renderers/TableRenderer.vue'
import CodeRenderer from './renderers/CodeRenderer.vue'
import ListRenderer from './renderers/ListRenderer.vue'

interface ContentBlock {
  type: 'text' | 'table' | 'code' | 'list' | 'quote'
  content: string
  metadata?: Record<string, any>
}

interface Props {
  content: string | any
}

const props = defineProps<Props>()

// 确保输入是字符串
const normalizedContent = computed(() => {
  if (!props.content) {
    return ''
  } else if (typeof props.content === 'string') {
    return props.content
  } else {
    // 如果不是字符串，尝试转换为字符串
    try {
      return String(props.content)
    } catch (e) {
      console.warn('⚠️ Failed to convert content to string:', props.content)
      return ''
    }
  }
})

// 智能内容分析和分块
const contentBlocks = computed(() => {
  const blocks: ContentBlock[] = []
  const content = normalizedContent.value

  // 1. 提取代码块
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 添加代码块前的文本
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim()
      if (textContent) {
        blocks.push(...parseTextContent(textContent))
      }
    }

    // 添加代码块
    blocks.push({
      type: 'code',
      content: match[2],
      metadata: { language: match[1] || 'text' }
    })

    lastIndex = match.index + match[0].length
  }

  // 添加剩余文本
  if (lastIndex < content.length) {
    const remainingContent = content.slice(lastIndex).trim()
    if (remainingContent) {
      blocks.push(...parseTextContent(remainingContent))
    }
  }

  return blocks
})

// 解析文本内容，识别表格、列表等
const parseTextContent = (text: string): ContentBlock[] => {
  const blocks: ContentBlock[] = []
  const lines = text.split('\n')
  let currentBlock = ''
  let blockType: ContentBlock['type'] = 'text'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 检测表格
    if (line.includes('|') && line.split('|').length > 2) {
      if (currentBlock && blockType !== 'table') {
        blocks.push({ type: blockType, content: currentBlock.trim() })
        currentBlock = ''
      }
      blockType = 'table'
      currentBlock += line + '\n'
    }
    // 检测列表
    else if (/^[\s]*[-*+]\s/.test(line) || /^[\s]*\d+\.\s/.test(line)) {
      if (currentBlock && blockType !== 'list') {
        blocks.push({ type: blockType, content: currentBlock.trim() })
        currentBlock = ''
      }
      blockType = 'list'
      currentBlock += line + '\n'
    }
    // 检测引用
    else if (line.startsWith('>')) {
      if (currentBlock && blockType !== 'quote') {
        blocks.push({ type: blockType, content: currentBlock.trim() })
        currentBlock = ''
      }
      blockType = 'quote'
      currentBlock += line + '\n'
    }
    // 普通文本
    else {
      if (blockType !== 'text' && currentBlock) {
        blocks.push({ type: blockType, content: currentBlock.trim() })
        currentBlock = ''
        blockType = 'text'
      }
      currentBlock += line + '\n'
    }
  }

  // 添加最后一个块
  if (currentBlock.trim()) {
    blocks.push({ type: blockType, content: currentBlock.trim() })
  }

  return blocks
}

// 获取对应的渲染组件
const getRendererComponent = (block: ContentBlock) => {
  switch (block.type) {
    case 'table':
      return TableRenderer
    case 'code':
      return CodeRenderer
    case 'list':
      return ListRenderer
    default:
      return TextRenderer
  }
}
</script>

<style scoped>
.content-renderer {
  @apply space-y-4;
}
</style>