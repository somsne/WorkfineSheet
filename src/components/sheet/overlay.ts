/**
 * 覆盖层输入模块
 * 负责处理单元格编辑覆盖层的定位和状态管理
 */

import type { OverlayState, GeometryConfig, SizeAccess, Viewport } from './types'
import { getRowTop, getColLeft, getRowHeight, getColWidth } from './geometry'

export interface OverlayPosition {
  top: number
  left: number
  width: number
  height: number
}

/**
 * 计算覆盖层的位置和尺寸
 */
export function calculateOverlayPosition(
  row: number,
  col: number,
  viewport: Viewport,
  sizes: SizeAccess,
  cfg: GeometryConfig
): OverlayPosition {
  const { colHeaderHeight, rowHeaderWidth } = cfg
  
  const top = colHeaderHeight + getRowTop(row, sizes, cfg) - viewport.scrollTop
  const left = rowHeaderWidth + getColLeft(col, sizes, cfg) - viewport.scrollLeft
  const width = getColWidth(col, sizes, cfg)
  const height = getRowHeight(row, sizes, cfg)
  
  return { top, left, width, height }
}

/**
 * 打开覆盖层
 * @returns 更新后的 overlay 状态
 */
export function openOverlay(
  row: number,
  col: number,
  initialValue: string,
  mode: 'edit' | 'typing',
  viewport: Viewport,
  sizes: SizeAccess,
  cfg: GeometryConfig
): Partial<OverlayState> {
  const position = calculateOverlayPosition(row, col, viewport, sizes, cfg)
  
  return {
    visible: true,
    row,
    col,
    top: position.top,
    left: position.left,
    width: position.width,
    height: position.height,
    value: initialValue,
    originalValue: initialValue,
    mode
  }
}

/**
 * 关闭覆盖层
 */
export function closeOverlay(): Partial<OverlayState> {
  return {
    visible: false
  }
}

/**
 * 处理双击事件，判断是否应该打开覆盖层
 */
export function handleDoubleClick(
  x: number,
  y: number,
  cfg: GeometryConfig
): { shouldOpen: boolean; inHeader: boolean } {
  const { rowHeaderWidth, colHeaderHeight } = cfg
  
  // ignore clicks in headers
  const inHeader = x < rowHeaderWidth || y < colHeaderHeight
  
  return {
    shouldOpen: !inHeader,
    inHeader
  }
}

/**
 * 计算保存后光标的新位置（回车确认后移动规则）
 */
export function getNextCellAfterSave(
  currentRow: number,
  currentCol: number,
  totalRows: number,
  totalCols: number
): { row: number; col: number } {
  // 回车确认后，光标移动到下一行
  // 如果是最后一行，则移动到下一列的第一行
  if (currentRow < totalRows - 1) {
    // 不是最后一行，向下移动
    return { row: currentRow + 1, col: currentCol }
  } else {
    // 是最后一行，移动到下一列的第一行
    if (currentCol < totalCols - 1) {
      return { row: 0, col: currentCol + 1 }
    } else {
      // 已经是最后一列的最后一行，回到第一行第一列
      return { row: 0, col: 0 }
    }
  }
}

/**
 * 检查点击位置是否在覆盖层输入框内部
 */
export function isClickInsideOverlay(
  clickX: number,
  clickY: number,
  overlayRect: { left: number; top: number; width: number; height: number }
): boolean {
  const { left, top, width, height } = overlayRect
  const right = left + width
  const bottom = top + height
  
  return clickX >= left && clickX <= right && clickY >= top && clickY <= bottom
}

/**
 * 检查是否应该在输入模式下打开覆盖层（typing 模式）
 */
export function shouldOpenTypingOverlay(
  key: string,
  ctrlKey: boolean,
  metaKey: boolean,
  altKey: boolean
): boolean {
  // 排除控制键组合
  if (ctrlKey || metaKey || altKey) {
    return false
  }
  
  // 排除特殊键
  const excludedKeys = [
    'Enter', 'Escape', 'Tab',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Backspace', 'Delete',
    'Home', 'End', 'PageUp', 'PageDown',
    'Insert', 'CapsLock', 'NumLock', 'ScrollLock',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
  ]
  
  if (excludedKeys.includes(key)) {
    return false
  }
  
  // 可打印字符或空格
  return key.length === 1 || key === ' '
}
