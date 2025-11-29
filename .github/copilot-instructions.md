# 🤖 Copilot Instructions for WorkfineSheet

## 项目概览
WorkfineSheet 是基于 Vue 3 + TypeScript + Canvas 的高性能电子表格组件，采用模块化架构，支持 100+ Excel 公式。

## 核心架构 (理解数据流是关键)
```
应用层 (CanvasSheet.vue) → Composables (8个) → 公式层 (FormulaSheet.ts) → 计算层 (FormulaEngine.ts) → 数据层 (SheetModel.ts)
```

**Composables 架构** (`src/components/sheet/composables/`):
- `useSheetState.ts` - 核心状态管理（选区、编辑状态、滚动位置）
- `useSheetDrawing.ts` - Canvas 绑定与绘制调度
- `useSheetMouse.ts` - 鼠标事件处理（选择、拖拽、调整大小）
- `useSheetKeyboard.ts` - 键盘事件处理（导航、编辑、快捷键）
- `useSheetEditing.ts` - 单元格编辑逻辑
- `useSheetClipboard.ts` - 复制粘贴功能
- `useSheetContextMenu.ts` - 右键菜单
- `useFillHandle.ts` - 填充柄功能（拖拽填充、双击快填、反向清除）

**核心模块** (`src/components/sheet/`):
- `types.ts` - 所有共享类型定义（CellStyle, SelectionRange 等），修改类型从这里开始
- `geometry.ts` - 行列位置计算（纯函数），支持隐藏行列
- `renderCells.ts` - 单元格渲染（样式、选择、公式引用高亮）
- `api.ts` - 对外 API 接口 (`SheetAPI`)，父组件通过此接口操作表格
- `rowcol.ts` - 行列增删操作，支持样式/边框/格式继承
- `fillHandle.ts` - 填充柄核心逻辑（模式识别、值生成、公式调整）

**数据层** (`src/lib/`):
- `SheetModel.ts` - 稀疏存储模型，管理 cells/styles/borders/formats
- `UndoRedoManager.ts` - 命令模式实现撤销重做

## 开发命令
```bash
nvm use               # 自动读取 .nvmrc (Node 20+)
npm run dev           # 启动开发服务器 (http://localhost:5174)
npm run build         # 生产构建 (vue-tsc + vite)
npm test              # 运行单元测试 (vitest)
npm run test:coverage # 生成覆盖率报告
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

## 测试约定
- 单元测试位于 `src/components/sheet/tests/*.spec.ts`
- HTML 功能测试位于 `tests/*.html`
- 测试框架: Vitest + jsdom
- 纯函数模块（geometry, references, clipboard, fillHandle）优先测试
- 运行单个测试: `npm test -- geometry`
- 当前测试: 514 个用例

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