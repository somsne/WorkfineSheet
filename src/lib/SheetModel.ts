import type { FormulaMetadata } from './FormulaMetadata'
import type { CellStyle, CellBorder, BorderEdge, CellFormat } from '../components/sheet/types'
import { DEFAULT_CELL_STYLE, DEFAULT_CELL_FORMAT } from '../components/sheet/types'

export type CellKey = string

export function keyFor(r: number, c: number) {
  return `${r},${c}`
}

export interface Cell {
  value: string
  // 如果单元格包含公式，存储其元数据
  formulaMetadata?: FormulaMetadata
}

export class SheetModel {
  // sparse storage
  private cells: Map<CellKey, Cell> = new Map()
  
  // 样式存储（使用 Map 优化查询性能）
  private cellStyles: Map<CellKey, CellStyle> = new Map()
  
  // 边框存储
  private cellBorders: Map<CellKey, CellBorder> = new Map()
  
  // 格式存储（独立于样式，用于数据显示格式）
  private cellFormats: Map<CellKey, CellFormat> = new Map()

  getCell(r: number, c: number): Cell | null {
    const k = keyFor(r, c)
    return this.cells.get(k) ?? null
  }

  getValue(r: number, c: number): string {
    const cell = this.getCell(r, c)
    return cell ? cell.value : ''
  }

  setValue(r: number, c: number, value: string) {
    const k = keyFor(r, c)
    if (value === '' || value == null) {
      this.cells.delete(k)
    } else {
      this.cells.set(k, { value })
    }
  }

  // 设置完整的单元格对象（用于包含元数据的情况）
  setCell(r: number, c: number, cell: Cell) {
    const k = keyFor(r, c)
    if (!cell.value || cell.value === '') {
      this.cells.delete(k)
    } else {
      this.cells.set(k, cell)
    }
  }

  // simple iterator for populated cells
  forEach(fn: (r: number, c: number, cell: Cell) => void) {
    for (const [k, v] of this.cells.entries()) {
      const parts = k.split(',')
      const rs = parts[0]
      const cs = parts[1]
      if (rs && cs) {
        fn(parseInt(rs, 10), parseInt(cs, 10), v)
      }
    }
  }

  // ==================== 样式管理方法 ====================

  /**
   * 设置单元格样式
   * 会合并现有样式，而不是完全替换
   * @param r 行号
   * @param c 列号
   * @param style 要设置的样式（部分属性）
   */
  setCellStyle(r: number, c: number, style: Partial<CellStyle>): void {
    const k = keyFor(r, c)
    const currentStyle = this.cellStyles.get(k) || { ...DEFAULT_CELL_STYLE }
    this.cellStyles.set(k, { ...currentStyle, ...style })
  }

  /**
   * 获取单元格样式
   * 如果单元格没有设置样式，返回默认样式
   * @param r 行号
   * @param c 列号
   * @returns 单元格样式
   */
  getCellStyle(r: number, c: number): CellStyle {
    const k = keyFor(r, c)
    return this.cellStyles.get(k) || { ...DEFAULT_CELL_STYLE }
  }

  /**
   * 清除单元格样式
   * @param r 行号
   * @param c 列号
   */
  clearCellStyle(r: number, c: number): void {
    const k = keyFor(r, c)
    this.cellStyles.delete(k)
  }

  /**
   * 批量设置样式（选区）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param style 要设置的样式
   */
  setRangeStyle(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    style: Partial<CellStyle>
  ): void {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.setCellStyle(r, c, style)
      }
    }
  }

  /**
   * 检查单元格是否有自定义样式
   * @param r 行号
   * @param c 列号
   * @returns 是否有自定义样式
   */
  hasCellStyle(r: number, c: number): boolean {
    const k = keyFor(r, c)
    return this.cellStyles.has(k)
  }

  /**
   * 获取所有有样式的单元格数量
   * @returns 样式单元格数量
   */
  getStyledCellCount(): number {
    return this.cellStyles.size
  }

  // ==================== 边框管理方法 ====================

  /**
   * 设置单元格边框
   * 会合并现有边框，而不是完全替换
   * @param r 行号
   * @param c 列号
   * @param border 要设置的边框（部分属性）
   */
  setCellBorder(r: number, c: number, border: Partial<CellBorder>): void {
    const k = keyFor(r, c)
    const currentBorder = this.cellBorders.get(k) || {}
    this.cellBorders.set(k, { ...currentBorder, ...border })
  }

  /**
   * 获取单元格边框
   * @param r 行号
   * @param c 列号
   * @returns 单元格边框，如果没有设置则返回 undefined
   */
  getCellBorder(r: number, c: number): CellBorder | undefined {
    const k = keyFor(r, c)
    return this.cellBorders.get(k)
  }

  /**
   * 清除单元格边框
   * @param r 行号
   * @param c 列号
   */
  clearCellBorder(r: number, c: number): void {
    const k = keyFor(r, c)
    this.cellBorders.delete(k)
  }

  /**
   * 批量设置边框（选区全边框）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param border 要设置的边框
   */
  setRangeBorder(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    border: Partial<CellBorder>
  ): void {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.setCellBorder(r, c, border)
      }
    }
  }

  /**
   * 设置范围外边框（只设置最外层四边）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param edge 边框样式
   */
  setRangeOuterBorder(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    edge: BorderEdge
  ): void {
    // 上边和下边
    for (let c = startCol; c <= endCol; c++) {
      // 上边框
      const topKey = keyFor(startRow, c)
      const topBorder = this.cellBorders.get(topKey) || {}
      this.cellBorders.set(topKey, { ...topBorder, top: edge })
      
      // 下边框
      const bottomKey = keyFor(endRow, c)
      const bottomBorder = this.cellBorders.get(bottomKey) || {}
      this.cellBorders.set(bottomKey, { ...bottomBorder, bottom: edge })
    }
    
    // 左边和右边
    for (let r = startRow; r <= endRow; r++) {
      // 左边框
      const leftKey = keyFor(r, startCol)
      const leftBorder = this.cellBorders.get(leftKey) || {}
      this.cellBorders.set(leftKey, { ...leftBorder, left: edge })
      
      // 右边框
      const rightKey = keyFor(r, endCol)
      const rightBorder = this.cellBorders.get(rightKey) || {}
      this.cellBorders.set(rightKey, { ...rightBorder, right: edge })
    }
  }

  /**
   * 清除范围边框
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   */
  clearRangeBorder(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): void {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.clearCellBorder(r, c)
      }
    }
  }

  /**
   * 检查单元格是否有边框
   * @param r 行号
   * @param c 列号
   * @returns 是否有边框
   */
  hasCellBorder(r: number, c: number): boolean {
    const k = keyFor(r, c)
    return this.cellBorders.has(k)
  }

  /**
   * 获取所有有边框的单元格数量
   * @returns 边框单元格数量
   */
  getBorderedCellCount(): number {
    return this.cellBorders.size
  }

  // ==================== 格式管理方法 ====================

  /**
   * 设置单元格格式
   * @param r 行号
   * @param c 列号
   * @param format 要设置的格式
   */
  setCellFormat(r: number, c: number, format: CellFormat): void {
    const k = keyFor(r, c)
    this.cellFormats.set(k, { ...format })
  }

  /**
   * 获取单元格格式
   * 如果单元格没有设置格式，返回默认格式
   * @param r 行号
   * @param c 列号
   * @returns 单元格格式
   */
  getCellFormat(r: number, c: number): CellFormat {
    const k = keyFor(r, c)
    return this.cellFormats.get(k) || { ...DEFAULT_CELL_FORMAT }
  }

  /**
   * 清除单元格格式
   * @param r 行号
   * @param c 列号
   */
  clearCellFormat(r: number, c: number): void {
    const k = keyFor(r, c)
    this.cellFormats.delete(k)
  }

  /**
   * 批量设置格式（选区）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param format 要设置的格式
   */
  setRangeFormat(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    format: CellFormat
  ): void {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.setCellFormat(r, c, format)
      }
    }
  }

  /**
   * 检查单元格是否有自定义格式
   * @param r 行号
   * @param c 列号
   * @returns 是否有自定义格式
   */
  hasCellFormat(r: number, c: number): boolean {
    const k = keyFor(r, c)
    return this.cellFormats.has(k)
  }

  /**
   * 获取所有有格式的单元格数量
   * @returns 格式单元格数量
   */
  getFormattedCellCount(): number {
    return this.cellFormats.size
  }

  /**
   * 遍历所有有格式的单元格
   * @param fn 回调函数
   */
  forEachFormat(fn: (r: number, c: number, format: CellFormat) => void): void {
    for (const [k, format] of this.cellFormats.entries()) {
      const parts = k.split(',')
      const rs = parts[0]
      const cs = parts[1]
      if (rs && cs) {
        fn(parseInt(rs, 10), parseInt(cs, 10), format)
      }
    }
  }
}
