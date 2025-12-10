# WorkfineSheet API 文档

> 📊 高性能电子表格组件的完整 API 参考

## 📖 目录

- [快速开始](#-快速开始)
- [API 架构](#-api-架构)
- [组件 API](#-组件-api-sheetapi)
  - [单元格值操作](#单元格值操作)
  - [批量数据操作](#批量数据操作)
  - [样式操作](#样式操作)
  - [边框操作](#边框操作)
  - [格式操作](#格式操作)
  - [合并单元格](#合并单元格)
  - [行列尺寸](#行列尺寸)
  - [行列操作](#行列操作)
  - [隐藏/显示](#隐藏显示)
  - [选择操作](#选择操作)
  - [冻结窗格](#冻结窗格)
  - [撤销/重做](#撤销重做)
  - [图片操作](#图片操作)
  - [格式刷](#格式刷)
- [数据层 API](#-数据层-api)
  - [SheetAPI](#sheetapi)
  - [RangeAPI](#rangeapi)
  - [WorkbookAPI](#workbookapi)
- [Workbook 批量操作](#-workbook-批量操作)

---

## 🚀 快速开始

### 基本用法

```vue
<template>
  <WorkbookSheet 
    :workbook="workbook" 
    @ready="onSheetReady"
  />
</template>

<script setup>
import { ref } from 'vue'
import { Workbook } from 'workfine-sheet'
import WorkbookSheet from 'workfine-sheet/components/WorkbookSheet.vue'

const workbook = ref(new Workbook())
let api = null

function onSheetReady(sheetApi) {
  api = sheetApi
  
  // 设置单元格值
  api.setCellValue(0, 0, 'Hello')
  api.setCellValue(0, 1, 'World')
  
  // 设置样式
  api.setCellStyle(0, 0, { bold: true, fontSize: 14 })
  
  // 批量设置数据
  api.setValues(1, 0, [
    ['姓名', '年龄', '城市'],
    ['张三', '25', '北京'],
    ['李四', '30', '上海']
  ])
}
</script>
```

### 批量数据操作

```typescript
// 批量设置数据（高性能）
api.setValues(0, 0, [
  ['A1', 'B1', 'C1'],
  ['A2', 'B2', 'C2'],
  ['A3', 'B3', 'C3']
])

// 批量获取数据
const data = api.getValues(0, 0, 2, 2)
// => [['A1', 'B1', 'C1'], ['A2', 'B2', 'C2'], ['A3', 'B3', 'C3']]

// 清除范围数据
api.clearValues(0, 0, 2, 2)
```

---

## 🏗 API 架构

WorkfineSheet 采用三层 API 架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                     组件 API (SheetAPI)                          │
│  • 自动触发渲染刷新                                               │
│  • 嵌入应用推荐使用                                               │
│  • 通过 @ready 事件获取                                          │
├─────────────────────────────────────────────────────────────────┤
│                     数据层 API                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  SheetAPI    │  │  RangeAPI    │  │ WorkbookAPI  │          │
│  │  单表数据操作  │  │  范围批量操作  │  │  多表管理     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                     模型层 (SheetModel)                          │
│  • 底层数据存储                                                   │
│  • 单元测试/性能测试使用                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 组件 API (SheetAPI)

通过 `@ready` 事件获取的 API 对象，**操作后自动刷新渲染**。

### 单元格值操作

| 方法 | 说明 | 示例 |
|------|------|------|
| `getCellValue(row, col)` | 获取计算后的值 | `api.getCellValue(0, 0)` |
| `getRawCellValue(row, col)` | 获取原始值（公式返回公式文本） | `api.getRawCellValue(0, 0)` |
| `setCellValue(row, col, value)` | 设置单元格值 | `api.setCellValue(0, 0, '=A2+B2')` |

```typescript
// 设置文本
api.setCellValue(0, 0, 'Hello')

// 设置数字
api.setCellValue(0, 1, '123.45')

// 设置公式
api.setCellValue(0, 2, '=A1+B1')

// 获取值（公式单元格返回计算结果）
const value = api.getCellValue(0, 2)  // => "123.45"

// 获取原始值（公式单元格返回公式文本）
const raw = api.getRawCellValue(0, 2)  // => "=A1+B1"
```

### 批量数据操作

| 方法 | 说明 |
|------|------|
| `setValues(startRow, startCol, values)` | 批量设置二维数组数据 |
| `getValues(startRow, startCol, endRow, endCol)` | 批量获取范围数据 |
| `clearValues(startRow, startCol, endRow, endCol)` | 清除范围数据 |
| `getDataRange()` | 获取有数据的边界范围 |
| `getCellCount()` | 获取有数据的单元格数量 |

```typescript
// 批量设置（从 A1 开始）
api.setValues(0, 0, [
  ['姓名', '年龄', '城市'],
  ['张三', '25', '北京'],
  ['李四', '30', '上海']
])

// 批量获取 A1:C3
const data = api.getValues(0, 0, 2, 2)

// 获取数据边界
const range = api.getDataRange()
// => { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }

// 清除 A1:C3
api.clearValues(0, 0, 2, 2)
```

### 样式操作

| 方法 | 说明 |
|------|------|
| `getCellStyle(row, col)` | 获取单元格样式 |
| `setCellStyle(row, col, style)` | 设置单元格样式（合并） |
| `clearCellStyle(row, col)` | 清除单元格样式 |
| `setRangeStyle(startRow, startCol, endRow, endCol, style)` | 批量设置范围样式 |

**样式属性**

| 属性 | 类型 | 说明 |
|------|------|------|
| `bold` | `boolean` | 粗体 |
| `italic` | `boolean` | 斜体 |
| `underline` | `boolean \| 'single' \| 'double'` | 下划线 |
| `strikethrough` | `boolean` | 删除线 |
| `fontFamily` | `string` | 字体 |
| `fontSize` | `number` | 字号 |
| `color` | `string` | 字体颜色 |
| `backgroundColor` | `string` | 背景色 |
| `textAlign` | `'left' \| 'center' \| 'right'` | 水平对齐 |
| `verticalAlign` | `'top' \| 'middle' \| 'bottom'` | 垂直对齐 |
| `wrapText` | `boolean` | 自动换行 |
| `textRotation` | `number` | 文字旋转角度 |

```typescript
// 设置样式
api.setCellStyle(0, 0, {
  bold: true,
  fontSize: 14,
  color: '#ff0000',
  backgroundColor: '#ffff00'
})

// 批量设置表头样式
api.setRangeStyle(0, 0, 0, 5, {
  bold: true,
  backgroundColor: '#e0e0e0',
  textAlign: 'center'
})

// 快捷方法
api.setBold(0, 0, true)
api.setItalic(0, 0, true)
api.setFontSize(0, 0, 16)
api.setTextColor(0, 0, '#333333')
api.setBackgroundColor(0, 0, '#f5f5f5')
api.setTextAlign(0, 0, 'center')
api.setVerticalAlign(0, 0, 'middle')
api.setWrapText(0, 0, true)
```

### 边框操作

| 方法 | 说明 |
|------|------|
| `getCellBorder(row, col)` | 获取单元格边框 |
| `setCellBorder(row, col, border)` | 设置单元格边框 |
| `clearCellBorder(row, col)` | 清除单元格边框 |
| `setRangeBorder(...)` | 设置范围内所有单元格边框 |
| `setRangeOuterBorder(...)` | 仅设置范围外边框 |
| `clearRangeBorder(...)` | 清除范围边框 |
| `setAllBorders(...)` | 设置全边框（快捷） |
| `setOuterBorder(...)` | 设置外边框（快捷） |

**边框样式**

| 样式 | 说明 |
|------|------|
| `thin` | 细线 |
| `medium` | 中等 |
| `thick` | 粗线 |
| `dashed` | 虚线 |
| `dotted` | 点线 |
| `double` | 双线 |

```typescript
// 设置单元格边框
api.setCellBorder(0, 0, {
  bottom: { style: 'thin', color: '#000000' }
})

// 设置范围全边框
api.setAllBorders(0, 0, 5, 5, {
  style: 'thin',
  color: '#cccccc'
})

// 仅设置外边框
api.setOuterBorder(0, 0, 5, 5, {
  style: 'medium',
  color: '#000000'
})
```

### 格式操作

| 方法 | 说明 |
|------|------|
| `getCellFormat(row, col)` | 获取单元格格式 |
| `setCellFormat(row, col, format)` | 设置单元格格式 |
| `clearCellFormat(row, col)` | 清除单元格格式 |
| `setRangeFormat(...)` | 批量设置范围格式 |
| `getFormattedValue(row, col)` | 获取格式化后的显示值 |

```typescript
// 数字格式（千分位 + 2位小数）
api.setCellFormat(0, 0, { 
  type: 'number', 
  decimals: 2,
  thousandSeparator: true
})

// 百分比格式
api.setCellFormat(0, 1, { 
  type: 'percent', 
  decimals: 1 
})

// 日期格式
api.setCellFormat(0, 2, { 
  type: 'date', 
  pattern: 'YYYY-MM-DD' 
})

// 货币格式
api.setCellFormat(0, 3, { 
  type: 'currency', 
  symbol: '¥',
  decimals: 2
})
```

### 合并单元格

| 方法 | 说明 |
|------|------|
| `mergeCells(startRow, startCol, endRow, endCol)` | 合并单元格 |
| `unmergeCells(row, col)` | 取消合并（任意单元格） |
| `canMerge(...)` | 检查是否可合并 |
| `getMergedCellInfo(row, col)` | 获取合并信息 |
| `getMergedRegion(row, col)` | 获取所在合并区域 |
| `getAllMergedRegions()` | 获取所有合并区域 |
| `mergeSelection()` | 合并当前选区 |
| `unmergeSelection()` | 取消当前选区合并 |

```typescript
// 合并 A1:C1
api.mergeCells(0, 0, 0, 2)

// 检查是否可合并（无冲突）
if (api.canMerge(1, 0, 1, 2)) {
  api.mergeCells(1, 0, 1, 2)
}

// 获取合并信息
const info = api.getMergedCellInfo(0, 0)
// => { isMerged: true, isMaster: true, masterRow: 0, masterCol: 0, rowSpan: 1, colSpan: 3 }

// 取消合并
api.unmergeCells(0, 0)
```

### 行列尺寸

| 方法 | 说明 |
|------|------|
| `getRowHeight(row)` | 获取行高 |
| `setRowHeight(row, height)` | 设置行高 |
| `setRowsHeight(rows, height)` | 批量设置多行高度 |
| `getColWidth(col)` | 获取列宽 |
| `setColWidth(col, width)` | 设置列宽 |
| `setColsWidth(cols, width)` | 批量设置多列宽度 |

```typescript
// 设置第一行高度
api.setRowHeight(0, 40)

// 批量设置多行高度
api.setRowsHeight([0, 1, 2], 30)

// 设置 A 列宽度
api.setColWidth(0, 150)

// 批量设置多列宽度
api.setColsWidth([0, 1, 2], 120)
```

### 行列操作

| 方法 | 说明 |
|------|------|
| `insertRowAbove(row, count?)` | 在上方插入行（支持批量） |
| `insertRowBelow(row, count?)` | 在下方插入行（支持批量） |
| `deleteRow(row, count?)` | 删除连续行（支持批量） |
| `deleteRows(rows)` | 批量删除不连续的多行 |
| `insertColLeft(col, count?)` | 在左侧插入列（支持批量） |
| `insertColRight(col, count?)` | 在右侧插入列（支持批量） |
| `deleteCol(col, count?)` | 删除连续列（支持批量） |
| `deleteCols(cols)` | 批量删除不连续的多列 |

> **动态扩展**: 插入行/列时会自动扩展表格边界，不再受静态行数/列数限制。撤销操作会正确恢复原始尺寸。

```typescript
// 在第 3 行上方插入 1 行
await api.insertRowAbove(2)

// 在第 3 行上方批量插入 5 行
await api.insertRowAbove(2, 5)

// 删除第 5 行
await api.deleteRow(4)

// 删除第 5-9 行（连续 5 行）
await api.deleteRow(4, 5)

// 批量删除不连续的行
await api.deleteRows([1, 5, 10, 15])

// 在 B 列左侧插入 3 列
await api.insertColLeft(1, 3)

// 批量删除不连续的列
await api.deleteCols([0, 3, 7])

// 在表格末尾插入新行（会自动扩展表格）
await api.insertRowBelow(199)  // 表格自动扩展到 201 行
```

### 隐藏/显示

| 方法 | 说明 |
|------|------|
| `hideRow(row)` | 隐藏行 |
| `hideRows(rows)` | 批量隐藏多行 |
| `hideRowRange(startRow, endRow)` | 隐藏连续行 |
| `unhideRow(row)` | 显示行 |
| `unhideRows(rows)` | 批量显示多行 |
| `unhideRowRange(startRow, endRow)` | 显示连续行 |
| `isRowHidden(row)` | 检查行是否隐藏 |
| `getHiddenRows()` | 获取所有隐藏行 |
| `hideColumn(col)` | 隐藏列 |
| `hideColumns(cols)` | 批量隐藏多列 |
| `hideColumnRange(startCol, endCol)` | 隐藏连续列 |
| `unhideColumn(col)` | 显示列 |
| `unhideColumns(cols)` | 批量显示多列 |
| `unhideColumnRange(startCol, endCol)` | 显示连续列 |
| `isColumnHidden(col)` | 检查列是否隐藏 |
| `getHiddenColumns()` | 获取所有隐藏列 |
| `setShowGridLines(show)` | 设置网格线显示 |
| `getShowGridLines()` | 获取网格线状态 |

```typescript
// 隐藏第 3-5 行
api.hideRowRange(2, 4)

// 批量隐藏多行
api.hideRows([0, 5, 10])

// 显示所有隐藏行
api.unhideRows(api.getHiddenRows())

// 隐藏/显示网格线
api.setShowGridLines(false)
```

### 选择操作

| 方法 | 说明 |
|------|------|
| `getSelection()` | 获取当前选中单元格 |
| `setSelection(row, col)` | 设置选中单元格 |
| `getSelectionRange()` | 获取选区范围 |

```typescript
// 选中 B2
api.setSelection(1, 1)

// 获取当前选中
const sel = api.getSelection()
// => { row: 1, col: 1 }

// 获取选区范围
const range = api.getSelectionRange()
// => { startRow: 1, startCol: 1, endRow: 3, endCol: 3 }
```

### 冻结窗格

| 方法 | 说明 |
|------|------|
| `setFrozenRows(count)` | 设置冻结行数 |
| `getFrozenRows()` | 获取冻结行数 |
| `setFrozenColumns(count)` | 设置冻结列数 |
| `getFrozenColumns()` | 获取冻结列数 |

```typescript
// 冻结前 2 行
api.setFrozenRows(2)

// 冻结前 1 列
api.setFrozenColumns(1)
```

### 撤销/重做

| 方法 | 说明 |
|------|------|
| `undo()` | 撤销 |
| `redo()` | 重做 |
| `canUndo()` | 是否可撤销 |
| `canRedo()` | 是否可重做 |

```typescript
// 撤销
if (api.canUndo()) {
  api.undo()
}

// 重做
if (api.canRedo()) {
  api.redo()
}
```

### 图片操作

| 方法 | 说明 |
|------|------|
| `insertImage(file)` | 插入浮动图片 |
| `insertImageFromUrl(url, width?, height?)` | 从 URL 插入浮动图片 |
| `deleteImage(imageId)` | 删除图片 |
| `getAllImages()` | 获取所有图片 |
| `insertCellImage(file, row?, col?)` | 插入单元格内嵌图片 |
| `insertCellImageFromUrl(url, row?, col?)` | 从 URL 插入内嵌图片 |
| `getCellImages(row, col)` | 获取单元格图片 |
| `removeCellImage(row, col, imageId)` | 移除单元格图片 |
| `clearCellImages(row, col)` | 清除单元格所有图片 |

```typescript
// 插入浮动图片
const imageId = await api.insertImage(file)

// 从 URL 插入
const id = await api.insertImageFromUrl('https://example.com/image.png', 200, 150)

// 插入单元格内嵌图片
await api.insertCellImage(file, 0, 0)
```

### 格式刷

| 方法 | 说明 |
|------|------|
| `getFormatPainterMode()` | 获取格式刷模式 |
| `startFormatPainter()` | 启动格式刷（单次） |
| `startFormatPainterContinuous()` | 启动格式刷（连续） |
| `stopFormatPainter()` | 停止格式刷 |
| `applyFormatPainter()` | 应用格式 |

```typescript
// 单次格式刷
api.startFormatPainter()

// 连续格式刷（双击效果）
api.startFormatPainterContinuous()

// 停止
api.stopFormatPainter()
```

---

## 📦 数据层 API

直接操作数据模型，**不触发渲染**，适合批量操作后统一刷新。

### SheetAPI

包装 `SheetModel`，提供类型安全的单表操作。

```typescript
import { SheetAPI } from 'workfine-sheet/api'
import { SheetModel } from 'workfine-sheet/lib/SheetModel'

const model = new SheetModel()
const api = new SheetAPI(model)

// 批量设置数据
api.setValues(0, 0, [
  ['A', 'B', 'C'],
  ['1', '2', '3']
])

// 设置样式
api.setCellStyle(0, 0, { bold: true })

// 合并单元格
api.mergeCells(0, 0, 0, 2)
```

### RangeAPI

范围操作 API，支持链式调用。

```typescript
import { RangeAPI } from 'workfine-sheet/api'

const range = new RangeAPI(model, 0, 0, 10, 5)

// 链式操作
range
  .setValues(data)
  .setStyle({ backgroundColor: '#f0f0f0' })
  .setAllBorders({ style: 'thin', color: '#ccc' })

// 获取范围信息
range.getA1Notation()  // => "A1:F11"
range.getCellCount()   // => 66
```

### WorkbookAPI

多表管理 API。

```typescript
import { WorkbookAPI } from 'workfine-sheet/api'
import { Workbook } from 'workfine-sheet/lib/Workbook'

const workbook = new Workbook()
const api = new WorkbookAPI(workbook)

// 添加工作表
const sheetId = api.addSheet('数据表')

// 切换工作表
api.setActiveSheet(sheetId)

// 获取所有工作表
const sheets = api.getAllSheets()

// 重命名
api.renameSheet(sheetId, '新名称')

// 删除
api.deleteSheet(sheetId)
```

---

## ⚡ Workbook 批量操作

使用 `batch()` 方法可以在批量操作期间暂停重绘和公式计算，操作完成后统一处理，显著提升大数据量操作的性能。

### 方法签名

```typescript
workbook.batch<T>(callback: () => T): T
```

### 基本用法

```typescript
import { Workbook } from 'workfine-sheet'

const workbook = new Workbook()
const model = workbook.getActiveModel()

// 同步批量操作
workbook.batch(() => {
  for (let i = 0; i < 1000; i++) {
    model.setValue(i, 0, `Row ${i}`)
    model.setValue(i, 1, `Data ${i}`)
  }
})
// batch 完成后自动触发一次重绘
```

### 异步批量操作

```typescript
// 异步批量操作（支持 await）
await workbook.batch(async () => {
  const data = await fetchDataFromServer()
  
  for (const item of data) {
    model.setValue(item.row, item.col, item.value)
  }
})
```

### 返回值

```typescript
// 批量操作可以返回值
const result = workbook.batch(() => {
  model.setValue(0, 0, 'processed')
  return { success: true, count: 100 }
})
console.log(result) // { success: true, count: 100 }
```

### 嵌套批量操作

```typescript
// 支持嵌套，只在最外层结束时触发刷新
workbook.batch(() => {
  // 第一批数据
  workbook.batch(() => {
    model.setValues(0, 0, data1)
  })
  
  // 第二批数据
  workbook.batch(() => {
    model.setValues(100, 0, data2)
  })
})
// 只触发一次重绘
```

### 状态查询

```typescript
// 检查是否在批量模式中
if (workbook.isInBatchMode()) {
  console.log('正在批量操作中')
}
```

### 完成回调

```typescript
// 注册批量完成回调（组件内部使用）
const callback = () => {
  console.log('批量操作完成，准备重绘')
}
workbook.onBatchComplete(callback)

// 移除回调
workbook.offBatchComplete(callback)
```

### 性能对比

| 操作方式 | 1000 行数据 | 10000 行数据 |
|---------|------------|--------------|
| 逐个设置 + 每次重绘 | ~500ms | ~5000ms |
| batch 批量操作 | ~50ms | ~200ms |

> **提示**: 对于大量数据操作，始终使用 `batch()` 可以获得 10-20 倍的性能提升。

---

## 📝 更新日志

- **v1.0.3** (2025-12-10)
  - 行列操作 API 支持批量插入/删除（`count` 参数）
  - 新增 `deleteRows(rows)` 批量删除不连续的多行
  - 新增 `deleteCols(cols)` 批量删除不连续的多列

- **v1.0.2** (2025-12-10)
  - 动态行列扩展：插入行/列时自动扩展表格边界
  - 支持撤销/重做时正确恢复表格尺寸
  - 移除静态 DEFAULT_ROWS/DEFAULT_COLS 限制

- **v1.0.1** (2025-12-10)
  - 添加 `workbook.batch()` 批量操作功能
  - 批量操作期间暂停重绘，完成后统一刷新
  - 支持同步和异步批量操作
  - 支持嵌套批量操作

- **v1.0.0** (2025-12-10)
  - 初始 API 文档
  - 添加批量数据操作 API
  - 添加批量隐藏/显示行列 API
  - 添加批量设置行高/列宽 API
