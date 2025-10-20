/**
 * 智能渲染器React组件
 * 使用新的渲染引擎来渲染LLM输出
 */

import React, { useState, useEffect, useMemo } from 'react'
import { globalRenderEngine } from '@/lib/render-engine/core/RenderEngine'
import { RenderOptions } from '@/lib/render-engine/types'

interface SmartRendererProps {
  /** 要渲染的内容 */
  content: string
  /** 渲染选项 */
  options?: Partial<RenderOptions>
  /** 是否启用流式渲染 */
  streaming?: boolean
  /** 自定义CSS类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 错误回调 */
  onError?: (error: Error) => void
}

/**
 * 智能渲染器组件
 */
export const SmartRenderer: React.FC<SmartRendererProps> = ({
  content,
  options = {},
  streaming = false,
  className,
  style,
  onError
}) => {
  const [renderedElement, setRenderedElement] = useState<React.ReactElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 合并渲染选项
  const renderOptions = useMemo((): RenderOptions => ({
    theme: 'light',
    performance: 'balanced',
    interactive: true,
    caching: true,
    ...options,
    className,
    style
  }), [options, className, style])

  // 渲染内容
  useEffect(() => {
    if (!content || content.trim().length === 0) {
      setRenderedElement(null)
      return
    }

    const renderContent = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // 确保渲染引擎已初始化
        await globalRenderEngine.initialize()
        
        // 渲染内容
        const element = await globalRenderEngine.render(content, renderOptions)
        setRenderedElement(element)
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        onError?.(error)
        
        // 降级到简单文本渲染
        setRenderedElement(
          <div 
            className="render-error-fallback"
            style={{
              padding: '12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626'
            }}
          >
            <div className="font-medium mb-2">渲染失败，显示原始内容：</div>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{content}</pre>
          </div>
        )
      } finally {
        setIsLoading(false)
      }
    }

    renderContent()
  }, [content, renderOptions, onError])

  // 加载状态
  if (isLoading) {
    return (
      <div className="smart-renderer-loading flex items-center space-x-2 p-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">正在渲染内容...</span>
      </div>
    )
  }

  // 空内容
  if (!content || content.trim().length === 0) {
    return null
  }

  // 渲染结果
  return (
    <div className={`smart-renderer ${className || ''}`} style={style}>
      {renderedElement}
      
      {/* 调试信息（开发模式） */}
      {typeof process !== 'undefined' && process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-400 border-t pt-2">
          <div>内容长度: {content.length} 字符</div>
          <div>渲染选项: {JSON.stringify(renderOptions, null, 2)}</div>
          {error && <div className="text-red-500">错误: {error.message}</div>}
        </div>
      )}
    </div>
  )
}

/**
 * 流式智能渲染器组件
 */
export const StreamingSmartRenderer: React.FC<SmartRendererProps> = (props) => {
  // 流式渲染的实现可以在后续添加
  return <SmartRenderer {...props} />
}

export default SmartRenderer