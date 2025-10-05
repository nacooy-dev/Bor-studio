<template>
  <div class="table-renderer">
    <div class="table-container">
      <table class="enhanced-table">
        <thead v-if="tableData.headers.length > 0">
          <tr>
            <th 
              v-for="(header, index) in tableData.headers" 
              :key="index"
              :style="getColumnStyle(index)"
            >
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in tableData.rows" :key="rowIndex">
            <td 
              v-for="(cell, cellIndex) in row" 
              :key="cellIndex"
              :style="getColumnStyle(cellIndex)"
              v-html="formatCell(cell)"
            />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  content: string
}

const props = defineProps<Props>()

// 解析表格数据
const tableData = computed(() => {
  const lines = props.content.split('\n').filter(line => line.trim())
  const headers: string[] = []
  const rows: string[][] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.includes('|')) continue

    const cells = line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '')

    if (i === 0 || headers.length === 0) {
      // 第一行作为表头
      headers.push(...cells)
    } else if (line.includes('---') || line.includes('===')) {
      // 跳过分隔行
      continue
    } else {
      // 数据行
      rows.push(cells)
    }
  }

  return { headers, rows }
})

// 获取列样式
const getColumnStyle = (index: number) => {
  const totalColumns = tableData.value.headers.length
  
  // 根据列数动态调整宽度
  if (totalColumns <= 2) {
    return { width: '50%' }
  } else if (totalColumns === 3) {
    return { width: '33.33%' }
  } else if (totalColumns === 4) {
    return { width: '25%' }
  } else {
    return { width: `${100 / totalColumns}%` }
  }
}

// 格式化单元格内容
const formatCell = (cell: string) => {
  // 处理URL链接
  const urlRegex = /(https?:\/\/[^\s]+)/g
  let formatted = cell.replace(urlRegex, (url) => {
    const domain = url.replace(/^https?:\/\//, '').split('/')[0]
    return `<a href="${url}" target="_blank" class="table-link" title="${url}">${domain}</a>`
  })

  // 处理粗体
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  // 处理斜体
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>')

  return formatted
}
</script>

<style scoped>
.table-renderer {
  @apply my-4;
}

.table-container {
  @apply overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.enhanced-table {
  @apply w-full border-collapse;
  table-layout: fixed;
  min-width: 100%;
}

.enhanced-table th {
  @apply bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.enhanced-table td {
  @apply px-3 py-3 text-sm text-gray-700 dark:text-gray-300;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.5;
}

.enhanced-table tr:hover {
  @apply bg-gray-50 dark:bg-gray-800;
}

.enhanced-table tr:nth-child(even) {
  @apply bg-gray-50 dark:bg-gray-900;
}

:deep(.table-link) {
  @apply text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline;
  font-size: 0.875rem;
  word-break: break-all;
}

:deep(.table-link:hover) {
  @apply no-underline;
}
</style>