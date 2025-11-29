# 单元格格式 API 参考

> 版本: 1.0.0  
> 日期: 2025-11-28

## 概述

单元格格式 API 提供了设置、获取和清除单元格格式的方法，所有操作都支持撤销/重做。

## 类型定义

### CellFormatType

所有支持的格式类型：

```typescript
type CellFormatType =
  // 文本类
  | 'general'      // 常规（默认）
  | 'text'         // 文本
  | 'idCard'       // 身份证
  | 'email'        // 邮箱
  | 'phone'        // 手机号码
  | 'telephone'    // 电话号码
  | 'hyperlink'    // 超链接
  // 数值类
  | 'number'       // 整数
  | 'decimal2'     // 两位小数
  | 'percent'      // 百分比
  | 'permille'     // 千分比
  | 'currencyCNY'  // 人民币
  | 'currencyUSD'  // 美元
  | 'thousands'    // 千分位
  | 'scientific'   // 科学计数法
  | 'fraction'     // 分数
  | 'negativeRed'  // 负数红色
  // 日期时间类
  | 'date-y'       // 2024
  | 'date-y-cn'    // 2024年
  | 'date-ym'      // 2024-3
  | 'date-ym-pad'  // 2024-03
  | 'date-ym-slash' // 2024/3
  | 'date-ym-slash-pad' // 2024/03
  | 'date-ym-cn'   // 2024年3月
  | 'date-ym-cn-pad' // 2024年03月
  | 'date-m-cn'    // 3月
  | 'date-ymd'     // 2024-3-15
  | 'date-ymd-pad' // 2024-03-15
  | 'date-ymd-slash' // 2024/3/15
  | 'date-ymd-slash-pad' // 2024/03/15
  | 'date-ymd-cn'  // 2024年3月15日
  | 'date-ymd-cn-pad' // 2024年03月15日
  | 'date-md'      // 3-15
  | 'date-md-pad'  // 03-15
  | 'date-md-slash' // 3/15
  | 'date-md-slash-pad' // 03/15
  | 'date-md-cn'   // 3月15日
  | 'date-md-cn-pad' // 03月15日
  | 'datetime'     // 2024-3-15 14:30:45
  | 'datetime-pad' // 2024-03-15 14:30:45
  | 'datetime-slash' // 2024/3/15 14:30:45
  | 'datetime-slash-pad' // 2024/03/15 14:30:45
  | 'datetime-cn'  // 2024年3月15日 14时30分45秒
  | 'datetime-cn-pad' // 2024年03月15日 14时30分45秒
  | 'time-hm'      // 14:30
  | 'time-hm-cn'   // 14时30分
  | 'time-hms'     // 14:30:45
  | 'time-hms-cn'  // 14时30分45秒
  // 自定义
  | 'custom'       // Excel 格式字符串
```

### CellFormat

格式配置接口：

```typescript
interface CellFormat {
  /** 格式类型 */
  type: CellFormatType
  
  /** 自定义格式字符串（仅当 type 为 'custom' 时使用） */
  pattern?: string
  
  /** 小数位数（用于数值类型，覆盖默认值） */
  decimalPlaces?: number
  
  /** 负数颜色（用于 negativeRed 等格式） */
  negativeColor?: string
}
```

### FormatResult

格式化结果接口：

```typescript
interface FormatResult {
  /** 格式化后的显示文本 */
  text: string
  
  /** 验证是否通过（用于验证类格式） */
  valid?: boolean
  
  /** 是否为负数（用于负数红色等格式） */
  isNegative?: boolean
  
  /** 是否为超链接 */
  isHyperlink?: boolean
  
  /** 超链接地址 */
  href?: string
}
```

## SheetAPI 方法

### getCellFormat

获取单元格格式。

```typescript
getCellFormat(row: number, col: number): CellFormat
```

**参数**
- `row` - 行号（0-based）
- `col` - 列号（0-based）

**返回值**
- `CellFormat` - 格式配置，如果没有设置则返回 `{ type: 'general' }`

**示例**
```typescript
const format = api.getCellFormat(0, 0)
console.log(format.type) // 'general'
```

### setCellFormat

设置单元格格式（支持撤销/重做）。

```typescript
setCellFormat(row: number, col: number, format: CellFormat): void
```

**参数**
- `row` - 行号（0-based）
- `col` - 列号（0-based）
- `format` - 格式配置

**示例**
```typescript
// 设置为百分比格式
api.setCellFormat(0, 0, { type: 'percent' })

// 设置为自定义格式
api.setCellFormat(0, 1, { 
  type: 'custom', 
  pattern: '¥#,##0.00' 
})
```

### clearCellFormat

清除单元格格式（支持撤销/重做）。

```typescript
clearCellFormat(row: number, col: number): void
```

**参数**
- `row` - 行号（0-based）
- `col` - 列号（0-based）

**示例**
```typescript
api.clearCellFormat(0, 0)
```

### setRangeFormat

设置区域格式（支持撤销/重做）。

```typescript
setRangeFormat(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  format: CellFormat
): void
```

**参数**
- `startRow` - 起始行号
- `startCol` - 起始列号
- `endRow` - 结束行号
- `endCol` - 结束列号
- `format` - 格式配置

**示例**
```typescript
// 将 A1:C10 区域设置为货币格式
api.setRangeFormat(0, 0, 9, 2, { type: 'currencyCNY' })
```

### getFormattedValue

获取格式化后的显示值。

```typescript
getFormattedValue(row: number, col: number): string
```

**参数**
- `row` - 行号（0-based）
- `col` - 列号（0-based）

**返回值**
- `string` - 格式化后的显示文本

**示例**
```typescript
api.setValue(0, 0, 0.856)
api.setCellFormat(0, 0, { type: 'percent' })
console.log(api.getFormattedValue(0, 0)) // '85.60%'
```

## 格式化引擎 API

### formatValue

统一的格式化入口函数。

```typescript
function formatValue(
  value: unknown,
  format: CellFormat
): FormatResult
```

**参数**
- `value` - 原始值
- `format` - 格式配置

**返回值**
- `FormatResult` - 格式化结果

**示例**
```typescript
import { formatValue } from '@/lib/formatValue'

// 数字格式化
const result1 = formatValue(1234.567, { type: 'thousands' })
console.log(result1.text) // '1,234.57'

// 日期格式化
const result2 = formatValue(Date.now(), { type: 'date-ymd-cn' })
console.log(result2.text) // '2024年11月28日'

// 验证类格式
const result3 = formatValue('13812345678', { type: 'phone' })
console.log(result3.text) // '13812345678'
console.log(result3.valid) // true
```

### 验证函数

```typescript
// 身份证验证
function validateIdCard(value: string): boolean

// 手机号验证
function validatePhone(value: string): boolean

// 邮箱验证
function validateEmail(value: string): boolean
```

### 格式化函数

```typescript
// 固定电话格式化
function formatTelephone(value: string): string

// 小数格式化
function formatDecimal(value: number, places: number): string

// 千分位格式化
function formatThousands(value: number, decimalPlaces?: number): string

// 百分比格式化
function formatPercent(value: number, decimalPlaces?: number): string

// 货币格式化
function formatCurrency(value: number, symbol: string, decimalPlaces?: number): string

// 科学计数法
function formatScientific(value: number, decimalPlaces?: number): string

// 分数格式化
function formatFraction(value: number): string

// 日期格式化
function formatDate(value: Date | number | string, formatType: CellFormatType): string

// 自定义格式
function formatCustom(value: number, pattern: string): string
```

## 常量

### DEFAULT_CELL_FORMAT

默认格式配置：

```typescript
const DEFAULT_CELL_FORMAT: CellFormat = {
  type: 'general'
}
```

### FORMAT_CATEGORIES

格式类型分类：

```typescript
const FORMAT_CATEGORIES = {
  text: ['general', 'text', 'idCard', 'email', 'phone', 'telephone', 'hyperlink'],
  number: ['number', 'decimal2', 'percent', 'permille', 'currencyCNY', 'currencyUSD', 
           'thousands', 'scientific', 'fraction', 'negativeRed'],
  date: ['date-y', 'date-y-cn', 'date-ym', ...], // 30+ 种日期格式
  custom: ['custom']
}
```

## 使用示例

### 基本使用

```typescript
// 获取 API
const api = sheetRef.value

// 设置值
api.setValue(0, 0, 1234.567)

// 设置格式
api.setCellFormat(0, 0, { type: 'currencyCNY' })

// 获取格式化后的值
console.log(api.getFormattedValue(0, 0)) // '¥1,234.57'
```

### 自定义格式

```typescript
// 自定义千分位格式
api.setCellFormat(0, 0, {
  type: 'custom',
  pattern: '#,##0.000'
})

// 带单位的货币
api.setCellFormat(0, 1, {
  type: 'custom',
  pattern: '¥#,##0.00元'
})
```

### 验证类格式

```typescript
// 身份证验证
api.setValue(0, 0, '110101199003076518')
api.setCellFormat(0, 0, { type: 'idCard' })
// 如果校验失败，可以通过 formatValue 获取 valid 状态

// 手机号验证
api.setValue(0, 1, '13812345678')
api.setCellFormat(0, 1, { type: 'phone' })
```

### 批量设置

```typescript
// 选中区域后设置格式
const selection = api.getSelectionRange()
api.setRangeFormat(
  selection.startRow,
  selection.startCol,
  selection.endRow,
  selection.endCol,
  { type: 'percent' }
)
```

## 相关文档

- [CELL_FORMAT.md](../features/CELL_FORMAT.md) - 功能说明
- [FORMAT_GUIDE.md](../guides/FORMAT_GUIDE.md) - 使用指南
