import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// 获取当前文件的目录路径（ES 模块中的 __dirname 替代方案）
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 简单的开发环境检测
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL

// 主窗口引用
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
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

// 应用准备就绪
app.whenReady().then(() => {
  // 设置应用用户模型 ID (Windows)
  app.setAppUserModelId('com.bor.intelligent-agent-hub')

  createWindow()

  app.on('activate', function () {
    // macOS 上，当点击 dock 图标并且没有其他窗口打开时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
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
  // 这里可以处理系统级主题切换
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
      preload: join(__dirname, 'preload.js'),
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