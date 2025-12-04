# 公式编辑系统完整文档

本文档整合了公式栏（FormulaBar）和单元格编辑器（RichTextInput/Overlay）的协调机制，以及跨 Sheet 公式引用的完整实现。

---

## 1. 系统架构

### 1.1 核心设计：FormulaEditManager 代理层

**FormulaEditManager 是整个公式编辑系统的核心**，它作为中央协调器统一管理所有编辑状态。

```
┌─────────────────────────────────────────────────────────────────┐
│                      WorkbookSheet                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │          FormulaEditManager (代理层/状态中心)              │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  state: {                                            │  │  │
│  │  │    active,           // 是否正在编辑                  │  │  │
│  │  │    source,           // 编辑源: 'cell' | 'formulaBar'│  │  │
│  │  │    sourceSheetId,    // 源 Sheet ID（跨Sheet关键）    │  │  │
│  │  │    row, col,         // 编辑单元格位置                │  │  │
│  │  │    originalValue,    // 原始值（取消时恢复）          │  │  │
│  │  │    currentValue,     // 当前编辑值                    │  │  │
│  │  │    cursorPosition,   // 光标位置                      │  │  │
│  │  │    isFormulaMode,    // 是否公式模式（以=开头）       │  │  │
│  │  │    isInSelectableState, // 是否可插入引用             │  │  │
│  │  │    formulaReferences // 公式引用列表（彩色高亮用）    │  │  │
│  │  │  }                                                   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  methods:                                                  │  │
│  │    startEdit, switchSource, updateValue, confirmEdit,     │  │
│  │    cancelEdit, reset, insertReference, isCrossSheetMode   │  │
│  └───────────────────────────────────────────────────────────┘  │
│            ↑ 写入状态                      ↑ 写入状态            │
│            │                               │                     │
│            │ 读取状态 ↓                    │ 读取状态 ↓          │
│  ┌─────────────────────┐          ┌─────────────────────────┐   │
│  │     FormulaBar      │          │      CanvasSheet        │   │
│  │    (受控组件)       │          │    (Overlay/Input)      │   │
│  │  emit('start-edit') │          │  emit('editing-state')  │   │
│  │  emit('input')      │          │  emit('selection')      │   │
│  │  emit('confirm')    │          │  emit('request-edit')   │   │
│  │  emit('cancel')     │          │                         │   │
│  │  emit('tab')        │          │                         │   │
│  │  emit('blur')       │          │                         │   │
│  │  emit('focus')      │          │                         │   │
│  └─────────────────────┘          └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **单一数据源** | 所有编辑状态存储在 FormulaEditManager |
| **受控组件** | FormulaBar 和 RichTextInput 从代理层读取状态 |
| **事件上报** | 组件通过 emit 上报用户操作，WorkbookSheet 调用代理层方法 |
| **焦点独占** | 任意时刻只有一个编辑源拥有焦点 |
| **内容同步** | 公式栏编辑时，单元格 Overlay 同步显示内容 |

### 1.3 编辑源定义

| 编辑源 | 触发方式 | 焦点位置 | Overlay 状态 |
|--------|----------|----------|--------------|
| `cell` | 双击/F2/直接打字 | RichTextInput | 显示，可编辑 |
| `formulaBar` | 点击公式栏 | FormulaBar 输入框 | 显示，只读同步 |

---

## 2. FormulaEditManager 详细接口

### 2.1 状态结构

```typescript
interface FormulaEditState {
  // ===== 基础状态 =====
  active: boolean                        // 是否正在编辑
  source: 'cell' | 'formulaBar' | null   // 编辑源
  mode: 'edit' | 'typing'                // 编辑模式
  
  // ===== 位置信息 =====
  sourceSheetId: string | null           // 源 Sheet ID（跨 Sheet 关键）
  currentSheetId: string | null          // 当前浏览的 Sheet ID
  row: number                            // 编辑单元格行
  col: number                            // 编辑单元格列
  
  // ===== 值信息 =====
  originalValue: string                  // 编辑前的原始值（取消时恢复）
  currentValue: string                   // 当前编辑值
  cursorPosition: number                 // 光标位置
  selectionRange: { start: number; end: number } | null  // 选中范围
  hasTextSelection: boolean              // 是否有文本选中
  
  // ===== 公式模式 =====
  isFormulaMode: boolean                 // 是否以 = 开头
  isInSelectableState: boolean           // 光标是否在可插入引用位置
  formulaReferences: FormulaReference[]  // 公式引用列表（彩色高亮）
}
```

### 2.2 核心方法

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
    mode?: 'edit' | 'typing'
  }): void
  
  /** 切换编辑源（不结束编辑，保持内容） */
  switchSource(newSource: 'cell' | 'formulaBar'): void
  
  /** 确认编辑，返回保存信息 */
  confirmEdit(): {
    sheetId: string
    row: number
    col: number
    value: string
  } | null
  
  /** 取消编辑，返回原始信息 */
  cancelEdit(): {
    sheetId: string
    row: number
    col: number
    value: string
  } | null
  
  /** 重置状态 */
  reset(): void
  
  // ===== 值操作 =====
  
  /** 更新编辑值 */
  updateValue(value: string, cursorPos?: number): void
  
  /** 更新光标位置 */
  updateCursorPosition(pos: number, selection?: { start: number; end: number } | null): void
  
  /** 插入单元格引用 */
  insertReference(reference: string): InsertReferenceResult | null
  
  // ===== 跨 Sheet =====
  
  /** 切换 Sheet（跨 Sheet 公式模式） */
  switchSheet(sheetId: string): void
  
  /** 是否处于跨 Sheet 模式 */
  isCrossSheetMode(currentSheetId: string): boolean
  
  // ===== 统一动作流程（新增） =====
  
  /** 动作：开始单元格编辑 */
  actionStartCellEdit(options: StartEditOptions): EditActionResult
  
  /** 动作：开始公式栏编辑 */
  actionStartFormulaBarEdit(options: StartEditOptions): EditActionResult
  
  /** 动作：切换到公式栏 */
  actionSwitchToFormulaBar(): EditActionResult
  
  /** 动作：切换到单元格 */
  actionSwitchToCell(): EditActionResult
  
  /** 动作：输入变化 */
  actionInput(value: string, cursorPos?: number): EditActionResult
  
  /** 动作：光标位置变化 */
  actionCursorPositionChange(pos: number, selection?: { start: number; end: number }): EditActionResult
  
  /** 动作：确认编辑 */
  actionConfirm(): EditActionResult
  
  /** 动作：确认并移动到右边（Tab） */
  actionConfirmAndMoveRight(): EditActionResult
  
  /** 动作：确认并移动到下一行（Enter） */
  actionConfirmAndMoveDown(): EditActionResult
  
  /** 动作：取消编辑（Escape） */
  actionCancel(): EditActionResult
  
  /** 动作：失焦确认 */
  actionBlurConfirm(): EditActionResult
  
  /** 动作：选区变化处理（公式引用插入） */
  actionSelectionChange(...): { consumed: boolean; actions: EditUIAction[] }
  
  /** 动作：Sheet 切换处理 */
  actionSheetChange(targetSheetId: string): { allowSwitch: boolean; actions: EditUIAction[]; needConfirm?: boolean }
  
  /** 动作：双击请求编辑（跨Sheet模式） */
  actionRequestEdit(row: number, col: number): EditActionResult
  
  /** 动作：单元格编辑状态变化 */
  actionEditingStateChange(payload: EditingStatePayload): EditActionResult
}
```

### 2.3 统一动作流程（新增）

所有编辑操作都封装为 `action*` 方法，返回统一的 `EditActionResult`：

```typescript
/** 动作结果 */
interface EditActionResult {
  success: boolean              // 是否成功
  actions: EditUIAction[]       // 需要执行的 UI 动作
  saveData?: SaveData           // 保存数据（confirm 返回）
  restoreData?: RestoreData     // 恢复数据（cancel 返回）
}

/** UI 动作类型 */
type EditUIAction = 
  | { type: 'openOverlay'; row: number; col: number; value: string }
  | { type: 'closeOverlay' }
  | { type: 'syncOverlayValue'; value: string }
  | { type: 'focusFormulaBar' }
  | { type: 'focusOverlay' }
  | { type: 'switchSheet'; sheetId: string }
  | { type: 'selectCell'; row: number; col: number }
  | { type: 'setCellValue'; row: number; col: number; value: string }
  | { type: 'updateFormulaBarDisplay'; row: number; col: number; value: string }
```

**使用方式**：WorkbookSheet 通过 `executeUIActions()` 函数执行动作列表：

```typescript
// 示例：公式栏确认
function handleFormulaBarConfirm() {
  const result = formulaEditManager.actionConfirm()
  if (result.success) {
    nextTick(() => executeUIActions(result.actions))
    resetFormulaBarUI()
  }
}

// 执行器函数
function executeUIActions(actions: EditUIAction[]) {
  for (const action of actions) {
    switch (action.type) {
      case 'openOverlay':
        canvasSheetRef.value?.openOverlayWithValue?.(action.row, action.col, action.value)
        break
      case 'closeOverlay':
        canvasSheetRef.value?.cancelEditing?.()
        break
      // ... 其他动作
    }
  }
}
```

### 2.4 文件位置

```
src/components/sheet/formulaEditState.ts
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
WorkbookSheet.handleEditingStateChange:
    formulaEditManager.startEdit({
      source: 'cell',
      sheetId: activeSheetId,
      row, col, value, mode
    })
    ↓
CanvasSheet: overlay.visible = true, RichTextInput 获得焦点
    ↓
FormulaBar: 显示 state.currentValue（同步显示）
    ↓
用户输入 → RichTextInput 处理 → emit('editing-state-change')
    ↓
WorkbookSheet: formulaEditManager.updateValue(newValue, cursorPos)
    ↓
用户按 Enter
    ↓
CanvasSheet: 保存并关闭 overlay
    ↓
WorkbookSheet: formulaEditManager.reset()
```

### 3.2 公式栏编辑流程 (source = 'formulaBar')

```
用户点击公式栏输入区
    ↓
FormulaBar: emit('start-edit')
    ↓
WorkbookSheet.handleFormulaBarStartEdit:
    formulaEditManager.startEdit({
      source: 'formulaBar',
      sheetId, row, col, value, mode: 'edit'
    })
    ↓
【关键】打开 CanvasSheet overlay（同步显示，但焦点在公式栏）
    canvasSheetRef.openOverlayWithValue(row, col, value)
    ↓
FormulaBar: 获得焦点，进入编辑模式
    ↓
用户输入 → FormulaBar 处理 → emit('input', value, cursorPos)
    ↓
WorkbookSheet.handleFormulaBarInput:
    formulaEditManager.updateValue(value, cursorPos)
    【关键】同步更新 overlay 内容
    canvasSheetRef.setEditingValue(value)
    ↓
用户按 Enter
    ↓
FormulaBar: emit('confirm')
    ↓
WorkbookSheet.handleFormulaBarConfirm:
    result = formulaEditManager.confirmEdit()
    canvasSheetRef.setCellValue(result.row, result.col, result.value)
    canvasSheetRef.cancelEditing()  // 关闭 overlay
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
WorkbookSheet.handleFormulaBarFocus:
    检测到 state.active && state.source === 'cell'
    → formulaEditManager.switchSource('formulaBar')
    ↓
【状态变化】:
  - source: 'cell' → 'formulaBar'
  - currentValue 保持不变
  - FormulaBar 获得焦点
  - Overlay 保持显示（内容同步）
```

**场景：公式栏编辑中 → 双击单元格**

```
用户正在公式栏编辑（source = 'formulaBar'）
    ↓
用户双击单元格
    ↓
CanvasSheet: emit('request-edit', { row, col })
    ↓
WorkbookSheet.handleRequestEdit:
    检测到公式栏公式模式
    → formulaEditManager.switchSource('cell')
    ↓
【状态变化】:
  - source: 'formulaBar' → 'cell'
  - FormulaBar 失去焦点
  - RichTextInput 获得焦点
  - currentValue 同步到 overlay
```

---

## 4. 跨 Sheet 公式引用

### 4.1 跨 Sheet 模式判断

```typescript
// FormulaEditManager 方法
isCrossSheetMode(currentSheetId: string): boolean {
  return state.active && 
         state.source === 'formulaBar' &&  // 必须是公式栏编辑
         state.isFormulaMode &&             // 必须是公式模式
         state.sourceSheetId !== currentSheetId  // 当前 Sheet 不是源 Sheet
}
```

### 4.2 编辑源与跨 Sheet 行为

| 编辑源 | 切换 Sheet 时行为 | 原因 |
|--------|------------------|------|
| `cell` | **结束编辑**，正常切换 | RichTextInput 是 Sheet 内组件，切换后会销毁 |
| `formulaBar` + 非公式 | **确认编辑**，正常切换 | 非公式无需跨 Sheet 引用 |
| `formulaBar` + 公式 | **保持编辑**，进入跨 Sheet 模式 | 公式栏是全局组件，可跨 Sheet 保持状态 |

### 4.3 跨 Sheet 编辑流程

```
1. 用户点击公式栏，开始编辑
   ↓
   FormulaEditManager.startEdit({ source: 'formulaBar', ... })

2. 用户输入 `=`
   ↓
   FormulaEditManager: isFormulaMode = true

3. 用户点击其他 Sheet 标签
   ↓
   WorkbookSheet.handleSheetChange():
     检测到 state.source === 'formulaBar' && isFormulaMode
     → 只切换 Sheet 显示，不结束编辑
   ↓
   FormulaEditManager: isCrossSheetMode(currentSheetId) = true

4. 用户点击目标 Sheet 的单元格
   ↓
   CanvasSheet: emit('selection-change')
   ↓
   WorkbookSheet.handleSelectionChange():
     检测到 isCrossSheetMode && isInSelectableState
     → 生成跨 Sheet 引用（如 `Sheet2!A1`）
     → FormulaEditManager.insertReference(reference)

5. 用户按 Enter 确认
   ↓
   FormulaBar: emit('confirm')
   ↓
   WorkbookSheet.handleFormulaBarConfirm():
     result = FormulaEditManager.confirmEdit()
     → 切换回 result.sheetId（源 Sheet）
     → canvasSheetRef.setCellValue(result.row, result.col, result.value)
```

### 4.4 跨 Sheet 引用格式

```typescript
function formatCrossSheetReference(
  sheetName: string, 
  startRow: number, 
  startCol: number,
  endRow?: number,
  endCol?: number
): string {
  // 需要引号包裹的情况：空格、单引号、感叹号、方括号
  const needsQuotes = /[\s'!\[\]]/.test(sheetName)
  const quotedName = needsQuotes 
    ? `'${sheetName.replace(/'/g, "''")}'`  // 单引号转义
    : sheetName
  
  const startAddr = getCellAddress(startRow, startCol)
  
  if (endRow !== undefined && endCol !== undefined && 
      (endRow !== startRow || endCol !== startCol)) {
    const endAddr = getCellAddress(endRow, endCol)
    return `${quotedName}!${startAddr}:${endAddr}`
  }
  
  return `${quotedName}!${startAddr}`
}
```

| Sheet 名称 | 生成的引用 |
|-----------|-----------|
| `Sheet1` | `Sheet1!A1` |
| `Sheet 2` | `'Sheet 2'!A1` |
| `销售数据` | `销售数据!A1` |
| `It's mine` | `'It''s mine'!A1` |

---

## 5. 键盘操作规范

### 5.1 FormulaBar 键盘事件

| 按键 | 行为 | emit 事件 |
|------|------|-----------|
| Enter | 确认编辑，移到下一行 | `confirm` |
| Tab | 确认编辑，移到右边 | `tab` |
| Escape | 取消编辑，恢复原值 | `cancel` |
| 其他 | 正常输入 | `input` |

### 5.2 WorkbookSheet 键盘处理

```typescript
// handleFormulaBarConfirm - Enter 键
function handleFormulaBarConfirm() {
  const result = formulaEditManager.confirmEdit()
  if (!result) return
  
  // 跨 Sheet 时先切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(result.sheetId)
  }
  
  nextTick(() => {
    canvasSheetRef.value?.setCellValue?.(result.row, result.col, result.value)
    canvasSheetRef.value?.cancelEditing?.()
    // Enter 后移动到下一行由 CanvasSheet 处理
  })
}

// handleFormulaBarTab - Tab 键
function handleFormulaBarTab() {
  const result = formulaEditManager.confirmEdit()
  if (!result) return
  
  // 跨 Sheet 时先切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(result.sheetId)
  }
  
  nextTick(() => {
    canvasSheetRef.value?.setCellValue?.(result.row, result.col, result.value)
    canvasSheetRef.value?.cancelEditing?.()
    // Tab 后移动到右边一列
    canvasSheetRef.value?.selectCell?.(result.row, result.col + 1)
  })
}

// handleFormulaBarCancel - Escape 键
function handleFormulaBarCancel() {
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  const sourceRow = formulaEditManager.state.row
  const sourceCol = formulaEditManager.state.col
  
  // 跨 Sheet 时先切回源 Sheet
  if (sourceSheetId && sourceSheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(sourceSheetId)
  }
  
  formulaEditManager.cancelEdit()
  
  // 关闭 overlay
  canvasSheetRef.value?.cancelEditing?.()
  
  // 恢复公式栏显示原始值
  nextTick(() => {
    const originalValue = canvasSheetRef.value?.getCellDisplayValue?.(sourceRow, sourceCol) ?? ''
    formulaBarCellValue.value = originalValue
    formulaBarRow.value = sourceRow
    formulaBarCol.value = sourceCol
  })
}

// handleFormulaBarBlur - 失焦
function handleFormulaBarBlur() {
  // 如果是公式模式且处于可选择状态，不处理（用户在点击单元格）
  if (formulaEditManager.state.isFormulaMode && 
      formulaEditManager.state.isInSelectableState) {
    return
  }
  
  // 其他情况，确认编辑
  handleFormulaBarConfirm()  // 不移动选区
}
```

---

## 6. 内容同步机制

### 6.1 公式栏编辑时的内容同步

当用户在公式栏编辑时，单元格 Overlay 需要同步显示内容：

```typescript
// WorkbookSheet.handleFormulaBarStartEdit
function handleFormulaBarStartEdit() {
  // ... 初始化代理层状态
  
  // 🔑 关键：打开 overlay 同步显示
  canvasSheetRef.value?.openOverlayWithValue?.(
    formulaBarRow.value, 
    formulaBarCol.value, 
    formulaBarCellValue.value
  )
}

// WorkbookSheet.handleFormulaBarInput
function handleFormulaBarInput(value: string, cursorPos?: number) {
  formulaEditManager.updateValue(value, cursorPos)
  
  // 🔑 关键：同步更新 overlay 内容
  canvasSheetRef.value?.setEditingValue?.(value)
}
```

### 6.2 CanvasSheet 新增方法

```typescript
// 设置编辑中的值（用于公式栏同步）
function setEditingValue(value: string) {
  if (state.overlay.visible) {
    state.overlay.value = value
  }
}

// 打开 overlay 并设置指定值（用于公式栏编辑）
function openOverlayWithValue(row: number, col: number, value: string) {
  input.openOverlay(row, col, value, 'edit')
}

// 获取单元格显示值（包括公式字符串）
function getCellDisplayValue(row: number, col: number): string {
  return state.formulaSheet.getDisplayValue(row, col) ?? ''
}
```

---

## 7. UI 状态同步

### 7.1 公式栏状态 Props

```typescript
// WorkbookSheet 传递给 FormulaBar 的 Props
<FormulaBar
  :row="formulaBarRow"
  :col="formulaBarCol"
  :end-row="formulaBarEndRow"
  :end-col="formulaBarEndCol"
  :cell-value="formulaBarCellValue"
  :is-editing="formulaBarIsEditing"
  :editing-value="formulaBarEditingValue"
  :formula-references="formulaReferences"
  :source-sheet-name="formulaBarSourceSheetName"  // 跨 Sheet 时显示
  @navigate="handleFormulaBarNavigate"
  @select-range="handleFormulaBarSelectRange"
  @start-edit="handleFormulaBarStartEdit"
  @confirm="handleFormulaBarConfirm"
  @cancel="handleFormulaBarCancel"
  @tab="handleFormulaBarTab"
  @blur="handleFormulaBarBlur"
  @input="handleFormulaBarInput"
  @focus="handleFormulaBarFocus"
/>
```

### 7.2 跨 Sheet 模式 UI 提示

| UI 元素 | 跨 Sheet 模式显示 |
|---------|------------------|
| 名称框 | `Sheet1!A1` 格式（显示源单元格） |
| 选区高亮 | 目标 Sheet 选区使用彩色边框 |

```typescript
// 跨 Sheet 模式下名称框显示源 Sheet 名称
const formulaBarSourceSheetName = computed(() => {
  const mgr = formulaEditManager
  if (!mgr.state.active || 
      mgr.state.source !== 'formulaBar' || 
      !mgr.state.isFormulaMode ||
      mgr.state.sourceSheetId === activeSheetId.value) {
    return ''
  }
  const sourceSheet = workbook.value.getSheetById(mgr.state.sourceSheetId ?? '')
  return sourceSheet?.metadata?.name ?? ''
})
```

---

## 8. 零宽空格处理

### 8.1 问题背景

FormulaBar 使用 `contenteditable` div，当内容为空时需要占位符（零宽空格 `\u200B`）来保持光标位置。

### 8.2 处理规则

```typescript
// 生成 HTML 时，空内容添加零宽空格
function generateFormulaHtml(text: string): string {
  if (!text) return '\u200B'
  // ...
  return html || '\u200B'
}

// 获取值时，移除零宽空格
function handleFormulaInput() {
  // 🔑 关键：移除零宽空格
  const text = (formulaInputRef.value?.innerText ?? '').replace(/\u200B/g, '')
  emit('input', text, cursorPos)
}

function getCurrentValue(): string {
  if (formulaInputRef.value) {
    return (formulaInputRef.value.innerText ?? '').replace(/\u200B/g, '')
  }
  return displayValue.value.replace(/\u200B/g, '')
}
```

---

## 9. 实现检查清单

### ✅ FormulaEditManager 代理层
- [x] 状态结构（active, source, sourceSheetId, currentValue, cursorPosition, etc.）
- [x] startEdit 方法（接受 source 参数）
- [x] switchSource 方法（编辑源切换，保持内容）
- [x] updateValue 方法（更新值和光标位置）
- [x] confirmEdit 方法（返回 sheetId, row, col, value）
- [x] cancelEdit 方法（恢复原始值）
- [x] insertReference 方法（插入单元格引用）
- [x] isCrossSheetMode 方法（跨 Sheet 模式判断）
- [x] isFormulaMode 计算属性
- [x] isInSelectableState 计算属性
- [x] DEBUG 日志系统

### ✅ WorkbookSheet 集成
- [x] 创建 FormulaEditManager 实例
- [x] handleEditingStateChange（单元格编辑状态）
- [x] handleFormulaBarStartEdit（打开 overlay 同步显示）
- [x] handleFormulaBarInput（同步更新 overlay）
- [x] handleFormulaBarConfirm（Enter 确认）
- [x] handleFormulaBarTab（Tab 确认并右移）
- [x] handleFormulaBarCancel（Escape 取消，恢复原值）
- [x] handleFormulaBarBlur（失焦确认，排除公式选择模式）
- [x] handleFormulaBarFocus（编辑源切换）
- [x] handleSheetChange（跨 Sheet 模式处理）
- [x] handleSelectionChange（公式模式插入引用）
- [x] handleRequestEdit（双击切换编辑源）

### ✅ FormulaBar 组件
- [x] emit('start-edit') - 开始编辑
- [x] emit('input', value, cursorPos) - 输入变化
- [x] emit('confirm') - Enter 确认
- [x] emit('tab') - Tab 确认
- [x] emit('cancel') - Escape 取消
- [x] emit('blur') - 失焦（排除公式选择模式）
- [x] emit('focus') - 获得焦点
- [x] 零宽空格处理
- [x] 跨 Sheet 名称框显示

### ✅ CanvasSheet 新增方法
- [x] setEditingValue(value) - 设置编辑中的值
- [x] openOverlayWithValue(row, col, value) - 打开 overlay 并设置值
- [x] getCellDisplayValue(row, col) - 获取显示值（含公式）

---

## 10. 相关文件

| 文件 | 说明 |
|------|------|
| `src/components/sheet/formulaEditState.ts` | FormulaEditManager 代理层实现 |
| `src/components/WorkbookSheet.vue` | 协调层，调用代理层方法 |
| `src/components/FormulaBar.vue` | 公式栏组件 |
| `src/components/CanvasSheet.vue` | 单元格编辑容器 |
| `src/components/RichTextInput.vue` | 单元格编辑器 |
| `src/components/sheet/references.ts` | 公式引用解析 |

---

## 11. 调试日志

系统内置了详细的调试日志，可以通过以下方式查看：

```typescript
// formulaEditState.ts
const DEBUG = true  // 开启/关闭日志

// 日志格式
// [时间戳] [FormulaEdit:分类] 消息 {数据}
// 例如：
// [12:34:56.789] [FormulaEdit:startEdit] source=formulaBar, cell=[0,0] {...}
// [12:34:56.800] [FormulaEdit:updateValue] cursor: 0 → 5, isSelectable=true {...}
```

```typescript
// WorkbookSheet.vue
const DEBUG = true  // 开启/关闭日志

// 日志格式
// [时间戳] [WorkbookSheet:分类] 消息 {数据}
// 例如：
// [12:34:56.789] [WorkbookSheet:formulaBar] 开始编辑 {...}
// [12:34:56.800] [WorkbookSheet:selectionChange] 检测到公式栏公式模式
```
