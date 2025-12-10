/**
 * Grid rendering module: draws grid lines, column/row headers, and hover highlights.
 * Depends on geometry module for sizes and positions.
 * 
 * 性能优化 v1.2.0：
 * - 支持通过 positionAccessor 注入缓存的位置计算函数
 * - 当提供 positionAccessor 时，使用 O(1) 的 PositionIndex 查找
 * - 否则回退到原来的 O(n) 累加计算
 */

import type { GeometryConfig, SizeAccess, MergedRegion, SelectionRange, MultiSelectionState, SelectedCell, PositionAccessor } from './types'
import { getColWidth as geomGetColWidth, getRowHeight as geomGetRowHeight, getColLeft as geomGetColLeft, getRowTop as geomGetRowTop, getVisibleRange } from './geometry'

export interface GridRenderConfig {
  containerWidth: number
  containerHeight: number
  viewport: { scrollTop: number; scrollLeft: number }
  hoverState: { type: '' | 'row' | 'col'; index: number }
  totalRows: number
  totalCols: number
  sizes: SizeAccess
  geometryConfig: GeometryConfig
  /** 合并单元格区域列表 */
  mergedRegions?: MergedRegion[]
  /** 当前选中的单元格 */
  selected?: SelectedCell
  /** 选区范围 */
  selectionRange?: SelectionRange
  /** 多选区 */
  multiSelection?: MultiSelectionState
  /** 位置访问器（可选，提供时使用缓存的 O(1) 查找） */
  positionAccessor?: PositionAccessor
}

/**
 * 检查一条水平网格线是否在合并区域内部
 * @param row 网格线所在的行（行底部边界）
 * @param col 网格线经过的列
 * @param mergedRegions 合并区域列表
 * @returns 如果在合并区域内部则返回 true
 */
function isHorizontalGridLineInMergedRegion(
  row: number,
  col: number,
  mergedRegions: MergedRegion[]
): boolean {
  for (const region of mergedRegions) {
    // 水平线在合并区域内部：行在 startRow 到 endRow-1 之间，列在 startCol 到 endCol 之间
    if (
      row >= region.startRow &&
      row < region.endRow &&
      col >= region.startCol &&
      col <= region.endCol
    ) {
      return true
    }
  }
  return false
}

/**
 * 检查一条垂直网格线是否在合并区域内部
 * @param row 网格线经过的行
 * @param col 网格线所在的列（列右边界）
 * @param mergedRegions 合并区域列表
 * @returns 如果在合并区域内部则返回 true
 */
function isVerticalGridLineInMergedRegion(
  row: number,
  col: number,
  mergedRegions: MergedRegion[]
): boolean {
  for (const region of mergedRegions) {
    // 垂直线在合并区域内部：列在 startCol 到 endCol-1 之间，行在 startRow 到 endRow 之间
    if (
      col >= region.startCol &&
      col < region.endCol &&
      row >= region.startRow &&
      row <= region.endRow
    ) {
      return true
    }
  }
  return false
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
/**
 * 计算选中的行和列范围
 */
function getSelectedRowsAndCols(
  selected: SelectedCell | undefined,
  selectionRange: SelectionRange | undefined,
  multiSelection: MultiSelectionState | undefined
): { selectedRows: Set<number>; selectedCols: Set<number> } {
  const selectedRows = new Set<number>()
  const selectedCols = new Set<number>()
  
  // 添加当前选区
  if (selectionRange && selectionRange.startRow >= 0) {
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol)
    for (let r = minRow; r <= maxRow; r++) selectedRows.add(r)
    for (let c = minCol; c <= maxCol; c++) selectedCols.add(c)
  } else if (selected && selected.row >= 0 && selected.col >= 0) {
    // 如果没有选区，使用单个选中的单元格
    selectedRows.add(selected.row)
    selectedCols.add(selected.col)
  }
  
  // 添加多选区的行列
  if (multiSelection && multiSelection.ranges.length > 0) {
    for (const range of multiSelection.ranges) {
      const minRow = Math.min(range.startRow, range.endRow)
      const maxRow = Math.max(range.startRow, range.endRow)
      const minCol = Math.min(range.startCol, range.endCol)
      const maxCol = Math.max(range.startCol, range.endCol)
      for (let r = minRow; r <= maxRow; r++) selectedRows.add(r)
      for (let c = minCol; c <= maxCol; c++) selectedCols.add(c)
    }
  }
  
  return { selectedRows, selectedCols }
}

export function drawGrid(ctx: CanvasRenderingContext2D, config: GridRenderConfig) {
  const {
    containerWidth: w,
    containerHeight: h,
    viewport,
    hoverState,
    totalRows,
    totalCols,
    sizes,
    geometryConfig,
    mergedRegions = [],
    selected,
    selectionRange,
    multiSelection,
    positionAccessor
  } = config
  
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig
  
  // 使用 positionAccessor（如果提供）或回退到 geometry 函数
  const getRowHeight = positionAccessor?.getRowHeight ?? ((r: number) => geomGetRowHeight(r, sizes, geometryConfig))
  const getColWidth = positionAccessor?.getColWidth ?? ((c: number) => geomGetColWidth(c, sizes, geometryConfig))
  const getRowTop = positionAccessor?.getRowTop ?? ((r: number) => geomGetRowTop(r, sizes, geometryConfig))
  const getColLeft = positionAccessor?.getColLeft ?? ((c: number) => geomGetColLeft(c, sizes, geometryConfig))
  
  // 计算选中的行和列
  const { selectedRows, selectedCols } = getSelectedRowsAndCols(selected, selectionRange, multiSelection)
  
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // 固定使用亮色模式
  const headerBgColor = '#f0f0f0'
  const headerTextColor = '#333'
  // 选中的行/列头背景色（参考Excel的浅绿色）
  const selectedHeaderBgColor = '#e8f5e9'
  // 选中的行/列头文字颜色（深绿色）
  const selectedHeaderTextColor = '#217346'
  
  ctx.fillStyle = headerBgColor
  ctx.fillRect(0, 0, w, colHeaderHeight)
  ctx.fillRect(0, 0, rowHeaderWidth, h)

  const { startRow, endRow, startCol, endCol } = getVisibleRange(w, h, viewport, sizes, geometryConfig, totalRows, totalCols)

  // 检查是否显示网格线（默认为 true）
  const shouldDrawGridLines = sizes.showGridFlag !== false
  const hasMergedRegions = mergedRegions.length > 0

  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  ctx.fillStyle = headerTextColor
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'middle'

  // 如果有合并单元格，使用分段绘制模式
  if (shouldDrawGridLines && hasMergedRegions) {
    // 绘制垂直网格线（按列绘制，分段跳过合并区域）
    for (let c = startCol; c <= endCol + 1; c++) {
      const x = rowHeaderWidth + getColLeft(c) - viewport.scrollLeft
      if (x <= rowHeaderWidth || x >= w) continue
      
      // 对每一列，从上到下分段绘制，跳过合并区域内部
      let currentY = colHeaderHeight
      for (let r = startRow; r <= endRow; r++) {
        const cellY = colHeaderHeight + getRowTop(r) - viewport.scrollTop
        const cellHeight = getRowHeight(r)
        
        // 检查这条垂直线段是否在合并区域内部
        // 垂直线在列 c 的左边界，检查它是否穿过合并区域
        const isInsideMerge = c > 0 && isVerticalGridLineInMergedRegion(r, c - 1, mergedRegions)
        
        if (!isInsideMerge) {
          // 绘制这一段垂直线
          if (cellY >= currentY) {
            ctx.beginPath()
            ctx.moveTo(x, Math.max(cellY, colHeaderHeight))
            ctx.lineTo(x, Math.min(cellY + cellHeight, h))
            ctx.stroke()
          }
        }
        currentY = cellY + cellHeight
      }
    }
    
    // 绘制水平网格线（按行绘制，分段跳过合并区域）
    for (let r = startRow; r <= endRow + 1; r++) {
      const y = colHeaderHeight + getRowTop(r) - viewport.scrollTop
      if (y <= colHeaderHeight || y >= h) continue
      
      // 对每一行，从左到右分段绘制，跳过合并区域内部
      for (let c = startCol; c <= endCol; c++) {
        const cellX = rowHeaderWidth + getColLeft(c) - viewport.scrollLeft
        const cellWidth = getColWidth(c)
        
        // 检查这条水平线段是否在合并区域内部
        const isInsideMerge = r > 0 && isHorizontalGridLineInMergedRegion(r - 1, c, mergedRegions)
        
        if (!isInsideMerge) {
          ctx.beginPath()
          ctx.moveTo(Math.max(cellX, rowHeaderWidth), y)
          ctx.lineTo(Math.min(cellX + cellWidth, w), y)
          ctx.stroke()
        }
      }
    }
  } else if (shouldDrawGridLines) {
    // 无合并单元格时使用原来的整行/整列绘制方式（性能更好）
    // Draw visible columns
    let accumulatedColX = rowHeaderWidth
    for (let c = 0; c < totalCols; c++) {
      const colWidth = getColWidth(c)
      const x = accumulatedColX - viewport.scrollLeft
      
      if (x + colWidth > rowHeaderWidth && x < w && c >= startCol && c <= endCol) {
        ctx.beginPath()
        ctx.moveTo(x, colHeaderHeight)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      
      accumulatedColX += colWidth
      
      const rightX = accumulatedColX - viewport.scrollLeft
      if (rightX > rowHeaderWidth && rightX < w && c >= startCol && c <= endCol) {
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
      const rowHeight = getRowHeight(r)
      const y = accumulatedRowY - viewport.scrollTop
      
      if (y + rowHeight > colHeaderHeight && y < h && r >= startRow && r <= endRow) {
        ctx.beginPath()
        ctx.moveTo(rowHeaderWidth, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      
      accumulatedRowY += rowHeight
      
      const bottomY = accumulatedRowY - viewport.scrollTop
      if (bottomY > colHeaderHeight && bottomY < h && r >= startRow && r <= endRow) {
        ctx.beginPath()
        ctx.moveTo(rowHeaderWidth, bottomY)
        ctx.lineTo(w, bottomY)
        ctx.stroke()
      }
      
      if (accumulatedRowY - viewport.scrollTop > h) break
    }
  }

  // 绘制列标签
  let accumulatedColX = rowHeaderWidth
  for (let c = 0; c < totalCols; c++) {
    const colWidth = getColWidth(c)
    const x = accumulatedColX - viewport.scrollLeft
    
    if (colWidth > 0 && x + colWidth > rowHeaderWidth && x < w && c >= startCol && c <= endCol) {
      const label = getColLabel(c)
      const metrics = ctx.measureText(label)
      ctx.fillText(label, x + (colWidth - metrics.width) / 2, colHeaderHeight / 2)
    }
    
    accumulatedColX += colWidth
    if (accumulatedColX - viewport.scrollLeft > w) break
  }

  // 绘制行标签
  let accumulatedRowY = colHeaderHeight
  for (let r = 0; r < totalRows; r++) {
    const rowHeight = getRowHeight(r)
    const y = accumulatedRowY - viewport.scrollTop
    
    if (rowHeight > 0 && y + rowHeight > colHeaderHeight && y < h && r >= startRow && r <= endRow) {
      const label = (r + 1).toString()
      const metrics = ctx.measureText(label)
      ctx.fillText(label, (rowHeaderWidth - metrics.width) / 2, y + rowHeight / 2)
    }
    
    accumulatedRowY += rowHeight
    if (accumulatedRowY - viewport.scrollTop > h) break
  }
  
  // Redraw header mask layer to cover any overflow content
  // This ensures headers are always on top
  ctx.fillStyle = headerBgColor
  // Column header mask
  ctx.fillRect(0, 0, w, colHeaderHeight)
  // Row header mask  
  ctx.fillRect(0, 0, rowHeaderWidth, h)
  
  // Draw selected column header backgrounds first
  accumulatedColX = rowHeaderWidth
  for (let c = 0; c < totalCols; c++) {
    const colWidth = getColWidth(c)
    const x = accumulatedColX - viewport.scrollLeft
    
    if (colWidth > 0 && x + colWidth > rowHeaderWidth && x < w && c >= startCol && c <= endCol) {
      // 如果该列被选中，绘制高亮背景
      if (selectedCols.has(c)) {
        ctx.fillStyle = selectedHeaderBgColor
        ctx.fillRect(Math.max(x, rowHeaderWidth), 0, Math.min(colWidth, x + colWidth - rowHeaderWidth), colHeaderHeight)
      }
    }
    
    accumulatedColX += colWidth
    if (accumulatedColX - viewport.scrollLeft > w) break
  }
  
  // Draw selected row header backgrounds first
  accumulatedRowY = colHeaderHeight
  for (let r = 0; r < totalRows; r++) {
    const rowHeight = getRowHeight(r)
    const y = accumulatedRowY - viewport.scrollTop
    
    if (rowHeight > 0 && y + rowHeight > colHeaderHeight && y < h && r >= startRow && r <= endRow) {
      // 如果该行被选中，绘制高亮背景
      if (selectedRows.has(r)) {
        ctx.fillStyle = selectedHeaderBgColor
        ctx.fillRect(0, Math.max(y, colHeaderHeight), rowHeaderWidth, Math.min(rowHeight, y + rowHeight - colHeaderHeight))
      }
    }
    
    accumulatedRowY += rowHeight
    if (accumulatedRowY - viewport.scrollTop > h) break
  }
  
  // Redraw column labels and separator lines
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  
  // 获取隐藏行列信息
  const hiddenRows = sizes.hiddenRows || new Set<number>()
  const hiddenCols = sizes.hiddenCols || new Set<number>()
  
  accumulatedColX = rowHeaderWidth
  for (let c = 0; c < totalCols; c++) {
    const colWidth = getColWidth(c)
    const x = accumulatedColX - viewport.scrollLeft
    
    if (colWidth > 0 && x + colWidth > rowHeaderWidth && x < w && c >= startCol && c <= endCol) {
      // Draw column left border line
      // 检查是否有隐藏的列在当前列之前（使用不同颜色的分隔线）
      if (c > 0 && hiddenCols.has(c - 1)) {
        ctx.strokeStyle = '#217346'  // 绿色表示有隐藏列
        ctx.lineWidth = 2
      } else {
        ctx.strokeStyle = '#999'
        ctx.lineWidth = 1
      }
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, colHeaderHeight)
      ctx.stroke()
      ctx.lineWidth = 1
      
      // Draw column label with appropriate color
      const label = getColLabel(c)
      const metrics = ctx.measureText(label)
      ctx.fillStyle = selectedCols.has(c) ? selectedHeaderTextColor : headerTextColor
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
    const rowHeight = getRowHeight(r)
    const y = accumulatedRowY - viewport.scrollTop
    
    if (rowHeight > 0 && y + rowHeight > colHeaderHeight && y < h && r >= startRow && r <= endRow) {
      // Draw row top border line
      // 检查是否有隐藏的行在当前行之前（使用不同颜色的分隔线）
      if (r > 0 && hiddenRows.has(r - 1)) {
        ctx.strokeStyle = '#217346'  // 绿色表示有隐藏行
        ctx.lineWidth = 2
      } else {
        ctx.strokeStyle = '#999'
        ctx.lineWidth = 1
      }
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(rowHeaderWidth, y)
      ctx.stroke()
      ctx.lineWidth = 1
      
      // Draw row label with appropriate color
      const label = (r + 1).toString()
      const metrics = ctx.measureText(label)
      ctx.fillStyle = selectedRows.has(r) ? selectedHeaderTextColor : headerTextColor
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
  ctx.fillStyle = headerBgColor
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
    const rightX = rowHeaderWidth + getColLeft(c + 1) - viewport.scrollLeft
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
    const bottomY = colHeaderHeight + getRowTop(r + 1) - viewport.scrollTop
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
