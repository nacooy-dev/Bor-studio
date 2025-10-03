// OpenAI 兼容 API 提供商实现
import { BaseLLMProvider, type ChatCompletionOptions } from './base'
import type { LLMModel } from '../models'

export class OpenAICompatibleProvider extends BaseLLMProvider {
  id = 'openai-compatible'
  name = 'OpenAI 兼容'
  type = 'openai-compatible' as const
  private manualModels: LLMModel[] = []

  constructor(config?: { 
    apiKey?: string; 
    baseUrl?: string; 
    name?: string;
    models?: LLMModel[]
  }) {
    super({
      apiKey: config?.apiKey,
      baseUrl: config?.baseUrl || 'http://localhost:8000/v1'
    })
    
    if (config?.name) {
      this.name = config.name
    }
    
    if (config?.models) {
      this.manualModels = config.models
    }
  }

  isConfigured(): boolean {
    return !!this.baseUrl
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.apiKey ? {
          'Authorization': `Bearer ${this.apiKey}`
        } : {},
        // 添加超时
        signal: AbortSignal.timeout(10000) // 10秒超时
      })
      
      // 检查响应状态和内容类型
      if (response.ok) {
        const contentType = response.headers.get('content-type')
        return contentType?.includes('application/json') || false
      }
      
      // 对于认证错误，静默返回false而不是抛出错误
      if (response.status === 401) {
        console.warn(`OpenAI兼容服务认证失败 (${this.baseUrl}): API密钥无效或缺失`)
        return false
      }
      
      // 其他HTTP错误也返回false
      console.warn(`OpenAI兼容服务不可用 (${this.baseUrl}): HTTP ${response.status}`)
      return false
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        console.warn(`OpenAI兼容服务连接超时 (${this.baseUrl})`)
      } else {
        console.warn(`OpenAI兼容服务连接失败 (${this.baseUrl}):`, error)
      }
      return false
    }
  }

  async getModels(): Promise<LLMModel[]> {
    if (!this.isConfigured()) return this.manualModels

    // 如果有手动配置的模型，优先返回手动配置的
    if (this.manualModels.length > 0) {
      return this.manualModels
    }

    // 尝试自动发现模型
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.apiKey ? {
          'Authorization': `Bearer ${this.apiKey}`
        } : {},
        signal: AbortSignal.timeout(10000) // 10秒超时
      })

      if (!response.ok) {
        console.warn(`无法自动发现模型 (HTTP ${response.status}), 请手动配置模型`)
        return []
      }

      // 检查Content-Type
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        console.warn(`模型发现端点返回非JSON响应 (Content-Type: ${contentType}), 请手动配置模型`)
        return []
      }

      const data = await response.json()
      
      // 检查响应格式
      if (!data.data || !Array.isArray(data.data)) {
        console.warn('模型发现端点响应格式不正确，请手动配置模型')
        return []
      }
      
      const discoveredModels = data.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.description || `${model.id} model`,
        contextLength: model.context_length || 4096
      }))

      console.log(`自动发现 ${discoveredModels.length} 个模型`)
      return discoveredModels
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        console.warn('模型发现请求超时，请手动配置模型')
      } else {
        console.warn('自动发现模型失败，请手动配置:', error)
      }
      return []
    }
  }

  async chat(options: ChatCompletionOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI-compatible API base URL not configured')
    }

    const { model, messages, settings, onStream, signal } = options

    const requestBody = {
      model,
      messages: this.formatMessages(messages),
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      top_p: settings.topP,
      frequency_penalty: settings.frequencyPenalty,
      presence_penalty: settings.presencePenalty,
      stream: !!onStream
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const contentType = response.headers.get('content-type')
      let errorMessage = `HTTP ${response.status} ${response.statusText}`
      
      try {
        if (contentType?.includes('application/json')) {
          const errorData = await response.json()
          errorMessage = errorData.error?.message || errorData.message || errorMessage
        } else {
          const errorText = await response.text()
          // 如果返回的是HTML页面，提取有用信息
          if (errorText.includes('<!doctype') || errorText.includes('<html')) {
            errorMessage = `服务器返回HTML页面而不是JSON响应。请检查：
1. API端点URL是否正确 (当前: ${this.baseUrl}/chat/completions)
2. 服务是否正在运行
3. API密钥是否正确配置`
          } else {
            errorMessage = errorText.slice(0, 200) // 限制错误信息长度
          }
        }
      } catch (parseError) {
        errorMessage = `无法解析错误响应: ${response.status} ${response.statusText}`
      }
      
      throw new Error(errorMessage)
    }

    // 检查响应的Content-Type
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      throw new Error(`服务器返回了非JSON响应 (Content-Type: ${contentType})。请检查API端点是否正确。`)
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream)
    } else {
      try {
        const data = await response.json()
        
        // 检查响应格式是否符合OpenAI API标准
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          throw new Error(`API响应格式不正确。期望包含choices数组，实际收到: ${JSON.stringify(data).slice(0, 200)}`)
        }
        
        return data.choices[0]?.message?.content || ''
      } catch (jsonError) {
        if (jsonError instanceof SyntaxError) {
          throw new Error(`无法解析JSON响应。服务器可能返回了HTML页面或其他非JSON内容。`)
        }
        throw jsonError
      }
    }
  }

  protected extractContentFromResponse(response: any): string {
    return response.choices?.[0]?.delta?.content || ''
  }

  // 重写配置更新方法以支持自定义名称和模型
  updateConfig(config: { 
    apiKey?: string; 
    baseUrl?: string; 
    name?: string;
    models?: LLMModel[]
  }) {
    super.updateConfig(config)
    if (config.name) {
      this.name = config.name
    }
    if (config.models) {
      this.manualModels = config.models
    }
  }

  getConfig() {
    return {
      ...super.getConfig(),
      name: this.name,
      models: this.manualModels
    }
  }

  // 添加手动模型管理方法
  addManualModel(model: { id: string; name?: string; description?: string; contextLength?: number }) {
    const newModel: LLMModel = {
      id: model.id,
      name: model.name || model.id,
      description: model.description || `${model.id} model`,
      contextLength: model.contextLength || 4096
    }
    
    // 检查是否已存在
    const exists = this.manualModels.find(m => m.id === model.id)
    if (!exists) {
      this.manualModels.push(newModel)
    }
  }

  removeManualModel(modelId: string) {
    this.manualModels = this.manualModels.filter(m => m.id !== modelId)
  }

  getManualModels(): LLMModel[] {
    return [...this.manualModels]
  }
}