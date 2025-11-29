/**
 * OffscreenCanvas 渲染 Worker
 * 
 * 在 Web Worker 中执行表格渲染，不阻塞主线程
 */

import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  CellData,
  CellStyleData,
  GeometryConfigData,
  ViewportState,
  SelectionState,
  DragStateData,
  MergedRegionData,
  VisibleRange
} from './renderProtocol'

// ==================== Worker 状态 ====================

/** 渲染器状态 */
interface RendererState {
  canvas: OffscreenCanvas | null
  ctx: OffscreenCanvasRenderingContext2D | null
  dpr: number
  width: number
  height: number
  config: GeometryConfigData
  totalRows: number
  totalCols: number
  viewport: ViewportState
  selection: SelectionState
  dragState: DragStateData
  cells: Map<string, CellData>
  styles: Map<string, CellStyleData>
  rowHeights: Map<number, number>
  colWidths: Map<number, number>
  hiddenRows: Set<number>
  hiddenCols: Set<number>
  mergedRegions: MergedRegionData[]
  
  // 性能统计
  frameCount: number
  totalRenderTime: number
  lastRenderTimes: number[]
}

// 初始化状态
const state: RendererState = {
  canvas: null,
  ctx: null,
  dpr: 1,
  width: 0,
  height: 0,
  config: {
    defaultRowHeight: 25,
    defaultColWidth: 100,
    rowHeaderWidth: 50,
    colHeaderHeight: 25
  },
  totalRows: 100,
  totalCols: 26,
  viewport: { scrollTop: 0, scrollLeft: 0 },
  selection: { row: -1, col: -1, startRow: -1, startCol: -1, endRow: -1, endCol: -1 },
  dragState: { isDragging: false, startRow: -1, startCol: -1, currentRow: -1, currentCol: -1 },
  cells: new Map(),
  styles: new Map(),
  rowHeights: new Map(),
  colWidths: new Map(),
  hiddenRows: new Set(),
  hiddenCols: new Set(),
  mergedRegions: [],
  frameCount: 0,
  totalRenderTime: 0,
  lastRenderTimes: []
}

// ==================== 几何计算函数 ====================

function getRowHeight(row: number): number {
  if (state.hiddenRows.has(row)) return 0
  return state.rowHeights.get(row) ?? state.config.defaultRowHeight
}

function getColWidth(col: number): number {
  if (state.hiddenCols.has(col)) return 0
  return state.colWidths.get(col) ?? state.config.defaultColWidth
}

function getRowTop(row: number): number {
  let top = 0
  for (let r = 0; r < row; r++) {
    top += getRowHeight(r)
  }
  return top
}

function getColLeft(col: number): number {
  let left = 0
  for (let c = 0; c < col; c++) {
    left += getColWidth(c)
  }
  return left
}

function getVisibleRange(): VisibleRange {
  const { scrollTop, scrollLeft } = state.viewport
  const { rowHeaderWidth, colHeaderHeight } = state.config
  
  // 计算可见起始行
  let startRow = 0
  let accY = 0
  while (startRow < state.totalRows && accY + getRowHeight(startRow) < scrollTop) {
    accY += getRowHeight(startRow)
    startRow++
  }
  
  // 计算可见结束行
  let endRow = startRow
  accY = getRowTop(startRow) - scrollTop + colHeaderHeight
  while (endRow < state.totalRows && accY < state.height) {
    accY += getRowHeight(endRow)
    endRow++
  }
  endRow = Math.min(endRow, state.totalRows - 1)
  
  // 计算可见起始列
  let startCol = 0
  let accX = 0
  while (startCol < state.totalCols && accX + getColWidth(startCol) < scrollLeft) {
    accX += getColWidth(startCol)
    startCol++
  }
  
  // 计算可见结束列
  let endCol = startCol
  accX = getColLeft(startCol) - scrollLeft + rowHeaderWidth
  while (endCol < state.totalCols && accX < state.width) {
    accX += getColWidth(endCol)
    endCol++
  }
  endCol = Math.min(endCol, state.totalCols - 1)
  
  return { startRow, endRow, startCol, endCol }
}

// ==================== 渲染函数 ====================

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

function getCellKey(row: number, col: number): string {
  return `${row},${col}`
}

function buildFontString(style: CellStyleData): string {
  const parts: string[] = []
  if (style.italic) parts.push('italic')
  if (style.bold) parts.push('bold')
  parts.push(`${style.fontSize || 12}px`)
  parts.push(style.fontFamily || 'Arial, sans-serif')
  return parts.join(' ')
}

/** 绘制网格线和表头 */
function drawGrid(): void {
  const { ctx, width, height, viewport, config } = state
  if (!ctx) return
  
  const { rowHeaderWidth, colHeaderHeight } = config
  const { scrollTop, scrollLeft } = viewport
  const { startRow, endRow, startCol, endCol } = getVisibleRange()
  
  // 背景色
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, width, colHeaderHeight)
  ctx.fillRect(0, 0, rowHeaderWidth, height)
  
  // 网格线
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  
  // 垂直线
  for (let c = startCol; c <= endCol + 1; c++) {
    const x = rowHeaderWidth + getColLeft(c) - scrollLeft
    if (x >= rowHeaderWidth && x <= width) {
      ctx.beginPath()
      ctx.moveTo(x, colHeaderHeight)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }
  
  // 水平线
  for (let r = startRow; r <= endRow + 1; r++) {
    const y = colHeaderHeight + getRowTop(r) - scrollTop
    if (y >= colHeaderHeight && y <= height) {
      ctx.beginPath()
      ctx.moveTo(rowHeaderWidth, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }
  
  // 列标签
  ctx.fillStyle = '#333'
  ctx.font = '12px Arial'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  
  for (let c = startCol; c <= endCol; c++) {
    const x = rowHeaderWidth + getColLeft(c) - scrollLeft
    const w = getColWidth(c)
    if (x + w > rowHeaderWidth && x < width) {
      ctx.fillText(getColLabel(c), x + w / 2, colHeaderHeight / 2)
    }
  }
  
  // 行标签
  for (let r = startRow; r <= endRow; r++) {
    const y = colHeaderHeight + getRowTop(r) - scrollTop
    const h = getRowHeight(r)
    if (y + h > colHeaderHeight && y < height) {
      ctx.fillText(String(r + 1), rowHeaderWidth / 2, y + h / 2)
    }
  }
  
  // 表头分隔线
  ctx.strokeStyle = '#999'
  ctx.beginPath()
  ctx.moveTo(0, colHeaderHeight)
  ctx.lineTo(width, colHeaderHeight)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(rowHeaderWidth, 0)
  ctx.lineTo(rowHeaderWidth, height)
  ctx.stroke()
}

/** 绘制单元格内容 */
function drawCells(): number {
  const { ctx, viewport, config } = state
  if (!ctx) return 0
  
  const { rowHeaderWidth, colHeaderHeight } = config
  const { scrollTop, scrollLeft } = viewport
  const { startRow, endRow, startCol, endCol } = getVisibleRange()
  
  let cellsRendered = 0
  
  // 设置裁剪区域
  ctx.save()
  ctx.beginPath()
  ctx.rect(rowHeaderWidth, colHeaderHeight, state.width - rowHeaderWidth, state.height - colHeaderHeight)
  ctx.clip()
  
  for (let r = startRow; r <= endRow; r++) {
    const cellY = colHeaderHeight + getRowTop(r) - scrollTop
    const rowHeight = getRowHeight(r)
    if (rowHeight === 0) continue
    
    for (let c = startCol; c <= endCol; c++) {
      const cellX = rowHeaderWidth + getColLeft(c) - scrollLeft
      const colWidth = getColWidth(c)
      if (colWidth === 0) continue
      
      const key = getCellKey(r, c)
      const cellData = state.cells.get(key)
      const styleData = state.styles.get(key)
      
      // 绘制背景色
      if (styleData?.backgroundColor && styleData.backgroundColor !== '#FFFFFF') {
        ctx.fillStyle = styleData.backgroundColor
        ctx.fillRect(cellX + 0.5, cellY + 0.5, colWidth - 1, rowHeight - 1)
      }
      
      // 绘制内容
      if (cellData?.value !== null && cellData?.value !== undefined) {
        const text = String(cellData.value)
        
        // 应用样式
        if (styleData) {
          ctx.font = buildFontString(styleData)
          ctx.fillStyle = styleData.color || '#000'
        } else {
          ctx.font = '12px Arial'
          ctx.fillStyle = '#000'
        }
        
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        
        // 计算文本位置
        const padding = 4
        let textX = cellX + padding
        const textY = cellY + rowHeight / 2
        
        // 水平对齐
        if (styleData?.textAlign === 'center') {
          const metrics = ctx.measureText(text)
          textX = cellX + (colWidth - metrics.width) / 2
        } else if (styleData?.textAlign === 'right') {
          const metrics = ctx.measureText(text)
          textX = cellX + colWidth - metrics.width - padding
        }
        
        // 裁剪文本
        ctx.save()
        ctx.beginPath()
        ctx.rect(cellX, cellY, colWidth, rowHeight)
        ctx.clip()
        ctx.fillText(text, textX, textY)
        ctx.restore()
      }
      
      cellsRendered++
    }
  }
  
  ctx.restore()
  return cellsRendered
}

/** 绘制选择高亮 */
function drawSelection(): void {
  const { ctx, viewport, config, selection } = state
  if (!ctx) return
  if (selection.startRow < 0 || selection.startCol < 0) return
  
  const { rowHeaderWidth, colHeaderHeight } = config
  const { scrollTop, scrollLeft } = viewport
  
  // 绘制选择区域高亮
  ctx.save()
  ctx.beginPath()
  ctx.rect(rowHeaderWidth, colHeaderHeight, state.width - rowHeaderWidth, state.height - colHeaderHeight)
  ctx.clip()
  
  // 范围高亮
  if (selection.endRow >= 0 && selection.endCol >= 0) {
    const sx = rowHeaderWidth + getColLeft(selection.startCol) - scrollLeft
    const sy = colHeaderHeight + getRowTop(selection.startRow) - scrollTop
    const ex = rowHeaderWidth + getColLeft(selection.endCol + 1) - scrollLeft
    const ey = colHeaderHeight + getRowTop(selection.endRow + 1) - scrollTop
    
    // 填充
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    ctx.fillRect(sx, sy, ex - sx, ey - sy)
    
    // 边框
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
  }
  
  // 当前选中单元格
  if (selection.row >= 0 && selection.col >= 0) {
    const sx = rowHeaderWidth + getColLeft(selection.col) - scrollLeft
    const sy = colHeaderHeight + getRowTop(selection.row) - scrollTop
    const w = getColWidth(selection.col)
    const h = getRowHeight(selection.row)
    
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1)
  }
  
  ctx.restore()
}

/** 绘制拖拽框 */
function drawDragBox(): void {
  const { ctx, viewport, config, dragState } = state
  if (!ctx || !dragState.isDragging) return
  if (dragState.startRow < 0 || dragState.startCol < 0) return
  
  const { rowHeaderWidth, colHeaderHeight } = config
  const { scrollTop, scrollLeft } = viewport
  
  const startRow = Math.min(dragState.startRow, dragState.currentRow)
  const startCol = Math.min(dragState.startCol, dragState.currentCol)
  const endRow = Math.max(dragState.startRow, dragState.currentRow)
  const endCol = Math.max(dragState.startCol, dragState.currentCol)
  
  const sx = rowHeaderWidth + getColLeft(startCol) - scrollLeft
  const sy = colHeaderHeight + getRowTop(startRow) - scrollTop
  const ex = rowHeaderWidth + getColLeft(endCol + 1) - scrollLeft
  const ey = colHeaderHeight + getRowTop(endRow + 1) - scrollTop
  
  ctx.save()
  ctx.beginPath()
  ctx.rect(rowHeaderWidth, colHeaderHeight, state.width - rowHeaderWidth, state.height - colHeaderHeight)
  ctx.clip()
  
  ctx.strokeStyle = '#10b981'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
  ctx.setLineDash([])
  
  ctx.restore()
}

/** 主渲染函数 */
function render(frameId: number): void {
  const startTime = performance.now()
  
  if (!state.ctx || !state.canvas) {
    sendMessage({ type: 'error', message: 'Canvas not initialized' })
    return
  }
  
  // 清空画布
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height)
  
  // 绘制各层
  drawGrid()
  const cellsRendered = drawCells()
  drawSelection()
  drawDragBox()
  
  // 统计性能
  const renderTime = performance.now() - startTime
  state.frameCount++
  state.totalRenderTime += renderTime
  state.lastRenderTimes.push(renderTime)
  if (state.lastRenderTimes.length > 60) {
    state.lastRenderTimes.shift()
  }
  
  // 发送渲染完成消息
  sendMessage({
    type: 'rendered',
    frameId,
    renderTime,
    cellsRendered
  })
}

// ==================== 消息处理 ====================

function sendMessage(message: WorkerToMainMessage): void {
  self.postMessage(message)
}

function handleInit(msg: MainToWorkerMessage & { type: 'init' }): void {
  state.canvas = msg.canvas
  state.ctx = msg.canvas.getContext('2d')
  state.dpr = msg.dpr
  state.config = msg.config
  state.totalRows = msg.totalRows
  state.totalCols = msg.totalCols
  
  // 应用 DPR
  if (state.ctx && state.canvas) {
    state.width = state.canvas.width / state.dpr
    state.height = state.canvas.height / state.dpr
    state.ctx.scale(state.dpr, state.dpr)
  }
  
  sendMessage({ type: 'ready' })
}

function handleResize(msg: MainToWorkerMessage & { type: 'resize' }): void {
  if (!state.canvas || !state.ctx) return
  
  state.canvas.width = Math.floor(msg.width * msg.dpr)
  state.canvas.height = Math.floor(msg.height * msg.dpr)
  state.width = msg.width
  state.height = msg.height
  state.dpr = msg.dpr
  
  state.ctx.setTransform(1, 0, 0, 1, 0, 0)
  state.ctx.scale(state.dpr, state.dpr)
}

function handleSetViewport(msg: MainToWorkerMessage & { type: 'setViewport' }): void {
  state.viewport = msg.viewport
}

function handleUpdateData(msg: MainToWorkerMessage & { type: 'updateData' }): void {
  if (msg.fullUpdate) {
    state.cells.clear()
  }
  for (const cell of msg.cells) {
    state.cells.set(getCellKey(cell.row, cell.col), cell)
  }
}

function handleUpdateStyles(msg: MainToWorkerMessage & { type: 'updateStyles' }): void {
  for (const style of msg.styles) {
    state.styles.set(getCellKey(style.row, style.col), style)
  }
}

function handleSetSelection(msg: MainToWorkerMessage & { type: 'setSelection' }): void {
  state.selection = msg.selection
}

function handleSetDragState(msg: MainToWorkerMessage & { type: 'setDragState' }): void {
  state.dragState = msg.dragState
}

function handleSetSizes(msg: MainToWorkerMessage & { type: 'setSizes' }): void {
  state.rowHeights.clear()
  state.colWidths.clear()
  state.hiddenRows.clear()
  state.hiddenCols.clear()
  
  for (const [row, height] of msg.sizes.rowHeights) {
    state.rowHeights.set(row, height)
  }
  for (const [col, width] of msg.sizes.colWidths) {
    state.colWidths.set(col, width)
  }
  for (const row of msg.sizes.hiddenRows) {
    state.hiddenRows.add(row)
  }
  for (const col of msg.sizes.hiddenCols) {
    state.hiddenCols.add(col)
  }
}

function handleSetMergedRegions(msg: MainToWorkerMessage & { type: 'setMergedRegions' }): void {
  state.mergedRegions = msg.regions
}

function handleRender(msg: MainToWorkerMessage & { type: 'render' }): void {
  render(msg.frameId)
}

function handleDestroy(): void {
  state.canvas = null
  state.ctx = null
  state.cells.clear()
  state.styles.clear()
}

// ==================== Worker 入口 ====================

self.onmessage = (e: MessageEvent<MainToWorkerMessage>) => {
  try {
    const msg = e.data
    
    switch (msg.type) {
      case 'init':
        handleInit(msg)
        break
      case 'resize':
        handleResize(msg)
        break
      case 'setViewport':
        handleSetViewport(msg)
        break
      case 'updateData':
        handleUpdateData(msg)
        break
      case 'updateStyles':
        handleUpdateStyles(msg)
        break
      case 'setSelection':
        handleSetSelection(msg)
        break
      case 'setDragState':
        handleSetDragState(msg)
        break
      case 'setSizes':
        handleSetSizes(msg)
        break
      case 'setMergedRegions':
        handleSetMergedRegions(msg)
        break
      case 'render':
        handleRender(msg)
        break
      case 'destroy':
        handleDestroy()
        break
      default:
        sendMessage({ type: 'error', message: `Unknown message type: ${(msg as { type: string }).type}` })
    }
  } catch (error) {
    sendMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}

// 发送初始化就绪信号
console.log('[OffscreenWorker] Worker loaded and ready to receive init message')
