#!/usr/bin/env node

import { spawn } from 'child_process';
import { join } from 'path';

// 直接启动Vite开发服务器和Electron
console.log('🚀 启动 Bor 智能体中枢开发环境...');

// 启动Vite开发服务器
const viteProcess = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

viteProcess.on('error', (error) => {
  console.error('❌ Vite启动失败:', error);
  process.exit(1);
});

viteProcess.on('close', (code) => {
  console.log(`Vite开发服务器退出，代码: ${code}`);
  process.exit(code);
});

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭开发环境...');
  viteProcess.kill('SIGINT');
});

console.log('✅ 开发环境启动命令已执行');