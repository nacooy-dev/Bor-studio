/**
 * 渲染引擎核心类型定义
 * 定义了所有渲染相关的接口、枚举和数据结构
 */

import { ReactElement } from 'react'

/**
 * 内容类型枚举
 */
export enum ContentType {
  TEXT = 'text',
  TABLE = 'table',
  CODE = 'code',
  MATH = 'math',
  CHART = 'chart',
  LIST = 'list',
  LINK = 'link',
  MIXED = 'mixed'
}

/**
 * 渲染性能模式
 */
export enum PerformanceMode {
  FAST = 'fast',
  BALANCED = 'balanced',
  QUALITY = 'quality'
}

/**
 * 渲染主题
 */
export enum RenderTheme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto'
}

/**
 * 内容解析结果
 */
export interface ParseResult {
  /** 内容类型 */
  type: ContentType
  /** 解析后的内容 */
  content: string
  /** 元数据信息 */
  metadata: Record<string, any>
  /** 识别置信度 (0-1) */
  confidence: number
  /** 内容在原文中的位置 */
  position: {
    start: number
    end: number
  }
}

/**
 * 内容段落
 */
export interface ContentSegment {
  /** 唯一标识符 */
  id: string
  /** 内容类型 */
  type: ContentType
  /** 段落内容 */
  content: string
  /** 元数据 */
  metadata: {
    /** 在原文中的起始位置 */
    startIndex: number
    /** 在原文中的结束位置 */
    endIndex: number
    /** 识别置信度 */
    confidence: number
    /** 渲染时间（毫秒） */
    renderTime?: number
    /** 缓存键 */
    cacheKey?: string
    /** 优先级 (1-10, 10最高) */
    priority?: number
  }
  /** 依赖的其他段落ID */
  dependencies?: string[]
}

/**
 * 渲染配置选项
 */
export interface RenderOptions {
  /** 主题模式 */
  theme: RenderTheme
  /** 性能模式 */
  performance: PerformanceMode
  /** 最大宽度 */
  maxWidth?: number
  /** 是否启用交互功能 */
  interactive?: boolean
  /** 是否启用缓存 */
  caching?: boolean
  /** 是否启用虚拟滚动 */
  virtualization?: boolean
  /** 自定义CSS类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 渲染时间（毫秒） */
  renderTime: number
  /** 内存使用量（字节） */
  memoryUsage: number
  /** 缓存命中率 (0-1) */
  cacheHitRate: number
  /** 错误率 (0-1) */
  errorRate: number
  /** 用户交互延迟（毫秒） */
  userInteractionLatency: number
  /** DOM节点数量 */
  domNodeCount: number
}

/**
 * 内容渲染器接口
 */
export interface ContentRenderer {
  /** 渲染器名称 */
  readonly name: string
  /** 渲染器优先级 (1-10, 10最高) */
  readonly priority: number
  /** 性能特征 */
  readonly performance: {
    /** 平均渲染时间（毫秒） */
    avgRenderTime: number
    /** 最大支持内容大小（字符数） */
    maxContentSize: number
  }

  /**
   * 检查是否能处理指定内容
   * @param content 待检查的内容
   * @returns 是否能处理
   */
  canHandle(content: string): boolean | Promise<boolean>

  /**
   * 渲染内容
   * @param content 待渲染的内容
   * @param options 渲染选项
   * @returns React元素
   */
  render(content: string, options?: RenderOptions): ReactElement | Promise<ReactElement>

  /**
   * 预处理内容（可选）
   * @param content 原始内容
   * @returns 预处理后的内容
   */
  preprocess?(content: string): string | Promise<string>

  /**
   * 后处理渲染结果（可选）
   * @param element 渲染后的React元素
   * @param content 原始内容
   * @returns 后处理后的React元素
   */
  postprocess?(element: ReactElement, content: string): ReactElement | Promise<ReactElement>
}

/**
 * 内容解析器接口
 */
export interface ContentParser {
  /**
   * 流式解析内容
   * @param chunk 内容块
   * @returns 解析结果数组
   */
  parseStream(chunk: string): ParseResult[] | Promise<ParseResult[]>

  /**
   * 检测内容类型
   * @param content 待检测的内容
   * @returns 内容类型
   */
  detectContentType(content: string): ContentType | Promise<ContentType>

  /**
   * 分割内容为段落
   * @param content 完整内容
   * @returns 内容段落数组
   */
  segmentContent(content: string): ContentSegment[] | Promise<ContentSegment[]>

  /**
   * 快速类型检测（前100字符）
   * @param content 内容前缀
   * @returns 可能的内容类型和置信度
   */
  quickDetect(content: string): { type: ContentType; confidence: number }
}

/**
 * 渲染路由器接口
 */
export interface RenderRouter {
  /**
   * 注册渲染器
   * @param renderer 渲染器实例
   */
  registerRenderer(renderer: ContentRenderer): void

  /**
   * 注销渲染器
   * @param name 渲染器名称
   */
  unregisterRenderer(name: string): void

  /**
   * 选择最优渲染器
   * @param content 待渲染内容
   * @param options 渲染选项
   * @returns 选中的渲染器
   */
  selectRenderer(content: string, options?: RenderOptions): ContentRenderer | Promise<ContentRenderer>

  /**
   * 快速路径渲染（简单内容）
   * @param content 内容
   * @param options 选项
   * @returns React元素
   */
  fastPath(content: string, options?: RenderOptions): ReactElement | null

  /**
   * 智能路由渲染（复杂内容）
   * @param content 内容
   * @param options 选项
   * @returns React元素
   */
  smartRoute(content: string, options?: RenderOptions): ReactElement | Promise<ReactElement>
}

/**
 * 缓存接口
 */
export interface RenderCache {
  /**
   * 获取缓存内容
   * @param key 缓存键
   * @returns 缓存的React元素
   */
  get(key: string): ReactElement | Promise<ReactElement | null>

  /**
   * 设置缓存内容
   * @param key 缓存键
   * @param value React元素
   * @param ttl 过期时间（毫秒）
   */
  set(key: string, value: ReactElement, ttl?: number): void | Promise<void>

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): void | Promise<void>

  /**
   * 清空缓存
   */
  clear(): void | Promise<void>

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number
    hitRate: number
    memoryUsage: number
  }
}

/**
 * 性能监控器接口
 */
export interface PerformanceMonitor {
  /**
   * 开始性能测量
   * @param label 测量标签
   * @returns 测量ID
   */
  startMeasure(label: string): string

  /**
   * 结束性能测量
   * @param measureId 测量ID
   * @returns 测量结果
   */
  endMeasure(measureId: string): number

  /**
   * 记录性能指标
   * @param metrics 性能指标
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>): void

  /**
   * 获取性能报告
   * @param timeRange 时间范围（毫秒）
   * @returns 性能报告
   */
  getReport(timeRange?: number): PerformanceMetrics

  /**
   * 记录错误
   * @param error 错误信息
   * @param context 错误上下文
   */
  recordError(error: Error, context?: Record<string, any>): void
}

/**
 * 渲染引擎主接口
 */
export interface RenderEngine {
  /**
   * 初始化渲染引擎
   */
  initialize(): Promise<void>

  /**
   * 渲染内容
   * @param content 待渲染内容
   * @param options 渲染选项
   * @returns React元素
   */
  render(content: string, options?: RenderOptions): ReactElement | Promise<ReactElement>

  /**
   * 流式渲染内容
   * @param contentStream 内容流
   * @param options 渲染选项
   * @returns React元素流
   */
  renderStream(
    contentStream: AsyncIterable<string>,
    options?: RenderOptions
  ): AsyncIterable<ReactElement>

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics

  /**
   * 清理资源
   */
  cleanup(): void
}

/**
 * 错误类型
 */
export class RenderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = 'RenderError'
  }
}

/**
 * 渲染器注册信息
 */
export interface RendererRegistration {
  renderer: ContentRenderer
  registeredAt: Date
  enabled: boolean
  stats: {
    renderCount: number
    totalRenderTime: number
    errorCount: number
  }
}

/**
 * 渲染上下文
 */
export interface RenderContext {
  /** 当前渲染的内容 */
  content: string
  /** 渲染选项 */
  options: RenderOptions
  /** 性能监控器 */
  monitor: PerformanceMonitor
  /** 缓存实例 */
  cache: RenderCache
  /** 父级上下文（用于嵌套渲染） */
  parent?: RenderContext
}

/**
 * 工具函数类型
 */
export type ContentTypeDetector = (content: string) => ContentType | null
export type ContentValidator = (content: string, type: ContentType) => boolean
export type ContentTransformer = (content: string) => string
export type RenderHook = (context: RenderContext) => void | Promise<void>