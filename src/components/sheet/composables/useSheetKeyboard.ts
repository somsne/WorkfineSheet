/**
 * useSheetKeyboard - 电子表格键盘处理 composable
 * 封装所有键盘事件处理、快捷键等
 */

import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'
import type { SheetInput } from './useSheetInput'
import type { SheetClipboard } from './useSheetClipboard'

export interface UseSheetKeyboardOptions {
  state: SheetState
  geometry: SheetGeometry
  input: SheetInput
  clipboard: SheetClipboard
  onDraw: () => void
}

export function useSheetKeyboard({ state, geometry, input, clipboard, onDraw }: UseSheetKeyboardOptions) {
  const {
    constants,
    imeProxy,
    model, undoRedo,
    selected, selectionRange,
    overlay
  } = state
  
  const { ensureVisible } = geometry
  const { openOverlay, focusImeProxy } = input
  const { onCopy, onPaste } = clipboard
  
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
    
    // 复制 (Ctrl/Cmd + C)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      onCopy()
      return
    }
    
    // 粘贴 (Ctrl/Cmd + V)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault()
      onPaste()
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
    
    // Escape - 清除选区
    if (e.key === 'Escape') {
      e.preventDefault()
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
