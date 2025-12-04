# 单元格编辑器重构方案研究

## 📋 目录

1. [当前架构分析](#当前架构分析)
2. [新架构方案](#新架构方案)
3. [职责划分](#职责划分)
4. [数据流设计](#数据流设计)
5. [实现细节](#实现细节)
6. [优缺点分析](#优缺点分析)
7. [迁移策略](#迁移策略)

---

## 当前架构分析

### 现状问题

当前 `RichTextInput.vue` 和 `FormulaBar.vue` 存在大量重复代码和职责交叉：

```
┌─────────────────────────────────────────────────────────────┐
│                     当前架构（问题点）                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │    FormulaBar.vue   │    │  RichTextInput.vue  │        │
│  │  ──────────────────│    │ ──────────────────── │        │
│  │  ✗ 完整编辑逻辑     │    │  ✗ 完整编辑逻辑     │        │
│  │  ✗ 公式引用高亮     │    │  ✗ 公式引用高亮     │        │
│  │  ✗ 光标管理        │    │  ✗ 光标管理         │        │
│  │  ✗ IME 处理        │    │  ✗ IME 处理         │        │
│  │  ✗ 引用插入        │    │  ✗ 引用插入         │        │
│  │  ✗ 键盘事件处理     │    │  ✗ 键盘事件处理     │        │
│  └─────────────────────┘    └─────────────────────┘        │
│           ↑                          ↑                      │
│           └──────── 重复代码 ─────────┘                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FormulaEditManager (代理层)             │   │
│  │  尝试同步两个编辑器状态，但两者都有独立的编辑能力      │   │
│  │  导致：状态同步复杂、焦点竞争、代码冗余               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**具体问题**：

1. **代码重复**：两个组件各自实现了：
   - `generateFormulaHtml` / `generateFormulaHtmlFromRefs`
   - `getCursorPosition` / `setCursorPosition`
   - `insertCellReference` / `insertRangeReference`
   - `updateSelectableState`
   - IME 处理逻辑
   - 键盘事件处理

2. **状态同步困难**：
   - 当 FormulaBar 输入时，需要同步到 RichTextInput
   - 当 RichTextInput 输入时，需要同步到 FormulaBar
   - 光标位置需要双向同步
   - 公式引用需要双向同步

3. **焦点管理复杂**：
   - 两个编辑器都可以获取焦点
   - 切换时需要复杂的焦点转移逻辑
   - 需要防止焦点竞争

---

## 新架构方案

### 核心思想

**FormulaBar 作为唯一的编辑大脑，RichTextInput 降级为"显示视图 + 输入代理"**

```
┌─────────────────────────────────────────────────────────────┐
│                     新架构（单一数据源）                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FormulaBar.vue（编辑大脑）              │   │
│  │  ═══════════════════════════════════════════════════│   │
│  │  ✓ 唯一的编辑逻辑                                   │   │
│  │  ✓ 唯一的状态管理                                   │   │
│  │  ✓ 光标位置管理                                    │   │
│  │  ✓ IME 处理                                        │   │
│  │  ✓ 公式引用插入                                    │   │
│  │  ✓ 键盘命令解析                                    │   │
│  │  ✓ 公式引用计算和高亮                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                  │
│                   [value, cursorPos, html]                  │
│                          ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            CellOverlay.vue（显示视图）               │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  ○ 显示格式化后的 HTML                             │   │
│  │  ○ 接收键盘输入并转发给 FormulaBar                  │   │
│  │  ○ 接收鼠标事件并转发（点击定位光标）               │   │
│  │  ○ 应用单元格样式（字体、颜色、对齐等）             │   │
│  │  ○ 自动调整尺寸                                    │   │
│  │  × 无编辑逻辑                                      │   │
│  │  × 无状态管理                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 数据流向

```
┌────────────────────────────────────────────────────────────────────┐
│                          数据流向图                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  用户在 CellOverlay 内按键（如 'A'）                                │
│                    │                                               │
│                    ▼                                               │
│  CellOverlay 捕获 keydown/keypress 事件                            │
│                    │                                               │
│                    ▼                                               │
│  转发给 FormulaBar：emit('key', { key: 'A', ... })                 │
│                    │                                               │
│                    ▼                                               │
│  FormulaBar 处理输入，更新内部状态                                  │
│  - currentValue = 'A'                                              │
│  - cursorPosition = 1                                              │
│  - formulaReferences = []                                          │
│                    │                                               │
│                    ▼                                               │
│  FormulaBar 生成显示数据                                           │
│  - displayHtml = 'A'                                               │
│                    │                                               │
│                    ▼                                               │
│  通过 props 传递给 CellOverlay                                     │
│  - :html="displayHtml"                                             │
│  - :cursor-position="cursorPosition"                               │
│                    │                                               │
│                    ▼                                               │
│  CellOverlay 更新显示                                              │
│  - innerHTML = displayHtml                                         │
│  - 渲染光标位置（或使用 contenteditable 显示光标）                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 职责划分

### FormulaBar.vue（编辑大脑）

| 职责 | 说明 |
|------|------|
| **状态管理** | 持有编辑状态：value、cursorPosition、selectionRange |
| **输入处理** | 处理所有字符输入、删除、粘贴等 |
| **光标管理** | 计算和维护光标位置 |
| **IME 处理** | 处理中文等输入法 |
| **公式解析** | 解析公式引用，生成高亮数据 |
| **引用插入** | 处理单元格引用插入和替换 |
| **命令解析** | 解析 Enter/Tab/Escape 等命令 |
| **HTML 生成** | 生成带颜色高亮的 HTML |

### CellOverlay.vue（显示视图）

| 职责 | 说明 |
|------|------|
| **显示内容** | 渲染 FormulaBar 提供的 HTML |
| **样式应用** | 应用单元格样式（字体、颜色、对齐） |
| **尺寸调整** | 根据内容自动调整宽高 |
| **事件转发** | 将键盘/鼠标事件转发给 FormulaBar |
| **焦点承载** | 承载视觉焦点（用户看到的编辑框） |
| **光标显示** | 显示光标和选区（可选） |

### 事件转发机制

```typescript
// CellOverlay.vue 的事件转发
interface CellOverlayEmits {
  // 键盘事件转发（所有按键都转发）
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'keypress', event: KeyboardEvent): void
  (e: 'keyup', event: KeyboardEvent): void
  
  // IME 事件转发
  (e: 'compositionstart', event: CompositionEvent): void
  (e: 'compositionupdate', event: CompositionEvent): void
  (e: 'compositionend', event: CompositionEvent): void
  
  // 鼠标事件（用于光标定位）
  (e: 'click', position: { x: number; y: number }): void
  
  // 焦点事件
  (e: 'focus'): void
  (e: 'blur'): void
}
```

---

## 实现细节

### 方案 A：完全无状态视图

CellOverlay 完全无状态，只负责渲染：

```vue
<!-- CellOverlay.vue -->
<template>
  <div
    class="cell-overlay"
    :style="overlayStyle"
    tabindex="0"
    @keydown="$emit('keydown', $event)"
    @keypress="$emit('keypress', $event)"
    @compositionstart="$emit('compositionstart', $event)"
    @compositionupdate="$emit('compositionupdate', $event)"
    @compositionend="$emit('compositionend', $event)"
    @click="handleClick"
    @focus="$emit('focus')"
    @blur="$emit('blur')"
  >
    <!-- 内容渲染区（只读，不接受输入） -->
    <div class="content" v-html="html"></div>
    
    <!-- 光标渲染（根据 cursorPosition 计算位置） -->
    <div 
      v-if="showCursor" 
      class="cursor-caret"
      :style="cursorStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CellStyle } from './sheet/types'

const props = defineProps<{
  visible: boolean
  html: string           // FormulaBar 生成的 HTML
  cursorPosition: number // 光标字符位置
  top: number
  left: number
  width: number
  height: number
  cellStyle?: CellStyle
  isFormula?: boolean
  isSelectable?: boolean // 公式可选择状态
}>()

const emit = defineEmits<{
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'keypress', event: KeyboardEvent): void
  (e: 'compositionstart', event: CompositionEvent): void
  (e: 'compositionupdate', event: CompositionEvent): void
  (e: 'compositionend', event: CompositionEvent): void
  (e: 'click', position: { x: number; y: number }): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

// 计算光标样式（位置需要根据 cursorPosition 和 HTML 计算）
const cursorStyle = computed(() => {
  // TODO: 实现光标位置计算
  return {}
})

function handleClick(e: MouseEvent) {
  emit('click', { x: e.offsetX, y: e.offsetY })
}
</script>
```

### 方案 B：使用隐藏 contenteditable

保留 contenteditable 但禁用其编辑功能，仅用于光标显示：

```vue
<!-- CellOverlay.vue -->
<template>
  <div class="cell-overlay" :style="overlayStyle">
    <!-- 隐藏的真实输入区（接收键盘事件） -->
    <textarea
      ref="hiddenInput"
      class="hidden-input"
      @keydown="handleKeyDown"
      @input="handleInput"
      @compositionstart="$emit('compositionstart', $event)"
      @compositionend="handleCompositionEnd"
    />
    
    <!-- 显示区（只读 contenteditable，显示光标） -->
    <div
      ref="displayRef"
      class="display-area"
      contenteditable="true"
      :style="displayStyle"
      @beforeinput.prevent
      @click="handleDisplayClick"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  html: string
  cursorPosition: number
  // ...
}>()

const displayRef = ref<HTMLDivElement>()
const hiddenInput = ref<HTMLTextAreaElement>()

// 同步 HTML 内容
watch(() => props.html, (html) => {
  if (displayRef.value) {
    displayRef.value.innerHTML = html
  }
})

// 同步光标位置
watch(() => props.cursorPosition, (pos) => {
  if (displayRef.value) {
    setCursorPosition(displayRef.value, pos)
  }
})

function handleKeyDown(e: KeyboardEvent) {
  // 阻止默认行为（不要真的修改 textarea）
  // 但让 FormulaBar 处理
  emit('keydown', e)
  
  // 某些键需要阻止默认行为
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
  }
}

function handleInput(e: Event) {
  // 获取输入的字符
  const target = e.target as HTMLTextAreaElement
  const char = target.value
  
  // 清空 textarea
  target.value = ''
  
  // 转发给 FormulaBar
  emit('char-input', char)
}
</script>
```

### 方案 C：混合代理模式（推荐）

结合 FormulaEditManager 的代理层设计，CellOverlay 作为事件代理：

```typescript
// 在 FormulaEditManager 中扩展
export interface FormulaEditStateManager {
  // ... 现有方法
  
  // 新增：处理 CellOverlay 转发的事件
  handleOverlayKeyDown(e: KeyboardEvent): void
  handleOverlayInput(char: string): void
  handleOverlayCompositionStart(): void
  handleOverlayCompositionEnd(text: string): void
  handleOverlayClick(charOffset: number): void
  
  // 获取显示数据
  getDisplayHtml(): string
  getCursorPosition(): number
}
```

---

## 优缺点分析

### 优点

| 优点 | 说明 |
|------|------|
| **消除代码重复** | 编辑逻辑只在 FormulaBar 中实现一次 |
| **单一数据源** | 状态只在 FormulaBar/Manager 中，无需同步 |
| **简化调试** | 数据流清晰，易于追踪问题 |
| **降低复杂度** | CellOverlay 变成纯展示组件 |
| **更好的测试** | 可以单独测试 FormulaBar 的编辑逻辑 |

### 缺点

| 缺点 | 说明 | 解决方案 |
|------|------|----------|
| **光标显示复杂** | 需要在 CellOverlay 中计算光标位置 | 使用隐藏的 contenteditable 或自定义光标 |
| **IME 处理挑战** | 输入法预览需要显示在 CellOverlay | 使用隐藏 input 接收 IME，overlay 显示预览 |
| **事件延迟** | 事件转发可能有微小延迟 | 实际影响极小，用户无感 |
| **重构工作量** | 需要重写 CellOverlay | 可以渐进式重构 |

### 与当前架构对比

| 维度 | 当前架构 | 新架构 |
|------|----------|--------|
| 代码量 | RichTextInput ~700 行 + FormulaBar ~600 行 | FormulaBar ~800 行 + CellOverlay ~200 行 |
| 重复代码 | 大量重复 | 无重复 |
| 状态同步 | 双向同步，复杂 | 单向，简单 |
| 焦点管理 | 两个焦点点，易冲突 | 一个逻辑焦点 |
| 可维护性 | 差 | 好 |

---

## 迁移策略

### 阶段 1：准备工作

1. **抽取公共逻辑到 FormulaEditManager**
   - 将所有编辑逻辑移到 manager
   - FormulaBar 调用 manager 方法
   - RichTextInput 暂时保持不变

2. **统一数据源**
   - 所有状态存储在 manager
   - 两个组件都从 manager 读取

### 阶段 2：创建新 CellOverlay

1. **创建 CellOverlay.vue**
   - 纯展示组件
   - 事件转发机制

2. **FormulaBar 新增事件处理**
   - 处理 CellOverlay 转发的事件
   - 生成显示 HTML

### 阶段 3：切换和清理

1. **用 CellOverlay 替换 RichTextInput**
   - 逐步切换引用
   - 测试各种场景

2. **删除旧代码**
   - 移除 RichTextInput.vue
   - 清理冗余代码

### 代码示例：阶段 2 的实现

```vue
<!-- 新的 CellOverlay.vue -->
<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import type { CellStyle } from './sheet/types'

const props = defineProps<{
  visible: boolean
  displayHtml: string      // 从 FormulaBar 获取
  cursorPosition: number   // 从 FormulaBar 获取
  top: number
  left: number
  width: number
  height: number
  cellStyle?: CellStyle
  isFormula?: boolean
  isSelectableState?: boolean
  viewportWidth?: number
}>()

const emit = defineEmits<{
  // 键盘事件转发
  (e: 'key-event', type: 'keydown' | 'keyup', event: KeyboardEvent): void
  // 字符输入（单个字符）
  (e: 'char-input', char: string): void
  // IME 事件
  (e: 'composition-start'): void
  (e: 'composition-update', text: string): void
  (e: 'composition-end', text: string): void
  // 光标点击（计算后的字符偏移）
  (e: 'cursor-click', charOffset: number): void
  // 焦点事件
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const containerRef = ref<HTMLDivElement>()
const hiddenInputRef = ref<HTMLInputElement>()
const displayRef = ref<HTMLDivElement>()

const isComposing = ref(false)

// 自动尺寸
const autoWidth = ref(props.width)
const autoHeight = ref(props.height)

// 边框颜色（根据状态）
const borderColor = computed(() => {
  if (props.isSelectableState) return '#10b981'  // 绿色：可选择
  if (props.isFormula) return '#ef4444'          // 红色：公式
  return '#3b82f6'                                // 蓝色：普通
})

// 聚焦隐藏输入框
function focus() {
  hiddenInputRef.value?.focus()
}

// 处理隐藏输入框的 keydown
function handleHiddenKeyDown(e: KeyboardEvent) {
  emit('key-event', 'keydown', e)
  
  // 大部分键阻止默认行为，让 FormulaBar 处理
  const allowDefault = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!allowDefault.includes(e.key) && !isComposing.value) {
    e.preventDefault()
  }
}

// 处理隐藏输入框的 input（非 IME）
function handleHiddenInput(e: Event) {
  if (isComposing.value) return
  
  const target = e.target as HTMLInputElement
  const char = target.value
  target.value = ''  // 清空
  
  if (char) {
    emit('char-input', char)
  }
}

// IME 处理
function handleCompositionStart() {
  isComposing.value = true
  emit('composition-start')
}

function handleCompositionUpdate(e: CompositionEvent) {
  emit('composition-update', e.data || '')
}

function handleCompositionEnd(e: CompositionEvent) {
  isComposing.value = false
  const text = e.data || ''
  
  // 清空隐藏输入框
  if (hiddenInputRef.value) {
    hiddenInputRef.value.value = ''
  }
  
  emit('composition-end', text)
}

// 点击显示区域，计算光标位置
function handleDisplayClick(e: MouseEvent) {
  // 计算点击位置对应的字符偏移
  const charOffset = calculateCharOffset(e.offsetX, e.offsetY)
  emit('cursor-click', charOffset)
}

// 计算字符偏移（简化版，实际需要更复杂的计算）
function calculateCharOffset(_x: number, _y: number): number {
  // TODO: 实现精确的点击位置到字符偏移的转换
  // 可以使用 Range API 或者测量每个字符的位置
  return props.cursorPosition
}

// 同步显示内容
watch(() => props.displayHtml, (html) => {
  if (displayRef.value) {
    displayRef.value.innerHTML = html
  }
})

// visible 变化时聚焦
watch(() => props.visible, (visible) => {
  if (visible) {
    // 延迟聚焦，确保 DOM 已渲染
    setTimeout(() => focus(), 0)
  }
})

defineExpose({
  focus,
  getElement: () => containerRef.value
})
</script>

<template>
  <div 
    v-if="visible"
    ref="containerRef"
    class="cell-overlay"
    :style="{
      position: 'absolute',
      top: (top - 2) + 'px',
      left: (left - 2) + 'px',
      zIndex: 1000
    }"
    @mousedown.stop
    @click.stop
  >
    <!-- 隐藏的输入接收器 -->
    <input
      ref="hiddenInputRef"
      type="text"
      class="hidden-input"
      @keydown="handleHiddenKeyDown"
      @input="handleHiddenInput"
      @compositionstart="handleCompositionStart"
      @compositionupdate="handleCompositionUpdate"
      @compositionend="handleCompositionEnd"
      @focus="$emit('focus')"
      @blur="$emit('blur')"
    />
    
    <!-- 显示区域 -->
    <div
      ref="displayRef"
      class="display-area"
      :style="{
        width: autoWidth + 'px',
        height: autoHeight + 'px',
        border: '2px solid ' + borderColor,
        backgroundColor: isFormula ? '#fef2f2' : (cellStyle?.backgroundColor || 'white'),
        fontSize: (cellStyle?.fontSize || 12) + 'px',
        fontFamily: cellStyle?.fontFamily || 'Arial, sans-serif',
        color: cellStyle?.color || '#000',
        textAlign: cellStyle?.textAlign || 'left',
      }"
      @click="handleDisplayClick"
    ></div>
  </div>
</template>

<style scoped>
.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.display-area {
  box-sizing: content-box;
  padding: 0 2px;
  outline: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-all;
  cursor: text;
}
</style>
```

---

## 技术挑战与解决方案

### 挑战 1：光标位置显示

**问题**：CellOverlay 不是真正的 contenteditable，如何显示光标？

**方案**：
1. **方案 A**：使用 CSS 动画的自定义光标 div
2. **方案 B**：保留 contenteditable 但禁用输入（推荐）
3. **方案 C**：使用 `<input type="text">` + 覆盖层

```css
/* 方案 A：自定义光标 */
.custom-cursor {
  position: absolute;
  width: 2px;
  height: 1em;
  background: #000;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

### 挑战 2：IME 输入法

**问题**：IME 需要显示预览文本

**方案**：使用隐藏 input 接收 IME，通过 compositionupdate 获取预览文本，渲染到 overlay

```typescript
function handleCompositionUpdate(e: CompositionEvent) {
  const previewText = e.data || ''
  // 在当前光标位置显示预览（带下划线样式）
  updateDisplayWithIMEPreview(previewText)
}
```

### 挑战 3：点击定位光标

**问题**：如何将点击坐标转换为字符偏移？

**方案**：使用 `document.caretPositionFromPoint()` 或 Range API

```typescript
function calculateCharOffset(x: number, y: number): number {
  // 方案 1：使用 caretPositionFromPoint（Chrome/Firefox）
  const pos = document.caretPositionFromPoint(x, y)
  if (pos) {
    return calculateOffsetFromPosition(pos)
  }
  
  // 方案 2：使用 caretRangeFromPoint（Safari）
  const range = document.caretRangeFromPoint(x, y)
  if (range) {
    return calculateOffsetFromRange(range)
  }
  
  return 0
}
```

---

## 结论

新架构通过将 FormulaBar 作为唯一的编辑大脑，CellOverlay 降级为显示视图：

1. **消除了大量重复代码**
2. **简化了状态管理**（单一数据源）
3. **消除了焦点竞争问题**
4. **提高了可维护性和可测试性**

建议采用 **阶段式迁移策略**，先统一数据源，再创建新组件，最后切换和清理。

---

## 相关文档

- [公式编辑系统](./FORMULA_EDITING_SYSTEM.md)
- [FormulaBar 行为链](./FORMULA_BAR_BEHAVIOR.md)
- [RichTextInput 行为链](./RICH_TEXT_INPUT_BEHAVIOR.md)
