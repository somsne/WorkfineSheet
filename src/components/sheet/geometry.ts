import type { GeometryConfig, SizeAccess, Viewport } from './types'

/**
 * Geometry helpers: row/col sizes, positions, and visibility calculations.
 * Pure functions with explicit inputs for easy testing and reuse.
 */

export function getRowHeight(row: number, sizes: SizeAccess, cfg: GeometryConfig): number {
  if (sizes.hiddenRows?.has(row)) return 0
  return sizes.rowHeights.get(row) ?? cfg.defaultRowHeight
}

export function getColWidth(col: number, sizes: SizeAccess, cfg: GeometryConfig): number {
  if (sizes.hiddenCols?.has(col)) return 0
  return sizes.colWidths.get(col) ?? cfg.defaultColWidth
}

export function getRowTop(row: number, sizes: SizeAccess, cfg: GeometryConfig): number {
  let top = 0
  for (let r = 0; r < row; r++) {
    top += getRowHeight(r, sizes, cfg)
  }
  return top
}

export function getColLeft(col: number, sizes: SizeAccess, cfg: GeometryConfig): number {
  let left = 0
  for (let c = 0; c < col; c++) {
    left += getColWidth(c, sizes, cfg)
  }
  return left
}

export function getRowAtY(y: number, viewport: Viewport, sizes: SizeAccess, cfg: GeometryConfig, totalRows: number): number {
  const offsetY = y + viewport.scrollTop - cfg.colHeaderHeight
  let accumulatedHeight = 0
  for (let r = 0; r < totalRows; r++) {
    const h = getRowHeight(r, sizes, cfg)
    if (accumulatedHeight + h > offsetY) return r
    accumulatedHeight += h
  }
  return Math.max(0, totalRows - 1)
}

export function getColAtX(x: number, viewport: Viewport, sizes: SizeAccess, cfg: GeometryConfig, totalCols: number): number {
  const offsetX = x + viewport.scrollLeft - cfg.rowHeaderWidth
  let accumulatedWidth = 0
  for (let c = 0; c < totalCols; c++) {
    const w = getColWidth(c, sizes, cfg)
    if (accumulatedWidth + w > offsetX) return c
    accumulatedWidth += w
  }
  return Math.max(0, totalCols - 1)
}

export function getVisibleRange(
  containerWidth: number,
  containerHeight: number,
  viewport: Viewport,
  sizes: SizeAccess,
  cfg: GeometryConfig,
  totalRows: number,
  totalCols: number
): { startRow: number, endRow: number, startCol: number, endCol: number } {
  // Find startRow by scanning heights until surpassing scrollTop
  let startRow = 0
  let top = 0
  while (startRow < totalRows && top + getRowHeight(startRow, sizes, cfg) <= viewport.scrollTop) {
    top += getRowHeight(startRow, sizes, cfg)
    startRow++
  }
  // Find endRow by scanning until visible bottom
  const visibleBottom = viewport.scrollTop + Math.max(0, containerHeight - cfg.colHeaderHeight)
  let endRow = startRow
  let currentTop = top
  while (endRow < totalRows && currentTop < visibleBottom) {
    currentTop += getRowHeight(endRow, sizes, cfg)
    endRow++
  }
  endRow = Math.min(totalRows - 1, Math.max(startRow, endRow))

  // Find startCol by scanning widths until surpassing scrollLeft
  let startCol = 0
  let left = 0
  while (startCol < totalCols && left + getColWidth(startCol, sizes, cfg) <= viewport.scrollLeft) {
    left += getColWidth(startCol, sizes, cfg)
    startCol++
  }
  // Find endCol by scanning until visible right
  const visibleRight = viewport.scrollLeft + Math.max(0, containerWidth - cfg.rowHeaderWidth)
  let endCol = startCol
  let currentLeft = left
  while (endCol < totalCols && currentLeft < visibleRight) {
    currentLeft += getColWidth(endCol, sizes, cfg)
    endCol++
  }
  endCol = Math.min(totalCols - 1, Math.max(startCol, endCol))

  return { startRow, endRow, startCol, endCol }
}

export function ensureVisible(
  targetRow: number,
  targetCol: number,
  viewport: Viewport,
  containerWidth: number,
  containerHeight: number,
  sizes: SizeAccess,
  cfg: GeometryConfig
): { scrollTop: number, scrollLeft: number } {
  // Compute cell rect in content coordinates
  const cellLeft = cfg.rowHeaderWidth + getColLeft(targetCol, sizes, cfg) - viewport.scrollLeft
  const cellTop = cfg.colHeaderHeight + getRowTop(targetRow, sizes, cfg) - viewport.scrollTop
  const cellRight = cellLeft + getColWidth(targetCol, sizes, cfg)
  const cellBottom = cellTop + getRowHeight(targetRow, sizes, cfg)

  const isRowVisible = cellTop >= cfg.colHeaderHeight && cellBottom <= containerHeight
  const isColVisible = cellLeft >= cfg.rowHeaderWidth && cellRight <= containerWidth

  let scrollTop = viewport.scrollTop
  let scrollLeft = viewport.scrollLeft

  if (!isRowVisible) {
    if (cellTop < cfg.colHeaderHeight) {
      // Row is above visible area
      scrollTop = Math.max(0, getRowTop(targetRow, sizes, cfg))
    } else if (cellBottom > containerHeight) {
      // Row is below visible area
      scrollTop = Math.max(0, getRowTop(targetRow + 1, sizes, cfg) - containerHeight + cfg.colHeaderHeight)
    }
  }

  if (!isColVisible) {
    if (cellLeft < cfg.rowHeaderWidth) {
      // Column is to the left of visible area
      scrollLeft = Math.max(0, getColLeft(targetCol, sizes, cfg))
    } else if (cellRight > containerWidth) {
      // Column is to the right of visible area
      scrollLeft = Math.max(0, getColLeft(targetCol + 1, sizes, cfg) - containerWidth + cfg.rowHeaderWidth)
    }
  }

  return { scrollTop, scrollLeft }
}
