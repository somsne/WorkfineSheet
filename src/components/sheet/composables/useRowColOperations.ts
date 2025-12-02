/**
 * useRowColOperations - 电子表格行列操作 composable
 * 封装插入/删除行列、调整行高列宽相关的方法
 */

import {
  insertRowBelow as insertRowBelowHelper,
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
}

export function useRowColOperations({ state, geometry, onDraw, undoRedoExecutor }: UseRowColOperationsOptions) {
  const {
    constants,
    model, formulaSheet, undoRedo,
    rowHeights, colWidths, manualRowHeights,
    hiddenRows, hiddenCols,
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
   */
  function createRowColConfig(): RowColConfig {
    return {
      formulaSheet,
      sizeConfig: {
        rowHeights: rowHeights.value,
        colWidths: colWidths.value,
        defaultRowHeight: constants.ROW_HEIGHT,
        defaultColWidth: constants.COL_WIDTH,
        totalRows: constants.DEFAULT_ROWS,
        totalCols: constants.DEFAULT_COLS
      },
      selected,
      onRedraw: onDraw
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
    
    // 使用优化的批量插入函数（一次性移动所有内容）
    await insertRowsAboveBatch(row, count, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    const actionName = count > 1 
      ? `在第 ${row + 1} 行上方插入 ${count} 行`
      : `在第 ${row + 1} 行上方插入行`
    
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
   * 在指定行下方插入行（支持批量插入）
   */
  async function insertRowBelow(row: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const rowHeightsSnapshot = saveRowHeightsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    // 批量插入（从后往前插入，保持相对位置）
    for (let i = 0; i < count; i++) {
      await insertRowBelowHelper(row, createRowColConfig())
    }
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    const actionName = count > 1 
      ? `在第 ${row + 1} 行下方插入 ${count} 行`
      : `在第 ${row + 1} 行下方插入行`
    
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
    
    // 使用优化的批量插入函数
    await insertColsLeftBatch(col, count, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    const actionName = count > 1 
      ? `在第 ${col + 1} 列左侧插入 ${count} 列`
      : `在第 ${col + 1} 列左侧插入列`
    
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
   * 在指定列右侧插入列（支持批量插入 - 使用优化的批量函数）
   */
  async function insertColRight(col: number, count: number = 1) {
    const modelSnapshot = model.createSnapshot()
    const colWidthsSnapshot = saveColWidthsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    // 使用优化的批量插入函数（在 col+1 的左侧插入）
    await insertColsLeftBatch(col + 1, count, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    const actionName = count > 1 
      ? `在第 ${col + 1} 列右侧插入 ${count} 列`
      : `在第 ${col + 1} 列右侧插入列`
    
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
