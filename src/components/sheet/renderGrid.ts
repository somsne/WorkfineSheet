/**
 * Grid rendering module: draws grid lines, column/row headers, and hover highlights.
 * Depends on geometry module for sizes and positions.
 */

import type { GeometryConfig, SizeAccess } from './types'
import { getColWidth, getRowHeight, getColLeft, getRowTop, getVisibleRange } from './geometry'

export interface GridRenderConfig {
  containerWidth: number
  containerHeight: number
  viewport: { scrollTop: number; scrollLeft: number }
  hoverState: { type: '' | 'row' | 'col'; index: number }
  totalRows: number
  totalCols: number
  sizes: SizeAccess
  geometryConfig: GeometryConfig
}

/**
 * Get column label (A, B, ..., Z, AA, AB, ...)
 */
function getColLabel(c: number): string {
  let label = ''
  let n = c
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label
    if (n < 26) break
    n = Math.floor(n / 26) - 1
  }
  return label
}

/**
 * Draw grid lines, headers, and hover highlights on the grid canvas.
 */
export function drawGrid(ctx: CanvasRenderingContext2D, config: GridRenderConfig) {
  const {
    containerWidth: w,
    containerHeight: h,
    viewport,
    hoverState,
    totalRows,
    totalCols,
    sizes,
    geometryConfig
  } = config
  
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig
  
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Background colors for headers
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, w, colHeaderHeight)
  ctx.fillRect(0, 0, rowHeaderWidth, h)

  const { startRow, endRow, startCol, endCol } = getVisibleRange(w, h, viewport, sizes, geometryConfig, totalRows, totalCols)

  // 检查是否显示网格线（默认为 true）
  const shouldDrawGridLines = sizes.showGridFlag !== false

  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  ctx.fillStyle = '#333'
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'middle'

  // Draw visible columns
  let accumulatedColX = rowHeaderWidth
  for (let c = 0; c < totalCols; c++) {
    const colWidth = getColWidth(c, sizes, geometryConfig)
    const x = accumulatedColX - viewport.scrollLeft
    
    // Only draw visible columns
    if (x + colWidth > rowHeaderWidth && x < w && c >= startCol && c <= endCol) {
      // Vertical line at left of column (content area only) - only if grid lines enabled
      if (shouldDrawGridLines) {
        ctx.strokeStyle = '#999'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, colHeaderHeight)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      
      // Column label (in header area, will be redrawn later by mask layer)
      if (x + colWidth > rowHeaderWidth && x < w) {
        const label = getColLabel(c)
        const metrics = ctx.measureText(label)
        ctx.fillText(label, x + (colWidth - metrics.width) / 2, colHeaderHeight / 2)
      }
    }
    
    accumulatedColX += colWidth
    
    // Draw column right border (separator line) - only if grid lines enabled
    const rightX = accumulatedColX - viewport.scrollLeft
    if (shouldDrawGridLines && rightX > rowHeaderWidth && rightX < w && c >= startCol && c <= endCol) {
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rightX, colHeaderHeight)
      ctx.lineTo(rightX, h)
      ctx.stroke()
    }
    
    if (accumulatedColX - viewport.scrollLeft > w) break
  }

  // Draw visible rows
  let accumulatedRowY = colHeaderHeight
  for (let r = 0; r < totalRows; r++) {
    const rowHeight = getRowHeight(r, sizes, geometryConfig)
    const y = accumulatedRowY - viewport.scrollTop
    
    // Only draw visible rows
    if (y + rowHeight > colHeaderHeight && y < h && r >= startRow && r <= endRow) {
      // Horizontal line at top of row (content area only) - only if grid lines enabled
      if (shouldDrawGridLines) {
        ctx.strokeStyle = '#999'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(rowHeaderWidth, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      
      // Row label (in header area, will be redrawn later by mask layer)
      if (y + rowHeight > colHeaderHeight && y < h) {
        const label = (r + 1).toString()
        const metrics = ctx.measureText(label)
        ctx.fillText(label, (rowHeaderWidth - metrics.width) / 2, y + rowHeight / 2)
      }
    }
    
    accumulatedRowY += rowHeight
    
    // Draw row bottom border (separator line) - only if grid lines enabled
    const bottomY = accumulatedRowY - viewport.scrollTop
    if (shouldDrawGridLines && bottomY > colHeaderHeight && bottomY < h && r >= startRow && r <= endRow) {
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rowHeaderWidth, bottomY)
      ctx.lineTo(w, bottomY)
      ctx.stroke()
    }
    
    if (accumulatedRowY - viewport.scrollTop > h) break
  }
  
  // Redraw header mask layer to cover any overflow content
  // This ensures headers are always on top
  ctx.fillStyle = '#f0f0f0'
  // Column header mask
  ctx.fillRect(0, 0, w, colHeaderHeight)
  // Row header mask  
  ctx.fillRect(0, 0, rowHeaderWidth, h)
  
  // Redraw column labels and separator lines
  ctx.fillStyle = '#333'
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  
  accumulatedColX = rowHeaderWidth
  for (let c = 0; c < totalCols; c++) {
    const colWidth = getColWidth(c, sizes, geometryConfig)
    const x = accumulatedColX - viewport.scrollLeft
    
    if (x + colWidth > rowHeaderWidth && x < w && c >= startCol && c <= endCol) {
      // Draw column left border line
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, colHeaderHeight)
      ctx.stroke()
      
      // Draw column label
      const label = getColLabel(c)
      const metrics = ctx.measureText(label)
      ctx.fillText(label, x + (colWidth - metrics.width) / 2, colHeaderHeight / 2)
    }
    
    accumulatedColX += colWidth
    
    // Draw column right border line (separator) - normal style
    const rightX = accumulatedColX - viewport.scrollLeft
    if (rightX > rowHeaderWidth && rightX < w && c >= startCol && c <= endCol) {
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rightX, 0)
      ctx.lineTo(rightX, colHeaderHeight)
      ctx.stroke()
    }
    
    if (accumulatedColX - viewport.scrollLeft > w) break
  }
  
  // Redraw row labels and separator lines
  accumulatedRowY = colHeaderHeight
  for (let r = 0; r < totalRows; r++) {
    const rowHeight = getRowHeight(r, sizes, geometryConfig)
    const y = accumulatedRowY - viewport.scrollTop
    
    if (y + rowHeight > colHeaderHeight && y < h && r >= startRow && r <= endRow) {
      // Draw row top border line
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(rowHeaderWidth, y)
      ctx.stroke()
      
      // Draw row label
      const label = (r + 1).toString()
      const metrics = ctx.measureText(label)
      ctx.fillText(label, (rowHeaderWidth - metrics.width) / 2, y + rowHeight / 2)
    }
    
    accumulatedRowY += rowHeight
    
    // Draw row bottom border line (separator) - normal style
    const bottomY = accumulatedRowY - viewport.scrollTop
    if (bottomY > colHeaderHeight && bottomY < h && r >= startRow && r <= endRow) {
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, bottomY)
      ctx.lineTo(rowHeaderWidth, bottomY)
      ctx.stroke()
    }
    
    if (accumulatedRowY - viewport.scrollTop > h) break
  }
  
  // Draw column header and row header border lines at the end
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  // Column header bottom border
  ctx.beginPath()
  ctx.moveTo(0, colHeaderHeight)
  ctx.lineTo(w, colHeaderHeight)
  ctx.stroke()
  // Row header right border
  ctx.beginPath()
  ctx.moveTo(rowHeaderWidth, 0)
  ctx.lineTo(rowHeaderWidth, h)
  ctx.stroke()
  
  // Top-left corner mask layer to cover any scrolled content
  // Expand by 1px to fully cover border lines
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, rowHeaderWidth + 1, colHeaderHeight + 1)
  
  // Redraw top-left corner right and bottom border lines to ensure complete borders
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  // Right border (vertical line)
  ctx.beginPath()
  ctx.moveTo(rowHeaderWidth, 0)
  ctx.lineTo(rowHeaderWidth, colHeaderHeight)
  ctx.stroke()
  // Bottom border (horizontal line)
  ctx.beginPath()
  ctx.moveTo(0, colHeaderHeight)
  ctx.lineTo(rowHeaderWidth, colHeaderHeight)
  ctx.stroke()
  
  // Finally draw hover highlight lines (blue) to ensure they're not covered by other lines
  if (hoverState.type === 'col' && hoverState.index >= 0) {
    // Draw column highlight line
    const c = hoverState.index
    const rightX = rowHeaderWidth + getColLeft(c + 1, sizes, geometryConfig) - viewport.scrollLeft
    if (rightX > rowHeaderWidth && rightX < w) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      // Highlight in header area
      ctx.beginPath()
      ctx.moveTo(rightX, 0)
      ctx.lineTo(rightX, colHeaderHeight)
      ctx.stroke()
      // Highlight in content area
      ctx.beginPath()
      ctx.moveTo(rightX, colHeaderHeight)
      ctx.lineTo(rightX, h)
      ctx.stroke()
    }
  } else if (hoverState.type === 'row' && hoverState.index >= 0) {
    // Draw row highlight line
    const r = hoverState.index
    const bottomY = colHeaderHeight + getRowTop(r + 1, sizes, geometryConfig) - viewport.scrollTop
    if (bottomY > colHeaderHeight && bottomY < h) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      // Highlight in header area
      ctx.beginPath()
      ctx.moveTo(0, bottomY)
      ctx.lineTo(rowHeaderWidth, bottomY)
      ctx.stroke()
      // Highlight in content area
      ctx.beginPath()
      ctx.moveTo(rowHeaderWidth, bottomY)
      ctx.lineTo(w, bottomY)
      ctx.stroke()
    }
  }
}
