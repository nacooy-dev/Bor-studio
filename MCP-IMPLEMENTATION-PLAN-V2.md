# MCP集成实施计划 V2.0 - 基于5ire框架

## 🎯 核心目标

**让智能助手自主学习MCP工具文档，在对话中自然调用MCP工具，同时保持系统轻量化**

## 📊 当前项目状态分析

### 现有架构优势 ✅
- **成熟的意图识别系统** - `IntentRecognizer` + `DialogueRouter`
- **完整的LLM管理** - 多供应商支持，配置管理完善
- **Electron桌面架构** - 与5ire技术栈匹配
- **Vue.js前端** - 现代化响应式界面
- **轻量化设计** - 适合笔记本电脑环境

### 需要集成的功能
- **5ire MCP核心** - MCP服务器管理和stdio协议
- **智能工具学习** - 自动发现和学习MCP工具
- **自然语言工具调用** - 在对话中无缝调用工具
- **MCP管理界面** - 通过自然语言触发的管理界面

## 🏗️ 轻量化集成架构

### 核心原则
1. **最小化依赖** - 只集成5ire的核心MCP功能
2. **内存优化** - 按需加载MCP服务器
3. **性能优先** - 异步处理，避免阻塞主线程
4. **渐进增强** - 保持现有功能不受影响

### 架构设计
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   现有对话系统   │    │   MCP工具学习器   │    │   5ire MCP核心   │
│                │    │                  │    │                │
│ • IntentRecognizer │◄──►│ • 工具发现        │◄──►│ • 服务器管理     │
│ • DialogueRouter  │    │ • 文档解析        │    │ • stdio协议     │
│ • LLM集成        │    │ • 智能匹配        │    │ • 工具执行      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 分阶段实施计划

### 阶段1: 5ire核心集成 (2-3天)

#### 1.1 研究和提取5ire核心代码
- [ ] 克隆5ire项目并分析核心模块
- [ ] 识别关键文件：MCP管理器、stdio协议、工具发现
- [ ] 提取轻量化的核心功能

#### 1.2 创建MCP核心模块
```typescript
// src/lib/mcp/
├── manager.ts          # MCP服务器管理器 (从5ire提取)
├── protocol.ts         # stdio协议处理 (从5ire提取)
├── discovery.ts        # 工具发现机制 (从5ire提取)
├── types.ts           # MCP类型定义
└── index.ts           # 统一导出
```

#### 1.3 Electron主进程集成
- [ ] 在 `electron/main.ts` 中集成MCP管理器
- [ ] 实现IPC通信接口
- [ ] 添加MCP相关的Electron API

### 阶段2: 增强意图识别系统 (2天)

#### 2.1 扩展IntentType支持MCP
```typescript
// src/services/intent/IntentRecognizer.ts (增强)
export enum IntentType {
  // 现有类型保持不变
  LLM_MANAGEMENT = 'llm_management',
  SYSTEM_CONFIG = 'system_config',
  // ... 其他现有类型
  
  // 新增MCP相关类型
  MCP_MANAGEMENT = 'mcp_management',
  MCP_TOOL_CALL = 'mcp_tool_call',
  MCP_SERVER_CONTROL = 'mcp_server_control',
}
```

#### 2.2 创建MCP工具注册器
```typescript
// src/services/mcp/tool-registry.ts
class MCPToolRegistry {
  async discoverTools(): Promise<MCPTool[]>
  async registerTool(tool: MCPTool): Promise<void>
  async getToolByIntent(userInput: string): Promise<MCPTool | null>
}
```

#### 2.3 智能参数提取器
```typescript
// src/services/mcp/parameter-extractor.ts
class ParameterExtractor {
  async extractParameters(userInput: string, tool: MCPTool): Promise<any>
  async validateParameters(params: any, schema: any): Promise<boolean>
}
```

### 阶段3: 对话系统集成 (2天)

#### 3.1 创建MCP对话处理器
```typescript
// src/services/dialogue/MCPDialogueHandler.ts
class MCPDialogueHandler implements DialogueHandler {
  async handle(userInput: string, intent: IntentResult): Promise<DialogueResponse>
  private async executeToolCall(tool: MCPTool, params: any): Promise<any>
  private async handleMCPManagement(userInput: string): Promise<DialogueResponse>
}
```

#### 3.2 更新DialogueRouter
- [ ] 注册MCPDialogueHandler
- [ ] 添加MCP工具调用路由逻辑
- [ ] 保持现有系统配置等功能不受影响

### 阶段4: 轻量化UI集成 (1-2天)

#### 4.1 MCP管理组件
```vue
<!-- src/components/MCPManager.vue -->
<template>
  <div class="mcp-manager">
    <!-- 轻量化的MCP服务器管理界面 -->
  </div>
</template>
```

#### 4.2 自然语言触发
- [ ] 通过意图识别触发MCP管理界面
- [ ] 集成到现有的对话流程中

### 阶段5: 测试和优化 (1天)

#### 5.1 功能测试
- [ ] MCP服务器管理测试
- [ ] 工具发现和调用测试
- [ ] 对话集成测试

#### 5.2 性能优化
- [ ] 内存使用优化
- [ ] 启动时间优化
- [ ] 响应速度优化

## 🛠️ 具体实施步骤

### 第1步: 创建MCP核心模块结构

```typescript
// src/lib/mcp/types.ts
export interface MCPServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  status: 'stopped' | 'starting' | 'running' | 'error'
}

export interface MCPTool {
  name: string
  description: string
  server: string
  schema: any
  examples?: string[]
}

export interface MCPToolCall {
  tool: string
  parameters: any
  server: string
}
```

### 第2步: 集成5ire MCP管理器

```typescript
// src/lib/mcp/manager.ts (从5ire提取并轻量化)
export class MCPManager {
  private servers: Map<string, MCPServer> = new Map()
  private tools: Map<string, MCPTool> = new Map()
  
  async startServer(config: MCPServer): Promise<void>
  async stopServer(id: string): Promise<void>
  async listTools(serverId?: string): Promise<MCPTool[]>
  async executeTool(call: MCPToolCall): Promise<any>
  
  // 轻量化实现，按需加载
  private async loadServerOnDemand(id: string): Promise<void>
}
```

### 第3步: 增强意图识别

```typescript
// src/services/intent/IntentRecognizer.ts (增强版)
export class IntentRecognizer {
  private mcpToolRegistry?: MCPToolRegistry
  
  async recognizeIntent(userInput: string, history?: Message[]): Promise<IntentResult> {
    // 1. 现有意图识别逻辑
    const basicIntent = await this.recognizeBasicIntent(userInput, history)
    
    // 2. MCP工具意图识别
    if (this.mcpToolRegistry) {
      const toolIntent = await this.recognizeMCPToolIntent(userInput)
      if (toolIntent.confidence > basicIntent.confidence) {
        return toolIntent
      }
    }
    
    return basicIntent
  }
  
  // 保持现有方法不变，添加新的MCP相关方法
  private async recognizeMCPToolIntent(userInput: string): Promise<IntentResult>
}
```

### 第4步: 对话系统集成

```typescript
// src/services/dialogue/DialogueRouter.ts (增强版)
export class DialogueRouter {
  constructor() {
    // 保持现有处理器
    this.handlers.set(IntentType.LLM_MANAGEMENT, new LLMManagementHandler())
    this.handlers.set(IntentType.SYSTEM_CONFIG, new SystemConfigHandler())
    
    // 添加MCP处理器
    this.handlers.set(IntentType.MCP_TOOL_CALL, new MCPToolCallHandler())
    this.handlers.set(IntentType.MCP_MANAGEMENT, new MCPManagementHandler())
  }
}
```

## 🎯 轻量化策略

### 内存优化
1. **按需加载** - MCP服务器只在需要时启动
2. **工具缓存** - 智能缓存常用工具信息
3. **连接池** - 复用MCP连接，避免频繁创建

### 性能优化
1. **异步处理** - 所有MCP操作异步执行
2. **超时控制** - 设置合理的工具执行超时
3. **错误恢复** - 优雅处理MCP服务器异常

### 资源管理
1. **自动清理** - 定期清理未使用的MCP连接
2. **资源限制** - 限制同时运行的MCP服务器数量
3. **监控告警** - 监控资源使用情况

## 📊 成功指标

### 功能指标
- [ ] **MCP服务器管理** - 能够启动、停止、配置MCP服务器
- [ ] **工具自动发现** - 自动发现并学习MCP工具
- [ ] **自然语言调用** - 通过对话自然调用MCP工具
- [ ] **系统兼容性** - 不影响现有LLM管理等功能

### 性能指标
- [ ] **启动时间** - 应用启动时间增加<2秒
- [ ] **内存使用** - 空闲时内存增加<50MB
- [ ] **响应时间** - 工具调用响应时间<5秒
- [ ] **稳定性** - 24小时运行无崩溃

### 用户体验指标
- [ ] **学习能力** - 能够自动学习新MCP工具
- [ ] **调用准确率** - >85%的工具调用意图识别准确
- [ ] **参数提取率** - >80%的参数自动提取准确
- [ ] **用户满意度** - 自然的工具调用体验

## 🚀 实施优先级

### P0 (必须完成)
1. 5ire MCP核心集成
2. 基础工具发现和调用
3. 意图识别系统增强

### P1 (重要)
1. 智能参数提取
2. MCP管理界面
3. 性能优化

### P2 (优化)
1. 高级工具学习
2. 工具推荐系统
3. 使用统计和分析

---

**这个新的实施计划基于当前干净的代码库，专注于轻量化集成5ire的MCP核心功能，同时保持现有系统的完整性。您觉得这个方案如何？需要我开始实施某个具体阶段吗？**