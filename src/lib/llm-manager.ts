// 基于 Chatbot UI 架构的统一 LLM 管理器
import { ref, reactive } from 'vue'
import type { LLMModel, LLMProvider, ChatMessage, ChatSettings } from './models'
import { DEFAULT_CHAT_SETTINGS } from './models'
import { BaseLLMProvider } from './providers/base'
import { OpenAIProvider } from './providers/openai'
import { OllamaProvider } from './providers/ollama'

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
    
    // 可以继续添加其他提供商
    // this.registerProvider(new AnthropicProvider())
    // this.registerProvider(new GoogleProvider())
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
      const isConfigured = provider.isConfigured()
      const isAvailable = isConfigured ? await provider.isAvailable() : false
      const models = isAvailable ? await provider.getModels() : []
      
      providers.push({
        id,
        name: provider.name,
        type: provider.type,
        baseUrl: provider.getConfig().baseUrl,
        models,
        isConfigured,
        isAvailable
      })
    }
    
    this.availableProviders.value = providers
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

    if (!provider.isConfigured()) {
      throw new Error(`Provider ${providerId} is not configured`)
    }

    const isAvailable = await provider.isAvailable()
    if (!isAvailable) {
      throw new Error(`Provider ${providerId} is not available`)
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

    provider.updateConfig(config)
    this.config.providers[providerId] = config
    this.saveConfig()
    
    await this.refreshProviders()
  }

  async testProvider(providerId: string): Promise<{ success: boolean; message: string }> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      return { success: false, message: 'Provider not found' }
    }

    return await provider.testConnection()
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

  // 更新设置
  updateSettings(settings: Partial<ChatSettings>) {
    Object.assign(this.config.settings, settings)
    this.saveConfig()
  }

  getSettings(): ChatSettings {
    return { ...this.config.settings }
  }
}

// 单例实例
export const llmManager = new LLMManager()