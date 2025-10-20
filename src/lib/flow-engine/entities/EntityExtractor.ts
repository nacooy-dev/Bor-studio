/**
 * 实体提取器
 * 负责从用户输入中提取命名实体和参数
 */

export interface ExtractedEntity {
  type: string
  value: string
  normalizedValue?: any
  confidence: number
  startIndex: number
  endIndex: number
  metadata?: Record<string, any>
}

export interface EntityPattern {
  type: string
  pattern: RegExp
  normalizer?: (value: string) => any
  validator?: (value: string) => boolean
  confidence: number
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[]
  parameters: Record<string, any>
  confidence: number
}

/**
 * 实体提取器类
 */
export class EntityExtractor {
  private patterns: EntityPattern[] = []
  private customExtractors: Map<string, (text: string) => ExtractedEntity[]> = new Map()

  constructor() {
    this.initializeBuiltinPatterns()
  }

  /**
   * 从文本中提取实体
   */
  extractEntities(text: string): EntityExtractionResult {
    const entities: ExtractedEntity[] = []
    const parameters: Record<string, any> = {}

    // 使用正则模式提取
    for (const pattern of this.patterns) {
      const matches = this.extractWithPattern(text, pattern)
      entities.push(...matches)
    }

    // 使用自定义提取器
    for (const [type, extractor] of this.customExtractors.entries()) {
      try {
        const customEntities = extractor(text)
        entities.push(...customEntities)
      } catch (error) {
        console.warn(`自定义实体提取器 ${type} 执行失败:`, error)
      }
    }

    // 去重和排序
    const uniqueEntities = this.deduplicateEntities(entities)
    const sortedEntities = uniqueEntities.sort((a, b) => a.startIndex - b.startIndex)

    // 提取参数
    const extractedParameters = this.extractParameters(sortedEntities)

    // 计算整体置信度
    const overallConfidence = this.calculateOverallConfidence(sortedEntities)

    return {
      entities: sortedEntities,
      parameters: extractedParameters,
      confidence: overallConfidence
    }
  }

  /**
   * 注册自定义实体提取器
   */
  registerCustomExtractor(type: string, extractor: (text: string) => ExtractedEntity[]): void {
    this.customExtractors.set(type, extractor)
  }

  /**
   * 添加自定义模式
   */
  addPattern(pattern: EntityPattern): void {
    this.patterns.push(pattern)
  }

  /**
   * 验证实体值
   */
  validateEntity(entity: ExtractedEntity): boolean {
    const pattern = this.patterns.find(p => p.type === entity.type)
    if (pattern && pattern.validator) {
      return pattern.validator(entity.value)
    }
    return true
  }

  /**
   * 规范化实体值
   */
  normalizeEntity(entity: ExtractedEntity): ExtractedEntity {
    const pattern = this.patterns.find(p => p.type === entity.type)
    if (pattern && pattern.normalizer) {
      return {
        ...entity,
        normalizedValue: pattern.normalizer(entity.value)
      }
    }
    return entity
  }

  // 私有方法

  private initializeBuiltinPatterns(): void {
    // 数字实体
    this.patterns.push({
      type: 'number',
      pattern: /\b\d+(?:\.\d+)?\b/g,
      normalizer: (value: string) => parseFloat(value),
      validator: (value: string) => !isNaN(parseFloat(value)),
      confidence: 0.95
    })

    // 整数实体
    this.patterns.push({
      type: 'integer',
      pattern: /\b\d+\b/g,
      normalizer: (value: string) => parseInt(value, 10),
      validator: (value: string) => Number.isInteger(parseFloat(value)),
      confidence: 0.95
    })

    // 时间实体
    this.patterns.push({
      type: 'time',
      pattern: /\b(?:\d{1,2}:\d{2}(?::\d{2})?|\d{1,2}点(?:\d{1,2}分)?)\b/g,
      normalizer: this.normalizeTime,
      confidence: 0.9
    })

    // 日期实体
    this.patterns.push({
      type: 'date',
      pattern: /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|今天|明天|昨天|后天|前天)\b/g,
      normalizer: this.normalizeDate,
      confidence: 0.85
    })

    // 文件路径实体
    this.patterns.push({
      type: 'file_path',
      pattern: /(?:[a-zA-Z]:[\\\/][\w\s\\\/.-]+|\/[\w\s\/.-]+|\.\/[\w\s\/.-]+|\.\.\/[\w\s\/.-]+)/g,
      validator: (value: string) => value.length > 2,
      confidence: 0.8
    })

    // URL实体
    this.patterns.push({
      type: 'url',
      pattern: /https?:\/\/[^\s]+/g,
      validator: (value: string) => {
        try {
          new URL(value)
          return true
        } catch {
          return false
        }
      },
      confidence: 0.95
    })

    // 邮箱实体
    this.patterns.push({
      type: 'email',
      pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      validator: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      confidence: 0.9
    })

    // 电话号码实体
    this.patterns.push({
      type: 'phone',
      pattern: /\b(?:\+?86[-\s]?)?1[3-9]\d{9}\b/g,
      normalizer: (value: string) => value.replace(/[-\s]/g, ''),
      confidence: 0.85
    })

    // 模型名称实体
    this.patterns.push({
      type: 'model_name',
      pattern: /\b(?:llama|gpt|claude|qwen|mistral|deepseek|chatglm|baichuan)[\w-]*\b/gi,
      normalizer: (value: string) => value.toLowerCase(),
      confidence: 0.9
    })

    // 编程语言实体
    this.patterns.push({
      type: 'programming_language',
      pattern: /\b(?:javascript|python|java|typescript|c\+\+|c#|go|rust|php|ruby|swift|kotlin)\b/gi,
      normalizer: (value: string) => value.toLowerCase(),
      confidence: 0.85
    })

    // 颜色实体
    this.patterns.push({
      type: 'color',
      pattern: /\b(?:红色|绿色|蓝色|黄色|黑色|白色|灰色|紫色|橙色|粉色|red|green|blue|yellow|black|white|gray|purple|orange|pink)\b/gi,
      normalizer: (value: string) => this.normalizeColor(value),
      confidence: 0.8
    })

    // 货币实体
    this.patterns.push({
      type: 'currency',
      pattern: /\b(?:¥|￥|\$|€|£)\s*\d+(?:\.\d{2})?\b|\b\d+(?:\.\d{2})?\s*(?:元|美元|欧元|英镑|dollar|yuan)\b/gi,
      normalizer: this.normalizeCurrency,
      confidence: 0.9
    })

    // 百分比实体
    this.patterns.push({
      type: 'percentage',
      pattern: /\b\d+(?:\.\d+)?%\b/g,
      normalizer: (value: string) => parseFloat(value.replace('%', '')) / 100,
      confidence: 0.95
    })
  }

  private extractWithPattern(text: string, pattern: EntityPattern): ExtractedEntity[] {
    const entities: ExtractedEntity[] = []
    const matches = text.matchAll(pattern.pattern)

    for (const match of matches) {
      if (match.index !== undefined) {
        const value = match[0]
        
        // 验证实体值
        if (pattern.validator && !pattern.validator(value)) {
          continue
        }

        const entity: ExtractedEntity = {
          type: pattern.type,
          value,
          confidence: pattern.confidence,
          startIndex: match.index,
          endIndex: match.index + value.length
        }

        // 规范化值
        if (pattern.normalizer) {
          try {
            entity.normalizedValue = pattern.normalizer(value)
          } catch (error) {
            console.warn(`实体规范化失败 ${pattern.type}:`, error)
          }
        }

        entities.push(entity)
      }
    }

    return entities
  }

  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const unique: ExtractedEntity[] = []
    const seen = new Set<string>()

    for (const entity of entities) {
      const key = `${entity.type}:${entity.startIndex}:${entity.endIndex}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(entity)
      }
    }

    return unique
  }

  private extractParameters(entities: ExtractedEntity[]): Record<string, any> {
    const parameters: Record<string, any> = {}

    // 按类型分组实体
    const entityGroups = new Map<string, ExtractedEntity[]>()
    for (const entity of entities) {
      if (!entityGroups.has(entity.type)) {
        entityGroups.set(entity.type, [])
      }
      entityGroups.get(entity.type)!.push(entity)
    }

    // 为每种类型创建参数
    for (const [type, typeEntities] of entityGroups.entries()) {
      if (typeEntities.length === 1) {
        // 单个实体，直接使用值
        const entity = typeEntities[0]
        parameters[type] = entity.normalizedValue !== undefined ? entity.normalizedValue : entity.value
      } else {
        // 多个实体，使用数组
        parameters[type] = typeEntities.map(e => 
          e.normalizedValue !== undefined ? e.normalizedValue : e.value
        )
      }
    }

    return parameters
  }

  private calculateOverallConfidence(entities: ExtractedEntity[]): number {
    if (entities.length === 0) return 0

    const totalConfidence = entities.reduce((sum, entity) => sum + entity.confidence, 0)
    return totalConfidence / entities.length
  }

  // 规范化函数

  private normalizeTime = (value: string): { hour: number; minute: number; second?: number } => {
    if (value.includes('点')) {
      const match = value.match(/(\d{1,2})点(?:(\d{1,2})分)?/)
      if (match) {
        return {
          hour: parseInt(match[1], 10),
          minute: match[2] ? parseInt(match[2], 10) : 0
        }
      }
    } else {
      const parts = value.split(':')
      return {
        hour: parseInt(parts[0], 10),
        minute: parseInt(parts[1], 10),
        second: parts[2] ? parseInt(parts[2], 10) : undefined
      }
    }
    throw new Error(`无法解析时间: ${value}`)
  }

  private normalizeDate = (value: string): Date => {
    const now = new Date()
    
    switch (value) {
      case '今天':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate())
      case '明天':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      case '昨天':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      case '后天':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
      case '前天':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2)
      default:
        // 尝试解析 YYYY-MM-DD 或 YYYY/MM/DD 格式
        const dateMatch = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
        if (dateMatch) {
          return new Date(
            parseInt(dateMatch[1], 10),
            parseInt(dateMatch[2], 10) - 1, // 月份从0开始
            parseInt(dateMatch[3], 10)
          )
        }
        throw new Error(`无法解析日期: ${value}`)
    }
  }

  private normalizeColor = (value: string): string => {
    const colorMap: Record<string, string> = {
      '红色': 'red', '绿色': 'green', '蓝色': 'blue', '黄色': 'yellow',
      '黑色': 'black', '白色': 'white', '灰色': 'gray', '紫色': 'purple',
      '橙色': 'orange', '粉色': 'pink'
    }
    
    return colorMap[value] || value.toLowerCase()
  }

  private normalizeCurrency = (value: string): { amount: number; currency: string } => {
    // 提取数字和货币符号
    const numberMatch = value.match(/\d+(?:\.\d{2})?/)
    const amount = numberMatch ? parseFloat(numberMatch[0]) : 0
    
    let currency = 'CNY' // 默认人民币
    
    if (value.includes('$') || value.includes('美元') || value.includes('dollar')) {
      currency = 'USD'
    } else if (value.includes('€') || value.includes('欧元')) {
      currency = 'EUR'
    } else if (value.includes('£') || value.includes('英镑')) {
      currency = 'GBP'
    }
    
    return { amount, currency }
  }
}

/**
 * 默认实体提取器实例
 */
export const defaultEntityExtractor = new EntityExtractor()

/**
 * 便捷的实体提取函数
 */
export function extractEntities(text: string): EntityExtractionResult {
  return defaultEntityExtractor.extractEntities(text)
}