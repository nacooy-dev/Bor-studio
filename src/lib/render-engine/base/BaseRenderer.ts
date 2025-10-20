/**
 * 基础渲染器抽象类
 * 提供所有渲染器的通用功能和默认实现
 */

import { ReactElement } from 'react'
import {
  ContentRenderer,
  RenderOptions,
  PerformanceMetrics,
  RenderError,
  RenderContext
} from '../types'

/**
 * 基础渲染器抽象类
 */
export abstract class BaseRenderer implements ContentRenderer {
  public abstract readonly name: string
  public abstract readonly priority: number
  
  public readonly performance = {
    avgRenderTime: 0,
    maxContentSize: 100000 // 默认最大10万字符
  }

  protected renderCount = 0
  protected totalRenderTime = 0
  protected errorCount = 0

  /**
   * 检查是否能处理指定内容
   */
  public abstract canHandle(content: string): boolean | Promise<boolean>

  /**
   * 渲染内容的核心实现
   */
  protected abstract renderContent(content: string, options?: RenderOptions): ReactElement | Promise<ReactElement>

  /**
   * 渲染内容（带性能监控和错误处理）
   */
  public async render(content: string, options?: RenderOptions): Promise<ReactElement> {
    const startTime = performance.now()
    
    try {
      // 验证内容大小
      if (content.length > this.performance.maxContentSize) {
        throw new RenderError(
          `Content too large: ${content.length} > ${this.performance.maxContentSize}`,
          'CONTENT_TOO_LARGE',
          { contentLength: content.length, maxSize: this.performance.maxContentSize }
        )
      }

      // 预处理内容
      const processedContent = await this.preprocessContent(content)
      
      // 渲染内容
      let result = await this.renderContent(processedContent, options)
      
      // 后处理结果
      result = await this.postprocessResult(result, processedContent)
      
      // 更新性能统计
      const renderTime = performance.now() - startTime
      this.updateStats(renderTime, false)
      
      return result
    } catch (error) {
      const renderTime = performance.now() - startTime
      this.updateStats(renderTime, true)
      
      if (error instanceof RenderError) {
        throw error
      }
      
      throw new RenderError(
        `Render failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RENDER_FAILED',
        { 
          renderer: this.name,
          contentLength: content.length,
          error: error instanceof Error ? error.message : String(error)
        }
      )
    }
  }

  /**
   * 预处理内容（子类可重写）
   */
  protected async preprocessContent(content: string): Promise<string> {
    return content.trim()
  }

  /**
   * 后处理渲染结果（子类可重写）
   */
  protected async postprocessResult(element: ReactElement, content: string): Promise<ReactElement> {
    return element
  }

  /**
   * 更新性能统计
   */
  private updateStats(renderTime: number, isError: boolean): void {
    this.renderCount++
    this.totalRenderTime += renderTime
    
    if (isError) {
      this.errorCount++
    }
    
    // 更新平均渲染时间
    ;(this.performance as any).avgRenderTime = this.totalRenderTime / this.renderCount
  }

  /**
   * 获取渲染器统计信息
   */
  public getStats(): {
    renderCount: number
    avgRenderTime: number
    errorCount: number
    errorRate: number
  } {
    return {
      renderCount: this.renderCount,
      avgRenderTime: this.performance.avgRenderTime,
      errorCount: this.errorCount,
      errorRate: this.renderCount > 0 ? this.errorCount / this.renderCount : 0
    }
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.renderCount = 0
    this.totalRenderTime = 0
    this.errorCount = 0
    ;(this.performance as any).avgRenderTime = 0
  }

  /**
   * 检查内容是否为空或无效
   */
  protected isEmpty(content: string): boolean {
    return !content || content.trim().length === 0
  }

  /**
   * 生成缓存键
   */
  protected generateCacheKey(content: string, options?: RenderOptions): string {
    const optionsHash = options ? this.hashObject(options) : 'default'
    const contentHash = this.hashString(content)
    return `${this.name}:${contentHash}:${optionsHash}`
  }

  /**
   * 简单字符串哈希函数
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 对象哈希函数
   */
  private hashObject(obj: any): string {
    return this.hashString(JSON.stringify(obj))
  }

  /**
   * 创建错误边界包装器
   */
  protected createErrorBoundary(content: ReactElement, fallback?: ReactElement): ReactElement {
    // 这里返回一个简单的错误边界，实际实现会在具体的React组件中
    return content
  }

  /**
   * 验证渲染选项
   */
  protected validateOptions(options?: RenderOptions): RenderOptions {
    if (!options) {
      return {
        theme: 'light' as const,
        performance: 'balanced' as const,
        interactive: true,
        caching: true
      }
    }
    
    return {
      theme: options.theme || 'light',
      performance: options.performance || 'balanced',
      interactive: options.interactive !== false,
      caching: options.caching !== false,
      ...options
    }
  }

  /**
   * 检查是否应该使用快速模式
   */
  protected shouldUseFastMode(content: string, options?: RenderOptions): boolean {
    const validatedOptions = this.validateOptions(options)
    
    return (
      validatedOptions.performance === 'fast' ||
      content.length < 1000 // 小于1000字符使用快速模式
    )
  }

  /**
   * 创建渲染上下文
   */
  protected createRenderContext(content: string, options?: RenderOptions): Partial<RenderContext> {
    return {
      content,
      options: this.validateOptions(options)
    }
  }
}

/**
 * 同步渲染器基类（用于简单的同步渲染）
 */
export abstract class BaseSyncRenderer extends BaseRenderer {
  /**
   * 同步渲染内容
   */
  protected abstract renderContentSync(content: string, options?: RenderOptions): ReactElement

  /**
   * 实现异步接口，内部调用同步方法
   */
  protected renderContent(content: string, options?: RenderOptions): ReactElement {
    return this.renderContentSync(content, options)
  }
}

/**
 * 异步渲染器基类（用于需要异步处理的复杂渲染）
 */
export abstract class BaseAsyncRenderer extends BaseRenderer {
  /**
   * 异步渲染内容
   */
  protected abstract renderContentAsync(content: string, options?: RenderOptions): Promise<ReactElement>

  /**
   * 实现异步接口
   */
  protected renderContent(content: string, options?: RenderOptions): Promise<ReactElement> {
    return this.renderContentAsync(content, options)
  }
}