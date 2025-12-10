# WorkfineSheet API 使用分析

本文档分析测试文件中的 API 调用情况，指导统一使用标准 API 接口。

## 📊 API 层次结构

```
组件层 (api.ts)                    数据层 (SheetAPI.ts)              模型层 (SheetModel.ts)
┌─────────────────────┐            ┌──────────────────────┐          ┌──────────────────────┐
│ WorkbookSheet       │            │ SheetAPI             │          │ SheetModel           │
│ - onReady(api)      │◄───────────│ - setValue()         │◄─────────│ - setValue()         │
│ - api.redraw()      │            │ - setValues()        │          │ - setValues()        │
│ - api.setCellValue()│            │ - setCellStyle()     │          │ - setCellStyle()     │
│ - api.getCellValue()│            │ - setCell()          │          │ - setCell()          │
└─────────────────────┘            └──────────────────────┘          └──────────────────────┘
         ▲                                   ▲                                 ▲
         │                                   │                                 │
    带渲染刷新                           API 包装                          底层模型
    (推荐使用)                         (纯数据操作)                      (内部/测试用)
```

## 📁 测试文件调用方式分析

### ✅ 正确用法（使用组件 API）

| 文件 | 调用方式 | 说明 |
|------|---------|------|
| `sheet-render-test.html` | `model.setValues()` + `api.redraw()` | ✅ 批量设置后手动刷新 |
| `workbook-demo.html` | `workbookRef.getWorkbook()` → API | ✅ 通过组件获取 API |

### ⚠️ 需要改进（直接使用 SheetModel）

| 文件 | 当前调用 | 问题 | 建议改进 |
|------|---------|------|---------|
| `benchmark.html` | `model.setValue()` | 性能测试场景可接受 | 保持，专注模型性能 |
| `memory-performance.html` | `model.setValue()` | 内存测试场景可接受 | 保持，专注内存分析 |
| `style-performance.html` | `model.setCellStyle()` | 样式性能测试 | 保持 |
| `performance-test.html` | `new SheetModel()` | 纯模型性能测试 | 保持 |
| `data-performance.html` | `new SheetModel()` | 数据层性能测试 | 保持 |
| `async-performance.html` | `new SheetModel()` | 异步性能测试 | 保持 |
| `merge-performance.html` | `new SheetModel()` | 合并性能测试 | 保持 |
| `formula-performance.html` | `new SheetModel()` | 公式性能测试 | 保持 |
| `interaction-performance.html` | `new SheetModel()` | 交互性能测试 | 保持 |
| `formatPainter-performance.html` | `new SheetModel()` | 格式刷性能测试 | 保持 |
| `render-performance.html` | `new SheetModel()` | 渲染性能测试 | 保持 |
| `test-insert-complete.html` | `new SheetModel()` | 插入操作测试 | 保持 |
| `test-absolute-reference.html` | `new SheetModel()` | 引用测试 | 保持 |
| `async-test.html` | `new SheetModel()` | 异步测试 | 保持 |

### 📝 结论

**性能/单元测试文件**：可直接使用 `SheetModel`，因为它们测试的是底层模型性能，不涉及渲染。

**功能演示/集成测试文件**：应使用组件 API (`onReady` 回调获取的 `api` 对象)。

---

## 🔧 API 对照表

### 单元格值操作

| 操作 | SheetModel | SheetAPI | 组件 API (api.ts) |
|------|-----------|----------|------------------|
| 获取单元格 | `getCell(r, c)` | `getCell(r, c)` | - |
| 获取值 | `getValue(r, c)` | `getValue(r, c)` | `getCellValue(r, c)` |
| 设置值 | `setValue(r, c, v)` | `setValue(r, c, v)` | `setCellValue(r, c, v)` ✅ |
| 批量设置值 | `setValues(r, c, data)` | `setValues(r, c, data)` | - (用 setValues + redraw) |
| 批量获取值 | `getValues(sr, sc, er, ec)` | `getValues(sr, sc, er, ec)` | - |
| 清除范围值 | `clearValues(sr, sc, er, ec)` | `clearValues(sr, sc, er, ec)` | - |

### 样式操作

| 操作 | SheetModel | SheetAPI | 组件 API |
|------|-----------|----------|----------|
| 获取样式 | `getCellStyle(r, c)` | `getCellStyle(r, c)` | `getCellStyle(r, c)` |
| 设置样式 | `setCellStyle(r, c, style)` | `setCellStyle(r, c, style)` | `setCellStyle(r, c, style)` |
| 范围样式 | `setRangeStyle(...)` | `setRangeStyle(...)` | `setRangeStyle(...)` |
| 清除样式 | `clearCellStyle(r, c)` | `clearCellStyle(r, c)` | `clearCellStyle(r, c)` |

### 边框操作

| 操作 | SheetModel | SheetAPI | 组件 API |
|------|-----------|----------|----------|
| 获取边框 | `getCellBorder(r, c)` | `getCellBorder(r, c)` | `getCellBorder(r, c)` |
| 设置边框 | `setCellBorder(r, c, border)` | `setCellBorder(r, c, border)` | `setCellBorder(r, c, border)` |
| 范围边框 | `setRangeBorder(...)` | `setRangeBorder(...)` | `setRangeBorder(...)` |
| 外边框 | `setRangeOuterBorder(...)` | `setRangeOuterBorder(...)` | `setOuterBorder(...)` |
| 清除边框 | `clearCellBorder(r, c)` | `clearCellBorder(r, c)` | `clearCellBorder(r, c)` |

### 合并单元格

| 操作 | SheetModel | SheetAPI | 组件 API |
|------|-----------|----------|----------|
| 合并 | `mergeCells(...)` | `mergeCells(...)` | `mergeCells(...)` |
| 取消合并 | `unmergeCells(r, c)` | `unmergeCells(r, c)` | `unmergeCells(r, c)` |
| 获取合并信息 | `getMergedCellInfo(r, c)` | `getMergedCellInfo(r, c)` | `getMergedCellInfo(r, c)` |
| 获取合并区域 | `getMergedRegion(r, c)` | `getMergedRegion(r, c)` | `getMergedRegion(r, c)` |

### 行列操作

| 操作 | SheetModel | SheetAPI | 组件 API |
|------|-----------|----------|----------|
| 获取行高 | `getRowHeight(row)` | `getRowHeight(row)` | `getRowHeight(row)` |
| 设置行高 | `setRowHeight(row, h)` | `setRowHeight(row, h)` | `setRowHeight(row, h)` |
| 获取列宽 | `getColWidth(col)` | `getColWidth(col)` | `getColWidth(col)` |
| 设置列宽 | `setColWidth(col, w)` | `setColWidth(col, w)` | `setColWidth(col, w)` |
| 隐藏行 | `hideRow(row)` | `hideRow(row)` | `hideRow(row)` |
| 显示行 | `showRow(row)` | `showRow(row)` | `unhideRow(row)` |
| 隐藏列 | `hideCol(col)` | `hideCol(col)` | `hideColumn(col)` |
| 显示列 | `showCol(col)` | `showCol(col)` | `unhideColumn(col)` |
| 插入行 | - | - | `insertRowAbove(row)` |
| 删除行 | - | - | `deleteRow(row)` |
| 插入列 | - | - | `insertColLeft(col)` |
| 删除列 | - | - | `deleteCol(col)` |

### 渲染控制（仅组件 API）

| 操作 | 组件 API | 说明 |
|------|----------|------|
| 强制重绘 | `redraw()` | 批量操作后调用 |
| 滚动到单元格 | `scrollToCell(r, c)` | 确保可见 |
| 设置选区 | `setSelection(r, c)` | 设置当前选中 |
| 获取选区 | `getSelection()` | 获取当前选中 |

---

## 📌 使用建议

### 1. 嵌入应用开发

```typescript
// 通过 onReady 获取 API
<WorkbookSheet 
  :workbook="workbook" 
  @ready="(api) => { sheetApi = api }"
/>

// 使用 API
sheetApi.setCellValue(0, 0, 'Hello')  // 自动刷新
sheetApi.setCellStyle(0, 0, { bold: true })
```

### 2. 批量数据操作

```typescript
// 获取底层模型进行批量操作
const model = workbook.getActiveModel()
model.setValues(0, 0, largeData)  // 批量设置
model.setRangeStyle(0, 0, 100, 10, { backgroundColor: '#f0f0f0' })

// 完成后统一刷新
api.redraw()
```

### 3. 性能测试

```typescript
// 直接使用 SheetModel，不涉及渲染
import { SheetModel } from '../src/lib/SheetModel'

const model = new SheetModel()
// 纯数据操作性能测试
for (let i = 0; i < 10000; i++) {
  model.setValue(i, 0, `Value-${i}`)
}
```

---

## 🔄 待补充 API

以下 API 在 SheetModel 中已实现，但尚未暴露到组件 API：

| API | SheetModel | SheetAPI | 组件 API | 状态 |
|-----|-----------|----------|----------|------|
| `setValues` | ✅ | ✅ | ✅ | 已完成 |
| `getValues` | ✅ | ✅ | ✅ | 已完成 |
| `clearValues` | ✅ | ✅ | ✅ | 已完成 |
| `getDataRange` | ✅ | ✅ | ✅ | 已完成 |
| `getCellCount` | ✅ | ✅ | ✅ | 已完成 |
| `hideRows` | ✅ | ✅ | ✅ | 已完成 |
| `hideRowRange` | ✅ | ✅ | ✅ | 已完成 |
| `showRows` / `unhideRows` | ✅ | ✅ | ✅ | 已完成 |
| `showRowRange` / `unhideRowRange` | ✅ | ✅ | ✅ | 已完成 |
| `getHiddenRows` | ✅ | ✅ | ✅ | 已完成 |
| `isRowHidden` | ✅ | ✅ | ✅ | 已完成 |
| `hideColumns` | ✅ | ✅ | ✅ | 已完成 |
| `hideColumnRange` | ✅ | ✅ | ✅ | 已完成 |
| `showCols` / `unhideColumns` | ✅ | ✅ | ✅ | 已完成 |
| `showColRange` / `unhideColumnRange` | ✅ | ✅ | ✅ | 已完成 |
| `getHiddenColumns` | ✅ | ✅ | ✅ | 已完成 |
| `isColumnHidden` | ✅ | ✅ | ✅ | 已完成 |
| `setRowsHeight` | ✅ | ✅ | ✅ | 已完成 |
| `setColsWidth` | ✅ | ✅ | ✅ | 已完成 |

---

## 📅 更新日志

- **2025-12-10**: 初始版本，分析所有测试文件的 API 调用情况
- **2025-12-10**: 为 SheetModel 添加 `setValues`、`getValues`、`clearValues` 方法
- **2025-12-10**: 为组件 API 添加所有待补充的批量操作方法，详见 `src/api/README.md`
