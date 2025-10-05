<template>
  <div id="app" class="h-screen w-screen overflow-hidden transparent-app">
    <!-- 主应用内容 - 整个区域可拖拽 -->
    <div class="app-content draggable-area">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
// 无需导入标题栏组件
</script>

<style scoped>
.transparent-app {
  background: transparent;
}

.app-content {
  height: 100vh;
  overflow: hidden;
}

.draggable-area {
  -webkit-app-region: drag;
}

/* 让交互元素不可拖拽 */
:deep(button),
:deep(input),
:deep(textarea),
:deep(select),
:deep(.no-drag) {
  -webkit-app-region: no-drag;
}
</style>