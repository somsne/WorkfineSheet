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
    container, overlayInput,
    model, formulaSheet,
    viewport, scrollbar,
    selected, selectionRange, dragState,
    overlay,
    resizeState, hoverState,
    rowHeights, colWidths,
    formulaReferences,
    contextMenu, inputDialog
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
      dragState
    }
  }
  
  /**
   * 处理点击事件
   */
  function onClick(e: MouseEvent) {
    if (!container.value) return
    
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const needsRedraw = handleClick({
      x,
      y,
      shiftKey: e.shiftKey,
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
    const rect = container.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 检测行高调整区域
    if (x < constants.ROW_HEADER_WIDTH && y > constants.COL_HEADER_HEIGHT) {
      let accumulatedY = constants.COL_HEADER_HEIGHT - viewport.scrollTop
      for (let r = 0; r < constants.DEFAULT_ROWS; r++) {
        const rowHeight = getRowHeight(r)
        accumulatedY += rowHeight
        
        if (Math.abs(y - accumulatedY) <= constants.RESIZE_HANDLE_SIZE / 2) {
          resizeState.isResizing = true
          resizeState.type = 'row'
          resizeState.index = r
          resizeState.startPos = e.clientY
          resizeState.startSize = rowHeight
          e.preventDefault()
          return
        }
        
        if (accumulatedY > y + constants.RESIZE_HANDLE_SIZE) break
      }
      
      // 行表头拖拽选择
      startDragSelection({
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
      onDraw()
      return
    }
    
    // 检测列宽调整区域
    if (y < constants.COL_HEADER_HEIGHT && x > constants.ROW_HEADER_WIDTH) {
      let accumulatedX = constants.ROW_HEADER_WIDTH - viewport.scrollLeft
      for (let c = 0; c < constants.DEFAULT_COLS; c++) {
        const colWidth = getColWidth(c)
        accumulatedX += colWidth
        
        if (Math.abs(x - accumulatedX) <= constants.RESIZE_HANDLE_SIZE / 2) {
          resizeState.isResizing = true
          resizeState.type = 'col'
          resizeState.index = c
          resizeState.startPos = e.clientX
          resizeState.startSize = colWidth
          e.preventDefault()
          return
        }
        
        if (accumulatedX > x + constants.RESIZE_HANDLE_SIZE) break
      }
      
      // 列表头拖拽选择
      startDragSelection({
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
      onDraw()
      return
    }
    
    // 点击左上角
    if (x < constants.ROW_HEADER_WIDTH && y < constants.COL_HEADER_HEIGHT) return
    
    // 检查编辑框
    if (overlay.visible && overlayInput.value) {
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
        e.preventDefault()
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
    if (!shouldOpen) return
    
    let col = getColAtX(x)
    let row = getRowAtY(y)
    
    const mergedRegion = model.getMergedRegion(row, col)
    if (mergedRegion) {
      row = mergedRegion.startRow
      col = mergedRegion.startCol
    }
    
    selected.row = row
    selected.col = col
    const editValue = formulaSheet.getDisplayValue(row, col)
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
    // 结束填充柄拖拽
    if (fillHandle && fillHandle.fillHandleState.dragging) {
      fillHandle.endFillHandleDrag()
      return
    }
    
    // 结束调整大小
    if (resizeState.isResizing) {
      resizeState.isResizing = false
      resizeState.type = ''
      resizeState.index = -1
      return
    }
    
    if (!dragState.isDragging) return
    
    // 公式模式特殊处理
    if (overlay.visible && overlayInput.value && (overlayInput.value as any).formulaMode) {
      const clickedSelf = (dragState.startRow === overlay.row && dragState.startCol === overlay.col)
      
      if (clickedSelf) {
        return
      }
      
      const overlayInputInstance = overlayInput.value as any
      const isSelectable = overlayInputInstance?.isInSelectableState ?? false
      const hasSelection = overlayInputInstance?.hasTextSelection ?? false
      
      if (!isSelectable && !hasSelection) {
        const currentValue = overlayInputInstance?.getCurrentValue?.() ?? ''
        
        formulaSheet.setValue(overlay.row, overlay.col, currentValue)
        
        overlay.visible = false
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
      
      if (isActualDrag) {
        const startAddr = formulaSheet.getCellAddress(dragState.startRow, dragState.startCol)
        const endAddr = formulaSheet.getCellAddress(dragState.currentRow, dragState.currentCol)
        ;(overlayInput.value as any).insertRangeReference(startAddr, endAddr)
      } else if (startRegion && (startRegion.endRow > startRegion.startRow || startRegion.endCol > startRegion.startCol)) {
        const startAddr = formulaSheet.getCellAddress(startRegion.startRow, startRegion.startCol)
        const endAddr = formulaSheet.getCellAddress(startRegion.endRow, startRegion.endCol)
        ;(overlayInput.value as any).insertRangeReference(startAddr, endAddr)
      } else {
        const cellAddr = formulaSheet.getCellAddress(dragState.startRow, dragState.startCol)
        ;(overlayInput.value as any).insertCellReference(cellAddr)
      }
      
      selected.row = overlay.row
      selected.col = overlay.col
      state.clearSelectionRange()
      state.clearDragState()
      
      onDraw()
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
