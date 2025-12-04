# RichTextInput 行为链文档

本文档描述 RichTextInput.vue（单元格富文本编辑器）的完整行为链和事件处理流程。

---

## 目录

1. [组件概述](#组件概述)
2. [组件架构](#组件架构)
3. [Props 与 Events](#props-与-events)
4. [行为场景](#行为场景)
   - [场景 1: 编辑启动](#场景-1-编辑启动)
   - [场景 2: 文本输入](#场景-2-文本输入)
   - [场景 3: 公式编辑](#场景-3-公式编辑)
   - [场景 4: 引用插入](#场景-4-引用插入)
   - [场景 5: 编辑确认](#场景-5-编辑确认)
   - [场景 6: 编辑取消](#场景-6-编辑取消)
   - [场景 7: 焦点切换到 FormulaBar](#场景-7-焦点切换到-formulabar)
5. [状态管理](#状态管理)
6. [尺寸自适应](#尺寸自适应)
7. [样式系统](#样式系统)
8. [方法索引](#方法索引)

---

## 组件概述

`RichTextInput.vue` 是单元格内的富文本编辑器，支持：
- 普通文本编辑
- 公式输入（以 `=` 开头）
- 公式引用彩色高亮
- IME 输入法支持
- 自动换行与尺寸调整
- 与 FormulaBar 协同编辑

---

## 组件架构

```
┌─────────────────────────────────────────────────────────────┐
│                     RichTextInput.vue                        │
├─────────────────────────────────────────────────────────────┤
│  Props（外部输入）                                           │
│  ├─ visible, value, row, col, top, left, width, height      │
│  ├─ mode ('edit' | 'typing')                                │
│  ├─ isFormula, cellStyle, formulaReferences                 │
│  └─ viewportWidth                                           │
├─────────────────────────────────────────────────────────────┤
│  内部状态                                                    │
│  ├─ internal.value (编辑中的文本值)                         │
│  ├─ cursorPos.value (光标位置)                              │
│  ├─ isComposing.value (IME 组合状态)                        │
│  ├─ formulaMode (computed: 是否公式模式)                     │
│  ├─ isInSelectableState.value (是否可插入引用)              │
│  └─ autoWidth/autoHeight (自动尺寸)                         │
├─────────────────────────────────────────────────────────────┤
│  Events（输出事件）                                          │
│  ├─ enter(val) → Enter 确认，向下移动                        │
│  ├─ tab(val) → Tab 确认，向右移动                           │
│  ├─ blur(val) → 失焦保存，不移动                            │
│  ├─ cancel() → Escape 取消                                  │
│  └─ input-change() → 内容变化通知                           │
├─────────────────────────────────────────────────────────────┤
│  Expose（暴露方法）                                          │
│  ├─ formulaMode, isInSelectableState, hasTextSelection      │
│  ├─ insertCellReference(addr), insertRangeReference(...)    │
│  └─ getCurrentValue(), getEditorElement()                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Props 与 Events

### Props

| Prop | 类型 | 说明 |
|------|------|------|
| `visible` | `boolean` | 是否显示编辑器 |
| `value` | `string` | 初始/同步值 |
| `row` | `number` | 单元格行号 |
| `col` | `number` | 单元格列号 |
| `top` | `number` | 顶部偏移 (px) |
| `left` | `number` | 左侧偏移 (px) |
| `width` | `number` | 单元格宽度 |
| `height` | `number` | 单元格高度 |
| `mode` | `'edit' \| 'typing'` | 编辑模式 |
| `isFormula` | `boolean` | 是否公式（可选） |
| `cellStyle` | `CellStyle` | 单元格样式 |
| `formulaReferences` | `FormulaReferenceTextIndex[]` | 公式引用列表 |
| `viewportWidth` | `number` | 可视区域宽度（限制右边界） |

### Events

| Event | 参数 | 说明 |
|-------|------|------|
| `enter` | `val: string` | Enter 确认，通知向下移动 |
| `tab` | `val: string` | Tab 确认，通知向右移动 |
| `blur` | `val: string` | 失焦保存（非公式模式） |
| `cancel` | - | Escape 取消编辑 |
| `input-change` | - | 内容变化，通知父组件更新引用 |

---

## 行为场景

### 场景 1: 编辑启动

#### 1.1 双击单元格启动（mode='edit'）

```
用户双击单元格
    ↓
CanvasSheet.handleDoubleClick()
    ↓
input.openOverlay(row, col, displayValue, 'edit')
    ↓
overlay.visible = true, overlay.value = displayValue
    ↓
RichTextInput 渲染（visible=true）
    ↓
setEditorRef() → nextTick() → initializeEditor()
    ↓
internal.value = props.value
updateEditorContent(value, false)
editorRef.focus()
setCursorPosition(text.length)  // 光标在末尾
adjustSize()
```

#### 1.2 输入字符启动（mode='typing'）

```
用户按下字符键（如 'A'）
    ↓
useSheetKeyboard.handleKeyDown()
    ↓
input.openOverlay(row, col, 'A', 'typing')
    ↓
overlay.visible = true, overlay.value = 'A'
    ↓
RichTextInput 渲染
    ↓
initializeEditor()
    ↓
internal.value = 'A'
光标在末尾
```

#### 1.3 从 FormulaBar 启动

```
用户点击 FormulaBar 开始编辑
    ↓
FormulaBar emit('start-edit')
    ↓
WorkbookSheet.handleFormulaBarStartEdit()
    ↓
formulaEditManager.startEdit({ source: 'formulaBar', ... })
    ↓
canvasSheetRef.openOverlay(row, col, value, 'edit')
    ↓
RichTextInput 渲染
    ↓
initializeEditor() 检测到 FormulaBar 有焦点
    ↓
不调用 editorRef.focus()  // 避免抢夺焦点
```

---

### 场景 2: 文本输入

#### 2.1 普通字符输入

```
用户输入字符
    ↓
handleInput(e: Event)
    ↓
检查 isComposing.value → 如果 IME 组合中，跳过
    ↓
text = getEditorTextContent(editorRef)
internal.value = text
cursorPos.value = getCursorPosition()
    ↓
如果 formulaMode：
  updateSelectableState()  // 更新可选择状态
    ↓
adjustSize()  // 自动调整尺寸
emit('input-change')  // 通知父组件
```

#### 2.2 IME 输入法输入

```
用户开始输入中文
    ↓
handleCompositionStart()
    ↓
isComposing.value = true
（此时 handleInput 会被跳过）
    ↓
用户选择候选词
    ↓
handleCompositionEnd()
    ↓
isComposing.value = false
handleInput()  // 处理最终文本
emit('input-change')
```

#### 2.3 粘贴操作

```
用户 Ctrl/Cmd+V 粘贴
    ↓
handlePaste(e: ClipboardEvent)
    ↓
e.preventDefault()  // 阻止默认粘贴
    ↓
text = e.clipboardData.getData('text/plain')
检查长度限制（MAX_PASTE_LENGTH = 5000）
    ↓
计算新文本：before + text + after
internal.value = newText
    ↓
updateEditorContent(newText, false)
setCursorPosition(插入后位置)
    ↓
adjustSize()
emit('input-change')
```

---

### 场景 3: 公式编辑

#### 3.1 公式模式判断

```typescript
const formulaMode = computed(() => internal.value?.startsWith('=') ?? false)
```

#### 3.2 公式输入流程

```
用户输入 '='
    ↓
handleInput()
    ↓
internal.value = '='
formulaMode.value → true
    ↓
updateSelectableState()  // 检查是否可插入引用
    ↓
因为 cursorPos=1，前一个字符是 '='
isInSelectableState.value = true
    ↓
边框颜色变为绿色（可选择状态）
```

#### 3.3 公式引用高亮

```
父组件传入 formulaReferences 变化
    ↓
watch(props.formulaReferences)
    ↓
如果 formulaMode && visible：
  updateEditorContent(internal.value, true)
    ↓
generateFormulaHtmlFromRefs(text, references, true)
    ↓
HTML: '=<span style="color:#4472C4">A1</span>+<span style="color:#ED7D31">B1</span>'
    ↓
editorRef.innerHTML = html
保持光标位置
```

---

### 场景 4: 引用插入

#### 4.1 单元格引用插入

```
用户在公式模式下点击其他单元格
    ↓
useSheetMouse 调用 insertFormulaReference()
    ↓
overlayInput.insertCellReference('B2')
    ↓
insertCellReference() 内部：
    ↓
检查 findReferenceToReplace()
  - 如果光标在已有引用上 → 替换
  - 否则 → 在光标位置插入
    ↓
newText = beforeCursor + 'B2' + afterCursor
internal.value = newText
cursorPos.value = 新位置
    ↓
updateEditorContent(newText, false)
setCursorPosition(newCursorPos)
updateSelectableState()
emit('input-change')
    ↓
返回 newText（供父组件更新 formulaReferences）
```

#### 4.2 区域引用插入

```
用户拖拽选择区域
    ↓
useSheetMouse 调用 insertRangeReference()
    ↓
overlayInput.insertRangeReference('B2', 'D5')
    ↓
insertRangeReference() 内部调用 insertCellReference('B2:D5')
```

#### 4.3 替换已有引用

```
公式：=A1+B2，光标在 'A1' 中间
    ↓
用户点击 C3
    ↓
findReferenceToReplace() 返回 { start: 1, end: 3, ref: 'A1' }
    ↓
替换 'A1' → 'C3'
结果：=C3+B2
```

---

### 场景 5: 编辑确认

#### 5.1 Enter 确认

```
用户按 Enter
    ↓
handleKeyDown(e)
    ↓
parseKeyAction(e, 'cell') → { type: 'confirmAndMoveDown' }
    ↓
preventKeyDefault(e, action)
emit('enter', internal.value)
    ↓
CanvasSheet.handleOverlayEnter(value)
    ↓
emit('overlay-enter', { row, col, value })
    ↓
WorkbookSheet 处理保存和移动
```

#### 5.2 Tab 确认

```
用户按 Tab
    ↓
parseKeyAction(e, 'cell') → { type: 'confirmAndMoveRight' }
    ↓
emit('tab', internal.value)
    ↓
→ 保存并向右移动
```

#### 5.3 失焦确认（非公式模式）

```
用户点击其他区域
    ↓
handleBlur(e)
    ↓
检查 isCancelling.value → 如果正在取消，跳过
检查 formulaMode.value → 如果公式模式，跳过
检查 relatedTarget → 如果焦点转到 FormulaBar，跳过
    ↓
emit('blur', internal.value)
    ↓
→ 保存，不移动
```

#### 5.4 Alt+Enter 换行

```
用户按 Alt+Enter
    ↓
parseKeyAction(e, 'cell') → { type: 'insertLineBreak' }
    ↓
preventKeyDefault(e, action)
insertLineBreak()
    ↓
在光标位置插入 <br>
更新 internal.value
adjustSize()
emit('input-change')
```

---

### 场景 6: 编辑取消

```
用户按 Escape
    ↓
handleKeyDown(e)
    ↓
parseKeyAction(e, 'cell') → { type: 'cancel' }
    ↓
preventKeyDefault(e, action)
isCancelling.value = true  // 阻止 blur 事件
emit('cancel')
    ↓
CanvasSheet.handleOverlayCancel()
    ↓
input.onOverlayCancel()
    ↓
overlay.visible = false
formulaReferences = []
focusImeProxy()
```

---

### 场景 7: 焦点切换到 FormulaBar

```
用户点击 FormulaBar 输入区域
    ↓
RichTextInput.handleBlur()
    ↓
检查 relatedTarget 是否在 .formula-bar 内
    ↓
是 → return（不触发 blur 事件）
    ↓
FormulaBar 获得焦点，开始编辑
RichTextInput 保持显示，但不阻止用户操作
    ↓
FormulaBar 输入时：
  emit('input') → WorkbookSheet 更新 formulaEditManager
    ↓
  props.value 变化 → RichTextInput watch 响应
    ↓
  检测到 FormulaBar 有焦点
    ↓
  更新 internal.value 和 innerHTML
  但不设置光标（避免抢夺焦点）
```

---

## 状态管理

### 内部状态变量

| 状态 | 类型 | 说明 |
|------|------|------|
| `internal` | `Ref<string>` | 当前编辑文本 |
| `cursorPos` | `Ref<number>` | 光标位置 |
| `isComposing` | `Ref<boolean>` | IME 组合状态 |
| `isCancelling` | `Ref<boolean>` | 取消中标记（阻止 blur） |
| `isInitialized` | `boolean` | 初始化标记（防重复） |
| `pendingCursorPos` | `number \| null` | 待设置光标位置（引用插入后） |
| `autoWidth` | `Ref<number>` | 自动宽度 |
| `autoHeight` | `Ref<number>` | 自动高度 |

### 计算属性

| 属性 | 说明 |
|------|------|
| `formulaMode` | `internal.value?.startsWith('=')` |
| `editorStyle` | 编辑器样式对象 |

### 公式相关状态

| 状态 | 说明 |
|------|------|
| `isInSelectableState` | 当前是否可插入引用 |
| `lastOperatorPos` | 最后一个操作符位置 |
| `hasTextSelectionState` | 是否有文本选中 |

---

## 尺寸自适应

### adjustSize() 规则

```
┌─────────────────────────────────────────────────────────────┐
│                      尺寸调整规则                            │
├─────────────────────────────────────────────────────────────┤
│  情况 1: wrapText=true（自动换行）                          │
│    - 宽度固定 = 单元格宽度                                   │
│    - 高度根据换行后内容扩展                                  │
├─────────────────────────────────────────────────────────────┤
│  情况 2: 未靠近右边界                                        │
│    - 宽度根据内容向右扩展                                    │
│    - 高度根据行数计算                                        │
├─────────────────────────────────────────────────────────────┤
│  情况 3: 靠近右边界                                          │
│    - 宽度停止在右边界                                        │
│    - 高度根据换行后内容扩展                                  │
└─────────────────────────────────────────────────────────────┘
```

### 测量函数

- `measureTextWidth(text)` - 测量单行文本宽度
- `calculateWrappedHeight(text, containerWidth)` - 计算换行后高度
- `getMeasureElement()` - 懒加载测量元素（缓存复用）

---

## 样式系统

### 边框颜色语义

| 状态 | 边框颜色 | 说明 |
|------|----------|------|
| 普通编辑 | `#3b82f6` (蓝色) | 非公式模式 |
| 公式模式 | `#ef4444` (红色) | 公式但不可选择引用 |
| 可选择状态 | `#10b981` (绿色) | 公式且可插入引用 |

### 背景颜色

| 状态 | 背景颜色 |
|------|----------|
| 普通模式 | `cellStyle.backgroundColor` 或 `white` |
| 公式模式 | `#fef2f2` (淡红色) |

### 样式继承

编辑器继承单元格样式：
- `fontSize`, `fontFamily`
- `bold`, `italic`
- `underline`, `strikethrough`
- `textAlign` (水平对齐)
- `verticalAlign` (垂直对齐)
- `color` (字体颜色)

---

## 方法索引

### 生命周期方法

| 方法 | 说明 |
|------|------|
| `setEditorRef(el)` | 回调 ref，挂载时初始化 |
| `initializeEditor()` | 初始化编辑器内容和焦点 |

### 事件处理方法

| 方法 | 触发时机 |
|------|----------|
| `handleInput(e)` | input 事件 |
| `handleKeyDown(e)` | keydown 事件 |
| `handlePaste(e)` | paste 事件 |
| `handleCopy(e)` | copy 事件 |
| `handleCompositionStart(e)` | IME 开始 |
| `handleCompositionEnd(e)` | IME 结束 |
| `handleBlur(e)` | blur 事件 |
| `handleClick()` | click 事件 |

### 内容更新方法

| 方法 | 说明 |
|------|------|
| `updateEditorContent(text, preserveCursor)` | 更新编辑器 HTML |
| `insertLineBreak()` | 插入换行符 |

### 光标管理方法

| 方法 | 说明 |
|------|------|
| `getCursorPosition()` | 获取光标位置 |
| `setCursorPosition(pos)` | 设置光标位置 |
| `getTextContent()` | 获取纯文本内容 |

### 尺寸调整方法

| 方法 | 说明 |
|------|------|
| `adjustSize()` | 根据内容调整尺寸 |
| `measureTextWidth(text)` | 测量文本宽度 |
| `calculateWrappedHeight(text, width)` | 计算换行高度 |
| `getMeasureElement()` | 获取测量元素 |

### 公式引用方法

| 方法 | 说明 |
|------|------|
| `updateSelectableState()` | 更新可选择状态 |
| `findReferenceToReplace()` | 查找要替换的引用 |
| `insertCellReference(addr)` | 插入单元格引用 |
| `insertRangeReference(start, end)` | 插入区域引用 |

### 暴露方法 (defineExpose)

| 方法/属性 | 说明 |
|-----------|------|
| `formulaMode` | 是否公式模式 (getter) |
| `isInSelectableState` | 是否可选择状态 (getter) |
| `hasTextSelection` | 是否有文本选中 (getter) |
| `insertCellReference(addr)` | 插入单元格引用 |
| `insertRangeReference(start, end)` | 插入区域引用 |
| `getCurrentValue()` | 获取当前值 |
| `getEditorElement()` | 获取 DOM 元素 |

---

## 依赖关系

### 导入依赖

```typescript
// 类型
import type { CellStyle } from './sheet/types'
import type { FormulaReferenceTextIndex } from './sheet/formulaEditUtils'

// 工具函数
import {
  FORMULA_OPERATORS,
  generateFormulaHtmlFromRefs,
  getEditorCursorPosition,
  setEditorCursorPosition,
  getEditorTextContent,
  hasTextSelection as hasTextSelectionUtil,
  parseKeyAction,
  preventKeyDefault,
  isInSelectablePosition
} from './sheet/formulaEditUtils'
```

### 与其他组件的关系

```
┌─────────────────────────────────────────────────────────────┐
│                    WorkbookSheet                             │
│                         ↑                                    │
│            overlay-enter/tab/blur/cancel                     │
├─────────────────────────────────────────────────────────────┤
│                     CanvasSheet                              │
│                         ↑                                    │
│              enter/tab/blur/cancel/input-change              │
├─────────────────────────────────────────────────────────────┤
│                    RichTextInput                             │
│                         ↑                                    │
│      props: value, formulaReferences, cellStyle, ...         │
├─────────────────────────────────────────────────────────────┤
│                   formulaEditUtils                           │
│         generateFormulaHtml, parseKeyAction, ...             │
└─────────────────────────────────────────────────────────────┘
```

---

## 相关文档

- [公式栏行为链](./FORMULA_BAR_BEHAVIOR.md)
- [公式编辑系统](./FORMULA_EDITING_SYSTEM.md)
- [剪贴板功能](./CLIPBOARD.md)
