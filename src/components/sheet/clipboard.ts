/**
 * 剪贴板处理模块
 * 负责复制、粘贴操作，支持内部剪贴板（保留公式）和系统剪贴板（Excel 互操作）
 */

import type { InternalClipboardCell } from './types'

export interface InternalClipboard {
  data: InternalClipboardCell[][] | null
  startRow: number
  startCol: number
}

export interface CopySource {
  getValue: (row: number, col: number) => string
  getRawValue: (row: number, col: number) => string
}

export interface PasteTarget {
  setValue: (row: number, col: number, value: string) => void
  copyCell: (srcRow: number, srcCol: number, destRow: number, destCol: number) => void
}

/**
 * 复制单个单元格
 */
export async function copySingleCell(
  row: number,
  col: number,
  source: CopySource
): Promise<{ tsv: string; internalData: InternalClipboardCell[][] }> {
  const value = source.getValue(row, col)
  const rawValue = source.getRawValue(row, col)
  
  const internalData = [[{ value: rawValue, isFormula: rawValue.startsWith('=') }]]
  
  return {
    tsv: value,
    internalData
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
): Promise<{ tsv: string; internalData: InternalClipboardCell[][] }> {
  let tsv = ''
  const internalData: InternalClipboardCell[][] = []
  
  for (let r = startRow; r <= endRow; r++) {
    const row: string[] = []
    const internalRow: InternalClipboardCell[] = []
    
    for (let c = startCol; c <= endCol; c++) {
      // 复制到Excel时只复制计算结果值，不复制公式
      const value = source.getValue(r, c)
      row.push(value)
      
      // 保存原始值到内部剪贴板（包括公式）
      const rawValue = source.getRawValue(r, c)
      internalRow.push({ value: rawValue, isFormula: rawValue.startsWith('=') })
    }
    
    tsv += row.join('\t') + '\n'
    internalData.push(internalRow)
  }
  
  // 去掉最后的换行符
  tsv = tsv.slice(0, -1)
  
  return {
    tsv,
    internalData
  }
}

/**
 * 粘贴内部剪贴板数据（保留公式）
 * Excel 行为：无论是否有选区，都从起始位置按照剪贴板数据大小粘贴
 */
export function pasteInternal(
  data: InternalClipboardCell[][],
  srcStartRow: number,
  srcStartCol: number,
  destStartRow: number,
  destStartCol: number,
  target: PasteTarget
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
      
      if (cell.isFormula) {
        // 公式：使用 copyCell 保持相对/绝对引用
        target.copyCell(srcRow, srcCol, destRow, destCol)
      } else {
        // 普通值：直接设置
        target.setValue(destRow, destCol, cell.value)
      }
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
    await navigator.clipboard.writeText(text)
    return true
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
    const text = await navigator.clipboard.readText()
    return text || null
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
