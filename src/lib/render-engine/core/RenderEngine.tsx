/**
 * 渲染引擎核心实现
 * 整合所有渲染组件，提供统一的渲染接口
 */

import React, { ReactElement } from 'react'
import { RenderEngine as IRenderEngine, RenderOptions, PerformanceMetrics, ContentRenderer } from '../types'
import { RenderRouter } from '../router/RenderRouter'
import { ContentParser } from '../parser/ContentParser'
import { TextRenderer } from '../renderers/TextRenderer'
import { isSimpleText } from '../utils'
import { DEFAULT_CONFIG } from '../constants'

/**
 * 渲染引擎实现类
 */
export class RenderEngine implements IRenderEngine {
  private router: RenderRouter
  private parser: ContentParser
  private initialized = false
  private metrics: PerformanceMetrics = { ...DEFAULT_CONFIG.PERFORMANCE_METRICS }

  constructor() {
    this.router = new RenderRouter()
    this.parser = new ContentParser()
  }

  /**
   * 初始化渲染引擎
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 注册默认渲染器
      const textRenderer = new TextRenderer()
      this.router.registerRenderer(textRenderer)
      this.router.setFallbackRenderer(textRenderer)

      this.initialized = true
      console.log('🚀 RenderEngine initialized successfully')
    } catch (error) {
      console.error('❌ RenderEngine initialization failed:', error)
      throw error
    }
  }

  /**
   * 渲染内容
   */
  public async render(content: string, options?: RenderOptions): Promise<ReactElement> {
    if (!this.initialized) {
      await this.initialize()
    }

    const startTime = performance.now()

    try {
      const validatedOptions = this.validateOptions(options)

      // 快速路径：简单文本
      if (isSimpleText(content)) {
        const result = this.router.fastPath(content, validatedOptions)
        if (result) {
          this.updateMetrics(performance.now() - startTime, false)
          return result
        }
      }

      // 智能路由：复杂内容
      const result = await this.router.smartRoute(content, validatedOptions)
      this.updateMetrics(performance.now() - startTime, false)
      
      return result

    } catch (error) {
      this.updateMetrics(performance.now() - startTime, true)
      
      // 降级到简单文本渲染
      console.warn('Render failed, falling back to simple text:', error)
      return this.createFallbackElement(content, options)
    }
  }

  /**
   * 流式渲染内容
   */
  public async *renderStream(
    contentStream: AsyncIterable<string>,
    options?: RenderOptions
  ): AsyncIterable<ReactElement> {
    if (!this.initialized) {
      await this.initialize()
    }

    let accumulatedContent = ''

    for await (const chunk of contentStream) {
      accumulatedContent += chunk
      
      try {
        const result = await this.render(accumulatedContent, options)
        yield result
      } catch (error) {
        console.warn('Stream render chunk failed:', error)
        yield this.createFallbackElement(accumulatedContent, options)
      }
    }
  }

  /**
   * 注册自定义渲染器
   */
  public registerRenderer(renderer: ContentRenderer): void {
    this.router.registerRenderer(renderer)
  }

  /**
   * 获取性能指标
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.router.cleanup()
    this.parser.cleanup()
    this.initialized = false
  }

  /**
   * 验证渲染选项
   */
  private validateOptions(options?: RenderOptions): RenderOptions {
    return {
      theme: options?.theme || DEFAULT_CONFIG.RENDER_OPTIONS.theme,
      performance: options?.performance || DEFAULT_CONFIG.RENDER_OPTIONS.performance,
      interactive: options?.interactive !== false,
      caching: options?.caching !== false,
      virtualization: options?.virtualization || false,
      maxWidth: options?.maxWidth,
      className: options?.className,
      style: options?.style
    }
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(renderTime: number, isError: boolean): void {
    this.metrics.renderTime = renderTime
    
    if (isError) {
      this.metrics.errorRate = Math.min(1, this.metrics.errorRate + 0.01)
    } else {
      this.metrics.errorRate = Math.max(0, this.metrics.errorRate - 0.001)
    }
  }

  /**
   * 创建降级元素
   */
  private createFallbackElement(content: string, options?: RenderOptions): ReactElement {
    const validatedOptions = this.validateOptions(options)
    
    return React.createElement('div', {
      className: 'render-fallback',
      style: {
        whiteSpace: 'pre-wrap',
        padding: '12px',
        backgroundColor: validatedOptions.theme === 'dark' ? '#1f2937' : '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: '14px',
        lineHeight: 1.5,
        color: validatedOptions.theme === 'dark' ? '#e5e7eb' : '#374151'
      }
    }, content)
  }
}

/**
 * 创建渲染引擎实例
 */
export const createRenderEngine = () => new RenderEngine()

/**
 * 全局渲染引擎实例（单例）
 */
export const globalRenderEngine = new RenderEngine()