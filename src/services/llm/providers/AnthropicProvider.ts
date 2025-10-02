import type { LLMProvider } from '../LLMManager'
import type { Message } from '@/types'

export interface AnthropicConfig {
  apiKey: string
  baseURL?: string
  defaultModel?: string
}

export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic'
  type = 'anthropic' as const
  private config: AnthropicConfig
  private availableModels: string[] = []

  constructor(config: AnthropicConfig) {
    this.config = config
    this.initializeModels()
  }

  private initializeModels() {
    // Anthropic Claude 模型列表
    this.availableModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ]
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false
    }

    try {
      // 使用一个简单的请求来测试连接
      const response = await fetch(`${this.config.baseURL || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      })
      
      // 即使返回错误，只要不是认证错误就说明连接正常
      return response.status !== 401 && response.status !== 403
    } catch (error) {
      console.error('Anthropic 连接检查失败:', error)
      return false
    }
  }

  async getModels(): Promise<string[]> {
    // Anthropic API 目前不提供模型列表端点，返回预定义的模型
    return this.availableModels
  }

  async chat(
    messages: Message[],
    model?: string,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API 密钥未配置')
    }

    const modelName = model || this.config.defaultModel || 'claude-3-haiku-20240307'
    const isStreaming = !!onStream

    // 转换消息格式，Anthropic 不支持 system 角色在 messages 中
    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))

    // 提取系统消息
    const systemMessage = messages.find(msg => msg.role === 'system')?.content

    const requestBody: any = {
      model: modelName,
      max_tokens: 2000,
      messages: anthropicMessages,
      stream: isStreaming
    }

    if (systemMessage) {
      requestBody.system = systemMessage
    }

    try {
      const response = await fetch(`${this.config.baseURL || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Anthropic API 错误: ${errorData.error?.message || response.statusText}`)
      }

      if (isStreaming) {
        return await this.handleStreamResponse(response, onStream!)
      } else {
        return await this.handleResponse(response)
      }
    } catch (error) {
      console.error('Anthropic 聊天请求失败:', error)
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
            
            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text
                if (content) {
                  fullResponse += content
                  onStream(content)
                }
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
    return data.content?.[0]?.text || ''
  }

  // 测试连接
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const isAvailable = await this.isAvailable()
      if (isAvailable) {
        return {
          success: true,
          message: '连接成功！Claude 模型可用'
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
  updateConfig(config: Partial<AnthropicConfig>) {
    this.config = { ...this.config, ...config }
  }

  // 获取配置
  getConfig(): AnthropicConfig {
    return { ...this.config }
  }
}