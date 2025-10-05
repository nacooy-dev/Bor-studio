# Bor 智能体中枢 🤖

> 瑞士军刀式的个人智能助手平台，通过对话控制一切功能

[![Version](https://img.shields.io/badge/version-0.0.4-blue.svg)](https://github.com/your-username/bor-studio)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28+-blue.svg)](https://electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3+-green.svg)](https://vuejs.org/)

## ✨ 特性

### 🤖 多LLM提供商支持
- **OpenRouter** - 访问300+开源和闭源模型
- **Ollama** - 本地运行开源模型
- **OpenAI** - GPT系列模型
- **智能路由** - 自动选择最适合的模型

### 🔧 MCP工具集成
- **Model Context Protocol** - 标准化的工具协议
- **文件系统工具** - 读写文件和目录操作
- **搜索工具** - DuckDuckGo网络搜索
- **记忆工具** - 信息存储和检索
- **可扩展架构** - 轻松添加新工具

### 💬 智能对话体验
- **意图识别** - 自动理解用户需求
- **上下文感知** - 记住对话历史
- **流式响应** - 实时显示AI回复
- **工具调用** - 无缝集成外部工具

### ⚙️ 完整配置管理
- **LLM配置** - 模型选择和参数调整
- **MCP服务器管理** - 添加、启动、停止服务器
- **系统设置** - 主题、自动保存等
- **数据管理** - 聊天记录导出和清理

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- macOS / Windows / Linux

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/your-username/bor-studio.git
cd bor-studio
```

2. **安装依赖**
```bash
npm install
```

3. **开发模式运行**
```bash
npm run electron:dev
```

4. **构建应用**
```bash
npm run electron:build
npm run electron:start
```

## 📖 使用指南

### 配置LLM提供商

1. 点击"🔧 打开配置"按钮
2. 选择"LLM 模型"标签页
3. 选择提供商并配置API密钥
4. 选择模型并设为默认

### 添加MCP服务器

1. 进入配置页面的"MCP 工具"标签页
2. 点击"添加服务器"
3. 选择预设服务器或自定义配置
4. 启动服务器开始使用工具

### 开始对话

- 直接输入问题开始对话
- 说"搜索XXX"使用搜索工具
- 说"读取文件XXX"使用文件系统工具
- 说"配置LLM"打开配置界面

## 🏗️ 技术架构

### 前端技术栈
- **Vue 3** - 响应式前端框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 原子化CSS
- **Pinia** - 状态管理
- **Vue Router** - 路由管理

### 后端技术栈
- **Electron** - 跨平台桌面应用
- **Node.js** - 运行时环境
- **SQLite** - 本地数据存储
- **Child Process** - MCP服务器管理

### 核心模块
```
src/
├── components/          # Vue组件
├── views/              # 页面视图
├── lib/                # 核心库
│   ├── llm-manager/    # LLM管理器
│   └── mcp-host/       # MCP主机
├── services/           # 业务服务
└── stores/             # 状态管理
```

## 🔧 开发指南

### 项目结构
```
bor-studio/
├── src/                # 源代码
├── electron/           # Electron主进程
├── dist/               # 构建输出
├── dist-electron/      # Electron构建输出
└── scripts/            # 构建脚本
```

### 开发命令
```bash
# 开发模式
npm run dev

# 构建前端
npm run build

# 构建Electron
npm run electron:build

# 启动应用
npm run electron:start

# 打包应用
npm run electron:preview
```

### 添加新的MCP工具

1. 创建MCP服务器配置
2. 在预设服务器中添加配置
3. 实现工具调用逻辑
4. 更新UI界面

## 📝 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细的版本更新信息。

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP协议标准
- [Vue.js](https://vuejs.org/) - 前端框架
- [Electron](https://electronjs.org/) - 桌面应用框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS框架

## 📞 联系我们

- 项目主页: [GitHub](https://github.com/your-username/bor-studio)
- 问题反馈: [Issues](https://github.com/your-username/bor-studio/issues)
- 功能建议: [Discussions](https://github.com/your-username/bor-studio/discussions)

---

**Bor 智能体中枢** - 让AI成为你的得力助手 🚀