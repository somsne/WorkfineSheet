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
import { handleDoubleClick as handleDoubleClickHelper, isClickInsideOverlay } from '../overlay'
import { handleContextMenu, handleInputDialogConfirm as handleInputDialogConfirmHelper, type ContextMenuConfig } from '../uiMenus'
import { applyFormats } from '../formatPainter'
import { parseFormulaReferences } from '../references'
import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'
import type { SheetInput } from './useSheetInput'
import type { RowColOperations } from './useRowColOperations'
import type { FillHandleComposable } from './useFillHandle'

export interface UseSheetMouseOptions {
  state: SheetState
  geometry: SheetGeometry
  input: SheetInput
  rowColOps: RowColOperations
  onDraw: () => void
  scheduleRedraw: () => void
  fillHandle?: FillHandleComposable
}

export function useSheetMouse({ state, geometry, input, rowColOps, onDraw, scheduleRedraw, fillHandle }: UseSheetMouseOptions) {
  const {
    constants,
    container, overlayInput, formulaBarInput,
    model, formulaSheet,
    viewport, scrollbar,
    selected, selectionRange, dragState, multiSelection,
    overlay,
    resizeState, hoverState,
    rowHeights, colWidths, manualRowHeights,
    formulaReferences,
    contextMenu, inputDialog,
    formatPainter
  } = state
  
  const { 
    createSizeAccess, createGeometryConfig,
    getRowHeight, getColWidth, getRowAtY, getColAtX,
    getTotalContentWidth, getTotalContentHeight
  } = geometry
  
  const { openOverlay, focusImeProxy } = input
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
  
  /**
   * 处理点击事件
   */
  function onClick(e: MouseEvent) {
    console.log('[useSheetMouse] onClick', {
      target: e.target,
      detail: e.detail,
      overlayVisible: overlay.visible,
      selectedRow: selected.row,
      selectedCol: selected.col
    })
    if (!container.value) return
    
    // 如果正在编辑，不处理点击（避免干扰编辑器）
    if (overlay.visible) {
      console.log('[useSheetMouse] onClick: overlay visible, 返回')
      return
    }
    
    // 如果是双击的第二次点击，不处理，让 dblclick 处理
    if (e.detail === 2) {
      console.log('[useSheetMouse] onClick: detail === 2, 返回')
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
    
    // 检查是否在 FormulaBar 公式编辑模式
    const activeElement = document.activeElement as HTMLElement | null
    const isFormulaBarActive = activeElement?.closest('.formula-bar') !== null
    const formulaBarInstance = formulaBarInput.value as any
    
    if (isFormulaBarActive && formulaBarInstance?.formulaMode) {
      console.log('[DEBUG onMouseDown] FormulaBar is active and in formula mode, preventing default')
      e.preventDefault()
    }
    
    // 检查编辑框
    if (overlay.visible && overlayInput.value) {
      console.log('[DEBUG onMouseDown] overlay visible, checking formulaMode...')
      console.log('[DEBUG onMouseDown] formulaMode:', (overlayInput.value as any).formulaMode)
      console.log('[DEBUG onMouseDown] formulaMode?.value:', (overlayInput.value as any).formulaMode?.value)
      
      const inputElement = (overlayInput.value as any).getInputElement?.()
      
      if (inputElement) {
        const inputRect = inputElement.getBoundingClientRect()
        const containerRect = container.value!.getBoundingClientRect()
        
        const inputLeft = inputRect.left - containerRect.left
        const inputTop = inputRect.top - containerRect.top
        
        if (isClickInsideOverlay(x, y, {
          left: inputLeft,
          top: inputTop,
          width: inputRect.width,
          height: inputRect.height
        })) {
          return
        }
      }
      
      if ((overlayInput.value as any).formulaMode) {
        console.log('[DEBUG onMouseDown] formulaMode is TRUE, calling preventDefault')
        e.preventDefault()
      } else {
        console.log('[DEBUG onMouseDown] formulaMode is FALSE or undefined')
      }
    }
    
    // 检测填充柄拖拽
    if (fillHandle && fillHandle.startFillHandleDrag(x, y)) {
      e.preventDefault()
      return
    }
    
    // 普通单元格拖拽
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
  }
  
  /**
   * 处理双击事件
   */
  function onDoubleClick(e: MouseEvent) {
    console.log('[useSheetMouse] onDoubleClick', {
      target: e.target,
      detail: e.detail,
      overlayVisible: overlay.visible
    })
    if (!container.value) return
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 先检查填充柄双击
    if (fillHandle && fillHandle.handleDoubleClick(x, y)) {
      e.preventDefault()
      return
    }
    
    const { shouldOpen } = handleDoubleClickHelper(x, y, createGeometryConfig())
    console.log('[useSheetMouse] onDoubleClick: shouldOpen =', shouldOpen)
    if (!shouldOpen) return
    
    let col = getColAtX(x)
    let row = getRowAtY(y)
    
    console.log('[useSheetMouse] onDoubleClick: 准备打开编辑器', { row, col })
    
    const mergedRegion = model.getMergedRegion(row, col)
    if (mergedRegion) {
      row = mergedRegion.startRow
      col = mergedRegion.startCol
    }
    
    selected.row = row
    selected.col = col
    const editValue = formulaSheet.getDisplayValue(row, col)
    console.log('[useSheetMouse] onDoubleClick: 调用 openOverlay', { row, col, editValue })
    openOverlay(row, col, editValue, 'edit')
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
        scheduleRedraw()
      } else if (resizeState.type === 'col') {
        const delta = e.clientX - resizeState.startPos
        const newWidth = Math.max(constants.COL_WIDTH / 2, resizeState.startSize + delta)
        colWidths.value.set(resizeState.index, newWidth)
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
    
    container.value.style.cursor = cursor
    
    // 拖拽选择
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
    console.log('[DEBUG onMouseUp] called')
    console.log('[DEBUG onMouseUp] dragState.isDragging:', dragState.isDragging)
    
    // 结束填充柄拖拽
    if (fillHandle && fillHandle.fillHandleState.dragging) {
      fillHandle.endFillHandleDrag()
      return
    }
    
    // 结束调整大小
    if (resizeState.isResizing) {
      // 如果是调整行高，记录为用户手动设置
      if (resizeState.type === 'row') {
        manualRowHeights.value.add(resizeState.index)
      }
      resizeState.isResizing = false
      resizeState.type = ''
      resizeState.index = -1
      return
    }
    
    if (!dragState.isDragging) {
      console.log('[DEBUG onMouseUp] dragState.isDragging is false, returning early')
      return
    }
    
    // 公式模式特殊处理 - 支持 RichTextInput 和 FormulaBar
    console.log('[DEBUG onMouseUp] checking formula mode...')
    console.log('[DEBUG onMouseUp] overlay.visible:', overlay.visible)
    console.log('[DEBUG onMouseUp] overlayInput.value:', !!overlayInput.value)
    console.log('[DEBUG onMouseUp] formulaBarInput.value:', !!formulaBarInput.value)
    
    // 检查是否在公式编辑模式（RichTextInput 或 FormulaBar）
    const overlayInputInstance = overlayInput.value as any
    const formulaBarInstance = formulaBarInput.value as any
    
    // 判断当前活动的编辑器是哪个
    const activeElement = document.activeElement as HTMLElement | null
    const isFormulaBarActive = activeElement?.closest('.formula-bar') !== null
    
    // 选择活动的编辑器实例
    let activeEditor: any = null
    let isFormulaMode = false
    
    if (isFormulaBarActive && formulaBarInstance?.formulaMode) {
      activeEditor = formulaBarInstance
      isFormulaMode = true
      console.log('[DEBUG onMouseUp] FormulaBar is active and in formula mode')
    } else if (overlay.visible && overlayInputInstance?.formulaMode) {
      activeEditor = overlayInputInstance
      isFormulaMode = true
      console.log('[DEBUG onMouseUp] RichTextInput is active and in formula mode')
    }
    
    if (activeEditor && isFormulaMode) {
      const isSelectable = activeEditor?.isInSelectableState ?? false
      const hasSelection = activeEditor?.hasTextSelection ?? false
      
      console.log('[DEBUG onMouseUp] activeEditor:', activeEditor)
      console.log('[DEBUG onMouseUp] isSelectable:', isSelectable, 'hasSelection:', hasSelection)
      console.log('[DEBUG onMouseUp] activeEditor.isInSelectableState:', activeEditor?.isInSelectableState)
      console.log('[DEBUG onMouseUp] activeEditor.getCurrentValue():', activeEditor?.getCurrentValue?.())
      
      // 如果是 FormulaBar 模式，检查点击的是否是正在编辑的单元格
      if (isFormulaBarActive) {
        // FormulaBar 模式：overlay 可能不可见，使用 selected 来判断
        const clickedSelf = (dragState.startRow === selected.row && dragState.startCol === selected.col)
        if (clickedSelf) {
          state.clearDragState()
          return
        }
      } else {
        // RichTextInput 模式
        const clickedSelf = (dragState.startRow === overlay.row && dragState.startCol === overlay.col)
        if (clickedSelf) {
          return
        }
      }
      
      if (!isSelectable && !hasSelection) {
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
        
        selected.row = dragState.startRow
        selected.col = dragState.startCol
        state.clearSelectionRange()
        state.clearDragState()
        
        onDraw()
        return
      }
      
      // 插入引用
      const startRegion = model.getMergedRegion(dragState.startRow, dragState.startCol)
      
      let isActualDrag = false
      if (startRegion) {
        isActualDrag = (
          dragState.currentRow < startRegion.startRow ||
          dragState.currentRow > startRegion.endRow ||
          dragState.currentCol < startRegion.startCol ||
          dragState.currentCol > startRegion.endCol
        )
      } else {
        isActualDrag = (
          dragState.startRow !== dragState.currentRow ||
          dragState.startCol !== dragState.currentCol
        )
      }
      
      let newText = ''
      if (isActualDrag) {
        const startAddr = formulaSheet.getCellAddress(dragState.startRow, dragState.startCol)
        const endAddr = formulaSheet.getCellAddress(dragState.currentRow, dragState.currentCol)
        newText = activeEditor.insertRangeReference(startAddr, endAddr)
      } else if (startRegion && (startRegion.endRow > startRegion.startRow || startRegion.endCol > startRegion.startCol)) {
        const startAddr = formulaSheet.getCellAddress(startRegion.startRow, startRegion.startCol)
        const endAddr = formulaSheet.getCellAddress(startRegion.endRow, startRegion.endCol)
        newText = activeEditor.insertRangeReference(startAddr, endAddr)
      } else {
        const cellAddr = formulaSheet.getCellAddress(dragState.startRow, dragState.startCol)
        newText = activeEditor.insertCellReference(cellAddr)
      }
      
      // 插入引用后立即更新公式引用高亮（使用返回的新文本）
      const valueForParsing = newText || activeEditor.getCurrentValue?.() || ''
      formulaReferences.value = parseFormulaReferences(valueForParsing)
      console.log('[DEBUG onMouseUp] Updated formulaReferences immediately:', formulaReferences.value)
      
      if (!isFormulaBarActive) {
        selected.row = overlay.row
        selected.col = overlay.col
      }
      state.clearSelectionRange()
      state.clearDragState()
      
      onDraw()
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
    if (!scrollbar.dragging) return
    onMouseMove(e)
  }
  
  function onGlobalMouseUp() {
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
