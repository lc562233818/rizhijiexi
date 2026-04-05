import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { OperatorMeta } from '../data/operators'

export interface OperatorConfig {
  id: string
  name: string
  params: Record<string, unknown>
}

export interface RuleProject {
  name: string
  rawLog: string
  rules: OperatorConfig[]
}

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'xiaolin-project-v1'
const THEME_KEY = 'xiaolin-theme'

function generateId() {
  return Math.random().toString(36).slice(2)
}

function loadFromStorage(): RuleProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as RuleProject
    }
  } catch {
    // ignore
  }
  return { name: '未命名项目', rawLog: '', rules: [] }
}

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') {
      return saved
    }
  } catch {
    // ignore
  }
  // 检测系统偏好
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export const useProjectStore = defineStore('project', () => {
  const project = ref<RuleProject>(loadFromStorage())
  const theme = ref<Theme>(loadTheme())
  
  // 批量解析结果
  const batchResults = ref<Record<string, unknown>[]>([])

  // 监听主题变化并应用到 document
  watch(theme, (newTheme) => {
    localStorage.setItem(THEME_KEY, newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, { immediate: true })

  const configOutput = computed(() => {
    const rules = project.value.rules.map((r) => {
      const out: Record<string, unknown> = { operator: r.name }
      Object.entries(r.params).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) {
          out[k] = v
        }
      })
      return out
    })
    return { rules }
  })

  watch(
    project,
    (val) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    },
    { deep: true }
  )

  function reset() {
    project.value = { name: '未命名项目', rawLog: '', rules: [] }
  }

  function loadPreset(name: string, rawLog: string, rules: Record<string, unknown>[]) {
    project.value.name = name
    project.value.rawLog = rawLog
    project.value.rules = rules.map((r) => ({
      id: generateId(),
      name: r.operator as string,
      params: Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'operator')),
    }))
  }

  function addOperator(meta: OperatorMeta) {
    const params: Record<string, unknown> = {}
    meta.params.forEach((p) => {
      if (p.defaultValue !== undefined) {
        params[p.key] = p.defaultValue
      }
    })
    project.value.rules.push({
      id: generateId(),
      name: meta.name,
      params,
    })
  }

  function removeOperator(id: string) {
    project.value.rules = project.value.rules.filter((r) => r.id !== id)
  }

  function updateOperatorParam(id: string, key: string, value: unknown) {
    const rule = project.value.rules.find((r) => r.id === id)
    if (rule) {
      rule.params[key] = value
    }
  }

  function moveOperator(id: string, direction: -1 | 1) {
    const idx = project.value.rules.findIndex((r) => r.id === id)
    if (idx === -1) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= project.value.rules.length) return
    const temp = project.value.rules[idx]
    project.value.rules[idx] = project.value.rules[newIdx]
    project.value.rules[newIdx] = temp
  }

  return {
    project,
    theme,
    batchResults,
    configOutput,
    reset,
    loadPreset,
    addOperator,
    removeOperator,
    updateOperatorParam,
    moveOperator,
  }
})
