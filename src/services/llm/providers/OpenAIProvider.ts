import type { LLMProvider } from '../LLMManager'
import type { Message } from '@/types'

export interface OpenAIConfig {
  apiKey: string
  baseURL?: string
  organization?: string
  defaultModel?: string
}

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI'
  type = 'openai' as const
  private config: OpenAIConfig
  private availableModels: string[] = []

  constructor(config: OpenAIConfig) {
    this.config = config
    this.initializeModels()
  }

  private initializeModels() {
    // OpenAI 常用模型列表
    this.availableModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ]
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false
    }

    try {
      const response = await fetch(`${this.config.baseURL || 'https://api.openai.com'}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organization && { 'OpenAI-Organization': this.config.organization })
        }
      })
      
      return response.ok
    } catch (error) {
      console.error('OpenAI 连接检查失败:', error)
      return false
    }
  }

  async getModels(): Promise<string[]> {
    if (!this.config.apiKey) {
      return this.availableModels
    }

    try {
      const response = await fetch(`${this.config.baseURL || 'https://api.openai.com'}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organization && { 'OpenAI-Organization': this.config.organization })
        }
      })

      if (response.ok) {
        const data = await response.json()
        const models = data.data
          .filter((model: any) => model.id.includes('gpt'))
          .map((model: any) => model.id)
          .sort()
        
        this.availableModels = models.length > 0 ? models : this.availableModels
      }
    } catch (error) {
      console.error('获取 OpenAI 模型列表失败:', error)
    }

    return this.availableModels
  }

  async chat(
    messages: Message[],
    model?: string,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API 密钥未配置')
    }

    const modelName = model || this.config.defaultModel || 'gpt-3.5-turbo'
    const isStreaming = !!onStream

    const requestBody = {
      model: modelName,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: isStreaming,
      temperature: 0.7,
      max_tokens: 2000
    }

    try {
      const response = await fetch(`${this.config.baseURL || 'https://api.openai.com'}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organization && { 'OpenAI-Organization': this.config.organization })
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`OpenAI API 错误: ${errorData.error?.message || response.statusText}`)
      }

      if (isStreaming) {
        return await this.handleStreamResponse(response, onStream!)
      } else {
        return await this.handleResponse(response)
      }
    } catch (error) {
      console.error('OpenAI 聊天请求失败:', error)
      throw error
    }
  }

  private async handleStreamResponse(response: Response, onStream: (chunk: string) => void): Promise<string> {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    let fullResponse = ''
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              return fullResponse
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              
              if (content) {
                fullResponse += content
                onStream(content)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullResponse
  }

  private async handleResponse(response: Response): Promise<string> {
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  // 测试连接
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const isAvailable = await this.isAvailable()
      if (isAvailable) {
        const models = await this.getModels()
        return {
          success: true,
          message: `连接成功！发现 ${models.length} 个可用模型`
        }
      } else {
        return {
          success: false,
          message: 'API 密钥无效或网络连接失败'
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `连接失败: ${error.message}`
      }
    }
  }

  // 更新配置
  updateConfig(config: Partial<OpenAIConfig>) {
    this.config = { ...this.config, ...config }
  }

  // 获取配置
  getConfig(): OpenAIConfig {
    return { ...this.config }
  }
}