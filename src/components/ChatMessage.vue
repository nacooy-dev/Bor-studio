<template>
  <div class="flex mb-4" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
    <!-- AI消息：左侧显示，带头像 -->
    <div v-if="message.role === 'assistant'" class="flex items-start space-x-3 max-w-[85%]">
      <!-- AI头像 -->
      <div class="flex-shrink-0 w-8 h-8 rounded-full glass flex items-center justify-center mt-1">
        <div class="w-4 h-4 bg-gradient-to-br from-primary-blue to-primary-indigo rounded-sm"></div>
      </div>
      <!-- AI消息气泡 -->
      <div class="glass rounded-2xl rounded-tl-md px-4 py-3 break-words">
        <div v-if="message.content" class="message-content">
          <StreamingMessage 
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
        <div v-if="showTimestamp" class="text-xs opacity-50 mt-2 text-left">
          {{ formatTime(message.timestamp) }}
        </div>
      </div>
    </div>
    
    <!-- 用户消息：右侧显示，不带头像 -->
    <div v-else class="flex items-start justify-end max-w-[70%] ml-auto">
      <div class="bg-gradient-to-r from-primary-blue to-primary-indigo text-white rounded-2xl rounded-tr-md px-4 py-3 break-words shadow-lg">
        <div v-if="message.content" class="message-content">
          <div class="user-message whitespace-pre-wrap">
            {{ message.content }}
          </div>
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
        <div v-if="showTimestamp" class="text-xs opacity-75 mt-2 text-right">
          {{ formatTime(message.timestamp) }}
        </div>
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
/* 用户消息样式 */
.user-message {
  font-weight: 500;
  line-height: 1.5;
}

/* AI消息的Markdown内容样式 */
:deep(.prose) {
  color: inherit;
  font-size: 0.95em;
  line-height: 1.6;
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
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
}

:deep(.prose pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
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

:deep(.prose blockquote) {
  border-left: 3px solid rgba(59, 130, 246, 0.5);
  padding-left: 1em;
  margin: 0.5em 0;
  font-style: italic;
  opacity: 0.8;
}

:deep(.prose table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 0.9em;
}

:deep(.prose th, .prose td) {
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 0.5em;
  text-align: left;
}

:deep(.prose th) {
  background: rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

/* 深色模式下的样式调整 */
.dark :deep(.prose code) {
  background: rgba(255, 255, 255, 0.1);
}

.dark :deep(.prose pre) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark :deep(.prose th, .prose td) {
  border-color: rgba(255, 255, 255, 0.1);
}

.dark :deep(.prose th) {
  background: rgba(255, 255, 255, 0.05);
}

/* 消息动画 */
.message-content {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 头像动画 */
.flex-shrink-0 {
  animation: scaleIn 0.3s ease-out;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>