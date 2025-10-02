#!/usr/bin/env node

const { spawn } = require('child_process')
const { createServer } = require('vite')

async function startDev() {
  console.log('🚀 启动 Bor 智能体中枢开发环境...')
  
  try {
    // 启动 Vite 开发服务器
    console.log('📦 启动 Vite 开发服务器...')
    const viteProcess = spawn('npm', ['run', 'electron:dev'], {
      stdio: 'inherit',
      shell: true
    })

    viteProcess.on('error', (error) => {
      console.error('❌ 启动失败:', error)
      process.exit(1)
    })

    viteProcess.on('close', (code) => {
      console.log(`开发服务器退出，代码: ${code}`)
      process.exit(code)
    })

    // 处理进程退出
    process.on('SIGINT', () => {
      console.log('\n🛑 正在关闭开发服务器...')
      viteProcess.kill('SIGINT')
    })

  } catch (error) {
    console.error('❌ 启动开发环境失败:', error)
    process.exit(1)
  }
}

startDev()