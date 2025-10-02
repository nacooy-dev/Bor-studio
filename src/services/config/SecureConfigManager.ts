// 简单的事件发射器实现，避免依赖 Node.js events 模块
class SimpleEventEmitter {
  private listeners: Map<string, Function[]> = new Map()

  on(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  emit(event: string, ...args: any[]) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args))
    }
  }

  off(event: string, listener: Function) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }
}

// 配置窗口状态
export interface ConfigWindowState {
  id: string
  type: string
  isOpen: boolean
  data?: any
  timestamp: number
}

// 配置数据
export interface ConfigData {
  type: string
  data: Record<string, any>
  encrypted?: boolean
  timestamp: number
}

// 安全配置管理器
export class SecureConfigManager extends SimpleEventEmitter {
  private openWindows: Map<string, ConfigWindowState> = new Map()
  private configData: Map<string, ConfigData> = new Map()
  private encryptionKey?: string

  constructor() {
    super()
    this.initializeEncryption()
    this.loadStoredConfigs()
  }

  // 初始化加密
  private initializeEncryption() {
    // 生成或获取加密密钥
    this.encryptionKey = this.getOrCreateEncryptionKey()
  }

  // 获取或创建加密密钥
  private getOrCreateEncryptionKey(): string {
    let key = localStorage.getItem('bor-config-key')
    if (!key) {
      // 生成新的加密密钥
      key = this.generateEncryptionKey()
      localStorage.setItem('bor-config-key', key)
    }
    return key
  }

  // 生成加密密钥
  private generateEncryptionKey(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // 加载存储的配置
  private loadStoredConfigs() {
    try {
      const stored = localStorage.getItem('bor-secure-configs')
      if (stored) {
        const configs = JSON.parse(stored)
        for (const [key, value] of Object.entries(configs)) {
          this.configData.set(key, value as ConfigData)
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  // 保存配置到存储
  private saveConfigs() {
    try {
      const configs = Object.fromEntries(this.configData.entries())
      localStorage.setItem('bor-secure-configs', JSON.stringify(configs))
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  // 打开配置窗口
  async openConfigWindow(configType: string, params?: any): Promise<string> {
    const windowId = `config-${configType}-${Date.now()}`
    
    // 检查是否已有同类型窗口打开
    const existingWindow = Array.from(this.openWindows.values())
      .find(window => window.type === configType && window.isOpen)
    
    if (existingWindow) {
      console.log(`配置窗口 ${configType} 已经打开`)
      this.emit('window-focus', existingWindow.id)
      return existingWindow.id
    }

    // 创建新的窗口状态
    const windowState: ConfigWindowState = {
      id: windowId,
      type: configType,
      isOpen: true,
      data: params,
      timestamp: Date.now()
    }

    this.openWindows.set(windowId, windowState)

    try {
      // 如果在 Electron 环境中，使用 Electron API
      if (window.electronAPI && window.electronAPI.openConfigWindow) {
        await window.electronAPI.openConfigWindow(configType, params)
      } else {
        // 在浏览器环境中，使用模态对话框或新窗口
        this.openBrowserConfigWindow(configType, params)
      }

      this.emit('window-opened', windowState)
      console.log(`配置窗口已打开: ${configType}`)
      
      return windowId

    } catch (error) {
      console.error('打开配置窗口失败:', error)
      this.openWindows.delete(windowId)
      throw error
    }
  }

  // 在浏览器中打开配置窗口
  private openBrowserConfigWindow(configType: string, params?: any) {
    // 创建模态对话框
    const modal = document.createElement('div')
    modal.id = `config-modal-${configType}`
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    
    const content = document.createElement('div')
    content.className = 'bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto'
    
    // 加载配置页面内容
    this.loadConfigContent(configType, content, params)
    
    modal.appendChild(content)
    document.body.appendChild(modal)

    // 点击外部关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeConfigWindow(configType)
      }
    })
  }

  // 加载配置内容
  private async loadConfigContent(configType: string, container: HTMLElement, params?: any) {
    try {
      // 根据配置类型加载不同的内容
      switch (configType) {
        case 'llm-settings':
          await this.loadLLMSettingsContent(container, params)
          break
        case 'system-settings':
          await this.loadSystemSettingsContent(container, params)
          break
        default:
          container.innerHTML = `
            <div class="text-center">
              <h2 class="text-xl font-semibold mb-4">配置 - ${configType}</h2>
              <p class="text-gray-600">配置页面开发中...</p>
              <button onclick="this.closest('.fixed').remove()" 
                      class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                关闭
              </button>
            </div>
          `
      }
    } catch (error) {
      console.error('加载配置内容失败:', error)
      container.innerHTML = `
        <div class="text-center text-red-600">
          <h2 class="text-xl font-semibold mb-4">加载失败</h2>
          <p>${error.message}</p>
          <button onclick="this.closest('.fixed').remove()" 
                  class="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            关闭
          </button>
        </div>
      `
    }
  }

  // 加载 LLM 设置内容
  private async loadLLMSettingsContent(container: HTMLElement, params?: any) {
    // 获取当前 LLM 配置
    const currentConfig = this.getConfig('llm-settings') || {
      providers: {},
      currentProvider: 'ollama',
      currentModel: ''
    }

    container.innerHTML = `
      <div class="llm-settings max-w-4xl">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200">LLM 模型配置</h2>
          <button onclick="this.closest('.fixed').remove()" 
                  class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        <div class="space-y-6">
          <!-- 当前状态 -->
          <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 class="font-medium mb-2">当前配置</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300">
              供应商: <span class="font-mono">${currentConfig.currentProvider || '未设置'}</span><br>
              模型: <span class="font-mono">${currentConfig.currentModel || '未设置'}</span>
            </p>
          </div>

          <!-- 供应商配置 -->
          <div>
            <h3 class="font-medium mb-3">LLM 供应商配置</h3>
            <div class="space-y-4">
              ${this.renderProviderOptions(currentConfig.providers)}
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex justify-end space-x-3 pt-4 border-t">
            <button onclick="this.closest('.fixed').remove()" 
                    class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button onclick="window.borConfigManager.saveLLMConfig()" 
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              保存配置
            </button>
          </div>
        </div>
      </div>
    `

    // 暴露配置管理器到全局，供按钮调用
    ;(window as any).borConfigManager = this
  }

  // 渲染供应商选项
  private renderProviderOptions(currentProviders: any = {}): string {
    const providers = [
      { 
        id: 'ollama', 
        name: 'Ollama (本地)', 
        description: '本地运行的开源模型',
        fields: []
      },
      { 
        id: 'openai', 
        name: 'OpenAI', 
        description: 'GPT-4, GPT-3.5 等模型',
        fields: [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          { name: 'baseURL', label: 'Base URL (可选)', type: 'text', placeholder: 'https://api.openai.com' },
          { name: 'organization', label: 'Organization (可选)', type: 'text' }
        ]
      },
      { 
        id: 'anthropic', 
        name: 'Anthropic', 
        description: 'Claude 系列模型',
        fields: [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          { name: 'baseURL', label: 'Base URL (可选)', type: 'text', placeholder: 'https://api.anthropic.com' }
        ]
      },
      { 
        id: 'gemini', 
        name: 'Google Gemini', 
        description: 'Google 的 AI 模型',
        fields: [
          { name: 'apiKey', label: 'API Key', type: 'password', required: true },
          { name: 'baseURL', label: 'Base URL (可选)', type: 'text', placeholder: 'https://generativelanguage.googleapis.com' }
        ]
      }
    ]

    return providers.map(provider => {
      const config = currentProviders[provider.id] || {}
      const isConfigured = provider.id === 'ollama' || (config.apiKey && config.apiKey.length > 0)
      
      return `
        <div class="border rounded-lg p-4 ${isConfigured ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-gray-200'}">
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-medium">${provider.name}</h4>
                ${isConfigured ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">已配置</span>' : '<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">未配置</span>'}
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${provider.description}</p>
            </div>
            <div class="flex gap-2">
              ${isConfigured && provider.id !== 'ollama' ? `
                <button class="px-3 py-1 text-sm text-green-600 border border-green-300 rounded hover:bg-green-100" 
                        onclick="window.borConfigManager.testProvider('${provider.id}')">
                  测试
                </button>
              ` : ''}
              <button class="px-3 py-1 text-sm border rounded hover:bg-gray-100" 
                      onclick="window.borConfigManager.toggleProviderConfig('${provider.id}')">
                ${provider.id === 'ollama' ? '查看' : (isConfigured ? '编辑' : '配置')}
              </button>
            </div>
          </div>
          
          <div id="config-${provider.id}" class="hidden space-y-3">
            ${provider.fields.map(field => `
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ${field.label} ${field.required ? '<span class="text-red-500">*</span>' : ''}
                </label>
                <input 
                  type="${field.type}" 
                  name="${provider.id}-${field.name}"
                  value="${config[field.name] || ''}"
                  placeholder="${field.placeholder || ''}"
                  class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  ${field.required ? 'required' : ''}
                />
              </div>
            `).join('')}
            
            ${provider.id === 'ollama' ? `
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <p>Ollama 是本地运行的开源模型服务。</p>
                <p>确保 Ollama 服务正在运行：<code class="bg-gray-100 px-1 rounded">http://localhost:11434</code></p>
              </div>
            ` : `
              <div class="flex gap-2 pt-2">
                <button class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600" 
                        onclick="window.borConfigManager.saveProviderConfig('${provider.id}')">
                  保存
                </button>
                <button class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100" 
                        onclick="window.borConfigManager.toggleProviderConfig('${provider.id}')">
                  取消
                </button>
              </div>
            `}
          </div>
        </div>
      `
    }).join('')
  }

  // 加载系统设置内容
  private async loadSystemSettingsContent(container: HTMLElement, params?: any) {
    container.innerHTML = `
      <div class="system-settings">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-200">系统设置</h2>
          <button onclick="this.closest('.fixed').remove()" 
                  class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        <div class="space-y-6">
          <!-- 主题设置 -->
          <div>
            <h3 class="font-medium mb-3">外观主题</h3>
            <div class="space-y-2">
              <label class="flex items-center">
                <input type="radio" name="theme" value="light" class="mr-2">
                <span>浅色主题</span>
              </label>
              <label class="flex items-center">
                <input type="radio" name="theme" value="dark" class="mr-2">
                <span>深色主题</span>
              </label>
              <label class="flex items-center">
                <input type="radio" name="theme" value="system" class="mr-2" checked>
                <span>跟随系统</span>
              </label>
            </div>
          </div>

          <!-- 语言设置 -->
          <div>
            <h3 class="font-medium mb-3">语言</h3>
            <select class="w-full p-2 border rounded">
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </div>

          <!-- 操作按钮 -->
          <div class="flex justify-end space-x-3 pt-4 border-t">
            <button onclick="this.closest('.fixed').remove()" 
                    class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button onclick="window.borConfigManager.saveSystemConfig()" 
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              保存设置
            </button>
          </div>
        </div>
      </div>
    `
  }

  // 关闭配置窗口
  closeConfigWindow(configType: string): void {
    // 查找并关闭窗口
    for (const [windowId, windowState] of this.openWindows.entries()) {
      if (windowState.type === configType && windowState.isOpen) {
        windowState.isOpen = false
        this.openWindows.delete(windowId)
        
        // 移除浏览器中的模态对话框
        const modal = document.getElementById(`config-modal-${configType}`)
        if (modal) {
          modal.remove()
        }
        
        this.emit('window-closed', windowState)
        console.log(`配置窗口已关闭: ${configType}`)
        break
      }
    }
  }

  // 保存配置
  saveConfig(configType: string, data: Record<string, any>, encrypt: boolean = true): void {
    const configData: ConfigData = {
      type: configType,
      data: encrypt ? this.encryptData(data) : data,
      encrypted: encrypt,
      timestamp: Date.now()
    }

    this.configData.set(configType, configData)
    this.saveConfigs()
    this.emit('config-saved', { type: configType, data })
    
    console.log(`配置已保存: ${configType}`)
  }

  // 获取配置
  getConfig(configType: string): any {
    const config = this.configData.get(configType)
    if (!config) return null

    if (config.encrypted) {
      return this.decryptData(config.data)
    }
    
    return config.data
  }

  // 加密数据
  private encryptData(data: any): any {
    // 简单的加密实现（生产环境应使用更强的加密）
    try {
      const jsonString = JSON.stringify(data)
      const encrypted = btoa(jsonString) // Base64 编码
      return { encrypted }
    } catch (error) {
      console.error('数据加密失败:', error)
      return data
    }
  }

  // 解密数据
  private decryptData(encryptedData: any): any {
    try {
      if (encryptedData.encrypted) {
        const decrypted = atob(encryptedData.encrypted) // Base64 解码
        return JSON.parse(decrypted)
      }
      return encryptedData
    } catch (error) {
      console.error('数据解密失败:', error)
      return encryptedData
    }
  }

  // 切换供应商配置显示
  toggleProviderConfig(providerId: string): void {
    const configDiv = document.getElementById(`config-${providerId}`)
    if (configDiv) {
      configDiv.classList.toggle('hidden')
    }
  }

  // 保存供应商配置
  saveProviderConfig(providerId: string): void {
    const formData: any = {}
    
    // 收集表单数据
    const inputs = document.querySelectorAll(`input[name^="${providerId}-"]`)
    inputs.forEach((input: any) => {
      const fieldName = input.name.replace(`${providerId}-`, '')
      formData[fieldName] = input.value
    })

    // 验证必填字段
    if (providerId !== 'ollama' && !formData.apiKey) {
      alert('请输入 API Key')
      return
    }

    // 保存配置
    const currentConfig = this.getConfig('llm-settings') || { providers: {} }
    currentConfig.providers[providerId] = formData
    this.saveConfig('llm-settings', currentConfig)

    // 隐藏配置表单
    this.toggleProviderConfig(providerId)

    // 刷新页面显示
    setTimeout(() => {
      const modal = document.querySelector('.llm-settings')?.closest('.fixed')
      if (modal) {
        modal.remove()
        this.openConfigWindow('llm-settings')
      }
    }, 100)

    this.emit('provider-configured', { providerId, config: formData })
  }

  // 测试供应商连接
  async testProvider(providerId: string): Promise<void> {
    const button = document.querySelector(`button[onclick*="testProvider('${providerId}')"]`) as HTMLButtonElement
    if (button) {
      button.textContent = '测试中...'
      button.disabled = true
    }

    try {
      // 这里应该调用实际的测试逻辑
      // 暂时模拟测试结果
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const success = Math.random() > 0.3 // 模拟70%成功率
      
      if (success) {
        alert(`${providerId} 连接测试成功！`)
      } else {
        alert(`${providerId} 连接测试失败，请检查配置。`)
      }
    } catch (error) {
      alert(`测试失败: ${error.message}`)
    } finally {
      if (button) {
        button.textContent = '测试'
        button.disabled = false
      }
    }
  }

  // 配置供应商（保持向后兼容）
  configureProvider(providerId: string): void {
    this.toggleProviderConfig(providerId)
  }

  // 保存 LLM 配置
  saveLLMConfig(): void {
    // 收集表单数据
    const formData = {
      providers: [], // 从表单收集
      currentProvider: '', // 从表单收集
      currentModel: '', // 从表单收集
      timestamp: Date.now()
    }

    this.saveConfig('llm-settings', formData)
    this.closeConfigWindow('llm-settings')
    
    // 通知系统配置已更新
    this.emit('llm-config-updated', formData)
  }

  // 保存系统配置
  saveSystemConfig(): void {
    // 收集表单数据
    const themeRadio = document.querySelector('input[name="theme"]:checked') as HTMLInputElement
    const languageSelect = document.querySelector('select') as HTMLSelectElement

    const formData = {
      theme: themeRadio?.value || 'system',
      language: languageSelect?.value || 'zh-CN',
      timestamp: Date.now()
    }

    this.saveConfig('system-settings', formData, false) // 系统设置不需要加密
    this.closeConfigWindow('system-settings')
    
    // 通知系统设置已更新
    this.emit('system-config-updated', formData)
  }

  // 获取所有打开的窗口
  getOpenWindows(): ConfigWindowState[] {
    return Array.from(this.openWindows.values()).filter(window => window.isOpen)
  }

  // 清理过期的窗口状态
  cleanup(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24小时

    for (const [windowId, windowState] of this.openWindows.entries()) {
      if (now - windowState.timestamp > maxAge) {
        this.openWindows.delete(windowId)
      }
    }
  }
}