<template>
  <div class="streaming-message">
    <div class="message-content" v-html="renderedContent"></div>
    <div v-if="isStreaming" class="streaming-indicator">
      <div class="cursor-blink">|</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { marked } from 'marked'

interface Props {
  content: string
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

const displayContent = ref('')
const isAnimating = ref(false)

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

// 渲染内容
const renderedContent = computed(() => {
  if (!displayContent.value) return ''
  
  return marked(displayContent.value, {
    breaks: true,
    gfm: true,
  })
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

/* 继承父组件的 prose 样式 */
:deep(.prose) {
  color: inherit;
}

:deep(.prose p) {
  margin: 0.5em 0;
}

:deep(.prose p:first-child) {
  margin-top: 0;
}

:deep(.prose p:last-child) {
  margin-bottom: 0;
}

:deep(.prose code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}

:deep(.prose pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
}
</style>