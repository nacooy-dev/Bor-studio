#!/usr/bin/env node

import { spawn } from 'child_process'

console.log('🚀 启动 Bor 智能体中枢测试...')
console.log('📦 使用已构建的文件启动 Electron 应用')
console.log('')

// 直接启动 Electron
const electronProcess = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
})

electronProcess.on('error', (error) => {
  console.error('❌ 启动失败:', error)
  process.exit(1)
})

electronProcess.on('close', (code) => {
  console.log(`\n应用退出，代码: ${code}`)
  process.exit(code)
})

process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭应用...')
  electronProcess.kill('SIGINT')
})

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭应用...')
  electronProcess.kill('SIGTERM')
})