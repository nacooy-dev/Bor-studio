#!/bin/bash

echo "🚀 Bor 智能体中枢 - 环境设置脚本"
echo "=================================="

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 18+，当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"

# 安装项目依赖
echo "📦 安装项目依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 项目依赖安装完成"

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python3 未安装，MCP功能可能无法使用"
    echo "   请安装 Python 3.8+ 以使用完整功能"
else
    PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    echo "✅ Python 版本: $PYTHON_VERSION"
fi

# 检查uv
if ! command -v uv &> /dev/null; then
    echo "📦 安装 uv (Python包管理器)..."
    
    # 检测操作系统
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl -LsSf https://astral.sh/uv/install.sh | sh
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -LsSf https://astral.sh/uv/install.sh | sh
    else
        echo "⚠️  请手动安装 uv: https://docs.astral.sh/uv/getting-started/installation/"
    fi
    
    # 重新加载shell配置
    source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null || true
    
    if command -v uv &> /dev/null; then
        echo "✅ uv 安装成功: $(uv --version)"
    else
        echo "⚠️  uv 安装可能失败，请重启终端或手动安装"
    fi
else
    echo "✅ uv 版本: $(uv --version)"
fi

# 构建应用
echo "🔨 构建应用..."
npm run electron:build

if [ $? -ne 0 ]; then
    echo "❌ 应用构建失败"
    exit 1
fi

echo "✅ 应用构建完成"

echo ""
echo "🎉 环境设置完成！"
echo ""
echo "📋 下一步："
echo "   1. 启动应用: npm run electron:start"
echo "   2. 配置AI模型API密钥"
echo "   3. 添加MCP服务器"
echo ""
echo "📚 更多信息请查看 README.md 和 DEVELOPMENT.md"