import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
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

// MCP 实现选择 - 使用动态导入避免启动时加载
const USE_STANDARD_MCP = process.env.USE_STANDARD_MCP === 'false' ? false : true // 默认使用标准 MCP
console.log('- 使用标准MCP:', USE_STANDARD_MCP)

// 延迟创建MCP Host实例，直到应用准备好
let mcpHost: any = null

async function initializeMCPHost(): Promise<void> {
  try {
    console.log('🔧 初始化MCP Host...')
    if (USE_STANDARD_MCP) {
      const { StandardMCPAdapter } = await import('../src/lib/mcp-host/StandardMCPAdapter')
      mcpHost = new StandardMCPAdapter({
        maxServers: 10,
        serverTimeout: 30000,
        toolTimeout: 60000,
        enableLogging: true
      })
    } else {
      const { MCPHostMain } = await import('../src/lib/mcp-host/MCPHostMain')
      mcpHost = new MCPHostMain({
        maxServers: 10,
        serverTimeout: 30000,
        toolTimeout: 60000,
        enableLogging: true
      })
    }
    console.log('✅ MCP Host初始化完成')
  } catch (error) {
    console.error('❌ MCP Host初始化失败:', error)
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
        '/sbin',
        '/Applications/Xcode.app/Contents/Developer/usr/bin',
        '/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin'
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
      
      // 确保关键环境变量存在
      if (!process.env.HOME) {
        process.env.HOME = process.env.HOME || process.env.USERPROFILE || '/Users/' + (process.env.USER || 'unknown')
      }
      
      if (!process.env.TMPDIR) {
        process.env.TMPDIR = '/tmp'
      }
      
      if (!process.env.USER) {
        process.env.USER = process.env.USER || 'unknown'
      }
      
      if (!process.env.SHELL) {
        process.env.SHELL = '/bin/zsh'
      }
      
      // 添加更多可能需要的环境变量
      if (!process.env.LOGNAME) {
        process.env.LOGNAME = process.env.USER
      }
      
      if (!process.env.LANG) {
        process.env.LANG = 'en_US.UTF-8'
      }
      
      if (!process.env.TERM) {
        process.env.TERM = 'xterm-256color'
      }
      
      console.log('🔧 设置 PATH 环境变量:', process.env.PATH)
      console.log('🔧 设置 HOME 环境变量:', process.env.HOME)
      console.log('🔧 设置 TMPDIR 环境变量:', process.env.TMPDIR)
      console.log('🔧 设置 USER 环境变量:', process.env.USER)
      console.log('🔧 设置 SHELL 环境变量:', process.env.SHELL)
      console.log('🔧 设置 LOGNAME 环境变量:', process.env.LOGNAME)
      console.log('🔧 设置 LANG 环境变量:', process.env.LANG)
      console.log('🔧 设置 TERM 环境变量:', process.env.TERM)
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
    if (!mcpHost) {
      console.log('⚠️ MCP Host尚未初始化')
      return
    }

    // MCP Host 事件监听
    mcpHost.on('server_added', (server: any) => {
      console.log(`✅ MCP服务器已添加: ${server.id}`)
      // 保存服务器配置
      saveServerConfig(server.config)
    })

    mcpHost.on('server_started', (server: any) => {
      console.log(`🚀 MCP服务器已启动: ${server.id}`)
    })

    mcpHost.on('server_stopped', (server: any) => {
      console.log(`⏹️ MCP服务器已停止: ${server.id}`)
    })

    mcpHost.on('server_error', (server: any, error: any) => {
      console.error(`❌ MCP服务器错误 ${server.id}:`, error)
    })

    mcpHost.on('tools_discovered', (server: any, tools: any) => {
      console.log(`🔧 发现工具 ${server.id}:`, tools.map((t: any) => t.name))
    })
    
    console.log('✅ MCP Host initialized')
  } catch (error) {
    console.error('❌ MCP Host initialization failed:', error)
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
      if (!mcpHost) {
        throw new Error('MCP Host not initialized')
      }
      await mcpHost.addServer(config)
      
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
      if (!mcpHost) {
        throw new Error('MCP Host not initialized')
      }
      await mcpHost.startServer(serverId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 停止MCP服务器
  ipcMain.handle('mcp:stop-server', async (_, serverId: string) => {
    try {
      if (!mcpHost) {
        throw new Error('MCP Host not initialized')
      }
      await mcpHost.stopServer(serverId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取所有服务器
  ipcMain.handle('mcp:get-servers', async () => {
    try {
      if (!mcpHost) {
        return { success: true, data: [] }
      }
      const servers = mcpHost.getServers()
      // 清理不能序列化的对象
      const cleanServers = servers.map((server: any) => ({
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
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 获取所有工具
  ipcMain.handle('mcp:get-tools', async (_, serverId?: string) => {
    try {
      if (!mcpHost) {
        return { success: true, data: [] }
      }
      const tools = serverId ? 
        mcpHost.getServerStatus(serverId)?.tools || [] : 
        mcpHost.getAllTools()
      
      // 确保工具对象可以被序列化
      const cleanTools = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
        server: tool.server
      }))
      
      return { success: true, data: cleanTools }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 执行工具
  ipcMain.handle('mcp:execute-tool', async (_, call: MCPToolCall) => {
    try {
      if (!mcpHost) {
        throw new Error('MCP Host not initialized')
      }
      const result = await mcpHost.executeTool(call)
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 查找工具
  ipcMain.handle('mcp:find-tool', async (_, name: string, serverId?: string) => {
    try {
      if (!mcpHost) {
        return { success: true, data: null }
      }
      const tool = mcpHost.findTool(name, serverId)
      
      // 清理工具对象
      const cleanTool = tool ? {
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
        server: tool.server
      } : null
      
      return { success: true, data: cleanTool }
    } catch (error: any) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // 删除MCP服务器
  ipcMain.handle('mcp:remove-server', async (_, serverId: string) => {
    try {
      if (!mcpHost) {
        throw new Error('MCP Host not initialized')
      }
      await mcpHost.removeServer(serverId)
      
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
    const savedServers = await loadServerConfigs()
    
    // 添加每个保存的服务器到 MCP Host
    for (const config of savedServers) {
      try {
        if (!mcpHost) {
          console.log('⚠️ MCP Host尚未初始化，跳过服务器加载')
          return
        }
        await mcpHost.addServer(config)
        console.log(`✅ 已加载服务器: ${config.name} (${config.id})`)
        
        // 如果配置为自动启动，则启动服务器
        if (config.autoStart) {
          console.log(`🚀 正在自动启动服务器: ${config.name} (${config.id})`)
          // 使用Promise.race实现超时控制，避免长时间阻塞
          await Promise.race([
            mcpHost.startServer(config.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Server start timeout after 10 seconds')), 10000)
            )
          ])
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

  // 初始化MCP
  await initializeMCPHost()
  await initializeMCP()
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
    if (mcpHost) {
      await mcpHost.cleanup()
    }
    console.log('✅ MCP resources cleaned up')
  } catch (error) {
    console.error('❌ Error cleaning up MCP resources:', error)
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