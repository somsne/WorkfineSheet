<template>
  <div class="sheet-wrapper">
    <!-- 样式工具栏 -->
    <StyleToolbar v-if="api" :api="api" :current-selection="state.selected" :selection-range="state.selectionRange" />
    
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
      
      <!-- 填充选项菜单 -->
      <FillOptionsMenu
        :visible="fillHandle.fillOptionsMenu.visible"
        :x="fillHandle.fillOptionsMenu.x"
        :y="fillHandle.fillOptionsMenu.y"
        :direction="fillHandle.fillOptionsMenu.direction"
        :selected-type="fillHandle.fillOptionsMenu.selectedType"
        @select="fillHandle.handleFillOptionSelect"
        @close="fillHandle.closeFillOptionsMenu"
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { CellFormat, CellStyle, CellBorder } from './sheet/types'
import { createEventManager, type EventHandlers } from './sheet/events'
import { createSheetAPI } from './sheet/api'
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

// @ts-ignore
import RichTextInput from './RichTextInput.vue'
// @ts-ignore
import StyleToolbar from './StyleToolbar.vue'
// @ts-ignore
import ContextMenu from './ContextMenu.vue'
// @ts-ignore
import InputDialog from './InputDialog.vue'
// @ts-ignore
import FillOptionsMenu from './FillOptionsMenu.vue'

// ==================== 初始化状态 ====================
const state = useSheetState()

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
  totalRows: state.constants.DEFAULT_ROWS,
  totalCols: state.constants.DEFAULT_COLS,
  scheduleRedraw: () => scheduleRedrawFn(),
  updateSelectionRange: (range) => {
    state.selectionRange.startRow = range.startRow
    state.selectionRange.startCol = range.startCol
    state.selectionRange.endRow = range.endRow
    state.selectionRange.endCol = range.endCol
  }
})

// 3. 绘制 (传入 fillHandle)
const drawing = useSheetDrawing({ state, geometry, fillHandle })
drawFn = drawing.draw
scheduleRedrawFn = drawing.scheduleRedraw

// 4. 输入处理
const input = useSheetInput({ 
  state, 
  geometry, 
  onDraw: drawing.draw 
})

// 5. 剪贴板
const clipboard = useSheetClipboard({ 
  state, 
  onDraw: drawing.draw 
})

// 6. 行列操作
const rowColOps = useRowColOperations({ 
  state, 
  geometry, 
  onDraw: drawing.draw 
})

// 7. 键盘处理
const keyboard = useSheetKeyboard({ 
  state, 
  geometry, 
  input, 
  clipboard, 
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
  fillHandle
})

// 9. 图片处理
const images = useSheetImages({
  model: state.model,
  undoRedo: state.undoRedo,
  viewport: state.viewport,
  getSizes: () => geometry.createSizeAccess(),
  getGeometryConfig: () => geometry.createGeometryConfig(),
  getContainerWidth: () => state.container.value?.clientWidth ?? 0,
  getContainerHeight: () => state.container.value?.clientHeight ?? 0,
  getContainer: () => state.container.value,
  totalRows: state.constants.DEFAULT_ROWS,
  totalCols: state.constants.DEFAULT_COLS,
  requestDraw: () => {
    drawing.draw()
  }
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
    console.log('Container size:', containerRef.value.clientWidth, containerRef.value.clientHeight)
    
    drawing.draw()
    
    // 创建包装后的事件处理器，优先处理图片交互
    const wrappedMouseDown = (e: MouseEvent) => {
      // 先尝试图片交互
      if (images.handleImageMouseDown(e)) return
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
    
    const handlers: EventHandlers = {
      onMouseDown: wrappedMouseDown,
      onClick: mouse.onClick,
      onDoubleClick: mouse.onDoubleClick,
      onMouseMove: wrappedMouseMove,
      onWheel: mouse.onWheel,
      onMouseUp: wrappedMouseUp,
      onKeyDown: wrappedKeyDown,
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
    state.undoRedo.execute({
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
      state.undoRedo.execute({
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
    const oldStyles: Array<{ row: number; col: number; style: CellStyle }> = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        oldStyles.push({ row: r, col: c, style: { ...state.model.getCellStyle(r, c) } })
      }
    }
    
    state.undoRedo.execute({
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
  },
  
  // 边框相关（支持撤销/重做）
  getCellBorderFn: (row: number, col: number) => state.model.getCellBorder(row, col),
  setCellBorderFn: (row: number, col: number, border) => {
    const oldBorder = state.model.getCellBorder(row, col)
    state.undoRedo.execute({
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
      state.undoRedo.execute({
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
    
    state.undoRedo.execute({
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
    
    state.undoRedo.execute({
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
      state.undoRedo.execute({
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
    state.undoRedo.execute({
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
      state.undoRedo.execute({
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
    const oldFormats: Array<{ row: number; col: number; format: CellFormat | undefined }> = []
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        oldFormats.push({ row: r, col: c, format: state.model.getCellFormat(r, c) })
      }
    }
    
    state.undoRedo.execute({
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
    
    state.undoRedo.record({
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
    
    state.undoRedo.record({
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
  undoFn: () => state.undoRedo.undo(),
  redoFn: () => state.undoRedo.redo(),
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
  clearImageSelectionFn: () => images.clearImageSelection()
})

defineExpose(api)
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

/* 暗黑模式支持 - 系统偏好 */
@media (prefers-color-scheme: dark) {
  .sheet-container {
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

/* 暗黑模式支持 - 手动切换 */
:global(html.dark) .sheet-container {
  --sheet-border: #404040;
}

:global(html.dark) .v-scrollbar-thumb,
:global(html.dark) .h-scrollbar-thumb {
  --scrollbar-thumb: rgba(255, 255, 255, 0.25);
}

:global(html.dark) .calculation-progress {
  --progress-bg: rgba(30, 30, 30, 0.95);
  --progress-border: #404040;
  --progress-text: #e0e0e0;
  --progress-detail: #b0b0b0;
}
</style>
