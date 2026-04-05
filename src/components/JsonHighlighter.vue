<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  code: string
}>()

const highlightedCode = computed(() => {
  let json = props.code
  try {
    if (typeof json === 'object') {
      json = JSON.stringify(json, null, 2)
    }
  } catch {
    return escapeHtml(json)
  }
  
  return syntaxHighlight(json)
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function syntaxHighlight(json: string): string {
  // 使用正则表达式进行语法高亮
  let highlighted = escapeHtml(json)
  
  // 字符串（包括键和值）
  highlighted = highlighted.replace(
    /"([^"\\]*(\\.[^"\\]*)*)":/g,
    '<span class="json-key">"$1"</span>:'
  )
  
  highlighted = highlighted.replace(
    /: "([^"\\]*(\\.[^"\\]*)*)"/g,
    ': <span class="json-string">"$1"</span>'
  )
  
  // 数字
  highlighted = highlighted.replace(
    /: (-?\d+\.?\d*)/g,
    ': <span class="json-number">$1</span>'
  )
  
  // 布尔值和 null
  highlighted = highlighted.replace(
    /: (true|false|null)/g,
    ': <span class="json-boolean">$1</span>'
  )
  
  return highlighted
}
</script>

<template>
  <pre class="json-highlighter"><code v-html="highlightedCode"></code></pre>
</template>

<style scoped>
.json-highlighter {
  margin: 0;
  padding: 10px;
  background: #1e1e1e;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: #d4d4d4;
}

:deep(.json-key) {
  color: #9cdcfe;
}

:deep(.json-string) {
  color: #ce9178;
}

:deep(.json-number) {
  color: #b5cea8;
}

:deep(.json-boolean) {
  color: #569cd6;
}
</style>
