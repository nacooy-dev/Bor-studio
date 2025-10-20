<template>
  <div class="streaming-message">
    <!-- 检查是否为HTML内容 -->
    <div 
      v-if="isHTMLContent" 
      v-html="displayContent"
      class="html-content"
    />
    <!-- 否则使用内容渲染器 -->
    <ContentRenderer 
      v-else 
      :content="displayContent" 
    />
    
    <div v-if="isStreaming" class="streaming-indicator">
      <div class="cursor-blink">|</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import ContentRenderer from './ContentRenderer.vue'

interface Props {
  content: string
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

const displayContent = ref('')
const isAnimating = ref(false)

// 检查是否为HTML内容
const isHTMLContent = computed(() => {
  return props.content.startsWith('<div class="search-results">')
})

// 打字机动画
const animateText = async (targetContent: string) => {
  if (isAnimating.value) return
  
  isAnimating.value = true
  const currentLength = displayContent.value.length
  const targetLength = targetContent.length
  
  if (targetLength > currentLength) {
    // 添加字符
    for (let i = currentLength; i <= targetLength; i++) {
      displayContent.value = targetContent.slice(0, i)
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  } else {
    // 替换内容
    displayContent.value = targetContent
  }
  
  isAnimating.value = false
}

// 调试日志
watch(displayContent, (newContent) => {
  if (newContent) {
    console.log('StreamingMessage: 内容更新:', newContent.substring(0, 100) + '...')
  }
})

// 监听内容变化，实现打字机效果
watch(() => props.content, (newContent) => {
  if (newContent === displayContent.value) return
  
  if (props.isStreaming && newContent.length > displayContent.value.length) {
    // 流式更新，直接显示新内容
    displayContent.value = newContent
  } else {
    // 非流式更新，使用打字机效果
    animateText(newContent)
  }
}, { immediate: true })
</script>

<style scoped>
.streaming-message {
  @apply relative;
}

.streaming-indicator {
  @apply inline-block ml-1;
}

.cursor-blink {
  @apply inline-block text-primary-blue font-bold;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 流式消息容器样式 */
.streaming-message {
  @apply w-full;
}
</style>