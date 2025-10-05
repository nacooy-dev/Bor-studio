# 5ire MCP集成方案 - 智能助手自主工具调用

## 🎯 核心目标

**让智能助手能够自主学习MCP工具文档，在对话中自然地调用MCP工具完成操作**

## 🧠 智能助手MCP工具学习机制

### 1. 工具发现与文档解析
```
MCP工具注册 → 文档解析 → 能力映射 → 上下文注入
```

#### 工具文档自动解析
- **工具schema解析** - 自动解析MCP工具的输入输出schema
- **功能描述提取** - 提取工具的功能描述和使用场景
- **参数映射** - 将工具参数映射为自然语言描述
- **示例生成** - 自动生成工具使用示例

#### 智能上下文构建
```typescript
interface ToolContext {
  name: string
  description: string
  capabilities: string[]
  parameters: ParameterSchema[]
  examples: UsageExample[]
  naturalLanguageTriggers: string[]
}
```

### 2. 对话中的工具调用流程
```
用户输入 → 意图识别 → 工具匹配 → 参数提取 → 工具调用 → 结果处理
```

#### 智能工具匹配
- **意图分析** - 分析用户意图，匹配合适的MCP工具
- **参数智能提取** - 从自然语言中提取工具所需参数
- **上下文推理** - 基于对话上下文推理缺失参数
- **确认机制** - 关键操作前的智能确认

## 🏗️ 技术架构

### 核心组件架构
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   对话系统      │    │   MCP工具学习器   │    │   5ire MCP核心   │
│                │    │                  │    │                │
│ • 意图识别      │◄──►│ • 工具发现        │◄──►│ • 服务器管理     │
│ • 参数提取      │    │ • 文档解析        │    │ • stdio协议     │
│ • 工具调用      │    │ • 能力映射        │    │ • 工具执行      │
│ • 结果处理      │    │ • 上下文构建      │    │ • 错误处理      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 数据流
```
MCP服务器 → 工具发现 → 文档解析 → 能力注册 → 对话上下文 → 智能调用
```

## 📋 详细实施计划

### 阶段1: 5ire核心集成 (2-3天)

#### 1.1 提取5ire MCP核心代码
- [ ] 克隆5ire项目并分析核心模块
- [ ] 提取MCP服务器管理器 (`src/main/mcp/manager.ts`)
- [ ] 提取stdio协议处理 (`src/main/mcp/transport.ts`)
- [ ] 提取工具发现机制 (`src/main/mcp/discovery.ts`)

#### 1.2 适配到我们的项目结构
- [ ] 创建 `src/lib/mcp-5ire/` 目录结构
- [ ] 适配5ire代码到我们的TypeScript配置
- [ ] 集成到Electron主进程 (`electron/main.ts`)
- [ ] 实现IPC通信接口

### 阶段2: 智能工具学习系统 (3-4天)

#### 2.1 MCP工具文档解析器
```typescript
// src/lib/mcp-5ire/tool-learner.ts
class MCPToolLearner {
  async discoverTools(): Promise<ToolContext[]>
  async parseToolSchema(tool: MCPTool): Promise<ToolContext>
  async generateNaturalLanguageTriggers(tool: ToolContext): Promise<string[]>
  async buildToolContext(tools: ToolContext[]): Promise<string>
}
```

#### 2.2 智能参数提取器
```typescript
// src/lib/mcp-5ire/parameter-extractor.ts
class ParameterExtractor {
  async extractParameters(userInput: string, toolSchema: ToolContext): Promise<any>
  async inferMissingParameters(context: ConversationContext): Promise<any>
  async validateParameters(params: any, schema: ToolContext): Promise<boolean>
}
```

#### 2.3 工具调用协调器
```typescript
// src/lib/mcp-5ire/tool-coordinator.ts
class ToolCoordinator {
  async matchToolsForIntent(intent: string, context: string): Promise<ToolContext[]>
  async executeToolWithContext(tool: ToolContext, params: any): Promise<any>
  async handleToolErrors(error: any, tool: ToolContext): Promise<string>
}
```

### 阶段3: 对话系统集成 (2-3天)

#### 3.1 增强意图识别
- [ ] 扩展 `IntentRecognizer` 支持MCP工具意图
- [ ] 添加工具调用意图类型
- [ ] 实现动态意图学习（基于可用工具）

#### 3.2 MCP对话处理器增强
```typescript
// src/services/dialogue/EnhancedMCPDialogueHandler.ts
class EnhancedMCPDialogueHandler {
  private toolLearner: MCPToolLearner
  private parameterExtractor: ParameterExtractor
  private toolCoordinator: ToolCoordinator
  
  async handleToolRequest(userInput: string, context: DialogueContext): Promise<DialogueResponse>
  async learnNewTools(): Promise<void>
  async buildToolAwareContext(): Promise<string>
}
```

#### 3.3 智能工具调用流程
- [ ] 实现工具匹配算法
- [ ] 添加参数智能提取
- [ ] 实现工具调用确认机制
- [ ] 添加工具调用结果处理

### 阶段4: 自然语言工具调用 (2天)

#### 4.1 工具能力注入LLM上下文
```typescript
// 动态构建包含工具信息的系统提示
const systemPrompt = `
你是一个智能助手，可以使用以下工具：

${availableTools.map(tool => `
**${tool.name}**: ${tool.description}
参数: ${tool.parameters.map(p => `${p.name}(${p.type}): ${p.description}`).join(', ')}
使用场景: ${tool.examples.join('; ')}
`).join('\n')}

当用户需要执行相关操作时，你可以调用这些工具。
`
```

#### 4.2 工具调用语法设计
```typescript
// 智能助手调用工具的标准格式
interface ToolCall {
  action: "call_tool"
  tool: string
  parameters: Record<string, any>
  reasoning: string
}

// 示例：
{
  action: "call_tool",
  tool: "filesystem_read",
  parameters: { path: "/Users/user/document.txt" },
  reasoning: "用户想要查看文档内容"
}
```

#### 4.3 结果处理和反馈
- [ ] 工具执行结果格式化
- [ ] 错误处理和用户友好提示
- [ ] 工具调用历史记录
- [ ] 工具使用统计和优化

### 阶段5: MCP管理界面 (1-2天)

#### 5.1 自然语言触发的管理界面
- [ ] 意图识别："打开MCP管理"、"查看工具列表"
- [ ] 实现MCP管理页面路由
- [ ] 适配5ire的UI组件到我们的设计系统

#### 5.2 工具学习状态展示
- [ ] 显示已发现的工具列表
- [ ] 展示工具学习状态和能力
- [ ] 提供工具测试界面

## 🎯 关键技术实现

### 1. 智能工具发现
```typescript
// 自动发现并学习MCP工具
async function discoverAndLearnTools() {
  const mcpServers = await mcpManager.getActiveServers()
  const allTools = []
  
  for (const server of mcpServers) {
    const tools = await server.listTools()
    for (const tool of tools) {
      const context = await toolLearner.parseToolSchema(tool)
      const triggers = await toolLearner.generateNaturalLanguageTriggers(context)
      allTools.push({ ...context, triggers })
    }
  }
  
  // 更新LLM上下文
  await updateLLMContext(allTools)
}
```

### 2. 智能参数提取
```typescript
// 从自然语言中提取工具参数
async function extractToolParameters(userInput: string, toolSchema: ToolContext) {
  const extractor = new ParameterExtractor()
  
  // 使用NLP技术提取参数
  const extractedParams = await extractor.extractParameters(userInput, toolSchema)
  
  // 推理缺失参数
  const inferredParams = await extractor.inferMissingParameters(conversationContext)
  
  return { ...extractedParams, ...inferredParams }
}
```

### 3. 工具调用决策
```typescript
// 智能决策是否调用工具
async function shouldCallTool(userIntent: string, availableTools: ToolContext[]) {
  const matchedTools = await toolCoordinator.matchToolsForIntent(userIntent, conversationContext)
  
  if (matchedTools.length === 0) return null
  if (matchedTools.length === 1) return matchedTools[0]
  
  // 多个工具匹配时的智能选择
  return await selectBestTool(matchedTools, userIntent)
}
```

## 📊 成功指标

### 功能指标
- [ ] **工具自动发现** - 能够自动发现并学习新的MCP工具
- [ ] **自然调用** - 用户可以用自然语言调用MCP工具
- [ ] **参数智能提取** - 从对话中智能提取工具参数
- [ ] **上下文推理** - 基于对话历史推理工具使用

### 用户体验指标
- [ ] **调用成功率** - >90%的工具调用成功执行
- [ ] **参数准确率** - >85%的参数提取准确
- [ ] **响应时间** - 工具调用响应时间<3秒
- [ ] **用户满意度** - 自然的工具调用体验

### 示例对话流程
```
用户: "帮我读取桌面上的readme.txt文件"
助手: [自动识别需要文件读取工具] 
     [提取参数: path="~/Desktop/readme.txt"]
     [调用filesystem_read工具]
     "我来为您读取文件内容..."
     [显示文件内容]

用户: "搜索一下关于Vue.js的最新信息"
助手: [识别需要搜索工具]
     [提取参数: query="Vue.js latest information"]
     [调用web_search工具]
     "我来为您搜索Vue.js的最新信息..."
     [显示搜索结果]
```

## 🚀 实施优先级

### P0 (必须完成)
1. 5ire MCP核心集成
2. 基础工具发现和调用
3. 简单的参数提取

### P1 (重要)
1. 智能参数推理
2. 工具调用确认机制
3. 错误处理和恢复

### P2 (优化)
1. 工具使用学习和优化
2. 高级上下文推理
3. 工具调用性能优化

---

**这个方案重点关注智能助手的自主工具学习和自然调用能力，符合您的需求吗？需要我详细展开某个技术实现部分吗？**