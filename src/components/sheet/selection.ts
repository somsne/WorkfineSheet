/**
 * 选择与拖拽模块
 * 负责处理单元格选择、范围选择、行列选择和拖拽行为
 */

import type { SelectionRange, DragState, GeometryConfig, SizeAccess } from './types'
import { getRowAtY, getColAtX } from './geometry'

export interface SelectionState {
  selected: { row: number; col: number }
  selectionRange: SelectionRange
  dragState: DragState
}

export interface SelectionClickConfig {
  x: number
  y: number
  shiftKey: boolean
  containerRect: DOMRect
  viewport: { scrollTop: number; scrollLeft: number }
  geometryConfig: GeometryConfig
  sizes: SizeAccess
  defaultRows: number
  defaultCols: number
  state: SelectionState
}

export interface SelectionDragConfig {
  x: number
  y: number
  containerRect: DOMRect
  viewport: { scrollTop: number; scrollLeft: number }
  geometryConfig: GeometryConfig
  sizes: SizeAccess
  defaultRows: number
  defaultCols: number
  state: SelectionState
}

/**
 * 处理点击事件 - 单元格、行头、列头、左上角选择
 * @returns true 如果处理了点击（需要重绘）
 */
export function handleClick(config: SelectionClickConfig): boolean {
  const { x, y, shiftKey, viewport, geometryConfig, sizes, defaultRows, defaultCols, state } = config
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig

  // 如果刚完成拖动，忽略 click 事件
  if (state.dragState.justFinishedDrag) {
    state.dragState.justFinishedDrag = false
    return false
  }

  // 点击行头：选择整行
  if (x < rowHeaderWidth && y > colHeaderHeight) {
    const row = getRowAtY(y, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultRows)
    state.selected.row = row
    state.selected.col = 0
    state.selectionRange.startRow = row
    state.selectionRange.startCol = 0
    state.selectionRange.endRow = row
    state.selectionRange.endCol = defaultCols - 1
    return true
  }

  // 点击列头：选择整列
  if (y < colHeaderHeight && x > rowHeaderWidth) {
    const col = getColAtX(x, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultCols)
    state.selected.row = 0
    state.selected.col = col
    state.selectionRange.startRow = 0
    state.selectionRange.startCol = col
    state.selectionRange.endRow = defaultRows - 1
    state.selectionRange.endCol = col
    return true
  }

  // 点击左上角：选择全部
  if (x < rowHeaderWidth && y < colHeaderHeight) {
    state.selected.row = 0
    state.selected.col = 0
    state.selectionRange.startRow = 0
    state.selectionRange.startCol = 0
    state.selectionRange.endRow = defaultRows - 1
    state.selectionRange.endCol = defaultCols - 1
    return true
  }

  // 点击内容区域
  if (x < rowHeaderWidth || y < colHeaderHeight) return false

  const col = getColAtX(x, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultCols)
  const row = getRowAtY(y, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultRows)

  if (shiftKey && state.selected.row >= 0 && state.selected.col >= 0) {
    // Shift+Click: expand selection range
    state.selectionRange.startRow = Math.min(state.selected.row, row)
    state.selectionRange.startCol = Math.min(state.selected.col, col)
    state.selectionRange.endRow = Math.max(state.selected.row, row)
    state.selectionRange.endCol = Math.max(state.selected.col, col)
    return true
  }

  // Normal click handling is done in onMouseUp to distinguish from drag
  return false
}

/**
 * 开始拖拽选择
 * @returns true 如果开始了拖拽
 */
export function startDragSelection(config: SelectionDragConfig): boolean {
  const { x, y, viewport, geometryConfig, sizes, defaultRows, defaultCols, state } = config
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig

  // 点击行头开始拖拽选择行
  if (x < rowHeaderWidth && y > colHeaderHeight) {
    const row = getRowAtY(y, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultRows)
    state.dragState.isDragging = true
    state.dragState.startRow = row
    state.dragState.startCol = 0
    state.dragState.currentRow = row
    state.dragState.currentCol = defaultCols - 1

    state.selected.row = row
    state.selected.col = 0
    state.selectionRange.startRow = row
    state.selectionRange.startCol = 0
    state.selectionRange.endRow = row
    state.selectionRange.endCol = defaultCols - 1
    return true
  }

  // 点击列头开始拖拽选择列
  if (y < colHeaderHeight && x > rowHeaderWidth) {
    const col = getColAtX(x, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultCols)
    state.dragState.isDragging = true
    state.dragState.startRow = 0
    state.dragState.startCol = col
    state.dragState.currentRow = defaultRows - 1
    state.dragState.currentCol = col

    state.selected.row = 0
    state.selected.col = col
    state.selectionRange.startRow = 0
    state.selectionRange.startCol = col
    state.selectionRange.endRow = defaultRows - 1
    state.selectionRange.endCol = col
    return true
  }

  // 点击左上角不处理
  if (x < rowHeaderWidth && y < colHeaderHeight) return false

  // 普通单元格拖拽
  if (x < rowHeaderWidth || y < colHeaderHeight) return false

  const col = getColAtX(x, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultCols)
  const row = getRowAtY(y, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultRows)

  state.dragState.isDragging = true
  state.dragState.startRow = row
  state.dragState.startCol = col
  state.dragState.currentRow = row
  state.dragState.currentCol = col
  return true
}

/**
 * 更新拖拽选择状态
 * @returns true 如果状态发生变化（需要重绘）
 */
export function updateDragSelection(config: SelectionDragConfig): boolean {
  const { x, y, containerRect, viewport, geometryConfig, sizes, defaultRows, defaultCols, state } = config

  if (!state.dragState.isDragging) return false

  // 检查鼠标是否在容器外
  if (x < 0 || x > containerRect.width || y < 0 || y > containerRect.height) {
    return false
  }

  // 判断是否是行/列拖动选择
  const isRowDrag = (state.dragState.startCol === 0 && state.dragState.currentCol === defaultCols - 1)
  const isColDrag = (state.dragState.startRow === 0 && state.dragState.currentRow === defaultRows - 1)

  if (isRowDrag) {
    // 拖动选择行
    const row = getRowAtY(y, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultRows)
    if (row >= 0 && row < defaultRows) {
      const changed = state.dragState.currentRow !== row
      state.dragState.currentRow = row
      state.dragState.currentCol = defaultCols - 1
      state.selectionRange.startRow = Math.min(state.dragState.startRow, state.dragState.currentRow)
      state.selectionRange.startCol = 0
      state.selectionRange.endRow = Math.max(state.dragState.startRow, state.dragState.currentRow)
      state.selectionRange.endCol = defaultCols - 1
      return changed
    }
    return false
  }

  if (isColDrag) {
    // 拖动选择列
    const col = getColAtX(x, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultCols)
    if (col >= 0 && col < defaultCols) {
      const changed = state.dragState.currentCol !== col
      state.dragState.currentCol = col
      state.dragState.currentRow = defaultRows - 1
      state.selectionRange.startRow = 0
      state.selectionRange.startCol = Math.min(state.dragState.startCol, state.dragState.currentCol)
      state.selectionRange.endRow = defaultRows - 1
      state.selectionRange.endCol = Math.max(state.dragState.startCol, state.dragState.currentCol)
      return changed
    }
    return false
  }

  // 普通单元格拖动选择
  if (x < geometryConfig.rowHeaderWidth || y < geometryConfig.colHeaderHeight) return false

  const col = getColAtX(x, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultCols)
  const row = getRowAtY(y, { scrollTop: viewport.scrollTop, scrollLeft: viewport.scrollLeft }, sizes, geometryConfig, defaultRows)

  const newRow = Math.max(0, Math.min(row, defaultRows - 1))
  const newCol = Math.max(0, Math.min(col, defaultCols - 1))

  const changed = (state.dragState.currentRow !== newRow || state.dragState.currentCol !== newCol)

  state.dragState.currentRow = newRow
  state.dragState.currentCol = newCol

  // Update selection range as dragging
  state.selectionRange.startRow = Math.min(state.dragState.startRow, state.dragState.currentRow)
  state.selectionRange.startCol = Math.min(state.dragState.startCol, state.dragState.currentCol)
  state.selectionRange.endRow = Math.max(state.dragState.startRow, state.dragState.currentRow)
  state.selectionRange.endCol = Math.max(state.dragState.startCol, state.dragState.currentCol)

  return changed
}

/**
 * 结束拖拽选择
 * @returns true 如果需要重绘
 */
export function endDragSelection(state: SelectionState, defaultCols: number): boolean {
  if (!state.dragState.isDragging) return false

  // 判断是否是行/列拖动选择
  const isRowDrag = (state.dragState.startCol === 0 && state.dragState.currentCol === defaultCols - 1)
  const isColDrag = (state.dragState.startRow === 0 && state.dragState.currentRow === defaultCols - 1)

  // 检测是否真正拖动了（不是单纯的点击）
  const hasDragged = (state.dragState.startRow !== state.dragState.currentRow || 
                      state.dragState.startCol !== state.dragState.currentCol)

  state.dragState.isDragging = false

  // 如果是行列拖动，保持选择范围不变（已经在 updateDragSelection 中设置好了）
  if (isRowDrag || isColDrag) {
    // 清空单选状态，避免覆盖范围选择的显示
    state.selected.row = -1
    state.selected.col = -1
    // 标记刚完成拖动（如果真的拖动了）
    if (hasDragged) {
      state.dragState.justFinishedDrag = true
    }
    return true
  }

  // 普通单元格拖拽
  if (hasDragged) {
    // 拖拽多个单元格
    state.selected.row = state.dragState.startRow
    state.selected.col = state.dragState.startCol
    state.dragState.justFinishedDrag = true
    return true
  } else {
    // 单纯点击（没有拖动）
    state.selected.row = state.dragState.startRow
    state.selected.col = state.dragState.startCol
    state.selectionRange.startRow = state.dragState.startRow
    state.selectionRange.startCol = state.dragState.startCol
    state.selectionRange.endRow = state.dragState.startRow
    state.selectionRange.endCol = state.dragState.startCol
    return true
  }
}

/**
 * 获取选择范围的文本描述
 * @param getCellAddress 获取单元格地址的函数（如 A1, B2）
 */
export function getSelectionRangeText(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  getCellAddress: (row: number, col: number) => string
): string {
  const startAddr = getCellAddress(startRow, startCol)
  const endAddr = getCellAddress(endRow, endCol)
  const rows = endRow - startRow + 1
  const cols = endCol - startCol + 1

  if (rows === 1 && cols === 1) {
    return startAddr
  }

  return `${startAddr}:${endAddr}  (${rows}行 × ${cols}列)`
}
