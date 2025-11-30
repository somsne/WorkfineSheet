/**
 * useSheetClipboard - 电子表格剪贴板 composable
 * 封装复制、粘贴相关的方法
 */

import {
  copySingleCell,
  copyRange as copyRangeToClipboard,
  pasteInternal,
  pasteExternal,
  parseClipboardText,
  writeToClipboard,
  isInternalClipboardValid,
  type CopySource,
  type PasteTarget
} from '../clipboard'
import type { SheetState, InternalClipboardCell } from './useSheetState'

export interface UseSheetClipboardOptions {
  state: SheetState
  onDraw: () => void
}

export function useSheetClipboard({ state, onDraw }: UseSheetClipboardOptions) {
  const {
    formulaSheet,
    selected, selectionRange,
    internalClipboard, lastCopyTs,
    copyRange
  } = state
  
  /**
   * 复制选区到剪贴板
   * 支持 Excel 互操作：使用 TSV (Tab-separated values) 格式
   */
  async function onCopy() {
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
      internalClipboard.startRow = selected.row
      internalClipboard.startCol = selected.col
      copyStartRow = copyEndRow = selected.row
      copyStartCol = copyEndCol = selected.col
    } else {
      // 复制选区范围
      const { startRow, startCol, endRow, endCol } = selectionRange
      result = await copyRangeToClipboard(startRow, startCol, endRow, endCol, source)
      internalClipboard.startRow = startRow
      internalClipboard.startCol = startCol
      copyStartRow = startRow
      copyStartCol = startCol
      copyEndRow = endRow
      copyEndCol = endCol
    }
    
    // 保存到内部剪贴板
    internalClipboard.data = result.internalData as InternalClipboardCell[][]
    internalClipboard.mergedRegions = result.mergedRegions
    internalClipboard.tsvContent = result.tsv  // 保存 TSV 内容用于比较
    lastCopyTs.value = Date.now()
    
    // 设置复制区域范围（用于绘制蚂蚁线）
    copyRange.startRow = copyStartRow
    copyRange.startCol = copyStartCol
    copyRange.endRow = copyEndRow
    copyRange.endCol = copyEndCol
    copyRange.visible = true
    
    // 触发重绘以显示蚂蚁线
    onDraw()
    
    // 写入系统剪贴板
    const success = await writeToClipboard(result.tsv)
    if (success) {
      console.log('Copied to clipboard (TSV format):', result.tsv.substring(0, 100) + (result.tsv.length > 100 ? '...' : ''))
    }
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
    // 清除内部剪贴板数据
    internalClipboard.data = null
    internalClipboard.startRow = -1
    internalClipboard.startCol = -1
    internalClipboard.tsvContent = ''
    internalClipboard.mergedRegions = []
    lastCopyTs.value = 0
    onDraw()
  }
  
  /**
   * 从剪贴板粘贴
   * 支持：
   * 1. 从 Excel 复制的数据（TSV 格式）
   * 2. 从本表复制的数据（包含公式）
   * 3. 自动处理相对/绝对引用（$符号）
   * 4. 样式、格式、边框、合并单元格
   * 5. Excel 行为：无论是否有选区，都从左上角开始粘贴剪贴板数据，然后选中被影响的区域
   * @param clipboardText 从 paste 事件获取的剪贴板文本（可选）
   */
  async function onPaste(clipboardText?: string) {
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
    
    // 优先使用内部剪贴板
    if (internalClipboard.data && isInternalClipboardValid(lastCopyTs.value)) {
      // 如果系统剪贴板可读，检查内容是否匹配
      // 如果系统剪贴板不可读(text为null)，假设用户没有从外部复制新内容，直接使用内部剪贴板
      const shouldUseInternal = !text || (internalClipboard.tsvContent && text.trim() === internalClipboard.tsvContent.trim())
      
      if (shouldUseInternal) {
        const dataHeight = internalClipboard.data.length
        const dataWidth = Math.max(...internalClipboard.data.map(row => row.length))
        
        pasteInternal(
          internalClipboard.data,
          internalClipboard.startRow,
          internalClipboard.startCol,
          destStartRow,
          destStartCol,
          target,
          internalClipboard.mergedRegions
        )
        
        // 粘贴后选中所有被影响的单元格
        const pasteEndRow = destStartRow + dataHeight - 1
        const pasteEndCol = destStartCol + dataWidth - 1
        
        selectionRange.startRow = destStartRow
        selectionRange.startCol = destStartCol
        selectionRange.endRow = pasteEndRow
        selectionRange.endCol = pasteEndCol
        
        onDraw()
        return
      } else {
        // 系统剪贴板内容已变化（用户从外部复制了新内容），清除内部剪贴板和蚂蚁线
        clearCopyRange()
      }
    }
    
    // 从系统剪贴板粘贴
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
    if (copyRange.visible && internalClipboard.tsvContent) {
      const contentMatches = text.trim() === internalClipboard.tsvContent.trim()
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
    return !!(internalClipboard.data && isInternalClipboardValid(lastCopyTs.value))
  }
  
  return {
    onCopy,
    onPaste,
    clearCopyRange,
    hasInternalClipboard
  }
}

export type SheetClipboard = ReturnType<typeof useSheetClipboard>
