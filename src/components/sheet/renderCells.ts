/**
 * Cell content rendering module: draws cell text, selection highlights, and formula references.
 * Depends on geometry module for positions and the FormulaSheet for values.
 */

import type { GeometryConfig, SizeAccess, FormulaReference, CellStyle } from './types'
import { getRowHeight, getColWidth, getRowTop, getColLeft } from './geometry'

/**
 * Build Canvas font string from CellStyle
 * @param style Cell style object
 * @returns CSS font string (e.g., "italic bold 14px Arial")
 */
function buildFontString(style: CellStyle): string {
  const parts: string[] = []
  
  if (style.italic) {
    parts.push('italic')
  }
  
  if (style.bold) {
    parts.push('bold')
  }
  
  parts.push(`${style.fontSize}px`)
  parts.push(style.fontFamily || 'sans-serif')
  
  return parts.join(' ')
}

/**
 * Draw underline decoration
 * @param ctx Canvas context
 * @param x Text start X position
 * @param y Text Y position (center or baseline depending on textBaseline)
 * @param width Text width
 * @param fontSize Font size
 * @param type Underline type: true/'single' or 'double'
 * @param textBaseline Current textBaseline setting
 */
function drawUnderline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  type: boolean | 'single' | 'double',
  textBaseline: CanvasTextBaseline = 'middle'
): void {
  if (!type) return
  
  // 计算实际的 baseline 位置
  let baselineY = y
  if (textBaseline === 'middle') {
    // 如果是 middle，y 是文字中心，baseline 在中心下方约 0.3em
    baselineY = y + fontSize * 0.3
  } else if (textBaseline === 'top') {
    // 如果是 top，y 是文字顶部，baseline 在顶部下方约 0.8em
    baselineY = y + fontSize * 0.8
  }
  
  // 下划线位置：baseline 下方约 2px，避免与文字下沿重叠
  const lineY = baselineY + 2
  const lineWidth = 1
  
  ctx.save()
  ctx.strokeStyle = ctx.fillStyle // Use current text color
  ctx.lineWidth = lineWidth
  
  if (type === 'double') {
    // Double underline: two parallel lines
    ctx.beginPath()
    ctx.moveTo(x, lineY)
    ctx.lineTo(x + width, lineY)
    ctx.stroke()
    
    ctx.beginPath()
    ctx.moveTo(x, lineY + 2)
    ctx.lineTo(x + width, lineY + 2)
    ctx.stroke()
  } else {
    // Single underline
    ctx.beginPath()
    ctx.moveTo(x, lineY)
    ctx.lineTo(x + width, lineY)
    ctx.stroke()
  }
  
  ctx.restore()
}

/**
 * Draw strikethrough decoration
 * @param ctx Canvas context
 * @param x Text start X position
 * @param y Text Y position (center or baseline depending on textBaseline)
 * @param width Text width
 * @param fontSize Font size
 * @param textBaseline Current textBaseline setting
 */
function drawStrikethrough(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  textBaseline: CanvasTextBaseline = 'middle'
): void {
  let lineY: number
  
  if (textBaseline === 'middle') {
    // 如果是 middle，y 是文字中心，删除线就在中心稍上方
    lineY = y - fontSize * 0.1
  } else if (textBaseline === 'top') {
    // 如果是 top，y 是文字顶部，删除线在顶部下方约 0.5em
    lineY = y + fontSize * 0.5
  } else {
    // baseline: 删除线位置在 baseline 上方约 0.35em
    lineY = y - fontSize * 0.35
  }
  
  ctx.save()
  ctx.strokeStyle = ctx.fillStyle // Use current text color
  ctx.lineWidth = 1
  
  ctx.beginPath()
  ctx.moveTo(x, lineY)
  ctx.lineTo(x + width, lineY)
  ctx.stroke()
  
  ctx.restore()
}

/**
 * Calculate text X position based on horizontal alignment
 * @param cellX Cell left X position
 * @param cellWidth Cell width
 * @param textWidth Text width (from measureText)
 * @param textAlign Horizontal alignment: 'left' | 'center' | 'right'
 * @param padding Horizontal padding (default: 6px)
 * @returns Calculated X position for fillText
 */
function calculateTextX(
  cellX: number,
  cellWidth: number,
  textWidth: number,
  textAlign: 'left' | 'center' | 'right' = 'left',
  padding: number = 6
): number {
  switch (textAlign) {
    case 'left':
      return cellX + padding
    case 'center':
      return cellX + (cellWidth - textWidth) / 2
    case 'right':
      return cellX + cellWidth - textWidth - padding
    default:
      return cellX + padding
  }
}

/**
 * Calculate text Y position based on vertical alignment
 * @param cellY Cell top Y position
 * @param cellHeight Cell height
 * @param fontSize Font size
 * @param verticalAlign Vertical alignment: 'top' | 'middle' | 'bottom'
 * @param padding Vertical padding (default: 4px)
 * @returns Object with textY position and appropriate textBaseline setting
 */
function calculateTextY(
  cellY: number,
  cellHeight: number,
  _fontSize: number,
  verticalAlign: 'top' | 'middle' | 'bottom' = 'middle',
  padding: number = 4
): { textY: number; textBaseline: CanvasTextBaseline } {
  switch (verticalAlign) {
    case 'top':
      return {
        textY: cellY + padding,
        textBaseline: 'top'
      }
    case 'middle':
      return {
        textY: cellY + cellHeight / 2,
        textBaseline: 'middle'
      }
    case 'bottom':
      return {
        textY: cellY + cellHeight - padding,
        textBaseline: 'bottom'
      }
    default:
      return {
        textY: cellY + cellHeight / 2,
        textBaseline: 'middle'
      }
  }
}

/**
 * Wrap text to fit within a given width
 * @param ctx Canvas context (needed for measureText)
 * @param text Text to wrap
 * @param maxWidth Maximum width in pixels
 * @param padding Horizontal padding to subtract from maxWidth
 * @returns Array of text lines
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  padding: number = 12
): string[] {
  const availableWidth = maxWidth - padding
  const lines: string[] = []
  
  // 检查文本是否包含空格（英文）
  const hasSpaces = text.includes(' ')
  
  if (hasSpaces) {
    // 英文模式：按空格分词
    const words = text.split(' ')
    let currentLine = ''
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width > availableWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    
    if (currentLine) {
      lines.push(currentLine)
    }
  } else {
    // 中文模式：逐字符检查
    let currentLine = ''
    
    for (const char of text) {
      const testLine = currentLine + char
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width > availableWidth && currentLine) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    
    if (currentLine) {
      lines.push(currentLine)
    }
  }
  
  return lines.length > 0 ? lines : [text]
}

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
  // Style provider
  getCellStyle?: (row: number, col: number) => CellStyle
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
    getCellStyle,
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
        
        // Get cell style
        const style: CellStyle = getCellStyle ? getCellStyle(r, c) : {
          fontFamily: 'sans-serif',
          fontSize: 13,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left' as const,
          verticalAlign: 'middle' as const,
          wrapText: false,
          textRotation: 0
        }
        
        // Save current drawing state
        ctx.save()
        
        // Create clipping region limited to current cell
        ctx.beginPath()
        ctx.rect(cellX, cellY, colWidth, rowHeight)
        ctx.clip()
        
        // Draw background color if specified (留出1px的网格线空间)
        if (style.backgroundColor && style.backgroundColor !== '#FFFFFF') {
          ctx.fillStyle = style.backgroundColor
          ctx.fillRect(cellX + 0.5, cellY + 0.5, colWidth - 1, rowHeight - 1)
        }
        
        // Apply cell style
        ctx.font = buildFontString(style)
        ctx.fillStyle = style.color || '#000'
        
        // Handle newlines and wrapping
        const text = String(displayValue)
        let lines: string[]
        
        if (style.wrapText) {
          // Auto-wrap: split by newlines first, then wrap each line
          const rawLines = text.split('\n')
          lines = []
          for (const rawLine of rawLines) {
            const wrappedLines = wrapText(ctx, rawLine, colWidth)
            lines.push(...wrappedLines)
          }
        } else {
          // No wrapping: just split by newlines
          lines = text.split('\n')
        }
        
        if (lines.length === 1) {
          // Single line: apply alignment
          const textMetrics = ctx.measureText(text)
          const textWidth = textMetrics.width
          
          // Calculate vertical alignment
          const { textY, textBaseline } = calculateTextY(
            cellY,
            rowHeight,
            style.fontSize || 13,
            style.verticalAlign || 'middle'
          )
          ctx.textBaseline = textBaseline
          
          // Calculate horizontal alignment
          const textX = calculateTextX(
            cellX,
            colWidth,
            textWidth,
            style.textAlign || 'left'
          )
          
          // Handle text rotation (以文本块中心为原点)
          const rotation = style.textRotation || 0
          if (rotation !== 0) {
            // 以文本块的中心点作为旋转原点
            const textCenterX = textX + textWidth / 2
            const textCenterY = textY
            ctx.translate(textCenterX, textCenterY)
            ctx.rotate((rotation * Math.PI) / 180)
            ctx.translate(-textCenterX, -textCenterY)
          }
          
          ctx.fillText(text, textX, textY)
          
          // Draw underline
          if (style.underline) {
            drawUnderline(ctx, textX, textY, textWidth, style.fontSize || 13, style.underline, textBaseline)
          }
          
          // Draw strikethrough
          if (style.strikethrough) {
            drawStrikethrough(ctx, textX, textY, textWidth, style.fontSize || 13, textBaseline)
          }
        } else {
          // Multi-line: draw from top (vertical align for multi-line uses top as start)
          const lineHeight = (style.fontSize || 13) * 1.4 // Line height = fontSize * 1.4
          const totalHeight = lines.length * lineHeight
          
          // Calculate starting Y based on vertical alignment
          let startY: number
          const vAlign = style.verticalAlign || 'top'
          if (vAlign === 'top') {
            startY = cellY + 4
          } else if (vAlign === 'middle') {
            const centered = cellY + (rowHeight - totalHeight) / 2
            // If content would overflow above cell, start from top instead
            startY = Math.max(centered, cellY + 4)
          } else { // bottom
            const fromBottom = cellY + rowHeight - totalHeight - 4
            // If content would overflow above cell, start from top instead
            startY = Math.max(fromBottom, cellY + 4)
          }
          
          ctx.textBaseline = 'top'
          
          lines.forEach((line, index) => {
            const textY = startY + index * lineHeight
            // Only draw lines within cell bounds (check top is within cell)
            if (textY >= cellY && textY < cellY + rowHeight) {
              // Measure text for alignment
              const textMetrics = ctx.measureText(line)
              const textWidth = textMetrics.width
              
              // Calculate horizontal alignment
              const textX = calculateTextX(
                cellX,
                colWidth,
                textWidth,
                style.textAlign || 'left'
              )
              
              ctx.fillText(line, textX, textY)
              
              // Draw underline for multi-line
              if (style.underline) {
                drawUnderline(ctx, textX, textY, textWidth, style.fontSize || 13, style.underline, 'top')
              }
              
              // Draw strikethrough for multi-line
              if (style.strikethrough) {
                drawStrikethrough(ctx, textX, textY, textWidth, style.fontSize || 13, 'top')
              }
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
