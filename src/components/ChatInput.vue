<template>
  <div class="relative">
    <!-- 文件拖拽覆盖层 -->
    <div
      v-if="isDragOver"
      class="absolute inset-0 glass rounded-xl border-2 border-dashed border-primary-blue bg-primary-blue bg-opacity-10 flex items-center justify-center z-10"
    >
      <div class="text-center">
        <svg class="w-8 h-8 mx-auto mb-2 text-primary-blue" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
        </svg>
        <p class="text-sm text-primary-blue font-medium">拖拽文件到此处</p>
      </div>
    </div>
    
    <!-- 输入区域 - 精致的无边框设计 -->
    <div class="input-container rounded-2xl px-4 py-3">
      <div class="flex items-end space-x-3">
        <!-- 文本输入框 -->
        <div class="flex-1">
          <textarea
            ref="textareaRef"
            v-model="inputText"
            :placeholder="placeholder"
            :disabled="isLoading"
            class="w-full bg-transparent dark:bg-transparent border-0 outline-none resize-none placeholder-neutral-gray-500 text-neutral-gray-800 dark:text-neutral-gray-200 leading-relaxed"
            rows="2"
            @keydown="handleKeydown"
            @input="adjustHeight"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragenter="handleDragEnter"
            @dragleave="handleDragLeave"
          />
        </div>
        
        <!-- 操作按钮 - 更圆润的设计 -->
        <div class="flex items-center space-x-3">
          <!-- 文件上传按钮 -->
          <button
            type="button"
            :disabled="isLoading"
            class="p-2.5 rounded-xl hover:bg-black hover:bg-opacity-8 dark:hover:bg-white dark:hover:bg-opacity-12 transition-all duration-200 disabled:opacity-50 hover:scale-105"
            @click="triggerFileUpload"
          >
            <svg class="w-5 h-5 text-neutral-gray-600 dark:text-neutral-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            </svg>
          </button>
          
          <!-- 语音输入按钮 -->
          <button
            type="button"
            :disabled="isLoading"
            :class="[
              'p-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 hover:scale-105',
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'hover:bg-black hover:bg-opacity-8 dark:hover:bg-white dark:hover:bg-opacity-12'
            ]"
            :title="isListening ? '点击停止录音' : '点击开始语音输入'"
            @click="handleVoiceInput"
          >
            <svg 
              class="w-5 h-5" 
              :class="isListening ? 'text-white' : 'text-neutral-gray-600 dark:text-neutral-gray-400'" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path v-if="!isListening" d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
              <path v-else d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M9,9V15H15V9" />
            </svg>
          </button>
          
          <!-- 发送/中止按钮 - 更大更圆润 -->
          <button
            type="button"
            :disabled="!isLoading && !inputText.trim()"
            :class="[
              'p-3 rounded-xl text-white transition-all duration-200 hover:scale-105 shadow-lg',
              isLoading 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-primary-blue hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
            ]"
            @click="isLoading ? handleStop() : handleSend()"
          >
            <svg v-if="!isLoading" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6,6H18V18H6V6Z" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- 附件预览 - 增强版 -->
      <div v-if="attachedFiles.length > 0" class="mt-4 pt-4 border-t border-neutral-gray-200 dark:border-neutral-gray-700">
        <div class="space-y-2">
          <div class="text-xs text-neutral-gray-500 font-medium">
            附件 ({{ attachedFiles.length }})
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(file, index) in attachedFiles"
              :key="index"
              class="flex items-center space-x-3 bg-neutral-gray-100 dark:bg-neutral-gray-800 rounded-xl px-3 py-2.5 text-sm group hover:bg-neutral-gray-200 dark:hover:bg-neutral-gray-700 transition-colors"
            >
              <!-- 文件类型图标 -->
              <svg class="w-5 h-5 text-primary-blue flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path :d="getFileIcon(file.name)" />
              </svg>
              
              <!-- 文件信息 -->
              <div class="flex-1 min-w-0">
                <div class="text-neutral-gray-700 dark:text-neutral-gray-300 font-medium truncate">
                  {{ file.name }}
                </div>
                <div class="text-xs text-neutral-gray-500">
                  {{ formatFileSize(file.size) }}
                </div>
              </div>
              
              <!-- 删除按钮 -->
              <button
                @click="removeFile(index)"
                class="text-neutral-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 语音状态提示 -->
    <div
      v-if="showVoiceStatus"
      class="absolute bottom-full left-0 right-0 mb-2 glass rounded-xl p-3 shadow-lg animate-slide-up"
    >
      <div class="flex items-center space-x-2">
        <div v-if="isListening" class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <div v-else class="w-2 h-2 bg-gray-400 rounded-full"></div>
        <span class="text-sm text-neutral-gray-700 dark:text-neutral-gray-300">{{ voiceStatus }}</span>
      </div>
    </div>

    <!-- 智能建议 -->
    <div
      v-if="showSuggestions"
      class="absolute bottom-full left-0 right-0 mb-2 glass rounded-xl p-2 shadow-lg animate-slide-up"
    >
      <div class="text-xs text-neutral-gray-500 font-medium mb-2 px-2">建议</div>
      <div class="space-y-1">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion"
          @click="applySuggestion(suggestion)"
          class="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-gray-200 dark:hover:bg-neutral-gray-700 transition-colors text-sm text-neutral-gray-700 dark:text-neutral-gray-300"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>
    
    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept=".pdf,.doc,.docx,.txt,.md,.rtf,.csv,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp3,.wav,.mp4,.mov"
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'

// 语音识别类型声明
declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

interface Props {
  modelValue: string
  placeholder?: string
  isLoading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'send', content: string, files?: File[]): void
  (e: 'file-drop', files: File[]): void
  (e: 'stop'): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '输入消息...',
  isLoading: false
})

const emit = defineEmits<Emits>()

const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()
const inputText = ref('')
const attachedFiles = ref<File[]>([])
const isDragOver = ref(false)
const showSuggestions = ref(false)
const suggestions = ref<string[]>([])
const isListening = ref(false)
const voiceStatus = ref('')
const showVoiceStatus = ref(false)
const recognition = ref<any>(null)

// 智能建议列表
const smartSuggestions = {
  config: [
    '配置 LLM 模型',
    '配置 Bor 系统',
    '切换主题',
    '查看当前设置'
  ],
  workflow: [
    '创建定时任务',
    '创建自动化工作流',
    '执行工作流',
    '查看工作流列表'
  ],
  knowledge: [
    '上传文档到知识库',
    '搜索我的文档',
    '管理知识库',
    '删除文档'
  ],
  general: [
    '你好',
    '帮我写代码',
    '解释这个概念',
    '总结一下'
  ]
}

// 双向绑定
watch(() => props.modelValue, (newValue) => {
  inputText.value = newValue
})

watch(inputText, (newValue) => {
  emit('update:modelValue', newValue)
  updateSuggestions(newValue)
})

// 更新智能建议
const updateSuggestions = (input: string) => {
  if (!input.trim()) {
    showSuggestions.value = false
    return
  }
  
  const lowerInput = input.toLowerCase()
  let matchedSuggestions: string[] = []
  
  // 根据输入内容匹配建议
  if (lowerInput.includes('配置') || lowerInput.includes('设置')) {
    matchedSuggestions = smartSuggestions.config
  } else if (lowerInput.includes('工作流') || lowerInput.includes('自动化') || lowerInput.includes('定时')) {
    matchedSuggestions = smartSuggestions.workflow
  } else if (lowerInput.includes('文档') || lowerInput.includes('知识库') || lowerInput.includes('上传')) {
    matchedSuggestions = smartSuggestions.knowledge
  } else {
    matchedSuggestions = smartSuggestions.general
  }
  
  // 过滤已经匹配的建议
  suggestions.value = matchedSuggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(lowerInput) || 
    lowerInput.length < 2
  ).slice(0, 4)
  
  showSuggestions.value = suggestions.value.length > 0 && input.length > 0
}

// 自动调整高度
const adjustHeight = async () => {
  await nextTick()
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    // 设置最小高度为48px（约2行），最大高度为120px
    const minHeight = 48
    const maxHeight = 120
    const scrollHeight = textareaRef.value.scrollHeight
    textareaRef.value.style.height = Math.max(minHeight, Math.min(scrollHeight, maxHeight)) + 'px'
  }
}

// 处理键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  // 处理建议导航
  handleSuggestionKeydown(event)
  
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    
    // 如果正在加载，按Enter键应该中止
    if (props.isLoading) {
      handleStop()
      return
    }
    
    if (showSuggestions.value && suggestions.value.length > 0) {
      // 如果有建议显示，应用第一个建议
      applySuggestion(suggestions.value[0])
    } else if (inputText.value.trim()) {
      // 只有当输入框有内容时才发送
      handleSend()
    }
    // 如果输入框为空，不做任何操作
  }
  
  // Escape键中止对话
  if (event.key === 'Escape' && props.isLoading) {
    event.preventDefault()
    handleStop()
  }
}

// 发送消息
const handleSend = () => {
  console.log('handleSend 被调用', { inputText: inputText.value, isLoading: props.isLoading })
  
  if (!inputText.value.trim() || props.isLoading) return
  
  const content = inputText.value.trim()
  const files = attachedFiles.value.length > 0 ? [...attachedFiles.value] : undefined
  
  console.log('发送消息:', { content, files })
  emit('send', content, files)
  
  // 清空输入
  inputText.value = ''
  attachedFiles.value = []
  showSuggestions.value = false
  
  // 重置高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

// 中止消息
const handleStop = () => {
  console.log('handleStop 被调用')
  emit('stop')
}

// 触发文件上传
const triggerFileUpload = () => {
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const files = Array.from(target.files)
    attachedFiles.value.push(...files)
    target.value = '' // 清空输入，允许重复选择同一文件
  }
}

// 移除文件
const removeFile = (index: number) => {
  attachedFiles.value.splice(index, 1)
}

// 拖拽处理
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // 只有当离开整个输入区域时才隐藏覆盖层
  if (!event.currentTarget?.contains(event.relatedTarget as Node)) {
    isDragOver.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
  
  if (event.dataTransfer?.files) {
    const files = Array.from(event.dataTransfer.files)
    attachedFiles.value.push(...files)
    emit('file-drop', files)
  }
}

// 获取文件类型图标
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'pdf':
      return 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z'
    case 'doc':
    case 'docx':
      return 'M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4Z'
    case 'txt':
    case 'md':
      return 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return 'M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z'
    case 'mp3':
    case 'wav':
      return 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12Z'
    case 'mp4':
    case 'mov':
      return 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z'
    case 'csv':
    case 'xlsx':
      return 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z'
    default:
      return 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z'
  }
}

// 获取文件大小显示
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 应用建议
const applySuggestion = (suggestion: string) => {
  inputText.value = suggestion
  showSuggestions.value = false
  textareaRef.value?.focus()
}

// 处理键盘导航建议
const handleSuggestionKeydown = (event: KeyboardEvent) => {
  if (!showSuggestions.value) return
  
  if (event.key === 'Escape') {
    showSuggestions.value = false
    event.preventDefault()
  }
  // 这里可以添加上下箭头导航功能
}

// 组件挂载时初始化
onMounted(() => {
  // 设置初始高度
  adjustHeight()
  // 可以在这里预初始化语音识别
})

// 组件卸载时清理
onUnmounted(() => {
  // 清理语音状态
  isListening.value = false
  showVoiceStatus.value = false
})

// 智能语音识别 - 提供选择
const handleVoiceInput = () => {
  console.log('语音按钮被点击')
  
  // 如果是 macOS，提供选择
  if (navigator.platform.toLowerCase().includes('mac')) {
    const choice = confirm(
      '选择语音输入方式：\n\n' +
      '点击"确定"：使用 Web 语音识别（需要网络）\n' +
      '点击"取消"：使用 macOS 系统语音输入（本地）'
    )
    
    if (choice) {
      tryWebSpeechAPI()
    } else {
      showSystemVoiceInstructions()
    }
  } else {
    // 其他系统直接尝试 Web Speech API
    tryWebSpeechAPI()
  }
}

// 显示系统语音输入指导
const showSystemVoiceInstructions = () => {
  voiceStatus.value = '🎤 使用 macOS 系统语音输入（无需网络）'
  showVoiceStatus.value = true
  
  setTimeout(() => {
    voiceStatus.value = '1️⃣ 系统偏好设置 → 键盘 → 听写 → 启用听写'
    
    setTimeout(() => {
      voiceStatus.value = '2️⃣ 设置快捷键（通常是连按两次 Fn 键或自定义）'
      
      setTimeout(() => {
        voiceStatus.value = '3️⃣ 在输入框中按快捷键，看到麦克风图标后说话'
        
        setTimeout(() => {
          voiceStatus.value = '或者直接使用 Web 语音识别（可能需要网络）'
          
          setTimeout(() => {
            showVoiceStatus.value = false
          }, 4000)
        }, 3000)
      }, 3000)
    }, 3000)
  }, 1000)
  
  // 聚焦输入框，准备接收语音输入
  textareaRef.value?.focus()
}

// 尝试 Web Speech API
const tryWebSpeechAPI = () => {
  const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
  if (!SpeechRecognition) {
    voiceStatus.value = '浏览器不支持语音识别'
    showVoiceStatus.value = true
    setTimeout(() => showVoiceStatus.value = false, 3000)
    return
  }
  
  if (!recognition.value) {
    recognition.value = new SpeechRecognition()
    recognition.value.lang = 'zh-CN'
    recognition.value.continuous = false
    recognition.value.interimResults = false
    
    recognition.value.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      inputText.value = transcript
      voiceStatus.value = '语音识别完成'
      showVoiceStatus.value = true
      setTimeout(() => showVoiceStatus.value = false, 2000)
    }
    
    recognition.value.onstart = () => {
      isListening.value = true
      voiceStatus.value = '正在监听，请说话...'
      showVoiceStatus.value = true
    }
    
    recognition.value.onend = () => {
      isListening.value = false
    }
    
    recognition.value.onerror = (event) => {
      isListening.value = false
      console.log('语音识别错误:', event.error)
      
      if (event.error === 'network') {
        voiceStatus.value = '网络语音识别不可用，请使用系统语音输入（按 Fn 键两次）'
        showVoiceStatus.value = true
        setTimeout(() => showVoiceStatus.value = false, 4000)
        textareaRef.value?.focus()
      }
    }
  }
  
  if (isListening.value) {
    recognition.value.stop()
  } else {
    recognition.value.start()
  }
}

// 不需要单独的初始化函数了


</script>