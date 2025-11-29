# 单元格格式使用指南

> 版本: 1.0.0  
> 日期: 2025-11-28

## 快速开始

### 通过工具栏设置格式

1. 选中单元格或区域
2. 点击工具栏右侧的 **"123"** 按钮
3. 从下拉菜单中选择所需格式

![格式菜单示意图](./images/format-menu.png)

### 通过 API 设置格式

```typescript
// 获取 API 引用
const sheetRef = ref<InstanceType<typeof CanvasSheet>>()
const api = computed(() => sheetRef.value?.api)

// 设置格式
api.value.setCellFormat(0, 0, { type: 'percent' })
```

## 常见使用场景

### 1. 财务数据格式化

```typescript
// 金额显示为人民币格式
api.setCellFormat(row, col, { type: 'currencyCNY' })
// 显示效果: ¥1,234.56

// 金额显示为美元格式
api.setCellFormat(row, col, { type: 'currencyUSD' })
// 显示效果: $1,234.56

// 百分比显示
api.setCellFormat(row, col, { type: 'percent' })
// 0.856 → 85.60%

// 千分位数字
api.setCellFormat(row, col, { type: 'thousands' })
// 1234567 → 1,234,567
```

### 2. 日期时间格式化

```typescript
// 中文日期
api.setCellFormat(row, col, { type: 'date-ymd-cn' })
// 显示效果: 2024年11月28日

// ISO 日期格式
api.setCellFormat(row, col, { type: 'date-ymd-pad' })
// 显示效果: 2024-11-28

// 时间格式
api.setCellFormat(row, col, { type: 'time-hms' })
// 显示效果: 14:30:45

// 完整日期时间
api.setCellFormat(row, col, { type: 'datetime-pad' })
// 显示效果: 2024-11-28 14:30:45
```

### 3. 数据验证

```typescript
// 身份证验证
api.setCellFormat(row, col, { type: 'idCard' })
// 有效: 110101199003076518 (显示原值)
// 无效: 123456789012345678 (可通过样式标记)

// 手机号验证
api.setCellFormat(row, col, { type: 'phone' })
// 有效: 13812345678, +8613812345678

// 邮箱验证
api.setCellFormat(row, col, { type: 'email' })
// 有效: user@example.com
```

### 4. 自定义格式

```typescript
// 自定义数字格式
api.setCellFormat(row, col, {
  type: 'custom',
  pattern: '#,##0.000'  // 三位小数
})

// 带单位的货币
api.setCellFormat(row, col, {
  type: 'custom',
  pattern: '¥#,##0.00元'
})

// 电话号码模板
api.setCellFormat(row, col, {
  type: 'custom',
  pattern: '021-########'
})
```

## 格式模式语法

自定义格式支持以下占位符：

| 占位符 | 说明 | 示例 |
|-------|------|------|
| `0` | 数字位，不足补零 | `0.00` → 1.50 |
| `#` | 数字位，不显示无效零 | `#.##` → 1.5 |
| `,` | 千分位分隔符 | `#,##0` → 1,234 |
| `.` | 小数点 | `0.00` → 1.23 |
| `%` | 百分号（自动×100） | `0%` → 85% |
| `其他字符` | 原样输出 | `¥#,##0元` → ¥1,234元 |

### 示例格式模式

```
#,##0         → 1,234
#,##0.00      → 1,234.56
0.00%         → 85.60%
¥#,##0.00     → ¥1,234.56
$#,##0.00     → $1,234.56
0.00E+0       → 1.23E+3
```

## 与样式结合使用

格式和样式是独立的，可以组合使用：

```typescript
// 设置格式
api.setCellFormat(row, col, { type: 'percent' })

// 设置样式（红色字体，加粗）
api.setCellStyle(row, col, {
  color: '#dc2626',
  bold: true
})
```

### 负数红色

`negativeRed` 格式会自动处理负数显示：

```typescript
api.setValue(row, col, -1234.56)
api.setCellFormat(row, col, { type: 'negativeRed' })
// 自动显示为红色
```

## 撤销/重做

所有格式操作都支持撤销（Ctrl+Z）和重做（Ctrl+Y）：

```typescript
// 设置格式
api.setCellFormat(0, 0, { type: 'percent' })

// 按 Ctrl+Z 撤销
// 按 Ctrl+Y 重做
```

## 批量操作

### 设置选区格式

```typescript
// 获取当前选区
const range = api.getSelectionRange()

// 批量设置格式
api.setRangeFormat(
  range.startRow,
  range.startCol,
  range.endRow,
  range.endCol,
  { type: 'currencyCNY' }
)
```

### 清除格式

```typescript
// 清除单个单元格格式
api.clearCellFormat(row, col)

// 清除选区格式（需遍历）
for (let r = startRow; r <= endRow; r++) {
  for (let c = startCol; c <= endCol; c++) {
    api.clearCellFormat(r, c)
  }
}
```

## 最佳实践

### 1. 根据数据类型选择格式

| 数据类型 | 推荐格式 |
|---------|---------|
| 金额 | `currencyCNY`, `currencyUSD` |
| 比例 | `percent`, `permille` |
| 日期 | `date-ymd-pad`, `date-ymd-cn` |
| 时间 | `time-hms`, `time-hms-cn` |
| 大数字 | `thousands`, `scientific` |
| 手机号 | `phone` |
| 身份证 | `idCard` |

### 2. 表头不需要设置格式

表头单元格通常只包含文本标签，不需要设置数据格式。

### 3. 验证与格式分离

对于需要验证的数据（如身份证、手机号），建议：
1. 使用格式类型进行验证
2. 在保存时检查 `formatValue()` 返回的 `valid` 属性
3. 对无效数据进行提示或标记

```typescript
import { formatValue } from '@/lib/formatValue'

const result = formatValue(value, { type: 'idCard' })
if (!result.valid) {
  // 标记无效数据
  api.setCellStyle(row, col, { color: '#dc2626' })
}
```

## 常见问题

### Q: 格式化后原值会变吗？

A: 不会。格式只影响显示，原始值保持不变。通过 `getValue()` 可以获取原始值，通过 `getFormattedValue()` 获取格式化后的显示值。

### Q: 如何知道验证是否通过？

A: 使用 `formatValue()` 函数获取完整的格式化结果：

```typescript
import { formatValue } from '@/lib/formatValue'

const result = formatValue(value, { type: 'phone' })
console.log(result.valid) // true 或 false
```

### Q: 日期值应该用什么格式存储？

A: 建议使用时间戳（毫秒）或 ISO 日期字符串存储，然后通过日期格式类型显示。

```typescript
// 存储时间戳
api.setValue(row, col, Date.now())

// 设置显示格式
api.setCellFormat(row, col, { type: 'date-ymd-cn' })
```

### Q: 自定义格式支持条件吗？

A: 当前版本暂不支持 Excel 的条件格式（如 `[>0]绿色;[<0]红色`），但可以通过 `negativeRed` 格式类型实现负数红色显示。

## 相关文档

- [CELL_FORMAT.md](../features/CELL_FORMAT.md) - 功能说明
- [FORMAT_API.md](../api/FORMAT_API.md) - API 参考
