/**
 * useSheetClipboard - 电子表格剪贴板 composable
 * 封装复制、粘贴相关的方法
 */

import {
  copySingleCell,
  copyRange,
  pasteInternal,
  pasteExternal,
  parseClipboardText,
  writeToClipboard,
  readFromClipboard,
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
    internalClipboard, lastCopyTs
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
    
    if (selectionRange.startRow === -1) {
      // 如果没有选区，复制当前单元格
      result = await copySingleCell(selected.row, selected.col, source)
      internalClipboard.startRow = selected.row
      internalClipboard.startCol = selected.col
    } else {
      // 复制选区范围
      const { startRow, startCol, endRow, endCol } = selectionRange
      result = await copyRange(startRow, startCol, endRow, endCol, source)
      internalClipboard.startRow = startRow
      internalClipboard.startCol = startCol
    }
    
    // 保存到内部剪贴板
    internalClipboard.data = result.internalData as InternalClipboardCell[][]
    internalClipboard.mergedRegions = result.mergedRegions
    lastCopyTs.value = Date.now()
    
    // 写入系统剪贴板
    const success = await writeToClipboard(result.tsv)
    if (success) {
      console.log('Copied to clipboard (TSV format):', result.tsv.substring(0, 100) + (result.tsv.length > 100 ? '...' : ''))
    }
  }
  
  /**
   * 从剪贴板粘贴
   * 支持：
   * 1. 从 Excel 复制的数据（TSV 格式）
   * 2. 从本表复制的数据（包含公式）
   * 3. 自动处理相对/绝对引用（$符号）
   * 4. 样式、格式、边框、合并单元格
   * 5. Excel 行为：无论是否有选区，都从左上角开始粘贴剪贴板数据，然后选中被影响的区域
   */
  async function onPaste() {
    // 确定粘贴起始位置
    const destStartRow = selectionRange.startRow !== -1 ? selectionRange.startRow : selected.row
    const destStartCol = selectionRange.startCol !== -1 ? selectionRange.startCol : selected.col
    
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
    
    // 优先使用内部剪贴板
    if (internalClipboard.data && isInternalClipboardValid(lastCopyTs.value)) {
      console.log('Pasting from internal clipboard with formula metadata')
      
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
      console.log(`Pasted from internal clipboard, selected range: (${destStartRow},${destStartCol}) to (${pasteEndRow},${pasteEndCol})`)
      return
    }
    
    // 从系统剪贴板粘贴
    const text = await readFromClipboard()
    if (!text) return
    
    console.log('Pasting text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''))
    
    const data = parseClipboardText(text)
    
    console.log(`Pasting ${data.length} rows to (${destStartRow}, ${destStartCol})`)
    
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
    
    onDraw()
    console.log(`Pasted from clipboard, selected range: (${destStartRow},${destStartCol}) to (${pasteEndRow},${pasteEndCol})`)
  }
  
  return {
    onCopy,
    onPaste
  }
}

export type SheetClipboard = ReturnType<typeof useSheetClipboard>
