#!/usr/bin/env node

import { spawn } from 'child_process'

console.log('🌐 启动 Web 版本测试...')
console.log('📝 这将启动一个普通的 Web 应用，不包含 Electron 功能')
console.log('🔗 请在浏览器中访问 http://localhost:5173')
console.log('')

const viteProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
})

viteProcess.on('error', (error) => {
  console.error('❌ 启动失败:', error)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭开发服务器...')
  viteProcess.kill('SIGINT')
})