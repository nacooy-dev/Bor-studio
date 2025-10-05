/**
 * MCP模块统一导出
 * 基于5ire项目的MCP实现
 */

// 核心类型
export * from './types'

// MCP管理器
export { MCPManager } from './manager'

// 协议客户端
export { MCPProtocolClient } from './protocol'

// 默认配置
export const DEFAULT_MCP_CONFIG = {
  maxConcurrentServers: 5,
  toolExecutionTimeout: 30000,
  serverStartTimeout: 10000,
  enableLogging: true,
  logLevel: 'info' as const
}

// 预设服务器配置（渲染进程安全版本）
export const PRESET_SERVERS = [
  {
    id: 'filesystem',
    name: 'File System',
    description: 'File system operations',
    command: 'npx',
    args: ['-y', '--prefer-offline', '@modelcontextprotocol/server-filesystem', '~'],
    autoStart: false
  },
  {
    id: 'duckduckgo-search',
    name: 'DuckDuckGo Search',
    description: 'DuckDuckGo search engine, no API key required',
    command: 'npx',
    args: ['-y', 'duckduckgo-mcp-server'],
    autoStart: false
  },
  {
    id: 'web-research',
    name: 'Web Research',
    description: 'Web research and content analysis',
    command: 'npx',
    args: ['-y', 'mzxrai/mcp-webresearch'],
    autoStart: false
  },
  {
    id: 'web-fetch',
    name: 'Web Fetch',
    description: 'Web content fetching',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    autoStart: false
  },
  {
    id: 'sqlite',
    name: 'SQLite Database',
    description: 'SQLite database operations',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', './data.db'],
    autoStart: false
  }
]