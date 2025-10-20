/**
 * 渲染引擎工具函数
 */

import { ContentType, ContentTypeDetector, ContentValidator } from './types'
import { CONTENT_DETECTION_PATTERNS, CONTENT_SIZE_LIMITS } from './constants'

/**
 * 内容类型检测器
 */
export const detectContentType: ContentTypeDetector = (content: string): ContentType | null => {
  if (!content || content.trim().length === 0) {
    return null
  }

  const trimmedContent = content.trim()

  // 按优先级检测内容类型
  for (const [type, patterns] of Object.entries(CONTENT_DETECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trimmedContent)) {
        return type as ContentType
      }
    }
  }

  // 默认返回文本类型
  return ContentType.TEXT
}

/**
 * 快速内容类型检测（仅检查前100字符）
 */
export const quickDetectContentType = (content: string): { type: ContentType; confidence: number } => {
  if (!content || content.trim().length === 0) {
    return { type: ContentType.TEXT, confidence: 0 }
  }

  const prefix = content.slice(0, CONTENT_SIZE_LIMITS.QUICK_DETECT_LENGTH)
  const detectedType = detectContentType(prefix)

  if (!detectedType) {
    return { type: ContentType.TEXT, confidence: 0.5 }
  }

  // 计算置信度
  let confidence = 0.8 // 基础置信度

  // 根据匹配的模式数量调整置信度
  const patterns = CONTENT_DETECTION_PATTERNS[detectedType] || []
  const matchCount = patterns.filter(pattern => pattern.test(prefix)).length
  confidence = Math.min(0.95, 0.6 + (matchCount * 0.1))

  return { type: detectedType, confidence }
}

/**
 * 内容验证器
 */
export const validateContent: ContentValidator = (content: string, type: ContentType): boolean => {
  if (!content || content.trim().length === 0) {
    return false
  }

  const maxSize = getMaxContentSize(type)
  if (content.length > maxSize) {
    return false
  }

  const patterns = CONTENT_DETECTION_PATTERNS[type]
  if (!patterns) {
    return type === ContentType.TEXT // 文本类型总是有效的
  }

  return patterns.some(pattern => pattern.test(content))
}

/**
 * 获取内容类型的最大大小限制
 */
export const getMaxContentSize = (type: ContentType): number => {
  switch (type) {
    case ContentType.TEXT:
      return CONTENT_SIZE_LIMITS.TEXT_MAX_SIZE
    case ContentType.TABLE:
      return CONTENT_SIZE_LIMITS.TABLE_MAX_SIZE
    case ContentType.CODE:
      return CONTENT_SIZE_LIMITS.CODE_MAX_SIZE
    case ContentType.CHART:
      return CONTENT_SIZE_LIMITS.CHART_MAX_SIZE
    case ContentType.MATH:
      return CONTENT_SIZE_LIMITS.MATH_MAX_SIZE
    default:
      return CONTENT_SIZE_LIMITS.TEXT_MAX_SIZE
  }
}

/**
 * 检查内容是否为简单文本
 */
export const isSimpleText = (content: string): boolean => {
  if (!content || content.trim().length === 0) {
    return true
  }

  const trimmedContent = content.trim()

  // 检查是否包含特殊标记
  const hasSpecialMarkup = Object.values(CONTENT_DETECTION_PATTERNS)
    .flat()
    .some(pattern => pattern.test(trimmedContent))

  return !hasSpecialMarkup && trimmedContent.length < 1000
}

/**
 * 生成唯一ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 计算字符串哈希值
 */
export const hashString = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  return Math.abs(hash).toString(36)
}

/**
 * 深度克隆对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T
  }

  if (typeof obj === 'object') {
    const cloned = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }

  return obj
}

/**
 * 防抖函数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 异步延迟函数
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 安全的JSON解析
 */
export const safeJsonParse = <T = any>(str: string, defaultValue: T): T => {
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 格式化时间
 */
export const formatTime = (ms: number): string => {
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${(ms / 60000).toFixed(1)}m`
}

/**
 * 检查是否为移动设备
 */
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 768
}

/**
 * 检查是否支持Web Workers
 */
export const supportsWebWorkers = (): boolean => {
  return typeof Worker !== 'undefined'
}

/**
 * 检查是否支持IndexedDB
 */
export const supportsIndexedDB = (): boolean => {
  return typeof indexedDB !== 'undefined'
}

/**
 * 获取内存使用情况（如果支持）
 */
export const getMemoryUsage = (): number => {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    return (performance as any).memory.usedJSHeapSize
  }
  return 0
}

/**
 * 创建错误对象
 */
export const createError = (message: string, code: string, context?: Record<string, any>): Error => {
  const error = new Error(message)
  ;(error as any).code = code
  ;(error as any).context = context
  return error
}

/**
 * 安全执行函数
 */
export const safeExecute = async <T>(
  fn: () => T | Promise<T>,
  fallback: T,
  onError?: (error: Error) => void
): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
    return fallback
  }
}

/**
 * 批处理函数
 */
export const batch = <T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> => {
  const batches: T[][] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  return Promise.all(batches.map(processor)).then(results => results.flat())
}

/**
 * 重试函数
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxAttempts) {
        throw lastError
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }

  throw lastError!
}