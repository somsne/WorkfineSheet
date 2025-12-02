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
- `Workbook.ts` - 工作簿模型，多 Sheet 管理、视图状态保存/恢复、事件系统
- `SheetModel.ts` - 单表数据模型，稀疏存储 cells/styles/borders/formats/images/merges
- `FormulaSheet.ts` - 公式表包装器，异步计算队列、依赖图、值缓存、格式化
- `FormulaEngine.ts` - 公式计算引擎（基于 hot-formula-parser）
- `UndoRedoManager.ts` - 撤销重做（命令模式）

**辅助模块** (`src/components/sheet/`):
- `types.ts` - 所有共享类型定义（CellStyle, SelectionRange, FloatingImage 等）
- `geometry.ts` - 行列位置计算（纯函数），支持隐藏行列
- `rowcol.ts` - 行列增删核心逻辑，批量优化
- `fillHandle.ts` - 填充柄核心逻辑（模式识别、值生成、公式调整）
- `clipboard.ts` - 剪贴板数据处理
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
  undo: () => model.setValue(r, c, oldVal)
})
```

### 3. 样式系统 (CellStyle)
- 样式定义在 `types.ts` 的 `CellStyle` 接口
- 通过 `SheetModel.setCellStyle()` 设置，支持部分更新
- 边框独立存储在 `cellBorders` Map 中

### 4. 公式处理
- 公式以 `=` 开头，由 `FormulaEngine` (基于 hot-formula-parser) 计算
- `FormulaSheet.getValue()` 返回计算结果，`getDisplayValue()` 返回原始公式

### 5. 填充柄 (Fill Handle)
- 核心逻辑在 `fillHandle.ts`，交互在 `useFillHandle.ts`
- 支持智能模式识别：数字序列、日期序列、周期模式、自定义列表
- 公式填充时自动调整相对引用
- 反向拖拽清除内容（Excel 行为）
- 配置：`FILL_HANDLE_CONFIG = { SIZE: 8, HIT_AREA_PADDING: 5 }`

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
- **文档**：详见 `docs/features/CLIPBOARD.md`

## 测试约定
- 单元测试位于 `src/components/sheet/tests/*.spec.ts`
- HTML 功能测试位于 `tests/*.html`
- 测试框架: Vitest + jsdom
- 纯函数模块（geometry, references, clipboard, fillHandle）优先测试
- 运行单个测试: `npm test -- geometry`
- 当前测试: 623 个用例

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