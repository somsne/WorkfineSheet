# 单元格格式功能说明

> 版本: 1.0.0  
> 日期: 2025-11-28

## 概述

WorkfineSheet 支持丰富的单元格格式化功能，包括文本验证、数字格式化、日期格式化和自定义格式。格式配置独立于单元格样式存储，支持撤销/重做操作。

## 功能特性

### 🔤 文本格式

| 格式类型 | 说明 | 示例 |
|---------|------|------|
| `general` | 常规（默认） | 保持原样 |
| `text` | 文本 | 强制为文本 |
| `idCard` | 身份证验证 | 18位校验位验证 |
| `email` | 邮箱验证 | 标准邮箱格式 |
| `phone` | 手机号验证 | 支持+86前缀 |
| `telephone` | 固定电话格式化 | 021-12345678 |
| `hyperlink` | 超链接 | 蓝色下划线链接 |

### 🔢 数字格式

| 格式类型 | 说明 | 示例 |
|---------|------|------|
| `number` | 整数 | 1234 |
| `decimal2` | 两位小数 | 1234.50 |
| `thousands` | 千分位 | 1,234.56 |
| `percent` | 百分比 | 85.60% |
| `permille` | 千分率 | 35.60‰ |
| `currencyCNY` | 人民币 | ¥1,234.56 |
| `currencyUSD` | 美元 | $1,234.56 |
| `scientific` | 科学计数法 | 1.23e+7 |
| `fraction` | 分数 | 3/4 |
| `negativeRed` | 负数红色 | -1,234 (红色) |

### 📅 日期格式

支持 30+ 种日期时间格式模式：

**年份**
- `date-y` → 2024
- `date-y-cn` → 2024年

**年月**
- `date-ym` → 2024-3
- `date-ym-pad` → 2024-03
- `date-ym-slash` → 2024/3
- `date-ym-cn` → 2024年3月

**年月日**
- `date-ymd` → 2024-3-15
- `date-ymd-pad` → 2024-03-15
- `date-ymd-slash` → 2024/3/15
- `date-ymd-cn` → 2024年3月15日

**日期时间**
- `datetime` → 2024-3-15 14:30:45
- `datetime-pad` → 2024-03-15 14:30:45
- `datetime-cn` → 2024年3月15日 14时30分45秒

**时间**
- `time-hm` → 14:30
- `time-hms` → 14:30:45
- `time-hms-cn` → 14时30分45秒

### 🛠️ 自定义格式

支持类 Excel 的自定义格式模式：

```javascript
// 千分位，两位小数
{ type: 'custom', pattern: '#,##0.00' }

// 带货币符号
{ type: 'custom', pattern: '¥#,##0.00元' }

// 电话格式
{ type: 'custom', pattern: '021-########' }
```

## 数据验证

### 身份证验证

实现 18 位中国居民身份证校验位算法：

- 验证长度（18位）
- 验证字符（前17位数字，最后一位数字或X）
- 计算并验证校验位

```typescript
// 有效身份证示例
110101199003076518  // 通过验证

// 无效身份证示例  
123456789012345678  // 校验位错误
```

### 手机号验证

- 支持 `+86` 或 `86` 前缀
- 验证 11 位数字
- 验证首位为 1，第二位为 3-9

```typescript
// 有效手机号
13812345678
+8613812345678
8613812345678
```

### 邮箱验证

标准 RFC 邮箱格式验证。

### 固定电话格式化

智能识别中国区号并格式化：

- 3位区号：010, 020, 021, 022, 023, 024, 025, 027, 028, 029
- 4位区号：其他地区

```typescript
02112345678 → 021-12345678
051012345678 → 0510-12345678
```

## 技术架构

### 存储模型

格式配置独立存储在 `SheetModel.cellFormats` Map 中：

```typescript
interface CellFormat {
  type: CellFormatType
  pattern?: string        // 自定义格式模式
  decimalPlaces?: number  // 小数位数覆盖
  negativeColor?: string  // 负数颜色
}
```

### 数据流

```
用户操作 → StyleToolbar → API → FormulaSheet → SheetModel
                                     ↓
                              格式化引擎 (formatValue.ts)
                                     ↓
                              渲染层 (CanvasSheet.vue)
```

### 撤销/重做支持

所有格式操作都支持撤销/重做：

- `setCellFormat` - 设置单元格格式
- `clearCellFormat` - 清除单元格格式
- `setRangeFormat` - 设置区域格式

## 文件结构

```
src/
├── components/
│   └── sheet/
│       └── types.ts          # CellFormatType, CellFormat 类型定义
├── lib/
│   └── formatValue.ts        # 格式化引擎 (~660行)
│   └── SheetModel.ts         # cellFormats 存储
│   └── FormulaSheet.ts       # 格式化集成
│   └── tests/
│       └── formatValue.spec.ts # 49个测试用例
└── components/
    └── StyleToolbar.vue       # 格式选择 UI
```

## 测试覆盖

共 49 个测试用例，覆盖：

- ✅ 身份证验证 (5 测试)
- ✅ 手机号验证 (5 测试)
- ✅ 邮箱验证 (4 测试)
- ✅ 固定电话格式化 (4 测试)
- ✅ 小数格式化 (3 测试)
- ✅ 千分位格式化 (3 测试)
- ✅ 百分比格式化 (3 测试)
- ✅ 千分率格式化 (3 测试)
- ✅ 货币格式化 (3 测试)
- ✅ 科学计数法 (3 测试)
- ✅ 分数格式化 (3 测试)
- ✅ 日期解析 (5 测试)
- ✅ 日期格式化 (5 测试)
- ✅ 自定义格式 (5 测试)
- ✅ 统一入口 formatValue (3 测试)

## 相关文档

- [FORMAT_API.md](../api/FORMAT_API.md) - API 参考
- [FORMAT_GUIDE.md](../guides/FORMAT_GUIDE.md) - 使用指南
