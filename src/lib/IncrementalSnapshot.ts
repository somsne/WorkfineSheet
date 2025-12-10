/**
 * 增量快照管理器
 * 
 * 提供基于变更的增量快照机制，替代全量复制：
 * 1. 只记录实际变化的数据（而非完整 Map 复制）
 * 2. 支持高效的撤销/重做操作
 * 3. 大幅降低内存使用和创建时间
 * 
 * 设计思路：
 * - 操作前收集受影响区域的旧数据（用于撤销）
 * - 操作后收集变化后的新数据（用于重做）
 * - 使用 Map 存储 delta，key 为 "row,col" 格式
 */

import type { CellStyle, CellBorder, CellFormat, MergedRegion } from '../components/sheet/types'
import type { Cell, CellKey } from './SheetModel'
import type { SheetModel } from './SheetModel'

/**
 * 单元格快照数据（包含一个单元格的所有相关信息）
 */
export interface CellSnapshot {
  cell?: Cell
  style?: CellStyle
  border?: CellBorder
  format?: CellFormat
}

/**
 * 行高快照
 */
export type RowHeightsSnapshot = Map<number, number>

/**
 * 列宽快照
 */
export type ColWidthsSnapshot = Map<number, number>

/**
 * 合并区域快照
 */
export interface MergeSnapshot {
  mergedRegions: Map<CellKey, MergedRegion>
  mergedCellIndex: Map<CellKey, CellKey>
}

/**
 * 增量快照 - 只存储变化的数据
 */
export interface IncrementalSnapshotData {
  /** 变化的单元格（key: "row,col"） */
  cells: Map<CellKey, CellSnapshot>
  /** 合并区域变化 */
  merges?: MergeSnapshot
  /** 行高变化 */
  rowHeights?: RowHeightsSnapshot
  /** 列宽变化 */
  colWidths?: ColWidthsSnapshot
  /** 总行数 */
  totalRows?: number
  /** 总列数 */
  totalCols?: number
}

/**
 * 增量快照创建器
 * 用于在操作前后收集变化数据
 */
export class IncrementalSnapshotBuilder {
  private model: SheetModel
  private beforeData: IncrementalSnapshotData
  private afterData: IncrementalSnapshotData | null = null
  private affectedKeys: Set<CellKey>
  
  constructor(model: SheetModel) {
    this.model = model
    this.beforeData = {
      cells: new Map()
    }
    this.affectedKeys = new Set()
  }
  
  /**
   * 捕获指定范围内单元格的当前状态
   * @param startRow 起始行
   * @param endRow 结束行（包含）
   * @param startCol 起始列
   * @param endCol 结束列（包含）
   */
  captureRange(startRow: number, endRow: number, startCol: number, endCol: number): this {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.captureCell(r, c)
      }
    }
    return this
  }
  
  /**
   * 捕获单个单元格的当前状态
   */
  captureCell(row: number, col: number): this {
    const key: CellKey = `${row},${col}`
    if (this.affectedKeys.has(key)) return this
    
    this.affectedKeys.add(key)
    this.beforeData.cells.set(key, this.getCellSnapshot(row, col))
    return this
  }
  
  /**
   * 捕获指定行范围（从某行到末尾）的所有有数据的单元格
   * 用于行插入/删除操作
   */
  captureRowsFrom(startRow: number): this {
    // 遍历 cells Map，找到所有 >= startRow 的单元格
    for (const key of this.model.cellsKeys()) {
      const [r] = key.split(',').map(Number)
      if (r! >= startRow) {
        this.affectedKeys.add(key)
        const [row, col] = key.split(',').map(Number)
        this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
      }
    }
    // 同样处理样式和边框
    for (const key of this.model.cellStylesKeys()) {
      if (!this.affectedKeys.has(key)) {
        const [r] = key.split(',').map(Number)
        if (r! >= startRow) {
          this.affectedKeys.add(key)
          const [row, col] = key.split(',').map(Number)
          this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
        }
      }
    }
    for (const key of this.model.cellBordersKeys()) {
      if (!this.affectedKeys.has(key)) {
        const [r] = key.split(',').map(Number)
        if (r! >= startRow) {
          this.affectedKeys.add(key)
          const [row, col] = key.split(',').map(Number)
          this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
        }
      }
    }
    for (const key of this.model.cellFormatsKeys()) {
      if (!this.affectedKeys.has(key)) {
        const [r] = key.split(',').map(Number)
        if (r! >= startRow) {
          this.affectedKeys.add(key)
          const [row, col] = key.split(',').map(Number)
          this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
        }
      }
    }
    return this
  }
  
  /**
   * 捕获指定列范围（从某列到末尾）的所有有数据的单元格
   * 用于列插入/删除操作
   */
  captureColsFrom(startCol: number): this {
    for (const key of this.model.cellsKeys()) {
      const parts = key.split(',')
      const c = Number(parts[1])
      if (c >= startCol) {
        this.affectedKeys.add(key)
        const [row, col] = parts.map(Number)
        this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
      }
    }
    for (const key of this.model.cellStylesKeys()) {
      if (!this.affectedKeys.has(key)) {
        const parts = key.split(',')
        const c = Number(parts[1])
        if (c >= startCol) {
          this.affectedKeys.add(key)
          const [row, col] = parts.map(Number)
          this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
        }
      }
    }
    for (const key of this.model.cellBordersKeys()) {
      if (!this.affectedKeys.has(key)) {
        const parts = key.split(',')
        const c = Number(parts[1])
        if (c >= startCol) {
          this.affectedKeys.add(key)
          const [row, col] = parts.map(Number)
          this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
        }
      }
    }
    for (const key of this.model.cellFormatsKeys()) {
      if (!this.affectedKeys.has(key)) {
        const parts = key.split(',')
        const c = Number(parts[1])
        if (c >= startCol) {
          this.affectedKeys.add(key)
          const [row, col] = parts.map(Number)
          this.beforeData.cells.set(key, this.getCellSnapshot(row!, col!))
        }
      }
    }
    return this
  }
  
  /**
   * 捕获合并区域状态
   */
  captureMerges(): this {
    this.beforeData.merges = {
      mergedRegions: new Map(this.model.getMergedRegionsMap()),
      mergedCellIndex: new Map(this.model.getMergedCellIndexMap())
    }
    return this
  }
  
  /**
   * 捕获行高状态
   */
  captureRowHeights(rowHeights: Map<number, number>): this {
    this.beforeData.rowHeights = new Map(rowHeights)
    return this
  }
  
  /**
   * 捕获列宽状态
   */
  captureColWidths(colWidths: Map<number, number>): this {
    this.beforeData.colWidths = new Map(colWidths)
    return this
  }
  
  /**
   * 捕获总行列数
   */
  captureTotals(totalRows: number, totalCols: number): this {
    this.beforeData.totalRows = totalRows
    this.beforeData.totalCols = totalCols
    return this
  }
  
  /**
   * 完成操作后，创建 after 快照
   * 只捕获已标记为受影响的单元格
   * 
   * @param collectNew 是否收集新增的单元格（默认 false，避免收集无关数据）
   */
  finalize(collectNew: boolean = false): { before: IncrementalSnapshotData; after: IncrementalSnapshotData } {
    this.afterData = {
      cells: new Map()
    }
    
    // 重新收集已变化位置的当前状态
    for (const key of this.affectedKeys) {
      const [row, col] = key.split(',').map(Number)
      this.afterData.cells.set(key, this.getCellSnapshot(row!, col!))
    }
    
    // 可选：同时收集可能新增的单元格
    // （操作后可能有新位置被写入，用于行插入等场景）
    if (collectNew) {
      this.collectNewCells()
    }
    
    // 复制合并区域
    if (this.beforeData.merges) {
      this.afterData.merges = {
        mergedRegions: new Map(this.model.getMergedRegionsMap()),
        mergedCellIndex: new Map(this.model.getMergedCellIndexMap())
      }
    }
    
    return {
      before: this.beforeData,
      after: this.afterData
    }
  }
  
  /**
   * 完成后捕获新的行高/列宽/总数
   * @param collectNew 是否收集新增的单元格
   */
  finalizeWithSizes(
    rowHeights?: Map<number, number>,
    colWidths?: Map<number, number>,
    totalRows?: number,
    totalCols?: number,
    collectNew: boolean = false
  ): { before: IncrementalSnapshotData; after: IncrementalSnapshotData } {
    const result = this.finalize(collectNew)
    
    if (rowHeights && this.beforeData.rowHeights) {
      result.after.rowHeights = new Map(rowHeights)
    }
    if (colWidths && this.beforeData.colWidths) {
      result.after.colWidths = new Map(colWidths)
    }
    if (totalRows !== undefined && this.beforeData.totalRows !== undefined) {
      result.after.totalRows = totalRows
    }
    if (totalCols !== undefined && this.beforeData.totalCols !== undefined) {
      result.after.totalCols = totalCols
    }
    
    return result
  }
  
  /**
   * 获取单个单元格的完整快照
   */
  private getCellSnapshot(row: number, col: number): CellSnapshot {
    const snapshot: CellSnapshot = {}
    
    const cell = this.model.getCell(row, col)
    if (cell) {
      snapshot.cell = { ...cell }
    }
    
    const style = this.model.getCellStyle(row, col)
    if (style) {
      snapshot.style = { ...style }
    }
    
    const border = this.model.getCellBorder(row, col)
    if (border) {
      snapshot.border = { ...border }
    }
    
    const format = this.model.getCellFormat(row, col)
    if (format) {
      snapshot.format = { ...format }
    }
    
    return snapshot
  }
  
  /**
   * 收集操作后新增的单元格
   * 检查 model 中所有数据，找到不在 affectedKeys 中的新 key
   */
  private collectNewCells(): void {
    // 检查当前 model 中是否有新的 key
    for (const key of this.model.cellsKeys()) {
      if (!this.affectedKeys.has(key)) {
        const [row, col] = key.split(',').map(Number)
        this.affectedKeys.add(key)
        // before 中不存在，设为空
        this.beforeData.cells.set(key, {})
        this.afterData!.cells.set(key, this.getCellSnapshot(row!, col!))
      }
    }
    for (const key of this.model.cellStylesKeys()) {
      if (!this.affectedKeys.has(key)) {
        const [row, col] = key.split(',').map(Number)
        this.affectedKeys.add(key)
        this.beforeData.cells.set(key, {})
        this.afterData!.cells.set(key, this.getCellSnapshot(row!, col!))
      }
    }
    for (const key of this.model.cellBordersKeys()) {
      if (!this.affectedKeys.has(key)) {
        const [row, col] = key.split(',').map(Number)
        this.affectedKeys.add(key)
        this.beforeData.cells.set(key, {})
        this.afterData!.cells.set(key, this.getCellSnapshot(row!, col!))
      }
    }
    for (const key of this.model.cellFormatsKeys()) {
      if (!this.affectedKeys.has(key)) {
        const [row, col] = key.split(',').map(Number)
        this.affectedKeys.add(key)
        this.beforeData.cells.set(key, {})
        this.afterData!.cells.set(key, this.getCellSnapshot(row!, col!))
      }
    }
  }
}

/**
 * 从增量快照恢复模型状态
 */
export function restoreFromIncrementalSnapshot(
  model: SheetModel,
  snapshot: IncrementalSnapshotData,
  rowHeightsSetter?: (heights: Map<number, number>) => void,
  colWidthsSetter?: (widths: Map<number, number>) => void,
  totalRowsSetter?: (count: number) => void,
  totalColsSetter?: (count: number) => void
): void {
  // 恢复单元格数据
  for (const [key, cellSnapshot] of snapshot.cells) {
    const [row, col] = key.split(',').map(Number)
    
    // 恢复值
    if (cellSnapshot.cell) {
      model.setCellRaw(row!, col!, cellSnapshot.cell)
    } else {
      model.deleteCell(row!, col!)
    }
    
    // 恢复样式（使用 setCellStyleRaw 完全替换，不合并）
    if (cellSnapshot.style) {
      model.setCellStyleRaw(row!, col!, cellSnapshot.style)
    } else {
      model.deleteCellStyle(row!, col!)
    }
    
    // 恢复边框
    if (cellSnapshot.border) {
      model.setCellBorder(row!, col!, cellSnapshot.border)
    } else {
      model.deleteCellBorder(row!, col!)
    }
    
    // 恢复格式
    if (cellSnapshot.format) {
      model.setCellFormat(row!, col!, cellSnapshot.format)
    } else {
      model.deleteCellFormat(row!, col!)
    }
  }
  
  // 恢复合并区域
  if (snapshot.merges) {
    model.setMergedRegionsMap(snapshot.merges.mergedRegions)
    model.setMergedCellIndexMap(snapshot.merges.mergedCellIndex)
  }
  
  // 恢复行高
  if (snapshot.rowHeights && rowHeightsSetter) {
    rowHeightsSetter(new Map(snapshot.rowHeights))
  }
  
  // 恢复列宽
  if (snapshot.colWidths && colWidthsSetter) {
    colWidthsSetter(new Map(snapshot.colWidths))
  }
  
  // 恢复总行数
  if (snapshot.totalRows !== undefined && totalRowsSetter) {
    totalRowsSetter(snapshot.totalRows)
  }
  
  // 恢复总列数
  if (snapshot.totalCols !== undefined && totalColsSetter) {
    totalColsSetter(snapshot.totalCols)
  }
}

/**
 * 创建增量快照构建器的便捷函数
 */
export function createIncrementalSnapshot(model: SheetModel): IncrementalSnapshotBuilder {
  return new IncrementalSnapshotBuilder(model)
}
