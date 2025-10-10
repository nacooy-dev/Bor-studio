# Bor 智能体中枢

瑞士军刀式的个人智能助手平台，集成多种AI模型和MCP工具，提供强大的对话和自动化能力。

## ✨ 特性

- 🤖 **多模型支持**: 支持 OpenAI、Anthropic、Google Gemini、智谱AI、OpenRouter、Ollama 等多种AI模型
- 🔧 **MCP集成**: 完整支持 Model Context Protocol，可扩展各种工具和服务
- 💬 **智能对话**: 流式对话体验，支持上下文记忆和多轮对话
- 🎨 **现代界面**: 基于 Vue 3 + Tailwind CSS 的现代化界面设计
- 🔒 **本地优先**: 数据本地存储，保护隐私安全
- ⚡ **高性能**: 基于 Electron + Vite 构建，启动快速，响应迅速

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 yarn
- Python 3.8+ (用于MCP服务器)
- uv (Python包管理器，用于MCP服务器)

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-username/bor-intelligent-agent-hub.git
cd bor-intelligent-agent-hub

# 自动设置环境（推荐）
npm run setup  # Linux/macOS
# 或
npm run setup:windows  # Windows

# 手动安装依赖
npm install

# 安装 uv (用于MCP服务器)
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 开发模式

```bash
# 启动开发服务器
npm run dev

# 启动Electron应用
npm run electron:start
```

### 构建应用

```bash
# 构建Web版本
npm run build

# 构建Electron应用
npm run electron:build

# 打包Electron应用
npm run electron:preview
```



## 🔧 配置

### AI模型配置

1. 打开应用设置
2. 选择要使用的AI提供商
3. 输入相应的API密钥
4. 选择模型并保存

支持的提供商：
- **OpenAI**: GPT-4, GPT-3.5等
- **Anthropic**: Claude系列
- **Google**: Gemini系列  
- **智谱AI**: GLM系列
- **OpenRouter**: 多种开源模型
- **Ollama**: 本地模型

### MCP服务器配置

应用内置了多个预设的MCP服务器：

- **Obsidian**: 笔记管理工具
- **DuckDuckGo Search**: 网络搜索
- **Memory**: 记忆存储
- **File System**: 文件系统操作
- **Sequential Thinking**: 结构化思维

可以在配置页面添加和管理MCP服务器。

## 📁 项目结构

```
├── electron/                 # Electron主进程代码
│   ├── main.ts              # 主进程入口
│   ├── preload-fixed.cjs    # 预加载脚本
│   └── database.ts          # 数据库管理
├── src/                     # 渲染进程代码
│   ├── components/          # Vue组件
│   ├── views/              # 页面视图
│   ├── services/           # 服务层
│   ├── lib/                # 工具库
│   └── types/              # 类型定义
├── public/                 # 静态资源
├── .kiro/                  # 配置文件
│   └── settings/
│       └── mcp.json        # MCP配置
└── dist/                   # 构建输出
```

## 🛠️ 技术栈

- **前端**: Vue 3, TypeScript, Tailwind CSS
- **桌面**: Electron
- **构建**: Vite
- **状态管理**: Pinia
- **数据库**: SQLite (better-sqlite3)
- **MCP**: @modelcontextprotocol/sdk

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - 强大的工具集成协议
- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式JavaScript框架
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的CSS框架

## 📞 支持

如果你喜欢这个项目，请给它一个 ⭐️！

有问题或建议？请创建一个 [Issue](https://github.com/your-username/bor-intelligent-agent-hub/issues)。