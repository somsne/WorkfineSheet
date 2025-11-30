import type { FormulaMetadata } from './FormulaMetadata'
import type { CellStyle, CellBorder, BorderEdge, CellFormat, MergedRegion, MergedCellInfo, FloatingImage, CellImage } from '../components/sheet/types'
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
  
  // 行样式存储（整行默认样式）
  private rowStyles: Map<number, CellStyle> = new Map()
  
  // 列样式存储（整列默认样式）
  private colStyles: Map<number, CellStyle> = new Map()
  
  // 边框存储
  private cellBorders: Map<CellKey, CellBorder> = new Map()
  
  // 格式存储（独立于样式，用于数据显示格式）
  private cellFormats: Map<CellKey, CellFormat> = new Map()
  
  // 行格式存储
  private rowFormats: Map<number, CellFormat> = new Map()
  
  // 列格式存储
  private colFormats: Map<number, CellFormat> = new Map()
  
  // 合并区域存储
  // Key: "startRow,startCol" (主单元格坐标)
  private mergedRegions: Map<CellKey, MergedRegion> = new Map()
  
  // 合并单元格反向索引：快速查找某个单元格属于哪个合并区域
  // Key: "row,col" → "startRow,startCol"
  private mergedCellIndex: Map<CellKey, CellKey> = new Map()
  
  // 浮动图片存储
  private floatingImages: Map<string, FloatingImage> = new Map()
  
  // 下一个图片 z-index
  private nextImageZIndex: number = 1
  
  // 单元格内嵌图片存储
  // Key: "row,col" → 该单元格的图片数组
  private cellImages: Map<CellKey, CellImage[]> = new Map()

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
    // 只存储用户设置的属性，不与默认样式合并
    const currentStyle = this.cellStyles.get(k) || {}
    this.cellStyles.set(k, { ...currentStyle, ...style } as CellStyle)
  }

  /**
   * 设置整行样式
   * 会清除该行所有单元格的相同样式属性，使行样式生效
   * @param row 行号
   * @param style 要设置的样式
   */
  setRowStyle(row: number, style: Partial<CellStyle>): void {
    // 只存储用户设置的属性，不与默认样式合并
    const currentStyle = this.rowStyles.get(row) || {}
    this.rowStyles.set(row, { ...currentStyle, ...style } as CellStyle)
    
    // 清除该行所有单元格的相同样式属性
    const styleKeys = Object.keys(style) as (keyof CellStyle)[]
    for (const [key, cellStyle] of this.cellStyles.entries()) {
      const [r] = key.split(',').map(Number)
      if (r === row && cellStyle) {
        // 删除单元格中与行样式相同的属性
        for (const prop of styleKeys) {
          delete (cellStyle as Record<string, unknown>)[prop]
        }
        // 如果单元格样式为空，则删除
        if (Object.keys(cellStyle).length === 0) {
          this.cellStyles.delete(key)
        }
      }
    }
  }

  /**
   * 获取整行样式
   * @param row 行号
   * @returns 行样式，如果未设置则返回 undefined
   */
  getRowStyle(row: number): CellStyle | undefined {
    return this.rowStyles.get(row)
  }

  /**
   * 清除整行样式
   * @param row 行号
   */
  clearRowStyle(row: number): void {
    this.rowStyles.delete(row)
  }

  /**
   * 设置整列样式
   * 会清除该列所有单元格的相同样式属性，使列样式生效
   * @param col 列号
   * @param style 要设置的样式
   */
  setColStyle(col: number, style: Partial<CellStyle>): void {
    // 只存储用户设置的属性，不与默认样式合并
    const currentStyle = this.colStyles.get(col) || {}
    this.colStyles.set(col, { ...currentStyle, ...style } as CellStyle)
    
    // 清除该列所有单元格的相同样式属性
    const styleKeys = Object.keys(style) as (keyof CellStyle)[]
    for (const [key, cellStyle] of this.cellStyles.entries()) {
      const [, c] = key.split(',').map(Number)
      if (c === col && cellStyle) {
        // 删除单元格中与列样式相同的属性
        for (const prop of styleKeys) {
          delete (cellStyle as Record<string, unknown>)[prop]
        }
        // 如果单元格样式为空，则删除
        if (Object.keys(cellStyle).length === 0) {
          this.cellStyles.delete(key)
        }
      }
    }
  }

  /**
   * 获取整列样式
   * @param col 列号
   * @returns 列样式，如果未设置则返回 undefined
   */
  getColStyle(col: number): CellStyle | undefined {
    return this.colStyles.get(col)
  }

  /**
   * 清除整列样式
   * @param col 列号
   */
  clearColStyle(col: number): void {
    this.colStyles.delete(col)
  }

  /**
   * 获取单元格样式
   * 样式优先级：单元格样式 > 行样式 > 列样式 > 默认样式
   * @param r 行号
   * @param c 列号
   * @returns 单元格样式
   */
  getCellStyle(r: number, c: number): CellStyle {
    const k = keyFor(r, c)
    const cellStyle = this.cellStyles.get(k)
    const rowStyle = this.rowStyles.get(r)
    const colStyle = this.colStyles.get(c)
    
    // 合并样式：默认样式 < 列样式 < 行样式 < 单元格样式
    return {
      ...DEFAULT_CELL_STYLE,
      ...(colStyle || {}),
      ...(rowStyle || {}),
      ...(cellStyle || {})
    }
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
   * 设置整行格式
   * 会清除该行所有单元格的格式，使行格式生效
   * @param row 行号
   * @param format 要设置的格式
   */
  setRowFormat(row: number, format: CellFormat): void {
    this.rowFormats.set(row, { ...format })
    
    // 清除该行所有单元格的格式
    for (const key of this.cellFormats.keys()) {
      const [r] = key.split(',').map(Number)
      if (r === row) {
        this.cellFormats.delete(key)
      }
    }
  }

  /**
   * 获取整行格式
   * @param row 行号
   * @returns 行格式，如果未设置则返回 undefined
   */
  getRowFormat(row: number): CellFormat | undefined {
    return this.rowFormats.get(row)
  }

  /**
   * 清除整行格式
   * @param row 行号
   */
  clearRowFormat(row: number): void {
    this.rowFormats.delete(row)
  }

  /**
   * 设置整列格式
   * 会清除该列所有单元格的格式，使列格式生效
   * @param col 列号
   * @param format 要设置的格式
   */
  setColFormat(col: number, format: CellFormat): void {
    this.colFormats.set(col, { ...format })
    
    // 清除该列所有单元格的格式
    for (const key of this.cellFormats.keys()) {
      const [, c] = key.split(',').map(Number)
      if (c === col) {
        this.cellFormats.delete(key)
      }
    }
  }

  /**
   * 获取整列格式
   * @param col 列号
   * @returns 列格式，如果未设置则返回 undefined
   */
  getColFormat(col: number): CellFormat | undefined {
    return this.colFormats.get(col)
  }

  /**
   * 清除整列格式
   * @param col 列号
   */
  clearColFormat(col: number): void {
    this.colFormats.delete(col)
  }

  /**
   * 获取单元格格式
   * 格式优先级：单元格格式 > 行格式 > 列格式 > 默认格式
   * @param r 行号
   * @param c 列号
   * @returns 单元格格式
   */
  getCellFormat(r: number, c: number): CellFormat {
    const k = keyFor(r, c)
    const cellFormat = this.cellFormats.get(k)
    if (cellFormat) return cellFormat
    
    const rowFormat = this.rowFormats.get(r)
    if (rowFormat) return rowFormat
    
    const colFormat = this.colFormats.get(c)
    if (colFormat) return colFormat
    
    return { ...DEFAULT_CELL_FORMAT }
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

  // ==================== 合并单元格管理方法 ====================

  /**
   * 合并单元格
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @returns 是否成功合并
   */
  mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    // 规范化坐标（确保 start <= end）
    const r1 = Math.min(startRow, endRow)
    const c1 = Math.min(startCol, endCol)
    const r2 = Math.max(startRow, endRow)
    const c2 = Math.max(startCol, endCol)
    
    // 检查是否是单个单元格（不需要合并）
    if (r1 === r2 && c1 === c2) {
      return false
    }
    
    // 检查是否与现有合并区域冲突
    if (!this.canMerge(r1, c1, r2, c2)) {
      return false
    }
    
    // 创建合并区域
    const region: MergedRegion = {
      startRow: r1,
      startCol: c1,
      endRow: r2,
      endCol: c2
    }
    
    // 获取主单元格的样式
    const masterKey = keyFor(r1, c1)
    const masterStyle = this.cellStyles.get(masterKey)
    
    // ==== 收集合并区域的外边框（Excel 行为：保留外边框，清除内部边框）====
    const mergedBorder: CellBorder = {}
    
    // 1. 收集顶边框：从第一行的所有单元格收集顶边框
    for (let c = c1; c <= c2; c++) {
      const border = this.cellBorders.get(keyFor(r1, c))
      if (border?.top) {
        // 使用第一个找到的顶边框（或可以选择最左边的）
        if (!mergedBorder.top) {
          mergedBorder.top = { ...border.top }
        }
      }
    }
    
    // 2. 收集底边框：从最后一行的所有单元格收集底边框
    for (let c = c1; c <= c2; c++) {
      const border = this.cellBorders.get(keyFor(r2, c))
      if (border?.bottom) {
        if (!mergedBorder.bottom) {
          mergedBorder.bottom = { ...border.bottom }
        }
      }
    }
    
    // 3. 收集左边框：从第一列的所有单元格收集左边框
    for (let r = r1; r <= r2; r++) {
      const border = this.cellBorders.get(keyFor(r, c1))
      if (border?.left) {
        if (!mergedBorder.left) {
          mergedBorder.left = { ...border.left }
        }
      }
    }
    
    // 4. 收集右边框：从最后一列的所有单元格收集右边框
    for (let r = r1; r <= r2; r++) {
      const border = this.cellBorders.get(keyFor(r, c2))
      if (border?.right) {
        if (!mergedBorder.right) {
          mergedBorder.right = { ...border.right }
        }
      }
    }
    
    // 清空所有单元格的边框和非主单元格的值
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const key = keyFor(r, c)
        if (r !== r1 || c !== c1) {
          // 清空值
          if (this.cells.has(key)) {
            this.cells.delete(key)
          }
        }
        // 清空所有单元格的边框（稍后会在主单元格设置合并后的边框）
        if (this.cellBorders.has(key)) {
          this.cellBorders.delete(key)
        }
        // 将主单元格的样式应用到所有合并的单元格（包括主单元格本身，确保一致性）
        if (masterStyle) {
          this.cellStyles.set(key, { ...masterStyle })
        } else {
          // 如果主单元格没有样式，清空其他单元格的样式
          if (r !== r1 || c !== c1) {
            this.cellStyles.delete(key)
          }
        }
      }
    }
    
    // 如果收集到了外边框，设置到主单元格
    if (mergedBorder.top || mergedBorder.right || mergedBorder.bottom || mergedBorder.left) {
      this.cellBorders.set(masterKey, mergedBorder)
    }
    
    // 存储合并区域
    this.mergedRegions.set(masterKey, region)
    
    // 建立反向索引
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        this.mergedCellIndex.set(keyFor(r, c), masterKey)
      }
    }
    
    return true
  }

  /**
   * 取消合并单元格
   * @param row 合并区域内任意单元格的行号
   * @param col 合并区域内任意单元格的列号
   * @returns 被取消的合并区域，如果没有则返回 null
   */
  unmergeCells(row: number, col: number): MergedRegion | null {
    const region = this.getMergedRegion(row, col)
    if (!region) {
      return null
    }
    
    const { startRow: r1, startCol: c1, endRow: r2, endCol: c2 } = region
    const masterKey = keyFor(r1, c1)
    
    // ==== 取消合并时分配边框（Excel 行为）====
    // 获取主单元格的边框（深拷贝，避免后续修改影响）
    const masterBorder = this.cellBorders.get(masterKey)
    const borderToDistribute = masterBorder ? {
      top: masterBorder.top ? { ...masterBorder.top } : undefined,
      bottom: masterBorder.bottom ? { ...masterBorder.bottom } : undefined,
      left: masterBorder.left ? { ...masterBorder.left } : undefined,
      right: masterBorder.right ? { ...masterBorder.right } : undefined
    } : null
    
    // 先清除主单元格的边框
    if (masterBorder) {
      this.cellBorders.delete(masterKey)
    }
    
    // 然后分配边框到各边界单元格
    if (borderToDistribute) {
      // 1. 顶边框分配到第一行的所有单元格
      if (borderToDistribute.top) {
        for (let c = c1; c <= c2; c++) {
          const key = keyFor(r1, c)
          const existing = this.cellBorders.get(key) || {}
          this.cellBorders.set(key, { ...existing, top: { ...borderToDistribute.top } })
        }
      }
      
      // 2. 底边框分配到最后一行的所有单元格
      if (borderToDistribute.bottom) {
        for (let c = c1; c <= c2; c++) {
          const key = keyFor(r2, c)
          const existing = this.cellBorders.get(key) || {}
          this.cellBorders.set(key, { ...existing, bottom: { ...borderToDistribute.bottom } })
        }
      }
      
      // 3. 左边框分配到第一列的所有单元格
      if (borderToDistribute.left) {
        for (let r = r1; r <= r2; r++) {
          const key = keyFor(r, c1)
          const existing = this.cellBorders.get(key) || {}
          this.cellBorders.set(key, { ...existing, left: { ...borderToDistribute.left } })
        }
      }
      
      // 4. 右边框分配到最后一列的所有单元格
      if (borderToDistribute.right) {
        for (let r = r1; r <= r2; r++) {
          const key = keyFor(r, c2)
          const existing = this.cellBorders.get(key) || {}
          this.cellBorders.set(key, { ...existing, right: { ...borderToDistribute.right } })
        }
      }
    }
    
    // 移除合并区域
    this.mergedRegions.delete(masterKey)
    
    // 移除反向索引
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        this.mergedCellIndex.delete(keyFor(r, c))
      }
    }
    
    return region
  }

  /**
   * 检查区域是否可以合并（无冲突）
   * @returns true 如果可以合并
   */
  canMerge(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    // 规范化坐标
    const r1 = Math.min(startRow, endRow)
    const c1 = Math.min(startCol, endCol)
    const r2 = Math.max(startRow, endRow)
    const c2 = Math.max(startCol, endCol)
    
    // 检查区域内是否有已合并的单元格
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const existingMasterKey = this.mergedCellIndex.get(keyFor(r, c))
        if (existingMasterKey) {
          // 如果已存在的合并区域不完全包含在新区域内，则冲突
          const existingRegion = this.mergedRegions.get(existingMasterKey)
          if (existingRegion) {
            // 检查现有区域是否完全在新区域内
            if (existingRegion.startRow < r1 || existingRegion.startCol < c1 ||
                existingRegion.endRow > r2 || existingRegion.endCol > c2) {
              return false // 部分重叠，冲突
            }
          }
        }
      }
    }
    
    return true
  }

  /**
   * 获取单元格的合并信息
   * @param row 行号
   * @param col 列号
   * @returns 合并信息
   */
  getMergedCellInfo(row: number, col: number): MergedCellInfo {
    const cellKey = keyFor(row, col)
    const masterKey = this.mergedCellIndex.get(cellKey)
    
    if (!masterKey) {
      return { isMerged: false, isMaster: false }
    }
    
    const region = this.mergedRegions.get(masterKey)
    if (!region) {
      return { isMerged: false, isMaster: false }
    }
    
    const isMaster = row === region.startRow && col === region.startCol
    
    return {
      isMerged: true,
      isMaster,
      region
    }
  }

  /**
   * 获取合并区域（如果存在）
   * @param row 合并区域内任意单元格的行号
   * @param col 合并区域内任意单元格的列号
   * @returns 合并区域，如果不在任何合并区域内则返回 null
   */
  getMergedRegion(row: number, col: number): MergedRegion | null {
    const cellKey = keyFor(row, col)
    const masterKey = this.mergedCellIndex.get(cellKey)
    
    if (!masterKey) {
      return null
    }
    
    return this.mergedRegions.get(masterKey) || null
  }

  /**
   * 获取所有合并区域
   * @returns 合并区域数组
   */
  getAllMergedRegions(): MergedRegion[] {
    return Array.from(this.mergedRegions.values())
  }

  /**
   * 检查区域内是否有数据会丢失（用于显示提示）
   * 只有主单元格（左上角）的值会保留，其他有值的单元格数据会丢失
   * @returns true 如果有数据会丢失
   */
  hasDataToLose(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    // 规范化坐标
    const r1 = Math.min(startRow, endRow)
    const c1 = Math.min(startCol, endCol)
    const r2 = Math.max(startRow, endRow)
    const c2 = Math.max(startCol, endCol)
    
    let nonEmptyCellCount = 0
    
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const value = this.getValue(r, c)
        if (value !== '') {
          nonEmptyCellCount++
          // 如果有超过1个非空单元格，则有数据会丢失
          if (nonEmptyCellCount > 1) {
            return true
          }
        }
      }
    }
    
    return false
  }

  /**
   * 获取合并区域数量
   * @returns 合并区域数量
   */
  getMergedRegionCount(): number {
    return this.mergedRegions.size
  }

  /**
   * 检查单元格是否在合并区域内
   * @param row 行号
   * @param col 列号
   * @returns 是否在合并区域内
   */
  isMergedCell(row: number, col: number): boolean {
    return this.mergedCellIndex.has(keyFor(row, col))
  }

  /**
   * 检查单元格是否是合并区域的主单元格
   * @param row 行号
   * @param col 列号
   * @returns 是否是主单元格
   */
  isMasterCell(row: number, col: number): boolean {
    const info = this.getMergedCellInfo(row, col)
    return info.isMerged && info.isMaster
  }

  /**
   * 遍历所有合并区域
   * @param fn 回调函数
   */
  forEachMergedRegion(fn: (region: MergedRegion) => void): void {
    for (const region of this.mergedRegions.values()) {
      fn(region)
    }
  }

  /**
   * 清除所有合并区域
   */
  clearAllMergedRegions(): void {
    this.mergedRegions.clear()
    this.mergedCellIndex.clear()
  }
  
  // ==================== 单元格内嵌图片管理方法 ====================

  /**
   * 添加单元格图片
   * @param row 行号
   * @param col 列号
   * @param imageData 图片数据（不含 id 和 timestamp）
   * @returns 图片 ID
   */
  addCellImage(
    row: number,
    col: number,
    imageData: Omit<CellImage, 'id' | 'timestamp'>
  ): string {
    const id = `cimg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const image: CellImage = {
      ...imageData,
      id,
      timestamp: Date.now()
    }
    
    const key = keyFor(row, col)
    const images = this.cellImages.get(key) || []
    images.push(image)
    this.cellImages.set(key, images)
    
    return id
  }

  /**
   * 获取单元格的所有图片（按时间戳排序，最新的在最后）
   * @param row 行号
   * @param col 列号
   * @returns 图片数组
   */
  getCellImages(row: number, col: number): CellImage[] {
    const key = keyFor(row, col)
    const images = this.cellImages.get(key) || []
    // 按时间戳排序，最新的在最后
    return [...images].sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 获取单元格显示的图片（最新的一张）
   * @param row 行号
   * @param col 列号
   * @returns 最新的图片，如果没有则返回 undefined
   */
  getCellDisplayImage(row: number, col: number): CellImage | undefined {
    const images = this.getCellImages(row, col)
    return images.length > 0 ? images[images.length - 1] : undefined
  }

  /**
   * 获取单元格图片数量
   * @param row 行号
   * @param col 列号
   * @returns 图片数量
   */
  getCellImageCount(row: number, col: number): number {
    const key = keyFor(row, col)
    return this.cellImages.get(key)?.length || 0
  }

  /**
   * 移除单元格的某张图片
   * @param row 行号
   * @param col 列号
   * @param imageId 图片 ID
   * @returns 被移除的图片，如果不存在则返回 undefined
   */
  removeCellImage(row: number, col: number, imageId: string): CellImage | undefined {
    const key = keyFor(row, col)
    const images = this.cellImages.get(key)
    if (!images) return undefined
    
    const index = images.findIndex(img => img.id === imageId)
    if (index === -1) return undefined
    
    const removed = images.splice(index, 1)[0]
    
    // 如果数组为空，删除整个 key
    if (images.length === 0) {
      this.cellImages.delete(key)
    }
    
    return removed
  }

  /**
   * 清除单元格的所有图片
   * @param row 行号
   * @param col 列号
   * @returns 被清除的图片数组
   */
  clearCellImages(row: number, col: number): CellImage[] {
    const key = keyFor(row, col)
    const images = this.cellImages.get(key) || []
    this.cellImages.delete(key)
    return images
  }

  /**
   * 更新单元格图片的对齐方式
   * @param row 行号
   * @param col 列号
   * @param imageId 图片 ID
   * @param horizontalAlign 水平对齐
   * @param verticalAlign 垂直对齐
   */
  updateCellImageAlignment(
    row: number,
    col: number,
    imageId: string,
    horizontalAlign?: 'left' | 'center' | 'right',
    verticalAlign?: 'top' | 'middle' | 'bottom'
  ): void {
    const key = keyFor(row, col)
    const images = this.cellImages.get(key)
    if (!images) return
    
    const image = images.find(img => img.id === imageId)
    if (!image) return
    
    if (horizontalAlign !== undefined) {
      image.horizontalAlign = horizontalAlign
    }
    if (verticalAlign !== undefined) {
      image.verticalAlign = verticalAlign
    }
  }

  /**
   * 检查单元格是否有图片
   * @param row 行号
   * @param col 列号
   * @returns 是否有图片
   */
  hasCellImage(row: number, col: number): boolean {
    const key = keyFor(row, col)
    const images = this.cellImages.get(key)
    return images !== undefined && images.length > 0
  }

  /**
   * 获取所有有图片的单元格数量
   * @returns 有图片的单元格数量
   */
  getCellsWithImageCount(): number {
    return this.cellImages.size
  }

  /**
   * 遍历所有有图片的单元格
   * @param fn 回调函数
   */
  forEachCellImage(fn: (row: number, col: number, images: CellImage[]) => void): void {
    for (const [key, images] of this.cellImages.entries()) {
      const parts = key.split(',')
      const rs = parts[0]
      const cs = parts[1]
      if (rs && cs) {
        fn(parseInt(rs, 10), parseInt(cs, 10), images)
      }
    }
  }

  /**
   * 根据行插入调整单元格图片位置
   */
  adjustCellImagesForRowInsert(row: number, count: number = 1): void {
    const newCellImages = new Map<CellKey, CellImage[]>()
    
    for (const [key, images] of this.cellImages.entries()) {
      const parts = key.split(',')
      const r = parseInt(parts[0]!, 10)
      const c = parseInt(parts[1]!, 10)
      
      if (r >= row) {
        // 该行及之后的行下移
        newCellImages.set(keyFor(r + count, c), images)
      } else {
        // 该行之前的行保持不变
        newCellImages.set(key, images)
      }
    }
    
    this.cellImages = newCellImages
  }

  /**
   * 根据行删除调整单元格图片位置
   */
  adjustCellImagesForRowDelete(row: number, count: number = 1): void {
    const newCellImages = new Map<CellKey, CellImage[]>()
    
    for (const [key, images] of this.cellImages.entries()) {
      const parts = key.split(',')
      const r = parseInt(parts[0]!, 10)
      const c = parseInt(parts[1]!, 10)
      
      if (r >= row && r < row + count) {
        // 被删除行的图片直接丢弃
        continue
      } else if (r >= row + count) {
        // 该行之后的行上移
        newCellImages.set(keyFor(r - count, c), images)
      } else {
        // 该行之前的行保持不变
        newCellImages.set(key, images)
      }
    }
    
    this.cellImages = newCellImages
  }

  /**
   * 根据列插入调整单元格图片位置
   */
  adjustCellImagesForColInsert(col: number, count: number = 1): void {
    const newCellImages = new Map<CellKey, CellImage[]>()
    
    for (const [key, images] of this.cellImages.entries()) {
      const parts = key.split(',')
      const r = parseInt(parts[0]!, 10)
      const c = parseInt(parts[1]!, 10)
      
      if (c >= col) {
        // 该列及之后的列右移
        newCellImages.set(keyFor(r, c + count), images)
      } else {
        // 该列之前的列保持不变
        newCellImages.set(key, images)
      }
    }
    
    this.cellImages = newCellImages
  }

  /**
   * 根据列删除调整单元格图片位置
   */
  adjustCellImagesForColDelete(col: number, count: number = 1): void {
    const newCellImages = new Map<CellKey, CellImage[]>()
    
    for (const [key, images] of this.cellImages.entries()) {
      const parts = key.split(',')
      const r = parseInt(parts[0]!, 10)
      const c = parseInt(parts[1]!, 10)
      
      if (c >= col && c < col + count) {
        // 被删除列的图片直接丢弃
        continue
      } else if (c >= col + count) {
        // 该列之后的列左移
        newCellImages.set(keyFor(r, c - count), images)
      } else {
        // 该列之前的列保持不变
        newCellImages.set(key, images)
      }
    }
    
    this.cellImages = newCellImages
  }

  // ==================== 浮动图片管理方法 ====================

  /**
   * 添加浮动图片
   * @param imageData 图片数据（不含 id 和 zIndex）
   * @returns 图片 ID
   */
  addFloatingImage(imageData: Omit<FloatingImage, 'id' | 'zIndex'>): string {
    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const image: FloatingImage = {
      ...imageData,
      id,
      zIndex: this.nextImageZIndex++
    }
    this.floatingImages.set(id, image)
    return id
  }

  /**
   * 获取浮动图片
   */
  getFloatingImage(id: string): FloatingImage | undefined {
    return this.floatingImages.get(id)
  }

  /**
   * 更新浮动图片
   */
  updateFloatingImage(id: string, updates: Partial<FloatingImage>): void {
    const image = this.floatingImages.get(id)
    if (image) {
      // 不允许更改 id
      const { id: _id, ...rest } = updates
      this.floatingImages.set(id, { ...image, ...rest })
    }
  }

  /**
   * 删除浮动图片
   */
  deleteFloatingImage(id: string): boolean {
    return this.floatingImages.delete(id)
  }

  /**
   * 恢复浮动图片（用于撤销/重做，保留原始 id 和 zIndex）
   */
  restoreFloatingImage(image: FloatingImage): void {
    this.floatingImages.set(image.id, { ...image })
    // 确保 nextImageZIndex 不会与恢复的图片冲突
    if (image.zIndex >= this.nextImageZIndex) {
      this.nextImageZIndex = image.zIndex + 1
    }
  }

  /**
   * 获取所有浮动图片（按 zIndex 排序，从下到上）
   */
  getAllFloatingImages(): FloatingImage[] {
    return Array.from(this.floatingImages.values())
      .filter(img => !img.hidden)
      .sort((a, b) => a.zIndex - b.zIndex)
  }

  /**
   * 获取浮动图片数量
   */
  getFloatingImageCount(): number {
    return this.floatingImages.size
  }

  /**
   * 将图片移到最上层
   */
  bringImageToFront(id: string): void {
    const image = this.floatingImages.get(id)
    if (image) {
      image.zIndex = this.nextImageZIndex++
    }
  }

  /**
   * 将图片移到最下层
   */
  sendImageToBack(id: string): void {
    const image = this.floatingImages.get(id)
    if (!image) return
    
    // 找出最小 zIndex
    let minZ = Infinity
    for (const img of this.floatingImages.values()) {
      if (img.zIndex < minZ) minZ = img.zIndex
    }
    
    // 设置为比最小值还小 1
    image.zIndex = minZ - 1
  }

  /**
   * 将图片上移一层
   */
  bringImageForward(id: string): void {
    const image = this.floatingImages.get(id)
    if (!image) return
    
    // 找出比当前 zIndex 大的最小值
    let nextZ: number | null = null
    let nextImage: FloatingImage | null = null
    
    for (const img of this.floatingImages.values()) {
      if (img.id !== id && img.zIndex > image.zIndex) {
        if (nextZ === null || img.zIndex < nextZ) {
          nextZ = img.zIndex
          nextImage = img
        }
      }
    }
    
    // 交换 zIndex
    if (nextImage) {
      const temp = image.zIndex
      image.zIndex = nextImage.zIndex
      nextImage.zIndex = temp
    }
  }

  /**
   * 将图片下移一层
   */
  sendImageBackward(id: string): void {
    const image = this.floatingImages.get(id)
    if (!image) return
    
    // 找出比当前 zIndex 小的最大值
    let prevZ: number | null = null
    let prevImage: FloatingImage | null = null
    
    for (const img of this.floatingImages.values()) {
      if (img.id !== id && img.zIndex < image.zIndex) {
        if (prevZ === null || img.zIndex > prevZ) {
          prevZ = img.zIndex
          prevImage = img
        }
      }
    }
    
    // 交换 zIndex
    if (prevImage) {
      const temp = image.zIndex
      image.zIndex = prevImage.zIndex
      prevImage.zIndex = temp
    }
  }

  /**
   * 根据锚点位置调整图片（插入行时）
   */
  adjustImagesForRowInsert(row: number, count: number = 1): void {
    for (const image of this.floatingImages.values()) {
      if (image.anchorRow >= row) {
        image.anchorRow += count
      }
    }
  }

  /**
   * 根据锚点位置调整图片（删除行时）
   */
  adjustImagesForRowDelete(row: number, count: number = 1): void {
    const toDelete: string[] = []
    for (const image of this.floatingImages.values()) {
      if (image.anchorRow >= row && image.anchorRow < row + count) {
        // 锚点行被删除，删除图片
        toDelete.push(image.id)
      } else if (image.anchorRow >= row + count) {
        // 锚点行在删除区域之后，上移
        image.anchorRow -= count
      }
    }
    toDelete.forEach(id => this.floatingImages.delete(id))
  }

  /**
   * 根据锚点位置调整图片（插入列时）
   */
  adjustImagesForColInsert(col: number, count: number = 1): void {
    for (const image of this.floatingImages.values()) {
      if (image.anchorCol >= col) {
        image.anchorCol += count
      }
    }
  }

  /**
   * 根据锚点位置调整图片（删除列时）
   */
  adjustImagesForColDelete(col: number, count: number = 1): void {
    const toDelete: string[] = []
    for (const image of this.floatingImages.values()) {
      if (image.anchorCol >= col && image.anchorCol < col + count) {
        // 锚点列被删除，删除图片
        toDelete.push(image.id)
      } else if (image.anchorCol >= col + count) {
        // 锚点列在删除区域之后，左移
        image.anchorCol -= count
      }
    }
    toDelete.forEach(id => this.floatingImages.delete(id))
  }

  /**
   * 创建模型快照（用于撤销操作）
   * @returns 模型状态快照
   */
  createSnapshot(): ModelSnapshot {
    // 深拷贝浮动图片
    const imagesCopy = new Map<string, FloatingImage>()
    for (const [id, img] of this.floatingImages.entries()) {
      imagesCopy.set(id, { ...img })
    }
    
    // 深拷贝单元格图片
    const cellImagesCopy = new Map<CellKey, CellImage[]>()
    for (const [key, images] of this.cellImages.entries()) {
      cellImagesCopy.set(key, images.map(img => ({ ...img })))
    }
    
    return {
      cells: new Map(this.cells),
      cellStyles: new Map(this.cellStyles),
      cellBorders: new Map(this.cellBorders),
      cellFormats: new Map(this.cellFormats),
      mergedRegions: new Map(this.mergedRegions),
      mergedCellIndex: new Map(this.mergedCellIndex),
      floatingImages: imagesCopy,
      nextImageZIndex: this.nextImageZIndex,
      cellImages: cellImagesCopy
    }
  }
  
  /**
   * 从快照恢复模型状态
   * @param snapshot 模型状态快照
   */
  restoreFromSnapshot(snapshot: ModelSnapshot): void {
    this.cells = new Map(snapshot.cells)
    this.cellStyles = new Map(snapshot.cellStyles)
    this.cellBorders = new Map(snapshot.cellBorders)
    this.cellFormats = new Map(snapshot.cellFormats)
    this.mergedRegions = new Map(snapshot.mergedRegions)
    this.mergedCellIndex = new Map(snapshot.mergedCellIndex)
    
    // 恢复浮动图片
    if (snapshot.floatingImages) {
      this.floatingImages = new Map()
      for (const [id, img] of snapshot.floatingImages.entries()) {
        this.floatingImages.set(id, { ...img })
      }
    }
    if (snapshot.nextImageZIndex !== undefined) {
      this.nextImageZIndex = snapshot.nextImageZIndex
    }
    
    // 恢复单元格图片
    if (snapshot.cellImages) {
      this.cellImages = new Map()
      for (const [key, images] of snapshot.cellImages.entries()) {
        this.cellImages.set(key, images.map(img => ({ ...img })))
      }
    }
  }
}

/**
 * 模型状态快照（用于撤销/重做）
 */
export interface ModelSnapshot {
  cells: Map<CellKey, Cell>
  cellStyles: Map<CellKey, CellStyle>
  cellBorders: Map<CellKey, CellBorder>
  cellFormats: Map<CellKey, CellFormat>
  mergedRegions: Map<CellKey, MergedRegion>
  mergedCellIndex: Map<CellKey, CellKey>
  floatingImages?: Map<string, FloatingImage>
  nextImageZIndex?: number
  cellImages?: Map<CellKey, CellImage[]>
}
