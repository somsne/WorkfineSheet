import { describe, it, expect } from 'vitest'
import { parseCellAddr, parseFormulaReferences, parseFormulaReferencesWithSheet, getReferencesForSheet } from '../references'

describe('references - parseCellAddr', () => {
  it('should parse simple cell address', () => {
    expect(parseCellAddr('A1')).toEqual({ col: 0, row: 0 })
    expect(parseCellAddr('B2')).toEqual({ col: 1, row: 1 })
    expect(parseCellAddr('Z10')).toEqual({ col: 25, row: 9 })
  })

  it('should parse multi-letter column address', () => {
    expect(parseCellAddr('AA1')).toEqual({ col: 26, row: 0 })
    expect(parseCellAddr('AB5')).toEqual({ col: 27, row: 4 })
    expect(parseCellAddr('AZ1')).toEqual({ col: 51, row: 0 })
    expect(parseCellAddr('BA1')).toEqual({ col: 52, row: 0 })
  })

  it('should handle lowercase input', () => {
    expect(parseCellAddr('a1')).toEqual({ col: 0, row: 0 })
    expect(parseCellAddr('aa10')).toEqual({ col: 26, row: 9 })
  })

  it('should return null for invalid input', () => {
    expect(parseCellAddr('')).toBeNull()
    expect(parseCellAddr('1A')).toBeNull()
    expect(parseCellAddr('A')).toBeNull()
    expect(parseCellAddr('123')).toBeNull()
  })

  it('should handle A0 as row -1 (edge case)', () => {
    // A0 technically parses to row -1, which is invalid but not null
    const result = parseCellAddr('A0')
    expect(result).not.toBeNull()
    expect(result?.row).toBe(-1)
    expect(result?.col).toBe(0)
  })

  it('should handle large row numbers', () => {
    expect(parseCellAddr('A100')).toEqual({ col: 0, row: 99 })
    expect(parseCellAddr('Z999')).toEqual({ col: 25, row: 998 })
  })
})

describe('references - parseFormulaReferences (current sheet only)', () => {
  it('should parse simple cell reference', () => {
    const refs = parseFormulaReferences('=A1')
    expect(refs.length).toBe(1)
    expect(refs[0]?.startRow).toBe(0)
    expect(refs[0]?.startCol).toBe(0)
  })

  it('should exclude cross-sheet references', () => {
    // 公式包含跨 Sheet 引用，parseFormulaReferences 只返回当前 Sheet 的引用
    const refs = parseFormulaReferences('=A1+Sheet2!B2')
    expect(refs.length).toBe(1) // 只有 A1，不包含 Sheet2!B2
    expect(refs[0]?.range).toBe('A1')
  })

  it('should exclude cross-sheet range references', () => {
    const refs = parseFormulaReferences('=A1+Sheet2!B2:C3')
    expect(refs.length).toBe(1) // 只有 A1
  })

  it('should exclude quoted sheet name references', () => {
    const refs = parseFormulaReferences("=A1+'Sheet 2'!B2")
    expect(refs.length).toBe(1) // 只有 A1
    expect(refs[0]?.range).toBe('A1')
  })

  it('should exclude Chinese sheet name references', () => {
    const refs = parseFormulaReferences('=A1+数据表!B2')
    expect(refs.length).toBe(1) // 只有 A1
  })

  it('should return empty for formula with only cross-sheet refs', () => {
    const refs = parseFormulaReferences('=Sheet2!A1+Sheet3!B2')
    expect(refs.length).toBe(0) // 没有当前 Sheet 的引用
  })
})

describe('references - parseFormulaReferencesWithSheet', () => {
  it('should return empty map for non-formula strings', () => {
    const result = parseFormulaReferencesWithSheet('hello', 'Sheet1')
    expect(result.size).toBe(0)
  })

  it('should parse simple cell reference in current sheet', () => {
    const result = parseFormulaReferencesWithSheet('=A1', 'Sheet1')
    expect(result.size).toBe(1)
    expect(result.has('Sheet1')).toBe(true)
    const refs = getReferencesForSheet(result, 'Sheet1')
    expect(refs.length).toBe(1)
    expect(refs[0]?.startRow).toBe(0)
    expect(refs[0]?.startCol).toBe(0)
  })

  it('should parse range reference in current sheet', () => {
    const result = parseFormulaReferencesWithSheet('=A1:B3', 'Sheet1')
    const refs = getReferencesForSheet(result, 'Sheet1')
    expect(refs.length).toBe(1)
    expect(refs[0]?.startRow).toBe(0)
    expect(refs[0]?.startCol).toBe(0)
    expect(refs[0]?.endRow).toBe(2)
    expect(refs[0]?.endCol).toBe(1)
  })

  it('should parse cross-sheet reference without quotes', () => {
    const result = parseFormulaReferencesWithSheet('=Sheet2!A1', 'Sheet1')
    expect(result.size).toBe(1)
    expect(result.has('Sheet2')).toBe(true)
    const refs = getReferencesForSheet(result, 'Sheet2')
    expect(refs.length).toBe(1)
    expect(refs[0]?.startRow).toBe(0)
    expect(refs[0]?.startCol).toBe(0)
  })

  it('should parse cross-sheet reference with quotes', () => {
    const result = parseFormulaReferencesWithSheet("='Sheet 2'!A1", 'Sheet1')
    expect(result.size).toBe(1)
    expect(result.has('Sheet 2')).toBe(true)
    const refs = getReferencesForSheet(result, 'Sheet 2')
    expect(refs.length).toBe(1)
    // range 应该保留原始格式（包含引号）
    expect(refs[0]?.range).toBe("'Sheet 2'!A1")
  })

  it('should preserve original format in range field for quoted sheet names', () => {
    const result = parseFormulaReferencesWithSheet("='My Sheet'!A1:B2", 'Sheet1')
    const refs = getReferencesForSheet(result, 'My Sheet')
    expect(refs.length).toBe(1)
    // range 应该保留原始格式（包含引号和范围）
    expect(refs[0]?.range).toBe("'My Sheet'!A1:B2")
  })

  it('should parse cross-sheet range reference', () => {
    const result = parseFormulaReferencesWithSheet('=Sheet2!A1:B3', 'Sheet1')
    const refs = getReferencesForSheet(result, 'Sheet2')
    expect(refs.length).toBe(1)
    expect(refs[0]?.startRow).toBe(0)
    expect(refs[0]?.endRow).toBe(2)
  })

  it('should parse mixed references from multiple sheets', () => {
    const result = parseFormulaReferencesWithSheet('=A1+Sheet2!B2+Sheet3!C3', 'Sheet1')
    expect(result.size).toBe(3)
    expect(result.has('Sheet1')).toBe(true)
    expect(result.has('Sheet2')).toBe(true)
    expect(result.has('Sheet3')).toBe(true)
    expect(getReferencesForSheet(result, 'Sheet1').length).toBe(1)
    expect(getReferencesForSheet(result, 'Sheet2').length).toBe(1)
    expect(getReferencesForSheet(result, 'Sheet3').length).toBe(1)
  })

  it('should parse Chinese sheet names', () => {
    const result = parseFormulaReferencesWithSheet('=数据表!A1', '工作表1')
    expect(result.has('数据表')).toBe(true)
    const refs = getReferencesForSheet(result, '数据表')
    expect(refs.length).toBe(1)
  })

  it('should handle absolute references', () => {
    const result = parseFormulaReferencesWithSheet('=$A$1', 'Sheet1')
    const refs = getReferencesForSheet(result, 'Sheet1')
    expect(refs.length).toBe(1)
    expect(refs[0]?.startRow).toBe(0)
    expect(refs[0]?.startCol).toBe(0)
  })

  it('should assign different colors to different references', () => {
    const result = parseFormulaReferencesWithSheet('=A1+B2+C3', 'Sheet1')
    const refs = getReferencesForSheet(result, 'Sheet1')
    expect(refs.length).toBe(3)
    // 验证颜色不同
    expect(refs[0]?.color).not.toBe(refs[1]?.color)
    expect(refs[1]?.color).not.toBe(refs[2]?.color)
  })

  it('should deduplicate same references', () => {
    const result = parseFormulaReferencesWithSheet('=A1+A1', 'Sheet1')
    const refs = getReferencesForSheet(result, 'Sheet1')
    expect(refs.length).toBe(1)
  })

  it('should return empty array for non-existent sheet', () => {
    const result = parseFormulaReferencesWithSheet('=A1', 'Sheet1')
    const refs = getReferencesForSheet(result, 'NonExistent')
    expect(refs.length).toBe(0)
  })
})
