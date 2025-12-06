# CellOverlay 与 FormulaBar 行为文档

## 概述

本文档描述 CellOverlay（单元格编辑覆盖层）和 FormulaBar（公式栏）的事件绑定和行为，以及在跨 Sheet 公式引用场景下的特殊处理。两个组件在编辑行为上保持一致。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WorkbookSheet.vue                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               FormulaEditManager (唯一编辑状态中心)                     │  │
│  │                                                                        │  │
│  │  核心状态:                                                             │  │
│  │  - active: boolean           是否处于编辑状态                          │  │
│  │  - source: 'cell' | 'formulaBar' | null   焦点来源                     │  │
│  │  - sourceSheetId: string     编辑单元格所属 Sheet（始终不变）           │  │
│  │  - currentSheetId: string    当前浏览的 Sheet（跨 Sheet 时变化）        │  │
│  │  - currentValue: string      当前编辑值                                │  │
│  │  - cursorPosition: number    光标位置                                  │  │
│  │  - isFormulaMode: boolean    是否公式（=开头）                         │  │
│  │  - isInSelectableState: boolean   光标是否在可插入引用位置             │  │
│  │  - arrowSelectMode: boolean  是否处于方向键选择模式                    │  │
│  │  - arrowSelectRow/Col/SheetId    方向键选择的当前位置                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│         ┌────────────────────┼────────────────────┐                         │
│         ↓                    ↓                    ↓                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  FormulaBar  │    │  CellOverlay │    │  CanvasSheet │                   │
│  │  (公式栏)    │    │  (编辑覆盖层) │    │  (画布)      │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## CellOverlay 事件绑定

### 1. 键盘事件 (`@keydown`)

**处理函数**: `handleOverlayKeyDown`

#### Enter 键
- **行为**: 确认编辑，移动到下一行
- **逻辑**:
  ```
  1. 调用 confirmOverlayEdit() 保存值
  2. 移动选区到下一行 (row + 1)
  3. 聚焦回 imeProxy
  ```

#### Escape 键
- **行为**: 取消编辑，恢复原值
- **逻辑**:
  ```
  1. 调用 cancelOverlayEdit()
  2. 如果在跨 Sheet 模式，切回源 Sheet
  3. 聚焦回 imeProxy
  ```

#### Tab 键
- **行为**: 确认编辑，移动到下一列
- **逻辑**:
  ```
  1. 调用 confirmOverlayEdit() 保存值
  2. 移动选区到下一列 (col + 1)，Shift+Tab 移动到上一列
  3. 聚焦回 imeProxy
  ```

#### 方向键 (Arrow Keys)

方向键处理分三种情况：

| 情况 | 条件 | 行为 |
|------|------|------|
| 1 | 已在方向键选择模式 (`arrowSelectMode = true`) | 继续移动选择位置 |
| 2 | 公式模式 + 光标在可选择位置 (`isFormulaMode && isInSelectableState`) | 进入方向键选择模式 |
| 3 | 其他情况 | 退出编辑，移动选区 |

**情况 2 详细逻辑**:
```
1. 检查是否有现有引用需要替换
   - 如果有: 以该引用的单元格位置为起点
   - 如果没有:
     - 跨 Sheet 模式: 从 A1 开始
     - 同 Sheet 模式: 从编辑单元格开始
2. 根据方向计算新位置
3. 进入方向键选择模式
4. 插入/替换引用
```

### 2. 值变化事件 (`@value-change`)

**处理函数**: `handleOverlayValueChange`

**行为**:
- 退出方向键选择模式（如果在该模式）
- 更新 FormulaEditManager 的值和光标位置

### 3. IME 事件

| 事件 | 处理函数 | 行为 |
|------|----------|------|
| `@composition-start` | `handleOverlayCompositionStart` | 标记开始输入法输入 |
| `@composition-update` | `handleOverlayCompositionUpdate` | 更新输入法预览 |
| `@composition-end` | `handleOverlayCompositionEnd` | 提交输入法文本 |

### 4. 焦点事件

#### Focus (`@focus`)
**处理函数**: `handleOverlayFocus`
- 切换 FormulaEditManager 的 source 为 'cell'

#### Blur (`@blur`)
**处理函数**: `handleOverlayBlur`

**复杂的焦点丢失处理逻辑**:

```
1. 如果焦点转移到公式栏 → 不关闭
2. 如果在公式可选择状态:
   - 点击 Sheet 标签 → 不关闭（允许跨 Sheet 选择）
   - 跨 Sheet 模式 → 不关闭
   - 同 Sheet 等待引用选择 → 不关闭
3. 其他情况 → 保存并关闭
```

### 5. 点击事件 (`@click`)

**处理函数**: `handleOverlayClick`
- 退出方向键选择模式

---

## FormulaBar 事件绑定

FormulaBar 的事件处理与 CellOverlay 保持一致。

### 1. 键盘事件 (`@keydown`)

**处理函数**: `handleFormulaBarKeyDown`

与 CellOverlay 完全一致的行为：
- **Enter**: 确认编辑，移动到下一行，聚焦回 imeProxy
- **Escape**: 取消编辑，聚焦回 imeProxy
- **Tab**: 确认编辑，移动到下一列，聚焦回 imeProxy
- **方向键**: 三种情况处理（方向键选择模式、进入选择模式、退出编辑）

### 2. 值变化事件 (`@value-change`)

**处理函数**: `handleFormulaBarValueChange`

**行为**:
- 如果未在编辑状态，开始新编辑
- 退出方向键选择模式（如果在该模式）
- 更新 FormulaEditManager 的值和光标位置

**事件负载**:
```typescript
{ value: string; cursorPosition: number }
```

### 3. IME 事件

| 事件 | 处理函数 | 行为 |
|------|----------|------|
| `@composition-end` | `handleFormulaBarCompositionEnd` | 退出方向键选择模式，提交输入法文本 |

### 4. 焦点事件

#### Focus (`@focus`)
**处理函数**: `handleFormulaBarFocus`
- 切换 FormulaEditManager 的 source 为 'formulaBar'

#### Blur (`@blur`)
**处理函数**: `handleFormulaBarBlur`

与 CellOverlay 一致的焦点丢失处理逻辑：
```
1. 如果焦点转移到 Overlay → 不关闭
2. 如果在公式可选择状态:
   - 点击 Sheet 标签 → 不关闭（允许跨 Sheet 选择）
   - 跨 Sheet 模式 → 不关闭
   - 同 Sheet 等待引用选择 → 不关闭
3. 其他情况 → 保存并关闭
```

### 5. 点击事件 (`@click`)

**处理函数**: `handleFormulaBarClick`
- 退出方向键选择模式（如果在该模式）
- 如果未在编辑状态，开始编辑当前单元格
- 如果已在编辑中，切换焦点到公式栏

---

## Overlay 显示/隐藏逻辑

### Props 控制

| Prop | 计算属性 | 说明 |
|------|----------|------|
| `visible` | `shouldShowOverlay` | 是否渲染 |
| `hidden` | `isOverlayHidden` | 是否视觉隐藏（但保持焦点） |

### shouldShowOverlay

```typescript
const shouldShowOverlay = computed(() => {
  return globalOverlay.value.visible && formulaEditManager.state.active
})
```

### isOverlayHidden

```typescript
const isOverlayHidden = computed(() => {
  // 跨 Sheet 模式：只要 sourceSheetId !== currentSheetId 就隐藏
  // 不管是否处于可选择状态
  if (!formulaEditManager.state.active) return false
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  const currentActiveSheetId = activeSheetId.value
  return sourceSheetId !== null && currentActiveSheetId !== sourceSheetId
})
```

### CSS 隐藏实现

```css
.cell-overlay--hidden {
  /* 视觉隐藏但保持焦点和键盘输入 */
  opacity: 0;
  pointer-events: none;
}

.cell-overlay--hidden .display-area {
  /* 允许输入区域接收键盘事件 */
  pointer-events: auto;
}
```

---

## 跨 Sheet 引用流程

### 状态判断

```typescript
// 是否处于跨 Sheet 引用模式
const isCrossSheetReferenceMode = computed(() => {
  const active = formulaEditManager.state.active
  const isInSelectableState = formulaEditManager.state.isInSelectableState
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  const currentActiveSheetId = activeSheetId.value
  
  if (!active) return false
  if (!isInSelectableState) return false
  return currentActiveSheetId !== sourceSheetId
})
```

### 完整流程

```
用户在 Sheet1!A1 编辑公式 "=SUM("
         │
         ↓
┌─────────────────────────────────────┐
│ 状态:                               │
│ - active = true                     │
│ - sourceSheetId = 'sheet1'          │
│ - isInSelectableState = true        │
│ - isOverlayHidden = false           │
└─────────────────────────────────────┘
         │
         ↓ 用户点击 Sheet2 标签
         │
┌─────────────────────────────────────┐
│ handleOverlayBlur 检测:             │
│ - 点击目标是 Sheet 标签             │
│ - 处于公式可选择状态                │
│ → 不关闭编辑，允许跨 Sheet 选择     │
└─────────────────────────────────────┘
         │
         ↓ Sheet 切换完成
         │
┌─────────────────────────────────────┐
│ 状态更新:                           │
│ - currentSheetId = 'sheet2'         │
│ - isOverlayHidden = true            │
│ - Overlay 视觉隐藏但保持焦点        │
│ - FormulaBar 继续显示公式           │
│ - skipNextSelectionReference = true │
└─────────────────────────────────────┘
         │
         ↓ 用户在 Sheet2 点击 B3:C5
         │
┌─────────────────────────────────────┐
│ handleSelectionChange:              │
│ - shouldInsertReference = true      │
│ - 生成引用: "Sheet2!B3:C5"          │
│ - 插入到公式: "=SUM(Sheet2!B3:C5"   │
│ - 进入方向键选择模式                │
└─────────────────────────────────────┘
         │
         ↓ 用户按 Enter 确认
         │
┌─────────────────────────────────────┐
│ confirmOverlayEdit:                 │
│ 1. 获取结果: { sheetId: 'sheet1',   │
│    row: 0, col: 0, value: ... }     │
│ 2. 切回 Sheet1                      │
│ 3. 保存值到 Sheet1!A1               │
│ 4. 选中 A1，关闭 Overlay            │
└─────────────────────────────────────┘
```

### 跨 Sheet 取消编辑

```
用户按 Escape
         │
         ↓
┌─────────────────────────────────────┐
│ cancelOverlayEdit:                  │
│ 1. 调用 formulaEditManager.cancel() │
│ 2. 获取源 Sheet 位置                │
│ 3. 切回 Sheet1                      │
│ 4. 选中原编辑单元格，恢复原值       │
└─────────────────────────────────────┘
```

---

## 方向键选择模式

### 状态

```typescript
interface ArrowSelectState {
  arrowSelectMode: boolean      // 是否在方向键选择模式
  arrowSelectRow: number        // 当前选中行
  arrowSelectCol: number        // 当前选中列
  arrowSelectSheetId: string    // 当前选中的 Sheet
}
```

### 进入条件

1. 公式模式 (`isFormulaMode = true`)
2. 光标在可选择位置 (`isInSelectableState = true`)
3. 按下方向键

### 起始位置确定

```
1. 检查当前光标位置是否有待替换的引用
   ↓
   有引用 → 解析引用位置作为起点
   ↓
   无引用 → 
     - 跨 Sheet: A1 作为起点
     - 同 Sheet: 编辑单元格位置作为起点
   ↓
2. 根据方向移动（有引用或同 Sheet 时移动，跨 Sheet 无引用时第一次就是 A1）
```

### 退出条件

1. 点击 Overlay
2. 输入任何字符
3. 按 Enter/Escape 确认/取消编辑

---

## 关键函数

### confirmOverlayEdit

```typescript
function confirmOverlayEdit() {
  const result = formulaEditManager.confirmEdit()
  // 1. 关闭 overlay
  // 2. 如果跨 Sheet，切回源 Sheet
  // 3. 保存值到源单元格
  // 4. 更新选区和焦点
}
```

### cancelOverlayEdit

```typescript
function cancelOverlayEdit() {
  const result = formulaEditManager.cancelEdit()
  // 1. 关闭 overlay
  // 2. 如果跨 Sheet，切回源 Sheet
  // 3. 恢复选区和焦点
}
```

### handleReferenceSelect

```typescript
function handleReferenceSelect(payload) {
  // 由 CanvasSheet 在公式可选择状态下点击单元格触发
  // 1. 生成引用字符串（包括跨 Sheet 前缀）
  // 2. 调用 formulaEditManager.insertReference()
  // 3. 重新聚焦 Overlay
}
```

---

## Sheet 切换处理

### handleSheetChange

当用户切换 Sheet 时：

```typescript
// 在公式可选择状态下切换 Sheet
if (formulaEditManager.state.active && 
    formulaEditManager.state.isFormulaMode && 
    formulaEditManager.state.isInSelectableState) {
  // 进入跨 Sheet 引用模式
  skipNextSelectionReference.value = true  // 跳过切换后的默认选区触发
  formulaEditManager.switchSheet(newSheetId)
  // Overlay 自动隐藏（isOverlayHidden 计算属性）
}
```

### skipNextSelectionReference

防止切换 Sheet 后恢复默认选区时自动插入引用：

```typescript
// 切换 Sheet 时设置
skipNextSelectionReference.value = true

// handleSelectionChange 中检查
if (skipNextSelectionReference.value) {
  skipNextSelectionReference.value = false
  return  // 跳过这次选区变化
}
```

---

## 总结

### 事件处理对比

| 事件 | CellOverlay | FormulaBar | 行为一致性 |
|------|-------------|------------|------------|
| `keydown` | `handleOverlayKeyDown` | `handleFormulaBarKeyDown` | ✅ 完全一致 |
| `value-change` | `handleOverlayValueChange` | `handleFormulaBarValueChange` | ✅ 完全一致 |
| `composition-end` | `handleOverlayCompositionEnd` | `handleFormulaBarCompositionEnd` | ✅ 完全一致 |
| `focus` | `handleOverlayFocus` | `handleFormulaBarFocus` | ✅ 完全一致 |
| `blur` | `handleOverlayBlur` | `handleFormulaBarBlur` | ✅ 完全一致 |
| `click` | `handleOverlayClick` | `handleFormulaBarClick` | ✅ 完全一致 |

### 功能实现方式

| 功能 | 实现方式 |
|------|----------|
| 编辑状态管理 | FormulaEditManager 作为唯一状态中心 |
| Overlay 显示控制 | `shouldShowOverlay` + `isOverlayHidden` |
| 跨 Sheet 引用 | 切换 Sheet 时隐藏 Overlay，保持编辑状态 |
| 方向键选择 | `arrowSelectMode` 状态 + `arrowMove` 方法 |
| 引用插入 | `handleSelectionChange` + `handleReferenceSelect` |
| 焦点管理 | blur 事件精细控制不同场景 |
| FormulaBar 同步 | 与 Overlay 共用 FormulaEditManager，行为一致 |
