<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from './stores/project'
import { analyzeLogFormat } from './utils/formatAnalyzer'
import OperatorLibrary from './components/OperatorLibrary.vue'
import RuleChainEditor from './components/RuleChainEditor.vue'
import LogInputPanel from './components/LogInputPanel.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import ExportActions from './components/ExportActions.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import XiaoLinLogo from './components/XiaoLinLogo.vue'

const store = useProjectStore()
const detectedFormat = computed(() => analyzeLogFormat(store.project.rawLog).format)
const leftCollapsed = ref(false)
</script>

<template>
  <div class="app-wrapper">
    <el-container class="main-container">
      <el-header class="app-header" height="56px">
        <div class="brand">
          <XiaoLinLogo size="small" />
          <span class="brand-text"></span>
          <span class="license-badge">MIT</span>
        </div>
        <div class="header-actions">
          <ThemeToggle />
          <ExportActions />
        </div>
      </el-header>

      <el-main class="app-main">
        <div class="workspace">
          <div class="panel left" :class="{ collapsed: leftCollapsed }">
            <div class="collapse-btn" @click="leftCollapsed = !leftCollapsed">
              <el-icon><component :is="leftCollapsed ? 'ArrowRight' : 'ArrowLeft'" /></el-icon>
            </div>
            <OperatorLibrary v-show="!leftCollapsed" :detected-format="detectedFormat" />
          </div>
          <div class="panel center">
            <RuleChainEditor />
          </div>
          <div class="panel right">
            <div class="right-panel-section log-input-section">
              <LogInputPanel />
            </div>
            <div class="right-panel-section preview-section">
              <PreviewPanel />
            </div>
          </div>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>

<style scoped>
.app-wrapper {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
}
.main-container {
  height: 100%;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-text {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.license-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: #67c23a;
  color: white;
  border-radius: 4px;
  margin-left: 20px;
  font-weight: 500;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.collapse-btn {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 0 4px 4px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  box-shadow: 2px 0 8px rgba(0,0,0,0.1);
}
.collapse-btn:hover {
  background: #f5f7fa;
}
.left.collapsed {
  width: 24px;
  min-width: 24px;
}
.app-main {
  padding: 0;
  background: #f5f7fa;
  overflow: hidden;
}
.workspace {
  display: flex;
  height: 100%;
  gap: 8px;
  padding: 8px;
}
.panel {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.left {
  width: 240px;
  flex-shrink: 0;
}
.center {
  flex: 1;
  min-width: 0;
}
.right {
  width: 380px;
  flex-shrink: 0;
}
.right-panel-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.log-input-section {
  flex: 0 0 35%;
  min-height: 150px;
  border-bottom: 2px solid #e4e7ed;
}
.preview-section {
  flex: 1;
  min-height: 300px;
  overflow: hidden;
}
</style>
