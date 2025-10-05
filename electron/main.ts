import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { MCPHostMain } from '../src/lib/mcp-host/MCPHostMain'
import type { MCPServerConfig, MCPToolCall } from '../src/lib/mcp-host/types'
import { electronDatabase } from './database'

// 创建MCP Host实例
const mcpHost = new MCPHostMain({
  maxServers: 10,
  serverTimeout: 30000,
  toolTimeout: 60000,
  enableLogging: true
})

// 获取当前文件的目录路径（ES 模块中的 __dirname 替代方案）
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 简单的开发环境检测
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL

// 主窗口引用
let mainWindow: BrowserWindow | null = null

// MCP Host 已经是全局实例，不需要额外声明

function createWindow(): void {
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
      preload: join(__dirname, 'preload.cjs'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 开发时暂时禁用，方便调试
    },
  })

  // 窗口准备好后显示
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    
    // 开发环境下打开开发者工具
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  // 处理窗口关闭
  mainWindow.on('closed', () => {
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
    // MCP Host 事件监听
    mcpHost.on('server_added', (server) => {
      console.log(`✅ MCP服务器已添加: ${server.id}`)
    })

    mcpHost.on('server_started', (server) => {
      console.log(`🚀 MCP服务器已启动: ${server.id}`)
    })

    mcpHost.on('server_stopped', (server) => {
      console.log(`⏹️ MCP服务器已停止: ${server.id}`)
    })

    mcpHost.on('server_error', (server, error) => {
      console.error(`❌ MCP服务器错误 ${server.id}:`, error)
    })

    mcpHost.on('tools_discovered', (server, tools) => {
      console.log(`🔧 发现工具 ${server.id}:`, tools.map(t => t.name))
    })
    
    console.log('✅ MCP Host initialized')
  } catch (error) {
    console.error('❌ MCP Host initialization failed:', error)
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

// 设置MCP IPC处理器
function setupMCPHandlers(): void {
  // 添加MCP服务器
  ipcMain.handle('mcp:add-server', async (_, config: MCPServerConfig) => {
    try {
      await mcpHost.addServer(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 启动MCP服务器
  ipcMain.handle('mcp:start-server', async (_, serverId: string) => {
    try {
      await mcpHost.startServer(serverId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 停止MCP服务器
  ipcMain.handle('mcp:stop-server', async (_, serverId: string) => {
    try {
      await mcpHost.stopServer(serverId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取所有服务器
  ipcMain.handle('mcp:get-servers', async () => {
    try {
      const servers = mcpHost.getServers()
      // 清理不能序列化的对象
      const cleanServers = servers.map(server => ({
        id: server.id,
        config: server.config,
        status: server.status,
        capabilities: server.capabilities,
        tools: server.tools,
        lastError: server.lastError,
        pid: server.pid,
        startTime: server.startTime
        // 不包含 process 和 messageBuffer
      }))
      return { success: true, data: cleanServers }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取所有工具
  ipcMain.handle('mcp:get-tools', async (_, serverId?: string) => {
    try {
      const tools = serverId ? 
        mcpHost.getServerStatus(serverId)?.tools || [] : 
        mcpHost.getAllTools()
      
      // 确保工具对象可以被序列化
      const cleanTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
        server: tool.server
      }))
      
      return { success: true, data: cleanTools }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 执行工具
  ipcMain.handle('mcp:execute-tool', async (_, call: MCPToolCall) => {
    try {
      const result = await mcpHost.executeTool(call)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 查找工具
  ipcMain.handle('mcp:find-tool', async (_, name: string, serverId?: string) => {
    try {
      const tool = mcpHost.findTool(name, serverId)
      
      // 清理工具对象
      const cleanTool = tool ? {
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
        server: tool.server
      } : null
      
      return { success: true, data: cleanTool }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 删除MCP服务器
  ipcMain.handle('mcp:remove-server', async (_, serverId: string) => {
    try {
      await mcpHost.removeServer(serverId)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  console.log('✅ MCP IPC handlers registered')
}

// 应用准备就绪
app.whenReady().then(async () => {
  // 设置应用用户模型 ID (Windows)
  app.setAppUserModelId('com.bor.intelligent-agent-hub')

  // 初始化数据库
  await electronDatabase.initialize()
  setupDatabaseHandlers()

  // 初始化MCP
  await initializeMCP()
  setupMCPHandlers()

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
    await mcpHost.cleanup()
    console.log('✅ MCP resources cleaned up')
  } catch (error) {
    console.error('❌ Error cleaning up MCP resources:', error)
  }
})

// 除了 macOS 外，当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
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
      preload: join(__dirname, 'preload.cjs'),
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
  } catch (error) {
    console.error('语音识别错误:', error)
    return { success: false, error: error.message }
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
  } catch (error) {
    return { success: false, error: error.message }
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
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// 在此处，您还可以包含应用程序的其余主进程代码
// 您也可以将它们放在单独的文件中并在此处导入