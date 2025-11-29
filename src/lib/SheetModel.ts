import type { FormulaMetadata } from './FormulaMetadata'
import type { CellStyle, CellBorder, BorderEdge, CellFormat, MergedRegion, MergedCellInfo } from '../components/sheet/types'
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
  
  // 合并区域存储
  // Key: "startRow,startCol" (主单元格坐标)
  private mergedRegions: Map<CellKey, MergedRegion> = new Map()
  
  // 合并单元格反向索引：快速查找某个单元格属于哪个合并区域
  // Key: "row,col" → "startRow,startCol"
  private mergedCellIndex: Map<CellKey, CellKey> = new Map()

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
  
  /**
   * 创建模型快照（用于撤销操作）
   * @returns 模型状态快照
   */
  createSnapshot(): ModelSnapshot {
    return {
      cells: new Map(this.cells),
      cellStyles: new Map(this.cellStyles),
      cellBorders: new Map(this.cellBorders),
      cellFormats: new Map(this.cellFormats),
      mergedRegions: new Map(this.mergedRegions),
      mergedCellIndex: new Map(this.mergedCellIndex)
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
}
