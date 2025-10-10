# Bor 智能体中枢 - Windows 环境设置脚本

Write-Host "🚀 Bor 智能体中枢 - 环境设置脚本" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

# 检查Node.js
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
    
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js 版本过低，需要 18+，当前版本: $nodeVersion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Node.js 未安装，请先安装 Node.js 18+" -ForegroundColor Red
    exit 1
}

# 检查npm
try {
    $npmVersion = npm -v
    Write-Host "✅ npm 版本: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm 未安装" -ForegroundColor Red
    exit 1
}

# 安装项目依赖
Write-Host "📦 安装项目依赖..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 依赖安装失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 项目依赖安装完成" -ForegroundColor Green

# 检查Python
try {
    $pythonVersion = python --version
    Write-Host "✅ Python 版本: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Python 未安装，MCP功能可能无法使用" -ForegroundColor Yellow
    Write-Host "   请安装 Python 3.8+ 以使用完整功能" -ForegroundColor Yellow
}

# 检查uv
try {
    $uvVersion = uv --version
    Write-Host "✅ uv 版本: $uvVersion" -ForegroundColor Green
} catch {
    Write-Host "📦 安装 uv (Python包管理器)..." -ForegroundColor Yellow
    
    try {
        powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
        
        # 刷新环境变量
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        $uvVersion = uv --version
        Write-Host "✅ uv 安装成功: $uvVersion" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  uv 安装可能失败，请重启终端或手动安装" -ForegroundColor Yellow
        Write-Host "   安装地址: https://docs.astral.sh/uv/getting-started/installation/" -ForegroundColor Yellow
    }
}

# 构建应用
Write-Host "🔨 构建应用..." -ForegroundColor Yellow
npm run electron:build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 应用构建失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 应用构建完成" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 环境设置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 下一步：" -ForegroundColor Cyan
Write-Host "   1. 启动应用: npm run electron:start" -ForegroundColor White
Write-Host "   2. 配置AI模型API密钥" -ForegroundColor White
Write-Host "   3. 添加MCP服务器" -ForegroundColor White
Write-Host ""
Write-Host "📚 更多信息请查看 README.md 和 DEVELOPMENT.md" -ForegroundColor Cyan