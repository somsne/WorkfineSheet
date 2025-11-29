/**
 * useRowColOperations - 电子表格行列操作 composable
 * 封装插入/删除行列、调整行高列宽相关的方法
 */

import {
  insertRowAbove as insertRowAboveHelper,
  insertRowBelow as insertRowBelowHelper,
  deleteRow as deleteRowHelper,
  insertColLeft as insertColLeftHelper,
  insertColRight as insertColRightHelper,
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
}

export function useRowColOperations({ state, geometry, onDraw }: UseRowColOperationsOptions) {
  const {
    constants,
    model, formulaSheet, undoRedo,
    rowHeights, colWidths,
    selected,
    inputDialog,
    saveRowHeightsSnapshot, restoreRowHeights,
    saveColWidthsSnapshot, restoreColWidths
  } = state
  
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
   * 在指定行上方插入行
   */
  async function insertRowAbove(row: number) {
    const modelSnapshot = model.createSnapshot()
    const rowHeightsSnapshot = saveRowHeightsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    await insertRowAboveHelper(row, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    undoRedo.record({
      name: `在第 ${row + 1} 行上方插入行`,
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
   * 在指定行下方插入行
   */
  async function insertRowBelow(row: number) {
    const modelSnapshot = model.createSnapshot()
    const rowHeightsSnapshot = saveRowHeightsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    await insertRowBelowHelper(row, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    undoRedo.record({
      name: `在第 ${row + 1} 行下方插入行`,
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
   * 删除指定行
   */
  async function deleteRow(row: number) {
    const modelSnapshot = model.createSnapshot()
    const rowHeightsSnapshot = saveRowHeightsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    await deleteRowHelper(row, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newRowHeightsSnapshot = saveRowHeightsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    undoRedo.record({
      name: `删除第 ${row + 1} 行`,
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
    showSetRowHeightDialogHelper(row, currentHeight, rowHeights.value, inputDialog as any, onDraw)
  }
  
  // ==================== 列操作 ====================
  
  /**
   * 在指定列左侧插入列
   */
  async function insertColLeft(col: number) {
    const modelSnapshot = model.createSnapshot()
    const colWidthsSnapshot = saveColWidthsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    await insertColLeftHelper(col, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    undoRedo.record({
      name: `在第 ${col + 1} 列左侧插入列`,
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
   * 在指定列右侧插入列
   */
  async function insertColRight(col: number) {
    const modelSnapshot = model.createSnapshot()
    const colWidthsSnapshot = saveColWidthsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    await insertColRightHelper(col, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    undoRedo.record({
      name: `在第 ${col + 1} 列右侧插入列`,
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
   * 删除指定列
   */
  async function deleteCol(col: number) {
    const modelSnapshot = model.createSnapshot()
    const colWidthsSnapshot = saveColWidthsSnapshot()
    const oldSelected = { row: selected.row, col: selected.col }
    
    await deleteColHelper(col, createRowColConfig())
    
    const newModelSnapshot = model.createSnapshot()
    const newColWidthsSnapshot = saveColWidthsSnapshot()
    const newSelected = { row: selected.row, col: selected.col }
    
    undoRedo.record({
      name: `删除第 ${col + 1} 列`,
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
    showSetColWidthDialogHelper(col, currentWidth, colWidths.value, inputDialog as any, onDraw)
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
