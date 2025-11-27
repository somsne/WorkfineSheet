# 样式 API 文档

WorkfineSheet 提供了完整的单元格样式 API，支持 12 种样式属性的设置和查询。

## 目录

- [核心方法](#核心方法)
- [快捷方法 - 字体样式](#快捷方法---字体样式)
- [快捷方法 - 字体属性](#快捷方法---字体属性)
- [快捷方法 - 颜色](#快捷方法---颜色)
- [快捷方法 - 对齐](#快捷方法---对齐)
- [快捷方法 - 其他](#快捷方法---其他)
- [样式属性](#样式属性)
- [使用示例](#使用示例)

## 核心方法

### getCellStyle()

获取单元格的完整样式对象。

**签名**
```typescript
getCellStyle(row: number, col: number): CellStyle
```

**参数**
- `row`: 行号（从 0 开始）
- `col`: 列号（从 0 开始）

**返回值**
- 返回包含所有样式属性的 `CellStyle` 对象
- 如果单元格没有自定义样式，返回默认样式

**示例**
```typescript
const style = api.getCellStyle(0, 0)
console.log(style.bold) // false
console.log(style.fontSize) // 12
console.log(style.color) // '#000000'
```

---

### setCellStyle()

设置单元格样式（部分更新，不会覆盖未指定的属性）。

**签名**
```typescript
setCellStyle(row: number, col: number, style: Partial<CellStyle>): void
```

**参数**
- `row`: 行号
- `col`: 列号
- `style`: 样式对象（可以只包含要更改的属性）

**示例**
```typescript
// 只设置粗体和字号，其他属性保持不变
api.setCellStyle(0, 0, { bold: true, fontSize: 16 })

// 再次设置斜体，之前的粗体和字号保留
api.setCellStyle(0, 0, { italic: true })

const style = api.getCellStyle(0, 0)
// style.bold === true
// style.fontSize === 16
// style.italic === true
```

---

### clearCellStyle()

清除单元格的所有自定义样式，恢复为默认样式。

**签名**
```typescript
clearCellStyle(row: number, col: number): void
```

**参数**
- `row`: 行号
- `col`: 列号

**示例**
```typescript
api.setCellStyle(0, 0, { bold: true, fontSize: 20 })
api.clearCellStyle(0, 0)

const style = api.getCellStyle(0, 0)
// style.bold === false (默认值)
// style.fontSize === 12 (默认值)
```

---

### setRangeStyle()

批量设置范围内所有单元格的样式。

**签名**
```typescript
setRangeStyle(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  style: Partial<CellStyle>
): void
```

**参数**
- `startRow`: 起始行号
- `startCol`: 起始列号
- `endRow`: 结束行号（包含）
- `endCol`: 结束列号（包含）
- `style`: 要应用的样式

**示例**
```typescript
// 将 A1:C3 范围设置为粗体、红色文字
api.setRangeStyle(0, 0, 2, 2, {
  bold: true,
  color: '#FF0000'
})

// 所有 9 个单元格都被设置为粗体红色
```

---

## 快捷方法 - 字体样式

### setBold()

设置或取消粗体。

**签名**
```typescript
setBold(row: number, col: number, bold: boolean): void
```

**示例**
```typescript
api.setBold(0, 0, true)  // 设置粗体
api.setBold(0, 0, false) // 取消粗体
```

---

### setItalic()

设置或取消斜体。

**签名**
```typescript
setItalic(row: number, col: number, italic: boolean): void
```

**示例**
```typescript
api.setItalic(0, 0, true)  // 设置斜体
api.setItalic(0, 0, false) // 取消斜体
```

---

### setUnderline()

设置下划线样式。

**签名**
```typescript
setUnderline(row: number, col: number, underline: boolean | 'single' | 'double'): void
```

**参数**
- `underline`: 
  - `false`: 无下划线
  - `true` 或 `'single'`: 单下划线
  - `'double'`: 双下划线

**示例**
```typescript
api.setUnderline(0, 0, true)     // 单下划线
api.setUnderline(0, 0, 'double') // 双下划线
api.setUnderline(0, 0, false)    // 取消下划线
```

---

### setStrikethrough()

设置或取消删除线。

**签名**
```typescript
setStrikethrough(row: number, col: number, strikethrough: boolean): void
```

**示例**
```typescript
api.setStrikethrough(0, 0, true)  // 添加删除线
api.setStrikethrough(0, 0, false) // 取消删除线
```

---

## 快捷方法 - 字体属性

### setFontFamily()

设置字体。

**签名**
```typescript
setFontFamily(row: number, col: number, fontFamily: string): void
```

**参数**
- `fontFamily`: CSS 字体族名称（支持 fallback）

**示例**
```typescript
api.setFontFamily(0, 0, 'Arial, sans-serif')
api.setFontFamily(0, 0, "'Microsoft YaHei', sans-serif")
api.setFontFamily(0, 0, "'Courier New', monospace")
```

---

### setFontSize()

设置字号。

**签名**
```typescript
setFontSize(row: number, col: number, fontSize: number): void
```

**参数**
- `fontSize`: 字号（单位：像素）

**示例**
```typescript
api.setFontSize(0, 0, 12) // 12px
api.setFontSize(0, 0, 16) // 16px
api.setFontSize(0, 0, 24) // 24px
```

---

## 快捷方法 - 颜色

### setTextColor()

设置文字颜色。

**签名**
```typescript
setTextColor(row: number, col: number, color: string): void
```

**参数**
- `color`: CSS 颜色值（HEX、RGB、颜色名等）

**示例**
```typescript
api.setTextColor(0, 0, '#FF0000')         // 红色
api.setTextColor(0, 0, 'rgb(0, 255, 0)')  // 绿色
api.setTextColor(0, 0, 'blue')            // 蓝色
```

---

### setBackgroundColor()

设置背景颜色。

**签名**
```typescript
setBackgroundColor(row: number, col: number, color: string): void
```

**参数**
- `color`: CSS 颜色值

**示例**
```typescript
api.setBackgroundColor(0, 0, '#FFFF00') // 黄色背景
api.setBackgroundColor(0, 0, '#E0E0E0') // 灰色背景
api.setBackgroundColor(0, 0, '#FFFFFF') // 白色背景
```

---

## 快捷方法 - 对齐

### setTextAlign()

设置水平对齐方式。

**签名**
```typescript
setTextAlign(row: number, col: number, align: 'left' | 'center' | 'right'): void
```

**参数**
- `align`: 对齐方式
  - `'left'`: 左对齐
  - `'center'`: 居中
  - `'right'`: 右对齐

**示例**
```typescript
api.setTextAlign(0, 0, 'left')   // 左对齐
api.setTextAlign(0, 1, 'center') // 居中
api.setTextAlign(0, 2, 'right')  // 右对齐
```

---

### setVerticalAlign()

设置垂直对齐方式。

**签名**
```typescript
setVerticalAlign(row: number, col: number, align: 'top' | 'middle' | 'bottom'): void
```

**参数**
- `align`: 对齐方式
  - `'top'`: 顶部对齐
  - `'middle'`: 垂直居中
  - `'bottom'`: 底部对齐

**示例**
```typescript
api.setVerticalAlign(0, 0, 'top')    // 顶部对齐
api.setVerticalAlign(0, 1, 'middle') // 垂直居中
api.setVerticalAlign(0, 2, 'bottom') // 底部对齐
```

---

## 快捷方法 - 其他

### setWrapText()

设置自动换行。

**签名**
```typescript
setWrapText(row: number, col: number, wrap: boolean): void
```

**参数**
- `wrap`: `true` 启用自动换行，`false` 禁用

**示例**
```typescript
api.setWrapText(0, 0, true)  // 启用自动换行
api.setWrapText(0, 0, false) // 禁用自动换行
```

---

### setTextRotation()

设置文字旋转角度。

**签名**
```typescript
setTextRotation(row: number, col: number, rotation: number): void
```

**参数**
- `rotation`: 旋转角度（单位：度，0-360）
  - `0`: 不旋转
  - `45`: 顺时针旋转 45°
  - `90`: 顺时针旋转 90°

**示例**
```typescript
api.setTextRotation(0, 0, 0)   // 不旋转
api.setTextRotation(0, 0, 45)  // 旋转 45°
api.setTextRotation(0, 0, 90)  // 旋转 90°
```

---

## 样式属性

`CellStyle` 接口包含以下属性：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fontFamily` | `string` | `'Arial, sans-serif'` | 字体族 |
| `fontSize` | `number` | `12` | 字号（像素） |
| `bold` | `boolean` | `false` | 是否粗体 |
| `italic` | `boolean` | `false` | 是否斜体 |
| `underline` | `false \| 'single' \| 'double'` | `false` | 下划线样式 |
| `strikethrough` | `boolean` | `false` | 是否删除线 |
| `color` | `string` | `'#000000'` | 文字颜色 |
| `backgroundColor` | `string` | `'#FFFFFF'` | 背景颜色 |
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | 水平对齐 |
| `verticalAlign` | `'top' \| 'middle' \| 'bottom'` | `'middle'` | 垂直对齐 |
| `wrapText` | `boolean` | `false` | 自动换行 |
| `textRotation` | `number` | `0` | 旋转角度（度） |

---

## 使用示例

### 示例 1: 创建标题行

```typescript
// 设置第一行为标题样式
api.setRangeStyle(0, 0, 0, 5, {
  bold: true,
  fontSize: 14,
  color: '#FFFFFF',
  backgroundColor: '#4472C4',
  textAlign: 'center',
  verticalAlign: 'middle'
})
```

### 示例 2: 高亮重要数据

```typescript
// 将特定单元格标记为重要
api.setCellStyle(5, 2, {
  bold: true,
  color: '#FF0000',
  backgroundColor: '#FFFF00'
})
```

### 示例 3: 设置货币格式外观

```typescript
// 货币列右对齐，粗体
api.setRangeStyle(1, 3, 10, 3, {
  bold: true,
  textAlign: 'right'
})
```

### 示例 4: 斑马纹表格

```typescript
// 奇数行浅灰背景
for (let row = 1; row < 20; row += 2) {
  api.setRangeStyle(row, 0, row, 5, {
    backgroundColor: '#F2F2F2'
  })
}
```

### 示例 5: 复杂样式组合

```typescript
// 创建一个复杂样式的单元格
api.setCellStyle(10, 10, {
  fontFamily: "'Microsoft YaHei', sans-serif",
  fontSize: 16,
  bold: true,
  italic: false,
  underline: 'double',
  strikethrough: false,
  color: '#0066CC',
  backgroundColor: '#E6F2FF',
  textAlign: 'center',
  verticalAlign: 'middle',
  wrapText: true,
  textRotation: 0
})
```

### 示例 6: 快捷键响应

```typescript
// 响应 Ctrl+B 快捷键
function handleBoldShortcut(row: number, col: number) {
  const currentStyle = api.getCellStyle(row, col)
  api.setBold(row, col, !currentStyle.bold)
}

// 响应 Ctrl+I 快捷键
function handleItalicShortcut(row: number, col: number) {
  const currentStyle = api.getCellStyle(row, col)
  api.setItalic(row, col, !currentStyle.italic)
}
```

### 示例 7: 条件格式化

```typescript
// 根据数值设置颜色
function applyConditionalFormatting(row: number, col: number, value: number) {
  if (value > 100) {
    api.setTextColor(row, col, '#00FF00') // 绿色
  } else if (value < 0) {
    api.setTextColor(row, col, '#FF0000') // 红色
  } else {
    api.setTextColor(row, col, '#000000') // 黑色
  }
}
```

### 示例 8: 批量清除样式

```typescript
// 清除某个范围的所有样式
for (let row = 0; row < 10; row++) {
  for (let col = 0; col < 10; col++) {
    api.clearCellStyle(row, col)
  }
}
```

---

## 性能建议

1. **批量操作**: 使用 `setRangeStyle()` 比循环调用 `setCellStyle()` 更高效
   ```typescript
   // ✅ 推荐
   api.setRangeStyle(0, 0, 100, 10, { bold: true })
   
   // ❌ 不推荐
   for (let row = 0; row <= 100; row++) {
     for (let col = 0; col <= 10; col++) {
       api.setCellStyle(row, col, { bold: true })
     }
   }
   ```

2. **部分更新**: 只传递需要更改的属性
   ```typescript
   // ✅ 推荐
   api.setCellStyle(0, 0, { bold: true })
   
   // ❌ 不必要
   const fullStyle = api.getCellStyle(0, 0)
   fullStyle.bold = true
   api.setCellStyle(0, 0, fullStyle)
   ```

3. **缓存查询**: 如果需要多次读取同一单元格的样式，缓存结果
   ```typescript
   const style = api.getCellStyle(0, 0)
   console.log(style.bold)
   console.log(style.italic)
   // 而不是两次调用 api.getCellStyle(0, 0)
   ```

---

## TypeScript 类型定义

```typescript
interface CellStyle {
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: false | 'single' | 'double'
  strikethrough: boolean
  color: string
  backgroundColor: string
  textAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
  wrapText: boolean
  textRotation: number
}

interface StyleAPI {
  // 核心方法
  getCellStyle(row: number, col: number): CellStyle
  setCellStyle(row: number, col: number, style: Partial<CellStyle>): void
  clearCellStyle(row: number, col: number): void
  setRangeStyle(startRow: number, startCol: number, endRow: number, endCol: number, style: Partial<CellStyle>): void
  
  // 快捷方法
  setBold(row: number, col: number, bold: boolean): void
  setItalic(row: number, col: number, italic: boolean): void
  setUnderline(row: number, col: number, underline: boolean | 'single' | 'double'): void
  setStrikethrough(row: number, col: number, strikethrough: boolean): void
  setFontFamily(row: number, col: number, fontFamily: string): void
  setFontSize(row: number, col: number, fontSize: number): void
  setTextColor(row: number, col: number, color: string): void
  setBackgroundColor(row: number, col: number, color: string): void
  setTextAlign(row: number, col: number, align: 'left' | 'center' | 'right'): void
  setVerticalAlign(row: number, col: number, align: 'top' | 'middle' | 'bottom'): void
  setWrapText(row: number, col: number, wrap: boolean): void
  setTextRotation(row: number, col: number, rotation: number): void
}
```

---

## 相关文档

- [P0.1 功能规划](./P0.1-CHECKLIST.md)
- [P0.1 功能总结](./P0.1-SUMMARY.md)
- [单元测试说明](../src/components/sheet/tests/README.md)
