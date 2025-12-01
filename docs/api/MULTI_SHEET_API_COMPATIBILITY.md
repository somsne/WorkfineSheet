# 多 Sheet API 兼容性检查

> 最后更新: 2025-12-01

本文档检查所有 API 在多 Sheet 场景下的兼容性状态。

## 概述

WorkfineSheet 支持两种使用方式：
1. **单 Sheet 模式** - 直接使用 `CanvasSheet` 组件
2. **多 Sheet 模式** - 使用 `WorkbookSheet` 组件（包含多个工作表和标签栏）

多 Sheet 模式下，API 分为两类：
- **工作簿级 API** - 管理多个工作表的操作
- **工作表级 API** - 操作当前活动工作表的数据

**所有 API 已完成多 Sheet 适配。**

---

## 工作簿级 API（仅 WorkbookSheet）

这些 API 仅在 `WorkbookSheet` 组件中可用，用于管理多个工作表。

| API | 说明 | 状态 |
|-----|------|------|
| `getWorkbook()` | 获取 Workbook 实例 | ✅ 已实现 |
| `getActiveCanvasSheet()` | 获取当前活动工作表的 CanvasSheet 引用 | ✅ 已实现 |
| `getSheetData(sheetId)` | 获取指定工作表的数据 | ✅ 已实现 |
| `addSheet(name?, insertIndex?)` | 添加工作表 | ✅ 已实现 |
| `removeSheet(sheetId)` | 删除工作表 | ✅ 已实现 |
| `renameSheet(sheetId, newName)` | 重命名工作表 | ✅ 已实现 |
| `setActiveSheet(sheetId)` | 设置活动工作表 | ✅ 已实现 |
| `getActiveSheetId()` | 获取活动工作表 ID | ✅ 已实现 |
| `getSheetCount()` | 获取工作表数量 | ✅ 已实现 |
| `toJSON()` | 导出工作簿为 JSON | ✅ 已实现 |
| `fromJSON(data)` | 从 JSON 加载工作簿 | ✅ 已实现 |
| `getCrossSheetValue(sheetName, row, col)` | 获取跨表单元格值 | ✅ 已实现 |

---

## 工作表级 API 兼容性检查

以下 API 在 `CanvasSheet` 和 `WorkbookSheet` 中均可用。`WorkbookSheet` 会将调用代理到当前活动的工作表。

### 选择 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `getSelection()` | ✅ | ✅ 代理 | ✅ | 返回当前活动 Sheet 的选中单元格 |
| `setSelection(row, col)` | ✅ | ✅ 代理 | ✅ | 设置当前活动 Sheet 的选中单元格 |
| `getSelectionRange()` | ✅ | ✅ 代理 | ✅ | 返回当前活动 Sheet 的选择范围 |

### 单元格值 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `getCellValue(row, col)` | ✅ | ✅ 代理 | ✅ | 获取当前活动 Sheet 的单元格值 |
| `setCellValue(row, col, value)` | ✅ | ✅ 代理 | ✅ | 设置当前活动 Sheet 的单元格值 |

### 样式 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `getCellStyle(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `setCellStyle(row, col, style)` | ✅ | ✅ 代理 | ✅ | |
| `clearCellStyle(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `setRangeStyle(...)` | ✅ | ✅ 代理 | ✅ | |
| `setBold(row, col, bold)` | ✅ | ✅ 代理 | ✅ | |
| `setItalic(row, col, italic)` | ✅ | ✅ 代理 | ✅ | |
| `setUnderline(...)` | ✅ | ✅ 代理 | ✅ | |
| `setStrikethrough(...)` | ✅ | ✅ 代理 | ✅ | |
| `setFontFamily(...)` | ✅ | ✅ 代理 | ✅ | |
| `setFontSize(...)` | ✅ | ✅ 代理 | ✅ | |
| `setTextColor(...)` | ✅ | ✅ 代理 | ✅ | |
| `setBackgroundColor(...)` | ✅ | ✅ 代理 | ✅ | |
| `setTextAlign(...)` | ✅ | ✅ 代理 | ✅ | |
| `setVerticalAlign(...)` | ✅ | ✅ 代理 | ✅ | |
| `setWrapText(...)` | ✅ | ✅ 代理 | ✅ | |
| `setTextRotation(...)` | ✅ | ✅ 代理 | ✅ | |

### 边框 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `getCellBorder(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `setCellBorder(row, col, border)` | ✅ | ✅ 代理 | ✅ | |
| `clearCellBorder(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `setRangeBorder(...)` | ✅ | ✅ 代理 | ✅ | |
| `setRangeOuterBorder(...)` | ✅ | ✅ 代理 | ✅ | |
| `clearRangeBorder(...)` | ✅ | ✅ 代理 | ✅ | |
| `setAllBorders(...)` | ✅ | ✅ 代理 | ✅ | |
| `setOuterBorder(...)` | ✅ | ✅ 代理 | ✅ | |
| `clearAllBorders(...)` | ✅ | ✅ 代理 | ✅ | |

### 格式 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `getCellFormat(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `setCellFormat(row, col, format)` | ✅ | ✅ 代理 | ✅ | |
| `clearCellFormat(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `setRangeFormat(...)` | ✅ | ✅ 代理 | ✅ | |
| `getFormattedValue(row, col)` | ✅ | ✅ 代理 | ✅ | |

### 合并单元格 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `mergeCells(...)` | ✅ | ✅ 代理 | ✅ | |
| `unmergeCells(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `canMerge(...)` | ✅ | ✅ 代理 | ✅ | |
| `getMergedCellInfo(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `getMergedRegion(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `getAllMergedRegions()` | ✅ | ✅ 代理 | ✅ | |
| `hasDataToLose(...)` | ✅ | ✅ 代理 | ✅ | |
| `mergeSelection()` | ✅ | ✅ 代理 | ✅ | |
| `unmergeSelection()` | ✅ | ✅ 代理 | ✅ | |

### 行列操作 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `getRowHeight(row)` | ✅ | ✅ 代理 | ✅ | |
| `setRowHeight(row, height)` | ✅ | ✅ 代理 | ✅ | |
| `getColWidth(col)` | ✅ | ✅ 代理 | ✅ | |
| `setColWidth(col, width)` | ✅ | ✅ 代理 | ✅ | |
| `insertRowAbove(row)` | ✅ | ✅ 代理 | ✅ | |
| `insertRowBelow(row)` | ✅ | ✅ 代理 | ✅ | |
| `deleteRow(row)` | ✅ | ✅ 代理 | ✅ | |
| `insertColLeft(col)` | ✅ | ✅ 代理 | ✅ | |
| `insertColRight(col)` | ✅ | ✅ 代理 | ✅ | |
| `deleteCol(col)` | ✅ | ✅ 代理 | ✅ | |

### 显示/隐藏 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `hideRow(row)` | ✅ | ✅ 代理 | ✅ | |
| `unhideRow(row)` | ✅ | ✅ 代理 | ✅ | |
| `hideColumn(col)` | ✅ | ✅ 代理 | ✅ | |
| `unhideColumn(col)` | ✅ | ✅ 代理 | ✅ | |
| `setShowGridLines(show)` | ✅ | ✅ 代理 | ✅ | |
| `getShowGridLines()` | ✅ | ✅ 代理 | ✅ | |

### 冻结 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `setFrozenRows(count)` | ✅ | ✅ 代理 | ✅ | |
| `getFrozenRows()` | ✅ | ✅ 代理 | ✅ | |
| `setFrozenColumns(count)` | ✅ | ✅ 代理 | ✅ | |
| `getFrozenColumns()` | ✅ | ✅ 代理 | ✅ | |

### 撤销/重做 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `undo()` | ✅ | ✅ 代理 | ✅ | 每个 Sheet 独立的撤销栈 |
| `redo()` | ✅ | ✅ 代理 | ✅ | 每个 Sheet 独立的重做栈 |
| `canUndo()` | ✅ | ✅ 代理 | ✅ | |
| `canRedo()` | ✅ | ✅ 代理 | ✅ | |

### 图片 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `insertImage(file)` | ✅ | ✅ 代理 | ✅ | |
| `insertImageFromUrl(url, ...)` | ✅ | ✅ 代理 | ✅ | |
| `deleteImage(imageId)` | ✅ | ✅ 代理 | ✅ | |
| `getAllImages()` | ✅ | ✅ 代理 | ✅ | |
| `getSelectedImageId()` | ✅ | ✅ 代理 | ✅ | |
| `selectImage(imageId)` | ✅ | ✅ 代理 | ✅ | |
| `clearImageSelection()` | ✅ | ✅ 代理 | ✅ | |

### 单元格图片 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `insertCellImage(...)` | ✅ | ✅ 代理 | ✅ | |
| `insertCellImageFromUrl(...)` | ✅ | ✅ 代理 | ✅ | |
| `getCellImages(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `getCellDisplayImage(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `getCellImageCount(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `removeCellImage(...)` | ✅ | ✅ 代理 | ✅ | |
| `clearCellImages(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `updateCellImageAlignment(...)` | ✅ | ✅ 代理 | ✅ | |
| `insertImageToSelection(...)` | ✅ | ✅ 代理 | ✅ | |
| `openCellImagePreview(row, col)` | ✅ | ✅ 代理 | ✅ | |
| `closeCellImagePreview()` | ✅ | ✅ 代理 | ✅ | |

### 格式刷 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `getFormatPainterMode()` | ✅ | ✅ 代理 | ✅ | |
| `startFormatPainter()` | ✅ | ✅ 代理 | ✅ | 支持跨 Sheet 应用 |
| `startFormatPainterContinuous()` | ✅ | ✅ 代理 | ✅ | 支持跨 Sheet 连续应用 |
| `stopFormatPainter()` | ✅ | ✅ 代理 | ✅ | |
| `applyFormatPainter()` | ✅ | ✅ 代理 | ✅ | |

### 其他 API

| API | CanvasSheet | WorkbookSheet | 多 Sheet 适配 | 备注 |
|-----|-------------|---------------|---------------|------|
| `redraw()` | ✅ | ✅ 代理 | ✅ | |
| `getViewState()` | ✅ | ❌ 内部使用 | ✅ | 切换 Sheet 时自动保存/恢复 |
| `setViewState(...)` | ✅ | ❌ 内部使用 | ✅ | 切换 Sheet 时自动保存/恢复 |
| `getFormatPainterState()` | ✅ | ❌ 内部使用 | ✅ | 跨 Sheet 格式刷状态管理 |
| `setFormatPainterState(...)` | ✅ | ❌ 内部使用 | ✅ | 跨 Sheet 格式刷状态管理 |
| `getClipboardState()` | ✅ | ❌ 内部使用 | ✅ | 跨 Sheet 剪贴板状态管理 |
| `setClipboardState(...)` | ✅ | ❌ 内部使用 | ✅ | 跨 Sheet 剪贴板状态管理 |

---

## 跨 Sheet 功能状态

### 已实现的跨 Sheet 功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 工作表切换 | ✅ | 支持通过标签栏或 API 切换 |
| 视图状态保存/恢复 | ✅ | 切换时自动保存滚动位置、选择状态 |
| 跨 Sheet 复制粘贴 | ✅ | 支持在不同 Sheet 间复制粘贴 |
| 跨 Sheet 格式刷 | ✅ | 支持 single/continuous 模式 |
| 跨 Sheet 公式引用 | ✅ | 支持 `Sheet1!A1` 语法 |
| 蚂蚁线状态管理 | ✅ | 只在源 Sheet 显示蚂蚁线 |

### 待完善的功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 跨 Sheet 撤销/重做 | ⚠️ | 当前每个 Sheet 独立，不支持跨 Sheet 操作撤销 |
| 工作表保护 | ❌ | 未实现 |
| 工作表隐藏 | ✅ | 已实现 |

---

## 建议改进

### 待完善功能

1. **跨 Sheet 撤销/重做**
   - 当前每个 Sheet 独立撤销栈，不支持跨 Sheet 操作撤销
   - 考虑支持工作簿级别的撤销栈

2. **工作表保护**
   - 未实现

---

## 使用建议

### 单 Sheet 场景

直接使用 `CanvasSheet` 组件，可以访问所有 API。

```vue
<CanvasSheet ref="sheetRef" :model="model" />
```

```typescript
const sheetRef = ref()
sheetRef.value.setCellValue(0, 0, 'Hello')
sheetRef.value.setBold(0, 0, true)
```

### 多 Sheet 场景

使用 `WorkbookSheet` 组件，通过代理 API 操作当前活动工作表。

```vue
<WorkbookSheet ref="workbookRef" />
```

```typescript
const workbookRef = ref()

// 工作簿操作
workbookRef.value.addSheet('Sheet2')
workbookRef.value.setActiveSheet('sheet-id')

// 当前活动工作表操作（通过代理）
workbookRef.value.setCellValue(0, 0, 'Hello')
workbookRef.value.setCellStyle(0, 0, { bold: true })

// 访问未代理的 API（通过 getActiveCanvasSheet）
const canvasSheet = workbookRef.value.getActiveCanvasSheet()
canvasSheet?.setBold(0, 0, true)
```

---

## 图例

- ✅ 已实现/已适配
- ⚠️ 部分实现/需要改进
- ❌ 未实现/未代理
