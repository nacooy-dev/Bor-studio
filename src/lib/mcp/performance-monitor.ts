/**
 * MCP性能监控工具
 */

export interface PerformanceMetrics {
  operation: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: string
}

class MCPPerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private readonly MAX_METRICS = 100 // 限制存储的指标数量

  /**
   * 开始监控操作
   */
  startOperation(operation: string): string {
    const id = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const metric: PerformanceMetrics = {
      operation,
      startTime: performance.now(),
      success: false
    }
    
    this.metrics.push(metric)
    
    // 限制指标数量，避免内存泄漏
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift()
    }
    
    return id
  }

  /**
   * 结束监控操作
   */
  endOperation(operation: string, success: boolean = true, error?: string): void {
    const metric = this.metrics.find(m => 
      m.operation === operation && !m.endTime
    )
    
    if (metric) {
      metric.endTime = performance.now()
      metric.duration = metric.endTime - metric.startTime
      metric.success = success
      metric.error = error
      
      // 记录性能警告
      if (metric.duration > 1000) { // 超过1秒
        console.warn(`⚠️ 性能警告: ${operation} 耗时 ${metric.duration.toFixed(2)}ms`)
      } else if (metric.duration > 100) { // 超过100ms
        console.log(`⏱️ 性能提示: ${operation} 耗时 ${metric.duration.toFixed(2)}ms`)
      }
    }
  }

  /**
   * 获取性能统计
   */
  getStats(): {
    totalOperations: number
    averageDuration: number
    slowestOperation: PerformanceMetrics | null
    fastestOperation: PerformanceMetrics | null
    successRate: number
    recentOperations: PerformanceMetrics[]
  } {
    const completedMetrics = this.metrics.filter(m => m.endTime && m.duration !== undefined)
    
    if (completedMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        slowestOperation: null,
        fastestOperation: null,
        successRate: 0,
        recentOperations: []
      }
    }
    
    const durations = completedMetrics.map(m => m.duration!)
    const successCount = completedMetrics.filter(m => m.success).length
    
    return {
      totalOperations: completedMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      slowestOperation: completedMetrics.reduce((prev, current) => 
        (prev.duration! > current.duration!) ? prev : current
      ),
      fastestOperation: completedMetrics.reduce((prev, current) => 
        (prev.duration! < current.duration!) ? prev : current
      ),
      successRate: (successCount / completedMetrics.length) * 100,
      recentOperations: completedMetrics.slice(-10) // 最近10个操作
    }
  }

  /**
   * 清除指标
   */
  clear(): void {
    this.metrics = []
  }

  /**
   * 获取操作建议
   */
  getOptimizationSuggestions(): string[] {
    const stats = this.getStats()
    const suggestions: string[] = []
    
    if (stats.averageDuration > 500) {
      suggestions.push('平均响应时间较慢，考虑优化数据加载策略')
    }
    
    if (stats.successRate < 90) {
      suggestions.push('成功率较低，检查错误处理和网络连接')
    }
    
    if (stats.slowestOperation && stats.slowestOperation.duration! > 2000) {
      suggestions.push(`最慢操作 ${stats.slowestOperation.operation} 耗时过长，需要优化`)
    }
    
    const recentFailures = stats.recentOperations.filter(m => !m.success)
    if (recentFailures.length > 3) {
      suggestions.push('最近失败操作较多，检查系统稳定性')
    }
    
    return suggestions
  }
}

// 单例实例
export const mcpPerformanceMonitor = new MCPPerformanceMonitor()

/**
 * 性能监控装饰器
 */
export function monitorPerformance(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const operation = operationName || `${target.constructor.name}.${propertyKey}`
    
    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now()
      
      try {
        const result = await originalMethod.apply(this, args)
        const duration = performance.now() - startTime
        
        mcpPerformanceMonitor.endOperation(operation, true)
        
        if (duration > 100) {
          console.log(`⏱️ ${operation} 完成，耗时 ${duration.toFixed(2)}ms`)
        }
        
        return result
      } catch (error) {
        const duration = performance.now() - startTime
        mcpPerformanceMonitor.endOperation(operation, false, error instanceof Error ? error.message : '未知错误')
        
        console.warn(`❌ ${operation} 失败，耗时 ${duration.toFixed(2)}ms:`, error)
        throw error
      }
    }
    
    return descriptor
  }
}

/**
 * 简单的性能测量工具
 */
export class PerformanceTimer {
  private startTime: number
  private name: string

  constructor(name: string) {
    this.name = name
    this.startTime = performance.now()
  }

  end(): number {
    const duration = performance.now() - this.startTime
    console.log(`⏱️ ${this.name}: ${duration.toFixed(2)}ms`)
    return duration
  }

  static measure<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    const timer = new PerformanceTimer(name)
    
    try {
      const result = fn()
      
      if (result instanceof Promise) {
        return result.finally(() => timer.end())
      } else {
        timer.end()
        return Promise.resolve(result)
      }
    } catch (error) {
      timer.end()
      throw error
    }
  }
}