/**
 * API 封装模块
 * 提供给父组件调用的公开 API 接口
 */

import type { SelectedCell } from './rowcol'
import type { CellStyle, CellBorder, BorderEdge, CellFormat, MergedRegion, MergedCellInfo } from './types'

/**
 * 行列尺寸 API
 */
export interface RowColSizeAPI {
  /**
   * 获取行高
   */
  getRowHeight(row: number): number
  
  /**
   * 设置行高
   */
  setRowHeight(row: number, height: number): void
  
  /**
   * 获取列宽
   */
  getColWidth(col: number): number
  
  /**
   * 设置列宽
   */
  setColWidth(col: number, width: number): void
}

/**
 * 行列操作 API
 */
export interface RowColOperationAPI {
  /**
   * 在指定行上方插入行
   */
  insertRowAbove(row: number): Promise<void>
  
  /**
   * 在指定行下方插入行
   */
  insertRowBelow(row: number): Promise<void>
  
  /**
   * 删除指定行
   */
  deleteRow(row: number): Promise<void>
  
  /**
   * 在指定列左侧插入列
   */
  insertColLeft(col: number): Promise<void>
  
  /**
   * 在指定列右侧插入列
   */
  insertColRight(col: number): Promise<void>
  
  /**
   * 删除指定列
   */
  deleteCol(col: number): Promise<void>
}

/**
 * 选择 API
 */
export interface SelectionAPI {
  /**
   * 获取当前选中的单元格
   */
  getSelection(): { row: number; col: number }
  
  /**
   * 设置选中的单元格
   */
  setSelection(row: number, col: number): void
  
  /**
   * 获取选择范围
   */
  getSelectionRange(): {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  }
}

/**
 * 隐藏/显示 API
 */
export interface VisibilityAPI {
  /**
   * 隐藏行
   */
  hideRow(row: number): void
  
  /**
   * 取消隐藏行
   */
  unhideRow(row: number): void
  
  /**
   * 隐藏列
   */
  hideColumn(col: number): void
  
  /**
   * 取消隐藏列
   */
  unhideColumn(col: number): void
  
  /**
   * 设置网格线显示状态
   */
  setShowGridLines(show: boolean): void
  
  /**
   * 获取网格线显示状态
   */
  getShowGridLines(): boolean
}

/**
 * 冻结 API
 */
export interface FreezeAPI {
  /**
   * 设置冻结行数
   */
  setFrozenRows(count: number): void
  
  /**
   * 获取冻结行数
   */
  getFrozenRows(): number
  
  /**
   * 设置冻结列数
   */
  setFrozenColumns(count: number): void
  
  /**
   * 获取冻结列数
   */
  getFrozenColumns(): number
}

/**
 * 样式 API
 */
export interface StyleAPI {
  /**
   * 获取单元格样式
   */
  getCellStyle(row: number, col: number): CellStyle
  
  /**
   * 设置单元格样式（部分更新）
   */
  setCellStyle(row: number, col: number, style: Partial<CellStyle>): void
  
  /**
   * 清除单元格样式
   */
  clearCellStyle(row: number, col: number): void
  
  /**
   * 设置范围样式（批量）
   */
  setRangeStyle(startRow: number, startCol: number, endRow: number, endCol: number, style: Partial<CellStyle>): void
  
  // 快捷方法 - 字体样式
  /**
   * 设置粗体
   */
  setBold(row: number, col: number, bold: boolean): void
  
  /**
   * 设置斜体
   */
  setItalic(row: number, col: number, italic: boolean): void
  
  /**
   * 设置下划线
   */
  setUnderline(row: number, col: number, underline: boolean | 'single' | 'double'): void
  
  /**
   * 设置删除线
   */
  setStrikethrough(row: number, col: number, strikethrough: boolean): void
  
  // 快捷方法 - 字体属性
  /**
   * 设置字体
   */
  setFontFamily(row: number, col: number, fontFamily: string): void
  
  /**
   * 设置字号
   */
  setFontSize(row: number, col: number, fontSize: number): void
  
  // 快捷方法 - 颜色
  /**
   * 设置字体颜色
   */
  setTextColor(row: number, col: number, color: string): void
  
  /**
   * 设置背景色
   */
  setBackgroundColor(row: number, col: number, color: string): void
  
  // 快捷方法 - 对齐
  /**
   * 设置水平对齐
   */
  setTextAlign(row: number, col: number, align: 'left' | 'center' | 'right'): void
  
  /**
   * 设置垂直对齐
   */
  setVerticalAlign(row: number, col: number, align: 'top' | 'middle' | 'bottom'): void
  
  // 快捷方法 - 其他
  /**
   * 设置自动换行
   */
  setWrapText(row: number, col: number, wrap: boolean): void
  
  /**
   * 设置文字旋转角度
   */
  setTextRotation(row: number, col: number, rotation: number): void
}

/**
 * 边框 API
 */
export interface BorderAPI {
  /**
   * 获取单元格边框
   */
  getCellBorder(row: number, col: number): CellBorder | undefined
  
  /**
   * 设置单元格边框（部分更新）
   */
  setCellBorder(row: number, col: number, border: Partial<CellBorder>): void
  
  /**
   * 清除单元格边框
   */
  clearCellBorder(row: number, col: number): void
  
  /**
   * 设置范围边框（所有单元格全边框）
   */
  setRangeBorder(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    border: Partial<CellBorder>
  ): void
  
  /**
   * 设置范围外边框（只设置最外层）
   */
  setRangeOuterBorder(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    edge: BorderEdge
  ): void
  
  /**
   * 清除范围边框
   */
  clearRangeBorder(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): void
  
  // 快捷方法
  /**
   * 设置全边框（所有单元格四边都有边框）
   */
  setAllBorders(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    edge: BorderEdge
  ): void
  
  /**
   * 设置外边框（只有外围有边框）
   */
  setOuterBorder(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    edge: BorderEdge
  ): void
  
  /**
   * 清除所有边框
   */
  clearAllBorders(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): void
}

/**
 * 格式 API
 */
export interface FormatAPI {
  /**
   * 获取单元格格式
   */
  getCellFormat(row: number, col: number): CellFormat
  
  /**
   * 设置单元格格式
   */
  setCellFormat(row: number, col: number, format: CellFormat): void
  
  /**
   * 清除单元格格式
   */
  clearCellFormat(row: number, col: number): void
  
  /**
   * 批量设置范围格式
   */
  setRangeFormat(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    format: CellFormat
  ): void
  
  /**
   * 获取格式化后的显示值
   */
  getFormattedValue(row: number, col: number): string
}

/**
 * 合并单元格 API
 */
export interface MergeAPI {
  /**
   * 合并单元格
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @returns 是否成功（如果有冲突则返回 false）
   */
  mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): boolean
  
  /**
   * 取消合并单元格
   * @param row 合并区域内任意单元格的行
   * @param col 合并区域内任意单元格的列
   * @returns 被取消的合并区域，如果不存在则返回 null
   */
  unmergeCells(row: number, col: number): MergedRegion | null
  
  /**
   * 检查是否可以合并指定范围
   * @returns 是否可以合并（不与现有合并区域冲突）
   */
  canMerge(startRow: number, startCol: number, endRow: number, endCol: number): boolean
  
  /**
   * 获取单元格的合并信息
   */
  getMergedCellInfo(row: number, col: number): MergedCellInfo
  
  /**
   * 获取包含指定单元格的合并区域
   */
  getMergedRegion(row: number, col: number): MergedRegion | null
  
  /**
   * 获取所有合并区域
   */
  getAllMergedRegions(): MergedRegion[]
  
  /**
   * 检查合并操作是否会丢失数据
   * @returns 是否会丢失数据（除主单元格外还有其他单元格有值）
   */
  hasDataToLose(startRow: number, startCol: number, endRow: number, endCol: number): boolean
  
  /**
   * 合并当前选择范围
   * @returns 是否成功
   */
  mergeSelection(): boolean
  
  /**
   * 取消当前选择范围内的所有合并
   */
  unmergeSelection(): void
}

/**
 * 撤销还原 API
 */
export interface UndoRedoAPI {
  /**
   * 撤销上一步操作
   * @returns 是否成功撤销
   */
  undo(): boolean
  
  /**
   * 还原上一步撤销的操作
   * @returns 是否成功还原
   */
  redo(): boolean
  
  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean
  
  /**
   * 检查是否可以还原
   */
  canRedo(): boolean
}

/**
 * 完整的公开 API
 */
export interface SheetAPI extends RowColSizeAPI, RowColOperationAPI, SelectionAPI, VisibilityAPI, FreezeAPI, StyleAPI, BorderAPI, FormatAPI, MergeAPI, UndoRedoAPI {
  /**
   * 刷新绘制
   */
  redraw(): void
  
  /**
   * 获取单元格值
   */
  getCellValue(row: number, col: number): string
  
  /**
   * 设置单元格值
   */
  setCellValue(row: number, col: number, value: string): void
}

/**
 * 创建 API 实现
 */
export function createSheetAPI(context: {
  // 尺寸相关
  getRowHeight: (row: number) => number
  getColWidth: (col: number) => number
  rowHeights: Map<number, number>
  colWidths: Map<number, number>
  
  // 行列操作
  insertRowAbove: (row: number) => Promise<void>
  insertRowBelow: (row: number) => Promise<void>
  deleteRow: (row: number) => Promise<void>
  insertColLeft: (col: number) => Promise<void>
  insertColRight: (col: number) => Promise<void>
  deleteCol: (col: number) => Promise<void>
  
  // 选择相关
  selected: SelectedCell
  selectionRange: {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  }
  
  // 单元格值
  getCellValue: (row: number, col: number) => string
  setCellValue: (row: number, col: number, value: string) => void
  
  // 样式相关
  getCellStyleFn: (row: number, col: number) => CellStyle
  setCellStyleFn: (row: number, col: number, style: Partial<CellStyle>) => void
  clearCellStyleFn: (row: number, col: number) => void
  setRangeStyleFn: (startRow: number, startCol: number, endRow: number, endCol: number, style: Partial<CellStyle>) => void
  
  // 边框相关
  getCellBorderFn: (row: number, col: number) => CellBorder | undefined
  setCellBorderFn: (row: number, col: number, border: Partial<CellBorder>) => void
  clearCellBorderFn: (row: number, col: number) => void
  setRangeBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number, border: Partial<CellBorder>) => void
  setRangeOuterBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number, edge: BorderEdge) => void
  clearRangeBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number) => void
  
  // 绘制
  draw: () => void
  
  // 隐藏/显示（预留，当前可能未实现）
  hiddenRows?: Set<number>
  hiddenCols?: Set<number>
  showGridLines?: boolean
  setShowGridLinesFn?: (show: boolean) => void
  getShowGridLinesFn?: () => boolean
  
  // 冻结（预留，当前可能未实现）
  frozenRows?: number
  frozenCols?: number
  
  // 格式相关
  getCellFormatFn: (row: number, col: number) => CellFormat
  setCellFormatFn: (row: number, col: number, format: CellFormat) => void
  clearCellFormatFn: (row: number, col: number) => void
  setRangeFormatFn: (startRow: number, startCol: number, endRow: number, endCol: number, format: CellFormat) => void
  getFormattedValueFn: (row: number, col: number) => string
  
  // 合并单元格相关
  mergeCellsFn: (startRow: number, startCol: number, endRow: number, endCol: number) => boolean
  unmergeCellsFn: (row: number, col: number) => MergedRegion | null
  canMergeFn: (startRow: number, startCol: number, endRow: number, endCol: number) => boolean
  getMergedCellInfoFn: (row: number, col: number) => MergedCellInfo
  getMergedRegionFn: (row: number, col: number) => MergedRegion | null
  getAllMergedRegionsFn: () => MergedRegion[]
  hasDataToLoseFn: (startRow: number, startCol: number, endRow: number, endCol: number) => boolean
  
  // 撤销还原相关
  undoFn: () => boolean
  redoFn: () => boolean
  canUndoFn: () => boolean
  canRedoFn: () => boolean
}): SheetAPI {
  return {
    // 行高列宽
    getRowHeight: context.getRowHeight,
    getColWidth: context.getColWidth,
    setRowHeight(row: number, height: number): void {
      context.rowHeights.set(row, height)
      context.draw()
    },
    setColWidth(col: number, width: number): void {
      context.colWidths.set(col, width)
      context.draw()
    },
    
    // 行列操作
    insertRowAbove: context.insertRowAbove,
    insertRowBelow: context.insertRowBelow,
    deleteRow: context.deleteRow,
    insertColLeft: context.insertColLeft,
    insertColRight: context.insertColRight,
    deleteCol: context.deleteCol,
    
    // 选择
    getSelection(): { row: number; col: number } {
      return {
        row: context.selected.row,
        col: context.selected.col
      }
    },
    setSelection(row: number, col: number): void {
      context.selected.row = row
      context.selected.col = col
      context.selectionRange.startRow = -1
      context.selectionRange.startCol = -1
      context.selectionRange.endRow = -1
      context.selectionRange.endCol = -1
      context.draw()
    },
    getSelectionRange() {
      return {
        startRow: context.selectionRange.startRow,
        startCol: context.selectionRange.startCol,
        endRow: context.selectionRange.endRow,
        endCol: context.selectionRange.endCol
      }
    },
    
    // 隐藏/显示（预留，当前可能未实现）
    hideRow(row: number): void {
      if (context.hiddenRows) {
        context.hiddenRows.add(row)
        context.draw()
      }
    },
    unhideRow(row: number): void {
      if (context.hiddenRows) {
        context.hiddenRows.delete(row)
        context.draw()
      }
    },
    hideColumn(col: number): void {
      if (context.hiddenCols) {
        context.hiddenCols.add(col)
        context.draw()
      }
    },
    unhideColumn(col: number): void {
      if (context.hiddenCols) {
        context.hiddenCols.delete(col)
        context.draw()
      }
    },
    setShowGridLines(show: boolean): void {
      if (context.setShowGridLinesFn) {
        context.setShowGridLinesFn(show)
      } else if (context.showGridLines !== undefined) {
        context.showGridLines = show
        context.draw()
      }
    },
    getShowGridLines(): boolean {
      if (context.getShowGridLinesFn) {
        return context.getShowGridLinesFn()
      }
      return context.showGridLines ?? true
    },
    
    // 冻结（预留，当前可能未实现）
    setFrozenRows(count: number): void {
      if (context.frozenRows !== undefined) {
        context.frozenRows = count
        context.draw()
      }
    },
    getFrozenRows(): number {
      return context.frozenRows ?? 0
    },
    setFrozenColumns(count: number): void {
      if (context.frozenCols !== undefined) {
        context.frozenCols = count
        context.draw()
      }
    },
    getFrozenColumns(): number {
      return context.frozenCols ?? 0
    },
    
    // 其他
    redraw: context.draw,
    getCellValue: context.getCellValue,
    setCellValue: context.setCellValue,
    
    // 样式 API
    getCellStyle: context.getCellStyleFn,
    setCellStyle(row: number, col: number, style: Partial<CellStyle>): void {
      context.setCellStyleFn(row, col, style)
      context.draw()
    },
    clearCellStyle(row: number, col: number): void {
      context.clearCellStyleFn(row, col)
      context.draw()
    },
    setRangeStyle(startRow: number, startCol: number, endRow: number, endCol: number, style: Partial<CellStyle>): void {
      context.setRangeStyleFn(startRow, startCol, endRow, endCol, style)
      context.draw()
    },
    
    // 快捷方法 - 字体样式
    setBold(row: number, col: number, bold: boolean): void {
      context.setCellStyleFn(row, col, { bold })
      context.draw()
    },
    setItalic(row: number, col: number, italic: boolean): void {
      context.setCellStyleFn(row, col, { italic })
      context.draw()
    },
    setUnderline(row: number, col: number, underline: boolean | 'single' | 'double'): void {
      context.setCellStyleFn(row, col, { underline })
      context.draw()
    },
    setStrikethrough(row: number, col: number, strikethrough: boolean): void {
      context.setCellStyleFn(row, col, { strikethrough })
      context.draw()
    },
    
    // 快捷方法 - 字体属性
    setFontFamily(row: number, col: number, fontFamily: string): void {
      context.setCellStyleFn(row, col, { fontFamily })
      context.draw()
    },
    setFontSize(row: number, col: number, fontSize: number): void {
      context.setCellStyleFn(row, col, { fontSize })
      context.draw()
    },
    
    // 快捷方法 - 颜色
    setTextColor(row: number, col: number, color: string): void {
      context.setCellStyleFn(row, col, { color })
      context.draw()
    },
    setBackgroundColor(row: number, col: number, color: string): void {
      context.setCellStyleFn(row, col, { backgroundColor: color })
      context.draw()
    },
    
    // 快捷方法 - 对齐
    setTextAlign(row: number, col: number, align: 'left' | 'center' | 'right'): void {
      context.setCellStyleFn(row, col, { textAlign: align })
      context.draw()
    },
    setVerticalAlign(row: number, col: number, align: 'top' | 'middle' | 'bottom'): void {
      context.setCellStyleFn(row, col, { verticalAlign: align })
      context.draw()
    },
    
    // 快捷方法 - 其他
    setWrapText(row: number, col: number, wrap: boolean): void {
      context.setCellStyleFn(row, col, { wrapText: wrap })
      context.draw()
    },
    setTextRotation(row: number, col: number, rotation: number): void {
      context.setCellStyleFn(row, col, { textRotation: rotation })
      context.draw()
    },
    
    // ==================== 边框 API ====================
    
    // 基础方法
    getCellBorder: context.getCellBorderFn,
    setCellBorder(row: number, col: number, border: Partial<CellBorder>): void {
      context.setCellBorderFn(row, col, border)
      context.draw()
    },
    clearCellBorder(row: number, col: number): void {
      context.clearCellBorderFn(row, col)
      context.draw()
    },
    setRangeBorder(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      border: Partial<CellBorder>
    ): void {
      context.setRangeBorderFn(startRow, startCol, endRow, endCol, border)
      context.draw()
    },
    setRangeOuterBorder(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      edge: BorderEdge
    ): void {
      context.setRangeOuterBorderFn(startRow, startCol, endRow, endCol, edge)
      context.draw()
    },
    clearRangeBorder(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number
    ): void {
      context.clearRangeBorderFn(startRow, startCol, endRow, endCol)
      context.draw()
    },
    
    // 快捷方法
    setAllBorders(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      edge: BorderEdge
    ): void {
      const border: CellBorder = {
        top: edge,
        right: edge,
        bottom: edge,
        left: edge
      }
      context.setRangeBorderFn(startRow, startCol, endRow, endCol, border)
      context.draw()
    },
    setOuterBorder(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      edge: BorderEdge
    ): void {
      context.setRangeOuterBorderFn(startRow, startCol, endRow, endCol, edge)
      context.draw()
    },
    clearAllBorders(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number
    ): void {
      context.clearRangeBorderFn(startRow, startCol, endRow, endCol)
      context.draw()
    },
    
    // ==================== 格式 API ====================
    
    getCellFormat: context.getCellFormatFn,
    setCellFormat(row: number, col: number, format: CellFormat): void {
      context.setCellFormatFn(row, col, format)
      context.draw()
    },
    clearCellFormat(row: number, col: number): void {
      context.clearCellFormatFn(row, col)
      context.draw()
    },
    setRangeFormat(
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      format: CellFormat
    ): void {
      context.setRangeFormatFn(startRow, startCol, endRow, endCol, format)
      context.draw()
    },
    getFormattedValue: context.getFormattedValueFn,
    
    // ==================== 合并单元格 API ====================
    
    mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
      const result = context.mergeCellsFn(startRow, startCol, endRow, endCol)
      if (result) {
        context.draw()
      }
      return result
    },
    
    unmergeCells(row: number, col: number): MergedRegion | null {
      const result = context.unmergeCellsFn(row, col)
      if (result) {
        context.draw()
      }
      return result
    },
    
    canMerge: context.canMergeFn,
    getMergedCellInfo: context.getMergedCellInfoFn,
    getMergedRegion: context.getMergedRegionFn,
    getAllMergedRegions: context.getAllMergedRegionsFn,
    hasDataToLose: context.hasDataToLoseFn,
    
    mergeSelection(): boolean {
      const { startRow, startCol, endRow, endCol } = context.selectionRange
      if (startRow < 0 || startCol < 0) {
        // 没有选择范围，尝试使用单选
        const { row, col } = context.selected
        if (row >= 0 && col >= 0) {
          // 单个单元格无法合并
          return false
        }
        return false
      }
      const result = context.mergeCellsFn(startRow, startCol, endRow, endCol)
      if (result) {
        context.draw()
      }
      return result
    },
    
    unmergeSelection(): void {
      const { startRow, startCol, endRow, endCol } = context.selectionRange
      let hasUnmerged = false
      
      if (startRow >= 0 && startCol >= 0) {
        // 遍历选择范围内的所有单元格，取消所有合并
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const result = context.unmergeCellsFn(r, c)
            if (result) {
              hasUnmerged = true
            }
          }
        }
      } else {
        // 没有范围选择，尝试取消单选单元格所在的合并
        const { row, col } = context.selected
        if (row >= 0 && col >= 0) {
          const result = context.unmergeCellsFn(row, col)
          if (result) {
            hasUnmerged = true
          }
        }
      }
      
      if (hasUnmerged) {
        context.draw()
      }
    },
    
    // ==================== 撤销还原 API ====================
    
    undo(): boolean {
      const result = context.undoFn()
      if (result) {
        context.draw()
      }
      return result
    },
    
    redo(): boolean {
      const result = context.redoFn()
      if (result) {
        context.draw()
      }
      return result
    },
    
    canUndo: context.canUndoFn,
    canRedo: context.canRedoFn
  }
}
