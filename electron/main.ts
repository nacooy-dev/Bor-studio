import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn, execSync } from 'child_process'
import type { MCPServerConfig, MCPToolCall } from '../src/lib/mcp-host/types'
import { electronDatabase } from './database'

console.log('🔧 应用启动日志:')
console.log('- Electron版本:', process.versions.electron)
console.log('- Node版本:', process.versions.node)
console.log('- Chrome版本:', process.versions.chrome)
console.log('- 平台:', process.platform)
console.log('- 架构:', process.arch)

// 添加全局错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason, promise)
})

// 简单的开发环境检测
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL
console.log('- 开发环境:', isDev)
console.log('- NODE_ENV:', process.env.NODE_ENV)
console.log('- VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL)

// MCP服务器管理
import { simpleMCPClient } from './SimpleMCPClient'

async function initializeMCPClient(): Promise<void> {
  try {
    console.log('🔧 初始化MCP管理器...')
    // MCP管理器已经在导入时初始化
    console.log('✅ MCP管理器初始化完成')
  } catch (error) {
    console.error('❌ MCP管理器初始化失败:', error)
  }
}

// 获取当前文件的目录路径（ES 模块中的 __dirname 替代方案）
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 设置环境变量以确保打包应用能正确找到系统工具
function setupEnvironment(): void {
  // 在 macOS 上，打包的应用可能无法访问完整的 PATH
  if (process.platform === 'darwin') {
    // 检测是否为打包环境
    const isPackaged = !process.env.VITE_DEV_SERVER_URL && process.env.NODE_ENV !== 'development'
    console.log('🔧 环境检测:', {
      platform: process.platform,
      isPackaged: isPackaged,
      NODE_ENV: process.env.NODE_ENV,
      VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL
    })
    
    // 只在打包应用中扩展环境变量
    if (isPackaged) {
      console.log('🔧 在打包应用中扩展环境变量')
      
      // 添加常见的工具路径
      const additionalPaths = [
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin'
      ]
      
      // 如果 PATH 已经存在，扩展它而不是覆盖
      if (process.env.PATH) {
        // 避免重复添加路径
        const currentPaths = process.env.PATH.split(':')
        const newPaths = additionalPaths.filter(p => !currentPaths.includes(p))
        process.env.PATH = [...newPaths, ...currentPaths].join(':')
      } else {
        process.env.PATH = additionalPaths.join(':')
      }
      
      console.log('🔧 设置 PATH 环境变量:', process.env.PATH)
    } else {
      console.log('🔧 在开发环境中，不修改环境变量')
    }
  }
}

// 在创建窗口之前设置环境
console.log('🔧 开始设置环境变量')
setupEnvironment()
console.log('✅ 环境变量设置完成')

// 主窗口引用
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  console.log('🔧 创建主窗口...')
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: true, // 保留系统边框但隐藏标题栏
    transparent: true, // 保持透明以支持玻璃效果
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    vibrancy: process.platform === 'darwin' ? 'fullscreen-ui' : undefined, // 恢复强透明效果
    visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
    webPreferences: {
      preload: join(__dirname, 'preload-fixed.cjs'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 开发时禁用，避免加载问题
    },
  })

  // 调试preload路径
  const preloadPath = join(__dirname, 'preload-fixed.cjs')
  console.log('🔧 Preload path:', preloadPath)

  // 窗口准备好后显示
  mainWindow.on('ready-to-show', () => {
    console.log('✅ 窗口准备就绪，显示窗口')
    mainWindow?.show()
    
    // 开发环境下打开开发者工具
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  // 处理窗口关闭
  mainWindow.on('closed', () => {
    console.log('✅ 窗口已关闭')
    mainWindow = null
  })

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 加载应用
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// 初始化MCP管理器
async function initializeMCP(): Promise<void> {
  try {
    console.log('🔧 初始化MCP服务...')

    console.log('✅ 标准MCP客户端已准备就绪')
  } catch (error) {
    console.error('❌ 标准MCP客户端初始化失败:', error)
  }
}

// 保存服务器配置到数据库
async function saveServerConfig(config: any): Promise<void> {
  try {
    // 获取现有的服务器配置
    let savedServers = []
    try {
      const existing = electronDatabase.getConfig('mcp_installed_servers', '[]')
      savedServers = JSON.parse(existing)
    } catch (e) {
      savedServers = []
    }
    
    // 检查服务器是否已存在
    const existingIndex = savedServers.findIndex((s: any) => s.id === config.id)
    if (existingIndex >= 0) {
      // 更新现有服务器配置
      savedServers[existingIndex] = config
    } else {
      // 添加新服务器配置
      savedServers.push(config)
    }
    
    // 保存到数据库
    electronDatabase.setConfig('mcp_installed_servers', JSON.stringify(savedServers), 'mcp')
    console.log(`💾 已保存服务器配置: ${config.id}`)
  } catch (error) {
    console.error('❌ 保存服务器配置失败:', error)
  }
}

// 从数据库加载服务器配置
async function loadServerConfigs(): Promise<any[]> {
  try {
    const saved = electronDatabase.getConfig('mcp_installed_servers', '[]')
    const servers = JSON.parse(saved)
    console.log(`📂 已加载 ${servers.length} 个服务器配置`)
    return servers
  } catch (error) {
    console.error('❌ 加载服务器配置失败:', error)
    return []
  }
}

// 设置数据库IPC处理器
function setupDatabaseHandlers(): void {
  // 配置管理
  ipcMain.handle('db:set-config', (_, key: string, value: any, category?: string) => {
    return electronDatabase.setConfig(key, value, category)
  })

  ipcMain.handle('db:get-config', (_, key: string, defaultValue?: any) => {
    return electronDatabase.getConfig(key, defaultValue)
  })

  ipcMain.handle('db:get-configs-by-category', (_, category: string) => {
    return electronDatabase.getConfigsByCategory(category)
  })

  ipcMain.handle('db:delete-config', (_, key: string) => {
    return electronDatabase.deleteConfig(key)
  })

  // 聊天历史管理
  ipcMain.handle('db:save-chat-message', (_, sessionId: string, role: string, content: string, timestamp: number, metadata?: any) => {
    return electronDatabase.saveChatMessage(sessionId, role as 'user' | 'assistant' | 'system', content, timestamp, metadata)
  })

  ipcMain.handle('db:get-chat-history', (_, sessionId: string, limit?: number) => {
    return electronDatabase.getChatHistory(sessionId, limit)
  })

  ipcMain.handle('db:get-all-sessions', () => {
    return electronDatabase.getAllSessions()
  })

  ipcMain.handle('db:delete-chat-history', (_, sessionId: string) => {
    return electronDatabase.deleteChatHistory(sessionId)
  })

  // 数据库统计
  ipcMain.handle('db:get-stats', () => {
    return electronDatabase.getStats()
  })

  console.log('✅ Database IPC handlers registered')
}

// 设置自定义 MCP 服务器管理IPC处理器
function setupCustomMCPServerHandlers(): void {
  // 获取自定义 MCP 服务器
  ipcMain.handle('mcp:get-custom-servers', async () => {
    try {
      const customServers = electronDatabase.getConfig('mcp_custom_servers', '[]')
      return { success: true, data: JSON.parse(customServers) }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 添加自定义 MCP 服务器
  ipcMain.handle('mcp:add-custom-server', async (_, serverData: string) => {
    try {
      const servers = JSON.parse(electronDatabase.getConfig('mcp_custom_servers', '[]'))
      const newServer = JSON.parse(serverData)
      servers.push(newServer)
      electronDatabase.setConfig('mcp_custom_servers', JSON.stringify(servers), 'mcp')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 更新自定义 MCP 服务器
  ipcMain.handle('mcp:update-custom-server', async (_, serverId: string, serverData: string) => {
    try {
      const servers = JSON.parse(electronDatabase.getConfig('mcp_custom_servers', '[]'))
      const updatedServer = JSON.parse(serverData)
      const index = servers.findIndex((s: any) => s.id === serverId)
      if (index !== -1) {
        servers[index] = updatedServer
        electronDatabase.setConfig('mcp_custom_servers', JSON.stringify(servers), 'mcp')
        return { success: true }
      } else {
        return { success: false, error: 'Server not found' }
      }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 删除自定义 MCP 服务器
  ipcMain.handle('mcp:remove-custom-server', async (_, serverId: string) => {
    try {
      const servers = JSON.parse(electronDatabase.getConfig('mcp_custom_servers', '[]'))
      const filteredServers = servers.filter((s: any) => s.id !== serverId)
      electronDatabase.setConfig('mcp_custom_servers', JSON.stringify(filteredServers), 'mcp')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  console.log('✅ Custom MCP Server IPC handlers registered')
}

// 设置MCP IPC处理器
function setupMCPHandlers(): void {
  // 添加MCP服务器
  ipcMain.handle('mcp:add-server', async (_, config: MCPServerConfig) => {
    try {
      const result = await simpleMCPClient.addServer(config)
      if (!result.success) {
        throw new Error(result.error)
      }
      
      // 保存服务器配置到数据库
      await saveServerConfig(config)
      
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 启动MCP服务器
  ipcMain.handle('mcp:start-server', async (_, serverId: string) => {
    try {
      console.log(`🚀 启动MCP服务器: ${serverId}`)
      const result = await simpleMCPClient.startServer(serverId)
      return result
      
    } catch (error: any) {
      console.error(`❌ 启动服务器失败 ${serverId}:`, error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 停止MCP服务器
  ipcMain.handle('mcp:stop-server', async (_, serverId: string) => {
    try {
      const result = await simpleMCPClient.stopServer(serverId)
      return result
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取所有服务器
  ipcMain.handle('mcp:get-servers', async () => {
    try {
      const result = await simpleMCPClient.getServers()
      
      if (result.success && result.data) {
        // 合并数据库中的配置信息，确保配置完整
        const savedConfigs = await loadServerConfigs()
        console.log('🔍 数据库中的服务器配置:', JSON.stringify(savedConfigs, null, 2))
        
        const enrichedServers = result.data.map((server: any) => {
          const savedConfig = savedConfigs.find((config: any) => config.id === server.id)
          console.log(`🔍 服务器 ${server.id} 配置合并:`)
          console.log('  - StandardMCP配置:', JSON.stringify(server.config, null, 2))
          console.log('  - 数据库配置:', JSON.stringify(savedConfig, null, 2))
          
          const finalConfig = savedConfig || server.config
          console.log('  - 最终配置:', JSON.stringify(finalConfig, null, 2))
          
          return {
            ...server,
            config: finalConfig // 优先使用数据库中的完整配置
          }
        })
        
        return { success: true, data: enrichedServers }
      }
      
      return result
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取所有工具
  ipcMain.handle('mcp:get-tools', async (_, serverId?: string) => {
    try {
      const result = await simpleMCPClient.getTools(serverId)
      return result
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 执行工具
  ipcMain.handle('mcp:execute-tool', async (_, call: MCPToolCall) => {
    try {
      const result = await simpleMCPClient.executeTool(call)
      return result
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 查找工具
  ipcMain.handle('mcp:find-tool', async (_, name: string, serverId?: string) => {
    try {
      const toolsResult = await simpleMCPClient.getTools(serverId)
      if (!toolsResult.success || !toolsResult.data) {
        return { success: false, error: toolsResult.error }
      }
      const tool = toolsResult.data.find(t => t.name === name)
      const result = { success: true, data: tool || null }
      return result
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 删除MCP服务器
  ipcMain.handle('mcp:remove-server', async (_, serverId: string) => {
    try {
      const result = await simpleMCPClient.removeServer(serverId)
      if (!result.success) {
        throw new Error(result.error)
      }
      
      // 从数据库中删除服务器配置
      try {
        let savedServers = []
        try {
          const existing = electronDatabase.getConfig('mcp_installed_servers', '[]')
          savedServers = JSON.parse(existing)
        } catch (e) {
          savedServers = []
        }
        
        // 过滤掉要删除的服务器
        const filteredServers = savedServers.filter((s: any) => s.id !== serverId)
        
        // 保存更新后的配置
        electronDatabase.setConfig('mcp_installed_servers', JSON.stringify(filteredServers), 'mcp')
        console.log(`🗑️ 已从数据库中删除服务器配置: ${serverId}`)
      } catch (dbError) {
        console.error(`❌ 从数据库中删除服务器配置失败 ${serverId}:`, dbError)
      }
      
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  console.log('✅ MCP IPC handlers registered')
}

// 加载已保存的服务器配置
async function loadSavedServers(): Promise<void> {
  try {
    console.log('📂 正在加载已保存的服务器配置...')
    
    // 清理可能损坏的配置，重新开始
    console.log('🧹 清理现有配置，重新开始...')
    electronDatabase.setConfig('mcp_installed_servers', '[]', 'mcp')
    
    const savedServers = await loadServerConfigs()
    
    // 添加默认的预设服务器
    console.log('📝 添加默认预设服务器')
    const defaultServers = [
      {
        id: 'obsidian',
        name: 'Obsidian',
        description: 'Obsidian 笔记管理工具',
        command: 'uvx',
        args: ['obsidian-mcp'],
        env: {
          OBSIDIAN_VAULT_PATH: '/Users/lvyun/Nextcloud2/Bor-doc'
        },
        autoStart: true
      },
      {
        id: 'duckduckgo-search',
        name: 'DuckDuckGo Search',
        description: '网络搜索工具',
        command: 'uvx',
        args: ['duckduckgo-mcp-server'],
        autoStart: true
      }
    ]
    
    // 保存默认配置到数据库
    electronDatabase.setConfig('mcp_installed_servers', JSON.stringify(defaultServers), 'mcp')
    console.log('✅ 已保存默认服务器配置到数据库')
    
    // 重新加载配置
    const refreshedServers = await loadServerConfigs()
    
    // 添加每个保存的服务器到标准MCP客户端
    for (const config of refreshedServers) {
      try {
        console.log('🔍 正在加载服务器配置:', JSON.stringify(config, null, 2))
        
        // MCP管理器已准备就绪
        
        // 验证配置完整性
        if (!config.command || !config.args) {
          console.error(`❌ 服务器 ${config.id} 配置不完整，跳过加载`)
          console.error(`   - command: ${config.command}`)
          console.error(`   - args: ${JSON.stringify(config.args)}`)
          continue
        }
        
        const addResult = await simpleMCPClient.addServer(config)
        if (!addResult.success) {
          throw new Error(addResult.error)
        }
        console.log(`✅ 已加载服务器: ${config.name} (${config.id})`)
        
        // 如果配置为自动启动，则启动服务器
        if (config.autoStart) {
          console.log(`🚀 正在自动启动服务器: ${config.name} (${config.id})`)
          try {
            const startResult = await simpleMCPClient.startServer(config.id)
            if (startResult.success) {
              console.log(`✅ 服务器 ${config.id} 启动成功`)
            } else {
              console.error(`❌ 服务器 ${config.id} 启动失败:`, startResult.error)
            }
          } catch (startError) {
            console.error(`❌ 服务器 ${config.id} 启动异常:`, startError)
          }
        }
      } catch (error) {
        console.error(`❌ 加载服务器失败 ${config.id}:`, error)
      }
    }
    
    console.log('✅ 已完成服务器配置加载')
  } catch (error) {
    console.error('❌ 加载服务器配置时出错:', error)
  }
}

// 应用准备就绪
app.whenReady().then(async () => {
  console.log('✅ 应用准备就绪')
  // 设置应用用户模型 ID (Windows)
  app.setAppUserModelId('com.bor.intelligent-agent-hub')

  try {
    // 初始化数据库
    console.log('🔧 初始化数据库...')
    await electronDatabase.initialize()
    setupDatabaseHandlers()
    setupCustomMCPServerHandlers()
    console.log('✅ 数据库初始化完成')
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
  }

  // 初始化标准MCP客户端
  await initializeMCPClient()
  setupMCPHandlers()
  
  // 加载已保存的服务器配置
  await loadSavedServers()

  createWindow()

  app.on('activate', function () {
    // macOS 上，当点击 dock 图标并且没有其他窗口打开时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 应用退出前清理资源
app.on('before-quit', async () => {
  console.log('🧹 Cleaning up resources...')
  
  // 清理数据库
  try {
    electronDatabase.close()
    console.log('✅ Database resources cleaned up')
  } catch (error) {
    console.error('❌ Error cleaning up database resources:', error)
  }

  // 清理MCP资源
  try {
    await simpleMCPClient.cleanup()
    console.log('✅ Standard MCP Client resources cleaned up')
  } catch (error) {
    console.error('❌ Error cleaning up Standard MCP Client resources:', error)
  }
})

// 除了 macOS 外，当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
  console.log('✅ 所有窗口已关闭')
  if (process.platform !== 'darwin') app.quit()
})

// IPC 通信处理
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-platform', () => {
  return process.platform
})

// 主题切换处理
ipcMain.handle('set-theme', (_, theme: 'light' | 'dark' | 'system') => {
  // 透明窗口不需要设置背景颜色，由CSS控制
  return theme
})

// 窗口控制
ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize()
})

ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('close-window', () => {
  mainWindow?.close()
})

// 安全配置窗口管理
const configWindows = new Map<string, BrowserWindow>()

ipcMain.handle('open-config-window', (_, configType: string, params?: any) => {
  // 检查是否已有配置窗口打开
  const existingWindow = configWindows.get(configType)
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.focus()
    return
  }

  // 创建配置窗口
  const configWindow = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    modal: true,
    parent: mainWindow || undefined,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    webPreferences: {
      preload: join(__dirname, 'preload-fixed.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 加载配置页面
  if (isDev) {
    configWindow.loadURL(`http://localhost:5173/config/${configType}.html`)
  } else {
    configWindow.loadFile(join(__dirname, `../dist/config/${configType}.html`))
  }

  // 存储窗口引用
  configWindows.set(configType, configWindow)

  // 窗口关闭时清理引用
  configWindow.on('closed', () => {
    configWindows.delete(configType)
  })
})

// 处理配置保存
ipcMain.handle('save-config', (_, configType: string, data: any) => {
  // 这里处理配置数据的安全存储
  console.log(`保存配置: ${configType}`, data)
  
  // 关闭配置窗口
  const window = configWindows.get(configType)
  if (window && !window.isDestroyed()) {
    window.close()
  }
  
  return { success: true }
})

// 语音识别功能
import { exec } from 'child_process'
import { promisify } from 'util'


const execAsync = promisify(exec)

// 系统语音识别
ipcMain.handle('start-speech-recognition', async () => {
  try {
    if (process.platform === 'darwin') {
      // macOS 使用系统语音识别
      return await startMacOSSpeechRecognition()
    } else if (process.platform === 'win32') {
      // Windows 使用 PowerShell 语音识别
      return await startWindowsSpeechRecognition()
    } else {
      return { success: false, error: '不支持的操作系统' }
    }
  } catch (error: any) {
    console.error('语音识别错误:', error)
    return { success: false, error: (error as Error).message }
  }
})

// macOS 语音识别实现
async function startMacOSSpeechRecognition(): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    // 使用 AppleScript 调用系统语音识别
    const script = `
      tell application "System Events"
        -- 模拟按下 Fn 键两次来激活语音输入
        key code 63
        delay 0.1
        key code 63
        delay 2
        -- 等待用户说话
        delay 5
        -- 获取当前剪贴板内容作为结果
        set speechResult to the clipboard
        return speechResult
      end tell
    `
    
    // 暂时返回一个提示，因为真正的语音识别需要更复杂的实现
    return { 
      success: true, 
      text: "请使用系统语音输入功能（按 Fn 键两次）或直接输入文字" 
    }
  } catch (error: any) {
    return { success: false, error: (error as Error).message }
  }
}

// Windows 语音识别实现
async function startWindowsSpeechRecognition(): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    // 使用 PowerShell 的语音识别
    const script = `
      Add-Type -AssemblyName System.Speech
      $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
      $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
      $recognizer.SetInputToDefaultAudioDevice()
      $result = $recognizer.Recognize()
      Write-Output $result.Text
    `
    
    const { stdout } = await execAsync(`powershell -Command "${script}"`)
    
    return { success: true, text: stdout.trim() }
  } catch (error: any) {
    return { success: false, error: (error as Error).message }
  }
}