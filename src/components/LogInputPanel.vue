<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { analyzeLogFormat } from '../utils/formatAnalyzer'
import { simulateRuleChain } from '../utils/simulator'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { OperatorConfig } from '../stores/project'

const store = useProjectStore()
const analysis = computed(() => analyzeLogFormat(store.project.rawLog))
const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const isPaused = ref(false)
const parsedResults = ref<Record<string, unknown>[]>([])

// 进度相关
const progress = ref({
  current: 0,
  total: 0,
  percentage: 0,
  startTime: 0,
  elapsedTime: 0,
  estimatedTimeRemaining: 0,
  processedCount: 0,
  successCount: 0,
  errorCount: 0,
})

// 实时预览相关
const BATCH_SIZE = 100 // 每批处理的日志数量
const UPDATE_INTERVAL = 50 // 每处理多少条更新一次 UI
const showLivePreview = ref(true)

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

// 大文件阈值（10MB）
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024
// 大文件预览行数
const LARGE_FILE_PREVIEW_LINES = 1000

// 处理文件导入 - 支持大文件分块读取
async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  // 检查文件大小限制（100MB）
  const MAX_FILE_SIZE = 100 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`文件大小超过 100MB 限制，请选择更小的文件`)
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    return
  }
  
  isProcessing.value = true
  
  try {
    let text: string
    
    if (file.size > LARGE_FILE_THRESHOLD) {
      // 大文件处理：读取前 N 行或分批读取
      const shouldReadAll = await ElMessageBox.confirm(
        `文件大小为 ${formatFileSize(file.size)}，较大。\n\n` +
        `选择「全部读取」将完整导入（可能较慢）\n` +
        `选择「预览模式」仅导入前 ${LARGE_FILE_PREVIEW_LINES} 行用于测试规则`,
        '大文件提示',
        {
          confirmButtonText: '全部读取',
          cancelButtonText: '预览模式',
          type: 'warning',
          distinguishCancelAndClose: true,
        }
      ).then(() => true).catch((action) => {
        if (action === 'cancel') return false
        throw new Error('用户取消')
      })
      
      if (shouldReadAll) {
        // 分批读取大文件
        text = await readLargeFile(file)
      } else {
        // 仅读取前 N 行
        text = await readFileHeadLines(file, LARGE_FILE_PREVIEW_LINES)
      }
    } else {
      // 小文件直接读取
      text = await readFileAsText(file)
    }
    
    store.project.rawLog = text
    ElMessage.success(`已导入文件: ${file.name} (${formatFileSize(file.size)})`)
    
    // 清空之前的解析结果
    parsedResults.value = []
    store.batchResults = []
  } catch (error) {
    if ((error as Error).message !== '用户取消') {
      console.error('文件读取失败:', error)
      ElMessage.error('文件读取失败: ' + ((error as Error).message || '未知错误'))
    }
  } finally {
    isProcessing.value = false
    // 清空 input 值，允许重复选择同一文件
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

// 读取文件为文本（小文件）
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(String(e.target?.result || ''))
    reader.onerror = (e) => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

// 分批读取大文件
async function readLargeFile(file: File): Promise<string> {
  const chunkSize = 1024 * 1024 // 1MB 每块
  const totalChunks = Math.ceil(file.size / chunkSize)
  let result = ''
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)
    
    const text = await readFileAsText(chunk)
    result += text
    
    // 每读取 10MB 让出主线程
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  
  return result
}

// 读取文件前 N 行
async function readFileHeadLines(file: File, maxLines: number): Promise<string> {
  const chunkSize = 64 * 1024 // 64KB 每块
  let result = ''
  let lineCount = 0
  let position = 0
  
  while (position < file.size && lineCount < maxLines) {
    const chunk = file.slice(position, position + chunkSize)
    const text = await readFileAsText(chunk)
    
    const lines = text.split('\n')
    
    for (const line of lines) {
      if (lineCount >= maxLines) break
      result += line + '\n'
      lineCount++
    }
    
    position += chunkSize
    
    // 让出主线程
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  
  return result
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 取消解析的 AbortController
let abortController: AbortController | null = null

// 暂停/恢复解析
function togglePause() {
  isPaused.value = !isPaused.value
}

// 取消解析
function cancelParsing() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  isProcessing.value = false
  isPaused.value = false
  ElMessage.info('已取消解析')
}

// 更新进度信息
function updateProgress(current: number, total: number, startTime: number) {
  const now = Date.now()
  const elapsed = now - startTime
  const rate = current / (elapsed / 1000) // 每秒处理条数
  const remaining = total - current
  const estimatedTimeRemaining = rate > 0 ? remaining / rate : 0
  
  progress.value = {
    current,
    total,
    percentage: Math.round((current / total) * 100),
    startTime,
    elapsedTime: elapsed,
    estimatedTimeRemaining,
    processedCount: current,
    successCount: progress.value.successCount,
    errorCount: progress.value.errorCount,
  }
}

// 多行日志批量解析 - 优化版本（分批处理 + 实时预览）
async function parseMultilineLogs() {
  if (!store.project.rawLog.trim()) {
    ElMessage.warning('请先输入或导入日志内容')
    return
  }
  
  if (store.project.rules.length === 0) {
    ElMessage.warning('请先添加解析规则')
    return
  }
  
  // 创建新的 AbortController
  abortController = new AbortController()
  const signal = abortController.signal
  
  isProcessing.value = true
  isPaused.value = false
  
  // 重置进度
  progress.value = {
    current: 0,
    total: 0,
    percentage: 0,
    startTime: Date.now(),
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    processedCount: 0,
    successCount: 0,
    errorCount: 0,
  }
  
  try {
    // 检查是否有 multiline 规则
    const multilineRule = store.project.rules.find(r => r.name === 'multiline')
    
    let logsToParse: string[] = []
    
    // 阶段1：日志分割（显示进度）
    ElMessage.info('正在预处理日志...')
    
    if (multilineRule) {
      const pattern = multilineRule.params.pattern as string
      const negate = (multilineRule.params.negate as boolean) || false
      
      if (pattern) {
        const rawLines = store.project.rawLog.split('\n')
        const linePattern = new RegExp(pattern)
        const mergedLogs: string[] = []
        let currentLog = ''
        
        for (let i = 0; i < rawLines.length; i++) {
          if (signal.aborted) return
          
          const trimmedLine = rawLines[i].trim()
          if (!trimmedLine) continue
          
          const isNewLog = negate ? !linePattern.test(trimmedLine) : linePattern.test(trimmedLine)
          
          if (isNewLog) {
            if (currentLog) {
              mergedLogs.push(currentLog.trim())
            }
            currentLog = trimmedLine
          } else {
            currentLog += '\n' + trimmedLine
          }
        }
        
        if (currentLog) {
          mergedLogs.push(currentLog.trim())
        }
        
        logsToParse = mergedLogs
      } else {
        logsToParse = store.project.rawLog.split('\n').filter(l => l.trim())
      }
    } else {
      logsToParse = store.project.rawLog
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
    }
    
    if (logsToParse.length === 0) {
      ElMessage.warning('没有有效的日志')
      return
    }
    
    const totalLogs = logsToParse.length
    progress.value.total = totalLogs
    
    // 清空之前的结果
    parsedResults.value = []
    store.batchResults = []
    
    const rulesWithoutMultiline = store.project.rules.filter(r => r.name !== 'multiline')
    const results: Record<string, unknown>[] = []
    
    // 阶段2：分批处理日志
    ElMessage.info(`开始解析 ${totalLogs} 条日志...`)
    
    for (let i = 0; i < totalLogs; i++) {
      // 检查是否取消
      if (signal.aborted) {
        return
      }
      
      // 处理暂停
      while (isPaused.value && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      if (signal.aborted) return
      
      const log = logsToParse[i]
      
      try {
        const simulationResult = simulateRuleChain(log, rulesWithoutMultiline)
        
        if (simulationResult) {
          const parsedData = {
            ...simulationResult.finalOutput,
            _log_number: i + 1,
            _raw: log,
          }
          results.push(parsedData)
          progress.value.successCount++
          
          // 实时更新预览（每 UPDATE_INTERVAL 条更新一次）
          if (showLivePreview.value && (i + 1) % UPDATE_INTERVAL === 0) {
            store.batchResults = [...results]
            await new Promise(resolve => setTimeout(resolve, 0)) // 让出主线程
          }
        }
      } catch (error) {
        progress.value.errorCount++
        console.warn(`解析第 ${i + 1} 条日志失败:`, error)
      }
      
      // 更新进度（每 BATCH_SIZE 条更新一次进度显示）
      if ((i + 1) % BATCH_SIZE === 0 || i === totalLogs - 1) {
        updateProgress(i + 1, totalLogs, progress.value.startTime)
        
        // 让出主线程，避免阻塞 UI
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
    
    // 最终结果更新
    parsedResults.value = results
    store.batchResults = results
    
    const elapsed = (Date.now() - progress.value.startTime) / 1000
    const rate = totalLogs / elapsed
    
    ElMessage.success(
      `成功解析 ${results.length} 条日志，耗时 ${elapsed.toFixed(1)}s，平均 ${rate.toFixed(0)} 条/秒`
    )
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      ElMessage.error('批量解析失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  } finally {
    isProcessing.value = false
    isPaused.value = false
    abortController = null
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
            {{ isProcessing ? '解析中...' : '批量解析' }}
          </el-button>
        </el-tooltip>
        
        <!-- 暂停/恢复按钮 -->
        <el-tooltip :content="isPaused ? '恢复解析' : '暂停解析'">
          <el-button
            v-if="isProcessing"
            size="small"
            @click="togglePause"
          >
            <el-icon>
              <component :is="isPaused ? 'VideoPlay' : 'VideoPause'" />
            </el-icon>
          </el-button>
        </el-tooltip>
        
        <!-- 取消按钮 -->
        <el-tooltip content="取消解析">
          <el-button
            v-if="isProcessing"
            size="small"
            type="danger"
            @click="cancelParsing"
          >
            <el-icon><CircleClose /></el-icon>
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
    
    <!-- 解析进度条 -->
    <div v-if="isProcessing" class="progress-section">
      <div class="progress-header">
        <span class="progress-title">
          <el-icon v-if="isPaused" class="paused-icon"><VideoPause /></el-icon>
          {{ isPaused ? '已暂停' : '正在解析...' }}
        </span>
        <span class="progress-stats">
          {{ progress.current }} / {{ progress.total }} 条 ({{ progress.percentage }}%)
        </span>
      </div>
      <el-progress 
        :percentage="progress.percentage" 
        :stroke-width="12"
        :status="isPaused ? 'exception' : ''"
      />
      <div class="progress-details">
        <span>成功: {{ progress.successCount }}</span>
        <span>失败: {{ progress.errorCount }}</span>
        <span>速度: {{ (progress.current / (progress.elapsedTime / 1000 || 1)).toFixed(0) }} 条/秒</span>
        <span>已用时: {{ (progress.elapsedTime / 1000).toFixed(1) }}s</span>
        <span v-if="progress.estimatedTimeRemaining > 0">
          预计剩余: {{ progress.estimatedTimeRemaining.toFixed(1) }}s
        </span>
      </div>
    </div>
    
    <!-- 实时预览开关 -->
    <div v-if="isProcessing" class="live-preview-toggle">
      <el-checkbox v-model="showLivePreview" size="small">
        实时预览（每 {{ UPDATE_INTERVAL }} 条更新）
      </el-checkbox>
    </div>
    
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

/* 进度条样式 */
.progress-section {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px 16px;
  margin: 12px 0;
  border: 1px solid #e4e7ed;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-title {
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.paused-icon {
  color: #e6a23c;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.progress-stats {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.progress-details {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.progress-details span {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 实时预览开关 */
.live-preview-toggle {
  margin: 8px 0;
  padding: 0 4px;
}
</style>
