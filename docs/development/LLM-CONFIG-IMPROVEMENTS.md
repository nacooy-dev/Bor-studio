# LLM 配置面板改进

## 改进内容

### 1. 删除快速设置功能 ✅
- **移除原因**: 功能意义不大，用户更倾向于手动选择和配置
- **影响**: 界面更简洁，用户可以更专注于具体的配置选项

### 2. 增加已配置 LLM 的修改功能 ✅
- **编辑按钮**: 已配置的提供商显示"编辑"按钮而不是"配置"
- **配置回显**: 打开配置对话框时会显示现有的配置信息
- **智能默认值**: 根据不同提供商类型设置合适的默认配置

#### 提供商特定的默认配置
```typescript
switch (providerId) {
  case 'openai':
    defaultConfig.baseUrl = 'https://api.openai.com/v1'
    break
  case 'openrouter':
    defaultConfig.baseUrl = 'https://openrouter.ai/api/v1'
    break
  case 'gemini':
    defaultConfig.baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
    break
  case 'zhipu':
    defaultConfig.baseUrl = 'https://open.bigmodel.cn/api/paas/v4'
    break
  case 'openai-compatible':
    defaultConfig.baseUrl = 'http://localhost:8000/v1'
    defaultConfig.name = '自定义服务'
    break
}
```

### 3. 增加默认模型设置功能 ✅
- **统一模型选择**: 在一个地方查看和选择所有提供商的所有模型
- **当前默认显示**: 清晰显示当前设置的默认模型和提供商
- **分组显示**: 按提供商分组显示模型，便于选择
- **模型测试**: 可以在设置为默认之前测试模型可用性

#### 默认模型设置界面特性
- **当前状态显示**: 显示当前默认模型和提供商
- **分组选择器**: 按提供商分组的模型下拉选择器
- **一键设置**: 选择后立即设置为默认模型
- **测试功能**: 在设置前可以测试模型响应
- **模型信息**: 显示选中模型的详细信息（上下文长度、定价等）

## 用户体验改进

### 1. 更直观的配置流程
```
1. 查看提供商列表 → 看到配置状态
2. 点击"配置"或"编辑" → 打开配置对话框
3. 修改配置信息 → 保存配置
4. 在默认模型设置中 → 选择和测试模型
5. 设置为默认模型 → 开始使用
```

### 2. 配置状态的清晰反馈
- **未配置**: 显示"配置"按钮，状态为"需要配置"
- **已配置但不可用**: 显示"编辑"和"测试"按钮，状态为"连接失败"
- **已配置且可用**: 显示"编辑"和"测试"按钮，状态为"已连接"

### 3. 默认模型管理
- **集中管理**: 所有模型在一个地方统一管理
- **状态同步**: 实时显示当前默认模型状态
- **智能刷新**: 刷新所有提供商的模型列表

## 技术实现细节

### 1. 配置回显逻辑
```typescript
const configureProvider = (providerId: string) => {
  // 获取现有配置
  const provider = llmManager.getProvider(providerId)
  const existingConfig = provider?.getConfig() || {}
  
  // 合并默认配置和现有配置
  Object.assign(providerConfig, {
    ...defaultConfig,
    ...existingConfig  // 现有配置优先
  })
}
```

### 2. 默认模型选择器
```vue
<select v-model="selectedDefaultModel" @change="setDefaultModel">
  <optgroup v-for="provider in availableProvidersWithModels" :label="provider.name">
    <option 
      v-for="model in provider.models"
      :value="`${provider.id}:${model.id}`"
    >
      {{ model.name }}
    </option>
  </optgroup>
</select>
```

### 3. 模型测试功能
```typescript
const testSelectedModel = async () => {
  const [providerId, modelId] = selectedDefaultModel.value.split(':')
  
  // 临时切换提供商进行测试
  await llmManager.setProvider(providerId)
  
  // 发送测试消息
  const response = await llmManager.chat(testMessage, { model: modelId })
  
  // 显示测试结果
  alert(`模型测试成功！响应: ${response}`)
}
```

## 界面布局优化

### 1. 提供商卡片增强
- **编辑按钮**: 橙色的编辑按钮，区别于配置按钮
- **双按钮布局**: 编辑和测试按钮并排显示
- **状态指示**: 更清晰的状态标识

### 2. 默认模型设置区域
- **当前状态卡片**: 突出显示当前默认模型
- **选择器区域**: 分组的模型选择下拉框
- **操作按钮**: 刷新、测试、设置按钮
- **信息展示**: 选中模型的详细信息

### 3. 响应式设计
- **移动端适配**: 按钮和表单在小屏幕上的布局优化
- **触摸友好**: 按钮大小和间距适合触摸操作

## 配置持久化

### 1. 配置存储结构
```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.openai.com/v1"
    },
    "openai-compatible": {
      "name": "本地Ollama",
      "baseUrl": "http://localhost:11434/v1",
      "models": [
        {
          "id": "qwen:7b",
          "name": "通义千问 7B",
          "contextLength": 8192
        }
      ]
    }
  },
  "defaultProvider": "openai-compatible",
  "defaultModel": "qwen:7b"
}
```

### 2. 配置同步
- **实时保存**: 配置修改后立即保存到本地存储
- **状态同步**: 界面状态与配置数据保持同步
- **错误恢复**: 配置加载失败时的默认值处理

## 后续优化计划

### 1. 配置导入导出
- **配置备份**: 支持配置的导出和备份
- **批量导入**: 支持从文件导入配置
- **配置模板**: 提供常用配置的模板

### 2. 高级配置选项
- **连接超时**: 可配置的连接超时时间
- **重试机制**: 失败重试的次数和间隔
- **代理设置**: 支持代理服务器配置

### 3. 使用统计
- **模型使用统计**: 记录各模型的使用频率
- **性能监控**: 监控模型响应时间和成功率
- **智能推荐**: 基于使用习惯推荐最佳模型