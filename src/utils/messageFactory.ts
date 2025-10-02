import type { Message, MessageMetadata } from '@/types'

export class MessageFactory {
  private static generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9)
  }

  // 创建用户消息
  static createUserMessage(content: string, attachments?: File[]): Message {
    return {
      id: this.generateId(),
      role: 'user',
      content,
      attachments: attachments?.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
      timestamp: Date.now(),
    }
  }

  // 创建助手消息
  static createAssistantMessage(content: string, metadata?: MessageMetadata): Message {
    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      metadata,
      timestamp: Date.now(),
    }
  }

  // 创建系统消息
  static createSystemMessage(content: string): Message {
    return {
      id: this.generateId(),
      role: 'system',
      content,
      timestamp: Date.now(),
    }
  }

  // 创建配置相关消息
  static createConfigMessage(configType: string, action: string): Message {
    const content = this.getConfigMessageContent(configType, action)
    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      metadata: {
        type: 'config',
        configType,
        action,
      },
      timestamp: Date.now(),
    }
  }

  // 创建工作流相关消息
  static createWorkflowMessage(workflowName: string, action: string): Message {
    const content = this.getWorkflowMessageContent(workflowName, action)
    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      metadata: {
        type: 'workflow',
        workflowName,
        action,
      },
      timestamp: Date.now(),
    }
  }

  // 创建工具调用消息
  static createToolCallMessage(toolName: string, args: any, result?: any): Message {
    const content = result 
      ? `✅ 工具 **${toolName}** 执行成功\n\n结果：\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
      : `🔧 正在调用工具 **${toolName}**...`

    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      metadata: {
        type: 'tool-call',
        toolCall: {
          name: toolName,
          args,
          result,
        },
      },
      timestamp: Date.now(),
    }
  }

  private static getConfigMessageContent(configType: string, action: string): string {
    const messages = {
      'llm-settings': {
        'open': '正在打开 LLM 配置页面...\n\n为了保护您的隐私和安全，API 密钥等敏感信息将在专门的安全配置页面中处理。',
        'saved': '✅ LLM 配置已保存成功！\n\n您现在可以开始使用配置的模型进行对话了。',
      },
      'system-settings': {
        'open': '正在打开系统设置页面...',
        'saved': '✅ 系统设置已保存成功！',
      },
    }

    return messages[configType]?.[action] || `正在处理 ${configType} 的 ${action} 操作...`
  }

  private static getWorkflowMessageContent(workflowName: string, action: string): string {
    const messages = {
      'create': `✅ 工作流 **${workflowName}** 创建成功！\n\n您可以说"执行工作流"来运行它，或者说"修改工作流"来调整配置。`,
      'execute': `🚀 正在执行工作流 **${workflowName}**...\n\n请稍候，我会实时向您汇报执行进度。`,
      'completed': `✅ 工作流 **${workflowName}** 执行完成！\n\n所有步骤都已成功完成。`,
      'failed': `❌ 工作流 **${workflowName}** 执行失败\n\n系统已自动回滚，没有产生任何影响。`,
    }

    return messages[action] || `正在处理工作流 ${workflowName} 的 ${action} 操作...`
  }
}

// 消息类型检查工具
export class MessageTypeChecker {
  static isConfigMessage(message: Message): boolean {
    return message.metadata?.type === 'config'
  }

  static isWorkflowMessage(message: Message): boolean {
    return message.metadata?.type === 'workflow'
  }

  static isToolCallMessage(message: Message): boolean {
    return message.metadata?.type === 'tool-call'
  }

  static isStreamingMessage(message: Message, streamingId: string | null): boolean {
    return message.id === streamingId
  }
}