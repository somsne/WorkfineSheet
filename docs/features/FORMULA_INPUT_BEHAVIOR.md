# 公式输入行为规范（代理层模式）

本文档描述 WorkfineSheet 中公式栏（FormulaBar）和单元格编辑器（RichTextInput）的协调机制，采用**事件代理层模式**实现。

---

## 1. 架构概述

### 1.1 代理层模式

**核心思想**：引入 `FormulaEditManager` 作为中央协调器，统一管理编辑状态。

```
┌─────────────────────────────────────────────────────────────┐
│                    WorkbookSheet                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         FormulaEditManager (代理层/状态中心)         │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  state: {                                    │    │    │
│  │  │    active, source, row, col, value,         │    │    │
│  │  │    cursorPosition, isFormulaMode,           │    │    │
│  │  │    sourceSheetId, originalValue             │    │    │
│  │  │  }                                          │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │  methods: startEdit, switchSource, updateValue,     │    │
│  │           insertReference, confirmEdit, cancelEdit  │    │
│  └─────────────────────────────────────────────────────┘    │
│           ↑ 写入状态                    ↑ 写入状态           │
│           │                             │                    │
│           │ 读取状态 ↓                  │ 读取状态 ↓         │
│  ┌─────────────────┐            ┌─────────────────────┐     │
│  │   FormulaBar    │            │    CanvasSheet      │     │
│  │  (受控组件)     │            │   (RichTextInput)   │     │
│  │  emit('start')  │            │  emit('editing')    │     │
│  │  emit('confirm')│            │  emit('selection')  │     │
│  └─────────────────┘            └─────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **单一数据源** | 所有编辑状态存储在 FormulaEditManager |
| **受控组件** | FormulaBar 和 RichTextInput 从代理层读取状态 |
| **事件上报** | 组件通过 emit 上报用户操作，由 WorkbookSheet 调用代理层方法 |
| **焦点独占** | 任意时刻只有一个编辑源拥有焦点 |

### 1.3 编辑源定义

| 编辑源 | 触发方式 | 焦点位置 | overlay |
|--------|----------|----------|---------|
| `cell` | 双击/F2/直接打字 | RichTextInput | 显示 |
| `formulaBar` | 点击公式栏 | FormulaBar 输入框 | **不显示** |

---

## 2. FormulaEditManager 接口定义

### 2.1 状态结构

```typescript
interface FormulaEditState {
  // ===== 基础状态 =====
  active: boolean                        // 是否正在编辑
  source: 'cell' | 'formulaBar' | null   // 编辑源
  
  // ===== 位置信息 =====
  sourceSheetId: string                  // 源 Sheet ID（跨 Sheet 时使用）
  row: number                            // 编辑单元格行
  col: number                            // 编辑单元格列
  
  // ===== 值信息 =====
  originalValue: string                  // 编辑前的原始值（取消时恢复）
  currentValue: string                   // 当前编辑值
  cursorPosition: number                 // 光标位置
  
  // ===== 公式模式 =====
  isFormulaMode: boolean                 // 是否以 = 开头
  isInSelectableState: boolean           // 光标是否在可插入引用位置
}
```

### 2.2 方法定义

```typescript
interface FormulaEditManager {
  // 只读状态
  readonly state: FormulaEditState
  
  // ===== 生命周期 =====
  
  /** 开始编辑 */
  startEdit(options: {
    source: 'cell' | 'formulaBar'
    sheetId: string
    row: number
    col: number
    value: string
    mode?: 'edit' | 'typing'  // typing 模式会清空原值
  }): void
  
  /** 切换编辑源（不结束编辑） */
  switchSource(newSource: 'cell' | 'formulaBar'): void
  
  /** 确认编辑，返回保存信息 */
  confirmEdit(): {
    sheetId: string
    row: number
    col: number
    value: string
  } | null
  
  /** 取消编辑 */
  cancelEdit(): void
  
  /** 重置状态 */
  reset(): void
  
  // ===== 值操作 =====
  
  /** 更新编辑值 */
  updateValue(value: string, cursorPos?: number): void
  
  /** 插入单元格引用 */
  insertReference(reference: string): {
    newValue: string
    newCursorPos: number
  }
  
  // ===== 跨 Sheet =====
  
  /** 切换 Sheet（跨 Sheet 公式模式） */
  switchSheet(sheetId: string): void
  
  /** 是否处于跨 Sheet 模式 */
  isCrossSheetMode(currentSheetId: string): boolean
}
```

### 2.3 状态计算

```typescript
// 是否为公式模式
const isFormulaMode = computed(() => 
  state.currentValue.startsWith('=')
)

// 是否可插入引用（光标前是操作符）
const isInSelectableState = computed(() => {
  if (!isFormulaMode.value) return false
  return isInSelectablePosition(state.currentValue, state.cursorPosition)
})

// 是否跨 Sheet 模式
const isCrossSheetMode = (currentSheetId: string) => {
  return state.active && 
         state.isFormulaMode && 
         state.source === 'formulaBar' &&
         state.sourceSheetId !== currentSheetId
}
```

---

## 3. 编辑流程详解

### 3.1 单元格编辑流程 (source = 'cell')

```
用户双击单元格 / 按 F2 / 直接打字
    ↓
CanvasSheet: 检测到编辑触发
    ↓
CanvasSheet: emit('editing-state-change', { isEditing: true, ... })
    ↓
WorkbookSheet: 
    formulaEditManager.startEdit({
      source: 'cell',
      sheetId: activeSheetId,
      row, col, value, mode
    })
    ↓
CanvasSheet: overlay.visible = true, RichTextInput 获得焦点
    ↓
FormulaBar: 读取 state.currentValue 只读显示（不获得焦点）
    ↓
用户输入 → RichTextInput 处理 → emit('editing-state-change')
    ↓
WorkbookSheet: formulaEditManager.updateValue(newValue, cursorPos)
    ↓
用户按 Enter
    ↓
CanvasSheet: emit('confirm')
    ↓
WorkbookSheet: formulaEditManager.confirmEdit() → 保存
```

### 3.2 公式栏编辑流程 (source = 'formulaBar')

```
用户点击公式栏输入区
    ↓
FormulaBar: emit('start-edit')
    ↓
WorkbookSheet:
    formulaEditManager.startEdit({
      source: 'formulaBar',
      sheetId: activeSheetId,
      row, col, value, mode: 'edit'
    })
    ↓
【关键】CanvasSheet overlay 不显示
    ↓
FormulaBar: 获得焦点，进入编辑模式
    ↓
用户输入 → FormulaBar 处理 → emit('input', value, cursorPos)
    ↓
WorkbookSheet: formulaEditManager.updateValue(value, cursorPos)
    ↓
用户按 Enter
    ↓
FormulaBar: emit('confirm')
    ↓
WorkbookSheet:
    result = formulaEditManager.confirmEdit()
    canvasSheetRef.setCellValue(result.row, result.col, result.value)
```

### 3.3 编辑源切换流程

**场景：单元格编辑中 → 点击公式栏**

```
用户正在单元格编辑（source = 'cell'）
    ↓
用户点击公式栏
    ↓
FormulaBar: emit('focus')
    ↓
WorkbookSheet: formulaEditManager.switchSource('formulaBar')
    ↓
【关键变化】:
  - source: 'cell' → 'formulaBar'
  - RichTextInput 失去焦点（但 overlay 可保持可见）
  - FormulaBar 获得焦点
  - currentValue 保持不变
    ↓
用户继续在公式栏编辑
```

**场景：公式栏编辑中 → 双击单元格**

```
用户正在公式栏编辑（source = 'formulaBar'）
    ↓
用户双击单元格
    ↓
CanvasSheet: emit('request-edit', { row, col })
    ↓
WorkbookSheet: formulaEditManager.switchSource('cell')
    ↓
【关键变化】:
  - source: 'formulaBar' → 'cell'
  - FormulaBar 失去焦点
  - CanvasSheet 打开 overlay
  - RichTextInput 获得焦点
  - currentValue 同步到 overlay
```

---

## 4. 公式模式与引用插入

### 4.1 公式模式识别

当 `currentValue.startsWith('=')` 时进入公式模式：
- 启用单元格引用彩色高亮
- 允许点击/拖拽单元格插入引用

### 4.2 可插入引用位置判断

**规则**：光标前一个非空白字符必须是操作符

```typescript
const OPERATORS = ['=', '+', '-', '*', '/', '^', '&', '(', ',', ':', '<', '>', '!', '%']

function isInSelectablePosition(value: string, cursorPos: number): boolean {
  // 获取光标前的文本
  const textBefore = value.substring(0, cursorPos)
  // 去除尾部空白
  const trimmed = textBefore.trimEnd()
  if (trimmed.length === 0) return false
  // 检查最后一个字符
  const lastChar = trimmed[trimmed.length - 1]
  return OPERATORS.includes(lastChar)
}
```

**判断示例**：

| 值 | 光标位置 | 可插入 | 说明 |
|----|----------|--------|------|
| `=` | 1 | ✅ | 等号后 |
| `=A1+` | 4 | ✅ | 操作符后 |
| `=SUM(` | 5 | ✅ | 左括号后 |
| `=A1` | 3 | ❌ | 引用后（应替换） |
| `=SUM` | 4 | ❌ | 函数名后 |

### 4.3 引用插入 vs 替换

```typescript
function insertReference(reference: string): InsertReferenceResult {
  const { currentValue, cursorPosition } = state
  
  // 检查光标位置是否在现有引用内
  const existingRef = findReferenceAtPosition(currentValue, cursorPosition)
  
  if (existingRef) {
    // 替换现有引用
    const newValue = currentValue.substring(0, existingRef.start) +
                     reference +
                     currentValue.substring(existingRef.end)
    const newCursorPos = existingRef.start + reference.length
    return { newValue, newCursorPos, action: 'replace' }
  } else {
    // 插入新引用
    const newValue = currentValue.substring(0, cursorPosition) +
                     reference +
                     currentValue.substring(cursorPosition)
    const newCursorPos = cursorPosition + reference.length
    return { newValue, newCursorPos, action: 'insert' }
  }
}
```

### 4.4 不同编辑源的引用插入

**单元格编辑源 (source = 'cell')**：
```
用户点击其他单元格
    ↓
CanvasSheet.handleMouseDown: 
    检测到 isFormulaMode && isInSelectableState
    ↓
RichTextInput: 直接插入引用到输入框
    ↓
emit('editing-state-change') → 同步到代理层
```

**公式栏编辑源 (source = 'formulaBar')**：
```
用户点击单元格
    ↓
CanvasSheet: emit('selection-change')
    ↓
WorkbookSheet.handleSelectionChange:
    检测到 state.active && state.isFormulaMode && state.isInSelectableState
    ↓
formulaEditManager.insertReference(reference)
    ↓
FormulaBar: 读取更新后的 state.currentValue
```

---

## 5. 跨 Sheet 公式引用

### 5.1 基本规则

| 条件 | 行为 |
|------|------|
| 单元格编辑 + 切换 Sheet | **结束编辑**，正常切换 |
| 公式栏编辑非公式 + 切换 Sheet | **确认编辑**，正常切换 |
| 公式栏编辑公式 + 切换 Sheet | **保持编辑**，进入跨 Sheet 模式 |

### 5.2 跨 Sheet 编辑流程

```
用户在公式栏输入 `=`
    ↓
state.isFormulaMode = true
    ↓
用户点击 Sheet2 标签
    ↓
WorkbookSheet.handleSheetChange:
    检测到 state.active && state.isFormulaMode && state.source === 'formulaBar'
    ↓
workbook.setActiveSheet('sheet2')  // 切换显示
    // 不调用 formulaEditManager.confirmEdit() // 保持编辑状态
    ↓
用户点击 Sheet2 的 A1 单元格
    ↓
CanvasSheet: emit('selection-change')
    ↓
WorkbookSheet.handleSelectionChange:
    检测到跨 Sheet 公式模式
    const sheetName = workbook.getActiveSheetName()  // "Sheet2"
    const reference = `${sheetName}!A1`  // 或 `'Sheet 2'!A1`
    formulaEditManager.insertReference(reference)
    ↓
state.currentValue = "=Sheet2!A1"
    ↓
用户按 Enter
    ↓
FormulaBar: emit('confirm')
    ↓
WorkbookSheet.handleFormulaBarConfirm:
    result = formulaEditManager.confirmEdit()
    // result.sheetId = 'sheet1' (源 Sheet)
    workbook.setActiveSheet(result.sheetId)  // 切回源 Sheet
    canvasSheetRef.setCellValue(result.row, result.col, result.value)
```

### 5.3 跨 Sheet 引用格式

```typescript
function formatCrossSheetReference(
  sheetName: string, 
  row: number, 
  col: number
): string {
  const cellRef = getCellAddress(row, col)  // "A1"
  
  // 如果 Sheet 名包含空格或特殊字符，需要用单引号包裹
  if (/[\s'!]/.test(sheetName)) {
    const escaped = sheetName.replace(/'/g, "''")  // 转义单引号
    return `'${escaped}'!${cellRef}`
  }
  return `${sheetName}!${cellRef}`
}
```

详细规范见 [CROSS_SHEET_INPUT_BEHAVIOR.md](./CROSS_SHEET_INPUT_BEHAVIOR.md)

---

## 6. 键盘操作

### 6.1 非编辑状态

| 按键 | 行为 |
|------|------|
| 方向键 | 移动选区 |
| Enter | 进入单元格编辑 (source = 'cell') |
| F2 | 进入单元格编辑 (source = 'cell') |
| 可打印字符 | 进入 typing 模式 (source = 'cell', 清空原值) |
| Delete | 删除选中单元格内容 |

### 6.2 编辑状态

| 按键 | source = 'cell' | source = 'formulaBar' |
|------|-----------------|----------------------|
| Enter | 确认，移到下一行 | 确认，保持当前单元格 |
| Shift+Enter | 确认，移到上一行 | 确认，保持当前单元格 |
| Tab | 确认，移到右边 | 确认，移到右边 |
| Escape | 取消编辑 | 取消编辑 |
| 方向键 | 移动光标 / 插入引用（公式模式） | 移动光标 |

### 6.3 公式模式方向键行为（可选功能）

公式模式下，在可插入引用位置按方向键：

| 按键 | 行为 |
|------|------|
| ↑ | 选区上移，插入/更新引用 |
| ↓ | 选区下移，插入/更新引用 |
| ← | 选区左移，插入/更新引用 |
| → | 选区右移，插入/更新引用 |

---

## 7. WorkbookSheet 实现代码

### 7.1 初始化代理层

```typescript
import { createFormulaEditStateManager } from '@/components/sheet/formulaEditState'

// 创建代理层实例
const formulaEditManager = createFormulaEditStateManager()
```

### 7.2 公式栏事件处理

```typescript
// 公式栏开始编辑
function handleFormulaBarStartEdit() {
  formulaEditManager.startEdit({
    source: 'formulaBar',
    sheetId: activeSheetId.value,
    row: formulaBarRow.value,
    col: formulaBarCol.value,
    value: formulaBarCellValue.value,
    mode: 'edit'
  })
  // 🔑 不调用 canvasSheetRef.startEditingCurrentCell()
}

// 公式栏输入变化
function handleFormulaBarInput(value: string, cursorPos: number) {
  formulaEditManager.updateValue(value, cursorPos)
}

// 公式栏确认
function handleFormulaBarConfirm() {
  const result = formulaEditManager.confirmEdit()
  if (!result) return
  
  // 如果跨 Sheet，先切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(result.sheetId)
  }
  
  nextTick(() => {
    canvasSheetRef.value?.setCellValue?.(result.row, result.col, result.value)
    canvasSheetRef.value?.selectCell?.(result.row, result.col)
  })
}

// 公式栏取消
function handleFormulaBarCancel() {
  const state = formulaEditManager.state
  
  // 如果跨 Sheet，先切回源 Sheet
  if (state.sourceSheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(state.sourceSheetId)
  }
  
  formulaEditManager.cancelEdit()
}
```

### 7.3 单元格编辑事件处理

```typescript
// 单元格编辑状态变化
function handleEditingStateChange(payload: EditingStatePayload) {
  if (payload.isEditing) {
    if (!formulaEditManager.state.active) {
      // 新编辑开始
      formulaEditManager.startEdit({
        source: 'cell',
        sheetId: activeSheetId.value,
        row: payload.editingRow,
        col: payload.editingCol,
        value: payload.editingValue,
        mode: payload.mode ?? 'edit'
      })
    } else {
      // 更新编辑值
      formulaEditManager.updateValue(payload.editingValue, payload.cursorPosition)
    }
  } else {
    // 编辑结束
    formulaEditManager.reset()
  }
}
```

### 7.4 选区变化处理

```typescript
// 选区变化
function handleSelectionChange(payload: SelectionPayload) {
  const state = formulaEditManager.state
  
  // 公式模式下，可插入位置，插入引用
  if (state.active && state.isFormulaMode && state.isInSelectableState) {
    let reference: string
    
    // 判断是否跨 Sheet
    if (formulaEditManager.isCrossSheetMode(activeSheetId.value)) {
      const sheetName = workbook.value.getActiveSheetName()
      reference = formatCrossSheetReference(sheetName, payload.selected.row, payload.selected.col)
    } else {
      reference = getCellAddress(payload.selected.row, payload.selected.col)
    }
    
    formulaEditManager.insertReference(reference)
    return  // 不更新公式栏显示位置
  }
  
  // 正常更新公式栏
  updateFormulaBarDisplay(payload)
}
```

### 7.5 Sheet 切换处理

```typescript
// 切换 Sheet
function handleSheetChange(sheetId: string) {
  const state = formulaEditManager.state
  
  // 公式栏编辑公式时，进入跨 Sheet 模式
  if (state.active && state.isFormulaMode && state.source === 'formulaBar') {
    // 只切换显示，不结束编辑
    workbook.value.setActiveSheet(sheetId)
    return
  }
  
  // 单元格编辑时，结束编辑
  if (state.active && state.source === 'cell') {
    canvasSheetRef.value?.confirmEditing?.()
  }
  
  // 公式栏编辑非公式时，确认编辑
  if (state.active && state.source === 'formulaBar') {
    handleFormulaBarConfirm()
  }
  
  // 正常切换
  workbook.value.setActiveSheet(sheetId)
}
```

---

## 8. 实现步骤（按顺序执行）

### 阶段 1：完善 FormulaEditManager 代理层

#### Step 1.1 - 扩展状态结构
**文件**: `src/components/sheet/formulaEditState.ts`

```typescript
// 添加 source 字段到状态
interface FormulaEditState {
  active: boolean
  source: 'cell' | 'formulaBar' | null  // 新增
  sourceSheetId: string
  row: number
  col: number
  originalValue: string
  currentValue: string
  cursorPosition: number
}
```

**验证**: 状态结构包含 `source` 字段

#### Step 1.2 - 修改 startEdit 方法
**文件**: `src/components/sheet/formulaEditState.ts`

```typescript
startEdit(options: {
  source: 'cell' | 'formulaBar'  // 新增必填参数
  sheetId: string
  row: number
  col: number
  value: string
  mode?: 'edit' | 'typing'
}): void {
  state.active = true
  state.source = options.source  // 新增
  state.sourceSheetId = options.sheetId
  state.row = options.row
  state.col = options.col
  state.originalValue = options.value
  state.currentValue = options.mode === 'typing' ? '' : options.value
  state.cursorPosition = state.currentValue.length
}
```

**验证**: `startEdit` 接受 `source` 参数并正确设置

#### Step 1.3 - 添加 switchSource 方法
**文件**: `src/components/sheet/formulaEditState.ts`

```typescript
switchSource(newSource: 'cell' | 'formulaBar'): void {
  if (!state.active) return
  state.source = newSource
  // 不改变其他状态（value, row, col 等保持不变）
}
```

**验证**: 切换 source 不会重置编辑内容

#### Step 1.4 - 添加 confirmEdit 返回 sheetId
**文件**: `src/components/sheet/formulaEditState.ts`

```typescript
confirmEdit(): { sheetId: string; row: number; col: number; value: string } | null {
  if (!state.active) return null
  const result = {
    sheetId: state.sourceSheetId,  // 返回源 Sheet ID
    row: state.row,
    col: state.col,
    value: state.currentValue
  }
  reset()
  return result
}
```

**验证**: 返回值包含 `sheetId`

#### Step 1.5 - 添加计算属性
**文件**: `src/components/sheet/formulaEditState.ts`

```typescript
// 添加到返回对象
return {
  state: readonly(state),
  
  // 计算属性
  get isFormulaMode() {
    return state.currentValue.startsWith('=')
  },
  get isInSelectableState() {
    if (!this.isFormulaMode) return false
    return isInSelectablePosition(state.currentValue, state.cursorPosition)
  },
  
  // 方法
  isCrossSheetMode(currentSheetId: string) {
    return state.active && 
           this.isFormulaMode && 
           state.source === 'formulaBar' &&
           state.sourceSheetId !== currentSheetId
  },
  
  // ... 其他方法
}
```

**验证**: 可以通过 `manager.isFormulaMode` 访问计算属性

---

### 阶段 2：WorkbookSheet 集成代理层

#### Step 2.1 - 引入 FormulaEditManager
**文件**: `src/components/WorkbookSheet.vue`

```typescript
import { createFormulaEditStateManager } from '@/components/sheet/formulaEditState'

// setup 中
const formulaEditManager = createFormulaEditStateManager()
```

**验证**: WorkbookSheet 可以访问 `formulaEditManager`

#### Step 2.2 - 修改 handleEditingStateChange
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleEditingStateChange(payload: EditingStatePayload) {
  if (payload.isEditing) {
    if (!formulaEditManager.state.active) {
      // 单元格开始编辑 → 通知代理层
      formulaEditManager.startEdit({
        source: 'cell',  // 关键：标记来源
        sheetId: activeSheetId.value,
        row: payload.editingRow,
        col: payload.editingCol,
        value: payload.editingValue,
        mode: payload.mode ?? 'edit'
      })
    } else if (formulaEditManager.state.source === 'cell') {
      // 同源更新
      formulaEditManager.updateValue(payload.editingValue, payload.cursorPosition)
    }
    // 如果 source === 'formulaBar'，忽略（不应该发生）
  } else {
    // 编辑结束
    formulaEditManager.reset()
  }
}
```

**验证**: 单元格编辑时 `state.source === 'cell'`

#### Step 2.3 - 修改 handleFormulaBarStartEdit
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleFormulaBarStartEdit() {
  formulaEditManager.startEdit({
    source: 'formulaBar',  // 关键：标记来源
    sheetId: activeSheetId.value,
    row: formulaBarRow.value,
    col: formulaBarCol.value,
    value: formulaBarCellValue.value,
    mode: 'edit'
  })
  
  // 🔑 关键：不调用 canvasSheetRef.startEditingCurrentCell()
  // 公式栏编辑时不打开单元格 overlay
}
```

**验证**: 公式栏开始编辑时 `state.source === 'formulaBar'`，overlay 不显示

#### Step 2.4 - 修改 handleFormulaBarConfirm
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleFormulaBarConfirm() {
  const result = formulaEditManager.confirmEdit()
  if (!result) return
  
  // 如果跨 Sheet，先切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(result.sheetId)
  }
  
  // 直接保存到单元格（不依赖 overlay）
  nextTick(() => {
    canvasSheetRef.value?.setCellValue?.(result.row, result.col, result.value)
    canvasSheetRef.value?.selectCell?.(result.row, result.col)
  })
}
```

**验证**: 公式栏确认后直接保存，不依赖 overlay

#### Step 2.5 - 修改 handleFormulaBarCancel
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleFormulaBarCancel() {
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  
  // 如果跨 Sheet，先切回源 Sheet
  if (sourceSheetId && sourceSheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(sourceSheetId)
  }
  
  formulaEditManager.cancelEdit()
}
```

**验证**: 取消时正确切回源 Sheet

---

### 阶段 3：公式栏引用插入

#### Step 3.1 - 修改 handleSelectionChange 判断条件
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleSelectionChange(payload: SelectionPayload) {
  const mgr = formulaEditManager
  
  // 条件：公式栏编辑 + 公式模式 + 可插入位置
  if (mgr.state.active && 
      mgr.state.source === 'formulaBar' && 
      mgr.isFormulaMode && 
      mgr.isInSelectableState) {
    
    // 生成引用
    let reference: string
    if (mgr.isCrossSheetMode(activeSheetId.value)) {
      const sheetName = workbook.value.getActiveSheetName()
      reference = formatCrossSheetReference(sheetName, payload.selected.row, payload.selected.col)
    } else {
      reference = getCellAddress(payload.selected.row, payload.selected.col)
    }
    
    // 插入引用
    mgr.insertReference(reference)
    
    // 不更新公式栏显示位置（保持显示源单元格位置）
    return
  }
  
  // 正常更新公式栏显示
  updateFormulaBarDisplay(payload)
}
```

**验证**: 公式栏编辑公式时，点击单元格插入引用

#### Step 3.2 - FormulaBar 读取代理层状态
**文件**: `src/components/FormulaBar.vue`

```typescript
// props 新增
interface Props {
  // ... 现有 props
  editingValue?: string       // 从代理层读取的编辑值
  isFormulaBarEditing?: boolean  // 是否公式栏正在编辑
}

// computed
const displayValue = computed(() => {
  if (props.isFormulaBarEditing) {
    return props.editingValue ?? ''
  }
  return props.cellValue
})
```

**验证**: FormulaBar 根据 `isFormulaBarEditing` 显示不同内容

#### Step 3.3 - WorkbookSheet 传递代理层状态给 FormulaBar
**文件**: `src/components/WorkbookSheet.vue`

```html
<FormulaBar
  :row="formulaBarRow"
  :col="formulaBarCol"
  :cell-value="formulaBarCellValue"
  :editing-value="formulaEditManager.state.currentValue"
  :is-formula-bar-editing="formulaEditManager.state.source === 'formulaBar'"
  @start-edit="handleFormulaBarStartEdit"
  @input="handleFormulaBarInput"
  @confirm="handleFormulaBarConfirm"
  @cancel="handleFormulaBarCancel"
/>
```

**验证**: FormulaBar 在公式栏编辑时显示 `editingValue`

---

### 阶段 4：编辑源切换

#### Step 4.1 - FormulaBar 发送 focus 事件
**文件**: `src/components/FormulaBar.vue`

```typescript
// 输入框获得焦点时
function handleInputFocus() {
  emit('focus')
}
```

```html
<input @focus="handleInputFocus" />
```

**验证**: 点击公式栏触发 `focus` 事件

#### Step 4.2 - WorkbookSheet 处理 focus 事件
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleFormulaBarFocus() {
  const mgr = formulaEditManager
  
  if (mgr.state.active && mgr.state.source === 'cell') {
    // 从单元格切换到公式栏
    // 1. 先从 RichTextInput 获取最新值
    const currentValue = canvasSheetRef.value?.getCurrentEditingValue?.() ?? mgr.state.currentValue
    mgr.updateValue(currentValue)
    
    // 2. 切换编辑源
    mgr.switchSource('formulaBar')
    
    // 3. 关闭单元格 overlay（可选，也可以保持显示但失去焦点）
    // canvasSheetRef.value?.closeOverlay?.()
  } else if (!mgr.state.active) {
    // 未在编辑，开始公式栏编辑
    handleFormulaBarStartEdit()
  }
  // 如果已经是 formulaBar 源，不做任何事
}
```

**验证**: 单元格编辑中点击公式栏，source 切换为 'formulaBar'

#### Step 4.3 - CanvasSheet 处理 source='formulaBar' 时的双击
**文件**: `src/components/CanvasSheet.vue` (或对应 composable)

```typescript
// 双击单元格时
function handleCellDoubleClick(row: number, col: number) {
  // 通知父组件
  emit('request-edit', { row, col })
}
```

**验证**: 双击单元格时发送 `request-edit` 事件

#### Step 4.4 - WorkbookSheet 处理 request-edit 事件
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleRequestEdit(payload: { row: number; col: number }) {
  const mgr = formulaEditManager
  
  if (mgr.state.active && mgr.state.source === 'formulaBar') {
    // 从公式栏切换到单元格
    // 1. 切换编辑源
    mgr.switchSource('cell')
    
    // 2. 打开单元格 overlay，同步当前值
    nextTick(() => {
      canvasSheetRef.value?.openOverlayWithValue?.(
        mgr.state.row, 
        mgr.state.col, 
        mgr.state.currentValue
      )
    })
  } else {
    // 正常开始单元格编辑
    canvasSheetRef.value?.startEditingCell?.(payload.row, payload.col)
  }
}
```

**验证**: 公式栏编辑中双击单元格，source 切换为 'cell'，overlay 显示

---

### 阶段 5：跨 Sheet 公式引用

#### Step 5.1 - 修改 handleSheetChange
**文件**: `src/components/WorkbookSheet.vue`

```typescript
function handleSheetChange(sheetId: string) {
  const mgr = formulaEditManager
  
  // 情况1：公式栏编辑公式 → 进入跨 Sheet 模式
  if (mgr.state.active && mgr.isFormulaMode && mgr.state.source === 'formulaBar') {
    // 只切换显示，不结束编辑
    workbook.value.setActiveSheet(sheetId)
    return
  }
  
  // 情况2：单元格编辑 → 结束编辑
  if (mgr.state.active && mgr.state.source === 'cell') {
    canvasSheetRef.value?.confirmEditing?.()
  }
  
  // 情况3：公式栏编辑非公式 → 确认编辑
  if (mgr.state.active && mgr.state.source === 'formulaBar') {
    handleFormulaBarConfirm()
  }
  
  // 正常切换
  workbook.value.setActiveSheet(sheetId)
}
```

**验证**: 公式栏编辑公式时切换 Sheet，编辑状态保持

#### Step 5.2 - 跨 Sheet 选区高亮（可选）
**文件**: `src/components/CanvasSheet.vue`

```typescript
// props 新增
interface Props {
  // ...
  crossSheetFormulaState?: {
    active: boolean
    selectionColor?: string
  }
}
```

**验证**: 跨 Sheet 模式下目标 Sheet 选区显示不同颜色

---

### 阶段 6：单元测试

#### Step 6.1 - 测试 FormulaEditManager
**文件**: `src/lib/tests/formulaEditState.spec.ts`

```typescript
describe('FormulaEditManager', () => {
  it('should set source correctly on startEdit', () => {
    const mgr = createFormulaEditStateManager()
    mgr.startEdit({ source: 'cell', sheetId: 's1', row: 0, col: 0, value: 'test' })
    expect(mgr.state.source).toBe('cell')
  })
  
  it('should switch source without resetting value', () => {
    const mgr = createFormulaEditStateManager()
    mgr.startEdit({ source: 'cell', sheetId: 's1', row: 0, col: 0, value: 'hello' })
    mgr.updateValue('hello world')
    mgr.switchSource('formulaBar')
    expect(mgr.state.source).toBe('formulaBar')
    expect(mgr.state.currentValue).toBe('hello world')
  })
  
  it('should detect cross sheet mode correctly', () => {
    const mgr = createFormulaEditStateManager()
    mgr.startEdit({ source: 'formulaBar', sheetId: 's1', row: 0, col: 0, value: '=' })
    expect(mgr.isCrossSheetMode('s1')).toBe(false)
    expect(mgr.isCrossSheetMode('s2')).toBe(true)
  })
})
```

**验证**: 所有测试通过

---

## 9. 实现检查清单

### 阶段 1：FormulaEditManager ✅
- [x] 1.1 扩展状态结构（添加 source）
- [x] 1.2 修改 startEdit 方法（接受 source 参数）
- [x] 1.3 添加 switchSource 方法
- [x] 1.4 修改 confirmEdit 返回 sheetId
- [x] 1.5 添加计算属性（isFormulaMode, isInSelectableState, isCrossSheetMode）
- [x] 1.6 添加 DEBUG 日志系统

### 阶段 2：WorkbookSheet 集成 ✅
- [x] 2.1 引入 FormulaEditManager
- [x] 2.2 修改 handleEditingStateChange（source='cell'）
- [x] 2.3 修改 handleFormulaBarStartEdit（source='formulaBar'，不打开 overlay）
- [x] 2.4 修改 handleFormulaBarConfirm（直接保存）
- [x] 2.5 修改 handleFormulaBarCancel（切回源 Sheet）
- [x] 2.6 添加 DEBUG 日志系统

### 阶段 3：公式栏引用插入 ✅
- [x] 3.1 修改 handleSelectionChange（公式栏编辑时插入引用）
- [x] 3.2 FormulaBar emit('input') 包含光标位置
- [x] 3.3 WorkbookSheet handleFormulaBarInput 接收光标位置

### 阶段 4：编辑源切换 ✅
- [x] 4.1 FormulaBar 发送 focus 事件
- [x] 4.2 WorkbookSheet 处理 focus 事件（cell→formulaBar）
- [x] 4.3 CanvasSheet 发送 request-edit 事件
- [x] 4.4 WorkbookSheet 处理 request-edit 事件（formulaBar→cell）

### 阶段 5：跨 Sheet 公式引用 ✅
- [x] 5.1 修改 handleSheetChange（公式模式保持编辑）
- [x] 5.2 跨 Sheet 选区高亮（自定义颜色支持）

### 阶段 6：单元测试 ✅
- [x] 6.1 测试 FormulaEditManager switchSource
- [x] 6.2 测试 FormulaEditManager isCrossSheetMode
- [x] 6.3 测试辅助函数（getCellAddress, isInSelectablePosition, etc.）
- [x] 6.4 测试跨 Sheet 引用格式化

---

## 10. 相关文件

| 文件 | 说明 |
|------|------|
| `src/components/sheet/formulaEditState.ts` | 代理层实现 |
| `src/components/WorkbookSheet.vue` | 协调层，调用代理层方法 |
| `src/components/FormulaBar.vue` | 公式栏组件 |
| `src/components/CanvasSheet.vue` | 单元格编辑容器 |
| `src/components/RichTextInput.vue` | 单元格编辑器 |
| `docs/features/CROSS_SHEET_INPUT_BEHAVIOR.md` | 跨 Sheet 行为详细规范 |
