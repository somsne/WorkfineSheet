# 🤖 Copilot Instructions for WorkfineSheet

WorkfineSheet 是基于 Vue 3 + TypeScript + Canvas 的高性能电子表格组件，支持 100+ Excel 公式、多 Sheet 工作簿管理。

## 核心架构

```
用户操作 → WorkbookSheet → CanvasSheet (Composables) → FormulaSheet → SheetModel
                                         ↓
                                   FormulaEngine (计算)
                                         ↓
                                    Canvas 渲染
```

**分层结构**：
- **工作簿层**：WorkbookSheet.vue + StyleToolbar + FormulaBar + SheetTabBar
- **表格层**：CanvasSheet.vue + 10 个 Composables（useSheetState、useSheetDrawing、useSheetMouse 等）
- **公式层**：FormulaSheet.ts（异步计算、依赖图、缓存）
- **计算引擎**：FormulaEngine.ts（基于 hot-formula-parser）
- **数据层**：Workbook.ts、SheetModel.ts、UndoRedoManager.ts


### 核心模块

**工作簿层** (`src/components/`): WorkbookSheet.vue、StyleToolbar.vue、FormulaBar.vue、SheetTabBar.vue、CanvasSheet.vue

**Composables** (`src/components/sheet/composables/`): 
- useSheetState - 状态管理、useSheetDrawing - Canvas 绘制、useSheetGeometry - 几何计算
- useSheetMouse/useSheetKeyboard - 事件处理、useSheetInput - 单元格编辑
- useSheetClipboard - 复制粘贴、useFillHandle - 填充柄、useSheetImages - 浮动图片

**数据层** (`src/lib/`):
- `Workbook.ts` - 工作簿和多 Sheet 管理
- `SheetModel.ts` - 单表稀疏存储（cells、styles、borders、formats）
- `FormulaSheet.ts` - 公式计算管理（依赖图、缓存、跨表引用）
- `FormulaEngine.ts` - 公式计算引擎
- `UndoRedoManager.ts` - 撤销重做管理

**辅助模块** (`src/components/sheet/`):
- `types.ts` - 共享类型、`geometry.ts` - 几何计算、`rowcol.ts` - 行列操作
- `formulaEditState.ts` - 公式编辑管理器、`formulaEditUtils.ts` - 编辑工具函数
- `clipboard.ts` - 剪贴板处理、`references.ts` - 公式引用解析
- `renderCells.ts/renderGrid.ts` - Canvas 渲染、`api.ts` - 对外 API

**API 层** (`src/api/`):
- `SheetAPI.ts` - 单表数据操作 API（包装 SheetModel）
- `RangeAPI.ts` - 范围批量操作 API
- `WorkbookAPI.ts` - 多表管理 API
- `index.ts` - API 导出和常量定义
- `README.md` - 完整的 API 文档参考

## 开发命令
```bash 
nvm use 20 && npm run dev           # 开发服务器
nvm use 20 && npm run build         # 生产构建
nvm use 20 && npm test              # 单元测试
nvm use 20 && npm run test:coverage # 覆盖率报告
```

## 代码约定

### 1. 核心模式
- **纯函数优先**：几何计算、数据处理使用纯函数，便于测试和复用
- **撤销/重做**：所有可逆操作都要通过 `UndoRedoManager.execute()` 注册（支持 `sheetId` 跨 Sheet 操作）
- **样式系统**：通过 `SheetModel.setCellStyle()` 设置，边框独立存储在 `cellBorders` Map
- **公式处理**：以 `=` 开头，由 `FormulaEngine` 计算；`getValue()` 返回结果，`getDisplayValue()` 返回原始公式

### 2. 特殊功能

**填充柄** (`fillHandle.ts`): 智能模式识别、公式相对引用自动调整、反向拖拽清除

**行列操作** (`rowcol.ts`): 插入继承样式、批量优化（~18倍性能提升）

**行列隐藏**: 设置高/宽 ≤ 0，隐藏位置绿色分隔线，跳过渲染

**浮动图片**: 拖拽/8方向调整、锚点系统、RAF 节流

**剪贴板**: 内部保留公式/样式/边框、Excel 双向互操作、蚂蚁线动画

**单元格编辑**: `onOverlaySave(value, moveToNext)` 保存编辑（moveToNext=false 用于填充柄场景）

### 3. 公式编辑系统 ⭐

`FormulaEditManager` 是**唯一状态中心**，FormulaBar/CellOverlay 是纯渲染组件。

**核心状态**: active、source、row/col、currentValue、cursorPosition、isFormulaMode、isInSelectableState

**关键特性**:
- 跨 Sheet 引用：`isCrossSheetMode` 判断，隐藏 CellOverlay 不结束编辑
- 插入引用：`shouldInsertReference` 判断是否可插入（光标在操作符后）
- Sheet 切换检查 `isInSelectableState` 决定进入跨 Sheet 模式

**工具函数** (`formulaEditUtils.ts`):
- 光标管理：`getEditorCursorPosition/setEditorCursorPosition`
- HTML 生成：`generateFormulaHtml`（公式彩色）
- 状态判断：`isInSelectablePosition`（是否可插入引用）

### 4. 跨 Sheet 公式引用

- 语法：`=Sheet2!A1`、`='Sheet Name'!A1`
- Workbook 管理 FormulaSheet 实例
- `crossSheetValueGetter` 回调实现跨表依赖
- Sheet 名称格式化处理特殊字符：`'Sheet''s Data'!A1`

### 5. 撤销/重做

所有可逆操作通过 `UndoRedoManager.execute()` 注册：
```typescript
undoRedo.execute({
  name: '操作名',
  redo: () => {...},
  undo: () => {...},
  sheetId: currentSheetId,      // 支持跨 Sheet
  undoSelection: {...},          // 撤销后选区
  redoSelection: {...}           // 重做后选区
})
```
- 支持跨 Sheet 操作（自动切换 Sheet 和恢复选区）
- `peekUndoSheetId()` / `peekRedoSheetId()` 获取目标 Sheet

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
- **添加新 API**:
  1. 在 `src/lib/SheetModel.ts` 实现底层方法
  2. 在 `src/api/SheetAPI.ts` 中包装为 API 接口
  3. 在 `src/components/sheet/api.ts` 的 `SheetAPI` 接口和 `createSheetAPI()` 函数中暴露到组件 API
  4. 更新 `src/api/README.md` 文档，添加新方法说明和示例
