// 基于 Chatbot UI 的 OpenAI 提供商实现
import { BaseLLMProvider, type ChatCompletionOptions } from './base'
import { DEFAULT_MODELS, type LLMModel } from '../models'

export class OpenAIProvider extends BaseLLMProvider {
  id = 'openai'
  name = 'OpenAI'
  type = 'openai' as const

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    super(config)
    this.baseUrl = config?.baseUrl || 'https://api.openai.com/v1'
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
          'Content-Type': 'application/json'
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
      // 首先尝试从 API 获取模型列表
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const apiModels = data.data
          .filter((model: any) => model.id.includes('gpt'))
          .map((model: any) => ({
            id: model.id,
            name: this.formatModelName(model.id),
            description: `OpenAI ${model.id}`,
            provider: { id: this.id, name: this.name, type: this.type } as any,
            maxTokens: this.getMaxTokens(model.id),
            capabilities: [
              { type: 'text', supported: true },
              { type: 'streaming', supported: true },
              { type: 'function_calling', supported: model.id.includes('gpt-4') || model.id.includes('gpt-3.5') }
            ]
          }))

        return apiModels.length > 0 ? apiModels : DEFAULT_MODELS.openai
      }
    } catch (error) {
      console.warn('Failed to fetch OpenAI models from API, using defaults:', error)
    }

    // 回退到默认模型列表
    return DEFAULT_MODELS.openai
  }

  async chat(options: ChatCompletionOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured')
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

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || `HTTP ${response.status}`)
      }

      if (onStream) {
        return this.handleStreamResponse(response, onStream)
      } else {
        const data = await response.json()
        return data.choices[0]?.message?.content || ''
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private formatModelName(modelId: string): string {
    const nameMap: Record<string, string> = {
      'gpt-4-turbo-preview': 'GPT-4 Turbo',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-4-32k': 'GPT-4 32K',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K'
    }
    return nameMap[modelId] || modelId
  }

  private getMaxTokens(modelId: string): number {
    const tokenMap: Record<string, number> = {
      'gpt-4-turbo-preview': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-16k': 16385
    }
    return tokenMap[modelId] || 4096
  }
}