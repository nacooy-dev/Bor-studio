/**
 * MCP服务器注册表 - 管理可用的MCP服务器配置
 */

export interface MCPServerTemplate {
  id: string
  name: string
  description: string
  category: string
  command: string
  args: string[]
  env?: Record<string, string>
  homepage?: string
  tags: string[]
  requirements?: string[]
  parameters?: MCPParameter[]
  autoStart?: boolean
  disabled?: boolean
}

export interface MCPParameter {
  key: string
  type: 'string' | 'number' | 'boolean' | 'path' | 'list'
  description: string
  required: boolean
  default?: any
  placeholder?: string
  validation?: {
    pattern?: string
    min?: number
    max?: number
    options?: string[]
  }
}

/**
 * MCP服务器注册表
 * 基于awesome-mcp-servers和5ire项目的最佳实践
 */
export const MCP_SERVER_REGISTRY: MCPServerTemplate[] = [
  // 文件系统类
  {
    id: 'filesystem',
    name: 'File System',
    description: '本地文件系统访问 - 读取、写入、列出文件和目录',
    category: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    homepage: 'https://github.com/modelcontextprotocol/servers',
    tags: ['official', 'filesystem', 'local'],
    requirements: ['Node.js'],
    parameters: [
      {
        key: 'directories',
        type: 'list',
        description: '允许访问的目录列表',
        required: true,
        placeholder: '/Users/username/Documents',
        validation: {
          min: 1
        }
      }
    ],
    autoStart: false
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Google Drive集成 - 列出、读取和搜索云端文件',
    category: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gdrive'],
    homepage: 'https://github.com/modelcontextprotocol/servers',
    tags: ['official', 'cloud', 'google'],
    requirements: ['Node.js', 'Google API credentials'],
    parameters: [
      {
        key: 'credentials_path',
        type: 'path',
        description: 'Google API凭证文件路径',
        required: true,
        placeholder: '/path/to/credentials.json'
      }
    ],
    env: {
      'GOOGLE_APPLICATION_CREDENTIALS': '<credentials_path>'
    },
    autoStart: false
  },

  // 知识管理类
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Obsidian笔记管理 - 创建、读取、搜索和管理Markdown笔记',
    category: 'knowledge',
    command: 'uvx',
    args: ['obsidian-mcp'],
    homepage: 'https://github.com/your-repo/obsidian-mcp',
    tags: ['notes', 'markdown', 'knowledge'],
    requirements: ['Python', 'uv'],
    parameters: [
      {
        key: 'vault_path',
        type: 'path',
        description: 'Obsidian保险库路径',
        required: true,
        placeholder: '/Users/username/Documents/MyVault'
      }
    ],
    env: {
      'OBSIDIAN_VAULT_PATH': '<vault_path>',
      'FASTMCP_LOG_LEVEL': 'ERROR'
    },
    autoStart: false
  },
  {
    id: 'memory',
    name: 'Memory',
    description: '记忆存储和检索 - 保存和查找重要信息',
    category: 'knowledge',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    homepage: 'https://github.com/modelcontextprotocol/servers',
    tags: ['official', 'memory', 'storage'],
    requirements: ['Node.js'],
    autoStart: false
  },

  // 搜索类
  {
    id: 'duckduckgo-search',
    name: 'DuckDuckGo Search',
    description: '网络搜索 - 使用DuckDuckGo搜索引擎进行网页搜索',
    category: 'search',
    command: 'uvx',
    args: ['duckduckgo-mcp-server'],
    homepage: 'https://github.com/your-repo/duckduckgo-mcp',
    tags: ['search', 'web', 'privacy'],
    requirements: ['Python', 'uv'],
    autoStart: false
  },
  {
    id: 'tavily-search',
    name: 'Tavily Search',
    description: 'Tavily AI搜索 - 专为AI优化的搜索引擎',
    category: 'search',
    command: 'npx',
    args: ['-y', 'tavily-mcp@0.1.2'],
    homepage: 'https://tavily.com',
    tags: ['search', 'ai', 'api'],
    requirements: ['Node.js', 'Tavily API key'],
    parameters: [
      {
        key: 'api_key',
        type: 'string',
        description: 'Tavily API密钥',
        required: true,
        placeholder: 'tvly-xxxxxxxxxxxxxxxx'
      }
    ],
    env: {
      'TAVILY_API_KEY': '<api_key>'
    },
    autoStart: false
  },

  // 数据库类
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'SQLite数据库 - SQL查询和数据分析',
    category: 'database',
    command: 'uvx',
    args: ['mcp-server-sqlite'],
    homepage: 'https://github.com/your-repo/sqlite-mcp',
    tags: ['database', 'sql', 'local'],
    requirements: ['Python', 'uv'],
    parameters: [
      {
        key: 'db_path',
        type: 'path',
        description: 'SQLite数据库文件路径',
        required: true,
        placeholder: '/path/to/database.db'
      }
    ],
    autoStart: false
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'PostgreSQL数据库 - 只读数据库访问和模式检查',
    category: 'database',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    homepage: 'https://github.com/modelcontextprotocol/servers',
    tags: ['official', 'database', 'sql'],
    requirements: ['Node.js'],
    parameters: [
      {
        key: 'connection_string',
        type: 'string',
        description: 'PostgreSQL连接字符串',
        required: true,
        placeholder: 'postgresql://user:password@localhost:5432/dbname'
      }
    ],
    autoStart: false
  },

  // 开发工具类
  {
    id: 'git',
    name: 'Git',
    description: 'Git版本控制 - 读取、搜索和操作Git仓库',
    category: 'development',
    command: 'uvx',
    args: ['mcp-server-git'],
    homepage: 'https://github.com/your-repo/git-mcp',
    tags: ['git', 'version-control', 'development'],
    requirements: ['Python', 'uv', 'Git'],
    parameters: [
      {
        key: 'repository_path',
        type: 'path',
        description: 'Git仓库路径',
        required: true,
        placeholder: '/path/to/repository'
      }
    ],
    autoStart: false
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: '结构化思维 - 动态问题解决和结构化思考工具',
    category: 'development',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    homepage: 'https://github.com/modelcontextprotocol/servers',
    tags: ['official', 'thinking', 'problem-solving'],
    requirements: ['Node.js'],
    autoStart: false
  },

  // 系统工具类
  {
    id: 'shell',
    name: 'Shell',
    description: 'Shell命令执行 - 安全的系统命令执行',
    category: 'system',
    command: 'npx',
    args: ['-y', 'mcp-shell'],
    homepage: 'https://github.com/your-repo/shell-mcp',
    tags: ['shell', 'system', 'commands'],
    requirements: ['Node.js'],
    autoStart: false,
    disabled: true // 默认禁用，安全考虑
  },
  {
    id: 'time',
    name: 'Time',
    description: '时间工具 - 时间查询和时区转换',
    category: 'utility',
    command: 'uvx',
    args: ['mcp-server-time'],
    homepage: 'https://github.com/your-repo/time-mcp',
    tags: ['time', 'timezone', 'utility'],
    requirements: ['Python', 'uv'],
    parameters: [
      {
        key: 'local_timezone',
        type: 'string',
        description: '本地时区',
        required: false,
        default: 'Asia/Shanghai',
        placeholder: 'Asia/Shanghai'
      }
    ],
    autoStart: false
  },

  // 通信类
  {
    id: 'slack',
    name: 'Slack',
    description: 'Slack集成 - 与Slack工作区交互',
    category: 'communication',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    homepage: 'https://github.com/modelcontextprotocol/servers',
    tags: ['official', 'slack', 'communication'],
    requirements: ['Node.js', 'Slack Bot Token'],
    parameters: [
      {
        key: 'bot_token',
        type: 'string',
        description: 'Slack Bot Token',
        required: true,
        placeholder: 'xoxb-xxxxxxxxxxxxxxxx'
      },
      {
        key: 'team_id',
        type: 'string',
        description: 'Slack Team ID',
        required: true,
        placeholder: 'T1234567890'
      }
    ],
    env: {
      'SLACK_BOT_TOKEN': '<bot_token>',
      'SLACK_TEAM_ID': '<team_id>'
    },
    autoStart: false
  },

  // 更多文件系统工具
  {
    id: 'box',
    name: 'Box',
    description: 'Box云存储集成 - 访问和管理Box文件',
    category: 'filesystem',
    command: 'uvx',
    args: ['box-mcp-server'],
    homepage: 'https://github.com/box/box-mcp-server',
    tags: ['cloud', 'storage', 'enterprise'],
    requirements: ['Python', 'uv', 'Box API credentials'],
    parameters: [
      {
        key: 'client_id',
        type: 'string',
        description: 'Box应用客户端ID',
        required: true,
        placeholder: 'your_client_id'
      },
      {
        key: 'client_secret',
        type: 'string',
        description: 'Box应用客户端密钥',
        required: true,
        placeholder: 'your_client_secret'
      }
    ],
    env: {
      'BOX_CLIENT_ID': '<client_id>',
      'BOX_CLIENT_SECRET': '<client_secret>'
    },
    autoStart: false
  },

  // 更多搜索工具
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Brave搜索引擎 - 隐私优先的网络搜索',
    category: 'search',
    command: 'uvx',
    args: ['brave-search-mcp'],
    homepage: 'https://brave.com/search/api/',
    tags: ['search', 'privacy', 'api'],
    requirements: ['Python', 'uv', 'Brave Search API key'],
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
    id: 'exa-search',
    name: 'Exa Search',
    description: 'Exa AI搜索 - 为AI优化的语义搜索引擎',
    category: 'search',
    command: 'uvx',
    args: ['exa-mcp-server'],
    homepage: 'https://exa.ai/',
    tags: ['search', 'ai', 'semantic'],
    requirements: ['Python', 'uv', 'Exa API key'],
    parameters: [
      {
        key: 'api_key',
        type: 'string',
        description: 'Exa API密钥',
        required: true,
        placeholder: 'exa_xxxxxxxxxxxxxxxx'
      }
    ],
    env: {
      'EXA_API_KEY': '<api_key>'
    },
    autoStart: false
  },

  // 金融工具
  {
    id: 'coinbase',
    name: 'Coinbase',
    description: 'Coinbase加密货币 - 获取加密货币价格和市场数据',
    category: 'finance',
    command: 'uvx',
    args: ['coinbase-mcp-server'],
    homepage: 'https://www.coinbase.com/cloud',
    tags: ['crypto', 'finance', 'trading'],
    requirements: ['Python', 'uv'],
    autoStart: false
  },
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    description: 'Yahoo财经 - 股票价格、财务数据和市场信息',
    category: 'finance',
    command: 'uvx',
    args: ['yahoo-finance-mcp'],
    homepage: 'https://finance.yahoo.com/',
    tags: ['stocks', 'finance', 'market'],
    requirements: ['Python', 'uv'],
    autoStart: false
  },

  // 云服务工具
  {
    id: 'aws-kb',
    name: 'AWS Knowledge Base',
    description: 'AWS知识库 - 搜索AWS文档和最佳实践',
    category: 'cloud',
    command: 'uvx',
    args: ['aws-kb-mcp-server'],
    homepage: 'https://aws.amazon.com/',
    tags: ['aws', 'cloud', 'documentation'],
    requirements: ['Python', 'uv'],
    autoStart: false
  },
  {
    id: 'azure-ai',
    name: 'Azure AI',
    description: 'Azure AI服务 - 集成Azure认知服务',
    category: 'cloud',
    command: 'uvx',
    args: ['azure-ai-mcp'],
    homepage: 'https://azure.microsoft.com/en-us/products/ai-services',
    tags: ['azure', 'ai', 'cloud'],
    requirements: ['Python', 'uv', 'Azure subscription'],
    parameters: [
      {
        key: 'subscription_key',
        type: 'string',
        description: 'Azure订阅密钥',
        required: true,
        placeholder: 'your_azure_key'
      },
      {
        key: 'region',
        type: 'string',
        description: 'Azure区域',
        required: true,
        default: 'eastus',
        placeholder: 'eastus'
      }
    ],
    env: {
      'AZURE_SUBSCRIPTION_KEY': '<subscription_key>',
      'AZURE_REGION': '<region>'
    },
    autoStart: false
  },

  // 更多开发工具
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub集成 - 仓库管理、问题跟踪和代码搜索',
    category: 'development',
    command: 'uvx',
    args: ['github-mcp-server'],
    homepage: 'https://github.com/',
    tags: ['github', 'git', 'development'],
    requirements: ['Python', 'uv', 'GitHub token'],
    parameters: [
      {
        key: 'token',
        type: 'string',
        description: 'GitHub个人访问令牌',
        required: true,
        placeholder: 'ghp_xxxxxxxxxxxxxxxx'
      }
    ],
    env: {
      'GITHUB_TOKEN': '<token>'
    },
    autoStart: false
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Docker容器管理 - 管理Docker容器和镜像',
    category: 'development',
    command: 'uvx',
    args: ['docker-mcp-server'],
    homepage: 'https://www.docker.com/',
    tags: ['docker', 'containers', 'devops'],
    requirements: ['Python', 'uv', 'Docker'],
    autoStart: false
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Kubernetes集群管理 - K8s资源管理和监控',
    category: 'development',
    command: 'uvx',
    args: ['k8s-mcp-server'],
    homepage: 'https://kubernetes.io/',
    tags: ['kubernetes', 'k8s', 'devops'],
    requirements: ['Python', 'uv', 'kubectl'],
    parameters: [
      {
        key: 'kubeconfig_path',
        type: 'path',
        description: 'Kubernetes配置文件路径',
        required: false,
        placeholder: '~/.kube/config'
      }
    ],
    env: {
      'KUBECONFIG': '<kubeconfig_path>'
    },
    autoStart: false
  },

  // 更多知识管理工具
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notion集成 - 访问和管理Notion页面和数据库',
    category: 'knowledge',
    command: 'uvx',
    args: ['notion-mcp-server'],
    homepage: 'https://www.notion.so/',
    tags: ['notion', 'notes', 'database'],
    requirements: ['Python', 'uv', 'Notion integration token'],
    parameters: [
      {
        key: 'token',
        type: 'string',
        description: 'Notion集成令牌',
        required: true,
        placeholder: 'secret_xxxxxxxxxxxxxxxx'
      }
    ],
    env: {
      'NOTION_TOKEN': '<token>'
    },
    autoStart: false
  },
  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Atlassian Confluence - 企业知识管理和协作',
    category: 'knowledge',
    command: 'uvx',
    args: ['confluence-mcp-server'],
    homepage: 'https://www.atlassian.com/software/confluence',
    tags: ['confluence', 'wiki', 'enterprise'],
    requirements: ['Python', 'uv', 'Confluence API token'],
    parameters: [
      {
        key: 'base_url',
        type: 'string',
        description: 'Confluence基础URL',
        required: true,
        placeholder: 'https://your-domain.atlassian.net'
      },
      {
        key: 'username',
        type: 'string',
        description: '用户名',
        required: true,
        placeholder: 'your-email@example.com'
      },
      {
        key: 'api_token',
        type: 'string',
        description: 'API令牌',
        required: true,
        placeholder: 'your_api_token'
      }
    ],
    env: {
      'CONFLUENCE_BASE_URL': '<base_url>',
      'CONFLUENCE_USERNAME': '<username>',
      'CONFLUENCE_API_TOKEN': '<api_token>'
    },
    autoStart: false
  },

  // 更多数据库工具
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'MongoDB数据库 - NoSQL文档数据库查询',
    category: 'database',
    command: 'uvx',
    args: ['mongodb-mcp-server'],
    homepage: 'https://www.mongodb.com/',
    tags: ['mongodb', 'nosql', 'database'],
    requirements: ['Python', 'uv'],
    parameters: [
      {
        key: 'connection_string',
        type: 'string',
        description: 'MongoDB连接字符串',
        required: true,
        placeholder: 'mongodb://localhost:27017/dbname'
      }
    ],
    env: {
      'MONGODB_URI': '<connection_string>'
    },
    autoStart: false
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Redis缓存数据库 - 键值存储和缓存操作',
    category: 'database',
    command: 'uvx',
    args: ['redis-mcp-server'],
    homepage: 'https://redis.io/',
    tags: ['redis', 'cache', 'database'],
    requirements: ['Python', 'uv'],
    parameters: [
      {
        key: 'host',
        type: 'string',
        description: 'Redis主机地址',
        required: true,
        default: 'localhost',
        placeholder: 'localhost'
      },
      {
        key: 'port',
        type: 'number',
        description: 'Redis端口',
        required: true,
        default: 6379,
        placeholder: '6379'
      }
    ],
    env: {
      'REDIS_HOST': '<host>',
      'REDIS_PORT': '<port>'
    },
    autoStart: false
  },

  // 实用工具
  {
    id: 'weather',
    name: 'Weather',
    description: '天气信息 - 获取实时天气和预报',
    category: 'utility',
    command: 'uvx',
    args: ['weather-mcp-server'],
    homepage: 'https://openweathermap.org/',
    tags: ['weather', 'forecast', 'utility'],
    requirements: ['Python', 'uv', 'OpenWeatherMap API key'],
    parameters: [
      {
        key: 'api_key',
        type: 'string',
        description: 'OpenWeatherMap API密钥',
        required: true,
        placeholder: 'your_openweather_api_key'
      }
    ],
    env: {
      'OPENWEATHER_API_KEY': '<api_key>'
    },
    autoStart: false
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: '日历管理 - 日程安排和提醒',
    category: 'utility',
    command: 'uvx',
    args: ['calendar-mcp-server'],
    homepage: 'https://developers.google.com/calendar',
    tags: ['calendar', 'schedule', 'productivity'],
    requirements: ['Python', 'uv', 'Google Calendar API'],
    parameters: [
      {
        key: 'credentials_path',
        type: 'path',
        description: 'Google Calendar凭证文件路径',
        required: true,
        placeholder: '/path/to/calendar-credentials.json'
      }
    ],
    env: {
      'GOOGLE_CALENDAR_CREDENTIALS': '<credentials_path>'
    },
    autoStart: false
  },
  {
    id: 'email',
    name: 'Email',
    description: '邮件管理 - 发送和接收邮件',
    category: 'communication',
    command: 'uvx',
    args: ['email-mcp-server'],
    homepage: 'https://developers.google.com/gmail',
    tags: ['email', 'gmail', 'communication'],
    requirements: ['Python', 'uv', 'Gmail API'],
    parameters: [
      {
        key: 'credentials_path',
        type: 'path',
        description: 'Gmail API凭证文件路径',
        required: true,
        placeholder: '/path/to/gmail-credentials.json'
      }
    ],
    env: {
      'GMAIL_CREDENTIALS': '<credentials_path>'
    },
    autoStart: false
  },

  // 内容创作工具
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'YouTube集成 - 视频信息和字幕获取',
    category: 'content',
    command: 'uvx',
    args: ['youtube-mcp-server'],
    homepage: 'https://developers.google.com/youtube',
    tags: ['youtube', 'video', 'content'],
    requirements: ['Python', 'uv', 'YouTube API key'],
    parameters: [
      {
        key: 'api_key',
        type: 'string',
        description: 'YouTube Data API密钥',
        required: true,
        placeholder: 'AIza_xxxxxxxxxxxxxxxx'
      }
    ],
    env: {
      'YOUTUBE_API_KEY': '<api_key>'
    },
    autoStart: false
  },
  {
    id: 'pdf-tools',
    name: 'PDF Tools',
    description: 'PDF工具 - PDF文档处理和文本提取',
    category: 'content',
    command: 'uvx',
    args: ['pdf-mcp-server'],
    homepage: 'https://github.com/your-repo/pdf-mcp',
    tags: ['pdf', 'document', 'text-extraction'],
    requirements: ['Python', 'uv'],
    autoStart: false
  },

  // 安全工具
  {
    id: 'password-manager',
    name: 'Password Manager',
    description: '密码管理 - 安全的密码生成和存储',
    category: 'security',
    command: 'uvx',
    args: ['password-mcp-server'],
    homepage: 'https://github.com/your-repo/password-mcp',
    tags: ['password', 'security', 'encryption'],
    requirements: ['Python', 'uv'],
    autoStart: false,
    disabled: true // 默认禁用，安全考虑
  },

  // 监控工具
  {
    id: 'system-monitor',
    name: 'System Monitor',
    description: '系统监控 - CPU、内存、磁盘使用情况',
    category: 'system',
    command: 'uvx',
    args: ['system-monitor-mcp'],
    homepage: 'https://github.com/your-repo/system-monitor-mcp',
    tags: ['monitoring', 'system', 'performance'],
    requirements: ['Python', 'uv'],
    autoStart: false
  },
  {
    id: 'network-tools',
    name: 'Network Tools',
    description: '网络工具 - ping、traceroute、端口扫描',
    category: 'system',
    command: 'uvx',
    args: ['network-tools-mcp'],
    homepage: 'https://github.com/your-repo/network-tools-mcp',
    tags: ['network', 'diagnostics', 'tools'],
    requirements: ['Python', 'uv'],
    autoStart: false
  }
]

/**
 * 按类别获取服务器
 */
export function getServersByCategory(category: string): MCPServerTemplate[] {
  return MCP_SERVER_REGISTRY.filter(server => server.category === category)
}

/**
 * 获取所有类别
 */
export function getCategories(): string[] {
  const categories = new Set(MCP_SERVER_REGISTRY.map(server => server.category))
  return Array.from(categories).sort()
}

/**
 * 根据ID获取服务器模板
 */
export function getServerTemplate(id: string): MCPServerTemplate | undefined {
  return MCP_SERVER_REGISTRY.find(server => server.id === id)
}

/**
 * 搜索服务器
 */
export function searchServers(query: string): MCPServerTemplate[] {
  const lowerQuery = query.toLowerCase()
  return MCP_SERVER_REGISTRY.filter(server => 
    server.name.toLowerCase().includes(lowerQuery) ||
    server.description.toLowerCase().includes(lowerQuery) ||
    server.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  )
}

/**
 * 类别显示名称映射
 */
export const CATEGORY_NAMES: Record<string, string> = {
  filesystem: '📂 文件系统',
  knowledge: '🧠 知识管理',
  search: '🔍 搜索',
  database: '🗄️ 数据库',
  development: '🛠️ 开发工具',
  system: '⚙️ 系统工具',
  utility: '🔧 实用工具',
  communication: '💬 通信',
  finance: '💰 金融',
  cloud: '☁️ 云服务',
  content: '📝 内容创作',
  security: '🔒 安全工具'
}