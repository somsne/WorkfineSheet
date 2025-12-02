/**
 * useSheetClipboard - 电子表格剪贴板 composable
 * 封装复制、粘贴相关的方法
 * 支持两种模式：
 * 1. 内部模式：剪贴板状态存储在 Sheet 层级（单 Sheet 使用）
 * 2. 外部模式：剪贴板状态由外部管理（Workbook 多 Sheet 模式）
 */

import {
  copySingleCell,
  copyRange as copyRangeToClipboard,
  pasteInternal,
  pasteExternal,
  parseClipboardText,
  parseExcelHtml,
  writeToClipboardWithHtml,
  isInternalClipboardValid,
  type CopySource,
  type PasteTarget
} from '../clipboard'
import type { SheetState, InternalClipboardCell } from './useSheetState'
import type { WorkbookClipboard } from '../types'

export interface UseSheetClipboardOptions {
  state: SheetState
  onDraw: () => void
  /** 外部剪贴板（Workbook 层级，可选） */
  externalClipboard?: () => WorkbookClipboard | null
  /** 剪贴板变化回调（复制时调用） */
  onClipboardChange?: (clipboard: WorkbookClipboard) => void
  /** 剪贴板清除回调（ESC 取消时调用） */
  onClipboardClear?: () => void
  /** 跨 Sheet 剪切源清除回调（粘贴剪切内容时，源在其他 Sheet） */
  onCutSourceClear?: (payload: {
    sourceSheetId: string
    startRow: number
    startCol: number
    height: number
    width: number
  }) => void
}

export function useSheetClipboard({ 
  state, 
  onDraw,
  externalClipboard,
  onClipboardChange,
  onClipboardClear,
  onCutSourceClear
}: UseSheetClipboardOptions) {
  const {
    formulaSheet,
    selected, selectionRange,
    internalClipboard, lastCopyTs,
    copyRange
  } = state
  
  /**
   * 获取当前有效的剪贴板数据
   * 优先使用外部剪贴板（Workbook 层级）
   */
  function getClipboardData() {
    const external = externalClipboard?.()
    if (external && external.data) {
      return {
        data: external.data,
        startRow: external.startRow,
        startCol: external.startCol,
        mergedRegions: external.mergedRegions,
        tsvContent: external.tsvContent,
        copyTs: external.copyTs,
        isCut: external.isCut,
        sourceSheetId: external.sourceSheetId
      }
    }
    // 回退到内部剪贴板
    return {
      data: internalClipboard.data,
      startRow: internalClipboard.startRow,
      startCol: internalClipboard.startCol,
      mergedRegions: internalClipboard.mergedRegions,
      tsvContent: internalClipboard.tsvContent,
      copyTs: lastCopyTs.value,
      isCut: false,
      sourceSheetId: null as string | null
    }
  }
  
  /**
   * 复制选区到剪贴板
   * 支持 Excel 互操作：使用 TSV (Tab-separated values) 格式
   * @param isCut 是否为剪切操作（剪切时粘贴后会清除源区域）
   * @param clipboardEvent 可选的剪贴板事件，用于使用 clipboardData.setData（更好的 Excel 兼容性）
   * @returns 返回 { tsv, html } 以便在 copy 事件中使用
   */
  async function onCopy(isCut: boolean = false, clipboardEvent?: ClipboardEvent): Promise<{ tsv: string; html: string } | null> {
    const model = formulaSheet.getModel()
    
    const source: CopySource = {
      getValue: (r: number, c: number) => formulaSheet.getValue(r, c),
      getRawValue: (r: number, c: number) => model.getValue(r, c),
      getCellStyle: (r: number, c: number) => model.getCellStyle(r, c),
      getCellBorder: (r: number, c: number) => model.getCellBorder(r, c),
      getCellFormat: (r: number, c: number) => model.getCellFormat(r, c),
      hasCellStyle: (r: number, c: number) => model.hasCellStyle(r, c),
      hasCellBorder: (r: number, c: number) => model.hasCellBorder(r, c),
      hasCellFormat: (r: number, c: number) => model.hasCellFormat(r, c),
      getMergedRegion: (r: number, c: number) => model.getMergedRegion(r, c)
    }

    let result
    let copyStartRow: number
    let copyStartCol: number
    let copyEndRow: number
    let copyEndCol: number
    
    if (selectionRange.startRow === -1) {
      // 如果没有选区，复制当前单元格
      result = await copySingleCell(selected.row, selected.col, source)
      copyStartRow = copyEndRow = selected.row
      copyStartCol = copyEndCol = selected.col
    } else {
      // 复制选区范围
      const { startRow, startCol, endRow, endCol } = selectionRange
      result = await copyRangeToClipboard(startRow, startCol, endRow, endCol, source)
      copyStartRow = startRow
      copyStartCol = startCol
      copyEndRow = endRow
      copyEndCol = endCol
    }
    
    const newCopyTs = Date.now()
    
    // 如果有外部剪贴板回调，通知外部（Workbook 层级）
    if (onClipboardChange) {
      onClipboardChange({
        data: result.internalData as InternalClipboardCell[][],
        startRow: copyStartRow,
        startCol: copyStartCol,
        mergedRegions: result.mergedRegions,
        tsvContent: result.tsv,
        copyTs: newCopyTs,
        sourceSheetId: null, // 由外部填充
        copyRange: {
          startRow: copyStartRow,
          startCol: copyStartCol,
          endRow: copyEndRow,
          endCol: copyEndCol
        },
        isCut
      })
    } else {
      // 内部模式：保存到内部剪贴板
      internalClipboard.data = result.internalData as InternalClipboardCell[][]
      internalClipboard.startRow = copyStartRow
      internalClipboard.startCol = copyStartCol
      internalClipboard.mergedRegions = result.mergedRegions
      internalClipboard.tsvContent = result.tsv
      lastCopyTs.value = newCopyTs
    }
    
    // 设置复制区域范围（用于绘制蚂蚁线）
    copyRange.startRow = copyStartRow
    copyRange.startCol = copyStartCol
    copyRange.endRow = copyEndRow
    copyRange.endCol = copyEndCol
    copyRange.visible = true
    
    // 触发重绘以显示蚂蚁线
    onDraw()
    
    // 如果提供了剪贴板事件，使用 clipboardData.setData（更好的 Excel 兼容性）
    if (clipboardEvent && clipboardEvent.clipboardData) {
      clipboardEvent.preventDefault()
      clipboardEvent.clipboardData.setData('text/plain', result.tsv)
      clipboardEvent.clipboardData.setData('text/html', result.html)
    } else {
      // 回退：使用 Clipboard API（可能对某些应用兼容性较差）
      await writeToClipboardWithHtml(result.tsv, result.html)
    }
    
    return { tsv: result.tsv, html: result.html }
  }
  
  /**
   * 剪切选区到剪贴板
   * 与复制类似，但粘贴后会清除源区域内容和格式
   * @param clipboardEvent 可选的剪贴板事件，用于使用 clipboardData.setData（更好的 Excel 兼容性）
   */
  async function onCut(clipboardEvent?: ClipboardEvent) {
    await onCopy(true, clipboardEvent)
  }
  
  /**
   * 清除复制区域蚂蚁线和内部剪贴板
   */
  function clearCopyRange() {
    copyRange.startRow = -1
    copyRange.startCol = -1
    copyRange.endRow = -1
    copyRange.endCol = -1
    copyRange.visible = false
    
    // 如果有外部剪贴板回调，通知外部清除
    if (onClipboardClear) {
      onClipboardClear()
    } else {
      // 内部模式：清除内部剪贴板数据
      internalClipboard.data = null
      internalClipboard.startRow = -1
      internalClipboard.startCol = -1
      internalClipboard.tsvContent = ''
      internalClipboard.mergedRegions = []
      lastCopyTs.value = 0
    }
    
    onDraw()
  }
  
  /**
   * 清除源区域内容和格式（用于剪切操作）
   */
  function clearSourceRange(startRow: number, startCol: number, height: number, width: number) {
    const model = formulaSheet.getModel()
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const row = startRow + r
        const col = startCol + c
        // 清除值
        formulaSheet.setValue(row, col, '')
        // 清除样式
        model.clearCellStyle(row, col)
        // 清除边框
        model.clearCellBorder(row, col)
        // 清除格式
        model.clearCellFormat(row, col)
        // 解除合并（如果是合并区域的左上角）
        const merged = model.getMergedRegion(row, col)
        if (merged && merged.startRow === row && merged.startCol === col) {
          model.unmergeCells(row, col)
        }
      }
    }
  }
  
  /**
   * 从剪贴板粘贴
   * 支持：
   * 1. 从 Excel 复制的 HTML 格式数据（包含样式）
   * 2. 从 Excel 复制的 TSV 格式数据（纯文本）
   * 3. 从本表复制的数据（包含公式）
   * 4. 自动处理相对/绝对引用（$符号）
   * 5. 样式、格式、边框、合并单元格
   * 6. Excel 行为：无论是否有选区，都从左上角开始粘贴剪贴板数据，然后选中被影响的区域
   * @param clipboardText 从 paste 事件获取的剪贴板文本（可选）
   * @param clipboardHtml 从 paste 事件获取的 HTML 格式数据（可选）
   */
  async function onPaste(clipboardText?: string, clipboardHtml?: string) {
    // 确定粘贴起始位置
    const destStartRow = selectionRange.startRow !== -1 ? selectionRange.startRow : selected.row
    const destStartCol = selectionRange.startCol !== -1 ? selectionRange.startCol : selected.col
    
    // 检查粘贴位置是否有效
    if (destStartRow < 0 || destStartCol < 0) {
      return
    }
    
    const model = formulaSheet.getModel()
    
    const target: PasteTarget = {
      setValue: (r: number, c: number, v: string) => formulaSheet.setValue(r, c, v),
      copyCell: (sr: number, sc: number, dr: number, dc: number) => formulaSheet.copyCell(sr, sc, dr, dc),
      setCellStyle: (r: number, c: number, style) => model.setCellStyle(r, c, style),
      setCellBorder: (r: number, c: number, border) => model.setCellBorder(r, c, border),
      setCellFormat: (r: number, c: number, format) => model.setCellFormat(r, c, format),
      clearCellStyle: (r: number, c: number) => model.clearCellStyle(r, c),
      clearCellBorder: (r: number, c: number) => model.clearCellBorder(r, c),
      clearCellFormat: (r: number, c: number) => model.clearCellFormat(r, c),
      mergeCells: (sr: number, sc: number, er: number, ec: number) => model.mergeCells(sr, sc, er, ec),
      unmergeCells: (r: number, c: number) => model.unmergeCells(r, c)
    }
    
    // 使用传入的剪贴板文本
    const text = clipboardText ?? null
    
    // 获取剪贴板数据（优先外部，回退内部）
    const clipboardData = getClipboardData()
    
    // 优先使用内部剪贴板
    if (clipboardData.data && isInternalClipboardValid(clipboardData.copyTs)) {
      // 如果系统剪贴板可读，检查内容是否匹配
      // 如果系统剪贴板不可读(text为null)，假设用户没有从外部复制新内容，直接使用内部剪贴板
      const shouldUseInternal = !text || (clipboardData.tsvContent && text.trim() === clipboardData.tsvContent.trim())
      
      if (shouldUseInternal) {
        const dataHeight = clipboardData.data.length
        const dataWidth = Math.max(...clipboardData.data.map(row => row.length))
        
        pasteInternal(
          clipboardData.data,
          clipboardData.startRow,
          clipboardData.startCol,
          destStartRow,
          destStartCol,
          target,
          clipboardData.mergedRegions
        )
        
        // 粘贴后选中所有被影响的单元格
        const pasteEndRow = destStartRow + dataHeight - 1
        const pasteEndCol = destStartCol + dataWidth - 1
        
        selectionRange.startRow = destStartRow
        selectionRange.startCol = destStartCol
        selectionRange.endRow = pasteEndRow
        selectionRange.endCol = pasteEndCol
        
        // 如果是剪切操作，清除源区域内容和格式
        if (clipboardData.isCut) {
          if (!clipboardData.sourceSheetId) {
            // 内部模式（单 Sheet）：直接清除源区域
            clearSourceRange(clipboardData.startRow, clipboardData.startCol, dataHeight, dataWidth)
          } else if (onCutSourceClear) {
            // 外部模式（多 Sheet）：发出清除事件，由 Workbook 层处理
            onCutSourceClear({
              sourceSheetId: clipboardData.sourceSheetId,
              startRow: clipboardData.startRow,
              startCol: clipboardData.startCol,
              height: dataHeight,
              width: dataWidth
            })
          }
          // 剪切完成后清除剪贴板（剪切只能粘贴一次）
          clearCopyRange()
        }
        
        onDraw()
        return
      } else {
        // 系统剪贴板内容已变化（用户从外部复制了新内容），清除内部剪贴板和蚂蚁线
        clearCopyRange()
      }
    }
    
    // 从系统剪贴板粘贴（优先使用 HTML 格式，包含样式信息）
    if (!text && !clipboardHtml) {
      return
    }
    
    // 尝试解析 HTML 格式（来自 Excel 的富文本）
    const htmlResult = clipboardHtml ? parseExcelHtml(clipboardHtml) : null
    
    if (htmlResult && htmlResult.data.length > 0) {
      // 使用 HTML 格式粘贴（包含样式、边框、合并单元格）
      const dataHeight = htmlResult.data.length
      const dataWidth = Math.max(...htmlResult.data.map(row => row.length), 0)
      
      pasteInternal(
        htmlResult.data,
        0, // HTML 解析的数据从 0,0 开始
        0,
        destStartRow,
        destStartCol,
        target,
        htmlResult.mergedRegions
      )
      
      // 粘贴后选中所有被影响的单元格
      const pasteEndRow = destStartRow + dataHeight - 1
      const pasteEndCol = destStartCol + dataWidth - 1
      
      selectionRange.startRow = destStartRow
      selectionRange.startCol = destStartCol
      selectionRange.endRow = pasteEndRow
      selectionRange.endCol = pasteEndCol
      
      // 清除蚂蚁线（粘贴了外部内容）
      if (copyRange.visible) {
        clearCopyRange()
      }
      
      onDraw()
      return
    }
    
    // 回退到纯文本格式
    if (!text) {
      return
    }
    
    const data = parseClipboardText(text)
    
    const dataHeight = data.length
    const dataWidth = Math.max(...data.map(row => row.length), 0)
    
    pasteExternal(data, destStartRow, destStartCol, target)
    
    // 粘贴后选中所有被影响的单元格
    const pasteEndRow = destStartRow + dataHeight - 1
    const pasteEndCol = destStartCol + dataWidth - 1
    
    selectionRange.startRow = destStartRow
    selectionRange.startCol = destStartCol
    selectionRange.endRow = pasteEndRow
    selectionRange.endCol = pasteEndCol
    
    // 检查粘贴内容是否与蚂蚁线区域内容匹配
    // 如果有蚂蚁线且内容不匹配（用户粘贴了外部内容），清除蚂蚁线
    if (copyRange.visible && clipboardData.tsvContent) {
      const contentMatches = text.trim() === clipboardData.tsvContent.trim()
      if (!contentMatches) {
        clearCopyRange()
      }
    }
    
    onDraw()
  }
  
  /**
   * 检查是否有有效的内部剪贴板数据
   */
  function hasInternalClipboard(): boolean {
    const clipboardData = getClipboardData()
    return !!(clipboardData.data && isInternalClipboardValid(clipboardData.copyTs))
  }
  
  /**
   * 同步外部剪贴板状态到本地蚂蚁线显示
   * 由外部调用，当切换 Sheet 时恢复蚂蚁线
   */
  function syncCopyRangeFromExternal(externalCopyRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null) {
    if (externalCopyRange) {
      copyRange.startRow = externalCopyRange.startRow
      copyRange.startCol = externalCopyRange.startCol
      copyRange.endRow = externalCopyRange.endRow
      copyRange.endCol = externalCopyRange.endCol
      copyRange.visible = true
    } else {
      copyRange.startRow = -1
      copyRange.startCol = -1
      copyRange.endRow = -1
      copyRange.endCol = -1
      copyRange.visible = false
    }
  }
  
  return {
    onCopy,
    onCut,
    onPaste,
    clearCopyRange,
    clearSourceRange,
    hasInternalClipboard,
    syncCopyRangeFromExternal
  }
}

export type SheetClipboard = ReturnType<typeof useSheetClipboard>
