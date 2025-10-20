/**
 * 解析器模块入口文件
 */

export { ContentParser } from './ContentParser'
export { StreamParser } from './StreamParser'

// 创建默认解析器实例
export const createContentParser = () => new ContentParser()
export const createStreamParser = () => new StreamParser()