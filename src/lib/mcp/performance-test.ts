/**
 * MCP性能测试工具
 * 用于测试和监控MCP工具执行性能
 */

import { mcpPerformanceMonitor } from './performance-monitor'
import { mcpService } from '@/services/mcp'

export interface PerformanceTestResult {
  testName: string
  duration: number
  success: boolean
  error?: string
  timestamp: number
}

export class MCPPerformanceTester {
  private testResults: PerformanceTestResult[] = []

  /**
   * 运行所有性能测试
   */
  async runAllTests(): Promise<PerformanceTestResult[]> {
    console.log('🚀 开始MCP性能测试...')
    
    // 测试内置工具性能
    await this.testBuiltInTools()
    
    // 测试外部工具性能（如果可用）
    await this.testExternalTools()
    
    // 测试服务器启动性能
    await this.testServerStartup()
    
    console.log('✅ MCP性能测试完成')
    return this.testResults
  }

  /**
   * 测试内置工具性能
   */
  private async testBuiltInTools(): Promise<void> {
    console.log('🔧 测试内置工具性能...')
    
    try {
      // 测试计算器工具
      const calcStart = Date.now()
      const calcResult = await mcpService.executeTool({
        tool: 'calculate',
        parameters: { expression: '2 + 2 * 3' },
        server: 'built-in'
      })
      const calcDuration = Date.now() - calcStart
      
      this.testResults.push({
        testName: '内置计算器工具',
        duration: calcDuration,
        success: calcResult.success,
        timestamp: Date.now()
      })
      
      // 测试时间工具
      const timeStart = Date.now()
      const timeResult = await mcpService.executeTool({
        tool: 'get_time',
        parameters: { format: 'iso' },
        server: 'built-in'
      })
      const timeDuration = Date.now() - timeStart
      
      this.testResults.push({
        testName: '内置时间工具',
        duration: timeDuration,
        success: timeResult.success,
        timestamp: Date.now()
      })
      
      console.log(`✅ 内置工具测试完成: 计算器${calcDuration}ms, 时间${timeDuration}ms`)
    } catch (error) {
      console.error('❌ 内置工具测试失败:', error)
      this.testResults.push({
        testName: '内置工具测试',
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now()
      })
    }
  }

  /**
   * 测试外部工具性能
   */
  private async testExternalTools(): Promise<void> {
    console.log('🔌 测试外部工具性能...')
    
    try {
      // 获取可用的外部工具
      const toolsResult = await mcpService.getTools()
      if (!toolsResult.success || !toolsResult.data) {
        console.log('⚠️ 无外部工具可用')
        return
      }
      
      const externalTools = toolsResult.data.filter((tool: any) => tool.server !== 'built-in')
      if (externalTools.length === 0) {
        console.log('⚠️ 无外部工具可用')
        return
      }
      
      // 测试前3个外部工具
      for (let i = 0; i < Math.min(3, externalTools.length); i++) {
        const tool = externalTools[i]
        try {
          const start = Date.now()
          // 对于幂等操作，使用简单的参数
          const parameters = tool.name.includes('time') ? { format: 'iso' } : {}
          
          const result = await mcpService.executeTool({
            tool: tool.name,
            parameters,
            server: tool.server
          })
          
          const duration = Date.now() - start
          
          this.testResults.push({
            testName: `外部工具-${tool.name}`,
            duration,
            success: result.success,
            timestamp: Date.now()
          })
          
          console.log(`✅ 外部工具测试: ${tool.name} ${duration}ms`)
        } catch (error) {
          console.error(`❌ 外部工具测试失败 ${tool.name}:`, error)
          this.testResults.push({
            testName: `外部工具-${tool.name}`,
            duration: 0,
            success: false,
            error: error instanceof Error ? error.message : '未知错误',
            timestamp: Date.now()
          })
        }
      }
    } catch (error) {
      console.error('❌ 外部工具测试失败:', error)
      this.testResults.push({
        testName: '外部工具测试',
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now()
      })
    }
  }

  /**
   * 测试服务器启动性能
   */
  private async testServerStartup(): Promise<void> {
    console.log('🚀 测试服务器启动性能...')
    
    try {
      const serversResult = await mcpService.getServers()
      if (!serversResult.success || !serversResult.data) {
        console.log('⚠️ 无服务器可用')
        return
      }
      
      const stoppedServers = serversResult.data.filter((server: any) => server.status === 'stopped')
      if (stoppedServers.length === 0) {
        console.log('⚠️ 无已停止服务器')
        return
      }
      
      // 测试启动第一个已停止的服务器
      const server = stoppedServers[0]
      try {
        const start = Date.now()
        const result = await mcpService.startServer(server.id)
        const duration = Date.now() - start
        
        this.testResults.push({
          testName: `服务器启动-${server.name}`,
          duration,
          success: result.success,
          timestamp: Date.now()
        })
        
        console.log(`✅ 服务器启动测试: ${server.name} ${duration}ms`)
        
        // 如果启动成功，稍后停止服务器
        if (result.success) {
          setTimeout(async () => {
            try {
              await mcpService.stopServer(server.id)
              console.log(`✅ 服务器已停止: ${server.name}`)
            } catch (error) {
              console.error(`❌ 停止服务器失败 ${server.name}:`, error)
            }
          }, 2000)
        }
      } catch (error) {
        console.error(`❌ 服务器启动测试失败 ${server.name}:`, error)
        this.testResults.push({
          testName: `服务器启动-${server.name}`,
          duration: 0,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error('❌ 服务器启动测试失败:', error)
      this.testResults.push({
        testName: '服务器启动测试',
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: Date.now()
      })
    }
  }

  /**
   * 获取性能测试报告
   */
  getTestReport(): string {
    if (this.testResults.length === 0) {
      return '暂无性能测试数据'
    }
    
    const successfulTests = this.testResults.filter(t => t.success)
    const failedTests = this.testResults.filter(t => !t.success)
    const avgDuration = successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length
    
    let report = '📊 MCP性能测试报告\n\n'
    report += `**测试总数：** ${this.testResults.length}\n`
    report += `**成功：** ${successfulTests.length}\n`
    report += `**失败：** ${failedTests.length}\n`
    report += `**平均耗时：** ${avgDuration.toFixed(2)}ms\n\n`
    
    report += '**详细结果：**\n'
    for (const test of this.testResults) {
      const status = test.success ? '✅' : '❌'
      const duration = test.success ? `${test.duration}ms` : '失败'
      report += `• ${status} ${test.testName}: ${duration}\n`
    }
    
    return report
  }

  /**
   * 清除测试结果
   */
  clearResults(): void {
    this.testResults = []
  }
}

// 单例实例
export const mcpPerformanceTester = new MCPPerformanceTester()