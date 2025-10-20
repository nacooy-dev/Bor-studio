/**
 * 渲染路由器实现
 * 负责选择最优渲染器并管理渲染流程
 */

import React, { ReactElement } from 'react'
import {
  RenderRouter as IRenderRouter,
  ContentRenderer,
  RenderOptions,
  ContentType,
  PerformanceMonitor,
  RenderError,
  RendererRegistration
} from '../types'
import {
  isSimpleText,
  quickDetectContentType,
  generateId,
  safeExecute
} from '../utils'
import {
  ERROR_CODES,
  RENDERER_PRIORITIES,
  PERFORMANCE_THRESHOLDS
} from '../constants'

/**
 * 渲染路由器实现类
 */
export class RenderRouter implements IRenderRouter {
  private renderers = new Map<string, RendererRegistration>()
  private performanceMonitor?: PerformanceMonitor
  private fallbackRenderer?: ContentRenderer

  constructor(performanceMonitor?: PerformanceMonitor) {
    this.performanceMonitor = performanceMonitor
  }

  /**
   * 注册渲染器
   */
  public registerRenderer(renderer: ContentRenderer): void {
    const registration: RendererRegistration = {
      renderer,
      registeredAt: new Date(),
      enabled: true,
      stats: {
        renderCount: 0,
        totalRenderTime: 0,
        errorCount: 0
      }
    }

    this.renderers.set(renderer.name, registration)
    
    console.log(`✅ Registered renderer: ${renderer.name} (priority: ${renderer.priority})`)
  }

  /**
   * 注销渲染器
   */
  public unregisterRenderer(name: string): void {
    const removed = this.renderers.delete(name)
    if (removed) {
      console.log(`🗑️ Unregistered renderer: ${name}`)
    }
  }

  /**
   * 设置后备渲染器
   */
  public setFallbackRenderer(renderer: ContentRenderer): void {
    this.fallbackRenderer = renderer
  }

  /**
   * 选择最优渲染器
   */
  public async selectRenderer(content: string, options?: RenderOptions): Promise<ContentRenderer> {
    if (!content || content.trim().length === 0) {
      throw new RenderError('Empty content provided', ERROR_CODES.RENDER_FAILED)
    }

    try {
      // 获取所有可用的渲染器
      const availableRenderers = this.getAvailableRenderers()
      
      if (availableRenderers.length === 0) {
        throw new RenderError('No renderers available', ERROR_CODES.RENDERER_NOT_FOUND)
      }

      // 快速检测内容类型
      const { type, confidence } = quickDetectContentType(content)
      
      // 找到能处理该内容的渲染器
      const candidateRenderers: Array<{ renderer: ContentRenderer; score: number }> = []

      for (const registration of availableRenderers) {
        const renderer = registration.renderer
        
        try {
          const canHandle = await renderer.canHandle(content)
          if (canHandle) {
            const score = this.calculateRendererScore(renderer, type, confidence, registration.stats)
            candidateRenderers.push({ renderer, score })
          }
        } catch (error) {
          console.warn(`Renderer ${renderer.name} failed canHandle check:`, error)
          this.updateRendererStats(renderer.name, 0, true)
        }
      }

      if (candidateRenderers.length === 0) {
        // 使用后备渲染器
        if (this.fallbackRenderer) {
          console.log(`🔄 Using fallback renderer for content type: ${type}`)
          return this.fallbackRenderer
        }
        
        throw new RenderError(
          `No suitable renderer found for content type: ${type}`,
          ERROR_CODES.RENDERER_NOT_FOUND,
          { contentType: type, confidence }
        )
      }

      // 选择得分最高的渲染器
      candidateRenderers.sort((a, b) => b.score - a.score)
      const selectedRenderer = candidateRenderers[0].renderer

      console.log(`🎯 Selected renderer: ${selectedRenderer.name} (score: ${candidateRenderers[0].score})`)
      return selectedRenderer

    } catch (error) {
      if (error instanceof RenderError) {
        throw error
      }
      
      throw new RenderError(
        `Renderer selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ERROR_CODES.RENDER_FAILED,
        { contentLength: content.length }
      )
    }
  }

  /**
   * 快速路径渲染（简单内容）
   */
  public fastPath(content: string, options?: RenderOptions): ReactElement | null {
    if (!isSimpleText(content)) {
      return null
    }

    // 创建简单的文本渲染
    return React.createElement('div', {
      className: 'simple-text-render',
      style: { whiteSpace: 'pre-wrap' }
    }, content)
  }

  /**
   * 智能路由渲染（复杂内容）
   */
  public async smartRoute(content: string, options?: RenderOptions): Promise<ReactElement> {
    const measureId = this.performanceMonitor?.startMeasure('smart-route')
    
    try {
      // 选择最优渲染器
      const renderer = await this.selectRenderer(content, options)
      
      // 执行渲染
      const startTime = performance.now()
      const result = await renderer.render(content, options)
      const renderTime = performance.now() - startTime
      
      // 更新统计信息
      this.updateRendererStats(renderer.name, renderTime, false)
      
      // 记录性能指标
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetrics({
          renderTime,
          domNodeCount: this.estimateDOMNodes(result)
        })
      }

      return result

    } catch (error) {
      throw new RenderError(
        `Smart routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ERROR_CODES.RENDER_FAILED,
        { contentLength: content.length }
      )
    } finally {
      if (measureId && this.performanceMonitor) {
        this.performanceMonitor.endMeasure(measureId)
      }
    }
  }

  /**
   * 获取可用渲染器
   */
  private getAvailableRenderers(): RendererRegistration[] {
    return Array.from(this.renderers.values())
      .filter(registration => registration.enabled)
      .sort((a, b) => b.renderer.priority - a.renderer.priority)
  }

  /**
   * 计算渲染器得分
   */
  private calculateRendererScore(
    renderer: ContentRenderer,
    contentType: ContentType,
    confidence: number,
    stats: RendererRegistration['stats']
  ): number {
    let score = renderer.priority * 10 // 基础优先级分数

    // 内容类型匹配加分
    if (this.isRendererSuitableForType(renderer, contentType)) {
      score += confidence * 20
    }

    // 性能表现加分
    if (stats.renderCount > 0) {
      const avgRenderTime = stats.totalRenderTime / stats.renderCount
      const errorRate = stats.errorCount / stats.renderCount
      
      // 渲染时间越短得分越高
      if (avgRenderTime < renderer.performance.avgRenderTime) {
        score += 10
      }
      
      // 错误率越低得分越高
      score -= errorRate * 50
    }

    // 内容大小适配性
    const contentSize = 1000 // 估算值，实际应该传入
    if (contentSize <= renderer.performance.maxContentSize) {
      score += 5
    } else {
      score -= 20 // 内容过大严重扣分
    }

    return Math.max(0, score)
  }

  /**
   * 检查渲染器是否适合特定内容类型
   */
  private isRendererSuitableForType(renderer: ContentRenderer, type: ContentType): boolean {
    const rendererTypeMap: Record<string, ContentType[]> = {
      'TextRenderer': [ContentType.TEXT, ContentType.MIXED],
      'TableRenderer': [ContentType.TABLE],
      'CodeRenderer': [ContentType.CODE],
      'MathRenderer': [ContentType.MATH],
      'ChartRenderer': [ContentType.CHART],
      'ListRenderer': [ContentType.LIST],
      'LinkRenderer': [ContentType.LINK]
    }

    const suitableTypes = rendererTypeMap[renderer.name] || []
    return suitableTypes.includes(type)
  }

  /**
   * 更新渲染器统计信息
   */
  private updateRendererStats(rendererName: string, renderTime: number, isError: boolean): void {
    const registration = this.renderers.get(rendererName)
    if (!registration) return

    registration.stats.renderCount++
    registration.stats.totalRenderTime += renderTime

    if (isError) {
      registration.stats.errorCount++
    }

    // 如果错误率过高，暂时禁用渲染器
    const errorRate = registration.stats.errorCount / registration.stats.renderCount
    if (errorRate > PERFORMANCE_THRESHOLDS.ERROR_RATE_WARNING && registration.stats.renderCount > 10) {
      registration.enabled = false
      console.warn(`⚠️ Disabled renderer ${rendererName} due to high error rate: ${errorRate}`)
    }
  }

  /**
   * 估算DOM节点数量
   */
  private estimateDOMNodes(element: ReactElement): number {
    // 简单估算，实际实现可能需要递归遍历
    return 1
  }

  /**
   * 获取路由器统计信息
   */
  public getStats(): {
    totalRenderers: number
    enabledRenderers: number
    totalRenders: number
    avgRenderTime: number
    errorRate: number
  } {
    const registrations = Array.from(this.renderers.values())
    const enabledCount = registrations.filter(r => r.enabled).length
    
    const totalRenders = registrations.reduce((sum, r) => sum + r.stats.renderCount, 0)
    const totalRenderTime = registrations.reduce((sum, r) => sum + r.stats.totalRenderTime, 0)
    const totalErrors = registrations.reduce((sum, r) => sum + r.stats.errorCount, 0)

    return {
      totalRenderers: registrations.length,
      enabledRenderers: enabledCount,
      totalRenders,
      avgRenderTime: totalRenders > 0 ? totalRenderTime / totalRenders : 0,
      errorRate: totalRenders > 0 ? totalErrors / totalRenders : 0
    }
  }

  /**
   * 重置所有统计信息
   */
  public resetStats(): void {
    for (const registration of this.renderers.values()) {
      registration.stats = {
        renderCount: 0,
        totalRenderTime: 0,
        errorCount: 0
      }
      registration.enabled = true
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.renderers.clear()
    this.performanceMonitor = undefined
    this.fallbackRenderer = undefined
  }
}