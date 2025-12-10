/**
 * Cell content rendering module: draws cell text, selection highlights, and formula references.
 * Depends on geometry module for positions and the FormulaSheet for values.
 * 
 * 性能优化 v1.2.0：
 * - 支持通过 positionAccessor 注入缓存的位置计算函数
 * - 当提供 positionAccessor 时，使用 O(1) 的 PositionIndex 查找
 * - 否则回退到原来的 O(n) 累加计算
 */

import type { GeometryConfig, SizeAccess, FormulaReference, CellStyle, CellBorder, BorderEdge, MergedCellInfo, MergedRegion, CellImage, PositionAccessor } from './types'
import { BORDER_PRESETS } from './types'
import { getRowHeight as geomGetRowHeight, getColWidth as geomGetColWidth, getRowTop as geomGetRowTop, getColLeft as geomGetColLeft } from './geometry'
import { renderCellImage } from './renderCellImage'

/**
 * 简单的 LRU 缓存实现，用于 measureText 缓存
 */
class TextMeasureCache {
  private cache = new Map<string, number>()
  private maxSize: number
  
  constructor(maxSize = 500) {
    this.maxSize = maxSize
  }
  
  /**
   * 获取或计算文本宽度
   * @param ctx Canvas context
   * @param text 要测量的文本
   * @param font 字体字符串
   * @returns 文本宽度
   */
  measure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
    const key = `${font}|${text}`
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      // LRU: 将访问过的项移到末尾
      this.cache.delete(key)
      this.cache.set(key, cached)
      return cached
    }
    
    // 确保使用正确的字体
    if (ctx.font !== font) {
      ctx.font = font
    }
    const width = ctx.measureText(text).width
    
    // 缓存大小限制
    if (this.cache.size >= this.maxSize) {
      // 删除最老的条目（Map 的第一个）
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, width)
    return width
  }
  
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear()
  }
}

// 全局文本测量缓存实例
const textMeasureCache = new TextMeasureCache()

/**
 * 将 HEX 颜色转换为带透明度的 RGBA
 * @param hex HEX 颜色（支持 #RGB, #RRGGBB）
 * @param alpha 透明度 (0-1)
 * @returns RGBA 字符串
 */
function hexToRgba(hex: string, alpha: number): string {
  // 移除 # 前缀
  const cleanHex = hex.replace('#', '')
  
  let r: number, g: number, b: number
  
  if (cleanHex.length === 3) {
    // 短格式 #RGB
    const r0 = cleanHex.charAt(0)
    const g0 = cleanHex.charAt(1)
    const b0 = cleanHex.charAt(2)
    r = parseInt(r0 + r0, 16)
    g = parseInt(g0 + g0, 16)
    b = parseInt(b0 + b0, 16)
  } else {
    // 长格式 #RRGGBB
    r = parseInt(cleanHex.substring(0, 2), 16)
    g = parseInt(cleanHex.substring(2, 4), 16)
    b = parseInt(cleanHex.substring(4, 6), 16)
  }
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
 * @param padding Horizontal padding (default: 2px, similar to Excel)
 * @returns Calculated X position for fillText
 */
function calculateTextX(
  cellX: number,
  cellWidth: number,
  textWidth: number,
  textAlign: 'left' | 'center' | 'right' = 'left',
  padding: number = 2
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
 * @param padding Vertical padding (default: 2px, similar to Excel)
 * @returns Object with textY position and appropriate textBaseline setting
 */
function calculateTextY(
  cellY: number,
  cellHeight: number,
  _fontSize: number,
  verticalAlign: 'top' | 'middle' | 'bottom' = 'middle',
  padding: number = 2
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
 * @param padding Horizontal padding to subtract from maxWidth (default: 4px, 2px each side)
 * @returns Array of text lines
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  padding: number = 4
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
  /** 多选区（Ctrl+点击产生的多个不连续选区） */
  multiSelection?: {
    ranges: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>
    active: boolean
  }
  /** 复制区域（蚂蚁线）*/
  copyRange?: {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    visible: boolean
  }
  /** 蚂蚁线动画偏移量 */
  marchingAntsOffset?: number
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
  // Border provider
  model?: {
    getCellBorder: (row: number, col: number) => CellBorder | undefined
  }
  // Helper for selection range text
  getSelectionRangeText?: (startRow: number, startCol: number, endRow: number, endCol: number) => string
  // Merge cell providers
  getMergedCellInfo?: (row: number, col: number) => MergedCellInfo
  getMergedRegion?: (row: number, col: number) => MergedRegion | null
  // All merged regions for rendering merged cells that start outside visible area
  mergedRegions?: MergedRegion[]
  // Cell image providers
  getCellDisplayImage?: (row: number, col: number) => CellImage | undefined
  getCellImageCount?: (row: number, col: number) => number
  // Visible range
  startRow: number
  endRow: number
  startCol: number
  endCol: number
  /** 跨 Sheet 选区高亮颜色（用于公式栏跨 Sheet 引用） */
  crossSheetSelectionColor?: string
  /** 是否隐藏默认选区（跨 Sheet 公式模式下不显示默认选中单元格） */
  hideDefaultSelection?: boolean
  /** 位置访问器（可选，提供时使用缓存的 O(1) 查找） */
  positionAccessor?: PositionAccessor
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
    getMergedCellInfo,
    // getMergedRegion is available but not used in this function (used via config.model)
    mergedRegions = [],
    getCellDisplayImage,
    getCellImageCount,
    startRow,
    endRow,
    startCol,
    endCol,
    positionAccessor
  } = config
  
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig
  
  // 使用 positionAccessor（如果提供）或回退到 geometry 函数
  const getRowHeight = positionAccessor?.getRowHeight ?? ((r: number) => geomGetRowHeight(r, sizes, geometryConfig))
  const getColWidth = positionAccessor?.getColWidth ?? ((c: number) => geomGetColWidth(c, sizes, geometryConfig))
  const getRowTop = positionAccessor?.getRowTop ?? ((r: number) => geomGetRowTop(r, sizes, geometryConfig))
  const getColLeft = positionAccessor?.getColLeft ?? ((c: number) => geomGetColLeft(c, sizes, geometryConfig))
  
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  
  // Set clipping region to ensure content doesn't draw over headers
  ctx.save()
  ctx.beginPath()
  ctx.rect(rowHeaderWidth, colHeaderHeight, w - rowHeaderWidth, h - colHeaderHeight)
  ctx.clip()

  ctx.textBaseline = 'middle'

  // 性能优化：跟踪当前字体和颜色，避免重复设置
  let currentFont = ''
  let currentFillStyle = ''

  // 辅助函数：计算合并单元格的总宽度
  const getMergedWidth = (startC: number, endC: number): number => {
    let width = 0
    for (let c = startC; c <= endC; c++) {
      width += getColWidth(c)
    }
    return width
  }

  // 辅助函数：计算合并单元格的总高度
  const getMergedHeight = (startR: number, endR: number): number => {
    let height = 0
    for (let r = startR; r <= endR; r++) {
      height += getRowHeight(r)
    }
    return height
  }

  // 辅助函数：渲染单元格内容
  // 性能优化：合并背景和文本的 save/clip/restore 为一次调用
  const renderCellContent = (
    r: number, 
    c: number, 
    cellX: number, 
    cellY: number, 
    colWidth: number, 
    rowHeight: number
  ) => {
    // Get cell style first for background rendering
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
    
    // 计算裁剪区域（只计算一次）
    const clipX = Math.max(cellX, rowHeaderWidth)
    const clipY = Math.max(cellY, colHeaderHeight)
    
    // Save current drawing state - 只保存一次
    ctx.save()
    
    // Create clipping region limited to current cell (or merged cell area)
    ctx.beginPath()
    ctx.rect(clipX, clipY, colWidth, rowHeight)
    ctx.clip()
    
    // Draw background color if specified (留出1px的网格线空间)
    if (style.backgroundColor && style.backgroundColor !== '#FFFFFF') {
      ctx.fillStyle = style.backgroundColor
      ctx.fillRect(cellX + 0.5, cellY + 0.5, colWidth - 1, rowHeight - 1)
    }
    
    // Render cell image if present (图片优先于文本)
    if (getCellDisplayImage && getCellImageCount) {
      const displayImage = getCellDisplayImage(r, c)
      if (displayImage) {
        const imageCount = getCellImageCount(r, c)
        renderCellImage(
          ctx,
          displayImage,
          cellX,
          cellY,
          colWidth,
          rowHeight,
          imageCount,
          rowHeaderWidth,
          colHeaderHeight,
          style.textAlign,    // 传递单元格水平对齐
          style.verticalAlign // 传递单元格垂直对齐
        )
        // 如果有图片，不渲染文本（图片和文本不共存）
        ctx.restore()
        return
      }
    }
    
    const displayValue = getCellValue(r, c)
    if (displayValue === null || displayValue === undefined) {
      ctx.restore()
      return
    }
    
    // 继续在同一裁剪区域内渲染文本（无需再次 save/clip）
    
    // Apply cell style - 性能优化：只在变化时设置
    const font = buildFontString(style)
    if (font !== currentFont) {
      ctx.font = font
      currentFont = font
    }
    const fillStyle = style.color || '#000'
    if (fillStyle !== currentFillStyle) {
      ctx.fillStyle = fillStyle
      currentFillStyle = fillStyle
    }
    
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
      // 使用缓存的文本测量
      const textWidth = textMeasureCache.measure(ctx, text, font)
      
      // Calculate vertical alignment
      const { textY, textBaseline } = calculateTextY(
        cellY,
        rowHeight,
        style.fontSize || 12,
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
      
      // Draw underline if enabled
      if (style.underline) {
        drawUnderline(ctx, textX, textY, textWidth, style.fontSize || 12, style.underline, textBaseline)
      }
      
      // Draw strikethrough if enabled
      if (style.strikethrough) {
        drawStrikethrough(ctx, textX, textY, textWidth, style.fontSize || 12, textBaseline)
      }
    } else {
      // Multi-line: render each line
      const lineHeight = (style.fontSize || 12) * 1.2
      const totalHeight = lines.length * lineHeight
      
      // Calculate starting Y position based on vertical alignment
      let startY: number
      switch (style.verticalAlign) {
        case 'top':
          startY = cellY + lineHeight / 2 + 2
          break
        case 'bottom':
          startY = cellY + rowHeight - totalHeight + lineHeight / 2 - 2
          break
        case 'middle':
        default:
          startY = cellY + (rowHeight - totalHeight) / 2 + lineHeight / 2
      }
      
      ctx.textBaseline = 'middle'
      
      lines.forEach((line, idx) => {
        // 使用缓存的文本测量
        const lineWidth = textMeasureCache.measure(ctx, line, font)
        const lineX = calculateTextX(cellX, colWidth, lineWidth, style.textAlign || 'left')
        const lineY = startY + idx * lineHeight
        
        ctx.fillText(line, lineX, lineY)
        
        // Draw underline for each line
        if (style.underline) {
          drawUnderline(ctx, lineX, lineY, lineWidth, style.fontSize || 12, style.underline, 'middle')
        }
        
        // Draw strikethrough for each line
        if (style.strikethrough) {
          drawStrikethrough(ctx, lineX, lineY, lineWidth, style.fontSize || 12, 'middle')
        }
      })
    }
    
    ctx.restore()
    // restore 会恢复字体状态，需要重置缓存变量
    currentFont = ''
    currentFillStyle = ''
  }

  // 收集需要渲染的合并区域（主单元格在可视区域外，但合并区域与可视区域有交集）
  const mergedRegionsToRender = new Set<string>()
  for (const region of mergedRegions) {
    // 检查合并区域是否与可视区域有交集
    const hasIntersection = !(
      region.endRow < startRow ||
      region.startRow > endRow ||
      region.endCol < startCol ||
      region.startCol > endCol
    )
    
    // 主单元格是否在可视区域外
    const masterOutside = region.startRow < startRow || region.startCol < startCol
    
    if (hasIntersection && masterOutside) {
      mergedRegionsToRender.add(`${region.startRow},${region.startCol}`)
    }
  }

  // 先渲染主单元格在可视区域外的合并单元格
  for (const region of mergedRegions) {
    const key = `${region.startRow},${region.startCol}`
    if (mergedRegionsToRender.has(key)) {
      const cellX = rowHeaderWidth + getColLeft(region.startCol) - viewport.scrollLeft
      const cellY = colHeaderHeight + getRowTop(region.startRow) - viewport.scrollTop
      const mergedWidth = getMergedWidth(region.startCol, region.endCol)
      const mergedHeight = getMergedHeight(region.startRow, region.endRow)
      
      renderCellContent(region.startRow, region.startCol, cellX, cellY, mergedWidth, mergedHeight)
    }
  }

  // 性能优化：预计算可见列的宽度和左边位置
  const colWidthCache: number[] = []
  const colLeftCache: number[] = []
  for (let c = startCol; c <= endCol; c++) {
    colWidthCache[c - startCol] = getColWidth(c)
    colLeftCache[c - startCol] = getColLeft(c)
  }

  // Draw visible cells from model
  for (let r = startRow; r <= endRow; r++) {
    const rowHeight = getRowHeight(r)
    // 跳过隐藏的行
    if (rowHeight <= 0) continue
    
    const cellY = colHeaderHeight + getRowTop(r) - viewport.scrollTop
    
    for (let c = startCol; c <= endCol; c++) {
      // 使用预计算的列宽和位置缓存
      const cacheIdx = c - startCol
      const colWidth = colWidthCache[cacheIdx]!
      // 跳过隐藏的列
      if (colWidth <= 0) continue
      
      // 检查合并单元格信息
      const mergeInfo = getMergedCellInfo?.(r, c)
      
      // 如果是合并单元格的非主单元格，跳过渲染
      if (mergeInfo?.isMerged && !mergeInfo.isMaster) {
        continue
      }

      // 计算单元格位置和尺寸 - 使用预计算缓存
      const cellX = rowHeaderWidth + colLeftCache[cacheIdx]! - viewport.scrollLeft
      let actualColWidth = colWidth
      let actualRowHeight = rowHeight

      // 如果是合并单元格的主单元格，使用合并区域的尺寸
      if (mergeInfo?.isMaster && mergeInfo.region) {
        const region = mergeInfo.region
        actualColWidth = getMergedWidth(region.startCol, region.endCol)
        actualRowHeight = getMergedHeight(region.startRow, region.endRow)
      }
      
      renderCellContent(r, c, cellX, cellY, actualColWidth, actualRowHeight)
    }
  }

  // Draw cell borders (after cell content, before selection highlights)
  // This ensures borders are visible but don't cover selection highlights
  if (config.model && config.model.getCellBorder) {
    // 记录已绘制边框的合并区域，避免重复
    const drawnMergedBorders = new Set<string>()
    
    for (let r = startRow; r <= endRow; r++) {
      const rowHeight = getRowHeight(r)
      // 跳过隐藏的行
      if (rowHeight <= 0) continue
      
      const cellY = colHeaderHeight + getRowTop(r) - viewport.scrollTop
      
      for (let c = startCol; c <= endCol; c++) {
        // 使用预计算的列宽和位置缓存
        const cacheIdx = c - startCol
        const colWidth = colWidthCache[cacheIdx]!
        // 跳过隐藏的列
        if (colWidth <= 0) continue
        
        const cellX = rowHeaderWidth + colLeftCache[cacheIdx]! - viewport.scrollLeft
        
        // 检查单元格是否在合并区域内
        const mergeInfo = getMergedCellInfo?.(r, c)
        
        if (mergeInfo?.isMerged && mergeInfo.region) {
          // 合并区域：只从主单元格获取边框，且只绘制一次
          const region = mergeInfo.region
          const regionKey = `${region.startRow},${region.startCol}`
          
          if (!drawnMergedBorders.has(regionKey)) {
            drawnMergedBorders.add(regionKey)
            
            // 从主单元格获取边框
            const masterBorder = config.model.getCellBorder(region.startRow, region.startCol)
            if (masterBorder) {
              // 计算合并区域的实际位置和大小
              const mergeX = rowHeaderWidth + getColLeft(region.startCol) - viewport.scrollLeft
              const mergeY = colHeaderHeight + getRowTop(region.startRow) - viewport.scrollTop
              const mergeWidth = getColLeft(region.endCol + 1) - getColLeft(region.startCol)
              const mergeHeight = getRowTop(region.endRow + 1) - getRowTop(region.startRow)
              
              // 在合并区域的边界上绘制边框
              drawCellBorder(ctx, mergeX, mergeY, mergeWidth, mergeHeight, masterBorder)
            }
          }
        } else {
          // 普通单元格，正常绘制边框
          const border = config.model.getCellBorder(r, c)
          if (border) {
            drawCellBorder(ctx, cellX, cellY, colWidth, rowHeight, border)
          }
        }
      }
    }
  }

  // 渲染多选区（Ctrl+点击产生的多个不连续选区）
  const { multiSelection } = config
  if (multiSelection && multiSelection.active && multiSelection.ranges.length > 0) {
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    
    for (const range of multiSelection.ranges) {
      if (range.startRow < 0 || range.startCol < 0) continue
      
      const drawnMergedRegions = new Set<string>()
      
      for (let r = range.startRow; r <= range.endRow; r++) {
        for (let c = range.startCol; c <= range.endCol; c++) {
          const mergeInfo = getMergedCellInfo?.(r, c)
          
          if (mergeInfo?.isMerged && mergeInfo.region) {
            const regionKey = `${mergeInfo.region.startRow},${mergeInfo.region.startCol}`
            if (!drawnMergedRegions.has(regionKey)) {
              drawnMergedRegions.add(regionKey)
              const sx = rowHeaderWidth + getColLeft(mergeInfo.region.startCol) - viewport.scrollLeft
              const sy = colHeaderHeight + getRowTop(mergeInfo.region.startRow) - viewport.scrollTop
              const ex = rowHeaderWidth + getColLeft(mergeInfo.region.endCol + 1) - viewport.scrollLeft
              const ey = colHeaderHeight + getRowTop(mergeInfo.region.endRow + 1) - viewport.scrollTop
              if (ex > 0 && sx < w && ey > 0 && sy < h) {
                ctx.fillRect(sx, sy, ex - sx, ey - sy)
              }
            }
          } else {
            const sx = rowHeaderWidth + getColLeft(c) - viewport.scrollLeft
            const sy = colHeaderHeight + getRowTop(r) - viewport.scrollTop
            const colWidth = getColWidth(c)
            const rowHeight = getRowHeight(r)
            
            if (sx + colWidth > 0 && sx < w && sy + rowHeight > 0 && sy < h) {
              ctx.fillRect(sx, sy, colWidth, rowHeight)
            }
          }
        }
      }
      
      // 绘制多选区边框（使用虚线样式区分）
      const sx = rowHeaderWidth + getColLeft(range.startCol) - viewport.scrollLeft
      const sy = colHeaderHeight + getRowTop(range.startRow) - viewport.scrollTop
      const ex = rowHeaderWidth + getColLeft(range.endCol + 1) - viewport.scrollLeft
      const ey = colHeaderHeight + getRowTop(range.endRow + 1) - viewport.scrollTop
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
      ctx.setLineDash([])
    }
  }

  // Highlight selection range (fill with light blue)
  // 只有当选区包含多个单元格时才绘制背景遮罩，单个单元格（活动单元格）不需要遮罩
  const isSingleCellSelection = selectionRange.startRow === selectionRange.endRow && 
                                 selectionRange.startCol === selectionRange.endCol
  
  // 跨 Sheet 公式模式使用自定义颜色
  const selectionFillColor = config.crossSheetSelectionColor 
    ? hexToRgba(config.crossSheetSelectionColor, 0.15)
    : 'rgba(59, 130, 246, 0.1)'
  const selectionBorderColor = config.crossSheetSelectionColor || '#3b82f6'
  
  // 如果隐藏默认选区，跳过选区绘制
  if (config.hideDefaultSelection) {
    // 跨 Sheet 公式模式：不绘制默认选区，等待用户主动点击选择
  } else if (selectionRange.startRow >= 0 && selectionRange.startCol >= 0 && !isSingleCellSelection) {
    ctx.fillStyle = selectionFillColor
    
    // 记录已绘制的合并区域，避免重复绘制
    const drawnMergedRegions = new Set<string>()
    
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        const mergeInfo = getMergedCellInfo?.(r, c)
        
        if (mergeInfo?.isMerged && mergeInfo.region) {
          // 合并区域：只绘制一次整个区域
          const regionKey = `${mergeInfo.region.startRow},${mergeInfo.region.startCol}`
          if (!drawnMergedRegions.has(regionKey)) {
            drawnMergedRegions.add(regionKey)
            // 绘制整个合并区域
            const sx = rowHeaderWidth + getColLeft(mergeInfo.region.startCol) - viewport.scrollLeft
            const sy = colHeaderHeight + getRowTop(mergeInfo.region.startRow) - viewport.scrollTop
            const ex = rowHeaderWidth + getColLeft(mergeInfo.region.endCol + 1) - viewport.scrollLeft
            const ey = colHeaderHeight + getRowTop(mergeInfo.region.endRow + 1) - viewport.scrollTop
            if (ex > 0 && sx < w && ey > 0 && sy < h) {
              ctx.fillRect(sx, sy, ex - sx, ey - sy)
            }
          }
        } else {
          // 普通单元格：正常绘制
          const sx = rowHeaderWidth + getColLeft(c) - viewport.scrollLeft
          const sy = colHeaderHeight + getRowTop(r) - viewport.scrollTop
          const colWidth = getColWidth(c)
          const rowHeight = getRowHeight(r)
          
          if (sx + colWidth > 0 && sx < w && sy + rowHeight > 0 && sy < h) {
            ctx.fillRect(sx, sy, colWidth, rowHeight)
          }
        }
      }
    }
    // Draw border around selection range
    const sx = rowHeaderWidth + getColLeft(selectionRange.startCol) - viewport.scrollLeft
    const sy = colHeaderHeight + getRowTop(selectionRange.startRow) - viewport.scrollTop
    const ex = rowHeaderWidth + getColLeft(selectionRange.endCol + 1) - viewport.scrollLeft
    const ey = colHeaderHeight + getRowTop(selectionRange.endRow + 1) - viewport.scrollTop
    ctx.strokeStyle = selectionBorderColor
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
  }

  // Highlight single selection
  // 如果选中的单元格在合并区域内，且选择范围已经覆盖整个合并区域，则不绘制额外的单选框
  if (selected.row >= 0 && selected.col >= 0 && !config.hideDefaultSelection) {
    const mergeInfo = getMergedCellInfo?.(selected.row, selected.col)
    const isInMergedRegion = mergeInfo?.isMerged
    
    // 检查选择范围是否已经覆盖了合并区域
    const selectionCoversRegion = isInMergedRegion && mergeInfo?.region && 
      selectionRange.startRow <= mergeInfo.region.startRow &&
      selectionRange.startCol <= mergeInfo.region.startCol &&
      selectionRange.endRow >= mergeInfo.region.endRow &&
      selectionRange.endCol >= mergeInfo.region.endCol
    
    // 只有当选中单元格不在合并区域内，或者选择范围没有覆盖合并区域时，才绘制单选框
    if (!selectionCoversRegion) {
      const sx = rowHeaderWidth + getColLeft(selected.col) - viewport.scrollLeft
      const sy = colHeaderHeight + getRowTop(selected.row) - viewport.scrollTop
      const colWidth = getColWidth(selected.col)
      const rowHeight = getRowHeight(selected.row)
      ctx.strokeStyle = selectionBorderColor
      ctx.lineWidth = 2
      ctx.strokeRect(sx + 0.5, sy + 0.5, colWidth - 1, rowHeight - 1)
    }
  }

  // Draw colored borders for formula references (Excel style)
  if (formulaReferences.length > 0) {
    for (const ref of formulaReferences) {
      const sx = rowHeaderWidth + getColLeft(ref.startCol) - viewport.scrollLeft
      const sy = colHeaderHeight + getRowTop(ref.startRow) - viewport.scrollTop
      const ex = rowHeaderWidth + getColLeft(ref.endCol + 1) - viewport.scrollLeft
      const ey = colHeaderHeight + getRowTop(ref.endRow + 1) - viewport.scrollTop
      const width = ex - sx
      const height = ey - sy
      
      
      // Only draw visible references
      if (sx + width > 0 && sx < w && sy + height > 0 && sy < h) {
        ctx.save()
        ctx.strokeStyle = ref.color
        ctx.lineWidth = 3  // 加粗便于观察
        ctx.strokeRect(sx + 1, sy + 1, width - 2, height - 2)
        ctx.restore()
      } else {
      }
    }
  }

  // Draw dashed box during dragging (only when mouse has actually moved)
  // 只有当鼠标真正移动了（起点和当前点不同）时才绘制虚线拖拽框
  const hasDragged = dragState.startRow !== dragState.currentRow || dragState.startCol !== dragState.currentCol
  if (dragState.isDragging && dragState.startRow >= 0 && dragState.startCol >= 0 && hasDragged) {
    const startRow = Math.min(dragState.startRow, dragState.currentRow)
    const startCol = Math.min(dragState.startCol, dragState.currentCol)
    const endRow = Math.max(dragState.startRow, dragState.currentRow)
    const endCol = Math.max(dragState.startCol, dragState.currentCol)

    // Calculate dashed box coordinates
    const sx = rowHeaderWidth + getColLeft(startCol) - viewport.scrollLeft
    const sy = colHeaderHeight + getRowTop(startRow) - viewport.scrollTop
    const ex = rowHeaderWidth + getColLeft(endCol + 1) - viewport.scrollLeft
    const ey = colHeaderHeight + getRowTop(endRow + 1) - viewport.scrollTop
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
  
  // Draw marching ants (animated dashed border) for copy range
  // 蚂蚁线层级最高，在所有选择框之上
  const { copyRange, marchingAntsOffset = 0 } = config
  if (copyRange && copyRange.visible && copyRange.startRow >= 0) {
    const sx = rowHeaderWidth + getColLeft(copyRange.startCol) - viewport.scrollLeft
    const sy = colHeaderHeight + getRowTop(copyRange.startRow) - viewport.scrollTop
    const ex = rowHeaderWidth + getColLeft(copyRange.endCol + 1) - viewport.scrollLeft
    const ey = colHeaderHeight + getRowTop(copyRange.endRow + 1) - viewport.scrollTop
    const width = ex - sx
    const height = ey - sy
    
    // Only draw if visible
    if (sx + width > rowHeaderWidth && sx < w && sy + height > colHeaderHeight && sy < h) {
      ctx.save()
      // 先绘制白色底边，让蚂蚁线更清晰可见
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.strokeRect(sx + 0.5, sy + 0.5, width - 1, height - 1)
      // 再绘制墨绿色蚂蚁线
      ctx.strokeStyle = '#3871E0'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.lineDashOffset = -marchingAntsOffset
      ctx.strokeRect(sx + 0.5, sy + 0.5, width - 1, height - 1)
      ctx.restore()
    }
  }
  
  // Restore clipping region
  ctx.restore()
}

// ==================== 边框绘制功能 ====================

/**
 * Draw a single border edge (one side of a cell)
 * @param ctx Canvas context
 * @param x1 Start X coordinate
 * @param y1 Start Y coordinate
 * @param x2 End X coordinate
 * @param y2 End Y coordinate
 * @param edge Border edge configuration
 * @param direction Line direction (horizontal or vertical)
 */
function drawBorderEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  edge: BorderEdge,
  direction: 'horizontal' | 'vertical'
): void {
  if (edge.style === 'none') return

  const preset = BORDER_PRESETS[edge.style]
  const width = edge.width ?? preset.width
  const color = edge.color ?? '#000000'

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width

  // Set line dash pattern for dashed/dotted styles
  if (preset.pattern.length > 0) {
    ctx.setLineDash([...preset.pattern])
  }

  // Double border requires special handling
  if (edge.style === 'double') {
    drawDoubleBorder(ctx, x1, y1, x2, y2, width, direction)
  } else {
    // Single line border
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Draw double border (two parallel lines)
 * @param ctx Canvas context
 * @param x1 Start X coordinate
 * @param y1 Start Y coordinate
 * @param x2 End X coordinate
 * @param y2 End Y coordinate
 * @param width Total border width
 * @param direction Line direction
 */
function drawDoubleBorder(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  direction: 'horizontal' | 'vertical'
): void {
  const gap = 1 // Gap between the two lines
  const lineWidth = Math.max(1, Math.floor((width - gap) / 2))
  
  ctx.lineWidth = lineWidth

  if (direction === 'horizontal') {
    // Top line
    ctx.beginPath()
    ctx.moveTo(x1, y1 - gap / 2 - lineWidth / 2)
    ctx.lineTo(x2, y2 - gap / 2 - lineWidth / 2)
    ctx.stroke()
    
    // Bottom line
    ctx.beginPath()
    ctx.moveTo(x1, y1 + gap / 2 + lineWidth / 2)
    ctx.lineTo(x2, y2 + gap / 2 + lineWidth / 2)
    ctx.stroke()
  } else {
    // Left line
    ctx.beginPath()
    ctx.moveTo(x1 - gap / 2 - lineWidth / 2, y1)
    ctx.lineTo(x2 - gap / 2 - lineWidth / 2, y2)
    ctx.stroke()
    
    // Right line
    ctx.beginPath()
    ctx.moveTo(x1 + gap / 2 + lineWidth / 2, y1)
    ctx.lineTo(x2 + gap / 2 + lineWidth / 2, y2)
    ctx.stroke()
  }
}

/**
 * Draw all borders for a single cell
 * @param ctx Canvas context
 * @param x Cell X position
 * @param y Cell Y position
 * @param width Cell width
 * @param height Cell height
 * @param border Cell border configuration
 */
export function drawCellBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  border: CellBorder
): void {
  if (!border) return

  // Draw borders in order: top -> right -> bottom -> left
  // This ensures proper corner connections
  
  if (border.top) {
    drawBorderEdge(ctx, x, y, x + width, y, border.top, 'horizontal')
  }
  
  if (border.right) {
    drawBorderEdge(ctx, x + width, y, x + width, y + height, border.right, 'vertical')
  }
  
  if (border.bottom) {
    drawBorderEdge(ctx, x, y + height, x + width, y + height, border.bottom, 'horizontal')
  }
  
  if (border.left) {
    drawBorderEdge(ctx, x, y, x, y + height, border.left, 'vertical')
  }
}
