# 手动模型配置功能

## 功能概述

为了解决 OpenAI 兼容的自定义 LLM 服务器无法自动发现模型的问题，我们添加了手动模型配置功能。

## 实现的功能

### 1. 自动发现 + 手动配置混合模式
- **优先级**: 手动配置的模型 > 自动发现的模型
- **回退机制**: 如果自动发现失败，使用手动配置的模型
- **兼容性**: 支持标准 OpenAI API 和自定义实现

### 2. 手动模型管理
- ✅ **添加模型**: 支持手动添加模型ID、名称、上下文长度
- ✅ **删除模型**: 可以移除不需要的手动配置模型
- ✅ **模型验证**: 添加时检查重复，确保唯一性
- ✅ **配置持久化**: 手动配置会保存到本地存储

### 3. 增强的配置界面
- ✅ **直观的模型列表**: 显示已配置的手动模型
- ✅ **简化的添加流程**: 三个字段即可添加模型
- ✅ **实时反馈**: 添加/删除操作有即时反馈
- ✅ **响应式设计**: 适配移动端和桌面端

## 使用场景

### 场景1: 本地 Ollama 服务
```
服务名称: 本地 Ollama
基础 URL: http://localhost:11434/v1
API 密钥: (留空)
手动模型:
- qwen:7b (通义千问 7B)
- llama2:7b (Llama 2 7B)
- mistral:7b (Mistral 7B)
```

### 场景2: 自定义 LLM 服务
```
服务名称: 公司内部LLM
基础 URL: http://internal-llm.company.com/v1
API 密钥: your-internal-api-key
手动模型:
- company-model-v1 (公司定制模型 V1)
- company-model-v2 (公司定制模型 V2)
```

### 场景3: 第三方兼容服务
```
服务名称: 某云服务商
基础 URL: https://api.provider.com/v1
API 密钥: sk-xxxxx
手动模型:
- provider-gpt-3.5 (提供商GPT-3.5)
- provider-claude (提供商Claude)
```

## 技术实现

### 1. OpenAI 兼容提供商增强
```typescript
class OpenAICompatibleProvider {
  private manualModels: LLMModel[] = []
  
  async getModels(): Promise<LLMModel[]> {
    // 优先返回手动配置的模型
    if (this.manualModels.length > 0) {
      return this.manualModels
    }
    
    // 尝试自动发现
    try {
      return await this.discoverModels()
    } catch {
      return []
    }
  }
  
  addManualModel(model: ModelConfig) { /* ... */ }
  removeManualModel(modelId: string) { /* ... */ }
}
```

### 2. 配置界面组件
```vue
<!-- 手动模型配置区域 -->
<div class="form-group">
  <label>手动配置模型</label>
  
  <!-- 已配置模型列表 -->
  <div class="manual-models-list">
    <div v-for="model in providerConfig.models" class="manual-model-item">
      <div class="model-info">
        <span class="model-name">{{ model.name }}</span>
        <span class="model-id">{{ model.id }}</span>
      </div>
      <button @click="removeManualModel(index)">×</button>
    </div>
  </div>
  
  <!-- 添加新模型表单 -->
  <div class="add-model-form">
    <input v-model="newModel.id" placeholder="模型 ID" />
    <input v-model="newModel.name" placeholder="显示名称" />
    <input v-model="newModel.contextLength" type="number" placeholder="上下文长度" />
    <button @click="addManualModel">+ 添加模型</button>
  </div>
</div>
```

### 3. 配置持久化
```typescript
// 配置保存时包含手动模型
const config = {
  apiKey: 'xxx',
  baseUrl: 'http://localhost:11434/v1',
  name: '本地Ollama',
  models: [
    { id: 'qwen:7b', name: '通义千问 7B', contextLength: 8192 },
    { id: 'llama2:7b', name: 'Llama 2 7B', contextLength: 4096 }
  ]
}
```

## 用户体验改进

### 1. Chatbot UI 风格的配置流程
- **渐进式配置**: 先基础连接，再模型配置
- **智能默认值**: 常用端口和路径的预填充
- **实时验证**: 配置项的即时检查和反馈

### 2. 错误处理和用户指导
- **友好的错误信息**: 明确说明问题和解决方案
- **操作指导**: 提供具体的配置步骤
- **回退方案**: 自动发现失败时的手动配置提示

### 3. 测试和验证功能
- **连接测试**: 验证服务器可达性
- **模型测试**: 实际调用模型进行验证
- **配置预览**: 显示最终的配置结果

## 测试方法

### 1. 使用测试页面
打开 `test-manual-models.html` 进行功能测试：
- 测试连接到本地 Ollama 服务
- 手动添加和删除模型
- 验证模型调用功能

### 2. 在主应用中测试
1. 打开配置页面
2. 选择 "OpenAI 兼容" 提供商
3. 配置服务信息和手动模型
4. 测试模型可用性
5. 在聊天界面中使用配置的模型

## 后续优化计划

### 1. 模型模板功能
- 预设常用模型配置模板
- 一键导入流行的本地模型配置
- 社区共享的模型配置库

### 2. 批量操作
- 批量导入模型配置
- 配置文件的导入/导出
- 模型配置的备份和恢复

### 3. 高级功能
- 模型性能基准测试
- 自动模型推荐
- 使用统计和分析