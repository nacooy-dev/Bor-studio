/**
 * 外部MCP服务器注册表 - 从多个来源聚合服务器信息
 */

import type { MCPServerTemplate } from './server-registry'

export interface ExternalRegistry {
  name: string
  url: string
  description: string
  enabled: boolean
}

/**
 * 外部注册表配置
 */
export const EXTERNAL_REGISTRIES: ExternalRegistry[] = [
  {
    name: 'Awesome MCP Servers',
    url: 'static://community-servers',
    description: '社区维护的优质MCP服务器列表（静态数据）',
    enabled: true // 使用静态数据，安全启用
  },
  {
    name: 'ModelContextProtocol Official',
    url: 'static://official-servers',
    description: '官方MCP服务器仓库（静态数据）',
    enabled: true // 使用静态数据，安全启用
  },
  {
    name: 'MCP Hub',
    url: 'https://mcp-hub.com/api/servers',
    description: 'MCP服务器中心',
    enabled: false // 暂时禁用，因为这个API可能不存在
  }
]

/**
 * 获取官方服务器列表（静态数据，避免API调用问题）
 */
export async function fetchOfficialServers(): Promise<MCPServerTemplate[]> {
  // 暂时使用静态数据，避免GitHub API路径问题
  const officialServers: MCPServerTemplate[] = [
    {
      id: 'official-brave-search',
      name: 'Brave Search MCP Server',
      description: 'MCP server for Brave Search API integration',
      category: 'search',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      homepage: 'https://github.com/modelcontextprotocol/servers',
      tags: ['official', 'search', 'api'],
      requirements: ['Node.js', 'Brave Search API key'],
      parameters: [
        {
          key: 'api_key',
          type: 'string',
          description: 'Brave Search API密钥',
          required: true,
          placeholder: 'BSA_xxxxxxxxxxxxxxxx'
        }
      ],
      env: {
        'BRAVE_SEARCH_API_KEY': '<api_key>'
      },
      autoStart: false
    },
    {
      id: 'official-puppeteer',
      name: 'Puppeteer MCP Server',
      description: 'MCP server for web automation and scraping with Puppeteer',
      category: 'development',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      homepage: 'https://github.com/modelcontextprotocol/servers',
      tags: ['official', 'web', 'automation'],
      requirements: ['Node.js'],
      autoStart: false
    },
    {
      id: 'official-everart',
      name: 'EverArt MCP Server',
      description: 'MCP server for EverArt API integration',
      category: 'content',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everart'],
      homepage: 'https://github.com/modelcontextprotocol/servers',
      tags: ['official', 'art', 'api'],
      requirements: ['Node.js', 'EverArt API key'],
      autoStart: false
    }
  ]
  
  console.log('✅ 获取官方服务器列表（静态数据）:', officialServers.length, '个')
  return officialServers
}

/**
 * 解析官方服务器信息
 */
async function parseOfficialServer(name: string, url: string): Promise<MCPServerTemplate | null> {
  try {
    // 获取package.json信息
    const packageResponse = await fetch(`${url}/package.json`)
    if (!packageResponse.ok) {
      return null
    }
    
    const packageInfo = await packageResponse.json()
    const content = atob(packageInfo.content) // GitHub API返回base64编码的内容
    const pkg = JSON.parse(content)
    
    // 根据包名推断类别和标签
    const category = inferCategory(name, pkg.description || '')
    const tags = inferTags(name, pkg.description || '')
    
    return {
      id: `official-${name}`,
      name: pkg.name || name,
      description: pkg.description || `Official MCP server: ${name}`,
      category,
      command: 'npx',
      args: ['-y', pkg.name],
      homepage: pkg.homepage || `https://github.com/modelcontextprotocol/servers/tree/main/src/${name}`,
      tags: ['official', ...tags],
      requirements: ['Node.js'],
      autoStart: false
    }
  } catch (error) {
    console.error(`解析服务器 ${name} 失败:`, error)
    return null
  }
}

/**
 * 获取社区服务器列表（静态数据，避免网络请求问题）
 */
export async function fetchAwesomeServers(): Promise<MCPServerTemplate[]> {
  // 暂时使用静态数据，避免网络请求问题
  const communityServers: MCPServerTemplate[] = [
    {
      id: 'community-linear',
      name: 'Linear MCP Server',
      description: 'MCP server for Linear project management integration',
      category: 'development',
      command: 'uvx',
      args: ['linear-mcp-server'],
      homepage: 'https://github.com/jerhadf/linear-mcp-server',
      tags: ['community', 'project-management', 'api'],
      requirements: ['Python', 'uv', 'Linear API key'],
      parameters: [
        {
          key: 'api_key',
          type: 'string',
          description: 'Linear API密钥',
          required: true,
          placeholder: 'lin_api_xxxxxxxxxxxxxxxx'
        }
      ],
      env: {
        'LINEAR_API_KEY': '<api_key>'
      },
      autoStart: false
    },
    {
      id: 'community-todoist',
      name: 'Todoist MCP Server',
      description: 'MCP server for Todoist task management',
      category: 'utility',
      command: 'uvx',
      args: ['todoist-mcp-server'],
      homepage: 'https://github.com/abhiz123/todoist-mcp-server',
      tags: ['community', 'productivity', 'tasks'],
      requirements: ['Python', 'uv', 'Todoist API token'],
      parameters: [
        {
          key: 'api_token',
          type: 'string',
          description: 'Todoist API令牌',
          required: true,
          placeholder: 'your_todoist_token'
        }
      ],
      env: {
        'TODOIST_API_TOKEN': '<api_token>'
      },
      autoStart: false
    },
    {
      id: 'community-spotify',
      name: 'Spotify MCP Server',
      description: 'MCP server for Spotify music control and information',
      category: 'content',
      command: 'uvx',
      args: ['spotify-mcp-server'],
      homepage: 'https://github.com/varunneal/spotify-mcp',
      tags: ['community', 'music', 'api'],
      requirements: ['Python', 'uv', 'Spotify API credentials'],
      parameters: [
        {
          key: 'client_id',
          type: 'string',
          description: 'Spotify客户端ID',
          required: true,
          placeholder: 'your_spotify_client_id'
        },
        {
          key: 'client_secret',
          type: 'string',
          description: 'Spotify客户端密钥',
          required: true,
          placeholder: 'your_spotify_client_secret'
        }
      ],
      env: {
        'SPOTIFY_CLIENT_ID': '<client_id>',
        'SPOTIFY_CLIENT_SECRET': '<client_secret>'
      },
      autoStart: false
    }
  ]
  
  console.log('✅ 获取社区服务器列表（静态数据）:', communityServers.length, '个')
  return communityServers
}

/**
 * 解析Awesome MCP Servers的Markdown内容
 */
function parseAwesomeMarkdown(markdown: string): MCPServerTemplate[] {
  const servers: MCPServerTemplate[] = []
  const lines = markdown.split('\n')
  
  let currentCategory = 'utility'
  
  for (const line of lines) {
    // 检测类别标题
    if (line.startsWith('## ') || line.startsWith('### ')) {
      const categoryTitle = line.replace(/^#+\s+/, '').toLowerCase()
      currentCategory = mapAwesomeCategory(categoryTitle)
      continue
    }
    
    // 解析服务器条目 (格式: - [Name](url) - Description)
    const match = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s+-\s+(.+)$/)
    if (match) {
      const [, name, url, description] = match
      
      // 尝试从URL推断安装命令
      const installInfo = inferInstallCommand(url, name)
      
      servers.push({
        id: `awesome-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        description,
        category: currentCategory,
        command: installInfo.command,
        args: installInfo.args,
        homepage: url,
        tags: ['community', ...inferTags(name, description)],
        requirements: installInfo.requirements,
        autoStart: false
      })
    }
  }
  
  return servers
}

/**
 * 推断服务器类别
 */
function inferCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase()
  
  if (text.includes('file') || text.includes('storage') || text.includes('drive')) {
    return 'filesystem'
  }
  if (text.includes('search') || text.includes('web') || text.includes('google')) {
    return 'search'
  }
  if (text.includes('database') || text.includes('sql') || text.includes('mongo')) {
    return 'database'
  }
  if (text.includes('git') || text.includes('github') || text.includes('dev')) {
    return 'development'
  }
  if (text.includes('note') || text.includes('wiki') || text.includes('knowledge')) {
    return 'knowledge'
  }
  if (text.includes('slack') || text.includes('email') || text.includes('chat')) {
    return 'communication'
  }
  if (text.includes('aws') || text.includes('azure') || text.includes('cloud')) {
    return 'cloud'
  }
  if (text.includes('crypto') || text.includes('finance') || text.includes('stock')) {
    return 'finance'
  }
  
  return 'utility'
}

/**
 * 推断服务器标签
 */
function inferTags(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase()
  const tags: string[] = []
  
  if (text.includes('api')) tags.push('api')
  if (text.includes('cloud')) tags.push('cloud')
  if (text.includes('local')) tags.push('local')
  if (text.includes('web')) tags.push('web')
  if (text.includes('ai')) tags.push('ai')
  if (text.includes('ml')) tags.push('ml')
  if (text.includes('popular')) tags.push('popular')
  if (text.includes('enterprise')) tags.push('enterprise')
  
  return tags
}

/**
 * 映射Awesome MCP类别到我们的类别
 */
function mapAwesomeCategory(title: string): string {
  if (title.includes('file') || title.includes('storage')) return 'filesystem'
  if (title.includes('search')) return 'search'
  if (title.includes('database')) return 'database'
  if (title.includes('development') || title.includes('dev')) return 'development'
  if (title.includes('knowledge') || title.includes('note')) return 'knowledge'
  if (title.includes('communication')) return 'communication'
  if (title.includes('cloud')) return 'cloud'
  if (title.includes('finance')) return 'finance'
  if (title.includes('system')) return 'system'
  
  return 'utility'
}

/**
 * 从URL推断安装命令
 */
function inferInstallCommand(url: string, name: string): {
  command: string
  args: string[]
  requirements: string[]
} {
  // GitHub仓库
  if (url.includes('github.com')) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (match) {
      const [, owner, repo] = match
      
      // 如果是Python项目，使用uvx
      if (repo.includes('python') || repo.includes('py-')) {
        return {
          command: 'uvx',
          args: [repo],
          requirements: ['Python', 'uv']
        }
      }
      
      // 默认使用npx
      return {
        command: 'npx',
        args: ['-y', repo],
        requirements: ['Node.js']
      }
    }
  }
  
  // PyPI包
  if (url.includes('pypi.org')) {
    return {
      command: 'uvx',
      args: [name.toLowerCase().replace(/\s+/g, '-')],
      requirements: ['Python', 'uv']
    }
  }
  
  // npm包
  if (url.includes('npmjs.com')) {
    return {
      command: 'npx',
      args: ['-y', name.toLowerCase().replace(/\s+/g, '-')],
      requirements: ['Node.js']
    }
  }
  
  // 默认
  return {
    command: 'uvx',
    args: [name.toLowerCase().replace(/\s+/g, '-')],
    requirements: ['Python', 'uv']
  }
}

/**
 * 获取所有外部服务器（性能优化版本）
 */
export async function fetchAllExternalServers(): Promise<MCPServerTemplate[]> {
  // 检查是否有启用的外部源
  const enabledRegistries = EXTERNAL_REGISTRIES.filter(reg => reg.enabled)
  if (enabledRegistries.length === 0) {
    return []
  }
  
  try {
    // 使用静态数据，避免网络请求延迟
    const allServers: MCPServerTemplate[] = []
    
    // 快速获取官方服务器（静态数据）
    const officialRegistry = EXTERNAL_REGISTRIES.find(r => r.name === 'ModelContextProtocol Official')
    if (officialRegistry?.enabled) {
      const officialServers = await fetchOfficialServers()
      allServers.push(...officialServers)
    }
    
    // 快速获取社区服务器（静态数据）
    const awesomeRegistry = EXTERNAL_REGISTRIES.find(r => r.name === 'Awesome MCP Servers')
    if (awesomeRegistry?.enabled) {
      const communityServers = await fetchAwesomeServers()
      allServers.push(...communityServers)
    }
    
    // 去重（基于ID）
    const uniqueServers = new Map<string, MCPServerTemplate>()
    for (const server of allServers) {
      if (!uniqueServers.has(server.id)) {
        uniqueServers.set(server.id, server)
      }
    }
    
    return Array.from(uniqueServers.values())
  } catch (error) {
    console.warn('获取外部服务器失败:', error)
    return []
  }
}

/**
 * 轻量级缓存管理
 */
class ExternalRegistryCache {
  private cache = new Map<string, { data: MCPServerTemplate[]; timestamp: number }>()
  private readonly CACHE_DURATION = 30 * 60 * 1000 // 30分钟
  private readonly MAX_CACHE_SIZE = 10 // 限制缓存大小

  async get(key: string, fetcher: () => Promise<MCPServerTemplate[]>): Promise<MCPServerTemplate[]> {
    const cached = this.cache.get(key)
    const now = Date.now()
    
    // 检查缓存是否有效
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data
    }
    
    try {
      // 快速获取数据（静态数据，几乎无延迟）
      const data = await fetcher()
      
      // 限制缓存大小，避免内存泄漏
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.cache.keys().next().value
        this.cache.delete(oldestKey)
      }
      
      this.cache.set(key, { data, timestamp: now })
      return data
    } catch (error) {
      // 如果获取失败，返回缓存的数据（即使过期）
      if (cached) {
        console.warn(`获取 ${key} 失败，使用缓存数据`)
        return cached.data
      }
      // 如果没有缓存，返回空数组而不是抛出错误
      console.warn(`获取 ${key} 失败，返回空数组`)
      return []
    }
  }

  clear() {
    this.cache.clear()
  }

  // 获取缓存统计信息
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      keys: Array.from(this.cache.keys())
    }
  }
}

export const externalRegistryCache = new ExternalRegistryCache()