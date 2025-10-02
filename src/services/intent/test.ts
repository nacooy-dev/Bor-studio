// 简单的意图识别测试
import { IntentRecognizer, IntentType } from './IntentRecognizer'

const recognizer = new IntentRecognizer()

// 测试用例
const testCases = [
  '配置 LLM',
  '切换模型到 GPT-4',
  '帮我上传文档',
  '创建一个定时任务',
  '切换到深色主题',
  '你好，今天天气怎么样？',
  '搜索我的文档',
  '配置系统设置'
]

async function runTests() {
  console.log('🧪 开始意图识别测试...\n')
  
  for (const testCase of testCases) {
    try {
      const result = await recognizer.recognizeIntent(testCase)
      console.log(`输入: "${testCase}"`)
      console.log(`意图: ${result.type}`)
      console.log(`置信度: ${result.confidence}`)
      console.log(`参数: ${JSON.stringify(result.params)}`)
      console.log(`说明: ${result.explanation}`)
      console.log('---')
    } catch (error) {
      console.error(`测试失败: ${testCase}`, error)
    }
  }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  runTests()
}

export { runTests }