import type { FormulaMetadata } from './FormulaMetadata'
import type { CellStyle } from '../components/sheet/types'
import { DEFAULT_CELL_STYLE } from '../components/sheet/types'

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
}
