/**
 * MCP对话处理器
 * 通过自然语言处理MCP相关的对话请求
 */

import { mcpService } from '@/services/mcp'
import type { Message } from '@/types'

export interface MCPDialogueResponse {
  message: string
  actions?: Array<{
    type: string
    payload: any
  }>
  requiresLLM?: boolean
  followUpQuestions?: string[]
}

export class MCPDialogueHandler {
  /**
   * 处理MCP相关的对话
   */
  async handleMCPDialogue(userInput: string, conversationHistory: Message[]): Promise<MCPDialogueResponse> {
    const input = userInput.toLowerCase()
    
    // 检查MCP服务器状态
    if (this.isStatusQuery(input)) {
      return await this.handleStatusQuery()
    }
    
    // 添加MCP服务器
    if (this.isAddServerRequest(input)) {
      return await this.handleAddServerRequest(userInput)
    }
    
    // 启动/停止服务器
    if (this.isServerControlRequest(input)) {
      return await this.handleServerControlRequest(userInput)
    }
    
    // 工具查询
    if (this.isToolQuery(input)) {
      return await this.handleToolQuery(userInput)
    }
    
    // 删除服务器
    if (this.isRemoveServerRequest(input)) {
      return await this.handleRemoveServerRequest(userInput)
    }
    
    // 工具执行
    if (this.isToolExecutionRequest(input)) {
      return await this.handleToolExecution(userInput, conversationHistory)
    }
    
    // 通用MCP帮助
    if (this.isMCPHelpRequest(input)) {
      return this.handleMCPHelp()
    }
    
    // 如果没有匹配到特定的MCP操作，打开MCP配置页面
    const suggestions: Array<{
      type: string
      payload: any
      url?: URL
      text?: string
    }> = []

    // 添加跳转到配置页面的建议
    suggestions.push({
      type: 'navigation',
      payload: { path: '/config#mcp' },
      text: '前往MCP配置页面'
    })

    return {
      message: '🔧 正在打开MCP工具配置页面！\n\n' +
               '在配置页面中，您可以：\n' +
               '• 📋 查看所有预设的MCP服务器\n' +
               '• ➕ 一键添加常用工具（文件系统、搜索、数据库等）\n' +
               '• ▶️ 启动和停止服务器\n' +
               '• 🛠️ 查看每个服务器的可用工具\n' +
               '• 📊 实时监控服务器状态\n\n' +
               '配置完成后，您就可以通过对话直接使用这些工具了！',
      actions: suggestions,
      followUpQuestions: [
        '检查MCP状态',
        'MCP帮助'
      ]
    }
  }

  /**
   * 检查是否是状态查询
   */
  private isStatusQuery(input: string): boolean {
    return (input.includes('mcp') || input.includes('工具')) && 
           (input.includes('状态') || input.includes('检查') || input.includes('查看'))
  }

  /**
   * 处理状态查询
   */
  private async handleStatusQuery(): Promise<MCPDialogueResponse> {
    try {
      const [serversResult, toolsResult] = await Promise.all([
        mcpService.getServers(),
        mcpService.getTools()
      ])
      
      const servers = serversResult.success ? serversResult.data || [] : []
      const tools = toolsResult.success ? toolsResult.data || [] : []
      
      // 分类统计
      const runningServers = servers.filter((s: any) => s.status === 'running')
      const stoppedServers = servers.filter((s: any) => s.status === 'stopped')
      const errorServers = servers.filter((s: any) => s.status === 'error')
      
      let message = '📊 MCP工具状态报告\n\n'
      
      if (servers.length === 0) {
        message += '❌ 暂无MCP服务器\n\n'
        message += '**建议操作：**\n'
        message += '• 说"添加文件系统工具"来添加文件操作工具\n'
        message += '• 说"添加DuckDuckGo搜索工具"来添加搜索功能\n'
        message += '• 说"添加网络研究工具"来添加研究分析功能\n'
        message += '• 说"MCP帮助"了解更多功能'
      } else {
        message += `**服务器总数：** ${servers.length}\n`
        message += `**运行中：** ${runningServers.length}\n`
        message += `**已停止：** ${stoppedServers.length}\n`
        message += `**错误：** ${errorServers.length}\n`
        message += `**可用工具：** ${tools.length}\n\n`
        
        if (runningServers.length > 0) {
          message += '**运行中的服务器：**\n'
          for (const server of runningServers) {
            const serverTools = tools.filter((t: any) => t.server === server.id)
            message += `• ${server.name} (${serverTools.length} 个工具)\n`
          }
          message += '\n'
        }
        
        if (stoppedServers.length > 0) {
          message += '**已停止的服务器：**\n'
          for (const server of stoppedServers) {
            message += `• ${server.name}\n`
          }
          message += '\n'
        }
        
        if (errorServers.length > 0) {
          message += '**错误的服务器：**\n'
          for (const server of errorServers) {
            message += `• ${server.name}: ${server.lastError}\n`
          }
        }
      }
      
      const followUpQuestions = []
      if (stoppedServers.length > 0) {
        followUpQuestions.push(`启动${stoppedServers[0].name}`)
      }
      if (runningServers.length > 0) {
        followUpQuestions.push('有什么工具可用')
      }
      if (servers.length === 0) {
        followUpQuestions.push('添加文件系统工具')
      }
      
      return {
        message,
        followUpQuestions
      }
    } catch (error) {
      return {
        message: `❌ 获取MCP状态失败：${error instanceof Error ? error.message : '未知错误'}`,
        followUpQuestions: ['MCP帮助']
      }
    }
  }

  /**
   * 检查是否是添加服务器请求
   */
  private isAddServerRequest(input: string): boolean {
    return input.includes('添加') && 
           (input.includes('工具') || input.includes('服务器') || input.includes('mcp') ||
            input.includes('文件系统') || input.includes('搜索') || input.includes('数据库') ||
            input.includes('duckduckgo') || input.includes('网络研究') || input.includes('网页获取'))
  }

  /**
   * 处理添加服务器请求
   */
  private async handleAddServerRequest(userInput: string): Promise<MCPDialogueResponse> {
    const input = userInput.toLowerCase()
    const presetServers = mcpService.getPresetServers()
    
    // 识别要添加的服务器类型
    let targetServer = null
    
    if (input.includes('文件系统') || input.includes('文件')) {
      targetServer = presetServers.find(s => s.id === 'filesystem')
    } else if (input.includes('duckduckgo') || input.includes('鸭鸭')) {
      targetServer = presetServers.find(s => s.id === 'duckduckgo-search')
    } else if (input.includes('网络研究') || input.includes('研究工具')) {
      targetServer = presetServers.find(s => s.id === 'web-research')
    } else if (input.includes('时间服务器') || input.includes('时间工具')) {
      targetServer = presetServers.find(s => s.id === 'time-server')
    } else if (input.includes('搜索') || input.includes('网络')) {
      // 默认推荐DuckDuckGo搜索，因为无需API密钥
      targetServer = presetServers.find(s => s.id === 'duckduckgo-search')
    } else if (input.includes('获取网页') || input.includes('抓取')) {
      targetServer = presetServers.find(s => s.id === 'web-fetch')
    } else if (input.includes('数据库') || input.includes('sqlite')) {
      targetServer = presetServers.find(s => s.id === 'sqlite')
    }
    
    if (!targetServer) {
      return {
        message: '请指定要添加的工具类型：\n\n' +
                 '• **文件系统工具** - 文件读写、目录操作\n' +
                 '• **DuckDuckGo搜索工具** - 免费搜索引擎，无需API密钥\n' +
                 '• **网络研究工具** - 深度网络研究和内容分析\n' +
                 '• **网页获取工具** - 获取网页内容\n' +
                 '• **数据库工具** - SQLite数据库操作\n\n' +
                 '例如：说"添加DuckDuckGo搜索工具"',
        followUpQuestions: [
          '添加文件系统工具',
          '添加DuckDuckGo搜索工具',
          '添加网络研究工具',
          '添加数据库工具'
        ]
      }
    }
    
    try {
      const result = await mcpService.addServer(targetServer)
      
      if (result.success) {
        let message = `✅ 已添加 **${targetServer.name}**\n\n`
        message += `**描述：** ${targetServer.description}\n`
        message += `**命令：** ${targetServer.command} ${targetServer.args.join(' ')}\n\n`
        
        if (targetServer.autoStart) {
          message += '服务器将自动启动...'
        } else {
          message += `说"启动${targetServer.name}"来启动服务器`
        }
        
        return {
          message,
          followUpQuestions: [
            `启动${targetServer.name}`,
            '检查MCP状态'
          ]
        }
      } else {
        return {
          message: `❌ 添加服务器失败：${result.error}`,
          followUpQuestions: ['MCP帮助']
        }
      }
    } catch (error) {
      return {
        message: `❌ 添加服务器时出错：${error instanceof Error ? error.message : '未知错误'}`,
        followUpQuestions: ['MCP帮助']
      }
    }
  }

  /**
   * 检查是否是服务器控制请求
   */
  private isServerControlRequest(input: string): boolean {
    return (input.includes('启动') || input.includes('停止')) && 
           (input.includes('服务器') || input.includes('工具') || input.includes('server') ||
            input.includes('文件系统') || input.includes('搜索') || input.includes('数据库') ||
            input.includes('duckduckgo') || input.includes('search') || input.includes('研究') ||
            input.includes('获取') || input.includes('fetch') || input.includes('time') ||
            input.includes('时间') || input.includes('file') || input.includes('system'))
  }

  /**
   * 处理服务器控制请求
   */
  private async handleServerControlRequest(userInput: string): Promise<MCPDialogueResponse> {
    const input = userInput.toLowerCase()
    const isStart = input.includes('启动')
    const isStop = input.includes('停止')
    
    try {
      const serversResult = await mcpService.getServers()
      if (!serversResult.success || !serversResult.data) {
        return {
          message: '❌ 无法获取服务器列表',
          followUpQuestions: ['检查MCP状态']
        }
      }
      
      const servers = serversResult.data
      
      // 识别目标服务器
      let targetServer = null
      
      if (input.includes('文件系统') || input.includes('文件')) {
        targetServer = servers.find((s: any) => s.id === 'filesystem')
      } else if (input.includes('duckduckgo') || input.includes('鸭鸭')) {
        targetServer = servers.find((s: any) => s.id === 'duckduckgo-search')
      } else if (input.includes('网络研究') || input.includes('研究')) {
        targetServer = servers.find((s: any) => s.id === 'web-research')
      } else if (input.includes('time') || input.includes('时间')) {
        targetServer = servers.find((s: any) => s.id === 'time-server')
      } else if (input.includes('搜索')) {
        targetServer = servers.find((s: any) => s.id === 'duckduckgo-search')
      } else if (input.includes('获取') || input.includes('抓取')) {
        targetServer = servers.find((s: any) => s.id === 'web-fetch')
      } else if (input.includes('数据库') || input.includes('sqlite')) {
        targetServer = servers.find((s: any) => s.id === 'sqlite')
      } else {
        // 尝试从服务器名称匹配
        for (const server of servers) {
          const serverNameLower = server.name.toLowerCase()
          // 检查完整名称匹配
          if (input.includes(serverNameLower)) {
            targetServer = server
            break
          }
          // 检查部分名称匹配
          const nameWords = serverNameLower.split(' ')
          if (nameWords.some((word: string) => word.length > 2 && input.includes(word))) {
            targetServer = server
            break
          }
        }
      }
      
      if (!targetServer) {
        const availableServers = servers.map((s: any) => `• ${s.name} (${s.status})`).join('\n')
        return {
          message: `请指定要${isStart ? '启动' : '停止'}的服务器：

${availableServers}

` +
                   `例如：说"${isStart ? '启动' : '停止'}文件系统服务器"`,
          followUpQuestions: servers.map((s: any) => `${isStart ? '启动' : '停止'}${s.name}`)
        }
      }
      
      if (isStart) {
        if (targetServer.status === 'running') {
          return {
            message: `✅ ${targetServer.name} 已经在运行中`,
            followUpQuestions: ['有什么工具可用', '检查MCP状态']
          }
        }
        
        const result = await mcpService.startServer(targetServer.id)
        if (result.success) {
          return {
            message: `✅ ${targetServer.name} 启动成功！\n\n现在可以使用相关工具了。`,
            followUpQuestions: ['有什么工具可用', '检查MCP状态']
          }
        } else {
          return {
            message: `❌ 启动 ${targetServer.name} 失败：${result.error}`,
            followUpQuestions: ['检查MCP状态', 'MCP帮助']
          }
        }
      } else if (isStop) {
        if (targetServer.status === 'stopped') {
          return {
            message: `✅ ${targetServer.name} 已经停止`,
            followUpQuestions: [`启动${targetServer.name}`, '检查MCP状态']
          }
        }
        
        const result = await mcpService.stopServer(targetServer.id)
        if (result.success) {
          return {
            message: `✅ ${targetServer.name} 已停止`,
            followUpQuestions: [`启动${targetServer.name}`, '检查MCP状态']
          }
        } else {
          return {
            message: `❌ 停止 ${targetServer.name} 失败：${result.error}`,
            followUpQuestions: ['检查MCP状态', 'MCP帮助']
          }
        }
      }
      
      return {
        message: '请指定要启动还是停止服务器',
        followUpQuestions: ['检查MCP状态']
      }
    } catch (error) {
      return {
        message: `❌ 服务器操作失败：${error instanceof Error ? error.message : '未知错误'}`,
        followUpQuestions: ['检查MCP状态', 'MCP帮助']
      }
    }
  }

  /**
   * 检查是否是工具查询
   */
  private isToolQuery(input: string): boolean {
    return (input.includes('工具') || input.includes('功能')) && 
           (input.includes('有什么') || input.includes('可用') || input.includes('列表') || input.includes('查看'))
  }

  /**
   * 处理工具查询
   */
  private async handleToolQuery(userInput: string): Promise<MCPDialogueResponse> {
    try {
      const toolsResult = await mcpService.getTools()
      if (!toolsResult.success || !toolsResult.data) {
        return {
          message: '❌ 无法获取工具列表',
          followUpQuestions: ['检查MCP状态']
        }
      }
      
      const tools = toolsResult.data
      
      if (tools.length === 0) {
        return {
          message: '❌ 暂无可用工具\n\n请先添加并启动MCP服务器：',
          followUpQuestions: [
            '添加文件系统工具',
            '检查MCP状态'
          ]
        }
      }
      
      // 按服务器分组工具
      const toolsByServer = tools.reduce((acc: any, tool: any) => {
        if (!acc[tool.server]) {
          acc[tool.server] = []
        }
        acc[tool.server].push(tool)
        return acc
      }, {} as Record<string, any[]>)
      
      let message = `🛠️ 可用工具列表 (${tools.length} 个)\n\n`
      
      for (const [serverId, serverTools] of Object.entries(toolsByServer)) {
        const serverName = (serverTools as any[])[0]?.server || serverId
        message += `**${serverName}：**\n`
        
        for (const tool of (serverTools as any[])) {
          const riskEmoji = tool.riskLevel === 'high' ? '⚠️' : tool.riskLevel === 'medium' ? '⚡' : '✅'
          message += `• ${riskEmoji} **${tool.name}** - ${tool.description}\n`
        }
        message += '\n'
      }
      
      message += '**使用方法：**\n'
      message += '直接说出您的需求，我会自动选择合适的工具执行。\n\n'
      message += '例如：\n'
      message += '• "帮我读取桌面上的readme.txt文件"\n'
      message += '• "搜索关于AI的最新信息"\n'
      message += '• "列出当前目录的所有文件"'
      
      return {
        message,
        followUpQuestions: [
          '帮我读取文件',
          '搜索信息',
          '列出文件'
        ]
      }
    } catch (error) {
      return {
        message: `❌ 获取工具列表失败：${error instanceof Error ? error.message : '未知错误'}`,
        followUpQuestions: ['检查MCP状态', 'MCP帮助']
      }
    }
  }

  /**
   * 检查是否是工具执行请求
   */
  private isToolExecutionRequest(input: string): boolean {
    const executionKeywords = [
      '帮我', '请', '读取', '写入', '搜索', '查找', '列出', '创建', '删除', '修改'
    ]
    
    return executionKeywords.some(keyword => input.includes(keyword)) &&
           (input.includes('文件') || input.includes('目录') || input.includes('搜索') || 
            input.includes('数据') || input.length > 10) // 较长的描述性请求
  }

  /**
   * 处理工具执行
   */
  private async handleToolExecution(userInput: string, conversationHistory: Message[]): Promise<MCPDialogueResponse> {
    try {
      const toolsResult = await mcpService.getTools()
      if (!toolsResult.success || !toolsResult.data) {
        return {
          message: '❌ 无法获取工具列表，请先启动MCP服务器',
          followUpQuestions: ['检查MCP状态', '添加文件系统工具']
        }
      }
      
      const tools = toolsResult.data
      if (tools.length === 0) {
        return {
          message: '❌ 暂无可用工具，请先添加并启动MCP服务器',
          followUpQuestions: ['添加文件系统工具']
        }
      }
      
      // 简单的工具匹配逻辑
      const matchedTool = this.findBestMatchingTool(userInput, tools)
      
      if (!matchedTool) {
        return {
          message: '❓ 无法确定要使用的工具\n\n' +
                   '请更具体地描述您的需求，或查看可用工具列表。',
          followUpQuestions: [
            '有什么工具可用',
            '帮我读取文件',
            '搜索信息'
          ]
        }
      }
      
      // 提取参数
      const parameters = this.extractParameters(userInput, matchedTool)
      
      // 检查必需参数
      const requiredParams = matchedTool.schema?.required || []
      const missingParams = requiredParams.filter((param: string) => !parameters[param])
      
      if (missingParams.length > 0) {
        return {
          message: `🔧 使用 **${matchedTool.name}** 工具需要以下参数：\n\n` +
                   missingParams.map((param: string) => `• **${param}**`).join('\n') + '\n\n' +
                   '请提供更详细的信息。',
          followUpQuestions: [
            '有什么工具可用',
            'MCP帮助'
          ]
        }
      }
      
      // 执行工具
      const executionResult = await mcpService.executeTool({
        tool: matchedTool.name,
        server: matchedTool.server,
        parameters,
        requestId: `chat_${Date.now()}`
      })
      
      if (executionResult.success && executionResult.data?.success) {
        const result = executionResult.data.data
        let message = `✅ **${matchedTool.name}** 执行成功\n\n`
        
        if (typeof result === 'string') {
          message += result
        } else if (result && typeof result === 'object') {
          message += '``json\n' + JSON.stringify(result, null, 2) + '\n```'
        } else {
          message += '操作完成'
        }
        
        return {
          message,
          followUpQuestions: [
            '继续使用工具',
            '有什么工具可用'
          ]
        }
      } else {
        const error = executionResult.data?.error || executionResult.error || '未知错误'
        return {
          message: `❌ **${matchedTool.name}** 执行失败：${error}`,
          followUpQuestions: [
            '有什么工具可用',
            '检查MCP状态'
          ]
        }
      }
    } catch (error) {
      return {
        message: `❌ 工具执行出错：${error instanceof Error ? error.message : '未知错误'}`,
        followUpQuestions: ['检查MCP状态', 'MCP帮助']
      }
    }
  }

  /**
   * 处理工具使用请求（带性能优化）
   */
  private async handleToolUsage(userInput: string): Promise<MCPDialogueResponse> {
    try {
      console.log('🔧 处理工具使用请求:', userInput)
      
      // 获取可用工具
      const toolsResult = await mcpService.getTools()
      if (!toolsResult.success || !toolsResult.data) {
        return {
          message: '❌ 无法获取工具列表',
          followUpQuestions: ['检查MCP状态']
        }
      }
      
      const tools = toolsResult.data
      
      // 简单的工具匹配逻辑
      const matchedTool = this.findBestMatchingTool(userInput, tools)
      
      if (!matchedTool) {
        return {
          message: '❓ 无法确定要使用的工具\n\n' +
                   '请更具体地描述您的需求，或查看可用工具列表。',
          followUpQuestions: [
            '有什么工具可用',
            '帮我读取文件',
            '搜索信息'
          ]
        }
      }
      
      // 提取参数
      const parameters = this.extractParameters(userInput, matchedTool)
      
      // 检查必需参数
      const requiredParams = matchedTool.schema?.required || []
      const missingParams = requiredParams.filter((param: string) => !parameters[param])
      
      if (missingParams.length > 0) {
        return {
          message: `🔧 使用 **${matchedTool.name}** 工具需要以下参数：\n\n` +
                   missingParams.map((param: string) => `• **${param}**`).join('\n') + '\n\n' +
                   '请提供更详细的信息。',
          followUpQuestions: [
            '有什么工具可用',
            'MCP帮助'
          ]
        }
      }
      
      // 执行工具，增加超时时间和重试机制
      let lastError: Error | null = null;
      let executionResult: any = null;
      let success = false;
      
      // 尝试最多3次
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📡 尝试执行工具 (第${attempt}次尝试):`, matchedTool.name);
          
          const executionPromise = mcpService.executeTool({
            tool: matchedTool.name,
            server: matchedTool.server,
            parameters,
            requestId: `chat_${Date.now()}_attempt_${attempt}`
          })
          
          executionResult = await Promise.race([
            executionPromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool execution timeout after 30 seconds (attempt ${attempt})`)), 30000)
            )
          ])
          
          // 检查执行结果
          if ((executionResult as any).success && (executionResult as any).data?.success) {
            success = true;
            console.log(`✅ 工具执行成功 (第${attempt}次尝试)`);
            break;
          } else {
            const error = (executionResult as any).data?.error || (executionResult as any).error || 'Unknown error';
            console.warn(`⚠️ 工具执行失败 (第${attempt}次尝试):`, error);
            lastError = new Error(error);
            
            // 如果不是最后一次尝试，等待一段时间再重试
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
            }
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`⚠️ 工具执行异常 (第${attempt}次尝试):`, error);
          
          // 如果不是最后一次尝试，等待一段时间再重试
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
          }
        }
      }
      
      // 检查最终结果
      if (success && executionResult) {
        const result = (executionResult as any).data.data
        let message = `✅ **${matchedTool.name}** 执行成功\n\n`
        
        if (typeof result === 'string') {
          message += result
        } else if (result && typeof result === 'object') {
          message += '``json\n' + JSON.stringify(result, null, 2) + '\n```'
        } else {
          message += '操作完成'
        }
        
        return {
          message,
          followUpQuestions: [
            '继续使用工具',
            '有什么工具可用'
          ]
        }
      } else {
        const error = lastError?.message || (executionResult as any)?.data?.error || (executionResult as any)?.error || '未知错误'
        return {
          message: `❌ **${matchedTool.name}** 执行失败：${error}`,
          followUpQuestions: [
            '有什么工具可用',
            '检查MCP状态'
          ]
        }
      }
    } catch (error) {
      return {
        message: `❌ 工具执行出错：${error instanceof Error ? error.message : '未知错误'}`,
        followUpQuestions: ['检查MCP状态', 'MCP帮助']
      }
    }
  }

  /**
   * 检查是否是删除服务器请求
   */
  private isRemoveServerRequest(input: string): boolean {
    return input.includes('删除') && 
           (input.includes('服务器') || input.includes('工具') || 
            input.includes('duckduckgo') || input.includes('文件系统') || 
            input.includes('搜索') || input.includes('数据库') || input.includes('时间'))
  }

  /**
   * 处理删除服务器请求
   */
  private async handleRemoveServerRequest(userInput: string): Promise<MCPDialogueResponse> {
    const input = userInput.toLowerCase()
    
    try {
      const serversResult = await mcpService.getServers()
      if (!serversResult.success || !serversResult.data) {
        return {
          message: '❌ 无法获取服务器列表',
          followUpQuestions: ['检查MCP状态']
        }
      }
      
      const servers = serversResult.data
      
      // 识别目标服务器
      let targetServer = null
      
      if (input.includes('duckduckgo') || input.includes('鸭鸭')) {
        targetServer = servers.find((s: any) => s.id === 'duckduckgo-search')
      } else if (input.includes('文件系统') || input.includes('文件')) {
        targetServer = servers.find((s: any) => s.id === 'filesystem')
      } else if (input.includes('时间')) {
        targetServer = servers.find((s: any) => s.id === 'time-server')
      } else {
        // 尝试从服务器名称匹配
        for (const server of servers) {
          const serverNameLower = server.name.toLowerCase()
          if (input.includes(serverNameLower)) {
            targetServer = server
            break
          }
        }
      }
      
      if (!targetServer) {
        const availableServers = servers.map((s: any) => `• ${s.name}`).join('\n')
        return {
          message: `请指定要删除的服务器：

${availableServers}

` +
                   `例如：说"删除DuckDuckGo服务器"`,
          followUpQuestions: servers.map((s: any) => `删除${s.name}`)
        }
      }
      
      // 这里我们需要添加删除服务器的API调用
      // 目前MCP服务中没有删除方法，我们返回一个说明
      return {
        message: `⚠️ 删除服务器功能暂未实现\n\n` +
                 `要删除 **${targetServer.name}**，您可以：\n` +
                 `1. 重启应用程序\n` +
                 `2. 或者先停止服务器，然后重新添加正确的配置\n\n` +
                 `当前服务器状态：${targetServer.status}`,
        followUpQuestions: [
          `停止${targetServer.name}`,
          '检查MCP状态'
        ]
      }
    } catch (error) {
      return {
        message: `❌ 删除服务器时出错：${error instanceof Error ? error.message : '未知错误'}`,
        followUpQuestions: ['检查MCP状态']
      }
    }
  }

  /**
   * 检查是否是MCP帮助请求
   */
  private isMCPHelpRequest(input: string): boolean {
    return input.includes('mcp') && (input.includes('帮助') || input.includes('help') || input.includes('如何'))
  }

  /**
   * 处理MCP帮助
   */
  private handleMCPHelp(): MCPDialogueResponse {
    return {
      message: `🔌 MCP (Model Context Protocol) 帮助

**什么是MCP？**
MCP是一个协议，让AI助手能够安全地使用外部工具和服务。

**可用命令：**

**📊 状态管理**
• "检查MCP状态" - 查看服务器和工具状态
• "MCP状态报告" - 详细状态信息

**🔧 服务器管理**
• "添加文件系统工具" - 添加文件操作工具
• "添加DuckDuckGo搜索工具" - 添加免费搜索引擎
• "添加网络研究工具" - 添加深度研究分析工具
• "添加网页获取工具" - 添加网页内容获取工具
• "添加数据库工具" - 添加SQLite工具
• "启动[服务器名]" - 启动指定服务器
• "停止[服务器名]" - 停止指定服务器

**🛠️ 工具使用**
• "有什么工具可用" - 查看所有可用工具
• "帮我读取文件 /path/to/file" - 读取文件
• "搜索关于AI的信息" - 网络搜索
• "列出当前目录文件" - 文件系统操作

**💡 使用技巧：**
• 直接描述您的需求，我会自动选择合适的工具
• 工具按风险等级分类：✅低风险 ⚡中风险 ⚠️高风险
• 所有操作都是安全的，会在执行前确认`,
      followUpQuestions: [
        '检查MCP状态',
        '添加文件系统工具',
        '有什么工具可用'
      ]
    }
  }

  /**
   * 找到最匹配的工具
   */
  private findBestMatchingTool(userInput: string, tools: any[]): any | null {
    const input = userInput.toLowerCase()
    
    // 文件操作相关
    if (input.includes('文件') || input.includes('读取') || input.includes('写入') || input.includes('目录')) {
      return tools.find(t => t.name.toLowerCase().includes('read') || 
                            t.name.toLowerCase().includes('write') || 
                            t.name.toLowerCase().includes('file') ||
                            t.name.toLowerCase().includes('list'))
    }
    
    // 搜索相关
    if (input.includes('搜索') || input.includes('查找') || input.includes('search')) {
      // 优先选择DuckDuckGo搜索工具
      return tools.find(t => t.server === 'duckduckgo-search') ||
             tools.find(t => t.name.toLowerCase().includes('search') || 
                            t.description.toLowerCase().includes('search'))
    }
    
    // 数据库相关
    if (input.includes('数据库') || input.includes('查询') || input.includes('sql')) {
      return tools.find(t => t.name.toLowerCase().includes('sql') || 
                            t.name.toLowerCase().includes('db') ||
                            t.name.toLowerCase().includes('query'))
    }
    
    // 默认返回第一个可用工具
    return tools[0] || null
  }

  /**
   * 从用户输入中提取参数
   */
  private extractParameters(userInput: string, tool: any): Record<string, any> {
    const parameters: Record<string, any> = {}
    
    // 文件路径提取
    const pathMatch = userInput.match(/([~\/]?[\w\/\.-]+\.\w+|[~\/][\w\/\.-]*)/g)
    if (pathMatch && (tool.name.toLowerCase().includes('read') || 
                      tool.name.toLowerCase().includes('write') || 
                      tool.name.toLowerCase().includes('file'))) {
      parameters.path = pathMatch[0]
    }
    
    // 搜索查询提取
    if (tool.name.toLowerCase().includes('search')) {
      const searchMatch = userInput.match(/搜索(.+?)的|关于(.+?)的|搜索(.+)$|查找(.+)$/)
      if (searchMatch) {
        parameters.query = searchMatch[1] || searchMatch[2] || searchMatch[3] || searchMatch[4]
      }
    }
    
    return parameters
  }
}