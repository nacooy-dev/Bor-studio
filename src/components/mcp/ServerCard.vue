<template>
  <div :class="['server-card', { installed: isInstalled, disabled: server.disabled }]">
    <!-- 服务器头部 -->
    <div class="server-header">
      <div class="server-info">
        <h4 class="server-name">{{ server.name }}</h4>
        <div class="server-meta">
          <span class="category">{{ getCategoryName(server.category) }}</span>
          <span v-if="server.tags.includes('official')" class="official-badge">官方</span>
        </div>
      </div>
      <div class="server-status">
        <div v-if="installationState.status === 'installing'" class="status-installing">
          <i class="icon-loading spinning"></i>
          <span>{{ installationState.progress }}%</span>
        </div>
        <div v-else-if="installationState.status === 'testing'" class="status-testing">
          <i class="icon-test"></i>
          <span>测试中</span>
        </div>
        <div v-else-if="isInstalled" class="status-installed">
          <i class="icon-check"></i>
          <span>已安装</span>
        </div>
        <div v-else-if="installationState.status === 'failed'" class="status-failed">
          <i class="icon-error"></i>
          <span>失败</span>
        </div>
      </div>
    </div>

    <!-- 服务器描述 -->
    <div class="server-description">
      <p>{{ server.description }}</p>
    </div>

    <!-- 标签 -->
    <div class="server-tags">
      <span
        v-for="tag in server.tags.slice(0, 4)"
        :key="tag"
        :class="['tag', getTagClass(tag)]"
      >
        {{ tag }}
      </span>
      <span v-if="server.tags.length > 4" class="tag-more">
        +{{ server.tags.length - 4 }}
      </span>
    </div>

    <!-- 技术信息 -->
    <div class="server-tech">
      <div class="tech-item">
        <i class="icon-command"></i>
        <span>{{ server.command }}</span>
      </div>
      <div v-if="server.requirements" class="tech-item">
        <i class="icon-requirements"></i>
        <span>{{ server.requirements.join(', ') }}</span>
      </div>
    </div>

    <!-- 安装进度 -->
    <div v-if="installationState.status === 'installing'" class="installation-progress">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${installationState.progress || 0}%` }"
        ></div>
      </div>
      <div class="progress-message">{{ installationState.message }}</div>
    </div>

    <!-- 错误信息 -->
    <div v-if="installationState.status === 'failed'" class="installation-error">
      <i class="icon-error"></i>
      <span>{{ installationState.error }}</span>
    </div>

    <!-- 操作按钮 -->
    <div class="server-actions">
      <button
        v-if="!isInstalled && !server.disabled"
        :disabled="installationState.status === 'installing' || installationState.status === 'testing'"
        class="btn btn-primary"
        @click="$emit('install', server)"
      >
        <i v-if="installationState.status === 'installing'" class="icon-loading spinning"></i>
        <i v-else class="icon-download"></i>
        {{ getInstallButtonText() }}
      </button>

      <button
        v-if="isInstalled"
        class="btn btn-secondary"
        @click="$emit('configure', server)"
      >
        <i class="icon-settings"></i>
        配置
      </button>

      <button
        v-if="isInstalled"
        class="btn btn-danger"
        @click="$emit('uninstall', server)"
      >
        <i class="icon-trash"></i>
        卸载
      </button>

      <button
        v-if="server.homepage"
        class="btn btn-link"
        @click="openHomepage"
      >
        <i class="icon-external"></i>
        主页
      </button>
    </div>

    <!-- 禁用遮罩 -->
    <div v-if="server.disabled" class="disabled-overlay">
      <i class="icon-warning"></i>
      <span>此服务器已被禁用</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MCPServerTemplate } from '@/lib/mcp/server-registry'
import type { ServerInstallationState } from '@/lib/mcp/server-marketplace'
import { CATEGORY_NAMES } from '@/lib/mcp/server-registry'

interface Props {
  server: MCPServerTemplate
  installationState: ServerInstallationState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  install: [server: MCPServerTemplate]
  uninstall: [server: MCPServerTemplate]
  configure: [server: MCPServerTemplate]
}>()

// 计算属性
const isInstalled = computed(() => {
  return props.installationState.status === 'installed'
})

// 方法
const getCategoryName = (category: string): string => {
  return CATEGORY_NAMES[category] || category
}

const getTagClass = (tag: string): string => {
  const tagClasses: Record<string, string> = {
    'official': 'tag-official',
    'popular': 'tag-popular',
    'cloud': 'tag-cloud',
    'local': 'tag-local',
    'database': 'tag-database',
    'search': 'tag-search'
  }
  return tagClasses[tag] || 'tag-default'
}

const getInstallButtonText = (): string => {
  switch (props.installationState.status) {
    case 'installing':
      return '安装中...'
    case 'testing':
      return '测试中...'
    case 'failed':
      return '重试安装'
    default:
      return '安装'
  }
}

const openHomepage = () => {
  if (props.server.homepage) {
    window.open(props.server.homepage, '_blank')
  }
}
</script>

<style scoped>
.server-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.server-card:hover {
  border-color: rgba(0, 122, 255, 0.5);
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 122, 255, 0.15);
}

.server-card.installed {
  border-color: rgba(52, 199, 89, 0.5);
  background: rgba(52, 199, 89, 0.05);
}

.server-card.disabled {
  opacity: 0.6;
}

/* 深色模式 */
:deep(.dark) .server-card,
.dark .server-card {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

:deep(.dark) .server-card:hover,
.dark .server-card:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(0, 122, 255, 0.7);
}

:deep(.dark) .server-card.installed,
.dark .server-card.installed {
  background: rgba(52, 199, 89, 0.1);
  border-color: rgba(52, 199, 89, 0.5);
}

.server-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.server-info {
  flex: 1;
}

.server-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

:deep(.dark) .server-name,
.dark .server-name {
  color: rgba(255, 255, 255, 0.9);
}

.server-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category {
  font-size: 12px;
  color: #8e8e93;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

:deep(.dark) .category,
.dark .category {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.official-badge {
  font-size: 10px;
  background: rgba(0, 122, 255, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 10px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.server-status {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-installing {
  color: #007bff;
}

.status-testing {
  color: #ffc107;
}

.status-installed {
  color: #28a745;
}

.status-failed {
  color: #dc3545;
}

.server-description {
  margin-bottom: 15px;
}

.server-description p {
  margin: 0;
  font-size: 14px;
  color: #8e8e93;
  line-height: 1.4;
}

:deep(.dark) .server-description p,
.dark .server-description p {
  color: rgba(255, 255, 255, 0.7);
}

.server-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 15px;
}

.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.tag-default {
  background: #e9ecef;
  color: #495057;
}

.tag-official {
  background: #007bff;
  color: white;
}

.tag-popular {
  background: #28a745;
  color: white;
}

.tag-cloud {
  background: #17a2b8;
  color: white;
}

.tag-local {
  background: #6c757d;
  color: white;
}

.tag-database {
  background: #fd7e14;
  color: white;
}

.tag-search {
  background: #6f42c1;
  color: white;
}

.tag-more {
  background: #f8f9fa;
  color: #6c757d;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
}

.server-tech {
  margin-bottom: 15px;
}

.tech-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.tech-item i {
  width: 12px;
  opacity: 0.7;
}

.installation-progress {
  margin-bottom: 15px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 5px;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.progress-message {
  font-size: 12px;
  color: #666;
}

.installation-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 15px;
}

.server-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-link {
  background: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-link:hover {
  background: #007bff;
  color: white;
}

.disabled-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 图标样式 - 这里使用简单的文本替代，实际项目中应该使用图标字体 */
.icon-loading::before { content: "⟳"; }
.icon-check::before { content: "✓"; }
.icon-error::before { content: "✗"; }
.icon-test::before { content: "🔍"; }
.icon-download::before { content: "⬇"; }
.icon-settings::before { content: "⚙"; }
.icon-trash::before { content: "🗑"; }
.icon-external::before { content: "↗"; }
.icon-command::before { content: "$"; }
.icon-requirements::before { content: "📋"; }
.icon-warning::before { content: "⚠"; }
</style>