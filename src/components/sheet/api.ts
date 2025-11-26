/**
 * API 封装模块
 * 提供给父组件调用的公开 API 接口
 */

import type { SelectedCell } from './rowcol'

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
 * 完整的公开 API
 */
export interface SheetAPI extends RowColSizeAPI, RowColOperationAPI, SelectionAPI, VisibilityAPI, FreezeAPI {
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
  
  // 绘制
  draw: () => void
  
  // 隐藏/显示（预留，当前可能未实现）
  hiddenRows?: Set<number>
  hiddenCols?: Set<number>
  showGridLines?: boolean
  
  // 冻结（预留，当前可能未实现）
  frozenRows?: number
  frozenCols?: number
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
      if (context.showGridLines !== undefined) {
        context.showGridLines = show
        context.draw()
      }
    },
    getShowGridLines(): boolean {
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
    setCellValue: context.setCellValue
  }
}
