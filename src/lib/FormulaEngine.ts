/**
 * Excel 公式引擎
 * 使用 hot-formula-parser 库支持 Excel 公式
 */

import { Parser } from 'hot-formula-parser'

export interface CellReference {
  row: number
  col: number
  isAbsolute: boolean
  isRowAbsolute: boolean
  isColAbsolute: boolean
}

export interface RangeReference {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export class FormulaEngine {
  private parser: Parser
  private getCellValue: (row: number, col: number) => any

  constructor(getCellValueFn: (row: number, col: number) => any) {
    this.parser = new Parser()
    this.getCellValue = getCellValueFn
    this.setupFunctions()
  }

  /**
   * 检查字符串是否为公式
   */
  isFormula(value: string): boolean {
    return typeof value === 'string' && value.startsWith('=')
  }

  /**
   * 计算公式
   */
  evaluate(formula: string): {
    result: any
    error: string | null
  } {
    if (!this.isFormula(formula)) {
      return { result: formula, error: null }
    }

    try {
      // 移除前面的 =
      let expression = formula.substring(1)

      // 替换所有单元格引用为它们的实际值
      expression = this.replaceReferencesWithValues(expression)

      // 解析并计算公式
      const parseResult = this.parser.parse(expression)

      if (parseResult.error) {
        return { result: null, error: parseResult.error }
      }

      return { result: parseResult.result, error: null }
    } catch (err) {
      console.error('[FormulaEngine] 异常:', err)
      return { result: null, error: '#ERROR!' }
    }
  }

  /**
   * 提取公式中的单元格引用（用于依赖追踪）
   */
  extractCellReferences(formula: string): CellReference[] {
    if (!this.isFormula(formula)) {
      return []
    }

    const expression = formula.substring(1)
    const references: CellReference[] = []
    const processedRefs = new Set<string>()

    // 匹配单元格引用：A1, $A1, A$1, $A$1, A1:B2 等（包括小写）
    const cellRegex = /\$?[A-Za-z]+\$?\d+/g
    let match

    while ((match = cellRegex.exec(expression)) !== null) {
      const refStr = match[0].toUpperCase()  // 转换为大写
      
      // 避免重复处理相同的引用
      if (processedRefs.has(refStr)) {
        continue
      }
      processedRefs.add(refStr)

      const ref = this.parseCellReference(refStr)
      if (ref) {
        references.push(ref)
      }
    }

    return references
  }

  /**
   * 解析单个单元格引用
   * 例如: A1, $A1, A$1, $A$1
   * 输入应该是大写的
   */
  private parseCellReference(ref: string): CellReference | null {
    // 引用应该已经是大写，所以使用严格的正则表达式
    const match = /^(\$)?([A-Z]+)(\$)?(\d+)$/.exec(ref)
    if (!match) return null

    const [, colAbsMarker, colLetters, rowAbsMarker, rowStr] = match as RegExpExecArray & [string, string | undefined, string, string | undefined, string]
    const col = this.colLettersToNumber(colLetters)
    const row = parseInt(rowStr, 10) - 1

    return {
      row,
      col,
      isAbsolute: !!colAbsMarker && !!rowAbsMarker,
      isRowAbsolute: !!rowAbsMarker,
      isColAbsolute: !!colAbsMarker
    }
  }

  /**
   * 列字母转数字：A=0, B=1, ..., Z=25, AA=26
   */
  private colLettersToNumber(letters: string): number {
    let num = 0
    for (let i = 0; i < letters.length; i++) {
      num = num * 26 + (letters.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
    }
    return num - 1
  }

  /**
   * 数字转列字母：0=A, 1=B, ..., 25=Z, 26=AA
   */
  private numberToColLetters(num: number): string {
    let letters = ''
    num += 1
    while (num > 0) {
      const remainder = (num - 1) % 26
      letters = String.fromCharCode('A'.charCodeAt(0) + remainder) + letters
      num = Math.floor((num - 1) / 26)
    }
    return letters
  }

  /**
   * 解析范围引用 (如 A1:B3)
   */
  private parseRangeReference(rangeStr: string): RangeReference | null {
    const parts = rangeStr.split(':')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    
    const startRef = this.parseCellReference(parts[0].toUpperCase())
    const endRef = this.parseCellReference(parts[1].toUpperCase())
    
    if (!startRef || !endRef) return null
    
    return {
      startRow: Math.min(startRef.row, endRef.row),
      startCol: Math.min(startRef.col, endRef.col),
      endRow: Math.max(startRef.row, endRef.row),
      endCol: Math.max(startRef.col, endRef.col)
    }
  }

  /**
   * 展开范围引用为值数组
   * 例如: B2:D3 展开为 [[B2, C2, D2], [B3, C3, D3]]
   */
  private expandRange(rangeStr: string): number[][] {
    const range = this.parseRangeReference(rangeStr)
    if (!range) return []
    
    const values: number[][] = []
    for (let r = range.startRow; r <= range.endRow; r++) {
      const row: number[] = []
      for (let c = range.startCol; c <= range.endCol; c++) {
        const cellValue = this.getCellValue(r, c)
        const normalizedValue = this.normalizeValue(cellValue)
        // 收集数值，字符串类型的数值也要转换
        if (typeof normalizedValue === 'number') {
          row.push(normalizedValue)
        } else if (typeof normalizedValue === 'string') {
          // 尝试将字符串转为数值，如果失败则使用 0
          const numValue = parseFloat(normalizedValue)
          row.push(isNaN(numValue) ? 0 : numValue)
        } else {
          // 其他类型（如 null）使用 0
          row.push(0)
        }
      }
      values.push(row)
    }
    return values
  }

  /**
   * 将表达式中的单元格引用替换为其实际值
   * hot-formula-parser 不支持包含数字的变量名（如 B2），
   * 所以我们需要直接替换为数值或用括号包装
   * 
   * 注意：getCellValue 回调会自动递归计算公式，
   * 所以我们这里获取的已经是计算后的值
   */
  private replaceReferencesWithValues(expression: string): string {
    // 首先处理范围引用 (A1:B2, $A$1:$B$2, etc.)
    expression = expression.replace(/(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/gi, (match) => {
      const rangeStr = match.toUpperCase()
      const range = this.parseRangeReference(rangeStr)
      if (!range) return match
      
      // 检查是否在函数调用中（如 SUM(A1:B2)）
      // 如果是，hot-formula-parser 会自动处理范围
      // 我们需要将范围展开为逗号分隔的值
      const values = this.expandRange(rangeStr)
      if (values.length === 0) return '0'
      
      // 将二维数组展开为一维数组
      const flatValues = values.flat()
      return flatValues.join(',')
    })
    
    // 然后处理单个单元格引用：A1, $A1, A$1, $A$1 等
    const cellRegex = /(\$)?([A-Za-z]+)(\$)?(\d+)/g
    
    return expression.replace(cellRegex, (match) => {
      const refStr = match.toUpperCase()
      
      const ref = this.parseCellReference(refStr)
      if (!ref) {
        return match // 无法解析则保持原样
      }

      // 获取单元格值
      // getCellValue 是由调用者传递的回调函数，可能返回：
      // 1. 普通值（数字、字符串）
      // 2. 计算后的公式结果
      // 3. 错误信息（如 #VALUE!, #DIV/0! 等）
      const cellValue = this.getCellValue(ref.row, ref.col)
      const normalizedValue = this.normalizeValue(cellValue)

      // 如果是字符串，用双引号包装；如果是数字，直接返回
      if (typeof normalizedValue === 'string') {
        // 如果是错误信息，直接返回（会导致公式计算失败）
        if (normalizedValue.startsWith('#')) {
          return normalizedValue
        }
        return `"${normalizedValue}"`
      } else if (normalizedValue === 0 && cellValue === '') {
        // 空单元格返回 0
        return '0'
      } else {
        return String(normalizedValue)
      }
    })
  }

  /**
   * 标准化单元格值
   * 公式计算需要正确的数据类型
   */
  private normalizeValue(value: any): any {
    // 如果是 null、undefined 或空字符串，返回 0
    if (value === null || value === undefined || value === '') {
      return 0
    }

    // 如果值本身是公式，不应该出现在这里，因为 getCellValue 应该返回计算后的值
    // 但如果确实出现了，说明是一个循环引用或其他问题
    if (typeof value === 'string' && value.startsWith('=')) {
      console.warn('[FormulaEngine] normalizeValue 收到公式值（应该已被计算）:', value)
      // 不返回 0，让上层处理这个错误
      return value
    }

    // 如果是字符串，尝试转换为数字
    if (typeof value === 'string') {
      // 移除前后空格
      const trimmed = value.trim()
      
      // 如果是纯数字字符串，转为数字
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed)
      }
      
      // 如果无法转换为数字，保持字符串原样
      return trimmed
    }

    // 如果已经是数字，直接返回
    if (typeof value === 'number') {
      return value
    }

    // 其他类型保持原样
    return value
  }

  /**
   * 设置自定义函数
   */
  private setupFunctions(): void {
    // 所有默认函数已由 hot-formula-parser 提供
    // 可以在这里添加自定义函数
  }

  /**
   * 获取单元格地址 (A1 格式)
   */
  getCellAddress(row: number, col: number, absolute: boolean = false): string {
    const colLetter = this.numberToColLetters(col)
    const rowNum = row + 1

    if (absolute) {
      return `$${colLetter}$${rowNum}`
    }
    return `${colLetter}${rowNum}`
  }

  /**
   * 生成单元格范围字符串
   */
  getRangeString(startRow: number, startCol: number, endRow: number, endCol: number, absolute: boolean = false): string {
    const start = this.getCellAddress(startRow, startCol, absolute)
    const end = this.getCellAddress(endRow, endCol, absolute)
    return `${start}:${end}`
  }

  /**
   * 调整公式中的引用（用于插入/删除行列）
   * @param formula 原始公式
   * @param operation 操作类型：'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol'
   * @param index 插入/删除的行号或列号
   * @param count 插入/删除的数量（默认为1）
   * @returns 调整后的公式
   */
  adjustFormulaReferences(
    formula: string,
    operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
    index: number,
    count: number = 1
  ): string {
    if (!this.isFormula(formula)) {
      return formula
    }

    const expression = formula.substring(1) // 移除 '='
    let adjustedExpression = expression

    // 匹配所有单元格引用：A1, $A1, A$1, $A$1, A1:B2 等
    const cellRegex = /(\$?)([A-Za-z]+)(\$?)(\d+)/g
    const replacements: Array<{ original: string; adjusted: string; index: number }> = []

    let match
    while ((match = cellRegex.exec(expression)) !== null) {
      const fullMatch = match[0]
      const colAbsMarker = match[1] || ''
      const colLetters = (match[2] || '').toUpperCase()
      const rowAbsMarker = match[3] || ''
      const rowStr = match[4] || '0'
      
      if (!colLetters || !rowStr) continue

      const col = this.colLettersToNumber(colLetters)
      const row = parseInt(rowStr, 10) - 1
      const isColAbsolute = !!colAbsMarker
      const isRowAbsolute = !!rowAbsMarker

      let newRow = row
      let newCol = col
      let shouldAdjust = false

      // 根据操作类型调整引用
      switch (operation) {
        case 'insertRow':
          // 相对引用：如果引用的行 >= 插入位置，行号增加
          if (!isRowAbsolute && row >= index) {
            newRow = row + count
            shouldAdjust = true
          }
          break

        case 'deleteRow':
          // 相对引用：如果引用的行 > 删除位置，行号减少
          if (!isRowAbsolute) {
            if (row === index) {
              // 引用的行被删除，标记为 #REF!
              replacements.push({
                original: fullMatch,
                adjusted: '#REF!',
                index: match.index
              })
              continue
            } else if (row > index) {
              newRow = row - count
              shouldAdjust = true
            }
          }
          break

        case 'insertCol':
          // 相对引用：如果引用的列 >= 插入位置，列号增加
          if (!isColAbsolute && col >= index) {
            newCol = col + count
            shouldAdjust = true
          }
          break

        case 'deleteCol':
          // 相对引用：如果引用的列 > 删除位置，列号减少
          if (!isColAbsolute) {
            if (col === index) {
              // 引用的列被删除，标记为 #REF!
              replacements.push({
                original: fullMatch,
                adjusted: '#REF!',
                index: match.index
              })
              continue
            } else if (col > index) {
              newCol = col - count
              shouldAdjust = true
            }
          }
          break
      }

      if (shouldAdjust) {
        const newColLetter = this.numberToColLetters(newCol)
        const newRowNum = newRow + 1
        const adjustedRef = `${colAbsMarker}${newColLetter}${rowAbsMarker}${newRowNum}`
        replacements.push({
          original: fullMatch,
          adjusted: adjustedRef,
          index: match.index
        })
      }
    }

    // 从后往前替换，避免索引错位
    replacements.sort((a, b) => b.index - a.index)
    for (const { original, adjusted, index } of replacements) {
      adjustedExpression =
        adjustedExpression.substring(0, index) +
        adjusted +
        adjustedExpression.substring(index + original.length)
    }

    return '=' + adjustedExpression
  }

  /**
   * 清空缓存
   */
  clear(): void {
    // 清空所有设置的变量
    this.parser = new Parser()
    this.setupFunctions()
  }
}

// 导出 Parser 类供高级用途
export { Parser }
