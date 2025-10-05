<template>
  <div class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
    <div
      class="rounded-2xl px-4 py-3 break-words"
      :class="[
        message.role === 'user' 
          ? 'bg-primary-blue text-white ml-auto' 
          : 'glass mr-auto',
        message.role === 'user' 
          ? 'max-w-[50%]' 
          : 'max-w-[80%]'
      ]"
    >
      <!-- 消息内容 -->
      <div v-if="message.content" class="message-content">
        <!-- 用户消息显示为纯文本 -->
        <div v-if="message.role === 'user'" class="user-message">
          {{ message.content }}
        </div>
        <!-- AI消息使用markdown渲染 -->
        <StreamingMessage 
          v-else
          :content="message.content"
          :is-streaming="isStreaming"
        />
      </div>
      
      <!-- 附件显示 -->
      <div v-if="message.attachments && message.attachments.length > 0" class="mt-2 space-y-2">
        <div
          v-for="attachment in message.attachments"
          :key="attachment.name"
          class="flex items-center space-x-2 text-xs opacity-75"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <span>{{ attachment.name }}</span>
        </div>
      </div>
      
      <!-- 时间戳 -->
      <div
        v-if="showTimestamp"
        class="text-xs opacity-50 mt-2"
        :class="message.role === 'user' ? 'text-right' : 'text-left'"
      >
        {{ formatTime(message.timestamp) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StreamingMessage from './StreamingMessage.vue'
import type { Message } from '@/types'

interface Props {
  message: Message
  showTimestamp?: boolean
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTimestamp: false,
  isStreaming: false
})

// 消息内容处理已移至 StreamingMessage 组件

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // 如果是今天
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // 如果是昨天
  if (diff < 48 * 60 * 60 * 1000) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // 其他日期
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
/* Markdown 内容样式 */
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

:deep(.prose pre code) {
  background: none;
  padding: 0;
}

:deep(.prose ul, .prose ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

:deep(.prose li) {
  margin: 0.25em 0;
}

/* 用户消息的代码样式 */
.message-user :deep(.prose code) {
  background: rgba(255, 255, 255, 0.2);
}

.message-user :deep(.prose pre) {
  background: rgba(255, 255, 255, 0.2);
}
</style>