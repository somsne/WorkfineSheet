# 跨 Sheet 公式输入交互行为规范

## 概述

本文档详细描述跨 Sheet 公式输入的交互行为规范，基于 `FormulaEditManager` 代理层模式实现。

---

## 1. 设计前提

### 1.1 基本原则

- **两种编辑源都支持跨 Sheet 引用**
- 编辑源决定了切换 Sheet 时的行为差异
- `FormulaEditManager` 统一管理跨 Sheet 编辑状态

### 1.2 编辑源与跨 Sheet 行为

| 编辑源 | 切换 Sheet 时行为 | 原因 |
|--------|------------------|------|
| `cell` | **结束编辑**，正常切换 | RichTextInput 是 Sheet 内组件，切换后会销毁 |
| `formulaBar` + 非公式 | **确认编辑**，正常切换 | 非公式无需跨 Sheet 引用 |
| `formulaBar` + 公式 | **保持编辑**，进入跨 Sheet 模式 | 公式栏是全局组件，可跨 Sheet 保持状态 |

### 1.3 为什么单元格编辑不支持跨 Sheet？

1. **组件生命周期**：RichTextInput 是 CanvasSheet 内的 overlay，切换 Sheet 后组件会被销毁/重建
2. **焦点管理复杂**：需要在目标 Sheet 重新创建编辑状态
3. **用户体验**：Excel 单元格编辑时切换 Sheet 也会结束编辑

### 1.4 跨 Sheet 模式判断

```typescript
// FormulaEditManager 方法
isCrossSheetMode(currentSheetId: string): boolean {
  return state.active && 
         state.source === 'formulaBar' &&  // 必须是公式栏编辑
         isFormulaMode &&                   // 必须是公式模式
         state.sourceSheetId !== currentSheetId  // 当前 Sheet 不是源 Sheet
}
```

---

## 2. 跨 Sheet 编辑流程

### 2.1 从公式栏进入跨 Sheet 模式

```
1. 用户点击公式栏，开始编辑
   ↓
   FormulaEditManager.startEdit({ source: 'formulaBar', ... })
   FormulaBar: 获得焦点

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
     检测到 isCrossSheetMode
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

### 2.2 从单元格编辑切换到公式栏再跨 Sheet

```
1. 用户双击单元格，开始编辑
   ↓
   FormulaEditManager.startEdit({ source: 'cell', ... })

2. 用户输入 `=SUM(`
   ↓
   FormulaEditManager: isFormulaMode = true

3. 用户点击公式栏（切换编辑源）
   ↓
   FormulaEditManager.switchSource('formulaBar')
   ↓
   source: 'cell' → 'formulaBar'
   currentValue 保持不变

4. 用户点击其他 Sheet 标签
   ↓
   现在 source === 'formulaBar'，可以进入跨 Sheet 模式
   ↓
   （后续流程同 2.1）
```

### 2.3 单元格编辑直接切换 Sheet（不支持跨 Sheet）

```
1. 用户双击单元格，开始编辑
   ↓
   FormulaEditManager.startEdit({ source: 'cell', ... })

2. 用户输入 `=`

3. 用户点击其他 Sheet 标签
   ↓
   WorkbookSheet.handleSheetChange():
     检测到 state.source === 'cell'
     → canvasSheetRef.confirmEditing()  // 结束编辑
     → workbook.setActiveSheet(sheetId) // 正常切换
```

### 2.4 取消流程

```
用户按 Escape
    ↓
FormulaBar: emit('cancel')
    ↓
WorkbookSheet.handleFormulaBarCancel():
    sourceSheetId = FormulaEditManager.state.sourceSheetId
    ↓
    如果 currentSheetId !== sourceSheetId:
        workbook.setActiveSheet(sourceSheetId)  // 切回源 Sheet
    ↓
    FormulaEditManager.cancelEdit()  // 丢弃编辑内容
```

---

## 3. 状态管理（基于 FormulaEditManager）

### 3.1 跨 Sheet 相关状态

```typescript
// FormulaEditManager.state 中的跨 Sheet 相关字段
interface FormulaEditState {
  active: boolean
  source: 'cell' | 'formulaBar' | null
  sourceSheetId: string    // 🔑 编辑开始时的 Sheet ID
  row: number
  col: number
  originalValue: string
  currentValue: string
  cursorPosition: number
}

// 计算属性
isFormulaMode: boolean     // currentValue.startsWith('=')
isInSelectableState: boolean  // 光标在可插入引用位置

// 方法
isCrossSheetMode(currentSheetId: string): boolean
```

### 3.2 状态流转图

```
┌─────────────────────────────────────────────────────────────┐
│                     编辑状态流转                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [未编辑] ──点击公式栏──→ [公式栏编辑]                        │
│     │                         │                              │
│     │                         │ 输入 `=`                     │
│  双击单元格                   ↓                              │
│     │                   [公式栏公式编辑]                      │
│     ↓                         │                              │
│  [单元格编辑]                  │ 切换 Sheet                   │
│     │                         ↓                              │
│     │                   [跨 Sheet 模式]                      │
│     │                         │                              │
│     │ 切换 Sheet              │ Enter/Escape                 │
│     ↓                         ↓                              │
│  [结束编辑] ←───────────── [保存/取消]                       │
│                               │                              │
│                               ↓                              │
│                         [切回源 Sheet]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 关键交互细节

### 4.1 切换 Sheet 时的行为决策树

```
handleSheetChange(targetSheetId):
    │
    ├── state.active === false ?
    │   └── 正常切换 Sheet
    │
    ├── state.source === 'cell' ?
    │   └── canvasSheetRef.confirmEditing()  // 结束单元格编辑
    │       └── 正常切换 Sheet
    │
    └── state.source === 'formulaBar' ?
        │
        ├── isFormulaMode === false ?
        │   └── handleFormulaBarConfirm()  // 确认非公式编辑
        │       └── 正常切换 Sheet
        │
        └── isFormulaMode === true ?
            └── workbook.setActiveSheet(targetSheetId)  // 只切换显示
                └── 保持编辑状态（进入跨 Sheet 模式）
```

### 4.2 点击单元格时的行为

| 条件 | 行为 |
|------|------|
| 跨 Sheet 模式 + `isInSelectableState` | 插入跨 Sheet 引用 |
| 跨 Sheet 模式 + 光标在引用内 | 替换为跨 Sheet 引用 |
| 同 Sheet 公式模式 + `isInSelectableState` | 插入本 Sheet 引用 |
| 非公式模式 / 非编辑状态 | 正常选区处理 |

### 4.3 键盘输入时的行为

| 条件 | 行为 |
|------|------|
| 跨 Sheet 模式 + 可打印字符 | 输入到 FormulaBar（焦点在公式栏） |
| 跨 Sheet 模式 + Enter | 确认编辑，返回源 Sheet |
| 跨 Sheet 模式 + Escape | 取消编辑，返回源 Sheet |
| 跨 Sheet 模式 + Tab | 确认编辑，返回源 Sheet，移到右边单元格 |
| 跨 Sheet 模式 + 方向键 | 移动目标 Sheet 选区（P2 可选功能） |

### 4.4 切换回源 Sheet 的行为

用户在跨 Sheet 模式下点击源 Sheet 标签：
- 切换到源 Sheet
- **不结束编辑**（仍可继续编辑公式）
- `isCrossSheetMode(sourceSheetId)` 返回 `false`
- 点击单元格会插入本 Sheet 引用（不带 Sheet 前缀）

---

## 5. 实现方案（基于代理层）

### 5.1 WorkbookSheet 核心逻辑

```typescript
// 使用 FormulaEditManager 代理层
const formulaEditManager = createFormulaEditStateManager()

// 切换 Sheet
function handleSheetChange(sheetId: string) {
  const mgr = formulaEditManager
  
  // 情况1：未在编辑
  if (!mgr.state.active) {
    workbook.value.setActiveSheet(sheetId)
    return
  }
  
  // 情况2：单元格编辑 → 结束编辑
  if (mgr.state.source === 'cell') {
    canvasSheetRef.value?.confirmEditing?.()
    workbook.value.setActiveSheet(sheetId)
    return
  }
  
  // 情况3：公式栏编辑
  if (mgr.state.source === 'formulaBar') {
    if (mgr.isFormulaMode) {
      // 公式模式 → 进入跨 Sheet 模式（只切换显示）
      workbook.value.setActiveSheet(sheetId)
      // 不调用 confirmEdit，保持编辑状态
    } else {
      // 非公式模式 → 确认编辑
      handleFormulaBarConfirm()
      workbook.value.setActiveSheet(sheetId)
    }
  }
}

// 选区变化
function handleSelectionChange(payload: SelectionPayload) {
  const mgr = formulaEditManager
  
  // 公式栏编辑 + 公式模式 + 可插入引用位置
  if (mgr.state.active && 
      mgr.state.source === 'formulaBar' && 
      mgr.isFormulaMode && 
      mgr.isInSelectableState) {
    
    let reference: string
    
    // 判断是否跨 Sheet
    if (mgr.isCrossSheetMode(activeSheetId.value)) {
      const sheetName = workbook.value.getActiveSheetName()
      reference = formatCrossSheetReference(sheetName, payload.selected.row, payload.selected.col)
    } else {
      reference = getCellAddress(payload.selected.row, payload.selected.col)
    }
    
    mgr.insertReference(reference)
    return  // 不更新公式栏显示位置
  }
  
  // 正常更新公式栏显示
  updateFormulaBarDisplay(payload)
}

// 公式栏确认
function handleFormulaBarConfirm() {
  const result = formulaEditManager.confirmEdit()
  if (!result) return
  
  // 如果在其他 Sheet，先切回源 Sheet
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
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  
  // 如果在其他 Sheet，先切回源 Sheet
  if (sourceSheetId && sourceSheetId !== activeSheetId.value) {
    workbook.value.setActiveSheet(sourceSheetId)
  }
  
  formulaEditManager.cancelEdit()
}
```

### 5.2 FormulaBar Props 设计

```typescript
interface FormulaBarProps {
  // 显示信息
  row: number
  col: number
  cellValue: string           // 非编辑时显示
  
  // 编辑状态（从代理层读取）
  isEditing: boolean          // state.active && state.source === 'formulaBar'
  editingValue: string        // state.currentValue
  cursorPosition: number      // state.cursorPosition
  
  // 跨 Sheet 模式
  isCrossSheetMode: boolean   // 用于 UI 提示
  sourceSheetName?: string    // 跨 Sheet 时显示源 Sheet 名
}

interface FormulaBarEmits {
  'start-edit': []
  'focus': []                 // 获得焦点（用于编辑源切换）
  'input': [value: string, cursorPos: number]
  'confirm': []
  'cancel': []
}
```

### 5.3 CanvasSheet 跨 Sheet 模式处理

```typescript
interface CanvasSheetProps {
  // ...现有 props
  isCrossSheetFormulaMode?: boolean  // 是否处于跨 Sheet 公式模式
}

// 键盘事件处理
function handleKeyDown(event: KeyboardEvent) {
  // 跨 Sheet 模式下，大部分按键由 FormulaBar 处理
  if (props.isCrossSheetFormulaMode) {
    // 只处理方向键（移动选区）
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      handleArrowKeyInCrossSheetMode(event)
      return
    }
    // 其他按键让事件冒泡，由 WorkbookSheet/FormulaBar 处理
    return
  }
  
  // 正常键盘处理
  // ...
}
```

---

## 6. 边界情况处理

### 6.1 连续点击不同单元格

在跨 Sheet 模式下连续点击不同单元格：

| 操作序列 | 公式变化 | 说明 |
|----------|----------|------|
| 输入 `=` | `=` | 光标在 `=` 后 |
| 点击 Sheet2!A1 | `=Sheet2!A1` | 插入引用 |
| 点击 Sheet2!B2 | `=Sheet2!B2` | **替换**引用（光标在引用内） |
| 输入 `+` | `=Sheet2!B2+` | 光标在 `+` 后 |
| 点击 Sheet2!C3 | `=Sheet2!B2+Sheet2!C3` | **追加**引用 |

### 6.2 拖选范围

拖选单元格范围：
```
拖选 Sheet2 的 A1:B5
    ↓
生成范围引用: `=Sheet2!A1:B5`
    ↓
拖选过程中实时更新引用
```

### 6.3 Sheet 名称特殊字符处理

```typescript
function formatCrossSheetReference(sheetName: string, row: number, col: number): string {
  const cellRef = getCellAddress(row, col)
  
  // 需要引号包裹的情况：空格、单引号、感叹号
  if (/[\s'!]/.test(sheetName)) {
    const escaped = sheetName.replace(/'/g, "''")  // 单引号转义为两个单引号
    return `'${escaped}'!${cellRef}`
  }
  return `${sheetName}!${cellRef}`
}
```

| Sheet 名称 | 生成的引用 |
|-----------|-----------|
| `Sheet1` | `Sheet1!A1` |
| `Sheet 2` | `'Sheet 2'!A1` |
| `销售数据` | `销售数据!A1` |
| `It's mine` | `'It''s mine'!A1` |

### 6.4 从单元格编辑想要跨 Sheet 的用户引导

如果用户在单元格编辑公式时想要跨 Sheet：

```
用户双击单元格，输入 `=`
    ↓
用户尝试点击其他 Sheet 标签
    ↓
系统自动确认并结束编辑（当前行为）
    ↓
【可选增强】提示用户：
    "提示：如需跨 Sheet 引用，请点击公式栏继续编辑"
```

---

## 7. UI 提示（可选增强）

### 7.1 跨 Sheet 编辑指示

在跨 Sheet 模式下，可以显示以下提示：

| UI 元素 | 提示内容 | 优先级 |
|---------|----------|--------|
| 名称框 | 显示源单元格地址（如 `Sheet1!A1`） | P1 |
| 公式栏边框 | 变色（如蓝色边框）表示跨 Sheet 编辑中 | P2 |
| 状态栏 | "正在编辑 Sheet1!A1 的公式" | P2 |

### 7.2 目标 Sheet 选区样式

在目标 Sheet 上，被选中的单元格可以显示：

| 样式 | 说明 | 优先级 |
|------|------|--------|
| 彩色边框 | 与公式引用颜色对应（如蓝色、红色等） | P1 |
| 虚线边框 | 区别于正常选区 | P2 |

```typescript
// CanvasSheet props
interface Props {
  // 跨 Sheet 选区颜色（用于公式引用高亮）
  crossSheetSelectionColor?: string
}
```

---

## 8. 实现优先级

### P0 - 核心功能（基于 FormulaEditManager）✅ 已完成

1. ✅ FormulaEditManager 代理层基础
2. ✅ `isCrossSheetMode()` 方法
3. ✅ `handleSheetChange` 按编辑源分支处理
4. ✅ 跨 Sheet 模式下 `handleSelectionChange` 插入引用
5. ✅ `handleFormulaBarConfirm` 切回源 Sheet
6. ✅ `handleFormulaBarCancel` 切回源 Sheet 并恢复原值

### P1 - 增强功能 ✅ 已完成

1. ✅ 连续点击替换引用（基于 `isInSelectableState`）
2. ✅ 拖选插入范围引用
3. ✅ 名称框显示源单元格（跨 Sheet 模式显示 `Sheet1!A1` 格式）
4. ✅ 跨 Sheet 选区彩色高亮
5. ✅ Tab 键确认并右移
6. ✅ Blur 事件确认（排除公式选择模式）
7. ✅ Escape 取消后恢复公式栏显示原值
8. ✅ 零宽空格处理（修复公式计算 #ERROR! 问题）

### P2 - 可选功能

1. ⬜ 方向键移动选区并更新引用
2. ⬜ 公式栏边框变色
3. ⬜ 状态栏提示
4. ⬜ 单元格编辑跨 Sheet 时的用户提示

---

## 9. 相关文档

| 文档 | 说明 |
|------|------|
| [FORMULA_EDITING_SYSTEM.md](./FORMULA_EDITING_SYSTEM.md) | **公式编辑系统完整文档（推荐阅读）** |
| [FORMULA_INPUT_BEHAVIOR.md](./FORMULA_INPUT_BEHAVIOR.md) | 公式输入行为规范（主文档） |
| `src/components/sheet/formulaEditState.ts` | FormulaEditManager 实现 |
| `src/components/WorkbookSheet.vue` | 协调层，调用代理层方法 |
| `src/components/FormulaBar.vue` | 公式栏组件 |
