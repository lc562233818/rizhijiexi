<script setup lang="ts">
import { computed, ref } from 'vue'
import { getOperatorMeta } from '../data/operators'
import { useProjectStore } from '../stores/project'
import { getCommonPatterns, compileGrok } from '../utils/grokPatterns'

const props = defineProps<{
  ruleId: string
}>()

const store = useProjectStore()
const rule = computed(() => store.project.rules.find((r) => r.id === props.ruleId))
const meta = computed(() => (rule.value ? getOperatorMeta(rule.value.name) : undefined))

function update(key: string, value: unknown) {
  store.updateOperatorParam(props.ruleId, key, value)
}

function updateKvKey(paramKey: string, oldKey: string, newKey: string, currentMap?: Record<string, string>) {
  const map = { ...(currentMap ?? {}) }
  const val = map[oldKey]
  delete map[oldKey]
  map[newKey] = val
  update(paramKey, map)
}

function updateKvVal(paramKey: string, key: string, newVal: string, currentMap?: Record<string, string>) {
  const map = { ...(currentMap ?? {}) }
  map[key] = newVal
  update(paramKey, map)
}

function removeKv(paramKey: string, key: string, currentMap?: Record<string, string>) {
  const map = { ...(currentMap ?? {}) }
  delete map[key]
  update(paramKey, map)
}

function addKv(paramKey: string, currentMap?: Record<string, string>) {
  const map = { ...(currentMap ?? {}) }
  map[''] = ''
  update(paramKey, map)
}

// Grok 模式相关
const showGrokPatterns = ref(false)
const compiledPattern = computed(() => {
  if (rule.value?.name === 'grok' && rule.value.params.pattern) {
    try {
      return compileGrok(rule.value.params.pattern as string)
    } catch {
      return '编译失败'
    }
  }
  return ''
})

function insertGrokPattern(pattern: string) {
  const currentPattern = (rule.value?.params.pattern as string) || ''
  const newPattern = currentPattern + (currentPattern && !currentPattern.endsWith(' ') ? ' ' : '') + `%${pattern}}`
  update('pattern', newPattern)
}

function toggleGrokPatterns() {
  showGrokPatterns.value = !showGrokPatterns.value
  update('show_patterns', showGrokPatterns.value)
}
</script>

<template>
  <div v-if="meta && rule" class="operator-form">
    <div class="form-header">
      <span class="form-title">{{ meta.label }}</span>
      <span class="form-desc">{{ meta.description }}</span>
    </div>
    <div class="form-body">
      <div v-for="param in meta.params" :key="param.key" class="form-item">
        <label class="form-label">
          {{ param.label }}
          <span v-if="param.required" class="required">*</span>
        </label>

        <el-input
          v-if="param.type === 'string'"
          :model-value="(rule.params[param.key] as string) ?? ''"
          @update:model-value="update(param.key, $event)"
          :placeholder="param.placeholder"
        />

        <template v-else-if="param.type === 'textarea'">
          <el-input
            type="textarea"
            :rows="param.key === 'pattern' && rule.name === 'grok' ? 4 : 3"
            :model-value="(rule.params[param.key] as string) ?? ''"
            @update:model-value="update(param.key, $event)"
            :placeholder="param.placeholder"
          />
          <!-- Grok 模式选择器 -->
          <template v-if="rule.name === 'grok' && param.key === 'pattern'">
            <el-button 
              size="small" 
              @click="toggleGrokPatterns" 
              style="margin-top: 8px"
              :type="showGrokPatterns ? 'primary' : 'default'"
            >
              {{ showGrokPatterns ? '隐藏常用模式' : '查看常用模式' }}
            </el-button>
            <div v-if="showGrokPatterns" class="grok-patterns-panel">
              <div class="grok-patterns-title">点击插入常用模式:</div>
              <div class="grok-patterns-grid">
                <el-button
                  v-for="p in getCommonPatterns()"
                  :key="p.name"
                  size="small"
                  @click="insertGrokPattern(`{${p.name}:`)"
                  class="grok-pattern-btn"
                >
                  <el-tooltip :content="p.description" placement="top">
                    <span>%{{ p.name }}</span>
                  </el-tooltip>
                </el-button>
              </div>
            </div>
            <div v-if="compiledPattern" class="compiled-pattern">
              <div class="compiled-label">编译后正则:</div>
              <code class="compiled-code">{{ compiledPattern }}</code>
            </div>
          </template>
        </template>

        <el-input-number
          v-else-if="param.type === 'number'"
          :model-value="(rule.params[param.key] as number) ?? undefined"
          @update:model-value="update(param.key, $event)"
          :placeholder="param.placeholder"
          style="width: 100%"
        />

        <el-switch
          v-else-if="param.type === 'boolean'"
          :model-value="(rule.params[param.key] as boolean) ?? false"
          @update:model-value="update(param.key, $event)"
        />

        <el-select
          v-else-if="param.type === 'select'"
          :model-value="(rule.params[param.key] as string) ?? ''"
          @update:model-value="update(param.key, $event)"
          style="width: 100%"
        >
          <el-option
            v-for="opt in param.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <div v-else-if="param.type === 'keyValue'" class="kv-editor">
          <div
            v-for="(kvVal, kvKey) in (rule.params[param.key] as Record<string, string> ?? {})"
            :key="kvKey"
            class="kv-row"
          >
            <el-input
              :model-value="kvKey"
              @update:model-value="updateKvKey(param.key, kvKey, $event, rule?.params[param.key] as Record<string, string> | undefined)"
              placeholder="字段名"
              style="flex: 1"
            />
            <el-input
              :model-value="kvVal"
              @update:model-value="updateKvVal(param.key, kvKey, $event, rule?.params[param.key] as Record<string, string> | undefined)"
              :placeholder="param.placeholder || '值'"
              style="flex: 2"
            />
            <el-button
              type="danger"
              size="small"
              @click="removeKv(param.key, kvKey, rule?.params[param.key] as Record<string, string> | undefined)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <el-button
            size="small"
            @click="addKv(param.key, rule?.params[param.key] as Record<string, string> | undefined)"
          >
            + 添加映射
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.operator-form {
  padding: 12px;
}
.form-header {
  margin-bottom: 12px;
}
.form-title {
  font-size: 16px;
  font-weight: 600;
  margin-right: 8px;
}
.form-desc {
  font-size: 12px;
  color: #909399;
}
.form-item {
  margin-bottom: 14px;
}
.form-label {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
  color: #606266;
}
.required {
  color: #f56c6c;
  margin-left: 2px;
}
.kv-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kv-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.grok-patterns-panel {
  margin-top: 8px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}
.grok-patterns-title {
  font-size: 12px;
  color: #606266;
  margin-bottom: 8px;
}
.grok-patterns-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.grok-pattern-btn {
  padding: 4px 8px;
  font-family: monospace;
}
.compiled-pattern {
  margin-top: 8px;
  padding: 8px;
  background: #f0f9ff;
  border-radius: 4px;
  border: 1px solid #b3e0ff;
}
.compiled-label {
  font-size: 11px;
  color: #409eff;
  margin-bottom: 4px;
}
.compiled-code {
  font-size: 11px;
  font-family: monospace;
  word-break: break-all;
  color: #303133;
}
</style>
