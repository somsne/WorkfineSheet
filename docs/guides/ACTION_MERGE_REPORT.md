# FormulaBar 与 RichTextInput 动作合并报告

## 📋 执行摘要

**合并状态**: ✅ 已完成  
**完成日期**: 2024-12-XX  
**测试结果**: 827 个测试全部通过  
**构建结果**: 成功

## 1. 当前状态分析

### 1.1 FormulaBar 中的动作方法

| 方法名 | 触发时机 | 当前实现 | 可合并性 |
|--------|----------|----------|----------|
| `handleFormulaInputClick` | 点击公式栏 | emit('start-edit') 或 emit('focus') | ✅ 可合并 |
| `handleFormulaInput` | 输入内容 | emit('input', text, cursorPos) | ✅ 可合并 |
| `handleFormulaKeydown` | 键盘按下 | Enter→confirm, Tab→tab, Escape→cancel | ✅ 可合并 |
| `handleFormulaBlur` | 失焦 | emit('blur') | ✅ 可合并 |
| `handleConfirm` | 点击确认按钮 | emit('confirm') | ✅ 可合并 |
| `handleCancel` | 点击取消按钮 | emit('cancel') | ✅ 可合并 |
| `handleCompositionStart/End` | IME 输入 | 设置 isComposing 标志 | ✅ 可合并 |
| `insertCellReference` | 插入引用 | 更新编辑器内容，emit('input') | ✅ 可合并 |
| `insertRangeReference` | 插入范围引用 | 调用 insertCellReference | ✅ 可合并 |
| `getCursorPosition` | 获取光标位置 | DOM Selection API | ✅ 可合并 |
| `setCursorPosition` | 设置光标位置 | DOM Range API | ✅ 可合并 |
| `updateSelectableState` | 更新可选择状态 | 检查光标位置是否在操作符后 | ✅ 可合并 |
| `updateEditorContent` | 更新编辑器内容 | 生成 HTML，设置光标 | ✅ 可合并 |
| `generateFormulaHtml` | 生成公式 HTML | 彩色高亮渲染 | ✅ 可合并 |

### 1.2 RichTextInput 中的动作方法

| 方法名 | 触发时机 | 当前实现 | 可合并性 |
|--------|----------|----------|----------|
| `handleInput` | 输入内容 | 更新 internal，emit('input-change') | ✅ 可合并 |
| `handleKeyDown` | 键盘按下 | Enter→save, Escape→cancel, Alt+Enter→换行 | ✅ 可合并 |
| `handleBlur` | 失焦 | emit('save') | ✅ 可合并 |
| `handleClick` | 点击 | 更新光标位置 | ✅ 可合并 |
| `handleCompositionStart/End` | IME 输入 | 设置 isComposing 标志 | ✅ 可合并 |
| `handlePaste` | 粘贴 | 纯文本粘贴 | ✅ 可合并 |
| `handleCopy` | 复制 | 纯文本复制 | ✅ 可合并 |
| `insertCellReference` | 插入引用 | 更新 internal，emit('input-change') | ✅ 可合并 |
| `insertRangeReference` | 插入范围引用 | 调用 insertCellReference | ✅ 可合并 |
| `insertLineBreak` | 插入换行 | Alt+Enter 插入 <br> | ⚠️ RichTextInput 专用 |
| `getCursorPosition` | 获取光标位置 | DOM Selection API | ✅ 可合并 |
| `setCursorPosition` | 设置光标位置 | DOM Range API | ✅ 可合并 |
| `updateSelectableState` | 更新可选择状态 | 检查光标位置是否在操作符后 | ✅ 可合并 |
| `updateEditorContent` | 更新编辑器内容 | 生成 HTML，设置光标 | ✅ 可合并 |
| `generateFormulaHtml` | 生成公式 HTML | 彩色高亮渲染 | ✅ 可合并 |
| `adjustSize` | 调整大小 | 计算宽高 | ❌ RichTextInput 专用 |
| `measureTextWidth` | 测量文本宽度 | 用于 adjustSize | ❌ RichTextInput 专用 |

## 2. 通用动作分类

### 2.1 完全相同（代码可完全复用）

1. **光标管理**
   - `getCursorPosition()` - 获取光标位置
   - `setCursorPosition(pos)` - 设置光标位置

2. **可选择状态判断**
   - `updateSelectableState()` - 检查光标位置是否在操作符后
   - `findReferenceToReplace()` - 查找要替换的引用
   - 常量：`OPERATORS`, `CELL_REF_REGEX`

3. **引用插入**
   - `insertCellReference(ref)` - 插入单元格引用
   - `insertRangeReference(start, end)` - 插入范围引用

4. **IME 处理**
   - `handleCompositionStart()` - IME 开始
   - `handleCompositionEnd()` - IME 结束

5. **公式 HTML 渲染**
   - `generateFormulaHtml(text)` - 生成彩色 HTML
   - `escapeHtml(text)` - HTML 转义

### 2.2 逻辑相同，参数/返回不同

1. **键盘事件处理**
   - FormulaBar: `handleFormulaKeydown` → emit events
   - RichTextInput: `handleKeyDown` → emit events + 换行处理
   - **合并策略**: 提取通用键盘动作，特殊处理（换行）由组件自行处理

2. **输入处理**
   - FormulaBar: `handleFormulaInput` → emit('input', value, cursor)
   - RichTextInput: `handleInput` → emit('input-change')
   - **合并策略**: 提取值解析、状态更新逻辑，emit 由组件自行处理

3. **失焦处理**
   - FormulaBar: `handleFormulaBlur` → emit('blur')（公式模式不触发）
   - RichTextInput: `handleBlur` → emit('save')（公式模式不触发）
   - **合并策略**: 提取通用判断逻辑

### 2.3 组件专用

| FormulaBar 专用 | RichTextInput 专用 |
|-----------------|-------------------|
| 名称框处理 | `insertLineBreak()` 换行 |
| - | `adjustSize()` 大小调整 |
| - | `measureTextWidth()` 文本测量 |
| - | `calculateWrappedHeight()` 换行高度 |
| - | 粘贴处理 `handlePaste()` |
| - | 复制处理 `handleCopy()` |

## 3. 建议合并到 FormulaEditManager 的方法

### 3.1 已存在于 FormulaEditManager

| 方法 | 当前状态 | 备注 |
|------|----------|------|
| `isInSelectablePosition()` | ✅ 已实现 | 导出的纯函数 |
| `findReferenceToReplace()` | ✅ 已实现 | 导出的纯函数 |
| `insertOrReplaceReference()` | ✅ 已实现 | 导出的纯函数 |
| `getCellAddress()` | ✅ 已实现 | 导出的纯函数 |
| `formatCrossSheetReference()` | ✅ 已实现 | 导出的纯函数 |
| `actionInput()` | ✅ 已实现 | 统一动作 |
| `actionConfirm()` | ✅ 已实现 | 统一动作 |
| `actionCancel()` | ✅ 已实现 | 统一动作 |
| `actionBlurConfirm()` | ✅ 已实现 | 统一动作 |
| `actionCursorPositionChange()` | ✅ 已实现 | 统一动作 |

### 3.2 建议新增到 FormulaEditManager

| 新方法 | 用途 | 原位置 |
|--------|------|--------|
| `getEditorCursorPosition(el)` | 从 DOM 获取光标位置 | 两组件重复 |
| `setEditorCursorPosition(el, pos)` | 设置 DOM 光标位置 | 两组件重复 |
| `generateFormulaHtml(text, refs)` | 生成彩色 HTML | 两组件重复 |
| `escapeHtml(text)` | HTML 转义 | 两组件重复 |
| `actionInsertReference(ref)` | 插入引用统一动作 | 新增 |
| `actionInsertRangeReference(start, end)` | 插入范围引用 | 新增 |
| `shouldHandleBlur()` | 判断是否处理失焦 | 两组件重复 |
| `getKeyAction(event)` | 解析键盘事件动作 | 两组件重复 |

## 4. 合并实施计划

### Phase 1: 提取纯函数到 formulaEditUtils.ts

```typescript
// 新建 formulaEditUtils.ts
export function getEditorCursorPosition(el: HTMLElement): number
export function setEditorCursorPosition(el: HTMLElement, pos: number): void
export function escapeHtml(text: string): string
export function generateFormulaHtml(
  text: string, 
  references: FormulaReference[]
): string
export function collectTextNodes(el: HTMLElement): Text[]

// 键盘动作类型
export type KeyAction = 
  | { type: 'confirm' }
  | { type: 'confirmAndMoveDown' }
  | { type: 'confirmAndMoveRight' }
  | { type: 'cancel' }
  | { type: 'insertLineBreak' }  // Alt+Enter
  | { type: 'navigation'; key: string }
  | null

export function parseKeyAction(e: KeyboardEvent): KeyAction
```

### Phase 2: 添加新动作到 FormulaEditManager

```typescript
// formulaEditState.ts 新增

/**
 * 动作：插入单元格引用
 * 统一的引用插入逻辑
 */
function actionInsertReference(reference: string): EditActionResult {
  // 调用现有的 insertReference()
  // 返回 UI 动作：syncOverlayValue, syncFormulaBarValue
}

/**
 * 动作：插入范围引用
 */
function actionInsertRangeReference(
  startAddr: string, 
  endAddr: string
): EditActionResult {
  return actionInsertReference(`${startAddr}:${endAddr}`)
}

/**
 * 判断是否应处理失焦事件
 */
function shouldHandleBlur(): boolean {
  // 公式模式 + 可选择状态 → 不处理
  return !(state.isFormulaMode && state.isInSelectableState)
}
```

### Phase 3: 重构 FormulaBar 使用通用方法

```typescript
// FormulaBar.vue
import { 
  getEditorCursorPosition,
  setEditorCursorPosition,
  generateFormulaHtml,
  parseKeyAction 
} from './formulaEditUtils'

// 键盘处理简化
function handleFormulaKeydown(e: KeyboardEvent) {
  const action = parseKeyAction(e)
  if (!action) return
  
  switch (action.type) {
    case 'confirm': emit('confirm'); break
    case 'confirmAndMoveRight': emit('tab'); break
    case 'cancel': emit('cancel'); break
    case 'navigation':
      nextTick(() => {
        cursorPos.value = getEditorCursorPosition(formulaInputRef.value!)
        updateSelectableState()
      })
      break
  }
}
```

### Phase 4: 重构 RichTextInput 使用通用方法

```typescript
// RichTextInput.vue
import { 
  getEditorCursorPosition,
  setEditorCursorPosition,
  generateFormulaHtml,
  parseKeyAction 
} from './formulaEditUtils'

// 键盘处理简化
function handleKeyDown(e: KeyboardEvent) {
  const action = parseKeyAction(e)
  if (!action) return
  
  switch (action.type) {
    case 'confirm': 
    case 'confirmAndMoveDown': 
      emit('save', internal.value)
      break
    case 'cancel': 
      emit('cancel')
      break
    case 'insertLineBreak':
      insertLineBreak() // 组件专用
      break
    case 'navigation':
      nextTick(() => {
        cursorPos.value = getEditorCursorPosition(editorRef!)
        updateSelectableState()
      })
      break
  }
}
```

## 5. 合并后的代码结构

```
src/components/sheet/
├── formulaEditState.ts      # 状态管理 + 统一动作
├── formulaEditUtils.ts      # 纯函数工具（新建）
│   ├── getEditorCursorPosition()
│   ├── setEditorCursorPosition()
│   ├── escapeHtml()
│   ├── generateFormulaHtml()
│   ├── collectTextNodes()
│   ├── parseKeyAction()
│   └── KeyAction 类型
└── ...

src/components/
├── FormulaBar.vue           # 使用通用工具
├── RichTextInput.vue        # 使用通用工具
└── ...
```

## 6. 预期收益

| 指标 | 合并前 | 合并后 | 改善 |
|------|--------|--------|------|
| 重复代码行数 | ~200 行 | 0 行 | -100% |
| 维护点数 | 2 处 | 1 处 | -50% |
| 测试覆盖 | 分散 | 集中 | 更易测试 |
| Bug 风险 | 两处实现可能不一致 | 单一实现 | 降低 |

## 7. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 光标位置计算差异 | 中 | 保留组件特定的微调参数 |
| IME 输入兼容性 | 高 | 充分测试各浏览器 |
| HTML 渲染差异 | 低 | 统一使用相同的渲染逻辑 |
| 焦点管理复杂性 | 中 | FormulaEditManager 统一管理 |

## 8. 执行顺序

1. ✅ 创建 `formulaEditUtils.ts` 提取纯函数 (51 个测试)
2. ✅ 为纯函数添加单元测试 (`formulaEditUtils.spec.ts`)
3. ✅ FormulaBar 切换使用通用函数（保持 emit 不变）
4. ✅ RichTextInput 切换使用通用函数（保持 emit 不变）
5. ✅ 验证所有功能正常 (827 tests passing)
6. ✅ 添加新的统一动作到 FormulaEditManager
7. ✅ 更新文档

---

## 9. 已完成的合并清单

### 9.1 新建文件

| 文件 | 描述 | 行数 |
|------|------|------|
| `src/components/sheet/formulaEditUtils.ts` | 共享工具函数模块 | ~400 |
| `src/components/sheet/tests/formulaEditUtils.spec.ts` | 单元测试 | ~350 |

### 9.2 导出的共享函数

| 函数 | 用途 |
|------|------|
| `FORMULA_OPERATORS` | 公式操作符常量 |
| `CELL_REF_REGEX` | 单元格引用正则 |
| `NAVIGATION_KEYS` | 导航键集合 |
| `escapeHtml(text)` | HTML 转义 |
| `generateFormulaHtml(text, refs)` | 公式彩色 HTML 生成 |
| `getEditorCursorPosition(el)` | 获取 DOM 光标位置 |
| `setEditorCursorPosition(el, pos)` | 设置 DOM 光标位置 |
| `getEditorTextContent(el)` | 获取编辑器纯文本 |
| `parseKeyAction(e, ctx)` | 解析键盘事件动作 |
| `preventKeyDefault(action)` | 判断是否阻止默认行为 |
| `collectTextNodes(el)` | 收集文本节点 |
| `isInSelectablePosition(text, cursor)` | 判断可选择状态 |
| `hasTextSelection()` | 检查是否有文本选区 |
| `convertReferencesToTextIndex(refs, text)` | 引用位置转换 |

### 9.3 FormulaBar.vue 变更

**已替换为共享函数的方法** (标记 `// [DEPRECATED - 已迁移到 formulaEditUtils.ts]`):

- `escapeHtml()` → 使用 `escapeHtmlUtil()`
- `generateFormulaHtml()` → 使用 `generateFormulaHtmlUtil()`
- `getCursorPosition()` → 使用 `getEditorCursorPosition()`
- `setCursorPosition()` → 使用 `setEditorCursorPosition()`
- `OPERATORS` 常量 → 使用 `FORMULA_OPERATORS`
- `CELL_REF_REGEX` → 使用 `CELL_REF_REGEX` (从 utils 导入)
- `updateSelectableState()` → 使用 `isInSelectablePositionUtil()`
- `getTextContent()` → 使用 `getEditorTextContent()`
- `parseKeyAction()` → 使用 `parseKeyActionUtil()`

### 9.4 RichTextInput.vue 变更

**已替换为共享函数的方法** (标记 `// [DEPRECATED - 已迁移到 formulaEditUtils.ts]`):

- `escapeHtml()` → 使用 `escapeHtmlUtil()`
- `generateFormulaHtml()` → 使用 `generateFormulaHtmlUtil()`
- `getCursorPosition()` → 使用 `getEditorCursorPosition()`
- `setCursorPosition()` → 使用 `setEditorCursorPosition()`
- `OPERATORS` 常量 → 使用 `FORMULA_OPERATORS`
- `CELL_REF_REGEX` → 使用 `CELL_REF_REGEX` (从 utils 导入)
- `updateSelectableState()` → 使用 `isInSelectablePositionUtil()`
- `findReferenceToReplace()` → 使用 `findReferenceToReplaceUtil()`
- `hasTextSelection` ref → 使用 `hasTextSelectionUtil()` + `hasTextSelectionState` ref
- `collectTextNodes()` → 使用 `collectTextNodesUtil()`

### 9.5 保留为组件专用的方法

| FormulaBar 专用 | RichTextInput 专用 |
|-----------------|-------------------|
| `handleNameBoxClick()` | `insertLineBreak()` |
| `getNameBoxText()` | `adjustSize()` |
| 名称框显示逻辑 | `measureTextWidth()` |
| | `calculateWrappedHeight()` |
| | `handlePaste()` |
| | `handleCopy()` |

## 10. 后续清理任务

以下标记为 `// [DEPRECATED]` 的代码可在确认稳定后删除：

### FormulaBar.vue
```typescript
// 以下方法已迁移，可安全删除：
- escapeHtml (原函数保留但标记废弃)
- getCursorPosition (原函数保留但标记废弃)
- setCursorPosition (原函数保留但标记废弃)
- 局部 OPERATORS 常量
- 局部 CELL_REF_REGEX 常量
```

### RichTextInput.vue
```typescript
// 以下方法已迁移，可安全删除：
- escapeHtml (原函数保留但标记废弃)
- getCursorPosition (原函数保留但标记废弃)
- setCursorPosition (原函数保留但标记废弃)
- 局部 OPERATORS 常量
- 局部 CELL_REF_REGEX 常量
- generateFormulaHtml (原函数保留但标记废弃)
- collectTextNodes (原函数保留但标记废弃)
- updateSelectableState (原函数保留但标记废弃)
```

---

**✅ 合并完成，所有测试通过！**
