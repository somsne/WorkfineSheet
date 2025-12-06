# 用户操作动作链与状态管理详解

本文档详细描述了 WorkfineSheet 中用户编辑操作的完整动作链、状态流转和组件协作关系。

## 目录

1. [架构概览](#架构概览)
2. [核心状态管理](#核心状态管理)
3. [组件职责划分](#组件职责划分)
4. [用户操作动作链详解](#用户操作动作链详解)
5. [状态同步机制](#状态同步机制)
6. [当前架构的问题与优化方向](#当前架构的问题与优化方向)

---

## 架构概览

### 整体架构层次

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WorkbookSheet.vue                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    FormulaEditManager (状态代理层)                │    │
│  │  核心状态: active, source, sourceSheetId, row, col,              │    │
│  │           originalValue, currentValue, cursorPosition,          │    │
│  │           isFormulaMode, isInSelectableState                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           ↑ 读写                               ↑ 读写                    │
│  ┌───────────────────┐              ┌───────────────────────────┐       │
│  │   FormulaBar.vue  │←──同步───→  │  CellOverlayAdapter.vue   │       │
│  │  (公式输入/显示)  │              │  (单元格编辑覆盖层)        │       │
│  └───────────────────┘              └───────────────────────────┘       │
│           ↑                                     ↑                        │
│           │ 事件                                │ 事件                   │
│           ↓                                     ↓                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      CanvasSheet.vue                             │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │                 useSheetInput.ts                         │    │    │
│  │  │  - openOverlay / closeOverlay                            │    │    │
│  │  │  - saveAndMove (保存并移动)                               │    │    │
│  │  │  - onOverlayEnter/Tab/Blur/Cancel                        │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 数据流向

```
用户操作
   │
   ├──→ FormulaBar (公式栏输入)
   │         │
   │         ├──→ emit('input') ──→ WorkbookSheet.handleFormulaBarInput()
   │         │                           │
   │         │                           ├──→ FormulaEditManager.updateValue()
   │         │                           └──→ 同步 globalOverlay.value
   │         │
   │         └──→ emit('confirm/cancel/tab') ──→ WorkbookSheet.handleFormulaBar*()
   │                                                   │
   │                                                   └──→ CanvasSheet.confirmEditingWithDirection()
   │
   └──→ CellOverlay (单元格内编辑)
             │
             ├──→ @input-change ──→ WorkbookSheet.handleGlobalOverlayInputChange()
             │                           │
             │                           ├──→ FormulaEditManager.updateValue()
             │                           └──→ 同步 formulaBarEditingValue
             │
             └──→ @enter/tab/blur/cancel ──→ WorkbookSheet.handleGlobalOverlay*()
                                                   │
                                                   └──→ CanvasSheet.confirmEditingWithDirection()
```

---

## 核心状态管理

### FormulaEditManager (代理层状态)

位置：`src/components/sheet/formulaEditState.ts`

```typescript
interface FormulaEditState {
  // 编辑激活状态
  active: boolean                    // 是否正在编辑
  source: 'cell' | 'formulaBar' | null  // 编辑来源
  mode: 'edit' | 'typing'           // 编辑模式
  
  // 位置信息
  sourceSheetId: string | null      // 源 Sheet ID（跨 Sheet 编辑时不变）
  currentSheetId: string | null     // 当前浏览的 Sheet ID
  row: number                       // 编辑单元格行号
  col: number                       // 编辑单元格列号
  
  // 值状态
  originalValue: string             // 原始值（取消时恢复）
  currentValue: string              // 当前编辑值
  
  // 公式状态
  isFormulaMode: boolean            // 是否为公式（以=开头）
  formulaReferences: FormulaReference[]  // 公式引用列表
  
  // 光标状态
  cursorPosition: number            // 光标位置
  selectionRange: { start, end } | null  // 选中范围
  hasTextSelection: boolean         // 是否有文本选中
  isInSelectableState: boolean      // 是否可插入引用
}
```

#### 关键方法

| 方法 | 用途 | 触发时机 |
|------|------|----------|
| `startEdit(options)` | 开始编辑 | 双击单元格/F2/直接打字/点击公式栏 |
| `updateValue(value, cursorPos?)` | 更新编辑值 | 用户输入/引用插入 |
| `switchSource(source)` | 切换编辑源 | 点击公式栏/点击单元格 |
| `switchSheet(sheetId)` | 切换当前 Sheet | 跨 Sheet 选取引用 |
| `insertReference(ref)` | 插入单元格引用 | 点击单元格选取引用 |
| `confirmEdit()` | 确认编辑 | Enter/Tab/失焦 |
| `cancelEdit()` | 取消编辑 | Escape |
| `reset()` | 重置状态 | 编辑结束 |
| `isCrossSheetMode(sheetId)` | 判断跨 Sheet 模式 | Sheet 切换/引用插入 |

### WorkbookSheet 层状态

位置：`src/components/WorkbookSheet.vue`

```typescript
// 全局 Overlay 状态
const globalOverlay = reactive({
  visible: boolean,       // 是否显示
  value: string,          // 当前值
  sheetId: string,        // 所属 Sheet ID
  row: number,
  col: number,
  top: number,
  left: number,
  width: number,
  height: number,
  mode: 'edit' | 'typing',
  cellStyle: CellStyle | undefined
})

// 公式栏 UI 状态
const formulaBarIsEditing = ref(false)     // 是否处于编辑状态
const formulaBarEditingValue = ref('')     // 编辑中的值
const formulaReferences = ref([])          // 公式引用列表

// 跨 Sheet 状态
const crossSheetReferencesMap = ref(new Map())  // 跨 Sheet 引用映射
let skipNextSelectionChange = false             // 跳过下次选区变化
let lastInsertedReference = null               // 上次插入的引用（用于替换）
```

### CanvasSheet 层状态

位置：`src/components/sheet/composables/useSheetState.ts`

```typescript
// Overlay 状态
const overlay = reactive({
  visible: boolean,
  value: string,
  row: number,
  col: number,
  top: number,
  left: number,
  width: number,
  height: number,
  mode: 'edit' | 'typing'
})

// 选区状态
const selected = reactive({ row: number, col: number })
const selectionRange = reactive({
  startRow: number, startCol: number,
  endRow: number, endCol: number
})
```

---

## 组件职责划分

### FormulaBar.vue

**职责**：公式输入和显示的 UI 组件

| 功能 | 实现方式 | 关联事件 |
|------|----------|----------|
| 显示当前单元格地址 | `cellAddress` computed | - |
| 显示/编辑单元格内容 | contenteditable div | @input → emit('input') |
| 公式引用高亮 | `generateFormulaHtmlFromRefs()` | - |
| 键盘处理 | `handleFormulaKeydown()` | Enter→emit('confirm'), Tab→emit('tab'), Esc→emit('cancel') |
| 插入单元格引用 | `insertCellReference()` | 由 WorkbookSheet 调用 |
| 可选择状态判断 | `isInSelectablePosition()` | - |

**事件输出**：
- `@navigate(row, col)` - 跳转到单元格
- `@select-range(...)` - 选择范围
- `@start-edit` - 开始编辑
- `@confirm` - 确认编辑 (Enter)
- `@cancel` - 取消编辑 (Escape)
- `@tab` - 确认并向右移动 (Tab)
- `@blur` - 失焦确认
- `@input(value, cursorPos)` - 输入变化
- `@focus` - 获得焦点

### CellOverlayAdapter.vue

**职责**：单元格编辑覆盖层的适配器

| 功能 | 实现方式 | 关联事件 |
|------|----------|----------|
| 显示编辑内容 | CellOverlay 内部 div | - |
| 公式引用高亮 | `generateFormulaHtmlFromRefs()` | - |
| 值同步 | watch props.value | - |
| 外部 HTML 显示 | props.externalDisplayHtml | - |

**事件输出**：
- `@enter(value)` - Enter 确认
- `@tab(value)` - Tab 确认
- `@blur(value)` - 失焦
- `@cancel` - Escape 取消
- `@input-change` - 输入变化
- `@char-input(char)` - 字符输入
- `@click` - 点击事件

### WorkbookSheet.vue

**职责**：工作簿层协调器，管理跨 Sheet 编辑状态

| 功能 | 实现方式 |
|------|----------|
| FormulaEditManager 管理 | `formulaEditManager` 实例 |
| 全局 Overlay 管理 | `globalOverlay` reactive |
| 事件路由 | `handleFormulaBar*()` / `handleGlobalOverlay*()` |
| Sheet 切换处理 | `handleSheetChange()` |
| 选区变化处理 | `handleSelectionChange()` |
| 引用插入 | 调用 FormulaBar 或 FormulaEditManager |

### CanvasSheet.vue

**职责**：单个工作表的渲染和交互

| 功能 | 实现方式 |
|------|----------|
| Canvas 渲染 | useSheetDrawing |
| 鼠标交互 | useSheetMouse |
| 键盘交互 | useSheetKeyboard |
| 输入处理 | useSheetInput |
| 选区管理 | useSheetState |
| 数据保存 | `saveAndMove()` |

---

## 用户操作动作链详解

### 1. 直接在单元格输入（非公式）

```
用户按键（如 'a'）
    │
    ├─1→ CanvasSheet.handleImeKeyDown()
    │         │
    │         └─→ 判断是否需要开始编辑
    │                │
    │                └─→ input.openOverlay(row, col, '', 'typing')
    │
    ├─2→ useSheetInput.openOverlay()
    │         │
    │         ├─→ 计算 overlay 位置
    │         └─→ onOpenGlobalOverlay(payload)  // 通知 WorkbookSheet
    │
    ├─3→ WorkbookSheet.handleOpenOverlay()
    │         │
    │         ├─→ openGlobalOverlay(payload)
    │         │         │
    │         │         ├─→ globalOverlay.visible = true
    │         │         └─→ 设置位置/值等
    │         │
    │         └─→ globalOverlayRef.focus()
    │
    ├─4→ WorkbookSheet.handleEditingStateChange()
    │         │
    │         ├─→ FormulaEditManager.startEdit({ source: 'cell', ... })
    │         └─→ 更新 formulaBarIsEditing = true
    │
    └─5→ 用户继续输入
              │
              └─→ CellOverlay @input-change → WorkbookSheet.handleGlobalOverlayInputChange()
                       │
                       ├─→ FormulaEditManager.updateValue()
                       └─→ formulaBarEditingValue = value  // 同步到公式栏显示
```

### 2. 双击单元格编辑已有内容

```
用户双击单元格
    │
    └─→ useSheetMouse.onMouseDown() (检测到双击)
             │
             └─→ input.openOverlay(row, col, existingValue, 'edit')
                      │
                      └─→ 后续流程同上（openGlobalOverlay → startEdit）
```

### 3. 点击 FormulaBar 开始编辑

```
用户点击公式栏
    │
    └─→ FormulaBar @focus
             │
             └─→ WorkbookSheet.handleFormulaBarFocus()
                      │
                      └─→ formulaEditManager.actionSwitchToFormulaBar()
                               │
                               ├─→ 如果已在单元格编辑：switchSource('formulaBar')
                               └─→ 如果未编辑：不处理
```

```
用户点击公式栏开始编辑（从非编辑状态）
    │
    └─→ FormulaBar @start-edit
             │
             └─→ WorkbookSheet.handleFormulaBarStartEdit()
                      │
                      ├─→ formulaEditManager.actionStartFormulaBarEdit()
                      │         │
                      │         └─→ startEdit({ source: 'formulaBar', ... })
                      │
                      └─→ executeUIActions()
                               │
                               └─→ openGlobalOverlay (打开 overlay 同步显示)
```

### 4. 公式输入（同 Sheet 引用）

```
用户在 FormulaBar 输入 "=A1"
    │
    ├─1→ FormulaBar @input('=', 1)
    │         │
    │         └─→ WorkbookSheet.handleFormulaBarInput()
    │                  │
    │                  ├─→ formulaEditManager.actionInput('=', 1)
    │                  │         │
    │                  │         └─→ updateValue('=', 1)
    │                  │                  │
    │                  │                  ├─→ state.currentValue = '='
    │                  │                  ├─→ state.isFormulaMode = true
    │                  │                  └─→ state.isInSelectableState = true
    │                  │
    │                  └─→ globalOverlay.value = '='  // 同步到 overlay
    │
    ├─2→ 用户点击单元格 A1
    │         │
    │         └─→ CanvasSheet @selection-change
    │                  │
    │                  └─→ WorkbookSheet.handleSelectionChange()
    │                           │
    │                           ├─→ 检查条件：active && isFormulaMode && isInSelectableState
    │                           │         → 满足条件
    │                           │
    │                           ├─→ 生成引用: reference = 'A1'
    │                           │
    │                           └─→ if (source === 'formulaBar'):
    │                                    formulaBarRef.insertCellReference('A1')
    │                                else:
    │                                    formulaEditManager.insertReference('A1')
    │
    └─3→ FormulaBar.insertCellReference('A1')
              │
              ├─→ 更新 innerHTML（带高亮）
              ├─→ 更新光标位置
              └─→ emit('input', '=A1', 3)
```

### 5. 跨 Sheet 公式引用

```
用户在 Sheet1 编辑公式 "=A1+"，然后点击切换到 Sheet2
    │
    ├─1→ SheetTabBar @switch('sheet2_id')
    │         │
    │         └─→ WorkbookSheet.handleSheetChange('sheet2_id')
    │                  │
    │                  ├─→ 检查编辑状态
    │                  │         source === 'cell' || 'formulaBar'
    │                  │         isFormulaMode === true
    │                  │         isInSelectableState === true
    │                  │
    │                  ├─→ 进入跨 Sheet 模式
    │                  │         │
    │                  │         ├─→ hideGlobalOverlay()  // 隐藏但不销毁
    │                  │         ├─→ formulaEditManager.switchSheet('sheet2_id')
    │                  │         └─→ skipNextSelectionChange = true
    │                  │
    │                  └─→ workbook.setActiveSheet('sheet2_id')
    │
    ├─2→ 用户在 Sheet2 点击单元格 B5
    │         │
    │         └─→ CanvasSheet @selection-change
    │                  │
    │                  └─→ WorkbookSheet.handleSelectionChange()
    │                           │
    │                           ├─→ 检查 skipNextSelectionChange → false（第一次被跳过）
    │                           │
    │                           ├─→ 检查条件：满足
    │                           │
    │                           ├─→ isCrossSheetMode() → true
    │                           │         │
    │                           │         └─→ 生成跨 Sheet 引用: "Sheet2!B5"
    │                           │
    │                           └─→ 插入引用
    │                                    │
    │                                    └─→ formulaEditManager.insertReference('Sheet2!B5')
    │                                              │
    │                                              ├─→ currentValue = '=A1+Sheet2!B5'
    │                                              └─→ 同步到 FormulaBar 和 globalOverlay
    │
    └─3→ FormulaBar 显示更新后的公式（带彩色高亮）
```

### 6. Enter 键确认编辑

```
用户按 Enter
    │
    ├─ 场景A：在 FormulaBar 按 Enter
    │         │
    │         └─→ FormulaBar.handleFormulaKeydown({ key: 'Enter' })
    │                  │
    │                  ├─→ parseKeyAction() → { type: 'confirm' }
    │                  └─→ emit('confirm')
    │                           │
    │                           └─→ WorkbookSheet.handleFormulaBarConfirm()
    │                                    │
    │                                    ├─→ 获取值: value = mgr.state.currentValue
    │                                    ├─→ mgr.reset()
    │                                    ├─→ closeGlobalOverlay()
    │                                    │
    │                                    ├─→ 跨 Sheet 检查
    │                                    │         │
    │                                    │         ├─ 是：workbook.setActiveSheet(sourceSheetId)
    │                                    │         │         → nextTick: confirmEditingWithDirection()
    │                                    │         │
    │                                    │         └─ 否：直接 confirmEditingWithDirection()
    │                                    │
    │                                    └─→ canvasSheetRef.confirmEditingWithDirection(value, 'down')
    │
    └─ 场景B：在 CellOverlay 按 Enter
              │
              └─→ CellOverlayAdapter @enter(value)
                       │
                       └─→ WorkbookSheet.handleGlobalOverlayEnter()
                                │
                                ├─→ 如果 source === 'formulaBar':
                                │         handleFormulaBarConfirm()  // 委托给公式栏处理
                                │
                                └─→ 否则：
                                          │
                                          ├─→ mgr.updateValue(val)
                                          ├─→ canvasSheetRef.confirmEditingWithDirection(val, 'down')
                                          ├─→ hideGlobalOverlay()
                                          └─→ mgr.reset()
```

### 7. Tab 键确认并向右移动

```
用户按 Tab
    │
    ├─ FormulaBar: emit('tab') → handleFormulaBarTab()
    │
    └─ CellOverlay: @tab(value) → handleGlobalOverlayTab()
              │
              └─→ confirmEditingWithDirection(value, 'right')
                       │
                       └─→ useSheetInput.onOverlayTab(value, options)
                                │
                                └─→ saveAndMove(value, 'right', options)
                                         │
                                         ├─→ 保存值到 formulaSheet
                                         ├─→ 关闭 overlay
                                         └─→ selected 移动到右边单元格
```

### 8. Escape 键取消编辑

```
用户按 Escape
    │
    ├─ FormulaBar: emit('cancel') → handleFormulaBarCancel()
    │         │
    │         ├─→ 跨 Sheet 检查
    │         │         │
    │         │         ├─ 是：切回源 Sheet
    │         │         └─ 否：直接取消
    │         │
    │         ├─→ mgr.reset()
    │         ├─→ closeGlobalOverlay()
    │         └─→ canvasSheetRef.cancelEditing()
    │
    └─ CellOverlay: @cancel → handleGlobalOverlayCancel()
              │
              ├─→ 跨 Sheet 模式：
              │         │
              │         └─→ 切回源 Sheet + 恢复 overlay 显示原值
              │
              └─→ 同 Sheet 模式：
                        │
                        └─→ canvasSheetRef.cancelEditing()
                                 │
                                 └─→ useSheetInput.onOverlayCancel()
                                          │
                                          ├─→ 恢复原值（从 formulaSheet 重新读取）
                                          └─→ 关闭 overlay
```

### 9. 失焦自动保存

```
Overlay 或 FormulaBar 失焦
    │
    ├─ FormulaBar: @blur → handleFormulaBarBlur()
    │         │
    │         ├─→ 跨 Sheet 模式：忽略（焦点可能在目标 Sheet）
    │         ├─→ source !== 'formulaBar'：忽略
    │         └─→ 正常情况：确认保存（不移动）
    │
    └─ CellOverlay: @blur → handleGlobalOverlayBlur()
              │
              ├─→ 跨 Sheet 模式：忽略
              ├─→ source === 'formulaBar'：忽略
              └─→ source === 'cell'：保存并关闭
                       │
                       └─→ confirmEditingWithDirection(val, 'none')
```

---

## 状态同步机制

### FormulaBar ↔ CellOverlay 单向同步

**当前架构**：FormulaBar 为主，CellOverlay 为辅（只读镜像）

```
用户在 FormulaBar 输入
         │
         ├─→ FormulaBar 更新本地 innerHTML
         │
         ├─→ emit('input', value, cursorPos)
         │         │
         │         └─→ WorkbookSheet.handleFormulaBarInput()
         │                  │
         │                  ├─→ FormulaEditManager.updateValue()
         │                  └─→ globalOverlay.value = value  ←── 同步到 Overlay
         │
         └─→ CellOverlayAdapter watch props.value
                  │
                  └─→ 更新显示（同步 FormulaBar 的内容）
```

**注意**：当 `source === 'formulaBar'` 时，CellOverlay 使用 `externalDisplayHtml` 显示 FormulaBar 生成的 HTML，确保两者显示一致。

### CanvasSheet ↔ WorkbookSheet 状态同步

```
CanvasSheet 编辑状态变化
         │
         └─→ emit('editing-state-change', payload)
                  │
                  └─→ WorkbookSheet.handleEditingStateChange()
                           │
                           ├─→ 新编辑开始：
                           │         FormulaEditManager.startEdit()
                           │
                           ├─→ 同源更新：
                           │         FormulaEditManager.updateValue()
                           │         （忽略空值，防止覆盖 FormulaBar 的值）
                           │
                           └─→ 编辑结束：
                                    FormulaEditManager.reset()
```

### 跨 Sheet 引用替换机制

```typescript
// 记录上次插入的引用位置
let lastInsertedReference: {
  reference: string
  startPos: number
  endPos: number
} | null = null

// 选区变化时
if (lastInsertedReference && isCrossSheetMode) {
  // 删除上次插入的引用
  valueToUse = valueToUse.substring(0, startPos) + valueToUse.substring(endPos)
  cursorToUse = startPos
  mgr.updateValue(valueToUse, cursorToUse)
}

// 插入新引用
const result = mgr.insertReference(reference)

// 记录本次插入位置
lastInsertedReference = {
  reference,
  startPos: insertStartPos,
  endPos: insertStartPos + reference.length
}
```

---

## 当前架构的问题与优化方向

### 架构方案对比分析

在优化架构时，存在两种可选方案：

#### 方案 A：FormulaEditManager 为核心（推荐）

```
FormulaEditManager (唯一状态源)
      │
      ├─→ FormulaBar (纯渲染，接收 props)
      └─→ CellOverlay (纯渲染，接收 props)
```

#### 方案 B：FormulaBar 为核心

```
FormulaBar (编辑大脑，持有状态)
      │
      └─→ CellOverlay (镜像显示，接收 FormulaBar 生成的 HTML)
```

#### 对比分析

| 维度 | 方案 A (Manager 为核心) | 方案 B (FormulaBar 为核心) |
|------|------------------------|---------------------------|
| **单一数据源** | ✅ Manager 是唯一源 | ❌ FormulaBar 和 Manager 都有状态 |
| **可测试性** | ✅ 纯 TS 逻辑易测试 | ❌ 需要组件挂载测试 |
| **关注点分离** | ✅ 逻辑/UI 分离 | ❌ UI 组件混入逻辑 |
| **跨 Sheet 一致性** | ✅ 状态不受组件影响 | ⚠️ 依赖组件生命周期 |
| **代码组织** | ✅ 清晰 | ❌ 混合 |
| **状态同步** | ✅ 单向下发 | ❌ 双向同步易出错 |

#### 为什么选择方案 A

**1. 单一数据源原则 (Single Source of Truth)**

```
方案 A:
┌─────────────────────────────────────────┐
│     FormulaEditManager (唯一状态源)      │
│  currentValue: "=A1+B2"                 │
│  cursorPosition: 7                      │
└─────────────────────────────────────────┘
         │                    │
         ↓                    ↓
    FormulaBar           CellOverlay
    (读取状态)            (读取状态)

方案 B (有问题):
┌─────────────────────────────────────────┐
│     FormulaBar (状态源 1)               │
│  内部状态: cursorPos, isInSelectableState│
└─────────────────────────────────────────┘
         │
         ↓ (需要同步)
┌─────────────────────────────────────────┐
│     FormulaEditManager (状态源 2)       │
│  也维护: currentValue, cursorPosition   │
└─────────────────────────────────────────┘
```

方案 A 避免了状态分散的问题。当前代码中 FormulaBar 和 FormulaEditManager 都维护 `cursorPosition`，这正是 bug 的来源。

**2. 测试友好**

```typescript
// 方案 A：状态管理器是纯 TypeScript，容易测试
describe('FormulaEditManager', () => {
  it('should insert reference correctly', () => {
    const mgr = createFormulaEditStateManager()
    mgr.startEdit({ value: '=A1+', row: 0, col: 0, ... })
    mgr.insertReference('B2')
    expect(mgr.state.currentValue).toBe('=A1+B2')
  })
})

// 方案 B：状态在 Vue 组件内，需要挂载组件才能测试
describe('FormulaBar', () => {
  it('should insert reference correctly', async () => {
    const wrapper = mount(FormulaBar, { props: { ... } })
    // 复杂的组件交互测试...
  })
})
```

**3. 避免 Vue 响应式陷阱**

```typescript
// 方案 B 的潜在问题：FormulaBar 内部状态与 props 同步
const cursorPos = ref(0)

watch(() => props.editingValue, (newVal) => {
  // 需要手动同步内部状态，容易遗漏或出现时序问题
})
```

方案 A 用 Manager 的 `reactive` 状态作为唯一源，FormulaBar 只是读取和渲染。

---

### 当前存在的问题

#### 问题 1：状态分散（核心问题）🔴 仍然存在

**现状**（2024-12 代码审查）：
- FormulaEditManager 维护 `currentValue`、`cursorPosition`、`isInSelectableState` 等状态
- FormulaBar **仍然有**自己的内部状态：
  ```typescript
  // FormulaBar.vue 第 275-282 行
  const pendingCursorPosition = ref<number | null>(null)
  const isInSelectableState = ref(false)
  const lastOperatorPos = ref(-1)
  const hasTextSelectionState = ref(false)
  const cursorPos = ref(0)
  ```
- 两者需要手动同步，容易出现不一致（这正是之前 bug 的来源）

**优化方向**：
- FormulaEditManager 作为唯一数据源
- FormulaBar 改为纯 UI 组件，只负责渲染和事件转发
- 删除 FormulaBar 内部的状态变量

**优先级**：⭐⭐⭐ 高（核心问题，影响稳定性）

#### 问题 2：CellOverlay 在跨 Sheet 时的角色模糊 🟡 已部分解决

**现状**（2024-12 代码审查）：
- ✅ 跨 Sheet 模式下 CellOverlay 正确隐藏
- ✅ FormulaBar 成为唯一可见的编辑界面
- ✅ 确认/取消时自动切回源 Sheet
- ⚠️ 代码中仍有较多 `isCrossSheetMode()` 判断分散在各处

**优化方向**：
- 进一步封装跨 Sheet 逻辑到 FormulaEditManager
- 减少 WorkbookSheet 中的条件判断

**优先级**：⭐⭐ 中（功能正常，但代码可读性待提升）

#### 问题 3：事件处理分散 🔴 仍然存在

**现状**（2024-12 代码审查）：
- Enter/Tab/Escape 在 FormulaBar 和 CellOverlay **仍有独立处理函数**
- 例如 `handleGlobalOverlayEnter` 内部判断 `source === 'formulaBar'` 后调用 `handleFormulaBarConfirm()`
- 这种委托模式虽然能工作，但增加了代码复杂度

```
当前的处理方式（部分委托）：

FormulaBar                          CellOverlay
    │                                    │
    ├─→ @input → handleFormulaBarInput   ├─→ @input-change → handleGlobalOverlayInputChange
    ├─→ @confirm → handleFormulaBarConfirm ├─→ @enter → handleGlobalOverlayEnter
    │                                    │         ├─→ if source==='formulaBar': 委托给 handleFormulaBarConfirm
    │                                    │         └─→ else: 自己处理
    ├─→ @cancel → handleFormulaBarCancel  ├─→ @cancel → handleGlobalOverlayCancel
    ├─→ @tab → handleFormulaBarTab        ├─→ @tab → handleGlobalOverlayTab
    └─→ @blur → handleFormulaBarBlur      └─→ @blur → handleGlobalOverlayBlur

存在 10 个处理函数，其中部分有委托关系，但核心逻辑仍然分散
```

**优化方向**：统一动作入口

**优先级**：⭐⭐⭐ 高（影响代码可维护性）

```
目标架构：

FormulaBar                          CellOverlay
    │                                    │
    └─────────────┬──────────────────────┘
                  │
                  ↓
         统一动作处理器 (Unified Action Handler)
                  │
                  ├─→ handleEditInput(value, cursorPos, source)
                  ├─→ handleEditConfirm(source, direction)
                  ├─→ handleEditCancel(source)
                  └─→ handleEditBlur(source)
                  │
                  ↓
           FormulaEditManager
```

#### 统一动作入口设计

**动作类型定义**：

```typescript
/** 编辑动作来源 */
type EditActionSource = 'formulaBar' | 'cellOverlay'

/** 确认方向 */
type ConfirmDirection = 'down' | 'right' | 'none'

/** 统一动作类型 */
type EditAction = 
  | { type: 'input'; value: string; cursorPos: number; source: EditActionSource }
  | { type: 'confirm'; direction: ConfirmDirection; source: EditActionSource }
  | { type: 'cancel'; source: EditActionSource }
  | { type: 'blur'; source: EditActionSource }
  | { type: 'focus'; source: EditActionSource }
  | { type: 'cursor-change'; position: number; source: EditActionSource }
```

**统一处理函数**：

```typescript
// ==================== 统一动作处理器 ====================

/**
 * 统一处理编辑输入
 * FormulaBar @input 和 CellOverlay @input-change 都调用此函数
 */
function handleEditInput(value: string, cursorPos: number, source: EditActionSource) {
  const mgr = formulaEditManager
  
  if (!mgr.state.active) return
  
  // 更新 Manager 状态
  mgr.updateValue(value, cursorPos)
  
  // 清除上次插入的引用记录（用户主动输入）
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
 * FormulaBar @confirm/@tab 和 CellOverlay @enter/@tab 都调用此函数
 */
function handleEditConfirm(direction: ConfirmDirection, source: EditActionSource) {
  const mgr = formulaEditManager
  
  if (!mgr.state.active) {
    // 回退：直接通过 CanvasSheet 确认
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
 * FormulaBar @cancel 和 CellOverlay @cancel 都调用此函数
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
 * FormulaBar @blur 和 CellOverlay @blur 都调用此函数
 */
function handleEditBlur(source: EditActionSource) {
  const mgr = formulaEditManager
  
  // 跨 Sheet 模式：忽略 blur
  if (mgr.isCrossSheetMode(activeSheetId.value ?? '')) {
    return
  }
  
  // 公式模式：不自动保存（用户可能在选择引用）
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

**简化后的事件处理函数**：

```typescript
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
  handleEditInput(value, /* cursorPos */ value.length, 'cellOverlay')
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

**统一动作入口的优势**：

| 优势 | 说明 |
|------|------|
| **逻辑集中** | 所有编辑逻辑在一处，易于理解和维护 |
| **一致性保证** | FormulaBar 和 CellOverlay 走同一条代码路径 |
| **易于测试** | 可以直接测试 `handleEditConfirm` 等函数 |
| **减少重复** | 不再需要写两套相似的处理逻辑 |
| **source 追踪** | 每个动作都带有来源信息，便于调试 |

#### 问题 4：formulaEditUtils.ts 与 formulaEditState.ts 职责不清 🟢 已基本解决

**现状**（2024-12 代码审查）：
- ✅ `formulaEditState.ts`：状态管理 + FormulaEditManager
- ✅ `formulaEditUtils.ts`：纯工具函数（HTML生成、光标操作、常量定义）
- ✅ 职责划分已相对清晰

**优化方向**：
- 继续保持当前分离
- 如有新增工具函数，放入 `formulaEditUtils.ts`

**优先级**：⭐ 低（当前已基本满足需求）

---

### 问题优先级总结

| 问题 | 状态 | 优先级 | 影响 |
|------|------|--------|------|
| 问题 1：状态分散 | 🔴 存在 | ⭐⭐⭐ | bug 主要来源 |
| 问题 2：跨 Sheet 角色 | 🟡 部分解决 | ⭐⭐ | 代码可读性 |
| 问题 3：事件处理分散 | 🔴 存在 | ⭐⭐⭐ | 可维护性 |
| 问题 4：职责不清 | 🟢 已解决 | ⭐ | 无明显影响 |

---

### 推荐的目标架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      WorkbookSheet                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │        FormulaEditManager (唯一状态源)                    │    │
│  │  - active, source, sourceSheetId                         │    │
│  │  - currentValue, originalValue                           │    │
│  │  - cursorPosition, isInSelectableState                   │    │
│  │  - formulaReferences                                     │    │
│  │  - 所有编辑逻辑方法                                       │    │
│  │  - displayHtml (computed，供 UI 使用)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│           │ props (只读)              │ props (只读)            │
│           ↓                           ↓                         │
│  ┌───────────────────┐      ┌─────────────────────────┐        │
│  │   FormulaBar      │      │      CellOverlay        │        │
│  │   (纯渲染)        │      │      (纯渲染)           │        │
│  │   - 显示内容      │      │      - 显示内容         │        │
│  │   - 转发事件 ↑    │      │      - 转发事件 ↑       │        │
│  └───────────────────┘      └─────────────────────────┘        │
│           │ emit                      │ emit                    │
│           └───────────────────────────┘                         │
│                        │                                        │
│                        ↓                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              事件处理器 (WorkbookSheet)                  │    │
│  │  handleInput() → Manager.updateValue()                  │    │
│  │  handleConfirm() → Manager.confirmEdit() → save         │    │
│  │  handleSelectionChange() → Manager.insertReference()    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 重构步骤

#### 1. 删除 FormulaBar 内部的状态

需要移除的状态变量：
- `cursorPos` → 从 Manager props 读取
- `isInSelectableState` → 从 Manager props 读取
- `lastOperatorPos` → 移到 Manager
- `hasTextSelectionState` → 从 Manager props 读取

#### 2. FormulaBar 变成纯渲染组件

```vue
<script setup>
const props = defineProps<{
  value: string
  cursorPosition: number
  isEditing: boolean
  formulaReferences: FormulaReference[]
  isInSelectableState: boolean
  displayHtml: string  // Manager 计算好的 HTML
}>()

const emit = defineEmits<{
  (e: 'input', value: string, cursorPos: number): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'tab'): void
  (e: 'cursor-change', position: number): void
}>()

// 只有渲染逻辑，没有状态管理
</script>
```

#### 3. Manager 暴露 computed 属性

```typescript
// FormulaEditManager 内部
const displayHtml = computed(() => 
  generateFormulaHtmlFromRefs(state.currentValue, state.formulaReferences, state.isFormulaMode)
)

return {
  state,
  displayHtml,  // 供 FormulaBar 和 CellOverlay 使用
  // ... 其他方法
}
```

#### 4. 统一光标管理

```typescript
// Manager 管理光标位置
function updateCursorPosition(pos: number) {
  state.cursorPosition = pos
  state.isInSelectableState = isInSelectablePosition(state.currentValue, pos)
}

// FormulaBar 只负责上报光标变化
// @cursor-change → WorkbookSheet → Manager.updateCursorPosition()
```

### 预期收益

1. **消除状态重复** - 单一数据源，不存在同步问题
2. **简化事件处理** - 所有逻辑集中在 WorkbookSheet
3. **提高可测试性** - 核心逻辑可独立单元测试
4. **降低复杂度** - 组件职责清晰，易于理解和维护
5. **减少 bug** - 状态一致性由架构保证

---

### 推荐重构顺序

基于问题优先级和依赖关系，推荐按以下顺序重构：

```
第 1 步：统一动作入口（问题 3）
   │
   ├─→ 风险：低（不改变组件接口）
   ├─→ 收益：高（消除重复代码）
   └─→ 可独立完成，每步可测试
   
第 2 步：删除 FormulaBar 内部状态（问题 1）
   │
   ├─→ 风险：中（需修改 FormulaBar 接口）
   ├─→ 收益：高（解决核心状态分散问题）
   └─→ 依赖第 1 步完成
   
第 3 步：优化跨 Sheet 逻辑封装（问题 2）
   │
   ├─→ 风险：低
   ├─→ 收益：中（提升代码可读性）
   └─→ 可选，不影响功能
```

**建议**：先完成第 1 步，观察效果后再决定是否继续。
