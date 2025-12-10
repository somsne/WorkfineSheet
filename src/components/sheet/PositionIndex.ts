/**
 * PositionIndex - 位置索引管理器
 * 
 * 预计算并缓存行列的累计位置，将 O(n) 的位置查询优化为 O(1)
 * 支持二分查找定位，将 O(n) 的坐标定位优化为 O(log n)
 * 
 * 性能优化：
 * - getRowTop/getColLeft: O(n) → O(1)
 * - getRowAtY/getColAtX: O(n) → O(log n)
 */

import type { GeometryConfig, SizeAccess } from './types'

export class PositionIndex {
  /** 行顶部位置数组：rowTops[i] = 第 i 行的顶部 Y 坐标 */
  private rowTops: number[] = []
  /** 列左侧位置数组：colLefts[i] = 第 i 列的左侧 X 坐标 */
  private colLefts: number[] = []
  /** 总行数 */
  private _totalRows: number = 0
  /** 总列数 */
  private _totalCols: number = 0
  /** 脏标记 - 行索引需要重建 */
  private dirtyRows: boolean = true
  /** 脏标记 - 列索引需要重建 */
  private dirtyCols: boolean = true
  /** 几何配置缓存 */
  private cfg: GeometryConfig | null = null
  
  /**
   * 标记行索引需要重建
   */
  invalidateRows(): void {
    this.dirtyRows = true
  }
  
  /**
   * 标记列索引需要重建
   */
  invalidateCols(): void {
    this.dirtyCols = true
  }
  
  /**
   * 标记所有索引需要重建
   */
  invalidateAll(): void {
    this.dirtyRows = true
    this.dirtyCols = true
  }
  
  /**
   * 检查行索引是否有效
   */
  isRowsValid(): boolean {
    return !this.dirtyRows
  }
  
  /**
   * 检查列索引是否有效
   */
  isColsValid(): boolean {
    return !this.dirtyCols
  }
  
  /**
   * 重建行位置索引
   */
  rebuildRowIndex(
    sizes: SizeAccess,
    cfg: GeometryConfig,
    totalRows: number
  ): void {
    // 使用值比较而非引用比较，避免每次创建新 cfg 对象导致缓存失效
    const cfgUnchanged = this.cfg !== null &&
      this.cfg.defaultRowHeight === cfg.defaultRowHeight &&
      this.cfg.defaultColWidth === cfg.defaultColWidth &&
      this.cfg.rowHeaderWidth === cfg.rowHeaderWidth &&
      this.cfg.colHeaderHeight === cfg.colHeaderHeight
    
    if (!this.dirtyRows && this._totalRows === totalRows && cfgUnchanged) {
      return // 索引仍然有效
    }
    
    this.cfg = cfg
    this._totalRows = totalRows
    this.rowTops = new Array(totalRows + 1)
    this.rowTops[0] = 0
    
    for (let r = 0; r < totalRows; r++) {
      const height = this.getRowHeightInternal(r, sizes, cfg)
      this.rowTops[r + 1] = (this.rowTops[r] ?? 0) + height
    }
    
    this.dirtyRows = false
  }
  
  /**
   * 重建列位置索引
   */
  rebuildColIndex(
    sizes: SizeAccess,
    cfg: GeometryConfig,
    totalCols: number
  ): void {
    // 使用值比较而非引用比较，避免每次创建新 cfg 对象导致缓存失效
    const cfgUnchanged = this.cfg !== null &&
      this.cfg.defaultRowHeight === cfg.defaultRowHeight &&
      this.cfg.defaultColWidth === cfg.defaultColWidth &&
      this.cfg.rowHeaderWidth === cfg.rowHeaderWidth &&
      this.cfg.colHeaderHeight === cfg.colHeaderHeight
    
    if (!this.dirtyCols && this._totalCols === totalCols && cfgUnchanged) {
      return // 索引仍然有效
    }
    
    this.cfg = cfg
    this._totalCols = totalCols
    this.colLefts = new Array(totalCols + 1)
    this.colLefts[0] = 0
    
    for (let c = 0; c < totalCols; c++) {
      const width = this.getColWidthInternal(c, sizes, cfg)
      this.colLefts[c + 1] = (this.colLefts[c] ?? 0) + width
    }
    
    this.dirtyCols = false
  }
  
  /**
   * 内部方法：获取行高
   */
  private getRowHeightInternal(row: number, sizes: SizeAccess, cfg: GeometryConfig): number {
    if (sizes.hiddenRows?.has(row)) return 0
    return sizes.rowHeights.get(row) ?? cfg.defaultRowHeight
  }
  
  /**
   * 内部方法：获取列宽
   */
  private getColWidthInternal(col: number, sizes: SizeAccess, cfg: GeometryConfig): number {
    if (sizes.hiddenCols?.has(col)) return 0
    return sizes.colWidths.get(col) ?? cfg.defaultColWidth
  }
  
  /**
   * 获取行顶部位置 O(1)
   * @param row 行号
   * @returns 顶部 Y 坐标
   */
  getRowTop(row: number): number {
    if (row < 0) return 0
    if (row >= this.rowTops.length) {
      return this.rowTops[this.rowTops.length - 1] ?? 0
    }
    return this.rowTops[row] ?? 0
  }
  
  /**
   * 获取列左侧位置 O(1)
   * @param col 列号
   * @returns 左侧 X 坐标
   */
  getColLeft(col: number): number {
    if (col < 0) return 0
    if (col >= this.colLefts.length) {
      return this.colLefts[this.colLefts.length - 1] ?? 0
    }
    return this.colLefts[col] ?? 0
  }
  
  /**
   * 获取行高 O(1)
   * @param row 行号
   * @returns 行高
   */
  getRowHeight(row: number): number {
    if (row < 0 || row >= this._totalRows) return 0
    return (this.rowTops[row + 1] ?? 0) - (this.rowTops[row] ?? 0)
  }
  
  /**
   * 获取列宽 O(1)
   * @param col 列号
   * @returns 列宽
   */
  getColWidth(col: number): number {
    if (col < 0 || col >= this._totalCols) return 0
    return (this.colLefts[col + 1] ?? 0) - (this.colLefts[col] ?? 0)
  }
  
  /**
   * 获取总内容高度
   */
  getTotalHeight(): number {
    return this.rowTops[this._totalRows] ?? 0
  }
  
  /**
   * 获取总内容宽度
   */
  getTotalWidth(): number {
    return this.colLefts[this._totalCols] ?? 0
  }
  
  /**
   * 根据 Y 坐标查找行号 O(log n)
   * @param y Y 坐标（相对于内容区域顶部）
   * @returns 行号
   */
  getRowAtY(y: number): number {
    if (y <= 0) return 0
    if (y >= this.getTotalHeight()) return Math.max(0, this._totalRows - 1)
    
    // 二分查找
    let left = 0
    let right = this._totalRows - 1
    
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2)
      if ((this.rowTops[mid] ?? 0) <= y) {
        left = mid
      } else {
        right = mid - 1
      }
    }
    
    return left
  }
  
  /**
   * 根据 X 坐标查找列号 O(log n)
   * @param x X 坐标（相对于内容区域左侧）
   * @returns 列号
   */
  getColAtX(x: number): number {
    if (x <= 0) return 0
    if (x >= this.getTotalWidth()) return Math.max(0, this._totalCols - 1)
    
    // 二分查找
    let left = 0
    let right = this._totalCols - 1
    
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2)
      if ((this.colLefts[mid] ?? 0) <= x) {
        left = mid
      } else {
        right = mid - 1
      }
    }
    
    return left
  }
  
  /**
   * 获取可见范围（优化版本）
   */
  getVisibleRange(
    containerWidth: number,
    containerHeight: number,
    scrollTop: number,
    scrollLeft: number,
    cfg: GeometryConfig
  ): { startRow: number; endRow: number; startCol: number; endCol: number } {
    // 使用二分查找定位起始行列
    const startRow = this.getRowAtY(scrollTop)
    const startCol = this.getColAtX(scrollLeft)
    
    // 计算可见底部和右侧
    const visibleBottom = scrollTop + Math.max(0, containerHeight - cfg.colHeaderHeight)
    const visibleRight = scrollLeft + Math.max(0, containerWidth - cfg.rowHeaderWidth)
    
    // 使用二分查找定位结束行列
    let endRow = this.getRowAtY(visibleBottom)
    let endCol = this.getColAtX(visibleRight)
    
    // 确保结束行列包含部分可见的单元格
    if (endRow < this._totalRows - 1 && (this.rowTops[endRow + 1] ?? 0) <= visibleBottom) {
      endRow++
    }
    if (endCol < this._totalCols - 1 && (this.colLefts[endCol + 1] ?? 0) <= visibleRight) {
      endCol++
    }
    
    // 边界检查
    endRow = Math.min(this._totalRows - 1, Math.max(startRow, endRow))
    endCol = Math.min(this._totalCols - 1, Math.max(startCol, endCol))
    
    return { startRow, endRow, startCol, endCol }
  }
  
  /**
   * 行插入后增量更新索引
   * @param row 插入位置
   * @param count 插入数量
   * @param heights 新行的高度数组（可选，使用默认高度）
   */
  insertRows(row: number, count: number, defaultHeight: number, heights?: number[]): void {
    if (row > this._totalRows) row = this._totalRows
    
    // 计算新行的位置
    const insertPos = this.rowTops[row] ?? this.getTotalHeight()
    const newPositions: number[] = []
    let cumHeight = 0
    
    for (let i = 0; i < count; i++) {
      newPositions.push(insertPos + cumHeight)
      cumHeight += heights?.[i] ?? defaultHeight
    }
    
    // 插入新位置
    this.rowTops.splice(row, 0, ...newPositions)
    
    // 更新后续位置
    for (let r = row + count; r < this.rowTops.length; r++) {
      this.rowTops[r] = (this.rowTops[r] ?? 0) + cumHeight
    }
    
    this._totalRows += count
  }
  
  /**
   * 行删除后增量更新索引
   * @param row 删除位置
   * @param count 删除数量
   */
  deleteRows(row: number, count: number): void {
    if (row >= this._totalRows) return
    
    const actualCount = Math.min(count, this._totalRows - row)
    const deltaHeight = (this.rowTops[row + actualCount] ?? 0) - (this.rowTops[row] ?? 0)
    
    // 删除位置
    this.rowTops.splice(row, actualCount)
    
    // 更新后续位置
    for (let r = row; r < this.rowTops.length; r++) {
      this.rowTops[r] = (this.rowTops[r] ?? 0) - deltaHeight
    }
    
    this._totalRows -= actualCount
  }
  
  /**
   * 列插入后增量更新索引
   * @param col 插入位置
   * @param count 插入数量
   * @param widths 新列的宽度数组（可选，使用默认宽度）
   */
  insertCols(col: number, count: number, defaultWidth: number, widths?: number[]): void {
    if (col > this._totalCols) col = this._totalCols
    
    // 计算新列的位置
    const insertPos = this.colLefts[col] ?? this.getTotalWidth()
    const newPositions: number[] = []
    let cumWidth = 0
    
    for (let i = 0; i < count; i++) {
      newPositions.push(insertPos + cumWidth)
      cumWidth += widths?.[i] ?? defaultWidth
    }
    
    // 插入新位置
    this.colLefts.splice(col, 0, ...newPositions)
    
    // 更新后续位置
    for (let c = col + count; c < this.colLefts.length; c++) {
      this.colLefts[c] = (this.colLefts[c] ?? 0) + cumWidth
    }
    
    this._totalCols += count
  }
  
  /**
   * 列删除后增量更新索引
   * @param col 删除位置
   * @param count 删除数量
   */
  deleteCols(col: number, count: number): void {
    if (col >= this._totalCols) return
    
    const actualCount = Math.min(count, this._totalCols - col)
    const deltaWidth = (this.colLefts[col + actualCount] ?? 0) - (this.colLefts[col] ?? 0)
    
    // 删除位置
    this.colLefts.splice(col, actualCount)
    
    // 更新后续位置
    for (let c = col; c < this.colLefts.length; c++) {
      this.colLefts[c] = (this.colLefts[c] ?? 0) - deltaWidth
    }
    
    this._totalCols -= actualCount
  }
  
  /**
   * 更新单行高度
   * @param row 行号
   * @param newHeight 新高度
   */
  updateRowHeight(row: number, newHeight: number): void {
    if (row < 0 || row >= this._totalRows) return
    
    const oldHeight = (this.rowTops[row + 1] ?? 0) - (this.rowTops[row] ?? 0)
    const delta = newHeight - oldHeight
    
    if (delta === 0) return
    
    // 更新后续位置
    for (let r = row + 1; r <= this._totalRows; r++) {
      this.rowTops[r] = (this.rowTops[r] ?? 0) + delta
    }
  }
  
  /**
   * 更新单列宽度
   * @param col 列号
   * @param newWidth 新宽度
   */
  updateColWidth(col: number, newWidth: number): void {
    if (col < 0 || col >= this._totalCols) return
    
    const oldWidth = (this.colLefts[col + 1] ?? 0) - (this.colLefts[col] ?? 0)
    const delta = newWidth - oldWidth
    
    if (delta === 0) return
    
    // 更新后续位置
    for (let c = col + 1; c <= this._totalCols; c++) {
      this.colLefts[c] = (this.colLefts[c] ?? 0) + delta
    }
  }
  
  /**
   * 获取当前总行数
   */
  get totalRows(): number {
    return this._totalRows
  }
  
  /**
   * 获取当前总列数
   */
  get totalCols(): number {
    return this._totalCols
  }
}

/**
 * 创建位置索引实例
 */
export function createPositionIndex(): PositionIndex {
  return new PositionIndex()
}
