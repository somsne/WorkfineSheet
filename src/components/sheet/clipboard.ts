/**
 * 剪贴板处理模块
 * 负责复制、粘贴操作，支持内部剪贴板（保留公式）和系统剪贴板（Excel 互操作）
 */

import type { InternalClipboardCell, CellStyle, CellBorder, CellFormat, MergedRegion } from './types'

export interface InternalClipboard {
  data: InternalClipboardCell[][] | null
  startRow: number
  startCol: number
  /** 复制区域内的合并单元格信息（相对坐标） */
  mergedRegions: Array<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  }>
}

export interface CopySource {
  getValue: (row: number, col: number) => string
  getRawValue: (row: number, col: number) => string
  getCellStyle: (row: number, col: number) => CellStyle
  getCellBorder: (row: number, col: number) => CellBorder | undefined
  getCellFormat: (row: number, col: number) => CellFormat | null
  hasCellStyle: (row: number, col: number) => boolean
  hasCellBorder: (row: number, col: number) => boolean
  hasCellFormat: (row: number, col: number) => boolean
  getMergedRegion: (row: number, col: number) => MergedRegion | null
}

export interface PasteTarget {
  setValue: (row: number, col: number, value: string) => void
  copyCell: (srcRow: number, srcCol: number, destRow: number, destCol: number) => void
  setCellStyle: (row: number, col: number, style: CellStyle) => void
  setCellBorder: (row: number, col: number, border: CellBorder) => void
  setCellFormat: (row: number, col: number, format: CellFormat) => void
  clearCellStyle: (row: number, col: number) => void
  clearCellBorder: (row: number, col: number) => void
  clearCellFormat: (row: number, col: number) => void
  mergeCells: (startRow: number, startCol: number, endRow: number, endCol: number) => void
  unmergeCells: (row: number, col: number) => void
}

/**
 * 复制单个单元格
 */
export async function copySingleCell(
  row: number,
  col: number,
  source: CopySource
): Promise<{ tsv: string; internalData: InternalClipboardCell[][]; mergedRegions: InternalClipboard['mergedRegions'] }> {
  const value = source.getValue(row, col)
  const rawValue = source.getRawValue(row, col)
  
  const cell: InternalClipboardCell = { 
    value: rawValue, 
    isFormula: rawValue.startsWith('=') 
  }
  
  // 复制样式
  if (source.hasCellStyle(row, col)) {
    cell.style = { ...source.getCellStyle(row, col) }
  }
  
  // 复制边框
  if (source.hasCellBorder(row, col)) {
    const border = source.getCellBorder(row, col)
    if (border) {
      cell.border = { ...border }
    }
  }
  
  // 复制格式
  if (source.hasCellFormat(row, col)) {
    const format = source.getCellFormat(row, col)
    if (format) {
      cell.format = { ...format }
    }
  }
  
  const internalData = [[cell]]
  
  // 检查合并单元格
  const mergedRegions: InternalClipboard['mergedRegions'] = []
  const merged = source.getMergedRegion(row, col)
  if (merged && merged.startRow === row && merged.startCol === col) {
    // 单个单元格复制时，合并区域相对坐标从 0,0 开始
    mergedRegions.push({
      startRow: 0,
      startCol: 0,
      endRow: merged.endRow - merged.startRow,
      endCol: merged.endCol - merged.startCol
    })
  }
  
  return {
    tsv: value,
    internalData,
    mergedRegions
  }
}

/**
 * 复制选区范围
 */
export async function copyRange(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  source: CopySource
): Promise<{ tsv: string; internalData: InternalClipboardCell[][]; mergedRegions: InternalClipboard['mergedRegions'] }> {
  let tsv = ''
  const internalData: InternalClipboardCell[][] = []
  const mergedRegions: InternalClipboard['mergedRegions'] = []
  const processedMergeIds = new Set<string>()
  
  for (let r = startRow; r <= endRow; r++) {
    const row: string[] = []
    const internalRow: InternalClipboardCell[] = []
    
    for (let c = startCol; c <= endCol; c++) {
      // 复制到Excel时只复制计算结果值，不复制公式
      const value = source.getValue(r, c)
      row.push(value)
      
      // 保存原始值到内部剪贴板（包括公式）
      const rawValue = source.getRawValue(r, c)
      const cell: InternalClipboardCell = { 
        value: rawValue, 
        isFormula: rawValue.startsWith('=') 
      }
      
      // 复制样式
      if (source.hasCellStyle(r, c)) {
        cell.style = { ...source.getCellStyle(r, c) }
      }
      
      // 复制边框
      if (source.hasCellBorder(r, c)) {
        const border = source.getCellBorder(r, c)
        if (border) {
          cell.border = { ...border }
        }
      }
      
      // 复制格式
      if (source.hasCellFormat(r, c)) {
        const format = source.getCellFormat(r, c)
        if (format) {
          cell.format = { ...format }
        }
      }
      
      // 检查合并单元格（只记录一次）
      const merged = source.getMergedRegion(r, c)
      if (merged) {
        const mergeId = `${merged.startRow},${merged.startCol}`
        if (!processedMergeIds.has(mergeId)) {
          processedMergeIds.add(mergeId)
          // 检查合并区域是否完全在复制范围内
          if (merged.startRow >= startRow && merged.endRow <= endRow &&
              merged.startCol >= startCol && merged.endCol <= endCol) {
            // 转换为相对坐标
            mergedRegions.push({
              startRow: merged.startRow - startRow,
              startCol: merged.startCol - startCol,
              endRow: merged.endRow - startRow,
              endCol: merged.endCol - startCol
            })
          }
        }
      }
      
      internalRow.push(cell)
    }
    
    tsv += row.join('\t') + '\n'
    internalData.push(internalRow)
  }
  
  // 去掉最后的换行符
  tsv = tsv.slice(0, -1)
  
  return {
    tsv,
    internalData,
    mergedRegions
  }
}

/**
 * 粘贴内部剪贴板数据（保留公式、样式、格式、合并单元格）
 * Excel 行为：无论是否有选区，都从起始位置按照剪贴板数据大小粘贴
 */
export function pasteInternal(
  data: InternalClipboardCell[][],
  srcStartRow: number,
  srcStartCol: number,
  destStartRow: number,
  destStartCol: number,
  target: PasteTarget,
  mergedRegions?: InternalClipboard['mergedRegions']
): void {
  // 按照剪贴板数据的实际大小粘贴
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] || { value: '', isFormula: false }
      const srcRow = srcStartRow + r
      const srcCol = srcStartCol + c
      const destRow = destStartRow + r
      const destCol = destStartCol + c
      
      // 先取消目标位置可能存在的合并单元格
      target.unmergeCells(destRow, destCol)
      
      if (cell.isFormula) {
        // 公式：使用 copyCell 保持相对/绝对引用
        target.copyCell(srcRow, srcCol, destRow, destCol)
      } else {
        // 普通值：直接设置
        target.setValue(destRow, destCol, cell.value)
      }
      
      // 粘贴样式
      if (cell.style) {
        target.setCellStyle(destRow, destCol, { ...cell.style })
      } else {
        target.clearCellStyle(destRow, destCol)
      }
      
      // 粘贴边框
      if (cell.border) {
        target.setCellBorder(destRow, destCol, { ...cell.border })
      } else {
        target.clearCellBorder(destRow, destCol)
      }
      
      // 粘贴格式
      if (cell.format) {
        target.setCellFormat(destRow, destCol, { ...cell.format })
      } else {
        target.clearCellFormat(destRow, destCol)
      }
    }
  }
  
  // 恢复合并单元格
  if (mergedRegions && mergedRegions.length > 0) {
    for (const region of mergedRegions) {
      const destMergeStartRow = destStartRow + region.startRow
      const destMergeStartCol = destStartCol + region.startCol
      const destMergeEndRow = destStartRow + region.endRow
      const destMergeEndCol = destStartCol + region.endCol
      
      target.mergeCells(destMergeStartRow, destMergeStartCol, destMergeEndRow, destMergeEndCol)
    }
  }
}

/**
 * 粘贴外部数据（从系统剪贴板）
 * Excel 行为：无论是否有选区，都从起始位置按照剪贴板数据大小粘贴
 */
export function pasteExternal(
  data: string[][],
  destStartRow: number,
  destStartCol: number,
  target: PasteTarget
): void {
  // 按照剪贴板数据的实际大小粘贴
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const value = row[c] || ''
      const destRow = destStartRow + r
      const destCol = destStartCol + c
      
      target.setValue(destRow, destCol, value)
    }
  }
}

/**
 * 解析 CSV 行（处理引号和转义）
 */
export function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 双引号转义
        current += '"'
        i++ // 跳过下一个引号
      } else {
        // 切换引号状态
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // 分隔符
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  cells.push(current)
  return cells
}

/**
 * 解析剪贴板文本为二维数组
 */
export function parseClipboardText(text: string): string[][] {
  // 尝试检测格式：TSV (制表符) 或 CSV (逗号)
  const hasTab = text.includes('\t')
  const delimiter = hasTab ? '\t' : ','
  
  // 解析为二维数组
  const lines = text.split('\n')
  const data: string[][] = []
  
  for (const line of lines) {
    if (!line) {
      // 空行也要保留，保持行对齐
      data.push([])
      continue
    }
    
    if (delimiter === ',') {
      // CSV 格式：处理引号
      const cells = parseCSVLine(line)
      data.push(cells)
    } else {
      // TSV 格式：直接分割，并去除每个单元格的首尾空白（包括\r）
      const cells = line.split('\t').map(cell => cell.trim())
      data.push(cells)
    }
  }
  
  return data
}

/**
 * 写入系统剪贴板
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    // 检查 Clipboard API 是否可用
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    
    // 降级方案：使用 execCommand（已废弃但兼容性好）
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch (err) {
    console.error('Failed to write to clipboard:', err)
    return false
  }
}

/**
 * 从系统剪贴板读取
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    // 检查 Clipboard API 是否可用
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText()
      return text || null
    }
    // 降级方案：无法主动读取剪贴板，返回 null
    return null
  } catch (err) {
    console.error('Failed to read from clipboard:', err)
    return null
  }
}

/**
 * 检查内部剪贴板是否有效（5秒内）
 */
export function isInternalClipboardValid(lastCopyTimestamp: number, maxAge: number = 5000): boolean {
  return (Date.now() - lastCopyTimestamp) < maxAge
}
