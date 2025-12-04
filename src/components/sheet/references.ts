/**
 * Formula reference parsing module: parses cell addresses and formula references.
 * Supports absolute ($A$1), mixed ($A1, A$1), and relative (A1) references.
 */

import type { FormulaReference } from './types'

/**
 * Excel-style reference colors
 */
export const REFERENCE_COLORS = [
  '#4472C4',  // Blue
  '#ED7D31',  // Orange
  '#A5A5A5',  // Gray
  '#FFC000',  // Yellow
  '#5B9BD5',  // Light blue
  '#70AD47',  // Green
  '#264478',  // Dark blue
  '#9E480E',  // Dark orange
  '#636363',  // Dark gray
  '#997300',  // Dark yellow
]

/**
 * 带 Sheet 信息的公式引用
 */
export interface SheetFormulaReference extends FormulaReference {
  /** Sheet 名称（null 表示当前 Sheet） */
  sheetName: string | null
}

/**
 * 按 Sheet 分组的公式引用映射
 * key: sheetName (null 用 '__current__' 表示当前 Sheet)
 */
export type SheetReferencesMap = Map<string, FormulaReference[]>

/**
 * Parse a cell address like "A1", "$A$1", "Sheet1!A1", or "'Sheet Name'!A1" into row/col indices (0-based).
 * Removes $ symbols and Sheet prefix before parsing.
 * 
 * @param addr - Cell address (with or without Sheet prefix)
 * @returns { row, col } or null if invalid
 */
export function parseCellAddr(addr: string): { row: number; col: number } | null {
  // 移除 Sheet 前缀（如果有）
  // 支持 'Sheet Name'!A1 和 SheetName!A1 格式
  const sheetPrefixMatch = addr.match(/^(?:'[^']+'|[^!]+)!(.+)$/)
  if (sheetPrefixMatch && sheetPrefixMatch[1]) {
    addr = sheetPrefixMatch[1]
  }
  
  // Remove absolute reference symbols $
  addr = addr.replace(/\$/g, '')
  const match = addr.match(/^([A-Za-z]+)(\d+)$/)
  if (!match || !match[1] || !match[2]) return null
  
  const colStr = match[1].toUpperCase()
  const rowStr = match[2]
  
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  col -= 1  // 0-indexed
  
  const row = parseInt(rowStr, 10) - 1  // 0-indexed
  
  return { row, col }
}

// ==================== 内部常量 ====================

// 跨 Sheet 范围引用: 'Sheet Name'!A1:B2 或 SheetName!A1:B2
const CROSS_SHEET_RANGE_REGEX = /(?:'([^']+)'|([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*))!(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/gi

// 跨 Sheet 单元格引用: 'Sheet Name'!A1 或 SheetName!A1
const CROSS_SHEET_CELL_REGEX = /(?:'([^']+)'|([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*))!(\$?[A-Za-z]+\$?\d+)(?![:\dA-Za-z])/gi

// 普通范围引用: A1:B2
const RANGE_REGEX = /(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/g

// 普通单元格引用: A1
const CELL_REGEX = /(^|[^A-Za-z0-9$!])(\$?[A-Za-z]+\$?\d+)(?![A-Za-z0-9:])/g

/**
 * 解析公式中的所有引用，包括跨 Sheet 引用，并按 Sheet 分组
 * 这是核心实现，其他解析函数都基于此函数
 * 
 * @param formula 公式字符串
 * @param currentSheetName 当前 Sheet 名称（用于标识无前缀的引用）
 * @returns 按 Sheet 名称分组的引用映射
 */
export function parseFormulaReferencesWithSheet(
  formula: string, 
  currentSheetName: string
): SheetReferencesMap {
  const result: SheetReferencesMap = new Map()
  
  if (!formula.startsWith('=')) return result
  
  const seen = new Set<string>()
  let colorIndex = 0
  
  // 创建正则副本（避免全局正则的 lastIndex 问题）
  const crossSheetRangeRegex = new RegExp(CROSS_SHEET_RANGE_REGEX.source, 'gi')
  const crossSheetCellRegex = new RegExp(CROSS_SHEET_CELL_REGEX.source, 'gi')
  const rangeRegex = new RegExp(RANGE_REGEX.source, 'g')
  const cellRegex = new RegExp(CELL_REGEX.source, 'g')
  
  // 辅助函数：添加引用到结果
  function addReference(sheetName: string, ref: FormulaReference) {
    if (!result.has(sheetName)) {
      result.set(sheetName, [])
    }
    result.get(sheetName)!.push(ref)
  }
  
  // 1. 先匹配跨 Sheet 范围引用
  let match
  while ((match = crossSheetRangeRegex.exec(formula)) !== null) {
    const sheetName = match[1] || match[2] // 带引号或不带引号的 Sheet 名
    const startAddr = match[3]?.toUpperCase()
    const endAddr = match[4]?.toUpperCase()
    const originalMatch = match[0] // 保存原始匹配字符串（包含引号格式）
    
    if (!sheetName || !startAddr || !endAddr) continue
    
    const seenKey = `${sheetName}!${startAddr.replace(/\$/g,'')}:${endAddr.replace(/\$/g,'')}`
    if (seen.has(seenKey)) continue
    seen.add(seenKey)
    
    const startRef = parseCellAddr(startAddr)
    const endRef = parseCellAddr(endAddr)
    
    if (startRef && endRef) {
      addReference(sheetName, {
        range: originalMatch, // 使用原始匹配字符串，保留引号格式
        startRow: Math.min(startRef.row, endRef.row),
        startCol: Math.min(startRef.col, endRef.col),
        endRow: Math.max(startRef.row, endRef.row),
        endCol: Math.max(startRef.col, endRef.col),
        color: REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length] || '#4472C4'
      })
      colorIndex++
    }
  }
  
  // 2. 匹配跨 Sheet 单元格引用
  while ((match = crossSheetCellRegex.exec(formula)) !== null) {
    const sheetName = match[1] || match[2]
    const cellAddr = match[3]?.toUpperCase()
    const originalMatch = match[0] // 保存原始匹配字符串（包含引号格式）
    
    if (!sheetName || !cellAddr) continue
    
    const seenKey = `${sheetName}!${cellAddr.replace(/\$/g,'')}`
    if (seen.has(seenKey)) continue
    seen.add(seenKey)
    
    const ref = parseCellAddr(cellAddr)
    if (ref) {
      addReference(sheetName, {
        range: originalMatch, // 使用原始匹配字符串，保留引号格式
        startRow: ref.row,
        startCol: ref.col,
        endRow: ref.row,
        endCol: ref.col,
        color: REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length] || '#4472C4'
      })
      colorIndex++
    }
  }
  
  // 3. 移除跨 Sheet 引用后，匹配普通范围引用
  const formulaWithoutCrossSheet = formula
    .replace(new RegExp(CROSS_SHEET_RANGE_REGEX.source, 'gi'), '')
    .replace(new RegExp(CROSS_SHEET_CELL_REGEX.source, 'gi'), '')
  
  while ((match = rangeRegex.exec(formulaWithoutCrossSheet)) !== null) {
    const startAddr = match[1]?.toUpperCase()
    const endAddr = match[2]?.toUpperCase()
    
    if (!startAddr || !endAddr) continue
    
    const seenKey = `${currentSheetName}!${startAddr.replace(/\$/g,'')}:${endAddr.replace(/\$/g,'')}`
    if (seen.has(seenKey)) continue
    seen.add(seenKey)
    
    const startRef = parseCellAddr(startAddr)
    const endRef = parseCellAddr(endAddr)
    
    if (startRef && endRef) {
      addReference(currentSheetName, {
        range: `${startAddr}:${endAddr}`,
        startRow: Math.min(startRef.row, endRef.row),
        startCol: Math.min(startRef.col, endRef.col),
        endRow: Math.max(startRef.row, endRef.row),
        endCol: Math.max(startRef.col, endRef.col),
        color: REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length] || '#4472C4'
      })
      colorIndex++
    }
  }
  
  // 4. 移除范围引用后，匹配普通单元格引用
  const formulaWithoutRanges = formulaWithoutCrossSheet.replace(new RegExp(RANGE_REGEX.source, 'g'), '')
  
  while ((match = cellRegex.exec(formulaWithoutRanges)) !== null) {
    const cellAddr = match[2]?.toUpperCase()
    if (!cellAddr) continue
    
    const seenKey = `${currentSheetName}!${cellAddr.replace(/\$/g,'')}`
    if (seen.has(seenKey)) continue
    seen.add(seenKey)
    
    const ref = parseCellAddr(cellAddr)
    if (ref) {
      addReference(currentSheetName, {
        range: cellAddr,
        startRow: ref.row,
        startCol: ref.col,
        endRow: ref.row,
        endCol: ref.col,
        color: REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length] || '#4472C4'
      })
      colorIndex++
    }
  }
  
  return result
}

/**
 * Parse formula references from a formula string (current sheet only).
 * 
 * This is a convenience wrapper around parseFormulaReferencesWithSheet.
 * It returns only references that belong to the current sheet,
 * excluding cross-sheet references (Sheet2!A1).
 * 
 * @param formula - Formula string (must start with '=')
 * @param currentSheetName - Current sheet name (default: '__current__')
 * @returns Array of references for the current sheet
 */
export function parseFormulaReferences(
  formula: string, 
  currentSheetName: string = '__current__'
): FormulaReference[] {
  const referencesMap = parseFormulaReferencesWithSheet(formula, currentSheetName)
  return getReferencesForSheet(referencesMap, currentSheetName)
}

/**
 * 获取指定 Sheet 的公式引用
 */
export function getReferencesForSheet(
  referencesMap: SheetReferencesMap, 
  sheetName: string
): FormulaReference[] {
  return referencesMap.get(sheetName) ?? []
}

/**
 * 获取所有 Sheet 的公式引用（合并为一个数组）
 * 用于编辑模式下显示公式中所有引用的颜色（包括跨 Sheet 引用）
 */
export function getAllReferences(referencesMap: SheetReferencesMap): FormulaReference[] {
  const result: FormulaReference[] = []
  for (const refs of referencesMap.values()) {
    result.push(...refs)
  }
  return result
}

/**
 * 解析公式中的所有引用（包括跨 Sheet 引用）
 * 用于编辑模式下的公式颜色显示
 * 
 * @param formula - 公式字符串（必须以 '=' 开头）
 * @param currentSheetName - 当前 Sheet 名称
 * @returns 所有引用的数组（包括跨 Sheet 引用）
 */
export function parseAllFormulaReferences(
  formula: string,
  currentSheetName: string = '__current__'
): FormulaReference[] {
  const referencesMap = parseFormulaReferencesWithSheet(formula, currentSheetName)
  return getAllReferences(referencesMap)
}
