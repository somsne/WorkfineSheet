/**
 * useSheetMouse - 电子表格鼠标交互 composable
 * 封装所有鼠标事件处理：点击、拖拽、滚动、调整大小等
 */

import { 
  handleClick, 
  startDragSelection, 
  updateDragSelection, 
  endDragSelection, 
  type SelectionState 
} from '../selection'
import { handleWheel, handleScrollbarDrag, startVerticalDrag, startHorizontalDrag, endDrag } from '../scrollbar'
import { handleContextMenu, handleInputDialogConfirm as handleInputDialogConfirmHelper, type ContextMenuConfig } from '../uiMenus'
import { applyFormats } from '../formatPainter'
import { parseAllFormulaReferences } from '../references'
import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'
import type { SheetInput } from './useSheetInput'
import type { RowColOperations } from './useRowColOperations'
import type { FillHandleComposable } from './useFillHandle'

// 格式刷光标 SVG（内联以避免资源加载问题）
const FORMAT_PAINTER_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="18" viewBox="0 0 26 18"><g fill="none" fill-rule="evenodd" stroke="none" stroke-width="1"><path fill="#FFF" fill-rule="nonzero" d="M24.5 0a1.5 1.5 0 0 1 1.493 1.356L26 1.5v5a1.5 1.5 0 0 1-1.356 1.493L24.5 8h-3.824l-.926.907V9h.75v5.625l-5 3.203V9h1v-.597L16.1 8h-4.6a1.5 1.5 0 0 1-1.473-1.215l-.02-.14L10 6.5v-5A1.5 1.5 0 0 1 11.356.007L11.5 0z"/><path fill="#333" d="M24.5 1a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-4.231L18.75 8.488V10h.75v4.078L16.5 16v-6h1V8h.008l-.001-.001L18.525 7H11.5a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5zm-.75 1.25h-11.5v3.5h11.5z"/><path fill="#333" stroke="#FFF" d="M2 .5H.5v2H2c.414 0 .79.168 1.06.44.272.27.44.646.44 1.06v3.5h-1v2h1V13c0 .414-.168.79-.44 1.06-.27.272-.646.44-1.06.44H.5v2H2c.98 0 1.865-.403 2.5-1.051A3.5 3.5 0 0 0 7 16.5h1.5v-1.998l-1.628-.007A1.496 1.496 0 0 1 5.5 13V9.5h1v-2h-1l.005-3.63A1.496 1.496 0 0 1 7 2.5h1.5V.497l-1.725.01c-.89.057-1.69.446-2.274 1.044A3.5 3.5 0 0 0 2 .5Z"/></g></svg>`

// 生成格式刷光标 CSS 值（data URL），热点在左中位置 (1, 9)
const FORMAT_PAINTER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(FORMAT_PAINTER_CURSOR_SVG)}") 1 9, auto`

/** 剪贴板操作接口 */
export interface ClipboardOperations {
  onCopy: () => Promise<{ tsv: string; html: string } | null>
  onCut: () => Promise<{ tsv: string; html: string } | null>
  onPaste: () => Promise<void>
}

/** 打开 Overlay 的回调参数 */
export interface OpenOverlayPayload {
  row: number
  col: number
  value: string
  top: number
  left: number
  width: number
  height: number
  mode: 'edit' | 'typing'
  cellStyle?: import('../types').CellStyle
}

/** 引用选择回调参数 */
export interface ReferenceSelectPayload {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface UseSheetMouseOptions {
  state: SheetState
  geometry: SheetGeometry
  input: SheetInput
  rowColOps: RowColOperations
  onDraw: () => void
  scheduleRedraw: () => void
  fillHandle?: FillHandleComposable
  /** 剪贴板操作（可选，用于右键菜单） */
  clipboardOps?: ClipboardOperations
  /** 打开 Overlay 回调（双击单元格时触发） */
  onOpenOverlay?: (payload: OpenOverlayPayload) => void
  /** 是否处于公式引用选择状态（由外部 Manager 控制） */
  isInReferenceSelectMode?: () => boolean
  /** 公式引用选择回调（点击单元格时触发） */
  onReferenceSelect?: (payload: ReferenceSelectPayload) => void
}

export function useSheetMouse({ state, geometry, input, rowColOps, onDraw, scheduleRedraw, fillHandle, clipboardOps, onOpenOverlay, isInReferenceSelectMode, onReferenceSelect }: UseSheetMouseOptions) {
  const {
    constants,
    container, overlayInput, formulaBarInput,
    model, formulaSheet,
    viewport, scrollbar,
    selected, selectionRange, dragState, multiSelection,
    overlay,
    resizeState, hoverState,
    rowHeights, colWidths, manualRowHeights,
    hiddenRows, hiddenCols,
    formulaReferences,
    contextMenu, inputDialog,
    formatPainter
  } = state
  
  const { 
    createSizeAccess, createGeometryConfig,
    getRowHeight, getColWidth, getRowAtY, getColAtX,
    getTotalContentWidth, getTotalContentHeight
  } = geometry
  
  const { focusImeProxy } = input
  const { insertRowAbove, insertRowBelow, deleteRow, showSetRowHeightDialog, insertColLeft, insertColRight, deleteCol, showSetColWidthDialog } = rowColOps
  
  /**
   * 获取滚动配置
   */
  function getScrollConfig() {
    const w = container.value?.clientWidth ?? 0
    const h = container.value?.clientHeight ?? 0
    return {
      containerWidth: w,
      containerHeight: h,
      contentWidth: getTotalContentWidth(),
      contentHeight: getTotalContentHeight(),
      rowHeaderWidth: constants.ROW_HEADER_WIDTH,
      colHeaderHeight: constants.COL_HEADER_HEIGHT
    }
  }
  
  /**
   * 创建选择状态对象
   */
  function createSelectionState(): SelectionState {
    return {
      selected,
      selectionRange,
      dragState,
      multiSelection
    }
  }
  
  // 标记是否刚刚完成填充柄拖拽（用于阻止随后的 click 事件）
  let justFinishedFillHandleDrag = false
  
  // 新的引用选择拖拽状态（基于外部 Manager）
  let refSelectDrag: {
    isDragging: boolean
    startRow: number
    startCol: number
    currentEndRow: number
    currentEndCol: number
  } = {
    isDragging: false,
    startRow: -1,
    startCol: -1,
    currentEndRow: -1,
    currentEndCol: -1
  }
  
  // 公式引用选择模式状态（旧代码兼容）
  let formulaReferenceMode: {
    active: boolean
    editor: any  // RichTextInput 或 FormulaBar 实例
    isFormulaBarActive: boolean
    editingRow: number  // 正在编辑的单元格行
    editingCol: number  // 正在编辑的单元格列
    // 引用选区（不影响 active 单元格）
    refStartRow: number
    refStartCol: number
    refEndRow: number
    refEndCol: number
    isDragging: boolean  // 是否正在拖拽选择引用区域
  } = {
    active: false,
    editor: null,
    isFormulaBarActive: false,
    editingRow: -1,
    editingCol: -1,
    refStartRow: -1,
    refStartCol: -1,
    refEndRow: -1,
    refEndCol: -1,
    isDragging: false
  }
  
  /**
   * 插入公式引用
   * 提取为独立函数，供 mousedown 和 mouseup 调用
   */
  function insertFormulaReference(
    activeEditor: any,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): void {
    // 检查起始单元格的合并区域
    const startRegion = model.getMergedRegion(startRow, startCol)
    
    // 判断是否是范围选择
    const isRangeSelection = (startRow !== endRow || startCol !== endCol)
    
    // 生成引用地址（同 Sheet 模式：生成 A1 或 A1:B2 格式）
    let reference: string
    if (isRangeSelection) {
      const startAddr = formulaSheet.getCellAddress(startRow, startCol)
      const endAddr = formulaSheet.getCellAddress(endRow, endCol)
      reference = `${startAddr}:${endAddr}`
    } else if (startRegion && (startRegion.endRow > startRegion.startRow || startRegion.endCol > startRegion.startCol)) {
      const startAddr = formulaSheet.getCellAddress(startRegion.startRow, startRegion.startCol)
      const endAddr = formulaSheet.getCellAddress(startRegion.endRow, startRegion.endCol)
      reference = `${startAddr}:${endAddr}`
    } else {
      reference = formulaSheet.getCellAddress(startRow, startCol)
    }
    
    // 插入引用（直接使用完整的引用字符串）
    const newText = activeEditor.insertCellReference?.(reference) ?? ''
    
    // 插入引用后立即更新公式引用高亮（使用返回的新文本）
    const valueForParsing = newText || activeEditor.getCurrentValue?.() || ''
    formulaReferences.value = parseAllFormulaReferences(valueForParsing)
  }
  
  /**
   * 处理点击事件
   */
  function onClick(e: MouseEvent) {
    if (!container.value) return
    
    // 如果正在编辑，不处理点击（避免干扰编辑器）
    if (overlay.visible) {
      return
    }
    
    // 如果刚刚完成填充柄拖拽，不处理点击
    if (justFinishedFillHandleDrag) {
      justFinishedFillHandleDrag = false
      return
    }
    
    // 如果正在填充柄拖拽，不处理点击
    if (fillHandle?.fillHandleState.dragging) {
      return
    }
    
    // 如果是双击的第二次点击，不处理，让 dblclick 处理
    if (e.detail === 2) {
      return
    }
    
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 检测是否在行高调整区域 - 如果是则不处理点击
    if (x < constants.ROW_HEADER_WIDTH && y > constants.COL_HEADER_HEIGHT) {
      let accumulatedY = constants.COL_HEADER_HEIGHT - viewport.scrollTop
      for (let r = 0; r < constants.DEFAULT_ROWS; r++) {
        const rowHeight = getRowHeight(r)
        accumulatedY += rowHeight
        
        if (Math.abs(y - accumulatedY) <= constants.RESIZE_HANDLE_SIZE / 2) {
          // 点击了行高调整区域，不处理点击事件
          return
        }
        
        if (accumulatedY > y + constants.RESIZE_HANDLE_SIZE) break
      }
    }
    
    // 检测是否在列宽调整区域 - 如果是则不处理点击
    if (y < constants.COL_HEADER_HEIGHT && x > constants.ROW_HEADER_WIDTH) {
      let accumulatedX = constants.ROW_HEADER_WIDTH - viewport.scrollLeft
      for (let c = 0; c < constants.DEFAULT_COLS; c++) {
        const colWidth = getColWidth(c)
        accumulatedX += colWidth
        
        if (Math.abs(x - accumulatedX) <= constants.RESIZE_HANDLE_SIZE / 2) {
          // 点击了列宽调整区域，不处理点击事件
          return
        }
        
        if (accumulatedX > x + constants.RESIZE_HANDLE_SIZE) break
      }
    }
    
    const needsRedraw = handleClick({
      x,
      y,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey, // macOS 使用 metaKey (Cmd)
      containerRect: rect,
      viewport,
      geometryConfig: createGeometryConfig(),
      sizes: createSizeAccess(),
      defaultRows: constants.DEFAULT_ROWS,
      defaultCols: constants.DEFAULT_COLS,
      state: createSelectionState()
    })
    
    if (needsRedraw) {
      onDraw()
      focusImeProxy()
    }
  }
  
  /**
   * 处理鼠标按下事件
   */
  function onMouseDown(e: MouseEvent) {
    if (!container.value) return
    
    // 忽略右键按下，由 contextmenu 事件处理
    if (e.button === 2) return
    
    // 如果是双击的第二次点击（detail === 2），不处理，让 dblclick 处理
    if (e.detail === 2) return
    
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 检测行高调整区域
    if (x < constants.ROW_HEADER_WIDTH && y > constants.COL_HEADER_HEIGHT) {
      let accumulatedY = constants.COL_HEADER_HEIGHT - viewport.scrollTop
      let hitResize = false
      for (let r = 0; r < constants.DEFAULT_ROWS; r++) {
        const rowHeight = getRowHeight(r)
        accumulatedY += rowHeight
        
        if (Math.abs(y - accumulatedY) <= constants.RESIZE_HANDLE_SIZE / 2) {
          resizeState.isResizing = true
          resizeState.type = 'row'
          resizeState.index = r
          resizeState.startPos = e.clientY
          resizeState.startSize = rowHeight
          
          // 检查是否选中了多行（整行选择模式）
          const isRowSelection = selectionRange.startCol === 0 && selectionRange.endCol === constants.DEFAULT_COLS - 1
          const isInSelection = isRowSelection && r >= selectionRange.startRow && r <= selectionRange.endRow
          
          if (isInSelection && selectionRange.endRow > selectionRange.startRow) {
            // 选中了多行，记录所有选中行的初始高度
            resizeState.batchIndices = []
            resizeState.batchStartSizes = []
            for (let i = selectionRange.startRow; i <= selectionRange.endRow; i++) {
              if (i !== r) {  // 不包括当前拖拽的行
                resizeState.batchIndices.push(i)
                resizeState.batchStartSizes.push(getRowHeight(i))
              }
            }
          } else {
            resizeState.batchIndices = []
            resizeState.batchStartSizes = []
          }
          
          hitResize = true
          e.preventDefault()
          return
        }
        
        if (accumulatedY > y + constants.RESIZE_HANDLE_SIZE) break
      }
      
      // 只有不在调整区域时才进行行选择
      if (!hitResize) {
        // 行表头拖拽选择
        startDragSelection({
          x,
          y,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey || e.metaKey,
          containerRect: rect,
          viewport,
          geometryConfig: createGeometryConfig(),
          sizes: createSizeAccess(),
          defaultRows: constants.DEFAULT_ROWS,
          defaultCols: constants.DEFAULT_COLS,
          state: createSelectionState(),
          getMergedRegion: (r, c) => model.getMergedRegion(r, c)
        })
        onDraw()
      }
      return
    }
    
    // 检测列宽调整区域
    if (y < constants.COL_HEADER_HEIGHT && x > constants.ROW_HEADER_WIDTH) {
      let accumulatedX = constants.ROW_HEADER_WIDTH - viewport.scrollLeft
      let hitResize = false
      for (let c = 0; c < constants.DEFAULT_COLS; c++) {
        const colWidth = getColWidth(c)
        accumulatedX += colWidth
        
        if (Math.abs(x - accumulatedX) <= constants.RESIZE_HANDLE_SIZE / 2) {
          resizeState.isResizing = true
          resizeState.type = 'col'
          resizeState.index = c
          resizeState.startPos = e.clientX
          resizeState.startSize = colWidth
          
          // 检查是否选中了多列（整列选择模式）
          const isColSelection = selectionRange.startRow === 0 && selectionRange.endRow === constants.DEFAULT_ROWS - 1
          const isInSelection = isColSelection && c >= selectionRange.startCol && c <= selectionRange.endCol
          
          if (isInSelection && selectionRange.endCol > selectionRange.startCol) {
            // 选中了多列，记录所有选中列的初始宽度
            resizeState.batchIndices = []
            resizeState.batchStartSizes = []
            for (let i = selectionRange.startCol; i <= selectionRange.endCol; i++) {
              if (i !== c) {  // 不包括当前拖拽的列
                resizeState.batchIndices.push(i)
                resizeState.batchStartSizes.push(getColWidth(i))
              }
            }
          } else {
            resizeState.batchIndices = []
            resizeState.batchStartSizes = []
          }
          
          hitResize = true
          e.preventDefault()
          return
        }
        
        if (accumulatedX > x + constants.RESIZE_HANDLE_SIZE) break
      }
      
      // 只有不在调整区域时才进行列选择
      if (!hitResize) {
        // 列表头拖拽选择
        startDragSelection({
          x,
          y,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey || e.metaKey,
          containerRect: rect,
          viewport,
          geometryConfig: createGeometryConfig(),
          sizes: createSizeAccess(),
          defaultRows: constants.DEFAULT_ROWS,
          defaultCols: constants.DEFAULT_COLS,
          state: createSelectionState(),
          getMergedRegion: (r, c) => model.getMergedRegion(r, c)
        })
        onDraw()
      }
      return
    }
    
    // 点击左上角
    if (x < constants.ROW_HEADER_WIDTH && y < constants.COL_HEADER_HEIGHT) return
    
    // ========== 新的公式引用选择模式处理（基于外部 Manager 状态）==========
    if (isInReferenceSelectMode?.()) {
      e.preventDefault()
      
      // 计算点击的单元格
      const clickedRow = getRowAtY(y)
      const clickedCol = getColAtX(x)
      
      if (clickedRow >= 0 && clickedCol >= 0) {
        // 考虑合并单元格
        let refRow = clickedRow
        let refCol = clickedCol
        let refEndRow = clickedRow
        let refEndCol = clickedCol
        const mergedRegion = model.getMergedRegion(clickedRow, clickedCol)
        if (mergedRegion) {
          refRow = mergedRegion.startRow
          refCol = mergedRegion.startCol
          refEndRow = mergedRegion.endRow
          refEndCol = mergedRegion.endCol
        }
        
        // 记录拖拽起始点
        refSelectDrag = {
          isDragging: true,
          startRow: refRow,
          startCol: refCol,
          currentEndRow: refEndRow,
          currentEndCol: refEndCol
        }
        
        // 通知外部插入引用（初始为单个单元格）
        onReferenceSelect?.({
          startRow: refRow,
          startCol: refCol,
          endRow: refEndRow,
          endCol: refEndCol
        })
        
        onDraw()
      }
      return
    }
    
    // 重置公式引用选择模式（旧代码兼容）
    formulaReferenceMode = {
      active: false,
      editor: null,
      isFormulaBarActive: false,
      editingRow: -1,
      editingCol: -1,
      refStartRow: -1,
      refStartCol: -1,
      refEndRow: -1,
      refEndCol: -1,
      isDragging: false
    }
    
    // 检查是否在公式编辑模式（FormulaBar 或 RichTextInput）- 旧代码，逐步迁移
    const activeElement = document.activeElement as HTMLElement | null
    const isFormulaBarActive = activeElement?.closest('.formula-bar') !== null
    const formulaBarInstance = formulaBarInput.value as any
    const overlayInputInstance = overlayInput.value as any
    
    // 判断活动的编辑器
    let activeEditor: any = null
    let isFormulaMode = false
    let editingRow = -1
    let editingCol = -1
    
    if (isFormulaBarActive && formulaBarInstance?.formulaMode) {
      activeEditor = formulaBarInstance
      isFormulaMode = true
      editingRow = selected.row
      editingCol = selected.col
    } else if (overlay.visible && overlayInputInstance?.formulaMode) {
      activeEditor = overlayInputInstance
      isFormulaMode = true
      editingRow = overlay.row
      editingCol = overlay.col
    }
    
    // 公式编辑模式处理（旧代码，逐步迁移）
    if (activeEditor && isFormulaMode) {
      e.preventDefault()
      
      const isSelectable = activeEditor?.isInSelectableState ?? false
      const hasSelection = activeEditor?.hasTextSelection ?? false
      
      // 计算点击的单元格
      const clickedRow = getRowAtY(y)
      const clickedCol = getColAtX(x)
      
      // 检查是否点击了正在编辑的单元格
      const clickedSelf = clickedRow === editingRow && clickedCol === editingCol
      if (clickedSelf) {
        // 点击自身，不处理（允许在编辑器内选择文本）
        return
      }
      
      // 在可选择状态
      if (isSelectable || hasSelection) {
        // 计算点击的单元格（考虑合并单元格）
        let refRow = clickedRow
        let refCol = clickedCol
        let refEndRow = clickedRow
        let refEndCol = clickedCol
        const mergedRegion = model.getMergedRegion(clickedRow, clickedCol)
        if (mergedRegion) {
          refRow = mergedRegion.startRow
          refCol = mergedRegion.startCol
          refEndRow = mergedRegion.endRow
          refEndCol = mergedRegion.endCol
        }
        
        // 设置公式引用选择模式（不修改 active 单元格）
        formulaReferenceMode = {
          active: true,
          editor: activeEditor,
          isFormulaBarActive,
          editingRow,
          editingCol,
          refStartRow: refRow,
          refStartCol: refCol,
          refEndRow: refEndRow,
          refEndCol: refEndCol,
          isDragging: true
        }
        
        // 立即插入引用（与普通单元格选择行为一致）
        insertFormulaReference(activeEditor, refRow, refCol, refEndRow, refEndCol)
        
        onDraw()
        return
      } else {
        // 不在可选择状态，保存并退出编辑
        const currentValue = activeEditor?.getCurrentValue?.() ?? ''
        
        if (overlay.visible) {
          formulaSheet.setValue(overlay.row, overlay.col, currentValue)
          overlay.visible = false
        } else {
          // FormulaBar 模式，保存到当前选中的单元格
          formulaSheet.setValue(selected.row, selected.col, currentValue)
        }
        
        formulaReferences.value = []
        // 继续正常的单元格选择流程
      }
    }

    // 检测填充柄拖拽
    if (fillHandle && fillHandle.isOnFillHandle(x, y)) {
      // 如果正在编辑单元格，先保存内容（不移动到下一单元格）
      if (overlay.visible && overlayInput.value) {
        // 记住当前编辑的单元格位置
        const editingRow = overlay.row
        const editingCol = overlay.col
        
        // 设置选区为刚编辑的单元格
        selected.row = editingRow
        selected.col = editingCol
        selectionRange.startRow = editingRow
        selectionRange.startCol = editingCol
        selectionRange.endRow = editingRow
        selectionRange.endCol = editingCol
        
        // 更新填充柄位置
        fillHandle.updateFillHandlePosition()
      }
      
      // 开始填充柄拖拽
      if (fillHandle.startFillHandleDrag(x, y)) {
        e.preventDefault()
        return
      }
    }
    
    // 普通单元格拖拽
    const started = startDragSelection({
      x,
      y,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
      containerRect: rect,
      viewport,
      geometryConfig: createGeometryConfig(),
      sizes: createSizeAccess(),
      defaultRows: constants.DEFAULT_ROWS,
      defaultCols: constants.DEFAULT_COLS,
      state: createSelectionState(),
      getMergedRegion: (r, c) => model.getMergedRegion(r, c)
    })
    
    // 立即重绘以显示焦点框，并更新填充柄位置
    if (started) {
      // 在 mousedown 时立即更新填充柄位置
      if (fillHandle) {
        fillHandle.updateFillHandlePosition()
      }
      onDraw()
      // 聚焦到 IME 代理，以便接收键盘输入
      focusImeProxy()
    }
  }
  
  /**
   * 处理双击事件 - 打开单元格编辑
   */
  function onDoubleClick(e: MouseEvent) {
    if (!container.value) return
    
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 在表头区域不处理（可以用于其他操作如调整列宽）
    if (x <= constants.ROW_HEADER_WIDTH || y <= constants.COL_HEADER_HEIGHT) {
      return
    }
    
    // 计算点击的单元格
    // 注意：getRowAtY/getColAtX 内部会减去表头尺寸，所以这里传入原始坐标
    const row = getRowAtY(y)
    const col = getColAtX(x)
    
    if (row < 0 || col < 0 || row >= constants.DEFAULT_ROWS || col >= constants.DEFAULT_COLS) {
      return
    }
    
    // 跳过隐藏的单元格
    if (hiddenRows.value.has(row) || hiddenCols.value.has(col)) {
      return
    }
    
    // 检查是否在合并区域内，如果是则使用合并区域的起始单元格
    const mergedRegion = model.getMergedRegion(row, col)
    const targetRow = mergedRegion ? mergedRegion.startRow : row
    const targetCol = mergedRegion ? mergedRegion.startCol : col
    
    // 获取单元格值 - 对公式显示原始公式
    const displayValue = formulaSheet.getDisplayValue(targetRow, targetCol)
    const value = displayValue ?? ''
    
    // 计算行的 Y 位置
    let cellTop = constants.COL_HEADER_HEIGHT
    for (let r = 0; r < targetRow; r++) {
      cellTop += getRowHeight(r)
    }
    cellTop -= viewport.scrollTop
    
    // 计算列的 X 位置
    let cellLeft = constants.ROW_HEADER_WIDTH
    for (let c = 0; c < targetCol; c++) {
      cellLeft += getColWidth(c)
    }
    cellLeft -= viewport.scrollLeft
    
    // 计算单元格尺寸（考虑合并区域）
    let cellWidth = 0
    let cellHeight = 0
    if (mergedRegion) {
      for (let c = mergedRegion.startCol; c <= mergedRegion.endCol; c++) {
        cellWidth += getColWidth(c)
      }
      for (let r = mergedRegion.startRow; r <= mergedRegion.endRow; r++) {
        cellHeight += getRowHeight(r)
      }
    } else {
      cellWidth = getColWidth(targetCol)
      cellHeight = getRowHeight(targetRow)
    }
    
    // 获取单元格样式
    const cellStyle = model.getCellStyle(targetRow, targetCol)
    
    // 更新选中状态
    selected.row = targetRow
    selected.col = targetCol
    selectionRange.startRow = targetRow
    selectionRange.startCol = targetCol
    selectionRange.endRow = mergedRegion ? mergedRegion.endRow : targetRow
    selectionRange.endCol = mergedRegion ? mergedRegion.endCol : targetCol
    
    // 触发回调（通知 WorkbookSheet 打开 Overlay）
    if (onOpenOverlay) {
      onOpenOverlay({
        row: targetRow,
        col: targetCol,
        value: value,
        top: cellTop,
        left: cellLeft,
        width: cellWidth,
        height: cellHeight,
        mode: 'edit',
        cellStyle: cellStyle || undefined
      })
    }
    
    onDraw()
  }
  
  /**
   * 处理滚轮事件
   */
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    
    const changed = handleWheel(e, viewport, getScrollConfig())
    
    if (changed) {
      onDraw()
    }
  }
  
  /**
   * 处理鼠标移动事件
   */
  function onMouseMove(e: MouseEvent) {
    if (!container.value) return
    
    // 滚动条拖拽
    if (scrollbar.dragging) {
      const changed = handleScrollbarDrag(scrollbar, viewport, { x: e.clientX, y: e.clientY }, getScrollConfig())
      if (changed) {
        scheduleRedraw()
      }
      return
    }
    
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 填充柄拖拽中
    if (fillHandle && fillHandle.fillHandleState.dragging) {
      fillHandle.updateFillHandleDrag(x, y)
      container.value.style.cursor = 'crosshair'
      return
    }
    
    // 调整大小
    if (resizeState.isResizing) {
      if (resizeState.type === 'row') {
        const delta = e.clientY - resizeState.startPos
        const newHeight = Math.max(constants.ROW_HEIGHT / 2, resizeState.startSize + delta)
        rowHeights.value.set(resizeState.index, newHeight)
        // 实时只调整当前行，其他选中的行在 mouseup 时同步
        scheduleRedraw()
      } else if (resizeState.type === 'col') {
        const delta = e.clientX - resizeState.startPos
        const newWidth = Math.max(constants.COL_WIDTH / 2, resizeState.startSize + delta)
        colWidths.value.set(resizeState.index, newWidth)
        // 实时只调整当前列，其他选中的列在 mouseup 时同步
        scheduleRedraw()
      }
      return
    }
    
    // 更新光标和悬停状态
    let cursor = 'default'
    let hoverFound = false
    
    // 行高调整区域
    if (x < constants.ROW_HEADER_WIDTH && y > constants.COL_HEADER_HEIGHT) {
      let accumulatedY = constants.COL_HEADER_HEIGHT - viewport.scrollTop
      for (let r = 0; r < constants.DEFAULT_ROWS; r++) {
        const rowHeight = getRowHeight(r)
        accumulatedY += rowHeight
        
        if (Math.abs(y - accumulatedY) <= constants.RESIZE_HANDLE_SIZE / 2) {
          cursor = 'ns-resize'
          hoverState.type = 'row'
          hoverState.index = r
          hoverFound = true
          scheduleRedraw()
          break
        }
        
        if (accumulatedY > y + constants.RESIZE_HANDLE_SIZE) break
      }
    }
    
    // 列宽调整区域
    if (!hoverFound && y < constants.COL_HEADER_HEIGHT && x > constants.ROW_HEADER_WIDTH) {
      let accumulatedX = constants.ROW_HEADER_WIDTH - viewport.scrollLeft
      for (let c = 0; c < constants.DEFAULT_COLS; c++) {
        const colWidth = getColWidth(c)
        accumulatedX += colWidth
        
        if (Math.abs(x - accumulatedX) <= constants.RESIZE_HANDLE_SIZE / 2) {
          cursor = 'ew-resize'
          hoverState.type = 'col'
          hoverState.index = c
          hoverFound = true
          scheduleRedraw()
          break
        }
        
        if (accumulatedX > x + constants.RESIZE_HANDLE_SIZE) break
      }
    }
    
    if (!hoverFound && (hoverState.type !== '' || hoverState.index !== -1)) {
      hoverState.type = ''
      hoverState.index = -1
      scheduleRedraw()
    }
    
    // 检测填充柄悬停
    if (fillHandle) {
      const fillHandleCursor = fillHandle.getCursor(x, y)
      if (fillHandleCursor) {
        cursor = fillHandleCursor
      }
    }
    
    // 格式刷模式下，在单元格区域使用格式刷光标
    if (formatPainter.mode !== 'off' && 
        x > constants.ROW_HEADER_WIDTH && 
        y > constants.COL_HEADER_HEIGHT &&
        cursor === 'default') {
      cursor = FORMAT_PAINTER_CURSOR
    }
    
    container.value.style.cursor = cursor
    
    // ========== 新的引用选择拖拽处理（基于外部 Manager 状态）==========
    if (refSelectDrag.isDragging && isInReferenceSelectMode?.()) {
      const refRow = getRowAtY(y)
      const refCol = getColAtX(x)
      
      if (refRow >= 0 && refCol >= 0) {
        // 考虑合并单元格
        let endRow = refRow
        let endCol = refCol
        const mergedRegion = model.getMergedRegion(refRow, refCol)
        if (mergedRegion) {
          // 扩展到合并区域的边界
          endRow = refRow >= refSelectDrag.startRow ? mergedRegion.endRow : mergedRegion.startRow
          endCol = refCol >= refSelectDrag.startCol ? mergedRegion.endCol : mergedRegion.startCol
        }
        
        // 只有当区域变化时才更新
        if (endRow !== refSelectDrag.currentEndRow || endCol !== refSelectDrag.currentEndCol) {
          refSelectDrag.currentEndRow = endRow
          refSelectDrag.currentEndCol = endCol
          
          // 规范化区域（确保 start <= end）
          const normalizedStartRow = Math.min(refSelectDrag.startRow, endRow)
          const normalizedStartCol = Math.min(refSelectDrag.startCol, endCol)
          const normalizedEndRow = Math.max(refSelectDrag.startRow, endRow)
          const normalizedEndCol = Math.max(refSelectDrag.startCol, endCol)
          
          // 通知外部更新引用
          onReferenceSelect?.({
            startRow: normalizedStartRow,
            startCol: normalizedStartCol,
            endRow: normalizedEndRow,
            endCol: normalizedEndCol
          })
          
          scheduleRedraw()
        }
      }
      return
    }
    
    // 公式引用选择拖拽（旧代码兼容）
    if (formulaReferenceMode.active && formulaReferenceMode.isDragging) {
      const refRow = getRowAtY(y)
      const refCol = getColAtX(x)
      
      // 考虑合并单元格
      const mergedRegion = model.getMergedRegion(refRow, refCol)
      if (mergedRegion) {
        formulaReferenceMode.refEndRow = mergedRegion.endRow
        formulaReferenceMode.refEndCol = mergedRegion.endCol
      } else {
        formulaReferenceMode.refEndRow = refRow
        formulaReferenceMode.refEndCol = refCol
      }
      
      scheduleRedraw()
      return
    }
    
    // 普通拖拽选择
    const changed = updateDragSelection({
      x,
      y,
      containerRect: rect,
      viewport,
      geometryConfig: createGeometryConfig(),
      sizes: createSizeAccess(),
      defaultRows: constants.DEFAULT_ROWS,
      defaultCols: constants.DEFAULT_COLS,
      state: createSelectionState(),
      getMergedRegion: (r, c) => model.getMergedRegion(r, c)
    })
    
    if (changed) {
      scheduleRedraw()
    }
  }
  
  /**
   * 处理鼠标松开事件
   */
  function onMouseUp(): void {
    
    // ========== 新的引用选择拖拽结束处理 ==========
    if (refSelectDrag.isDragging) {
      refSelectDrag.isDragging = false
      refSelectDrag.startRow = -1
      refSelectDrag.startCol = -1
      refSelectDrag.currentEndRow = -1
      refSelectDrag.currentEndCol = -1
      // 引用已在 mousedown/mousemove 中插入/更新，这里只需重置状态
      return
    }
    
    // 结束填充柄拖拽
    if (fillHandle && fillHandle.fillHandleState.dragging) {
      fillHandle.endFillHandleDrag()
      // 标记刚完成填充柄拖拽，阻止随后的 click 事件
      justFinishedFillHandleDrag = true
      return
    }
    
    // 结束调整大小
    if (resizeState.isResizing) {
      // 在结束时同步其他选中的行/列
      if (resizeState.type === 'row') {
        const finalHeight = rowHeights.value.get(resizeState.index) ?? constants.ROW_HEIGHT
        manualRowHeights.value.add(resizeState.index)
        // 同步其他选中的行
        for (const idx of resizeState.batchIndices) {
          rowHeights.value.set(idx, finalHeight)
          manualRowHeights.value.add(idx)
        }
      } else if (resizeState.type === 'col') {
        const finalWidth = colWidths.value.get(resizeState.index) ?? constants.COL_WIDTH
        // 同步其他选中的列
        for (const idx of resizeState.batchIndices) {
          colWidths.value.set(idx, finalWidth)
        }
      }
      
      resizeState.isResizing = false
      resizeState.type = ''
      resizeState.index = -1
      resizeState.batchIndices = []
      resizeState.batchStartSizes = []
      scheduleRedraw()
      return
    }
    
    // 公式引用选择模式处理（在 mousedown 中已插入初始引用）
    if (formulaReferenceMode.active && formulaReferenceMode.editor) {
      const activeEditor = formulaReferenceMode.editor
      
      // 从 formulaReferenceMode 获取引用选区
      const startRow = Math.min(formulaReferenceMode.refStartRow, formulaReferenceMode.refEndRow)
      const startCol = Math.min(formulaReferenceMode.refStartCol, formulaReferenceMode.refEndCol)
      const endRow = Math.max(formulaReferenceMode.refStartRow, formulaReferenceMode.refEndRow)
      const endCol = Math.max(formulaReferenceMode.refStartCol, formulaReferenceMode.refEndCol)
      
      // 检查是否通过拖拽扩展了范围（与初始位置不同）
      const initialStartRow = formulaReferenceMode.refStartRow
      const initialStartCol = formulaReferenceMode.refStartCol
      const hasRangeExpanded = (startRow !== initialStartRow || startCol !== initialStartCol ||
                                endRow !== initialStartRow || endCol !== initialStartCol) &&
                               (startRow !== endRow || startCol !== endCol)
      
      // 只有在拖拽扩展了范围时才更新引用
      if (hasRangeExpanded) {
        insertFormulaReference(activeEditor, startRow, startCol, endRow, endCol)
      }
      
      // 重置公式引用选择模式
      formulaReferenceMode = {
        active: false,
        editor: null,
        isFormulaBarActive: false,
        editingRow: -1,
        editingCol: -1,
        refStartRow: -1,
        refStartCol: -1,
        refEndRow: -1,
        refEndCol: -1,
        isDragging: false
      }
      
      onDraw()
      return
    }
    
    // 普通拖拽选择检查
    if (!dragState.isDragging) {
      return
    }
    
    // 格式刷模式处理
    if (formatPainter.mode !== 'off' && formatPainter.data) {
      // 从 dragState 获取目标选区（因为 selectionRange 还没更新）
      let targetStartRow: number, targetStartCol: number, targetEndRow: number, targetEndCol: number
      let isSingleCellTarget = false
      
      if (dragState.isDragging) {
        // 从拖拽状态获取目标位置
        targetStartRow = Math.min(dragState.startRow, dragState.currentRow)
        targetStartCol = Math.min(dragState.startCol, dragState.currentCol)
        targetEndRow = Math.max(dragState.startRow, dragState.currentRow)
        targetEndCol = Math.max(dragState.startCol, dragState.currentCol)
        
        // 检查是否是单击（非拖拽）- 起点和终点相同
        isSingleCellTarget = (dragState.startRow === dragState.currentRow && 
                             dragState.startCol === dragState.currentCol)
      } else if (selectionRange.startRow >= 0 && selectionRange.startCol >= 0) {
        targetStartRow = selectionRange.startRow
        targetStartCol = selectionRange.startCol
        targetEndRow = selectionRange.endRow
        targetEndCol = selectionRange.endCol
        isSingleCellTarget = (targetStartRow === targetEndRow && targetStartCol === targetEndCol)
      } else if (selected.row >= 0 && selected.col >= 0) {
        targetStartRow = selected.row
        targetStartCol = selected.col
        targetEndRow = selected.row
        targetEndCol = selected.col
        isSingleCellTarget = true
      } else {
        state.clearDragState()
        onDraw()
        return
      }
      
      // Excel 行为：如果目标是单个单元格，以该单元格为锚点扩展到源区域大小
      if (isSingleCellTarget && (formatPainter.data.rows > 1 || formatPainter.data.cols > 1)) {
        targetEndRow = targetStartRow + formatPainter.data.rows - 1
        targetEndCol = targetStartCol + formatPainter.data.cols - 1
      }
      
      // 应用格式
      applyFormats(
        formatPainter.data,
        targetStartRow, targetStartCol, targetEndRow, targetEndCol,
        (row, col, style) => model.setCellStyle(row, col, style),
        (row, col, border) => model.setCellBorder(row, col, border),
        (row, col) => model.clearCellBorder(row, col),
        (row, col, format) => model.setCellFormat(row, col, format),
        {
          setRowStyle: (row, style) => model.setRowStyle(row, style),
          setColStyle: (col, style) => model.setColStyle(col, style),
          setRowFormat: (row, format) => model.setRowFormat(row, format),
          setColFormat: (col, format) => model.setColFormat(col, format),
          getMergedRegion: (row, col) => model.getMergedRegion(row, col),
          mergeCells: (r1, c1, r2, c2) => model.mergeCells(r1, c1, r2, c2),
          unmergeCells: (row, col) => model.unmergeCells(row, col) !== null
        }
      )
      
      // 更新选区到目标位置
      selected.row = targetStartRow
      selected.col = targetStartCol
      selectionRange.startRow = targetStartRow
      selectionRange.startCol = targetStartCol
      selectionRange.endRow = targetEndRow
      selectionRange.endCol = targetEndCol
      
      // 如果是单次模式，应用后退出
      if (formatPainter.mode === 'single') {
        formatPainter.mode = 'off'
        formatPainter.data = null
      }
      
      state.clearDragState()
      onDraw()
      focusImeProxy()
      return
    }
    
    // 正常拖拽结束
    const needsRedraw = endDragSelection(
      createSelectionState(), 
      constants.DEFAULT_COLS, 
      (r, c) => model.getMergedRegion(r, c), 
      constants.DEFAULT_ROWS
    )
    if (needsRedraw) {
      onDraw()
      focusImeProxy()
    }
  }
  
  /**
   * 处理右键菜单
   */
  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    
    if (!container.value) return
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 判断点击位置并在需要时选中行/列
    if (x < constants.ROW_HEADER_WIDTH && y > constants.COL_HEADER_HEIGHT) {
      // 点击行头 - 检查是否需要选中该行
      const row = getRowAtY(y)
      // 检查当前是否是整行选择模式（选区覆盖所有列）
      const isRowSelection = selectionRange.startCol === 0 && selectionRange.endCol === constants.DEFAULT_COLS - 1
      // 检查点击的行是否在选区范围内
      const isRowInSelection = isRowSelection && row >= selectionRange.startRow && row <= selectionRange.endRow
      
      if (!isRowInSelection) {
        // 点击的行不在当前选区内，选中该行
        selected.row = row
        selected.col = 0
        selectionRange.startRow = row
        selectionRange.startCol = 0
        selectionRange.endRow = row
        selectionRange.endCol = constants.DEFAULT_COLS - 1
        // 清除多选区
        if (multiSelection) {
          multiSelection.ranges = []
          multiSelection.active = false
        }
        onDraw()
      }
    } else if (y < constants.COL_HEADER_HEIGHT && x > constants.ROW_HEADER_WIDTH) {
      // 点击列头 - 检查是否需要选中该列
      const col = getColAtX(x)
      // 检查当前是否是整列选择模式（选区覆盖所有行）
      const isColSelection = selectionRange.startRow === 0 && selectionRange.endRow === constants.DEFAULT_ROWS - 1
      // 检查点击的列是否在选区范围内
      const isColInSelection = isColSelection && col >= selectionRange.startCol && col <= selectionRange.endCol
      
      if (!isColInSelection) {
        // 点击的列不在当前选区内，选中该列
        selected.row = 0
        selected.col = col
        selectionRange.startRow = 0
        selectionRange.startCol = col
        selectionRange.endRow = constants.DEFAULT_ROWS - 1
        selectionRange.endCol = col
        // 清除多选区
        if (multiSelection) {
          multiSelection.ranges = []
          multiSelection.active = false
        }
        onDraw()
      }
    } else if (x > constants.ROW_HEADER_WIDTH && y > constants.COL_HEADER_HEIGHT) {
      // 点击单元格区域
      const row = getRowAtY(y)
      const col = getColAtX(x)
      
      // 检查点击的单元格是否在当前选区内
      const isInSelection = row >= selectionRange.startRow && row <= selectionRange.endRow &&
                            col >= selectionRange.startCol && col <= selectionRange.endCol
      
      if (!isInSelection) {
        // 点击的单元格不在当前选区内，选中该单元格
        selected.row = row
        selected.col = col
        selectionRange.startRow = row
        selectionRange.startCol = col
        selectionRange.endRow = row
        selectionRange.endCol = col
        // 清除多选区
        if (multiSelection) {
          multiSelection.ranges = []
          multiSelection.active = false
        }
        onDraw()
      }
      
      // 显示单元格右键菜单（剪切、复制、粘贴）
      contextMenu.x = e.clientX
      contextMenu.y = e.clientY
      contextMenu.targetRow = row
      contextMenu.targetCol = col
      
      contextMenu.items = []
      
      if (clipboardOps) {
        contextMenu.items.push(
          { 
            label: '剪切', 
            action: async () => {
              const result = await clipboardOps.onCut()
              if (!result) return
              // 写入系统剪贴板
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({
                    'text/plain': new Blob([result.tsv], { type: 'text/plain' }),
                    'text/html': new Blob([result.html], { type: 'text/html' })
                  })
                ])
              } catch {
                // 降级方案：只写入纯文本
                await navigator.clipboard.writeText(result.tsv)
              }
              onDraw()
            }
          },
          { 
            label: '复制', 
            action: async () => {
              const result = await clipboardOps.onCopy()
              if (!result) return
              // 写入系统剪贴板
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({
                    'text/plain': new Blob([result.tsv], { type: 'text/plain' }),
                    'text/html': new Blob([result.html], { type: 'text/html' })
                  })
                ])
              } catch {
                // 降级方案：只写入纯文本
                await navigator.clipboard.writeText(result.tsv)
              }
              onDraw()
            }
          },
          { 
            label: '粘贴', 
            action: async () => {
              await clipboardOps.onPaste()
              onDraw()
            }
          }
        )
      }
      
      contextMenu.visible = true
      return // 已处理，不再调用 handleContextMenu
    }
    
    // 隐藏/取消隐藏行的操作
    function hideRows(startRow: number, endRow: number) {
      for (let r = startRow; r <= endRow; r++) {
        hiddenRows.value.add(r)
      }
      onDraw()
    }
    
    function unhideRows(startRow: number, endRow: number) {
      for (let r = startRow; r <= endRow; r++) {
        hiddenRows.value.delete(r)
      }
      onDraw()
    }
    
    // 隐藏/取消隐藏列的操作
    function hideCols(startCol: number, endCol: number) {
      for (let c = startCol; c <= endCol; c++) {
        hiddenCols.value.add(c)
      }
      onDraw()
    }
    
    function unhideCols(startCol: number, endCol: number) {
      for (let c = startCol; c <= endCol; c++) {
        hiddenCols.value.delete(c)
      }
      onDraw()
    }
    
    const menuConfig: ContextMenuConfig = {
      rowHeaderWidth: constants.ROW_HEADER_WIDTH,
      colHeaderHeight: constants.COL_HEADER_HEIGHT,
      getRowAtY,
      getColAtX,
      selectionRange: {
        startRow: selectionRange.startRow,
        startCol: selectionRange.startCol,
        endRow: selectionRange.endRow,
        endCol: selectionRange.endCol
      },
      hiddenRows: hiddenRows.value,
      hiddenCols: hiddenCols.value,
      rowOperations: {
        insertRowAbove,
        insertRowBelow,
        deleteRow,
        showSetRowHeightDialog,
        hideRows,
        unhideRows
      },
      colOperations: {
        insertColLeft,
        insertColRight,
        deleteCol,
        showSetColWidthDialog,
        hideCols,
        unhideCols
      }
    }
    
    handleContextMenu(e, rect, menuConfig, contextMenu)
  }
  
  /**
   * 输入对话框确认
   */
  function onInputDialogConfirm(value: string) {
    handleInputDialogConfirmHelper(value, inputDialog)
  }
  
  // ==================== 滚动条事件 ====================
  
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
    // 引用选择拖拽（需要全局监听，因为鼠标可能移出容器）
    if (refSelectDrag.isDragging && container.value) {
      onMouseMove(e)
      return
    }
    
    if (!scrollbar.dragging) return
    onMouseMove(e)
  }
  
  function onGlobalMouseUp() {
    // 引用选择拖拽结束
    if (refSelectDrag.isDragging) {
      refSelectDrag.isDragging = false
      refSelectDrag.startRow = -1
      refSelectDrag.startCol = -1
      refSelectDrag.currentEndRow = -1
      refSelectDrag.currentEndCol = -1
    }
    
    if (scrollbar.dragging) {
      endDrag(scrollbar)
    }
  }
  
  return {
    // 鼠标事件
    onClick,
    onMouseDown,
    onDoubleClick,
    onMouseMove,
    onMouseUp,
    onWheel,
    
    // 右键菜单
    onContextMenu,
    onInputDialogConfirm,
    
    // 滚动条
    onVThumbMouseDown,
    onHThumbMouseDown,
    onGlobalMouseMove,
    onGlobalMouseUp
  }
}

export type SheetMouse = ReturnType<typeof useSheetMouse>
