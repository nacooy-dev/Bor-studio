import type { LLMProvider } from '../LLMManager'
import type { Message } from '@/types'

export interface GeminiConfig {
  apiKey: string
  baseURL?: string
  defaultModel?: string
}

export class GeminiProvider implements LLMProvider {
  name = 'Google Gemini'
  type = 'gemini' as const
  private config: GeminiConfig
  private availableModels: string[] = []

  constructor(config: GeminiConfig) {
    this.config = config
    this.initializeModels()
  }

  private initializeModels() {
    // Google Gemini 模型列表
    this.availableModels = [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro'
    ]
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false
    }

    try {
      const response = await fetch(
        `${this.config.baseURL || 'https://generativelanguage.googleapis.com'}/v1beta/models?key=${this.config.apiKey}`
      )
      
      return response.ok
    } catch (error) {
      console.error('Gemini 连接检查失败:', error)
      return false
    }
  }

  async getModels(): Promise<string[]> {
    if (!this.config.apiKey) {
      return this.availableModels
    }

    try {
      const response = await fetch(
        `${this.config.baseURL || 'https://generativelanguage.googleapis.com'}/v1beta/models?key=${this.config.apiKey}`
      )

      if (response.ok) {
        const data = await response.json()
        const models = data.models
          ?.filter((model: any) => model.name.includes('gemini') && model.supportedGenerationMethods?.includes('generateContent'))
          ?.map((model: any) => model.name.replace('models/', ''))
          ?.sort()
        
        if (models && models.length > 0) {
          this.availableModels = models
        }
      }
    } catch (error) {
      console.error('获取 Gemini 模型列表失败:', error)
    }

    return this.availableModels
  }

  async chat(
    messages: Message[],
    model?: string,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Gemini API 密钥未配置')
    }

    const modelName = model || this.config.defaultModel || 'gemini-1.5-flash'
    const isStreaming = !!onStream

    // 转换消息格式为 Gemini 格式
    const geminiMessages = this.convertMessagesToGeminiFormat(messages)

    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    }

    const endpoint = isStreaming ? 'streamGenerateContent' : 'generateContent'
    const url = `${this.config.baseURL || 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelName}:${endpoint}?key=${this.config.apiKey}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Gemini API 错误: ${errorData.error?.message || response.statusText}`)
      }

      if (isStreaming) {
        return await this.handleStreamResponse(response, onStream!)
      } else {
        return await this.handleResponse(response)
      }
    } catch (error) {
      console.error('Gemini 聊天请求失败:', error)
      throw error
    }
  }

  private convertMessagesToGeminiFormat(messages: Message[]) {
    const contents = []
    let currentRole = ''
    let currentParts: any[] = []

    for (const message of messages) {
      if (message.role === 'system') {
        // 系统消息转换为用户消息
        if (currentRole && currentParts.length > 0) {
          contents.push({ role: currentRole, parts: currentParts })
          currentParts = []
        }
        currentRole = 'user'
        currentParts.push({ text: `System: ${message.content}` })
      } else {
        const geminiRole = message.role === 'assistant' ? 'model' : 'user'
        
        if (currentRole !== geminiRole) {
          if (currentRole && currentParts.length > 0) {
            contents.push({ role: currentRole, parts: currentParts })
          }
          currentRole = geminiRole
          currentParts = []
        }
        
        currentParts.push({ text: message.content })
      }
    }

    if (currentRole && currentParts.length > 0) {
      contents.push({ role: currentRole, parts: currentParts })
    }

    return contents
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
          try {
            const parsed = JSON.parse(line)
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text
            
            if (content) {
              fullResponse += content
              onStream(content)
            }
          } catch (e) {
            // 忽略解析错误
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
  updateConfig(config: Partial<GeminiConfig>) {
    this.config = { ...this.config, ...config }
  }

  // 获取配置
  getConfig(): GeminiConfig {
    return { ...this.config }
  }
}