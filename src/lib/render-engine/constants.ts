/**
 * 渲染引擎常量定义
 */

import { ContentType, PerformanceMode } from './types'

/**
 * 性能基准常量
 */
export const PERFORMANCE_BENCHMARKS = {
  /** 文本渲染器基准（毫秒） */
  TEXT_RENDERER: 10,
  /** 表格渲染器基准（毫秒） */
  TABLE_RENDERER: 50,
  /** 代码渲染器基准（毫秒） */
  CODE_RENDERER: 30,
  /** 图表渲染器基准（毫秒） */
  CHART_RENDERER: 100,
  /** 数学公式渲染器基准（毫秒） */
  MATH_RENDERER: 20
} as const

/**
 * 内容大小限制常量
 */
export const CONTENT_SIZE_LIMITS = {
  /** 文本内容最大大小（字符数） */
  TEXT_MAX_SIZE: 50000,
  /** 表格内容最大大小（字符数） */
  TABLE_MAX_SIZE: 100000,
  /** 代码内容最大大小（字符数） */
  CODE_MAX_SIZE: 200000,
  /** 图表数据最大大小（字符数） */
  CHART_MAX_SIZE: 50000,
  /** 数学公式最大大小（字符数） */
  MATH_MAX_SIZE: 10000,
  /** 快速检测内容长度（字符数） */
  QUICK_DETECT_LENGTH: 100
} as const

/**
 * 缓存配置常量
 */
export const CACHE_CONFIG = {
  /** 内存缓存最大条目数 */
  MEMORY_CACHE_MAX_SIZE: 1000,
  /** 持久化缓存最大大小（MB） */
  PERSISTENT_CACHE_MAX_SIZE: 100,
  /** 默认缓存TTL（毫秒） */
  DEFAULT_TTL: 24 * 60 * 60 * 1000, // 24小时
  /** 缓存键前缀 */
  CACHE_KEY_PREFIX: 'render-cache:',
  /** IndexedDB数据库名称 */
  INDEXEDDB_NAME: 'render-cache-db',
  /** IndexedDB版本 */
  INDEXEDDB_VERSION: 1
} as const

/**
 * 虚拟滚动配置常量
 */
export const VIRTUAL_SCROLL_CONFIG = {
  /** 默认项目高度（像素） */
  DEFAULT_ITEM_HEIGHT: 100,
  /** 缓冲区大小（项目数） */
  BUFFER_SIZE: 5,
  /** 最小虚拟化阈值（项目数） */
  MIN_VIRTUALIZATION_THRESHOLD: 50,
  /** 滚动防抖延迟（毫秒） */
  SCROLL_DEBOUNCE_DELAY: 16
} as const

/**
 * 内容类型检测模式
 */
export const CONTENT_DETECTION_PATTERNS = {
  [ContentType.TABLE]: [
    /^\s*\|.*\|.*\|\s*$/m, // Markdown表格
    /^\s*[^|]*\|[^|]*\|[^|]*$/m, // 简单表格
    /,.*,.*,/m // CSV格式
  ],
  [ContentType.CODE]: [
    /^```[\w]*\n/m, // 代码块开始
    /^    \w+/m, // 缩进代码
    /^\t\w+/m // Tab缩进代码
  ],
  [ContentType.MATH]: [
    /\$\$[\s\S]*?\$\$/m, // 块级数学公式
    /\$[^$\n]+\$/m, // 行内数学公式
    /\\begin\{[\w*]+\}/m, // LaTeX环境
    /\\[a-zA-Z]+\{/m // LaTeX命令
  ],
  [ContentType.LIST]: [
    /^\s*[-*+]\s+/m, // 无序列表
    /^\s*\d+\.\s+/m, // 有序列表
    /^\s*\[\s*[x\s]\]\s+/m // 任务列表
  ],
  [ContentType.LINK]: [
    /https?:\/\/[^\s]+/m, // HTTP链接
    /\[.*?\]\(.*?\)/m, // Markdown链接
    /www\.[^\s]+/m // www链接
  ]
} as const

/**
 * 渲染器优先级常量
 */
export const RENDERER_PRIORITIES = {
  /** 数学公式渲染器优先级 */
  MATH: 10,
  /** 代码渲染器优先级 */
  CODE: 9,
  /** 表格渲染器优先级 */
  TABLE: 8,
  /** 图表渲染器优先级 */
  CHART: 7,
  /** 列表渲染器优先级 */
  LIST: 6,
  /** 链接渲染器优先级 */
  LINK: 5,
  /** 文本渲染器优先级 */
  TEXT: 1
} as const

/**
 * 错误代码常量
 */
export const ERROR_CODES = {
  /** 内容过大 */
  CONTENT_TOO_LARGE: 'CONTENT_TOO_LARGE',
  /** 渲染失败 */
  RENDER_FAILED: 'RENDER_FAILED',
  /** 渲染器未找到 */
  RENDERER_NOT_FOUND: 'RENDERER_NOT_FOUND',
  /** 解析失败 */
  PARSE_FAILED: 'PARSE_FAILED',
  /** 缓存错误 */
  CACHE_ERROR: 'CACHE_ERROR',
  /** 性能超时 */
  PERFORMANCE_TIMEOUT: 'PERFORMANCE_TIMEOUT',
  /** 内存不足 */
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  /** 不支持的内容类型 */
  UNSUPPORTED_CONTENT_TYPE: 'UNSUPPORTED_CONTENT_TYPE'
} as const

/**
 * 性能阈值常量
 */
export const PERFORMANCE_THRESHOLDS = {
  /** 渲染超时阈值（毫秒） */
  RENDER_TIMEOUT: 5000,
  /** 内存使用警告阈值（MB） */
  MEMORY_WARNING_THRESHOLD: 100,
  /** 内存使用错误阈值（MB） */
  MEMORY_ERROR_THRESHOLD: 200,
  /** 缓存命中率警告阈值 */
  CACHE_HIT_RATE_WARNING: 0.5,
  /** 错误率警告阈值 */
  ERROR_RATE_WARNING: 0.1,
  /** DOM节点数量警告阈值 */
  DOM_NODE_WARNING_THRESHOLD: 1000
} as const

/**
 * 流式渲染配置常量
 */
export const STREAM_RENDER_CONFIG = {
  /** 流式缓冲区大小（字符数） */
  BUFFER_SIZE: 1000,
  /** 渲染批次大小 */
  BATCH_SIZE: 10,
  /** 渲染间隔（毫秒） */
  RENDER_INTERVAL: 16, // ~60fps
  /** 最大等待时间（毫秒） */
  MAX_WAIT_TIME: 100
} as const

/**
 * CSS类名常量
 */
export const CSS_CLASSES = {
  /** 渲染容器 */
  RENDER_CONTAINER: 'render-container',
  /** 文本内容 */
  TEXT_CONTENT: 'text-content',
  /** 表格容器 */
  TABLE_CONTAINER: 'table-container',
  /** 代码块 */
  CODE_BLOCK: 'code-block',
  /** 图表容器 */
  CHART_CONTAINER: 'chart-container',
  /** 数学公式 */
  MATH_FORMULA: 'math-formula',
  /** 错误边界 */
  ERROR_BOUNDARY: 'error-boundary',
  /** 加载状态 */
  LOADING_STATE: 'loading-state',
  /** 虚拟滚动项 */
  VIRTUAL_ITEM: 'virtual-item'
} as const

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  /** 默认渲染选项 */
  RENDER_OPTIONS: {
    theme: 'light' as const,
    performance: 'balanced' as const,
    interactive: true,
    caching: true,
    virtualization: false
  },
  /** 默认性能指标 */
  PERFORMANCE_METRICS: {
    renderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    errorRate: 0,
    userInteractionLatency: 0,
    domNodeCount: 0
  }
} as const

/**
 * 调试配置常量
 */
export const DEBUG_CONFIG = {
  /** 是否启用调试模式 */
  ENABLED: typeof process !== 'undefined' ? process.env.NODE_ENV === 'development' : false,
  /** 日志级别 */
  LOG_LEVEL: typeof process !== 'undefined' ? (process.env.RENDER_LOG_LEVEL || 'info') : 'info',
  /** 性能监控 */
  PERFORMANCE_MONITORING: true,
  /** 错误详细信息 */
  DETAILED_ERRORS: true
} as const