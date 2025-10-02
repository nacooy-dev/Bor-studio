// 基于 Chatbot UI 的基础提供商接口
import type { LLMModel, LLMProvider, ChatMessage, ChatSettings } from '../models'

export interface StreamResponse {
  content: string
  done: boolean
  model?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface ChatCompletionOptions {
  model: string
  messages: ChatMessage[]
  settings: ChatSettings
  onStream?: (response: StreamResponse) => void
  signal?: AbortSignal
}

export abstract class BaseLLMProvider {
  abstract id: string
  abstract name: string
  abstract type: LLMProvider['type']
  
  protected apiKey?: string
  protected baseUrl?: string
  
  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey
    this.baseUrl = config?.baseUrl
  }

  // 抽象方法 - 子类必须实现
  abstract isConfigured(): boolean
  abstract isAvailable(): Promise<boolean>
  abstract getModels(): Promise<LLMModel[]>
  abstract chat(options: ChatCompletionOptions): Promise<string>
  
  // 可选方法 - 子类可以重写
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const isAvailable = await this.isAvailable()
      return {
        success: isAvailable,
        message: isAvailable ? '连接成功' : '连接失败'
      }
    } catch (error) {
      return {
        success: false,
        message: `连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 工具方法
  protected formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }

  protected handleStreamResponse(
    response: Response,
    onStream?: (response: StreamResponse) => void
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (!response.body) {
        reject(new Error('No response body'))
        return
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
              
              if (data === '[DONE]') {
                onStream?.({ content: '', done: true })
                resolve(fullContent)
                return
              }

              try {
                const parsed = JSON.parse(data)
                const content = this.extractContentFromResponse(parsed)
                
                if (content) {
                  fullContent += content
                  onStream?.({ content, done: false })
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }

        resolve(fullContent)
      } catch (error) {
        reject(error)
      }
    })
  }

  // 子类需要重写此方法来提取内容
  protected extractContentFromResponse(response: any): string {
    return response.choices?.[0]?.delta?.content || ''
  }

  // 配置管理
  updateConfig(config: { apiKey?: string; baseUrl?: string }) {
    if (config.apiKey !== undefined) {
      this.apiKey = config.apiKey
    }
    if (config.baseUrl !== undefined) {
      this.baseUrl = config.baseUrl
    }
  }

  getConfig() {
    return {
      apiKey: this.apiKey ? '***' + this.apiKey.slice(-4) : undefined,
      baseUrl: this.baseUrl
    }
  }
}