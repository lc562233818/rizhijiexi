<script setup lang="ts">
import { computed } from 'vue'
import { categories, operators } from '../data/operators'
import { useProjectStore } from '../stores/project'
import type { LogFormat } from '../utils/formatAnalyzer'

const props = defineProps<{
  detectedFormat?: LogFormat
}>()

const store = useProjectStore()

const grouped = computed(() => {
  return categories.map((cat) => ({
    ...cat,
    ops: operators.filter((op) => op.category === cat.key),
  }))
})

function isRecommended(opName: string): boolean {
  if (!props.detectedFormat) return false
  const map: Record<LogFormat, string[]> = {
    json: ['json', 'expand'],
    xml: ['xml'],
    csv: ['csv'],
    kv: ['kv_split', 'kv_regex'],
    syslog: ['syslog_pri', 'regex'],
    nginx: ['regex', 'ua_parse', 'geo'],
    plain: ['regex'],
  }
  return map[props.detectedFormat]?.includes(opName) ?? false
}
</script>

<template>
  <div class="operator-library">
    <h3 class="title">
      <el-icon><Collection /></el-icon> 算子库
    </h3>
    <div class="category-list">
      <div v-for="cat in grouped" :key="cat.key" class="category">
        <div class="cat-label">{{ cat.label }}</div>
        <div class="op-list">
          <el-tooltip
            v-for="op in cat.ops"
            :key="op.name"
            :content="op.description"
            placement="right"
          >
            <el-button
              size="small"
              class="op-btn"
              :type="isRecommended(op.name) ? 'primary' : 'default'"
              @click="store.addOperator(op)"
            >
              <span class="op-name">{{ op.label }}</span>
              <el-tag v-if="isRecommended(op.name)" size="small" type="warning" effect="dark" class="rec-tag">荐</el-tag>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.operator-library {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
}
.title {
  font-size: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.category {
  margin-bottom: 14px;
}
.cat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
  font-weight: 600;
}
.op-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.op-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}
.op-name {
  font-size: 12px;
}
.rec-tag {
  margin-left: 2px;
  height: 16px;
  padding: 0 4px;
  line-height: 14px;
}
</style>
