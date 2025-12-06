# 公式编辑系统架构调整实施细节

本文档详细列出所有需要调整的代码点和实施步骤。

## 目录

1. [实施概览](#实施概览)
2. [第 1 步：统一动作入口](#第-1-步统一动作入口)
3. [第 2 步：删除 FormulaBar 内部状态](#第-2-步删除-formulabar-内部状态)
4. [第 3 步：优化跨 Sheet 逻辑封装](#第-3-步优化跨-sheet-逻辑封装)
5. [第 3.5 步：统一 UI 显示/隐藏操作](#第-35-步统一-ui-显示隐藏操作)
6. [第 4 步：统一公式引用插入逻辑](#第-4-步统一公式引用插入逻辑)
7. [第 5 步：统一 Sheet 切换处理](#第-5-步统一-sheet-切换处理)
8. [测试验证清单](#测试验证清单)
9. [回滚方案](#回滚方案)

---

## 实施概览

### 当前问题

| 问题 | 状态 | 文件位置 | 影响 |
|------|------|----------|------|
| 状态分散 | 🔴 | FormulaBar.vue + formulaEditState.ts | bug 主要来源 |
| 事件处理分散 | 🔴 | WorkbookSheet.vue | 可维护性差 |
| UI 显示/隐藏分散 | 🔴 | WorkbookSheet.vue | 易遗漏同步 |
| 跨 Sheet 角色 | 🟡 | WorkbookSheet.vue | 代码可读性 |
| 引用插入分支 | 🔴 | WorkbookSheet.vue handleSelectionChange | 逻辑重复 |
| Sheet 切换复杂 | 🟡 | WorkbookSheet.vue handleSheetChange | 分支过多 |

### 实施顺序与风险评估

```
第 1 步：统一动作入口
├─→ 风险：低
├─→ 工时：2-3 小时
├─→ 测试：运行全部 887 测试
└─→ 可独立完成，不影响组件接口

第 2 步：删除 FormulaBar 内部状态
├─→ 风险：中
├─→ 工时：3-4 小时
├─→ 测试：重点测试公式编辑流程
└─→ 需修改 FormulaBar.vue 接口

第 3 步：优化跨 Sheet 逻辑封装
├─→ 风险：低
├─→ 工时：1-2 小时
└─→ 封装 isCrossSheetMode 判断

第 3.5 步：统一 UI 显示/隐藏操作 ⭐ (新增)
├─→ 风险：低
├─→ 工时：1-2 小时
├─→ 测试：编辑开始/结束的 UI 同步
└─→ 整合分散的 overlay/formulaBar 显示控制

第 4 步：统一公式引用插入逻辑 ⭐
├─→ 风险：中
├─→ 工时：2-3 小时
├─→ 测试：重点测试公式引用插入和替换
└─→ 消除 handleSelectionChange 的分支

第 5 步：统一 Sheet 切换处理
├─→ 风险：低
├─→ 工时：2 小时
└─→ 可选，使用状态机模式重构 handleSheetChange
```

### 关键函数调整一览

| 函数 | 当前行数 | 问题 | 目标 |
|------|----------|------|------|
| `handleFormulaBar*` (5个) | ~200行 | 与 Overlay 逻辑重复 | 薄包装，调用统一处理器 |
| `handleGlobalOverlay*` (5个) | ~150行 | 与 FormulaBar 逻辑重复 | 薄包装，调用统一处理器 |
| `handleSelectionChange` | ~150行 | source 分支、引用替换逻辑分散 | 统一引用插入 |
| `handleSheetChange` | ~120行 | 6 种情况的 if-else 嵌套 | 状态机模式 |
| UI 显示函数 (6个) | ~60行 | 分散调用，易遗漏 | 统一 `EditUIController` |

---

## 第 1 步：统一动作入口

### 1.1 目标

将 10 个分散的事件处理函数统一为 4 个核心处理器 + 10 个薄包装函数。

### 1.2 涉及文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/components/WorkbookSheet.vue` | 重构 | 添加统一处理器，简化现有函数 |

### 1.3 当前代码结构

```typescript
// WorkbookSheet.vue 中当前的 10 个处理函数

// FormulaBar 事件处理（5个）
function handleFormulaBarInput(value: string, cursorPos: number) { /* 独立逻辑 */ }
function handleFormulaBarConfirm() { /* 独立逻辑 */ }
function handleFormulaBarCancel() { /* 独立逻辑 */ }
function handleFormulaBarTab() { /* 独立逻辑 */ }
function handleFormulaBarBlur() { /* 独立逻辑 */ }

// CellOverlay 事件处理（5个）
function handleGlobalOverlayInputChange() { /* 独立逻辑 */ }
function handleGlobalOverlayEnter(val: string) { /* 独立逻辑，部分委托 */ }
function handleGlobalOverlayCancel() { /* 独立逻辑 */ }
function handleGlobalOverlayTab(val: string) { /* 独立逻辑，部分委托 */ }
function handleGlobalOverlayBlur(val: string) { /* 独立逻辑 */ }
```

### 1.4 目标代码结构

```typescript
// ==================== 类型定义 ====================

/** 编辑动作来源 */
type EditActionSource = 'formulaBar' | 'cellOverlay'

/** 确认方向 */
type ConfirmDirection = 'down' | 'right' | 'none'

// ==================== 4 个统一处理器 ====================

/**
 * 统一处理编辑输入
 */
function handleEditInput(value: string, cursorPos: number, source: EditActionSource) {
  const mgr = formulaEditManager
  
  if (!mgr.state.active) return
  
  // 更新 Manager 状态
  mgr.updateValue(value, cursorPos)
  
  // 清除上次插入的引用记录
  lastInsertedReference = null
  
  // 双向同步 UI
  globalOverlay.value = value
  formulaBarEditingValue.value = value
  formulaReferences.value = mgr.state.formulaReferences
  
  // 更新跨 Sheet 引用映射
  if (mgr.state.isFormulaMode) {
    const sourceSheet = workbook.value.getSheetById(mgr.state.sourceSheetId ?? '')
    const sourceSheetName = sourceSheet?.metadata?.name ?? 'Sheet1'
    crossSheetReferencesMap.value = parseFormulaReferencesWithSheet(value, sourceSheetName)
  } else {
    crossSheetReferencesMap.value = new Map()
  }
}

/**
 * 统一处理编辑确认
 */
function handleEditConfirm(direction: ConfirmDirection, source: EditActionSource) {
  const mgr = formulaEditManager
  
  if (!mgr.state.active) {
    canvasSheetRef.value?.confirmEditing?.()
    return
  }
  
  const value = mgr.state.currentValue
  const row = mgr.state.row
  const col = mgr.state.col
  const sourceSheetId = mgr.state.sourceSheetId
  
  // 重置状态
  mgr.reset()
  resetFormulaBarUI()
  closeGlobalOverlay()
  
  // 跨 Sheet 处理
  if (sourceSheetId && sourceSheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(sourceSheetId)
    nextTick(() => {
      canvasSheetRef.value?.confirmEditingWithDirection?.(value, direction, { row, col })
    })
  } else {
    canvasSheetRef.value?.confirmEditingWithDirection?.(value, direction, { row, col })
  }
}

/**
 * 统一处理编辑取消
 */
function handleEditCancel(source: EditActionSource) {
  const mgr = formulaEditManager
  
  if (!mgr.state.active) {
    canvasSheetRef.value?.cancelEditing?.()
    return
  }
  
  const sourceSheetId = mgr.state.sourceSheetId
  
  // 重置状态
  mgr.reset()
  resetFormulaBarUI()
  closeGlobalOverlay()
  
  // 跨 Sheet 处理
  if (sourceSheetId && sourceSheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(sourceSheetId)
  }
  
  canvasSheetRef.value?.cancelEditing?.()
}

/**
 * 统一处理编辑失焦
 */
function handleEditBlur(source: EditActionSource) {
  const mgr = formulaEditManager
  
  // 跨 Sheet 模式：忽略 blur
  if (mgr.isCrossSheetMode(activeSheetId.value ?? '')) {
    return
  }
  
  // 公式模式且在可选择状态：不自动保存
  if (mgr.state.isFormulaMode && mgr.state.isInSelectableState) {
    return
  }
  
  // 非活跃状态：忽略
  if (!mgr.state.active) {
    return
  }
  
  // 执行保存（不移动）
  handleEditConfirm('none', source)
}

// ==================== 10 个薄包装函数 ====================

// FormulaBar 事件 → 统一处理器
function handleFormulaBarInput(value: string, cursorPos: number) {
  handleEditInput(value, cursorPos, 'formulaBar')
}

function handleFormulaBarConfirm() {
  handleEditConfirm('down', 'formulaBar')
}

function handleFormulaBarTab() {
  handleEditConfirm('right', 'formulaBar')
}

function handleFormulaBarCancel() {
  handleEditCancel('formulaBar')
}

function handleFormulaBarBlur() {
  handleEditBlur('formulaBar')
}

// CellOverlay 事件 → 统一处理器
function handleGlobalOverlayInputChange() {
  const value = globalOverlayRef.value?.getCurrentValue?.() ?? globalOverlay.value
  handleEditInput(value, value.length, 'cellOverlay')
}

function handleGlobalOverlayEnter(val: string) {
  handleEditConfirm('down', 'cellOverlay')
}

function handleGlobalOverlayTab(val: string) {
  handleEditConfirm('right', 'cellOverlay')
}

function handleGlobalOverlayCancel() {
  handleEditCancel('cellOverlay')
}

function handleGlobalOverlayBlur(val: string) {
  handleEditBlur('cellOverlay')
}
```

### 1.5 实施步骤

#### 步骤 1.5.1：添加类型定义

在 WorkbookSheet.vue 的 `<script setup>` 顶部添加：

```typescript
/** 编辑动作来源 */
type EditActionSource = 'formulaBar' | 'cellOverlay'

/** 确认方向 */
type ConfirmDirection = 'down' | 'right' | 'none'
```

#### 步骤 1.5.2：添加 4 个统一处理器

在现有处理函数之前添加统一处理器（代码见 1.4 节）。

#### 步骤 1.5.3：简化现有处理函数

将现有 10 个函数改为薄包装：

| 原函数 | 改为调用 |
|--------|----------|
| `handleFormulaBarInput` | `handleEditInput(value, cursorPos, 'formulaBar')` |
| `handleFormulaBarConfirm` | `handleEditConfirm('down', 'formulaBar')` |
| `handleFormulaBarTab` | `handleEditConfirm('right', 'formulaBar')` |
| `handleFormulaBarCancel` | `handleEditCancel('formulaBar')` |
| `handleFormulaBarBlur` | `handleEditBlur('formulaBar')` |
| `handleGlobalOverlayInputChange` | `handleEditInput(value, value.length, 'cellOverlay')` |
| `handleGlobalOverlayEnter` | `handleEditConfirm('down', 'cellOverlay')` |
| `handleGlobalOverlayTab` | `handleEditConfirm('right', 'cellOverlay')` |
| `handleGlobalOverlayCancel` | `handleEditCancel('cellOverlay')` |
| `handleGlobalOverlayBlur` | `handleEditBlur('cellOverlay')` |

#### 步骤 1.5.4：运行测试

```bash
nvm use 20 && npm test
```

预期：887 测试全部通过。

---

## 第 2 步：删除 FormulaBar 内部状态

### 2.1 目标

FormulaBar 改为纯 UI 组件，所有状态由 FormulaEditManager 管理。

### 2.2 涉及文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/components/FormulaBar.vue` | 重构 | 删除内部状态，改为 props 驱动 |
| `src/components/WorkbookSheet.vue` | 修改 | 传递新 props |
| `src/components/sheet/formulaEditState.ts` | 增强 | 添加 displayHtml computed |

### 2.3 需要删除的 FormulaBar 内部状态

```typescript
// FormulaBar.vue 第 275-282 行，需要删除：
const pendingCursorPosition = ref<number | null>(null)  // 删除
const isInSelectableState = ref(false)                   // 删除，改用 props
const lastOperatorPos = ref(-1)                          // 删除，移到 Manager
const hasTextSelectionState = ref(false)                 // 删除，改用 props
const cursorPos = ref(0)                                 // 删除，改用 props
```

### 2.4 FormulaBar 新 Props 设计

```typescript
// 新增 props
interface FormulaBarProps {
  // 现有 props
  cellAddress: string
  cellValue: string
  isEditing: boolean
  editingValue: string
  formulaReferences: FormulaReference[]
  
  // 新增 props（从 Manager 获取）
  cursorPosition: number           // 替代 cursorPos ref
  isInSelectableState: boolean     // 替代 isInSelectableState ref
  displayHtml: string              // Manager 计算好的 HTML
}
```

### 2.5 FormulaEditManager 增强

```typescript
// formulaEditState.ts 添加 computed

const displayHtml = computed(() => {
  if (!state.isFormulaMode) {
    return escapeHtml(state.currentValue)
  }
  return generateFormulaHtmlFromRefs(
    state.currentValue,
    state.formulaReferences,
    true
  )
})

// 导出
return {
  state,
  displayHtml,  // 新增
  // ... 其他方法
}
```

### 2.6 实施步骤

#### 步骤 2.6.1：增强 FormulaEditManager

文件：`src/components/sheet/formulaEditState.ts`

```typescript
import { computed } from 'vue'
import { escapeHtml, generateFormulaHtmlFromRefs } from './formulaEditUtils'

// 在 createFormulaEditStateManager 函数内添加：
const displayHtml = computed(() => {
  if (!state.isFormulaMode) {
    return escapeHtml(state.currentValue)
  }
  return generateFormulaHtmlFromRefs(
    state.currentValue,
    state.formulaReferences,
    true
  )
})

// 在 return 中添加 displayHtml
return {
  state,
  displayHtml,
  // ... 其他方法
}
```

#### 步骤 2.6.2：修改 FormulaBar Props

文件：`src/components/FormulaBar.vue`

```typescript
// 修改 props 定义
const props = defineProps<{
  cellAddress: string
  cellValue: string
  isEditing: boolean
  editingValue: string
  formulaReferences: FormulaReference[]
  // 新增
  cursorPosition: number
  isInSelectableState: boolean
  displayHtml: string
}>()

// 删除内部状态
// const cursorPos = ref(0)  // 删除
// const isInSelectableState = ref(false)  // 删除
// const lastOperatorPos = ref(-1)  // 删除
// const hasTextSelectionState = ref(false)  // 删除
// const pendingCursorPosition = ref<number | null>(null)  // 删除
```

#### 步骤 2.6.3：修改 FormulaBar 内部逻辑

替换所有对内部状态的引用：

| 原代码 | 替换为 |
|--------|--------|
| `cursorPos.value` | `props.cursorPosition` |
| `isInSelectableState.value` | `props.isInSelectableState` |

#### 步骤 2.6.4：修改 WorkbookSheet 传递 Props

文件：`src/components/WorkbookSheet.vue`

```vue
<FormulaBar
  :cell-address="cellAddress"
  :cell-value="cellValue"
  :is-editing="formulaBarIsEditing"
  :editing-value="formulaBarEditingValue"
  :formula-references="formulaReferences"
  :cursor-position="formulaEditManager.state.cursorPosition"
  :is-in-selectable-state="formulaEditManager.state.isInSelectableState"
  :display-html="formulaEditManager.displayHtml"
  @input="handleFormulaBarInput"
  @confirm="handleFormulaBarConfirm"
  ...
/>
```

#### 步骤 2.6.5：添加光标变化事件

FormulaBar 需要上报光标变化：

```typescript
// FormulaBar.vue
const emit = defineEmits<{
  // 现有事件...
  (e: 'cursor-change', position: number): void  // 新增
}>()

// 在光标变化时 emit
function handleCursorChange() {
  const pos = getEditorCursorPosition(formulaInputRef.value)
  emit('cursor-change', pos)
}
```

```typescript
// WorkbookSheet.vue
function handleFormulaBarCursorChange(position: number) {
  formulaEditManager.updateCursorPosition(position)
}
```

#### 步骤 2.6.6：运行测试

```bash
nvm use 20 && npm test
```

---

## 第 3 步：优化跨 Sheet 逻辑封装

### 3.1 目标

将分散的 `isCrossSheetMode()` 判断封装到 FormulaEditManager 内部。

### 3.2 涉及文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/components/sheet/formulaEditState.ts` | 增强 | 添加跨 Sheet 辅助方法 |
| `src/components/WorkbookSheet.vue` | 简化 | 使用 Manager 方法替代直接判断 |

### 3.3 FormulaEditManager 增强

```typescript
// 添加方法
function shouldIgnoreBlur(currentSheetId: string): boolean {
  // 跨 Sheet 模式忽略 blur
  if (isCrossSheetMode(currentSheetId)) return true
  
  // 公式模式且在可选择状态忽略 blur
  if (state.isFormulaMode && state.isInSelectableState) return true
  
  // 非活跃状态忽略
  if (!state.active) return true
  
  return false
}

function getConfirmContext() {
  return {
    value: state.currentValue,
    row: state.row,
    col: state.col,
    sourceSheetId: state.sourceSheetId,
    needSwitchSheet: state.sourceSheetId !== state.currentSheetId
  }
}
```

### 3.4 简化 WorkbookSheet

```typescript
// 原代码
function handleEditBlur(source: EditActionSource) {
  const mgr = formulaEditManager
  
  if (mgr.isCrossSheetMode(activeSheetId.value ?? '')) return
  if (mgr.state.isFormulaMode && mgr.state.isInSelectableState) return
  if (!mgr.state.active) return
  
  handleEditConfirm('none', source)
}

// 简化后
function handleEditBlur(source: EditActionSource) {
  if (formulaEditManager.shouldIgnoreBlur(activeSheetId.value ?? '')) return
  handleEditConfirm('none', source)
}
```

---

## 第 3.5 步：统一 UI 显示/隐藏操作

### 3.5.1 目标

将分散的 FormulaBar 和 CellOverlay 显示/隐藏逻辑整合到统一的 UI 控制器中。

### 3.5.2 当前问题

**分散的 UI 控制函数**：

```typescript
// WorkbookSheet.vue 中存在多个独立的 UI 控制函数

// Overlay 相关（3个）
function hideGlobalOverlay() {           // 隐藏但不重置
  globalOverlay.visible = false
}
function closeGlobalOverlay() {          // 隐藏并重置
  globalOverlay.visible = false
  globalOverlay.value = ''
  globalOverlay.sheetId = ''
  globalOverlayFormulaRefs.value = []
}
function showGlobalOverlay(params) {     // 显示并初始化（隐式在 openGlobalOverlay）
  globalOverlay.visible = true
  globalOverlay.value = params.value
  // ...
}

// FormulaBar 相关（2个）
function resetFormulaBarUI() {           // 重置公式栏状态
  formulaBarIsEditing.value = false
  formulaBarEditingValue.value = ''
  crossSheetReferencesMap.value = new Map()
  lastInsertedReference = null
}
// 直接赋值：formulaBarIsEditing.value = true

// 状态同步
function updateGlobalOverlayFormulaRefs(value: string) { ... }
```

**问题**：
1. **调用分散**：每个事件处理函数都要分别调用 `closeGlobalOverlay()` + `resetFormulaBarUI()`
2. **易遗漏**：新增功能时容易忘记同步某一方
3. **语义不清**：`hideGlobalOverlay` vs `closeGlobalOverlay` 区别不明显
4. **跨 Sheet 复杂**：需要特殊处理 `hideGlobalOverlay`（不清除状态，方便恢复）

### 3.5.3 涉及文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/components/WorkbookSheet.vue` | 重构 | 整合 UI 控制逻辑 |

### 3.5.4 目标代码结构

```typescript
/**
 * 编辑 UI 控制器
 * 统一管理 FormulaBar 和 CellOverlay 的显示状态
 */
const editUIController = {
  /**
   * 开始编辑 - 同时激活两个 UI
   */
  startEditing(params: {
    row: number
    col: number
    value: string
    mode: 'edit' | 'input'
    source: 'cell' | 'formulaBar'
  }) {
    // FormulaBar
    formulaBarIsEditing.value = true
    formulaBarEditingValue.value = params.value
    
    // CellOverlay（仅 cell 源时显示）
    if (params.source === 'cell') {
      globalOverlay.visible = true
      globalOverlay.value = params.value
      globalOverlay.row = params.row
      globalOverlay.col = params.col
      globalOverlay.mode = params.mode
      globalOverlay.sheetId = activeSheetId.value ?? ''
    }
    
    // 公式引用
    updateGlobalOverlayFormulaRefs(params.value)
  },
  
  /**
   * 同步编辑值 - 双向同步
   */
  syncValue(value: string) {
    globalOverlay.value = value
    formulaBarEditingValue.value = value
    updateGlobalOverlayFormulaRefs(value)
  },
  
  /**
   * 暂时隐藏 Overlay（跨 Sheet 模式）
   * - 不清除状态，方便切回时恢复
   */
  hideOverlay() {
    globalOverlay.visible = false
  },
  
  /**
   * 恢复 Overlay 显示（从跨 Sheet 切回）
   */
  showOverlay() {
    globalOverlay.visible = true
  },
  
  /**
   * 结束编辑 - 关闭并重置所有 UI
   */
  endEditing() {
    // FormulaBar
    formulaBarIsEditing.value = false
    formulaBarEditingValue.value = ''
    
    // CellOverlay
    globalOverlay.visible = false
    globalOverlay.value = ''
    globalOverlay.sheetId = ''
    globalOverlayFormulaRefs.value = []
    
    // 清理跨 Sheet 状态
    crossSheetReferencesMap.value = new Map()
    lastInsertedReference = null
  },
  
  /**
   * 更新 Overlay 位置（不改变其他状态）
   */
  updateOverlayPosition(row: number, col: number) {
    globalOverlay.row = row
    globalOverlay.col = col
  }
}
```

### 3.5.5 重构后的调用方式

```typescript
// 原代码（分散调用）
function handleEditConfirm(direction: ConfirmDirection, source: EditActionSource) {
  // ... 业务逻辑 ...
  
  // 重置 UI（需要分别调用）
  resetFormulaBarUI()        // 容易遗漏
  closeGlobalOverlay()       // 容易遗漏
}

// 重构后（统一调用）
function handleEditConfirm(direction: ConfirmDirection, source: EditActionSource) {
  // ... 业务逻辑 ...
  
  // 统一重置 UI
  editUIController.endEditing()
}
```

### 3.5.6 调用点映射

| 原调用 | 替换为 | 说明 |
|--------|--------|------|
| `openGlobalOverlay(params)` + `formulaBarIsEditing.value = true` | `editUIController.startEditing(params)` | 开始编辑 |
| `closeGlobalOverlay()` + `resetFormulaBarUI()` | `editUIController.endEditing()` | 结束编辑 |
| `hideGlobalOverlay()` | `editUIController.hideOverlay()` | 跨 Sheet 隐藏 |
| `globalOverlay.visible = true` (切回时) | `editUIController.showOverlay()` | 跨 Sheet 恢复 |
| `globalOverlay.value = x` + `formulaBarEditingValue.value = x` | `editUIController.syncValue(x)` | 同步值 |

### 3.5.7 实施步骤

#### 步骤 1：添加 editUIController 对象

在 WorkbookSheet.vue 中添加控制器定义（约 80 行）。

#### 步骤 2：替换现有调用

使用全局搜索替换：

| 搜索 | 替换为 |
|------|--------|
| `closeGlobalOverlay()\s*\n\s*resetFormulaBarUI()` | `editUIController.endEditing()` |
| `hideGlobalOverlay()` | `editUIController.hideOverlay()` |

#### 步骤 3：验证测试

```bash
nvm use 20 && npm test
```

### 3.5.8 与其他步骤的关系

```
第 1 步（统一动作入口）→ 第 3.5 步（统一 UI 控制）
                            │
                            ↓
                   统一处理器直接调用 editUIController
```

**推荐合并到第 1 步**：在实施统一动作入口时，同时引入 `editUIController`，这样统一处理器可以直接调用控制器方法。

---

## 第 4 步：统一公式引用插入逻辑

### 4.1 目标

将 `handleSelectionChange` 中分散的引用插入逻辑统一，消除 `source === 'formulaBar'` 和 `source === 'cell'` 的分支处理。

### 4.2 当前问题

`handleSelectionChange` 函数中存在两条代码路径：

```typescript
// 当前代码结构（约 100 行）
if (mgr.state.source === 'formulaBar') {
  // 路径 A：通过 FormulaBar 插入引用
  formulaBarRef.value?.insertCellReference?.(reference)
} else {
  // 路径 B：通过 FormulaEditManager 插入引用（约 40 行）
  // 包含：替换上次引用、更新状态、同步 UI
}
```

**问题**：
1. 两条路径逻辑重复（都需要生成引用、判断跨 Sheet）
2. FormulaBar 插入引用有自己的替换逻辑，Manager 也有，可能不一致
3. `lastInsertedReference` 变量仅在路径 B 使用

### 4.3 涉及文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/components/WorkbookSheet.vue` | 重构 | `handleSelectionChange` 函数 |
| `src/components/sheet/formulaEditState.ts` | 增强 | 添加统一的引用插入方法 |
| `src/components/FormulaBar.vue` | 简化 | `insertCellReference` 改为调用 Manager |

### 4.4 目标代码结构

```typescript
/** 统一的引用插入处理 */
function handleInsertReference(reference: string) {
  const mgr = formulaEditManager
  
  // 1. 跨 Sheet 模式下的引用替换逻辑
  if (lastInsertedReference && mgr.isCrossSheetMode(activeSheetId.value ?? '')) {
    const { startPos, endPos } = lastInsertedReference
    let valueToUse = mgr.state.currentValue
    if (startPos >= 0 && endPos <= valueToUse.length) {
      valueToUse = valueToUse.substring(0, startPos) + valueToUse.substring(endPos)
      mgr.updateValue(valueToUse, startPos)
    }
  }
  
  // 2. 统一通过 Manager 插入引用
  const result = mgr.insertReference(reference)
  if (!result) return
  
  // 3. 记录本次插入位置（用于下次替换）
  lastInsertedReference = {
    reference,
    startPos: result.insertStartPos,
    endPos: result.insertStartPos + reference.length
  }
  
  // 4. 同步 UI
  globalOverlay.value = result.newValue
  formulaBarEditingValue.value = result.newValue
  formulaReferences.value = mgr.state.formulaReferences
  
  // 5. 更新跨 Sheet 引用映射
  const sourceSheet = workbook.value.getSheetById(mgr.state.sourceSheetId ?? '')
  const sourceSheetName = sourceSheet?.metadata?.name ?? 'Sheet1'
  crossSheetReferencesMap.value = parseFormulaReferencesWithSheet(result.newValue, sourceSheetName)
  
  // 6. 同步 FormulaBar 显示（如果是 formulaBar 源）
  if (mgr.state.source === 'formulaBar') {
    formulaBarRef.value?.syncValueFromManager?.(result.newValue, result.newCursorPos)
  }
}

/** 简化后的 handleSelectionChange */
function handleSelectionChange(payload: { ... }) {
  // ... 跳过检查 ...
  
  const mgr = formulaEditManager
  
  if (!mgr.state.active || !mgr.state.isFormulaMode || !mgr.state.isInSelectableState) {
    // 更新选区状态
    return
  }
  
  // 生成引用
  const reference = generateReference(payload.selectionRange, mgr.isCrossSheetMode(activeSheetId.value ?? ''))
  
  // 统一插入
  handleInsertReference(reference)
}

/** 生成引用字符串 */
function generateReference(range: SelectionRange, isCrossSheet: boolean): string {
  const { startRow, startCol, endRow, endCol } = range
  const isSingleCell = startRow === endRow && startCol === endCol
  
  if (isCrossSheet) {
    const sheetName = workbook.value.getActiveSheet()?.metadata?.name ?? 'Sheet1'
    return isSingleCell 
      ? formatCrossSheetReference(sheetName, startRow, startCol)
      : formatCrossSheetReference(sheetName, startRow, startCol, endRow, endCol)
  }
  
  return isSingleCell
    ? getCellAddress(startRow, startCol)
    : `${getCellAddress(startRow, startCol)}:${getCellAddress(endRow, endCol)}`
}
```

### 4.5 FormulaBar 改造

```typescript
// FormulaBar.vue

// 删除 insertCellReference 内部的复杂逻辑
// 改为简单的 DOM 操作 + emit

/** 简化后的 insertCellReference */
function insertCellReference(reference: string) {
  // 只负责更新 DOM 显示，实际状态由 Manager 管理
  emit('insert-reference', reference)
}

// 新增方法：从 Manager 同步值
function syncValueFromManager(value: string, cursorPos: number) {
  // 更新 innerHTML
  updateFormulaDisplay(value)
  // 恢复光标位置
  setEditorCursorPosition(formulaInputRef.value, cursorPos)
}
```

### 4.6 实施步骤

#### 步骤 4.6.1：在 Manager 增强 insertReference 返回值

```typescript
// formulaEditState.ts
function insertReference(reference: string) {
  // ... 现有逻辑 ...
  return {
    newValue: state.currentValue,
    newCursorPos: state.cursorPosition,
    insertStartPos: previousCursorPos  // 新增：返回插入起始位置
  }
}
```

#### 步骤 4.6.2：添加统一处理函数

在 WorkbookSheet.vue 添加 `handleInsertReference` 和 `generateReference` 函数。

#### 步骤 4.6.3：简化 handleSelectionChange

删除 `if (source === 'formulaBar')` 分支，统一调用 `handleInsertReference`。

#### 步骤 4.6.4：改造 FormulaBar.insertCellReference

改为 emit 事件，由 WorkbookSheet 处理。

---

## 第 5 步：统一 Sheet 切换处理

### 5.1 目标

将 `handleSheetChange` 中的复杂分支逻辑封装到统一动作处理器中。

### 5.2 当前问题

`handleSheetChange` 函数约 120 行，包含：
- 情况1：未在编辑 → 正常切换
- 情况2：单元格编辑
  - 2a：公式模式 + 可选取 → 进入跨 Sheet 模式
  - 2b：非公式/不可选取 → 保存后切换
- 情况3：公式栏编辑
  - 3a：切回源 Sheet → 恢复 overlay
  - 3b：公式模式 + 可选取 → 进入跨 Sheet 模式
  - 3c：公式模式 + 不可选取 → 提交后切换
  - 3d：非公式模式 → 确认后切换

### 5.3 涉及文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/components/WorkbookSheet.vue` | 重构 | `handleSheetChange` 函数 |
| `src/components/sheet/formulaEditState.ts` | 增强 | 添加 `getSheetChangeAction` 方法 |

### 5.4 目标代码结构

```typescript
// formulaEditState.ts 新增

type SheetChangeAction = 
  | { type: 'normalSwitch' }                              // 正常切换
  | { type: 'enterCrossSheetMode'; hideOverlay: boolean } // 进入跨 Sheet 模式
  | { type: 'returnToSource'; showOverlay: boolean }      // 返回源 Sheet
  | { type: 'confirmAndSwitch' }                          // 确认后切换
  | { type: 'saveAndSwitch'; value: string }              // 保存后切换

function getSheetChangeAction(targetSheetId: string): SheetChangeAction {
  // 未在编辑
  if (!state.active) {
    return { type: 'normalSwitch' }
  }
  
  // 切回源 Sheet
  if (state.sourceSheetId === targetSheetId) {
    return { type: 'returnToSource', showOverlay: true }
  }
  
  // 公式模式 + 可选取状态
  if (state.isFormulaMode && state.isInSelectableState) {
    return { type: 'enterCrossSheetMode', hideOverlay: true }
  }
  
  // 其他情况：确认后切换
  if (state.source === 'formulaBar') {
    return { type: 'confirmAndSwitch' }
  } else {
    return { type: 'saveAndSwitch', value: state.currentValue }
  }
}
```

```typescript
// WorkbookSheet.vue 简化后

function handleSheetChange(sheetId: string) {
  const action = formulaEditManager.getSheetChangeAction(sheetId)
  
  switch (action.type) {
    case 'normalSwitch':
      closeGlobalOverlay()
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      break
      
    case 'enterCrossSheetMode':
      if (action.hideOverlay) hideGlobalOverlay()
      formulaEditManager.switchSheet(sheetId)
      saveCurrentSheetState()
      skipNextSelectionChange = true
      workbook.value.setActiveSheet(sheetId)
      nextTick(() => formulaBarRef.value?.focus())
      break
      
    case 'returnToSource':
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      if (action.showOverlay) {
        nextTick(() => {
          globalOverlay.visible = true
          updateOverlayPosition(formulaEditManager.state.row, formulaEditManager.state.col)
        })
      }
      break
      
    case 'confirmAndSwitch':
      handleEditConfirm('none', 'formulaBar')
      closeGlobalOverlay()
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      break
      
    case 'saveAndSwitch':
      canvasSheetRef.value?.confirmEditingWithDirection?.(action.value, 'none')
      hideGlobalOverlay()
      formulaEditManager.reset()
      resetFormulaBarUI()
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      break
  }
}
```

### 5.5 实施步骤

#### 步骤 5.5.1：在 Manager 添加 getSheetChangeAction

定义 `SheetChangeAction` 类型和 `getSheetChangeAction` 方法。

#### 步骤 5.5.2：重构 handleSheetChange

使用 switch-case 替代多层 if-else。

#### 步骤 5.5.3：添加测试用例

为 `getSheetChangeAction` 添加单元测试。

---

## 测试验证清单

### 基础编辑功能测试

| 功能 | 测试方法 | 预期结果 |
|------|----------|----------|
| 单元格直接输入 | 选中单元格，直接打字 | 输入内容显示在单元格和公式栏 |
| 双击编辑 | 双击有内容的单元格 | 进入编辑模式，光标在内容末尾 |
| F2 编辑 | 选中单元格按 F2 | 进入编辑模式 |
| 公式栏编辑 | 点击公式栏输入 | 单元格同步显示内容 |
| Enter 确认 | 编辑后按 Enter | 保存并向下移动 |
| Tab 确认 | 编辑后按 Tab | 保存并向右移动 |
| Escape 取消 | 编辑后按 Escape | 恢复原值 |
| 失焦保存 | 编辑后点击其他区域 | 自动保存（非公式模式） |

### 公式引用功能测试

| 功能 | 测试方法 | 预期结果 |
|------|----------|----------|
| 公式引用（单元格） | 输入 `=` 后点击 A1 | 插入 `A1`，公式变为 `=A1` |
| 公式引用（范围） | 输入 `=SUM(` 后拖选 A1:B3 | 插入 `A1:B3`，公式变为 `=SUM(A1:B3` |
| 公式引用替换 | 输入 `=` 后点击 A1，再点击 B2 | 引用变为 `B2`（替换而非追加） |
| 公式操作符后引用 | 输入 `=A1+` 后点击 B1 | 追加 `B1`，公式变为 `=A1+B1` |
| 公式中间编辑 | 光标移到 `=A1+B1` 的 `+` 后，点击 C1 | 在光标位置插入 `C1` |
| 彩色引用高亮 | 输入 `=A1+B1` | A1 和 B1 显示不同颜色 |

### 跨 Sheet 公式功能测试

| 功能 | 测试方法 | 预期结果 |
|------|----------|----------|
| 跨 Sheet 引用 | 在 Sheet1 输入 `=`，切到 Sheet2 点击 A1 | 插入 `Sheet2!A1` |
| 跨 Sheet 引用（带空格名称） | 在 Sheet1 输入 `=`，切到 "Sheet 2" 点击 A1 | 插入 `'Sheet 2'!A1` |
| 跨 Sheet 引用替换 | 跨 Sheet 模式下，点击 B1 再点击 C1 | 引用从 `Sheet2!B1` 变为 `Sheet2!C1` |
| 跨 Sheet 确认 | 跨 Sheet 公式按 Enter | 切回源 Sheet 并保存公式 |
| 跨 Sheet 取消 | 跨 Sheet 公式按 Escape | 切回源 Sheet 并取消编辑 |
| 跨 Sheet 切回源 | 跨 Sheet 模式下点击源 Sheet 标签 | 恢复 overlay 显示 |
| 公式栏跨 Sheet | 点击公式栏输入 `=`，切换 Sheet | 进入跨 Sheet 模式，公式栏保持焦点 |
| 名称框显示 | 跨 Sheet 模式查看名称框 | 显示 `Sheet1!A1` 格式（源位置） |

### Sheet 切换场景测试

| 场景 | 操作 | 预期结果 |
|------|------|----------|
| 未编辑时切换 | 直接点击其他 Sheet 标签 | 正常切换 |
| 普通编辑时切换 | 输入 `abc` 后切换 Sheet | 保存内容后切换 |
| 公式可选取时切换 | 输入 `=A1+` 后切换 Sheet | 进入跨 Sheet 模式 |
| 公式不可选取时切换 | 输入 `=A1` 后切换 Sheet | 确认公式后切换 |
| 跨 Sheet 切第三方 | 从 Sheet1 跨到 Sheet2，再切 Sheet3 | 引用变为 Sheet3 的单元格 |

### 边界情况测试

| 场景 | 操作 | 预期结果 |
|------|------|----------|
| 空单元格编辑 | 双击空单元格 | 正常进入编辑 |
| 公式单元格编辑 | 双击显示 `=A1+B1` 的单元格 | 进入编辑，显示公式 |
| 快速切换编辑源 | 在单元格输入后立即点击公式栏 | 内容不丢失，切换到公式栏编辑 |
| 连续 Enter | 多次按 Enter | 每次向下移动一格 |
| 连续 Tab | 多次按 Tab | 每次向右移动一格 |
| IME 输入 | 使用中文输入法 | 正确处理组合输入 |

### 单元测试

```bash
# 运行全部测试
nvm use 20 && npm test

# 运行特定测试
nvm use 20 && npm test -- formulaEditState
```

### 集成测试

使用 `tests/test-formula-editing.html` 进行手动测试。

---

## 回滚方案

### Git 分支策略

```bash
# 开始重构前创建分支
git checkout -b refactor/unified-edit-handler

# 每完成一步提交
git add .
git commit -m "refactor: step 1 - unified action handler"

# 如需回滚
git checkout main
git branch -D refactor/unified-edit-handler
```

### 回滚检查点

| 步骤 | 回滚命令 | 说明 |
|------|----------|------|
| 第 1 步 | `git revert HEAD` | 仅回滚统一处理器 |
| 第 2 步 | `git revert HEAD~1..HEAD` | 回滚 FormulaBar 修改 |
| 全部回滚 | `git checkout main` | 放弃整个分支 |

---

## 附录：代码位置速查

### WorkbookSheet.vue 关键位置

| 功能 | 大约行号 | 说明 |
|------|----------|------|
| FormulaBar 模板 | 20-40 | 组件调用和 props |
| CellOverlay 模板 | 75-95 | 组件调用和事件 |
| formulaEditManager | 200+ | Manager 实例创建 |
| handleFormulaBarInput | 700+ | 公式栏输入处理 |
| handleFormulaBarConfirm | 770+ | 公式栏确认处理 |
| handleGlobalOverlayEnter | 990+ | Overlay Enter 处理 |
| handleGlobalOverlayBlur | 1040+ | Overlay 失焦处理 |

### FormulaBar.vue 关键位置

| 功能 | 大约行号 | 说明 |
|------|----------|------|
| props 定义 | 40-80 | 组件 props |
| 内部状态 | 275-285 | **需要删除的状态** |
| handleFormulaKeydown | 450+ | 键盘事件处理 |
| insertCellReference | 550+ | 插入引用方法 |

### formulaEditState.ts 关键位置

| 功能 | 说明 |
|------|------|
| FormulaEditState 接口 | 状态类型定义 |
| createFormulaEditStateManager | Manager 工厂函数 |
| startEdit | 开始编辑 |
| updateValue | 更新值 |
| insertReference | 插入引用 |
| reset | 重置状态 |
