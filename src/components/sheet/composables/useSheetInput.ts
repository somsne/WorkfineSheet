/**
 * useSheetInput - 电子表格输入处理 composable
 * 封装所有输入相关的方法：IME 处理、overlay 编辑器、公式引用等
 */

import { nextTick, watch } from 'vue'
import { openOverlay as openOverlayHelper, closeOverlay, getNextCellAfterSave, getNextCellRight } from '../overlay'
import { parseAllFormulaReferences } from '../references'
import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'

/** UndoRedo 执行器接口（支持自定义包装器） */
interface UndoRedoExecutor {
  execute(action: { name: string; undo: () => void; redo: () => void }): void
  record(action: { name: string; undo: () => void; redo: () => void }): void
}

export interface UseSheetInputOptions {
  state: SheetState
  geometry: SheetGeometry
  onDraw: () => void
  /** 可选的 UndoRedo 执行器，如果提供则使用它而不是 state.undoRedo */
  undoRedoExecutor?: UndoRedoExecutor
  /** 单元格值变化回调（删除内容后调用，用于更新 FormulaBar） */
  onCellValueChange?: () => void
}

export function useSheetInput({ state, geometry, onDraw, undoRedoExecutor, onCellValueChange }: UseSheetInputOptions) {
  const {
    constants,
    overlayInput, imeProxy,
    formulaSheet, undoRedo,
    viewport,
    selected, selectionRange,
    overlay, imeState,
    formulaReferences, updateFormulaReferences,
    rowHeights, manualRowHeights, model,
    copyRange, internalClipboard, lastCopyTs
  } = state
  
  // 使用传入的执行器或默认的 state.undoRedo
  const undoRedoExec = undoRedoExecutor ?? undoRedo
  
  const { createSizeAccess, createGeometryConfig, getRowHeight, getColWidth, getRowTop, getColLeft } = geometry
  
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
  
  // ==================== Overlay 编辑器 ====================
  
  /**
   * 打开编辑器覆盖层
   */
  function openOverlay(row: number, col: number, initialValue: string, mode: 'edit' | 'typing' = 'edit') {
    const overlayState = openOverlayHelper(row, col, initialValue, mode, viewport, createSizeAccess(), createGeometryConfig())
    Object.assign(overlay, overlayState)
    
    // 🔧 关键修复：如果初始值是公式，立即初始化公式引用
    // 这样编辑已有公式的单元格时，高亮边框会立即显示
    if (initialValue.startsWith('=')) {
      formulaReferences.value = parseAllFormulaReferences(initialValue)
    } else {
      formulaReferences.value = []
    }
    
    onDraw()
  }
  
  /**
   * 移动方向类型
   */
  type MoveDirection = 'down' | 'right' | 'none'
  
  /**
   * 保存操作参数
   */
  interface SaveOptions {
    /** 可选的目标行（默认使用 selected.row，即当前活动单元格） */
    row?: number
    /** 可选的目标列（默认使用 selected.col，即当前活动单元格） */
    col?: number
  }
  
  /**
   * 核心保存逻辑（内部使用）
   * 
   * 设计说明：
   * - row/col 优先使用传入值，否则使用 selected（当前活动单元格）
   * - selected 是 Sheet 的核心状态，FormulaBar 和 Overlay 都响应它
   * - overlay.row/col 只用于 overlay 的定位，不作为数据源
   * 
   * @param val 要保存的值
   * @param direction 保存后移动方向
   * @param options 可选参数（row/col）
   */
  function saveAndMove(val: string, direction: MoveDirection, options?: SaveOptions) {
    // 使用传入的 row/col 或从 selected（当前活动单元格）获取
    const row = options?.row ?? selected.row
    const col = options?.col ?? selected.col
    
    // 验证 row/col 是否有效
    if (row < 0 || col < 0) {
      console.warn('[useSheetInput] saveAndMove: invalid row/col', { row, col, selected: { row: selected.row, col: selected.col } })
      return
    }
    
    // 如果 overlay 可见，需要关闭它
    const shouldCloseOverlay = overlay.visible
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
      // 如果修改了复制区域内的单元格，清除蚂蚁线
      checkAndClearCopyRange(row, col)
      
      undoRedoExec.execute({
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
    
    // 自动调整行高（仅当设置了自动换行且用户未手动设置行高时）
    const cellStyle = model.getCellStyle(row, col)
    const isWrapText = cellStyle.wrapText ?? false
    const isManualRowHeight = manualRowHeights.value.has(row)
    
    if (isWrapText && !isManualRowHeight && val) {
      const colWidth = getColWidth(col)
      const requiredHeight = calculateRequiredRowHeight(val, colWidth, cellStyle)
      const currentHeight = getRowHeight(row)
      
      if (requiredHeight > currentHeight) {
        rowHeights.value.set(row, requiredHeight)
      }
    }
    
    // 关闭覆盖层（如果可见）
    if (shouldCloseOverlay) {
      Object.assign(overlay, closeOverlay())
    }
    formulaReferences.value = []
    
    // 根据方向移动到下一个单元格
    if (direction !== 'none') {
      const nextCell = direction === 'down'
        ? getNextCellAfterSave(row, col, constants.DEFAULT_ROWS, constants.DEFAULT_COLS)
        : getNextCellRight(row, col, constants.DEFAULT_ROWS, constants.DEFAULT_COLS)
      
      // 同步更新 selected 和 selectionRange（保持一致性）
      selected.row = nextCell.row
      selected.col = nextCell.col
      selectionRange.startRow = nextCell.row
      selectionRange.startCol = nextCell.col
      selectionRange.endRow = nextCell.row
      selectionRange.endCol = nextCell.col
    }
    
    onDraw()
    
    // 编辑完成后，聚焦 IME 代理以便继续输入
    focusImeProxy()
  }
  
  /**
   * Enter 键保存编辑内容并向下移动
   * @param val 要保存的值
   * @param options 可选参数（row/col，用于从 FormulaBar 编辑时传入）
   */
  function onOverlayEnter(val: string, options?: SaveOptions) {
    saveAndMove(val, 'down', options)
  }
  
  /**
   * Tab 键保存编辑内容并向右移动
   * @param val 要保存的值
   * @param options 可选参数（row/col，用于从 FormulaBar 编辑时传入）
   */
  function onOverlayTab(val: string, options?: SaveOptions) {
    saveAndMove(val, 'right', options)
  }
  
  /**
   * 失焦保存编辑内容（不移动）
   * @param val 要保存的值
   * @param options 可选参数（row/col，用于从 FormulaBar 编辑时传入）
   */
  function onOverlayBlur(val: string, options?: SaveOptions) {
    saveAndMove(val, 'none', options)
  }
  
  /**
   * 保存编辑内容（兼容旧 API）
   * @param val 要保存的值
   * @param moveToNext 保存后是否移动到下一个单元格（默认 true，向下移动）
   */
  function onOverlaySave(val: string, moveToNext: boolean = true) {
    saveAndMove(val, moveToNext ? 'down' : 'none')
  }
  
  /**
   * 计算文本所需的行高（用于自动换行单元格）
   * 注意：lineHeight 必须与 renderCells.ts 中保持一致（1.2）
   * padding 必须与 renderCells.ts 中的 wrapText 一致（4px）
   */
  function calculateRequiredRowHeight(
    text: string,
    containerWidth: number,
    cellStyle: { fontFamily?: string; fontSize?: number; bold?: boolean; italic?: boolean }
  ): number {
    // 创建临时测量元素
    // padding = 4 与 renderCells.ts wrapText 函数一致
    const measureSpan = document.createElement('span')
    measureSpan.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-break: break-all;
      width: ${containerWidth - 4}px;
      font-family: ${cellStyle.fontFamily || 'Arial, sans-serif'};
      font-size: ${cellStyle.fontSize || 12}px;
      font-weight: ${cellStyle.bold ? 'bold' : 'normal'};
      font-style: ${cellStyle.italic ? 'italic' : 'normal'};
      line-height: ${(cellStyle.fontSize || 12) * 1.2}px;
      display: block;
    `
    document.body.appendChild(measureSpan)
    measureSpan.textContent = text || ' '
    const height = measureSpan.offsetHeight
    document.body.removeChild(measureSpan)
    
    // 添加一些 padding
    return height + 4
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
        // 如果修改了复制区域内的单元格，清除蚂蚁线
        checkAndClearCopyRange(selected.row, selected.col)
        formulaSheet.setValue(selected.row, selected.col, '')
        onDraw()
        // 通知 FormulaBar 更新
        onCellValueChange?.()
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
    onOverlayEnter,
    onOverlayTab,
    onOverlayBlur,
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
