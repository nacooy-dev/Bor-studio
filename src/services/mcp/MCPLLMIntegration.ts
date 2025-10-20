/**
 * MCP与LLM集成服务
 * 负责将MCP工具能力注入到LLM对话中，实现智能工具调用
 */

import { mcpService } from '../mcp'
import type { Message } from '@/types'
import type { MCPTool, MCPToolCall } from '@/lib/mcp-host/types'

export interface MCPToolContext {
  name: string
  description: string
  parameters: any
  server: string
  riskLevel: 'low' | 'medium' | 'high'
}

export interface ToolCallRequest {
  tool: string
  parameters: Record<string, any>
  reasoning?: string
}

export interface ToolCallResult {
  success: boolean
  result?: any
  error?: string
  toolName: string
}

/**
 * MCP与LLM集成管理器
 */
export class MCPLLMIntegration {
  private availableTools: MCPToolContext[] = []
  private toolCallHistory: Array<{ call: MCPToolCall; result: any; timestamp: Date }> = []

  /**
   * 初始化工具发现
   */
  async initialize(): Promise<void> {
    await this.discoverTools()
  }

  /**
   * 发现并学习可用的MCP工具
   */
  async discoverTools(): Promise<void> {
    try {
      console.log('🔍 开始发现MCP工具...')
      
      const toolsResult = await mcpService.getTools()
      console.log('🔍 MCP服务返回结果:', toolsResult)
      
      if (!toolsResult.success || !toolsResult.data) {
        console.warn('⚠️ 无法获取MCP工具列表:', toolsResult.error)
        return
      }

      console.log('🔍 原始工具数据:', toolsResult.data)

      this.availableTools = toolsResult.data.map((tool: MCPTool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
        server: tool.server,
        riskLevel: this.assessRiskLevel(tool)
      }))

      console.log(`✅ 发现 ${this.availableTools.length} 个MCP工具:`, 
        this.availableTools.map(t => t.name))
      console.log('✅ 工具详细信息:', this.availableTools)
    } catch (error) {
      console.error('❌ 工具发现失败:', error)
    }
  }

  /**
   * 评估工具风险级别
   */
  private assessRiskLevel(tool: MCPTool): 'low' | 'medium' | 'high' {
    const name = tool.name.toLowerCase()
    const desc = tool.description.toLowerCase()

    // 高风险操作
    if (name.includes('delete') || name.includes('remove') || name.includes('write') ||
        desc.includes('删除') || desc.includes('写入') || desc.includes('修改')) {
      return 'high'
    }

    // 中风险操作
    if (name.includes('create') || name.includes('update') || name.includes('execute') ||
        desc.includes('创建') || desc.includes('执行') || desc.includes('运行')) {
      return 'medium'
    }

    // 低风险操作（读取、查询等）
    return 'low'
  }

  /**
   * 构建包含工具信息的系统提示
   */
  buildToolAwareSystemPrompt(): string {
    console.log('🔧 构建工具感知系统提示，可用工具数量:', this.availableTools.length)
    console.log('🔧 可用工具列表:', this.availableTools.map(t => t.name))
    
    if (this.availableTools.length === 0) {
      console.log('⚠️ 没有可用工具，返回空提示')
      return ''
    }

    const toolDescriptions = this.availableTools.map(tool => {
      const riskEmoji = {
        low: '🟢',
        medium: '🟡', 
        high: '🔴'
      }[tool.riskLevel]

      return `**${tool.name}** ${riskEmoji}
描述: ${tool.description}
服务器: ${tool.server}
参数: ${JSON.stringify(tool.parameters, null, 2)}`
    }).join('\n\n')

    return `
## 🛠️ 可用工具

你现在可以使用以下MCP工具来帮助用户完成任务：

${toolDescriptions}

### 工具调用规则：
1. **识别需求** - 分析用户请求，判断是否需要使用工具
2. **选择工具** - 选择最合适的工具来完成任务
3. **提取参数** - 从用户输入中提取工具所需的参数
4. **风险评估** - 🔴高风险操作需要用户确认，🟡中风险操作需要说明，🟢低风险操作可直接执行
5. **调用格式** - 使用JSON格式调用工具

### 工具调用格式：

**方式1：JSON格式**
\`\`\`json
{
  "action": "call_tool",
  "tool": "工具名称",
  "parameters": {
    "参数名": "参数值"
  },
  "reasoning": "调用原因说明"
}
\`\`\`

**方式2：函数调用格式**
\`\`\`python
search(query='搜索内容')
tool_call(query='查询内容')
\`\`\`

当用户的请求可以通过这些工具完成时，请主动使用相应的工具。
`
  }

  /**
   * 检测消息中的工具调用请求
   */
  detectToolCall(message: string): ToolCallRequest | null {
    console.log('🔍 开始检测工具调用，消息长度:', message.length)
    
    try {
      // 1. 查找函数调用格式的工具调用 (如: tool_call(query='成都天气'))
      const functionCallMatch = message.match(/(\w+)\s*\(\s*([^)]+)\s*\)/)
      if (functionCallMatch) {
        const [, functionName, argsStr] = functionCallMatch
        console.log('📝 找到函数调用格式:', functionName, argsStr)
        
        // 解析参数
        const parameters: Record<string, any> = {}
        
        // 处理简单的参数格式: query='value' 或 query="value"
        const argMatches = argsStr.matchAll(/(\w+)\s*=\s*['"]([^'"]+)['"]/g)
        for (const match of argMatches) {
          parameters[match[1]] = match[2]
        }
        
        // 如果是搜索相关的函数调用
        if (functionName.toLowerCase().includes('search') || 
            functionName.toLowerCase().includes('tool') ||
            Object.keys(parameters).some(key => key.toLowerCase().includes('query'))) {
          
          // 查找匹配的工具
          const matchingTool = this.availableTools.find(tool => 
            tool.name.toLowerCase().includes('search') ||
            tool.server === 'duckduckgo-search'
          )
          
          if (matchingTool) {
            console.log('✅ 成功解析函数调用工具调用:', matchingTool.name, parameters)
            return {
              tool: matchingTool.name,
              parameters: parameters,
              reasoning: `调用${functionName}函数`
            }
          }
        }
      }

      // 2. 查找JSON代码块格式的工具调用
      const jsonMatch = message.match(/```json\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        console.log('📝 找到JSON代码块:', jsonMatch[1])
        try {
          const parsed = JSON.parse(jsonMatch[1])
          if (parsed.action === 'call_tool' && parsed.tool) {
            console.log('✅ 成功解析JSON代码块工具调用:', parsed)
            return {
              tool: parsed.tool,
              parameters: parsed.parameters || {},
              reasoning: parsed.reasoning
            }
          }
        } catch (parseError) {
          console.error('❌ JSON代码块解析失败:', parseError)
        }
      }

      // 2. 查找直接的JSON格式工具调用（更宽松的匹配）
      const patterns = [
        /\{\s*"action"\s*:\s*"call_tool"[\s\S]*?\}/,
        /\{\s*"action"\s*,[\s\S]*?"tool"\s*:\s*"[^"]+"/,  // 处理语法错误的情况
        /\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*?"parameters"\s*:\s*\{[\s\S]*?\}/
      ]

      for (const pattern of patterns) {
        const directJsonMatch = message.match(pattern)
        if (directJsonMatch) {
          console.log('📝 找到直接JSON匹配:', directJsonMatch[0])
          
          // 尝试修复常见的JSON语法错误
          let jsonStr = directJsonMatch[0]
          
          // 清理控制字符
          jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '')
          
          // 修复复杂的格式错误
          // 1. 修复 "action": "call_tool": "search" -> "action": "call_tool", "tool": "search"
          jsonStr = jsonStr.replace(/"action":\s*"call_tool":\s*"([^"]+)"/, '"action": "call_tool", "tool": "$1"')
          
          // 2. 修复 "parameters":": "value" -> "parameters": {"query": "value"}
          jsonStr = jsonStr.replace(/"parameters":\s*":\s*"([^"]+)"/, '"parameters": {"query": "$1"}')
          
          // 3. 修复 "action", 为 "action": "call_tool",
          jsonStr = jsonStr.replace(/"action"\s*,/, '"action": "call_tool",')
          
          // 4. 修复缺少冒号的情况：如 "tool"parameters" -> "tool": "search", "parameters"
          jsonStr = jsonStr.replace(/"tool"(\s*)"parameters"/, '"tool": "search", "parameters"')
          jsonStr = jsonStr.replace(/"tool"(\s*)parameters/, '"tool": "search", "parameters"')
          
          // 5. 修复参数结构问题
          // 如果parameters后面直接跟着字符串，包装成对象
          jsonStr = jsonStr.replace(/"parameters":\s*"([^"]+)"(?=\s*[,}])/, '"parameters": {"query": "$1"}')
          
          // 6. 修复max_results位置错误
          if (jsonStr.includes('"max_results"') && !jsonStr.includes('{"query"')) {
            // 如果有max_results但parameters不是对象，重构
            const maxResultsMatch = jsonStr.match(/"max_results":\s*(\d+)/)
            const queryMatch = jsonStr.match(/"query":\s*"([^"]+)"/)
            
            if (maxResultsMatch && queryMatch) {
              const maxResults = maxResultsMatch[1]
              const query = typeof queryMatch === 'object' ? (queryMatch[1] || 'search query') : 'search query'
              
              // 重构parameters部分
              jsonStr = jsonStr.replace(/"parameters":[^}]*"max_results":\s*\d+[^}]*/, 
                `"parameters": {"query": "${query}", "max_results": ${maxResults}}`)
            }
          }
          
          // 7. 修复其他常见的格式问题
          jsonStr = jsonStr.replace(/,(\s*)}/, '$1}') // 移除尾随逗号
          jsonStr = jsonStr.replace(/,(\s*)]/, '$1]') // 移除数组尾随逗号
          
          // 8. 确保有完整的结构
          if (!jsonStr.includes('"action"')) {
            // 如果没有action字段，但有tool字段，添加action
            if (jsonStr.includes('"tool"') || jsonStr.includes('search')) {
              jsonStr = jsonStr.replace(/\{/, '{"action": "call_tool", ')
            }
          }
          
          // 9. 确保tool字段存在
          if (!jsonStr.includes('"tool"') && jsonStr.includes('search')) {
            jsonStr = jsonStr.replace(/"action":\s*"call_tool"/, '"action": "call_tool", "tool": "search"')
          }
          
          console.log('🔧 修复后的JSON:', jsonStr)
          
          try {
            const parsed = JSON.parse(jsonStr)
            if (parsed.tool) {
              console.log('✅ 成功解析修复后的工具调用:', parsed)
              return {
                tool: parsed.tool,
                parameters: parsed.parameters || {},
                reasoning: parsed.reasoning || '工具调用'
              }
            }
          } catch (parseError) {
            console.error('❌ 修复后JSON解析仍失败:', parseError)
            
            // 尝试更激进的修复
            const aggressivelyFixed = this.aggressiveJsonFix(directJsonMatch[0])
            if (aggressivelyFixed) {
              console.log('🔧 激进修复后的JSON:', aggressivelyFixed)
              try {
                const parsed = JSON.parse(aggressivelyFixed)
                if (parsed.tool) {
                  console.log('✅ 激进修复成功:', parsed)
                  return {
                    tool: parsed.tool,
                    parameters: parsed.parameters || {},
                    reasoning: parsed.reasoning || '工具调用'
                  }
                }
              } catch (aggressiveError) {
                console.error('❌ 激进修复也失败:', aggressiveError)
              }
            }
          }
        }
      }

      // 3. 查找简化格式的工具调用
      const simpleMatch = message.match(/\[TOOL_CALL\]\s*(\{[\s\S]*?\})\s*\[\/TOOL_CALL\]/)
      if (simpleMatch) {
        console.log('📝 找到简化格式工具调用:', simpleMatch[1])
        try {
          const parsed = JSON.parse(simpleMatch[1])
          if (parsed.tool) {
            console.log('✅ 成功解析简化格式工具调用:', parsed)
            return {
              tool: parsed.tool,
              parameters: parsed.parameters || {},
              reasoning: parsed.reasoning
            }
          }
        } catch (parseError) {
          console.error('❌ 简化格式解析失败:', parseError)
        }
      }

      console.log('ℹ️ 未检测到有效的工具调用')
      return null
    } catch (error) {
      console.error('❌ 工具调用检测异常:', error)
      return null
    }
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(request: ToolCallRequest): Promise<ToolCallResult> {
    try {
      console.log('🔧 执行工具调用:', request)

      // 验证工具是否存在并找到对应的服务器
      const tool = this.availableTools.find(t => t.name === request.tool)
      if (!tool) {
        // 如果找不到工具，尝试刷新工具列表
        await this.discoverTools()
        const refreshedTool = this.availableTools.find(t => t.name === request.tool)
        
        if (!refreshedTool) {
          return {
            success: false,
            error: `工具 "${request.tool}" 不存在。可用工具: ${this.availableTools.map(t => t.name).join(', ')}`,
            toolName: request.tool
          }
        }
        
        // 使用刷新后找到的工具
        const mcpCall: MCPToolCall = {
          tool: request.tool,
          parameters: request.parameters,
          server: refreshedTool.server
        }
        
        return await this.executeToolWithServer(mcpCall, request.tool)
      }

      // 构建MCP工具调用
      const mcpCall: MCPToolCall = {
        tool: request.tool,
        parameters: request.parameters,
        server: tool.server
      }

      return await this.executeToolWithServer(mcpCall, request.tool)
      
    } catch (error) {
      console.error('❌ 工具执行异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        toolName: request.tool
      }
    }
  }

  /**
   * 使用指定服务器执行工具调用（带性能优化和重试机制）
   */
  private async executeToolWithServer(mcpCall: MCPToolCall, toolName: string): Promise<ToolCallResult> {
    try {
      console.log('📡 发送工具调用到服务器:', mcpCall)
      
      // 记录开始时间
      const startTime = Date.now()
      
      // 增加超时时间并添加重试机制
      let lastError: Error | null = null;
      
      // 尝试最多3次
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📡 尝试执行工具调用 (第${attempt}次尝试):`, mcpCall);
          
          const result = await Promise.race([
            mcpService.executeTool(mcpCall),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool execution timeout after 30 seconds (attempt ${attempt})`)), 30000)
            )
          ])
          
          const executionTime = Date.now() - startTime
          console.log(`⏱️ 工具执行耗时: ${executionTime}ms (第${attempt}次尝试)`)
          
          // 记录调用历史
          this.toolCallHistory.push({
            call: mcpCall,
            result: (result as any).data,
            timestamp: new Date()
          })

          if ((result as any).success) {
            console.log('✅ 工具调用成功:', (result as any).data)
            return {
              success: true,
              result: (result as any).data,
              toolName: toolName
            }
          } else {
            const error = (result as any).error || 'Unknown error';
            console.warn(`⚠️ 工具调用失败 (第${attempt}次尝试):`, error);
            lastError = new Error(error);
            
            // 如果不是最后一次尝试，等待一段时间再重试
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
            }
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`⚠️ 工具调用异常 (第${attempt}次尝试):`, error);
          
          // 如果不是最后一次尝试，等待一段时间再重试
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
          }
        }
      }
      
      // 所有尝试都失败了
      throw new Error(`Tool execution failed after 3 attempts: ${lastError?.message || 'Unknown error'}`)
    } catch (error) {
      console.error('❌ 服务器工具调用最终失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '服务器调用失败',
        toolName: toolName
      }
    }
  }

  /**
   * 格式化工具调用结果为用户友好的消息
   */
  formatToolResult(result: ToolCallResult): string {
    if (result.success) {
      // 特殊处理搜索结果，不使用代码块包装
      if (result.toolName === 'search' && typeof result.result === 'string') {
        return this.formatSearchResult(result.result)
      }
      
      return `🔧 **工具执行成功** (${result.toolName})

**执行结果:**
\`\`\`
${typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}
\`\`\``
    } else {
      return `❌ **工具执行失败** (${result.toolName})

**错误信息:** ${result.error}`
    }
  }

  /**
   * 格式化搜索结果，保持链接可点击
   */
  private formatSearchResult(resultText: string): string {
    console.log('🔍 开始格式化搜索结果:', resultText.substring(0, 200) + '...')
    
    // 解析搜索结果文本
    const lines = resultText.split('\n')
    const formattedLines: string[] = []
    
    let currentItem: { title?: string, url?: string, summary?: string } = {}
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (trimmedLine.match(/^\d+\./)) {
        // 新的搜索结果项开始
        if (currentItem.title) {
          const formatted = this.formatSearchItem(currentItem)
          console.log('📝 格式化项目:', currentItem, '→', formatted)
          formattedLines.push(formatted)
        }
        currentItem = { title: trimmedLine }
      } else if (trimmedLine.startsWith('URL:')) {
        currentItem.url = trimmedLine.replace('URL:', '').trim()
      } else if (trimmedLine.startsWith('Summary:')) {
        currentItem.summary = trimmedLine.replace('Summary:', '').trim()
      } else if (trimmedLine && !trimmedLine.startsWith('Found')) {
        // 继续当前项的内容
        if (currentItem.summary) {
          currentItem.summary += ' ' + trimmedLine
        } else if (currentItem.title) {
          currentItem.title += ' ' + trimmedLine
        }
      }
    }
    
    // 处理最后一个项目
    if (currentItem.title) {
      const formatted = this.formatSearchItem(currentItem)
      console.log('📝 格式化最后项目:', currentItem, '→', formatted)
      formattedLines.push(formatted)
    }
    
    const finalResult = `🔍 **搜索结果**\n\n${formattedLines.join('\n\n')}`
    console.log('✅ 最终格式化结果:', finalResult)
    return finalResult
  }

  /**
   * 格式化单个搜索项
   */
  private formatSearchItem(item: { title?: string, url?: string, summary?: string }): string {
    const parts: string[] = []
    
    if (item.title) {
      // 清理标题中的数字前缀
      const cleanTitle = item.title.replace(/^\d+\.\s*/, '')
      if (item.url) {
        // 将标题作为链接文本，使用更明确的Markdown格式
        parts.push(`**[${cleanTitle}](${item.url})**`)
        // 同时添加一个单独的URL行，确保链接可见
        parts.push(`🔗 ${item.url}`)
      } else {
        parts.push(`**${cleanTitle}**`)
      }
    } else if (item.url) {
      // 如果没有标题，直接显示URL作为链接
      parts.push(`🔗 [${item.url}](${item.url})`)
    }
    
    if (item.summary) {
      parts.push(`\n${item.summary}`)
    }
    
    return parts.join('\n')
  }



  /**
   * 激进的JSON修复方法
   */
  private aggressiveJsonFix(jsonStr: string): string | null {
    try {
      console.log('🔧 开始激进修复，原始字符串:', jsonStr)
      
      // 清理所有控制字符和不可见字符
      let fixed = jsonStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      
      // 尝试从文本中提取关键信息，使用更宽松的匹配
      const toolPatterns = [
        /"tool"[^"]*"([^"]+)"/,
        /search/i,
        /fetch_content/i
      ]
      
      const queryPatterns = [
        /"query"[^"]*"([^"]+)"/,
        /"parameters"[^"]*"([^"]+)"/
      ]
      
      const maxResultsPatterns = [
        /"max_results"[^:]*:\s*(\d+)/,
        /(\d+)/
      ]
      
      const reasoningPatterns = [
        /"reasoning"[^"]*"([^"]+)"/,
        /查询.*天气/,
        /搜索.*信息/
      ]
      
      // 提取工具名
      let toolName = 'search' // 默认
      for (const pattern of toolPatterns) {
        const match = fixed.match(pattern)
        if (match) {
          if (typeof match[1] === 'string') {
            toolName = match[1]
          } else if (pattern.source.includes('search')) {
            toolName = 'search'
          }
          break
        }
      }
      
      // 提取查询内容
      let query = 'search query' // 默认
      for (const pattern of queryPatterns) {
        const match = fixed.match(pattern)
        if (match) {
          if (typeof match[1] === 'string') {
            query = match[1]
          }
          break
        }
      }
      
      // 提取最大结果数
      let maxResults = 5 // 默认
      for (const pattern of maxResultsPatterns) {
        const match = fixed.match(pattern)
        if (match && match[1]) {
          const num = parseInt(match[1])
          if (num > 0 && num <= 20) {
            maxResults = num
            break
          }
        }
      }
      
      // 提取推理信息
      let reasoning = '搜索查询' // 默认
      for (const pattern of reasoningPatterns) {
        const match = fixed.match(pattern)
        if (match) {
          if (typeof match[1] === 'string') {
            reasoning = match[1]
          } else if (pattern.source.includes('查询.*天气')) {
            reasoning = '查询天气信息'
          }
          break
        }
      }
      
      // 重新构建JSON
      const reconstructed = {
        action: "call_tool",
        tool: toolName,
        parameters: {
          query: query,
          max_results: maxResults
        },
        reasoning: reasoning
      }
      
      const result = JSON.stringify(reconstructed)
      console.log('✅ 激进修复成功，重构的JSON:', result)
      return result
      
    } catch (error) {
      console.error('❌ 激进修复失败:', error)
      return null
    }
  }

  /**
   * 智能匹配用户意图到工具
   */
  matchToolsForIntent(userInput: string): MCPToolContext[] {
    const input = userInput.toLowerCase()
    const matchedTools: Array<{ tool: MCPToolContext; score: number }> = []

    for (const tool of this.availableTools) {
      let score = 0
      const toolName = tool.name.toLowerCase()
      const toolDesc = tool.description.toLowerCase()

      // 直接名称匹配
      if (input.includes(toolName)) {
        score += 10
      }

      // 描述关键词匹配
      const descWords = toolDesc.split(/\s+/)
      for (const word of descWords) {
        if (input.includes(word) && word.length > 2) {
          score += 2
        }
      }

      // 功能意图匹配
      if (this.matchesFunctionalIntent(input, tool)) {
        score += 5
      }

      if (score > 0) {
        matchedTools.push({ tool, score })
      }
    }

    // 按分数排序并返回工具
    return matchedTools
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // 最多返回3个匹配的工具
      .map(item => item.tool)
  }

  /**
   * 匹配功能意图
   */
  private matchesFunctionalIntent(input: string, tool: MCPToolContext): boolean {
    const intentMap = {
      '读取': ['read', 'get', 'fetch', '读取', '获取', '查看'],
      '写入': ['write', 'create', 'save', '写入', '创建', '保存'],
      '搜索': ['search', 'find', 'query', '搜索', '查找', '查询'],
      '删除': ['delete', 'remove', '删除', '移除'],
      '列表': ['list', 'ls', 'dir', '列表', '目录']
    }

    for (const [intent, keywords] of Object.entries(intentMap)) {
      if (input.includes(intent)) {
        return keywords.some(keyword => 
          tool.name.toLowerCase().includes(keyword) || 
          tool.description.toLowerCase().includes(keyword)
        )
      }
    }

    return false
  }

  /**
   * 获取工具调用历史
   */
  getToolCallHistory(): Array<{ call: MCPToolCall; result: any; timestamp: Date }> {
    return this.toolCallHistory.slice(-10) // 返回最近10次调用
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): MCPToolContext[] {
    return this.availableTools
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.availableTools = []
    this.toolCallHistory = []
  }
}

// 创建单例实例
export const mcpLLMIntegration = new MCPLLMIntegration()