<template>
  <div class="title-bar glass-effect">
    <!-- 拖拽区域 -->
    <div class="drag-region">
      <!-- 应用图标和标题 -->
      <div class="app-info">
        <div class="app-icon">
          <div class="w-6 h-6 bg-gradient-to-br from-primary-blue to-primary-indigo rounded-lg"></div>
        </div>
        <span class="app-title">Bor</span>
      </div>
    </div>

    <!-- 窗口控制按钮 -->
    <div class="window-controls">
      <button @click="minimizeWindow" class="control-btn minimize-btn" title="最小化">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
          <rect x="2" y="5" width="8" height="2" rx="1"/>
        </svg>
      </button>
      
      <button @click="maximizeWindow" class="control-btn maximize-btn" title="最大化">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
          <rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
      
      <button @click="closeWindow" class="control-btn close-btn" title="关闭">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
          <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 窗口控制函数
const minimizeWindow = () => {
  if (window.electronAPI) {
    window.electronAPI.minimizeWindow()
  }
}

const maximizeWindow = () => {
  if (window.electronAPI) {
    window.electronAPI.maximizeWindow()
  }
}

const closeWindow = () => {
  if (window.electronAPI) {
    window.electronAPI.closeWindow()
  }
}
</script>

<style scoped>
.title-bar {
  @apply fixed top-0 left-0 right-0 z-50 flex items-center justify-between;
  height: 40px;
  padding: 0 16px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.dark .title-bar {
  background: rgba(0, 0, 0, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.drag-region {
  @apply flex-1 flex items-center;
  -webkit-app-region: drag;
  height: 100%;
}

.app-info {
  @apply flex items-center gap-2;
}

.app-icon {
  @apply flex items-center justify-center;
}

.app-title {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300;
  user-select: none;
}

.window-controls {
  @apply flex items-center gap-2;
  -webkit-app-region: no-drag;
}

.control-btn {
  @apply w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200;
  @apply hover:bg-gray-200 dark:hover:bg-gray-700;
  @apply text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200;
}

.minimize-btn:hover {
  @apply bg-yellow-100 text-yellow-600;
}

.maximize-btn:hover {
  @apply bg-green-100 text-green-600;
}

.close-btn:hover {
  @apply bg-red-100 text-red-600;
}

/* macOS 风格的控制按钮 */
@media (platform: darwin) {
  .control-btn {
    @apply w-3 h-3 rounded-full;
  }
  
  .minimize-btn {
    @apply bg-yellow-400 hover:bg-yellow-500;
  }
  
  .maximize-btn {
    @apply bg-green-400 hover:bg-green-500;
  }
  
  .close-btn {
    @apply bg-red-400 hover:bg-red-500;
  }
  
  .control-btn svg {
    @apply opacity-0 group-hover:opacity-100;
  }
}

/* 玻璃效果 */
.glass-effect {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.125);
}

.dark .glass-effect {
  background: rgba(17, 25, 40, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.125);
}
</style>