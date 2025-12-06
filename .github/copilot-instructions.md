# 🤖 Copilot Instructions for WorkfineSheet

## 项目概览
WorkfineSheet 是基于 Vue 3 + TypeScript + Canvas 的高性能电子表格组件，采用模块化架构，支持 100+ Excel 公式、多 Sheet 工作簿管理。

## 核心架构

### 整体分层架构
```
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (App.vue)                          │
├─────────────────────────────────────────────────────────────┤
│              工作簿层 (WorkbookSheet.vue)                    │
│    ┌─────────────┬─────────────┬─────────────────────┐      │
│    │ StyleToolbar│ FormulaBar  │    SheetTabBar      │      │
│    └─────────────┴─────────────┴─────────────────────┘      │
├─────────────────────────────────────────────────────────────┤
│              表格层 (CanvasSheet.vue)                        │
│    ┌──────────────────────────────────────────────────┐     │
│    │           Composables (10个功能模块)              │     │
│    │  useSheetState | useSheetDrawing | useSheetMouse │     │
│    │  useSheetKeyboard | useSheetInput | useFillHandle│     │
│    │  useSheetClipboard | useSheetImages | ...        │     │
│    └──────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│              公式层 (FormulaSheet.ts)                        │
│         异步计算队列 | 依赖图 | 缓存 | 格式化               │
├─────────────────────────────────────────────────────────────┤
│              计算引擎 (FormulaEngine.ts)                     │
│           基于 hot-formula-parser，支持 100+ 函数           │
├─────────────────────────────────────────────────────────────┤
│              数据层                                          │
│    ┌───────────────┬─────────────────┬────────────────┐     │
│    │  Workbook.ts  │  SheetModel.ts  │ UndoRedoManager│     │
│    │  多Sheet管理  │  单表稀疏存储   │   命令模式     │     │
│    └───────────────┴─────────────────┴────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 数据流向
```
用户操作 → WorkbookSheet → CanvasSheet → Composables → FormulaSheet → SheetModel
                                              ↓
                                        FormulaEngine (计算)
                                              ↓
                                      Canvas 渲染 ← 状态更新
```

### 核心组件职责

**工作簿层** (`src/components/`):
- `WorkbookSheet.vue` - 工作簿容器，协调多 Sheet 切换、工具栏、公式栏、标签栏
- `StyleToolbar.vue` - 样式工具栏（字体、颜色、对齐、边框等）
- `FormulaBar.vue` - 公式栏（名称框、公式输入、彩色引用高亮）
- `SheetTabBar.vue` - 底部标签栏（Sheet 切换、增删、重命名、颜色、隐藏）

**表格层** (`src/components/`):
- `CanvasSheet.vue` - 单个工作表的 Canvas 渲染容器，组装所有 Composables
- `RichTextInput.vue` - 单元格富文本编辑器
- `ContextMenu.vue` - 右键菜单组件

**Composables** (`src/components/sheet/composables/`):
- `useSheetState.ts` - 核心状态管理（选区、编辑状态、滚动位置、视图配置）
- `useSheetDrawing.ts` - Canvas 绑定与绘制调度，RAF 节流优化
- `useSheetGeometry.ts` - 几何计算（行列位置、可见范围、滚动边界）
- `useSheetMouse.ts` - 鼠标事件处理（选择、拖拽、调整大小、滚动条）
- `useSheetKeyboard.ts` - 键盘事件处理（导航、编辑、快捷键）
- `useSheetInput.ts` - 输入处理（IME、单元格编辑、公式输入）
- `useSheetClipboard.ts` - 复制粘贴功能
- `useFillHandle.ts` - 填充柄功能（拖拽填充、双击快填、智能模式）
- `useSheetImages.ts` - 浮动图片管理（拖拽、调整大小、锚点系统）
- `useRowColOperations.ts` - 行列操作（插入、删除、隐藏、批量优化）

**渲染模块** (`src/components/sheet/`):
- `renderCells.ts` - 单元格内容渲染（文字、样式、选区、公式引用高亮）
- `renderGrid.ts` - 网格线和表头渲染，隐藏行列视觉指示器
- `renderCellImage.ts` - 单元格内嵌图片渲染
- `images/renderImages.ts` - 浮动图片渲染

**数据层** (`src/lib/`):
- `Workbook.ts` - 工作簿模型，多 Sheet 管理、FormulaSheet 管理、视图状态保存/恢复、事件系统、跨表公式引用支持
- `SheetModel.ts` - 单表数据模型，稀疏存储 cells/styles/borders/formats/images/merges
- `FormulaSheet.ts` - 公式表包装器，异步计算队列、依赖图、值缓存、格式化、跨表引用回调
- `FormulaEngine.ts` - 公式计算引擎（基于 hot-formula-parser），支持跨表引用语法
- `UndoRedoManager.ts` - 撤销重做管理器（命令模式，支持跨 Sheet 操作和选区恢复）

**辅助模块** (`src/components/sheet/`):
- `types.ts` - 所有共享类型定义（CellStyle, SelectionRange, FloatingImage 等）
- `geometry.ts` - 行列位置计算（纯函数），支持隐藏行列
- `rowcol.ts` - 行列增删核心逻辑，批量优化
- `fillHandle.ts` - 填充柄核心逻辑（模式识别、值生成、公式调整）
- `clipboard.ts` - 剪贴板数据处理
- `formulaEditState.ts` - **公式编辑代理层**（FormulaEditManager，统一管理编辑状态）
- `formulaEditUtils.ts` - **公式编辑工具函数**（光标管理、HTML生成、键盘解析）
- `references.ts` - 公式引用解析（彩色高亮用）
- `api.ts` - 对外 API 接口 (`SheetAPI`)
- `uiMenus.ts` - 右键菜单配置

## 开发命令
```bash 
# 都需要切换到 Node 20
nvm use 20 && npm run dev           # 启动开发服务器 (http://localhost:5174)
nvm use 20 && npm run build         # 生产构建 (vue-tsc + vite)
nvm use 20 && npm test              # 运行单元测试 (vitest)
nvm use 20 && npm run test:coverage # 生成覆盖率报告
```

## 代码模式与约定

### 1. 纯函数优先 + 配置注入
```typescript
// ✅ 推荐：几何计算使用纯函数
export function getRowHeight(row: number, sizes: SizeAccess, cfg: GeometryConfig): number {
  return sizes.hiddenRows?.has(row) ? 0 : sizes.rowHeights.get(row) ?? cfg.defaultRowHeight
}
```

### 2. 撤销/重做必须注册命令
```typescript
// 所有可逆操作都要通过 UndoRedoManager
undoRedo.execute({
  name: '设置单元格值',
  redo: () => model.setValue(r, c, newVal),
  undo: () => model.setValue(r, c, oldVal),
  sheetId: currentSheetId,           // 跨 Sheet 支持
  undoSelection: { startRow, startCol, endRow, endCol },  // 撤销后选中区域
  redoSelection: { startRow, startCol, endRow, endCol }   // 重做后选中区域
})
```

**跨 Sheet 撤销/重做**：
- `UndoRedoManager` 支持 `sheetId` 字段，记录操作所属的 Sheet
- 撤销/重做时自动切换到目标 Sheet 并选中受影响区域
- `peekUndoSheetId()` / `peekRedoSheetId()` 获取下一个操作的 Sheet ID
- WorkbookSheet 通过全局 keydown 监听器（捕获阶段）统一处理所有撤销/重做
- 跨 Sheet 切换时通过更新 `viewState` 实现选区恢复

### 3. 样式系统 (CellStyle)
- 样式定义在 `types.ts` 的 `CellStyle` 接口
- 通过 `SheetModel.setCellStyle()` 设置，支持部分更新
- 边框独立存储在 `cellBorders` Map 中

### 4. 公式处理
- 公式以 `=` 开头，由 `FormulaEngine` (基于 hot-formula-parser) 计算
- `FormulaSheet.getValue()` 返回计算结果，`getDisplayValue()` 返回原始公式
- **跨 Sheet 公式引用**：
  - 支持 `=Sheet2!A1` 和 `='Sheet Name'!A1` 语法
  - Workbook 统一管理所有 FormulaSheet 实例
  - `crossSheetValueGetter` 回调由 Workbook 提供给每个 FormulaSheet
  - 跨表依赖链支持（如 Sheet1 引用 Sheet2 的公式结果）
  - 详见 `docs/features/CROSS_SHEET_FORMULA.md`

### 5. 填充柄 (Fill Handle)
- 核心逻辑在 `fillHandle.ts`，交互在 `useFillHandle.ts`
- 支持智能模式识别：数字序列、日期序列、周期模式、自定义列表
- 公式填充时自动调整相对引用
- 反向拖拽清除内容（Excel 行为）
- 配置：`FILL_HANDLE_CONFIG = { SIZE: 8, HIT_AREA_PADDING: 5 }`
- **编辑时点击填充柄**：自动保存当前编辑内容（调用 `onOverlaySave(value, false)`），然后开始填充拖拽
- **填充柄位置更新**：在 `mousedown` 时立即更新（通过 `selection.ts` 中同步更新 `selectionRange`）

### 6. 行列操作样式继承 (rowcol.ts)
- 插入行：新行继承**上方行**的样式/边框/格式/行高（第0行继承下方）
- 插入列：新列继承**左侧列**的样式/边框/格式/列宽（第0列继承右侧）
- 删除行列：格式随单元格移动
- **批量插入优化**：`insertRowsAboveBatch()` / `insertColsLeftBatch()` 一次性移动数据，性能提升 ~18 倍

### 7. 行列隐藏功能
- 通过右键菜单隐藏/显示行列
- 隐藏实现：设置行高/列宽 ≤ 0
- 视觉指示：隐藏位置显示绿色分隔线（renderGrid.ts）
- 渲染跳过：隐藏行列不渲染内容和边框（renderCells.ts）
- 状态存储：`hiddenRows` / `hiddenCols` Set 集合

### 8. 浮动图片 (useSheetImages.ts)
- 支持拖拽移动、8方向调整大小
- 锚点系统：图片位置关联到单元格，随行列插入/删除移动
- 图片选中状态独立于单元格选区
- **性能优化**：`requestDraw` 使用 `requestAnimationFrame` 节流，避免拖动卡顿

### 9. 视图状态持久化 (Workbook.ts)
- `SheetViewState` 保存：滚动位置、选区、网格线显示状态
- 切换 Sheet 时自动保存/恢复视图状态

### 10. 剪贴板功能 (clipboard.ts)
- **内部剪贴板**：保留公式、样式、边框、格式、合并单元格
- **Excel 互操作**：与 Office 365 Excel 双向复制粘贴
  - 生成 Excel 兼容 HTML（使用 `<style>` 定义类样式）
  - 使用 `getComputedStyle` 解析 Excel 样式
- **快捷键**：Ctrl/Cmd+C/X/V 复制/剪切/粘贴，Escape 取消
- **蚂蚁线动画**：复制后显示虚线边框动画
- **右键菜单**：单元格右键支持剪切/复制/粘贴操作（通过 `ClipboardOperations` 接口）
- **文档**：详见 `docs/features/CLIPBOARD.md`

### 11. 单元格编辑保存 (useSheetInput.ts)
- `onOverlaySave(value, moveToNext)` - 保存编辑内容
  - `moveToNext = true`（默认）：保存后移动到下一个单元格
  - `moveToNext = false`：保存后保持在当前单元格（用于填充柄等场景）
- **防重复调用**：检查 `overlay.visible`，已关闭时直接返回
- **RichTextInput 获取值**：使用 `getCurrentValue()` 方法（非 `getValue`）

### 12. 公式编辑系统 - FormulaEditManager 代理层 ⭐

**设计文档**: `docs/architecture/FORMULA_EDIT_MANAGER_DESIGN.md`

**核心架构**：`FormulaEditManager` 是公式编辑系统的**唯一状态中心**，统一管理所有编辑状态。FormulaBar 和 CellOverlay 退化为**纯渲染组件**。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WorkbookSheet                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    FormulaEditManager (唯一状态源)                      │  │
│  │                                                                        │  │
│  │  状态: active, source, mode, row, col, sourceSheetId, currentSheetId  │  │
│  │        currentValue, originalValue, cursorPosition, selectionRange    │  │
│  │        isFormulaMode, formulaReferences, isInSelectableState          │  │
│  │                                                                        │  │
│  │  计算属性: displayHtml, isCrossSheetMode, shouldInsertReference       │  │
│  │                                                                        │  │
│  │  动作: startEdit, updateValue, updateCursor, insertReference          │  │
│  │        confirmEdit, cancelEdit, switchSource, switchSheet             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│              ┌───────────────┼───────────────┐                              │
│              ↓ props         ↓ props         ↓ 方法调用                      │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐      │
│  │   FormulaBar      │  │   CellOverlay     │  │   CanvasSheet       │      │
│  │   (纯渲染)        │  │   (纯渲染)        │  │   (事件采集)        │      │
│  │  显示 displayHtml │  │  显示 displayHtml │  │  - 选区变化         │      │
│  │  转发键盘事件     │  │  转发键盘事件     │  │  - 双击/F2 编辑     │      │
│  └───────────────────┘  └───────────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**文件位置**: `src/components/sheet/formulaEditState.ts`

**组件职责划分**:

| 组件 | 职责 | 不负责 |
|------|------|--------|
| FormulaEditManager | 所有编辑状态、光标、公式引用、跨 Sheet | UI 渲染 |
| FormulaBar | 渲染 displayHtml、转发事件、名称框 | 编辑状态、光标状态 |
| CellOverlay | 渲染 displayHtml、转发事件、定位 | 编辑状态、光标状态 |
| CanvasSheet | 选区事件、双击编辑、引用选择 | 编辑状态管理 |
| WorkbookSheet | 协调中心、事件分发、调用 Manager | 直接状态管理 |

**核心状态**:
```typescript
interface FormulaEditState {
  active: boolean                    // 是否激活编辑
  source: 'cell' | 'formulaBar' | null  // 当前焦点位置
  sourceSheetId: string | null      // 编辑单元格所属 Sheet（不变）
  currentSheetId: string | null     // 当前浏览的 Sheet（跨 Sheet 时变化）
  row: number; col: number          // 编辑单元格位置
  currentValue: string              // 当前编辑值
  originalValue: string             // 原始值（取消恢复用）
  cursorPosition: number            // 光标位置
  isFormulaMode: boolean            // 是否公式（=开头）
  isInSelectableState: boolean      // 是否可插入引用
  formulaReferences: FormulaReference[]  // 公式引用列表
}
```

**关键计算属性**:
```typescript
// 是否跨 Sheet 模式
isCrossSheetMode = computed(() => 
  state.active && state.sourceSheetId !== state.currentSheetId
)

// 是否应该插入引用（点击单元格时判断）
shouldInsertReference = computed(() =>
  state.active && state.isFormulaMode && state.isInSelectableState
)

// 渲染用 HTML（公式着色）
displayHtml = computed(() => generateFormulaHtml(state.currentValue, refs))
```

**跨 Sheet 公式引用流程**:

```
1. 用户在 Sheet1!A1 输入 =SUM(
   → isInSelectableState = true（光标在操作符后）

2. 用户点击 Sheet2 标签
   → 检测 isInSelectableState === true
   → 进入跨 Sheet 引用模式（不是普通切换）
   → manager.switchSheet('sheet2')
   → 隐藏 CellOverlay（不结束编辑）
   → FormulaBar 保持显示公式

3. 用户在 Sheet2 点击/拖选 A1:B3
   → 检测 shouldInsertReference === true
   → 生成跨 Sheet 引用: formatCrossSheetReference('Sheet2', 0, 0, 2, 1)
   → manager.insertReference('Sheet2!A1:B3')
   → currentValue = '=SUM(Sheet2!A1:B3'

4a. 用户按 Enter 确认
    → manager.confirmEdit()
    → 返回 { sheetId: 'sheet1', row: 0, col: 0, value: '=SUM(Sheet2!A1:B3)' }
    → 自动切回 Sheet1
    → 保存值

4b. 用户按 Escape 取消
    → manager.cancelEdit()
    → 自动切回 Sheet1
    → 恢复原始值
```

**状态转换矩阵**:

| 当前状态 | 用户操作 | 结果 |
|----------|----------|------|
| 未编辑 | 点击 Sheet2 | 普通切换 |
| 编辑普通文本 | 点击 Sheet2 | 保存后切换 |
| 编辑公式，光标在操作符后 | 点击 Sheet2 | 进入跨 Sheet 模式 |
| 跨 Sheet 模式 | 点击单元格 | 插入/替换引用 |
| 跨 Sheet 模式 | 点击 Sheet3 | 切换到 Sheet3（继续跨 Sheet 模式）|
| 跨 Sheet 模式 | 点击源 Sheet | 返回源 Sheet（继续编辑）|
| 跨 Sheet 模式 | Enter/Escape | 确认/取消，返回源 Sheet |
| 跨 Sheet 模式 | 输入字符 | 继续编辑（在公式栏）|

**isInSelectableState 判断规则**:
```typescript
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%', '!']

function isInSelectablePosition(value: string, cursorPos: number): boolean {
  if (!value.startsWith('=')) return false
  if (cursorPos <= 0) return false
  
  const prevChar = value.charAt(cursorPos - 1)
  // 1. 直接在操作符后面
  if (OPERATORS.includes(prevChar)) return true
  // 2. 在操作符后面，正在输入引用（如 "A" 或 "A1"）
  // ...详细逻辑见 formulaEditState.ts
}
```

**Sheet 名称格式化**:
```typescript
// "Sheet1" → Sheet1!A1
// "My Sheet" → 'My Sheet'!A1
// "Sheet's Data" → 'Sheet''s Data'!A1
```

### 13. 公式编辑工具函数 (formulaEditUtils.ts)

共享的纯函数工具模块，供 FormulaBar 和 RichTextInput 使用：

```typescript
// 常量
FORMULA_OPERATORS  // 公式操作符列表 ['(', '=', '+', '-', '*', '/', ...]
CELL_REF_REGEX     // 单元格引用正则 /\$?[A-Z]+\$?\d+/
NAVIGATION_KEYS    // 导航键列表 ['ArrowLeft', 'ArrowRight', ...]

// HTML 处理
escapeHtml(text)                    // HTML 转义
generateFormulaHtml(text, refs)     // 生成彩色公式 HTML
generateFormulaHtmlFromRefs(...)    // 从 FormulaReference[] 生成 HTML

// 光标管理
getEditorCursorPosition(el)         // 获取 contenteditable 光标位置
setEditorCursorPosition(el, pos)    // 设置光标位置
getEditorTextContent(el)            // 获取纯文本（移除零宽空格）
getEditorSelection(el)              // 获取选区范围

// 键盘事件
parseKeyAction(e, context)          // 解析键盘动作 → KeyAction
preventKeyDefault(e, action)        // 阻止默认行为

// 可选择状态
isInSelectablePosition(value, cursor)  // 判断是否可插入引用
hasTextSelection()                     // 是否有文本选中
```

### 14. 当前架构问题与优化方向 ⚠️

**详细文档**: 
- `docs/architecture/USER_ACTION_CHAINS.md`
- `docs/architecture/FORMULA_EDIT_MANAGER_DESIGN.md`

#### 问题优先级总结

| 问题 | 状态 | 优先级 | 解决方案 |
|------|------|--------|----------|
| 状态分散 | 🟡 设计中 | ⭐⭐⭐ | FormulaEditManager 作为唯一数据源 |
| 事件处理分散 | 🟡 设计中 | ⭐⭐⭐ | 统一事件处理入口 |
| UI 显示/隐藏分散 | 🟡 设计中 | ⭐⭐ | FormulaBar/CellOverlay 纯渲染化 |
| 引用插入分支 | 🟡 设计中 | ⭐⭐ | Manager.insertReference 统一处理 |
| 跨 Sheet 引用 | 🟡 设计中 | ⭐⭐ | isCrossSheetMode + shouldInsertReference |

#### 目标架构（设计完成，待实现）

```
FormulaEditManager (唯一状态源)
       │
       ├─→ FormulaBar (纯渲染：显示 displayHtml，转发事件)
       ├─→ CellOverlay (纯渲染：显示 displayHtml，转发事件)
       └─→ CanvasSheet (事件采集：选区变化、双击编辑)
              │
              ↓
       WorkbookSheet (协调中心：接收事件，调用 Manager)
```

#### 跨 Sheet 引用实现要点

1. **状态判断**：
   - `isCrossSheetMode`: `sourceSheetId !== currentSheetId`
   - `shouldInsertReference`: `active && isFormulaMode && isInSelectableState`

2. **Sheet 切换处理**：
   ```typescript
   if (manager.state.active && manager.state.isInSelectableState) {
     // 跨 Sheet 引用模式
     manager.switchSheet(newSheetId)
     hideOverlay()  // 隐藏但不结束编辑
   } else if (manager.state.active) {
     // 保存后切换
     confirmAndSave()
   }
   ```

3. **选区变化处理**：
   ```typescript
   if (manager.shouldInsertReference) {
     const ref = isCrossSheetMode 
       ? formatCrossSheetReference(sheetName, ...) 
       : formatReference(...)
     manager.insertReference(ref)
     return  // 阻止默认选区行为
   }
   ```

## 测试约定
- 单元测试位于 `src/components/sheet/tests/*.spec.ts` 和 `src/lib/tests/*.spec.ts`
- HTML 功能测试位于 `tests/*.html`
- 测试框架: Vitest + jsdom
- 纯函数模块（geometry, references, clipboard, fillHandle, UndoRedoManager, formulaEditState, formulaEditUtils, crossSheetFormula）优先测试
- 运行单个测试: `npm test -- geometry`
- 当前测试: **887 测试用例**，25 个测试文件

## 目录结构快速导航
```
src/components/sheet/   # 核心渲染与交互模块
src/lib/                # 数据模型与公式引擎
src/types/              # 第三方类型声明
docs/guides/            # 架构和开发文档
docs/DOCS_INDEX.md      # 完整文档索引
```

## 常见任务指引
- **添加新样式属性**: 修改 `types.ts` → `SheetModel` → `renderCells.ts` → `api.ts`
- **添加键盘快捷键**: 在 `CanvasSheet.vue` 的 `onKeyDown` 处理
- **添加右键菜单项**: 修改 `uiMenus.ts` 的 `handleContextMenu`
- **调试公式**: `formulaEngine.evaluate(formula)` 返回 `{result, error}`