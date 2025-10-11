# Bor 智能体中枢 v2.1.0 版本发布说明

## 版本信息
- 版本号：v2.1.0
- 发布日期：2025年10月11日
- 适用平台：macOS, Windows, Linux

## 重要修复

### 1. Electron版本升级
- 将Electron从版本28.3.3升级至38.2.2
- 解决了Electron Helper参数错误问题
- 修复了应用程序窗口无法正常显示的问题

### 2. 环境变量设置优化
- 优化了macOS打包应用的环境变量设置逻辑
- 确保仅在打包环境下扩展PATH和其他关键环境变量
- 修复了打包后MCP服务无法正常启动的问题
- 保持开发环境的纯净性，避免不必要的环境变量干扰

### 3. MCP服务稳定性提升
- 增强了MCP服务器进程的环境变量传递
- 改进了StandardMCPAdapter和MCPHostMain中的环境变量处理
- 确保MCP工具能够正确访问系统工具（如uvx、python等）

## 技术改进

### 主进程优化
- 在[electron/main.ts](file:///Users/lvyun/nacoolab/01-Lab-works/Bor-studio/electron/main.ts)中完善了环境变量设置逻辑
- 添加了更多关键环境变量：LOGNAME、LANG、TERM
- 优化了macOS系统工具路径的扩展

### MCP适配器增强
- 在[src/lib/mcp-host/StandardMCPAdapter.ts](file:///Users/lvyun/nacoolab/01-Lab-works/Bor-studio/src/lib/mcp-host/StandardMCPAdapter.ts)中增强了环境变量传递
- 确保MCP服务器子进程能继承正确的环境变量

### MCP主机改进
- 在[src/lib/mcp-host/MCPHostMain.ts](file:///Users/lvyun/nacoolab/01-Lab-works/Bor-studio/src/lib/mcp-host/MCPHostMain.ts)中完善了环境变量设置
- 保证在所有MCP实现中都有一致的环境变量支持

## 验证结果

- 应用程序能够正常启动并显示窗口
- MCP服务在打包环境下能够正常运行
- 系统工具（uvx、python等）可正常访问
- 开发环境不受影响，保持原有功能

## 安装说明

请下载对应平台的安装包：
- macOS: Bor智能体中枢-2.1.0.dmg
- Windows: Bor智能体中枢-2.1.0.exe
- Linux: Bor智能体中枢-2.1.0.AppImage

## 注意事项

此版本修复了之前版本中存在的关键问题，强烈建议所有用户升级到此版本以获得最佳体验。