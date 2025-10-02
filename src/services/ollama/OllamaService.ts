import type { Message } from '@/types'

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
}

export interface OllamaResponse {
  model: string
  created_at: string
  response?: string // Legacy format
  message?: {       // New format
    role: string
    content: string
  }
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface ChatRequest {
  model: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
  }
}

export class OllamaService {
  private baseURL: string
  private defaultModel: string

  constructor(baseURL: string = 'http://localhost:11434', defaultModel: string = 'llama2') {
    this.baseURL = baseURL
    this.defaultModel = defaultModel
  }

  // 检查 Ollama 服务状态
  async checkStatus(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3秒超时
      
      const response = await fetch(`${this.baseURL}/api/tags`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      // 静默处理错误，不在控制台输出
      return false
    }
  }

  // 获取可用模型列表
  async getModels(): Promise<OllamaModel[]> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
      
      const response = await fetch(`${this.baseURL}/api/tags`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        return []
      }
      
      const data = await response.json()
      return data.models || []
    } catch (error) {
      // 静默处理错误
      return []
    }
  }

  // 检查模型是否可用
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const models = await this.getModels()
      return models.some(model => model.name === modelName)
    } catch (error) {
      return false
    }
  }

  // 拉取模型
  async pullModel(modelName: string, onProgress?: (progress: string) => void): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.status && onProgress) {
              onProgress(data.status)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      console.error('拉取模型失败:', error)
      throw error
    }
  }

  // 发送聊天请求
  async chat(
    messages: Message[],
    model?: string,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const modelName = model || this.defaultModel

    // 如果没有指定模型，尝试获取第一个可用模型
    if (!modelName) {
      const availableModels = await this.getModels()
      if (availableModels.length === 0) {
        throw new Error('没有可用的模型。请先拉取一个模型，例如：ollama pull llama2')
      }
      const firstModel = availableModels[0].name
      return this.chat(messages, firstModel, onStream)
    }

    // 检查模型是否可用
    if (!(await this.isModelAvailable(modelName))) {
      throw new Error(`模型 ${modelName} 不可用。请先拉取模型：ollama pull ${modelName}`)
    }

    const chatRequest: ChatRequest = {
      model: modelName,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: !!onStream,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
    }

    try {
      console.log('发送 Ollama 请求:', {
        url: `${this.baseURL}/api/chat`,
        model: modelName,
        messageCount: messages.length,
        stream: !!onStream,
        requestBody: JSON.stringify(chatRequest, null, 2)
      })

      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatRequest),
      })

      console.log('Ollama 响应状态:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Ollama 错误响应:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }

      if (onStream) {
        console.log('开始处理流式响应...')
        return await this.handleStreamResponse(response, onStream)
      } else {
        console.log('开始处理普通响应...')
        return await this.handleResponse(response)
      }
    } catch (error) {
      console.error('聊天请求失败:', error)
      throw error
    }
  }

  // 处理流式响应
  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<string> {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    let fullResponse = ''
    let buffer = '' // 用于处理不完整的 JSON 行

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('流式响应结束，总长度:', fullResponse.length)
          
          // 处理缓冲区中剩余的数据
          if (buffer.trim()) {
            try {
              const data: any = JSON.parse(buffer.trim())
              const content = data.message?.content || data.response
              console.log('处理缓冲区数据:', { content, done: data.done })
              if (content) {
                fullResponse += content
                onStream(content)
              }
            } catch (e) {
              console.log('缓冲区 JSON 解析失败:', buffer, e)
            }
          }
          
          break
        }

        const chunk = new TextDecoder().decode(value)
        // console.log('收到原始数据块，长度:', chunk.length)
        
        // 将新数据添加到缓冲区
        buffer += chunk
        
        // 按行分割，保留最后一个可能不完整的行
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后一行（可能不完整）

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue
          
          try {
            const data: any = JSON.parse(trimmedLine)
            
            // 处理新的响应格式 (message.content) 和旧的响应格式 (response)
            const content = data.message?.content || data.response
            
            // console.log('解析响应:', { hasContent: !!content, contentLength: content?.length || 0, done: data.done })
            
            if (content) {
              fullResponse += content
              console.log('流式响应:', content)
              onStream(content)
            }
            
            if (data.done) {
              console.log('响应完成标志收到，返回完整响应，总长度:', fullResponse.length)
              return fullResponse
            }
          } catch (e) {
            console.log('JSON 解析失败，行内容:', trimmedLine.substring(0, 100), '错误:', e.message)
            // 忽略解析错误，继续处理下一行
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    console.log('返回完整响应，最终长度:', fullResponse.length)
    return fullResponse
  }

  // 处理普通响应
  private async handleResponse(response: Response): Promise<string> {
    const data: OllamaResponse = await response.json()
    return data.message?.content || data.response || ''
  }

  // 生成嵌入向量
  async generateEmbedding(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data.embedding || []
    } catch (error) {
      console.error('生成嵌入向量失败:', error)
      throw error
    }
  }

  // 获取模型信息
  async getModelInfo(modelName: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('获取模型信息失败:', error)
      throw error
    }
  }
}