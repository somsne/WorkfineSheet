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
 * Parse a cell address like "A1" or "$A$1" into row/col indices (0-based).
 * Removes $ symbols before parsing.
 */
export function parseCellAddr(addr: string): { row: number; col: number } | null {
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

/**
 * Parse formula references from a formula string.
 * Supports:
 * - Range references: A1:B3, $A$1:$B$3
 * - Single cell references: A1, $A$1, $A1, A$1
 * Returns an array of references with assigned colors and deduplication.
 */
export function parseFormulaReferences(formula: string): FormulaReference[] {
  if (!formula.startsWith('=')) return []
  
  const references: FormulaReference[] = []
  const seen = new Set<string>()
  
  // Match range references (A1:B3) and single cell references (A1)
  // Support absolute references $A$1 / $A1 / A$1
  const rangeRegex = /(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/g
  // Use word boundaries to avoid false matches
  const cellRegex = /(^|[^A-Za-z0-9$])(\$?[A-Za-z]+\$?\d+)(?=[^A-Za-z0-9]|$)/g
  
  let colorIndex = 0
  
  // First match range references
  let match
  while ((match = rangeRegex.exec(formula)) !== null) {
    const rangeStr = match[0].toUpperCase()
    if (seen.has(rangeStr)) continue
    seen.add(rangeStr)
    
    const startAddr = match[1]?.toUpperCase()
    const endAddr = match[2]?.toUpperCase()
    
    if (!startAddr || !endAddr) continue
    
    const startRef = parseCellAddr(startAddr)
    const endRef = parseCellAddr(endAddr)
    
    if (startRef && endRef) {
      const seenKey = `${startAddr.replace(/\$/g,'')}:${endAddr.replace(/\$/g,'')}`
      if (seen.has(seenKey)) continue
      seen.add(seenKey)
      references.push({
        range: rangeStr,
        startRow: Math.min(startRef.row, endRef.row),
        startCol: Math.min(startRef.col, endRef.col),
        endRow: Math.max(startRef.row, endRef.row),
        endCol: Math.max(startRef.col, endRef.col),
        color: REFERENCE_COLORS[colorIndex % REFERENCE_COLORS.length] || '#4472C4'
      })
      colorIndex++
    }
  }
  
  // Remove range references, then match single cell references
  const formulaWithoutRanges = formula.replace(rangeRegex, '')
  
  rangeRegex.lastIndex = 0
  while ((match = cellRegex.exec(formulaWithoutRanges)) !== null) {
    const cellAddr = match[2]?.toUpperCase()
    if (!cellAddr || seen.has(cellAddr)) continue
    const norm = cellAddr.replace(/\$/g, '')
    if (seen.has(norm)) continue
    seen.add(norm)
    
    const ref = parseCellAddr(cellAddr)
    if (ref) {
      references.push({
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
  
  return references
}
