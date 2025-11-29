/**
 * 选择与拖拽模块
 * 负责处理单元格选择、范围选择、行列选择和拖拽行为
 */

import type { SelectionRange, DragState, GeometryConfig, SizeAccess, MergedRegion } from './types'
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
  /** 获取单元格所属的合并区域 */
  getMergedRegion?: (row: number, col: number) => MergedRegion | null
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
  /** 获取单元格所属的合并区域 */
  getMergedRegion?: (row: number, col: number) => MergedRegion | null
}

/**
 * 扩展选择范围以包含合并单元格
 * @param selectionRange 当前选择范围
 * @param getMergedRegion 获取合并区域的函数
 * @returns 是否有变化
 */
function expandSelectionForMergedCells(
  selectionRange: SelectionRange,
  getMergedRegion?: (row: number, col: number) => MergedRegion | null
): boolean {
  if (!getMergedRegion) return false

  let changed = true
  let iterations = 0
  const maxIterations = 100 // 防止无限循环

  // 迭代扩展，直到没有新的合并区域需要包含
  while (changed && iterations < maxIterations) {
    changed = false
    iterations++

    // 检查选择范围四边的所有单元格
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        const region = getMergedRegion(r, c)
        if (region) {
          // 如果合并区域超出当前选择范围，扩展选择
          if (region.startRow < selectionRange.startRow) {
            selectionRange.startRow = region.startRow
            changed = true
          }
          if (region.startCol < selectionRange.startCol) {
            selectionRange.startCol = region.startCol
            changed = true
          }
          if (region.endRow > selectionRange.endRow) {
            selectionRange.endRow = region.endRow
            changed = true
          }
          if (region.endCol > selectionRange.endCol) {
            selectionRange.endCol = region.endCol
            changed = true
          }
        }
      }
    }
  }

  return iterations > 1
}

/**
 * 处理点击事件 - 单元格、行头、列头、左上角选择
 * @returns true 如果处理了点击（需要重绘）
 */
export function handleClick(config: SelectionClickConfig): boolean {
  const { x, y, shiftKey, viewport, geometryConfig, sizes, defaultRows, defaultCols, state, getMergedRegion } = config
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
    
    // 扩展选择范围以包含所有相关的合并单元格
    expandSelectionForMergedCells(state.selectionRange, getMergedRegion)
    
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
  const { x, y, viewport, geometryConfig, sizes, defaultRows, defaultCols, state, getMergedRegion } = config
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

  // 检查点击的单元格是否在合并区域内
  const region = getMergedRegion?.(row, col)
  
  state.dragState.isDragging = true
  
  if (region) {
    // 如果点击了合并单元格，从主单元格开始拖拽
    state.dragState.startRow = region.startRow
    state.dragState.startCol = region.startCol
    state.dragState.currentRow = region.endRow
    state.dragState.currentCol = region.endCol
  } else {
    state.dragState.startRow = row
    state.dragState.startCol = col
    state.dragState.currentRow = row
    state.dragState.currentCol = col
  }
  
  return true
}

/**
 * 更新拖拽选择状态
 * @returns true 如果状态发生变化（需要重绘）
 */
export function updateDragSelection(config: SelectionDragConfig): boolean {
  const { x, y, containerRect, viewport, geometryConfig, sizes, defaultRows, defaultCols, state, getMergedRegion } = config

  if (!state.dragState.isDragging) return false

  // 检查鼠标是否在容器外
  if (x < 0 || x > containerRect.width || y < 0 || y > containerRect.height) {
    return false
  }

  // 判断是否是行/列拖动选择
  const isRowDrag = (state.dragState.startCol === 0 && state.dragState.currentCol === defaultCols - 1)
  const isColDrag = (state.dragState.startRow === 0 && state.dragState.currentRow === defaultRows - 1)

  if (isRowDrag) {
    // 拖动选择行 - 不扩展合并单元格
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
    // 拖动选择列 - 不扩展合并单元格
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

  let newRow = Math.max(0, Math.min(row, defaultRows - 1))
  let newCol = Math.max(0, Math.min(col, defaultCols - 1))

  // 检查当前鼠标位置的单元格是否在合并区域内
  const region = getMergedRegion?.(newRow, newCol)
  if (region) {
    // 扩展选择到合并区域的边界
    if (newRow < state.dragState.startRow) {
      newRow = region.startRow
    } else if (newRow > state.dragState.startRow) {
      newRow = region.endRow
    }
    if (newCol < state.dragState.startCol) {
      newCol = region.startCol
    } else if (newCol > state.dragState.startCol) {
      newCol = region.endCol
    }
  }

  const changed = (state.dragState.currentRow !== newRow || state.dragState.currentCol !== newCol)

  state.dragState.currentRow = newRow
  state.dragState.currentCol = newCol

  // Update selection range as dragging
  state.selectionRange.startRow = Math.min(state.dragState.startRow, state.dragState.currentRow)
  state.selectionRange.startCol = Math.min(state.dragState.startCol, state.dragState.currentCol)
  state.selectionRange.endRow = Math.max(state.dragState.startRow, state.dragState.currentRow)
  state.selectionRange.endCol = Math.max(state.dragState.startCol, state.dragState.currentCol)
  
  // 扩展选择范围以包含所有相关的合并单元格
  expandSelectionForMergedCells(state.selectionRange, getMergedRegion)

  return changed
}

/**
 * 结束拖拽选择
 * @returns true 如果需要重绘
 */
export function endDragSelection(
  state: SelectionState, 
  defaultCols: number,
  getMergedRegion?: (row: number, col: number) => MergedRegion | null,
  defaultRows?: number
): boolean {
  if (!state.dragState.isDragging) return false

  // 判断是否是行/列拖动选择
  const isRowDrag = (state.dragState.startCol === 0 && state.dragState.currentCol === defaultCols - 1)
  const isColDrag = (state.dragState.startRow === 0 && state.dragState.currentRow === (defaultRows ?? defaultCols) - 1)

  // 检测是否真正拖动了（不是单纯的点击）
  // 注意：对于合并单元格，startRow/currentRow 等可能不同（因为合并区域），
  // 但这仍然算作单击合并单元格而非拖动
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

  // 普通单元格拖拽或合并单元格点击
  // 对于合并单元格，selected 指向主单元格（左上角）
  state.selected.row = state.dragState.startRow
  state.selected.col = state.dragState.startCol
  
  // 设置选择范围
  state.selectionRange.startRow = Math.min(state.dragState.startRow, state.dragState.currentRow)
  state.selectionRange.startCol = Math.min(state.dragState.startCol, state.dragState.currentCol)
  state.selectionRange.endRow = Math.max(state.dragState.startRow, state.dragState.currentRow)
  state.selectionRange.endCol = Math.max(state.dragState.startCol, state.dragState.currentCol)
  
  // 扩展选择范围以包含所有相关的合并单元格
  expandSelectionForMergedCells(state.selectionRange, getMergedRegion)
  
  if (hasDragged) {
    state.dragState.justFinishedDrag = true
  }
  
  return true
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
