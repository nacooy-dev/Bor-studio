/**
 * 意图分析测试
 * 验证增强的意图分析节点功能
 */

import { IntentAnalysisNode, IntentType } from '../nodes/IntentAnalysisNode'
import { ContextManager } from '../context/ContextManager'
import { defaultEntityExtractor } from '../entities/EntityExtractor'
import { FlowInput, FlowContext } from '../core/FlowNode'

/**
 * 运行意图分析测试
 */
export async function runIntentAnalysisTest(): Promise<{
  success: boolean
  results: any[]
  errors: string[]
}> {
  const results: any[] = []
  const errors: string[] = []

  try {
    console.log('🧪 开始意图分析测试...')

    // 创建意图分析节点
    const intentNode = new IntentAnalysisNode({
      id: 'intent_analysis_test',
      name: '意图分析测试节点'
    })

    // 创建上下文管理器
    const contextManager = new ContextManager()

    // 测试用例
    const testCases = [
      {
        input: '你好',
        expectedIntent: IntentType.CONVERSATION,
        description: '基础问候'
      },
      {
        input: '帮我搜索人工智能的资料',
        expectedIntent: IntentType.TOOL_CALL,
        description: '搜索工具调用'
      },
      {
        input: '现在几点了？',
        expectedIntent: IntentType.TOOL_CALL,
        description: '时间查询'
      },
      {
        input: '计算 2 + 3 * 4',
        expectedIntent: IntentType.TOOL_CALL,
        description: '数学计算'
      },
      {
        input: '切换到 llama2 模型',
        expectedIntent: IntentType.SYSTEM_OPERATION,
        description: '系统操作'
      },
      {
        input: '什么是机器学习？',
        expectedIntent: IntentType.KNOWLEDGE_QUERY,
        description: '知识查询'
      },
      {
        input: '启动 MCP 文件系统工具',
        expectedIntent: IntentType.MCP_OPERATION,
        description: 'MCP操作'
      },
      {
        input: '不明白',
        expectedIntent: IntentType.CLARIFICATION,
        description: '澄清请求'
      }
    ]

    let correctPredictions = 0
    const detailedResults: any[] = []

    // 执行测试用例
    for (const testCase of testCases) {
      try {
        // 创建测试上下文
        const context = contextManager.getContext('test-session', 'test-user')
        
        // 准备输入
        const input: FlowInput = {
          data: { message: testCase.input },
          context: context as FlowContext,
          metadata: { testCase: testCase.description }
        }

        // 执行意图分析
        const output = await intentNode.execute(input)

        if (output.error) {
          errors.push(`测试用例 "${testCase.description}" 执行失败: ${output.error.message}`)
          continue
        }

        const analysisResult = output.data.intent
        const predictedIntent = analysisResult.primaryIntent
        const confidence = analysisResult.confidence

        // 检查预测结果
        const isCorrect = predictedIntent === testCase.expectedIntent
        if (isCorrect) {
          correctPredictions++
        }

        detailedResults.push({
          input: testCase.input,
          description: testCase.description,
          expected: testCase.expectedIntent,
          predicted: predictedIntent,
          confidence: confidence,
          correct: isCorrect,
          entities: analysisResult.entities,
          parameters: analysisResult.parameters,
          reasoning: analysisResult.reasoning
        })

        results.push(`${isCorrect ? '✅' : '❌'} ${testCase.description}: ${predictedIntent} (置信度: ${(confidence * 100).toFixed(1)}%)`)

      } catch (error) {
        errors.push(`测试用例 "${testCase.description}" 异常: ${error}`)
      }
    }

    // 计算准确率
    const accuracy = correctPredictions / testCases.length
    results.push(`📊 意图识别准确率: ${(accuracy * 100).toFixed(1)}% (${correctPredictions}/${testCases.length})`)

    // 详细结果分析
    results.push('📋 详细测试结果:')
    detailedResults.forEach(result => {
      results.push(`  - ${result.description}:`)
      results.push(`    输入: "${result.input}"`)
      results.push(`    预期: ${result.expected}`)
      results.push(`    预测: ${result.predicted} (${(result.confidence * 100).toFixed(1)}%)`)
      results.push(`    实体: ${result.entities.length > 0 ? result.entities.map((e: any) => `${e.type}(${e.value})`).join(', ') : '无'}`)
      results.push(`    推理: ${result.reasoning}`)
      results.push('')
    })

    // 测试实体提取
    await testEntityExtraction(results, errors)

    console.log('🎉 意图分析测试完成')
    return {
      success: errors.length === 0 && accuracy >= 0.7, // 要求70%以上准确率
      results,
      errors
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    errors.push(`❌ 意图分析测试失败: ${errorMessage}`)
    console.error('❌ 意图分析测试失败:', error)
    
    return {
      success: false,
      results,
      errors
    }
  }
}

/**
 * 测试实体提取功能
 */
async function testEntityExtraction(results: any[], errors: string[]): Promise<void> {
  try {
    results.push('🔍 实体提取测试:')

    const entityTestCases = [
      {
        input: '计算 3.14 + 2.5',
        expectedEntities: ['number'],
        description: '数字实体'
      },
      {
        input: '明天下午3点提醒我',
        expectedEntities: ['date', 'time'],
        description: '时间日期实体'
      },
      {
        input: '打开 /Users/test/document.txt 文件',
        expectedEntities: ['file_path'],
        description: '文件路径实体'
      },
      {
        input: '访问 https://www.example.com 网站',
        expectedEntities: ['url'],
        description: 'URL实体'
      },
      {
        input: '切换到 llama2-7b 模型',
        expectedEntities: ['model_name'],
        description: '模型名称实体'
      },
      {
        input: '发送邮件到 test@example.com',
        expectedEntities: ['email'],
        description: '邮箱实体'
      }
    ]

    let entityCorrect = 0

    for (const testCase of entityTestCases) {
      const extractionResult = defaultEntityExtractor.extractEntities(testCase.input)
      const extractedTypes = [...new Set(extractionResult.entities.map(e => e.type))]
      
      const hasExpectedEntities = testCase.expectedEntities.every(expected => 
        extractedTypes.includes(expected)
      )

      if (hasExpectedEntities) {
        entityCorrect++
      }

      results.push(`  ${hasExpectedEntities ? '✅' : '❌'} ${testCase.description}: 提取到 ${extractedTypes.join(', ')}`)
    }

    const entityAccuracy = entityCorrect / entityTestCases.length
    results.push(`📊 实体提取准确率: ${(entityAccuracy * 100).toFixed(1)}% (${entityCorrect}/${entityTestCases.length})`)

  } catch (error) {
    errors.push(`实体提取测试失败: ${error}`)
  }
}

/**
 * 测试上下文感知功能
 */
export async function runContextAwarenessTest(): Promise<{
  success: boolean
  results: any[]
  errors: string[]
}> {
  const results: any[] = []
  const errors: string[] = []

  try {
    console.log('🧪 开始上下文感知测试...')

    const contextManager = new ContextManager()
    const sessionId = 'context-test-session'
    const userId = 'context-test-user'

    // 模拟对话历史
    const conversationHistory = [
      { id: '1', role: 'user' as const, content: '我想学习机器学习', timestamp: Date.now() - 60000 },
      { id: '2', role: 'assistant' as const, content: '机器学习是人工智能的一个分支...', timestamp: Date.now() - 50000 },
      { id: '3', role: 'user' as const, content: '有什么好的Python库推荐吗？', timestamp: Date.now() - 40000 },
      { id: '4', role: 'assistant' as const, content: 'scikit-learn、TensorFlow和PyTorch都是很好的选择...', timestamp: Date.now() - 30000 }
    ]

    // 建立上下文
    const context = contextManager.getContext(sessionId, userId)
    for (const msg of conversationHistory) {
      contextManager.updateContext(sessionId, msg)
    }

    // 测试上下文相关性分析
    const testInput = '那TensorFlow怎么安装？'
    const relevanceAnalysis = contextManager.analyzeContextRelevance(context, testInput)

    results.push('🔍 上下文相关性分析:')
    results.push(`  相关消息数: ${relevanceAnalysis.relevantMessages.length}`)
    results.push(`  相关主题数: ${relevanceAnalysis.relevantTopics.length}`)
    results.push(`  相关实体数: ${relevanceAnalysis.relevantEntities.length}`)
    results.push(`  上下文得分: ${relevanceAnalysis.contextScore.toFixed(2)}`)

    // 验证是否找到了相关的历史消息
    const foundRelevantMessage = relevanceAnalysis.relevantMessages.some(msg => 
      msg.content.includes('TensorFlow') || msg.content.includes('Python')
    )

    if (foundRelevantMessage) {
      results.push('✅ 成功识别相关历史消息')
    } else {
      errors.push('❌ 未能识别相关历史消息')
    }

    // 测试用户偏好分析
    const userPreferences = contextManager.getUserPreferences(userId)
    results.push('👤 用户偏好分析:')
    results.push(`  对话风格: ${userPreferences.conversationStyle}`)
    results.push(`  常用工具: ${userPreferences.favoriteTools?.join(', ') || '无'}`)

    console.log('🎉 上下文感知测试完成')
    return {
      success: errors.length === 0,
      results,
      errors
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    errors.push(`❌ 上下文感知测试失败: ${errorMessage}`)
    
    return {
      success: false,
      results,
      errors
    }
  }
}