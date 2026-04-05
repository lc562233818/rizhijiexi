<script setup lang="ts">
import { useProjectStore } from '../stores/project'

const store = useProjectStore()
</script>

<template>
  <el-switch
    v-model="store.theme"
    active-value="dark"
    inactive-value="light"
    inline-prompt
    :active-icon="Moon"
    :inactive-icon="Sunny"
    style="--el-switch-on-color: #409eff; --el-switch-off-color: #dcdfe6"
  />
</template>

<script lang="ts">
import { Moon, Sunny } from '@element-plus/icons-vue'
export { Moon, Sunny }
</script>
