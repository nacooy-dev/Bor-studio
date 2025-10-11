/**
 * 自定义MCP服务器解析器
 * 支持从GitHub仓库、npm包等来源解析MCP服务器信息
 */

import type { MCPServerTemplate, MCPParameter } from './server-registry'

export interface ParsedServerInfo {
  success: boolean
  server?: MCPServerTemplate
  error?: string
  confidence: number // 0-1，解析置信度
  suggestions?: string[] // 给用户的建议
}

export interface ServerSource {
  type: 'github' | 'npm' | 'pypi' | 'url'
  url: string
  owner?: string
  repo?: string
  packageName?: string
}

/**
 * 自定义服务器解析器
 */
export class CustomServerParser {
  /**
   * 解析服务器源
   */
  async parseServerSource(input: string): Promise<ParsedServerInfo> {
    const source = this.identifySource(input)
    
    if (!source) {
      return {
        success: false,
        error: '无法识别的服务器源格式',
        confidence: 0,
        suggestions: [
          '支持的格式：',
          '• GitHub: https://github.com/owner/repo',
          '• npm: npm:package-name 或 https://npmjs.com/package/name',
          '• PyPI: pypi:package-name 或 https://pypi.org/project/name'
        ]
      }
    }

    try {
      switch (source.type) {
        case 'github':
          return await this.parseGitHubRepo(source)
        case 'npm':
          return await this.parseNpmPackage(source)
        case 'pypi':
          return await this.parsePyPIPackage(source)
        default:
          return {
            success: false,
            error: '暂不支持此类型的服务器源',
            confidence: 0
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '解析失败',
        confidence: 0
      }
    }
  }

  /**
   * 识别服务器源类型
   */
  private identifySource(input: string): ServerSource | null {
    const trimmed = input.trim()

    // GitHub URL
    const githubMatch = trimmed.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/)
    if (githubMatch) {
      return {
        type: 'github',
        url: trimmed,
        owner: githubMatch[1],
        repo: githubMatch[2]
      }
    }

    // npm package
    if (trimmed.startsWith('npm:')) {
      return {
        type: 'npm',
        url: trimmed,
        packageName: trimmed.substring(4)
      }
    }

    const npmMatch = trimmed.match(/^https?:\/\/(?:www\.)?npmjs\.com\/package\/([^\/]+)/)
    if (npmMatch) {
      return {
        type: 'npm',
        url: trimmed,
        packageName: npmMatch[1]
      }
    }

    // PyPI package
    if (trimmed.startsWith('pypi:')) {
      return {
        type: 'pypi',
        url: trimmed,
        packageName: trimmed.substring(5)
      }
    }

    const pypiMatch = trimmed.match(/^https?:\/\/pypi\.org\/project\/([^\/]+)/)
    if (pypiMatch) {
      return {
        type: 'pypi',
        url: trimmed,
        packageName: pypiMatch[1]
      }
    }

    return null
  }

  /**
   * 解析GitHub仓库
   */
  private async parseGitHubRepo(source: ServerSource): Promise<ParsedServerInfo> {
    const { owner, repo } = source
    
    try {
      // 获取仓库基本信息
      const repoInfo = await this.fetchGitHubRepoInfo(owner!, repo!)
      
      // 获取package.json（如果存在）
      const packageJson = await this.fetchGitHubFile(owner!, repo!, 'package.json')
      
      // 获取README
      const readme = await this.fetchGitHubReadme(owner!, repo!)
      
      // 解析服务器信息
      const server = this.buildServerFromGitHub(source, repoInfo, packageJson, readme)
      
      return {
        success: true,
        server,
        confidence: this.calculateConfidence(server, packageJson, readme),
        suggestions: this.generateSuggestions(server, packageJson, readme)
      }
    } catch (error) {
      return {
        success: false,
        error: `GitHub仓库解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        confidence: 0
      }
    }
  }

  /**
   * 解析npm包
   */
  private async parseNpmPackage(source: ServerSource): Promise<ParsedServerInfo> {
    try {
      const packageInfo = await this.fetchNpmPackageInfo(source.packageName!)
      const server = this.buildServerFromNpm(source, packageInfo)
      
      return {
        success: true,
        server,
        confidence: 0.8,
        suggestions: ['npm包信息已自动解析，请检查配置是否正确']
      }
    } catch (error) {
      return {
        success: false,
        error: `npm包解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        confidence: 0
      }
    }
  }

  /**
   * 解析PyPI包
   */
  private async parsePyPIPackage(source: ServerSource): Promise<ParsedServerInfo> {
    try {
      const packageInfo = await this.fetchPyPIPackageInfo(source.packageName!)
      const server = this.buildServerFromPyPI(source, packageInfo)
      
      return {
        success: true,
        server,
        confidence: 0.8,
        suggestions: ['PyPI包信息已自动解析，请检查配置是否正确']
      }
    } catch (error) {
      return {
        success: false,
        error: `PyPI包解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        confidence: 0
      }
    }
  }

  /**
   * 获取GitHub仓库信息
   */
  private async fetchGitHubRepoInfo(owner: string, repo: string): Promise<any> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
    if (!response.ok) {
      throw new Error(`GitHub API错误: ${response.status}`)
    }
    return response.json()
  }

  /**
   * 获取GitHub文件内容
   */
  private async fetchGitHubFile(owner: string, repo: string, path: string): Promise<any> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`)
      if (!response.ok) {
        return null
      }
      const data = await response.json()
      const content = atob(data.content)
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * 获取GitHub README
   */
  private async fetchGitHubReadme(owner: string, repo: string): Promise<string> {
    const readmeFiles = ['README.md', 'readme.md', 'README.rst', 'README.txt']
    
    for (const filename of readmeFiles) {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`)
        if (response.ok) {
          const data = await response.json()
          return atob(data.content)
        }
      } catch {
        continue
      }
    }
    
    return ''
  }

  /**
   * 获取npm包信息
   */
  private async fetchNpmPackageInfo(packageName: string): Promise<any> {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`)
    if (!response.ok) {
      throw new Error(`npm API错误: ${response.status}`)
    }
    return response.json()
  }

  /**
   * 获取PyPI包信息
   */
  private async fetchPyPIPackageInfo(packageName: string): Promise<any> {
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`)
    if (!response.ok) {
      throw new Error(`PyPI API错误: ${response.status}`)
    }
    return response.json()
  }

  /**
   * 从GitHub信息构建服务器配置
   */
  private buildServerFromGitHub(
    source: ServerSource, 
    repoInfo: any, 
    packageJson: any, 
    readme: string
  ): MCPServerTemplate {
    const { owner, repo } = source
    const id = `custom-${owner}-${repo}`.toLowerCase()
    
    // 推断安装命令
    const { command, args } = this.inferInstallCommand(packageJson, readme, source)
    
    // 推断类别
    const category = this.inferCategory(repoInfo.description || '', readme, packageJson)
    
    // 推断标签
    const tags = this.inferTags(repoInfo, packageJson, readme)
    
    // 推断参数
    const parameters = this.inferParameters(readme, packageJson)

    return {
      id,
      name: packageJson?.name || repoInfo.name || repo,
      description: repoInfo.description || packageJson?.description || `自定义MCP服务器: ${repo}`,
      category,
      command,
      args,
      homepage: source.url,
      tags: ['custom', ...tags],
      requirements: this.inferRequirements(command, packageJson),
      parameters,
      autoStart: false
    }
  }

  /**
   * 从npm信息构建服务器配置
   */
  private buildServerFromNpm(source: ServerSource, packageInfo: any): MCPServerTemplate {
    const latest = packageInfo['dist-tags']?.latest
    const versionInfo = packageInfo.versions?.[latest]
    
    return {
      id: `custom-npm-${source.packageName}`,
      name: packageInfo.name,
      description: packageInfo.description || `npm MCP服务器: ${source.packageName}`,
      category: this.inferCategory(packageInfo.description || '', '', versionInfo),
      command: 'npx',
      args: ['-y', packageInfo.name],
      homepage: packageInfo.homepage || `https://npmjs.com/package/${source.packageName}`,
      tags: ['custom', 'npm'],
      requirements: ['Node.js'],
      autoStart: false
    }
  }

  /**
   * 从PyPI信息构建服务器配置
   */
  private buildServerFromPyPI(source: ServerSource, packageInfo: any): MCPServerTemplate {
    const info = packageInfo.info
    
    return {
      id: `custom-pypi-${source.packageName}`,
      name: info.name,
      description: info.summary || `PyPI MCP服务器: ${source.packageName}`,
      category: this.inferCategory(info.summary || '', '', null),
      command: 'uvx',
      args: [info.name],
      homepage: info.home_page || `https://pypi.org/project/${source.packageName}`,
      tags: ['custom', 'python'],
      requirements: ['Python', 'uv'],
      autoStart: false
    }
  }

  /**
   * 推断安装命令
   */
  private inferInstallCommand(packageJson: any, readme: string, source: ServerSource): { command: string; args: string[] } {
    // 检查package.json
    if (packageJson) {
      return {
        command: 'npx',
        args: ['-y', packageJson.name]
      }
    }

    // 检查README中的安装说明
    const readmeLower = readme.toLowerCase()
    
    if (readmeLower.includes('uvx') || readmeLower.includes('uv run')) {
      return {
        command: 'uvx',
        args: [source.repo || 'unknown']
      }
    }
    
    if (readmeLower.includes('npx')) {
      return {
        command: 'npx',
        args: ['-y', source.repo || 'unknown']
      }
    }

    // 默认根据仓库名推断
    if (source.repo?.includes('python') || source.repo?.includes('py-')) {
      return {
        command: 'uvx',
        args: [source.repo]
      }
    }

    return {
      command: 'npx',
      args: ['-y', source.repo || 'unknown']
    }
  }

  /**
   * 推断服务器类别
   */
  private inferCategory(description: string, readme: string, packageJson: any): string {
    const text = `${description} ${readme}`.toLowerCase()
    
    if (text.includes('file') || text.includes('storage') || text.includes('filesystem')) {
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
    
    return 'utility'
  }

  /**
   * 推断标签
   */
  private inferTags(repoInfo: any, packageJson: any, readme: string): string[] {
    const tags: string[] = []
    const text = `${repoInfo.description || ''} ${readme}`.toLowerCase()
    
    if (text.includes('api')) tags.push('api')
    if (text.includes('web')) tags.push('web')
    if (text.includes('ai') || text.includes('ml')) tags.push('ai')
    if (text.includes('tool')) tags.push('tool')
    if (repoInfo.stargazers_count > 100) tags.push('popular')
    if (packageJson) tags.push('npm')
    
    return tags
  }

  /**
   * 推断参数
   */
  private inferParameters(readme: string, packageJson: any): MCPParameter[] {
    const parameters: MCPParameter[] = []
    
    // 从README中提取常见的配置参数
    const apiKeyMatch = readme.match(/api[_\s]?key|token|secret/i)
    if (apiKeyMatch) {
      parameters.push({
        key: 'api_key',
        type: 'string',
        description: 'API密钥',
        required: true,
        placeholder: 'your_api_key'
      })
    }
    
    const pathMatch = readme.match(/path|directory|folder/i)
    if (pathMatch) {
      parameters.push({
        key: 'path',
        type: 'path',
        description: '文件路径',
        required: false,
        placeholder: '/path/to/directory'
      })
    }
    
    return parameters
  }

  /**
   * 推断系统要求
   */
  private inferRequirements(command: string, packageJson: any): string[] {
    const requirements: string[] = []
    
    if (command === 'npx') {
      requirements.push('Node.js')
    } else if (command === 'uvx') {
      requirements.push('Python', 'uv')
    }
    
    return requirements
  }

  /**
   * 计算解析置信度
   */
  private calculateConfidence(server: MCPServerTemplate, packageJson: any, readme: string): number {
    let confidence = 0.3 // 基础分数
    
    if (packageJson) confidence += 0.3
    if (readme.length > 100) confidence += 0.2
    if (server.description.length > 20) confidence += 0.1
    if (server.parameters && server.parameters.length > 0) confidence += 0.1
    
    return Math.min(confidence, 1.0)
  }

  /**
   * 生成建议
   */
  private generateSuggestions(server: MCPServerTemplate, packageJson: any, readme: string): string[] {
    const suggestions: string[] = []
    
    if (!packageJson) {
      suggestions.push('未找到package.json，请手动确认安装命令')
    }
    
    if (readme.length < 100) {
      suggestions.push('README信息较少，建议手动检查配置参数')
    }
    
    if (!server.parameters || server.parameters.length === 0) {
      suggestions.push('未检测到配置参数，如需要请手动添加')
    }
    
    suggestions.push('请在安装前确认服务器的安全性和可信度')
    
    return suggestions
  }
}

// 单例实例
export const customServerParser = new CustomServerParser()