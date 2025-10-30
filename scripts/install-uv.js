#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 安装 uv 到项目本地...');

const projectRoot = path.resolve(__dirname, '..');
const binDir = path.join(projectRoot, 'bin');
const uvPath = path.join(binDir, process.platform === 'win32' ? 'uv.exe' : 'uv');
const uvxPath = path.join(binDir, process.platform === 'win32' ? 'uvx.exe' : 'uvx');

// 创建 bin 目录
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// 检查是否已经安装
if (fs.existsSync(uvPath) && fs.existsSync(uvxPath)) {
  console.log('✅ uv 已经安装在项目本地');
  try {
    const version = execSync(`"${uvPath}" --version`, { encoding: 'utf8' }).trim();
    console.log(`✅ 版本: ${version}`);
    process.exit(0);
  } catch (error) {
    console.log('⚠️  现有安装可能损坏，重新安装...');
  }
}

async function downloadUv() {
  const platform = process.platform;
  const arch = process.arch;

  let downloadUrl;
  let fileName;

  // 确定下载URL
  if (platform === 'darwin') {
    if (arch === 'arm64') {
      downloadUrl = 'https://github.com/astral-sh/uv/releases/latest/download/uv-aarch64-apple-darwin.tar.gz';
    } else {
      downloadUrl = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-apple-darwin.tar.gz';
    }
    fileName = 'uv-macos.tar.gz';
  } else if (platform === 'linux') {
    if (arch === 'arm64') {
      downloadUrl = 'https://github.com/astral-sh/uv/releases/latest/download/uv-aarch64-unknown-linux-gnu.tar.gz';
    } else {
      downloadUrl = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz';
    }
    fileName = 'uv-linux.tar.gz';
  } else if (platform === 'win32') {
    downloadUrl = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip';
    fileName = 'uv-windows.zip';
  } else {
    throw new Error(`不支持的平台: ${platform}`);
  }

  console.log(`📥 下载 uv for ${platform}-${arch}...`);
  console.log(`URL: ${downloadUrl}`);

  const downloadPath = path.join(binDir, fileName);

  // 使用 curl 或 wget 下载
  try {
    if (platform === 'win32') {
      // Windows 使用 PowerShell
      execSync(`powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${downloadPath}'"`, { stdio: 'inherit' });
    } else {
      // macOS/Linux 使用 curl
      execSync(`curl -L -o "${downloadPath}" "${downloadUrl}"`, { stdio: 'inherit' });
    }
  } catch (error) {
    console.error('❌ 下载失败:', error.message);
    process.exit(1);
  }

  console.log('📦 解压文件...');

  // 解压文件
  try {
    if (platform === 'win32') {
      // Windows 使用 PowerShell 解压
      execSync(`powershell -Command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${binDir}' -Force"`, { stdio: 'inherit' });

      // 移动文件到正确位置
      const extractedDir = path.join(binDir, 'uv-x86_64-pc-windows-msvc');
      if (fs.existsSync(extractedDir)) {
        fs.copyFileSync(path.join(extractedDir, 'uv.exe'), uvPath);
        fs.copyFileSync(path.join(extractedDir, 'uvx.exe'), uvxPath);
        // 清理
        fs.rmSync(extractedDir, { recursive: true, force: true });
      }
    } else {
      // macOS/Linux 使用 tar
      execSync(`tar -xzf "${downloadPath}" -C "${binDir}"`, { stdio: 'inherit' });

      // 查找解压后的目录
      const files = fs.readdirSync(binDir);
      const extractedDir = files.find(f => f.startsWith('uv-') && fs.statSync(path.join(binDir, f)).isDirectory());

      if (extractedDir) {
        const srcDir = path.join(binDir, extractedDir);
        fs.copyFileSync(path.join(srcDir, 'uv'), uvPath);
        fs.copyFileSync(path.join(srcDir, 'uvx'), uvxPath);

        // 设置执行权限
        fs.chmodSync(uvPath, '755');
        fs.chmodSync(uvxPath, '755');

        // 清理
        fs.rmSync(srcDir, { recursive: true, force: true });
      }
    }

    // 清理下载文件
    fs.unlinkSync(downloadPath);

  } catch (error) {
    console.error('❌ 解压失败:', error.message);
    process.exit(1);
  }

  // 验证安装
  try {
    const version = execSync(`"${uvPath}" --version`, { encoding: 'utf8' }).trim();
    console.log('✅ uv 安装成功!');
    console.log(`✅ 版本: ${version}`);
    console.log(`✅ 安装路径: ${uvPath}`);
  } catch (error) {
    console.error('❌ 安装验证失败:', error.message);
    process.exit(1);
  }
}

// 执行安装
downloadUv().catch(error => {
  console.error('❌ 安装过程出错:', error.message);
  process.exit(1);
});