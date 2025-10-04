// OpenRouter 提供商实现
import { BaseLLMProvider, type ChatCompletionOptions, type StreamResponse } from './base'
import type { LLMModel } from '../models'

export class OpenRouterProvider extends BaseLLMProvider {
  id = 'openrouter'
  name = 'OpenRouter'
  type = 'openrouter' as const

  constructor(config?: { apiKey?: string }) {
    super({
      apiKey: config?.apiKey,
      baseUrl: 'https://openrouter.ai/api/v1'
    })
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://bor-intelligent-agent-hub.com',
          'X-Title': 'Bor Intelligent Agent Hub'
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  async getModels(): Promise<LLMModel[]> {
    if (!this.isConfigured()) return []

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://bor-intelligent-agent-hub.com',
          'X-Title': 'Bor Intelligent Agent Hub'
        }
      })

      if (!response.ok) return []

      const data = await response.json()
      
      return data.data?.map((model: any) => {
        // 优化模型名称显示，只显示关键部分
        let displayName = model.name || model.id
        // 如果名称过长，尝试简化
        if (displayName.length > 50) {
          // 对于OpenRouter的模型，通常格式为 "provider/model-name"
          const parts = model.id.split('/')
          if (parts.length === 2) {
            displayName = `${parts[0]}/${parts[1].length > 30 ? parts[1].substring(0, 30) + '...' : parts[1]}`
          } else if (model.id.length > 50) {
            displayName = model.id.substring(0, 50) + '...'
          }
        }
        
        return {
          id: model.id,
          name: displayName,
          description: model.description,
          contextLength: model.context_length || 4096,
          pricing: {
            prompt: model.pricing?.prompt,
            completion: model.pricing?.completion
          }
        }
      }) || []
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error)
      return []
    }
  }

  async chat(options: ChatCompletionOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter API key not configured')
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://bor-intelligent-agent-hub.com',
        'X-Title': 'Bor Intelligent Agent Hub'
      },
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${error}`)
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