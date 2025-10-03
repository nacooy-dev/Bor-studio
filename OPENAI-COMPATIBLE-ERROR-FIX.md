# OpenAI兼容服务错误修复

## 🚨 问题描述

### 错误信息
```
模型: gpt-4o-mini
错误: Unexpected token '<', "<!doctype "... is not valid JSON
```

### 错误分析
这个错误表明API服务器返回的是HTML页面而不是JSON响应，通常原因包括：

1. **API端点URL错误** - 请求的路径不正确
2. **服务未运行** - 目标服务没有启动
3. **认证失败** - API密钥无效或缺失
4. **服务器错误** - 返回404、500等错误页面

## ✅ 修复方案

### 1. 改进错误处理

#### 详细的HTTP错误检查
```typescript
if (!response.ok) {
  const contentType = response.headers.get('content-type')
  let errorMessage = `HTTP ${response.status} ${response.statusText}`
  
  try {
    if (contentType?.includes('application/json')) {
      const errorData = await response.json()
      errorMessage = errorData.error?.message || errorData.message || errorMessage
    } else {
      const errorText = await response.text()
      // 如果返回的是HTML页面，提取有用信息
      if (errorText.includes('<!doctype') || errorText.includes('<html')) {
        errorMessage = `服务器返回HTML页面而不是JSON响应。请检查：
1. API端点URL是否正确 (当前: ${this.baseUrl}/chat/completions)
2. 服务是否正在运行
3. API密钥是否正确配置`
      }
    }
  } catch (parseError) {
    errorMessage = `无法解析错误响应: ${response.status} ${response.statusText}`
  }
  
  throw new Error(errorMessage)
}
```

#### Content-Type验证
```typescript
// 检查响应的Content-Type
const contentType = response.headers.get('content-type')
if (!contentType?.includes('application/json')) {
  throw new Error(`服务器返回了非JSON响应 (Content-Type: ${contentType})。请检查API端点是否正确。`)
}
```

#### JSON解析错误处理
```typescript
try {
  const data = await response.json()
  
  // 检查响应格式是否符合OpenAI API标准
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    throw new Error(`API响应格式不正确。期望包含choices数组，实际收到: ${JSON.stringify(data).slice(0, 200)}`)
  }
  
  return data.choices[0]?.message?.content || ''
} catch (jsonError) {
  if (jsonError instanceof SyntaxError) {
    throw new Error(`无法解析JSON响应。服务器可能返回了HTML页面或其他非JSON内容。`)
  }
  throw jsonError
}
```

### 2. 改进连接检查

#### 添加超时和Content-Type检查
```typescript
async isAvailable(): Promise<boolean> {
  if (!this.isConfigured()) return false

  try {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: this.apiKey ? {
        'Authorization': `Bearer ${this.apiKey}`
      } : {},
      signal: AbortSignal.timeout(10000) // 10秒超时
    })
    
    // 检查响应状态和内容类型
    if (response.ok) {
      const contentType = response.headers.get('content-type')
      return contentType?.includes('application/json') || false
    }
    
    return false
  } catch (error) {
    console.warn(`OpenAI兼容服务连接失败 (${this.baseUrl}):`, error)
    return false
  }
}
```

### 3. 改进模型发现

#### 更健壮的模型获取
```typescript
try {
  const response = await fetch(`${this.baseUrl}/models`, {
    headers: this.apiKey ? {
      'Authorization': `Bearer ${this.apiKey}`
    } : {},
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    console.warn(`无法自动发现模型 (HTTP ${response.status}), 请手动配置模型`)
    return []
  }

  // 检查Content-Type
  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    console.warn(`模型发现端点返回非JSON响应 (Content-Type: ${contentType}), 请手动配置模型`)
    return []
  }

  const data = await response.json()
  
  // 检查响应格式
  if (!data.data || !Array.isArray(data.data)) {
    console.warn('模型发现端点响应格式不正确，请手动配置模型')
    return []
  }
  
  // ... 处理模型数据
} catch (error) {
  if (error instanceof Error && error.name === 'TimeoutError') {
    console.warn('模型发现请求超时，请手动配置模型')
  } else {
    console.warn('自动发现模型失败，请手动配置:', error)
  }
  return []
}
```

## 🛠️ 调试工具

创建了 `test-openai-compatible-debug.html` 调试工具，包含：

### 功能特性
- **连接测试** - 验证服务是否可达
- **模型列表获取** - 测试 `/models` 端点
- **对话测试** - 测试 `/chat/completions` 端点
- **详细诊断** - 显示具体的错误信息和解决建议

### 使用方法
1. 输入你的服务配置（URL、API密钥、模型ID）
2. 点击"测试连接"检查基本连通性
3. 点击"获取模型列表"验证模型端点
4. 点击"测试对话"验证聊天功能

## 🔍 常见问题诊断

### 1. HTML页面错误
**症状**: `Unexpected token '<', "<!doctype "... is not valid JSON`

**原因**: 
- URL路径错误（如访问了根路径而不是API端点）
- 服务返回404错误页面
- 服务器配置问题

**解决方案**:
- 确认URL格式：`http://localhost:8000/v1`
- 检查服务是否在指定端口运行
- 验证API路径是否正确

### 2. 认证错误
**症状**: `HTTP 401 Unauthorized`

**原因**:
- API密钥无效或格式错误
- 服务要求认证但未提供密钥

**解决方案**:
- 检查API密钥格式
- 确认服务是否需要认证
- 验证密钥权限

### 3. 连接超时
**症状**: `TimeoutError` 或连接超时

**原因**:
- 服务响应慢
- 网络连接问题
- 服务未启动

**解决方案**:
- 检查服务状态
- 验证网络连接
- 增加超时时间

### 4. CORS错误
**症状**: `CORS policy` 相关错误

**原因**:
- 服务器未配置CORS
- 浏览器安全限制

**解决方案**:
- 配置服务器CORS设置
- 使用代理或服务器端请求

## 📋 修复检查清单

- [x] 改进HTTP错误处理
- [x] 添加Content-Type验证
- [x] 增强JSON解析错误处理
- [x] 添加请求超时机制
- [x] 改进连接可用性检查
- [x] 优化模型发现逻辑
- [x] 创建调试工具
- [x] 提供详细错误信息
- [x] 添加常见问题解决方案

## 🎯 用户指导

### 配置步骤
1. **确认服务运行**: 确保OpenAI兼容服务正在运行
2. **验证URL格式**: 使用正确的API端点格式
3. **测试连接**: 使用调试工具验证连接
4. **配置认证**: 如需要，正确设置API密钥
5. **手动添加模型**: 如自动发现失败，手动配置模型

### 推荐的URL格式
- **本地服务**: `http://localhost:8000/v1`
- **远程服务**: `https://your-api-server.com/v1`
- **确保包含**: `/v1` 路径后缀

### 模型配置建议
- 优先使用自动发现
- 自动发现失败时手动添加
- 确认模型ID与服务器匹配
- 设置合适的上下文长度

现在用户应该能够更容易地诊断和修复OpenAI兼容服务的连接问题了！