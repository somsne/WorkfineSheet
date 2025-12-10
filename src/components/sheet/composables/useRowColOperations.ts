/**
 * useRowColOperations - 电子表格行列操作 composable
 * 封装插入/删除行列、调整行高列宽相关的方法
 */

import {
  insertRowsAboveBatch,
  deleteRow as deleteRowHelper,
  insertColsLeftBatch,
  deleteCol as deleteColHelper,
  showSetRowHeightDialog as showSetRowHeightDialogHelper,
  showSetColWidthDialog as showSetColWidthDialogHelper,
  type RowColConfig
} from '../rowcol'
import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'

export interface UseRowColOperationsOptions {
  state: SheetState
  geometry: SheetGeometry
  onDraw: () => void
  /** 可选的 UndoRedo 执行器，如果提供则使用它而不是 state.undoRedo（用于添加 sheetId） */
  undoRedoExecutor?: {
    execute(action: { name: string; undo: () => void; redo: () => void }): void
    record(action: { name: string; undo: () => void; redo: () => void }): void
  }
  /** 检测是否处于批量操作模式（如果是则跳过中间渲染） */
  isInBatchMode?: () => boolean
}

export function useRowColOperations({ state, geometry, onDraw, undoRedoExecutor, isInBatchMode }: UseRowColOperationsOptions) {
  const {
    constants,
    model, formulaSheet, undoRedo,
    rowHeights, colWidths, manualRowHeights,
    hiddenRows, hiddenCols,
    totalRows, totalCols,
    selected,
    inputDialog,
    saveRowHeightsSnapshot, restoreRowHeights,
    saveColWidthsSnapshot, restoreColWidths
  } = state
  
  // 使用传入的执行器或默认的 undoRedo
  const undoRedoExec = undoRedoExecutor ?? undoRedo
  
  const { getRowHeight, getColWidth } = geometry
  
  /**
   * 创建行列配置对象
   * @param forceSkipRedraw 强制跳过重绘（用于批量操作内部循环）
   */
  function createRowColConfig(forceSkipRedraw: boolean = false): RowColConfig {
    // 在 batch 模式时自动跳过重绘
    const shouldSkipRedraw = forceSkipRedraw || (isInBatchMode?.() ?? false)
    return {
      formulaSheet,
      sizeConfig: {
        rowHeights: rowHeights.value,
        colWidths: colWidths.value,
        defaultRowHeight: constants.ROW_HEIGHT,
        defaultColWidth: constants.COL_WIDTH,
        totalRows: totalRows.value,
        totalCols: totalCols.value
      },
      selected,
      onRedraw: onDraw,
      skipRedraw: shouldSkipRedraw
    }
  }
  
  // ==================== 行操作 ====================
  
  /**
   * 在指定行上方插入行（支持批量插入 - 使用优化的批量函数）
   */
  async function insertRowAbove(row: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const rowHeightsSnapshot = saveRowHeightsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    const oldTotalRows = totalRows.value
    
    // 使用优化的批量插入函数（一次性移动所有内容）
    await insertRowsAboveBatch(row, count, createRowColConfig())
    
    // 自动扩展总行数
    totalRows.value += count
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    const newTotalRows = totalRows.value
    
    const actionName = count > 1 
      ? `在第 ${row + 1} 行上方插入 ${count} 行`
      : `在第 ${row + 1} 行上方插入行`
    
    undoRedoExec.record({
      name: actionName,
      undo: () => {
        model.restoreFromSnapshot(modelSnapshot)
        restoreRowHeights(rowHeightsSnapshot)
        totalRows.value = oldTotalRows
        selected.row = oldSelected.row
        selected.col = oldSelected.col
        onDraw()
      },
      redo: () => {
        model.restoreFromSnapshot(newModelSnapshot)
        restoreRowHeights(newRowHeightsSnapshot)
        totalRows.value = newTotalRows
        selected.row = newSelected.row
        selected.col = newSelected.col
        onDraw()
      }
    })
    
  }
  
  /**
   * 在指定行下方插入行（支持批量插入 - 使用优化的批量函数）
   */
  async function insertRowBelow(row: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const rowHeightsSnapshot = saveRowHeightsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    const oldTotalRows = totalRows.value
    
    // 使用优化的批量插入函数（在 row+1 的上方插入）
    await insertRowsAboveBatch(row + 1, count, createRowColConfig())
    
    // 自动扩展总行数
    totalRows.value += count
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    const newTotalRows = totalRows.value
    
    const actionName = count > 1 
      ? `在第 ${row + 1} 行下方插入 ${count} 行`
      : `在第 ${row + 1} 行下方插入行`
    
    undoRedoExec.record({
      name: actionName,
      undo: () => {
        model.restoreFromSnapshot(modelSnapshot)
        restoreRowHeights(rowHeightsSnapshot)
        totalRows.value = oldTotalRows
        selected.row = oldSelected.row
        selected.col = oldSelected.col
        onDraw()
      },
      redo: () => {
        model.restoreFromSnapshot(newModelSnapshot)
        restoreRowHeights(newRowHeightsSnapshot)
        totalRows.value = newTotalRows
        selected.row = newSelected.row
        selected.col = newSelected.col
        onDraw()
      }
    })
  }
  
  /**
   * 删除指定行（支持批量删除）
   */
  async function deleteRow(row: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const rowHeightsSnapshot = saveRowHeightsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    // 从后往前删除，避免索引偏移
    for (let i = count - 1; i >= 0; i--) {
      await deleteRowHelper(row + i, createRowColConfig())
    }
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    const actionName = count > 1 
      ? `删除第 ${row + 1} - ${row + count} 行`
      : `删除第 ${row + 1} 行`
    
    undoRedoExec.record({
      name: actionName,
      undo: () => {
        model.restoreFromSnapshot(modelSnapshot)
        restoreRowHeights(rowHeightsSnapshot)
        selected.row = oldSelected.row
        selected.col = oldSelected.col
        onDraw()
      },
      redo: () => {
        model.restoreFromSnapshot(newModelSnapshot)
        restoreRowHeights(newRowHeightsSnapshot)
        selected.row = newSelected.row
        selected.col = newSelected.col
        onDraw()
      }
    })
  }
  
  /**
   * 显示设置行高对话框
   */
  function showSetRowHeightDialog(row: number) {
    const currentHeight = getRowHeight(row)
    showSetRowHeightDialogHelper(row, currentHeight, rowHeights.value, manualRowHeights.value, hiddenRows.value, inputDialog as any, onDraw)
  }
  
  // ==================== 列操作 ====================
  
  /**
   * 在指定列左侧插入列（支持批量插入 - 使用优化的批量函数）
   */
  async function insertColLeft(col: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const colWidthsSnapshot = saveColWidthsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    const oldTotalCols = totalCols.value
    
    // 使用优化的批量插入函数
    await insertColsLeftBatch(col, count, createRowColConfig())
    
    // 自动扩展总列数
    totalCols.value += count
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    const newTotalCols = totalCols.value
    
    const actionName = count > 1 
      ? `在第 ${col + 1} 列左侧插入 ${count} 列`
      : `在第 ${col + 1} 列左侧插入列`
    
    undoRedoExec.record({
      name: actionName,
      undo: () => {
        model.restoreFromSnapshot(modelSnapshot)
        restoreColWidths(colWidthsSnapshot)
        totalCols.value = oldTotalCols
        selected.row = oldSelected.row
        selected.col = oldSelected.col
        onDraw()
      },
      redo: () => {
        model.restoreFromSnapshot(newModelSnapshot)
        restoreColWidths(newColWidthsSnapshot)
        totalCols.value = newTotalCols
        selected.row = newSelected.row
        selected.col = newSelected.col
        onDraw()
      }
    })
    
  }
  
  /**
   * 在指定列右侧插入列（支持批量插入 - 使用优化的批量函数）
   */
  async function insertColRight(col: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const colWidthsSnapshot = saveColWidthsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    const oldTotalCols = totalCols.value
    
    // 使用优化的批量插入函数（在 col+1 的左侧插入）
    await insertColsLeftBatch(col + 1, count, createRowColConfig())
    
    // 自动扩展总列数
    totalCols.value += count
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    const newTotalCols = totalCols.value
    
    const actionName = count > 1 
      ? `在第 ${col + 1} 列右侧插入 ${count} 列`
      : `在第 ${col + 1} 列右侧插入列`
    
    undoRedoExec.record({
      name: actionName,
      undo: () => {
        model.restoreFromSnapshot(modelSnapshot)
        restoreColWidths(colWidthsSnapshot)
        totalCols.value = oldTotalCols
        selected.row = oldSelected.row
        selected.col = oldSelected.col
        onDraw()
      },
      redo: () => {
        model.restoreFromSnapshot(newModelSnapshot)
        restoreColWidths(newColWidthsSnapshot)
        totalCols.value = newTotalCols
        selected.row = newSelected.row
        selected.col = newSelected.col
        onDraw()
      }
    })
    
  }
  
  /**
   * 删除指定列（支持批量删除）
   */
  async function deleteCol(col: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const colWidthsSnapshot = saveColWidthsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    // 从后往前删除，避免索引偏移
    for (let i = count - 1; i >= 0; i--) {
      await deleteColHelper(col + i, createRowColConfig())
    }
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    const actionName = count > 1 
      ? `删除第 ${col + 1} - ${col + count} 列`
      : `删除第 ${col + 1} 列`
    
    undoRedoExec.record({
      name: actionName,
      undo: () => {
        model.restoreFromSnapshot(modelSnapshot)
        restoreColWidths(colWidthsSnapshot)
        selected.row = oldSelected.row
        selected.col = oldSelected.col
        onDraw()
      },
      redo: () => {
        model.restoreFromSnapshot(newModelSnapshot)
        restoreColWidths(newColWidthsSnapshot)
        selected.row = newSelected.row
        selected.col = newSelected.col
        onDraw()
      }
    })
  }
  
  /**
   * 显示设置列宽对话框
   */
  function showSetColWidthDialog(col: number) {
    const currentWidth = getColWidth(col)
    showSetColWidthDialogHelper(col, currentWidth, colWidths.value, hiddenCols.value, inputDialog as any, onDraw)
  }
  
  return {
    // 行操作
    insertRowAbove,
    insertRowBelow,
    deleteRow,
    showSetRowHeightDialog,
    
    // 列操作
    insertColLeft,
    insertColRight,
    deleteCol,
    showSetColWidthDialog
  }
}

export type RowColOperations = ReturnType<typeof useRowColOperations>
