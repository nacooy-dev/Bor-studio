#!/usr/bin/env node

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 启动 Electron 应用
const electronPath = join(__dirname, '../node_modules/.bin/electron');
const mainPath = join(__dirname, '../dist-electron/main.js');

console.log('🚀 启动 Bor 智能体中枢...');

const electron = spawn(electronPath, [mainPath], {
  stdio: 'inherit',
  cwd: join(__dirname, '..')
});

electron.on('close', (code) => {
  console.log(`\n📱 应用已关闭 (退出码: ${code})`);
});

electron.on('error', (err) => {
  console.error('❌ 启动失败:', err);
});