<template>
  <div ref="container" class="sheet-container" @contextmenu="onContextMenu">
    <canvas ref="gridCanvas" class="grid-canvas"></canvas>
    <canvas ref="contentCanvas" class="content-canvas"></canvas>
    <SheetOverlayInput
      ref="overlayInput"
      :visible="overlay.visible"
      :value="overlay.value"
      :row="overlay.row"
      :col="overlay.col"
      :top="overlay.top"
      :left="overlay.left"
      :width="overlay.width"
      :height="overlay.height"
      :mode="overlay.mode"
      @save="onOverlaySave"
      @cancel="onOverlayCancel"
      @input-change="updateFormulaReferences"
    />
    <!-- 垂直滚动条（右侧） -->
    <div
      v-if="scrollbar.v.visible"
      class="v-scrollbar-track"
      :style="{ top: COL_HEADER_HEIGHT + 'px' }"
    >
      <div
        class="v-scrollbar-thumb"
        :style="{ height: scrollbar.v.thumbSize + 'px', top: scrollbar.v.thumbPos + 'px' }"
        @mousedown="onVThumbMouseDown"
      ></div>
    </div>
    <!-- 水平滚动条（底部） -->
    <div
      v-if="scrollbar.h.visible"
      class="h-scrollbar-track"
      :style="{ left: ROW_HEADER_WIDTH + 'px' }"
    >
      <div
        class="h-scrollbar-thumb"
        :style="{ width: scrollbar.h.thumbSize + 'px', left: scrollbar.h.thumbPos + 'px' }"
        @mousedown="onHThumbMouseDown"
      ></div>
    </div>
    <!-- 右键菜单 -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @close="contextMenu.visible = false"
    />
    <!-- 输入对话框 -->
    <InputDialog
      :visible="inputDialog.visible"
      :title="inputDialog.title"
      :default-value="inputDialog.defaultValue"
      :placeholder="inputDialog.placeholder"
      @confirm="onInputDialogConfirm"
      @cancel="inputDialog.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, reactive, watch } from 'vue'
import { SheetModel } from '../lib/SheetModel'
import { UndoRedoManager } from '../lib/UndoRedoManager'
import { FormulaSheet } from '../lib/FormulaSheet'
// @ts-ignore - Vue SFC typing handled via vue-tsc at build time
import SheetOverlayInput from './SheetOverlayInput.vue'
// @ts-ignore
import ContextMenu from './ContextMenu.vue'
// @ts-ignore
import InputDialog from './InputDialog.vue'

const ROW_HEIGHT = 26
const COL_WIDTH = 100
const ROW_HEADER_WIDTH = 40
const COL_HEADER_HEIGHT = 26
const DEFAULT_ROWS = 1000
const DEFAULT_COLS = 50
const RESIZE_HANDLE_SIZE = 4 // 拖动调整的检测区域（分隔线两侧各2px）

const container = ref<HTMLElement | null>(null)
const gridCanvas = ref<HTMLCanvasElement | null>(null)
const contentCanvas = ref<HTMLCanvasElement | null>(null)
const overlayInput = ref(null)

// 自定义行高和列宽
const rowHeights = ref<Map<number, number>>(new Map()) // 存储自定义的行高
const colWidths = ref<Map<number, number>>(new Map())  // 存储自定义的列宽

// 调整大小状态
const resizeState = reactive({
  isResizing: false,
  type: '' as 'row' | 'col' | '',  // 正在调整行还是列
  index: -1,  // 正在调整的行号或列号
  startPos: 0,  // 鼠标起始位置
  startSize: 0  // 起始大小
})

// 悬停状态（用于高亮显示可调整的分隔线）
const hoverState = reactive({
  type: '' as 'row' | 'col' | '',  // 悬停在行还是列的分隔线上
  index: -1  // 悬停的行号或列号
})

const model = new SheetModel()
const formulaSheet = new FormulaSheet(model)
const undoRedo = new UndoRedoManager(100)

// Initialize with sample data
model.setValue(0, 0, 'Item')
model.setValue(0, 1, 'Q1')
model.setValue(0, 2, 'Q2')
model.setValue(0, 3, 'Total')
model.setValue(1, 0, 'Sales')
model.setValue(1, 1, '100')
model.setValue(1, 2, '150')
model.setValue(1, 3, '=B2+C2')  // Formula: 250
model.setValue(2, 0, 'Profit')
model.setValue(2, 1, '20')
model.setValue(2, 2, '30')
model.setValue(2, 3, '=B3+C3')  // Formula: 50
model.setValue(3, 0, 'Margin')
model.setValue(3, 1, '=B3/B2*100')  // Formula: 20
model.setValue(3, 2, '=C3/C2*100')  // Formula: 20
model.setValue(3, 3, '=D3/D2*100')  // Formula: depends on D2, D3

const overlay = reactive({
  visible: false,
  row: 0,
  col: 0,
  top: 0,
  left: 0,
  width: COL_WIDTH,
  height: ROW_HEIGHT,
  value: '',
  mode: 'edit' as 'edit' | 'typing',
  originalValue: ''  // 保存编辑前的原始值，用于 ESC 取消
})

const selected = reactive({ row: -1, col: -1 })

// Selection range for multiple cells
const selectionRange = reactive({
  startRow: -1,
  startCol: -1,
  endRow: -1,
  endCol: -1
})

// Drag selection state
const dragState = reactive({
  isDragging: false,
  startRow: -1,
  startCol: -1,
  currentRow: -1,
  currentCol: -1,
  justFinishedDrag: false  // 标记刚完成拖动，用于阻止 onClick
})

// 公式引用高亮显示
interface FormulaReference {
  range: string  // 如 "A1" 或 "A1:B3"
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  color: string
}

const formulaReferences = ref<FormulaReference[]>([])

// Excel 风格的引用颜色
const REFERENCE_COLORS = [
  '#4472C4',  // 蓝色
  '#ED7D31',  // 橙色
  '#A5A5A5',  // 灰色
  '#FFC000',  // 黄色
  '#5B9BD5',  // 浅蓝
  '#70AD47',  // 绿色
  '#264478',  // 深蓝
  '#9E480E',  // 深橙
  '#636363',  // 深灰
  '#997300',  // 深黄
]

// Viewport state for scrolling
const viewport = reactive({
  scrollTop: 0,
  scrollLeft: 0
})

// 自定义滚动条状态
const scrollbar = reactive({
  v: {
    visible: true,
    trackSize: 0,
    thumbSize: 0,
    thumbPos: 0
  },
  h: {
    visible: true,
    trackSize: 0,
    thumbSize: 0,
    thumbPos: 0
  },
  dragging: '' as '' | 'v' | 'h',
  startMousePos: 0,
  startScroll: 0
})

// 右键菜单状态
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  items: [] as Array<{label: string, action: () => void, disabled?: boolean, divider?: boolean}>,
  targetRow: -1,
  targetCol: -1
})

// 输入对话框状态
const inputDialog = reactive({
  visible: false,
  title: '',
  defaultValue: '',
  placeholder: '',
  callback: null as ((value: string) => void) | null
})

// Performance optimization: debounce redraw with requestAnimationFrame
let redrawScheduled = false
let redrawHandle: number | null = null

function devicePixelRatioSafe() {
  return window.devicePixelRatio || 1
}

function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = devicePixelRatioSafe()
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/**
 * 简单的单元格地址解析 (A1 -> {row: 0, col: 0})
 */
function parseCellAddr(addr: string): { row: number, col: number } | null {
  const match = addr.match(/^([A-Za-z]+)(\d+)$/)
  if (!match || !match[1] || !match[2]) return null
  
  const colStr = match[1].toUpperCase()
  const rowStr = match[2]
  
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  col -= 1  // 0-indexed
  
  const row = parseInt(rowStr, 10) - 1  // 0-indexed
  
  return { row, col }
}

/**
 * 解析公式中的单元格引用
 */
function parseFormulaReferences(formula: string): FormulaReference[] {
  if (!formula.startsWith('=')) return []
  
  const references: FormulaReference[] = []
  const seen = new Set<string>()
  
  // 匹配范围引用 (A1:B3) 和单个单元格引用 (A1)
  const rangeRegex = /([A-Za-z]+\d+):([A-Za-z]+\d+)/g
  const cellRegex = /\b([A-Za-z]+\d+)\b/g
  
  let colorIndex = 0
  
  // 先匹配范围引用
  let match
  while ((match = rangeRegex.exec(formula)) !== null) {
    const rangeStr = match[0].toUpperCase()
    if (seen.has(rangeStr)) continue
    seen.add(rangeStr)
    
    const startAddr = match[1]?.toUpperCase()
    const endAddr = match[2]?.toUpperCase()
    
    if (!startAddr || !endAddr) continue
    
    const startRef = parseCellAddr(startAddr)
    const endRef = parseCellAddr(endAddr)
    
    if (startRef && endRef) {
      references.push({
        range: rangeStr,
        startRow: Math.min(startRef.row, endRef.row),
        startCol: Math.min(startRef.col, endRef.col),
        endRow: Math.max(startRef.row, endRef.row),
        endCol: Math.max(startRef.col, endRef.col),
        color: REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length] || '#4472C4'
      })
      colorIndex++
    }
  }
  
  // 移除范围引用，然后匹配单个单元格引用
  const formulaWithoutRanges = formula.replace(rangeRegex, '')
  
  rangeRegex.lastIndex = 0
  while ((match = cellRegex.exec(formulaWithoutRanges)) !== null) {
    const cellAddr = match[1]?.toUpperCase()
    if (!cellAddr || seen.has(cellAddr)) continue
    seen.add(cellAddr)
    
    const ref = parseCellAddr(cellAddr)
    if (ref) {
      references.push({
        range: cellAddr,
        startRow: ref.row,
        startCol: ref.col,
        endRow: ref.row,
        endCol: ref.col,
        color: REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length] || '#4472C4'
      })
      colorIndex++
    }
  }
  
  return references
}

/**
 * Schedule redraw with requestAnimationFrame for better performance
 * This ensures the canvas is redrawn at most once per frame (60fps)
 */
function scheduleRedraw() {
  if (redrawScheduled) return
  
  redrawScheduled = true
  redrawHandle = requestAnimationFrame(() => {
    redrawScheduled = false
    redrawHandle = null
    draw()
  })
}

/**
 * Direct redraw - use for critical updates that need immediate rendering
 */
function draw() {
  if (!container.value || !gridCanvas.value || !contentCanvas.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight

  // Ensure canvas has reasonable size
  if (w < 100 || h < 100) {
    console.warn('Container too small', w, h)
    return
  }

  setCanvasSize(gridCanvas.value, w, h)
  setCanvasSize(contentCanvas.value, w, h)

  // 更新滚动条
  updateScrollbars(w, h)
  // 如果编辑框可见，随滚动动态更新其位置与尺寸
  if (overlay.visible) {
    overlay.top = COL_HEADER_HEIGHT + getRowTop(overlay.row) - viewport.scrollTop
    overlay.left = ROW_HEADER_WIDTH + getColLeft(overlay.col) - viewport.scrollLeft
    overlay.width = getColWidth(overlay.col)
    overlay.height = getRowHeight(overlay.row)
  }

  // 先绘制单元格内容，再绘制网格和表头（确保表头在最上层）
  drawCells(w, h)
  drawGrid(w, h)
}

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

// 获取指定行的高度
function getRowHeight(row: number): number {
  return rowHeights.value.get(row) ?? ROW_HEIGHT
}

// 获取指定列的宽度
function getColWidth(col: number): number {
  return colWidths.value.get(col) ?? COL_WIDTH
}

// 获取从0到指定行的累计高度
function getRowTop(row: number): number {
  let top = 0
  for (let r = 0; r < row; r++) {
    top += getRowHeight(r)
  }
  return top
}

// 获取从0到指定列的累计宽度
function getColLeft(col: number): number {
  let left = 0
  for (let c = 0; c < col; c++) {
    left += getColWidth(c)
  }
  return left
}

// 根据 Y 坐标（含滚动偏移）获取行号
function getRowAtY(y: number): number {
  const offsetY = y + viewport.scrollTop - COL_HEADER_HEIGHT
  let accumulatedHeight = 0
  
  for (let r = 0; r < DEFAULT_ROWS; r++) {
    const rowHeight = getRowHeight(r)
    if (accumulatedHeight + rowHeight > offsetY) {
      return r
    }
    accumulatedHeight += rowHeight
  }
  
  return DEFAULT_ROWS - 1
}

// 根据 X 坐标（含滚动偏移）获取列号
function getColAtX(x: number): number {
  const offsetX = x + viewport.scrollLeft - ROW_HEADER_WIDTH
  let accumulatedWidth = 0
  
  for (let c = 0; c < DEFAULT_COLS; c++) {
    const colWidth = getColWidth(c)
    if (accumulatedWidth + colWidth > offsetX) {
      return c
    }
    accumulatedWidth += colWidth
  }
  
  return DEFAULT_COLS - 1
}

function getVisibleRange(w: number, h: number) {
  // Calculate which rows and columns are visible based on scroll offset
  const startRow = Math.max(0, Math.floor(viewport.scrollTop / ROW_HEIGHT))
  const endRow = Math.min(DEFAULT_ROWS, startRow + Math.ceil(h / ROW_HEIGHT) + 1)

  const startCol = Math.max(0, Math.floor(viewport.scrollLeft / COL_WIDTH))
  const endCol = Math.min(DEFAULT_COLS, startCol + Math.ceil((w - ROW_HEADER_WIDTH) / COL_WIDTH) + 1)

  return { startRow, endRow, startCol, endCol }
}

function ensureVisible(row: number, col: number) {
  if (!container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight

  // Calculate the screen position of the cell
  const cellLeft = ROW_HEADER_WIDTH + col * COL_WIDTH - viewport.scrollLeft
  const cellTop = COL_HEADER_HEIGHT + row * ROW_HEIGHT - viewport.scrollTop
  const cellRight = cellLeft + COL_WIDTH
  const cellBottom = cellTop + ROW_HEIGHT

  // Check if cell is completely visible (with some padding consideration)
  const isRowVisible = cellTop >= COL_HEADER_HEIGHT && cellBottom <= h
  const isColVisible = cellLeft >= ROW_HEADER_WIDTH && cellRight <= w

  if (isRowVisible && isColVisible) {
    return // Cell is already completely visible
  }

  // Adjust scrollTop to ensure row is completely visible
  if (!isRowVisible) {
    if (cellTop < COL_HEADER_HEIGHT) {
      // Row is above visible area
      viewport.scrollTop = Math.max(0, row * ROW_HEIGHT)
    } else if (cellBottom > h) {
      // Row is below visible area
      viewport.scrollTop = Math.max(0, (row + 1) * ROW_HEIGHT - h + COL_HEADER_HEIGHT)
    }
  }

  // Adjust scrollLeft to ensure column is completely visible
  if (!isColVisible) {
    if (cellLeft < ROW_HEADER_WIDTH) {
      // Column is to the left of visible area
      viewport.scrollLeft = Math.max(0, col * COL_WIDTH)
    } else if (cellRight > w) {
      // Column is to the right of visible area (including partially visible)
      viewport.scrollLeft = Math.max(0, (col + 1) * COL_WIDTH - w + ROW_HEADER_WIDTH)
    }
  }

  draw()
}

function getTotalContentHeight(): number {
  // 不包括列表头高度（滚动范围只针对网格部分）
  return getRowTop(DEFAULT_ROWS)
}

function getTotalContentWidth(): number {
  // 不包括行表头宽度（滚动范围只针对网格部分）
  return getColLeft(DEFAULT_COLS)
}

function updateScrollbars(w: number, h: number) {
  // 轨道尺寸为可视区域（剔除行/列表头）
  const trackH = Math.max(0, h - COL_HEADER_HEIGHT)
  const trackW = Math.max(0, w - ROW_HEADER_WIDTH)
  const contentH = getTotalContentHeight()
  const contentW = getTotalContentWidth()
  const minThumb = 20

  // 垂直滚动条
  scrollbar.v.trackSize = trackH
  if (contentH <= trackH || trackH === 0) {
    scrollbar.v.visible = false
    viewport.scrollTop = 0
    scrollbar.v.thumbSize = 0
    scrollbar.v.thumbPos = 0
  } else {
    scrollbar.v.visible = true
    const thumbLen = Math.max(minThumb, Math.floor(trackH * trackH / contentH))
    const maxThumbPos = trackH - thumbLen
    const maxScroll = contentH - trackH
    const pos = Math.floor((viewport.scrollTop / maxScroll) * maxThumbPos)
    scrollbar.v.thumbSize = thumbLen
    scrollbar.v.thumbPos = Math.max(0, Math.min(maxThumbPos, pos))
  }

  // 水平滚动条
  scrollbar.h.trackSize = trackW
  if (contentW <= trackW || trackW === 0) {
    scrollbar.h.visible = false
    viewport.scrollLeft = 0
    scrollbar.h.thumbSize = 0
    scrollbar.h.thumbPos = 0
  } else {
    scrollbar.h.visible = true
    const thumbLen = Math.max(minThumb, Math.floor(trackW * trackW / contentW))
    const maxThumbPos = trackW - thumbLen
    const maxScroll = contentW - trackW
    const pos = Math.floor((viewport.scrollLeft / maxScroll) * maxThumbPos)
    scrollbar.h.thumbSize = thumbLen
    scrollbar.h.thumbPos = Math.max(0, Math.min(maxThumbPos, pos))
  }
}

/**
 * 获取选择范围的文本表示 (如 "A1:B3", "3行 x 2列")
 */
function getSelectionRangeText(startRow: number, startCol: number, endRow: number, endCol: number): string {
  const startAddr = formulaSheet.getCellAddress(startRow, startCol)
  const endAddr = formulaSheet.getCellAddress(endRow, endCol)
  const rows = endRow - startRow + 1
  const cols = endCol - startCol + 1
  
  if (rows === 1 && cols === 1) {
    return startAddr
  }
  
  return `${startAddr}:${endAddr}  (${rows}行 × ${cols}列)`
}

function drawGrid(w: number, h: number) {
  const canvas = gridCanvas.value!
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // background colors
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, w, COL_HEADER_HEIGHT)
  ctx.fillRect(0, 0, ROW_HEADER_WIDTH, h)

  const { startRow, endRow, startCol, endCol } = getVisibleRange(w, h)

  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  ctx.fillStyle = '#333'
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'middle'

  // draw visible columns
  let accumulatedColX = ROW_HEADER_WIDTH
  for (let c = 0; c < DEFAULT_COLS; c++) {
    const colWidth = getColWidth(c)
    const x = accumulatedColX - viewport.scrollLeft
    
    // 只绘制可见的列
    if (x + colWidth > ROW_HEADER_WIDTH && x < w && c >= startCol && c <= endCol) {
      // vertical line at left of column (只绘制内容区域部分)
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, COL_HEADER_HEIGHT)
      ctx.lineTo(x, h)
      ctx.stroke()
      
      // column label (在表头区域绘制，会被后续遮罩层覆盖和重绘)
      if (x + colWidth > ROW_HEADER_WIDTH && x < w) {
        const label = getColLabel(c)
        const metrics = ctx.measureText(label)
        ctx.fillText(label, x + (colWidth - metrics.width) / 2, COL_HEADER_HEIGHT / 2)
      }
    }
    
    accumulatedColX += colWidth
    
    // 绘制列的右边界（分隔线），检查是否需要高亮
    // 注意：这里的高亮线会被后续的遮罩层覆盖，实际显示由遮罩层后的重绘控制
    const rightX = accumulatedColX - viewport.scrollLeft
    if (rightX > ROW_HEADER_WIDTH && rightX < w && c >= startCol && c <= endCol) {
      ctx.strokeStyle = '#999'  // 第一次绘制使用默认颜色
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rightX, COL_HEADER_HEIGHT)
      ctx.lineTo(rightX, h)
      ctx.stroke()
    }
    
    if (accumulatedColX - viewport.scrollLeft > w) break
  }

  // draw visible rows
  let accumulatedRowY = COL_HEADER_HEIGHT
  for (let r = 0; r < DEFAULT_ROWS; r++) {
    const rowHeight = getRowHeight(r)
    const y = accumulatedRowY - viewport.scrollTop
    
    // 只绘制可见的行
    if (y + rowHeight > COL_HEADER_HEIGHT && y < h && r >= startRow && r <= endRow) {
      // horizontal line at top of row (只绘制内容区域部分)
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ROW_HEADER_WIDTH, y)
      ctx.lineTo(w, y)
      ctx.stroke()
      
      // row label (在表头区域绘制，会被后续遮罩层覆盖和重绘)
      if (y + rowHeight > COL_HEADER_HEIGHT && y < h) {
        const label = (r + 1).toString()
        const metrics = ctx.measureText(label)
        ctx.fillText(label, (ROW_HEADER_WIDTH - metrics.width) / 2, y + rowHeight / 2)
      }
    }
    
    accumulatedRowY += rowHeight
    
    // 绘制行的下边界（分隔线），检查是否需要高亮
    // 注意：这里的高亮线会被后续的遮罩层覆盖，实际显示由遮罩层后的重绘控制
    const bottomY = accumulatedRowY - viewport.scrollTop
    if (bottomY > COL_HEADER_HEIGHT && bottomY < h && r >= startRow && r <= endRow) {
      ctx.strokeStyle = '#999'  // 第一次绘制使用默认颜色
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ROW_HEADER_WIDTH, bottomY)
      ctx.lineTo(w, bottomY)
      ctx.stroke()
    }
    
    if (accumulatedRowY - viewport.scrollTop > h) break
  }
  
  // 在网格绘制的最后，重新绘制行头和列标的遮罩层，覆盖任何可能溢出的内容
  // 这确保表头始终在最上层
  ctx.fillStyle = '#f0f0f0'
  // 列标头遮罩
  ctx.fillRect(0, 0, w, COL_HEADER_HEIGHT)
  // 行标头遮罩  
  ctx.fillRect(0, 0, ROW_HEADER_WIDTH, h)
  
  // 重新绘制列标签和分隔线
  ctx.fillStyle = '#333'
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  
  accumulatedColX = ROW_HEADER_WIDTH
  for (let c = 0; c < DEFAULT_COLS; c++) {
    const colWidth = getColWidth(c)
    const x = accumulatedColX - viewport.scrollLeft
    
    if (x + colWidth > ROW_HEADER_WIDTH && x < w && c >= startCol && c <= endCol) {
      // 绘制列的左边界线
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, COL_HEADER_HEIGHT)
      ctx.stroke()
      
      // 绘制列标签
      const label = getColLabel(c)
      const metrics = ctx.measureText(label)
      ctx.fillText(label, x + (colWidth - metrics.width) / 2, COL_HEADER_HEIGHT / 2)
    }
    
    accumulatedColX += colWidth
    
    // 绘制列的右边界线（分隔线）- 普通样式
    const rightX = accumulatedColX - viewport.scrollLeft
    if (rightX > ROW_HEADER_WIDTH && rightX < w && c >= startCol && c <= endCol) {
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rightX, 0)
      ctx.lineTo(rightX, COL_HEADER_HEIGHT)
      ctx.stroke()
    }
    
    if (accumulatedColX - viewport.scrollLeft > w) break
  }
  
  // 重新绘制行标签和分隔线
  accumulatedRowY = COL_HEADER_HEIGHT
  for (let r = 0; r < DEFAULT_ROWS; r++) {
    const rowHeight = getRowHeight(r)
    const y = accumulatedRowY - viewport.scrollTop
    
    if (y + rowHeight > COL_HEADER_HEIGHT && y < h && r >= startRow && r <= endRow) {
      // 绘制行的上边界线
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(ROW_HEADER_WIDTH, y)
      ctx.stroke()
      
      // 绘制行标签
      const label = (r + 1).toString()
      const metrics = ctx.measureText(label)
      ctx.fillText(label, (ROW_HEADER_WIDTH - metrics.width) / 2, y + rowHeight / 2)
    }
    
    accumulatedRowY += rowHeight
    
    // 绘制行的下边界线（分隔线）- 普通样式
    const bottomY = accumulatedRowY - viewport.scrollTop
    if (bottomY > COL_HEADER_HEIGHT && bottomY < h && r >= startRow && r <= endRow) {
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, bottomY)
      ctx.lineTo(ROW_HEADER_WIDTH, bottomY)
      ctx.stroke()
    }
    
    if (accumulatedRowY - viewport.scrollTop > h) break
  }
  
  // 最后绘制列标头和行标头的边界线
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  // 列标头底部边界
  ctx.beginPath()
  ctx.moveTo(0, COL_HEADER_HEIGHT)
  ctx.lineTo(w, COL_HEADER_HEIGHT)
  ctx.stroke()
  // 行标头右侧边界
  ctx.beginPath()
  ctx.moveTo(ROW_HEADER_WIDTH, 0)
  ctx.lineTo(ROW_HEADER_WIDTH, h)
  ctx.stroke()
  
  // 左上角交叉区域的遮罩层，覆盖任何滚动后可能显示的内容
  // 扩大1像素以完全覆盖边界线
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, ROW_HEADER_WIDTH + 1, COL_HEADER_HEIGHT + 1)
  
  // 重新绘制左上角区域的右边界和下边界线，确保边框完整
  ctx.strokeStyle = '#999'
  ctx.lineWidth = 1
  // 右边界（垂直线）
  ctx.beginPath()
  ctx.moveTo(ROW_HEADER_WIDTH, 0)
  ctx.lineTo(ROW_HEADER_WIDTH, COL_HEADER_HEIGHT)
  ctx.stroke()
  // 下边界（水平线）
  ctx.beginPath()
  ctx.moveTo(0, COL_HEADER_HEIGHT)
  ctx.lineTo(ROW_HEADER_WIDTH, COL_HEADER_HEIGHT)
  ctx.stroke()
  
  // 最后绘制悬停高亮线（蓝色），确保不被其他线覆盖
  if (hoverState.type === 'col' && hoverState.index >= 0) {
    // 绘制列的高亮线
    const c = hoverState.index
    const rightX = ROW_HEADER_WIDTH + getColLeft(c + 1) - viewport.scrollLeft
    if (rightX > ROW_HEADER_WIDTH && rightX < w) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      // 表头区域的高亮
      ctx.beginPath()
      ctx.moveTo(rightX, 0)
      ctx.lineTo(rightX, COL_HEADER_HEIGHT)
      ctx.stroke()
      // 内容区域的高亮
      ctx.beginPath()
      ctx.moveTo(rightX, COL_HEADER_HEIGHT)
      ctx.lineTo(rightX, h)
      ctx.stroke()
    }
  } else if (hoverState.type === 'row' && hoverState.index >= 0) {
    // 绘制行的高亮线
    const r = hoverState.index
    const bottomY = COL_HEADER_HEIGHT + getRowTop(r + 1) - viewport.scrollTop
    if (bottomY > COL_HEADER_HEIGHT && bottomY < h) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      // 表头区域的高亮
      ctx.beginPath()
      ctx.moveTo(0, bottomY)
      ctx.lineTo(ROW_HEADER_WIDTH, bottomY)
      ctx.stroke()
      // 内容区域的高亮
      ctx.beginPath()
      ctx.moveTo(ROW_HEADER_WIDTH, bottomY)
      ctx.lineTo(w, bottomY)
      ctx.stroke()
    }
  }
}

function drawCells(w: number, h: number) {
  const canvas = contentCanvas.value!
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const { startRow, endRow, startCol, endCol } = getVisibleRange(w, h)
  
  // 设置裁剪区域，确保内容不会绘制到行头和列标区域
  ctx.save()
  ctx.beginPath()
  ctx.rect(ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, w - ROW_HEADER_WIDTH, h - COL_HEADER_HEIGHT)
  ctx.clip()

  ctx.fillStyle = '#000'
  ctx.font = '13px sans-serif'
  ctx.textBaseline = 'middle'

  // draw visible cells from model
  for (let r = startRow; r < endRow; r++) {
    const cellY = COL_HEADER_HEIGHT + getRowTop(r) - viewport.scrollTop
    const rowHeight = getRowHeight(r)
    
    for (let c = startCol; c < endCol; c++) {
      const displayValue = formulaSheet.getValue(r, c)
      if (displayValue !== null && displayValue !== undefined) {
        const cellX = ROW_HEADER_WIDTH + getColLeft(c) - viewport.scrollLeft
        const colWidth = getColWidth(c)
        
        // 保存当前绘图状态
        ctx.save()
        
        // 创建裁剪区域限制在当前单元格内
        ctx.beginPath()
        ctx.rect(cellX, cellY, colWidth, rowHeight)
        ctx.clip()
        
        // 处理换行符
        const text = String(displayValue)
        const lines = text.split('\n')
        
        if (lines.length === 1) {
          // 单行：使用原来的中心对齐方式
          const textX = cellX + 6
          const textY = cellY + rowHeight / 2
          ctx.fillText(text, textX, textY)
        } else {
          // 多行：从顶部开始绘制
          ctx.textBaseline = 'top'
          const textX = cellX + 6
          const lineHeight = 18
          
          lines.forEach((line, index) => {
            const textY = cellY + 4 + index * lineHeight
            // 只绘制在单元格范围内的行
            if (textY >= cellY && textY < cellY + rowHeight) {
              ctx.fillText(line, textX, textY)
            }
          })
          ctx.textBaseline = 'middle' // 恢复默认
        }
        
        // 恢复绘图状态（包括裁剪区域）
        ctx.restore()
      }
    }
  }

  // highlight selection range (fill with light blue)
  if (selectionRange.startRow >= 0 && selectionRange.startCol >= 0) {
    console.log('draw() - 绘制选择范围:', {
      startRow: selectionRange.startRow,
      startCol: selectionRange.startCol,
      endRow: selectionRange.endRow,
      endCol: selectionRange.endCol
    })
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
    for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
      const sy = COL_HEADER_HEIGHT + getRowTop(r) - viewport.scrollTop
      const rowHeight = getRowHeight(r)
      
      for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
        const sx = ROW_HEADER_WIDTH + getColLeft(c) - viewport.scrollLeft
        const colWidth = getColWidth(c)
        
        if (sx + colWidth > 0 && sx < w && sy + rowHeight > 0 && sy < h) {
          ctx.fillRect(sx + 0.5, sy + 0.5, colWidth - 1, rowHeight - 1)
        }
      }
    }
    // Draw border around selection range
    const sx = ROW_HEADER_WIDTH + getColLeft(selectionRange.startCol) - viewport.scrollLeft
    const sy = COL_HEADER_HEIGHT + getRowTop(selectionRange.startRow) - viewport.scrollTop
    const ex = ROW_HEADER_WIDTH + getColLeft(selectionRange.endCol + 1) - viewport.scrollLeft
    const ey = COL_HEADER_HEIGHT + getRowTop(selectionRange.endRow + 1) - viewport.scrollTop
    console.log('draw() - 绘制选择范围边框:', { sx, sy, ex, ey, width: ex - sx, height: ey - sy })
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
  }

  // highlight single selection
  if (selected.row >= 0 && selected.col >= 0) {
    const sx = ROW_HEADER_WIDTH + getColLeft(selected.col) - viewport.scrollLeft
    const sy = COL_HEADER_HEIGHT + getRowTop(selected.row) - viewport.scrollTop
    const colWidth = getColWidth(selected.col)
    const rowHeight = getRowHeight(selected.row)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(sx + 0.5, sy + 0.5, colWidth - 1, rowHeight - 1)
  }

  // 绘制公式引用的彩色外框 (Excel 风格)
  if (formulaReferences.value.length > 0) {
    for (const ref of formulaReferences.value) {
  const sx = ROW_HEADER_WIDTH + getColLeft(ref.startCol) - viewport.scrollLeft
  const sy = COL_HEADER_HEIGHT + getRowTop(ref.startRow) - viewport.scrollTop
  const ex = ROW_HEADER_WIDTH + getColLeft(ref.endCol + 1) - viewport.scrollLeft
  const ey = COL_HEADER_HEIGHT + getRowTop(ref.endRow + 1) - viewport.scrollTop
  const width = ex - sx
  const height = ey - sy
      
      // 只绘制可见的引用
      if (sx + width > 0 && sx < w && sy + height > 0 && sy < h) {
        ctx.strokeStyle = ref.color
        ctx.lineWidth = 2
        ctx.strokeRect(sx + 0.5, sy + 0.5, width - 1, height - 1)
      }
    }
  }

  // Draw dashed box during dragging (Phase 3 feature)
  if (dragState.isDragging && dragState.startRow >= 0 && dragState.startCol >= 0) {
    const startRow = Math.min(dragState.startRow, dragState.currentRow)
    const startCol = Math.min(dragState.startCol, dragState.currentCol)
    const endRow = Math.max(dragState.startRow, dragState.currentRow)
    const endCol = Math.max(dragState.startCol, dragState.currentCol)

  // Calculate dashed box coordinates - 使用动态行高列宽
  const sx = ROW_HEADER_WIDTH + getColLeft(startCol) - viewport.scrollLeft
  const sy = COL_HEADER_HEIGHT + getRowTop(startRow) - viewport.scrollTop
  const ex = ROW_HEADER_WIDTH + getColLeft(endCol + 1) - viewport.scrollLeft
  const ey = COL_HEADER_HEIGHT + getRowTop(endRow + 1) - viewport.scrollTop
  const width = ex - sx
  const height = ey - sy

    // Draw dashed border
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(sx + 0.5, sy + 0.5, width - 1, height - 1)
    ctx.setLineDash([]) // Reset line dash

    // Display selection range text
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
  
  // 恢复裁剪区域
  ctx.restore()
}

function onClick(e: MouseEvent) {
  if (!container.value) return
  
  // 如果刚完成拖动，忽略 click 事件
  if (dragState.justFinishedDrag) {
    console.log('onClick - 忽略（刚完成拖动）')
    dragState.justFinishedDrag = false
    return
  }
  
  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 点击行头：选择整行
  if (x < ROW_HEADER_WIDTH && y > COL_HEADER_HEIGHT) {
    const row = getRowAtY(y)
    selected.row = row
    selected.col = 0
    selectionRange.startRow = row
    selectionRange.startCol = 0
    selectionRange.endRow = row
    selectionRange.endCol = DEFAULT_COLS - 1
    draw()
    return
  }

  // 点击列头：选择整列
  if (y < COL_HEADER_HEIGHT && x > ROW_HEADER_WIDTH) {
    const col = getColAtX(x)
    selected.row = 0
    selected.col = col
    selectionRange.startRow = 0
    selectionRange.startCol = col
    selectionRange.endRow = DEFAULT_ROWS - 1
    selectionRange.endCol = col
    draw()
    return
  }

  // 点击左上角：选择全部
  if (x < ROW_HEADER_WIDTH && y < COL_HEADER_HEIGHT) {
    selected.row = 0
    selected.col = 0
    selectionRange.startRow = 0
    selectionRange.startCol = 0
    selectionRange.endRow = DEFAULT_ROWS - 1
    selectionRange.endCol = DEFAULT_COLS - 1
    draw()
    return
  }

  // 点击内容区域
  if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return

  // Account for scroll offset - 使用动态计算
  const col = getColAtX(x)
  const row = getRowAtY(y)

  if (e.shiftKey && selected.row >= 0 && selected.col >= 0) {
    // Shift+Click: expand selection range
    selectionRange.startRow = Math.min(selected.row, row)
    selectionRange.startCol = Math.min(selected.col, col)
    selectionRange.endRow = Math.max(selected.row, row)
    selectionRange.endCol = Math.max(selected.col, col)
    draw()
  }
  // Normal click handling is done in onMouseUp to distinguish from drag
}

function onMouseDown(e: MouseEvent) {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 检测是否点击了行高调整区域（行表头的分隔线）
  if (x < ROW_HEADER_WIDTH && y > COL_HEADER_HEIGHT) {
    // 遍历可见行，找到鼠标悬停的分隔线
    let accumulatedY = COL_HEADER_HEIGHT - viewport.scrollTop
    for (let r = 0; r < DEFAULT_ROWS; r++) {
      const rowHeight = getRowHeight(r)
      accumulatedY += rowHeight
      
      // 检查是否在这一行的下边界附近（分隔线中间 ±2px）
      if (Math.abs(y - accumulatedY) <= RESIZE_HANDLE_SIZE / 2) {
        resizeState.isResizing = true
        resizeState.type = 'row'
        resizeState.index = r
        resizeState.startPos = e.clientY
        resizeState.startSize = rowHeight
        e.preventDefault()
        return
      }
      
      if (accumulatedY > y + RESIZE_HANDLE_SIZE) break
    }
    
    // 如果不是调整大小，则是拖动选择行
    const row = getRowAtY(y)
    dragState.isDragging = true
    dragState.startRow = row
    dragState.startCol = 0
    dragState.currentRow = row
    dragState.currentCol = DEFAULT_COLS - 1
    
    console.log('onMouseDown - 初始化行选择:', {
      row,
      startRow: dragState.startRow,
      startCol: dragState.startCol,
      currentRow: dragState.currentRow,
      currentCol: dragState.currentCol
    })
    
    selected.row = row
    selected.col = 0
    selectionRange.startRow = row
    selectionRange.startCol = 0
    selectionRange.endRow = row
    selectionRange.endCol = DEFAULT_COLS - 1
    draw()
    return
  }
  
  // 检测是否点击了列宽调整区域（列表头的分隔线）
  if (y < COL_HEADER_HEIGHT && x > ROW_HEADER_WIDTH) {
    // 遍历可见列，找到鼠标悬停的分隔线
    let accumulatedX = ROW_HEADER_WIDTH - viewport.scrollLeft
    for (let c = 0; c < DEFAULT_COLS; c++) {
      const colWidth = getColWidth(c)
      accumulatedX += colWidth
      
      // 检查是否在这一列的右边界附近（分隔线中间 ±2px）
      if (Math.abs(x - accumulatedX) <= RESIZE_HANDLE_SIZE / 2) {
        resizeState.isResizing = true
        resizeState.type = 'col'
        resizeState.index = c
        resizeState.startPos = e.clientX
        resizeState.startSize = colWidth
        e.preventDefault()
        return
      }
      
      if (accumulatedX > x + RESIZE_HANDLE_SIZE) break
    }
    
    // 如果不是调整大小，则是拖动选择列
    const col = getColAtX(x)
    dragState.isDragging = true
    dragState.startRow = 0
    dragState.startCol = col
    dragState.currentRow = DEFAULT_ROWS - 1
    dragState.currentCol = col
    
    console.log('onMouseDown - 初始化列选择:', {
      col,
      startRow: dragState.startRow,
      startCol: dragState.startCol,
      currentRow: dragState.currentRow,
      currentCol: dragState.currentCol
    })
    
    selected.row = 0
    selected.col = col
    selectionRange.startRow = 0
    selectionRange.startCol = col
    selectionRange.endRow = DEFAULT_ROWS - 1
    selectionRange.endCol = col
    draw()
    return
  }

  // 点击左上角
  if (x < ROW_HEADER_WIDTH && y < COL_HEADER_HEIGHT) return

  // Account for scroll offset - 使用动态计算
  const col = getColAtX(x)
  const row = getRowAtY(y)

  // 如果输入框可见，检查点击位置
  if (overlay.visible && overlayInput.value) {
    // 获取输入框的实际元素（可能已自动扩大）
    const inputElement = (overlayInput.value as any).getInputElement?.()
    
    if (inputElement) {
      const inputRect = inputElement.getBoundingClientRect()
      const containerRect = container.value!.getBoundingClientRect()
      
      // 将输入框坐标转换为相对于容器的坐标
      const inputLeft = inputRect.left - containerRect.left
      const inputTop = inputRect.top - containerRect.top
      const inputRight = inputLeft + inputRect.width
      const inputBottom = inputTop + inputRect.height
      
      // 如果点击的是输入框内部
      if (x >= inputLeft && x <= inputRight && y >= inputTop && y <= inputBottom) {
        // 不初始化拖拽状态，直接返回
        return
      }
    }
    
    // 如果在公式模式下点击输入框外部，阻止默认行为以保持焦点
    if ((overlayInput.value as any).formulaMode) {
      e.preventDefault()
    }
  }

  // Prepare for drag selection
  dragState.isDragging = true
  dragState.startRow = row
  dragState.startCol = col
  dragState.currentRow = row
  dragState.currentCol = col
}

function openOverlay(row: number, col: number, initialValue: string, mode: 'edit' | 'typing' = 'edit') {
  overlay.row = row
  overlay.col = col
  overlay.top = COL_HEADER_HEIGHT + getRowTop(row) - viewport.scrollTop
  overlay.left = ROW_HEADER_WIDTH + getColLeft(col) - viewport.scrollLeft
  overlay.width = getColWidth(col)
  overlay.height = getRowHeight(row)
  overlay.value = initialValue
  overlay.originalValue = initialValue  // 保存原始值用于 ESC 取消
  overlay.mode = mode
  overlay.visible = true
  draw()
}

function onDoubleClick(e: MouseEvent) {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // ignore clicks in headers
  if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return

  // Account for scroll offset - 使用动态计算
  const col = getColAtX(x)
  const row = getRowAtY(y)

  // Open edit mode
  selected.row = row
  selected.col = col
  const editValue = formulaSheet.getDisplayValue(row, col)
  openOverlay(row, col, editValue, 'edit')
}

function onKeyDown(e: KeyboardEvent) {
  // Only handle keyboard when not in edit mode
  if (overlay.visible) return

  // Handle undo (Ctrl/Cmd + Z)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (undoRedo.undo()) {
      draw()
    }
    return
  }

  // Handle redo (Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z)
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    if (undoRedo.redo()) {
      draw()
    }
    return
  }

  // Handle copy (Ctrl/Cmd + C)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    onCopy()
    return
  }

  // Handle paste (Ctrl/Cmd + V)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    e.preventDefault()
    onPaste()
    return
  }

  // Handle Select All (Ctrl/Cmd + A)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    // Select entire range
    selectionRange.startRow = 0
    selectionRange.startCol = 0
    selectionRange.endRow = DEFAULT_ROWS - 1
    selectionRange.endCol = DEFAULT_COLS - 1
    selected.row = 0
    selected.col = 0
    draw()
    return
  }

  // Handle Escape (clear selection and drag state)
  if (e.key === 'Escape') {
    e.preventDefault()
    selectionRange.startRow = -1
    selectionRange.startCol = -1
    selectionRange.endRow = -1
    selectionRange.endCol = -1
    dragState.isDragging = false
    dragState.startRow = -1
    dragState.startCol = -1
    dragState.currentRow = -1
    dragState.currentCol = -1
    draw()
    return
  }

  // Don't handle printable keys - let IME handle them
  // The strategy: open the overlay and let the input element handle all composition
  if (e.key === 'Process' || e.isComposing) {
    return
  }

  // For any printable key, open overlay and focus the input
  // The input element will handle IME, backspace, etc automatically
  if (
    e.key.length === 1 &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    selected.row >= 0 &&
    selected.col >= 0
  ) {
    // Open overlay in typing mode with empty value
    openOverlay(selected.row, selected.col, '', 'typing')
    // Don't prevent default - let the key event propagate to the input element
    return
  }

  // Handle Shift+Arrow for range selection extension
  if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault()
    
    // Initialize selection if not already started
    if (selectionRange.startRow === -1) {
      selectionRange.startRow = selected.row
      selectionRange.startCol = selected.col
      selectionRange.endRow = selected.row
      selectionRange.endCol = selected.col
    }
    
    // Extend selection based on arrow key
    const step = 1
    switch (e.key) {
      case 'ArrowUp':
        selectionRange.endRow = Math.max(selectionRange.startRow, selectionRange.endRow - step)
        break
      case 'ArrowDown':
        selectionRange.endRow = Math.min(DEFAULT_ROWS - 1, selectionRange.endRow + step)
        break
      case 'ArrowLeft':
        selectionRange.endCol = Math.max(selectionRange.startCol, selectionRange.endCol - step)
        break
      case 'ArrowRight':
        selectionRange.endCol = Math.min(DEFAULT_COLS - 1, selectionRange.endCol + step)
        break
    }
    
    // Update selected cell to the end of the range
    selected.row = selectionRange.endRow
    selected.col = selectionRange.endCol
    ensureVisible(selected.row, selected.col)
    draw()
    return
  }

  const step = e.shiftKey ? 5 : 1
  let newRow = selected.row
  let newCol = selected.col

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      newRow = Math.max(0, selected.row - step)
      break
    case 'ArrowDown':
      e.preventDefault()
      newRow = Math.min(DEFAULT_ROWS - 1, selected.row + step)
      break
    case 'ArrowLeft':
      e.preventDefault()
      newCol = Math.max(0, selected.col - step)
      break
    case 'ArrowRight':
      e.preventDefault()
      newCol = Math.min(DEFAULT_COLS - 1, selected.col + step)
      break
    case 'Enter':
      e.preventDefault()
      // Move down one row, or wrap to next column first row
      newRow = selected.row + 1
      if (newRow >= DEFAULT_ROWS) {
        newRow = 0
        newCol = selected.col + 1
        if (newCol >= DEFAULT_COLS) {
          newCol = DEFAULT_COLS - 1
        }
      }
      break
    case 'Tab':
      e.preventDefault()
      // Move right one column, or wrap to next row first column
      newCol = selected.col + 1
      if (newCol >= DEFAULT_COLS) {
        newCol = 0
        newRow = selected.row + 1
        if (newRow >= DEFAULT_ROWS) {
          newRow = DEFAULT_ROWS - 1
        }
      }
      break
    default:
      return
  }

  if (newRow !== selected.row || newCol !== selected.col) {
    selected.row = newRow
    selected.col = newCol
    // Clear selection range when moving without Shift
    selectionRange.startRow = -1
    selectionRange.startCol = -1
    selectionRange.endRow = -1
    selectionRange.endCol = -1
    ensureVisible(newRow, newCol)
    draw()
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  
  // Scroll vertically or horizontally
  if (e.shiftKey || e.deltaX !== 0) {
    // Horizontal scroll
    const w = container.value?.clientWidth ?? 0
    const trackW = Math.max(0, w - ROW_HEADER_WIDTH)
    const maxScrollLeft = Math.max(0, getTotalContentWidth() - trackW)
    viewport.scrollLeft = Math.max(0, Math.min(
      viewport.scrollLeft + (e.deltaY || e.deltaX),
      maxScrollLeft
    ))
  } else {
    // Vertical scroll
    const h = container.value?.clientHeight ?? 0
    const trackH = Math.max(0, h - COL_HEADER_HEIGHT)
    const maxScrollTop = Math.max(0, getTotalContentHeight() - trackH)
    viewport.scrollTop = Math.max(0, Math.min(
      viewport.scrollTop + e.deltaY,
      maxScrollTop
    ))
  }
  
  draw()
}

function onMouseMove(e: MouseEvent) {
  if (!container.value) return
  
  // 滚动条拖拽优先处理
  if (scrollbar.dragging) {
    const rect = container.value.getBoundingClientRect()
    if (scrollbar.dragging === 'v') {
      const h = rect.height
      const trackH = Math.max(0, h - COL_HEADER_HEIGHT)
      const contentH = getTotalContentHeight()
      const thumbMovable = Math.max(1, trackH - scrollbar.v.thumbSize)
      const maxScroll = Math.max(1, contentH - trackH)
      const delta = e.clientY - scrollbar.startMousePos
      const scrollDelta = delta * (maxScroll / thumbMovable)
      viewport.scrollTop = Math.max(0, Math.min(scrollbar.startScroll + scrollDelta, maxScroll))
    } else if (scrollbar.dragging === 'h') {
      const w = rect.width
      const trackW = Math.max(0, w - ROW_HEADER_WIDTH)
      const contentW = getTotalContentWidth()
      const thumbMovable = Math.max(1, trackW - scrollbar.h.thumbSize)
      const maxScroll = Math.max(1, contentW - trackW)
      const delta = e.clientX - scrollbar.startMousePos
      const scrollDelta = delta * (maxScroll / thumbMovable)
      viewport.scrollLeft = Math.max(0, Math.min(scrollbar.startScroll + scrollDelta, maxScroll))
    }
    scheduleRedraw()
    return
  }

  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 处理调整大小
  if (resizeState.isResizing) {
    if (resizeState.type === 'row') {
      const delta = e.clientY - resizeState.startPos
      const newHeight = Math.max(ROW_HEIGHT / 2, resizeState.startSize + delta)
      rowHeights.value.set(resizeState.index, newHeight)
      scheduleRedraw()
    } else if (resizeState.type === 'col') {
      const delta = e.clientX - resizeState.startPos
      const newWidth = Math.max(COL_WIDTH / 2, resizeState.startSize + delta)
      colWidths.value.set(resizeState.index, newWidth)
      scheduleRedraw()
    }
    return
  }

  // 更新光标样式和悬停状态：检测是否悬停在调整区域
  let cursor = 'default'
  let hoverFound = false
  
  // 检测行高调整区域（分隔线中间）
  if (x < ROW_HEADER_WIDTH && y > COL_HEADER_HEIGHT) {
    let accumulatedY = COL_HEADER_HEIGHT - viewport.scrollTop
    for (let r = 0; r < DEFAULT_ROWS; r++) {
      const rowHeight = getRowHeight(r)
      accumulatedY += rowHeight
      
      if (Math.abs(y - accumulatedY) <= RESIZE_HANDLE_SIZE / 2) {
        cursor = 'ns-resize'
        hoverState.type = 'row'
        hoverState.index = r
        hoverFound = true
        scheduleRedraw() // 重绘以显示高亮
        break
      }
      
      if (accumulatedY > y + RESIZE_HANDLE_SIZE) break
    }
  }
  
  // 检测列宽调整区域（分隔线中间）
  if (!hoverFound && y < COL_HEADER_HEIGHT && x > ROW_HEADER_WIDTH) {
    let accumulatedX = ROW_HEADER_WIDTH - viewport.scrollLeft
    for (let c = 0; c < DEFAULT_COLS; c++) {
      const colWidth = getColWidth(c)
      accumulatedX += colWidth
      
      if (Math.abs(x - accumulatedX) <= RESIZE_HANDLE_SIZE / 2) {
        cursor = 'ew-resize'
        hoverState.type = 'col'
        hoverState.index = c
        hoverFound = true
        scheduleRedraw() // 重绘以显示高亮
        break
      }
      
      if (accumulatedX > x + RESIZE_HANDLE_SIZE) break
    }
  }
  
  // 如果没有悬停在任何调整区域，清除悬停状态
  if (!hoverFound && (hoverState.type !== '' || hoverState.index !== -1)) {
    hoverState.type = ''
    hoverState.index = -1
    scheduleRedraw()
  }
  
  container.value.style.cursor = cursor

  // 处理单元格拖拽选择
  if (!dragState.isDragging) return

  // 检查鼠标是否在容器外
  // 如果鼠标移出容器，停止更新拖拽状态
  if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
    return
  }

  // 判断是否是行/列拖动选择
  const isRowDrag = (dragState.startCol === 0 && dragState.currentCol === DEFAULT_COLS - 1)
  const isColDrag = (dragState.startRow === 0 && dragState.currentRow === DEFAULT_ROWS - 1)

  if (isRowDrag) {
    // 拖动选择行
    const row = getRowAtY(y)
    if (row >= 0 && row < DEFAULT_ROWS) {
      dragState.currentRow = row
      // 保持列范围为整行
      dragState.currentCol = DEFAULT_COLS - 1
      selectionRange.startRow = Math.min(dragState.startRow, dragState.currentRow)
      selectionRange.startCol = 0
      selectionRange.endRow = Math.max(dragState.startRow, dragState.currentRow)
      selectionRange.endCol = DEFAULT_COLS - 1
      console.log('onMouseMove - 行拖动:', { row, startRow: dragState.startRow, currentRow: dragState.currentRow })
      scheduleRedraw()
    }
    return
  }

  if (isColDrag) {
    // 拖动选择列
    const col = getColAtX(x)
    if (col >= 0 && col < DEFAULT_COLS) {
      dragState.currentCol = col
      // 保持行范围为整列
      dragState.currentRow = DEFAULT_ROWS - 1
      selectionRange.startRow = 0
      selectionRange.startCol = Math.min(dragState.startCol, dragState.currentCol)
      selectionRange.endRow = DEFAULT_ROWS - 1
      selectionRange.endCol = Math.max(dragState.startCol, dragState.currentCol)
      console.log('onMouseMove - 列拖动:', { col, startCol: dragState.startCol, currentCol: dragState.currentCol })
      scheduleRedraw()
    }
    return
  }

  // 普通单元格拖动选择
  // ignore moves in headers
  if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return

  // Account for scroll offset - 使用动态计算
  const col = getColAtX(x)
  const row = getRowAtY(y)

  dragState.currentRow = Math.max(0, Math.min(row, DEFAULT_ROWS - 1))
  dragState.currentCol = Math.max(0, Math.min(col, DEFAULT_COLS - 1))

  // Update selection range as dragging
  selectionRange.startRow = Math.min(dragState.startRow, dragState.currentRow)
  selectionRange.startCol = Math.min(dragState.startCol, dragState.currentCol)
  selectionRange.endRow = Math.max(dragState.startRow, dragState.currentRow)
  selectionRange.endCol = Math.max(dragState.startCol, dragState.currentCol)

  // Use scheduleRedraw for smooth dragging at 60fps
  scheduleRedraw()
}

function onMouseUp(): void {
  // 结束调整大小
  if (resizeState.isResizing) {
    resizeState.isResizing = false
    resizeState.type = ''
    resizeState.index = -1
    return
  }

  if (!dragState.isDragging) return

  // 判断是否是行/列拖动选择
  const isRowDrag = (dragState.startCol === 0 && dragState.currentCol === DEFAULT_COLS - 1)
  const isColDrag = (dragState.startRow === 0 && dragState.currentRow === DEFAULT_ROWS - 1)

  console.log('onMouseUp - dragState:', {
    startRow: dragState.startRow,
    startCol: dragState.startCol,
    currentRow: dragState.currentRow,
    currentCol: dragState.currentCol,
    isRowDrag,
    isColDrag
  })
  console.log('onMouseUp - selectionRange:', {
    startRow: selectionRange.startRow,
    startCol: selectionRange.startCol,
    endRow: selectionRange.endRow,
    endCol: selectionRange.endCol
  })
  console.log('onMouseUp - selected:', {
    row: selected.row,
    col: selected.col
  })

  // 检测是否真正拖动了（不是单纯的点击）
  const hasDragged = (dragState.startRow !== dragState.currentRow || dragState.startCol !== dragState.currentCol)
  
  dragState.isDragging = false

  // 如果是行列拖动，保持选择范围不变（已经在 onMouseMove 中设置好了）
  if (isRowDrag || isColDrag) {
    console.log('行列拖动完成，保持选择范围')
    // 清空单选状态，避免覆盖范围选择的显示
    selected.row = -1
    selected.col = -1
    // 标记刚完成拖动（如果真的拖动了）
    if (hasDragged) {
      dragState.justFinishedDrag = true
    }
    draw()
    return
  }
  
  // Check if input is in formula mode
  if (overlay.visible && overlayInput.value && (overlayInput.value as any).formulaMode) {
    // 检查是否点击的是正在编辑的单元格本身
    const clickedSelf = (dragState.startRow === overlay.row && dragState.startCol === overlay.col)
    
    if (clickedSelf) {
      // 点击自己不插入引用，仅聚焦输入框
      return
    }
    
    // Excel 风格：只在以下情况允许点击插入/替换引用
    // 1. 可选状态（操作符后，绿色边框）
    // 2. 选中了单元格引用文本（如双击选中了 "D3"）
    const overlayInputInstance = overlayInput.value as any
    // Vue 的 defineExpose 会自动解包 ref，所以直接访问属性即可
    const isSelectable = overlayInputInstance?.isInSelectableState ?? false
    const hasSelection = overlayInputInstance?.hasTextSelection ?? false
    
    if (!isSelectable && !hasSelection) {
      // 红框状态：非可选状态且没有选中单元格引用
      // 此时点击其他单元格应该：
      // 1. 提交当前单元格的编辑
      // 2. 激活被点击的单元格
      
      // 获取当前编辑的值
      const currentValue = overlayInputInstance?.getCurrentValue?.() ?? ''
      
      // 保存到当前编辑的单元格
      const editRow = overlay.row
      const editCol = overlay.col
      formulaSheet.setValue(editRow, editCol, currentValue)
      
      // 关闭编辑框
      overlay.visible = false
      formulaReferences.value = []
      
      // 激活被点击的单元格
      selected.row = dragState.startRow
      selected.col = dragState.startCol
      selectionRange.startRow = -1
      selectionRange.startCol = -1
      selectionRange.endRow = -1
      selectionRange.endCol = -1
      
      draw()
      return
    }
    
    // In formula mode and selectable state: insert cell reference or range
    if (dragState.startRow !== dragState.currentRow || dragState.startCol !== dragState.currentCol) {
      // Dragged: insert range reference
      const startAddr = formulaSheet.getCellAddress(dragState.startRow, dragState.startCol)
      const endAddr = formulaSheet.getCellAddress(dragState.currentRow, dragState.currentCol)
      ;(overlayInput.value as any).insertRangeReference(startAddr, endAddr)
    } else {
      // Single cell click: insert single reference
      const cellAddr = formulaSheet.getCellAddress(dragState.startRow, dragState.startCol)
      ;(overlayInput.value as any).insertCellReference(cellAddr)
    }
    
    // 保持编辑单元格为选中状态
    selected.row = overlay.row
    selected.col = overlay.col
    selectionRange.startRow = -1
    selectionRange.startCol = -1
    selectionRange.endRow = -1
    selectionRange.endCol = -1
    
    // 绘制选择区域的视觉反馈
    draw()
    
    // Clear drag state but keep overlay open for continued editing
    return
  }
  
  // If dragged to a different cell, clear single selection and keep range
  if (dragState.startRow !== dragState.currentRow || dragState.startCol !== dragState.currentCol) {
    selected.row = -1
    selected.col = -1
    // 标记刚完成拖动
    dragState.justFinishedDrag = true
  } else {
    // If no actual drag (same cell), set it as selected
    selected.row = dragState.startRow
    selected.col = dragState.startCol
    selectionRange.startRow = -1
    selectionRange.startCol = -1
    selectionRange.endRow = -1
    selectionRange.endCol = -1
  }
  
  draw()
}

function getSelectionAsCSV(): string {
  let csv = ''
  let startRow = selected.row
  let endRow = selected.row
  let startCol = selected.col
  let endCol = selected.col

  // Use selection range if available
  if (selectionRange.startRow >= 0) {
    startRow = selectionRange.startRow
    endRow = selectionRange.endRow
    startCol = selectionRange.startCol
    endCol = selectionRange.endCol
  }

  for (let r = startRow; r <= endRow; r++) {
    const row: string[] = []
    for (let c = startCol; c <= endCol; c++) {
      // Use getModel() to get raw value for CSV export
      const val = formulaSheet.getModel().getValue(r, c)
      // Escape quotes and wrap in quotes if contains comma
      const escaped = val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
      row.push(escaped)
    }
    csv += row.join(',') + '\n'
  }
  return csv
}

async function onCopy() {
  const csv = getSelectionAsCSV()
  try {
    await navigator.clipboard.writeText(csv)
    console.log('Copied to clipboard:', csv)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

async function onPaste() {
  try {
    const text = await navigator.clipboard.readText()
    // Parse CSV (simple version, handles basic cases)
    const lines = text.trim().split('\n')
    const startRow = selected.row
    const startCol = selected.col

    for (let r = 0; r < lines.length; r++) {
      const line = lines[r]
      if (!line) continue
      
      const cells = line.split(',').map(cell => {
        // Remove surrounding quotes if present
        if (cell.startsWith('"') && cell.endsWith('"')) {
          return cell.slice(1, -1).replace(/""/g, '"')
        }
        return cell
      })

      for (let c = 0; c < cells.length; c++) {
        const cellVal = cells[c] ?? ''
        formulaSheet.setValue(startRow + r, startCol + c, cellVal)  // 使用 FormulaSheet.setValue 以清理缓存
      }
    }
    draw()
    console.log('Pasted from clipboard')
  } catch (err) {
    console.error('Failed to paste:', err)
  }
}

function onOverlaySave(val: string) {
  const row = overlay.row
  const col = overlay.col
  const oldValue = formulaSheet.getDisplayValue(row, col)
  
  // Only create undo action if value actually changed
  if (oldValue !== val) {
    undoRedo.execute({
      name: `Edit cell (${row}, ${col})`,
      undo: () => {
        formulaSheet.setValue(row, col, oldValue)  // 使用 FormulaSheet.setValue 而不是 getModel().setValue
        draw()
      },
      redo: () => {
        formulaSheet.setValue(row, col, val)  // 使用 FormulaSheet.setValue 而不是 getModel().setValue
        draw()
      }
    })
  }
  
  overlay.visible = false
  formulaReferences.value = []  // 清空引用高亮
  
  // 回车确认后，光标移动到下一行
  // 如果是最后一行，则移动到下一列的第一行
  if (row < DEFAULT_ROWS - 1) {
    // 不是最后一行，向下移动
    selected.row = row + 1
    selected.col = col
  } else {
    // 是最后一行，移动到下一列的第一行
    if (col < DEFAULT_COLS - 1) {
      selected.row = 0
      selected.col = col + 1
    } else {
      // 已经是最后一列的最后一行，回到第一行第一列
      selected.row = 0
      selected.col = 0
    }
  }
  
  // 清除区域选择
  selectionRange.startRow = -1
  selectionRange.startCol = -1
  selectionRange.endRow = -1
  selectionRange.endCol = -1
  
  draw()
}

function onOverlayCancel() {
  // ESC 取消输入，不保存更改，恢复原值
  overlay.visible = false
  formulaReferences.value = []  // 清空引用高亮
  draw()
}

function onCompositionStart() {
  if (!overlay.visible) {
    if (selected.row < 0 || selected.col < 0) return
    openOverlay(selected.row, selected.col, '', 'typing')
  }
}

// 监听公式输入变化，更新引用高亮
let updateReferencesTimer: number | null = null
function updateFormulaReferences() {
  if (updateReferencesTimer !== null) {
    clearTimeout(updateReferencesTimer)
  }
  
  updateReferencesTimer = window.setTimeout(() => {
    if (overlay.visible && overlayInput.value && (overlayInput.value as any).formulaMode) {
      const currentValue = (overlayInput.value as any).getCurrentValue?.() || overlay.value
      formulaReferences.value = parseFormulaReferences(currentValue)
      draw()
    } else {
      formulaReferences.value = []
    }
    updateReferencesTimer = null
  }, 100)
}

// 监听 overlay 可见性变化
watch(() => overlay.visible, () => {
  updateFormulaReferences()
})

// 右键菜单处理
function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  contextMenu.x = e.clientX
  contextMenu.y = e.clientY
  
  // 判断点击位置
  if (x < ROW_HEADER_WIDTH && y > COL_HEADER_HEIGHT) {
    // 点击行头
    const row = getRowAtY(y)
    contextMenu.targetRow = row
    contextMenu.targetCol = -1
    contextMenu.items = [
      { label: '在上方插入行', action: () => insertRowAbove(row) },
      { label: '在下方插入行', action: () => insertRowBelow(row) },
      { label: '删除行', action: () => deleteRow(row) },
      { label: '', action: () => {}, divider: true },
      { label: '设置行高...', action: () => showSetRowHeightDialog(row) }
    ]
    contextMenu.visible = true
  } else if (y < COL_HEADER_HEIGHT && x > ROW_HEADER_WIDTH) {
    // 点击列头
    const col = getColAtX(x)
    contextMenu.targetRow = -1
    contextMenu.targetCol = col
    contextMenu.items = [
      { label: '在左侧插入列', action: () => insertColLeft(col) },
      { label: '在右侧插入列', action: () => insertColRight(col) },
      { label: '删除列', action: () => deleteCol(col) },
      { label: '', action: () => {}, divider: true },
      { label: '设置列宽...', action: () => showSetColWidthDialog(col) }
    ]
    contextMenu.visible = true
  }
  // 其他区域不显示菜单（已屏蔽默认菜单）
}

// 行操作
function insertRowAbove(row: number) {
  console.log('在行', row, '上方插入行')
  
  // 获取底层模型
  const model = formulaSheet.getModel()
  
  // 收集需要移动的单元格数据
  const cellsToMove: Array<{ row: number; col: number; value: string }> = []
  model.forEach((r, c, cell) => {
    if (r >= row) {
      cellsToMove.push({ row: r, col: c, value: cell.value })
    }
  })
  
  // 按行号从大到小排序，避免覆盖
  cellsToMove.sort((a, b) => b.row - a.row)
  
  // 将数据移到新位置（行号+1），从后往前移动
  cellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r + 1, c, value)
  })
  
  // 清空插入的新行
  for (let c = 0; c < DEFAULT_COLS; c++) {
    model.setValue(row, c, '')
  }
  
  // 移动自定义行高
  const newRowHeights = new Map<number, number>()
  rowHeights.value.forEach((height, r) => {
    if (r >= row) {
      newRowHeights.set(r + 1, height)
    } else {
      newRowHeights.set(r, height)
    }
  })
  rowHeights.value = newRowHeights
  
  // 清空公式缓存，确保重新计算
  formulaSheet.clearFormulaCache()
  
  // 重新绘制
  draw()
}

function insertRowBelow(row: number) {
  console.log('在行', row, '下方插入行')
  // 在下方插入等同于在 row+1 的上方插入
  insertRowAbove(row + 1)
}

function deleteRow(row: number) {
  console.log('删除行', row)
  
  // 获取底层模型
  const model = formulaSheet.getModel()
  
  // 收集需要移动的单元格数据
  const cellsToMove: Array<{ row: number; col: number; value: string }> = []
  model.forEach((r, c, cell) => {
    if (r > row) {
      cellsToMove.push({ row: r, col: c, value: cell.value })
    }
  })
  
  // 按行号从小到大排序，从前往后移动
  cellsToMove.sort((a, b) => a.row - b.row)
  
  // 先清空被删除的行
  for (let c = 0; c < DEFAULT_COLS; c++) {
    model.setValue(row, c, '')
  }
  
  // 将数据移到新位置（行号-1），从前往后移动
  cellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r - 1, c, value)
    // 清空原位置
    model.setValue(r, c, '')
  })
  
  // 移动自定义行高
  const newRowHeights = new Map<number, number>()
  rowHeights.value.forEach((height, r) => {
    if (r < row) {
      newRowHeights.set(r, height)
    } else if (r > row) {
      newRowHeights.set(r - 1, height)
    }
    // r === row 的行高被删除，不添加到新map中
  })
  rowHeights.value = newRowHeights
  
  // 调整选择范围
  if (selected.row === row) {
    selected.row = Math.max(0, row - 1)
  } else if (selected.row > row) {
    selected.row--
  }
  
  // 清空公式缓存，确保重新计算
  formulaSheet.clearFormulaCache()
  
  // 重新绘制
  draw()
}

function showSetRowHeightDialog(row: number) {
  const currentHeight = getRowHeight(row)
  inputDialog.title = '设置行高'
  inputDialog.defaultValue = currentHeight.toString()
  inputDialog.placeholder = '请输入行高（像素）'
  inputDialog.callback = (value: string) => {
    const height = parseInt(value, 10)
    if (!isNaN(height) && height > 0) {
      rowHeights.value.set(row, height)
      draw()
    }
  }
  inputDialog.visible = true
}

// 列操作
function insertColLeft(col: number) {
  console.log('在列', col, '左侧插入列')
  
  // 获取底层模型
  const model = formulaSheet.getModel()
  
  // 收集需要移动的单元格数据
  const cellsToMove: Array<{ row: number; col: number; value: string }> = []
  model.forEach((r, c, cell) => {
    if (c >= col) {
      cellsToMove.push({ row: r, col: c, value: cell.value })
    }
  })
  
  // 按列号从大到小排序，避免覆盖
  cellsToMove.sort((a, b) => b.col - a.col)
  
  // 将数据移到新位置（列号+1），从右往左移动
  cellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c + 1, value)
  })
  
  // 清空插入的新列
  for (let r = 0; r < DEFAULT_ROWS; r++) {
    model.setValue(r, col, '')
  }
  
  // 移动自定义列宽
  const newColWidths = new Map<number, number>()
  colWidths.value.forEach((width, c) => {
    if (c >= col) {
      newColWidths.set(c + 1, width)
    } else {
      newColWidths.set(c, width)
    }
  })
  colWidths.value = newColWidths
  
  // 清空公式缓存，确保重新计算
  formulaSheet.clearFormulaCache()
  
  // 重新绘制
  draw()
}

function insertColRight(col: number) {
  console.log('在列', col, '右侧插入列')
  // 在右侧插入等同于在 col+1 的左侧插入
  insertColLeft(col + 1)
}

function deleteCol(col: number) {
  console.log('删除列', col)
  
  // 获取底层模型
  const model = formulaSheet.getModel()
  
  // 收集需要移动的单元格数据
  const cellsToMove: Array<{ row: number; col: number; value: string }> = []
  model.forEach((r, c, cell) => {
    if (c > col) {
      cellsToMove.push({ row: r, col: c, value: cell.value })
    }
  })
  
  // 按列号从小到大排序，从左往右移动
  cellsToMove.sort((a, b) => a.col - b.col)
  
  // 先清空被删除的列
  for (let r = 0; r < DEFAULT_ROWS; r++) {
    model.setValue(r, col, '')
  }
  
  // 将数据移到新位置（列号-1），从左往右移动
  cellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c - 1, value)
    // 清空原位置
    model.setValue(r, c, '')
  })
  
  // 移动自定义列宽
  const newColWidths = new Map<number, number>()
  colWidths.value.forEach((width, c) => {
    if (c < col) {
      newColWidths.set(c, width)
    } else if (c > col) {
      newColWidths.set(c - 1, width)
    }
    // c === col 的列宽被删除，不添加到新map中
  })
  colWidths.value = newColWidths
  
  // 调整选择范围
  if (selected.col === col) {
    selected.col = Math.max(0, col - 1)
  } else if (selected.col > col) {
    selected.col--
  }
  
  // 清空公式缓存，确保重新计算
  formulaSheet.clearFormulaCache()
  
  // 重新绘制
  draw()
}

function showSetColWidthDialog(col: number) {
  const currentWidth = getColWidth(col)
  inputDialog.title = '设置列宽'
  inputDialog.defaultValue = currentWidth.toString()
  inputDialog.placeholder = '请输入列宽（像素）'
  inputDialog.callback = (value: string) => {
    const width = parseInt(value, 10)
    if (!isNaN(width) && width > 0) {
      colWidths.value.set(col, width)
      draw()
    }
  }
  inputDialog.visible = true
}

// 输入对话框确认
function onInputDialogConfirm(value: string) {
  if (inputDialog.callback) {
    inputDialog.callback(value)
  }
  inputDialog.visible = false
}

onMounted(() => {
  // Ensure DOM is fully laid out
  window.requestAnimationFrame(() => {
    if (!container.value) return
    console.log('Container size:', container.value.clientWidth, container.value.clientHeight)
    // initial draw
    draw()
    // attach events
    container.value.addEventListener('mousedown', onMouseDown)
    container.value.addEventListener('click', onClick)
    container.value.addEventListener('dblclick', onDoubleClick)
    container.value.addEventListener('mousemove', onMouseMove)
    container.value.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', draw)
    window.addEventListener('compositionstart', onCompositionStart)
    // 滚动条全局拖拽事件
    window.addEventListener('mousemove', onGlobalMouseMove)
    window.addEventListener('mouseup', onGlobalMouseUp)
  })
})

onBeforeUnmount(() => {
  // Cancel pending redraw animation frame
  if (redrawHandle !== null) {
    cancelAnimationFrame(redrawHandle)
  }
  
  if (container.value) {
    container.value.removeEventListener('mousedown', onMouseDown)
    container.value.removeEventListener('click', onClick)
    container.value.removeEventListener('dblclick', onDoubleClick)
    container.value.removeEventListener('mousemove', onMouseMove)
    container.value.removeEventListener('wheel', onWheel)
  }
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', draw)
  window.removeEventListener('compositionstart', onCompositionStart)
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
})

function onVThumbMouseDown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  scrollbar.dragging = 'v'
  scrollbar.startMousePos = e.clientY
  scrollbar.startScroll = viewport.scrollTop
}

function onHThumbMouseDown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  scrollbar.dragging = 'h'
  scrollbar.startMousePos = e.clientX
  scrollbar.startScroll = viewport.scrollLeft
}

function onGlobalMouseMove(e: MouseEvent) {
  // 转发到 onMouseMove 的滚动条分支（容器坐标不需要）
  if (!scrollbar.dragging) return
  onMouseMove(e)
}

function onGlobalMouseUp() {
  if (scrollbar.dragging) {
    scrollbar.dragging = ''
  }
}
</script>

<style scoped>
.sheet-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #fff;
  border: 1px solid #ddd;
}

.grid-canvas,
.content-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* 自定义滚动条样式 */
.v-scrollbar-track {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12px;
  z-index: 60;
}
.v-scrollbar-thumb {
  position: absolute;
  left: 2px;
  width: 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  cursor: pointer;
}

.h-scrollbar-track {
  position: absolute;
  right: 0;
  bottom: 0;
  height: 12px;
  z-index: 60;
}
.h-scrollbar-thumb {
  position: absolute;
  top: 2px;
  height: 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  cursor: pointer;
}

.grid-canvas {
  z-index: 10;
}

.content-canvas {
  z-index: 20;
}
</style>
