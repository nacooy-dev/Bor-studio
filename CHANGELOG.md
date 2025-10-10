# 更新日志

## [1.0.0] - 2024-01-10

### 🎉 正式版本发布
- **稳定版本**: 经过充分测试的稳定版本，适合生产使用
- **完整功能**: 所有核心功能已完成并验证
- **文档完善**: 提供完整的用户和开发者文档

### ✨ 核心功能
- **多AI模型支持**: OpenAI, Anthropic, Google Gemini, 智谱AI, OpenRouter, Ollama
- **标准MCP协议**: 完整支持Model Context Protocol v2024-11-05
- **智能对话系统**: 流式对话，上下文记忆，多轮交互
- **工具生态**: 丰富的MCP工具集成（搜索、笔记、文件系统等）
- **本地数据**: SQLite数据库，聊天历史和配置本地存储
- **现代界面**: Vue 3 + Tailwind CSS，支持明暗主题

### 🔧 技术架构
- **Electron + Vue 3**: 跨平台桌面应用
- **TypeScript**: 类型安全的开发体验
- **标准MCP SDK**: 使用官方`@modelcontextprotocol/sdk`
- **模块化设计**: 清晰的代码结构，易于维护和扩展

### 📚 文档和工具
- **完整文档**: README.md, DEVELOPMENT.md, 项目状态文档
- **自动化设置**: 一键环境设置脚本（Linux/macOS/Windows）
- **开发工具**: 完整的开发、构建、测试工具链

## [0.0.5] - 2024-01-09

### 🎉 重大更新
- **MCP架构升级**: 从自建MCP实现迁移到标准MCP SDK (`@modelcontextprotocol/sdk`)
- **修复MCP启动问题**: 解决了Electron环境中MCP服务无法正常启动的问题

### ✨ 新增功能
- 集成标准MCP协议支持
- 新增多个预设MCP服务器：
  - Obsidian笔记管理
  - DuckDuckGo网络搜索
  - Memory记忆存储
  - File System文件操作
  - Sequential Thinking结构化思维
- 改进的MCP服务器管理界面
- 增强的错误处理和日志记录

### 🔧 技术改进
- **Preload脚本修复**: 使用`.cjs`扩展名解决ES模块兼容性问题
- **构建优化**: 改进Vite配置，优化构建流程
- **类型安全**: 完善TypeScript类型定义
- **代码重构**: 清理冗余代码，提高代码质量

### 🐛 修复问题
- 修复MCP服务在Electron环境中无法检测的问题
- 修复preload脚本加载失败的问题
- 修复StandardMCPAdapter中的进程管理问题
- 修复工具发现和执行的稳定性问题

### 📚 文档更新
- 新增完整的README.md
- 新增开发者指南DEVELOPMENT.md
- 新增MIT许可证
- 完善项目配置文件

### 🔄 架构变更
- 主要使用StandardMCPAdapter作为默认MCP实现
- 保留MCPHostMain作为备用实现
- 优化MCP服务的生命周期管理
- 改进错误处理和重试机制

## [0.0.4] - 2024-01-08

### ✨ 功能特性
- 基础MCP功能实现
- 多AI模型支持
- 聊天界面和对话管理
- 本地数据存储

### 🔧 技术栈
- Electron + Vue 3 + TypeScript
- 自建MCP Host实现
- SQLite数据库
- Tailwind CSS界面

---

## 版本说明

- **主版本号**: 重大架构变更或不兼容更新
- **次版本号**: 新功能添加，向后兼容
- **修订版本号**: Bug修复和小改进

## 图标说明

- 🎉 重大更新
- ✨ 新增功能  
- 🔧 技术改进
- 🐛 修复问题
- 📚 文档更新
- 🔄 架构变更
- ⚠️ 重要提醒
- 🗑️ 移除功能