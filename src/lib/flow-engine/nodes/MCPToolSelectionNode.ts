/**
 * MCP工具选择和映射节点
 * 基于意图分析结果智能选择最适合的MCP工具
 */

import { FlowNode, FlowInput, FlowOutput } from '../core/FlowNode'
import { llmMCPHandler } from '@/services/mcp/LLMBasedMCPHandler'
import type { MCPToolCall } from '@/types'

// 工具能力定义
export interface ToolCapability {
  toolName: string
  serverId: string
  description: string
  capabilities: string[]
  inputTypes: string[]
  outputTypes: string[]
  reliability: number
  averageExecutionTime: number
  lastUsed?: number
  usageCount: number
}

// 工具匹配结果
export interface ToolMatch {
  tool: ToolCapability
  score: number
  reasoning: string
  confidence: number
  estimatedExecutionTime: number
}

// 工具选择结果
export interface ToolSelectionResult {
  selectedTools: ToolMatch[]
  executionPlan: ExecutionPlan
  fallbackTools: ToolMatch[]
  totalEstimatedTime: number
}

// 执行计划
export interface ExecutionPlan {
  strategy: 'sequential' | 'parallel' | 'conditional'
  steps: ExecutionStep[]
  dependencies: Record<string, string[]>
  timeout: number
}

export interface ExecutionStep {
  stepId: string
  toolName: string
  serverId: string
  parameters: Record<string, any>
  dependsOn: string[]
  canRunInParallel: boolean
  priority: number
}

/**
 * MCP工具选择节点
 */
export class MCPToolSelectionNode extends FlowNode {
  private toolCapabilities: Map<string, ToolCapability> = new Map()
  private intentToToolMapping: Map<string, string[]> = new Map()
  private toolPerformanceHistory: Map<string, PerformanceMetric[]> = new Map()

  constructor(config: any) {
    super({
      id: config.id || 'mcp_tool_selection',
      name: config.name || 'MCP工具选择节点',
      type: 'MCPToolSelectionNode',
      successors: config.successors || ['parallel_tool_execution', 'sequential_tool_execution', 'no_tools_available'],
      errorHandlers: config.errorHandlers || ['tool_selection_fallback'],
      timeout: config.timeout || 10000,
      params: config.params || {}
    })

    this.initializeToolMappings()
  }

  async initialize(): Promise<void> {
    await this.loadToolCapabilities()
    await this.loadPerformanceHistory()
  }

  async execute(input: FlowInput): Promise<FlowOutput> {
    if (!this.validateInput(input)) {
      return this.createErrorOutput({
        code: 'INVALID_INPUT',
        message: 'Invalid input for tool selection',
        recoverable: false,
        retryable: false
      })
    }

    try {
      const intentResult = input.data.intent
      const userInput = input.data.originalInput
      const context = input.context

      // 分析工具需求
      const toolRequirements = this.analyzeToolRequirements(intentResult, userInput, context)
      
      // 查找可用工具
      const availableTools = await this.getAvailableTools()
      
      // 匹配和评分工具
      const toolMatches = this.matchAndScoreTools(toolRequirements, availableTools)
      
      // 选择最佳工具组合
      const selectionResult = this.selectOptimalTools(toolMatches, toolRequirements)
      
      // 创建执行计划
      const executionPlan = this.createExecutionPlan(selectionResult.selectedTools, toolRequirements)
      
      // 选择下一个节点
      const nextNode = this.selectNextNode(executionPlan)
      
      const outputData = {
        toolSelection: selectionResult,
        executionPlan,
        toolRequirements,
        originalIntent: intentResult,
        timestamp: Date.now()
      }

      return this.createOutput(
        outputData,
        [nextNode],
        context,
        {
          selectedToolCount: selectionResult.selectedTools.length,
          executionStrategy: executionPlan.strategy,
          estimatedTime: selectionResult.totalEstimatedTime
        }
      )

    } catch (error) {
      return this.createErrorOutput({
        code: 'TOOL_SELECTION_ERROR',
        message: error instanceof Error ? error.message : 'Tool selection failed',
        details: error,
        recoverable: true,
        retryable: true
      })
    }
  }

  /**
   * 分析工具需求
   */
  private analyzeToolRequirements(intentResult: any, userInput: string, context: any): ToolRequirement {
    const requirements: ToolRequirement = {
      primaryCapability: this.mapIntentToCapability(intentResult.primaryIntent),
      requiredInputTypes: this.extractRequiredInputTypes(intentResult.entities),
      expectedOutputTypes: this.inferExpectedOutputTypes(intentResult.primaryIntent),
      parameters: intentResult.parameters,
      constraints: {
        maxExecutionTime: 30000, // 30秒
        requiresInternet: this.requiresInternet(intentResult.primaryIntent),
        requiresFileAccess: this.requiresFileAccess(intentResult.entities),
        priority: this.calculatePriority(intentResult.confidence)
      },
      context: {
        userPreferences: context.userProfile?.preferences || {},
        recentToolUsage: this.getRecentToolUsage(context),
        systemState: context.systemState || {}
      }
    }

    return requirements
  }

  /**
   * 获取可用工具 - 使用新的LLM-MCP处理器
   */
  private async getAvailableTools(): Promise<ToolCapability[]> {
    try {
      // 🚀 使用新的LLM-MCP处理器获取工具
      const mcpTools = llmMCPHandler.getAvailableTools()
      const capabilities: ToolCapability[] = []

      for (const tool of mcpTools) {
        const capability: ToolCapability = {
          toolName: tool.name,
          serverId: tool.server || 'unknown',
          description: tool.description || '',
          capabilities: this.inferCapabilities(tool),
          inputTypes: this.inferInputTypes(tool),
          outputTypes: this.inferOutputTypes(tool),
          reliability: this.calculateReliability(tool.name),
          averageExecutionTime: this.getAverageExecutionTime(tool.name),
          lastUsed: this.getLastUsedTime(tool.name),
          usageCount: this.getUsageCount(tool.name)
        }
        capabilities.push(capability)
      }

      console.log(`🔧 流程引擎获取到 ${capabilities.length} 个MCP工具`)
      return capabilities

    } catch (error) {
      console.error('获取可用工具失败:', error)
      return []
    }
  }

  /**
   * 匹配和评分工具
   */
  private matchAndScoreTools(requirements: ToolRequirement, availableTools: ToolCapability[]): ToolMatch[] {
    const matches: ToolMatch[] = []

    for (const tool of availableTools) {
      const score = this.calculateToolScore(tool, requirements)
      
      if (score > 0.3) { // 只考虑得分超过30%的工具
        const match: ToolMatch = {
          tool,
          score,
          reasoning: this.generateMatchReasoning(tool, requirements, score),
          confidence: this.calculateMatchConfidence(tool, requirements, score),
          estimatedExecutionTime: this.estimateExecutionTime(tool, requirements)
        }
        matches.push(match)
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  /**
   * 选择最佳工具组合
   */
  private selectOptimalTools(matches: ToolMatch[], requirements: ToolRequirement): ToolSelectionResult {
    const selectedTools: ToolMatch[] = []
    const fallbackTools: ToolMatch[] = []
    
    // 选择主要工具
    if (matches.length > 0) {
      selectedTools.push(matches[0])
      
      // 选择补充工具（如果需要）
      const remainingMatches = matches.slice(1)
      for (const match of remainingMatches) {
        if (this.isComplementaryTool(match, selectedTools, requirements)) {
          selectedTools.push(match)
          if (selectedTools.length >= 3) break // 最多选择3个工具
        }
      }
      
      // 选择备用工具
      fallbackTools.push(...remainingMatches.slice(0, 2))
    }

    const totalEstimatedTime = selectedTools.reduce((sum, match) => sum + match.estimatedExecutionTime, 0)

    return {
      selectedTools,
      executionPlan: {} as ExecutionPlan, // 将在createExecutionPlan中填充
      fallbackTools,
      totalEstimatedTime
    }
  }

  /**
   * 创建执行计划
   */
  private createExecutionPlan(selectedTools: ToolMatch[], requirements: ToolRequirement): ExecutionPlan {
    const steps: ExecutionStep[] = []
    const dependencies: Record<string, string[]> = {}
    
    // 分析工具依赖关系
    const canRunInParallel = this.canToolsRunInParallel(selectedTools)
    const strategy = canRunInParallel ? 'parallel' : 'sequential'
    
    // 创建执行步骤
    selectedTools.forEach((match, index) => {
      const stepId = `step_${index + 1}`
      const step: ExecutionStep = {
        stepId,
        toolName: match.tool.toolName,
        serverId: match.tool.serverId,
        parameters: this.prepareToolParameters(match.tool, requirements),
        dependsOn: strategy === 'sequential' && index > 0 ? [`step_${index}`] : [],
        canRunInParallel: canRunInParallel,
        priority: this.calculateStepPriority(match, requirements)
      }
      steps.push(step)
      dependencies[stepId] = step.dependsOn
    })

    const timeout = Math.max(
      requirements.constraints.maxExecutionTime,
      selectedTools.reduce((sum, match) => sum + match.estimatedExecutionTime, 0) * 1.5
    )

    return {
      strategy,
      steps,
      dependencies,
      timeout
    }
  }

  /**
   * 选择下一个节点
   */
  private selectNextNode(executionPlan: ExecutionPlan): string {
    if (executionPlan.steps.length === 0) {
      return 'no_tools_available'
    }

    switch (executionPlan.strategy) {
      case 'parallel':
        return 'parallel_tool_execution'
      case 'sequential':
        return 'sequential_tool_execution'
      case 'conditional':
        return 'conditional_tool_execution'
      default:
        return 'sequential_tool_execution'
    }
  }

  // 初始化和配置方法

  private initializeToolMappings(): void {
    // 意图到工具能力的映射
    this.intentToToolMapping.set('tool_call', ['search', 'calculate', 'file_operation', 'web_request'])
    this.intentToToolMapping.set('file_operation', ['file_read', 'file_write', 'file_list', 'file_search'])
    this.intentToToolMapping.set('web_search', ['web_search', 'url_fetch', 'search_engine'])
    this.intentToToolMapping.set('calculation', ['calculate', 'math', 'compute'])
    this.intentToToolMapping.set('time_query', ['get_time', 'date_time', 'calendar'])
    this.intentToToolMapping.set('knowledge_query', ['search', 'knowledge_base', 'document_search'])
    this.intentToToolMapping.set('system_operation', ['system_info', 'process_control', 'config_management'])
  }

  private async loadToolCapabilities(): Promise<void> {
    // 从历史使用数据加载工具能力信息
    // 这里可以从数据库或配置文件加载
  }

  private async loadPerformanceHistory(): Promise<void> {
    // 加载工具性能历史数据
    // 用于计算平均执行时间和可靠性
  }

  // 辅助方法

  private mapIntentToCapability(intent: string): string {
    const mapping: Record<string, string> = {
      'tool_call': 'general_tool',
      'file_operation': 'file_management',
      'web_search': 'web_access',
      'calculation': 'computation',
      'time_query': 'time_service',
      'knowledge_query': 'information_retrieval',
      'system_operation': 'system_control'
    }
    return mapping[intent] || 'general_tool'
  }

  private extractRequiredInputTypes(entities: any[]): string[] {
    const inputTypes = new Set<string>()
    
    for (const entity of entities) {
      switch (entity.type) {
        case 'number':
        case 'integer':
          inputTypes.add('numeric')
          break
        case 'file_path':
          inputTypes.add('file_path')
          break
        case 'url':
          inputTypes.add('url')
          break
        case 'date':
        case 'time':
          inputTypes.add('datetime')
          break
        default:
          inputTypes.add('text')
      }
    }
    
    return Array.from(inputTypes)
  }

  private inferExpectedOutputTypes(intent: string): string[] {
    const outputMapping: Record<string, string[]> = {
      'calculation': ['numeric', 'text'],
      'file_operation': ['file_content', 'file_info'],
      'web_search': ['search_results', 'web_content'],
      'time_query': ['datetime', 'text'],
      'knowledge_query': ['information', 'text'],
      'system_operation': ['system_info', 'status']
    }
    return outputMapping[intent] || ['text']
  }

  private requiresInternet(intent: string): boolean {
    return ['web_search', 'knowledge_query'].includes(intent)
  }

  private requiresFileAccess(entities: any[]): boolean {
    return entities.some(entity => entity.type === 'file_path')
  }

  private calculatePriority(confidence: number): number {
    if (confidence > 0.8) return 1 // 高优先级
    if (confidence > 0.6) return 2 // 中优先级
    return 3 // 低优先级
  }

  private getRecentToolUsage(context: any): string[] {
    return context.userProfile?.toolUsageHistory?.slice(-5).map((usage: any) => usage.toolName) || []
  }

  private inferCapabilities(tool: any): string[] {
    // 基于工具名称和描述推断能力
    const capabilities = []
    const name = tool.name.toLowerCase()
    const description = (tool.description || '').toLowerCase()
    
    if (name.includes('search') || description.includes('search')) {
      capabilities.push('search')
    }
    if (name.includes('file') || description.includes('file')) {
      capabilities.push('file_operation')
    }
    if (name.includes('web') || description.includes('web')) {
      capabilities.push('web_access')
    }
    if (name.includes('calc') || description.includes('calculate')) {
      capabilities.push('computation')
    }
    
    return capabilities.length > 0 ? capabilities : ['general']
  }

  private inferInputTypes(tool: any): string[] {
    // 基于工具信息推断输入类型
    return ['text'] // 简化实现
  }

  private inferOutputTypes(tool: any): string[] {
    // 基于工具信息推断输出类型
    return ['text'] // 简化实现
  }

  private calculateReliability(toolName: string): number {
    // 基于历史成功率计算可靠性
    const history = this.toolPerformanceHistory.get(toolName) || []
    if (history.length === 0) return 0.8 // 默认可靠性
    
    const successCount = history.filter(metric => metric.success).length
    return successCount / history.length
  }

  private getAverageExecutionTime(toolName: string): number {
    // 获取平均执行时间
    const history = this.toolPerformanceHistory.get(toolName) || []
    if (history.length === 0) return 5000 // 默认5秒
    
    const totalTime = history.reduce((sum, metric) => sum + metric.executionTime, 0)
    return totalTime / history.length
  }

  private getLastUsedTime(toolName: string): number | undefined {
    const history = this.toolPerformanceHistory.get(toolName) || []
    return history.length > 0 ? Math.max(...history.map(h => h.timestamp)) : undefined
  }

  private getUsageCount(toolName: string): number {
    return this.toolPerformanceHistory.get(toolName)?.length || 0
  }

  private calculateToolScore(tool: ToolCapability, requirements: ToolRequirement): number {
    let score = 0
    
    // 能力匹配得分 (40%)
    const capabilityMatch = this.calculateCapabilityMatch(tool, requirements)
    score += capabilityMatch * 0.4
    
    // 可靠性得分 (25%)
    score += tool.reliability * 0.25
    
    // 性能得分 (20%)
    const performanceScore = Math.max(0, 1 - (tool.averageExecutionTime / 30000)) // 30秒为基准
    score += performanceScore * 0.2
    
    // 使用历史得分 (15%)
    const usageScore = Math.min(tool.usageCount / 10, 1) // 使用次数越多得分越高
    score += usageScore * 0.15
    
    return Math.min(score, 1.0)
  }

  private calculateCapabilityMatch(tool: ToolCapability, requirements: ToolRequirement): number {
    const requiredCapabilities = [requirements.primaryCapability]
    const toolCapabilities = tool.capabilities
    
    let matchCount = 0
    for (const required of requiredCapabilities) {
      if (toolCapabilities.includes(required)) {
        matchCount++
      }
    }
    
    return matchCount / requiredCapabilities.length
  }

  private generateMatchReasoning(tool: ToolCapability, requirements: ToolRequirement, score: number): string {
    const reasons = []
    
    if (tool.capabilities.includes(requirements.primaryCapability)) {
      reasons.push(`支持${requirements.primaryCapability}能力`)
    }
    
    if (tool.reliability > 0.8) {
      reasons.push(`高可靠性(${(tool.reliability * 100).toFixed(0)}%)`)
    }
    
    if (tool.averageExecutionTime < 5000) {
      reasons.push(`快速执行(${(tool.averageExecutionTime / 1000).toFixed(1)}s)`)
    }
    
    if (tool.usageCount > 5) {
      reasons.push(`使用经验丰富(${tool.usageCount}次)`)
    }
    
    return reasons.join('; ') || `匹配度${(score * 100).toFixed(0)}%`
  }

  private calculateMatchConfidence(tool: ToolCapability, requirements: ToolRequirement, score: number): number {
    return Math.min(score * 1.2, 1.0) // 置信度略高于得分
  }

  private estimateExecutionTime(tool: ToolCapability, requirements: ToolRequirement): number {
    let baseTime = tool.averageExecutionTime
    
    // 根据参数复杂度调整
    const paramCount = Object.keys(requirements.parameters).length
    const complexityMultiplier = 1 + (paramCount * 0.1)
    
    return Math.round(baseTime * complexityMultiplier)
  }

  private isComplementaryTool(match: ToolMatch, selectedTools: ToolMatch[], requirements: ToolRequirement): boolean {
    // 检查工具是否与已选工具互补
    const selectedCapabilities = new Set(selectedTools.flatMap(t => t.tool.capabilities))
    const newCapabilities = match.tool.capabilities.filter(cap => !selectedCapabilities.has(cap))
    
    return newCapabilities.length > 0 && match.score > 0.5
  }

  private canToolsRunInParallel(tools: ToolMatch[]): boolean {
    // 简化判断：如果工具数量少于等于3且没有文件操作冲突，可以并行
    if (tools.length <= 1) return false
    if (tools.length > 3) return false
    
    const hasFileOperations = tools.some(t => t.tool.capabilities.includes('file_operation'))
    return !hasFileOperations // 文件操作通常需要串行
  }

  private prepareToolParameters(tool: ToolCapability, requirements: ToolRequirement): Record<string, any> {
    // 根据工具需求准备参数
    const params: Record<string, any> = { ...requirements.parameters }
    
    // 添加工具特定的参数
    if (tool.toolName.includes('search')) {
      params.query = params.query || requirements.parameters.searchQuery || ''
    }
    
    return params
  }

  private calculateStepPriority(match: ToolMatch, requirements: ToolRequirement): number {
    return Math.round(match.score * requirements.constraints.priority)
  }
}

// 辅助接口定义
interface ToolRequirement {
  primaryCapability: string
  requiredInputTypes: string[]
  expectedOutputTypes: string[]
  parameters: Record<string, any>
  constraints: {
    maxExecutionTime: number
    requiresInternet: boolean
    requiresFileAccess: boolean
    priority: number
  }
  context: {
    userPreferences: Record<string, any>
    recentToolUsage: string[]
    systemState: Record<string, any>
  }
}

interface PerformanceMetric {
  timestamp: number
  executionTime: number
  success: boolean
  errorType?: string
}