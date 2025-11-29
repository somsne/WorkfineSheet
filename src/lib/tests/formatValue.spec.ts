/**
 * 单元格格式化功能单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  validateIdCard,
  validatePhone,
  validateEmail,
  formatTelephone,
  formatDecimal,
  formatThousands,
  formatPercent,
  formatPermille,
  formatCurrency,
  formatScientific,
  formatFraction,
  parseDate,
  formatDate,
  formatCustom,
  formatValue,
  excelSerialToDate,
  dateToExcelSerial
} from '../formatValue'
import type { CellFormat } from '../../components/sheet/types'

// ==================== 验证函数测试 ====================

describe('validateIdCard', () => {
  it('应该验证有效的身份证号码', () => {
    // 使用正确计算的校验码
    // 110101199003074514 - 校验码为 4
    expect(validateIdCard('110101199003074514')).toBe(true)
  })

  it('应该拒绝无效的身份证号码', () => {
    expect(validateIdCard('110101199003074518')).toBe(false) // 校验码错误
    expect(validateIdCard('12345678901234567')).toBe(false) // 只有17位
    expect(validateIdCard('1234567890123456789')).toBe(false) // 19位
    // 11010119900307451 的校验码是 4，X 结尾应该无效
    expect(validateIdCard('11010119900307451X')).toBe(false) // X 结尾但校验码错误
    // 有效身份证：110101199003070716（校验码是 6）
    expect(validateIdCard('110101199003070716')).toBe(true)
  })

  it('应该拒绝空值和非字符串', () => {
    expect(validateIdCard('')).toBe(false)
    expect(validateIdCard(null as any)).toBe(false)
    expect(validateIdCard(undefined as any)).toBe(false)
    expect(validateIdCard(123456789012345678 as any)).toBe(false)
  })
})

describe('validatePhone', () => {
  it('应该验证有效的中国大陆手机号码', () => {
    expect(validatePhone('13812345678')).toBe(true)
    expect(validatePhone('15912345678')).toBe(true)
    expect(validatePhone('18612345678')).toBe(true)
  })

  it('应该支持 +86 前缀', () => {
    expect(validatePhone('+8613812345678')).toBe(true)
    expect(validatePhone('+86 13812345678')).toBe(true)
    expect(validatePhone('+86-13812345678')).toBe(true)
  })

  it('应该支持 86 前缀', () => {
    expect(validatePhone('8613812345678')).toBe(true)
    expect(validatePhone('86-13812345678')).toBe(true)
  })

  it('应该拒绝无效的手机号码', () => {
    expect(validatePhone('12345678901')).toBe(false) // 非有效号段
    expect(validatePhone('1381234567')).toBe(false) // 只有10位
    expect(validatePhone('138123456789')).toBe(false) // 12位
  })
})

describe('validateEmail', () => {
  it('应该验证有效的邮箱', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('test.name@example.co.jp')).toBe(true)
    expect(validateEmail('test+label@example.com')).toBe(true)
  })

  it('应该拒绝无效的邮箱', () => {
    expect(validateEmail('test')).toBe(false)
    expect(validateEmail('test@')).toBe(false)
    expect(validateEmail('@example.com')).toBe(false)
    expect(validateEmail('test@example')).toBe(false)
  })

  it('应该拒绝空值和非字符串', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail(null as any)).toBe(false)
    expect(validateEmail(undefined as any)).toBe(false)
  })
})

// ==================== 电话格式化测试 ====================

describe('formatTelephone', () => {
  it('应该格式化北京固定电话（8位）', () => {
    expect(formatTelephone('01012345678')).toBe('010-12345678')
    expect(formatTelephone('010-12345678')).toBe('010-12345678')
  })

  it('应该格式化上海固定电话（8位）', () => {
    expect(formatTelephone('02112345678')).toBe('021-12345678')
  })

  it('应该格式化其他地区固定电话（7位）', () => {
    expect(formatTelephone('05711234567')).toBe('0571-1234567')
    // 028 是成都区号（3位），所以 02881234567 = 028-81234567
    expect(formatTelephone('02881234567')).toBe('028-81234567')
    // 非直辖市 4位区号示例: 0592（厦门）
    expect(formatTelephone('05921234567')).toBe('0592-1234567')
  })

  it('应该保留已格式化的电话', () => {
    expect(formatTelephone('0571-1234567')).toBe('0571-1234567')
  })

  it('应该处理无区号的号码', () => {
    expect(formatTelephone('12345678')).toBe('12345678')
  })

  it('应该处理空值和非字符串', () => {
    expect(formatTelephone('')).toBe('')
    expect(formatTelephone(null as any)).toBe(null)
    expect(formatTelephone(undefined as any)).toBe(undefined)
  })

  it('应该处理纯非数字字符', () => {
    expect(formatTelephone('abc')).toBe('abc')
  })
})

// ==================== 数字格式化测试 ====================

describe('formatDecimal', () => {
  it('应该格式化小数', () => {
    expect(formatDecimal(123.456, 2)).toBe('123.46')
    expect(formatDecimal(123.4, 2)).toBe('123.40')
    expect(formatDecimal(123, 2)).toBe('123.00')
  })

  it('应该处理负数', () => {
    expect(formatDecimal(-123.456, 2)).toBe('-123.46')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatDecimal(Infinity, 2)).toBe('Infinity')
    expect(formatDecimal(-Infinity, 2)).toBe('-Infinity')
    expect(formatDecimal(NaN, 2)).toBe('NaN')
  })
})

describe('formatThousands', () => {
  it('应该添加千分位分隔符', () => {
    expect(formatThousands(1234567.89, 2)).toBe('1,234,567.89')
    expect(formatThousands(1234, 0)).toBe('1,234')
  })

  it('应该处理小数字', () => {
    expect(formatThousands(123, 2)).toBe('123.00')
    expect(formatThousands(0, 2)).toBe('0.00')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatThousands(Infinity, 2)).toBe('Infinity')
    expect(formatThousands(NaN, 2)).toBe('NaN')
  })
})

describe('formatPercent', () => {
  it('应该格式化为百分比', () => {
    expect(formatPercent(0.1234, 2)).toBe('12.34%')
    expect(formatPercent(1.5, 0)).toBe('150%')
  })

  it('应该处理负数', () => {
    expect(formatPercent(-0.1234, 2)).toBe('-12.34%')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatPercent(Infinity, 2)).toBe('Infinity')
    expect(formatPercent(NaN, 2)).toBe('NaN')
  })
})

describe('formatPermille', () => {
  it('应该格式化为千分比', () => {
    expect(formatPermille(0.01234, 2)).toBe('12.34‰')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatPermille(Infinity, 2)).toBe('Infinity')
    expect(formatPermille(NaN, 2)).toBe('NaN')
  })
})

describe('formatCurrency', () => {
  it('应该格式化为人民币', () => {
    expect(formatCurrency(1234.56, '¥', 2)).toBe('¥1,234.56')
    expect(formatCurrency(-1234.56, '¥', 2)).toBe('-¥1,234.56')
  })

  it('应该格式化为美元', () => {
    expect(formatCurrency(1234.56, '$', 2)).toBe('$1,234.56')
  })

  it('应该处理零值', () => {
    expect(formatCurrency(0, '¥', 2)).toBe('¥0.00')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatCurrency(Infinity, '¥', 2)).toBe('Infinity')
    expect(formatCurrency(NaN, '¥', 2)).toBe('NaN')
  })
})

describe('formatScientific', () => {
  it('应该格式化为科学计数法', () => {
    // JavaScript toExponential 输出大写 E
    expect(formatScientific(12345, 2)).toBe('1.23E+4')
    expect(formatScientific(0.00123, 2)).toBe('1.23E-3')
  })

  it('应该处理负数', () => {
    expect(formatScientific(-12345, 2)).toBe('-1.23E+4')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatScientific(Infinity, 2)).toBe('Infinity')
    expect(formatScientific(NaN, 2)).toBe('NaN')
  })
})

describe('formatFraction', () => {
  it('应该格式化为分数', () => {
    expect(formatFraction(0.5)).toBe('1/2')
    expect(formatFraction(0.25)).toBe('1/4')
    // formatFraction 会约分，0.333... ≈ 1/3
    expect(formatFraction(0.333)).toBe('1/3')
    // formatFraction 输出带分数格式：整数部分 + 分数部分
    expect(formatFraction(1.5)).toBe('1 1/2')
  })

  it('应该处理整数', () => {
    expect(formatFraction(2)).toBe('2')
    expect(formatFraction(0)).toBe('0')
  })

  it('应该处理负数', () => {
    expect(formatFraction(-0.5)).toBe('-1/2')
    expect(formatFraction(-1.25)).toBe('-1 1/4')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatFraction(Infinity)).toBe('Infinity')
    expect(formatFraction(-Infinity)).toBe('-Infinity')
    expect(formatFraction(NaN)).toBe('NaN')
  })

  it('应该处理非常接近整数的小数', () => {
    // 0.001 非常接近 0，应该返回 "0"
    expect(formatFraction(0.001)).toBe('0')
  })
})

// ==================== 日期格式化测试 ====================

describe('parseDate', () => {
  it('应该解析 Date 对象', () => {
    const date = new Date(2024, 0, 15)
    const result = parseDate(date)
    expect(result?.getFullYear()).toBe(2024)
    expect(result?.getMonth()).toBe(0)
    expect(result?.getDate()).toBe(15)
  })

  it('应该拒绝无效的 Date 对象', () => {
    const invalidDate = new Date('invalid')
    expect(parseDate(invalidDate)).toBeNull()
  })

  it('应该解析 Excel 序列号', () => {
    // Excel 序列号 45306 = 2024-01-15
    const result = parseDate(45306)
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(2024)
    expect(result?.getMonth()).toBe(0)
    expect(result?.getDate()).toBe(15)
  })

  it('应该解析 Excel 序列号字符串', () => {
    // Excel 序列号字符串 "45306" = 2024-01-15
    const result = parseDate('45306')
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(2024)
    expect(result?.getMonth()).toBe(0)
    expect(result?.getDate()).toBe(15)
  })

  it('应该解析日期字符串', () => {
    const result = parseDate('2024-01-15')
    expect(result?.getFullYear()).toBe(2024)
    expect(result?.getMonth()).toBe(0)
    expect(result?.getDate()).toBe(15)
  })

  it('应该拒绝超出 Excel 序列号范围的数字', () => {
    // 超出 Excel 序列号范围的数字应该返回 null
    expect(parseDate(0)).toBeNull()
    expect(parseDate(-1)).toBeNull()
    expect(parseDate(2958466)).toBeNull() // 超出 9999-12-31
  })

  it('应该拒绝超出 Excel 序列号范围的数字字符串', () => {
    // 超出 Excel 序列号范围的纯数字字符串应该返回 null
    expect(parseDate('0')).toBeNull()
    expect(parseDate('2958466')).toBeNull() // 超出 9999-12-31
    expect(parseDate('9999999')).toBeNull()
  })

  it('应该返回 null 对于不支持的类型', () => {
    expect(parseDate({})).toBeNull()
    expect(parseDate([])).toBeNull()
    expect(parseDate(true)).toBeNull()
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
  })
})

// ==================== Excel 日期序列号转换测试 ====================

describe('excelSerialToDate', () => {
  it('应该正确转换 Excel 序列号 1 为 1900-01-01', () => {
    const result = excelSerialToDate(1)
    expect(result?.getFullYear()).toBe(1900)
    expect(result?.getMonth()).toBe(0)
    expect(result?.getDate()).toBe(1)
  })

  it('应该正确转换 Excel 序列号 59 为 1900-02-28', () => {
    const result = excelSerialToDate(59)
    expect(result?.getFullYear()).toBe(1900)
    expect(result?.getMonth()).toBe(1)
    expect(result?.getDate()).toBe(28)
  })

  it('应该处理 Excel 1900 年闰年 bug（序列号 60 返回 1900-02-28）', () => {
    // Excel 错误地认为 1900-02-29 存在，序列号 60
    // 我们返回 1900-02-28 因为 1900-02-29 不存在
    const result = excelSerialToDate(60)
    expect(result?.getFullYear()).toBe(1900)
    expect(result?.getMonth()).toBe(1)
    expect(result?.getDate()).toBe(28)
  })

  it('应该正确转换 Excel 序列号 61 为 1900-03-01', () => {
    const result = excelSerialToDate(61)
    expect(result?.getFullYear()).toBe(1900)
    expect(result?.getMonth()).toBe(2)
    expect(result?.getDate()).toBe(1)
  })

  it('应该正确转换常见日期（2024-01-15 = 45306）', () => {
    const result = excelSerialToDate(45306)
    expect(result?.getFullYear()).toBe(2024)
    expect(result?.getMonth()).toBe(0)
    expect(result?.getDate()).toBe(15)
  })

  it('应该正确转换 2000-01-01（Excel 序列号 36526）', () => {
    const result = excelSerialToDate(36526)
    expect(result?.getFullYear()).toBe(2000)
    expect(result?.getMonth()).toBe(0)
    expect(result?.getDate()).toBe(1)
  })

  it('应该返回 null 当序列号无效时', () => {
    expect(excelSerialToDate(0)).toBeNull()
    expect(excelSerialToDate(-1)).toBeNull()
  })
})

describe('dateToExcelSerial', () => {
  it('应该正确转换 1900-01-01 为序列号 1', () => {
    const date = new Date(1900, 0, 1)
    expect(dateToExcelSerial(date)).toBe(1)
  })

  it('应该正确转换 1900-02-28 为序列号 59', () => {
    const date = new Date(1900, 1, 28)
    expect(dateToExcelSerial(date)).toBe(59)
  })

  it('应该正确转换 1900-03-01 为序列号 61（跳过 60）', () => {
    // 由于 Excel 的 1900 年闰年 bug，1900-03-01 应该是 61
    const date = new Date(1900, 2, 1)
    expect(dateToExcelSerial(date)).toBe(61)
  })

  it('应该正确转换 2024-01-15 为序列号 45306', () => {
    const date = new Date(2024, 0, 15)
    expect(dateToExcelSerial(date)).toBe(45306)
  })

  it('应该正确转换 2000-01-01 为序列号 36526', () => {
    const date = new Date(2000, 0, 1)
    expect(dateToExcelSerial(date)).toBe(36526)
  })

  it('双向转换应该一致', () => {
    // 测试各种日期的双向转换
    const testDates = [
      new Date(1900, 0, 1),   // 1900-01-01
      new Date(1900, 1, 28),  // 1900-02-28
      new Date(1900, 2, 1),   // 1900-03-01
      new Date(2000, 0, 1),   // 2000-01-01
      new Date(2024, 0, 15),  // 2024-01-15
      new Date(2024, 11, 31), // 2024-12-31
    ]

    for (const date of testDates) {
      const serial = dateToExcelSerial(date)
      const backToDate = excelSerialToDate(serial)
      expect(backToDate?.getFullYear()).toBe(date.getFullYear())
      expect(backToDate?.getMonth()).toBe(date.getMonth())
      expect(backToDate?.getDate()).toBe(date.getDate())
    }
  })
})

describe('formatDate', () => {
  const date = new Date(2024, 0, 15, 14, 30, 45)

  // 年份格式
  it('应该格式化 date-y', () => {
    expect(formatDate(date, 'date-y')).toBe('2024')
  })

  it('应该格式化 date-y-cn', () => {
    expect(formatDate(date, 'date-y-cn')).toBe('2024年')
  })

  // 年月格式
  it('应该格式化 date-ym', () => {
    expect(formatDate(date, 'date-ym')).toBe('2024-1')
  })

  it('应该格式化 date-ym-pad', () => {
    expect(formatDate(date, 'date-ym-pad')).toBe('2024-01')
  })

  it('应该格式化 date-ym-slash', () => {
    expect(formatDate(date, 'date-ym-slash')).toBe('2024/1')
  })

  it('应该格式化 date-ym-slash-pad', () => {
    expect(formatDate(date, 'date-ym-slash-pad')).toBe('2024/01')
  })

  it('应该格式化 date-ym-cn', () => {
    expect(formatDate(date, 'date-ym-cn')).toBe('2024年1月')
  })

  it('应该格式化 date-ym-cn-pad', () => {
    expect(formatDate(date, 'date-ym-cn-pad')).toBe('2024年01月')
  })

  it('应该格式化 date-m-cn', () => {
    expect(formatDate(date, 'date-m-cn')).toBe('1月')
  })

  // 年月日格式
  it('应该格式化 date-ymd', () => {
    expect(formatDate(date, 'date-ymd')).toBe('2024-1-15')
  })

  it('应该格式化 date-ymd-pad', () => {
    expect(formatDate(date, 'date-ymd-pad')).toBe('2024-01-15')
  })

  it('应该格式化 date-ymd-slash', () => {
    expect(formatDate(date, 'date-ymd-slash')).toBe('2024/1/15')
  })

  it('应该格式化 date-ymd-slash-pad', () => {
    expect(formatDate(date, 'date-ymd-slash-pad')).toBe('2024/01/15')
  })

  it('应该格式化 date-ymd-cn', () => {
    expect(formatDate(date, 'date-ymd-cn')).toBe('2024年1月15日')
  })

  it('应该格式化中文日期 date-ymd-cn-pad', () => {
    expect(formatDate(date, 'date-ymd-cn-pad')).toBe('2024年01月15日')
  })

  // 月日格式
  it('应该格式化 date-md', () => {
    expect(formatDate(date, 'date-md')).toBe('1-15')
  })

  it('应该格式化 date-md-pad', () => {
    expect(formatDate(date, 'date-md-pad')).toBe('01-15')
  })

  it('应该格式化 date-md-slash', () => {
    expect(formatDate(date, 'date-md-slash')).toBe('1/15')
  })

  it('应该格式化 date-md-slash-pad', () => {
    expect(formatDate(date, 'date-md-slash-pad')).toBe('01/15')
  })

  it('应该格式化 date-md-cn', () => {
    expect(formatDate(date, 'date-md-cn')).toBe('1月15日')
  })

  it('应该格式化 date-md-cn-pad', () => {
    expect(formatDate(date, 'date-md-cn-pad')).toBe('01月15日')
  })

  // 完整日期时间格式
  it('应该格式化 datetime', () => {
    expect(formatDate(date, 'datetime')).toBe('2024-1-15 14:30:45')
  })

  it('应该格式化日期时间 datetime-pad', () => {
    expect(formatDate(date, 'datetime-pad')).toBe('2024-01-15 14:30:45')
  })

  it('应该格式化 datetime-slash', () => {
    expect(formatDate(date, 'datetime-slash')).toBe('2024/1/15 14:30:45')
  })

  it('应该格式化 datetime-slash-pad', () => {
    expect(formatDate(date, 'datetime-slash-pad')).toBe('2024/01/15 14:30:45')
  })

  it('应该格式化 datetime-cn', () => {
    expect(formatDate(date, 'datetime-cn')).toBe('2024年1月15日 14时30分45秒')
  })

  it('应该格式化 datetime-cn-pad', () => {
    expect(formatDate(date, 'datetime-cn-pad')).toBe('2024年01月15日 14时30分45秒')
  })

  // 时间格式
  it('应该格式化时间 time-hm', () => {
    expect(formatDate(date, 'time-hm')).toBe('14:30')
  })

  it('应该格式化 time-hm-cn', () => {
    expect(formatDate(date, 'time-hm-cn')).toBe('14时30分')
  })

  it('应该格式化时间 time-hms', () => {
    expect(formatDate(date, 'time-hms')).toBe('14:30:45')
  })

  it('应该格式化 time-hms-cn', () => {
    expect(formatDate(date, 'time-hms-cn')).toBe('14时30分45秒')
  })

  // 默认格式
  it('应该使用默认格式处理未知类型', () => {
    expect(formatDate(date, 'unknown' as any)).toBe('2024-01-15')
  })
})

// ==================== 自定义格式测试 ====================

describe('formatCustom', () => {
  it('应该处理基本数字格式', () => {
    expect(formatCustom(1234.567, '#,##0.00')).toBe('1,234.57')
    expect(formatCustom(1234, '0.00')).toBe('1234.00')
  })

  it('应该处理百分比格式', () => {
    expect(formatCustom(0.1234, '0.00%')).toBe('12.34%')
  })

  it('应该处理千分比格式', () => {
    expect(formatCustom(0.01234, '0.00‰')).toBe('12.34‰')
  })

  it('应该处理货币格式', () => {
    expect(formatCustom(1234.56, '¥#,##0.00')).toBe('¥1,234.56')
    expect(formatCustom(1234.56, '$#,##0.00')).toBe('$1,234.56')
    expect(formatCustom(1234.56, '€#,##0.00')).toBe('€1,234.56')
  })

  it('应该处理负数格式', () => {
    // 使用双段格式：正数;负数
    expect(formatCustom(-1234.56, '#,##0.00;-#,##0.00')).toBe('-1,234.56')
  })

  it('应该处理零值格式', () => {
    // 使用三段格式：正数;负数;零
    // 零值使用第三段格式 "0"
    expect(formatCustom(0, '#,##0.00;-#,##0.00;0')).toBe('0')
    // 默认使用第一段格式
    expect(formatCustom(0, '#,##0.00')).toBe('0.00')
  })

  it('应该处理带后缀的格式', () => {
    expect(formatCustom(12345, '#,##0 元')).toBe('12,345 元')
    expect(formatCustom(100, '0.00 kg')).toBe('100.00 kg')
  })

  it('应该处理无千分位的格式', () => {
    expect(formatCustom(1234567, '0')).toBe('1234567')
    expect(formatCustom(1234567, '0.00')).toBe('1234567.00')
  })

  it('应该处理 Infinity 和 NaN', () => {
    expect(formatCustom(Infinity, '#,##0.00')).toBe('Infinity')
    expect(formatCustom(-Infinity, '#,##0.00')).toBe('-Infinity')
    expect(formatCustom(NaN, '#,##0.00')).toBe('NaN')
  })
})

// ==================== 综合 formatValue 测试 ====================

describe('formatValue', () => {
  it('应该使用默认格式（常规）', () => {
    const result = formatValue('Hello', { type: 'general' })
    expect(result.text).toBe('Hello')
    // general 格式不设置 valid 字段
  })

  it('应该格式化 text 类型', () => {
    const result = formatValue('Hello World', { type: 'text' })
    expect(result.text).toBe('Hello World')
  })

  it('应该格式化数字类型', () => {
    const format: CellFormat = { type: 'decimal2' }
    const result = formatValue(123.456, format)
    expect(result.text).toBe('123.46')
  })

  it('应该格式化整数类型', () => {
    const format: CellFormat = { type: 'number' }
    const result = formatValue(123.456, format)
    expect(result.text).toBe('123')
    expect(result.isNegative).toBe(false)
  })

  it('应该格式化负数并标记 isNegative', () => {
    const format: CellFormat = { type: 'number' }
    const result = formatValue(-123.456, format)
    expect(result.text).toBe('-123')
    expect(result.isNegative).toBe(true)
  })

  it('应该格式化百分比类型', () => {
    const format: CellFormat = { type: 'percent', decimalPlaces: 1 }
    const result = formatValue(0.1234, format)
    expect(result.text).toBe('12.3%')
  })

  it('应该格式化千分比类型', () => {
    const format: CellFormat = { type: 'permille' }
    const result = formatValue(0.01234, format)
    expect(result.text).toBe('12.34‰')
  })

  it('应该格式化人民币类型', () => {
    const format: CellFormat = { type: 'currencyCNY' }
    const result = formatValue(1234.56, format)
    expect(result.text).toBe('¥1,234.56')
  })

  it('应该格式化美元类型', () => {
    const format: CellFormat = { type: 'currencyUSD' }
    const result = formatValue(1234.56, format)
    expect(result.text).toBe('$1,234.56')
  })

  it('应该格式化千分位类型', () => {
    const format: CellFormat = { type: 'thousands' }
    const result = formatValue(1234567.89, format)
    expect(result.text).toBe('1,234,567.89')
  })

  it('应该格式化科学计数法类型', () => {
    const format: CellFormat = { type: 'scientific' }
    const result = formatValue(12345678, format)
    expect(result.text).toBe('1.23E+7')
  })

  it('应该格式化分数类型', () => {
    const format: CellFormat = { type: 'fraction' }
    const result = formatValue(0.5, format)
    expect(result.text).toBe('1/2')
  })

  it('应该格式化负数红色类型', () => {
    const format: CellFormat = { type: 'negativeRed' }
    const negResult = formatValue(-1234.56, format)
    expect(negResult.isNegative).toBe(true)
    
    const posResult = formatValue(1234.56, format)
    expect(posResult.isNegative).toBe(false)
  })

  it('应该验证身份证', () => {
    const format: CellFormat = { type: 'idCard' }
    
    // 有效身份证：110101199003074514
    const valid = formatValue('110101199003074514', format)
    expect(valid.valid).toBe(true)
    expect(valid.text).toBe('110101199003074514')
    
    // 无效身份证
    const invalid = formatValue('12345678901234567X', format)
    expect(invalid.valid).toBe(false)
  })

  it('应该验证邮箱', () => {
    const format: CellFormat = { type: 'email' }
    
    const valid = formatValue('test@example.com', format)
    expect(valid.valid).toBe(true)
    
    const invalid = formatValue('invalid-email', format)
    expect(invalid.valid).toBe(false)
  })

  it('应该验证手机号码', () => {
    const format: CellFormat = { type: 'phone' }
    
    const valid = formatValue('13812345678', format)
    expect(valid.valid).toBe(true)
    
    const invalid = formatValue('12345678901', format)
    expect(invalid.valid).toBe(false)
  })

  it('应该格式化固定电话', () => {
    const format: CellFormat = { type: 'telephone' }
    
    const result = formatValue('01012345678', format)
    expect(result.text).toBe('010-12345678')
  })

  it('应该格式化超链接', () => {
    const format: CellFormat = { type: 'hyperlink' }
    
    // 带协议的链接
    const result1 = formatValue('https://example.com', format)
    expect(result1.isHyperlink).toBe(true)
    expect(result1.href).toBe('https://example.com')
    
    // 不带协议的链接
    const result2 = formatValue('example.com', format)
    expect(result2.isHyperlink).toBe(true)
    expect(result2.href).toBe('https://example.com')
  })

  it('应该格式化日期', () => {
    const format: CellFormat = { type: 'date-ymd-pad' }
    
    const result = formatValue(new Date(2024, 0, 15), format)
    expect(result.text).toBe('2024-01-15')
  })

  it('应该使用自定义格式', () => {
    const format: CellFormat = { type: 'custom', pattern: '#,##0.00' }
    
    const result = formatValue(1234567.89, format)
    expect(result.text).toBe('1,234,567.89')
  })

  it('自定义格式无 pattern 时返回原始值', () => {
    const format: CellFormat = { type: 'custom' }
    const result = formatValue('test', format)
    expect(result.text).toBe('test')
  })

  it('自定义格式非数字时返回原始值', () => {
    const format: CellFormat = { type: 'custom', pattern: '#,##0.00' }
    const result = formatValue('abc', format)
    expect(result.text).toBe('abc')
  })

  it('应该处理空值', () => {
    const result = formatValue('', { type: 'number' })
    expect(result.text).toBe('')
  })

  it('应该处理 null 和 undefined', () => {
    const nullResult = formatValue(null, { type: 'number' })
    expect(nullResult.text).toBe('')
    
    const undefinedResult = formatValue(undefined, { type: 'number' })
    expect(undefinedResult.text).toBe('')
  })

  it('应该处理非数字字符串的数字格式', () => {
    const format: CellFormat = { type: 'number' }
    const result = formatValue('abc', format)
    expect(result.text).toBe('abc')
  })

  it('应该处理非数字字符串的百分比格式', () => {
    const format: CellFormat = { type: 'percent' }
    const result = formatValue('abc', format)
    expect(result.text).toBe('abc')
  })

  it('应该处理非数字字符串的货币格式', () => {
    const format: CellFormat = { type: 'currencyCNY' }
    const result = formatValue('abc', format)
    expect(result.text).toBe('abc')
  })

  it('应该处理无效日期值', () => {
    const format: CellFormat = { type: 'date-ymd' }
    const result = formatValue('invalid-date', format)
    expect(result.text).toBe('invalid-date')
  })

  it('Excel 序列号格式化日期时应返回 rawValue', () => {
    // 45658 = 2025/1/1
    const dateFormat: CellFormat = { type: 'date-ymd-slash' }
    const dateResult = formatValue(45658, dateFormat)
    expect(dateResult.text).toBe('2025/1/1')
    expect(dateResult.rawValue).toBe('2025/1/1')
    
    // 字符串形式的序列号也应该工作
    const strResult = formatValue('45658', dateFormat)
    expect(strResult.text).toBe('2025/1/1')
    expect(strResult.rawValue).toBe('2025/1/1')
  })

  it('Excel 序列号格式化日期时间时应返回带时间的 rawValue', () => {
    // 122 = 1900/5/1 (Excel 序列号)
    const datetimeFormat: CellFormat = { type: 'datetime' }
    const result = formatValue(122, datetimeFormat)
    expect(result.rawValue).toBe('1900/5/1  00:00:00')
  })

  it('日期字符串格式化时不应返回 rawValue', () => {
    const format: CellFormat = { type: 'date-ymd-slash' }
    const result = formatValue('2025-01-01', format)
    expect(result.text).toBe('2025/1/1')
    expect(result.rawValue).toBeUndefined()
  })

  it('应该处理默认格式类型', () => {
    const result = formatValue('test', { type: 'unknown' as any })
    expect(result.text).toBe('test')
  })
})
