<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { presets } from '../data/presets'
import { 
  downloadJson, 
  downloadYaml, 
  downloadCsv, 
  downloadXml,
  downloadLogstashConfig,
  downloadFluentdConfig,
  copyToClipboard 
} from '../utils/exporter'
import { ElMessage } from 'element-plus'

const store = useProjectStore()
const presetMenu = ref(false)

function exportJson() {
  downloadJson(store.configOutput, `${store.project.name || 'xiaolin-rules'}.json`)
}

function exportYaml() {
  downloadYaml(store.configOutput, `${store.project.name || 'xiaolin-rules'}.yaml`)
}

function exportCsv() {
  downloadCsv(store.configOutput, `${store.project.name || 'xiaolin-rules'}.csv`)
}

function exportXml() {
  downloadXml(store.configOutput, `${store.project.name || 'xiaolin-rules'}.xml`)
}

function exportLogstash() {
  downloadLogstashConfig(store.configOutput, `${store.project.name || 'xiaolin-rules'}.conf`)
}

function exportFluentd() {
  downloadFluentdConfig(store.configOutput, `${store.project.name || 'xiaolin-rules'}.conf`)
}

async function copyConfig() {
  const success = await copyToClipboard(store.configOutput)
  if (success) {
    ElMessage.success('配置已复制到剪贴板')
  } else {
    ElMessage.error('复制失败')
  }
}

function loadPreset(idx: number) {
  const p = presets[idx]
  store.loadPreset(p.name, p.rawLog, p.rules)
  presetMenu.value = false
}
</script>

<template>
  <div class="export-actions">
    <el-input v-model="store.project.name" placeholder="项目名称" style="width: 180px" />
    <el-divider direction="vertical" />
    <el-button @click="store.reset">新建</el-button>
    <el-dropdown trigger="click" @visible-change="presetMenu = $event">
      <el-button>
        加载示例<el-icon class="el-icon--right"><arrow-down /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="(p, idx) in presets"
            :key="p.name"
            @click="loadPreset(idx)"
          >
            {{ p.name }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-divider direction="vertical" />
    <el-tooltip content="复制 JSON 配置到剪贴板">
      <el-button @click="copyConfig">
        <el-icon><DocumentCopy /></el-icon>
      </el-button>
    </el-tooltip>
    <el-dropdown split-button type="primary" @click="exportJson">
      导出 JSON
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="exportYaml">导出 YAML</el-dropdown-item>
          <el-dropdown-item @click="exportCsv">导出 CSV</el-dropdown-item>
          <el-dropdown-item @click="exportXml">导出 XML</el-dropdown-item>
          <el-dropdown-item divided @click="exportLogstash">Logstash Config</el-dropdown-item>
          <el-dropdown-item @click="exportFluentd">Fluentd Config</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.export-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
