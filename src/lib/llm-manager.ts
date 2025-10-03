// 基于 Chatbot UI 架构的统一 LLM 管理器
import { ref, reactive } from 'vue'
import type { LLMModel, LLMProvider, ChatMessage, ChatSettings } from './models'
import { DEFAULT_CHAT_SETTINGS } from './models'
import { BaseLLMProvider } from './providers/base'
import { OpenAIProvider } from './providers/openai'
import { OllamaProvider } from './providers/ollama'
import { OpenRouterProvider } from './providers/openrouter'
import { GeminiProvider } from './providers/gemini'
import { ZhipuProvider } from './providers/zhipu'
import { OpenAICompatibleProvider } from './providers/openai-compatible'

export interface LLMManagerConfig {
  providers: Record<string, any>
  defaultProvider: string
  defaultModel: string
  settings: ChatSettings
}

export class LLMManager {
  private providers = new Map<string, BaseLLMProvider>()
  private config = reactive<LLMManagerConfig>({
    providers: {},
    defaultProvider: 'ollama',
    defaultModel: '',
    settings: { ...DEFAULT_CHAT_SETTINGS }
  })

  // 响应式状态
  public readonly isLoading = ref(false)
  public readonly currentProvider = ref<string>('')
  public readonly currentModel = ref<string>('')
  public readonly availableModels = ref<LLMModel[]>([])
  public readonly availableProviders = ref<LLMProvider[]>([])

  constructor() {
    this.initializeProviders()
    this.loadConfig()
  }

  private initializeProviders() {
    // 注册内置提供商
    this.registerProvider(new OllamaProvider())
    this.registerProvider(new OpenAIProvider())
    this.registerProvider(new OpenRouterProvider())
    this.registerProvider(new GeminiProvider())
    this.registerProvider(new ZhipuProvider())
    this.registerProvider(new OpenAICompatibleProvider())
  }

  private registerProvider(provider: BaseLLMProvider) {
    this.providers.set(provider.id, provider)
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem('bor-llm-config')
      if (saved) {
        const config = JSON.parse(saved)
        Object.assign(this.config, config)
        
        // 恢复提供商配置
        for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
          const provider = this.providers.get(providerId)
          if (provider && providerConfig) {
            provider.updateConfig(providerConfig as any)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error)
    }
  }

  private saveConfig() {
    try {
      localStorage.setItem('bor-llm-config', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save LLM config:', error)
    }
  }

  // 公共 API
  async initialize() {
    this.isLoading.value = true
    
    try {
      await this.refreshProviders()
      await this.refreshModels()
      
      // 如果没有设置默认提供商，自动选择第一个可用的
      if (!this.currentProvider.value) {
        const availableProvider = this.availableProviders.value.find(p => p.isAvailable)
        if (availableProvider) {
          await this.setProvider(availableProvider.id)
        }
      }
    } finally {
      this.isLoading.value = false
    }
  }

  async refreshProviders() {
    const providers: LLMProvider[] = []
    
    for (const [id, provider] of this.providers) {
      try {
        const isConfigured = provider.isConfigured()
        let isAvailable = false
        let models: LLMModel[] = []
        
        if (isConfigured) {
          // 测试连接可用性
          isAvailable = await provider.isAvailable()
          
          if (isAvailable) {
            // 获取模型列表
            models = await provider.getModels()
            console.log(`✅ Provider ${id}: 发现 ${models.length} 个模型`)
          } else {
            console.warn(`⚠️ Provider ${id}: 已配置但不可用`)
          }
        } else {
          console.log(`ℹ️ Provider ${id}: 未配置`)
        }
        
        providers.push({
          id,
          name: provider.name,
          type: provider.type,
          baseUrl: provider.getConfig().baseUrl,
          models,
          isConfigured,
          isAvailable
        })
      } catch (error) {
        console.error(`❌ Provider ${id} 检查失败:`, error)
        // 即使出错也要添加到列表中，但标记为不可用
        providers.push({
          id,
          name: provider.name,
          type: provider.type,
          baseUrl: provider.getConfig().baseUrl,
          models: [],
          isConfigured: provider.isConfigured(),
          isAvailable: false
        })
      }
    }
    
    this.availableProviders.value = providers
    console.log(`🔄 刷新完成: ${providers.length} 个提供商，${providers.filter(p => p.isAvailable).length} 个可用`)
  }

  async refreshModels() {
    if (!this.currentProvider.value) {
      this.availableModels.value = []
      return
    }

    const provider = this.providers.get(this.currentProvider.value)
    if (!provider) {
      this.availableModels.value = []
      return
    }

    try {
      const models = await provider.getModels()
      this.availableModels.value = models
      
      // 如果没有设置默认模型，自动选择第一个
      if (!this.currentModel.value && models.length > 0) {
        this.setModel(models[0].id)
      }
    } catch (error) {
      console.error('Failed to refresh models:', error)
      this.availableModels.value = []
    }
  }

  async setProvider(providerId: string) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    // 允许选择未配置的提供商，但会在UI中提示需要配置
    if (!provider.isConfigured()) {
      console.warn(`Provider ${providerId} is not configured`)
      // 不抛出错误，让用户可以选择并配置
    } else {
      // 只有已配置的提供商才检查可用性
      const isAvailable = await provider.isAvailable()
      if (!isAvailable) {
        console.warn(`Provider ${providerId} is configured but not available`)
        // 不抛出错误，让用户可以选择并重新配置
      }
    }

    this.currentProvider.value = providerId
    this.config.defaultProvider = providerId
    this.saveConfig()
    
    await this.refreshModels()
  }

  setModel(modelId: string) {
    const model = this.availableModels.value.find(m => m.id === modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    this.currentModel.value = modelId
    this.config.defaultModel = modelId
    this.saveConfig()
  }

  async configureProvider(providerId: string, config: any) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    // 特殊处理 OpenAI 兼容提供商的手动模型配置
    if (provider.type === 'openai-compatible' && config.models) {
      console.log(`配置 ${providerId} 的手动模型:`, config.models)
    }

    provider.updateConfig(config)
    this.config.providers[providerId] = config
    this.saveConfig()
    
    await this.refreshProviders()
  }

  async testProvider(providerId: string): Promise<{ success: boolean; message: string; details?: any }> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      return { success: false, message: 'Provider not found' }
    }

    try {
      // 1. 测试基本连接
      const connectionResult = await provider.testConnection()
      if (!connectionResult.success) {
        return connectionResult
      }

      // 2. 尝试获取模型列表
      const models = await provider.getModels()
      if (models.length === 0) {
        return { 
          success: false, 
          message: '连接成功但未发现可用模型',
          details: { models: [] }
        }
      }

      // 3. 尝试简单的聊天测试（如果有模型）
      try {
        const testMessages = [{
          id: 'test',
          role: 'user' as const,
          content: 'Hello',
          timestamp: Date.now()
        }]

        const response = await provider.chat({
          model: models[0].id,
          messages: testMessages,
          settings: { ...this.config.settings, maxTokens: 10 }
        })

        return {
          success: true,
          message: `连接成功！发现 ${models.length} 个模型，测试响应: "${response.slice(0, 50)}${response.length > 50 ? '...' : ''}"`,
          details: { 
            models: models.length,
            testResponse: response.slice(0, 100)
          }
        }
      } catch (chatError) {
        // 聊天测试失败不算致命错误
        return {
          success: true,
          message: `连接成功，发现 ${models.length} 个模型，但聊天测试失败: ${chatError instanceof Error ? chatError.message : '未知错误'}`,
          details: { 
            models: models.length,
            chatTestFailed: true
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: {
      provider?: string
      model?: string
      settings?: Partial<ChatSettings>
      onStream?: (content: string) => void
      signal?: AbortSignal
    }
  ): Promise<string> {
    const providerId = options?.provider || this.currentProvider.value
    const modelId = options?.model || this.currentModel.value
    
    if (!providerId || !modelId) {
      throw new Error('No provider or model selected')
    }

    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    const settings = { ...this.config.settings, ...options?.settings }
    
    return await provider.chat({
      model: modelId,
      messages,
      settings,
      onStream: options?.onStream ? (response) => {
        options.onStream!(response.content)
      } : undefined,
      signal: options?.signal
    })
  }

  // 获取当前状态
  getStatus() {
    return {
      currentProvider: this.currentProvider.value,
      currentModel: this.currentModel.value,
      availableProviders: this.availableProviders.value,
      availableModels: this.availableModels.value,
      isLoading: this.isLoading.value
    }
  }

  // 获取提供商实例（用于特殊操作，如 Ollama 的 pullModel）
  getProvider(providerId: string): BaseLLMProvider | undefined {
    return this.providers.get(providerId)
  }

  // 添加自定义 OpenAI 兼容提供商
  addCustomProvider(config: { 
    id: string
    name: string
    baseUrl: string
    apiKey?: string 
  }) {
    const provider = new OpenAICompatibleProvider({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      name: config.name
    })
    
    // 使用自定义 ID
    provider.id = config.id
    
    this.registerProvider(provider)
    
    // 保存配置
    this.config.providers[config.id] = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      name: config.name
    }
    this.saveConfig()
    
    return provider
  }

  // 移除自定义提供商
  removeCustomProvider(providerId: string) {
    this.providers.delete(providerId)
    delete this.config.providers[providerId]
    this.saveConfig()
  }

  // 更新设置
  updateSettings(settings: Partial<ChatSettings>) {
    Object.assign(this.config.settings, settings)
    this.saveConfig()
  }

  // 公共保存配置方法
  async save() {
    this.saveConfig()
  }

  getSettings(): ChatSettings {
    return { ...this.config.settings }
  }

  // 智能模型推荐
  getRecommendedModels(): { provider: string; model: string; reason: string }[] {
    const recommendations: { provider: string; model: string; reason: string }[] = []
    
    for (const provider of this.availableProviders.value) {
      if (!provider.isAvailable || provider.models.length === 0) continue
      
      // 根据不同提供商推荐最佳模型
      switch (provider.type) {
        case 'openai':
          const gpt4 = provider.models.find(m => m.id.includes('gpt-4') && !m.id.includes('vision'))
          if (gpt4) {
            recommendations.push({
              provider: provider.id,
              model: gpt4.id,
              reason: '最强大的通用模型，适合复杂任务'
            })
          }
          break
          
        case 'ollama':
          // 推荐轻量级但性能好的模型
          const qwen = provider.models.find(m => m.id.includes('qwen') && m.id.includes('7b'))
          const llama = provider.models.find(m => m.id.includes('llama') && m.id.includes('7b'))
          
          if (qwen) {
            recommendations.push({
              provider: provider.id,
              model: qwen.id,
              reason: '中文友好的本地模型，性能均衡'
            })
          } else if (llama) {
            recommendations.push({
              provider: provider.id,
              model: llama.id,
              reason: '经典的本地模型，社区支持好'
            })
          }
          break
          
        case 'gemini':
          const geminiPro = provider.models.find(m => m.id.includes('gemini-1.5-pro'))
          if (geminiPro) {
            recommendations.push({
              provider: provider.id,
              model: geminiPro.id,
              reason: '超长上下文，适合处理大文档'
            })
          }
          break
          
        case 'zhipu':
          const glm4 = provider.models.find(m => m.id.includes('glm-4'))
          if (glm4) {
            recommendations.push({
              provider: provider.id,
              model: glm4.id,
              reason: '国产优秀模型，中文理解能力强'
            })
          }
          break
          
        case 'openrouter':
          // 推荐性价比高的模型
          const claude = provider.models.find(m => m.id.includes('claude-3-haiku'))
          if (claude) {
            recommendations.push({
              provider: provider.id,
              model: claude.id,
              reason: '快速且经济的高质量模型'
            })
          }
          break
      }
    }
    
    return recommendations.slice(0, 3) // 最多返回3个推荐
  }

  // 自动选择最佳模型
  async autoSelectBestModel(): Promise<{ success: boolean; message: string }> {
    const recommendations = this.getRecommendedModels()
    
    if (recommendations.length === 0) {
      return { success: false, message: '没有找到可用的模型' }
    }
    
    // 选择第一个推荐
    const best = recommendations[0]
    
    try {
      await this.setProvider(best.provider)
      this.setModel(best.model)
      
      return {
        success: true,
        message: `已自动选择 ${best.model} (${best.reason})`
      }
    } catch (error) {
      return {
        success: false,
        message: `自动选择失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }
}

// 单例实例
export const llmManager = new LLMManager()