# 更新日志

## [0.0.5] - 2025-01-09

### 🚀 重大更新
- **迁移到标准 MCP 实现**: 从自建 MCP Host 迁移到官方 MCP SDK
- **保持 UI 兼容**: 完全保留原有的用户界面和交互体验
- **增强兼容性**: 支持所有标准 MCP 服务器和配置格式

### ✨ 新功能
- 添加 `StandardMCPAdapter` - 基于官方 MCP SDK 的适配器
- 添加 `MCPConfigManager` - 支持标准 MCP 配置文件导入/导出
- 集成 Obsidian MCP 工具 - 完整的笔记管理功能
- 支持动态 MCP 实现切换（标准 vs 自建）

### 🔧 技术改进
- 安装官方 MCP SDK (`@modelcontextprotocol/sdk`)
- 改进错误处理和服务器状态管理
- 优化序列化处理，解决 "An object could not be cloned" 错误
- 添加自动重试机制处理服务器冲突

### 📦 依赖更新
- 新增: `@modelcontextprotocol/sdk` - 官方 MCP 软件开发工具包

### 🐛 修复
- 修复 MCP 服务器添加时的序列化问题
- 修复服务器已存在时的错误处理
- 完善类型定义，添加缺失的 `removeServer` 方法

### 📝 文档
- 更新 MCP 集成文档
- 添加标准 MCP 配置示例

---

## [0.0.4] - 2025-01-08

### 初始版本功能
- 基础 MCP Host 实现
- 用户界面和核心功能
- 数据库集成
- Electron 应用框架