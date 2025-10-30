<template>
  <div class="h-full flex flex-col bg-transparent overflow-hidden">
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
        class="flex-1 overflow-y-auto space-y-6 py-6 no-drag"
        style="height: calc(100vh - 200px);"
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
import { mcpService } from '@/services/mcp'
import { flowIntegration } from '@/lib/flow-engine/FlowIntegration'
import { llmMCPHandler } from '@/services/mcp/LLMBasedMCPHandler'
import { hybridIntentEngine } from '@/services/intent/HybridIntentEngine'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'

import type { Message } from '@/types'

const $router = useRouter()
const chatStore = useChatStore()
// 使用全局 LLM 管理器实例
const dialogueRouter = new DialogueRouter()
// 初始化LLM-MCP处理器
onMounted(async () => {
  await llmMCPHandler.initialize()
})
const messagesContainer = ref<HTMLElement>()
const inputText = ref('')
const isLoading = ref(false)
const streamingMessageId = ref<string | null>(null)
const abortController = ref<AbortController | null>(null)
const isProcessingNote = ref(false)
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
    return ['检查系统状态', '配置 LLM', '如何安装 Ollama？', '检查MCP状态']
  } else if (systemStatus.value.availableModels.length === 0) {
    return ['刷新模型列表', '如何拉取模型？', '检查系统状态', '添加文件系统工具']
  } else {
    return ['你好', '帮我写代码', '检查系统状态', '配置 LLM', '有什么工具可用']
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
    // 🔧 优先检查系统命令
    const isSystemCommand = await handleSystemCommands(messageContent)
    if (isSystemCommand) {
      isLoading.value = false
      return
    }
    
    // 🚀 新架构：让LLM决定是否需要调用MCP工具
    // 不再在前端做路由判断，而是将工具信息提供给LLM
    console.log('💭 将用户输入发送给LLM，由LLM决定是否需要调用MCP工具')
    

    
    // 如果正在处理笔记，不执行AI响应
    if (isProcessingNote.value) {
      console.log('🛑 正在处理笔记，跳过AI响应')
      return
    }
    
    // 调用真实的 AI 响应处理
    await handleAIResponse(messageContent)
  } catch (error) {
    console.error('发送消息失败:', error)
    
    // 检查是否是用户主动中止
    if (error && (error as Error).name === 'AbortError') {
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

    console.log('🚀 使用混合意图识别引擎处理用户输入...')

    // 🧠 混合意图识别：快思维 + 慢思维
    const intentResult = await hybridIntentEngine.recognizeIntent(userInput)
    console.log('🎯 意图识别结果:', intentResult)

    if (intentResult.tool && intentResult.confidence > 0.6) {
      console.log(`🔧 ${intentResult.method === 'fast' ? '快思维' : '慢思维'}识别成功，使用工具: ${intentResult.tool}`)
      
      // 🚀 处理5个核心工具（快思维）
      if (intentResult.method === 'fast') {
        await handleCoreToolCall(intentResult.tool, intentResult.parameters, userInput)
        return
      }
      
      // 🤔 处理其他MCP工具（慢思维）
      await handleDirectToolCall(userInput, intentResult.tool, intentResult.parameters)
      return
    }

    // 🧠 需要LLM深度分析
    if (intentResult.intent === 'llm_analysis_required') {
      console.log('🤔 启动LLM深度分析模式')
      // 继续到LLM处理流程
    }

    // 回退到原有的对话路由处理
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
    
    // 最终回退到传统LLM处理
    await handleLLMResponse(userInput)
  }
}

// 🚀 处理5个核心工具（快思维）
const handleCoreToolCall = async (toolName: string, parameters: Record<string, any>, userInput: string) => {
  console.log(`⚡ 快思维处理核心工具: ${toolName}`, parameters)
  
  try {
    switch (toolName) {
      case 'navigate_to_config':
        // 导航到配置页面
        console.log('🔧 导航到配置页面')
        await $router.push('/config')
        const configMessage = MessageFactory.createAssistantMessage('✅ 已打开Bor配置页面')
        messages.value.push(configMessage)
        break

      case 'get_current_time':
        // 时间同步
        const now = new Date()
        const timeStr = now.toLocaleString('zh-CN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          weekday: 'long'
        })
        const timeMessage = MessageFactory.createAssistantMessage(
          `🕐 **当前时间**\n\n${timeStr}\n\n系统时间已与对话时间同步。`
        )
        messages.value.push(timeMessage)
        break

      case 'search':
        // DuckDuckGo搜索 - 使用现有的MCP调用
        await handleDirectToolCall(userInput, 'search', parameters)
        break

      case 'obsidian_operation':
        // Obsidian操作 - 根据操作类型选择具体工具并清理参数
        const obsidianTool = mapObsidianOperation(parameters.operation)
        
        // 🔧 清理参数，移除operation字段，只保留工具需要的参数
        const cleanedParams = {
          path: parameters.path,
          content: parameters.content
        }
        
        console.log(`📝 Obsidian操作: ${parameters.operation} -> ${obsidianTool}`, cleanedParams)
        await handleDirectToolCall(userInput, obsidianTool, cleanedParams)
        break

      case 'advanced_calculator':
        // 高级计算器 - 查找计算相关的MCP工具
        const calcTool = llmMCPHandler.getAvailableTools().find(t => 
          t.name.includes('calc') || t.name.includes('math') || t.name.includes('compute')
        )
        if (calcTool) {
          await handleDirectToolCall(userInput, calcTool.name, parameters)
        } else {
          // 简单的内置计算（仅支持基本运算）
          const safeCalc = safeCalculate(parameters.expression)
          const calcMessage = MessageFactory.createAssistantMessage(
            safeCalc.success 
              ? `🧮 **计算结果**\n\n${parameters.expression} = ${safeCalc.result}`
              : `❌ **计算错误**\n\n${safeCalc.error}\n\n建议安装高级计算器MCP工具以支持更复杂的计算。`
          )
          messages.value.push(calcMessage)
        }
        break

      case 'ultrarag_search':
        // UltraRAG知识库搜索 - 如果有对应的MCP工具
        const ragTool = llmMCPHandler.getAvailableTools().find(t => 
          t.name.includes('rag') || t.name.includes('knowledge') || t.server?.includes('ultrarag')
        )
        if (ragTool) {
          await handleDirectToolCall(userInput, ragTool.name, parameters)
        } else {
          const noRagMessage = MessageFactory.createAssistantMessage(
            '❌ UltraRAG知识库工具未配置，请检查MCP配置。'
          )
          messages.value.push(noRagMessage)
        }
        break

      default:
        console.warn(`未知的核心工具: ${toolName}`)
        await handleDirectToolCall(userInput, toolName, parameters)
    }
  } catch (error) {
    console.error('核心工具处理失败:', error)
    const errorMessage = MessageFactory.createAssistantMessage(
      `❌ 工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
    messages.value.push(errorMessage)
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

// 映射Obsidian操作到具体工具
const mapObsidianOperation = (operation: string): string => {
  const toolMap: Record<string, string> = {
    'create': 'create_note_tool',
    'edit': 'update_note_tool',
    'open': 'read_note_tool',
    'delete': 'delete_note_tool',
    'list': 'list_notes_tool'
  }
  return toolMap[operation] || 'create_note_tool'
}

// 安全的计算函数（避免使用eval）
const safeCalculate = (expression: string): { success: boolean; result?: number; error?: string } => {
  try {
    // 只允许基本的数学运算
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '')
    if (sanitized !== expression) {
      return { success: false, error: '只支持基本数学运算符 (+, -, *, /, (), .)' }
    }
    
    // 使用Function构造函数代替eval（稍微安全一些）
    const result = new Function('return ' + sanitized)()
    
    if (typeof result !== 'number' || !isFinite(result)) {
      return { success: false, error: '计算结果无效' }
    }
    
    return { success: true, result }
  } catch (error) {
    return { success: false, error: '计算表达式格式错误' }
  }
}

// ⚡ 处理直接工具调用 - 高效路径
const handleDirectToolCall = async (userInput: string, toolName: string, preExtractedParams?: Record<string, any>) => {
  console.log(`🚀 直接执行工具调用: ${toolName}`)
  
  // 添加处理中消息
  const processingMessage = MessageFactory.createAssistantMessage(`🔧 正在使用 ${toolName} 处理您的请求...`)
  messages.value.push(processingMessage)
  
  try {
    // 使用预提取的参数或智能提取参数
    const parameters = preExtractedParams || extractToolParameters(userInput, toolName)
    console.log('📋 使用的参数:', parameters)
    
    // 执行工具调用
    const result = await llmMCPHandler.executeToolCall(toolName, parameters)
    
    // 删除处理中消息
    const processingIndex = messages.value.findIndex(msg => msg.id === processingMessage.id)
    if (processingIndex !== -1) {
      messages.value.splice(processingIndex, 1)
    }
    
    if (result.success) {
      console.log('✅ 工具调用成功')
      
      // 格式化结果
      const formattedResult = formatToolResult(toolName, result.data, userInput)
      const resultMessage = MessageFactory.createAssistantMessage(formattedResult)
      messages.value.push(resultMessage)
    } else {
      console.error('❌ 工具调用失败:', result.error)
      
      const errorMessage = MessageFactory.createAssistantMessage(
        `❌ **工具执行失败**\n\n**错误**: ${result.error}\n\n让我尝试用其他方式帮助您...`
      )
      messages.value.push(errorMessage)
      
      // 回退到LLM处理
      await handleLLMResponse(userInput)
    }
    
  } catch (error) {
    console.error('❌ 直接工具调用异常:', error)
    
    // 删除处理中消息
    const processingIndex = messages.value.findIndex(msg => msg.id === processingMessage.id)
    if (processingIndex !== -1) {
      messages.value.splice(processingIndex, 1)
    }
    
    // 回退到LLM处理
    await handleLLMResponse(userInput)
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

// 智能参数提取 - 修复参数匹配
const extractToolParameters = (userInput: string, toolName: string): Record<string, any> => {
  const lowerInput = userInput.toLowerCase()
  console.log(`🔧 为工具 ${toolName} 提取参数`)
  
  // 🔥 根据实际工具的参数要求来构建参数
  const tool = llmMCPHandler.getAvailableTools().find(t => t.name === toolName)
  if (tool?.inputSchema?.properties) {
    const requiredParams = Object.keys(tool.inputSchema.properties)
    console.log(`📋 工具 ${toolName} 需要的参数:`, requiredParams)
    
    const params: Record<string, any> = {}
    
    // 根据工具的实际参数要求来构建
    if (requiredParams.includes('query')) {
      // 提取搜索查询
      let query = userInput
      const searchKeywords = ['搜索', '查找', 'search', 'find', '搜', '查']
      
      for (const keyword of searchKeywords) {
        const regex = new RegExp(`^${keyword}\\s*[:：]?\\s*`, 'i')
        query = query.replace(regex, '').trim()
      }
      
      params.query = query || userInput
    }
    
    // 其他常见参数
    if (requiredParams.includes('max_results')) {
      params.max_results = 5
    }
    
    if (requiredParams.includes('days_ago')) {
      params.days_ago = 7
    }
    
    console.log(`✅ 构建的参数:`, params)
    return params
  }
  
  // 回退到通用参数
  if (toolName.includes('search')) {
    let query = userInput
    const searchKeywords = ['搜索', '查找', 'search', 'find', '搜', '查']
    
    for (const keyword of searchKeywords) {
      const regex = new RegExp(`^${keyword}\\s*[:：]?\\s*`, 'i')
      query = query.replace(regex, '').trim()
    }
    
    return { query: query || userInput }
  }
  
  if (toolName.includes('note')) {
    // 笔记操作参数
    if (lowerInput.includes('创建') || lowerInput.includes('新建')) {
      const content = userInput.replace(/(创建|新建).*?笔记\s*[:：]?\s*/i, '').trim()
      return {
        path: `笔记_${Date.now()}.md`,
        content: content || '新建笔记内容'
      }
    }
    
    if (lowerInput.includes('搜索') || lowerInput.includes('查找')) {
      const query = userInput.replace(/(搜索|查找).*?笔记\s*[:：]?\s*/i, '').trim()
      return { query: query || userInput }
    }
  }
  
  // 默认参数
  return { input: userInput }
}

// 格式化工具结果
const formatToolResult = (toolName: string, data: any, originalInput: string): string => {
  if (toolName.includes('search')) {
    return formatSearchResult(data)
  }
  
  if (toolName.includes('note') || toolName.includes('obsidian')) {
    return formatObsidianResult(toolName, data, originalInput)
  }
  
  return `🔧 **工具执行结果**\n\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
}

// 格式化搜索结果
const formatSearchResult = (result: any): string => {
  if (typeof result === 'string') {
    // DuckDuckGo MCP服务器返回格式化的字符串
    return `🔍 **搜索结果**\n\n${result}`
  }
  
  if (Array.isArray(result)) {
    let formatted = `🔍 **搜索结果**\n\n`
    
    result.forEach((item: any, index: number) => {
      formatted += `**${index + 1}. [${item.title || '无标题'}](${item.link || '#'})**\n`
      if (item.snippet) {
        formatted += `${item.snippet}\n`
      }
      formatted += `\n`
    })

    return formatted.trim()
  }

  return `🔍 **搜索结果**\n\n${JSON.stringify(result, null, 2)}`
}

// 专门格式化 Obsidian 结果
const formatObsidianResult = (toolName: string, data: any, originalInput: string): string => {
  try {
    // 尝试解析 JSON 数据
    let parsedData = data
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
      } catch {
        // 如果不是 JSON，直接使用字符串
        parsedData = { message: data }
      }
    }

    // 根据工具类型格式化结果
    if (toolName.includes('create')) {
      return formatCreateNoteResult(parsedData, originalInput)
    } else if (toolName.includes('read')) {
      return formatReadNoteResult(parsedData)
    } else if (toolName.includes('list')) {
      return formatListNotesResult(parsedData)
    } else if (toolName.includes('search')) {
      return formatSearchNotesResult(parsedData)
    } else if (toolName.includes('update')) {
      return formatUpdateNoteResult(parsedData)
    } else if (toolName.includes('delete')) {
      return formatDeleteNoteResult(parsedData)
    }

    // 默认格式化
    return `📝 **笔记操作完成**\n\n${JSON.stringify(parsedData, null, 2)}`
  } catch (error) {
    return `📝 **笔记操作完成**\n\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
  }
}

// 格式化创建笔记结果
const formatCreateNoteResult = (data: any, originalInput: string): string => {
  const fileName = data.path || data.name || '未知文件'
  const success = data.success !== false && !data.error
  
  if (success) {
    return `✅ **笔记创建成功！**\n\n📄 **文件名**: ${fileName}\n📝 **内容**: ${originalInput.replace(/^(创建|新建|写)\\s*(笔记|文档|日记)\\s*/i, '').trim() || '已创建'}\n\n💡 您的笔记已保存到 Obsidian vault 中。`
  } else {
    return `❌ **笔记创建失败**\n\n**错误**: ${data.error || data.message || '未知错误'}`
  }
}

// 格式化读取笔记结果
const formatReadNoteResult = (data: any): string => {
  const fileName = data.path || data.name || '笔记'
  const content = data.content || data.text || ''
  
  if (content) {
    return `📖 **${fileName}**\n\n${content.substring(0, 500)}${content.length > 500 ? '\n\n...(内容已截断)' : ''}`
  } else {
    return `📖 **${fileName}**\n\n📄 笔记内容为空或无法读取。`
  }
}

// 格式化列表笔记结果
const formatListNotesResult = (data: any): string => {
  const notes = data.notes || data.files || data.list || []
  
  if (Array.isArray(notes) && notes.length > 0) {
    const noteList = notes.slice(0, 10).map((note, index) => {
      const name = typeof note === 'string' ? note : (note.name || note.path || note.title)
      return `${index + 1}. ${name}`
    }).join('\n')
    
    return `📋 **笔记列表** (共 ${notes.length} 个)\n\n${noteList}${notes.length > 10 ? '\n\n...(仅显示前10个)' : ''}`
  } else {
    return `📋 **笔记列表**\n\n📄 暂无笔记或无法获取列表。`
  }
}

// 格式化搜索笔记结果
const formatSearchNotesResult = (data: any): string => {
  const results = data.results || data.matches || data.notes || []
  
  if (Array.isArray(results) && results.length > 0) {
    const searchResults = results.slice(0, 5).map((result, index) => {
      const name = typeof result === 'string' ? result : (result.name || result.path || result.title)
      const snippet = result.snippet || result.content || ''
      return `${index + 1}. **${name}**${snippet ? `\n   ${snippet.substring(0, 100)}...` : ''}`
    }).join('\n\n')
    
    return `🔍 **搜索结果** (找到 ${results.length} 个)\n\n${searchResults}${results.length > 5 ? '\n\n...(仅显示前5个)' : ''}`
  } else {
    return `🔍 **搜索结果**\n\n📄 未找到匹配的笔记。`
  }
}

// 格式化更新笔记结果
const formatUpdateNoteResult = (data: any): string => {
  const fileName = data.path || data.name || '笔记'
  const success = data.success !== false && !data.error
  
  if (success) {
    return `✅ **笔记更新成功！**\n\n📄 **文件名**: ${fileName}\n💡 笔记内容已更新。`
  } else {
    return `❌ **笔记更新失败**\n\n**错误**: ${data.error || data.message || '未知错误'}`
  }
}

// 格式化删除笔记结果
const formatDeleteNoteResult = (data: any): string => {
  const fileName = data.path || data.name || '笔记'
  const success = data.success !== false && !data.error
  
  if (success) {
    return `✅ **笔记删除成功！**\n\n📄 **文件名**: ${fileName}\n💡 笔记已从 vault 中删除。`
  } else {
    return `❌ **笔记删除失败**\n\n**错误**: ${data.error || data.message || '未知错误'}`
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
    await llmManager.setModel(systemStatus.value.currentModel)
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

    // 🚀 构建包含MCP工具信息的消息历史
    let enhancedHistory = [...conversationHistory]
    
    // 获取可用的MCP工具并添加到系统提示中
    const availableTools = llmMCPHandler.getAvailableTools()
    let systemPrompt = ''
    
    if (availableTools.length > 0) {
      const toolsInfo = llmMCPHandler.formatToolsForLLM()
      systemPrompt = `你是一个智能助手，可以使用以下MCP工具来帮助用户：

${toolsInfo}

🔧 **工具调用格式**：
当你需要调用工具时，请使用以下格式（注意：JSON必须是单行，不能包含换行符）：
\`\`\`tool-call
{"tool": "工具名称", "parameters": {"参数名": "参数值"}}
\`\`\`

例如：
- 搜索网页：\`\`\`tool-call
{"tool": "search", "parameters": {"query": "成都大运会"}}
\`\`\`
- 创建笔记：\`\`\`tool-call
{"tool": "create_note_tool", "parameters": {"path": "日记.md", "content": "今天的日记内容"}}
\`\`\`

⚠️ 重要：JSON必须是单行格式，不要包含换行符或特殊字符。`
    }
    
    // 如果有对话路由的系统提示，合并
    if (dialogueResponse?.metadata?.systemPrompt) {
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${dialogueResponse.metadata.systemPrompt}` : dialogueResponse.metadata.systemPrompt
    }
    
    // 添加系统提示到消息历史
    if (systemPrompt) {
      enhancedHistory.unshift({
        id: 'mcp-system-prompt',
        role: 'system',
        content: systemPrompt,
        timestamp: Date.now()
      })
    }

    // 调用 LLM
    const response = await llmManager.chat(enhancedHistory, {
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

    // 🔍 检查LLM响应中是否包含工具调用
    const llmResponseContent = messages.value[messageIndex]?.content || response || ''
    console.log('🔍 检查LLM响应中的工具调用:', llmResponseContent.substring(0, 200) + '...')
    
    // 使用新的LLM-MCP处理器检测工具调用 - 简化JSON解析
    const toolCallMatch = llmResponseContent.match(/```tool-call\s*\n([\s\S]*?)\n```/)
    
    if (toolCallMatch) {
      try {
        const jsonStr = toolCallMatch[1].trim()
        console.log('🔧 原始JSON:', jsonStr)
        
        const toolCallData = JSON.parse(jsonStr)
        console.log('🔧 检测到MCP工具调用请求:', toolCallData)

        // 添加工具执行提示
        const toolMessage = MessageFactory.createAssistantMessage(`🔧 正在执行工具: ${toolCallData.tool}...`)
        messages.value.push(toolMessage)

        // 执行工具调用
        const toolResult = await llmMCPHandler.executeToolCall(toolCallData.tool, toolCallData.parameters)
        
        // 删除工具执行提示
        const toolMessageIndex = messages.value.findIndex(m => m.id === toolMessage.id)
        if (toolMessageIndex !== -1) {
          messages.value.splice(toolMessageIndex, 1)
        }
        
        if (toolResult.success) {
          console.log('✅ MCP工具调用成功:', toolResult.data)
          
          // 将工具结果添加为新消息
          const resultMessage = MessageFactory.createAssistantMessage(
            `🔍 **工具执行结果**\n\n${typeof toolResult.data === 'string' ? toolResult.data : JSON.stringify(toolResult.data, null, 2)}`
          )
          messages.value.push(resultMessage)
        } else {
          console.error('❌ MCP工具调用失败:', toolResult.error)
          
          // 添加错误消息
          const errorMessage = MessageFactory.createAssistantMessage(
            `❌ **工具执行失败**\n\n**错误**: ${toolResult.error}`
          )
          messages.value.push(errorMessage)
        }
      } catch (parseError) {
        console.error('❌ 工具调用解析失败:', parseError)
        
        // 添加解析错误消息
        const parseErrorMessage = MessageFactory.createAssistantMessage(
          `❌ **工具调用格式错误**\n\n无法解析工具调用请求，请检查格式是否正确。`
        )
        messages.value.push(parseErrorMessage)
      }
    }

  } catch (error) {
    console.error('LLM 调用失败:', error)
    
    // 更新消息显示错误
    const messageIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
    if (messageIndex !== -1) {
      messages.value[messageIndex].content = `❌ 抱歉，处理您的请求时出现了错误：${error instanceof Error ? error.message : '未知错误'}`
    }
  } finally {
    // 清理流式消息ID
    streamingMessageId.value = null
    isLoading.value = false
    
    // 滚动到底部
    await nextTick()
    scrollToBottom()
  }
}

// 检查LLM响应中的工具调用
const checkLLMResponseForToolCalls = async (llmResponse: string) => {
  try {
    console.log('🔍 检查LLM响应中的工具调用:', llmResponse.substring(0, 200) + '...')
    
    // 检测工具调用请求
    const toolCallRequest = mcpManager.detectToolCall(llmResponse)
    if (!toolCallRequest) {
      console.log('ℹ️ LLM响应中未检测到工具调用')
      return
    }

    console.log('🔧 在LLM响应中检测到工具调用请求:', toolCallRequest)

    // 执行工具调用
    const toolResult = await mcpManager.executeToolCall(toolCallRequest)
    
    // 创建工具执行结果消息
    const toolResultMessage = mcpManager.formatToolResult(toolResult)
    
    // 添加工具执行结果到对话中
    const resultMessage = MessageFactory.createAssistantMessage(toolResultMessage)
    messages.value.push(resultMessage)
    
    // 滚动到底部
    await nextTick()
    scrollToBottom()
    
  } catch (error) {
    console.error('❌ 检查LLM响应工具调用失败:', error)
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
        
      case 'navigation':
        // 处理导航动作
        console.log('执行导航:', action.payload.path)
        if (action.payload.path) {
          try {
            // 处理带 hash 的路径
            if (action.payload.path.startsWith('/')) {
              // 如果是完整的路径，直接使用 Vue Router 跳转
              await $router.push(action.payload.path)
            } else if (action.payload.path.startsWith('#')) {
              // 如果是 hash 路径，直接修改 location hash
              window.location.hash = action.payload.path
            } else {
              // 其他情况，添加 # 前缀
              window.location.hash = `#${action.payload.path}`
            }
            console.log('导航成功')
          } catch (error) {
            console.error('导航失败:', error)
            // 回退到直接修改 hash
            window.location.hash = action.payload.path.startsWith('#') ? 
              action.payload.path : 
              `#${action.payload.path}`
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
      if ((window as any).electronAPI && (window as any).electronAPI.setTheme) {
        try {
          await (window as any).electronAPI.setTheme(theme)
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

  // 配置 LLM - 跳转到配置页面 (支持多种表达方式)
  if (input.includes('配置') && (input.includes('llm') || input.includes('模型'))) {
    const configMessage = MessageFactory.createAssistantMessage(
      '🔧 正在打开配置页面...\n\n您可以在配置页面中设置LLM模型提供商和相关参数。'
    )
    messages.value.push(configMessage)
    
    // 跳转到配置页面
    setTimeout(() => {
      $router.push('/config')
    }, 500)
    return true
  }

  // 配置 MCP - 跳转到配置页面
  if (input.includes('配置') && input.includes('mcp')) {
    const configMessage = MessageFactory.createAssistantMessage(
      '🔧 正在打开配置页面...\n\n您可以在配置页面中管理MCP服务器和工具集成。'
    )
    messages.value.push(configMessage)
    
    // 跳转到配置页面
    setTimeout(() => {
      $router.push('/config')
    }, 500)
    return true
  }

  // 通用配置 - 跳转到配置页面
  if ((input.includes('打开') || input.includes('进入')) && input.includes('配置')) {
    const configMessage = MessageFactory.createAssistantMessage(
      '🔧 正在打开配置页面...\n\n您可以在这里管理所有系统设置。'
    )
    messages.value.push(configMessage)
    
    // 跳转到配置页面
    setTimeout(() => {
      $router.push('/config')
    }, 500)
    return true
  }

  // 检查系统状态
  if (input.includes('检查') && (input.includes('状态') || input.includes('系统'))) {
    await checkSystemStatus()
    const status = systemStatus.value
    const statusMessage = MessageFactory.createAssistantMessage(
      `📊 系统状态报告

**Ollama 服务：** ${status.ollama ? '✅ 已连接' : '❌ 未连接'}
**当前模型：** ${status.currentModel}
**可用模型：** ${status.availableModels.length} 个

${status.availableModels.length > 0 ? `模型列表：
${status.availableModels.map(m => `- ${m}`).join('\n')}` : '请先拉取模型才能开始对话。'}`
    )
    messages.value.push(statusMessage)
    return true
  }

  // 刷新模型列表
  if (input.includes('刷新') && input.includes('模型')) {
    await checkSystemStatus()
    const refreshMessage = MessageFactory.createAssistantMessage(
      `🔄 模型列表已刷新

发现 ${systemStatus.value.availableModels.length} 个可用模型：
${systemStatus.value.availableModels.map(m => `- ${m}`).join('\n') || '暂无可用模型'}`
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
        `❓ 请指定要切换的模型名称

**可用模型：**
${availableModels.map(m => `- ${m}`).join('\n')}

例如：说"切换模型到 ${availableModels[0]}"`
      )
      messages.value.push(modelListMessage)
      return true
    }
    
    systemStatus.value.currentModel = modelName
    await llmManager.setModel(modelName)

    const switchMessage = MessageFactory.createAssistantMessage(
      `✅ 已切换到模型：**${modelName}**\n\n现在可以开始对话了！`
    )
    messages.value.push(switchMessage)
    return true
  }

  // 如何安装 Ollama
  if (input.includes('如何') && input.includes('安装') && input.includes('ollama')) {
    const installMessage = MessageFactory.createAssistantMessage(
      `📦 如何安装 Ollama

**方法一：官网下载**
1. 访问 https://ollama.ai
2. 下载适合您系统的安装包
3. 按照安装向导完成安装

**方法二：命令行安装**
\`\`\`bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows (PowerShell)
iwr -useb https://ollama.ai/install.ps1 | iex
\`\`\`

**安装完成后：**
1. 拉取一个模型：\`ollama pull llama2\`
2. 说"检查系统状态"来验证安装`
    )
    messages.value.push(installMessage)
    return true
  }

  // 如何拉取模型
  if (input.includes('如何') && input.includes('拉取') && input.includes('模型')) {
    const pullMessage = MessageFactory.createAssistantMessage(
      `🔽 如何拉取模型

**推荐模型：**
\`\`\`bash
# 轻量级模型（推荐新手）
ollama pull llama2:7b
ollama pull qwen:7b

# 中等模型（平衡性能）
ollama pull llama2:13b
ollama pull mistral:7b

# 代码专用模型
ollama pull codellama:7b
ollama pull deepseek-coder:6.7b
\`\`\`

**拉取完成后：**
说"刷新模型列表"来重新检测可用模型。`
    )
    messages.value.push(pullMessage)
    return true
  }



  // 调试命令：显示所有Obsidian工具
  if (input.includes('显示') && input.includes('obsidian') && input.includes('工具')) {
    try {
      const toolsResult = await window.electronAPI.mcp.getTools()
      let toolsList = '🛠️ **Obsidian MCP 工具列表**\n\n'
      
      if (toolsResult.success && toolsResult.data) {
        const obsidianTools = toolsResult.data.filter((tool: any) => 
          tool.server === 'obsidian' || 
          tool.name.includes('obsidian') ||
          tool.description?.toLowerCase().includes('obsidian')
        )
        
        toolsList += `找到 ${obsidianTools.length} 个 Obsidian 工具：\n\n`
        
        obsidianTools.forEach((tool: any, index: number) => {
          toolsList += `${index + 1}. **${tool.name}**\n`
          toolsList += `   - 描述: ${tool.description || '无描述'}\n`
          toolsList += `   - 服务器: ${tool.server}\n\n`
        })
      } else {
        toolsList += '❌ 无法获取工具列表\n'
      }
      
      const toolsMessage = MessageFactory.createAssistantMessage(toolsList)
      messages.value.push(toolsMessage)
    } catch (error) {
      const errorMessage = MessageFactory.createAssistantMessage(`❌ 获取Obsidian工具失败: ${error}`)
      messages.value.push(errorMessage)
    }
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

// 滚动到底部 - 简化版本
const scrollToBottom = () => {
  if (messagesContainer.value) {
    requestAnimationFrame(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }
}

// 工具函数：获取模型显示名称
const getModelDisplayName = (modelId: string) => {
  // 从所有提供商中查找模型
  for (const provider of llmManager.availableProviders.value) {
    const model = provider.models.find(m => m.id === modelId)
    if (model) {
      return model.name || model.id
    }
  }
  return modelId
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

// 设为默认模型
const setAsDefault = async () => {
  if (!llmManager.currentModel.value) {
    alert('请先选择一个模型')
    return
  }
  
  try {
    // 保存当前选择为默认
    llmManager.setModel(llmManager.currentModel.value)
    
    // 同时保存提供商选择
    if (llmManager.currentProvider.value) {
      await llmManager.setProvider(llmManager.currentProvider.value)
    }
    
    // 保存配置到本地存储
    await llmManager.save()
    
    alert(`✅ 已设置 ${getModelDisplayName(llmManager.currentModel.value)} 为默认模型和提供商`)
  } catch (error) {
    alert(`❌ 设置默认模型失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

onMounted(async () => {
  try {
    // 初始化主题
    const savedTheme = localStorage.getItem('bor-theme') || 'light'
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
    document.documentElement.setAttribute('data-theme', savedTheme)
    
    // 通知Electron主进程设置窗口背景
    if (window.electronAPI?.setTheme) {
      try {
        await window.electronAPI.setTheme(savedTheme)
      } catch (error) {
        console.error('设置主题失败:', error)
      }
    }
    
    // 初始化聊天存储
    chatStore.initialize()
    
    // 检查系统状态
    await checkSystemStatus()
    
    // 根据系统状态显示不同的欢迎信息
    if (messages.value.length === 0) {
      let welcomeMessage: Message
      
      try {
        if (!systemStatus.value.ollama) {
          // 检查是否有任何可用的提供商
          const hasAvailableProvider = llmManager.availableProviders.value.some(p => p.isAvailable)
          
          if (!hasAvailableProvider) {
            // 没有可用的提供商
            welcomeMessage = MessageFactory.createAssistantMessage(
              `👋 欢迎使用 Bor 智能体中枢！

**系统状态：**
- LLM 服务：❌ 未连接

**开始使用：**
1. 说"配置 LLM"来设置模型提供商
2. 或访问配置页面进行详细设置

点击下方"🔧 打开配置"按钮开始配置。`
            )
          } else if (!llmManager.currentModel.value) {
            // 有可用提供商但没有选择模型
            const currentProvider = llmManager.availableProviders.value.find(p => p.id === llmManager.currentProvider.value)
            const providerName = currentProvider?.name || llmManager.currentProvider.value || '未知提供商'
            
            welcomeMessage = MessageFactory.createAssistantMessage(
              `👋 欢迎使用 Bor 智能体中枢！

**系统状态：**
- ${providerName} 服务：✅ 已连接
- 当前模型：❌ 未选择

**下一步：**
1. 说"配置 LLM"来选择模型
2. 或直接开始对话，系统将自动选择默认模型

点击下方"🔧 打开配置"按钮选择模型。`
            )
          } else {
            // 一切正常
            const currentProvider = llmManager.availableProviders.value.find(p => p.id === llmManager.currentProvider.value)
            const providerName = currentProvider?.name || llmManager.currentProvider.value || '未知提供商'
            
            welcomeMessage = MessageFactory.createAssistantMessage(
              `👋 欢迎使用 Bor 智能体中枢！

**当前状态：**
- ${providerName} 服务：✅ 已连接
- 当前模型：${systemStatus.value.currentModel}
- 可用模型：${systemStatus.value.availableModels.length} 个

您可以直接开始对话，或说"配置 LLM"进行更多设置。`
            )
          }
        } else if (systemStatus.value.availableModels.length === 0) {
          // Ollama 已连接但没有模型
          const currentProvider = llmManager.availableProviders.value.find(p => p.id === llmManager.currentProvider.value)
          const providerName = currentProvider?.name || llmManager.currentProvider.value || 'Ollama'
          
          if (llmManager.currentProvider.value === 'ollama') {
            welcomeMessage = MessageFactory.createAssistantMessage(
              `👋 欢迎使用 Bor 智能体中枢！

**系统状态：**
- ${providerName} 服务：✅ 已连接
- 可用模型：❌ 暂无

**开始使用：**
请先拉取一个模型，例如：
\`\`\`bash
ollama pull llama2
# 或者
ollama pull qwen:7b
\`\`\`

然后说"刷新模型列表"来重新检测。`
            )
          } else {
            welcomeMessage = MessageFactory.createAssistantMessage(
              `👋 欢迎使用 Bor 智能体中枢！

**系统状态：**
- ${providerName} 服务：✅ 已连接
- 可用模型：❌ 暂无

**开始使用：**
请在LLM配置中添加模型，或检查服务配置是否正确。

您可以说"打开配置"来管理模型设置。`
            )
          }
        } else {
          // 一切正常
          const currentProvider = llmManager.availableProviders.value.find(p => p.id === llmManager.currentProvider.value)
          const providerName = currentProvider?.name || llmManager.currentProvider.value || '未知提供商'
          
          welcomeMessage = MessageFactory.createAssistantMessage(
            `👋 欢迎使用 Bor 智能体中枢！

**当前状态：**
- ${providerName} 服务：✅ 已连接
- 当前模型：${systemStatus.value.currentModel}
- 可用模型：${systemStatus.value.availableModels.length} 个

您可以直接开始对话，或说"检查系统状态"查看详细信息。`
          )
        }
      } catch (welcomeError) {
        console.error('生成欢迎信息失败:', welcomeError)
        // 使用最基础的欢迎信息
        welcomeMessage = MessageFactory.createAssistantMessage(
          `👋 欢迎使用 Bor 智能体中枢！

系统正在初始化，请稍候...

如果长时间没有响应，请说"配置 LLM"来检查设置。`
        )
      }
      
      messages.value.push(welcomeMessage)
      
      // 更新建议列表
      try {
        suggestions.value = getSuggestions()
      } catch (suggestionError) {
        console.error('生成建议列表失败:', suggestionError)
        suggestions.value = ['你好', '配置 LLM', '检查系统状态']
      }
    }
  } catch (error) {
    console.error('聊天视图初始化失败:', error)
    // 确保即使出错也能显示基本界面
    if (messages.value.length === 0) {
      const errorMessage = MessageFactory.createAssistantMessage(
        `❌ 系统初始化遇到问题

请尝试以下操作：
1. 刷新页面
2. 说"配置 LLM"检查设置
3. 检查浏览器控制台错误信息

我们将继续尝试加载系统...`
      )
      messages.value.push(errorMessage)
    }
  }
})
</script>