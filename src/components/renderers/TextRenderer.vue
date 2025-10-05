<template>
  <div class="text-renderer">
    <div v-html="formattedContent" class="prose prose-sm max-w-none dark:prose-invert" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

interface Props {
  content: string
}

const props = defineProps<Props>()

const formattedContent = computed(() => {
  return marked(props.content, {
    breaks: true,
    gfm: true
  })
})
</script>

<style scoped>
.text-renderer {
  @apply my-2;
}

:deep(.prose) {
  @apply text-gray-900 dark:text-gray-100;
}

:deep(.prose p) {
  @apply mb-3 leading-relaxed;
}

:deep(.prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6) {
  @apply text-gray-900 dark:text-gray-100 font-semibold mb-3 mt-6 first:mt-0;
}

:deep(.prose strong) {
  @apply font-semibold text-gray-900 dark:text-gray-100;
}

:deep(.prose em) {
  @apply italic;
}

:deep(.prose a) {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline;
}
</style>