# 开发指南

## 项目架构

### 核心架构
- **主进程 (Main Process)**: `electron/main.ts` - 管理应用生命周期、窗口创建、MCP服务器
- **渲染进程 (Renderer Process)**: `src/` - Vue.js应用，处理UI和用户交互
- **预加载脚本 (Preload Script)**: `electron/preload-fixed.cjs` - 安全的IPC通信桥梁

### MCP集成架构
- **StandardMCPAdapter**: 使用官方MCP SDK的适配器
- **MCPHostMain**: 自建的MCP主机实现（备用）
- **MCP服务层**: `src/services/mcp.ts` - 渲染进程的MCP服务接口

## 开发环境设置

### 1. 安装依赖
```bash
npm install
```

### 2. 安装MCP相关工具
```bash
# 安装uv (Python包管理器)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 验证安装
uv --version
```

### 3. 启动开发服务器
```bash
# 方式1: 直接启动Electron
npm run electron:start

# 方式2: 开发模式 (热重载)
npm run dev
# 然后在另一个终端运行
npm run electron:dev
```

## 构建流程

### 开发构建
```bash
npm run electron:build
```

### 生产构建
```bash
npm run build
npm run electron:preview
```

## MCP开发

### 添加新的MCP服务器

1. 在 `.kiro/settings/mcp.json` 中添加配置：
```json
{
  "mcpServers": {
    "your-server": {
      "command": "uvx",
      "args": ["your-mcp-server"],
      "env": {
        "YOUR_ENV_VAR": "value"
      },
      "disabled": false,
      "autoApprove": ["tool1", "tool2"]
    }
  }
}
```

2. 在 `src/services/mcp.ts` 中添加预设配置（可选）

### MCP工具调用流程

1. **发现工具**: 服务器启动时自动发现可用工具
2. **工具调用**: 通过 `mcpService.executeTool()` 调用
3. **结果处理**: 在对话系统中集成工具结果

## 数据库

### 数据库结构
- **configs**: 应用配置存储
- **chat_messages**: 聊天历史记录
- **chat_sessions**: 聊天会话管理

### 数据库操作
```typescript
// 保存配置
await electronAPI.database.setConfig('key', 'value', 'category')

// 获取配置
const value = await electronAPI.database.getConfig('key', 'defaultValue')

// 保存聊天消息
await electronAPI.database.saveChatMessage(sessionId, role, content, timestamp)
```

## 调试

### 主进程调试
```bash
# 启动时添加调试参数
npm run electron:start -- --inspect=9229
```

### 渲染进程调试
- 使用Chrome DevTools (Ctrl+Shift+I)
- 查看控制台日志

### MCP调试
- 检查主进程日志中的MCP相关输出
- 使用 `console.log` 在MCP服务中添加调试信息

## 常见问题

### 1. MCP服务器启动失败
- 检查 `uv` 是否正确安装
- 验证MCP服务器包是否可用
- 查看主进程控制台的错误信息

### 2. Preload脚本加载失败
- 确保使用 `.cjs` 扩展名（因为项目使用ES模块）
- 检查文件路径是否正确
- 验证contextBridge API是否正确暴露

### 3. 构建失败
- 清理构建缓存: `rm -rf dist dist-electron`
- 重新安装依赖: `rm -rf node_modules && npm install`
- 检查TypeScript类型错误

## 代码规范

### 文件命名
- Vue组件: PascalCase (e.g., `ChatView.vue`)
- TypeScript文件: camelCase (e.g., `mcpService.ts`)
- 配置文件: kebab-case (e.g., `vite.config.ts`)

### 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建/工具相关

## 发布流程

1. 更新版本号: `package.json`
2. 更新CHANGELOG
3. 构建应用: `npm run electron:preview`
4. 测试构建产物
5. 创建Git标签
6. 推送到GitHub
7. 创建Release

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 编写代码和测试
4. 提交Pull Request
5. 代码审查
6. 合并到主分支