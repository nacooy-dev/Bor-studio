// Google Gemini 提供商实现
import { BaseLLMProvider, type ChatCompletionOptions } from './base'
import type { LLMModel, ChatMessage } from '../models'

export class GeminiProvider extends BaseLLMProvider {
  id = 'gemini'
  name = 'Google Gemini'
  type = 'gemini' as const

  constructor(config?: { apiKey?: string }) {
    super({
      apiKey: config?.apiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
    })
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`)
      return response.ok
    } catch {
      return false
    }
  }

  async getModels(): Promise<LLMModel[]> {
    if (!this.isConfigured()) return []

    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`)
      
      if (!response.ok) return []

      const data = await response.json()
      
      return data.models?.filter((model: any) => 
        model.supportedGenerationMethods?.includes('generateContent')
      ).map((model: any) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name,
        description: model.description,
        contextLength: model.inputTokenLimit || 32768
      })) || []
    } catch (error) {
      console.error('Failed to fetch Gemini models:', error)
      return []
    }
  }

  async chat(options: ChatCompletionOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured')
    }

    const { model, messages, settings, onStream, signal } = options

    // 转换消息格式为 Gemini 格式
    const contents = this.formatMessagesForGemini(messages)

    const requestBody = {
      contents,
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens,
        topP: settings.topP,
        topK: settings.topK || 40
      }
    }

    const endpoint = onStream ? 'streamGenerateContent' : 'generateContent'
    const response = await fetch(
      `${this.baseUrl}/models/${model}:${endpoint}?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${error}`)
    }

    if (onStream) {
      return this.handleGeminiStream(response, options.onStream!)
    } else {
      const data = await response.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }
  }

  private formatMessagesForGemini(messages: ChatMessage[]) {
    const contents = []
    
    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini 没有 system role，将其转换为 user 消息
        contents.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }]
        })
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })
      }
    }
    
    return contents
  }

  private async handleGeminiStream(
    response: Response,
    onStream: (response: { content: string; done: boolean }) => void
  ): Promise<string> {
    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            try {
              const parsed = JSON.parse(data)
              const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
              
              if (content) {
                fullContent += content
                onStream({ content, done: false })
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      onStream({ content: '', done: true })
      return fullContent
    } catch (error) {
      throw error
    }
  }
}