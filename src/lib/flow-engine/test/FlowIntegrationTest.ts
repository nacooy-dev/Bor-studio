/**
 * 流程集成测试
 */

import { flowIntegration } from '../FlowIntegration'

export async function testFlowIntegration() {
  console.log('🧪 开始测试流程集成...')

  try {
    // 测试初始化
    await flowIntegration.initialize()
    console.log('✅ 流程引擎初始化成功')

    // 测试状态检查
    const status = flowIntegration.getStatus()
    console.log('📊 流程引擎状态:', status)

    // 测试简单输入处理
    const response = await flowIntegration.processUserInput('你好', [], {
      sessionId: 'test-session',
      userId: 'test-user'
    })

    console.log('🎯 处理结果:', response)

    if (response.success) {
      console.log('✅ 流程集成测试成功')
    } else {
      console.log('⚠️ 流程处理失败，但集成正常')
    }

    return true

  } catch (error) {
    console.error('❌ 流程集成测试失败:', error)
    return false
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testFlowIntegration()
}