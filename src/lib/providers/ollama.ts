// 基于 Chatbot UI 的 Ollama 提供商实现
import { BaseLLMProvider, type ChatCompletionOptions } from './base'
import type { LLMModel } from '../models'

interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
}

export class OllamaProvider extends BaseLLMProvider {
  id = 'ollama'
  name = 'Ollama'
  type = 'ollama' as const

  constructor(config?: { baseUrl?: string }) {
    super(config)
    this.baseUrl = config?.baseUrl || 'http://localhost:11434'
  }

  isConfigured(): boolean {
    return true // Ollama 不需要 API 密钥
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  async getModels(): Promise<LLMModel[]> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) return []
      
      const data = await response.json()
      const models: OllamaModel[] = data.models || []
      
      return models
        .filter(model => !model.name.toLowerCase().includes('embed')) // 过滤嵌入模型
        .map(model => ({
          id: model.name,
          name: this.formatModelName(model.name),
          description: `本地模型 - ${this.formatFileSize(model.size)}`,
          provider: { id: this.id, name: this.name, type: this.type } as any,
          maxTokens: this.estimateMaxTokens(model.name),
          capabilities: [
            { type: 'text', supported: true },
            { type: 'streaming', supported: true }
          ]
        }))
    } catch {
      return []
    }
  }

  async chat(options: ChatCompletionOptions): Promise<string> {
    const { model, messages, settings, onStream, signal } = options

    const requestBody = {
      model,
      messages: this.formatMessages(messages),
      stream: !!onStream,
      options: {
        temperature: settings.temperature,
        top_p: settings.topP,
        num_predict: settings.maxTokens
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      if (onStream) {
        return this.handleOllamaStreamResponse(response, onStream)
      } else {
        const data = await response.json()
        return data.message?.content || data.response || ''
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
      throw new Error(`Ollama API error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async handleOllamaStreamResponse(
    response: Response,
    onStream: (response: any) => void
  ): Promise<string> {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          // 处理缓冲区中剩余的数据
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer.trim())
              const content = data.message?.content || data.response || ''
              if (content) {
                fullContent += content
                onStream({ content, done: data.done || false })
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
          break
        }

        const chunk = decoder.decode(value)
        buffer += chunk
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue
          
          try {
            const data = JSON.parse(trimmedLine)
            const content = data.message?.content || data.response || ''
            
            if (content) {
              fullContent += content
              onStream({ content, done: data.done || false })
            }
            
            if (data.done) {
              return fullContent
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      return fullContent
    } finally {
      reader.releaseLock()
    }
  }

  private formatModelName(modelName: string): string {
    // 移除版本标签，格式化显示名称
    const baseName = modelName.split(':')[0]
    const nameMap: Record<string, string> = {
      'llama2': 'Llama 2',
      'llama3': 'Llama 3',
      'codellama': 'Code Llama',
      'mistral': 'Mistral',
      'qwen': 'Qwen',
      'gemma': 'Gemma',
      'phi': 'Phi',
      'deepseek-coder': 'DeepSeek Coder'
    }
    
    return nameMap[baseName] || modelName
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  private estimateMaxTokens(modelName: string): number {
    // 根据模型名称估算最大 token 数
    if (modelName.includes('32k')) return 32768
    if (modelName.includes('16k')) return 16384
    if (modelName.includes('8k')) return 8192
    if (modelName.includes('4k')) return 4096
    
    // 默认估算
    if (modelName.includes('7b')) return 4096
    if (modelName.includes('13b')) return 4096
    if (modelName.includes('70b')) return 4096
    
    return 2048 // 保守估算
  }

  // Ollama 特有的方法
  async pullModel(modelName: string, onProgress?: (progress: string) => void): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
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
  }

  async deleteModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  }
}