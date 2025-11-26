# WorkfineSheet 模块架构文档

## 概述

WorkfineSheet 是一个基于 Vue 3 + Canvas 的电子表格组件。通过模块化重构，将原来 2680 行的单一组件拆分为 14 个独立模块，减少了 49.3% 的代码量（约 1320 行），提高了可维护性和可测试性。

## 架构设计原则

1. **纯函数优先**：核心逻辑使用纯函数，便于测试和复用
2. **配置注入**：通过配置对象传递依赖，避免全局状态
3. **单一职责**：每个模块负责单一功能领域
4. **类型安全**：完整的 TypeScript 类型定义

## 模块结构

### 📁 src/components/sheet/

#### 1. **types.ts** - 类型定义
集中管理所有共享类型接口：
- `SelectionRange` - 选择范围
- `DragState` - 拖拽状态
- `Viewport` - 视口滚动状态
- `GeometryConfig` - 几何配置
- `SizeAccess` - 尺寸访问接口
- `FormulaReference` - 公式引用
- `OverlayState` - 覆盖层状态
- `ScrollbarState` - 滚动条状态

#### 2. **geometry.ts** - 几何计算
负责行列位置和尺寸计算：
```typescript
// 核心函数
getRowHeight(row, sizes, cfg): number
getColWidth(col, sizes, cfg): number
getRowTop(row, sizes, cfg): number
getColLeft(col, sizes, cfg): number
getRowAtY(y, viewport, sizes, cfg, totalRows): number
getColAtX(x, viewport, sizes, cfg, totalCols): number
```
- 支持自定义行高列宽
- 支持隐藏行列
- 纯函数设计，易于测试

#### 3. **renderCore.ts** - 渲染核心
Canvas 渲染基础设施：
```typescript
setupCanvas(canvas, width, height): CanvasRenderingContext2D
requestRedraw(callback)
cancelRedraw(id)
```
- 处理设备像素比
- 帧调度机制（requestAnimationFrame）
- 防止重复渲染

#### 4. **renderGrid.ts** - 网格渲染
绘制表格网格和表头：
```typescript
drawGrid(ctx, cfg)
drawHeaders(ctx, cfg)
```
- 支持网格线开关（`showGridFlag`）
- 行列标题绘制
- 自适应视口裁剪

#### 5. **renderCells.ts** - 单元格渲染
绘制单元格内容和装饰：
```typescript
drawCells(ctx, cfg)
drawSelection(ctx, cfg)
drawFormulaReferenceBorders(ctx, cfg)
```
- 文本对齐和裁剪
- 选择高亮
- 公式引用边框

#### 6. **scrollbar.ts** - 滚动条管理
自定义滚动条计算和渲染：
```typescript
updateScrollbarState(state, viewport, cfg)
handleScrollbarMouseDown(e, state, cfg)
handleGlobalMouseMove(e, state, cfg)
```
- 滚动条可见性判断
- 滑块位置计算
- 拖拽滚动支持

#### 7. **references.ts** - 公式引用解析
解析单元格地址和公式引用：
```typescript
parseCellAddr(addr: string): {row, col} | null
parseFormulaReferences(formula: string): FormulaReference[]
```
- 支持相对引用（A1）
- 支持绝对引用（$A$1）
- 支持混合引用（$A1, A$1）
- 多色高亮渲染

#### 8. **selection.ts** - 选择与拖拽
处理单元格、行、列选择：
```typescript
handleMouseDown(e, state, cfg)
handleMouseMove(e, state, cfg)
handleMouseUp(state)
```
- 单击选择
- 拖拽框选
- 行列整体选择
- 悬停高亮

#### 9. **overlay.ts** - 编辑覆盖层
管理单元格编辑输入框：
```typescript
showOverlay(row, col, state, cfg)
updateOverlayPosition(state, cfg)
commitOverlay(state, callbacks)
```
- 双击进入编辑模式
- F2 键编辑当前单元格
- 位置自动跟随
- 回车提交

#### 10. **clipboard.ts** - 剪贴板处理
复制粘贴功能：
```typescript
parseCSVLine(line: string): string[]
handleCopy(e, cfg)
handlePaste(e, cfg)
```
- Excel 格式兼容
- 公式保持（内部剪贴板）
- CSV 解析（支持引号转义）
- 多行多列粘贴

#### 11. **rowcol.ts** - 行列操作
行列的插入、删除、调整：
```typescript
insertRowAbove(cfg)
insertRowBelow(cfg)
deleteRow(cfg)
insertColLeft(cfg)
insertColRight(cfg)
deleteCol(cfg)
showSetRowHeightDialog(row, cfg)
showSetColWidthDialog(col, cfg)
```
- 异步公式调整
- 自动更新自定义尺寸
- 移动非公式单元格

#### 12. **uiMenus.ts** - 菜单与对话框
上下文菜单生成：
```typescript
handleContextMenu(e, cfg)
handleInputDialogConfirm(cfg)
closeInputDialog(cfg)
```
- 动态菜单项生成
- 位置敏感（单元格/行头/列头）
- 输入对话框管理

#### 13. **api.ts** - 公共 API
对外暴露的组件接口：
```typescript
interface SheetAPI {
  rowColSize: RowColSizeAPI      // 行列尺寸
  rowColOps: RowColOperationAPI  // 行列操作
  selection: SelectionAPI        // 选择
  visibility: VisibilityAPI      // 隐藏显示
  freeze: FreezeAPI              // 冻结（预留）
  getCellValue(row, col): string
  setCellValue(row, col, value)
  redraw()
}
```
- 清晰的接口划分
- TypeScript 类型约束
- 便于父组件调用

#### 14. **events.ts** - 事件管理
统一事件监听器管理：
```typescript
class EventManager {
  register(container, handlers)
  unregister()
  isRegistered(): boolean
}
```
- 防止重复注册
- 自动清理
- 生命周期跟踪

## 数据流

### 渲染流程
```
用户交互/数据变化
  ↓
requestRedraw() - 请求重绘
  ↓
renderFrame() - 下一帧执行
  ↓
drawGrid() → drawCells() → drawSelection()
  ↓
Canvas 显示
```

### 事件处理流程
```
DOM 事件
  ↓
EventManager 分发
  ↓
handleMouseDown/Move/Up
  ↓
更新选择状态 → 显示覆盖层 → 触发重绘
```

### 公式计算流程
```
单元格编辑
  ↓
FormulaSheet.setCellValue()
  ↓
异步计算队列
  ↓
依赖单元格更新
  ↓
触发重绘
```

## 使用示例

### 基本使用
```vue
<template>
  <CanvasSheet
    ref="sheetRef"
    :default-row-height="25"
    :default-col-width="100"
    :total-rows="100"
    :total-cols="26"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CanvasSheet from '@/components/CanvasSheet.vue'

const sheetRef = ref<InstanceType<typeof CanvasSheet>>()

onMounted(() => {
  const api = sheetRef.value
  if (!api) return

  // 设置单元格值
  api.setCellValue(0, 0, 'Hello')
  api.setCellValue(0, 1, '=A1 & " World"')

  // 设置行高列宽
  api.rowColSize.setRowHeight(0, 50)
  api.rowColSize.setColWidth(0, 150)

  // 获取选择
  const selection = api.selection.getSelection()
  console.log('Current selection:', selection)
})
</script>
```

### 高级用法
```typescript
// 批量插入行
for (let i = 0; i < 5; i++) {
  await api.rowColOps.insertRowBelow(10)
}

// 隐藏列（预留 API）
// api.visibility.hideColumn(3)
// api.visibility.unhideColumn(3)

// 设置网格线显示
// api.visibility.setShowGridLines(false)
```

## 测试

### 单元测试
```bash
# 运行测试
npm test

# 测试 UI
npm run test:ui

# 覆盖率报告
npm run test:coverage
```

### 测试覆盖
- ✅ geometry.ts - 几何计算核心函数
- ✅ references.ts - 单元格地址解析
- ✅ clipboard.ts - CSV 解析
- ✅ events.ts - 事件管理器
- 🔄 集成测试待完善（阶段 17）

## 构建

```bash
# 开发
npm run dev

# 构建
npm run build

# 预览
npm run preview
```

### TypeScript 配置
项目使用 TypeScript 严格模式：
- **target**: ES2019（支持 Array.flat()）
- **downlevelIteration**: true（支持 Map 迭代）
- **strict**: true（严格类型检查）

## 性能优化

1. **帧调度**：使用 `requestAnimationFrame` 合并重绘请求
2. **视口裁剪**：只渲染可见区域的单元格
3. **纯函数**：几何计算可被 JavaScript 引擎优化
4. **事件代理**：减少 DOM 事件监听器数量

## 贡献指南

### 添加新功能
1. 在 `src/components/sheet/` 创建新模块文件
2. 在 `types.ts` 添加类型定义
3. 在 `CanvasSheet.vue` 集成模块
4. 在 `api.ts` 暴露必要的接口
5. 编写单元测试（`tests/*.spec.ts`）
6. 更新本文档

### 代码规范
- 使用 TypeScript 严格模式
- 优先使用纯函数
- 通过配置对象注入依赖
- 避免直接访问组件状态
- 添加必要的注释和类型定义

## FAQ

### Q: 为什么不使用现有的表格库？
A: WorkfineSheet 需要与自定义公式引擎（FormulaSheet）深度集成，并支持特定的业务需求。

### Q: Canvas 渲染与 DOM 渲染的区别？
A: Canvas 渲染性能更好，特别是处理大量单元格时。但失去了 DOM 的可访问性特性。

### Q: 如何扩展支持更多的快捷键？
A: 在 `events.ts` 的 `EventHandlers` 接口中添加 `onKeyDown` 处理，在组件中实现具体逻辑。

### Q: 公式引用高亮的颜色可以自定义吗？
A: 可以修改 `references.ts` 中的 `REFERENCE_COLORS` 数组。

### Q: 如何支持冻结窗格？
A: 已在 `api.ts` 中预留 `FreezeAPI` 接口，需要在 `renderCore.ts` 和 `geometry.ts` 中添加冻结逻辑。

## 路线图

- [x] 核心重构（阶段 0-15）
- [x] 构建验证（阶段 19）
- [x] 单元测试（阶段 16）
- [ ] 集成测试（阶段 17）
- [ ] 完善文档（阶段 18）
- [ ] 实现冻结窗格
- [ ] 实现单元格合并
- [ ] 实现条件格式
- [ ] 实现数据验证
- [ ] 实现图表集成

## 许可证

[根据项目实际情况填写]

## 维护者

[根据项目实际情况填写]
