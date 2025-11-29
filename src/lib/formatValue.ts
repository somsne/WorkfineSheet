/**
 * 单元格值格式化引擎
 * 支持文本、数值、日期时间、自定义格式
 */

import type { CellFormat, CellFormatType } from '../components/sheet/types'

// ==================== 文本格式化 ====================

/**
 * 验证中国大陆身份证号码（18位）
 * @param value 身份证号码
 * @returns 是否有效
 */
export function validateIdCard(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  
  // 去除空格
  const id = value.trim()
  
  // 18位身份证正则
  const reg = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/
  if (!reg.test(id)) return false
  
  // 校验码验证
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id[i]!, 10) * weights[i]!
  }
  
  const checkCode = checkCodes[sum % 11]
  return id[17]!.toUpperCase() === checkCode
}

/**
 * 验证中国大陆手机号码
 * 支持格式：13812345678, +8613812345678, 86-13812345678
 * @param value 手机号码
 * @returns 是否有效
 */
export function validatePhone(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  
  // 去除空格、横杠
  let phone = value.trim().replace(/[\s-]/g, '')
  
  // 处理 +86 或 86 前缀
  if (phone.startsWith('+86')) {
    phone = phone.substring(3)
  } else if (phone.startsWith('86') && phone.length === 13) {
    phone = phone.substring(2)
  }
  
  // 中国大陆手机号：1开头，第二位3-9，共11位
  const reg = /^1[3-9]\d{9}$/
  return reg.test(phone)
}

/**
 * 格式化中国电话号码
 * 输入：02512345678 或 025-12345678 或 12345678
 * 输出：025-12345678 或 12345678（无区号）
 * @param value 电话号码
 * @returns 格式化后的电话号码
 */
export function formatTelephone(value: string): string {
  if (!value || typeof value !== 'string') return value
  
  // 去除所有非数字字符
  const digits = value.replace(/\D/g, '')
  
  if (digits.length === 0) return value
  
  // 中国区号规则：
  // - 北京010、上海021、天津022、重庆023 为3位
  // - 其他地区 0xxx 为4位
  const threeDigitAreaCodes = ['010', '020', '021', '022', '023', '024', '025', '027', '028', '029']
  
  // 尝试匹配区号
  let areaCode = ''
  let phoneNumber = digits
  
  if (digits.startsWith('0')) {
    // 检查3位区号
    const potentialThreeDigit = digits.substring(0, 3)
    if (threeDigitAreaCodes.includes(potentialThreeDigit) && digits.length >= 11) {
      areaCode = potentialThreeDigit
      phoneNumber = digits.substring(3)
    } 
    // 检查4位区号
    else if (digits.length >= 11) {
      areaCode = digits.substring(0, 4)
      phoneNumber = digits.substring(4)
    }
  }
  
  // 返回格式化结果
  if (areaCode) {
    return `${areaCode}-${phoneNumber}`
  }
  
  return digits
}

/**
 * 验证邮箱格式
 * @param value 邮箱地址
 * @returns 是否有效
 */
export function validateEmail(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  
  const reg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return reg.test(value.trim())
}

// ==================== 数值格式化 ====================

/**
 * 格式化数字为指定小数位
 * @param value 数值
 * @param decimalPlaces 小数位数
 * @returns 格式化后的字符串
 */
export function formatDecimal(value: number, decimalPlaces: number): string {
  if (!isFinite(value)) return String(value)
  return value.toFixed(decimalPlaces)
}

/**
 * 格式化数字为千分位
 * @param value 数值
 * @param decimalPlaces 小数位数
 * @returns 格式化后的字符串（如 1,234.56）
 */
export function formatThousands(value: number, decimalPlaces: number = 2): string {
  if (!isFinite(value)) return String(value)
  
  const parts = value.toFixed(decimalPlaces).split('.')
  parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

/**
 * 格式化百分比
 * @param value 数值（0.1234 表示 12.34%）
 * @param decimalPlaces 小数位数
 * @returns 格式化后的字符串（如 12.34%）
 */
export function formatPercent(value: number, decimalPlaces: number = 2): string {
  if (!isFinite(value)) return String(value)
  return (value * 100).toFixed(decimalPlaces) + '%'
}

/**
 * 格式化千分比
 * @param value 数值
 * @param decimalPlaces 小数位数
 * @returns 格式化后的字符串（如 12.34‰）
 */
export function formatPermille(value: number, decimalPlaces: number = 2): string {
  if (!isFinite(value)) return String(value)
  return (value * 1000).toFixed(decimalPlaces) + '‰'
}

/**
 * 格式化货币
 * @param value 数值
 * @param symbol 货币符号（默认 ¥）
 * @param decimalPlaces 小数位数
 * @returns 格式化后的字符串（如 ¥1,234.56）
 */
export function formatCurrency(value: number, symbol: string = '¥', decimalPlaces: number = 2): string {
  if (!isFinite(value)) return String(value)
  
  const absValue = Math.abs(value)
  const formatted = formatThousands(absValue, decimalPlaces)
  
  if (value < 0) {
    return `-${symbol}${formatted}`
  }
  return `${symbol}${formatted}`
}

/**
 * 格式化科学计数法
 * @param value 数值
 * @param decimalPlaces 小数位数
 * @returns 格式化后的字符串（如 1.23E+03）
 */
export function formatScientific(value: number, decimalPlaces: number = 2): string {
  if (!isFinite(value)) return String(value)
  return value.toExponential(decimalPlaces).toUpperCase()
}

/**
 * 将小数转换为分数（近似）
 * @param value 数值
 * @returns 分数字符串（如 1/2, 3/4）
 */
export function formatFraction(value: number): string {
  if (!isFinite(value)) return String(value)
  if (Number.isInteger(value)) return String(value)
  
  // 提取整数部分
  const intPart = Math.floor(Math.abs(value))
  const decPart = Math.abs(value) - intPart
  
  // 常见分数分母
  const denominators = [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 100]
  
  let bestNum = 0
  let bestDen = 1
  let bestError = Math.abs(decPart)
  
  for (const den of denominators) {
    const num = Math.round(decPart * den)
    const error = Math.abs(decPart - num / den)
    if (error < bestError) {
      bestError = error
      bestNum = num
      bestDen = den
    }
  }
  
  // 约分
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(bestNum, bestDen)
  bestNum /= divisor
  bestDen /= divisor
  
  const sign = value < 0 ? '-' : ''
  
  if (bestNum === 0) {
    return intPart === 0 ? '0' : `${sign}${intPart}`
  }
  
  if (intPart === 0) {
    return `${sign}${bestNum}/${bestDen}`
  }
  
  return `${sign}${intPart} ${bestNum}/${bestDen}`
}

// ==================== 日期时间格式化 ====================

/**
 * Excel 日期序列号转换为 JavaScript Date
 * 
 * Excel 日期系统说明：
 * - 序列号 0 = 1900-01-00 = 1899-12-31
 * - 序列号 1 = 1900-01-01
 * - Excel 有一个著名的 bug：错误地认为 1900 年是闰年
 * - 序列号 60 = 1900-02-29（这个日期实际不存在）
 * - 序列号 61 = 1900-03-01
 * - 为了与 Excel 兼容，我们需要处理这个 bug
 * 
 * @param serialNumber Excel 日期序列号
 * @returns JavaScript Date 对象
 */
export function excelSerialToDate(serialNumber: number): Date | null {
  if (serialNumber <= 0) return null
  
  // 序列号 60 是 Excel 虚构的 1900-02-29，返回 1900-02-28
  if (serialNumber === 60) {
    return new Date(1900, 1, 28)
  }
  
  // 计算实际的序列号（移除 Excel bug 的影响）
  let adjustedSerial = serialNumber
  if (serialNumber > 60) {
    // 1900-03-01 之后的日期，Excel 序列号比实际多 1
    adjustedSerial = serialNumber - 1
  }
  
  // Excel epoch: 1899-12-31 = 序列号 0
  // 所以序列号 N 表示从 1899-12-31 开始的第 N 天
  const resultDate = new Date(1899, 11, 31 + adjustedSerial)
  
  return isNaN(resultDate.getTime()) ? null : resultDate
}

/**
 * JavaScript Date 转换为 Excel 日期序列号
 * 
 * Excel 日期系统：
 * - 序列号 0 = 1900-01-00 = 1899-12-31
 * - 序列号 1 = 1900-01-01
 * - 由于 Excel 的 1900 年闰年 bug，序列号 60 = 1900-02-29（不存在）
 * 
 * @param date JavaScript Date 对象
 * @returns Excel 日期序列号
 */
export function dateToExcelSerial(date: Date): number {
  if (!date || isNaN(date.getTime())) return 0
  
  // Excel epoch: 1899-12-31 = 序列号 0
  const epoch = new Date(1899, 11, 31)
  
  // 标准化到当天午夜
  const d1 = new Date(epoch.getFullYear(), epoch.getMonth(), epoch.getDate())
  const d2 = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  // 计算天数差
  let serial = Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000))
  
  // 1900-02-28 = 59，之后的日期需要 +1 来兼容 Excel bug
  // （因为 Excel 多算了一个不存在的 1900-02-29）
  if (serial > 59) {
    serial += 1
  }
  
  return serial
}

/**
 * 解析值为日期对象
 * 支持：Date对象、Excel序列号、日期字符串
 * @param value 输入值
 * @returns Date对象或null
 */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }
  
  if (typeof value === 'number') {
    // 仅支持 Excel 序列号（1-2958465，对应 1900-01-01 到 9999-12-31）
    if (value >= 1 && value <= 2958465) {
      return excelSerialToDate(value)
    }
    return null
  }
  
  if (typeof value === 'string') {
    // 首先尝试解析为数字（Excel 序列号字符串）
    const num = parseFloat(value)
    if (!isNaN(num) && /^\d+(\.\d+)?$/.test(value.trim())) {
      // 纯数字字符串，仅支持 Excel 序列号范围
      if (num >= 1 && num <= 2958465) {
        return excelSerialToDate(num)
      }
      return null
    }
    // 尝试解析日期字符串
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
  }
  
  return null
}

/**
 * 补零
 */
function pad(n: number, width: number = 2): string {
  return String(n).padStart(width, '0')
}

/**
 * 根据格式类型格式化日期
 * @param date 日期对象
 * @param formatType 格式类型
 * @returns 格式化后的字符串
 */
export function formatDate(date: Date, formatType: CellFormatType): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const h = date.getHours()
  const min = date.getMinutes()
  const s = date.getSeconds()
  
  switch (formatType) {
    // 年份
    case 'date-y':
      return `${y}`
    case 'date-y-cn':
      return `${y}年`
    
    // 年月
    case 'date-ym':
      return `${y}-${m}`
    case 'date-ym-pad':
      return `${y}-${pad(m)}`
    case 'date-ym-slash':
      return `${y}/${m}`
    case 'date-ym-slash-pad':
      return `${y}/${pad(m)}`
    case 'date-ym-cn':
      return `${y}年${m}月`
    case 'date-ym-cn-pad':
      return `${y}年${pad(m)}月`
    case 'date-m-cn':
      return `${m}月`
    
    // 年月日
    case 'date-ymd':
      return `${y}-${m}-${d}`
    case 'date-ymd-pad':
      return `${y}-${pad(m)}-${pad(d)}`
    case 'date-ymd-slash':
      return `${y}/${m}/${d}`
    case 'date-ymd-slash-pad':
      return `${y}/${pad(m)}/${pad(d)}`
    case 'date-ymd-cn':
      return `${y}年${m}月${d}日`
    case 'date-ymd-cn-pad':
      return `${y}年${pad(m)}月${pad(d)}日`
    case 'date-md':
      return `${m}-${d}`
    case 'date-md-pad':
      return `${pad(m)}-${pad(d)}`
    case 'date-md-slash':
      return `${m}/${d}`
    case 'date-md-slash-pad':
      return `${pad(m)}/${pad(d)}`
    case 'date-md-cn':
      return `${m}月${d}日`
    case 'date-md-cn-pad':
      return `${pad(m)}月${pad(d)}日`
    
    // 完整日期时间
    case 'datetime':
      return `${y}-${m}-${d} ${h}:${pad(min)}:${pad(s)}`
    case 'datetime-pad':
      return `${y}-${pad(m)}-${pad(d)} ${h}:${pad(min)}:${pad(s)}`
    case 'datetime-slash':
      return `${y}/${m}/${d} ${h}:${pad(min)}:${pad(s)}`
    case 'datetime-slash-pad':
      return `${y}/${pad(m)}/${pad(d)} ${h}:${pad(min)}:${pad(s)}`
    case 'datetime-cn':
      return `${y}年${m}月${d}日 ${h}时${pad(min)}分${pad(s)}秒`
    case 'datetime-cn-pad':
      return `${y}年${pad(m)}月${pad(d)}日 ${h}时${pad(min)}分${pad(s)}秒`
    
    // 时间
    case 'time-hm':
      return `${h}:${pad(min)}`
    case 'time-hm-cn':
      return `${h}时${pad(min)}分`
    case 'time-hms':
      return `${h}:${pad(min)}:${pad(s)}`
    case 'time-hms-cn':
      return `${h}时${pad(min)}分${pad(s)}秒`
    
    default:
      return `${y}-${pad(m)}-${pad(d)}`
  }
}

// ==================== 自定义格式化 ====================

/**
 * 解析并应用 Excel 风格的自定义格式
 * 支持基本格式：#,##0.00, 0.00%, 等
 * @param value 数值
 * @param pattern 格式字符串
 * @returns 格式化后的字符串
 */
export function formatCustom(value: number, pattern: string): string {
  if (!isFinite(value)) return String(value)
  
  // 处理多段格式（正数;负数;零;文本）
  const sections = pattern.split(';')
  let formatPattern: string
  const defaultPattern = sections[0] || '#'
  
  if (value > 0) {
    formatPattern = defaultPattern
  } else if (value < 0) {
    formatPattern = sections[1] || defaultPattern
    value = Math.abs(value)
  } else {
    formatPattern = sections[2] || defaultPattern
  }
  
  // 检测百分比
  if (formatPattern.includes('%')) {
    value *= 100
    formatPattern = formatPattern.replace('%', '')
    return applyNumberFormat(value, formatPattern) + '%'
  }
  
  // 检测千分比
  if (formatPattern.includes('‰')) {
    value *= 1000
    formatPattern = formatPattern.replace('‰', '')
    return applyNumberFormat(value, formatPattern) + '‰'
  }
  
  return applyNumberFormat(value, formatPattern)
}

/**
 * 应用数字格式
 */
function applyNumberFormat(value: number, pattern: string): string {
  // 提取前缀和后缀文本（非格式字符）
  // 格式字符包括: 0 # , . - ¥ $ €
  const formatChars = /[0#,.\-¥$€]/g
  let prefix = ''
  let suffix = ''
  let workPattern = pattern
  
  // 检测负号前缀
  if (workPattern.startsWith('-')) {
    prefix = '-'
    workPattern = workPattern.substring(1)
  }
  
  // 提取货币符号前缀
  if (workPattern.startsWith('¥')) {
    prefix += '¥'
    workPattern = workPattern.substring(1)
  } else if (workPattern.startsWith('$')) {
    prefix += '$'
    workPattern = workPattern.substring(1)
  } else if (workPattern.startsWith('€')) {
    prefix += '€'
    workPattern = workPattern.substring(1)
  }
  
  // 提取后缀（格式字符后的所有文本）
  const lastFormatCharIndex = Math.max(
    workPattern.lastIndexOf('0'),
    workPattern.lastIndexOf('#'),
    workPattern.lastIndexOf('.')
  )
  if (lastFormatCharIndex >= 0 && lastFormatCharIndex < workPattern.length - 1) {
    suffix = workPattern.substring(lastFormatCharIndex + 1).replace(formatChars, '').trim()
  }
  
  // 计算小数位数
  let decimalPlaces = 0
  const decimalMatch = workPattern.match(/\.([0#]+)/)
  if (decimalMatch && decimalMatch[1]) {
    decimalPlaces = decimalMatch[1].length
  }
  
  // 检测是否需要千分位
  const useThousands = workPattern.includes(',')
  
  // 格式化数字
  let result = value.toFixed(decimalPlaces)
  
  if (useThousands) {
    const parts = result.split('.')
    parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    result = parts.join('.')
  }
  
  // 组合结果
  return prefix + result + (suffix ? ' ' + suffix : '')
}

// ==================== 统一入口 ====================

/**
 * 格式化结果接口
 */
export interface FormatResult {
  /** 格式化后的显示文本 */
  text: string
  /** 转换后的原始值（如 Excel 序列号转换为标准日期字符串） */
  rawValue?: string
  /** 是否验证通过（对于需要验证的格式） */
  valid?: boolean
  /** 是否为负数（用于负数红色显示） */
  isNegative?: boolean
  /** 是否为超链接 */
  isHyperlink?: boolean
  /** 超链接地址 */
  href?: string
}

/**
 * 格式化单元格值
 * @param value 原始值
 * @param format 格式配置
 * @returns 格式化结果
 */
export function formatValue(value: unknown, format: CellFormat): FormatResult {
  // 空值处理
  if (value === null || value === undefined || value === '') {
    return { text: '' }
  }
  
  const stringValue = String(value)
  const { type, pattern, decimalPlaces } = format
  
  switch (type) {
    // ========== 文本类 ==========
    case 'general':
      return { text: stringValue }
    
    case 'text':
      return { text: stringValue }
    
    case 'idCard': {
      const valid = validateIdCard(stringValue)
      return { text: stringValue, valid }
    }
    
    case 'email': {
      const valid = validateEmail(stringValue)
      return { text: stringValue, valid }
    }
    
    case 'phone': {
      const valid = validatePhone(stringValue)
      return { text: stringValue, valid }
    }
    
    case 'telephone': {
      const formatted = formatTelephone(stringValue)
      return { text: formatted }
    }
    
    case 'hyperlink': {
      let href = stringValue
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        href = 'https://' + href
      }
      return { text: stringValue, isHyperlink: true, href }
    }
    
    // ========== 数值类 ==========
    case 'number': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      return { text: Math.round(num).toString(), isNegative: num < 0 }
    }
    
    case 'decimal2': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { text: formatDecimal(num, places), isNegative: num < 0 }
    }
    
    case 'percent': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { text: formatPercent(num, places), isNegative: num < 0 }
    }
    
    case 'permille': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { text: formatPermille(num, places), isNegative: num < 0 }
    }
    
    case 'currencyCNY': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { text: formatCurrency(num, '¥', places), isNegative: num < 0 }
    }
    
    case 'currencyUSD': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { text: formatCurrency(num, '$', places), isNegative: num < 0 }
    }
    
    case 'thousands': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { text: formatThousands(num, places), isNegative: num < 0 }
    }
    
    case 'scientific': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { text: formatScientific(num, places), isNegative: num < 0 }
    }
    
    case 'fraction': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      return { text: formatFraction(num), isNegative: num < 0 }
    }
    
    case 'negativeRed': {
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      const places = decimalPlaces ?? 2
      return { 
        text: formatThousands(num, places), 
        isNegative: num < 0 
      }
    }
    
    // ========== 日期时间类 ==========
    case 'date-y':
    case 'date-y-cn':
    case 'date-ym':
    case 'date-ym-pad':
    case 'date-ym-slash':
    case 'date-ym-slash-pad':
    case 'date-ym-cn':
    case 'date-ym-cn-pad':
    case 'date-m-cn':
    case 'date-ymd':
    case 'date-ymd-pad':
    case 'date-ymd-slash':
    case 'date-ymd-slash-pad':
    case 'date-ymd-cn':
    case 'date-ymd-cn-pad':
    case 'date-md':
    case 'date-md-pad':
    case 'date-md-slash':
    case 'date-md-slash-pad':
    case 'date-md-cn':
    case 'date-md-cn-pad':
    case 'datetime':
    case 'datetime-pad':
    case 'datetime-slash':
    case 'datetime-slash-pad':
    case 'datetime-cn':
    case 'datetime-cn-pad':
    case 'time-hm':
    case 'time-hm-cn':
    case 'time-hms':
    case 'time-hms-cn': {
      const date = parseDate(value)
      if (!date) return { text: stringValue }
      
      // 检查输入是否为 Excel 序列号（数值或纯数字字符串）
      // 排除日期字符串如 "2025-01-01"、"2025/1/1" 等
      const isNumericInput = typeof value === 'number' || 
        (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()))
      const numValue = typeof value === 'number' ? value : parseFloat(stringValue)
      const isExcelSerial = isNumericInput && !isNaN(numValue) && numValue >= 1 && numValue <= 2958465
      
      if (isExcelSerial) {
        // Excel 行为：将序列号转换为标准日期格式字符串作为 rawValue
        const y = date.getFullYear()
        const m = date.getMonth() + 1
        const d = date.getDate()
        const h = date.getHours()
        const min = date.getMinutes()
        const s = date.getSeconds()
        
        // 带时间的格式用 "yyyy/m/d hh:mm:ss"，纯日期格式用 "yyyy/m/d"
        const isTimeFormat = type.startsWith('time-') || type.startsWith('datetime')
        const rawValue = isTimeFormat
          ? `${y}/${m}/${d}  ${pad(h)}:${pad(min)}:${pad(s)}`
          : `${y}/${m}/${d}`
        
        return { text: formatDate(date, type), rawValue }
      }
      
      return { text: formatDate(date, type) }
    }
    
    // ========== 自定义 ==========
    case 'custom': {
      if (!pattern) return { text: stringValue }
      const num = parseFloat(stringValue)
      if (isNaN(num)) return { text: stringValue }
      return { text: formatCustom(num, pattern), isNegative: num < 0 }
    }
    
    default:
      return { text: stringValue }
  }
}
