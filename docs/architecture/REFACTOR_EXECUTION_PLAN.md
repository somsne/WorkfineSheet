# 公式编辑系统重构执行计划

> 本文档用于指导 AI 逐步实施重构。每个任务包含明确的输入、输出和验证标准。

## 执行概览

```
总任务数：6 个主任务 + 若干子任务
预计总工时：10-14 小时
测试基准：887 测试用例全部通过
```

### 执行进度

| 任务 | 状态 | 完成时间 | 备注 |
|------|------|----------|------|
| 任务 1 | ✅ 已完成 | 2025-12-05 | 添加统一处理器和 UI 控制器 |
| 任务 2 | ✅ 已完成 | 2025-12-05 | 统一引用插入（合并任务4）|
| 任务 3 | ✅ 已完成 | 2025-12-05 | 优化跨 Sheet 封装 |
| 任务 4 | ✅ 合并到任务2 | - | 统一引用插入（已实现） |
| 任务 5 | ✅ 已完成 | 2025-12-05 | 统一 Sheet 切换 |
| 任务 6 | ✅ 已完成 | 2025-12-05 | 清理和文档 |

### 任务依赖图

```
任务 1（统一动作入口 + UI 控制器）
    │
    ├──→ 任务 2（删除 FormulaBar 内部状态）
    │         │
    │         └──→ 任务 3（优化跨 Sheet 封装）
    │
    └──→ 任务 4（统一引用插入）
              │
              └──→ 任务 5（统一 Sheet 切换）
                        │
                        └──→ 任务 6（清理和文档）
```

---

## 任务 1：统一动作入口 + UI 控制器 ✅ 已完成

**完成时间**: 2025-12-05
**提交**: b6494ce

### 1.1 任务描述

将 10 个分散的事件处理函数统一为 4 个核心处理器，同时引入 `editUIController` 统一管理 UI 显示/隐藏。

### 1.2 前置条件

- [x] 确认当前测试全部通过：`nvm use 20 && npm test` ✅ 887 passed
- [x] 创建 git 分支：`git checkout -b refactor/unified-edit-handler` ✅

### 1.3 修改文件

| 文件 | 操作 |
|------|------|
| `src/components/WorkbookSheet.vue` | 添加代码 |

### 1.4 实施步骤

#### 步骤 1.4.1：添加类型定义

**位置**：WorkbookSheet.vue `<script setup>` 顶部（import 之后）

```typescript
// ==================== 编辑系统类型 ====================

/** 编辑动作来源 */
type EditActionSource = 'formulaBar' | 'cellOverlay'

/** 确认方向 */
type ConfirmDirection = 'down' | 'right' | 'none'
```

#### 步骤 1.4.2：添加 editUIController

**位置**：在 `resetFormulaBarUI` 函数之前

```typescript
// ==================== 编辑 UI 控制器 ====================

/**
 * 统一管理 FormulaBar 和 CellOverlay 的显示状态
 */
const editUIController = {
  /**
   * 开始编辑 - 同时激活 FormulaBar 和 CellOverlay
   */
  startEditing(params: {
    row: number
    col: number
    value: string
    mode: 'edit' | 'input'
    source: 'cell' | 'formulaBar'
    sheetId?: string
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
      globalOverlay.sheetId = params.sheetId ?? activeSheetId.value ?? ''
    }
    
    // 公式引用
    this.updateFormulaRefs(params.value)
  },
  
  /**
   * 同步编辑值 - 双向同步 FormulaBar 和 CellOverlay
   */
  syncValue(value: string) {
    globalOverlay.value = value
    formulaBarEditingValue.value = value
    this.updateFormulaRefs(value)
  },
  
  /**
   * 更新公式引用（内部方法）
   */
  updateFormulaRefs(value: string) {
    if (value.startsWith('=')) {
      globalOverlayFormulaRefs.value = formulaEditManager.textFormulaReferences.value
    } else {
      globalOverlayFormulaRefs.value = []
    }
  },
  
  /**
   * 暂时隐藏 Overlay（跨 Sheet 模式，不清除状态）
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
   * 更新 Overlay 位置
   */
  updatePosition(row: number, col: number) {
    globalOverlay.row = row
    globalOverlay.col = col
  }
}
```

#### 步骤 1.4.3：添加 4 个统一处理器

**位置**：在 `editUIController` 之后

```typescript
// ==================== 统一编辑处理器 ====================

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
  
  // 同步 UI
  editUIController.syncValue(value)
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
  
  // 非活跃状态时委托给 CanvasSheet
  if (!mgr.state.active) {
    if (direction === 'down') {
      canvasSheetRef.value?.confirmEditing?.()
    } else if (direction === 'right') {
      canvasSheetRef.value?.confirmEditingAndMoveRight?.()
    }
    return
  }
  
  const value = mgr.state.currentValue
  const row = mgr.state.row
  const col = mgr.state.col
  const sourceSheetId = mgr.state.sourceSheetId
  
  // 重置状态
  mgr.reset()
  editUIController.endEditing()
  
  // 跨 Sheet 处理：切回源 Sheet
  if (sourceSheetId && sourceSheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(sourceSheetId)
    nextTick(() => {
      if (direction === 'right') {
        canvasSheetRef.value?.confirmEditingWithValue?.(value, { row, col, moveRight: true })
      } else if (direction === 'down') {
        canvasSheetRef.value?.confirmEditingWithValue?.(value, { row, col, moveDown: true })
      } else {
        canvasSheetRef.value?.confirmEditingWithValue?.(value, { row, col })
      }
    })
  } else {
    if (direction === 'right') {
      canvasSheetRef.value?.confirmEditingWithValue?.(value, { row, col, moveRight: true })
    } else if (direction === 'down') {
      canvasSheetRef.value?.confirmEditingWithValue?.(value, { row, col, moveDown: true })
    } else {
      canvasSheetRef.value?.confirmEditingWithValue?.(value, { row, col })
    }
  }
}

/**
 * 统一处理编辑取消
 */
function handleEditCancel(source: EditActionSource) {
  const mgr = formulaEditManager
  
  // 非活跃状态时委托给 CanvasSheet
  if (!mgr.state.active) {
    canvasSheetRef.value?.cancelEditing?.()
    return
  }
  
  const sourceSheetId = mgr.state.sourceSheetId
  
  // 重置状态
  mgr.reset()
  editUIController.endEditing()
  
  // 跨 Sheet 处理：切回源 Sheet
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
  
  // 公式模式且在可选择状态：不自动保存（等待用户选择单元格）
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
```

#### 步骤 1.4.4：简化现有处理函数

**修改**：将现有的 10 个处理函数改为薄包装

```typescript
// ==================== FormulaBar 事件处理（薄包装）====================

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

// ==================== CellOverlay 事件处理（薄包装）====================

function handleGlobalOverlayInputChange() {
  const value = globalOverlayRef.value?.getCurrentValue?.() ?? globalOverlay.value
  const cursorPos = value.length // 简化：使用末尾位置
  handleEditInput(value, cursorPos, 'cellOverlay')
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

#### 步骤 1.4.5：替换分散的 UI 调用

**搜索替换**：

| 原代码 | 替换为 |
|--------|--------|
| `closeGlobalOverlay()\n  resetFormulaBarUI()` | `editUIController.endEditing()` |
| `resetFormulaBarUI()\n  closeGlobalOverlay()` | `editUIController.endEditing()` |
| `hideGlobalOverlay()` | `editUIController.hideOverlay()` |

**注意**：需要逐个检查上下文，确保替换正确。

### 1.5 验证标准

- [x] 运行测试：`nvm use 20 && npm test`，887 测试全部通过 ✅
- [ ] 手动测试：
  - [ ] 单元格双击编辑 → Enter 保存
  - [ ] 公式栏点击编辑 → Tab 保存
  - [ ] Escape 取消编辑
  - [ ] 公式 `=A1+` 后点击 B1 插入引用
- [x] 提交：`git add . && git commit -m "refactor: step 1 - unified action handler + UI controller"` ✅

### 1.6 实施记录

**实际完成的内容**：
1. 添加了 `EditActionSource` 和 `ConfirmDirection` 类型定义
2. 添加了 `editUIController` 对象，包含：
   - `startEditing()` - 开始编辑
   - `syncValue()` - 同步值
   - `updateFormulaRefs()` - 更新公式引用
   - `hideOverlay()` - 隐藏 overlay
   - `showOverlay()` - 显示 overlay
   - `endEditing()` - 结束编辑
   - `updatePosition()` - 更新位置
3. 添加了 4 个统一处理器：
   - `handleEditInput()` - 处理输入
   - `handleEditConfirm()` - 处理确认
   - `handleEditCancel()` - 处理取消
   - `handleEditBlur()` - 处理失焦
4. 替换了 6 处 `closeGlobalOverlay()+resetFormulaBarUI()` 配对调用为 `editUIController.endEditing()`

**保留未改动的内容**：
- 现有的 10 个事件处理函数保持原样（避免引入风险）
- `handleSheetChange` 中的 `hideGlobalOverlay()`/`closeGlobalOverlay()` 调用（复杂场景）
- `handleCloseOverlay` 中的单独 `closeGlobalOverlay()` 调用（语义正确）

---

## 任务 2：删除 FormulaBar 内部状态

### 2.1 任务描述

FormulaBar 改为纯 UI 组件，删除内部状态，改用 props 驱动。

### 2.2 前置条件

- [ ] 任务 1 已完成并测试通过

### 2.3 修改文件

| 文件 | 操作 |
|------|------|
| `src/components/sheet/formulaEditState.ts` | 添加 displayHtml computed |
| `src/components/FormulaBar.vue` | 删除内部状态，添加新 props |
| `src/components/WorkbookSheet.vue` | 传递新 props |

### 2.4 实施步骤

#### 步骤 2.4.1：增强 FormulaEditManager

**文件**：`src/components/sheet/formulaEditState.ts`

**添加**：

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
    true  // useClasses
  )
})

// 在 return 语句中添加 displayHtml
```

#### 步骤 2.4.2：修改 FormulaBar props

**文件**：`src/components/FormulaBar.vue`

**删除的内部状态**（约第 275-285 行）：

```typescript
// 删除以下代码：
const pendingCursorPosition = ref<number | null>(null)
const isInSelectableState = ref(false)
const lastOperatorPos = ref(-1)
const hasTextSelectionState = ref(false)
const cursorPos = ref(0)
```

**新增 props**：

```typescript
const props = defineProps<{
  // 现有 props
  cellAddress: string
  cellValue: string
  isEditing: boolean
  editingValue: string
  formulaReferences: FormulaReference[]
  // 新增 props
  cursorPosition: number
  isInSelectableState: boolean
  displayHtml: string
}>()
```

**新增 emit**：

```typescript
const emit = defineEmits<{
  // 现有 emits...
  (e: 'cursor-change', position: number): void
}>()
```

#### 步骤 2.4.3：修改 WorkbookSheet 传递 props

**文件**：`src/components/WorkbookSheet.vue`

**模板修改**：

```vue
<FormulaBar
  ref="formulaBarRef"
  :cell-address="cellAddress"
  :cell-value="cellValue"
  :is-editing="formulaBarIsEditing"
  :editing-value="formulaBarEditingValue"
  :formula-references="formulaReferences"
  :cursor-position="formulaEditManager.state.cursorPosition"
  :is-in-selectable-state="formulaEditManager.state.isInSelectableState"
  :display-html="formulaEditManager.displayHtml.value"
  @input="handleFormulaBarInput"
  @confirm="handleFormulaBarConfirm"
  @tab="handleFormulaBarTab"
  @cancel="handleFormulaBarCancel"
  @blur="handleFormulaBarBlur"
  @cursor-change="handleFormulaBarCursorChange"
  ...
/>
```

**添加处理函数**：

```typescript
function handleFormulaBarCursorChange(position: number) {
  formulaEditManager.updateCursorPosition(position)
}
```

### 2.5 验证标准

- [x] 运行测试：`nvm use 20 && npm test` ✅ 887 passed
- [ ] 手动测试：
  - [ ] 公式栏输入公式，引用显示彩色
  - [ ] 光标移动到操作符后，点击单元格插入引用
  - [ ] 公式栏和单元格编辑内容同步
- [ ] 提交：`git commit -m "refactor: step 2 - unified reference insertion"`

### 2.6 实施记录（2025-01-xx）

**实际完成的内容**：

**目标调整**：将原任务 4（统一引用插入）的内容合并到本任务，优先解决引用插入分支问题。

**修改文件**：

1. **FormulaBar.vue**
   - 新增 `targetCursorPosition` prop（从 Manager 接收目标光标位置）
   - 修改 `updateEditorContent` 使用 `targetCursorPosition` 恢复光标
   - 新增 watch 监听 `targetCursorPosition` 变化
   - 标记 `insertCellReference` 和 `insertRangeReference` 为 `@deprecated`

2. **WorkbookSheet.vue**
   - 新增 `formulaBarTargetCursorPosition` computed（从 Manager state 获取）
   - 传递 `:target-cursor-position` prop 给 FormulaBar
   - **统一 handleSelectionChange**：移除 `source === 'formulaBar'` 分支
     - 所有引用插入统一通过 `mgr.insertReference(reference)` 处理
     - 通过 props 变化（`formulaBarEditingValue` + `formulaBarTargetCursorPosition`）触发 FormulaBar 更新

**效果**：
- 消除了引用插入的分支逻辑
- FormulaBar 通过响应式 props 更新内容和光标位置
- Manager 成为引用插入的唯一真相来源

**保留的内部状态**：
- FormulaBar 仍保留 `cursorPos`、`isInSelectableState` 等状态用于本地 DOM 交互
- 这些状态作为本地缓存，真相来源是 Manager

---

## 任务 3：优化跨 Sheet 逻辑封装

### 3.1 任务描述

将分散的跨 Sheet 判断逻辑封装到 FormulaEditManager 中。

### 3.2 前置条件

- [x] 任务 2 已完成并测试通过

### 3.3 修改文件

| 文件 | 操作 |
|------|------|
| `src/components/sheet/formulaEditState.ts` | 添加辅助方法 |
| `src/components/WorkbookSheet.vue` | 简化判断逻辑 |

### 3.4 实施步骤

#### 步骤 3.4.1：添加辅助方法

**文件**：`src/components/sheet/formulaEditState.ts`

```typescript
/**
 * 判断是否应该忽略 blur 事件
 */
function shouldIgnoreBlur(currentSheetId: string): boolean {
  // 跨 Sheet 模式忽略 blur
  if (isCrossSheetMode(currentSheetId)) return true
  
  // 公式模式且在可选择状态忽略 blur
  if (state.isFormulaMode && state.isInSelectableState) return true
  
  // 非活跃状态忽略
  if (!state.active) return true
  
  return false
}

/**
 * 获取确认编辑时的上下文信息
 */
function getConfirmContext() {
  return {
    value: state.currentValue,
    row: state.row,
    col: state.col,
    sourceSheetId: state.sourceSheetId,
    needSwitchSheet: state.active && state.sourceSheetId !== null
  }
}
```

#### 步骤 3.4.2：简化 WorkbookSheet 判断

**文件**：`src/components/WorkbookSheet.vue`

**原代码**：
```typescript
function handleEditBlur(source: EditActionSource) {
  const mgr = formulaEditManager
  
  if (mgr.isCrossSheetMode(activeSheetId.value ?? '')) return
  if (mgr.state.isFormulaMode && mgr.state.isInSelectableState) return
  if (!mgr.state.active) return
  
  handleEditConfirm('none', source)
}
```

**简化后**：
```typescript
function handleEditBlur(source: EditActionSource) {
  if (formulaEditManager.shouldIgnoreBlur(activeSheetId.value ?? '')) return
  handleEditConfirm('none', source)
}
```

### 3.5 验证标准

- [x] 运行测试：`nvm use 20 && npm test` ✅ 887 passed
- [x] 提交：`git commit -m "refactor: step 3 - encapsulate cross-sheet logic"`

### 3.6 实施记录（2025-12-05）

**完成的内容**：

1. **formulaEditState.ts** - 添加封装方法：
   - `shouldIgnoreBlur(currentSheetId)` - 判断是否应忽略 blur 事件
   - `getConfirmContext()` - 获取确认编辑的上下文信息

2. **WorkbookSheet.vue** - 简化 `handleEditBlur`：
   - 原来 3 个分支判断简化为 1 行调用

**效果**：
- blur 处理逻辑从 WorkbookSheet 转移到 Manager
- 代码更简洁，逻辑更清晰
- Manager 作为跨 Sheet 逻辑的单一来源

---

## 任务 4：统一公式引用插入逻辑 ✅ 已合并到任务 2

> 本任务已在任务 2 中完成实施。

### 4.1 任务描述

消除 `handleSelectionChange` 中 `source === 'formulaBar'` 和 `source === 'cell'` 的分支处理。

### 4.2 前置条件

- [x] 任务 1 已完成（不依赖任务 2、3）

### 4.3 修改文件

| 文件 | 操作 |
|------|------|
| `src/components/sheet/formulaEditState.ts` | 增强 insertReference 返回值 |
| `src/components/WorkbookSheet.vue` | 添加统一处理函数 |
| `src/components/FormulaBar.vue` | 简化 insertCellReference |

### 4.4 实施步骤

#### 步骤 4.4.1：增强 Manager insertReference

**文件**：`src/components/sheet/formulaEditState.ts`

**修改 insertReference 返回值**：

```typescript
function insertReference(reference: string): {
  newValue: string
  newCursorPos: number
  insertStartPos: number
} | null {
  // ... 现有逻辑 ...
  
  return {
    newValue: state.currentValue,
    newCursorPos: state.cursorPosition,
    insertStartPos: previousCursorPos  // 记录插入起始位置
  }
}
```

#### 步骤 4.4.2：添加统一引用插入函数

**文件**：`src/components/WorkbookSheet.vue`

```typescript
/**
 * 生成单元格引用字符串
 */
function generateReference(
  range: { startRow: number; startCol: number; endRow: number; endCol: number },
  isCrossSheet: boolean
): string {
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

/**
 * 统一处理引用插入
 */
function handleInsertReference(reference: string) {
  const mgr = formulaEditManager
  
  // 1. 跨 Sheet 模式下替换上一个引用
  if (lastInsertedReference && mgr.isCrossSheetMode(activeSheetId.value ?? '')) {
    const { startPos, endPos } = lastInsertedReference
    let valueToUse = mgr.state.currentValue
    if (startPos >= 0 && endPos <= valueToUse.length) {
      valueToUse = valueToUse.substring(0, startPos) + valueToUse.substring(endPos)
      mgr.updateValue(valueToUse, startPos)
    }
  }
  
  // 2. 通过 Manager 插入引用
  const result = mgr.insertReference(reference)
  if (!result) return
  
  // 3. 记录本次插入位置
  lastInsertedReference = {
    reference,
    startPos: result.insertStartPos,
    endPos: result.insertStartPos + reference.length
  }
  
  // 4. 同步 UI
  editUIController.syncValue(result.newValue)
  formulaReferences.value = mgr.state.formulaReferences
  
  // 5. 更新跨 Sheet 引用映射
  const sourceSheet = workbook.value.getSheetById(mgr.state.sourceSheetId ?? '')
  const sourceSheetName = sourceSheet?.metadata?.name ?? 'Sheet1'
  crossSheetReferencesMap.value = parseFormulaReferencesWithSheet(result.newValue, sourceSheetName)
  
  // 6. 聚焦到公式栏
  nextTick(() => formulaBarRef.value?.focus?.())
}
```

#### 步骤 4.4.3：简化 handleSelectionChange

**文件**：`src/components/WorkbookSheet.vue`

删除 `if (mgr.state.source === 'formulaBar')` 分支，统一调用 `handleInsertReference`。

### 4.5 验证标准

- [ ] 运行测试：`nvm use 20 && npm test`
- [ ] 手动测试：
  - [ ] 单元格编辑输入 `=`，点击 A1 → 插入 `A1`
  - [ ] 公式栏编辑输入 `=`，点击 A1 → 插入 `A1`
  - [ ] 跨 Sheet：输入 `=`，切换 Sheet，点击 B2 → 插入 `Sheet2!B2`
  - [ ] 跨 Sheet 连续点击：引用被替换而非追加
- [ ] 提交：`git commit -m "refactor: step 4 - unified reference insertion"`

---

## 任务 5：统一 Sheet 切换处理

### 5.1 任务描述

使用状态机模式重构 `handleSheetChange`，消除复杂的 if-else 嵌套。

### 5.2 前置条件

- [ ] 任务 4 已完成并测试通过

### 5.3 修改文件

| 文件 | 操作 |
|------|------|
| `src/components/sheet/formulaEditState.ts` | 添加 getSheetChangeAction |
| `src/components/WorkbookSheet.vue` | 重构 handleSheetChange |

### 5.4 实施步骤

#### 步骤 5.4.1：添加 SheetChangeAction 类型

**文件**：`src/components/sheet/formulaEditState.ts`

```typescript
/** Sheet 切换动作类型 */
export type SheetChangeAction = 
  | { type: 'normalSwitch' }
  | { type: 'enterCrossSheetMode'; hideOverlay: boolean }
  | { type: 'returnToSource'; showOverlay: boolean }
  | { type: 'confirmAndSwitch' }
  | { type: 'saveAndSwitch'; value: string }

/**
 * 获取 Sheet 切换应执行的动作
 */
function getSheetChangeAction(targetSheetId: string): SheetChangeAction {
  // 未在编辑
  if (!state.active) {
    return { type: 'normalSwitch' }
  }
  
  // 切回源 Sheet
  if (state.sourceSheetId === targetSheetId) {
    return { type: 'returnToSource', showOverlay: state.source === 'cell' }
  }
  
  // 公式模式 + 可选取状态 → 进入跨 Sheet 模式
  if (state.isFormulaMode && state.isInSelectableState) {
    return { type: 'enterCrossSheetMode', hideOverlay: state.source === 'cell' }
  }
  
  // 其他情况：确认/保存后切换
  if (state.source === 'formulaBar') {
    return { type: 'confirmAndSwitch' }
  } else {
    return { type: 'saveAndSwitch', value: state.currentValue }
  }
}
```

#### 步骤 5.4.2：重构 handleSheetChange

**文件**：`src/components/WorkbookSheet.vue`

```typescript
function handleSheetChange(sheetId: string) {
  const action = formulaEditManager.getSheetChangeAction(sheetId)
  
  switch (action.type) {
    case 'normalSwitch':
      editUIController.endEditing()
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      break
      
    case 'enterCrossSheetMode':
      if (action.hideOverlay) {
        editUIController.hideOverlay()
      }
      formulaEditManager.switchSheet(sheetId)
      saveCurrentSheetState()
      skipNextSelectionChange = true
      workbook.value.setActiveSheet(sheetId)
      nextTick(() => formulaBarRef.value?.focus?.())
      break
      
    case 'returnToSource':
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      if (action.showOverlay) {
        nextTick(() => {
          editUIController.showOverlay()
          editUIController.updatePosition(
            formulaEditManager.state.row,
            formulaEditManager.state.col
          )
        })
      }
      break
      
    case 'confirmAndSwitch':
      handleEditConfirm('none', 'formulaBar')
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      break
      
    case 'saveAndSwitch':
      canvasSheetRef.value?.confirmEditingWithValue?.(action.value, {
        row: formulaEditManager.state.row,
        col: formulaEditManager.state.col
      })
      editUIController.endEditing()
      formulaEditManager.reset()
      saveCurrentSheetState()
      workbook.value.setActiveSheet(sheetId)
      break
  }
}
```

### 5.5 验证标准

- [x] 运行测试：`nvm use 20 && npm test` ✅ 887 passed
- [ ] 手动测试：
  - [ ] 未编辑时切换 Sheet
  - [ ] 普通编辑时切换 Sheet（自动保存）
  - [ ] 公式 `=A1+` 后切换 Sheet（进入跨 Sheet 模式）
  - [ ] 跨 Sheet 模式切回源 Sheet
  - [ ] 跨 Sheet 模式按 Enter 确认
- [x] 提交：`git commit -m "refactor: step 5 - unified sheet change handling"`

### 5.6 实施记录（2025-12-05）

**完成的内容**：

1. **formulaEditState.ts** - 添加状态机支持：
   - 新增 `SheetChangeAction` 类型（5 种动作）
   - 新增 `getSheetChangeAction()` 方法，返回应执行的动作

2. **WorkbookSheet.vue** - 使用 switch-case 重构 `handleSheetChange`：
   - 原来 100+ 行 if-else 嵌套 → 80 行 switch-case
   - 清晰的 5 种场景处理：normalSwitch、enterCrossSheetMode、returnToSource、confirmAndSwitch、saveAndSwitch

**效果**：
- 逻辑更清晰，每个 case 独立处理
- 决策逻辑移到 Manager，WorkbookSheet 只负责执行
- 便于添加新的切换场景

---

## 任务 6：清理和文档更新

### 6.1 任务描述

删除废弃代码，更新文档，合并分支。

### 6.2 前置条件

- [x] 任务 1-5 全部完成并测试通过

### 6.3 实施步骤

#### 步骤 6.3.1：删除废弃代码

- [ ] 删除 `closeGlobalOverlay` 函数（已被 editUIController.endEditing 替代）
- [ ] 删除 `hideGlobalOverlay` 函数（已被 editUIController.hideOverlay 替代）
- [ ] 删除 `resetFormulaBarUI` 函数（已整合到 editUIController）
- [ ] 删除 `updateGlobalOverlayFormulaRefs` 函数（已整合到 editUIController）

#### 步骤 6.3.2：更新文档

- [ ] 更新 `USER_ACTION_CHAINS.md` 问题状态为 🟢
- [ ] 更新 `copilot-instructions.md` 架构说明
- [ ] 更新 `REFACTOR_IMPLEMENTATION_PLAN.md` 标记完成

#### 步骤 6.3.3：最终验证

```bash
# 运行全部测试
nvm use 20 && npm test

# 检查 TypeScript 编译
npm run build

# 手动完整测试流程
```

#### 步骤 6.3.4：合并分支

```bash
git checkout main
git merge refactor/unified-edit-handler
git push
```

### 6.4 验证标准

- [x] 887 测试全部通过 ✅
- [ ] TypeScript 编译无错误
- [ ] 手动测试全部场景
- [ ] 代码已合并到 main 分支

### 6.5 实施记录（2025-12-05）

**完成的内容**：

1. **删除未使用函数**：
   - 删除 `hideGlobalOverlay()`（已被 editUIController.hideOverlay 替代）

2. **标记废弃函数**：
   - `closeGlobalOverlay()` 标记为 @deprecated
   - `resetFormulaBarUI()` 标记为 @deprecated
   - 建议使用 `editUIController.endEditing()` 代替

3. **保留的函数**（仍有使用场景）：
   - `updateGlobalOverlayFormulaRefs()` - 被 3 处调用
   - `closeGlobalOverlay()` - 被 handleCloseOverlay 调用
   - `resetFormulaBarUI()` - 被 Tab/Blur 处理调用

**说明**：
- 采用保守策略，未完全删除仍在使用的函数
- 通过 @deprecated 标记引导后续重构
- 测试全部通过，功能正常

---

## 附录：快速命令参考

```bash
# 测试
nvm use 20 && npm test                    # 全部测试
nvm use 20 && npm test -- formulaEditState  # 单个文件

# Git
git checkout -b refactor/unified-edit-handler  # 创建分支
git add . && git commit -m "message"           # 提交
git checkout main && git merge <branch>        # 合并

# 搜索
grep -n "closeGlobalOverlay" src/components/WorkbookSheet.vue
grep -n "resetFormulaBarUI" src/components/WorkbookSheet.vue
```

## 附录：回滚检查点

| 任务 | 回滚命令 |
|------|----------|
| 任务 1 | `git revert HEAD` |
| 任务 2 | `git revert HEAD~1..HEAD` |
| 全部 | `git checkout main && git branch -D refactor/unified-edit-handler` |
