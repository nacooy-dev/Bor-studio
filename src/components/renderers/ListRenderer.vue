<template>
  <div class="list-renderer">
    <div v-html="formattedList" class="enhanced-list" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

interface Props {
  content: string
}

const props = defineProps<Props>()

const formattedList = computed(() => {
  return marked(props.content, {
    breaks: true,
    gfm: true
  })
})
</script>

<style scoped>
.list-renderer {
  @apply my-3;
}

:deep(.enhanced-list ul) {
  @apply space-y-2 pl-6;
}

:deep(.enhanced-list ol) {
  @apply space-y-2 pl-6;
}

:deep(.enhanced-list li) {
  @apply text-gray-700 dark:text-gray-300 leading-relaxed;
  position: relative;
}

:deep(.enhanced-list ul li::before) {
  content: '•';
  @apply text-blue-500 font-bold absolute -left-4;
}

:deep(.enhanced-list ol li) {
  counter-increment: list-counter;
}

:deep(.enhanced-list ol) {
  counter-reset: list-counter;
}

:deep(.enhanced-list ol li::before) {
  content: counter(list-counter) '.';
  @apply text-blue-500 font-semibold absolute -left-6 w-4 text-right;
}

:deep(.enhanced-list li strong) {
  @apply font-semibold text-gray-900 dark:text-gray-100;
}

:deep(.enhanced-list li a) {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline;
}
</style>