// 简单测试意图识别
import { IntentRecognizer } from './services/intent/IntentRecognizer.js'

const recognizer = new IntentRecognizer()

async function testIntent() {
  const testInput = '配置 LLM'
  console.log('测试输入:', testInput)
  
  try {
    const result = await recognizer.recognizeIntent(testInput)
    console.log('识别结果:', result)
  } catch (error) {
    console.error('测试失败:', error)
  }
}

testIntent()