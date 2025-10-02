<template>
  <div class="h-screen flex flex-col bg-transparent overflow-hidden">
    <!-- 极简聊天界面 - 完全纯净，无任何装饰 -->
    <div class="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 min-h-0">
      
      <!-- 极简欢迎信息 (仅在没有消息时显示) -->
      <div v-if="messages.length === 0" class="flex-1 flex items-center justify-center">
        <div class="text-center animate-fade-in max-w-lg">
          <!-- 简洁的图标 -->
          <div class="w-16 h-16 mx-auto mb-8 glass rounded-2xl flex items-center justify-center">
            <div class="w-8 h-8 bg-gradient-to-br from-primary-blue to-primary-indigo rounded-lg"></div>
          </div>
          
          <!-- 简洁的标题 -->
          <h1 class="text-3xl font-light text-neutral-gray-800 dark:text-neutral-gray-200 mb-3">
            Bor
          </h1>
          <p class="text-neutral-gray-500 dark:text-neutral-gray-400 mb-8 text-lg font-light">
            通过对话控制一切
          </p>
          
          <!-- 建议按钮 - 更简洁的样式 -->
          <div class="flex flex-wrap gap-3 justify-center">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion"
              @click="sendSuggestion(suggestion)"
              class="glass rounded-full px-4 py-2 text-sm font-medium text-neutral-gray-700 dark:text-neutral-gray-300 hover:bg-opacity-80 transition-all duration-200 hover:scale-105"
            >
              {{ suggestion }}
            </button>
            
            <!-- 测试配置按钮 -->
            <button
              @click="$router.push('/config')"
              class="glass rounded-full px-4 py-2 text-sm font-medium text-blue-600 hover:bg-opacity-80 transition-all duration-200 hover:scale-105"
            >
              🔧 打开配置
            </button>
          </div>
        </div>
      </div>
      
      <!-- 消息列表 - 极简滚动区域 -->
      <div
        v-else
        ref="messagesContainer"
        class="flex-1 overflow-y-auto custom-scrollbar space-y-6 py-6 min-h-0"
      >
        <div
          v-for="message in messages"
          :key="message.id"
          class="animate-slide-up"
        >
          <ChatMessage 
            :message="message" 
            :is-streaming="message.id === streamingMessageId"
          />
        </div>
        
        <!-- 优雅的输入指示器 -->
        <div v-if="isLoading" class="flex justify-start">
          <div class="glass rounded-2xl px-4 py-3 max-w-xs">
            <div class="flex items-center space-x-2">
              <div class="flex space-x-1">
                <div class="w-2 h-2 bg-neutral-gray-400 rounded-full animate-pulse-soft"></div>
                <div class="w-2 h-2 bg-neutral-gray-400 rounded-full animate-pulse-soft" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-neutral-gray-400 rounded-full animate-pulse-soft" style="animation-delay: 0.4s"></div>
              </div>
              <span class="text-xs text-neutral-gray-500">正在思考...</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 输入区域 - 固定在底部 -->
      <div class="flex-shrink-0 mt-4">
        <ChatInput
          v-model="inputText"
          :is-loading="isLoading"
          :placeholder="getContextualPlaceholder()"
          @send="handleSend"
          @file-drop="handleFileDrop"
          @stop="handleStop"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { llmManager } from '@/lib/llm-manager'
import { DialogueRouter } from '@/services/dialogue/DialogueRouter'
import { MessageFactory } from '@/utils/messageFactory'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import type { Message } from '@/types'

const $router = useRouter()
const chatStore = useChatStore()
// 使用全局 LLM 管理器实例
const dialogueRouter = new DialogueRouter()
const messagesContainer = ref<HTMLElement>()
const inputText = ref('')
const isLoading = ref(false)
const streamingMessageId = ref<string | null>(null)
const abortController = ref<AbortController | null>(null)
const systemStatus = ref({
  ollama: false,
  currentModel: '',
  availableModels: [] as string[]
})

// 从 store 获取消息
const messages = ref<Message[]>([])

// 建议快捷指令 - 根据系统状态动态调整
const getSuggestions = () => {
  if (!systemStatus.value.ollama) {
    return ['检查系统状态', '配置 LLM', '如何安装 Ollama？']
  } else if (systemStatus.value.availableModels.length === 0) {
    return ['刷新模型列表', '如何拉取模型？', '检查系统状态']
  } else {
    return ['你好', '帮我写代码', '检查系统状态', '配置 LLM']
  }
}

const suggestions = ref(getSuggestions())

// 获取上下文相关的占位符
const getContextualPlaceholder = () => {
  if (messages.value.length === 0) {
    const placeholders = [
      '开始对话，或说"配置 LLM"来设置模型...',
      '试试说"你好"或"配置 LLM"...',
      '通过对话控制一切功能...',
      '说"配置 LLM"开始设置，或直接聊天...'
    ]
    return placeholders[Math.floor(Math.random() * placeholders.length)]
  }
  
  // 根据最后几条消息的内容提供智能提示
  const lastMessage = messages.value[messages.value.length - 1]
  if (lastMessage?.role === 'assistant') {
    if (lastMessage.content.includes('配置')) {
      return '继续配置，或问其他问题...'
    }
    if (lastMessage.content.includes('工作流')) {
      return '继续讨论工作流，或说其他需求...'
    }
    if (lastMessage.content.includes('文档') || lastMessage.content.includes('知识库')) {
      return '继续讨论文档管理，或问其他问题...'
    }
  }
  
  return '继续对话...'
}

// 发送建议
const sendSuggestion = (suggestion: string) => {
  inputText.value = suggestion
  handleSend(suggestion)
}

// 测试配置跳转
const testConfigJump = () => {
  console.log('测试配置跳转')
  $router.push('/config')
}

// 处理消息发送
const handleSend = async (content: string, files?: File[]) => {
  // 使用传入的content，如果没有则使用inputText.value
  const messageContent = content || inputText.value.trim()
  
  if (!messageContent || isLoading.value) return
  
  console.log('handleSend 开始处理:', { content: messageContent, isLoading: isLoading.value })
  
  // 添加用户消息
  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: messageContent,
    timestamp: Date.now(),
  }
  
  messages.value.push(userMessage)
  inputText.value = ''
  isLoading.value = true
  
  // 创建中止控制器
  abortController.value = new AbortController()
  
  // 滚动到底部
  await nextTick()
  scrollToBottom()
  
  try {
    // 调用真实的 AI 响应处理
    await handleAIResponse(messageContent)
  } catch (error) {
    console.error('发送消息失败:', error)
    
    // 检查是否是用户主动中止
    if (error.name === 'AbortError') {
      const abortMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⏹️ 对话已中止',
        timestamp: Date.now(),
      }
      messages.value.push(abortMessage)
    } else {
      // 添加错误消息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，发生了错误。请稍后重试。',
        timestamp: Date.now(),
      }
      messages.value.push(errorMessage)
    }
  } finally {
    isLoading.value = false
    abortController.value = null
    streamingMessageId.value = null
    await nextTick()
    scrollToBottom()
  }
}

// 智能 AI 响应处理
const handleAIResponse = async (userInput: string) => {
  try {
    // 获取对话历史
    const conversationHistory = messages.value
      .slice(-10)
      .filter(msg => msg.role !== 'system')

    // 使用智能对话路由
    const dialogueResponse = await dialogueRouter.routeDialogue(userInput, conversationHistory)
    
    console.log('对话路由结果:', dialogueResponse)

    // 如果需要LLM处理
    if (dialogueResponse.metadata?.requiresLLM) {
      await handleLLMResponse(userInput, dialogueResponse)
      return
    }

    // 如果有直接响应消息
    if (dialogueResponse.message) {
      const assistantMessage = MessageFactory.createAssistantMessage(dialogueResponse.message)
      messages.value.push(assistantMessage)
    }

    // 执行动作
    if (dialogueResponse.actions) {
      await executeDialogueActions(dialogueResponse.actions)
    }

    // 显示后续问题
    if (dialogueResponse.followUpQuestions && dialogueResponse.followUpQuestions.length > 0) {
      // 可以在这里显示快捷回复按钮
      console.log('后续问题:', dialogueResponse.followUpQuestions)
    }

  } catch (error) {
    console.error('智能对话处理失败:', error)
    
    // 回退到传统LLM处理
    await handleLLMResponse(userInput)
  }
}

// 处理LLM响应
const handleLLMResponse = async (userInput: string, dialogueResponse?: any) => {
  // 检查 Ollama 状态
  if (!systemStatus.value.ollama) {
    const errorMessage = MessageFactory.createAssistantMessage(
      '❌ Ollama 服务未连接\n\n请确保：\n1. Ollama 已安装并运行\n2. 服务地址为 http://localhost:11434\n3. 至少有一个模型可用\n\n您可以说"检查系统状态"来重新检测。'
    )
    messages.value.push(errorMessage)
    return
  }

  // 检查是否有可用模型
  if (systemStatus.value.availableModels.length === 0) {
    const errorMessage = MessageFactory.createAssistantMessage(
      '❌ 没有可用的模型\n\n请先拉取一个模型，例如：\n```bash\nollama pull llama2\n```\n\n然后说"刷新模型列表"来重新检测。'
    )
    messages.value.push(errorMessage)
    return
  }

  // 检查当前模型是否设置
  if (!systemStatus.value.currentModel) {
    console.log('当前模型未设置，自动选择第一个可用模型')
    systemStatus.value.currentModel = systemStatus.value.availableModels[0]
    llmManager.setCurrentModel(systemStatus.value.currentModel)
  }

  console.log('准备调用 LLM，当前模型:', systemStatus.value.currentModel)

  // 创建助手消息
  const assistantMessage = MessageFactory.createAssistantMessage('')
  messages.value.push(assistantMessage)
  streamingMessageId.value = assistantMessage.id

  try {
    // 获取对话历史（最近10条消息）
    const conversationHistory = messages.value
      .slice(-10)
      .filter(msg => msg.role !== 'system')

    console.log('开始调用 LLM:', {
      model: systemStatus.value.currentModel,
      messageCount: conversationHistory.length
    })

    // 调用 LLM
    const response = await llmManager.chat(conversationHistory, {
      onStream: (chunk: string) => {
        // 找到消息在数组中的索引并更新
        const messageIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
        if (messageIndex !== -1) {
          messages.value[messageIndex].content += chunk
        }
        // 滚动到底部
        nextTick().then(() => scrollToBottom())
      },
      signal: abortController.value?.signal
    })

    console.log('LLM 调用完成')

    // 如果没有流式响应，直接设置完整响应
    const messageIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
    if (messageIndex !== -1 && !messages.value[messageIndex].content && response) {
      messages.value[messageIndex].content = response
    }

  } catch (error) {
    console.error('LLM 调用失败:', error)
    const messageIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
    if (messageIndex !== -1) {
      messages.value[messageIndex].content = `❌ 对话失败：${error.message}\n\n请检查 Ollama 服务状态或尝试切换模型。`
    }
  } finally {
    streamingMessageId.value = null
  }
}

// 执行对话动作
const executeDialogueActions = async (actions: any[]) => {
  for (const action of actions) {
    console.log('执行动作:', action)
    
    switch (action.type) {
      case 'open_config':
        // 配置窗口已经在对话处理器中打开，这里只需要确认
        console.log(`配置窗口已打开: ${action.payload.configType}`)
        break
        
      case 'redirect':
        // 处理页面跳转
        console.log('执行页面跳转:', action.payload.url)
        if (action.payload.url) {
          try {
            // 使用 Vue Router 进行跳转
            const targetPath = action.payload.url.replace('#', '')
            console.log('跳转到路径:', targetPath)
            await $router.push(targetPath)
            console.log('跳转成功')
          } catch (error) {
            console.error('跳转失败:', error)
            // 回退到直接修改 hash
            window.location.hash = action.payload.url
          }
        }
        break
        
      case 'switch_model':
        if (action.payload.model) {
          systemStatus.value.currentModel = action.payload.model
          await llmManager.setModel(action.payload.model)
          
          const confirmMessage = MessageFactory.createAssistantMessage(
            `✅ 已切换到模型：**${action.payload.model}**`
          )
          messages.value.push(confirmMessage)
        }
        break
        
      case 'execute_command':
        await executeSystemCommand(action.payload.command, action.payload.args)
        break
        
      case 'show_ui':
        console.log('显示UI组件:', action.payload.component)
        // 这里可以添加UI组件显示逻辑
        break
        
      default:
        console.log('未知动作类型:', action.type)
    }
  }
}

// 执行系统命令
const executeSystemCommand = async (command: string, args: any[] = []) => {
  console.log('执行系统命令:', command, args)
  
  switch (command) {
    case 'setTheme':
      const theme = args[0]
      if (window.electronAPI && window.electronAPI.setTheme) {
        try {
          await window.electronAPI.setTheme(theme)
          console.log(`主题已切换到: ${theme}`)
        } catch (error) {
          console.error('主题切换失败:', error)
        }
      } else {
        // 在浏览器环境中切换主题
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
        } else {
          document.documentElement.classList.add('light')
          document.documentElement.classList.remove('dark')
        }
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('bor-theme', theme)
        console.log(`浏览器主题已切换到: ${theme}`)
        
        // 立即反馈给用户
        const themeMessage = MessageFactory.createAssistantMessage(
          `🎨 主题已立即切换到${theme === 'dark' ? '深色' : '浅色'}模式！`
        )
        messages.value.push(themeMessage)
      }
      break
      
    case 'refreshModels':
      await checkSystemStatus()
      const refreshMessage = MessageFactory.createAssistantMessage(
        `🔄 模型列表已刷新，发现 ${systemStatus.value.availableModels.length} 个可用模型`
      )
      messages.value.push(refreshMessage)
      break
      
    default:
      console.log('未知系统命令:', command)
  }
}

// 处理系统命令
const handleSystemCommands = async (userInput: string): Promise<boolean> => {
  const input = userInput.toLowerCase()

  // 配置 LLM
  if (input.includes('配置') && input.includes('llm')) {
    const configMessage = MessageFactory.createConfigMessage('llm-settings', 'open')
    messages.value.push(configMessage)
    
    setTimeout(() => {
      if (window.electronAPI) {
        window.electronAPI.openConfigWindow('llm-settings')
      } else {
        // Web 环境下的处理
        alert('配置功能需要在桌面应用中使用')
      }
    }, 1000)
    return true
  }

  // 检查系统状态
  if (input.includes('检查') && (input.includes('状态') || input.includes('系统'))) {
    await checkSystemStatus()
    const status = systemStatus.value
    const statusMessage = MessageFactory.createAssistantMessage(
      `📊 系统状态报告\n\n**Ollama 服务：** ${status.ollama ? '✅ 已连接' : '❌ 未连接'}\n**当前模型：** ${status.currentModel}\n**可用模型：** ${status.availableModels.length} 个\n\n${status.availableModels.length > 0 ? `模型列表：\n${status.availableModels.map(m => `- ${m}`).join('\n')}` : '请先拉取模型才能开始对话。'}`
    )
    messages.value.push(statusMessage)
    return true
  }

  // 刷新模型列表
  if (input.includes('刷新') && input.includes('模型')) {
    await checkSystemStatus()
    const refreshMessage = MessageFactory.createAssistantMessage(
      `🔄 模型列表已刷新\n\n发现 ${systemStatus.value.availableModels.length} 个可用模型：\n${systemStatus.value.availableModels.map(m => `- ${m}`).join('\n') || '暂无可用模型'}`
    )
    messages.value.push(refreshMessage)
    return true
  }

  // 切换模型
  if (input.includes('切换模型') || input.includes('使用模型')) {
    const availableModels = systemStatus.value.availableModels
    if (availableModels.length === 0) {
      const errorMessage = MessageFactory.createAssistantMessage('❌ 没有可用的模型，请先拉取模型。')
      messages.value.push(errorMessage)
      return true
    }

    // 改进的模型选择逻辑
    let modelName = null
    
    // 尝试从用户输入中提取模型名称
    const inputWords = userInput.toLowerCase().split(/\s+/)
    
    // 查找完全匹配的模型
    for (const model of availableModels) {
      const modelLower = model.toLowerCase()
      if (userInput.toLowerCase().includes(modelLower)) {
        modelName = model
        break
      }
    }
    
    // 如果没有找到完全匹配，尝试部分匹配
    if (!modelName) {
      for (const word of inputWords) {
        for (const model of availableModels) {
          if (model.toLowerCase().includes(word) && word.length > 2) {
            modelName = model
            break
          }
        }
        if (modelName) break
      }
    }
    
    // 如果还是没找到，显示可用模型列表
    if (!modelName) {
      const modelListMessage = MessageFactory.createAssistantMessage(
        `❓ 请指定要切换的模型名称\n\n**可用模型：**\n${availableModels.map(m => `- ${m}`).join('\n')}\n\n例如：说"切换模型到 ${availableModels[0]}"`
      )
      messages.value.push(modelListMessage)
      return true
    }
    
    systemStatus.value.currentModel = modelName
    llmManager.setCurrentModel(modelName)

    const switchMessage = MessageFactory.createAssistantMessage(
      `✅ 已切换到模型：**${modelName}**\n\n现在可以开始对话了！`
    )
    messages.value.push(switchMessage)
    return true
  }

  // 如何安装 Ollama
  if (input.includes('如何') && input.includes('安装') && input.includes('ollama')) {
    const installMessage = MessageFactory.createAssistantMessage(
      `📦 如何安装 Ollama\n\n**方法一：官网下载**\n1. 访问 https://ollama.ai\n2. 下载适合您系统的安装包\n3. 按照安装向导完成安装\n\n**方法二：命令行安装**\n\`\`\`bash\n# macOS/Linux\ncurl -fsSL https://ollama.ai/install.sh | sh\n\n# Windows (PowerShell)\niwr -useb https://ollama.ai/install.ps1 | iex\n\`\`\`\n\n**安装完成后：**\n1. 拉取一个模型：\`ollama pull llama2\`\n2. 说"检查系统状态"来验证安装`
    )
    messages.value.push(installMessage)
    return true
  }

  // 如何拉取模型
  if (input.includes('如何') && input.includes('拉取') && input.includes('模型')) {
    const pullMessage = MessageFactory.createAssistantMessage(
      `🔽 如何拉取模型\n\n**推荐模型：**\n\`\`\`bash\n# 轻量级模型（推荐新手）\nollama pull llama2:7b\nollama pull qwen:7b\n\n# 中等模型（平衡性能）\nollama pull llama2:13b\nollama pull mistral:7b\n\n# 代码专用模型\nollama pull codellama:7b\nollama pull deepseek-coder:6.7b\n\`\`\`\n\n**拉取完成后：**\n说"刷新模型列表"来重新检测可用模型。`
    )
    messages.value.push(pullMessage)
    return true
  }

  return false
}

// 处理中止
const handleStop = () => {
  console.log('用户请求中止对话')
  
  if (abortController.value) {
    abortController.value.abort()
    console.log('已发送中止信号')
  }
  
  // 立即停止加载状态
  isLoading.value = false
  streamingMessageId.value = null
  
  // 添加中止消息
  const stopMessage: Message = {
    id: Date.now().toString(),
    role: 'assistant',
    content: '⏹️ 对话已中止',
    timestamp: Date.now(),
  }
  messages.value.push(stopMessage)
  
  nextTick().then(() => scrollToBottom())
}

// 处理文件拖拽
const handleFileDrop = (files: File[]) => {
  console.log('文件拖拽:', files)
  // 这里将实现文件处理逻辑
}

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    // 使用 requestAnimationFrame 确保 DOM 更新完成后再滚动
    requestAnimationFrame(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
}

// 检查系统状态
const checkSystemStatus = async () => {
  try {
    await llmManager.initialize()
    const status = llmManager.getStatus()
    
    console.log('🔍 LLMManager 返回的状态:', status)
    
    systemStatus.value = {
      ollama: status.availableProviders.find(p => p.type === 'ollama')?.isAvailable || false,
      currentModel: status.currentModel,
      availableModels: status.availableModels.map(m => m.name)
    }
    
    console.log('🔍 设置后的 systemStatus:', systemStatus.value)
  } catch (error) {
    console.error('检查系统状态失败:', error)
    systemStatus.value = {
      ollama: false,
      currentModel: '',
      availableModels: []
    }
  }
}

onMounted(async () => {
  // 初始化聊天存储
  chatStore.initialize()
  
  // 检查系统状态
  await checkSystemStatus()
  
  // 根据系统状态显示不同的欢迎信息
  if (messages.value.length === 0) {
    let welcomeMessage: Message
    
    if (!systemStatus.value.ollama) {
      // Ollama 未连接
      welcomeMessage = MessageFactory.createAssistantMessage(
        `👋 欢迎使用 Bor 智能体中枢！\n\n**系统状态：**\n- Ollama 服务：❌ 未连接\n\n**开始使用：**\n1. 请先安装 Ollama：https://ollama.ai\n2. 启动 Ollama 服务\n3. 拉取一个模型，例如：\`ollama pull llama2\`\n4. 然后说"检查系统状态"重新检测\n\n或者说"配置 LLM"来设置其他模型提供商。`
      )
    } else if (systemStatus.value.availableModels.length === 0) {
      // Ollama 已连接但没有模型
      welcomeMessage = MessageFactory.createAssistantMessage(
        `👋 欢迎使用 Bor 智能体中枢！\n\n**系统状态：**\n- Ollama 服务：✅ 已连接\n- 可用模型：❌ 暂无\n\n**开始使用：**\n请先拉取一个模型，例如：\n\`\`\`bash\nollama pull llama2\n# 或者\nollama pull qwen:7b\n\`\`\`\n\n然后说"刷新模型列表"来重新检测。`
      )
    } else {
      // 一切正常
      welcomeMessage = MessageFactory.createAssistantMessage(
        `👋 欢迎使用 Bor 智能体中枢！\n\n**当前状态：**\n- Ollama 服务：✅ 已连接\n- 当前模型：${systemStatus.value.currentModel}\n- 可用模型：${systemStatus.value.availableModels.length} 个\n\n您可以直接开始对话，或说"检查系统状态"查看详细信息。`
      )
    }
    
    messages.value.push(welcomeMessage)
    
    // 更新建议列表
    suggestions.value = getSuggestions()
  }
})
</script>