/**
 * RangeAPI - 范围（Range）API 包装
 * 
 * 提供对单元格范围的便捷操作 API
 * Range 是对一组连续单元格的抽象，支持批量读写值、样式、边框、格式等
 */

import { SheetModel } from '../lib/SheetModel'
import type { 
  CellStyle, 
  CellBorder, 
  BorderEdge, 
  CellFormat,
  MergedRegion
} from '../components/sheet/types'

/**
 * 范围坐标
 */
export interface RangeCoords {
  /** 起始行（0-based） */
  startRow: number
  /** 起始列（0-based） */
  startCol: number
  /** 结束行（0-based） */
  endRow: number
  /** 结束列（0-based） */
  endCol: number
}

/**
 * 范围 API 接口
 * 
 * 用于操作单元格范围，支持：
 * - 范围值的批量读写
 * - 范围样式设置
 * - 范围边框设置
 * - 范围格式设置
 * - 合并/取消合并
 */
export interface IRangeAPI {
  // ==================== 范围信息 ====================

  /**
   * 获取范围坐标
   */
  getCoords(): RangeCoords

  /**
   * 获取范围的行数
   */
  getRowCount(): number

  /**
   * 获取范围的列数
   */
  getColCount(): number

  /**
   * 获取范围的单元格数量
   */
  getCellCount(): number

  /**
   * 获取范围的 A1 表示法
   * @example "A1:C3", "B2:D5"
   */
  getA1Notation(): string

  /**
   * 检查指定单元格是否在范围内
   * @param row 行号
   * @param col 列号
   */
  contains(row: number, col: number): boolean

  /**
   * 检查两个范围是否相交
   * @param other 另一个范围
   */
  intersects(other: RangeCoords): boolean

  // ==================== 值操作 ====================

  /**
   * 获取范围内所有值（二维数组）
   * @returns 值的二维数组
   * @example
   * ```ts
   * const values = range.getValues()
   * // [['A1', 'B1', 'C1'], ['A2', 'B2', 'C2']]
   * ```
   */
  getValues(): string[][]

  /**
   * 设置范围内所有值
   * @param values 值的二维数组
   * @example
   * ```ts
   * range.setValues([
   *   ['Name', 'Age', 'City'],
   *   ['Alice', '25', 'Beijing']
   * ])
   * ```
   */
  setValues(values: string[][]): void

  /**
   * 获取范围左上角单元格的值
   */
  getValue(): string

  /**
   * 设置范围内所有单元格为同一个值
   * @param value 值
   */
  setValue(value: string): void

  /**
   * 清除范围内所有值
   */
  clearValues(): void

  /**
   * 遍历范围内所有单元格
   * @param fn 回调函数
   */
  forEach(fn: (row: number, col: number, value: string) => void): void

  /**
   * 对范围内所有值进行映射
   * @param fn 映射函数
   * @returns 映射后的二维数组
   */
  map<T>(fn: (row: number, col: number, value: string) => T): T[][]

  // ==================== 样式操作 ====================

  /**
   * 设置范围样式
   * @param style 样式对象
   * @example
   * ```ts
   * range.setStyle({
   *   bold: true,
   *   backgroundColor: '#ffff00'
   * })
   * ```
   */
  setStyle(style: Partial<CellStyle>): void

  /**
   * 获取范围内所有样式（二维数组）
   */
  getStyles(): CellStyle[][]

  /**
   * 清除范围内所有样式
   */
  clearStyles(): void

  // ==================== 快捷样式方法 ====================

  /**
   * 设置粗体
   * @param bold 是否粗体
   */
  setBold(bold: boolean): void

  /**
   * 设置斜体
   * @param italic 是否斜体
   */
  setItalic(italic: boolean): void

  /**
   * 设置下划线
   * @param underline 下划线类型
   */
  setUnderline(underline: boolean | 'single' | 'double'): void

  /**
   * 设置删除线
   * @param strikethrough 是否删除线
   */
  setStrikethrough(strikethrough: boolean): void

  /**
   * 设置字体
   * @param fontFamily 字体名称
   */
  setFontFamily(fontFamily: string): void

  /**
   * 设置字号
   * @param fontSize 字号（像素）
   */
  setFontSize(fontSize: number): void

  /**
   * 设置字体颜色
   * @param color 颜色值
   */
  setTextColor(color: string): void

  /**
   * 设置背景色
   * @param color 颜色值
   */
  setBackgroundColor(color: string): void

  /**
   * 设置水平对齐
   * @param align 对齐方式
   */
  setTextAlign(align: 'left' | 'center' | 'right'): void

  /**
   * 设置垂直对齐
   * @param align 对齐方式
   */
  setVerticalAlign(align: 'top' | 'middle' | 'bottom'): void

  /**
   * 设置自动换行
   * @param wrap 是否换行
   */
  setWrapText(wrap: boolean): void

  // ==================== 边框操作 ====================

  /**
   * 设置范围内所有单元格的全边框
   * @param edge 边框样式
   * @example
   * ```ts
   * range.setAllBorders({ style: 'thin', color: '#000000' })
   * ```
   */
  setAllBorders(edge: BorderEdge): void

  /**
   * 设置范围的外边框（只设置最外层四边）
   * @param edge 边框样式
   */
  setOuterBorder(edge: BorderEdge): void

  /**
   * 设置范围的上边框
   * @param edge 边框样式
   */
  setTopBorder(edge: BorderEdge): void

  /**
   * 设置范围的下边框
   * @param edge 边框样式
   */
  setBottomBorder(edge: BorderEdge): void

  /**
   * 设置范围的左边框
   * @param edge 边框样式
   */
  setLeftBorder(edge: BorderEdge): void

  /**
   * 设置范围的右边框
   * @param edge 边框样式
   */
  setRightBorder(edge: BorderEdge): void

  /**
   * 清除范围内所有边框
   */
  clearBorders(): void

  /**
   * 获取范围内所有边框（二维数组）
   */
  getBorders(): (CellBorder | undefined)[][]

  // ==================== 格式操作 ====================

  /**
   * 设置范围格式
   * @param format 格式对象
   * @example
   * ```ts
   * range.setFormat({ type: 'number', decimals: 2 })
   * ```
   */
  setFormat(format: CellFormat): void

  /**
   * 获取范围内所有格式（二维数组）
   */
  getFormats(): CellFormat[][]

  /**
   * 清除范围内所有格式
   */
  clearFormats(): void

  // ==================== 合并单元格 ====================

  /**
   * 合并范围内所有单元格
   * @returns 是否成功
   */
  merge(): boolean

  /**
   * 取消范围内的所有合并
   */
  unmerge(): void

  /**
   * 检查范围是否可以合并
   */
  canMerge(): boolean

  /**
   * 检查范围是否已合并
   */
  isMerged(): boolean

  /**
   * 获取范围内的所有合并区域
   */
  getMergedRegions(): MergedRegion[]

  // ==================== 复制粘贴 ====================

  /**
   * 复制范围数据到目标位置
   * @param targetRow 目标起始行
   * @param targetCol 目标起始列
   * @param options 复制选项
   */
  copyTo(targetRow: number, targetCol: number, options?: CopyOptions): void

  /**
   * 移动范围数据到目标位置
   * @param targetRow 目标起始行
   * @param targetCol 目标起始列
   */
  moveTo(targetRow: number, targetCol: number): void

  // ==================== 清除操作 ====================

  /**
   * 清除范围内所有内容（值、样式、边框、格式）
   */
  clear(): void

  /**
   * 只清除值，保留样式
   */
  clearContent(): void
}

/**
 * 复制选项
 */
export interface CopyOptions {
  /** 是否复制值 */
  values?: boolean
  /** 是否复制样式 */
  styles?: boolean
  /** 是否复制边框 */
  borders?: boolean
  /** 是否复制格式 */
  formats?: boolean
}

/**
 * 列字母转换工具
 */
function colToLetter(col: number): string {
  let result = ''
  col++
  while (col > 0) {
    col--
    result = String.fromCharCode(65 + (col % 26)) + result
    col = Math.floor(col / 26)
  }
  return result
}

/**
 * 范围 API 包装类
 * 
 * @example
 * ```ts
 * import { RangeAPI } from './api/RangeAPI'
 * import { SheetModel } from './lib/SheetModel'
 * 
 * const model = new SheetModel()
 * 
 * // 创建范围 A1:C3
 * const range = new RangeAPI(model, 0, 0, 2, 2)
 * 
 * // 设置值
 * range.setValues([
 *   ['Name', 'Age', 'City'],
 *   ['Alice', '25', 'Beijing'],
 *   ['Bob', '30', 'Shanghai']
 * ])
 * 
 * // 设置样式
 * range.setStyle({ backgroundColor: '#f0f0f0' })
 * 
 * // 设置边框
 * range.setAllBorders({ style: 'thin', color: '#000000' })
 * 
 * // 合并单元格
 * const headerRange = new RangeAPI(model, 0, 0, 0, 2)
 * headerRange.merge()
 * ```
 */
export class RangeAPI implements IRangeAPI {
  private model: SheetModel
  private startRow: number
  private startCol: number
  private endRow: number
  private endCol: number

  /**
   * 创建范围 API
   * @param model SheetModel 实例
   * @param startRow 起始行（0-based）
   * @param startCol 起始列（0-based）
   * @param endRow 结束行（0-based）
   * @param endCol 结束列（0-based）
   */
  constructor(
    model: SheetModel,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ) {
    this.model = model
    // 规范化坐标（确保 start <= end）
    this.startRow = Math.min(startRow, endRow)
    this.startCol = Math.min(startCol, endCol)
    this.endRow = Math.max(startRow, endRow)
    this.endCol = Math.max(startCol, endCol)
  }

  // ==================== 范围信息 ====================

  getCoords(): RangeCoords {
    return {
      startRow: this.startRow,
      startCol: this.startCol,
      endRow: this.endRow,
      endCol: this.endCol
    }
  }

  getRowCount(): number {
    return this.endRow - this.startRow + 1
  }

  getColCount(): number {
    return this.endCol - this.startCol + 1
  }

  getCellCount(): number {
    return this.getRowCount() * this.getColCount()
  }

  getA1Notation(): string {
    const startCell = `${colToLetter(this.startCol)}${this.startRow + 1}`
    const endCell = `${colToLetter(this.endCol)}${this.endRow + 1}`
    
    if (startCell === endCell) {
      return startCell
    }
    return `${startCell}:${endCell}`
  }

  contains(row: number, col: number): boolean {
    return row >= this.startRow && row <= this.endRow &&
           col >= this.startCol && col <= this.endCol
  }

  intersects(other: RangeCoords): boolean {
    return !(other.endRow < this.startRow || 
             other.startRow > this.endRow ||
             other.endCol < this.startCol || 
             other.startCol > this.endCol)
  }

  // ==================== 值操作 ====================

  getValues(): string[][] {
    const result: string[][] = []
    for (let r = this.startRow; r <= this.endRow; r++) {
      const row: string[] = []
      for (let c = this.startCol; c <= this.endCol; c++) {
        row.push(this.model.getValue(r, c))
      }
      result.push(row)
    }
    return result
  }

  setValues(values: string[][]): void {
    for (let i = 0; i < values.length && i < this.getRowCount(); i++) {
      const row = values[i]
      if (row) {
        for (let j = 0; j < row.length && j < this.getColCount(); j++) {
          this.model.setValue(this.startRow + i, this.startCol + j, row[j] ?? '')
        }
      }
    }
  }

  getValue(): string {
    return this.model.getValue(this.startRow, this.startCol)
  }

  setValue(value: string): void {
    for (let r = this.startRow; r <= this.endRow; r++) {
      for (let c = this.startCol; c <= this.endCol; c++) {
        this.model.setValue(r, c, value)
      }
    }
  }

  clearValues(): void {
    for (let r = this.startRow; r <= this.endRow; r++) {
      for (let c = this.startCol; c <= this.endCol; c++) {
        this.model.setValue(r, c, '')
      }
    }
  }

  forEach(fn: (row: number, col: number, value: string) => void): void {
    for (let r = this.startRow; r <= this.endRow; r++) {
      for (let c = this.startCol; c <= this.endCol; c++) {
        fn(r, c, this.model.getValue(r, c))
      }
    }
  }

  map<T>(fn: (row: number, col: number, value: string) => T): T[][] {
    const result: T[][] = []
    for (let r = this.startRow; r <= this.endRow; r++) {
      const row: T[] = []
      for (let c = this.startCol; c <= this.endCol; c++) {
        row.push(fn(r, c, this.model.getValue(r, c)))
      }
      result.push(row)
    }
    return result
  }

  // ==================== 样式操作 ====================

  setStyle(style: Partial<CellStyle>): void {
    this.model.setRangeStyle(this.startRow, this.startCol, this.endRow, this.endCol, style)
  }

  getStyles(): CellStyle[][] {
    const result: CellStyle[][] = []
    for (let r = this.startRow; r <= this.endRow; r++) {
      const row: CellStyle[] = []
      for (let c = this.startCol; c <= this.endCol; c++) {
        row.push(this.model.getCellStyle(r, c))
      }
      result.push(row)
    }
    return result
  }

  clearStyles(): void {
    for (let r = this.startRow; r <= this.endRow; r++) {
      for (let c = this.startCol; c <= this.endCol; c++) {
        this.model.clearCellStyle(r, c)
      }
    }
  }

  // ==================== 快捷样式方法 ====================

  setBold(bold: boolean): void {
    this.setStyle({ bold })
  }

  setItalic(italic: boolean): void {
    this.setStyle({ italic })
  }

  setUnderline(underline: boolean | 'single' | 'double'): void {
    this.setStyle({ underline })
  }

  setStrikethrough(strikethrough: boolean): void {
    this.setStyle({ strikethrough })
  }

  setFontFamily(fontFamily: string): void {
    this.setStyle({ fontFamily })
  }

  setFontSize(fontSize: number): void {
    this.setStyle({ fontSize })
  }

  setTextColor(color: string): void {
    this.setStyle({ color })
  }

  setBackgroundColor(color: string): void {
    this.setStyle({ backgroundColor: color })
  }

  setTextAlign(align: 'left' | 'center' | 'right'): void {
    this.setStyle({ textAlign: align })
  }

  setVerticalAlign(align: 'top' | 'middle' | 'bottom'): void {
    this.setStyle({ verticalAlign: align })
  }

  setWrapText(wrap: boolean): void {
    this.setStyle({ wrapText: wrap })
  }

  // ==================== 边框操作 ====================

  setAllBorders(edge: BorderEdge): void {
    const border: CellBorder = {
      top: edge,
      right: edge,
      bottom: edge,
      left: edge
    }
    this.model.setRangeBorder(this.startRow, this.startCol, this.endRow, this.endCol, border)
  }

  setOuterBorder(edge: BorderEdge): void {
    this.model.setRangeOuterBorder(this.startRow, this.startCol, this.endRow, this.endCol, edge)
  }

  setTopBorder(edge: BorderEdge): void {
    for (let c = this.startCol; c <= this.endCol; c++) {
      this.model.setCellBorder(this.startRow, c, { top: edge })
    }
  }

  setBottomBorder(edge: BorderEdge): void {
    for (let c = this.startCol; c <= this.endCol; c++) {
      this.model.setCellBorder(this.endRow, c, { bottom: edge })
    }
  }

  setLeftBorder(edge: BorderEdge): void {
    for (let r = this.startRow; r <= this.endRow; r++) {
      this.model.setCellBorder(r, this.startCol, { left: edge })
    }
  }

  setRightBorder(edge: BorderEdge): void {
    for (let r = this.startRow; r <= this.endRow; r++) {
      this.model.setCellBorder(r, this.endCol, { right: edge })
    }
  }

  clearBorders(): void {
    this.model.clearRangeBorder(this.startRow, this.startCol, this.endRow, this.endCol)
  }

  getBorders(): (CellBorder | undefined)[][] {
    const result: (CellBorder | undefined)[][] = []
    for (let r = this.startRow; r <= this.endRow; r++) {
      const row: (CellBorder | undefined)[] = []
      for (let c = this.startCol; c <= this.endCol; c++) {
        row.push(this.model.getCellBorder(r, c))
      }
      result.push(row)
    }
    return result
  }

  // ==================== 格式操作 ====================

  setFormat(format: CellFormat): void {
    this.model.setRangeFormat(this.startRow, this.startCol, this.endRow, this.endCol, format)
  }

  getFormats(): CellFormat[][] {
    const result: CellFormat[][] = []
    for (let r = this.startRow; r <= this.endRow; r++) {
      const row: CellFormat[] = []
      for (let c = this.startCol; c <= this.endCol; c++) {
        row.push(this.model.getCellFormat(r, c))
      }
      result.push(row)
    }
    return result
  }

  clearFormats(): void {
    for (let r = this.startRow; r <= this.endRow; r++) {
      for (let c = this.startCol; c <= this.endCol; c++) {
        this.model.clearCellFormat(r, c)
      }
    }
  }

  // ==================== 合并单元格 ====================

  merge(): boolean {
    return this.model.mergeCells(this.startRow, this.startCol, this.endRow, this.endCol)
  }

  unmerge(): void {
    // 遍历范围内所有单元格，取消所有合并
    for (let r = this.startRow; r <= this.endRow; r++) {
      for (let c = this.startCol; c <= this.endCol; c++) {
        this.model.unmergeCells(r, c)
      }
    }
  }

  canMerge(): boolean {
    return this.model.canMerge(this.startRow, this.startCol, this.endRow, this.endCol)
  }

  isMerged(): boolean {
    // 检查范围是否完全被一个合并区域覆盖
    const region = this.model.getMergedRegion(this.startRow, this.startCol)
    if (!region) return false
    
    return region.startRow === this.startRow &&
           region.startCol === this.startCol &&
           region.endRow === this.endRow &&
           region.endCol === this.endCol
  }

  getMergedRegions(): MergedRegion[] {
    const regions: MergedRegion[] = []
    const seen = new Set<string>()
    
    for (let r = this.startRow; r <= this.endRow; r++) {
      for (let c = this.startCol; c <= this.endCol; c++) {
        const region = this.model.getMergedRegion(r, c)
        if (region) {
          const key = `${region.startRow},${region.startCol}`
          if (!seen.has(key)) {
            seen.add(key)
            regions.push(region)
          }
        }
      }
    }
    
    return regions
  }

  // ==================== 复制粘贴 ====================

  copyTo(targetRow: number, targetCol: number, options: CopyOptions = {}): void {
    const { 
      values = true, 
      styles = true, 
      borders = true, 
      formats = true 
    } = options

    const rowCount = this.getRowCount()
    const colCount = this.getColCount()

    for (let i = 0; i < rowCount; i++) {
      for (let j = 0; j < colCount; j++) {
        const srcRow = this.startRow + i
        const srcCol = this.startCol + j
        const tgtRow = targetRow + i
        const tgtCol = targetCol + j

        if (values) {
          this.model.setValue(tgtRow, tgtCol, this.model.getValue(srcRow, srcCol))
        }

        if (styles) {
          const style = this.model.getCellStyle(srcRow, srcCol)
          this.model.setCellStyle(tgtRow, tgtCol, style)
        }

        if (borders) {
          const border = this.model.getCellBorder(srcRow, srcCol)
          if (border) {
            this.model.setCellBorder(tgtRow, tgtCol, border)
          }
        }

        if (formats) {
          const format = this.model.getCellFormat(srcRow, srcCol)
          this.model.setCellFormat(tgtRow, tgtCol, format)
        }
      }
    }
  }

  moveTo(targetRow: number, targetCol: number): void {
    // 先复制到目标位置
    this.copyTo(targetRow, targetCol)
    // 再清除原位置
    this.clear()
  }

  // ==================== 清除操作 ====================

  clear(): void {
    this.clearValues()
    this.clearStyles()
    this.clearBorders()
    this.clearFormats()
  }

  clearContent(): void {
    this.clearValues()
  }

  /**
   * 获取底层 SheetModel 实例
   */
  getModel(): SheetModel {
    return this.model
  }

  /**
   * 创建子范围
   * @param rowOffset 行偏移
   * @param colOffset 列偏移
   * @param rowCount 行数
   * @param colCount 列数
   */
  getSubRange(rowOffset: number, colOffset: number, rowCount: number, colCount: number): RangeAPI {
    const newStartRow = this.startRow + rowOffset
    const newStartCol = this.startCol + colOffset
    const newEndRow = Math.min(newStartRow + rowCount - 1, this.endRow)
    const newEndCol = Math.min(newStartCol + colCount - 1, this.endCol)
    
    return new RangeAPI(this.model, newStartRow, newStartCol, newEndRow, newEndCol)
  }

  /**
   * 扩展范围
   * @param rows 向下扩展的行数
   * @param cols 向右扩展的列数
   */
  expand(rows: number, cols: number): RangeAPI {
    return new RangeAPI(
      this.model,
      this.startRow,
      this.startCol,
      this.endRow + rows,
      this.endCol + cols
    )
  }

  /**
   * 偏移范围
   * @param rowOffset 行偏移
   * @param colOffset 列偏移
   */
  offset(rowOffset: number, colOffset: number): RangeAPI {
    return new RangeAPI(
      this.model,
      this.startRow + rowOffset,
      this.startCol + colOffset,
      this.endRow + rowOffset,
      this.endCol + colOffset
    )
  }
}

/**
 * 从 A1 表示法创建范围
 * @param model SheetModel 实例
 * @param a1Notation A1 表示法（如 "A1:C3"、"B2"）
 * @returns RangeAPI 实例
 * @example
 * ```ts
 * const range = rangeFromA1(model, 'A1:C3')
 * const cell = rangeFromA1(model, 'B2')
 * ```
 */
export function rangeFromA1(model: SheetModel, a1Notation: string): RangeAPI {
  const parts = a1Notation.split(':')
  
  const parseCell = (cell: string): { row: number; col: number } => {
    const match = cell.match(/^([A-Z]+)(\d+)$/i)
    if (!match) {
      throw new Error(`Invalid cell reference: ${cell}`)
    }
    
    const letters = match[1]!.toUpperCase()
    const rowNum = parseInt(match[2]!, 10)
    
    let col = 0
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64)
    }
    
    return { row: rowNum - 1, col: col - 1 }
  }

  const start = parseCell(parts[0]!)
  const end = parts[1] ? parseCell(parts[1]) : start

  return new RangeAPI(model, start.row, start.col, end.row, end.col)
}

// 重新导出类型
export type { CellStyle, CellBorder, BorderEdge, CellFormat, MergedRegion }
