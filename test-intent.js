// 简单的意图识别测试
const testCases = [
  // 应该匹配 LLM_MANAGEMENT 的情况
  { input: "配置LLM", expected: "LLM_MANAGEMENT", shouldMatch: true },
  { input: "配置bor的llm设置", expected: "LLM_MANAGEMENT", shouldMatch: true },
  { input: "设置模型", expected: "LLM_MANAGEMENT", shouldMatch: true },
  { input: "切换模型", expected: "LLM_MANAGEMENT", shouldMatch: true },
  
  // 不应该匹配 LLM_MANAGEMENT 的情况
  { input: "我今天要配置一个新的服务器，然后使用LLM来处理数据，这个过程需要很多步骤", expected: "LLM_MANAGEMENT", shouldMatch: false },
  { input: "请帮我写一个关于配置管理的文档，其中要包含LLM相关的内容", expected: "LLM_MANAGEMENT", shouldMatch: false },
  { input: "我在研究各种模型的配置方法", expected: "LLM_MANAGEMENT", shouldMatch: false },
  
  // 其他意图测试
  { input: "切换主题", expected: "THEME_CHANGE", shouldMatch: true },
  { input: "创建工作流", expected: "WORKFLOW_CREATION", shouldMatch: true },
  { input: "上传文档", expected: "DOCUMENT_UPLOAD", shouldMatch: true },
]

console.log("意图识别测试用例:")
testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. "${testCase.input}"`)
  console.log(`   期望: ${testCase.shouldMatch ? '匹配' : '不匹配'} ${testCase.expected}`)
  console.log(`   输入长度: ${testCase.input.length} 字符`)
  console.log()
})