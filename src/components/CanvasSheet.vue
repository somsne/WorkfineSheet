<template>
  <div class="sheet-wrapper">
    <div ref="containerRef" class="sheet-container" @contextmenu="handleContextMenuWrapper">
      <canvas ref="gridCanvasRef" class="grid-canvas"></canvas>
      <canvas ref="contentCanvasRef" class="content-canvas"></canvas>
      
      <!-- 隐藏的 IME 输入代理 textarea -->
      <textarea
        ref="imeProxyRef"
        class="ime-proxy"
        @compositionstart="input.onImeCompositionStart"
        @compositionupdate="input.onImeCompositionUpdate"
        @compositionend="input.onImeCompositionEnd"
        @input="input.onImeInput"
        @keydown="handleImeKeyDown"
      ></textarea>
      
      <!-- RichTextInput 富文本编辑器 -->
      <RichTextInput
        ref="overlayInputRef"
        :visible="state.overlay.visible"
        :value="state.overlay.value"
        :row="state.overlay.row"
        :col="state.overlay.col"
        :top="state.overlay.top"
        :left="state.overlay.left"
        :width="state.overlay.width"
        :height="state.overlay.height"
        :mode="state.overlay.mode"
        :is-formula="state.overlay.value.startsWith('=')"
        :cell-style="state.model.getCellStyle(state.overlay.row, state.overlay.col)"
        :formula-references="state.richTextFormulaReferences.value"
        :viewport-width="state.container.value?.clientWidth ?? 800"
        @save="input.onOverlaySave"
        @cancel="input.onOverlayCancel"
        @input-change="state.updateFormulaReferences"
      />
      
      <!-- 垂直滚动条 -->
      <div
        v-if="state.scrollbar.v.visible"
        class="v-scrollbar-track"
        :style="{ top: state.constants.COL_HEADER_HEIGHT + 'px' }"
      >
        <div
          class="v-scrollbar-thumb"
          :style="{ height: state.scrollbar.v.thumbSize + 'px', top: state.scrollbar.v.thumbPos + 'px' }"
          @mousedown="mouse.onVThumbMouseDown"
        ></div>
      </div>
      
      <!-- 水平滚动条 -->
      <div
        v-if="state.scrollbar.h.visible"
        class="h-scrollbar-track"
        :style="{ left: state.constants.ROW_HEADER_WIDTH + 'px' }"
      >
        <div
          class="h-scrollbar-thumb"
          :style="{ width: state.scrollbar.h.thumbSize + 'px', left: state.scrollbar.h.thumbPos + 'px' }"
          @mousedown="mouse.onHThumbMouseDown"
        ></div>
      </div>
      
      <!-- 右键菜单 -->
      <ContextMenu
        :visible="state.contextMenu.visible"
        :x="state.contextMenu.x"
        :y="state.contextMenu.y"
        :items="state.contextMenu.items"
        @close="state.contextMenu.visible = false"
      />
      
      <!-- 输入对话框 -->
      <InputDialog
        :visible="state.inputDialog.visible"
        :title="state.inputDialog.title"
        :default-value="state.inputDialog.defaultValue"
        :placeholder="state.inputDialog.placeholder"
        @confirm="mouse.onInputDialogConfirm"
        @cancel="state.inputDialog.visible = false"
      />
      
      <!-- 单元格图片预览 -->
      <ImagePreview
        :visible="images.imagePreviewState.value.visible"
        :images="images.imagePreviewState.value.images"
        :initial-index="images.imagePreviewState.value.currentIndex"
        @close="images.closeCellImagePreview"
        @remove="images.handleCellImageRemove"
      />
      
      <!-- 计算进度指示器 -->
      <div v-if="state.calculationProgress.visible" class="calculation-progress">
        <div class="progress-content">
          <span class="progress-icon">···</span>
          <span class="progress-text">
            正在计算: {{ state.calculationProgress.pending + state.calculationProgress.processing }} 个公式
          </span>
          <span v-if="state.calculationProgress.completed > 0" class="progress-detail">
            (已完成 {{ state.calculationProgress.completed }})
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { CellFormat, CellStyle, CellBorder, CellImageAlignment, CellImageVerticalAlign } from './sheet/types'
import { createEventManager, type EventHandlers } from './sheet/events'
import { createSheetAPI } from './sheet/api'
import { extractFormats, applyFormats } from './sheet/formatPainter'
import {
  useSheetState,
  useSheetGeometry,
  useSheetDrawing,
  useSheetInput,
  useSheetClipboard,
  useRowColOperations,
  useSheetKeyboard,
  useSheetMouse,
  useFillHandle,
  useSheetImages
} from './sheet/composables'
import { renderFloatingImages } from './sheet/images'
import type { SheetModel } from '../lib/SheetModel'
import type { SheetViewState } from '../lib/Workbook'
import type { WorkbookClipboard } from './sheet/types'
import type { UndoRedoManager } from '../lib/UndoRedoManager'

// @ts-ignore
import RichTextInput from './RichTextInput.vue'
// @ts-ignore
import ContextMenu from './ContextMenu.vue'
// @ts-ignore
import InputDialog from './InputDialog.vue'
// @ts-ignore
import ImagePreview from './ImagePreview.vue'

// ==================== Props ====================
interface Props {
  /** 外部传入的 SheetModel（多工作表模式使用） */
  externalModel?: SheetModel
  /** 外部传入的 UndoRedoManager（多工作表模式使用，所有 Sheet 共享） */
  externalUndoRedo?: UndoRedoManager
  /** 是否跳过演示数据初始化 */
  skipDemoData?: boolean
  /** 初始视图状态（多工作表模式切换时恢复） */
  initialViewState?: SheetViewState
  /** 外部剪贴板（Workbook 层级管理，可选） */
  clipboard?: WorkbookClipboard | null
  /** 当前 Sheet ID（用于判断蚂蚁线显示和 UndoRedo 操作记录） */
  sheetId?: string
}

const props = withDefaults(defineProps<Props>(), {
  externalModel: undefined,
  externalUndoRedo: undefined,
  skipDemoData: false,
  initialViewState: undefined,
  clipboard: undefined,
  sheetId: ''
})

// ==================== Events ====================
const emit = defineEmits<{
  /** 选区变化事件 */
  (e: 'selection-change', payload: {
    selected: { row: number; col: number }
    selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number }
    multiSelection?: { ranges: any[]; active: boolean }
    cellValue: string
    formulaReferences?: any[]
  }): void
  /** 编辑状态变化事件 */
  (e: 'editing-state-change', payload: {
    isEditing: boolean
    editingValue: string
    formulaReferences?: any[]
  }): void
  /** 剪贴板变化事件（复制时触发） */
  (e: 'clipboard-change', clipboard: WorkbookClipboard): void
  /** 剪贴板清除事件（ESC 取消时触发） */
  (e: 'clipboard-clear'): void
  /** 剪切源区域清除事件（跨 Sheet 粘贴时触发） */
  (e: 'cut-source-clear', payload: {
    sourceSheetId: string
    startRow: number
    startCol: number
    height: number
    width: number
  }): void
}>()

// ==================== 初始化状态 ====================
const state = useSheetState({
  externalModel: props.externalModel,
  externalUndoRedo: props.externalUndoRedo,
  skipDemoData: props.skipDemoData
})

// ==================== UndoRedo 包装器（自动添加 sheetId 和选区）====================

/** 受影响区域信息 */
interface AffectedRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

/** 包装后的 UndoRedo 操作类型 */
interface WrappedUndoRedoAction {
  name: string
  undo: () => void
  redo: () => void
  /** 撤销后应选中的区域（如果未提供，将使用执行时的当前选区） */
  undoSelection?: AffectedRange
  /** 重做后应选中的区域（如果未提供，将使用执行时的当前选区） */
  redoSelection?: AffectedRange
}

/**
 * 获取当前选区作为 AffectedRange
 */
function getCurrentSelectionRange(): AffectedRange {
  return {
    startRow: state.selectionRange.startRow,
    startCol: state.selectionRange.startCol,
    endRow: state.selectionRange.endRow,
    endCol: state.selectionRange.endCol
  }
}

/**
 * 包装 undoRedo 操作，自动添加当前 sheetId 和选区信息
 * 这样所有操作都会记录它所属的 Sheet，以及撤销/重做后应该选中的区域
 */
const undoRedoWithSheetId = {
  execute(action: WrappedUndoRedoAction) {
    // 如果没有提供选区信息，使用当前选区
    const currentSelection = getCurrentSelectionRange()
    const sheetId = props.sheetId || undefined
    state.undoRedo.execute({
      ...action,
      sheetId,
      // 撤销后选中操作前的选区（通常就是当前选区）
      undoSelection: action.undoSelection ?? currentSelection,
      // 重做后也选中同样的区域
      redoSelection: action.redoSelection ?? currentSelection
    })
  },
  record(action: WrappedUndoRedoAction) {
    // 如果没有提供选区信息，使用当前选区
    const currentSelection = getCurrentSelectionRange()
    const sheetId = props.sheetId || undefined
    state.undoRedo.record({
      ...action,
      sheetId,
      undoSelection: action.undoSelection ?? currentSelection,
      redoSelection: action.redoSelection ?? currentSelection
    })
  }
}

// ==================== DOM 引用绑定 ====================
const containerRef = ref<HTMLElement | null>(null)
const gridCanvasRef = ref<HTMLCanvasElement | null>(null)
const contentCanvasRef = ref<HTMLCanvasElement | null>(null)
const overlayInputRef = ref<any>(null)
const imeProxyRef = ref<HTMLTextAreaElement | null>(null)

// 将 DOM 引用同步到 state
function syncRefs() {
  state.container.value = containerRef.value
  state.gridCanvas.value = gridCanvasRef.value
  state.contentCanvas.value = contentCanvasRef.value
  state.overlayInput.value = overlayInputRef.value
  state.imeProxy.value = imeProxyRef.value
}

// ==================== 初始化 Composables ====================

// 1. 几何计算 (需要 draw 的占位函数)
let drawFn: () => void = () => {}
const geometry = useSheetGeometry({ 
  state, 
  onDraw: () => drawFn() 
})

// 2. 填充柄 (需要在绘制之前创建)
let scheduleRedrawFn: () => void = () => {}
const fillHandle = useFillHandle({
  getSelectionRange: () => state.selectionRange,
  getViewport: () => state.viewport,
  getGeometryConfig: () => geometry.createGeometryConfig(),
  getSizeAccess: () => geometry.createSizeAccess(),
  getCanvasSize: () => ({
    width: state.container.value?.clientWidth ?? 0,
    height: state.container.value?.clientHeight ?? 0
  }),
  getModel: () => state.model,
  getFormulaSheet: () => state.formulaSheet,
  getUndoRedoManager: () => state.undoRedo,
  getSheetId: () => props.sheetId || undefined,
  totalRows: state.constants.DEFAULT_ROWS,
  totalCols: state.constants.DEFAULT_COLS,
  scheduleRedraw: () => scheduleRedrawFn(),
  updateSelectionRange: (range) => {
    state.selectionRange.startRow = range.startRow
    state.selectionRange.startCol = range.startCol
    state.selectionRange.endRow = range.endRow
    state.selectionRange.endCol = range.endCol
  },
  // 多选状态检查 - 多选激活时隐藏填充柄
  isMultiSelectionActive: () => state.multiSelection.active && state.multiSelection.ranges.length > 0
})

// 3. 绘制 (传入 fillHandle)
const drawing = useSheetDrawing({ state, geometry, fillHandle })
drawFn = drawing.draw
scheduleRedrawFn = drawing.scheduleRedraw

// 4. 输入处理（使用带 sheetId 的 undoRedo 包装器）
const input = useSheetInput({ 
  state, 
  geometry, 
  onDraw: drawing.draw,
  undoRedoExecutor: undoRedoWithSheetId
})

// 5. 剪贴板（支持外部剪贴板模式）
const clipboard = useSheetClipboard({ 
  state, 
  onDraw: drawing.draw,
  // 外部剪贴板：从 props 获取
  externalClipboard: () => props.clipboard ?? null,
  // 剪贴板变化时通知父组件
  onClipboardChange: (clipboardData) => {
    // 填充 sourceSheetId
    clipboardData.sourceSheetId = props.sheetId || null
    emit('clipboard-change', clipboardData)
  },
  // 剪贴板清除时通知父组件
  onClipboardClear: () => {
    emit('clipboard-clear')
  },
  // 跨 Sheet 剪切源清除时通知父组件
  onCutSourceClear: (payload) => {
    emit('cut-source-clear', payload)
  }
})

// 6. 行列操作（使用带 sheetId 的 undoRedo 包装器）
const rowColOps = useRowColOperations({ 
  state, 
  geometry, 
  onDraw: drawing.draw,
  undoRedoExecutor: undoRedoWithSheetId
})

// 7. 键盘处理
const keyboard = useSheetKeyboard({ 
  state, 
  geometry, 
  input, 
  clipboard,
  drawing,
  onDraw: drawing.draw 
})

// 8. 鼠标处理
const mouse = useSheetMouse({ 
  state, 
  geometry, 
  input, 
  rowColOps, 
  onDraw: drawing.draw,
  scheduleRedraw: drawing.scheduleRedraw,
  fillHandle,
  clipboardOps: {
    onCopy: () => clipboard.onCopy(false),
    onCut: () => clipboard.onCopy(true), // onCut 内部调用 onCopy(true)
    onPaste: clipboard.onPaste
  }
})

// 9. 图片处理（使用带 sheetId 的 undoRedo 包装器）
const images = useSheetImages({
  model: state.model,
  undoRedo: state.undoRedo,
  undoRedoExecutor: undoRedoWithSheetId,
  viewport: state.viewport,
  getSizes: () => geometry.createSizeAccess(),
  getGeometryConfig: () => geometry.createGeometryConfig(),
  getContainerWidth: () => state.container.value?.clientWidth ?? 0,
  getContainerHeight: () => state.container.value?.clientHeight ?? 0,
  getContainer: () => state.container.value,
  totalRows: state.constants.DEFAULT_ROWS,
  totalCols: state.constants.DEFAULT_COLS,
  requestDraw: (() => {
    // 使用 requestAnimationFrame 节流，避免高频重绘（如拖动图片时）
    let rafPending = false
    return () => {
      if (!rafPending) {
        rafPending = true
        requestAnimationFrame(() => {
          rafPending = false
          drawing.draw()
        })
      }
    }
  })()
})

// 绘制图片的辅助函数
function drawImages() {
  if (!state.contentCanvas.value) return
  const ctx = state.contentCanvas.value.getContext('2d')
  if (!ctx) return
  
  const allImages = state.model.getAllFloatingImages()
  if (allImages.length === 0) return
  
  renderFloatingImages(
    ctx,
    allImages,
    state.viewport,
    geometry.createSizeAccess(),
    geometry.createGeometryConfig(),
    state.container.value?.clientWidth ?? 0,
    state.container.value?.clientHeight ?? 0,
    images.imageLoader,
    images.selectedImageId.value,
    // 图片加载完成后触发重绘
    () => {
      requestAnimationFrame(() => {
        drawing.draw()
      })
    }
  )
}

// 设置绘制后回调（用于绘制图片）
drawing.setAfterDrawCallback(drawImages)

// ==================== IME KeyDown 包装 ====================
function handleImeKeyDown(e: KeyboardEvent) {
  input.onImeKeyDown(e, { ensureVisible: geometry.ensureVisible })
}

// ==================== 计算队列监听 ====================
state.formulaSheet.onQueueStats((stats) => {
  state.calculationProgress.pending = stats.pending
  state.calculationProgress.processing = stats.processing
  state.calculationProgress.completed = stats.completed
  state.calculationProgress.failed = stats.failed
  state.calculationProgress.visible = stats.pending > 0 || stats.processing > 0
})

state.formulaSheet.onCellStateChange((_row, _col, cellState) => {
  if (cellState.state === 'completed' || cellState.state === 'error') {
    requestAnimationFrame(() => {
      drawing.draw()
    })
  }
})

// ==================== 事件管理 ====================
const eventManager = createEventManager()

// 处理右键菜单，支持图片右键菜单
function handleContextMenuWrapper(e: MouseEvent) {
  const x = e.offsetX
  const y = e.offsetY
  
  // 检查是否右键点击了图片
  const clickedImage = images.getImageAtPoint(x, y)
  if (clickedImage) {
    e.preventDefault()
    // 选中该图片
    images.selectedImageId.value = clickedImage.id
    drawing.draw()
    
    // 显示图片右键菜单
    state.contextMenu.x = e.clientX
    state.contextMenu.y = e.clientY
    state.contextMenu.items = [
      { label: '上移一层', action: () => images.bringSelectedImageForward() },
      { label: '下移一层', action: () => images.sendSelectedImageBackward() },
      { label: '置于顶层', action: () => images.bringSelectedImageToFront() },
      { label: '置于底层', action: () => images.sendSelectedImageToBack() },
      { label: '', action: () => {}, divider: true },
      { label: '删除图片', action: () => images.deleteSelectedImage() }
    ]
    state.contextMenu.visible = true
    return
  }
  
  // 否则使用默认的右键菜单处理
  mouse.onContextMenu(e)
}

onMounted(() => {
  window.requestAnimationFrame(() => {
    syncRefs()
    
    if (!containerRef.value) return
    
    // 恢复初始视图状态（多工作表切换时使用）
    if (props.initialViewState) {
      const vs = props.initialViewState
      state.selected.row = vs.activeCell.row
      state.selected.col = vs.activeCell.col
      state.selectionRange.startRow = vs.selectionRange.startRow
      state.selectionRange.startCol = vs.selectionRange.startCol
      state.selectionRange.endRow = vs.selectionRange.endRow
      state.selectionRange.endCol = vs.selectionRange.endCol
      state.viewport.scrollTop = vs.scrollPosition.scrollTop
      state.viewport.scrollLeft = vs.scrollPosition.scrollLeft
      // 恢复网格线显示状态
      state.showGridLines.value = vs.showGridLines !== false
    } else {
      // 默认选中 A1 单元格
      state.selected.row = 0
      state.selected.col = 0
      state.selectionRange.startRow = 0
      state.selectionRange.startCol = 0
      state.selectionRange.endRow = 0
      state.selectionRange.endCol = 0
    }
    
    drawing.draw()
    
    // 创建包装后的事件处理器，优先处理图片交互
    const wrappedMouseDown = (e: MouseEvent) => {
      // 先尝试浮动图片交互
      if (images.handleImageMouseDown(e)) return
      
      // 检测单元格内嵌图片点击
      const cellImageHit = images.checkCellImageClick(e.offsetX, e.offsetY)
      if (cellImageHit) {
        // 打开图片预览
        images.openCellImagePreview(cellImageHit.row, cellImageHit.col)
        return
      }
      
      // 否则使用默认处理
      mouse.onMouseDown(e)
    }
    
    const wrappedMouseMove = (e: MouseEvent) => {
      // 更新光标样式（如果在图片控制点或图片上）
      const imageCursor = images.getImageCursor(e.offsetX, e.offsetY)
      if (imageCursor && containerRef.value) {
        containerRef.value.style.cursor = imageCursor
        // 图片区域不需要调用默认处理器（避免被覆盖）
        return
      }
      
      // 处理图片拖拽/调整大小
      if (images.handleImageMouseMove(e)) return
      // 否则使用默认处理
      mouse.onMouseMove(e)
    }
    
    const wrappedMouseUp = (_e: MouseEvent) => {
      images.handleImageMouseUp()
      mouse.onMouseUp()
    }
    
    const wrappedGlobalMouseMove = (e: MouseEvent) => {
      // 处理图片拖拽/调整大小（鼠标可能移出容器）
      if (images.handleGlobalImageMouseMove(e)) return
      // 否则使用默认处理
      mouse.onGlobalMouseMove(e)
    }
    
    const wrappedKeyDown = (e: KeyboardEvent) => {
      // 先尝试图片键盘事件
      if (images.handleImageKeyDown(e)) return
      // 否则使用默认处理
      keyboard.onKeyDown(e)
    }
    
    // copy 事件处理器 - 使用 clipboardData.setData 写入剪贴板（更好的 Excel 兼容性）
    const wrappedCopy = (e: ClipboardEvent) => {
      // 如果编辑器正在编辑中，不处理（让编辑器自己处理）
      if (state.overlay.visible) return
      
      // 检查事件是否来自其他输入元素（但允许 imeProxy）
      const target = e.target as HTMLElement
      if (target && target !== state.imeProxy.value) {
        const tagName = target.tagName.toLowerCase()
        const isContentEditable = target.isContentEditable
        if (tagName === 'input' || tagName === 'textarea' || isContentEditable) {
          return
        }
      }
      
      // 使用 clipboardEvent 写入剪贴板
      clipboard.onCopy(false, e)
      // 启动蚂蚁线动画
      drawing.startMarchingAntsAnimation()
    }
    
    // cut 事件处理器 - 使用 clipboardData.setData 写入剪贴板（更好的 Excel 兼容性）
    const wrappedCut = (e: ClipboardEvent) => {
      // 如果编辑器正在编辑中，不处理（让编辑器自己处理）
      if (state.overlay.visible) return
      
      // 检查事件是否来自其他输入元素（但允许 imeProxy）
      const target = e.target as HTMLElement
      if (target && target !== state.imeProxy.value) {
        const tagName = target.tagName.toLowerCase()
        const isContentEditable = target.isContentEditable
        if (tagName === 'input' || tagName === 'textarea' || isContentEditable) {
          return
        }
      }
      
      // 使用 clipboardEvent 写入剪贴板
      clipboard.onCut(e)
      // 启动蚂蚁线动画
      drawing.startMarchingAntsAnimation()
    }
    
    // paste 事件处理器 - 从剪贴板事件获取文本和 HTML
    const wrappedPaste = (e: ClipboardEvent) => {
      // 如果编辑器正在编辑中，不处理（让编辑器自己处理）
      if (state.overlay.visible) return
      
      // 从 ClipboardEvent 获取文本和 HTML
      const text = e.clipboardData?.getData('text/plain') || ''
      const html = e.clipboardData?.getData('text/html') || ''
      
      if (text || html || clipboard.hasInternalClipboard()) {
        e.preventDefault() // 阻止默认粘贴行为
        clipboard.onPaste(text || undefined, html || undefined)
      }
    }
    
    const handlers: EventHandlers = {
      onMouseDown: wrappedMouseDown,
      onClick: mouse.onClick,
      onDoubleClick: mouse.onDoubleClick,
      onMouseMove: wrappedMouseMove,
      onWheel: mouse.onWheel,
      onMouseUp: wrappedMouseUp,
      onKeyDown: wrappedKeyDown,
      onCopy: wrappedCopy,
      onCut: wrappedCut,
      onPaste: wrappedPaste,
      onResize: drawing.draw,
      onCompositionStart: input.onCompositionStart,
      onGlobalMouseMove: wrappedGlobalMouseMove,
      onGlobalMouseUp: mouse.onGlobalMouseUp
    }
    eventManager.register(containerRef.value, handlers)
  })
  
  // 监听主题切换
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        drawing.draw()
        break
      }
    }
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  ;(window as any).__sheetThemeObserver = observer
})

onBeforeUnmount(() => {
  drawing.cancelScheduled()
  eventManager.unregister()
  
  const observer = (window as any).__sheetThemeObserver
  if (observer) {
    observer.disconnect()
    delete (window as any).__sheetThemeObserver
  }
})

// ==================== 事件发射 ====================

/** 发射选区变化事件 */
function emitSelectionChange() {
  const row = state.selectionRange.startRow
  const col = state.selectionRange.startCol
  emit('selection-change', {
    selected: { row: state.selected.row, col: state.selected.col },
    selectionRange: { ...state.selectionRange },
    multiSelection: state.multiSelection.active ? {
      ranges: [...state.multiSelection.ranges],
      active: true
    } : undefined,
    cellValue: state.model.getValue(row, col) ?? '',
    formulaReferences: state.richTextFormulaReferences.value
  })
}

/** 发射编辑状态变化事件 */
function emitEditingStateChange() {
  emit('editing-state-change', {
    isEditing: state.overlay.visible,
    editingValue: state.overlay.value,
    formulaReferences: state.richTextFormulaReferences.value
  })
}

// ==================== 状态变化监听 ====================

// 监听选区变化（选中单元格/范围）
watch(
  () => [
    state.selectionRange.startRow,
    state.selectionRange.startCol,
    state.selectionRange.endRow,
    state.selectionRange.endCol,
    state.selected.row,
    state.selected.col
  ],
  () => {
    emitSelectionChange()
  }
)

// 监听编辑状态变化
watch(
  () => [state.overlay.visible, state.overlay.value],
  () => {
    emitEditingStateChange()
  }
)

// 监听公式引用变化
watch(
  () => state.richTextFormulaReferences.value,
  () => {
    if (state.overlay.visible) {
      emitEditingStateChange()
    }
  },
  { deep: true }
)

// 监听外部剪贴板变化，同步蚂蚁线显示
watch(
  () => props.clipboard,
  (newClipboard) => {
    if (newClipboard && newClipboard.copyRange) {
      // 只有当前 Sheet 是复制源时才显示蚂蚁线
      const isSourceSheet = newClipboard.sourceSheetId === props.sheetId
      if (isSourceSheet) {
        clipboard.syncCopyRangeFromExternal(newClipboard.copyRange)
        // 重新启动蚂蚁线动画
        drawing.startMarchingAntsAnimation()
      } else {
        // 不是源 Sheet，隐藏蚂蚁线
        clipboard.syncCopyRangeFromExternal(null)
        drawing.stopMarchingAntsAnimation()
      }
    } else {
      // 剪贴板被清除，隐藏蚂蚁线
      clipboard.syncCopyRangeFromExternal(null)
      drawing.stopMarchingAntsAnimation()
    }
    drawing.draw()
  },
  { deep: true, immediate: true }
)

// ==================== API 创建 ====================
const api = createSheetAPI({
  // 尺寸相关
  getRowHeight: geometry.getRowHeight,
  getColWidth: geometry.getColWidth,
  rowHeights: state.rowHeights.value,
  colWidths: state.colWidths.value,
  manualRowHeights: state.manualRowHeights.value,
  
  // 行列操作
  insertRowAbove: rowColOps.insertRowAbove,
  insertRowBelow: rowColOps.insertRowBelow,
  deleteRow: rowColOps.deleteRow,
  insertColLeft: rowColOps.insertColLeft,
  insertColRight: rowColOps.insertColRight,
  deleteCol: rowColOps.deleteCol,
  
  // 选择相关
  selected: state.selected,
  selectionRange: state.selectionRange,
  
  // 单元格值
  getCellValue: (row: number, col: number) => state.formulaSheet.getValue(row, col),
  setCellValue: (row: number, col: number, value: string) => {
    state.formulaSheet.setValue(row, col, value)
    drawing.draw()
  },
  
  // 样式相关（支持撤销/重做）
  getCellStyleFn: (row: number, col: number) => state.model.getCellStyle(row, col),
  setCellStyleFn: (row: number, col: number, style) => {
    const oldStyle = { ...state.model.getCellStyle(row, col) }
    undoRedoWithSheetId.execute({
      name: `设置单元格样式 (${row}, ${col})`,
      undo: () => {
        state.model.clearCellStyle(row, col)
        if (Object.keys(oldStyle).length > 0) {
          state.model.setCellStyle(row, col, oldStyle)
        }
        drawing.draw()
      },
      redo: () => {
        state.model.setCellStyle(row, col, style)
        drawing.draw()
      }
    })
  },
  clearCellStyleFn: (row: number, col: number) => {
    const oldStyle = { ...state.model.getCellStyle(row, col) }
    if (Object.keys(oldStyle).length > 0) {
      undoRedoWithSheetId.execute({
        name: `清除单元格样式 (${row}, ${col})`,
        undo: () => {
          state.model.setCellStyle(row, col, oldStyle)
          drawing.draw()
        },
        redo: () => {
          state.model.clearCellStyle(row, col)
          drawing.draw()
        }
      })
    }
  },
  setRangeStyleFn: (startRow: number, startCol: number, endRow: number, endCol: number, style) => {
    const maxRows = state.constants.DEFAULT_ROWS
    const maxCols = state.constants.DEFAULT_COLS
    
    // 检测是否为整列选择（startRow=0, endRow=maxRows-1）
    const isFullColumn = startRow === 0 && endRow === maxRows - 1
    // 检测是否为整行选择（startCol=0, endCol=maxCols-1）
    const isFullRow = startCol === 0 && endCol === maxCols - 1
    
    if (isFullColumn && !isFullRow) {
      // 整列选择：使用列样式
      const oldColStyles: Array<{ col: number; style: CellStyle | undefined }> = []
      for (let c = startCol; c <= endCol; c++) {
        oldColStyles.push({ col: c, style: state.model.getColStyle(c) })
      }
      
      undoRedoWithSheetId.execute({
        name: `设置列样式 (${startCol}-${endCol})`,
        undo: () => {
          for (const { col, style: oldStyle } of oldColStyles) {
            state.model.clearColStyle(col)
            if (oldStyle) {
              state.model.setColStyle(col, oldStyle)
            }
          }
          drawing.draw()
        },
        redo: () => {
          for (let c = startCol; c <= endCol; c++) {
            state.model.setColStyle(c, style)
          }
          drawing.draw()
        }
      })
    } else if (isFullRow && !isFullColumn) {
      // 整行选择：使用行样式
      const oldRowStyles: Array<{ row: number; style: CellStyle | undefined }> = []
      for (let r = startRow; r <= endRow; r++) {
        oldRowStyles.push({ row: r, style: state.model.getRowStyle(r) })
      }
      
      undoRedoWithSheetId.execute({
        name: `设置行样式 (${startRow}-${endRow})`,
        undo: () => {
          for (const { row, style: oldStyle } of oldRowStyles) {
            state.model.clearRowStyle(row)
            if (oldStyle) {
              state.model.setRowStyle(row, oldStyle)
            }
          }
          drawing.draw()
        },
        redo: () => {
          for (let r = startRow; r <= endRow; r++) {
            state.model.setRowStyle(r, style)
          }
          drawing.draw()
        }
      })
    } else {
      // 普通选区：使用单元格样式
      const oldStyles: Array<{ row: number; col: number; style: CellStyle }> = []
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          oldStyles.push({ row: r, col: c, style: { ...state.model.getCellStyle(r, c) } })
        }
      }
      
      undoRedoWithSheetId.execute({
        name: `设置区域样式 (${startRow},${startCol})-(${endRow},${endCol})`,
        undo: () => {
          for (const { row, col, style: oldStyle } of oldStyles) {
            state.model.clearCellStyle(row, col)
            if (Object.keys(oldStyle).length > 0) {
              state.model.setCellStyle(row, col, oldStyle)
            }
          }
          drawing.draw()
        },
        redo: () => {
          state.model.setRangeStyle(startRow, startCol, endRow, endCol, style)
          drawing.draw()
        }
      })
    }
  },
  
  // 边框相关（支持撤销/重做）
  getCellBorderFn: (row: number, col: number) => state.model.getCellBorder(row, col),
  setCellBorderFn: (row: number, col: number, border) => {
    const oldBorder = state.model.getCellBorder(row, col)
    undoRedoWithSheetId.execute({
      name: `设置单元格边框 (${row}, ${col})`,
      undo: () => {
        state.model.clearCellBorder(row, col)
        if (oldBorder) {
          state.model.setCellBorder(row, col, oldBorder)
        }
        drawing.draw()
      },
      redo: () => {
        state.model.setCellBorder(row, col, border)
        drawing.draw()
      }
    })
  },
  clearCellBorderFn: (row: number, col: number) => {
    const oldBorder = state.model.getCellBorder(row, col)
    if (oldBorder) {
      undoRedoWithSheetId.execute({
        name: `清除单元格边框 (${row}, ${col})`,
        undo: () => {
          state.model.setCellBorder(row, col, oldBorder)
          drawing.draw()
        },
        redo: () => {
          state.model.clearCellBorder(row, col)
          drawing.draw()
        }
      })
    }
  },
  setRangeBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number, border) => {
    const oldBorders: Array<{ row: number; col: number; border: CellBorder | undefined }> = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        oldBorders.push({ row: r, col: c, border: state.model.getCellBorder(r, c) })
      }
    }
    
    undoRedoWithSheetId.execute({
      name: `设置区域边框 (${startRow},${startCol})-(${endRow},${endCol})`,
      undo: () => {
        for (const { row, col, border: oldBorder } of oldBorders) {
          state.model.clearCellBorder(row, col)
          if (oldBorder) {
            state.model.setCellBorder(row, col, oldBorder)
          }
        }
        drawing.draw()
      },
      redo: () => {
        state.model.setRangeBorder(startRow, startCol, endRow, endCol, border)
        drawing.draw()
      }
    })
  },
  setRangeOuterBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number, edge) => {
    const oldBorders: Array<{ row: number; col: number; border: CellBorder | undefined }> = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        oldBorders.push({ row: r, col: c, border: state.model.getCellBorder(r, c) })
      }
    }
    
    undoRedoWithSheetId.execute({
      name: `设置区域外边框 (${startRow},${startCol})-(${endRow},${endCol})`,
      undo: () => {
        for (const { row, col, border: oldBorder } of oldBorders) {
          state.model.clearCellBorder(row, col)
          if (oldBorder) {
            state.model.setCellBorder(row, col, oldBorder)
          }
        }
        drawing.draw()
      },
      redo: () => {
        state.model.setRangeOuterBorder(startRow, startCol, endRow, endCol, edge)
        drawing.draw()
      }
    })
  },
  clearRangeBorderFn: (startRow: number, startCol: number, endRow: number, endCol: number) => {
    const oldBorders: Array<{ row: number; col: number; border: CellBorder | undefined }> = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const border = state.model.getCellBorder(r, c)
        if (border) {
          oldBorders.push({ row: r, col: c, border })
        }
      }
    }
    
    if (oldBorders.length > 0) {
      undoRedoWithSheetId.execute({
        name: `清除区域边框 (${startRow},${startCol})-(${endRow},${endCol})`,
        undo: () => {
          for (const { row, col, border } of oldBorders) {
            if (border) {
              state.model.setCellBorder(row, col, border)
            }
          }
          drawing.draw()
        },
        redo: () => {
          state.model.clearRangeBorder(startRow, startCol, endRow, endCol)
          drawing.draw()
        }
      })
    }
  },
  
  // 绘制
  draw: drawing.draw,
  
  // 隐藏/显示
  hiddenRows: state.hiddenRows.value,
  hiddenCols: state.hiddenCols.value,
  showGridLines: state.showGridLines.value,
  setShowGridLinesFn: (show: boolean) => {
    state.showGridLines.value = show
    drawing.draw()
  },
  getShowGridLinesFn: () => state.showGridLines.value,
  
  // 格式相关（支持撤销/重做）
  getCellFormatFn: (row: number, col: number) => state.formulaSheet.getCellFormat(row, col),
  setCellFormatFn: (row: number, col: number, format) => {
    const oldFormat = state.model.getCellFormat(row, col)
    undoRedoWithSheetId.execute({
      name: `设置单元格格式 (${row}, ${col})`,
      undo: () => {
        if (oldFormat) {
          state.model.setCellFormat(row, col, oldFormat)
        } else {
          state.model.clearCellFormat(row, col)
        }
        drawing.draw()
      },
      redo: () => {
        state.formulaSheet.setCellFormat(row, col, format)
        drawing.draw()
      }
    })
  },
  clearCellFormatFn: (row: number, col: number) => {
    const oldFormat = state.model.getCellFormat(row, col)
    if (oldFormat) {
      undoRedoWithSheetId.execute({
        name: `清除单元格格式 (${row}, ${col})`,
        undo: () => {
          state.model.setCellFormat(row, col, oldFormat)
          drawing.draw()
        },
        redo: () => {
          state.model.clearCellFormat(row, col)
          drawing.draw()
        }
      })
    }
  },
  setRangeFormatFn: (startRow: number, startCol: number, endRow: number, endCol: number, format) => {
    const maxRows = state.constants.DEFAULT_ROWS
    const maxCols = state.constants.DEFAULT_COLS
    
    // 检测是否为整列选择
    const isFullColumn = startRow === 0 && endRow === maxRows - 1
    // 检测是否为整行选择
    const isFullRow = startCol === 0 && endCol === maxCols - 1
    
    if (isFullColumn && !isFullRow) {
      // 整列选择：使用列格式
      const oldColFormats: Array<{ col: number; format: CellFormat | undefined }> = []
      for (let c = startCol; c <= endCol; c++) {
        oldColFormats.push({ col: c, format: state.model.getColFormat(c) })
      }
      
      undoRedoWithSheetId.execute({
        name: `设置列格式 (${startCol}-${endCol})`,
        undo: () => {
          for (const { col, format: oldFormat } of oldColFormats) {
            state.model.clearColFormat(col)
            if (oldFormat) {
              state.model.setColFormat(col, oldFormat)
            }
          }
          drawing.draw()
        },
        redo: () => {
          for (let c = startCol; c <= endCol; c++) {
            state.model.setColFormat(c, format)
          }
          drawing.draw()
        }
      })
    } else if (isFullRow && !isFullColumn) {
      // 整行选择：使用行格式
      const oldRowFormats: Array<{ row: number; format: CellFormat | undefined }> = []
      for (let r = startRow; r <= endRow; r++) {
        oldRowFormats.push({ row: r, format: state.model.getRowFormat(r) })
      }
      
      undoRedoWithSheetId.execute({
        name: `设置行格式 (${startRow}-${endRow})`,
        undo: () => {
          for (const { row, format: oldFormat } of oldRowFormats) {
            state.model.clearRowFormat(row)
            if (oldFormat) {
              state.model.setRowFormat(row, oldFormat)
            }
          }
          drawing.draw()
        },
        redo: () => {
          for (let r = startRow; r <= endRow; r++) {
            state.model.setRowFormat(r, format)
          }
          drawing.draw()
        }
      })
    } else {
      // 普通选区：使用单元格格式
      const oldFormats: Array<{ row: number; col: number; format: CellFormat | undefined }> = []
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          oldFormats.push({ row: r, col: c, format: state.model.getCellFormat(r, c) })
        }
      }
      
      undoRedoWithSheetId.execute({
        name: `设置区域格式 (${startRow},${startCol})-(${endRow},${endCol})`,
        undo: () => {
          for (const { row, col, format: oldFormat } of oldFormats) {
            if (oldFormat) {
              state.model.setCellFormat(row, col, oldFormat)
            } else {
              state.model.clearCellFormat(row, col)
            }
          }
          drawing.draw()
        },
        redo: () => {
          state.formulaSheet.setRangeFormat(startRow, startCol, endRow, endCol, format)
          drawing.draw()
        }
      })
    }
  },
  getFormattedValueFn: (row: number, col: number) => state.formulaSheet.getFormattedValue(row, col),
  
  // 合并单元格相关（支持撤销/重做）
  mergeCellsFn: (startRow: number, startCol: number, endRow: number, endCol: number) => {
    if (!state.model.canMerge(startRow, startCol, endRow, endCol)) {
      return false
    }
    const cellValues: Array<{ row: number; col: number; value: string }> = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const value = state.model.getValue(r, c)
        if (value) {
          cellValues.push({ row: r, col: c, value })
        }
      }
    }
    
    const mergeResult = state.model.mergeCells(startRow, startCol, endRow, endCol)
    if (!mergeResult) {
      return false
    }
    
    state.formulaSheet.clearFormulaCache()
    
    undoRedoWithSheetId.record({
      name: `合并单元格 (${startRow},${startCol})-(${endRow},${endCol})`,
      undo: () => {
        state.model.unmergeCells(startRow, startCol)
        for (const { row, col, value } of cellValues) {
          state.model.setValue(row, col, value)
        }
        state.formulaSheet.clearFormulaCache()
        drawing.draw()
      },
      redo: () => {
        state.model.mergeCells(startRow, startCol, endRow, endCol)
        state.formulaSheet.clearFormulaCache()
        drawing.draw()
      }
    })
    
    drawing.draw()
    return true
  },
  unmergeCellsFn: (row: number, col: number) => {
    const region = state.model.getMergedRegion(row, col)
    if (!region) {
      return null
    }
    const masterValue = state.model.getValue(region.startRow, region.startCol)
    
    state.model.unmergeCells(row, col)
    state.formulaSheet.clearFormulaCache()
    
    undoRedoWithSheetId.record({
      name: `取消合并 (${region.startRow},${region.startCol})-(${region.endRow},${region.endCol})`,
      undo: () => {
        state.model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
        if (masterValue) {
          state.model.setValue(region.startRow, region.startCol, masterValue)
        }
        state.formulaSheet.clearFormulaCache()
        drawing.draw()
      },
      redo: () => {
        state.model.unmergeCells(region.startRow, region.startCol)
        state.formulaSheet.clearFormulaCache()
        drawing.draw()
      }
    })
    
    drawing.draw()
    return region
  },
  canMergeFn: (startRow: number, startCol: number, endRow: number, endCol: number) => 
    state.model.canMerge(startRow, startCol, endRow, endCol),
  getMergedCellInfoFn: (row: number, col: number) => state.model.getMergedCellInfo(row, col),
  getMergedRegionFn: (row: number, col: number) => state.model.getMergedRegion(row, col),
  getAllMergedRegionsFn: () => state.model.getAllMergedRegions(),
  hasDataToLoseFn: (startRow: number, startCol: number, endRow: number, endCol: number) => 
    state.model.hasDataToLose(startRow, startCol, endRow, endCol),
  
  // 撤销还原相关
  undoFn: () => state.undoRedo.undo() !== null,
  redoFn: () => state.undoRedo.redo() !== null,
  canUndoFn: () => state.undoRedo.canUndo(),
  canRedoFn: () => state.undoRedo.canRedo(),
  
  // 图片相关
  insertImageFn: (file: File) => images.insertImage(file),
  insertImageFromUrlFn: (url: string, width?: number, height?: number) => images.insertImageFromUrl(url, width, height),
  deleteImageFn: (imageId: string) => {
    const image = state.model.getFloatingImage(imageId)
    if (image) {
      state.model.deleteFloatingImage(imageId)
      if (images.selectedImageId.value === imageId) {
        images.selectedImageId.value = null
      }
    }
  },
  getAllImagesFn: () => {
    return state.model.getAllFloatingImages().map(img => ({
      id: img.id,
      src: img.src,
      width: img.width,
      height: img.height,
      anchorRow: img.anchorRow,
      anchorCol: img.anchorCol
    }))
  },
  getSelectedImageIdFn: () => images.selectedImageId.value,
  selectImageFn: (imageId: string) => {
    images.selectedImageId.value = imageId
  },
  clearImageSelectionFn: () => images.clearImageSelection(),
  
  // 格式刷相关
  getFormatPainterModeFn: () => state.formatPainter.mode,
  startFormatPainterFn: () => {
    // 获取当前选区
    const { startRow, startCol, endRow, endCol } = state.selectionRange
    if (startRow < 0 || startCol < 0) {
      // 没有选区时使用当前单元格
      if (state.selected.row < 0 || state.selected.col < 0) return
      const r = state.selected.row
      const c = state.selected.col
      
      // 提取格式
      state.formatPainter.data = extractFormats(
        r, c, r, c,
        (row, col) => state.model.getCellStyle(row, col),
        (row, col) => state.model.getCellBorder(row, col),
        (row, col) => state.model.getCellFormat(row, col),
        {
          getMergedRegion: (row, col) => state.model.getMergedRegion(row, col)
        }
      )
    } else {
      const maxRows = state.constants.DEFAULT_ROWS
      const maxCols = state.constants.DEFAULT_COLS
      const isFullRow = startCol === 0 && endCol === maxCols - 1
      const isFullColumn = startRow === 0 && endRow === maxRows - 1
      
      // 提取格式
      state.formatPainter.data = extractFormats(
        startRow, startCol, endRow, endCol,
        (row, col) => state.model.getCellStyle(row, col),
        (row, col) => state.model.getCellBorder(row, col),
        (row, col) => state.model.getCellFormat(row, col),
        {
          isFullRow,
          isFullColumn,
          getRowStyle: (row) => state.model.getRowStyle(row),
          getColStyle: (col) => state.model.getColStyle(col),
          getRowFormat: (row) => state.model.getRowFormat(row),
          getColFormat: (col) => state.model.getColFormat(col),
          getMergedRegion: (row, col) => state.model.getMergedRegion(row, col)
        }
      )
    }
    state.formatPainter.mode = 'single'
  },
  startFormatPainterContinuousFn: () => {
    // 与单次模式相同，但设置为连续模式
    const { startRow, startCol, endRow, endCol } = state.selectionRange
    if (startRow < 0 || startCol < 0) {
      if (state.selected.row < 0 || state.selected.col < 0) return
      const r = state.selected.row
      const c = state.selected.col
      
      state.formatPainter.data = extractFormats(
        r, c, r, c,
        (row, col) => state.model.getCellStyle(row, col),
        (row, col) => state.model.getCellBorder(row, col),
        (row, col) => state.model.getCellFormat(row, col),
        {
          getMergedRegion: (row, col) => state.model.getMergedRegion(row, col)
        }
      )
    } else {
      const maxRows = state.constants.DEFAULT_ROWS
      const maxCols = state.constants.DEFAULT_COLS
      const isFullRow = startCol === 0 && endCol === maxCols - 1
      const isFullColumn = startRow === 0 && endRow === maxRows - 1
      
      state.formatPainter.data = extractFormats(
        startRow, startCol, endRow, endCol,
        (row, col) => state.model.getCellStyle(row, col),
        (row, col) => state.model.getCellBorder(row, col),
        (row, col) => state.model.getCellFormat(row, col),
        {
          isFullRow,
          isFullColumn,
          getRowStyle: (row) => state.model.getRowStyle(row),
          getColStyle: (col) => state.model.getColStyle(col),
          getRowFormat: (row) => state.model.getRowFormat(row),
          getColFormat: (col) => state.model.getColFormat(col),
          getMergedRegion: (row, col) => state.model.getMergedRegion(row, col)
        }
      )
    }
    state.formatPainter.mode = 'continuous'
  },
  stopFormatPainterFn: () => {
    state.formatPainter.mode = 'off'
    state.formatPainter.data = null
  },
  applyFormatPainterFn: () => {
    if (!state.formatPainter.data || state.formatPainter.mode === 'off') return
    
    // 获取目标选区
    let targetStartRow: number, targetStartCol: number, targetEndRow: number, targetEndCol: number
    
    const { startRow, startCol, endRow, endCol } = state.selectionRange
    if (startRow >= 0 && startCol >= 0) {
      targetStartRow = startRow
      targetStartCol = startCol
      targetEndRow = endRow
      targetEndCol = endCol
    } else if (state.selected.row >= 0 && state.selected.col >= 0) {
      targetStartRow = state.selected.row
      targetStartCol = state.selected.col
      targetEndRow = state.selected.row
      targetEndCol = state.selected.col
    } else {
      return
    }
    
    // 应用格式
    applyFormats(
      state.formatPainter.data,
      targetStartRow, targetStartCol, targetEndRow, targetEndCol,
      (row, col, style) => state.model.setCellStyle(row, col, style),
      (row, col, border) => state.model.setCellBorder(row, col, border),
      (row, col) => state.model.clearCellBorder(row, col),
      (row, col, format) => state.model.setCellFormat(row, col, format),
      {
        setRowStyle: (row, style) => state.model.setRowStyle(row, style),
        setColStyle: (col, style) => state.model.setColStyle(col, style),
        setRowFormat: (row, format) => state.model.setRowFormat(row, format),
        setColFormat: (col, format) => state.model.setColFormat(col, format),
        getMergedRegion: (row, col) => state.model.getMergedRegion(row, col),
        mergeCells: (r1, c1, r2, c2) => state.model.mergeCells(r1, c1, r2, c2),
        unmergeCells: (row, col) => state.model.unmergeCells(row, col) !== null
      }
    )
    
    // 如果是单次模式，应用后退出
    if (state.formatPainter.mode === 'single') {
      state.formatPainter.mode = 'off'
      state.formatPainter.data = null
    }
    
    drawing.draw()
  },
  
  // 单元格内嵌图片相关
  insertCellImageFn: async (file: File, row?: number, col?: number) => {
    const targetRow = row ?? state.selected.row
    const targetCol = col ?? state.selected.col
    if (targetRow < 0 || targetCol < 0) return null
    return images.insertCellImage(targetRow, targetCol, file)
  },
  insertCellImageFromUrlFn: async (url: string, row?: number, col?: number) => {
    const targetRow = row ?? state.selected.row
    const targetCol = col ?? state.selected.col
    if (targetRow < 0 || targetCol < 0) return null
    return images.insertCellImageFromUrl(targetRow, targetCol, url)
  },
  getCellImagesFn: (row: number, col: number) => state.model.getCellImages(row, col),
  getCellDisplayImageFn: (row: number, col: number) => state.model.getCellDisplayImage(row, col) ?? null,
  getCellImageCountFn: (row: number, col: number) => state.model.getCellImageCount(row, col),
  removeCellImageFn: (row: number, col: number, imageId: string) => images.removeCellImage(row, col, imageId),
  clearCellImagesFn: (row: number, col: number) => images.clearCellImages(row, col),
  updateCellImageAlignmentFn: (row: number, col: number, imageId: string, horizontalAlign?: CellImageAlignment, verticalAlign?: CellImageVerticalAlign) => {
    images.updateCellImageAlignment(row, col, imageId, horizontalAlign, verticalAlign)
  },
  openCellImagePreviewFn: (row: number, col: number) => images.openCellImagePreview(row, col),
  closeCellImagePreviewFn: () => images.closeCellImagePreview()
})

// ==================== 添加视图状态相关方法到 API ====================

/** 获取当前视图状态（用于多工作表切换时保存） */
function getViewState(): SheetViewState {
  return {
    activeCell: { row: state.selected.row, col: state.selected.col },
    selectionRange: {
      startRow: state.selectionRange.startRow,
      startCol: state.selectionRange.startCol,
      endRow: state.selectionRange.endRow,
      endCol: state.selectionRange.endCol
    },
    scrollPosition: {
      scrollTop: state.viewport.scrollTop,
      scrollLeft: state.viewport.scrollLeft
    },
    showGridLines: state.showGridLines.value
  }
}

/** 设置视图状态（用于多工作表切换时恢复） */
function setViewState(viewState: SheetViewState) {
  state.selected.row = viewState.activeCell.row
  state.selected.col = viewState.activeCell.col
  state.selectionRange.startRow = viewState.selectionRange.startRow
  state.selectionRange.startCol = viewState.selectionRange.startCol
  state.selectionRange.endRow = viewState.selectionRange.endRow
  state.selectionRange.endCol = viewState.selectionRange.endCol
  state.viewport.scrollTop = viewState.scrollPosition.scrollTop
  state.viewport.scrollLeft = viewState.scrollPosition.scrollLeft
  // 恢复网格线显示状态
  state.showGridLines.value = viewState.showGridLines !== false
  drawing.draw()
}

/** 获取格式刷状态 */
function getFormatPainterState() {
  return {
    mode: state.formatPainter.mode,
    data: state.formatPainter.data
  }
}

/** 设置格式刷状态 */
function setFormatPainterState(formatPainterState: { mode: 'off' | 'single' | 'continuous'; data: any }) {
  state.formatPainter.mode = formatPainterState.mode
  state.formatPainter.data = formatPainterState.data
  drawing.draw()
}

/** 
 * @deprecated 剪贴板现在由 Workbook 层级通过 props.clipboard 管理
 * 保留此方法仅用于向后兼容
 */
function getClipboardState() {
  // 返回当前蚂蚁线状态（剪贴板数据由外部管理）
  return {
    data: null,
    startRow: -1,
    startCol: -1,
    mergedRegions: [],
    tsvContent: '',
    copyTs: 0,
    copyRange: state.copyRange.visible ? {
      startRow: state.copyRange.startRow,
      startCol: state.copyRange.startCol,
      endRow: state.copyRange.endRow,
      endCol: state.copyRange.endCol
    } : null
  }
}

/** 
 * @deprecated 剪贴板现在由 Workbook 层级通过 props.clipboard 管理
 * 保留此方法仅用于向后兼容
 */
function setClipboardState(_clipboardState: { 
  data: any; 
  startRow: number; 
  startCol: number; 
  mergedRegions: any[]; 
  tsvContent?: string;
  copyTs?: number;
  copyRange?: { startRow: number; startCol: number; endRow: number; endCol: number } | null
}) {
  // 剪贴板数据现在通过 props.clipboard 传入，不再在这里设置
  // 蚂蚁线状态由 watch(props.clipboard) 自动同步
  console.warn('setClipboardState is deprecated. Clipboard is now managed by Workbook via props.clipboard')
}

/** 是否正在编辑公式 */
function isEditingFormula(): boolean {
  return state.overlay.visible && state.overlay.value.startsWith('=')
}

/** 获取公式编辑状态 */
function getFormulaEditState() {
  if (!state.overlay.visible) return null
  return {
    row: state.overlay.row,
    col: state.overlay.col,
    value: state.overlay.value,
    mode: state.overlay.mode
  }
}

// ==================== 公式栏支持方法 ====================

/** 获取当前选区 */
function getSelectionRange() {
  return state.selectionRange
}

/** 选择单元格 */
function selectCell(row: number, col: number) {
  state.selected.row = row
  state.selected.col = col
  state.selectionRange.startRow = row
  state.selectionRange.startCol = col
  state.selectionRange.endRow = row
  state.selectionRange.endCol = col
  
  // 确保单元格可见（滚动到视图）
  geometry.ensureVisible(row, col)
  
  drawing.draw()
  // watch 会自动发射选区变化事件
}

/** 选择范围 */
function selectRange(startRow: number, startCol: number, endRow: number, endCol: number) {
  // 更新选区状态
  state.selected.row = startRow
  state.selected.col = startCol
  state.selectionRange.startRow = startRow
  state.selectionRange.startCol = startCol
  state.selectionRange.endRow = endRow
  state.selectionRange.endCol = endCol
  
  // 确保起始单元格可见并绘制
  // 如果 container 尚未就绪（Sheet 切换后），等待一帧后重试
  if (!state.container.value) {
    requestAnimationFrame(() => {
      geometry.ensureVisible(startRow, startCol)
      drawing.draw()
    })
  } else {
    geometry.ensureVisible(startRow, startCol)
    drawing.draw()
  }
  // watch 会自动发射选区变化事件
}

/** 开始编辑当前单元格 */
function startEditingCurrentCell() {
  const row = state.selected.row
  const col = state.selected.col
  const value = state.formulaSheet.getDisplayValue(row, col) ?? ''
  
  input.openOverlay(row, col, value, 'edit')
}

/** 确认编辑 */
function confirmEditing() {
  if (state.overlay.visible) {
    input.onOverlaySave(state.overlay.value)
  }
}

/** 取消编辑 */
function cancelEditing() {
  if (state.overlay.visible) {
    input.onOverlayCancel()
  }
}

/** 设置编辑中的值 */
function setEditingValue(value: string) {
  if (state.overlay.visible) {
    state.overlay.value = value
    // watch 会自动发射编辑状态变化事件
  }
}

// 扩展 API 对象
const extendedApi = {
  ...api,
  getViewState,
  setViewState,
  getFormatPainterState,
  setFormatPainterState,
  getClipboardState,
  setClipboardState,
  isEditingFormula,
  getFormulaEditState,
  // 公式栏支持
  getSelectionRange,
  selectCell,
  selectRange,
  startEditingCurrentCell,
  confirmEditing,
  cancelEditing,
  setEditingValue
}

defineExpose(extendedApi)
</script>

<style scoped>
.sheet-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
  cursor: inherit;
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

/* IME 输入代理 */
.ime-proxy {
  position: absolute;
  padding: 2px 4px;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  color: transparent;
  font-size: 13px;
  font-family: Arial, sans-serif;
  line-height: 1.4;
  resize: none;
  overflow: hidden;
  white-space: nowrap;
  z-index: 50;
  box-sizing: border-box;
  caret-color: transparent;
  opacity: 0;
  cursor: default;
  pointer-events: none;
}

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

</style>
