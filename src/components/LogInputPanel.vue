<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { analyzeLogFormat } from '../utils/formatAnalyzer'
import { parseLogFast } from '../utils/simulator'
import { nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
// import type { OperatorConfig } from '../stores/project'

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
const BATCH_SIZE = 500 // 每批处理的日志数量 (提速：减少UI更新频率)
const UPDATE_INTERVAL = 100 // 每处理多少条更新一次 UI
const showLivePreview = ref(true)

// 导入进度相关
const importProgress = ref({
  isImporting: false,
  percentage: 0,
  loaded: 0,
  total: 0,
  mode: 'replace' as 'replace' | 'append' // replace 替换, append 追加
})

// 导入完成状态
const importCompleted = ref({
  show: false,
  success: false,
  message: '',
  lines: 0,
  fileName: ''
})

const formatLabelMap: Record<string, string> = {
  json: 'JSON',
  xml: 'XML',
  csv: 'CSV',
  kv: 'KeyValue',
  syslog: 'Syslog',
  nginx: 'Nginx / Web',
  plain: '纯文本',
}

// 大文件阈值（10MB）
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024
// 大文件预览行数
const LARGE_FILE_PREVIEW_LINES = 1000

// 触发文件选择（替换模式）
function triggerFileInput() {
  importProgress.value.mode = 'replace'
  fileInput.value?.click()
}

// 触发文件选择（追加模式）
function triggerAppendFileInput() {
  importProgress.value.mode = 'append'
  fileInput.value?.click()
}

// 处理文件导入 - 支持大文件分块读取 + 进度条 + 追加导入
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
  
  // 如果是追加模式且已有内容，询问确认
  if (importProgress.value.mode === 'append' && store.project.rawLog.length > 0) {
    const currentLines = store.project.rawLog.split('\n').filter(l => l.trim()).length
    try {
      await ElMessageBox.confirm(
        `当前已有 ${currentLines} 行日志，确定要追加导入 ${formatFileSize(file.size)} 的文件吗？`,
        '追加导入确认',
        {
          confirmButtonText: '确认追加',
          cancelButtonText: '取消',
          type: 'info',
        }
      )
    } catch {
      // 用户取消
      if (fileInput.value) fileInput.value.value = ''
      return
    }
  }
  
  importProgress.value.isImporting = true
  importProgress.value.percentage = 0
  importProgress.value.loaded = 0
  importProgress.value.total = file.size
  
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
        // 分批读取大文件（带进度）
        text = await readLargeFileWithProgress(file)
      } else {
        // 仅读取前 N 行（带进度）
        text = await readFileHeadLinesWithProgress(file, LARGE_FILE_PREVIEW_LINES)
      }
    } else {
      // 小文件直接读取（带进度）
      text = await readFileAsTextWithProgress(file)
    }
    
    // 根据模式处理：替换或追加
    const lineCount = text.split('\n').filter(l => l.trim()).length
    if (importProgress.value.mode === 'append' && store.project.rawLog) {
      store.project.rawLog = store.project.rawLog + '\n' + text
      importCompleted.value = {
        show: true,
        success: true,
        message: `已追加导入: ${file.name}`,
        lines: lineCount,
        fileName: file.name
      }
    } else {
      store.project.rawLog = text
      // 清空之前的解析结果
      parsedResults.value = []
      store.batchResults = []
      importCompleted.value = {
        show: true,
        success: true,
        message: `已导入文件: ${file.name}`,
        lines: lineCount,
        fileName: file.name
      }
    }
    
    // 3秒后自动隐藏完成提示
    setTimeout(() => {
      importCompleted.value.show = false
    }, 3000)
    
    ElMessage.success(`${importCompleted.value.message} (${formatFileSize(file.size)}, ${lineCount} 行)`)
  } catch (error) {
    if ((error as Error).message !== '用户取消') {
      console.error('文件读取失败:', error)
      importCompleted.value = {
        show: true,
        success: false,
        message: '导入失败: ' + ((error as Error).message || '未知错误'),
        lines: 0,
        fileName: file.name
      }
      ElMessage.error(importCompleted.value.message)
      setTimeout(() => {
        importCompleted.value.show = false
      }, 5000)
    }
  } finally {
    importProgress.value.isImporting = false
    importProgress.value.percentage = 0
    // 清空 input 值，允许重复选择同一文件
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

// 读取文件为文本（小文件）- 带进度
function readFileAsTextWithProgress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    // 进度事件 - 使用 requestAnimationFrame 确保 UI 更新
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100)
        importProgress.value.loaded = e.loaded
        importProgress.value.percentage = percentage
        // 强制触发 UI 更新
        nextTick()
      }
    }
    
    reader.onload = (e) => {
      importProgress.value.percentage = 100
      resolve(String(e.target?.result || ''))
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

// 分批读取大文件 - 带进度（优化版）
async function readLargeFileWithProgress(file: File): Promise<string> {
  const chunkSize = 2 * 1024 * 1024 // 2MB 每块（增大块大小减少迭代次数）
  const totalChunks = Math.ceil(file.size / chunkSize)
  const chunks: string[] = new Array(totalChunks) // 预分配数组
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)
    
    chunks[i] = await readFileAsText(chunk)
    
    // 更新进度
    const loaded = Math.min(end, file.size)
    importProgress.value.loaded = loaded
    importProgress.value.percentage = Math.round((loaded / file.size) * 100)
    
    // 每 5 个块让出一次主线程，并强制 UI 更新
    if (i % 5 === 0) {
      await nextTick()
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
  }
  
  importProgress.value.percentage = 100
  return chunks.join('')
}

// 读取文件前 N 行 - 带进度（优化版）
async function readFileHeadLinesWithProgress(file: File, maxLines: number): Promise<string> {
  const chunkSize = 256 * 1024 // 256KB 每块（增大块大小）
  const lines: string[] = []
  let lineCount = 0
  let position = 0
  
  while (position < file.size && lineCount < maxLines) {
    const chunk = file.slice(position, position + chunkSize)
    const text = await readFileAsText(chunk)
    
    const chunkLines = text.split('\n')
    
    for (const line of chunkLines) {
      if (lineCount >= maxLines) break
      lines.push(line)
      lineCount++
    }
    
    position += chunkSize
    
    // 更新进度（每 2 次迭代更新一次）
    if (position % (chunkSize * 2) === 0 || position >= file.size || lineCount >= maxLines) {
      importProgress.value.loaded = Math.min(position, file.size)
      importProgress.value.percentage = Math.round((Math.min(position, file.size) / file.size) * 100)
      await nextTick()
    }
  }
  
  importProgress.value.percentage = 100
  return lines.join('\n')
}

// 基础读取函数（供内部使用）
function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(String(e.target?.result || ''))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
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
    
    // 阶段2：分批处理日志 - 使用更大的批次提升性能
    ElMessage.info(`开始解析 ${totalLogs} 条日志...`)
    
    // 优化：一次性处理更大批次，减少UI更新频率
    const CHUNK_SIZE = Math.min(BATCH_SIZE, Math.max(100, Math.floor(totalLogs / 20)))
    
    for (let i = 0; i < totalLogs; i += CHUNK_SIZE) {
      // 检查是否取消
      if (signal.aborted) return
      
      // 处理暂停
      while (isPaused.value && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (signal.aborted) return
      
      // 处理当前批次
      const endIdx = Math.min(i + CHUNK_SIZE, totalLogs)
      let batchSuccess = 0
      let batchError = 0
      
      // 使用高性能版本解析，避免记录中间步骤
      const batchResults: Record<string, unknown>[] = []
      for (let j = i; j < endIdx; j++) {
        const log = logsToParse[j]
        try {
          const parsed = parseLogFast(log, rulesWithoutMultiline)
          if (parsed && Object.keys(parsed).length > 1) { // 确保解析到了字段（不只是 raw_message）
            parsed._log_number = j + 1
            parsed._raw = log
            batchResults.push(parsed)
            batchSuccess++
          } else {
            batchError++
          }
        } catch {
          batchError++
        }
      }
      
      // 批量添加结果（比逐条 push 更高效）
      if (batchResults.length > 0) {
        results.push(...batchResults)
      }
      
      progress.value.successCount += batchSuccess
      progress.value.errorCount += batchError
      
      // 实时更新预览（降低频率，每5次更新一次）
      if (showLivePreview.value && (i / CHUNK_SIZE) % 5 === 0) {
        store.batchResults = results.slice(-1000) // 只保留最近1000条用于预览
      }
      
      // 更新进度（每批次结束后只让出一次主线程）
      updateProgress(endIdx, totalLogs, progress.value.startTime)
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
    
    // 最终结果更新 - 使用渐进式更新避免卡页面
    const BATCH_UPDATE_SIZE = 5000
    parsedResults.value = []
    store.batchResults = []
    
    for (let i = 0; i < results.length; i += BATCH_UPDATE_SIZE) {
      const batch = results.slice(i, i + BATCH_UPDATE_SIZE)
      parsedResults.value.push(...batch)
      store.batchResults = parsedResults.value.slice()
      await new Promise(resolve => setTimeout(resolve, 10)) // 让出主线程
    }
    
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
        
        <el-dropdown>
          <el-button size="small" :loading="importProgress.isImporting">
            <el-icon><FolderOpened /></el-icon>
            {{ importProgress.isImporting ? '导入中...' : '导入' }}
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="triggerFileInput">
                <el-icon><Document /></el-icon>
                替换导入
              </el-dropdown-item>
              <el-dropdown-item @click="triggerAppendFileInput" :disabled="!store.project.rawLog">
                <el-icon><Plus /></el-icon>
                追加导入
                <el-tag v-if="store.project.rawLog" size="small" type="info" style="margin-left: 8px;">
                  {{ store.project.rawLog.split('\n').filter(l => l.trim()).length }} 行
                </el-tag>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        
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
    
    <!-- 导入进度条 -->
    <div v-if="importProgress.isImporting" class="progress-section import-progress">
      <div class="progress-header">
        <span class="progress-title">
          <el-icon><Upload /></el-icon>
          {{ importProgress.mode === 'append' ? '正在追加导入...' : '正在导入...' }}
        </span>
        <span class="progress-stats">
          {{ formatFileSize(importProgress.loaded) }} / {{ formatFileSize(importProgress.total) }}
        </span>
      </div>
      <el-progress 
        :percentage="importProgress.percentage" 
        :stroke-width="12"
        status="success"
      />
      <div class="progress-details">
        <span>文件大小: {{ formatFileSize(importProgress.total) }}</span>
        <span>已读取: {{ formatFileSize(importProgress.loaded) }}</span>
        <span v-if="importProgress.mode === 'append'">
          追加模式：将在现有 {{ store.project.rawLog.split('\n').filter(l => l.trim()).length }} 行后添加
        </span>
      </div>
    </div>
    
    <!-- 导入完成提示 -->
    <transition name="fade">
      <div v-if="importCompleted.show && !importProgress.isImporting" 
           :class="['import-complete-toast', importCompleted.success ? 'success' : 'error']">
        <div class="toast-content">
          <el-icon :size="24" class="toast-icon">
            <component :is="importCompleted.success ? 'CircleCheck' : 'CircleClose'" />
          </el-icon>
          <div class="toast-info">
            <div class="toast-title">{{ importCompleted.message }}</div>
            <div v-if="importCompleted.success" class="toast-detail">
              <el-tag size="small" type="success" effect="plain">
                {{ importCompleted.lines.toLocaleString() }} 行日志
              </el-tag>
              <el-tag size="small" type="info" effect="plain" style="margin-left: 8px;">
                {{ formatFileSize(importProgress.total) }}
              </el-tag>
            </div>
          </div>
          <el-button 
            v-if="importCompleted.success"
            type="primary" 
            size="small" 
            @click="parseMultilineLogs"
            :disabled="isProcessing"
          >
            <el-icon><Connection /></el-icon>
            立即解析
          </el-button>
        </div>
      </div>
    </transition>
    
    <!-- 解析进度条 -->
    <div v-if="isProcessing" class="progress-section parsing-progress">
      <div class="progress-header">
        <span class="progress-title">
          <el-icon v-if="isPaused" class="paused-icon" color="#e6a23c"><VideoPause /></el-icon>
          <el-icon v-else color="#409eff"><Loading /></el-icon>
          {{ isPaused ? '已暂停' : '正在批量解析...' }}
        </span>
        <span class="progress-stats">
          {{ progress.current }} / {{ progress.total }} 条 ({{ progress.percentage }}%)
        </span>
      </div>
      <el-progress 
        :percentage="progress.percentage" 
        :stroke-width="16"
        :status="isPaused ? 'warning' : undefined"
        :indeterminate="progress.percentage < 100 && !isPaused"
      />
      <div class="progress-details">
        <el-tag size="small" type="success" effect="plain">
          <el-icon><Check /></el-icon> 成功: {{ progress.successCount }}
        </el-tag>
        <el-tag v-if="progress.errorCount > 0" size="small" type="danger" effect="plain">
          <el-icon><Close /></el-icon> 失败: {{ progress.errorCount }}
        </el-tag>
        <span>速度: <strong>{{ (progress.current / (progress.elapsedTime / 1000 || 1)).toFixed(0) }}</strong> 条/秒</span>
        <span>已用时: <strong>{{ (progress.elapsedTime / 1000).toFixed(1) }}</strong>s</span>
        <span v-if="progress.estimatedTimeRemaining > 0">
          预计剩余: <strong>{{ progress.estimatedTimeRemaining.toFixed(1) }}</strong>s
        </span>
      </div>
    </div>
    
    <el-input
      v-model="store.project.rawLog"
      type="textarea"
      :rows="10"
      placeholder="在此粘贴原始日志，或点击【导入】按钮选择日志文件...&#10;支持多行日志，每行将被独立解析"
      class="log-textarea"
    />
    
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

/* 解析进度条特殊样式 */
.parsing-progress {
  background: linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%);
  border: 1px solid #91d5ff;
}

.parsing-progress .progress-title {
  color: #1890ff;
}

/* 导入进度条特殊样式 */
.import-progress {
  background: linear-gradient(135deg, #f6ffed 0%, #e6ffdf 100%);
  border: 1px solid #b7eb8f;
}

.import-progress .progress-title {
  color: #52c41a;
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

/* 导入完成提示条 */
.import-complete-toast {
  margin: 12px 0;
  padding: 16px;
  border-radius: 12px;
  animation: slideInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.import-complete-toast.success {
  background: linear-gradient(135deg, #f6ffed 0%, #e6ffdf 100%);
  border: 1px solid #b7eb8f;
}

.import-complete-toast.error {
  background: linear-gradient(135deg, #fff2f0 0%, #ffccc7 100%);
  border: 1px solid #ff4d4f;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toast-icon {
  flex-shrink: 0;
}

.import-complete-toast.success .toast-icon {
  color: #52c41a;
  animation: checkmarkPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.import-complete-toast.error .toast-icon {
  color: #ff4d4f;
}

.toast-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  color: #262626;
}

.toast-detail {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes checkmarkPop {
  0% {
    transform: scale(0) rotate(-45deg);
  }
  50% {
    transform: scale(1.2) rotate(0deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}
</style>
