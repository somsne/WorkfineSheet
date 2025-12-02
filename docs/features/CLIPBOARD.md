# 剪贴板功能 (Clipboard)

## 概述

WorkfineSheet 提供完整的剪贴板功能，支持：

- **内部复制粘贴**：保留公式、样式、边框、格式、合并单元格
- **Excel 互操作**：与 Microsoft Excel (Office 365) 双向复制粘贴，保留样式格式
- **外部文本粘贴**：支持 TSV/CSV 格式的纯文本粘贴

## 功能特性

### 1. 内部剪贴板

在 WorkfineSheet 内部复制粘贴时，完整保留：

| 属性 | 说明 |
|------|------|
| 公式 | 相对引用自动调整，绝对引用保持不变 |
| 样式 | 字体、字号、粗体、斜体、下划线、删除线、颜色、背景色 |
| 边框 | 四边边框的样式、颜色、宽度 |
| 格式 | 数字格式、日期格式等 |
| 合并单元格 | 复制时记录，粘贴时恢复 |

### 2. Excel 互操作

#### 复制到 Excel

WorkfineSheet → Excel 复制时，生成 Excel 兼容的 HTML 格式：

- 使用 `<style>` 标签定义样式类（模仿 Excel 的 `.xl65` 格式）
- 包含 XML 命名空间声明（`xmlns:x`, `xmlns:o` 等）
- 支持的样式属性：
  - 字体：`font-family`, `font-size`, `font-weight`, `font-style`
  - 文本装饰：`text-decoration` (underline, line-through)
  - 颜色：`color`, `background`
  - 对齐：`text-align`, `vertical-align`
  - 边框：`border` (样式、颜色、宽度)

#### 从 Excel 粘贴

Excel → WorkfineSheet 粘贴时，解析 Excel 的 HTML 格式：

- 使用 `getComputedStyle` 解析 Excel 的类样式（`<style>` 标签）
- 提取样式、边框、合并单元格信息
- 白色边框自动转换为黑色（处理 Excel 默认值）

### 3. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + C` | 复制选中区域 |
| `Ctrl/Cmd + X` | 剪切选中区域 |
| `Ctrl/Cmd + V` | 粘贴 |
| `Escape` | 取消复制（清除蚂蚁线） |

### 4. 蚂蚁线动画

复制后，复制区域显示蚂蚁线边框动画：

- 动态虚线边框，指示复制源区域
- 按 Escape 或粘贴后清除
- 5 秒后内部剪贴板失效，降级为系统剪贴板粘贴

## 技术实现

### 模块结构

```
src/components/sheet/
├── clipboard.ts                    # 剪贴板核心模块
└── composables/
    └── useSheetClipboard.ts        # Vue Composable 封装
```

### 核心接口

```typescript
// 复制数据源接口
interface CopySource {
  getValue: (row: number, col: number) => string          // 显示值
  getRawValue: (row: number, col: number) => string       // 原始值（含公式）
  getCellStyle: (row: number, col: number) => CellStyle
  getCellBorder: (row: number, col: number) => CellBorder | undefined
  getCellFormat: (row: number, col: number) => CellFormat | null
  getMergedRegion: (row: number, col: number) => MergedRegion | null
}

// 粘贴目标接口
interface PasteTarget {
  setValue: (row: number, col: number, value: string) => void
  copyCell: (srcRow, srcCol, destRow, destCol) => void    // 公式复制
  setCellStyle: (row: number, col: number, style: CellStyle) => void
  setCellBorder: (row: number, col: number, border: CellBorder) => void
  setCellFormat: (row: number, col: number, format: CellFormat) => void
  mergeCells: (startRow, startCol, endRow, endCol) => void
  unmergeCells: (row: number, col: number) => void
}

// 内部剪贴板单元格
interface InternalClipboardCell {
  value: string
  isFormula: boolean
  style?: CellStyle
  border?: CellBorder
  format?: CellFormat
}
```

### 核心函数

| 函数 | 说明 |
|------|------|
| `copySingleCell()` | 复制单个单元格 |
| `copyRange()` | 复制选区范围 |
| `pasteInternal()` | 粘贴内部剪贴板数据 |
| `pasteExternal()` | 粘贴外部纯文本数据 |
| `generateExcelHtml()` | 生成 Excel 兼容 HTML |
| `parseExcelHtml()` | 解析 Excel HTML 格式 |
| `writeToClipboardWithHtml()` | 写入剪贴板（HTML + 纯文本） |
| `readFromClipboardWithHtml()` | 读取剪贴板（优先 HTML） |

### 剪贴板格式

#### 写入格式

同时写入两种格式到系统剪贴板：

1. **text/html**: Excel 兼容的 HTML 表格
2. **text/plain**: TSV 格式纯文本

#### HTML 格式示例

```html
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta name=ProgId content=Excel.Sheet>
<style>
td { font-size:12.0pt; font-family:Arial; }
.xl65 { background:yellow; mso-pattern:black none; border:.5pt solid black; }
</style>
</head>
<body>
<table>
<tr><td class=xl65>Hello</td></tr>
</table>
</body>
</html>
```

## 使用示例

### 基本复制粘贴

```typescript
// 通过 useSheetClipboard composable
const clipboard = useSheetClipboard(...)

// 复制
await clipboard.onCopy()

// 剪切
await clipboard.onCut()

// 粘贴
await clipboard.onPaste()
```

### 通过 API 操作

```typescript
import { copyRange, pasteInternal, generateExcelHtml } from './clipboard'

// 复制指定区域
const result = await copyRange(0, 0, 2, 2, source)

// 生成 Excel HTML
const html = generateExcelHtml(result.internalData, result.mergedRegions)

// 粘贴到目标位置
pasteInternal(result.internalData, 0, 0, 5, 5, target, result.mergedRegions)
```

## 兼容性

### 支持的浏览器

- Chrome 66+
- Firefox 63+
- Safari 13.1+
- Edge 79+

### Excel 版本

| 版本 | 支持状态 |
|------|---------|
| Office 365 (Web/Desktop) | ✅ 完全支持 |
| Excel 2019/2021 | ✅ 完全支持 |
| macOS Excel | ⚠️ 部分支持（HTML 格式限制） |
| Excel Online | ✅ 完全支持 |

### 已知限制

1. **macOS Excel 桌面版**：由于平台限制，从 Web 复制的 HTML 格式在 macOS 原生 Excel 中可能无法完整识别样式。建议使用 Office 365 或 Excel Online。

2. **权限要求**：读取剪贴板需要用户授权，首次使用时浏览器会提示权限请求。

3. **焦点要求**：复制/粘贴操作需要页面获得焦点。

## 更新日志

### 2025-12-02

- 实现 Excel HTML 格式互操作
- 使用 `<style>` 标签定义类样式（模仿 Excel 格式）
- 使用 `getComputedStyle` 解析 Excel 样式
- 修复边框颜色默认值处理
- 支持 `clipboardData.setData()` 写入剪贴板

### 初始版本

- 内部剪贴板支持公式、样式、格式
- TSV/CSV 格式解析
- 合并单元格支持
