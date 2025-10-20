/**
 * 渲染引擎入口文件
 * 导出所有公共接口、类型和工具函数
 */

// 核心类型和接口
export * from './types'

// 基础渲染器类
export * from './base/BaseRenderer'

// 常量定义
export * from './constants'

// 工具函数
export * from './utils'

// 版本信息
export const VERSION = '1.0.0'

// 默认导出（用于简化导入）
export { ContentType, PerformanceMode, RenderTheme } from './types'
export { detectContentType, quickDetectContentType, isSimpleText } from './utils'
export { BaseRenderer, BaseSyncRenderer, BaseAsyncRenderer } from './base/BaseRenderer'