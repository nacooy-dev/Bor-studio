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


export interface LLMManagerConfig {
  providers: Record<string, any>
  defaultProvider: string
  defaultModel: string  // 保留用于向后兼容
  providerDefaultModels: Record<string, string>  // 新增：为每个提供商存储默认模型
  settings: ChatSettings
}

export class LLMManager {
  private providers = new Map<string, BaseLLMProvider>()
  private config = reactive<LLMManagerConfig>({
    providers: {},
    defaultProvider: 'ollama',
    defaultModel: '',  // 保留用于向后兼容
    providerDefaultModels: {},  // 新增：为每个提供商存储默认模型
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
  }

  private registerProvider(provider: BaseLLMProvider) {
    this.providers.set(provider.id, provider)
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem('bor-llm-config')
      if (saved) {
        const config = JSON.parse(saved)
        // 确保配置结构正确
        if (typeof config === 'object' && config !== null) {
          // 合并默认配置和保存的配置
          Object.assign(this.config, {
            providers: {},
            defaultProvider: 'ollama',
            defaultModel: '',  // 保留用于向后兼容
            providerDefaultModels: {},  // 新增：为每个提供商存储默认模型
            settings: { ...DEFAULT_CHAT_SETTINGS }
          }, config)
          
          // 验证和恢复提供商配置
          if (typeof this.config.providers === 'object' && this.config.providers !== null) {
            for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
              // 验证提供商ID是否有效
              if (typeof providerId === 'string' && providerId.length > 0) {
                const provider = this.providers.get(providerId)
                // 验证配置是否有效
                if (provider && providerConfig && typeof providerConfig === 'object') {
                  try {
                    provider.updateConfig(providerConfig as any)
                  } catch (updateError) {
                    console.warn(`Failed to update config for provider ${providerId}:`, updateError)
                  }
                }
              }
            }
          }
          
          // 验证默认提供商
          if (typeof this.config.defaultProvider !== 'string' || !this.config.defaultProvider) {
            this.config.defaultProvider = 'ollama'
          }
          
          // 验证设置
          if (!this.config.settings || typeof this.config.settings !== 'object') {
            this.config.settings = { ...DEFAULT_CHAT_SETTINGS }
          }
          
          // 确保 providerDefaultModels 存在
          if (typeof this.config.providerDefaultModels !== 'object' || this.config.providerDefaultModels === null) {
            this.config.providerDefaultModels = {}
          }
        }
      }
    } catch (error) {
      console.error('Failed to load LLM config, using defaults:', error)
      // 出错时使用默认配置
      this.config = {
        providers: {},
        defaultProvider: 'ollama',
        defaultModel: '',
        providerDefaultModels: {},
        settings: { ...DEFAULT_CHAT_SETTINGS }
      }
    }
  }

  private saveConfig() {
    try {
      // 创建一个安全的配置副本，避免循环引用
      const safeConfig = {
        providers: this.config.providers,
        defaultProvider: this.config.defaultProvider,
        defaultModel: this.config.defaultModel,
        providerDefaultModels: this.config.providerDefaultModels,
        settings: this.config.settings
      }
      localStorage.setItem('bor-llm-config', JSON.stringify(safeConfig))
    } catch (error) {
      console.error('Failed to save LLM config:', error)
      // 不抛出错误，避免影响用户体验
    }
  }

  // 添加配置验证方法
  private validateConfig(config: any): config is LLMManagerConfig {
    return (
      typeof config === 'object' &&
      config !== null &&
      typeof config.defaultProvider === 'string' &&
      typeof config.defaultModel === 'string' &&
      typeof config.settings === 'object' &&
      config.settings !== null
    )
  }

  // 公共方法：验证并修复配置
  public validateAndFixConfig() {
    try {
      // 验证当前配置
      if (!this.validateConfig(this.config)) {
        console.warn('Invalid config detected, resetting to defaults')
        this.config = {
          providers: {},
          defaultProvider: 'ollama',
          defaultModel: '',
          providerDefaultModels: {},
          settings: { ...DEFAULT_CHAT_SETTINGS }
        }
      }
      
      // 验证提供商配置
      if (typeof this.config.providers !== 'object' || this.config.providers === null) {
        this.config.providers = {}
      }
      
      // 验证设置
      if (typeof this.config.settings !== 'object' || this.config.settings === null) {
        this.config.settings = { ...DEFAULT_CHAT_SETTINGS }
      }
      
      // 确保 providerDefaultModels 存在
      if (typeof this.config.providerDefaultModels !== 'object' || this.config.providerDefaultModels === null) {
        this.config.providerDefaultModels = {}
      }
      
      // 保存修复后的配置
      this.saveConfig()
      
      return true
    } catch (error) {
      console.error('Config validation failed:', error)
      return false
    }
  }

  // 公共方法：重置配置
  public resetConfig() {
    try {
      this.config = {
        providers: {},
        defaultProvider: 'ollama',
        defaultModel: '',
        providerDefaultModels: {},
        settings: { ...DEFAULT_CHAT_SETTINGS }
      }
      this.saveConfig()
      console.log('Config reset to defaults')
      return true
    } catch (error) {
      console.error('Config reset failed:', error)
      return false
    }
  }

  // 公共方法：导出配置
  public exportConfig(): string {
    try {
      // 创建安全的配置副本
      const safeConfig = {
        providers: this.config.providers,
        defaultProvider: this.config.defaultProvider,
        defaultModel: this.config.defaultModel,
        providerDefaultModels: this.config.providerDefaultModels,
        settings: this.config.settings
      }
      return JSON.stringify(safeConfig, null, 2)
    } catch (error) {
      console.error('Config export failed:', error)
      return '{}'
    }
  }

  // 公共方法：导入配置
  public importConfig(configStr: string): boolean {
    try {
      const config = JSON.parse(configStr)
      if (this.validateConfig(config)) {
        this.config = config
        this.saveConfig()
        
        // 恢复提供商配置
        for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
          const provider = this.providers.get(providerId)
          if (provider && providerConfig) {
            provider.updateConfig(providerConfig as any)
          }
        }
        
        console.log('Config imported successfully')
        return true
      } else {
        console.error('Invalid config format')
        return false
      }
    } catch (error) {
      console.error('Config import failed:', error)
      return false
    }
  }

  // 公共 API
  async initialize() {
    this.isLoading.value = true
    
    try {
      await this.refreshProviders()
      
      // 恢复之前保存的提供商和模型选择
      if (this.config.defaultProvider) {
        // 验证保存的提供商是否仍然可用
        const savedProvider = this.availableProviders.value.find(p => p.id === this.config.defaultProvider)
        if (savedProvider && savedProvider.isAvailable) {
          this.currentProvider.value = this.config.defaultProvider
          console.log(`恢复提供商选择: ${this.config.defaultProvider}`)
        } else if (savedProvider) {
          // 提供商存在但不可用，仍然选择它让用户重新配置
          this.currentProvider.value = this.config.defaultProvider
          console.log(`恢复提供商选择(但不可用): ${this.config.defaultProvider}`)
        }
      }
      
      await this.refreshModels()
      
      // 确保当前模型与配置一致
      if (this.currentProvider.value && this.config.providerDefaultModels[this.currentProvider.value]) {
        // 验证保存的模型是否仍然可用
        const savedModel = this.availableModels.value.find(m => m.id === this.config.providerDefaultModels[this.currentProvider.value])
        if (savedModel) {
          this.currentModel.value = this.config.providerDefaultModels[this.currentProvider.value]
          console.log(`恢复模型选择: ${this.config.providerDefaultModels[this.currentProvider.value]}`)
        }
      }
      
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
    
    // 使用 Promise.all 并行处理所有提供商检查，提高性能
    const providerChecks = Array.from(this.providers.entries()).map(async ([id, provider]) => {
      try {
        const isConfigured = provider.isConfigured()
        let isAvailable = false
        let models: LLMModel[] = []
        
        if (isConfigured) {
          try {
            // 设置超时，避免某个提供商响应过慢阻塞整个过程
            const timeoutPromise = new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('Provider check timeout')), 10000)
            )
            
            isAvailable = await Promise.race<boolean>([
              provider.isAvailable(),
              timeoutPromise
            ]).catch(() => {
              console.warn(`Provider ${id} availability check timed out`)
              return false
            })
            
            if (isAvailable) {
              const modelTimeoutPromise = new Promise<LLMModel[]>((_, reject) => 
                setTimeout(() => reject(new Error('Model fetch timeout')), 10000)
              )
              
              models = await Promise.race<LLMModel[]>([
                provider.getModels(),
                modelTimeoutPromise
              ]).catch(() => {
                console.warn(`Provider ${id} model fetch timed out`)
                return []
              })
              console.log(`✅ Provider ${id}: 发现 ${models.length} 个模型`)
            } else {
              console.warn(`⚠️ Provider ${id}: 已配置但不可用`)
            }
          } catch (providerError) {
            console.error(`Provider ${id} check failed:`, providerError)
            isAvailable = false
            models = []
          }
        } else {
          console.log(`ℹ️ Provider ${id}: 未配置`)
        }
        
        return {
          id,
          name: provider.name,
          type: provider.type,
          baseUrl: provider.getConfig().baseUrl,
          models,
          isConfigured,
          isAvailable
        }
      } catch (error) {
        console.error(`❌ Provider ${id} processing failed:`, error)
        // 即使出错也要返回一个安全的对象
        return {
          id,
          name: provider.name,
          type: provider.type,
          baseUrl: provider.getConfig().baseUrl,
          models: [],
          isConfigured: false,
          isAvailable: false
        }
      }
    })
    
    try {
      // 等待所有检查完成，设置总体超时
      const timeoutPromise = new Promise<LLMProvider[]>((_, reject) => 
        setTimeout(() => reject(new Error('Overall provider refresh timeout')), 30000)
      )
      
      const results = await Promise.race<LLMProvider[]>([
        Promise.all(providerChecks),
        timeoutPromise
      ])
      
      this.availableProviders.value = results
      console.log(`🔄 刷新完成: ${results.length} 个提供商，${results.filter(p => p.isAvailable).length} 个可用`)
    } catch (error) {
      console.error('Provider refresh failed:', error)
      // 即使失败也要确保有默认值
      this.availableProviders.value = []
    }
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
      
      // 检查之前保存的默认模型是否仍然可用
      if (this.currentProvider.value && this.config.providerDefaultModels[this.currentProvider.value]) {
        const savedModel = models.find(m => m.id === this.config.providerDefaultModels[this.currentProvider.value])
        if (savedModel) {
          // 如果保存的默认模型仍然可用，使用它
          this.currentModel.value = this.config.providerDefaultModels[this.currentProvider.value]
        } else if (models.length > 0) {
          // 如果保存的默认模型不可用，但有其他模型可用，选择第一个
          console.log(`保存的默认模型 ${this.config.providerDefaultModels[this.currentProvider.value]} 不可用，选择第一个可用模型: ${models[0].id}`)
          this.currentModel.value = models[0].id
          this.config.providerDefaultModels[this.currentProvider.value] = models[0].id
          this.saveConfig()
        }
      } else if (!this.currentModel.value && models.length > 0) {
        // 如果没有保存的默认模型且当前没有选择模型，自动选择第一个
        console.log(`没有保存的默认模型，选择第一个可用模型: ${models[0].id}`)
        this.currentModel.value = models[0].id
        if (this.currentProvider.value) {
          this.config.providerDefaultModels[this.currentProvider.value] = models[0].id
        }
        this.saveConfig()
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
    
    // 为当前提供商保存默认模型
    if (this.currentProvider.value) {
      this.config.providerDefaultModels[this.currentProvider.value] = modelId
    }
    
    // 保持向后兼容
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