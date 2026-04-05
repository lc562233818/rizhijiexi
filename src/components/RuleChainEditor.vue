<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { getOperatorMeta } from '../data/operators'
import OperatorForm from './OperatorForm.vue'

const store = useProjectStore()
const selectedRuleId = ref<string | null>(null)

function selectRule(id: string) {
  selectedRuleId.value = id
}

function removeRule(id: string) {
  store.removeOperator(id)
  if (selectedRuleId.value === id) {
    selectedRuleId.value = null
  }
}

function moveRule(id: string, dir: -1 | 1) {
  store.moveOperator(id, dir)
}
</script>

<template>
  <div class="rule-chain-editor">
    <div class="header">
      <h3 class="title">
        <el-icon><SetUp /></el-icon> 规则链
        <el-tag size="small" type="info">{{ store.project.rules.length }}</el-tag>
      </h3>
    </div>

    <div class="content">
      <div class="rule-list">
        <div
          v-for="(rule, index) in store.project.rules"
          :key="rule.id"
          class="rule-card"
          :class="{ active: selectedRuleId === rule.id }"
          @click="selectRule(rule.id)"
        >
          <div class="rule-index">{{ index + 1 }}</div>
          <div class="rule-info">
            <div class="rule-name">{{ getOperatorMeta(rule.name)?.label ?? rule.name }}</div>
          </div>
          <div class="rule-actions">
            <el-button
              link
              size="small"
              :disabled="index === 0"
              @click.stop="moveRule(rule.id, -1)"
            >
              <el-icon><ArrowUp /></el-icon>
            </el-button>
            <el-button
              link
              size="small"
              :disabled="index === store.project.rules.length - 1"
              @click.stop="moveRule(rule.id, 1)"
            >
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <el-button link type="danger" size="small" @click.stop="removeRule(rule.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <el-empty v-if="store.project.rules.length === 0" description="点击左侧算子添加到规则链" />
      </div>

      <div class="form-panel">
        <OperatorForm v-if="selectedRuleId" :rule-id="selectedRuleId" />
        <el-empty v-else description="选择左侧规则进行配置" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.rule-chain-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.header {
  padding: 12px 12px 6px;
  border-bottom: 1px solid #e4e7ed;
}
.title {
  font-size: 16px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.content {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.rule-list {
  width: 220px;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
  padding: 8px;
}
.rule-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 6px;
  background: #f5f7fa;
  transition: background 0.2s;
}
.rule-card:hover {
  background: #ebeef5;
}
.rule-card.active {
  background: #ecf5ff;
  outline: 1px solid #409eff;
}
.rule-index {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.rule-info {
  flex: 1;
  min-width: 0;
}
.rule-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rule-actions {
  display: flex;
  gap: 2px;
}
.form-panel {
  flex: 1;
  overflow-y: auto;
}
</style>
