<template>
  <div class="h-screen flex flex-col bg-transparent overflow-hidden">
    <!-- 简单测试界面 -->
    <div class="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 min-h-0">
      
      <!-- 测试消息 -->
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <h1 class="text-3xl font-light text-neutral-gray-800 dark:text-neutral-gray-200 mb-3">
            Bor 测试版
          </h1>
          <p class="text-neutral-gray-500 dark:text-neutral-gray-400 mb-8 text-lg font-light">
            应用正在加载...
          </p>
          
          <div class="space-y-2">
            <p>系统状态: {{ systemReady ? '✅ 就绪' : '⏳ 加载中' }}</p>
            <p>错误信息: {{ errorMessage || '无' }}</p>
          </div>
        </div>
      </div>
      
      <!-- 简单输入框 -->
      <div class="flex-shrink-0 mt-4">
        <div class="glass rounded-2xl p-4">
          <div class="flex items-end space-x-3">
            <input 
              v-model="testInput"
              type="text" 
              placeholder="输入测试消息..."
              class="flex-1 bg-transparent border-0 outline-none"
              @keydown.enter="sendTestMessage"
            />
            <button 
              @click="sendTestMessage"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const systemReady = ref(false)
const errorMessage = ref('')
const testInput = ref('')

const sendTestMessage = () => {
  console.log('测试消息:', testInput.value)
  testInput.value = ''
}

onMounted(async () => {
  try {
    console.log('ChatView 简化版正在加载...')
    
    // 模拟系统初始化
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    systemReady.value = true
    console.log('ChatView 简化版加载完成')
    
  } catch (error) {
    console.error('ChatView 加载失败:', error)
    errorMessage.value = error.message
  }
})
</script>