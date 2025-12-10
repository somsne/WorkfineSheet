/**
 * useSheetInput - 电子表格输入处理 composable
 * 封装所有输入相关的方法：IME 处理、单元格编辑等
 * 
 * 注意：Overlay UI 由 WorkbookSheet 管理，本模块只负责：
 * 1. 通知 WorkbookSheet 打开/关闭 overlay
 * 2. 保存单元格值
 * 3. 移动选区
 * 4. IME 输入处理
 */

import { watch } from 'vue'
import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'

/** UndoRedo 执行器接口（支持自定义包装器） */
interface UndoRedoExecutor {
  execute(action: { name: string; undo: () => void; redo: () => void }): void
  record(action: { name: string; undo: () => void; redo: () => void }): void
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

export interface UseSheetInputOptions {
  state: SheetState
  geometry: SheetGeometry
  onDraw: () => void
  /** 可选的 UndoRedo 执行器，如果提供则使用它而不是 state.undoRedo */
  undoRedoExecutor?: UndoRedoExecutor
  /** 当前 Sheet ID */
  sheetId?: string
  /** 打开 Overlay 的回调 */
  onOpenOverlay?: (payload: OpenOverlayPayload) => void
  /** 单元格值变化回调（用于通知 FormulaBar 更新） */
  onCellValueChange?: (row: number, col: number, value: string) => void
}

export function useSheetInput({ 
  state, 
  geometry, 
  onDraw,
  onOpenOverlay,
  onCellValueChange,
  undoRedoExecutor
}: UseSheetInputOptions) {
  const {
    constants,
    overlayInput, imeProxy,
    formulaSheet,
    viewport,
    selected, selectionRange,
    overlay, imeState,
    updateFormulaReferences,
    copyRange, internalClipboard, lastCopyTs,
    totalRows, totalCols,
    undoRedo
  } = state
  
  
  const { getRowHeight, getColWidth, getRowTop, getColLeft } = geometry
  
  /**
   * 检查并清除复制区域（如果被修改的单元格在复制区域内）
   */
  function checkAndClearCopyRange(row: number, col: number) {
    if (!copyRange.visible) return
    
    // 检查单元格是否在复制区域内
    if (row >= copyRange.startRow && row <= copyRange.endRow &&
        col >= copyRange.startCol && col <= copyRange.endCol) {
      // 清除蚂蚁线和内部剪贴板
      copyRange.startRow = -1
      copyRange.startCol = -1
      copyRange.endRow = -1
      copyRange.endCol = -1
      copyRange.visible = false
      internalClipboard.data = null
      internalClipboard.startRow = -1
      internalClipboard.startCol = -1
      internalClipboard.tsvContent = ''
      internalClipboard.mergedRegions = []
      lastCopyTs.value = 0
    }
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
      if (!overlay.visible && onOpenOverlay) {
        // 计算单元格位置
        const row = selected.row
        const col = selected.col
        const top = constants.COL_HEADER_HEIGHT + getRowTop(row) - viewport.scrollTop
        const left = constants.ROW_HEADER_WIDTH + getColLeft(col) - viewport.scrollLeft
        const width = getColWidth(col)
        const height = getRowHeight(row)
        const cellStyle = state.model.getCellStyle(row, col)
        
        // 通知打开 overlay（带上 IME 输入的文字）
        onOpenOverlay({
          row,
          col,
          value: finalText,
          top,
          left,
          width,
          height,
          mode: 'typing',
          cellStyle
        })
      } else if (overlay.visible) {
        // overlay 已经打开，插入文字到现有内容
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
      if (!overlay.visible && onOpenOverlay) {
        // 计算单元格位置
        const row = selected.row
        const col = selected.col
        const top = constants.COL_HEADER_HEIGHT + getRowTop(row) - viewport.scrollTop
        const left = constants.ROW_HEADER_WIDTH + getColLeft(col) - viewport.scrollLeft
        const width = getColWidth(col)
        const height = getRowHeight(row)
        const cellStyle = state.model.getCellStyle(row, col)
        
        // 通知打开 overlay
        onOpenOverlay({
          row,
          col,
          value,  // 用户输入的字符
          top,
          left,
          width,
          height,
          mode: 'typing',
          cellStyle
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
        if (newRow >= totalRows.value) {
          newRow = 0
          newCol = selected.col + 1
          if (newCol >= totalCols.value) {
            newCol = totalCols.value - 1
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
      return
    }
    
    // Delete 和 Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      if (selected.row >= 0 && selected.col >= 0) {
        // 如果修改了复制区域内的单元格，清除蚂蚁线
        checkAndClearCopyRange(selected.row, selected.col)
        
        // 确定要清空的范围（选区或单个单元格）
        const startRow = selectionRange.startRow >= 0 ? selectionRange.startRow : selected.row
        const startCol = selectionRange.startCol >= 0 ? selectionRange.startCol : selected.col
        const endRow = selectionRange.endRow >= 0 ? selectionRange.endRow : selected.row
        const endCol = selectionRange.endCol >= 0 ? selectionRange.endCol : selected.col
        
        // 保存旧值用于撤销（二维数组）
        const oldValues: string[][] = []
        let hasContent = false
        for (let r = startRow; r <= endRow; r++) {
          const rowValues: string[] = []
          for (let c = startCol; c <= endCol; c++) {
            const val = formulaSheet.getDisplayValue(r, c) ?? ''
            rowValues.push(val)
            if (val !== '') hasContent = true
          }
          oldValues.push(rowValues)
        }
        
        // 如果选区内没有内容，不需要执行删除操作
        if (!hasContent) {
          return
        }
        
        // 使用 undoRedo 执行删除操作（支持撤销）
        const executor = undoRedoExecutor ?? undoRedo
        executor.execute({
          name: '删除单元格内容',
          redo: () => {
            for (let r = startRow; r <= endRow; r++) {
              for (let c = startCol; c <= endCol; c++) {
                formulaSheet.setValue(r, c, '')
              }
            }
            onDraw()
            // 通知 FormulaBar 更新（使用选区起始单元格）
            onCellValueChange?.(startRow, startCol, '')
          },
          undo: () => {
            for (let r = startRow; r <= endRow; r++) {
              for (let c = startCol; c <= endCol; c++) {
                const oldVal = oldValues[r - startRow]?.[c - startCol] ?? ''
                formulaSheet.setValue(r, c, oldVal)
              }
            }
            onDraw()
            onCellValueChange?.(startRow, startCol, oldValues[0]?.[0] ?? '')
          }
        })
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
    // 如果是 IME 代理的事件，跳过（会由 onImeCompositionStart 处理）
    if (e.target === imeProxy.value) {
      return
    }
    
    // 如果事件来自其他输入元素（如 FormulaBar），不处理
    const target = e.target as HTMLElement
    if (target) {
      const tagName = target.tagName.toLowerCase()
      const isContentEditable = target.isContentEditable
      if (tagName === 'input' || tagName === 'textarea' || isContentEditable) {
        return
      }
    }
    
    if (!overlay.visible) {
      if (selected.row < 0 || selected.col < 0) return
      // requestOpenOverlay(selected.row, selected.col, '', 'typing')
    }
  }
  
  // 监听 overlay 可见性变化
  watch(() => overlay.visible, () => {
    updateFormulaReferences()
  })
  
  return {
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
