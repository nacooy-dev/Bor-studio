#!/usr/bin/env node

import { spawn } from 'child_process'
import { app } from 'electron'

console.log('🚀 启动 Bor 智能体中枢...')

// 直接启动 Electron，使用已构建的文件
const electronProcess = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true
})

electronProcess.on('error', (error) => {
  console.error('❌ 启动失败:', error)
  process.exit(1)
})

electronProcess.on('close', (code) => {
  console.log(`应用退出，代码: ${code}`)
  process.exit(code)
})

process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭应用...')
  electronProcess.kill('SIGINT')
})