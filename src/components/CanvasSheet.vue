<template>
  <div class="sheet-wrapper">
    <!-- 样式工具栏 -->
    <StyleToolbar v-if="api" :api="api" :current-selection="selected" :selection-range="selectionRange" />
    
    <div ref="container" class="sheet-container" @contextmenu="onContextMenu">
      <canvas ref="gridCanvas" class="grid-canvas"></canvas>
      <canvas ref="contentCanvas" class="content-canvas"></canvas>
      
      <!-- 隐藏的 IME 输入代理 textarea，用于捕获中文输入法的首字符 -->
      <textarea
        ref="imeProxy"
        class="ime-proxy"
        @compositionstart="onImeCompositionStart"
        @compositionupdate="onImeCompositionUpdate"
        @compositionend="onImeCompositionEnd"
        @input="onImeInput"
        @keydown="onImeKeyDown"
      ></textarea>
      
      <!-- RichTextInput 富文本编辑器 -->
    <RichTextInput
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
      :is-formula="overlay.value.startsWith('=')"
      :cell-style="model.getCellStyle(overlay.row, overlay.col)"
      :formula-references="richTextFormulaReferences"
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
    <!-- 计算进度指示器 -->
    <div v-if="calculationProgress.visible" class="calculation-progress">
      <div class="progress-content">
        <span class="progress-icon">···</span>
        <span class="progress-text">
          正在计算: {{ calculationProgress.pending + calculationProgress.processing }} 个公式
        </span>
        <span v-if="calculationProgress.completed > 0" class="progress-detail">
          (已完成 {{ calculationProgress.completed }})
        </span>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, reactive, watch, computed, nextTick } from 'vue'
import { getRowHeight as geomGetRowHeight, getColWidth as geomGetColWidth, getRowTop as geomGetRowTop, getColLeft as geomGetColLeft, getRowAtY as geomGetRowAtY, getColAtX as geomGetColAtX, getVisibleRange as geomGetVisibleRange, ensureVisible as geomEnsureVisible } from './sheet/geometry'
import type { GeometryConfig, SizeAccess, CellFormat } from './sheet/types'
import { setCanvasSize, createRedrawScheduler } from './sheet/renderCore'
import { drawGrid as renderGrid } from './sheet/renderGrid'
import type { GridRenderConfig } from './sheet/renderGrid'
import { drawCells as renderCells } from './sheet/renderCells'
import type { CellsRenderConfig } from './sheet/renderCells'
import { updateScrollbars, handleWheel, handleScrollbarDrag, startVerticalDrag, startHorizontalDrag, endDrag } from './sheet/scrollbar'
import { parseFormulaReferences } from './sheet/references'
import { 
  handleClick, 
  startDragSelection, 
  updateDragSelection, 
  endDragSelection, 
  getSelectionRangeText as getSelectionText,
  type SelectionState 
} from './sheet/selection'
import {
  openOverlay as openOverlayHelper,
  closeOverlay,
  handleDoubleClick as handleDoubleClickHelper,
  getNextCellAfterSave,
  isClickInsideOverlay
} from './sheet/overlay'
import {
  copySingleCell,
  copyRange,
  pasteInternal,
  pasteExternal,
  parseClipboardText,
  writeToClipboard,
  readFromClipboard,
  isInternalClipboardValid
} from './sheet/clipboard'
import {
  insertRowAbove as insertRowAboveHelper,
  insertRowBelow as insertRowBelowHelper,
  deleteRow as deleteRowHelper,
  insertColLeft as insertColLeftHelper,
  insertColRight as insertColRightHelper,
  deleteCol as deleteColHelper,
  showSetRowHeightDialog as showSetRowHeightDialogHelper,
  showSetColWidthDialog as showSetColWidthDialogHelper,
  type RowColConfig
} from './sheet/rowcol'
import {
  handleContextMenu,
  handleInputDialogConfirm as handleInputDialogConfirmHelper,
  type ContextMenuConfig
} from './sheet/uiMenus'
import { createSheetAPI } from './sheet/api'
import { createEventManager, type EventHandlers } from './sheet/events'
import { SheetModel } from '../lib/SheetModel'
import { UndoRedoManager } from '../lib/UndoRedoManager'
import { FormulaSheet } from '../lib/FormulaSheet'
import { initializeDemoData } from '../lib/demoData'

// Internal clipboard cell interface
interface InternalClipboardCell {
  value: string  // 原始值或公式
  isFormula: boolean
}

// 公式引用高亮显示 interface
interface FormulaReference {
  range: string  // 如 "A1" 或 "A1:B3"
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  color: string
}

// @ts-ignore
import RichTextInput from './RichTextInput.vue'
// @ts-ignore
import StyleToolbar from './StyleToolbar.vue'
// @ts-ignore
import ContextMenu from './ContextMenu.vue'
// @ts-ignore
import InputDialog from './InputDialog.vue'

const ROW_HEIGHT = 26
const COL_WIDTH = 100
const ROW_HEADER_WIDTH = 40
const COL_HEADER_HEIGHT = 26
const DEFAULT_ROWS = 200
const DEFAULT_COLS = 50
const RESIZE_HANDLE_SIZE = 4 // 拖动调整的检测区域（分隔线两侧各2px）

const container = ref<HTMLElement | null>(null)
const gridCanvas = ref<HTMLCanvasElement | null>(null)
const contentCanvas = ref<HTMLCanvasElement | null>(null)
const overlayInput = ref(null)
const imeProxy = ref<HTMLTextAreaElement | null>(null)  // IME 输入代理
// 最近一次应用内复制的时间戳（用于避免误用陈旧的内部剪贴板）
const lastCopyTs = ref(0)

// IME 输入状态
const imeState = reactive({
  isComposing: false,       // 是否正在输入法组合中
  compositionText: '',      // 当前组合的文本
  cursorPos: 0,             // 组合文本中的光标位置
})

// 自定义行高和列宽
const rowHeights = ref<Map<number, number>>(new Map()) // 存储自定义的行高
const colWidths = ref<Map<number, number>>(new Map())  // 存储自定义的列宽

// 隐藏行列状态
const hiddenRows = ref<Set<number>>(new Set())
const hiddenCols = ref<Set<number>>(new Set())

// 网格线显示开关
const showGridLines = ref<boolean>(true)

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
const formulaSheet = new FormulaSheet(model, true) // 启用异步计算
const undoRedo = new UndoRedoManager(100)

// 计算进度状态
const calculationProgress = reactive({
  visible: false,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0
})

// 监听计算队列状态
formulaSheet.onQueueStats((stats) => {
  calculationProgress.pending = stats.pending
  calculationProgress.processing = stats.processing
  calculationProgress.completed = stats.completed
  calculationProgress.failed = stats.failed
  calculationProgress.visible = stats.pending > 0 || stats.processing > 0
})

// 监听单元格状态变化，触发重绘
formulaSheet.onCellStateChange((_row, _col, state) => {
  if (state.state === 'completed' || state.state === 'error') {
    // 计算完成，触发重绘
    requestAnimationFrame(() => {
      draw()
    })
  }
})

// Initialize with demo data (style examples + sample data)
initializeDemoData(model)

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

// Internal clipboard for formula copying (preserve relative/absolute references)
const internalClipboard = reactive<{
  data: InternalClipboardCell[][] | null
  startRow: number
  startCol: number
}>({
  data: null,
  startRow: -1,
  startCol: -1
})
const formulaReferences = ref<FormulaReference[]>([])

// 为 RichTextInput 转换 FormulaReference 格式
const richTextFormulaReferences = computed(() => {
  // 依赖 formulaReferences.value 以触发重新计算
  const refs = formulaReferences.value
  
  // 从 overlayInput 获取当前值，而不是使用 overlay.value
  // 因为 RichTextInput 内部管理自己的值，overlay.value 不会实时更新
  const text = (overlayInput.value as any)?.getCurrentValue?.() || overlay.value
  const result: Array<{ ref: string; color: string; startIndex: number; endIndex: number }> = []
  
  for (const ref of refs) {
    // 在文本中查找引用的所有出现位置（不区分大小写）
    const textUpper = text.toUpperCase()
    const refUpper = ref.range.toUpperCase()
    
    let searchStart = 0
    while (searchStart < text.length) {
      const startIndex = textUpper.indexOf(refUpper, searchStart)
      if (startIndex === -1) break
      
      const endIndex = startIndex + ref.range.length
      result.push({
        ref: ref.range,
        color: ref.color,
        startIndex,
        endIndex
      })
      
      searchStart = endIndex
    }
  }
  
  return result
})

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

// Redraw scheduler from render core
const { scheduleRedraw, cancelScheduled } = createRedrawScheduler(() => draw())


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
  updateScrollbarsLocal(w, h)
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
  
  // 如果正在 IME 组合中，在选中单元格上绘制组合文本
  if (imeState.isComposing && imeState.compositionText && selected.row >= 0 && selected.col >= 0 && !overlay.visible) {
    drawImeCompositionText()
  }
}

/**
 * 在 canvas 上绘制 IME 组合中的文本
 * 让用户在输入法组合期间能看到正在输入的内容（如拼音）
 * 根据单元格样式显示
 */
function drawImeCompositionText() {
  if (!contentCanvas.value) return
  const ctx = contentCanvas.value.getContext('2d')
  if (!ctx) return
  
  const row = selected.row
  const col = selected.col
  const text = imeState.compositionText
  
  // 获取单元格样式
  const cellStyle = model.getCellStyle(row, col)
  
  // 计算单元格位置
  const cellX = ROW_HEADER_WIDTH + getColLeft(col) - viewport.scrollLeft
  const cellY = COL_HEADER_HEIGHT + getRowTop(row) - viewport.scrollTop
  const cellWidth = getColWidth(col)
  const cellHeight = getRowHeight(row)
  
  // 确保在可见区域内
  if (cellX + cellWidth < ROW_HEADER_WIDTH || cellY + cellHeight < COL_HEADER_HEIGHT) {
    return
  }
  
  // 绘制背景覆盖单元格原内容
  ctx.save()
  ctx.beginPath()
  ctx.rect(
    Math.max(cellX, ROW_HEADER_WIDTH),
    Math.max(cellY, COL_HEADER_HEIGHT),
    cellWidth,
    cellHeight
  )
  ctx.clip()
  
  // 使用单元格背景色或白色
  ctx.fillStyle = cellStyle.backgroundColor || '#fff'
  ctx.fillRect(cellX, cellY, cellWidth, cellHeight)
  
  // 构建字体样式
  const fontSize = cellStyle.fontSize || 13
  const fontFamily = cellStyle.fontFamily || 'Arial, sans-serif'
  const fontWeight = cellStyle.bold ? 'bold' : 'normal'
  const fontStyle = cellStyle.italic ? 'italic' : 'normal'
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  
  // 使用单元格文字颜色
  const textColor = cellStyle.color || '#000'
  ctx.fillStyle = textColor
  ctx.textBaseline = 'middle'
  
  // 计算文本位置（考虑对齐方式）
  const padding = 4
  let textX = cellX + padding
  const textY = cellY + cellHeight / 2
  
  // 水平对齐
  const textWidth = ctx.measureText(text).width
  if (cellStyle.textAlign === 'center') {
    textX = cellX + (cellWidth - textWidth) / 2
  } else if (cellStyle.textAlign === 'right') {
    textX = cellX + cellWidth - textWidth - padding
  }
  
  // 绘制文本
  ctx.fillText(text, textX, textY)
  
  // 绘制下划线表示这是组合中的文本
  ctx.strokeStyle = textColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(textX, textY + fontSize / 2 + 2)
  ctx.lineTo(textX + textWidth, textY + fontSize / 2 + 2)
  ctx.stroke()
  
  // 计算光标位置（根据 cursorPos 计算光标在文本中的像素位置）
  const cursorPos = imeState.cursorPos
  const textBeforeCursor = text.substring(0, cursorPos)
  const cursorOffsetX = ctx.measureText(textBeforeCursor).width
  const cursorX = textX + cursorOffsetX
  const cursorTop = textY - fontSize / 2
  const cursorBottom = textY + fontSize / 2
  
  // 绘制光标
  ctx.strokeStyle = textColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cursorX, cursorTop)
  ctx.lineTo(cursorX, cursorBottom)
  ctx.stroke()
  
  ctx.restore()
}


// 创建 SizeAccess 对象的辅助函数
function createSizeAccess(): SizeAccess {
  return {
    rowHeights: rowHeights.value,
    colWidths: colWidths.value,
    hiddenRows: hiddenRows.value,
    hiddenCols: hiddenCols.value,
    showGridFlag: showGridLines.value
  }
}

// 获取指定行的高度（通过几何模块）
function getRowHeight(row: number): number {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  return geomGetRowHeight(row, sizes, cfg)
}

// 获取指定列的宽度（通过几何模块）
function getColWidth(col: number): number {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  return geomGetColWidth(col, sizes, cfg)
}

// 获取从0到指定行的累计高度
function getRowTop(row: number): number {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  return geomGetRowTop(row, sizes, cfg)
}

// 获取从0到指定列的累计宽度
function getColLeft(col: number): number {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  return geomGetColLeft(col, sizes, cfg)
}

// 根据 Y 坐标（含滚动偏移）获取行号
function getRowAtY(y: number): number {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  return geomGetRowAtY(y, viewport, sizes, cfg, DEFAULT_ROWS)
}

// 根据 X 坐标（含滚动偏移）获取列号
function getColAtX(x: number): number {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  return geomGetColAtX(x, viewport, sizes, cfg, DEFAULT_COLS)
}

function getVisibleRange(w: number, h: number) {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  return geomGetVisibleRange(w, h, viewport, sizes, cfg, DEFAULT_ROWS, DEFAULT_COLS)
}

function ensureVisible(row: number, col: number) {
  if (!container.value) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  const next = geomEnsureVisible(row, col, viewport, w, h, sizes, cfg)
  viewport.scrollTop = next.scrollTop
  viewport.scrollLeft = next.scrollLeft
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

function updateScrollbarsLocal(w: number, h: number) {
  updateScrollbars(viewport, scrollbar, {
    containerWidth: w,
    containerHeight: h,
    contentWidth: getTotalContentWidth(),
    contentHeight: getTotalContentHeight(),
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  })
}

/**
 * 获取选择范围的文本表示 (如 "A1:B3", "3行 x 2列")
 */
function getSelectionRangeText(startRow: number, startCol: number, endRow: number, endCol: number): string {
  return getSelectionText(startRow, startCol, endRow, endCol, (r, c) => formulaSheet.getCellAddress(r, c))
}

function drawGrid(w: number, h: number) {
  const canvas = gridCanvas.value!
  const ctx = canvas.getContext('2d')!
  
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes: SizeAccess = {
    rowHeights: rowHeights.value,
    colWidths: colWidths.value,
    hiddenRows: hiddenRows.value,
    hiddenCols: hiddenCols.value,
    showGridFlag: showGridLines.value
  }
  
  const gridConfig: GridRenderConfig = {
    containerWidth: w,
    containerHeight: h,
    viewport,
    hoverState,
    totalRows: DEFAULT_ROWS,
    totalCols: DEFAULT_COLS,
    sizes,
    geometryConfig: cfg
  }
  
  renderGrid(ctx, gridConfig)
}

function drawCells(w: number, h: number) {
  const canvas = contentCanvas.value!
  const ctx = canvas.getContext('2d')!
  
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  
  const { startRow, endRow, startCol, endCol } = getVisibleRange(w, h)
  
  const cellsConfig: CellsRenderConfig = {
    containerWidth: w,
    containerHeight: h,
    viewport,
    selected,
    selectionRange,
    dragState,
    formulaReferences: formulaReferences.value,
    sizes,
    geometryConfig: cfg,
    getCellValue: (r, c) => formulaSheet.getFormattedValue(r, c),
    getCellStyle: (r, c) => model.getCellStyle(r, c),
    model: model, // 提供边框访问
    getSelectionRangeText,
    startRow,
    endRow,
    startCol,
    endCol
  }
  
  renderCells(ctx, cellsConfig)
}

function onClick(e: MouseEvent) {
  if (!container.value) return
  
  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()

  const selectionState: SelectionState = {
    selected,
    selectionRange,
    dragState
  }

  const needsRedraw = handleClick({
    x,
    y,
    shiftKey: e.shiftKey,
    containerRect: rect,
    viewport,
    geometryConfig: cfg,
    sizes,
    defaultRows: DEFAULT_ROWS,
    defaultCols: DEFAULT_COLS,
    state: selectionState
  })

  if (needsRedraw) {
    draw()
    // 选择单元格后，聚焦到 IME 代理以接收输入法输入
    focusImeProxy()
  }
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
    
    // 如果不是调整大小，使用选择模块处理行拖拽
    const cfg: GeometryConfig = {
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      rowHeaderWidth: ROW_HEADER_WIDTH,
      colHeaderHeight: COL_HEADER_HEIGHT
    }
    const sizes = createSizeAccess()
    const selectionState: SelectionState = {
      selected,
      selectionRange,
      dragState
    }
    
    startDragSelection({
      x,
      y,
      containerRect: rect,
      viewport,
      geometryConfig: cfg,
      sizes,
      defaultRows: DEFAULT_ROWS,
      defaultCols: DEFAULT_COLS,
      state: selectionState
    })
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
    
    // 如果不是调整大小，使用选择模块处理列拖拽
    const cfg: GeometryConfig = {
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      rowHeaderWidth: ROW_HEADER_WIDTH,
      colHeaderHeight: COL_HEADER_HEIGHT
    }
    const sizes = createSizeAccess()
    const selectionState: SelectionState = {
      selected,
      selectionRange,
      dragState
    }
    
    startDragSelection({
      x,
      y,
      containerRect: rect,
      viewport,
      geometryConfig: cfg,
      sizes,
      defaultRows: DEFAULT_ROWS,
      defaultCols: DEFAULT_COLS,
      state: selectionState
    })
    draw()
    return
  }

  // 点击左上角
  if (x < ROW_HEADER_WIDTH && y < COL_HEADER_HEIGHT) return

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
      
      // 如果点击的是输入框内部
      if (isClickInsideOverlay(x, y, {
        left: inputLeft,
        top: inputTop,
        width: inputRect.width,
        height: inputRect.height
      })) {
        // 不初始化拖拽状态，直接返回
        return
      }
    }
    
    // 如果在公式模式下点击输入框外部，阻止默认行为以保持焦点
    if ((overlayInput.value as any).formulaMode) {
      e.preventDefault()
    }
  }

  // 使用选择模块处理普通单元格拖拽
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  const selectionState: SelectionState = {
    selected,
    selectionRange,
    dragState
  }
  
  startDragSelection({
    x,
    y,
    containerRect: rect,
    viewport,
    geometryConfig: cfg,
    sizes,
    defaultRows: DEFAULT_ROWS,
    defaultCols: DEFAULT_COLS,
    state: selectionState
  })
}

function openOverlay(row: number, col: number, initialValue: string, mode: 'edit' | 'typing' = 'edit') {
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  
  const overlayState = openOverlayHelper(row, col, initialValue, mode, viewport, sizes, cfg)
  Object.assign(overlay, overlayState)
  draw()
}

function onDoubleClick(e: MouseEvent) {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }

  const { shouldOpen } = handleDoubleClickHelper(x, y, cfg)
  if (!shouldOpen) return

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
  // 如果焦点在 IME 代理上，让 IME 代理处理，不要在这里处理普通字符
  if (e.target === imeProxy.value) {
    // 只处理特殊键，普通字符让 imeProxy 的 input 事件处理
    const specialKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', 'F2', 'Delete', 'Backspace']
    if (!specialKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
      return
    }
  }
  
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

  // Handle Ctrl+B (Bold)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    if (selected.row >= 0 && selected.col >= 0) {
      const currentStyle = model.getCellStyle(selected.row, selected.col)
      model.setCellStyle(selected.row, selected.col, { bold: !currentStyle.bold })
      draw()
    }
    return
  }

  // Handle Ctrl+I (Italic)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
    e.preventDefault()
    if (selected.row >= 0 && selected.col >= 0) {
      const currentStyle = model.getCellStyle(selected.row, selected.col)
      model.setCellStyle(selected.row, selected.col, { italic: !currentStyle.italic })
      draw()
    }
    return
  }

  // Handle Ctrl+U (Underline)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
    e.preventDefault()
    if (selected.row >= 0 && selected.col >= 0) {
      const currentStyle = model.getCellStyle(selected.row, selected.col)
      model.setCellStyle(selected.row, selected.col, { underline: !currentStyle.underline })
      draw()
    }
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
    // 如果输入 = 号，进入公式输入模式（值为 =，触发公式模式）
    if (e.key === '=') {
      e.preventDefault()  // 阻止默认，因为我们已经设置了初始值 =
      openOverlay(selected.row, selected.col, '=', 'typing')
    } else {
      // 其他字符，打开空的 overlay
      openOverlay(selected.row, selected.col, '', 'typing')
    }
    // Don't prevent default for other chars - let the key event propagate to the input element
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
    // 移动后聚焦 IME 代理，以便接收输入法输入
    focusImeProxy()
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  
  const w = container.value?.clientWidth ?? 0
  const h = container.value?.clientHeight ?? 0
  
  const changed = handleWheel(e, viewport, {
    containerWidth: w,
    containerHeight: h,
    contentWidth: getTotalContentWidth(),
    contentHeight: getTotalContentHeight(),
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  })
  
  if (changed) {
    draw()
  }
}

function onMouseMove(e: MouseEvent) {
  if (!container.value) return
  
  // 滚动条拖拽优先处理
  if (scrollbar.dragging) {
    const rect = container.value.getBoundingClientRect()
    const changed = handleScrollbarDrag(scrollbar, viewport, { x: e.clientX, y: e.clientY }, {
      containerWidth: rect.width,
      containerHeight: rect.height,
      contentWidth: getTotalContentWidth(),
      contentHeight: getTotalContentHeight(),
      rowHeaderWidth: ROW_HEADER_WIDTH,
      colHeaderHeight: COL_HEADER_HEIGHT
    })
    if (changed) {
      scheduleRedraw()
    }
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

  // 使用选择模块处理单元格拖拽选择
  const cfg: GeometryConfig = {
    defaultRowHeight: ROW_HEIGHT,
    defaultColWidth: COL_WIDTH,
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT
  }
  const sizes = createSizeAccess()
  const selectionState: SelectionState = {
    selected,
    selectionRange,
    dragState
  }

  const changed = updateDragSelection({
    x,
    y,
    containerRect: rect,
    viewport,
    geometryConfig: cfg,
    sizes,
    defaultRows: DEFAULT_ROWS,
    defaultCols: DEFAULT_COLS,
    state: selectionState
  })

  if (changed) {
    scheduleRedraw()
  }
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

  // 使用选择模块结束拖拽（仅处理非 overlay 情况）
  // overlay 相关逻辑保留在下方
  
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
      
      // 重置拖拽状态，避免进入框选模式
      dragState.isDragging = false
      dragState.startRow = -1
      dragState.startCol = -1
      dragState.currentRow = -1
      dragState.currentCol = -1
      dragState.justFinishedDrag = false
      
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
    
    // 重置拖拽状态，避免进入框选模式
    dragState.isDragging = false
    dragState.startRow = -1
    dragState.startCol = -1
    dragState.currentRow = -1
    dragState.currentCol = -1
    dragState.justFinishedDrag = false
    
    // 绘制选择区域的视觉反馈
    draw()
    
    // Clear drag state but keep overlay open for continued editing
    return
  }
  
  // 使用选择模块完成拖拽
  const selectionState: SelectionState = {
    selected,
    selectionRange,
    dragState
  }
  
  const needsRedraw = endDragSelection(selectionState, DEFAULT_COLS)
  if (needsRedraw) {
    draw()
    // 拖拽选择结束后，聚焦 IME 代理
    focusImeProxy()
  }
}

/**
 * 复制选区到剪贴板
 * 支持 Excel 互操作：使用 TSV (Tab-separated values) 格式
 * 复制公式时保留原始文本（显示值，如 =A1+B1）
 */
async function onCopy() {
  const source = {
    getValue: (r: number, c: number) => formulaSheet.getValue(r, c),
    getRawValue: (r: number, c: number) => formulaSheet.getModel().getValue(r, c)
  }

  let result
  
  if (selectionRange.startRow === -1) {
    // 如果没有选区，复制当前单元格
    result = await copySingleCell(selected.row, selected.col, source)
    internalClipboard.startRow = selected.row
    internalClipboard.startCol = selected.col
  } else {
    // 复制选区范围
    const { startRow, startCol, endRow, endCol } = selectionRange
    result = await copyRange(startRow, startCol, endRow, endCol, source)
    internalClipboard.startRow = startRow
    internalClipboard.startCol = startCol
  }
  
  // 保存到内部剪贴板
  internalClipboard.data = result.internalData
  lastCopyTs.value = Date.now()
  
  // 写入系统剪贴板
  const success = await writeToClipboard(result.tsv)
  if (success) {
    console.log('Copied to clipboard (TSV format):', result.tsv.substring(0, 100) + (result.tsv.length > 100 ? '...' : ''))
  }
}

/**
 * 从剪贴板粘贴
 * 支持：
 * 1. 从 Excel 复制的数据（TSV 格式）
 * 2. 从本表复制的数据（包含公式）
 * 3. 自动处理相对/绝对引用（$符号）
 * 4. Excel 行为：无论是否有选区，都从左上角开始粘贴剪贴板数据，然后选中被影响的区域
 */
async function onPaste() {
  // 确定粘贴起始位置：如果有选区，从选区左上角开始；否则从当前单元格开始
  const destStartRow = selectionRange.startRow !== -1 ? selectionRange.startRow : selected.row
  const destStartCol = selectionRange.startCol !== -1 ? selectionRange.startCol : selected.col
  
  const target = {
    setValue: (r: number, c: number, v: string) => formulaSheet.setValue(r, c, v),
    copyCell: (sr: number, sc: number, dr: number, dc: number) => formulaSheet.copyCell(sr, sc, dr, dc)
  }
  
  // 优先使用内部剪贴板（表格内复制，保留公式和引用信息）
  if (internalClipboard.data && isInternalClipboardValid(lastCopyTs.value)) {
    console.log('Pasting from internal clipboard with formula metadata')
    
    const dataHeight = internalClipboard.data.length
    const dataWidth = Math.max(...internalClipboard.data.map(row => row.length))
    
    pasteInternal(
      internalClipboard.data,
      internalClipboard.startRow,
      internalClipboard.startCol,
      destStartRow,
      destStartCol,
      target
    )
    
    // 粘贴后选中所有被影响的单元格
    const pasteEndRow = destStartRow + dataHeight - 1
    const pasteEndCol = destStartCol + dataWidth - 1
    
    selectionRange.startRow = destStartRow
    selectionRange.startCol = destStartCol
    selectionRange.endRow = pasteEndRow
    selectionRange.endCol = pasteEndCol
    
    draw()
    console.log(`Pasted from internal clipboard, selected range: (${destStartRow},${destStartCol}) to (${pasteEndRow},${pasteEndCol})`)
    return
  }
  
  // 从系统剪贴板粘贴（从Excel或外部复制）
  const text = await readFromClipboard()
  if (!text) return
  
  console.log('Pasting text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''))
  
  // 解析剪贴板文本
  const data = parseClipboardText(text)
  
  console.log(`Pasting ${data.length} rows to (${destStartRow}, ${destStartCol})`)
  
  const dataHeight = data.length
  const dataWidth = Math.max(...data.map(row => row.length), 0)
  
  pasteExternal(data, destStartRow, destStartCol, target)
  
  // 粘贴后选中所有被影响的单元格
  const pasteEndRow = destStartRow + dataHeight - 1
  const pasteEndCol = destStartCol + dataWidth - 1
  
  selectionRange.startRow = destStartRow
  selectionRange.startCol = destStartCol
  selectionRange.endRow = pasteEndRow
  selectionRange.endCol = pasteEndCol
  
  draw()
  console.log(`Pasted from clipboard, selected range: (${destStartRow},${destStartCol}) to (${pasteEndRow},${pasteEndCol})`)
}

function onOverlaySave(val: string) {
  const row = overlay.row
  const col = overlay.col
  const oldValue = formulaSheet.getDisplayValue(row, col)
  
  // 检查是否需要进行日期格式转换
  // 即使 oldValue === val，如果输入的是纯数字且格式是日期类型，也需要调用 setValue 进行转换
  const format = formulaSheet.getCellFormat(row, col)
  const isDateFormat = format.type.startsWith('date-') || 
                       format.type.startsWith('time-') || 
                       format.type.startsWith('datetime')
  const isNumericInput = /^\d+(\.\d+)?$/.test(val.trim())
  const needsConversion = isDateFormat && isNumericInput
  
  // Only create undo action if value actually changed or needs conversion
  if (oldValue !== val || needsConversion) {
    undoRedo.execute({
      name: `Edit cell (${row}, ${col})`,
      undo: () => {
        formulaSheet.setValue(row, col, oldValue)
        draw()
      },
      redo: () => {
        formulaSheet.setValue(row, col, val)
        draw()
      }
    })
  }
  
  // 关闭覆盖层
  Object.assign(overlay, closeOverlay())
  formulaReferences.value = []  // 清空引用高亮
  
  // 使用覆盖层模块计算下一个单元格位置
  const nextCell = getNextCellAfterSave(row, col, DEFAULT_ROWS, DEFAULT_COLS)
  selected.row = nextCell.row
  selected.col = nextCell.col
  
  // 清除区域选择
  selectionRange.startRow = -1
  selectionRange.startCol = -1
  selectionRange.endRow = -1
  selectionRange.endCol = -1
  
  draw()
  
  // 编辑完成后，聚焦 IME 代理以便继续输入
  focusImeProxy()
}

function onOverlayCancel() {
  // ESC 取消输入，不保存更改，恢复原值
  Object.assign(overlay, closeOverlay())
  formulaReferences.value = []  // 清空引用高亮
  draw()
  
  // 取消编辑后，聚焦 IME 代理
  focusImeProxy()
}

function onCompositionStart(e: CompositionEvent) {
  // 如果事件来自 IME 代理，由 IME 代理自己的事件处理器处理
  if (e.target === imeProxy.value) {
    return
  }
  
  if (!overlay.visible) {
    if (selected.row < 0 || selected.col < 0) return
    openOverlay(selected.row, selected.col, '', 'typing')
  }
}

// ==================== IME 输入代理处理 ====================

/**
 * 聚焦到 IME 代理输入框
 * 当选择单元格但编辑器未打开时调用，以便接收 IME 输入
 */
function focusImeProxy() {
  if (!imeProxy.value || overlay.visible) return
  
  // 使用 setTimeout 延迟聚焦，等待可能的 dblclick 事件处理完成
  // 这样如果双击打开了编辑器，focusImeProxy 就不会抢夺焦点
  setTimeout(() => {
    // 再次检查，因为在延迟期间可能编辑器已经打开
    if (!imeProxy.value || overlay.visible) return
    
    if (selected.row >= 0 && selected.col >= 0) {
      // 将 imeProxy 定位到当前选中单元格的位置，使输入法候选框显示在正确位置
      const cellX = ROW_HEADER_WIDTH + getColLeft(selected.col) - viewport.scrollLeft
      const cellY = COL_HEADER_HEIGHT + getRowTop(selected.row) - viewport.scrollTop
      const cellWidth = getColWidth(selected.col)
      const cellHeight = getRowHeight(selected.row)
      
      imeProxy.value.style.left = `${cellX + 2}px`  // 加一点内边距
      imeProxy.value.style.top = `${cellY + 2}px`
      imeProxy.value.style.width = `${cellWidth - 4}px`
      imeProxy.value.style.height = `${cellHeight - 4}px`
      
      imeProxy.value.value = ''  // 清空代理输入框
      imeProxy.value.focus()
    }
  }, 50)  // 50ms 延迟，足够让 dblclick 事件先处理
}

/**
 * IME 组合开始事件
 * 当用户开始使用输入法时触发（如开始输入中文拼音）
 */
function onImeCompositionStart(_e: CompositionEvent) {
  imeState.isComposing = true
  imeState.compositionText = ''
  // 不在这里打开编辑器，让 imeProxy 完成整个 IME 组合过程
  // 编辑器将在 compositionend 时打开，带上最终文本
}

/**
 * IME 组合更新事件
 * 当输入法组合文本更新时触发（如拼音变化）
 */
function onImeCompositionUpdate(e: CompositionEvent) {
  // 保存组合文本，用于在 canvas 上显示
  imeState.compositionText = e.data || ''
  // 获取光标位置
  if (imeProxy.value) {
    imeState.cursorPos = imeProxy.value.selectionStart || imeState.compositionText.length
  }
  // 触发重绘以显示组合文本
  draw()
}

/**
 * IME 组合结束事件
 * 当用户确认输入法选择时触发（如选择了一个汉字）
 */
function onImeCompositionEnd(e: CompositionEvent) {
  imeState.isComposing = false
  const finalText = e.data || ''
  
  // 清空代理输入框和组合文本
  if (imeProxy.value) {
    imeProxy.value.value = ''
  }
  imeState.compositionText = ''
  draw()  // 清除 canvas 上的组合文本显示
  
  // 如果有最终文本，打开编辑器并设置初始值
  if (finalText && selected.row >= 0 && selected.col >= 0) {
    if (!overlay.visible) {
      openOverlay(selected.row, selected.col, finalText, 'typing')
      
      // 将光标移到文本末尾
      nextTick(() => {
        if (overlayInput.value) {
          const editor = (overlayInput.value as any).getEditorElement?.()
          if (editor) {
            editor.focus()
            // 将光标移到末尾
            const range = document.createRange()
            const selection = window.getSelection()
            range.selectNodeContents(editor)
            range.collapse(false)
            selection?.removeAllRanges()
            selection?.addRange(range)
          }
        }
      })
    } else {
      // 编辑器已经打开，追加文本
      if (overlayInput.value) {
        const editor = (overlayInput.value as any).getEditorElement?.()
        if (editor) {
          // 在当前位置插入文本
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            range.deleteContents()
            range.insertNode(document.createTextNode(finalText))
            range.collapse(false)
            selection.removeAllRanges()
            selection.addRange(range)
          } else {
            // 没有选区，追加到末尾
            editor.textContent += finalText
          }
        }
      }
    }
  }
}

/**
 * IME 代理输入框的 input 事件
 * 处理非 IME 的直接输入（如英文字符）
 */
function onImeInput(e: Event) {
  // 如果正在 IME 组合中，不处理（由 compositionend 处理）
  if (imeState.isComposing) return
  
  const target = e.target as HTMLTextAreaElement
  const value = target.value
  
  if (value && selected.row >= 0 && selected.col >= 0) {
    // 有输入内容，打开编辑器
    if (!overlay.visible) {
      openOverlay(selected.row, selected.col, value, 'typing')
      
      // 将焦点转移到编辑器
      nextTick(() => {
        if (overlayInput.value) {
          const editor = (overlayInput.value as any).getEditorElement?.()
          if (editor) {
            editor.focus()
            // 将光标移到末尾
            const range = document.createRange()
            const selection = window.getSelection()
            range.selectNodeContents(editor)
            range.collapse(false)
            selection?.removeAllRanges()
            selection?.addRange(range)
          }
        }
      })
    }
    
    // 清空代理
    target.value = ''
  }
}

/**
 * IME 代理输入框的 keydown 事件
 * 处理特殊按键（如方向键、Enter 等）
 */
function onImeKeyDown(e: KeyboardEvent) {
  // 如果正在 IME 组合中
  if (imeState.isComposing) {
    // 左右方向键用于在组合文本中移动光标
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // 等待浏览器处理完方向键后更新光标位置
      setTimeout(() => {
        if (imeProxy.value) {
          imeState.cursorPos = imeProxy.value.selectionStart || 0
          draw()
        }
      }, 0)
    }
    return
  }
  
  // Enter 键：移动到下一行（与 Excel 行为一致）
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault()
    e.stopPropagation()  // 阻止冒泡，避免 window 的 keydown 再次处理
    if (selected.row >= 0 && selected.col >= 0) {
      let newRow = selected.row + 1
      let newCol = selected.col
      if (newRow >= DEFAULT_ROWS) {
        newRow = 0
        newCol = selected.col + 1
        if (newCol >= DEFAULT_COLS) {
          newCol = DEFAULT_COLS - 1
        }
      }
      selected.row = newRow
      selected.col = newCol
      // 清除选区
      selectionRange.startRow = newRow
      selectionRange.startCol = newCol
      selectionRange.endRow = newRow
      selectionRange.endCol = newCol
      ensureVisible(newRow, newCol)
      draw()
    }
    return
  }
  
  // F2 键：打开编辑器
  if (e.key === 'F2') {
    e.preventDefault()
    e.stopPropagation()
    if (selected.row >= 0 && selected.col >= 0 && !overlay.visible) {
      const editValue = formulaSheet.getDisplayValue(selected.row, selected.col)
      openOverlay(selected.row, selected.col, editValue, 'edit')
    }
    return
  }
  
  // Delete 和 Backspace：清空选中单元格
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    e.stopPropagation()
    if (selected.row >= 0 && selected.col >= 0) {
      formulaSheet.setValue(selected.row, selected.col, '')
      draw()
    }
    return
  }
  
  // 方向键、Tab、Escape 等导航键：不在这里处理，让 window 的 keydown 事件自然处理
  // 这样可以避免重复处理导致跳两行/两列的问题
  const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'Home', 'End', 'PageUp', 'PageDown']
  if (navigationKeys.includes(e.key)) {
    // 不做任何处理，让事件冒泡到 window
    return
  }
  
  // Ctrl/Cmd 组合键：不在这里处理，让 window 的 keydown 处理
  if (e.ctrlKey || e.metaKey) {
    return
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
  
  const menuConfig: ContextMenuConfig = {
    rowHeaderWidth: ROW_HEADER_WIDTH,
    colHeaderHeight: COL_HEADER_HEIGHT,
    getRowAtY,
    getColAtX,
    rowOperations: {
      insertRowAbove,
      insertRowBelow,
      deleteRow,
      showSetRowHeightDialog
    },
    colOperations: {
      insertColLeft,
      insertColRight,
      deleteCol,
      showSetColWidthDialog
    }
  }
  
  handleContextMenu(e, rect, menuConfig, contextMenu)
}

// 行操作
async function insertRowAbove(row: number) {
  const rowColConfig: RowColConfig = {
    formulaSheet,
    sizeConfig: {
      rowHeights: rowHeights.value,
      colWidths: colWidths.value,
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      totalRows: DEFAULT_ROWS,
      totalCols: DEFAULT_COLS
    },
    selected,
    onRedraw: draw
  }
  await insertRowAboveHelper(row, rowColConfig)
}

async function insertRowBelow(row: number) {
  const rowColConfig: RowColConfig = {
    formulaSheet,
    sizeConfig: {
      rowHeights: rowHeights.value,
      colWidths: colWidths.value,
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      totalRows: DEFAULT_ROWS,
      totalCols: DEFAULT_COLS
    },
    selected,
    onRedraw: draw
  }
  await insertRowBelowHelper(row, rowColConfig)
}

async function deleteRow(row: number) {
  const rowColConfig: RowColConfig = {
    formulaSheet,
    sizeConfig: {
      rowHeights: rowHeights.value,
      colWidths: colWidths.value,
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      totalRows: DEFAULT_ROWS,
      totalCols: DEFAULT_COLS
    },
    selected,
    onRedraw: draw
  }
  await deleteRowHelper(row, rowColConfig)
}

function showSetRowHeightDialog(row: number) {
  const currentHeight = getRowHeight(row)
  showSetRowHeightDialogHelper(row, currentHeight, rowHeights.value, inputDialog as any, draw)
}

// 列操作
async function insertColLeft(col: number) {
  const rowColConfig: RowColConfig = {
    formulaSheet,
    sizeConfig: {
      rowHeights: rowHeights.value,
      colWidths: colWidths.value,
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      totalRows: DEFAULT_ROWS,
      totalCols: DEFAULT_COLS
    },
    selected,
    onRedraw: draw
  }
  await insertColLeftHelper(col, rowColConfig)
}

async function insertColRight(col: number) {
  const rowColConfig: RowColConfig = {
    formulaSheet,
    sizeConfig: {
      rowHeights: rowHeights.value,
      colWidths: colWidths.value,
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      totalRows: DEFAULT_ROWS,
      totalCols: DEFAULT_COLS
    },
    selected,
    onRedraw: draw
  }
  await insertColRightHelper(col, rowColConfig)
}

async function deleteCol(col: number) {
  const rowColConfig: RowColConfig = {
    formulaSheet,
    sizeConfig: {
      rowHeights: rowHeights.value,
      colWidths: colWidths.value,
      defaultRowHeight: ROW_HEIGHT,
      defaultColWidth: COL_WIDTH,
      totalRows: DEFAULT_ROWS,
      totalCols: DEFAULT_COLS
    },
    selected,
    onRedraw: draw
  }
  await deleteColHelper(col, rowColConfig)
}

function showSetColWidthDialog(col: number) {
  const currentWidth = getColWidth(col)
  showSetColWidthDialogHelper(col, currentWidth, colWidths.value, inputDialog as any, draw)
}

// 输入对话框确认
function onInputDialogConfirm(value: string) {
  handleInputDialogConfirmHelper(value, inputDialog)
}

// 创建事件管理器
const eventManager = createEventManager()

onMounted(() => {
  // Ensure DOM is fully laid out
  window.requestAnimationFrame(() => {
    if (!container.value) return
    console.log('Container size:', container.value.clientWidth, container.value.clientHeight)
    
    // initial draw
    draw()
    
    // 注册所有事件
    const handlers: EventHandlers = {
      onMouseDown,
      onClick,
      onDoubleClick,
      onMouseMove,
      onWheel,
      onMouseUp,
      onKeyDown,
      onResize: draw,
      onCompositionStart,
      onGlobalMouseMove,
      onGlobalMouseUp
    }
    eventManager.register(container.value, handlers)
  })
})

onBeforeUnmount(() => {
  // Cancel pending redraw animation frame
  cancelScheduled()
  
  // 移除所有事件
  eventManager.unregister()
})

function onVThumbMouseDown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  startVerticalDrag(scrollbar, viewport, e.clientY)
}

function onHThumbMouseDown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  startHorizontalDrag(scrollbar, viewport, e.clientX)
}

function onGlobalMouseMove(e: MouseEvent) {
  // 转发到 onMouseMove 的滚动条分支（容器坐标不需要）
  if (!scrollbar.dragging) return
  onMouseMove(e)
}

function onGlobalMouseUp() {
  if (scrollbar.dragging) {
    endDrag(scrollbar)
  }
}

// 创建并暴露公开 API
const api = createSheetAPI({
  // 尺寸相关
  getRowHeight,
  getColWidth,
  rowHeights: rowHeights.value,
  colWidths: colWidths.value,
  
  // 行列操作
  insertRowAbove,
  insertRowBelow,
  deleteRow,
  insertColLeft,
  insertColRight,
  deleteCol,
  
  // 选择相关
  selected,
  selectionRange,
  
  // 单元格值
  getCellValue: (row: number, col: number) => formulaSheet.getValue(row, col),
  setCellValue: (row: number, col: number, value: string) => {
    formulaSheet.setValue(row, col, value)
    draw()
  },
  
  // 样式相关
  getCellStyleFn: (row: number, col: number) => model.getCellStyle(row, col),
  setCellStyleFn: (row: number, col: number, style) => model.setCellStyle(row, col, style),
  clearCellStyleFn: (row: number, col: number) => model.clearCellStyle(row, col),
  setRangeStyleFn: (startRow: number, startCol: number, endRow: number, endCol: number, style) => 
    model.setRangeStyle(startRow, startCol, endRow, endCol, style),
  
  // 边框相关
  getCellBorderFn: (row: number, col: number) => model.getCellBorder(row, col),
  setCellBorderFn: (row: number, col: number, border) => model.setCellBorder(row, col, border),
  clearCellBorderFn: (row: number, col: number) => model.clearCellBorder(row, col),
  setRangeBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number, border) =>
    model.setRangeBorder(startRow, startCol, endRow, endCol, border),
  setRangeOuterBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number, edge) =>
    model.setRangeOuterBorder(startRow, startCol, endRow, endCol, edge),
  clearRangeBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number) =>
    model.clearRangeBorder(startRow, startCol, endRow, endCol),
  
  // 绘制
  draw,
  
  // 隐藏/显示（阶段 14 新增）
  hiddenRows: hiddenRows.value,
  hiddenCols: hiddenCols.value,
  showGridLines: showGridLines.value,
  setShowGridLinesFn: (show: boolean) => {
    showGridLines.value = show
    draw()
  },
  getShowGridLinesFn: () => showGridLines.value,
  
  // 格式相关（支持撤销/重做）
  getCellFormatFn: (row: number, col: number) => formulaSheet.getCellFormat(row, col),
  setCellFormatFn: (row: number, col: number, format) => {
    const oldFormat = model.getCellFormat(row, col)
    undoRedo.execute({
      name: `设置单元格格式 (${row}, ${col})`,
      undo: () => {
        if (oldFormat) {
          model.setCellFormat(row, col, oldFormat)
        } else {
          model.clearCellFormat(row, col)
        }
        draw()
      },
      redo: () => {
        formulaSheet.setCellFormat(row, col, format)
        draw()
      }
    })
  },
  clearCellFormatFn: (row: number, col: number) => {
    const oldFormat = model.getCellFormat(row, col)
    if (oldFormat) {
      undoRedo.execute({
        name: `清除单元格格式 (${row}, ${col})`,
        undo: () => {
          model.setCellFormat(row, col, oldFormat)
          draw()
        },
        redo: () => {
          model.clearCellFormat(row, col)
          draw()
        }
      })
    }
  },
  setRangeFormatFn: (startRow: number, startCol: number, endRow: number, endCol: number, format) => {
    // 保存旧格式
    const oldFormats: Array<{ row: number; col: number; format: CellFormat | undefined }> = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        oldFormats.push({ row: r, col: c, format: model.getCellFormat(r, c) })
      }
    }
    
    undoRedo.execute({
      name: `设置区域格式 (${startRow},${startCol})-(${endRow},${endCol})`,
      undo: () => {
        for (const { row, col, format: oldFormat } of oldFormats) {
          if (oldFormat) {
            model.setCellFormat(row, col, oldFormat)
          } else {
            model.clearCellFormat(row, col)
          }
        }
        draw()
      },
      redo: () => {
        formulaSheet.setRangeFormat(startRow, startCol, endRow, endCol, format)
        draw()
      }
    })
  },
  getFormattedValueFn: (row: number, col: number) => formulaSheet.getFormattedValue(row, col)
})

defineExpose(api)
</script>

<style scoped>
.sheet-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.sheet-container {
  position: relative;
  flex: 1;
  background: var(--sheet-bg, #fff);
  border: 1px solid var(--sheet-border, #ddd);
  overflow: hidden;
}

.grid-canvas,
.content-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: default;  /* 默认指针，不是文本光标 */
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
  background: var(--scrollbar-thumb, rgba(0, 0, 0, 0.25));
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
  background: var(--scrollbar-thumb, rgba(0, 0, 0, 0.25));
  cursor: pointer;
}

.grid-canvas {
  z-index: 10;
}

.content-canvas {
  z-index: 20;
}

/* 隐藏的 IME 输入代理 - 用于捕获中文输入法的首字符
 * 视觉上完全透明，但可以接收焦点和输入
 * 位置会动态设置到当前选中单元格，以便输入法候选框定位正确
 */
.ime-proxy {
  position: absolute;
  padding: 2px 4px;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  color: transparent;  /* 文字透明 */
  font-size: 13px;
  font-family: Arial, sans-serif;
  line-height: 1.4;
  resize: none;
  overflow: hidden;
  white-space: nowrap;
  z-index: 50;
  box-sizing: border-box;
  caret-color: transparent;  /* 光标透明 */
  opacity: 0;  /* 完全不可见 */
  cursor: default;  /* 保持默认指针 */
  pointer-events: none;  /* 不响应鼠标事件，让事件穿透到 canvas */
}

/* 当 textarea 获得焦点时，仍然保持透明，但让输入法能正确工作 */
.ime-proxy:focus {
  opacity: 0;
}

/* 计算进度指示器 */
.calculation-progress {
  position: absolute;
  top: 10px;
  right: 20px;
  z-index: 100;
  background: var(--progress-bg, rgba(255, 255, 255, 0.95));
  border: 1px solid var(--progress-border, #e0e0e0);
  border-radius: 8px;
  padding: 8px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(20px);
    opacity: 0;
  }
}
.progress-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--progress-text, #333);
}

.progress-icon {
  font-size: 16px;
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-detail {
  color: var(--progress-detail, #666);
  font-size: 12px;
}

/* 暗黑模式支持 */
@media (prefers-color-scheme: dark) {
  .sheet-container {
    /* 数据区域保持白色背景 */
    --sheet-border: #404040;
  }
  
  .v-scrollbar-thumb,
  .h-scrollbar-thumb {
    --scrollbar-thumb: rgba(255, 255, 255, 0.25);
  }
  
  .calculation-progress {
    --progress-bg: rgba(30, 30, 30, 0.95);
    --progress-border: #404040;
    --progress-text: #e0e0e0;
    --progress-detail: #b0b0b0;
  }
}
</style>
