/**
 * Cell content rendering module: draws cell text, selection highlights, and formula references.
 * Depends on geometry module for positions and the FormulaSheet for values.
 */

import type { GeometryConfig, SizeAccess, FormulaReference } from './types'
import { getRowHeight, getColWidth, getRowTop, getColLeft } from './geometry'

export interface CellsRenderConfig {
  containerWidth: number
  containerHeight: number
  viewport: { scrollTop: number; scrollLeft: number }
  selected: { row: number; col: number }
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number }
  dragState: { 
    isDragging: boolean
    startRow: number
    startCol: number
    currentRow: number
    currentCol: number
  }
  formulaReferences: FormulaReference[]
  sizes: SizeAccess
  geometryConfig: GeometryConfig
  // Data provider
  getCellValue: (row: number, col: number) => string | number | null | undefined
  // Helper for selection range text
  getSelectionRangeText?: (startRow: number, startCol: number, endRow: number, endCol: number) => string
  // Visible range
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

/**
 * Draw cell contents, selection highlights, formula references, and drag box on the content canvas.
 */
export function drawCells(ctx: CanvasRenderingContext2D, config: CellsRenderConfig) {
  const {
    containerWidth: w,
    containerHeight: h,
    viewport,
    selected,
    selectionRange,
    dragState,
    formulaReferences,
    sizes,
    geometryConfig,
    getCellValue,
    getSelectionRangeText,
    startRow,
    endRow,
    startCol,
    endCol
  } = config
  
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig
  
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  
  // Set clipping region to ensure content doesn't draw over headers
  ctx.save()
  ctx.beginPath()
  ctx.rect(rowHeaderWidth, colHeaderHeight, w - rowHeaderWidth, h - colHeaderHeight)
  ctx.clip()

  ctx.fillStyle = '#000'
  ctx.font = '13px sans-serif'
  ctx.textBaseline = 'middle'

  // Draw visible cells from model
  for (let r = startRow; r < endRow; r++) {
    const cellY = colHeaderHeight + getRowTop(r, sizes, geometryConfig) - viewport.scrollTop
    const rowHeight = getRowHeight(r, sizes, geometryConfig)
    
    for (let c = startCol; c < endCol; c++) {
      const displayValue = getCellValue(r, c)
      if (displayValue !== null && displayValue !== undefined) {
        const cellX = rowHeaderWidth + getColLeft(c, sizes, geometryConfig) - viewport.scrollLeft
        const colWidth = getColWidth(c, sizes, geometryConfig)
        
        // Save current drawing state
        ctx.save()
        
        // Create clipping region limited to current cell
        ctx.beginPath()
        ctx.rect(cellX, cellY, colWidth, rowHeight)
        ctx.clip()
        
        // Handle newlines
        const text = String(displayValue)
        const lines = text.split('\n')
        
        if (lines.length === 1) {
          // Single line: use original center alignment
          const textX = cellX + 6
          const textY = cellY + rowHeight / 2
          ctx.fillText(text, textX, textY)
        } else {
          // Multi-line: draw from top
          ctx.textBaseline = 'top'
          const textX = cellX + 6
          const lineHeight = 18
          
          lines.forEach((line, index) => {
            const textY = cellY + 4 + index * lineHeight
            // Only draw lines within cell bounds
            if (textY >= cellY && textY < cellY + rowHeight) {
              ctx.fillText(line, textX, textY)
            }
          })
          ctx.textBaseline = 'middle' // Restore default
        }
        
        // Restore drawing state (including clipping region)
        ctx.restore()
      }
    }
  }

  // Highlight selection range (fill with light blue)
  if (selectionRange.startRow >= 0 && selectionRange.startCol >= 0) {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      const sy = colHeaderHeight + getRowTop(r, sizes, geometryConfig) - viewport.scrollTop
      const rowHeight = getRowHeight(r, sizes, geometryConfig)
      
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        const sx = rowHeaderWidth + getColLeft(c, sizes, geometryConfig) - viewport.scrollLeft
        const colWidth = getColWidth(c, sizes, geometryConfig)
        
        if (sx + colWidth > 0 && sx < w && sy + rowHeight > 0 && sy < h) {
          ctx.fillRect(sx + 0.5, sy + 0.5, colWidth - 1, rowHeight - 1)
        }
      }
    }
    // Draw border around selection range
    const sx = rowHeaderWidth + getColLeft(selectionRange.startCol, sizes, geometryConfig) - viewport.scrollLeft
    const sy = colHeaderHeight + getRowTop(selectionRange.startRow, sizes, geometryConfig) - viewport.scrollTop
    const ex = rowHeaderWidth + getColLeft(selectionRange.endCol + 1, sizes, geometryConfig) - viewport.scrollLeft
    const ey = colHeaderHeight + getRowTop(selectionRange.endRow + 1, sizes, geometryConfig) - viewport.scrollTop
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
  }

  // Highlight single selection
  if (selected.row >= 0 && selected.col >= 0) {
    const sx = rowHeaderWidth + getColLeft(selected.col, sizes, geometryConfig) - viewport.scrollLeft
    const sy = colHeaderHeight + getRowTop(selected.row, sizes, geometryConfig) - viewport.scrollTop
    const colWidth = getColWidth(selected.col, sizes, geometryConfig)
    const rowHeight = getRowHeight(selected.row, sizes, geometryConfig)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 0.5, sy + 0.5, colWidth - 1, rowHeight - 1)
  }

  // Draw colored borders for formula references (Excel style)
  if (formulaReferences.length > 0) {
    for (const ref of formulaReferences) {
      const sx = rowHeaderWidth + getColLeft(ref.startCol, sizes, geometryConfig) - viewport.scrollLeft
      const sy = colHeaderHeight + getRowTop(ref.startRow, sizes, geometryConfig) - viewport.scrollTop
      const ex = rowHeaderWidth + getColLeft(ref.endCol + 1, sizes, geometryConfig) - viewport.scrollLeft
      const ey = colHeaderHeight + getRowTop(ref.endRow + 1, sizes, geometryConfig) - viewport.scrollTop
      const width = ex - sx
      const height = ey - sy
      
      // Only draw visible references
      if (sx + width > 0 && sx < w && sy + height > 0 && sy < h) {
        ctx.strokeStyle = ref.color
        ctx.lineWidth = 2
        ctx.strokeRect(sx + 0.5, sy + 0.5, width - 1, height - 1)
      }
    }
  }

  // Draw dashed box during dragging
  if (dragState.isDragging && dragState.startRow >= 0 && dragState.startCol >= 0) {
    const startRow = Math.min(dragState.startRow, dragState.currentRow)
    const startCol = Math.min(dragState.startCol, dragState.currentCol)
    const endRow = Math.max(dragState.startRow, dragState.currentRow)
    const endCol = Math.max(dragState.startCol, dragState.currentCol)

    // Calculate dashed box coordinates
    const sx = rowHeaderWidth + getColLeft(startCol, sizes, geometryConfig) - viewport.scrollLeft
    const sy = colHeaderHeight + getRowTop(startRow, sizes, geometryConfig) - viewport.scrollTop
    const ex = rowHeaderWidth + getColLeft(endCol + 1, sizes, geometryConfig) - viewport.scrollLeft
    const ey = colHeaderHeight + getRowTop(endRow + 1, sizes, geometryConfig) - viewport.scrollTop
    const width = ex - sx
    const height = ey - sy

    // Draw dashed border
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(sx + 0.5, sy + 0.5, width - 1, height - 1)
    ctx.setLineDash([]) // Reset line dash

    // Display selection range text if helper provided
    if (getSelectionRangeText) {
      const rangeText = getSelectionRangeText(startRow, startCol, endRow, endCol)
      ctx.fillStyle = '#059669'
      ctx.font = 'bold 12px sans-serif'
      ctx.textBaseline = 'bottom'
      const textMetrics = ctx.measureText(rangeText)
      const textX = sx + 5
      const textY = sy - 2
      
      // Draw semi-transparent background for text
      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)'
      ctx.fillRect(textX - 2, textY - 14, textMetrics.width + 4, 14)
      
      // Draw text
      ctx.fillStyle = '#059669'
      ctx.fillText(rangeText, textX, textY)
    }
  }
  
  // Restore clipping region
  ctx.restore()
}
