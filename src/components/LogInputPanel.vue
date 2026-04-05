<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { analyzeLogFormat } from '../utils/formatAnalyzer'
import { simulateRuleChain } from '../utils/simulator'
import { ElMessage } from 'element-plus'
import type { OperatorConfig } from '../stores/project'

const store = useProjectStore()
const analysis = computed(() => analyzeLogFormat(store.project.rawLog))
const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const parsedResults = ref<Record<string, unknown>[]>([])

const formatLabelMap: Record<string, string> = {
  json: 'JSON',
  xml: 'XML',
  csv: 'CSV',
  kv: 'KeyValue',
  syslog: 'Syslog',
  nginx: 'Nginx / Web',
  plain: '纯文本',
}

// 触发文件选择
function triggerFileInput() {
  fileInput.value?.click()
}

// 处理文件导入
async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  isProcessing.value = true
  
  try {
    const text = await file.text()
    store.project.rawLog = text
    ElMessage.success(`已导入文件: ${file.name} (${formatFileSize(file.size)})`)
    
    // 清空之前的解析结果
    parsedResults.value = []
    store.batchResults = []
  } catch (error) {
    ElMessage.error('文件读取失败')
  } finally {
    isProcessing.value = false
    // 清空 input 值，允许重复选择同一文件
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 多行日志批量解析
async function parseMultilineLogs() {
  if (!store.project.rawLog.trim()) {
    ElMessage.warning('请先输入或导入日志内容')
    return
  }
  
  if (store.project.rules.length === 0) {
    ElMessage.warning('请先添加解析规则')
    return
  }
  
  isProcessing.value = true
  
  try {
    // 检查是否有 multiline 规则
    const multilineRule = store.project.rules.find(r => r.name === 'multiline')
    
    let logsToParse: string[] = []
    
    if (multilineRule) {
      // 使用 multiline 规则合并日志
      const pattern = multilineRule.params.pattern as string
      const negate = (multilineRule.params.negate as boolean) || false
      
      if (pattern) {
        const rawLines = store.project.rawLog.split('\n')
        const linePattern = new RegExp(pattern)
        const mergedLogs: string[] = []
        let currentLog = ''
        
        rawLines.forEach((line) => {
          const trimmedLine = line.trim()
          if (!trimmedLine) return
          
          const isNewLog = negate ? !linePattern.test(trimmedLine) : linePattern.test(trimmedLine)
          
          if (isNewLog) {
            // 新日志开始
            if (currentLog) {
              mergedLogs.push(currentLog.trim())
            }
            currentLog = trimmedLine
          } else {
            // 续行
            currentLog += '\n' + trimmedLine
          }
        })
        
        // 添加最后一条
        if (currentLog) {
          mergedLogs.push(currentLog.trim())
        }
        
        logsToParse = mergedLogs
      } else {
        // 没有 pattern，按行分割
        logsToParse = store.project.rawLog.split('\n').filter(l => l.trim())
      }
    } else {
      // 没有 multiline 规则，按行分割
      logsToParse = store.project.rawLog
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
    }
    
    if (logsToParse.length === 0) {
      ElMessage.warning('没有有效的日志')
      return
    }
    
    // 对每条日志应用规则链（使用 simulator 确保与预览一致）
    const results: Record<string, unknown>[] = []
    
    for (let i = 0; i < logsToParse.length; i++) {
      const log = logsToParse[i]
      
      // 使用 simulateRuleChain 确保与实时预览结果一致
      // multiline 规则已经在上面处理过了，这里需要跳过
      const rulesWithoutMultiline = store.project.rules.filter(r => r.name !== 'multiline')
      const simulationResult = simulateRuleChain(log, rulesWithoutMultiline)
      
      if (simulationResult) {
        results.push({
          ...simulationResult.finalOutput,
          _log_number: i + 1,
          _raw: log,
        })
      }
    }
    
    parsedResults.value = results
    
    // 将批量解析结果存入 store，供 PreviewPanel 展示
    store.batchResults = results
    
    ElMessage.success(`成功解析 ${results.length} 条日志`)
  } catch (error) {
    ElMessage.error('批量解析失败: ' + (error instanceof Error ? error.message : '未知错误'))
  } finally {
    isProcessing.value = false
  }
}

// 应用单条规则
async function applyRule(
  rule: OperatorConfig,
  data: Record<string, unknown>,
  rawLine: string
): Promise<Record<string, unknown>> {
  const result = { ...data }
  const params = rule.params
  
  switch (rule.name) {
    case 'regex':
    case 'grok': {
      const pattern = params.pattern as string
      if (!pattern) return result
      
      // 简化版正则应用（实际应该调用 simulator）
      const regex = new RegExp(pattern)
      const match = regex.exec(rawLine)
      if (match && match.groups) {
        Object.entries(match.groups).forEach(([key, value]) => {
          if (value !== undefined) {
            result[key] = value
          }
        })
      }
      break
    }
    
    case 'json': {
      try {
        const parsed = JSON.parse(rawLine)
        const jsonpath = params.jsonpath as Record<string, string> | undefined
        if (jsonpath) {
          Object.entries(jsonpath).forEach(([fieldName, path]) => {
            result[fieldName] = getValueByPath(parsed, path as string)
          })
        } else {
          Object.assign(result, parsed)
        }
      } catch {
        // JSON 解析失败，保持原数据
      }
      break
    }
    
    case 'csv': {
      const delimiter = (params.delimiter as string) || ','
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const values = rawLine.split(delimiter)
      fields.forEach((field, index) => {
        if (values[index] !== undefined) {
          result[field] = values[index].trim()
        }
      })
      break
    }
    
    case 'timestamp': {
      const sourceField = params.source_field as string
      const value = result[sourceField]
      if (value) {
        result['_parsed_timestamp'] = value
      }
      break
    }
    
    case 'to_number': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      const type = (params.type as string) || 'int'
      fields.forEach(field => {
        if (result[field] !== undefined) {
          const numValue = type === 'int' 
            ? parseInt(String(result[field]), 10)
            : parseFloat(String(result[field]))
          if (!isNaN(numValue)) {
            result[field] = numValue
          }
        }
      })
      break
    }
    
    case 'remove': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      fields.forEach(field => {
        delete result[field]
      })
      break
    }
    
    case 'trim': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      if (fields.length === 0) {
        Object.keys(result).forEach(key => {
          if (typeof result[key] === 'string') {
            result[key] = String(result[key]).trim()
          }
        })
      } else {
        fields.forEach(field => {
          if (typeof result[field] === 'string') {
            result[field] = String(result[field]).trim()
          }
        })
      }
      break
    }
    
    case 'lowercase': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      fields.forEach(field => {
        if (typeof result[field] === 'string') {
          result[field] = String(result[field]).toLowerCase()
        }
      })
      break
    }
    
    case 'uppercase': {
      const fields = (params.fields as string)?.split(',').map(f => f.trim()) || []
      fields.forEach(field => {
        if (typeof result[field] === 'string') {
          result[field] = String(result[field]).toUpperCase()
        }
      })
      break
    }
    
    case 'ua_parse': {
      const sourceField = params.source_field as string
      const ua = String(result[sourceField] || '')
      
      let os = 'Unknown'
      let browser = 'Unknown'
      let device = 'Desktop'
      
      if (ua.includes('Windows')) os = 'Windows'
      else if (ua.includes('Mac')) os = 'macOS'
      else if (ua.includes('Linux')) os = 'Linux'
      else if (ua.includes('Android')) { os = 'Android'; device = 'Mobile' }
      else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; device = 'Mobile' }
      
      if (ua.includes('Chrome')) browser = 'Chrome'
      else if (ua.includes('Safari')) browser = 'Safari'
      else if (ua.includes('Firefox')) browser = 'Firefox'
      else if (ua.includes('Edge')) browser = 'Edge'
      
      if (ua.includes('Mobile')) device = 'Mobile'
      
      result['os'] = os
      result['browser'] = browser
      result['device'] = device
      break
    }
    
    case 'geo': {
      const prefix = (params.target_prefix as string) || 'geo_'
      result[`${prefix}country`] = 'CN'
      result[`${prefix}city`] = 'Beijing'
      break
    }
  }
  
  return result
}

// 根据路径获取对象值
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || !obj) return undefined
  const cleanPath = path.replace(/^\$\.?/, '').replace(/\['?(\w+)'?\]/g, '.$1')
  const keys = cleanPath.split('.').filter(Boolean)
  
  let result: unknown = obj
  for (const key of keys) {
    if (result === null || result === undefined) return undefined
    if (typeof result !== 'object') return undefined
    result = (result as Record<string, unknown>)[key]
  }
  return result
}

// 导出解析结果
function exportParsedResults() {
  if (parsedResults.value.length === 0) {
    ElMessage.warning('请先执行批量解析')
    return
  }
  
  const dataStr = JSON.stringify(parsedResults.value, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `parsed_logs_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  ElMessage.success(`已导出 ${parsedResults.value.length} 条解析结果`)
}

// 导出为 CSV
function exportAsCsv() {
  if (parsedResults.value.length === 0) {
    ElMessage.warning('请先执行批量解析')
    return
  }
  
  // 获取所有字段
  const allFields = new Set<string>()
  parsedResults.value.forEach(row => {
    Object.keys(row).forEach(key => allFields.add(key))
  })
  
  const fields = Array.from(allFields)
  
  // 构建 CSV
  const rows: string[] = []
  rows.push(fields.join(','))
  
  parsedResults.value.forEach(row => {
    const values = fields.map(field => {
      const value = row[field]
      if (value === undefined || value === null) return ''
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
      // 处理包含逗号或引号的值
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    rows.push(values.join(','))
  })
  
  const csvContent = '\uFEFF' + rows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `parsed_logs_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  ElMessage.success(`已导出 ${parsedResults.value.length} 条解析结果为 CSV`)
}
</script>

<template>
  <div class="log-input-panel">
    <div class="panel-header">
      <h3 class="title">
        <el-icon><Document /></el-icon>
        原始日志
      </h3>
      <div class="header-actions">
        <!-- 隐藏的文件输入 -->
        <input
          ref="fileInput"
          type="file"
          accept=".txt,.log,.json,.csv"
          style="display: none"
          @change="handleFileImport"
        />
        
        <el-tooltip content="导入日志文件">
          <el-button size="small" :loading="isProcessing" @click="triggerFileInput">
            <el-icon><FolderOpened /></el-icon>
            导入
          </el-button>
        </el-tooltip>
        
        <el-tooltip content="批量解析多行日志">
          <el-button 
            size="small" 
            type="primary"
            :loading="isProcessing" 
            @click="parseMultilineLogs"
            :disabled="!store.project.rawLog.trim() || store.project.rules.length === 0"
          >
            <el-icon><Connection /></el-icon>
            批量解析
          </el-button>
        </el-tooltip>
        
        <el-dropdown v-if="parsedResults.length > 0">
          <el-button size="small" type="success">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="exportParsedResults">
                导出为 JSON ({{ parsedResults.length }} 条)
              </el-dropdown-item>
              <el-dropdown-item @click="exportAsCsv">
                导出为 CSV ({{ parsedResults.length }} 条)
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        
        <el-button size="small" @click="store.project.rawLog = ''">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>
    
    <el-input
      v-model="store.project.rawLog"
      type="textarea"
      :rows="10"
      placeholder="在此粘贴原始日志，或点击【导入】按钮选择日志文件...&#10;支持多行日志，每行将被独立解析"
      class="log-textarea"
    />
    
    <div v-if="store.project.rawLog.trim()" class="analysis-bar">
      <el-tag :type="analysis.confidence > 0.8 ? 'success' : 'warning'">
        检测格式: {{ formatLabelMap[analysis.format] ?? analysis.format }}
      </el-tag>
      <span class="reason">{{ analysis.reasons.join('；') }}</span>
      <el-tag type="info" size="small">
        {{ store.project.rawLog.split('\n').filter(l => l.trim()).length }} 行
      </el-tag>
      <el-tag v-if="parsedResults.length > 0" type="success" size="small">
        已解析: {{ parsedResults.length }} 条
      </el-tag>
    </div>
    
    <!-- 解析结果预览 -->
    <div v-if="parsedResults.length > 0" class="preview-section">
      <div class="preview-header">
        <span class="preview-title">解析结果预览</span>
        <el-text type="info" size="small">显示前 5 条</el-text>
      </div>
      <div class="preview-content">
        <pre>{{ JSON.stringify(parsedResults.slice(0, 5), null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-input-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  overflow-y: auto;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.title {
  font-size: 16px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.header-actions {
  display: flex;
  gap: 6px;
}
.log-textarea {
  flex: 1;
  min-height: 150px;
}
.log-textarea :deep(textarea) {
  font-family: monospace;
  font-size: 12px;
  line-height: 1.6;
}
.analysis-bar {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.reason {
  font-size: 12px;
  color: #909399;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-section {
  margin-top: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}
.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}
.preview-content {
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: #1e1e1e;
}
.preview-content pre {
  margin: 0;
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
