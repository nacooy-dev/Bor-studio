// 智谱 AI 提供商实现
import { BaseLLMProvider, type ChatCompletionOptions } from './base'
import type { LLMModel } from '../models'

export class ZhipuProvider extends BaseLLMProvider {
  id = 'zhipu'
  name = '智谱 AI'
  type = 'zhipu' as const

  constructor(config?: { apiKey?: string }) {
    super({
      apiKey: config?.apiKey,
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
    })
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      // 智谱 AI 没有专门的模型列表接口，我们通过一个简单的请求来测试连接
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'glm-4',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      })
      
      // 即使返回错误，只要不是认证错误就说明连接正常
      return response.status !== 401 && response.status !== 403
    } catch {
      return false
    }
  }

  async getModels(): Promise<LLMModel[]> {
    // 智谱 AI 的预定义模型列表
    return [
      {
        id: 'glm-4',
        name: 'GLM-4',
        description: '智谱 AI 最新一代大语言模型',
        contextLength: 128000
      },
      {
        id: 'glm-4v',
        name: 'GLM-4V',
        description: '智谱 AI 多模态大语言模型',
        contextLength: 8192
      },
      {
        id: 'glm-3-turbo',
        name: 'GLM-3-Turbo',
        description: '智谱 AI 高效对话模型',
        contextLength: 128000
      }
    ]
  }

  async chat(options: ChatCompletionOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('智谱 AI API key not configured')
    }

    const { model, messages, settings, onStream, signal } = options

    const requestBody = {
      model,
      messages: this.formatMessages(messages),
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      top_p: settings.topP,
      stream: !!onStream
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`智谱 AI API error: ${error}`)
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream)
    } else {
      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    }
  }

  protected extractContentFromResponse(response: any): string {
    return response.choices?.[0]?.delta?.content || ''
  }
}