# Bor - 智能体中枢设计规划 V6.0

## 项目概述

**Bor** 是一个基于现代技术栈的常驻桌面智能体中枢，采用"轻量核心 + 强大生态"的设计理念，通过集成成熟开源框架实现快速开发和高质量交付。**Bor** 采用Web-First架构设计，一套代码多端部署的现代化智能体中枢。通过先进的Web技术栈构建核心应用，再通过不同的打包方式实现Web版、桌面版覆盖。

## 核心技术架构

### 1. 前端交互层 - Chatbot UI + Apple风格定制
- **基础框架**: Chatbot UI Core
- **定制方向**: Apple风格桌面级交互体验
- **集成方式**: Electron + Vue 3 + Vite 

### 2. LLM管理层 - LLMChat
- **功能**: 多模型管理、对话编排、知识库集成
- **优势**: 成熟的LLM抽象层和路由机制
- **集成**: 通过API Gateway模式集成到chatbot

### 3. MCP调度层 - Claude Desktop MCP架构
- **协议**: 基于官方MCP SDK实现和LLMchat、chatbot的对接
- **管理**: 服务器生命周期、工具发现、错误处理
- **扩展**: 支持自定义MCP服务器开发

### 4. 自动编程工具 - 轻量级代码生成
- **目标**: YAML脚本智能编译、工作流代码生成，实现和LLMchat、chatbot UI的对接
- **选型**: Aider (主推) + Tabby (本地) 
- **应用**: 工作流DSL转换、配置文件生成、智能代码补全

## 详细技术选型

### 前端架构 (Chatbot UI定制)

#### 核心组件选择
```typescript
// 基于Chatbot UI的核心组件
interface BorUIComponents {
  // 聊天界面
  ChatInterface: 'chatbot-ui/chat'           // 流式渲染、消息管理
  MessageRenderer: 'chatbot-ui/message'     // Markdown、代码高亮
  InputArea: 'chatbot-ui/input'             // 多模态输入、快捷键
  
  // 定制组件
  AppleSidebar: 'bor/sidebar'               // macOS风格导航
  GlassPanel: 'bor/glass-panel'             // 毛玻璃效果容器
  WorkflowCanvas: 'bor/workflow'            // 工作流可视化
}
```

#### Apple风格定制主题
```css
/* Apple Design System for Bor */
:root {
  /* 颜色系统 */
  --primary-blue: #007AFF;
  --secondary-gray: #8E8E93;
  --background-primary: rgba(255, 255, 255, 0.8);
  --background-secondary: rgba(248, 248, 248, 0.9);
  
  /* 毛玻璃效果 */
  --glass-blur: blur(20px);
  --glass-opacity: 0.8;
  
  /* 圆角系统 */
  --radius-small: 6px;
  --radius-medium: 12px;
  --radius-large: 16px;
  
  /* 字体系统 */
  --font-system: -apple-system, BlinkMacSystemFont, 'SF Pro Display';
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code';
}
```

### LLM管理层 (LLMChat集成)

#### 架构设计
```rust
// src-tauri/src/llm/mod.rs
use llmchat_core::{LLMRouter, ModelProvider, KnowledgeBase};

pub struct BorLLMManager {
    router: LLMRouter,
    providers: Vec<Box<dyn ModelProvider>>,
    knowledge_base: KnowledgeBase,
}

impl BorLLMManager {
    pub async fn new() -> Self {
        let mut router = LLMRouter::new();
        
        // 注册模型提供商
        router.register_provider("openai", OpenAIProvider::new()).await;
        router.register_provider("anthropic", AnthropicProvider::new()).await;
        router.register_provider("local", LocalModelProvider::new()).await;
        
        Self {
            router,
            providers: vec![],
            knowledge_base: KnowledgeBase::new("./data/knowledge"),
        }
    }
    
    pub async fn chat_completion(&self, request: ChatRequest) -> Result<ChatResponse> {
        // 智能路由到最适合的模型
        let model = self.router.select_model(&request).await?;
        
        // 集成知识库上下文
        let enhanced_request = self.knowledge_base
            .enhance_request(request).await?;
        
        model.complete(enhanced_request).await
    }
}
```

#### 知识库集成
```typescript
// 前端知识库管理界面
interface KnowledgeBaseConfig {
  // 文档管理
  documents: {
    upload: (files: File[]) => Promise<void>
    index: (docId: string) => Promise<void>
    search: (query: string) => Promise<SearchResult[]>
  }
  
  // 向量数据库
  vectorStore: {
    provider: 'chroma' | 'pinecone' | 'local'
    dimensions: number
    similarity_threshold: number
  }
  
  // RAG配置
  rag: {
    chunk_size: number
    overlap: number
    retrieval_count: number
  }
}
```

### MCP调度层 (Claude Desktop架构)

#### MCP服务器管理
```rust
// src-tauri/src/mcp/manager.rs
use mcp_sdk::{Client, Server, Transport};

pub struct MCPManager {
    servers: HashMap<String, MCPServerInstance>,
    client: Client,
}

impl MCPManager {
    pub async fn register_server(&mut self, config: ServerConfig) -> Result<()> {
        let transport = match config.transport {
            TransportType::Stdio => StdioTransport::new(&config.command, &config.args),
            TransportType::WebSocket => WebSocketTransport::new(&config.url),
        };
        
        let server = MCPServerInstance::new(config.name.clone(), transport).await?;
        self.servers.insert(config.name, server);
        
        Ok(())
    }
    
    pub async fn call_tool(&self, server_name: &str, tool_name: &str, args: Value) -> Result<Value> {
        let server = self.servers.get(server_name)
            .ok_or_else(|| anyhow!("Server not found: {}", server_name))?;
        
        server.call_tool(tool_name, args).await
    }
    
    pub async fn list_available_tools(&self) -> Vec<ToolInfo> {
        let mut tools = Vec::new();
        
        for (server_name, server) in &self.servers {
            if let Ok(server_tools) = server.list_tools().await {
                for tool in server_tools {
                    tools.push(ToolInfo {
                        server: server_name.clone(),
                        name: tool.name,
                        description: tool.description,
                        schema: tool.input_schema,
                    });
                }
            }
        }
        
        tools
    }
}
```

#### 预配置MCP服务器
```json
{
  "mcp_servers": {
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "args": [],
      "auto_start": true,
      "health_check_interval": 30
    },
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "./workspace"],
      "auto_start": true
    },
    "brave-search": {
      "command": "npx", 
      "args": ["@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      },
      "auto_start": false
    }
  }
}
```

### 自动编程工具集成

#### 轻量级代码生成框架选型

##### 1. Aider - AI编程助手 (主推荐)
```typescript
// electron/codegen/aider.ts
import { spawn } from 'child_process';
import path from 'path';

export class AiderIntegration {
    private workspaceDir: string;
    
    constructor(workspaceDir: string = './workspace') {
        this.workspaceDir = workspaceDir;
    }
    
    async generateYAML(description: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const aider = spawn('aider', [
                '--yes',
                '--message', `Generate YAML workflow: ${description}`,
                '--model', 'gpt-4'
            ], {
                cwd: this.workspaceDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let output = '';
            aider.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            aider.on('close', (code) => {
                if (code === 0) {
                    resolve(this.extractYAMLFromOutput(output));
                } else {
                    reject(new Error(`Aider failed with code ${code}`));
                }
            });
        });
    }
    
    private extractYAMLFromOutput(output: string): string {
        // 提取生成的YAML内容
        const yamlMatch = output.match(/```yaml\n([\s\S]*?)\n```/);
        return yamlMatch ? yamlMatch[1] : output;
    }
}
```

##### 2. Tabby - 本地代码补全
```typescript
// electron/codegen/tabby.ts
import axios from 'axios';

export class TabbyClient {
    private baseUrl: string;
    
    constructor(baseUrl: string = 'http://localhost:8080') {
        this.baseUrl = baseUrl;
    }
    
    async completeCode(prefix: string, language: string = 'yaml'): Promise<string> {
        try {
            const response = await axios.post(`${this.baseUrl}/v1/completions`, {
                language,
                segments: {
                    prefix,
                    suffix: ''
                }
            });
            
            return response.data.choices[0]?.text || '';
        } catch (error) {
            console.error('Tabby completion failed:', error);
            return '';
        }
    }
    
    async generateWorkflow(description: string): Promise<string> {
        const prefix = `# Workflow: ${description}\nname: `;
        return await this.completeCode(prefix);
    }
}
```

##### 3. CodeT5 - 离线代码生成
```python
# scripts/codet5_server.py - 独立的Python服务
from transformers import T5ForConditionalGeneration, RobertaTokenizer
import flask
from flask import request, jsonify

app = flask.Flask(__name__)

class CodeT5Generator:
    def __init__(self):
        self.model = T5ForConditionalGeneration.from_pretrained('Salesforce/codet5-small')
        self.tokenizer = RobertaTokenizer.from_pretrained('Salesforce/codet5-small')
    
    def generate(self, prompt: str, max_length: int = 512) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt", max_length=512, truncation=True)
        outputs = self.model.generate(**inputs, max_length=max_length, num_beams=4)
        return self.tokenizer.decode(outputs[0], skip_special_tokens=True)

generator = CodeT5Generator()

@app.route('/generate', methods=['POST'])
def generate_code():
    data = request.json
    prompt = data.get('prompt', '')
    result = generator.generate(f"Generate YAML: {prompt}")
    return jsonify({'generated_code': result})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8081)
```

#### YAML工作流智能编译
```typescript
// 前端工作流编辑器
interface WorkflowEditor {
  // 自然语言转YAML
  generateFromDescription: (description: string) => Promise<string>
  
  // 可视化编辑
  visualEditor: {
    nodes: WorkflowNode[]
    connections: Connection[]
    compile: () => Promise<string>
  }
  
  // 智能补全
  autoComplete: {
    suggestSteps: (context: string) => Promise<string[]>
    validateSyntax: (yaml: string) => ValidationResult
    optimizeWorkflow: (yaml: string) => Promise<string>
  }
}
```

## 实施计划

### Phase 1: 基础架构搭建 (第1-2周)

#### Week 1: 前端框架集成
- [ ] **Day 1-2**: 集成Chatbot UI定制化界面
  
  ```bash
  # 安装依赖
  npm install chatbot-ui-vue @chatbot-ui/core
  
  # 创建Apple风格主题
  # 实现基础聊天界面
  ```
  
- [ ] **Day 3-4**: Apple风格UI定制
  ```typescript
  // 实现毛玻璃效果
  // 定制消息气泡样式
  // 集成macOS原生组件
  ```

- [ ] **Day 5-7**: 响应式布局和交互优化
  ```vue
  <!-- 侧边栏导航重构 -->
  <!-- 主内容区域适配 -->
  <!-- 快捷键支持 -->
  ```

#### Week 2: 后端服务集成
- [ ] **Day 1-3**: LLMChat集成
  ```rust
  // 集成LLMChat核心库
  // 实现模型路由器
  // 配置知识库存储
  ```

- [ ] **Day 4-5**: MCP管理器实现
  ```rust
  // 基于Claude Desktop MCP架构
  // 实现服务器生命周期管理
  // 添加工具发现机制
  ```

- [ ] **Day 6-7**: 自动编程工具集成
  ```typescript
  // 集成Aider AI编程助手
  // 配置Tabby本地代码补全服务
  // 实现YAML智能编译和验证
  // 添加代码模板引擎
  ```

### Phase 2: 核心功能实现 (第3-4周)

#### Week 3: 智能对话系统
- [ ] **Day 1-2**: 多模型支持
  ```typescript
  // OpenAI GPT系列
  // Anthropic Claude系列  
  // Ollama本地模型支持
  // 智谱系列
  // OpenRouter
  // OpenAI兼容自定义
  ```
  
- [ ] **Day 3-4**: 知识库RAG集成
  ```rust
  // 文档向量化
  // 相似度搜索
  // 上下文增强
  ```

- [ ] **Day 5-7**: 对话历史和管理
  ```vue
  <!-- 对话列表组件 -->
  <!-- 搜索和过滤 -->
  <!-- 导出和分享 -->
  ```

#### Week 4: MCP工具生态
- [ ] **Day 1-3**: 预置MCP服务器
  ```json
  // Chrome DevTools自动化
  // 文件系统操作
  // 搜索引擎集成
  ```

- [ ] **Day 4-5**: 工具调用界面
  ```vue
  <!-- 可用工具列表 -->
  <!-- 工具参数配置 -->
  <!-- 执行结果展示 -->
  ```

- [ ] **Day 6-7**: 自定义MCP服务器支持
  ```rust
  // 服务器注册机制
  // 配置文件管理
  // 健康检查系统
  ```

### Phase 3: 高级功能开发 (第5-6周)

#### Week 5: 工作流系统
- [ ] **Day 1-3**: 可视化工作流编辑器
  ```vue
  <!-- 拖拽式节点编辑 -->
  <!-- 连线和条件分支 -->
  <!-- 实时预览和验证 -->
  ```

- [ ] **Day 4-5**: 工作流执行引擎
  ```rust
  // DAG任务调度
  // 并行执行支持
  // 错误处理和重试
  ```

- [ ] **Day 6-7**: 智能工作流生成
  ```typescript
  // 自然语言描述转工作流
  // 模板库和推荐
  // 工作流优化建议
  ```

#### Week 6: 系统完善
- [ ] **Day 1-2**: 性能优化
  ```rust
  // 内存管理优化
  // 异步处理改进
  // 缓存机制实现
  ```

- [ ] **Day 3-4**: 错误处理和日志
  ```rust
  // 统一错误处理
  // 结构化日志
  // 调试工具集成
  ```

- [ ] **Day 5-7**: 测试和文档
  ```bash
  # 单元测试覆盖
  # 集成测试
  # 用户文档编写
  ```

### Phase 4: 优化和扩展 (第7-8周)

#### Week 7: 用户体验优化
- [ ] **性能监控**: 实时性能指标
- [ ] **用户反馈**: 错误报告和建议收集
- [ ] **界面微调**: 动画效果和交互细节

#### Week 8: 生态扩展
- [ ] **插件系统**: 第三方扩展支持

- [ ] **API开放**: 外部集成接口

- [ ] **社区准备**: 开源发布准备

  

### 中风险项
1. **性能要求**: 桌面应用的响应速度要求
2. **跨平台兼容**: macOS优先，但需考虑扩展性
3. **数据安全**: 本地数据和API密钥管理

## 成功指标

### 技术指标
- [ ] 应用启动时间 < 3秒
- [ ] 消息响应延迟 < 500ms
- [ ] 内存占用 < 200MB
- [ ] MCP工具调用成功率 > 95%

### 功能指标  
- [ ] 支持3+主流LLM模型
- [ ] 集成5+核心MCP服务器
- [ ] 工作流执行成功率 > 90%
- [ ] 代码生成准确率 > 80%

### 用户体验指标
- [ ] 界面响应流畅度评分 > 4.5/5
- [ ] 功能易用性评分 > 4.0/5
- [ ] 整体满意度 > 4.2/5

