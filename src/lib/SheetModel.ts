import type { FormulaMetadata } from './FormulaMetadata'

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
}
