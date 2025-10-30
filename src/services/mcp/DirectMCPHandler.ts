/**
 * 直接MCP处理器
 * 最简化的MCP调用实现，直接与electron通信
 */

// 类型定义已在其他地方定义，这里不需要重复声明

export interface MCPCallRequest {
  tool: string
  parameters: Record<string, any>
}

export interface MCPCallResult {
  success: boolean
  data?: any
  error?: string
}

export class DirectMCPHandler {
  private serverStarted = false
  private availableTools: any[] = []
  private toolCapabilities: Map<string, any> = new Map()

  /**
   * 初始化并获取可用工具 - 真正的MCP动态发现
   */
  async initialize(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.mcp) {
        const toolsResult = await window.electronAPI.mcp.getTools()
        if (toolsResult.success && toolsResult.data) {
          this.availableTools = toolsResult.data
          
          // 🔥 关键改进：分析每个工具的能力，而不是硬编码
          this.analyzeToolCapabilities()
          
          console.log('📋 DirectMCPHandler 发现工具:', this.availableTools.map(t => 
            `${t.name} (${t.server}) - ${t.description?.substring(0, 50)}...`
          ))
        }
      }
    } catch (error) {
      console.error('❌ DirectMCPHandler 初始化失败:', error)
    }
  }

  /**
   * 🚀 MCP核心：动态分析工具能力，而不是硬编码
   */
  private analyzeToolCapabilities(): void {
    this.toolCapabilities.clear()
    
    for (const tool of this.availableTools) {
      const capabilities = {
        name: tool.name,
        server: tool.server,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {},
        
        // 🔍 动态分析工具类型
        toolType: this.inferToolType(tool),
        
        // 📝 分析工具适用场景
        useCases: this.inferUseCases(tool),
        
        // 🎯 计算工具匹配权重函数
        matchScore: (userInput: string) => this.calculateMatchScore(tool, userInput)
      }
      
      this.toolCapabilities.set(tool.name, capabilities)
      console.log(`🔧 分析工具能力: ${tool.name} -> ${capabilities.toolType} (${capabilities.useCases.join(', ')})`)
    }
  }

  /**
   * 🤖 基于MCP工具描述推断工具类型
   */
  private inferToolType(tool: any): string {
    const name = tool.name.toLowerCase()
    const desc = (tool.description || '').toLowerCase()
    const server = (tool.server || '').toLowerCase()

    // 基于MCP工具的实际描述和名称推断类型
    if (name.includes('search') && (server.includes('duckduckgo') || desc.includes('web') || desc.includes('internet'))) {
      return 'web_search'
    }
    
    if (name.includes('search') && (server.includes('obsidian') || desc.includes('note') || desc.includes('vault'))) {
      return 'note_search'
    }
    
    if (name.includes('create') && (server.includes('obsidian') || desc.includes('note'))) {
      return 'note_create'
    }
    
    if (name.includes('read') && (server.includes('obsidian') || desc.includes('note'))) {
      return 'note_read'
    }
    
    if (name.includes('list') && (server.includes('obsidian') || desc.includes('note'))) {
      return 'note_list'
    }

    // 基于服务器类型的通用推断
    if (server.includes('obsidian')) return 'note_management'
    if (server.includes('duckduckgo')) return 'web_search'
    
    return 'unknown'
  }

  /**
   * 🎯 基于MCP工具描述推断适用场景
   */
  private inferUseCases(tool: any): string[] {
    const desc = (tool.description || '').toLowerCase()
    const name = tool.name.toLowerCase()
    const useCases: string[] = []

    // 从MCP工具描述中提取关键信息
    if (desc.includes('search') || name.includes('search')) {
      useCases.push('search')
    }
    if (desc.includes('create') || name.includes('create')) {
      useCases.push('create')
    }
    if (desc.includes('web') || desc.includes('internet') || desc.includes('online')) {
      useCases.push('web_content')
    }
    if (desc.includes('note') || desc.includes('document') || desc.includes('vault')) {
      useCases.push('personal_content')
    }
    if (desc.includes('real-time') || desc.includes('current') || desc.includes('latest')) {
      useCases.push('real_time')
    }

    return useCases.length > 0 ? useCases : ['general']
  }

  /**
   * 🧠 智能计算工具与用户输入的匹配分数
   */
  private calculateMatchScore(tool: any, userInput: string): number {
    let score = 0
    const input = userInput.toLowerCase()
    const desc = (tool.description || '').toLowerCase()
    const name = tool.name.toLowerCase()

    // 基于MCP工具描述的语义匹配
    const descWords = desc.split(/\s+/)
    const inputWords = input.split(/\s+/)
    
    // 计算描述与输入的词汇重叠度
    const overlap = inputWords.filter(word => 
      descWords.some(descWord => descWord.includes(word) || word.includes(descWord))
    ).length
    
    score += overlap * 10

    // 特定场景的权重加分
    if (input.includes('搜索') || input.includes('search')) {
      if (name.includes('search')) score += 20
    }
    
    if (input.includes('笔记') || input.includes('note')) {
      if (desc.includes('note') || desc.includes('obsidian')) score += 30
    }
    
    if (input.includes('网页') || input.includes('web') || input.includes('在线')) {
      if (desc.includes('web') || desc.includes('internet') || name.includes('duckduckgo')) score += 30
    }

    return score
  }

  /**
   * 🌐 基于MCP工具能力检测网页搜索请求
   */
  isWebSearchRequest(input: string): boolean {
    const webSearchTools = Array.from(this.toolCapabilities.values())
      .filter(cap => cap.toolType === 'web_search')
    
    if (webSearchTools.length === 0) {
      console.log('❌ 没有发现网页搜索工具')
      return false
    }

    // 🎯 使用MCP工具的匹配分数来判断
    const bestWebTool = this.findBestMatchingTool(input, 'web_search')
    const bestNoteTool = this.findBestMatchingTool(input, 'note_search')
    
    // 如果网页搜索工具的匹配分数更高，则认为是网页搜索
    const webScore = bestWebTool ? bestWebTool.matchScore(input) : 0
    const noteScore = bestNoteTool ? bestNoteTool.matchScore(input) : 0
    
    console.log(`🔍 搜索类型分析: 网页搜索分数=${webScore}, 笔记搜索分数=${noteScore}`)
    
    return webScore > noteScore && webScore > 10 // 设置最低阈值
  }

  /**
   * 智能分析内容是否适合网页搜索 - 基于内容特征而非硬编码关键词
   */
  private analyzeContentForWebSearch(input: string): boolean {
    const lowerInput = input.toLowerCase()

    // 策略1: 检查是否包含时效性内容（通常需要网页搜索）
    const timeRelatedPatterns = [
      /今天|明天|昨天|最近|最新|刚刚|现在/,
      /today|tomorrow|yesterday|recent|latest|now|current/,
      /\d{4}年|\d+月|\d+日|这个月|上个月/,
      /this\s+(year|month|week)|last\s+(year|month|week)/
    ]

    if (timeRelatedPatterns.some(pattern => pattern.test(lowerInput))) {
      console.log('🕒 智能分析: 检测到时效性内容，推荐网页搜索')
      return true
    }

    // 策略2: 检查是否包含专有名词或实体
    if (this.containsProperNouns(input)) {
      console.log('🏷️ 智能分析: 检测到专有名词，推荐网页搜索')
      return true
    }

    // 策略3: 检查是否是问答式查询（通常需要网页搜索）
    const questionPatterns = [
      /什么是|怎么|如何|为什么|哪里|什么时候/,
      /what\s+is|how\s+to|why|where|when|which/
    ]

    if (questionPatterns.some(pattern => pattern.test(lowerInput))) {
      console.log('❓ 智能分析: 检测到问答式查询，推荐网页搜索')
      return true
    }

    // 策略4: 检查内容长度和复杂度（短查询通常是网页搜索）
    const words = input.trim().split(/\s+/)
    if (words.length <= 5 && !lowerInput.includes('我的') && !lowerInput.includes('my')) {
      console.log('📏 智能分析: 短查询且非个人内容，推荐网页搜索')
      return true
    }

    // 策略5: 基于可用工具的能力描述进行匹配
    return this.matchToolCapabilities(input, 'web')
  }

  /**
   * 检测专有名词 - 使用更智能的方法
   */
  private containsProperNouns(input: string): boolean {
    // 检测大写字母开头的英文单词（可能是专有名词）
    const capitalizedWords = input.match(/\b[A-Z][a-z]+\b/g)
    if (capitalizedWords && capitalizedWords.length > 0) {
      return true
    }

    // 检测数字+单位的组合（如价格、日期等）
    const numberUnitPatterns = [
      /\d+[元美金块万亿]/,  // 价格
      /\d+[年月日号]/,      // 日期
      /\d+[米公里千米]/,    // 距离
      /\d+[GB|MB|TB]/i      // 存储
    ]

    return numberUnitPatterns.some(pattern => pattern.test(input))
  }

  /**
   * 基于工具能力描述进行智能匹配
   */
  private matchToolCapabilities(input: string, category: 'web' | 'note'): boolean {
    const relevantTools = this.availableTools.filter(tool => {
      if (category === 'web') {
        return tool.name.includes('duckduckgo') ||
          (tool.name.includes('search') && !tool.name.includes('note'))
      } else {
        return tool.name.includes('note') || tool.name.includes('obsidian')
      }
    })

    // 如果没有相关工具，返回false
    if (relevantTools.length === 0) return false

    // 分析工具描述，看是否与用户输入匹配
    for (const tool of relevantTools) {
      const description = tool.description?.toLowerCase() || ''
      const toolName = tool.name.toLowerCase()

      // 简单的语义匹配（可以后续扩展为更复杂的NLP）
      if (description.includes('web') || description.includes('internet') ||
        description.includes('online') || toolName.includes('duckduckgo')) {
        console.log(`🔧 工具匹配: ${tool.name} 适合处理此类查询`)
        return category === 'web'
      }
    }

    // 默认策略：如果不确定，网页搜索覆盖面更广
    return category === 'web'
  }

  /**
   * 📝 基于MCP工具能力检测笔记搜索请求
   */
  isNoteSearchRequest(input: string): boolean {
    const noteSearchTools = Array.from(this.toolCapabilities.values())
      .filter(cap => cap.toolType === 'note_search')
    
    if (noteSearchTools.length === 0) {
      console.log('❌ 没有发现笔记搜索工具')
      return false
    }

    // 🎯 使用MCP工具的匹配分数来判断
    const bestNoteTool = this.findBestMatchingTool(input, 'note_search')
    const bestWebTool = this.findBestMatchingTool(input, 'web_search')
    
    const noteScore = bestNoteTool ? bestNoteTool.matchScore(input) : 0
    const webScore = bestWebTool ? bestWebTool.matchScore(input) : 0
    
    console.log(`📝 笔记搜索分析: 笔记搜索分数=${noteScore}, 网页搜索分数=${webScore}`)
    
    return noteScore > webScore && noteScore > 10 // 设置最低阈值
  }

  /**
   * 🔍 检测是否为搜索请求（兼容旧接口）- 现在基于MCP工具能力
   */
  isSearchRequest(input: string): boolean {
    // 检查是否有任何搜索相关的工具
    const hasAnySearchTool = Array.from(this.toolCapabilities.values())
      .some(cap => cap.useCases.includes('search') || cap.toolType.includes('search'))
    
    if (!hasAnySearchTool) return false

    // 基于MCP工具匹配分数判断是否为搜索请求
    const bestTool = this.findBestMatchingTool(input)
    return bestTool && bestTool.matchScore(input) > 15
  }

  /**
   * 🎯 基于MCP工具能力找到最佳匹配工具
   */
  findBestMatchingTool(input: string, toolType?: string): any | null {
    let candidates = Array.from(this.toolCapabilities.values())
    
    // 如果指定了工具类型，先过滤
    if (toolType) {
      candidates = candidates.filter(cap => cap.toolType === toolType)
    }
    
    if (candidates.length === 0) return null

    // 计算每个工具的匹配分数
    const scoredTools = candidates.map(cap => ({
      ...cap,
      score: cap.matchScore(input)
    })).sort((a, b) => b.score - a.score)

    console.log('🏆 工具匹配排名:', scoredTools.map(t => `${t.name}(${t.score})`).join(', '))
    
    return scoredTools[0].score > 0 ? scoredTools[0] : null
  }

  /**
   * 检测是否为笔记搜索请求
   */
  isNoteSearchRequest(input: string): boolean {
    // 检查是否有笔记搜索工具
    const hasNoteSearchTools = this.availableTools.some(tool =>
      tool.name.includes('search_notes') ||
      tool.name.includes('obsidian') ||
      (tool.name.includes('search') && (tool.name.includes('note') || tool.server === 'obsidian'))
    )

    if (!hasNoteSearchTools) return false

    const lowerInput = input.toLowerCase()

    // 明确的笔记搜索关键词
    const noteSearchKeywords = [
      '搜索笔记', '查找笔记', '搜索文档', '查找文档', '搜索日记',
      'search notes', 'find notes', 'search documents'
    ]

    if (noteSearchKeywords.some(keyword => lowerInput.includes(keyword.toLowerCase()))) {
      return true
    }

    // 通用搜索关键词 + 笔记内容指示符
    const generalSearchKeywords = ['搜索', '查询', '查找', '找', '搜', 'search', 'find']
    const noteIndicators = ['笔记', '文档', '日记', 'note', 'document', 'diary']

    const hasSearchKeyword = generalSearchKeywords.some(keyword => lowerInput.includes(keyword.toLowerCase()))
    const hasNoteIndicator = noteIndicators.some(indicator => lowerInput.includes(indicator.toLowerCase()))

    return hasSearchKeyword && hasNoteIndicator
  }

  /**
   * 检测是否为笔记请求 - 基于可用工具
   */
  isNoteRequest(input: string): boolean {
    // 检查是否有笔记相关的工具
    const hasNoteTools = this.availableTools.some(tool =>
      tool.name.includes('note') ||
      tool.name.includes('obsidian') ||
      tool.name.includes('create') ||
      tool.description?.toLowerCase().includes('note')
    )

    if (!hasNoteTools) return false

    const noteKeywords = [
      // 创建相关
      '笔记', '记录', '保存', '写入', '创建笔记', '日记', '创建日记',
      '新建', '创建', '写', '记', 'note', 'save', 'write', 'create', 'diary',
      // 删除相关
      '删除笔记', '删除文档', '移除笔记', '移除文档', '删除', '移除',
      // 查看相关
      '列出笔记', '列表笔记', '显示所有笔记', '列出', '列表', '显示所有',
      '读取笔记', '打开笔记', '查看笔记', '读取', '打开', '查看',
      // 搜索相关 (笔记内搜索)
      '搜索笔记', '查找笔记', '搜索文档', '查找文档'
    ]
    const lowerInput = input.toLowerCase()
    return noteKeywords.some(keyword => lowerInput.includes(keyword.toLowerCase()))
  }

  /**
   * 🚀 真正的MCP智能工具匹配 - 基于动态工具能力分析
   */
  findBestTool(input: string, category?: 'note' | 'search'): any | null {
    // 🔥 关键改进：使用MCP工具能力而不是硬编码规则
    let candidates = Array.from(this.toolCapabilities.values())
    
    // 如果指定了类别，进行过滤
    if (category === 'note') {
      candidates = candidates.filter(cap => 
        cap.toolType.includes('note') || 
        cap.useCases.includes('personal_content')
      )
    } else if (category === 'search') {
      candidates = candidates.filter(cap => 
        cap.toolType === 'web_search' || 
        cap.useCases.includes('web_content')
      )
    }

    if (candidates.length === 0) {
      console.log(`❌ 没有找到 ${category || 'any'} 类型的工具`)
      return null
    }

    // 🧠 使用MCP工具的智能匹配分数
    const scoredCandidates = candidates.map(cap => ({
      ...cap,
      score: cap.matchScore(input),
      // 从原始工具数据中获取完整信息
      originalTool: this.availableTools.find(t => t.name === cap.name)
    })).sort((a, b) => b.score - a.score)

    console.log(`🎯 MCP工具匹配结果 (${category || 'all'}):`, 
      scoredCandidates.map(c => `${c.name}(${c.score})`).join(', ')
    )

    const bestMatch = scoredCandidates[0]
    if (bestMatch && bestMatch.score > 5) {
      console.log(`✅ 选择最佳工具: ${bestMatch.name} (分数: ${bestMatch.score})`)
      return bestMatch.originalTool
    }

    console.log('❌ 没有找到合适的工具匹配')
    return null
  }

  /**
   * 构建智能工具调用参数
   */
  buildToolCall(input: string, tool: any): any {
    // 基础参数提取
    let content = input.replace(/创建|新建|笔记|日记|文档|删除|移除|读取|打开|查看|搜索|查找|列出|列表|显示所有|更新|修改|编辑|移动|重命名/gi, '').trim()

    // 提取文件名
    let fileName = content
    if (input.includes('名字是') || input.includes('叫')) {
      const nameMatch = input.match(/(?:名字是|叫)\s*([^\s，。！？]+)/)
      if (nameMatch) {
        fileName = nameMatch[1]
      }
    }

    // 根据工具名称智能构建参数
    const toolName = tool.name.toLowerCase()
    console.log('🔧 为工具构建参数:', tool.name, '用户输入:', input)

    // 检查工具的输入模式
    const inputSchema = tool.inputSchema || {}
    const properties = inputSchema.properties || {}
    const required = inputSchema.required || []

    console.log('📋 工具参数模式:', properties)

    // 智能参数映射
    const parameters: any = {}

    // 处理路径参数
    if (properties.path) {
      if (toolName.includes('create')) {
        if (!fileName || fileName.trim() === '') {
          fileName = `Note-${Date.now()}`
        }

        let folderPath = 'Notes'
        if (input.includes('日记')) {
          folderPath = 'Daily'
          fileName = `${new Date().toISOString().split('T')[0]}-日记`
        } else if (input.includes('文档')) {
          folderPath = 'Documents'
        }

        parameters.path = `${folderPath}/${fileName}.md`
      } else {
        parameters.path = fileName ? `${fileName}.md` : undefined
      }
    }

    // 处理内容参数
    if (properties.content) {
      parameters.content = `# ${fileName}\n\n${content || '新建笔记内容...'}`
    }

    // 处理查询参数
    if (properties.query) {
      // 提取搜索查询，移除搜索关键词
      let query = input
      const searchKeywords = ['搜索', '查找', '网页搜索', '在网页', '搜索网页', '网上搜索', '在线搜索', 'search', 'find']
      for (const keyword of searchKeywords) {
        const regex = new RegExp(`^${keyword}\\s*[:：]?\\s*`, 'i')
        query = query.replace(regex, '')
      }
      parameters.query = query.trim() || content || input
    }

    // 处理标签参数
    if (properties.tags && (input.includes('标签') || input.includes('tag'))) {
      const tagMatch = input.match(/标签[：:]?\s*([^\s，。！？]+)/)
      if (tagMatch) {
        parameters.tags = [tagMatch[1]]
      }
    }

    // 处理其他常见参数
    Object.keys(properties).forEach(key => {
      if (!parameters[key] && required.includes(key)) {
        // 为必需参数提供默认值
        switch (key) {
          case 'directory':
            parameters[key] = ''
            break
          case 'recursive':
            parameters[key] = true
            break
          case 'max_width':
            parameters[key] = 800
            break
          default:
            parameters[key] = content || ''
        }
      }
    })

    return {
      tool: tool.name,
      parameters: parameters,
      server: tool.server || 'obsidian'
    }
  }

  /**
   * 提取搜索查询
   */
  extractSearchQuery(input: string): string | null {
    let query = input

    // 移除搜索关键词
    const searchKeywords = ['搜索', '查询', '查找', '找', '搜', 'search', 'find']
    for (const keyword of searchKeywords) {
      const regex = new RegExp(`^${keyword}\\s*[:：]?\\s*`, 'i')
      query = query.replace(regex, '')
    }

    query = query.trim()
    return query.length > 0 ? query : null
  }

  /**
   * 确保MCP服务器启动
   */
  private async ensureServerStarted(): Promise<void> {
    if (this.serverStarted) {
      return
    }

    try {
      console.log('🚀 启动DuckDuckGo MCP服务器...')

      if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('Electron API 不可用')
      }

      // 启动服务器
      const startResult = await window.electronAPI.mcp.startServer('duckduckgo-search')
      if (!startResult.success) {
        throw new Error(`启动服务器失败: ${startResult.error}`)
      }

      // 等待服务器启动
      console.log('⏳ 等待服务器启动...')
      await new Promise(resolve => setTimeout(resolve, 8000))

      this.serverStarted = true
      console.log('✅ DuckDuckGo服务器启动完成')

    } catch (error) {
      console.error('❌ 启动MCP服务器失败:', error)
      throw error
    }
  }

  /**
   * 执行笔记操作
   */
  async executeNoteOperation(input: string): Promise<MCPCallResult> {
    try {
      console.log(`📝 执行笔记操作: "${input}"`)

      // 确保Obsidian服务器启动
      await this.ensureObsidianServerStarted()

      // 根据输入类型选择合适的工具
      let toolCall
      if (input.includes('搜索') || input.includes('查找') || input.includes('search')) {
        toolCall = {
          tool: 'search_notes',
          parameters: { query: input.replace(/搜索|查找|search/gi, '').trim() },
          server: 'obsidian'
        }
      } else if (input.includes('创建') || input.includes('新建') || input.includes('create')) {
        toolCall = {
          tool: 'create_note',
          parameters: {
            path: `新笔记_${Date.now()}.md`,
            content: input.replace(/创建|新建|create/gi, '').trim()
          },
          server: 'obsidian'
        }
      } else if (input.includes('列表') || input.includes('list')) {
        toolCall = {
          tool: 'list_notes',
          parameters: {},
          server: 'obsidian'
        }
      } else {
        // 默认搜索
        toolCall = {
          tool: 'search_notes',
          parameters: { query: input },
          server: 'obsidian'
        }
      }

      console.log('📡 发送Obsidian工具调用:', toolCall)
      const result = await window.electronAPI.mcp.executeTool(toolCall)

      if (result.success) {
        console.log('✅ 笔记操作成功')
        return {
          success: true,
          data: result.data
        }
      } else {
        console.error('❌ 笔记操作失败:', result.error)
        return {
          success: false,
          error: result.error || '笔记操作失败'
        }
      }

    } catch (error) {
      console.error('❌ 笔记操作异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 确保Obsidian服务器启动
   */
  private async ensureObsidianServerStarted(): Promise<void> {
    try {
      console.log('🚀 启动Obsidian MCP服务器...')

      if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('Electron API 不可用')
      }

      // 启动Obsidian服务器
      const startResult = await window.electronAPI.mcp.startServer('obsidian')
      if (!startResult.success) {
        throw new Error(`启动Obsidian服务器失败: ${startResult.error}`)
      }

      // 等待服务器启动
      console.log('⏳ 等待Obsidian服务器启动...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      console.log('✅ Obsidian服务器启动完成')

    } catch (error) {
      console.error('❌ 启动Obsidian服务器失败:', error)
      throw error
    }
  }

  /**
   * 执行搜索
   */
  async executeSearch(query: string, maxResults: number = 5): Promise<MCPCallResult> {
    try {
      console.log(`🔍 执行搜索: "${query}"`)

      // 确保服务器启动
      await this.ensureServerStarted()

      // 执行搜索工具调用
      const toolCall = {
        tool: 'search',
        parameters: { query, max_results: maxResults },
        server: 'duckduckgo-search'
      }

      console.log('📡 发送工具调用:', toolCall)
      const result = await window.electronAPI.mcp.executeTool(toolCall)

      if (result.success) {
        console.log('✅ 搜索执行成功')
        return {
          success: true,
          data: result.data
        }
      } else {
        console.error('❌ 搜索执行失败:', result.error)
        return {
          success: false,
          error: result.error || '搜索执行失败'
        }
      }

    } catch (error) {
      console.error('❌ 搜索异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 格式化搜索结果
   */
  formatSearchResult(result: MCPCallResult): string {
    if (!result.success) {
      return `❌ **搜索失败**\n\n**错误:** ${result.error}`
    }

    if (typeof result.data === 'string') {
      // DuckDuckGo MCP服务器返回格式化的字符串
      return `🔍 **搜索结果**\n\n${result.data}`
    }

    return `🔍 **搜索结果**\n\n${JSON.stringify(result.data, null, 2)}`
  }

  /**
   * 获取服务器状态
   */
  async getServerStatus(): Promise<string> {
    try {
      if (typeof window === 'undefined' || !window.electronAPI) {
        return '❌ Electron API 不可用'
      }

      const serversResult = await window.electronAPI.mcp.getServers()
      if (!serversResult.success) {
        return `❌ 获取服务器状态失败: ${serversResult.error}`
      }

      const servers = serversResult.data || []
      const duckduckgoServer = servers.find(s => s.id === 'duckduckgo-search')
      const obsidianServer = servers.find(s => s.id === 'obsidian')

      let status = '📊 **MCP服务器状态**\n\n'

      if (duckduckgoServer) {
        status += `🔍 **DuckDuckGo**: ${duckduckgoServer.status}\n`
      } else {
        status += `🔍 **DuckDuckGo**: 未配置\n`
      }

      if (obsidianServer) {
        status += `📝 **Obsidian**: ${obsidianServer.status}\n`
      } else {
        status += `📝 **Obsidian**: 未配置\n`
      }

      status += `\n**总计**: ${servers.length} 个服务器`

      return status

    } catch (error) {
      return `❌ 状态检查异常: ${error}`
    }
  }
}

// 创建单例实例
export const directMCPHandler = new DirectMCPHandler()