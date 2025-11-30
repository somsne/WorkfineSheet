/**
 * useSheetKeyboard - 电子表格键盘处理 composable
 * 封装所有键盘事件处理、快捷键等
 */

import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'
import type { SheetInput } from './useSheetInput'
import type { SheetClipboard } from './useSheetClipboard'
import type { SheetDrawing } from './useSheetDrawing'
import { extractFormats, applyFormats } from '../formatPainter'

export interface UseSheetKeyboardOptions {
  state: SheetState
  geometry: SheetGeometry
  input: SheetInput
  clipboard: SheetClipboard
  drawing?: SheetDrawing
  onDraw: () => void
}

export function useSheetKeyboard({ state, geometry, input, clipboard, drawing, onDraw }: UseSheetKeyboardOptions) {
  const {
    constants,
    imeProxy,
    model, undoRedo,
    selected, selectionRange,
    overlay,
    formatPainter
  } = state
  
  const { ensureVisible } = geometry
  const { openOverlay, focusImeProxy } = input
  const { onCopy, clearCopyRange } = clipboard
  
  /**
   * 处理键盘按下事件
   */
  function onKeyDown(e: KeyboardEvent) {
    // 如果焦点在 IME 代理上，只处理特殊键
    if (e.target === imeProxy.value) {
      const specialKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', 'F2', 'Delete', 'Backspace']
      if (!specialKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
        return
      }
    }
    
    // 编辑模式下不处理
    if (overlay.visible) return
    
    // 撤销 (Ctrl/Cmd + Z)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (undoRedo.undo()) {
        onDraw()
      }
      return
    }
    
    // 重做 (Ctrl/Cmd + Y 或 Ctrl/Cmd + Shift + Z)
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault()
      if (undoRedo.redo()) {
        onDraw()
      }
      return
    }
    
    // 复制格式 (Ctrl/Cmd + Shift + C) - 必须在普通复制之前检查
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      if (selected.row >= 0 && selected.col >= 0) {
        // 确定源区域
        let startRow: number, startCol: number, endRow: number, endCol: number
        if (selectionRange.startRow >= 0 && selectionRange.startCol >= 0) {
          startRow = selectionRange.startRow
          startCol = selectionRange.startCol
          endRow = selectionRange.endRow
          endCol = selectionRange.endCol
        } else {
          startRow = selected.row
          startCol = selected.col
          endRow = selected.row
          endCol = selected.col
        }
        
        const isFullRow = startCol === 0 && endCol === constants.DEFAULT_COLS - 1
        const isFullColumn = startRow === 0 && endRow === constants.DEFAULT_ROWS - 1
        
        const data = extractFormats(
          startRow, startCol, endRow, endCol,
          (row, col) => model.getCellStyle(row, col),
          (row, col) => model.getCellBorder(row, col),
          (row, col) => model.getCellFormat(row, col),
          {
            isFullRow,
            isFullColumn,
            getRowStyle: (row) => model.getRowStyle(row),
            getColStyle: (col) => model.getColStyle(col),
            getRowFormat: (row) => model.getRowFormat(row),
            getColFormat: (col) => model.getColFormat(col),
            getMergedRegion: (row, col) => model.getMergedRegion(row, col)
          }
        )
        formatPainter.data = data
        formatPainter.mode = 'single'
        onDraw()
      }
      return
    }
    
    // 粘贴格式 (Ctrl/Cmd + Shift + V) - 必须在普通粘贴之前检查
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault()
      if (formatPainter.data && selected.row >= 0 && selected.col >= 0) {
        // 确定目标区域
        let targetStartRow: number, targetStartCol: number, targetEndRow: number, targetEndCol: number
        if (selectionRange.startRow >= 0 && selectionRange.startCol >= 0) {
          targetStartRow = selectionRange.startRow
          targetStartCol = selectionRange.startCol
          targetEndRow = selectionRange.endRow
          targetEndCol = selectionRange.endCol
        } else {
          targetStartRow = selected.row
          targetStartCol = selected.col
          targetEndRow = selected.row
          targetEndCol = selected.col
        }
        
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
        // 粘贴格式后不退出模式，可以连续粘贴
        onDraw()
      }
      return
    }
    
    // 复制 (Ctrl/Cmd + C)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      onCopy()
      // 启动蚂蚁线动画
      drawing?.startMarchingAntsAnimation()
      return
    }
    
    // 粘贴 (Ctrl/Cmd + V) - 不阻止默认行为，让 paste 事件触发
    // 实际的粘贴处理由 onPaste 事件处理器完成
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      // 不调用 e.preventDefault()，让浏览器触发 paste 事件
      return
    }
    
    // 全选 (Ctrl/Cmd + A)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      selectionRange.startRow = 0
      selectionRange.startCol = 0
      selectionRange.endRow = constants.DEFAULT_ROWS - 1
      selectionRange.endCol = constants.DEFAULT_COLS - 1
      selected.row = 0
      selected.col = 0
      onDraw()
      return
    }
    
    // 加粗 (Ctrl/Cmd + B)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      if (selected.row >= 0 && selected.col >= 0) {
        const currentStyle = model.getCellStyle(selected.row, selected.col)
        model.setCellStyle(selected.row, selected.col, { bold: !currentStyle.bold })
        onDraw()
      }
      return
    }
    
    // 斜体 (Ctrl/Cmd + I)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault()
      if (selected.row >= 0 && selected.col >= 0) {
        const currentStyle = model.getCellStyle(selected.row, selected.col)
        model.setCellStyle(selected.row, selected.col, { italic: !currentStyle.italic })
        onDraw()
      }
      return
    }
    
    // 下划线 (Ctrl/Cmd + U)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
      e.preventDefault()
      if (selected.row >= 0 && selected.col >= 0) {
        const currentStyle = model.getCellStyle(selected.row, selected.col)
        model.setCellStyle(selected.row, selected.col, { underline: !currentStyle.underline })
        onDraw()
      }
      return
    }
    
    // Escape - 退出格式刷或清除选区/蚂蚁线
    if (e.key === 'Escape') {
      e.preventDefault()
      
      // 如果格式刷激活，先退出格式刷
      if (formatPainter.mode !== 'off') {
        formatPainter.mode = 'off'
        formatPainter.data = null
        onDraw()
        return
      }
      
      // 清除蚂蚁线（复制区域）
      if (state.copyRange.visible) {
        clearCopyRange()
        drawing?.stopMarchingAntsAnimation()
        return
      }
      
      state.clearSelectionRange()
      state.clearDragState()
      onDraw()
      return
    }
    
    // 不处理打印键 - 让 IME 处理
    if (e.key === 'Process' || e.isComposing) {
      return
    }
    
    // 可打印字符 - 打开编辑器
    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      selected.row >= 0 &&
      selected.col >= 0
    ) {
      if (e.key === '=') {
        e.preventDefault()
        openOverlay(selected.row, selected.col, '=', 'typing')
      } else {
        openOverlay(selected.row, selected.col, '', 'typing')
      }
      return
    }
    
    // Shift + 方向键 - 扩展选区
    if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      
      if (selectionRange.startRow === -1) {
        selectionRange.startRow = selected.row
        selectionRange.startCol = selected.col
        selectionRange.endRow = selected.row
        selectionRange.endCol = selected.col
      }
      
      const step = 1
      switch (e.key) {
        case 'ArrowUp':
          selectionRange.endRow = Math.max(selectionRange.startRow, selectionRange.endRow - step)
          break
        case 'ArrowDown':
          selectionRange.endRow = Math.min(constants.DEFAULT_ROWS - 1, selectionRange.endRow + step)
          break
        case 'ArrowLeft':
          selectionRange.endCol = Math.max(selectionRange.startCol, selectionRange.endCol - step)
          break
        case 'ArrowRight':
          selectionRange.endCol = Math.min(constants.DEFAULT_COLS - 1, selectionRange.endCol + step)
          break
      }
      
      selected.row = selectionRange.endRow
      selected.col = selectionRange.endCol
      ensureVisible(selected.row, selected.col)
      onDraw()
      return
    }
    
    // 导航键处理
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
        newRow = Math.min(constants.DEFAULT_ROWS - 1, selected.row + step)
        break
      case 'ArrowLeft':
        e.preventDefault()
        newCol = Math.max(0, selected.col - step)
        break
      case 'ArrowRight':
        e.preventDefault()
        newCol = Math.min(constants.DEFAULT_COLS - 1, selected.col + step)
        break
      case 'Enter':
        e.preventDefault()
        newRow = selected.row + 1
        if (newRow >= constants.DEFAULT_ROWS) {
          newRow = 0
          newCol = selected.col + 1
          if (newCol >= constants.DEFAULT_COLS) {
            newCol = constants.DEFAULT_COLS - 1
          }
        }
        break
      case 'Tab':
        e.preventDefault()
        newCol = selected.col + 1
        if (newCol >= constants.DEFAULT_COLS) {
          newCol = 0
          newRow = selected.row + 1
          if (newRow >= constants.DEFAULT_ROWS) {
            newRow = constants.DEFAULT_ROWS - 1
          }
        }
        break
      default:
        return
    }
    
    if (newRow !== selected.row || newCol !== selected.col) {
      selected.row = newRow
      selected.col = newCol
      // 清除选区
      state.clearSelectionRange()
      ensureVisible(newRow, newCol)
      onDraw()
      focusImeProxy()
    }
  }
  
  return {
    onKeyDown
  }
}

export type SheetKeyboard = ReturnType<typeof useSheetKeyboard>
