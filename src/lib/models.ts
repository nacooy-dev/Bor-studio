// 基于 Chatbot UI 的模型定义
export interface LLMModel {
  id: string
  name: string
  description?: string
  contextLength?: number
  pricing?: {
    prompt?: number
    completion?: number
    input?: number
    output?: number
  }
}

export interface LLMProvider {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'google' | 'ollama' | 'openrouter' | 'gemini' | 'zhipu' | 'openai-compatible' | 'custom'
  baseUrl?: string
  apiKey?: string
  models: LLMModel[]
  isConfigured: boolean
  isAvailable: boolean
}

export interface ModelCapability {
  type: 'text' | 'vision' | 'function_calling' | 'streaming' | 'embeddings'
  supported: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  model?: string
  provider?: string
  metadata?: Record<string, any>
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  model: string
  provider: string
  createdAt: number
  updatedAt: number
  settings: ChatSettings
}

export interface ChatSettings {
  temperature: number
  maxTokens: number
  topP: number
  topK?: number
  frequencyPenalty: number
  presencePenalty: number
  systemPrompt?: string
}

// 预定义的模型配置（基于 Chatbot UI 的模型列表）
export const DEFAULT_MODELS: Record<string, LLMModel[]> = {
  openai: [
    {
      id: 'gpt-4-turbo-preview',
      name: 'GPT-4 Turbo',
      description: 'Most capable GPT-4 model with improved instruction following',
      provider: {} as LLMProvider,
      maxTokens: 128000,
      pricing: { input: 0.01, output: 0.03 },
      capabilities: [
        { type: 'text', supported: true },
        { type: 'vision', supported: true },
        { type: 'function_calling', supported: true },
        { type: 'streaming', supported: true }
      ]
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'More capable than any GPT-3.5 model',
      provider: {} as LLMProvider,
      maxTokens: 8192,
      pricing: { input: 0.03, output: 0.06 },
      capabilities: [
        { type: 'text', supported: true },
        { type: 'function_calling', supported: true },
        { type: 'streaming', supported: true }
      ]
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and cost-effective model for most tasks',
      provider: {} as LLMProvider,
      maxTokens: 16385,
      pricing: { input: 0.0015, output: 0.002 },
      capabilities: [
        { type: 'text', supported: true },
        { type: 'function_calling', supported: true },
        { type: 'streaming', supported: true }
      ]
    }
  ],
  anthropic: [
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      description: 'Most powerful model for highly complex tasks',
      provider: {} as LLMProvider,
      maxTokens: 200000,
      pricing: { input: 0.015, output: 0.075 },
      capabilities: [
        { type: 'text', supported: true },
        { type: 'vision', supported: true },
        { type: 'streaming', supported: true }
      ]
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      description: 'Balance of intelligence and speed',
      provider: {} as LLMProvider,
      maxTokens: 200000,
      pricing: { input: 0.003, output: 0.015 },
      capabilities: [
        { type: 'text', supported: true },
        { type: 'vision', supported: true },
        { type: 'streaming', supported: true }
      ]
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      description: 'Fastest and most compact model',
      provider: {} as LLMProvider,
      maxTokens: 200000,
      pricing: { input: 0.00025, output: 0.00125 },
      capabilities: [
        { type: 'text', supported: true },
        { type: 'vision', supported: true },
        { type: 'streaming', supported: true }
      ]
    }
  ],
  google: [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Most capable Gemini model with 1M token context',
      provider: {} as LLMProvider,
      maxTokens: 1000000,
      capabilities: [
        { type: 'text', supported: true },
        { type: 'vision', supported: true },
        { type: 'streaming', supported: true }
      ]
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and efficient model for most tasks',
      provider: {} as LLMProvider,
      maxTokens: 1000000,
      capabilities: [
        { type: 'text', supported: true },
        { type: 'vision', supported: true },
        { type: 'streaming', supported: true }
      ]
    }
  ],
  ollama: [] // 动态获取
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  temperature: 0.7,
  maxTokens: 4000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0
}