# AGENTS.md - 小lin日志解析器

> 本文档面向 AI 编程助手，帮助理解项目架构和开发规范。

## 项目概述

**小lin日志解析器**（XiaoLin Log Parser）是一个可视化的日志解析与转换工具，用于帮助用户通过拖拽算子构建日志处理流水线，实时预览解析结果，并支持多格式导出。

### 核心功能

- **多格式日志检测**：自动识别 JSON、XML、CSV、键值对、Syslog、Nginx、普通文本等格式
- **算子链编辑**：通过拖拽算子构建日志处理流水线
- **实时预览**：即时查看解析结果和执行步骤
- **批量解析**：支持大文件（100MB+）的批量日志解析
- **多格式导出**：支持导出为 Excel、YAML、JSON、CSV、XML、Logstash/Fluentd 配置等
- **深色/浅色主题**：一键切换

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.4.21 | 前端框架 |
| TypeScript | 5.4.5 | 类型系统 |
| Vite | 5.2.8 | 构建工具 |
| Element Plus | 2.6.3 | UI 组件库 |
| Pinia | 2.1.7 | 状态管理 |
| xlsx | 0.18.5 | Excel 导出 |
| js-yaml | 4.1.0 | YAML 处理 |

## 项目结构

```
├── index.html              # HTML 入口
├── package.json            # 依赖配置
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
├── src/
│   ├── main.ts             # 应用入口
│   ├── App.vue             # 根组件
│   ├── components/         # Vue 组件
│   │   ├── OperatorLibrary.vue      # 算子库面板
│   │   ├── RuleChainEditor.vue      # 规则链编辑器
│   │   ├── OperatorForm.vue         # 算子配置表单
│   │   ├── LogInputPanel.vue        # 日志输入面板
│   │   ├── PreviewPanel.vue         # 结果预览面板
│   │   ├── ExportActions.vue        # 导出操作栏
│   │   ├── ThemeToggle.vue          # 主题切换
│   │   ├── JsonHighlighter.vue      # JSON 语法高亮
│   │   └── XiaoLinLogo.vue          # Logo 组件
│   ├── stores/
│   │   └── project.ts      # Pinia 状态管理
│   ├── data/
│   │   ├── operators.ts    # 算子定义（60+ 算子）
│   │   └── presets.ts      # 预设规则模板
│   └── utils/
│       ├── formatAnalyzer.ts        # 日志格式分析
│       ├── simulator.ts             # 规则链模拟执行
│       ├── exporter.ts              # 导出功能
│       └── grokPatterns.ts          # Grok 模式库
```

## 构建与运行

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev

# 构建生产版本（输出到 dist/）
npm run build

# 预览生产构建
npm run preview
```

## 核心概念

### 1. 算子（Operator）

算子是日志处理的基本单元，定义在 `src/data/operators.ts` 中，分为四大类：

| 类别 | 算子示例 |
|------|----------|
| 基础提取与拆分 | regex, grok, delimiter, kv_split, csv, json, xml |
| 类型转换与格式化 | to_number, url_decode, timestamp, format, trim |
| 数据丰富与内容处理 | ua_parse, url_parse, geo, mask, replace |
| 字段操作与高级处理 | remove, rename, filter, dedup, aggregate |

每个算子定义包含：
- `name`: 算子标识
- `label`: 显示名称
- `category`: 所属分类
- `description`: 描述
- `params`: 参数列表（含类型、默认值、必填等）

### 2. 规则链（Rule Chain）

规则链是算子的有序组合，按顺序执行。数据流：

```
rawLog -> Operator1 -> Operator2 -> ... -> OperatorN -> 结构化结果
```

### 3. 状态管理

使用 Pinia 管理全局状态，存储在 `src/stores/project.ts`：

```typescript
interface RuleProject {
  name: string        // 项目名称
  rawLog: string      // 原始日志内容
  rules: OperatorConfig[]  // 规则链
}
```

状态自动持久化到 localStorage（大文件内容除外，阈值 500KB）。

### 4. 模拟执行

`src/utils/simulator.ts` 提供两种执行模式：

- **simulateRuleChain**: 详细模式，记录每步的输入、输出、变化和错误
- **parseLogFast**: 高性能模式，用于批量解析，不记录中间步骤

## 代码风格指南

### TypeScript

- 启用严格模式（`strict: true`）
- 使用类型推断，但复杂类型需显式声明
- 接口使用 `PascalCase`，可选属性用 `?`

```typescript
// 示例：算子参数定义
export interface ParamMeta {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'textarea' | 'select' | 'keyValue'
  required?: boolean
  defaultValue?: unknown
}
```

### Vue 组件

- 使用 `<script setup lang="ts">` 语法
- Props 使用类型定义
- 样式使用 `scoped`，全局样式在 `App.vue` 中定义

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  ruleId: string
}
const props = defineProps<Props>()
</script>
```

### 命名规范

- 组件名：`PascalCase.vue`
- 工具函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 类型/接口：`PascalCase`

## 开发指南

### 添加新算子

1. 在 `src/data/operators.ts` 中添加算子定义：

```typescript
{
  name: 'my_operator',
  label: '我的算子',
  category: 'conversion',
  description: '描述信息',
  params: [
    { key: 'field', label: '字段', type: 'string', required: true },
    { key: 'option', label: '选项', type: 'select', defaultValue: 'a', 
      options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] }
  ]
}
```

2. 在 `src/utils/simulator.ts` 中添加执行逻辑：

```typescript
case 'my_operator': {
  const field = params.field as string
  const option = params.option as string
  // 执行逻辑
  result[field] = processedValue
  changes.push(`处理: ${field}`)
  break
}
```

3. 在 `getOperatorLabel` 函数中添加中文标签映射

### 添加预设模板

在 `src/data/presets.ts` 中添加：

```typescript
{
  name: '新日志类型',
  description: '描述',
  rawLog: '示例日志内容',
  rules: [
    { operator: 'regex', pattern: '(?<field>\\w+)' },
    // ...
  ]
}
```

### 大文件处理

批量解析实现要点：
- 使用 `AbortController` 支持取消操作
- 分批处理（BATCH_SIZE = 500）避免阻塞 UI
- 使用 `requestAnimationFrame` 让出主线程
- 支持暂停/恢复功能

```typescript
// 批量处理模式
for (let i = 0; i < totalLogs; i += CHUNK_SIZE) {
  if (signal.aborted) return
  while (isPaused.value && !signal.aborted) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  // 处理批次...
  await new Promise(resolve => requestAnimationFrame(resolve))
}
```

## 安全注意事项

1. **正则表达式安全**：用户输入的正则可能在浏览器中执行，需注意 ReDoS 风险
2. **大文件处理**：超过 500KB 的内容不保存到 localStorage，超过 100MB 的文件拒绝导入
3. **XSS 防护**：使用 `v-html` 时确保内容已转义（如 JSON 高亮组件）
4. **敏感信息脱敏**：内置 IP、密码、邮箱、手机号等字段的脱敏功能

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

依赖现代浏览器特性：
- ES2020
- RegExp 命名捕获组
- Blob API
- Clipboard API

## 依赖说明

### 生产依赖

| 包名 | 用途 |
|------|------|
| vue | 前端框架 |
| element-plus | UI 组件库 |
| @element-plus/icons-vue | 图标库 |
| pinia | 状态管理 |
| xlsx | Excel 处理 |
| js-yaml | YAML 解析/生成 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| vite | 构建工具 |
| @vitejs/plugin-vue | Vue 插件 |
| vue-tsc | Vue TypeScript 检查 |
| typescript | 类型系统 |

## 部署

生产构建输出为纯静态文件，可部署到任何静态托管服务：

```bash
npm run build
# 部署 dist/ 目录
```

## 许可证

MIT License
