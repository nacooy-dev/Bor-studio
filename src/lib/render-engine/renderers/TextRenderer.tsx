/**
 * 文本渲染器实现
 * 专门处理文本内容的高性能渲染
 */

import React, { ReactElement, useMemo } from 'react'
import { marked } from 'marked'
import { BaseSyncRenderer } from '../base/BaseRenderer'
import { ContentType, RenderOptions } from '../types'
import { RENDERER_PRIORITIES, CONTENT_SIZE_LIMITS } from '../constants'

/**
 * 文本渲染器
 */
export class TextRenderer extends BaseSyncRenderer {
  public readonly name = 'TextRenderer'
  public readonly priority = RENDERER_PRIORITIES.TEXT

  public readonly performance = {
    avgRenderTime: 5, // 目标5ms内完成
    maxContentSize: CONTENT_SIZE_LIMITS.TEXT_MAX_SIZE
  }

  /**
   * 检查是否能处理内容
   */
  public canHandle(content: string): boolean {
    if (this.isEmpty(content)) {
      return false
    }

    // 检查内容大小
    if (content.length > this.performance.maxContentSize) {
      return false
    }

    // 文本渲染器可以处理所有不包含特殊标记的内容
    return !this.hasComplexMarkup(content)
  }

  /**
   * 同步渲染内容
   */
  protected renderContentSync(content: string, options?: RenderOptions): ReactElement {
    const validatedOptions = this.validateOptions(options)
    
    // 快速模式：纯文本渲染
    if (this.shouldUseFastMode(content, options)) {
      return this.renderPlainText(content, validatedOptions)
    }

    // 标准模式：Markdown渲染
    return this.renderMarkdown(content, validatedOptions)
  }

  /**
   * 渲染纯文本（快速模式）
   */
  private renderPlainText(content: string, options: RenderOptions): ReactElement {
    return (
      <div 
        className={`text-renderer plain-text ${options.className || ''}`}
        style={{
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          color: options.theme === 'dark' ? '#e5e7eb' : '#374151',
          ...options.style
        }}
      >
        {this.processPlainText(content)}
      </div>
    )
  }

  /**
   * 渲染Markdown内容
   */
  private renderMarkdown(content: string, options: RenderOptions): ReactElement {
    const htmlContent = useMemo(() => {
      return this.parseMarkdown(content, options)
    }, [content, options.theme])

    return (
      <div 
        className={`text-renderer markdown-content prose prose-sm max-w-none ${
          options.theme === 'dark' ? 'prose-invert' : ''
        } ${options.className || ''}`}
        style={options.style}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    )
  }

  /**
   * 解析Markdown内容
   */
  private parseMarkdown(content: string, options: RenderOptions): string {
    // 配置marked选项
    marked.setOptions({
      breaks: true,
      gfm: true,
      sanitize: false, // 在生产环境中应该启用
      smartLists: true,
      smartypants: true
    })

    // 自定义渲染器
    const renderer = new marked.Renderer()
    
    // 自定义链接渲染 - 确保链接可点击
    renderer.link = (href: string, title: string | null, text: string): string => {
      const titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${text}</a>`
    }

    // 自定义代码渲染
    renderer.code = (code: string, language: string | undefined): string => {
      const lang = language || 'text'
      return `<pre class="bg-gray-100 dark:bg-gray-800 rounded-md p-3 overflow-x-auto"><code class="language-${lang}">${this.escapeHtml(code)}</code></pre>`
    }

    // 自定义行内代码渲染
    renderer.codespan = (code: string): string => {
      return `<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">${this.escapeHtml(code)}</code>`
    }

    // 自定义表格渲染（简化版）
    renderer.table = (header: string, body: string): string => {
      return `<div class="overflow-x-auto"><table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">${header}${body}</table></div>`
    }

    marked.use({ renderer })

    try {
      return marked(content)
    } catch (error) {
      console.warn('Markdown parsing failed, falling back to plain text:', error)
      return this.escapeHtml(content).replace(/\n/g, '<br>')
    }
  }

  /**
   * 处理纯文本内容
   */
  private processPlainText(content: string): ReactElement {
    // 检测并渲染链接
    const processedContent = this.detectAndRenderLinks(content)
    
    return (
      <>
        {processedContent.map((part, index) => 
          typeof part === 'string' ? (
            <span key={index}>{part}</span>
          ) : (
            part
          )
        )}
      </>
    )
  }

  /**
   * 检测并渲染链接
   */
  private detectAndRenderLinks(content: string): Array<string | ReactElement> {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts: Array<string | ReactElement> = []
    let lastIndex = 0
    let match

    while ((match = urlRegex.exec(content)) !== null) {
      // 添加链接前的文本
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index))
      }

      // 添加链接
      const url = match[1]
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {url}
        </a>
      )

      lastIndex = match.index + match[0].length
    }

    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return parts.length > 0 ? parts : [content]
  }

  /**
   * 检查是否包含复杂标记
   */
  private hasComplexMarkup(content: string): boolean {
    // 检查是否包含表格、代码块、数学公式等复杂结构
    const complexPatterns = [
      /^\|.*\|.*\|/m, // 表格
      /```[\w]*\n/m,  // 代码块
      /\$\$[\s\S]*?\$\$/m, // 数学公式块
      /^\s*[-*+]\s+.*\n\s*[-*+]\s+/m, // 多行列表
      /^\s*\d+\.\s+.*\n\s*\d+\.\s+/m  // 多行有序列表
    ]

    return complexPatterns.some(pattern => pattern.test(content))
  }

  /**
   * HTML转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * 预处理内容
   */
  protected async preprocessContent(content: string): Promise<string> {
    // 清理多余的空白字符
    return content
      .replace(/\r\n/g, '\n') // 统一换行符
      .replace(/\t/g, '  ')   // 制表符转空格
      .trim()
  }
}

/**
 * 创建文本渲染器实例
 */
export const createTextRenderer = () => new TextRenderer()