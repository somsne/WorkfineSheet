# FormulaEditManager 代理层设计

## 1. 设计目标

将 FormulaEditManager 打造为**唯一的编辑状态中心**，所有文本输入、光标管理、公式引用、跨 Sheet 操作均由它统一管理。FormulaBar 和 CellOverlay 退化为**纯渲染组件**。

## 2. 核心架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WorkbookSheet                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    FormulaEditManager (唯一状态源)                      │  │
│  │                                                                        │  │
│  │  状态:                                                                 │  │
│  │    active, source, mode, row, col, sheetId                            │  │
│  │    currentValue, originalValue, cursorPosition, selectionRange        │  │
│  │    isFormulaMode, formulaReferences, isInSelectableState              │  │
│  │    displayHtml (computed)                                             │  │
│  │                                                                        │  │
│  │  动作:                                                                 │  │
│  │    startEdit(), updateValue(), updateCursor(), insertReference()      │  │
│  │    confirmEdit(), cancelEdit(), switchSource(), switchSheet()         │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│              ┌───────────────┼───────────────┐                              │
│              ↓ props         ↓ props         ↓ 方法调用                      │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐      │
│  │   FormulaBar      │  │   CellOverlay     │  │   CanvasSheet       │      │
│  │   (纯渲染)        │  │   (纯渲染)        │  │   (事件采集)        │      │
│  │                   │  │                   │  │                     │      │
│  │  显示 displayHtml │  │  显示 displayHtml │  │  - 选区变化         │      │
│  │  转发键盘事件     │  │  转发键盘事件     │  │  - 双击/F2 编辑     │      │
│  │  转发光标变化     │  │  转发光标变化     │  │  - 引用选择         │      │
│  └───────────────────┘  └───────────────────┘  └─────────────────────┘      │
│              │                   │                       │                   │
│              └───────────────────┴───────────────────────┘                   │
│                              ↓ emit                                          │
│                    WorkbookSheet 事件处理                                    │
│                              ↓                                               │
│                    FormulaEditManager 更新                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. FormulaEditManager 完整接口

### 3.1 状态 (State)

```typescript
interface FormulaEditState {
  // === 编辑状态 ===
  active: boolean                    // 是否激活编辑
  source: 'cell' | 'formulaBar' | null  // 当前焦点位置
  mode: 'edit' | 'typing'           // 编辑 or 打字模式
  
  // === 位置信息 ===
  sourceSheetId: string | null      // 编辑单元格所属 Sheet
  row: number
  col: number
  
  // === 值状态 ===
  originalValue: string             // 原始值（取消恢复用）
  currentValue: string              // 当前值
  
  // === 光标状态 ===
  cursorPosition: number            // 光标位置
  selectionRange: { start: number; end: number } | null  // 选中范围
  hasTextSelection: boolean         // 是否有选中文本
  
  // === 公式状态 ===
  isFormulaMode: boolean            // 是否公式（=开头）
  formulaReferences: FormulaReference[]  // 引用列表
  isInSelectableState: boolean      // 是否可插入引用
  
  // === 跨 Sheet ===
  currentSheetId: string | null     // 当前浏览的 Sheet
}
```

### 3.2 计算属性 (Computed)

```typescript
// 带颜色的公式引用（用于高亮显示）
textFormulaReferences: ComputedRef<Array<{
  ref: string
  color: string
  startIndex: number
  endIndex: number
}>>

// 渲染用 HTML（公式着色后）
displayHtml: ComputedRef<string>

// 是否跨 Sheet 模式
isCrossSheetMode: ComputedRef<boolean>
```

### 3.3 动作方法 (Actions)

| 方法 | 参数 | 说明 |
|------|------|------|
| `startEdit` | `{ sheetId, row, col, value, source, mode }` | 开始编辑 |
| `updateValue` | `(value, cursorPos?)` | 更新编辑值 |
| `updateCursor` | `(pos, selection?)` | 更新光标位置 |
| `switchSource` | `(source)` | 切换焦点（cell ↔ formulaBar）|
| `switchSheet` | `(sheetId)` | 跨 Sheet 浏览 |
| `insertReference` | `(ref)` | 插入单元格引用 |
| `confirmEdit` | `()` | 确认编辑，返回 `{ sheetId, row, col, value }` |
| `cancelEdit` | `()` | 取消编辑，返回原始值信息 |
| `reset` | `()` | 重置所有状态 |

## 4. 组件职责划分

### 4.1 FormulaBar（纯渲染）

**Props 输入：**
```typescript
interface FormulaBarProps {
  row: number
  col: number
  endRow?: number
  endCol?: number
  isEditing: boolean           // 来自 Manager
  displayHtml: string          // 来自 Manager
  isFormula?: boolean          // 来自 Manager
  cursorPosition?: number      // 来自 Manager（可选，用于光标同步）
  sourceSheetName?: string     // 跨 Sheet 时显示
}
```

**Emit 输出（事件转发）：**
```typescript
emit('keydown', event)         // 键盘事件
emit('input', value, cursorPos) // 输入变化
emit('cursor-change', pos, selection) // 光标变化
emit('focus')                  // 获得焦点
emit('blur')                   // 失去焦点
emit('click')                  // 点击
```

**内部职责：**
- 渲染 displayHtml
- 名称框交互（仅名称框相关状态）
- IME 输入法处理
- 事件转发

**不再负责：**
- ~~cursorPosition 状态~~
- ~~isInSelectableState 状态~~
- ~~公式引用解析~~
- ~~引用插入逻辑~~

### 4.2 CellOverlay（纯渲染）

**Props 输入：**
```typescript
interface CellOverlayProps {
  visible: boolean
  displayHtml: string          // 来自 Manager
  row: number
  col: number
  top: number
  left: number
  width: number
  height: number
  cellStyle?: CellStyle
  isFormula?: boolean          // 来自 Manager
  cursorPosition?: number      // 来自 Manager
}
```

**Emit 输出（事件转发）：**
```typescript
emit('keydown', event)         // 键盘事件
emit('input', value, cursorPos) // 输入变化
emit('cursor-change', pos, selection) // 光标变化
emit('focus')
emit('blur')
```

**内部职责：**
- 渲染 displayHtml
- 定位在单元格上方
- IME 输入法处理
- 事件转发

### 4.3 CanvasSheet（事件采集）

**向上 Emit：**
```typescript
emit('request-edit', { row, col })          // 双击/F2 请求编辑
emit('selection-change', selectionInfo)     // 选区变化（用于引用插入）
emit('editing-state-change', overlayInfo)   // 内部 overlay 状态变化
```

**向下接收方法调用：**
```typescript
// 由 WorkbookSheet 调用
openOverlayWithValue(row, col, value)       // 打开 overlay
setEditingValue(value)                      // 同步值到 overlay
confirmEditingWithDirection(value, dir, opts) // 确认编辑
cancelEditing()                             // 取消编辑
```

### 4.4 WorkbookSheet（协调中心）

**持有：**
- `FormulaEditManager` 实例
- 全局 Overlay 状态（位置、尺寸）

**职责：**
1. 接收 FormulaBar/CellOverlay/CanvasSheet 事件
2. 调用 FormulaEditManager 方法更新状态
3. 将 Manager 状态下发给 FormulaBar/CellOverlay
4. 协调 CanvasSheet 的编辑操作

## 5. 典型用户操作流程

### 5.1 双击单元格开始编辑

```
1. CanvasSheet 检测双击
   → emit('request-edit', { row, col })

2. WorkbookSheet 处理
   → manager.startEdit({ sheetId, row, col, value, source: 'cell', mode: 'edit' })
   → 打开 globalOverlay

3. FormulaBar/CellOverlay 自动更新（响应式）
   → props.displayHtml 更新
   → props.isEditing 更新
```

### 5.2 输入字符

```
1. FormulaBar/CellOverlay 检测 input 事件
   → emit('input', newValue, cursorPos)

2. WorkbookSheet 处理
   → manager.updateValue(newValue, cursorPos)

3. 组件自动更新
   → displayHtml 重新计算
   → isInSelectableState 更新
```

### 5.3 公式模式点击选择引用

```
1. CanvasSheet 检测选区变化
   → emit('selection-change', { row, col, endRow, endCol })

2. WorkbookSheet 检查 manager.state.isInSelectableState
   → if true: manager.insertReference(ref)

3. 组件自动更新
   → displayHtml 包含新引用
   → cursorPosition 更新
```

### 5.4 切换焦点（公式栏 ↔ 单元格）

```
1. FormulaBar 点击
   → emit('focus')

2. WorkbookSheet 处理
   → manager.switchSource('formulaBar')

3. CellOverlay 同步更新（可选：显示为只读模式）
```

### 5.5 跨 Sheet 引用选择

**场景**：用户在 Sheet1 编辑公式 `=SUM(`，然后切换到 Sheet2 点击单元格 A1:B3

**核心问题**：
1. 切换 Sheet 时如何保持编辑状态？
2. 点击其他 Sheet 单元格时如何区分「插入引用」vs「普通选择」？
3. 如何生成正确的跨 Sheet 引用格式？

**状态判断**：
```typescript
// Manager 计算属性
isCrossSheetMode = computed(() => {
  return state.active && 
         state.sourceSheetId !== null && 
         state.currentSheetId !== state.sourceSheetId
})

// 是否应该插入引用（而非普通选择）
shouldInsertReference = computed(() => {
  return state.active && 
         state.isFormulaMode && 
         state.isInSelectableState
})
```

**完整流程**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. 用户在 Sheet1!A1 输入 =SUM(                                              │
│    → manager.state = {                                                      │
│        active: true,                                                        │
│        sourceSheetId: 'sheet1',                                            │
│        currentSheetId: 'sheet1',                                           │
│        row: 0, col: 0,                                                     │
│        currentValue: '=SUM(',                                              │
│        isFormulaMode: true,                                                │
│        isInSelectableState: true   // 光标在 ( 后面                         │
│      }                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. 用户点击 Sheet2 标签                                                     │
│    → WorkbookSheet.handleSheetChange('sheet2')                             │
│    → 检测到 manager.state.isInSelectableState === true                      │
│    → 进入跨 Sheet 引用模式（不是普通切换）                                   │
│                                                                             │
│    处理逻辑:                                                                │
│    if (manager.state.active && manager.state.isInSelectableState) {        │
│      // 跨 Sheet 引用模式                                                   │
│      manager.switchSheet('sheet2')                                         │
│      hideOverlay()  // 隐藏 CellOverlay（不关闭编辑状态）                    │
│      // FormulaBar 保持显示当前公式                                         │
│    } else {                                                                 │
│      // 普通切换：先保存/取消当前编辑                                        │
│      saveOrCancelEdit()                                                    │
│      switchSheet()                                                         │
│    }                                                                        │
│                                                                             │
│    → manager.state = {                                                      │
│        ...保持不变...,                                                      │
│        currentSheetId: 'sheet2'  // 只更新当前浏览的 Sheet                  │
│      }                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. 用户在 Sheet2 点击/拖选单元格 A1:B3                                      │
│    → CanvasSheet.emit('selection-change', { row:0, col:0, endRow:2, endCol:1 })│
│                                                                             │
│    WorkbookSheet 处理:                                                      │
│    if (manager.shouldInsertReference) {                                    │
│      // 生成跨 Sheet 引用                                                   │
│      const sheetName = getSheetName('sheet2')  // "Sheet2"                 │
│      const ref = formatCrossSheetReference(sheetName, 0, 0, 2, 1)          │
│      // → "Sheet2!A1:B3" 或 "'Sheet Name'!A1:B3"                           │
│                                                                             │
│      manager.insertReference(ref)                                          │
│      // → currentValue = "=SUM(Sheet2!A1:B3"                               │
│      // → cursorPosition 更新到引用末尾                                     │
│                                                                             │
│      // 阻止 CanvasSheet 的默认选区行为                                     │
│      return  // 不更新 Sheet2 的选区状态                                    │
│    } else {                                                                 │
│      // 普通选区变化                                                        │
│      updateSelection(...)                                                  │
│    }                                                                        │
│                                                                             │
│    → FormulaBar.displayHtml 自动更新，显示带颜色的引用                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4a. 用户继续输入/选择更多引用                                               │
│     → 重复步骤 3，每次点击都替换/追加引用                                    │
│                                                                             │
│ 4b. 用户按 Enter 确认                                                       │
│     → manager.confirmEdit()                                                │
│     → 返回 { sheetId: 'sheet1', row: 0, col: 0, value: '=SUM(Sheet2!A1:B3)' }│
│     → 自动切回 Sheet1                                                       │
│     → 保存值到 Sheet1!A1                                                    │
│                                                                             │
│ 4c. 用户按 Escape 取消                                                      │
│     → manager.cancelEdit()                                                 │
│     → 返回 { sheetId: 'sheet1', row: 0, col: 0, value: 原始值 }             │
│     → 自动切回 Sheet1                                                       │
│     → 恢复原始值                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**UI 状态管理**：

| 状态 | FormulaBar | CellOverlay | Sheet2 选区高亮 |
|------|------------|-------------|----------------|
| 跨 Sheet 模式 | 显示公式 + 彩色引用 | 隐藏 | 显示临时选区（虚线/特殊颜色）|
| 普通编辑 | 显示公式 | 显示 | - |

**关键实现细节**：

```typescript
// WorkbookSheet 中的 Sheet 切换处理
function handleSheetChange(newSheetId: string) {
  const manager = formulaEditManager
  
  // 情况1: 正在编辑公式且处于可插入引用状态
  if (manager.state.active && manager.state.isInSelectableState) {
    // 进入跨 Sheet 引用模式
    manager.switchSheet(newSheetId)
    
    // 隐藏 CellOverlay（但不结束编辑）
    globalOverlay.visible = false
    
    // 切换显示的 Sheet
    workbook.setActiveSheet(newSheetId)
    return
  }
  
  // 情况2: 正在编辑但不是公式/不在可插入位置
  if (manager.state.active) {
    // 需要先处理当前编辑（保存或取消）
    const result = manager.confirmEdit()
    if (result) {
      saveValueToSheet(result)
    }
  }
  
  // 情况3: 普通切换
  saveCurrentSheetState()
  workbook.setActiveSheet(newSheetId)
}

// WorkbookSheet 中的选区变化处理
function handleSelectionChange(selection: SelectionInfo) {
  const manager = formulaEditManager
  
  // 跨 Sheet 引用模式下的选区变化
  if (manager.shouldInsertReference && manager.isCrossSheetMode) {
    const sheetName = workbook.getSheetName(manager.state.currentSheetId!)
    const ref = formatCrossSheetReference(
      sheetName,
      selection.row,
      selection.col,
      selection.endRow,
      selection.endCol
    )
    manager.insertReference(ref)
    
    // 不更新 CanvasSheet 的选区（保持编辑焦点）
    return
  }
  
  // 同 Sheet 引用模式
  if (manager.shouldInsertReference) {
    const ref = formatReference(selection)  // "A1" 或 "A1:B3"
    manager.insertReference(ref)
    return
  }
  
  // 普通选区变化
  updateSelectionState(selection)
}
```

**引用替换逻辑**：

当用户连续点击不同单元格时，需要智能判断是「替换」还是「追加」：

```typescript
// 在 FormulaEditManager.insertReference 中
function insertReference(ref: string) {
  const { currentValue, cursorPosition, selectionRange } = state
  
  // 1. 有文本选中 → 替换选中内容
  if (selectionRange && selectionRange.start !== selectionRange.end) {
    // 替换选中的文本
  }
  
  // 2. 光标在已有引用上 → 替换该引用
  const existingRef = findReferenceAtCursor(currentValue, cursorPosition)
  if (existingRef) {
    // 替换 existingRef 为新的 ref
  }
  
  // 3. 光标在操作符后 → 插入新引用
  // 在光标位置插入
}
```

## 6. 跨 Sheet 引用的边界情况

### 6.1 状态转换矩阵

| 当前状态 | 用户操作 | 结果 |
|----------|----------|------|
| 未编辑 | 点击 Sheet2 标签 | 普通切换 |
| 编辑普通文本 | 点击 Sheet2 标签 | 保存后切换 |
| 编辑公式，光标在操作符后 | 点击 Sheet2 标签 | 进入跨 Sheet 模式 |
| 编辑公式，光标在引用中间 | 点击 Sheet2 标签 | 进入跨 Sheet 模式（点击将替换引用）|
| 编辑公式，光标在普通位置 | 点击 Sheet2 标签 | 保存后切换 |
| 跨 Sheet 模式 | 点击 Sheet2 单元格 | 插入/替换引用 |
| 跨 Sheet 模式 | 点击 Sheet3 标签 | 切换到 Sheet3（继续跨 Sheet 模式）|
| 跨 Sheet 模式 | 点击源 Sheet 标签 | 返回源 Sheet（继续编辑）|
| 跨 Sheet 模式 | 按 Enter | 确认并返回源 Sheet |
| 跨 Sheet 模式 | 按 Escape | 取消并返回源 Sheet |
| 跨 Sheet 模式 | 输入字符 | 退出跨 Sheet 模式，继续在公式栏编辑 |

### 6.2 isInSelectableState 判断规则

```typescript
// 可插入引用的位置（光标前一个字符）
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%', '!']

function isInSelectablePosition(value: string, cursorPos: number): boolean {
  if (!value.startsWith('=')) return false
  if (cursorPos <= 0) return false
  
  const prevChar = value.charAt(cursorPos - 1)
  
  // 1. 直接在操作符后面
  if (OPERATORS.includes(prevChar)) return true
  
  // 2. 在操作符后面，中间只有空格
  // 3. 在操作符后面，正在输入引用（如 "A" 或 "A1"）
  // ...详细逻辑
}
```

### 6.3 Sheet 名称格式化

```typescript
function formatCrossSheetReference(sheetName: string, ...): string {
  // 需要引号的情况：包含空格、特殊字符
  const needsQuotes = /[\s'!\[\]]/.test(sheetName)
  
  if (needsQuotes) {
    // 内部单引号需要转义为两个单引号
    const escaped = sheetName.replace(/'/g, "''")
    return `'${escaped}'!${cellRef}`
  }
  
  return `${sheetName}!${cellRef}`
}

// 示例：
// "Sheet1" → Sheet1!A1
// "My Sheet" → 'My Sheet'!A1
// "Sheet's Data" → 'Sheet''s Data'!A1
```

### 6.4 拖选范围引用

用户可以拖选多个单元格来插入范围引用：

```
点击 A1 → 插入 "Sheet2!A1"
拖选 A1:C3 → 插入 "Sheet2!A1:C3"
```

CanvasSheet 需要在跨 Sheet 模式下：
- 允许正常的拖选操作
- 但不更新自己的 selectionRange 状态
- 只通过 emit 上报选区信息

## 7. 实现步骤

### Phase 1: 增强 FormulaEditManager

- [ ] 添加 `switchSource()` 方法
- [ ] 完善跨 Sheet 状态管理
- [ ] 添加 `isCrossSheetMode` 计算属性
- [ ] 添加 `shouldInsertReference` 计算属性

### Phase 2: 简化 FormulaBar

- [ ] 移除内部 cursorPosition 状态
- [ ] 移除 isInSelectableState 状态
- [ ] 改为纯 props 驱动渲染
- [ ] 保留 IME 处理和事件转发

### Phase 3: 简化 CellOverlay

- [ ] 移除内部编辑状态
- [ ] 改为纯 props 驱动渲染
- [ ] 保留 IME 处理和事件转发

### Phase 4: 更新 WorkbookSheet

- [ ] 统一事件处理入口
- [ ] 实现跨 Sheet 引用模式的 Sheet 切换逻辑
- [ ] 实现跨 Sheet 模式下的选区处理
- [ ] 所有编辑操作通过 Manager
- [ ] 简化状态同步逻辑

## 8. 收益

| 方面 | 改进 |
|------|------|
| **状态一致性** | 单一数据源，无状态不同步 bug |
| **可维护性** | 逻辑集中，易于理解和修改 |
| **可测试性** | Manager 纯逻辑，易于单测 |
| **组件复用** | 渲染组件无状态，可复用 |
| **跨 Sheet** | 统一管理，逻辑清晰 |
