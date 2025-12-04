# FormulaBar 行为链文档

## 概述

FormulaBar（公式栏）是 WorkfineSheet 的核心编辑组件，支持以下场景：
1. **输入文本** - 普通文本编辑
2. **输入公式** - 以 `=` 开头的公式编辑
3. **选择引用单元格** - 在公式中点击单元格插入引用
4. **跨 Sheet 选择引用** - 切换 Sheet 后选择引用单元格

## 核心状态管理

### FormulaEditManager（代理层）

位置：`src/components/sheet/formulaEditState.ts`

```typescript
interface FormulaEditState {
  active: boolean              // 是否正在编辑
  source: 'cell' | 'formulaBar' | null  // 编辑来源
  mode: 'edit' | 'typing'      // 编辑模式
  sourceSheetId: string | null // 正在编辑的单元格所在 Sheet
  row: number                  // 编辑的单元格行
  col: number                  // 编辑的单元格列
  originalValue: string        // 原始值（取消时恢复）
  currentValue: string         // 当前编辑值
  isFormulaMode: boolean       // 是否为公式模式（以 = 开头）
  isInSelectableState: boolean // 是否处于可插入引用状态
  cursorPosition: number       // 光标位置
  formulaReferences: FormulaReference[] // 公式引用列表
  currentSheetId: string | null // 当前浏览的 Sheet（跨 Sheet 时可能不同于 sourceSheetId）
}
```

### 可插入引用状态判断

光标前一个非空白字符必须是以下之一：
- `=` 等号
- `+` `-` `*` `/` `^` `&` 运算符
- `(` `,` `:` `<` `>` `!` 分隔符

---

## 场景一：输入文本

### 行为流程

```
用户点击公式栏
  ↓
handleFormulaBarStartEdit()
  ↓
formulaEditManager.actionStartFormulaBarEdit()
  ↓
设置 state.active=true, source='formulaBar', isFormulaMode=false
  ↓
用户输入文字
  ↓
handleFormulaBarInput(value, cursorPos)
  ↓
formulaEditManager.actionInput()
  ↓
更新 state.currentValue
  ↓
用户按 Enter / Tab / 点击其他单元格
  ↓
handleFormulaBarConfirm() / handleFormulaBarTab()
  ↓
canvasSheetRef.confirmEditingWithDirection(value, direction)
  ↓
保存值到单元格，退出编辑
```

### 相关方法

| 方法 | 位置 | 说明 |
|-----|------|-----|
| `handleFormulaBarStartEdit()` | WorkbookSheet.vue | 开始编辑 |
| `handleFormulaBarInput()` | WorkbookSheet.vue | 输入变化 |
| `handleFormulaBarConfirm()` | WorkbookSheet.vue | Enter 确认 |
| `handleFormulaBarTab()` | WorkbookSheet.vue | Tab 确认并右移 |
| `handleFormulaBarBlur()` | WorkbookSheet.vue | 失焦确认 |
| `handleFormulaBarCancel()` | WorkbookSheet.vue | Esc 取消 |
| `actionStartFormulaBarEdit()` | formulaEditState.ts | 代理层：开始编辑 |
| `actionInput()` | formulaEditState.ts | 代理层：输入变化 |

---

## 场景二：输入公式

### 行为流程

```
用户在公式栏输入 "="
  ↓
handleFormulaBarInput("=", 1)
  ↓
formulaEditManager.actionInput()
  ↓
检测到 value.startsWith('=') → 设置 isFormulaMode=true
  ↓
parseAllFormulaReferences(value) → 更新 formulaReferences
  ↓
isInSelectablePosition(value, cursorPos) → 更新 isInSelectableState
  ↓
继续输入公式，如 "=SUM("
  ↓
光标在 "(" 后 → isInSelectableState=true（可插入引用）
  ↓
此时点击单元格会触发引用插入（见场景三）
```

### 相关方法

| 方法 | 位置 | 说明 |
|-----|------|-----|
| `actionInput()` | formulaEditState.ts | 更新值并判断公式模式 |
| `isInSelectablePosition()` | formulaEditState.ts | 判断光标是否在可插入位置 |
| `parseAllFormulaReferences()` | references.ts | 解析公式中所有引用 |

---

## 场景三：选择引用单元格

### 前置条件
- `isFormulaMode === true`（公式模式）
- `isInSelectableState === true`（光标在可插入位置）

### 行为流程

```
用户点击单元格 A1
  ↓
CanvasSheet 触发 selection-change 事件
  ↓
handleSelectionChange(payload)
  ↓
检查：mgr.state.active && source='formulaBar' && isFormulaMode && isInSelectableState
  ↓ 条件满足
生成引用地址 "A1" (或 "A1:B2" 范围)
  ↓
formulaBarRef.insertCellReference(reference)
  ↓
FormulaBar.vue: insertCellReference()
  - 检查是否需要替换已有引用（光标在引用内）
  - 在光标位置插入引用
  - 更新 DOM 和光标位置
  ↓
mgr.updateValue(newValue)
  ↓
更新 formulaReferences
  ↓
界面更新：公式栏显示彩色引用，单元格显示彩色边框
```

### mousedown 立即插入（与单元格选择行为一致）

```
onMouseDown (useSheetMouse.ts)
  ↓
检测公式模式 + isInSelectableState
  ↓
设置 formulaReferenceMode 状态
  ↓
insertFormulaReference() ← 立即插入引用
  ↓
onDraw() 更新显示

onMouseUp
  ↓
如果拖拽扩展了范围（区域选择）
  ↓
insertFormulaReference() ← 更新为范围引用
  ↓
重置 formulaReferenceMode
```

### 相关方法

| 方法 | 位置 | 说明 |
|-----|------|-----|
| `handleSelectionChange()` | WorkbookSheet.vue | 选区变化处理 |
| `insertCellReference()` | FormulaBar.vue | 插入单元格引用 |
| `insertRangeReference()` | FormulaBar.vue | 插入范围引用 |
| `findReferenceToReplace()` | FormulaBar.vue | 查找要替换的已有引用 |
| `insertFormulaReference()` | useSheetMouse.ts | 鼠标选择时插入引用 |
| `formatCrossSheetReference()` | formulaEditState.ts | 生成跨 Sheet 引用格式 |

---

## 场景四：跨 Sheet 选择引用

### 前置条件
- `isFormulaMode === true`
- `isInSelectableState === true`
- 用户点击了其他 Sheet 标签

### 行为流程

```
用户点击 Sheet2 标签
  ↓
handleSheetChange(sheetId)
  ↓
检查：mgr.state.source='formulaBar' && isFormulaMode
  ↓
检查：isInSelectableState === true?
  ↓ 是
进入跨 Sheet 模式：
  - formulaBarRef.setPendingCursorPosition() 保存光标位置
  - mgr.switchSheet(sheetId) 记录当前浏览的 Sheet
  - skipNextSelectionChange = true 跳过首次选区变化
  - workbook.setActiveSheet(sheetId) 切换显示
  - formulaBarRef.focus() 恢复公式栏焦点
  ↓
用户点击 Sheet2 的单元格 B2
  ↓
handleSelectionChange(payload)
  ↓
检查：mgr.isCrossSheetMode(activeSheetId) === true
  ↓
生成跨 Sheet 引用 "Sheet2!B2"
  ↓
formulaBarRef.insertCellReference("Sheet2!B2")
  ↓
公式变为 "=SUM(Sheet2!B2)"
  ↓
用户按 Enter 确认
  ↓
handleFormulaBarConfirm()
  ↓
检查：sourceSheetId !== activeSheetId
  ↓
切换回源 Sheet (Sheet1)
  ↓
保存公式到源单元格
```

### 不在可插入位置时

```
用户点击 Sheet2 标签
  ↓
handleSheetChange(sheetId)
  ↓
检查：isInSelectableState === false
  ↓
handleFormulaBarConfirm() 提交当前内容
  ↓
workbook.setActiveSheet(sheetId) 正常切换
  ↓
退出编辑状态
```

### 相关方法

| 方法 | 位置 | 说明 |
|-----|------|-----|
| `handleSheetChange()` | WorkbookSheet.vue | Sheet 切换处理 |
| `switchSheet()` | formulaEditState.ts | 记录跨 Sheet 状态 |
| `isCrossSheetMode()` | formulaEditState.ts | 判断是否跨 Sheet 模式 |
| `formatCrossSheetReference()` | formulaEditState.ts | 生成 "Sheet!A1" 格式 |
| `setPendingCursorPosition()` | FormulaBar.vue | 保存待恢复的光标位置 |

---

## 公式引用颜色显示

### 解析流程

```
用户输入公式 "=A1+Sheet2!B2"
  ↓
handleFormulaBarInput()
  ↓
parseFormulaReferencesWithSheet(value, sourceSheetName)
  ↓
返回 Map:
  - 'Sheet1' → [{ range: 'A1', color: '#4472C4', ... }]
  - 'Sheet2' → [{ range: 'Sheet2!B2', color: '#ED7D31', ... }]
  ↓
crossSheetReferencesMap.value = result
  ↓
公式栏：parseAllFormulaReferences() → 所有引用显示颜色
  ↓
单元格高亮：getReferencesForSheet(map, currentSheetName) → 只显示当前 Sheet 的引用
```

### 相关方法

| 方法 | 位置 | 说明 |
|-----|------|-----|
| `parseFormulaReferencesWithSheet()` | references.ts | 解析公式，按 Sheet 分组 |
| `parseAllFormulaReferences()` | references.ts | 获取所有引用（公式栏显示） |
| `getReferencesForSheet()` | references.ts | 获取指定 Sheet 的引用（单元格高亮） |
| `generateFormulaHtmlFromRefs()` | formulaEditUtils.ts | 生成带颜色的 HTML |

---

## 状态同步

### FormulaBar ↔ RichTextInput 同步

```
公式栏输入
  ↓
handleFormulaBarInput()
  ↓
mgr.actionInput() 更新代理层状态
  ↓
formulaBarEditingValue.value = value
  ↓
通过 props 传递给 CanvasSheet
  ↓
CanvasSheet 监听并同步到 RichTextInput
```

### 相关 Props

| Prop | 组件 | 说明 |
|-----|------|-----|
| `formulaReferences` | FormulaBar, RichTextInput | 公式引用（用于彩色显示） |
| `editingValue` | FormulaBar | 编辑中的值 |
| `isEditing` | FormulaBar | 是否在编辑状态 |
| `crossSheetFormulaState` | CanvasSheet | 跨 Sheet 公式状态 |

---

## 完整方法索引

### WorkbookSheet.vue

| 方法 | 说明 |
|-----|------|
| `handleFormulaBarStartEdit()` | 公式栏开始编辑 |
| `handleFormulaBarFocus()` | 公式栏获得焦点（编辑源切换） |
| `handleFormulaBarInput()` | 公式栏输入变化 |
| `handleFormulaBarConfirm()` | Enter 确认 |
| `handleFormulaBarTab()` | Tab 确认并右移 |
| `handleFormulaBarBlur()` | 失焦自动确认 |
| `handleFormulaBarCancel()` | Esc 取消 |
| `handleFormulaBarNavigate()` | 名称框导航 |
| `handleFormulaBarSelectRange()` | 名称框选择范围 |
| `handleSelectionChange()` | 选区变化（处理引用插入） |
| `handleSheetChange()` | Sheet 切换（处理跨 Sheet 模式） |

### FormulaBar.vue

| 方法 | 说明 |
|-----|------|
| `insertCellReference()` | 插入单元格引用 |
| `insertRangeReference()` | 插入范围引用 |
| `findReferenceToReplace()` | 查找要替换的引用 |
| `updateSelectableState()` | 更新可选择状态 |
| `getCurrentValue()` | 获取当前值 |
| `getCursorPosition()` | 获取光标位置 |
| `setCursorPosition()` | 设置光标位置 |
| `setPendingCursorPosition()` | 设置待恢复的光标位置 |

### formulaEditState.ts (FormulaEditManager)

| 方法 | 说明 |
|-----|------|
| `actionStartFormulaBarEdit()` | 开始公式栏编辑 |
| `actionSwitchToFormulaBar()` | 切换到公式栏编辑 |
| `actionInput()` | 输入变化 |
| `switchSource()` | 切换编辑源 |
| `switchSheet()` | 切换浏览的 Sheet |
| `isCrossSheetMode()` | 判断是否跨 Sheet 模式 |
| `updateValue()` | 更新当前值 |
| `reset()` | 重置状态 |
| `insertReference()` | 插入引用（核心逻辑） |
| `isInSelectablePosition()` | 判断是否可插入引用 |
| `formatCrossSheetReference()` | 生成跨 Sheet 引用格式 |

### references.ts

| 方法 | 说明 |
|-----|------|
| `parseFormulaReferencesWithSheet()` | 解析公式，按 Sheet 分组 |
| `parseAllFormulaReferences()` | 获取所有引用 |
| `parseFormulaReferences()` | 获取当前 Sheet 引用 |
| `getReferencesForSheet()` | 从 Map 获取指定 Sheet 引用 |

### useSheetMouse.ts

| 方法 | 说明 |
|-----|------|
| `insertFormulaReference()` | 鼠标选择时插入引用 |
| `onMouseDown()` | 处理公式模式下的单元格选择 |
| `onMouseUp()` | 处理区域选择结束 |

---

## 调试日志

启用调试日志：
```typescript
// src/components/sheet/formulaEditState.ts
const DEBUG = true

// src/components/WorkbookSheet.vue
const DEBUG_LOG = true
```

日志格式：
```
[时间戳] [FormulaEdit:类别] 消息 {数据}
[时间戳] [WorkbookSheet:类别] 消息 {数据}
```

常见类别：
- `action` - 动作执行
- `formulaBar` - 公式栏事件
- `selectionChange` - 选区变化
- `sheetChange` - Sheet 切换
