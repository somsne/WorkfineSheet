# 滚动性能分析报告 v2 (2025-12-10 toRaw 优化后)

## 概述

在应用 `toRaw()` 优化后，Vue Proxy 开销从 42.4% 降至 16.0%，但滚动仍有明显卡顿感。本报告深入分析残留的性能瓶颈。

## ✅ 已实施优化

### 优化 1: 渲染模块使用 PositionIndex 缓存

**问题**：`renderGrid.ts` 和 `renderCells.ts` 直接调用 `geometry.ts`，绕过了 `PositionIndex` O(1) 缓存。

**解决方案**：
1. 在 `types.ts` 添加 `PositionAccessor` 接口
2. 修改 `GridRenderConfig` 和 `CellsRenderConfig`，添加可选的 `positionAccessor` 字段
3. 在 `useSheetDrawing.ts` 传入缓存的位置访问器
4. 渲染模块使用注入的函数，如果未提供则回退到原始 `geometry.ts`

**修改的文件**：
- `src/components/sheet/types.ts` - 添加 `PositionAccessor` 接口
- `src/components/sheet/renderGrid.ts` - 支持 `positionAccessor` 参数
- `src/components/sheet/renderCells.ts` - 支持 `positionAccessor` 参数
- `src/components/sheet/composables/useSheetDrawing.ts` - 传入缓存的位置访问器

**预期效果**：
- `getRowHeight`: O(n) → O(1)
- `getRowTop`: O(n) → O(1)
- `getColWidth`: O(n) → O(1)
- `getColLeft`: O(n) → O(1)
- 预计可减少 ~600ms 渲染时间

## 关键发现

### 1. 超长任务阻塞主线程 🚨

发现 4 个超过 500ms 的长任务：

| 任务 | 耗时 |
|------|------|
| RunTask #1 | 1141.19ms |
| RunTask #2 | 597.07ms |
| RunTask #3 | 568.74ms |
| RunTask #4 | 508.13ms |

**这是卡顿的直接原因**：单个任务超过 16.67ms 就会导致掉帧，超过 500ms 会造成明显卡顿。

### 2. 热点函数分析

| 函数 | 采样次数 | 耗时 | 占比 | 问题 |
|------|---------|------|------|------|
| drawGrid (renderGrid.ts) | 4794 | 628.5ms | 19.4% | **直接调用 geometry.ts，绕过缓存** |
| get (vue.js) | 3930 | 517.7ms | 16.0% | 仍有 Vue Proxy 开销 |
| getRowHeight (geometry.ts) | 3873 | 513.5ms | 15.8% | **被 renderGrid 大量调用** |
| drawCells (renderCells.ts) | 1489 | 197.7ms | 6.1% | 同样问题 |
| getRowTop (geometry.ts) | 818 | 107.9ms | 3.3% | **被 renderCells 大量调用** |

### 3. 根本原因：渲染模块绕过位置缓存

`renderGrid.ts` 和 `renderCells.ts` 直接导入 `geometry.ts` 的函数：

```typescript
// renderGrid.ts 第 7 行
import { getColWidth, getRowHeight, getColLeft, getRowTop, getVisibleRange } from './geometry'
```

这意味着 **PositionIndex 缓存完全没有被渲染路径使用**！

每次绘制调用：
- `drawGrid`: 直接调用 geometry.ts 的 `getRowHeight` 等函数
- `drawCells`: 同样直接调用 geometry.ts

而 `useSheetGeometry` composable 中的优化版本（使用 PositionIndex O(1) 查找）从未被渲染代码使用。

### 4. RAF 回调分析

- RAF 回调总数：386 次
- 平均执行时间：9.13ms
- 最大执行时间：23.84ms
- 超时 RAF (>16.67ms)：8 次 (2.1%)

虽然大多数帧在预算内，但有部分帧超时。

### 5. Vue Proxy 残留开销

即使使用了 `toRaw()`，仍有 16.0% 的 Vue Proxy 开销，来源：

| 调用方 | 次数 |
|--------|------|
| SheetModel.getCell() | 8 |
| SheetModel.getMergedCellInfo() | 4 |
| SheetModel.getCellFormat() | 4 |
| SheetModel.getCellStyle() | 4 |
| SheetModel.getCellImages() | 4 |

这些是数据访问函数，需要进一步优化。

## 优化方案

### 方案 1：让渲染模块使用缓存的位置函数 ⭐ 推荐

修改 `GridRenderConfig` 和 `CellsRenderConfig`，添加位置计算函数参数：

```typescript
// types.ts
export interface PositionAccessor {
  getRowHeight: (row: number) => number
  getColWidth: (col: number) => number
  getRowTop: (row: number) => number
  getColLeft: (col: number) => number
}

// renderGrid.ts / renderCells.ts
export interface GridRenderConfig {
  // ... 现有字段
  positionAccessor: PositionAccessor  // 新增
}
```

在 `useSheetDrawing.ts` 中传入使用 PositionIndex 的版本：

```typescript
const gridConfig: GridRenderConfig = {
  // ...
  positionAccessor: {
    getRowHeight: geometry.getRowHeight,  // 使用 composable 的缓存版本
    getColWidth: geometry.getColWidth,
    getRowTop: geometry.getRowTop,
    getColLeft: geometry.getColLeft
  }
}
```

**预期效果**：
- getRowHeight: O(n) → O(1)，减少 ~500ms
- getRowTop: O(n) → O(1)，减少 ~100ms
- 总计可能减少 ~600ms 渲染时间

### 方案 2：SheetModel 数据访问优化

在 `SheetModel` 的高频方法中使用 `toRaw()`：

```typescript
class SheetModel {
  getCell(row: number, col: number) {
    return toRaw(this.cells).get(keyFor(row, col))
  }
  
  getCellStyle(row: number, col: number) {
    return toRaw(this.cellStyles).get(keyFor(row, col))
  }
}
```

### 方案 3：批量数据预取

在 `drawCells` 开始时，预先获取可见范围内所有单元格的数据：

```typescript
// 在渲染前预取数据
const cellDataCache = new Map<string, CellData>()
for (let r = startRow; r <= endRow; r++) {
  for (let c = startCol; c <= endCol; c++) {
    cellDataCache.set(`${r},${c}`, {
      value: model.getCell(r, c),
      style: model.getCellStyle(r, c),
      format: model.getCellFormat(r, c)
    })
  }
}
```

## 实施优先级

1. **方案 1**：让渲染模块使用 PositionIndex（预计减少 ~600ms，投入产出比最高）
2. **方案 2**：SheetModel toRaw 优化（中等收益）
3. **方案 3**：批量预取（需要较大重构）

## 测量方法

优化后重新录制 Performance trace：
1. 打开 Chrome DevTools → Performance
2. 开始录制
3. 快速拖动滚动条 3-5 秒
4. 停止录制
5. 导出 JSON 进行分析

## 结论

**滚动卡顿的根本原因不是 Vue Proxy 或防抖问题，而是渲染模块绕过了位置缓存，导致每次绘制都进行 O(n) 的位置计算。**

修复后预计可以将 `drawGrid` 的 628.5ms 和 `getRowHeight` 的 513.5ms 大幅减少。
