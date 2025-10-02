import { OllamaService } from '../ollama/OllamaService'
import { OpenAIProvider } from './providers/OpenAIProvider'
import { AnthropicProvider } from './providers/AnthropicProvider'
import { GeminiProvider } from './providers/GeminiProvider'
import type { Message } from '@/types'

export interface LLMProvider {
  name: string
  type: 'ollama' | 'openai' | 'anthropic' | 'openrouter' | 'zhipu' | 'gemini'
  isAvailable(): Promise<boolean>
  getModels(): Promise<string[]>
  chat(messages: Message[], model?: string, onStream?: (chunk: string) => void): Promise<string>
  testConnection?(): Promise<{ success: boolean; message: string }>
  updateConfig?(config: any): void
  getConfig?(): any
}

export class OllamaProvider implements LLMProvider {
  name = 'Ollama'
  type = 'ollama' as const
  private service: OllamaService

  constructor(baseURL?: string) {
    this.service = new OllamaService(baseURL)
  }

  async isAvailable(): Promise<boolean> {
    return await this.service.checkStatus()
  }

  async getModels(): Promise<string[]> {
    try {
      console.log('🔍 OllamaProvider 调用 service.getModels()')
      const models = await this.service.getModels()
      console.log('🔍 OllamaService 返回的模型对象:', models)
      const modelNames = models.map(model => model.name)
      console.log('🔍 提取的模型名称:', modelNames)
      return modelNames
    } catch (error) {
      console.error('🔍 OllamaProvider.getModels() 失败:', error)
      return []
    }
  }

  async chat(
    messages: Message[],
    model?: string,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    return await this.service.chat(messages, model, onStream)
  }

  async pullModel(modelName: string, onProgress?: (progress: string) => void): Promise<void> {
    return await this.service.pullModel(modelName, onProgress)
  }
}

export class LLMManager {
  private providers: Map<string, LLMProvider> = new Map()
  private currentProvider: string = 'ollama'
  private currentModel: string = '' // 不设置默认模型，动态检测
  private providerConfigs: Map<string, any> = new Map()

  constructor() {
    this.loadConfigurations()
    this.initializeProviders()
  }

  private loadConfigurations() {
    // 从本地存储加载供应商配置
    try {
      const saved = localStorage.getItem('bor-llm-configs')
      if (saved) {
        const configs = JSON.parse(saved)
        for (const [key, value] of Object.entries(configs)) {
          this.providerConfigs.set(key, value)
        }
      }
    } catch (error) {
      console.error('加载 LLM 配置失败:', error)
    }
  }

  private saveConfigurations() {
    try {
      const configs = Object.fromEntries(this.providerConfigs.entries())
      localStorage.setItem('bor-llm-configs', JSON.stringify(configs))
    } catch (error) {
      console.error('保存 LLM 配置失败:', error)
    }
  }

  private initializeProviders() {
    // 注册 Ollama 提供商（始终可用）
    this.providers.set('ollama', new OllamaProvider())
    
    // 根据配置初始化其他提供商
    this.initializeConfiguredProviders()
  }

  private initializeConfiguredProviders() {
    // OpenAI
    const openaiConfig = this.providerConfigs.get('openai')
    if (openaiConfig && openaiConfig.apiKey) {
      this.providers.set('openai', new OpenAIProvider(openaiConfig))
    }

    // Anthropic
    const anthropicConfig = this.providerConfigs.get('anthropic')
    if (anthropicConfig && anthropicConfig.apiKey) {
      this.providers.set('anthropic', new AnthropicProvider(anthropicConfig))
    }

    // Gemini
    const geminiConfig = this.providerConfigs.get('gemini')
    if (geminiConfig && geminiConfig.apiKey) {
      this.providers.set('gemini', new GeminiProvider(geminiConfig))
    }
  }

  // 获取当前提供商
  getCurrentProvider(): LLMProvider | null {
    return this.providers.get(this.currentProvider) || null
  }

  // 切换提供商
  async switchProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`提供商 ${providerName} 不存在`)
    }

    const isAvailable = await provider.isAvailable()
    if (!isAvailable) {
      throw new Error(`提供商 ${providerName} 不可用`)
    }

    this.currentProvider = providerName
    return true
  }

  // 切换模型
  setCurrentModel(model: string) {
    this.currentModel = model
  }

  // 获取当前模型
  getCurrentModel(): string {
    return this.currentModel
  }

  // 获取所有可用提供商
  async getAvailableProviders(): Promise<Array<{ name: string; type: string; available: boolean }>> {
    const results = []
    
    for (const [key, provider] of this.providers) {
      const available = await provider.isAvailable()
      results.push({
        name: provider.name,
        type: provider.type,
        available,
      })
    }

    return results
  }

  // 获取当前提供商的模型列表
  async getAvailableModels(): Promise<string[]> {
    const provider = this.getCurrentProvider()
    if (!provider) {
      console.log('🔍 没有当前提供商')
      return []
    }

    try {
      console.log('🔍 当前提供商:', provider.name, provider.type)
      const allModels = await provider.getModels()
      console.log('🔍 提供商返回的所有模型:', allModels)
      
      // 过滤掉嵌入模型，只保留聊天模型
      const chatModels = allModels.filter(model => {
        const modelLower = model.toLowerCase()
        // 排除嵌入模型
        return !modelLower.includes('embed') && 
               !modelLower.includes('embedding') &&
               !modelLower.includes('nomic-embed')
      })
      
      console.log('🔍 过滤后的聊天模型:', chatModels)
      
      // 如果没有设置当前模型，自动选择第一个可用的聊天模型
      if (!this.currentModel && chatModels.length > 0) {
        this.currentModel = chatModels[0]
        console.log('🔍 自动设置当前模型为:', this.currentModel)
      }
      
      return chatModels
    } catch (error) {
      console.error('获取模型列表失败:', error)
      return []
    }
  }

  // 发送聊天请求
  async chat(
    messages: Message[],
    options?: {
      model?: string
      provider?: string
      onStream?: (chunk: string) => void
    }
  ): Promise<string> {
    const providerName = options?.provider || this.currentProvider
    const model = options?.model || this.currentModel

    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`提供商 ${providerName} 不存在`)
    }

    const isAvailable = await provider.isAvailable()
    if (!isAvailable) {
      throw new Error(`提供商 ${providerName} 不可用，请检查服务状态`)
    }

    return await provider.chat(messages, model, options?.onStream)
  }

  // 检查系统状态
  async getSystemStatus() {
    const providers = await this.getAvailableProviders()
    const models = await this.getAvailableModels()

    return {
      currentProvider: this.currentProvider,
      currentModel: this.currentModel,
      providers,
      availableModels: models,
    }
  }

  // 配置供应商
  configureProvider(providerType: string, config: any): boolean {
    try {
      this.providerConfigs.set(providerType, config)
      this.saveConfigurations()

      // 重新初始化该供应商
      switch (providerType) {
        case 'openai':
          if (config.apiKey) {
            this.providers.set('openai', new OpenAIProvider(config))
          }
          break
        case 'anthropic':
          if (config.apiKey) {
            this.providers.set('anthropic', new AnthropicProvider(config))
          }
          break
        case 'gemini':
          if (config.apiKey) {
            this.providers.set('gemini', new GeminiProvider(config))
          }
          break
      }

      return true
    } catch (error) {
      console.error('配置供应商失败:', error)
      return false
    }
  }

  // 移除供应商配置
  removeProvider(providerType: string): boolean {
    try {
      this.providerConfigs.delete(providerType)
      this.providers.delete(providerType)
      this.saveConfigurations()
      return true
    } catch (error) {
      console.error('移除供应商失败:', error)
      return false
    }
  }

  // 测试供应商连接
  async testProvider(providerType: string): Promise<{ success: boolean; message: string }> {
    const provider = this.providers.get(providerType)
    if (!provider) {
      return { success: false, message: '供应商未配置' }
    }

    if (provider.testConnection) {
      return await provider.testConnection()
    }

    // 回退到基本可用性检查
    try {
      const isAvailable = await provider.isAvailable()
      return {
        success: isAvailable,
        message: isAvailable ? '连接成功' : '连接失败'
      }
    } catch (error) {
      return { success: false, message: `测试失败: ${error.message}` }
    }
  }

  // 获取供应商配置
  getProviderConfig(providerType: string): any {
    return this.providerConfigs.get(providerType)
  }

  // 获取所有已配置的供应商
  getConfiguredProviders(): Array<{ type: string; name: string; configured: boolean }> {
    const allProviders = [
      { type: 'ollama', name: 'Ollama (本地)', configured: true },
      { type: 'openai', name: 'OpenAI', configured: false },
      { type: 'anthropic', name: 'Anthropic (Claude)', configured: false },
      { type: 'gemini', name: 'Google Gemini', configured: false }
    ]

    return allProviders.map(provider => ({
      ...provider,
      configured: provider.type === 'ollama' || this.providers.has(provider.type)
    }))
  }

  // 智能选择提供商和模型
  async smartSelect(userInput: string): Promise<{ provider: string; model: string }> {
    const input = userInput.toLowerCase()

    // 如果用户明确要求本地模型
    if (input.includes('本地') || input.includes('离线') || input.includes('私密')) {
      return { provider: 'ollama', model: this.currentModel }
    }

    // 如果用户明确要求特定供应商
    if (input.includes('gpt') || input.includes('openai')) {
      if (this.providers.has('openai')) {
        const models = await this.providers.get('openai')!.getModels()
        const gptModel = models.find(m => m.includes('gpt-4')) || models[0]
        return { provider: 'openai', model: gptModel }
      }
    }

    if (input.includes('claude') || input.includes('anthropic')) {
      if (this.providers.has('anthropic')) {
        const models = await this.providers.get('anthropic')!.getModels()
        return { provider: 'anthropic', model: models[0] }
      }
    }

    if (input.includes('gemini') || input.includes('google')) {
      if (this.providers.has('gemini')) {
        const models = await this.providers.get('gemini')!.getModels()
        return { provider: 'gemini', model: models[0] }
      }
    }

    // 如果用户要求代码生成
    if (input.includes('代码') || input.includes('编程') || input.includes('code')) {
      // 优先使用 GPT-4 或 Claude 进行代码生成
      if (this.providers.has('openai')) {
        const models = await this.providers.get('openai')!.getModels()
        const codeModel = models.find(m => m.includes('gpt-4')) || models[0]
        return { provider: 'openai', model: codeModel }
      }
      
      if (this.providers.has('anthropic')) {
        const models = await this.providers.get('anthropic')!.getModels()
        return { provider: 'anthropic', model: models[0] }
      }
    }

    // 默认使用当前配置
    return { provider: this.currentProvider, model: this.currentModel }
  }
}