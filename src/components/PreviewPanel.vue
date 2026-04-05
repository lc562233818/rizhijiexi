<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import JsonHighlighter from './JsonHighlighter.vue'
import { simulateRuleChain } from '../utils/simulator'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'

const store = useProjectStore()
const fieldSearch = ref('')
const fieldValueSearch = ref('')
const activeSimulationTab = ref('final')
const expandedSteps = ref<number[]>([])

// 模拟执行结果
const simulationResult = computed(() => {
  if (!store.project.rawLog.trim() || store.project.rules.length === 0) {
    return null
  }
  return simulateRuleChain(store.project.rawLog, store.project.rules)
})

// 切换步骤展开/折叠
function toggleStep(step: number) {
  const index = expandedSteps.value.indexOf(step)
  if (index > -1) {
    expandedSteps.value.splice(index, 1)
  } else {
    expandedSteps.value.push(step)
  }
}

// 展开所有步骤
function expandAll() {
  if (simulationResult.value) {
    expandedSteps.value = simulationResult.value.steps.map(s => s.step)
  }
}

// 折叠所有步骤
function collapseAll() {
  expandedSteps.value = []
}

// 复制结构化结果
async function copyStructuredResult() {
  if (!simulationResult.value) return
  try {
    const text = JSON.stringify(simulationResult.value.finalOutput, null, 2)
    await navigator.clipboard.writeText(text)
    ElMessage.success('结构化结果已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

// 复制批量解析结果
async function copyBatchResults() {
  if (store.batchResults.length === 0) {
    ElMessage.warning('没有可复制的批量解析结果')
    return
  }
  try {
    const text = JSON.stringify(store.batchResults, null, 2)
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已复制 ${store.batchResults.length} 条解析结果`)
  } catch {
    ElMessage.error('复制失败')
  }
}

// 清空批量解析结果
function clearBatchResults() {
  store.batchResults = []
  ElMessage.success('已清空批量解析结果')
}

// 导出为 Excel - 横向表格格式（字段作为列，记录作为行）
function exportToExcel() {
  // 使用批量解析结果或实时模拟结果
  const dataToExport = store.batchResults.length > 0 
    ? store.batchResults 
    : (simulationResult.value ? [simulationResult.value.finalOutput] : [])
  
  if (dataToExport.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }
  
  try {
    // 创建工作簿
    const wb = XLSX.utils.book_new()
    
    // 获取所有字段（过滤掉内部字段，如 _raw, _log_number 等）
    const allFields = new Set<string>()
    dataToExport.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!key.startsWith('_')) {
          allFields.add(key)
        }
      })
    })
    
    // 字段排序：按照 formattedFieldsList 的顺序，然后追加其他字段
    const orderedFields: string[] = []
    const fieldSet = new Set<string>()
    
    // 先添加预览中的字段（按预览顺序）
    formattedFieldsList.value.forEach((f) => {
      if (!f.name.startsWith('_') && allFields.has(f.name)) {
        orderedFields.push(f.name)
        fieldSet.add(f.name)
      }
    })
    
    // 再添加其他字段
    allFields.forEach((field) => {
      if (!fieldSet.has(field)) {
        orderedFields.push(field)
      }
    })
    
    // 构建数据：第一行是表头（字段名），后面每行是一条记录
    const excelData: (string | number)[][] = []
    
    // 添加表头
    excelData.push(orderedFields)
    
    // 添加数据行
    dataToExport.forEach((row) => {
      const rowData: (string | number)[] = []
      orderedFields.forEach((field) => {
        const value = row[field]
        // 格式化值
        let displayValue: string | number = ''
        if (value === null || value === undefined) {
          displayValue = ''
        } else if (typeof value === 'string') {
          displayValue = value.trim()
        } else if (typeof value === 'object') {
          displayValue = JSON.stringify(value)
        } else if (typeof value === 'number') {
          displayValue = value
        } else {
          displayValue = String(value).trim()
        }
        rowData.push(displayValue)
      })
      excelData.push(rowData)
    })
    
    // 创建工作表
    const ws = XLSX.utils.aoa_to_sheet(excelData)
    
    // 设置列宽（根据字段名长度和内容长度）
    const colWidths = orderedFields.map((field, idx) => {
      let maxWidth = field.length + 2
      dataToExport.forEach((row) => {
        const value = row[field]
        const str = String(value ?? '')
        maxWidth = Math.max(maxWidth, Math.min(str.length + 2, 50))
      })
      return { wch: maxWidth }
    })
    ws['!cols'] = colWidths
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(wb, ws, '解析结果')
    
    // 生成文件名
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `结构化日志_${timestamp}.xlsx`
    
    // 下载文件
    XLSX.writeFile(wb, filename)
    
    ElMessage.success(`已导出 ${dataToExport.length} 条记录，${orderedFields.length} 个字段到 Excel`)
  } catch (error) {
    console.error('Excel 导出失败:', error)
    ElMessage.error('Excel 导出失败')
  }
}

const previewFields = computed(() => {
  const fields: string[] = []
  store.project.rules.forEach((rule) => {
    const params = rule.params
    if (params.fields && typeof params.fields === 'string') {
      // 对于 remove 算子，不添加字段；对于其他算子，添加字段
      if (rule.name !== 'remove') {
        fields.push(...params.fields.split(',').map((s) => s.trim()).filter(Boolean))
      }
    }
    if (params.target_field && typeof params.target_field === 'string') {
      fields.push(params.target_field)
    }
    if (rule.name === 'json' && params.jsonpath && typeof params.jsonpath === 'object') {
      fields.push(...Object.keys(params.jsonpath))
    }
    if (rule.name === 'xml' && params.xpath && typeof params.xpath === 'object') {
      fields.push(...Object.keys(params.xpath))
    }
    if (rule.name === 'rename' && params.mappings && typeof params.mappings === 'object') {
      fields.push(...Object.values(params.mappings as Record<string, string>))
    }
    if (rule.name === 'grok' && params.pattern && typeof params.pattern === 'string') {
      // 从 Grok 模式中提取字段名
      const fieldMatches = (params.pattern as string).matchAll(/%\{[A-Z0-9_]+:(\w+)\}/g)
      for (const match of fieldMatches) {
        fields.push(match[1])
      }
    }
    if (rule.name === 'remove' && params.fields && typeof params.fields === 'string') {
      const toRemove = params.fields.split(',').map((s) => s.trim())
      for (let i = fields.length - 1; i >= 0; i--) {
        if (toRemove.includes(fields[i])) {
          fields.splice(i, 1)
        }
      }
    }
  })
  // dedup preserve order
  return [...new Set(fields)]
})

const filteredFields = computed(() => {
  if (!fieldSearch.value) return previewFields.value
  const search = fieldSearch.value.toLowerCase()
  return previewFields.value.filter(f => f.toLowerCase().includes(search))
})

// 格式化字段值列表
interface FormattedField {
  name: string
  value: unknown
  displayValue: string
  valueType: string
  isNew: boolean
  source: 'original' | 'extracted' | 'transformed' | 'added'
}

const formattedFieldsList = computed<FormattedField[]>(() => {
  if (!simulationResult.value) return []
  
  const finalOutput = simulationResult.value.finalOutput
  const originalInput = simulationResult.value.steps[0]?.input || {}
  
  const fields: FormattedField[] = Object.entries(finalOutput).map(([name, value]) => {
    const valueType = getValueType(value)
    const displayValue = formatValueForDisplay(value)
    const isInOriginal = name in originalInput && name !== 'raw_message'
    const isRawMessage = name === 'raw_message'
    
    let source: FormattedField['source'] = 'added'
    if (isRawMessage) source = 'original'
    else if (isInOriginal) source = 'transformed'
    else if (name.startsWith('_')) source = 'original'
    else source = 'extracted'
    
    return {
      name,
      value,
      displayValue,
      valueType,
      isNew: !isInOriginal && !isRawMessage && !name.startsWith('_'),
      source,
    }
  })
  
  // 搜索过滤
  if (fieldValueSearch.value) {
    const search = fieldValueSearch.value.toLowerCase()
    return fields.filter(f => 
      f.name.toLowerCase().includes(search) || 
      f.displayValue.toLowerCase().includes(search)
    )
  }
  
  return fields
})

function getValueType(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function formatValueForDisplay(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') {
    if (value.length > 100) return value.slice(0, 100) + '...'
    return value
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value)
    if (json.length > 100) return json.slice(0, 100) + '...'
    return json
  }
  return String(value)
}

function getValueTypeTag(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'success',
    number: 'primary',
    boolean: 'warning',
    object: 'info',
    array: 'info',
    null: 'info',
    undefined: 'info',
  }
  return typeMap[type] || 'info'
}

// 生成字段对比数据
const generateCompareData = computed(() => {
  if (!simulationResult.value?.steps.length) return []
  
  const firstStep = simulationResult.value.steps[0]
  const lastStep = simulationResult.value.steps[simulationResult.value.steps.length - 1]
  
  const allFields = new Set([
    ...Object.keys(firstStep.input),
    ...Object.keys(lastStep.output),
  ])
  
  return Array.from(allFields).map(field => {
    const original = firstStep.input[field]
    const final = lastStep.output[field]
    const changed = JSON.stringify(original) !== JSON.stringify(final)
    
    return {
      field,
      original: original === undefined ? '(无)' : JSON.stringify(original).slice(0, 100),
      final: final === undefined ? '(已删除)' : JSON.stringify(final).slice(0, 100),
      changed,
    }
  })
})
</script>

<template>
  <div class="preview-panel">
    <div class="panel-header">
      <h3 class="title">
        <el-icon><View /></el-icon>
        实时预览 - 结构化结果
      </h3>
    </div>

    <!-- 结构化日志模拟执行结果 -->
    <div v-if="simulationResult" class="section simulation-section">
      <div class="section-header">
        <span class="section-title">
          <el-icon><DataLine /></el-icon>
          结构化日志预览
          <el-tag v-if="simulationResult.success" type="success" size="small">成功</el-tag>
          <el-tag v-else type="warning" size="small">有警告</el-tag>
        </span>
        <el-button-group size="small">
          <el-button @click="expandAll">展开全部</el-button>
          <el-button @click="collapseAll">折叠全部</el-button>
          <el-button @click="exportToExcel" type="primary">
            <el-icon><Download /></el-icon> 导出 Excel
          </el-button>
          <el-button @click="copyStructuredResult">
            <el-icon><DocumentCopy /></el-icon>
          </el-button>
        </el-button-group>
      </div>
      
      <!-- 实时格式化字段值展示 -->
      <div class="formatted-fields-panel">
        <div class="panel-subheader">
          <span class="subheader-title">
            <el-icon><List /></el-icon>
            字段值列表 ({{ formattedFieldsList.length }})
          </span>
          <el-input
            v-model="fieldValueSearch"
            placeholder="搜索字段或值"
            size="small"
            clearable
            style="width: 150px"
          />
        </div>
        <div class="fields-table-wrapper">
          <el-table
            :data="formattedFieldsList"
            size="small"
            border
            stripe
            style="width: 100%"
            :max-height="250"
          >
            <el-table-column prop="name" label="字段名" width="140" sortable>
              <template #default="{ row }">
                <div class="field-name-cell">
                  <el-icon v-if="row.isNew" color="#67c23a" class="new-field-icon"><CircleCheck /></el-icon>
                  <span :class="{ 'new-field': row.isNew }">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="value" label="字段值">
              <template #default="{ row }">
                <div class="field-value-cell">
                  <template v-if="row.valueType === 'string'">
                    <span class="string-value">"{{ row.displayValue }}"</span>
                  </template>
                  <template v-else-if="row.valueType === 'number'">
                    <span class="number-value">{{ row.displayValue }}</span>
                  </template>
                  <template v-else-if="row.valueType === 'boolean'">
                    <el-tag size="small" :type="row.value ? 'success' : 'danger'">{{ row.displayValue }}</el-tag>
                  </template>
                  <template v-else-if="row.valueType === 'object'">
                    <el-tooltip :content="row.displayValue" placement="top">
                      <span class="object-value">{{ row.displayValue }}</span>
                    </el-tooltip>
                  </template>
                  <template v-else-if="row.valueType === 'array'">
                    <el-tag size="small" type="info">[{{ row.value?.length || 0 }} items]</el-tag>
                  </template>
                  <template v-else>
                    <span class="null-value">{{ row.displayValue }}</span>
                  </template>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="valueType" label="类型" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="getValueTypeTag(row.valueType)">{{ row.valueType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.source === 'original'" size="small" type="info">原始</el-tag>
                <el-tag v-else-if="row.source === 'extracted'" size="small" type="success">提取</el-tag>
                <el-tag v-else-if="row.source === 'transformed'" size="small" type="warning">转换</el-tag>
                <el-tag v-else size="small">新增</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      
      <el-tabs v-model="activeSimulationTab" class="simulation-tabs">
        <!-- 最终结果 -->
        <el-tab-pane :label="store.batchResults.length > 0 ? `JSON 视图 (${store.batchResults.length}条)` : 'JSON 视图'" name="final">
          <div class="final-result">
            <!-- 有批量解析结果时展示批量结果 -->
            <template v-if="store.batchResults.length > 0">
              <div class="batch-result-header">
                <el-tag type="success" size="small">批量解析结果</el-tag>
                <span class="batch-count">共 {{ store.batchResults.length }} 条记录</span>
                <el-button-group size="small">
                  <el-button @click="exportToExcel" type="primary">
                    <el-icon><Download /></el-icon> 导出 Excel
                  </el-button>
                  <el-button @click="copyBatchResults">
                    <el-icon><DocumentCopy /></el-icon> 复制全部
                  </el-button>
                  <el-button @click="clearBatchResults" type="danger">
                    <el-icon><Delete /></el-icon> 清空
                  </el-button>
                </el-button-group>
              </div>
              <JsonHighlighter :code="JSON.stringify(store.batchResults, null, 2)" />
            </template>
            <!-- 否则展示单条模拟结果 -->
            <template v-else>
              <!-- 字段表格展示 -->
              <div class="single-result-fields">
                <div class="field-table-header">
                  <span class="field-count">共 {{ formattedFieldsList.length }} 个字段</span>
                </div>
                <el-table
                  :data="formattedFieldsList"
                  size="small"
                  border
                  stripe
                  style="width: 100%"
                  :max-height="200"
                >
                  <el-table-column prop="name" label="字段名" width="140" sortable>
                    <template #default="{ row }">
                      <div class="field-name-cell">
                        <el-icon v-if="row.isNew" color="#67c23a" class="new-field-icon"><CircleCheck /></el-icon>
                        <span :class="{ 'new-field': row.isNew }">{{ row.name }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="value" label="字段值">
                    <template #default="{ row }">
                      <div class="field-value-cell-full">
                        <template v-if="row.valueType === 'string'">
                          <span class="string-value">"{{ row.displayValue }}"</span>
                        </template>
                        <template v-else-if="row.valueType === 'number'">
                          <span class="number-value">{{ row.displayValue }}</span>
                        </template>
                        <template v-else-if="row.valueType === 'boolean'">
                          <el-tag size="small" :type="row.value ? 'success' : 'danger'">{{ row.displayValue }}</el-tag>
                        </template>
                        <template v-else-if="row.valueType === 'object'">
                          <el-tooltip :content="row.displayValue" placement="top">
                            <span class="object-value">{{ row.displayValue }}</span>
                          </el-tooltip>
                        </template>
                        <template v-else-if="row.valueType === 'array'">
                          <el-tag size="small" type="info">[{{ row.value?.length || 0 }} items]</el-tag>
                        </template>
                        <template v-else>
                          <span class="null-value">{{ row.displayValue }}</span>
                        </template>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="valueType" label="类型" width="80">
                    <template #default="{ row }">
                      <el-tag size="small" :type="getValueTypeTag(row.valueType)">{{ row.valueType }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="source" label="来源" width="100">
                    <template #default="{ row }">
                      <el-tag v-if="row.source === 'original'" size="small" type="info">原始</el-tag>
                      <el-tag v-else-if="row.source === 'extracted'" size="small" type="success">提取</el-tag>
                      <el-tag v-else-if="row.source === 'transformed'" size="small" type="warning">转换</el-tag>
                      <el-tag v-else size="small">新增</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <!-- JSON 原始格式 -->
              <div class="json-raw-section">
                <div class="json-section-title">JSON 原始格式</div>
                <JsonHighlighter :code="JSON.stringify(simulationResult.finalOutput, null, 2)" />
              </div>
            </template>
          </div>
        </el-tab-pane>
        
        <!-- 执行步骤 -->
        <el-tab-pane :label="`执行步骤 (${simulationResult.steps.length})`" name="steps">
          <div class="steps-container">
            <el-timeline>
              <el-timeline-item
                v-for="step in simulationResult.steps"
                :key="step.step"
                :type="step.errors?.length ? 'warning' : 'primary'"
                :icon="step.errors?.length ? 'Warning' : 'CircleCheck'"
              >
                <div class="step-header" @click="toggleStep(step.step)">
                  <span class="step-title">
                    {{ step.step }}. {{ step.operatorLabel }}
                    <el-tag size="small" type="info">{{ step.operator }}</el-tag>
                  </span>
                  <el-icon class="step-toggle-icon">
                    <ArrowDown v-if="expandedSteps.includes(step.step)" />
                    <ArrowRight v-else />
                  </el-icon>
                </div>
                
                <div v-show="expandedSteps.includes(step.step)" class="step-detail">
                  <!-- 变化列表 -->
                  <div v-if="step.changes.length > 0" class="step-changes">
                    <div class="detail-label">字段变化:</div>
                    <ul>
                      <li v-for="(change, idx) in step.changes" :key="idx" class="change-item">
                        <el-icon color="#67c23a"><Plus /></el-icon>
                        {{ change }}
                      </li>
                    </ul>
                  </div>
                  
                  <!-- 错误信息 -->
                  <div v-if="step.errors?.length" class="step-errors">
                    <div class="detail-label" style="color: #f56c6c;">错误:</div>
                    <ul>
                      <li v-for="(error, idx) in step.errors" :key="idx" class="error-item">
                        <el-icon color="#f56c6c"><Warning /></el-icon>
                        {{ error }}
                      </li>
                    </ul>
                  </div>
                  
                  <!-- 输入输出对比 -->
                  <div class="io-comparison">
                    <div class="io-box">
                      <div class="io-label">输入</div>
                      <pre class="io-content">{{ JSON.stringify(step.input, null, 2) }}</pre>
                    </div>
                    <div class="io-arrow">
                      <el-icon><ArrowRight /></el-icon>
                    </div>
                    <div class="io-box">
                      <div class="io-label">输出</div>
                      <pre class="io-content">{{ JSON.stringify(step.output, null, 2) }}</pre>
                    </div>
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-tab-pane>
        
        <!-- 字段对比 -->
        <el-tab-pane label="字段对比" name="compare">
          <div class="compare-container">
            <el-table :data="generateCompareData" size="small" border>
              <el-table-column prop="field" label="字段名" width="150" />
              <el-table-column prop="original" label="原始值">
                <template #default="{ row }">
                  <span class="value-cell original">{{ row.original }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="final" label="最终值">
                <template #default="{ row }">
                  <span class="value-cell final">{{ row.final }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="changed" label="状态" width="80">
                <template #default="{ row }">
                  <el-tag v-if="row.changed" type="success" size="small">已修改</el-tag>
                  <el-tag v-else type="info" size="small">未变</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <!-- 错误汇总 -->
      <div v-if="simulationResult.errors.length > 0" class="errors-summary">
        <el-alert
          :title="`发现 ${simulationResult.errors.length} 个问题`"
          type="warning"
          :closable="false"
        >
          <ul>
            <li v-for="(error, idx) in simulationResult.errors" :key="idx">{{ error }}</li>
          </ul>
        </el-alert>
      </div>
    </div>

    <div v-else class="section empty-simulation">
      <el-empty 
        description="请输入原始日志并在中间面板添加规则后，此处将显示结构化解析结果"
        :image-size="80"
      >
        <template #image>
          <el-icon :size="60" color="#dcdfe6"><DataLine /></el-icon>
        </template>
        <template #default>
          <p style="color: #909399; font-size: 12px; margin-top: 8px;">
            提示：点击顶部"加载示例"可快速体验
          </p>
        </template>
      </el-empty>
    </div>

    <div class="section">
      <div class="section-header">
        <span class="section-title">输出字段推断 ({{ previewFields.length }})</span>
        <el-input
          v-model="fieldSearch"
          placeholder="搜索字段"
          size="small"
          clearable
          style="width: 120px"
        />
      </div>
      <div class="field-tags">
        <el-tag v-for="f in filteredFields" :key="f" size="small" class="field-tag">{{ f }}</el-tag>
        <el-text v-if="filteredFields.length === 0" type="info" size="small">
          {{ fieldSearch ? '无匹配字段' : '暂无字段' }}
        </el-text>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <span class="section-title">规则配置</span>
      </div>
      <JsonHighlighter :code="JSON.stringify(store.configOutput, null, 2)" />
    </div>
  </div>
</template>

<style scoped>
.preview-panel {
  padding: 12px;
  height: 100%;
  overflow-y: auto;
}
.title {
  font-size: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.section {
  margin-bottom: 16px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}
.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.field-tag {
  margin-bottom: 4px;
}
.code-block {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 6px;
  font-size: 11px;
  font-family: monospace;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 结构化日志模拟区域 */
.simulation-section {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e4e7ed;
}

/* 格式化字段值面板 */
.formatted-fields-panel {
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  margin-bottom: 12px;
  overflow: hidden;
}
.panel-subheader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}
.subheader-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fields-table-wrapper {
  padding: 0;
}
.field-name-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
}
.new-field-icon {
  font-size: 14px;
}
.new-field {
  color: #67c23a;
  font-weight: 600;
}
.field-value-cell {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.string-value {
  color: #ce9178;
}
.number-value {
  color: #b5cea8;
}
.object-value {
  color: #9cdcfe;
  cursor: pointer;
}
.null-value {
  color: #569cd6;
  font-style: italic;
}
.empty-simulation {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
}
.simulation-tabs :deep(.el-tabs__header) {
  margin-bottom: 10px;
}
.final-result {
  max-height: 300px;
  overflow-y: auto;
}
.steps-container {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}
.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}
.step-header:hover {
  background: #f0f2f5;
  border-radius: 4px;
}
.step-title {
  font-weight: 500;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-toggle-icon {
  color: #909399;
}
.step-detail {
  margin-top: 8px;
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}
.detail-label {
  font-size: 12px;
  color: #606266;
  margin-bottom: 6px;
  font-weight: 500;
}
.step-changes {
  margin-bottom: 12px;
}
.step-changes ul {
  margin: 0;
  padding-left: 16px;
  list-style: none;
}
.change-item {
  font-size: 12px;
  color: #67c23a;
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.step-errors {
  margin-bottom: 12px;
}
.step-errors ul {
  margin: 0;
  padding-left: 16px;
  list-style: none;
}
.error-item {
  font-size: 12px;
  color: #f56c6c;
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.io-comparison {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
.io-box {
  flex: 1;
  background: #1e1e1e;
  border-radius: 4px;
  overflow: hidden;
}
.io-label {
  background: #2d2d2d;
  color: #909399;
  font-size: 11px;
  padding: 4px 8px;
  font-weight: 500;
}
.io-content {
  margin: 0;
  padding: 8px;
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  color: #d4d4d4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
.io-arrow {
  display: flex;
  align-items: center;
  color: #909399;
  font-size: 16px;
}
.errors-summary {
  margin-top: 12px;
}
.errors-summary ul {
  margin: 8px 0 0;
  padding-left: 16px;
}
.errors-summary li {
  font-size: 12px;
  margin: 4px 0;
}
.compare-container {
  max-height: 350px;
  overflow-y: auto;
}
.batch-result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f0f9ff;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid #d9ecff;
}
.batch-count {
  font-size: 13px;
  color: #606266;
  flex: 1;
}
/* 单条结果字段表格 */
.single-result-fields {
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  margin-bottom: 12px;
  overflow: hidden;
}
.field-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}
.field-count {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}
.field-value-cell-full {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.json-raw-section {
  background: #f5f7fa;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}
.json-section-title {
  padding: 8px 12px;
  background: #f0f2f5;
  border-bottom: 1px solid #ebeef5;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}
.value-cell {
  font-family: monospace;
  font-size: 11px;
}
.value-cell.original {
  color: #909399;
}
.value-cell.final {
  color: #67c23a;
}
:deep(.el-timeline-item__node) {
  background-color: #409eff;
}
:deep(.el-timeline-item__node--warning) {
  background-color: #e6a23c;
}
</style>
