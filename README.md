# Bor 智能体中枢

一个瑞士军刀式的个人智能助手平台，采用"对话即界面"的设计理念，通过自然语言控制所有功能。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 安装 Ollama（必需）

**方法一：官网下载**
- 访问 [https://ollama.ai](https://ollama.ai)
- 下载适合您系统的安装包

**方法二：命令行安装**
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows (PowerShell)
iwr -useb https://ollama.ai/install.ps1 | iex
```

### 3. 拉取模型

```bash
# 推荐新手使用的轻量级模型
ollama pull llama2:7b

# 或者中文优化模型
ollama pull qwen:7b

# 代码专用模型
ollama pull codellama:7b
```

### 4. 启动应用

```bash
# 开发模式
npm run electron:dev

# 构建生产版本
npm run build
```

## 功能特性

- 🎨 **极简设计**：Apple 风格的纯净界面，无传统菜单和按钮
- 🤖 **本地 AI**：基于 Ollama 的本地大语言模型，保护隐私
- 💬 **对话控制**：通过自然语言控制所有功能
- 📁 **文件支持**：拖拽上传多种文件类型
- 🔄 **流式响应**：实时打字机效果的 AI 回复
- ⚡ **智能建议**：根据上下文提供相关建议

## 使用指南

### 基础对话
- 直接输入问题开始对话
- 支持 Markdown 格式和代码高亮
- 拖拽文件到输入框进行文件相关操作

### 系统管理
- `检查系统状态` - 查看 Ollama 和模型状态
- `刷新模型列表` - 重新检测可用模型
- `切换模型 [模型名]` - 切换到指定模型
- `配置 LLM` - 打开模型配置页面

### 常见问题

**Q: 提示 "Ollama 服务未连接"？**
A: 请确保 Ollama 已安装并运行，然后说"检查系统状态"重新检测。

**Q: 提示 "没有可用的模型"？**
A: 请先拉取一个模型，例如：`ollama pull llama2:7b`

**Q: 如何切换模型？**
A: 说"切换模型 [模型名]"或"使用模型 [模型名]"

## 技术架构

- **前端**: Vue 3 + TypeScript + Tailwind CSS
- **桌面**: Electron
- **AI**: Ollama (本地大语言模型)
- **设计**: Apple Design System

## 开发计划

- [x] 基础聊天界面
- [x] Ollama 集成
- [ ] 意图识别系统
- [ ] RAG 知识库
- [ ] MCP 工具调度
- [ ] 工作流自动化
- [ ] 插件系统
- [ ] 自升级能力

## 许可证

MIT License