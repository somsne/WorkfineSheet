/**
 * useSheetInput - 电子表格输入处理 composable
 * 封装所有输入相关的方法：IME 处理、overlay 编辑器、公式引用等
 */

import { nextTick, watch } from 'vue'
import { openOverlay as openOverlayHelper, closeOverlay, getNextCellAfterSave } from '../overlay'
import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'

export interface UseSheetInputOptions {
  state: SheetState
  geometry: SheetGeometry
  onDraw: () => void
}

export function useSheetInput({ state, geometry, onDraw }: UseSheetInputOptions) {
  const {
    constants,
    overlayInput, imeProxy,
    formulaSheet, undoRedo,
    viewport,
    selected, selectionRange,
    overlay, imeState,
    formulaReferences, updateFormulaReferences
  } = state
  
  const { createSizeAccess, createGeometryConfig, getRowHeight, getColWidth, getRowTop, getColLeft } = geometry
  
  // ==================== Overlay 编辑器 ====================
  
  /**
   * 打开编辑器覆盖层
   */
  function openOverlay(row: number, col: number, initialValue: string, mode: 'edit' | 'typing' = 'edit') {
    const overlayState = openOverlayHelper(row, col, initialValue, mode, viewport, createSizeAccess(), createGeometryConfig())
    Object.assign(overlay, overlayState)
    onDraw()
  }
  
  /**
   * 保存编辑内容
   */
  function onOverlaySave(val: string) {
    const row = overlay.row
    const col = overlay.col
    const oldValue = formulaSheet.getDisplayValue(row, col)
    
    // 检查是否需要进行日期格式转换
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
          onDraw()
        },
        redo: () => {
          formulaSheet.setValue(row, col, val)
          onDraw()
        }
      })
    }
    
    // 关闭覆盖层
    Object.assign(overlay, closeOverlay())
    formulaReferences.value = []
    
    // 使用覆盖层模块计算下一个单元格位置
    const nextCell = getNextCellAfterSave(row, col, constants.DEFAULT_ROWS, constants.DEFAULT_COLS)
    selected.row = nextCell.row
    selected.col = nextCell.col
    
    // 清除区域选择
    state.clearSelectionRange()
    
    onDraw()
    
    // 编辑完成后，聚焦 IME 代理以便继续输入
    focusImeProxy()
  }
  
  /**
   * 取消编辑
   */
  function onOverlayCancel() {
    Object.assign(overlay, closeOverlay())
    formulaReferences.value = []
    onDraw()
    focusImeProxy()
  }
  
  // ==================== IME 输入处理 ====================
  
  /**
   * 聚焦到 IME 代理输入框
   */
  function focusImeProxy() {
    if (!imeProxy.value || overlay.visible) return
    
    setTimeout(() => {
      if (!imeProxy.value || overlay.visible) return
      
      if (selected.row >= 0 && selected.col >= 0) {
        const cellX = constants.ROW_HEADER_WIDTH + getColLeft(selected.col) - viewport.scrollLeft
        const cellY = constants.COL_HEADER_HEIGHT + getRowTop(selected.row) - viewport.scrollTop
        const cellWidth = getColWidth(selected.col)
        const cellHeight = getRowHeight(selected.row)
        
        imeProxy.value.style.left = `${cellX + 2}px`
        imeProxy.value.style.top = `${cellY + 2}px`
        imeProxy.value.style.width = `${cellWidth - 4}px`
        imeProxy.value.style.height = `${cellHeight - 4}px`
        
        imeProxy.value.value = ''
        imeProxy.value.focus()
      }
    }, 50)
  }
  
  /**
   * IME 组合开始
   */
  function onImeCompositionStart(_e: CompositionEvent) {
    imeState.isComposing = true
    imeState.compositionText = ''
  }
  
  /**
   * IME 组合更新
   */
  function onImeCompositionUpdate(e: CompositionEvent) {
    imeState.compositionText = e.data || ''
    if (imeProxy.value) {
      imeState.cursorPos = imeProxy.value.selectionStart || imeState.compositionText.length
    }
    onDraw()
  }
  
  /**
   * IME 组合结束
   */
  function onImeCompositionEnd(e: CompositionEvent) {
    imeState.isComposing = false
    const finalText = e.data || ''
    
    if (imeProxy.value) {
      imeProxy.value.value = ''
    }
    imeState.compositionText = ''
    onDraw()
    
    if (finalText && selected.row >= 0 && selected.col >= 0) {
      if (!overlay.visible) {
        openOverlay(selected.row, selected.col, finalText, 'typing')
        
        nextTick(() => {
          if (overlayInput.value) {
            const editor = (overlayInput.value as any).getEditorElement?.()
            if (editor) {
              editor.focus()
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
        if (overlayInput.value) {
          const editor = (overlayInput.value as any).getEditorElement?.()
          if (editor) {
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0)
              range.deleteContents()
              range.insertNode(document.createTextNode(finalText))
              range.collapse(false)
              selection.removeAllRanges()
              selection.addRange(range)
            } else {
              editor.textContent += finalText
            }
          }
        }
      }
    }
  }
  
  /**
   * IME 代理 input 事件
   */
  function onImeInput(e: Event) {
    if (imeState.isComposing) return
    
    const target = e.target as HTMLTextAreaElement
    const value = target.value
    
    if (value && selected.row >= 0 && selected.col >= 0) {
      if (!overlay.visible) {
        openOverlay(selected.row, selected.col, value, 'typing')
        
        nextTick(() => {
          if (overlayInput.value) {
            const editor = (overlayInput.value as any).getEditorElement?.()
            if (editor) {
              editor.focus()
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
      
      target.value = ''
    }
  }
  
  /**
   * IME 代理 keydown 事件
   */
  function onImeKeyDown(e: KeyboardEvent, helpers: {
    ensureVisible: (row: number, col: number) => void
  }) {
    if (imeState.isComposing) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setTimeout(() => {
          if (imeProxy.value) {
            imeState.cursorPos = imeProxy.value.selectionStart || 0
            onDraw()
          }
        }, 0)
      }
      return
    }
    
    // Enter 键
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      if (selected.row >= 0 && selected.col >= 0) {
        let newRow = selected.row + 1
        let newCol = selected.col
        if (newRow >= constants.DEFAULT_ROWS) {
          newRow = 0
          newCol = selected.col + 1
          if (newCol >= constants.DEFAULT_COLS) {
            newCol = constants.DEFAULT_COLS - 1
          }
        }
        selected.row = newRow
        selected.col = newCol
        selectionRange.startRow = newRow
        selectionRange.startCol = newCol
        selectionRange.endRow = newRow
        selectionRange.endCol = newCol
        helpers.ensureVisible(newRow, newCol)
        onDraw()
      }
      return
    }
    
    // F2 键
    if (e.key === 'F2') {
      e.preventDefault()
      e.stopPropagation()
      if (selected.row >= 0 && selected.col >= 0 && !overlay.visible) {
        const editValue = formulaSheet.getDisplayValue(selected.row, selected.col)
        openOverlay(selected.row, selected.col, editValue, 'edit')
      }
      return
    }
    
    // Delete 和 Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      if (selected.row >= 0 && selected.col >= 0) {
        formulaSheet.setValue(selected.row, selected.col, '')
        onDraw()
      }
      return
    }
    
    // 导航键 - 不处理，让事件冒泡
    const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'Home', 'End', 'PageUp', 'PageDown']
    if (navigationKeys.includes(e.key)) {
      return
    }
    
    // Ctrl/Cmd 组合键 - 不处理
    if (e.ctrlKey || e.metaKey) {
      return
    }
  }
  
  /**
   * composition start 事件（用于 window 级别）
   */
  function onCompositionStart(e: CompositionEvent) {
    if (e.target === imeProxy.value) {
      return
    }
    
    if (!overlay.visible) {
      if (selected.row < 0 || selected.col < 0) return
      openOverlay(selected.row, selected.col, '', 'typing')
    }
  }
  
  // 监听 overlay 可见性变化
  watch(() => overlay.visible, () => {
    updateFormulaReferences()
  })
  
  return {
    // Overlay 方法
    openOverlay,
    onOverlaySave,
    onOverlayCancel,
    
    // IME 方法
    focusImeProxy,
    onImeCompositionStart,
    onImeCompositionUpdate,
    onImeCompositionEnd,
    onImeInput,
    onImeKeyDown,
    onCompositionStart
  }
}

export type SheetInput = ReturnType<typeof useSheetInput>
