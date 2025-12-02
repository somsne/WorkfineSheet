import { describe, it, expect, vi } from 'vitest'
import { 
  parseCSVLine, 
  parseClipboardText, 
  isInternalClipboardValid,
  generateExcelHtml,
  parseExcelHtml,
  copySingleCell,
  copyRange,
  pasteInternal,
  pasteExternal,
  type CopySource,
  type PasteTarget
} from '../clipboard'
import type { InternalClipboardCell, CellStyle, CellBorder } from '../types'

describe('clipboard - parseCSVLine', () => {
  it('should parse simple CSV line', () => {
    const line = 'apple,banana,cherry'
    expect(parseCSVLine(line)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('should handle empty fields', () => {
    const line = 'a,,c'
    expect(parseCSVLine(line)).toEqual(['a', '', 'c'])
  })

  it('should handle quoted fields', () => {
    const line = '"apple","banana","cherry"'
    expect(parseCSVLine(line)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('should handle quoted fields with commas', () => {
    const line = '"Hello, World","Test, 123","End"'
    expect(parseCSVLine(line)).toEqual(['Hello, World', 'Test, 123', 'End'])
  })

  it('should handle quoted fields with escaped quotes', () => {
    const line = '"He said ""Hello""","Another ""test"""'
    expect(parseCSVLine(line)).toEqual(['He said "Hello"', 'Another "test"'])
  })

  it('should handle mixed quoted and unquoted fields', () => {
    const line = 'apple,"banana, fruit",cherry'
    expect(parseCSVLine(line)).toEqual(['apple', 'banana, fruit', 'cherry'])
  })

  it('should handle empty string', () => {
    expect(parseCSVLine('')).toEqual([''])
  })

  it('should handle single field', () => {
    expect(parseCSVLine('single')).toEqual(['single'])
  })

  it('should handle trailing comma', () => {
    const line = 'a,b,c,'
    expect(parseCSVLine(line)).toEqual(['a', 'b', 'c', ''])
  })

  it('should handle leading comma', () => {
    const line = ',a,b,c'
    expect(parseCSVLine(line)).toEqual(['', 'a', 'b', 'c'])
  })

  it('should preserve whitespace in fields', () => {
    const line = ' apple , banana , cherry '
    expect(parseCSVLine(line)).toEqual([' apple ', ' banana ', ' cherry '])
  })
})

describe('clipboard - parseClipboardText', () => {
  it('should parse TSV format (tab-separated)', () => {
    const text = 'A1\tB1\tC1\nA2\tB2\tC2'
    const result = parseClipboardText(text)
    expect(result).toEqual([
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2']
    ])
  })

  it('should parse CSV format (comma-separated)', () => {
    const text = 'A1,B1,C1\nA2,B2,C2'
    const result = parseClipboardText(text)
    expect(result).toEqual([
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2']
    ])
  })

  it('should handle single cell', () => {
    const text = 'Hello'
    const result = parseClipboardText(text)
    expect(result).toEqual([['Hello']])
  })

  it('should handle empty lines', () => {
    const text = 'A1\tB1\n\nA3\tB3'
    const result = parseClipboardText(text)
    expect(result).toEqual([
      ['A1', 'B1'],
      [],
      ['A3', 'B3']
    ])
  })

  it('should trim whitespace in TSV cells', () => {
    const text = ' A1 \t B1 \n A2 \t B2 '
    const result = parseClipboardText(text)
    expect(result).toEqual([
      ['A1', 'B1'],
      ['A2', 'B2']
    ])
  })
})

describe('clipboard - isInternalClipboardValid', () => {
  it('should return true for recent copy (within 5 seconds)', () => {
    const now = Date.now()
    expect(isInternalClipboardValid(now - 1000)).toBe(true)
    expect(isInternalClipboardValid(now - 4000)).toBe(true) // 使用更安全的边界值
  })

  it('should return false for old copy (after 5 seconds)', () => {
    const now = Date.now()
    expect(isInternalClipboardValid(now - 6000)).toBe(false) // 使用更安全的边界值
    expect(isInternalClipboardValid(now - 10000)).toBe(false)
  })

  it('should use custom maxAge', () => {
    const now = Date.now()
    expect(isInternalClipboardValid(now - 2000, 3000)).toBe(true)
    expect(isInternalClipboardValid(now - 4000, 3000)).toBe(false)
  })
})

describe('clipboard - generateExcelHtml', () => {
  it('should generate basic HTML table', () => {
    const data: InternalClipboardCell[][] = [
      [{ value: 'A1', isFormula: false }, { value: 'B1', isFormula: false }],
      [{ value: 'A2', isFormula: false }, { value: 'B2', isFormula: false }]
    ]
    const html = generateExcelHtml(data, [])
    
    expect(html).toContain('<table')
    expect(html).toContain('A1')
    expect(html).toContain('B1')
    expect(html).toContain('A2')
    expect(html).toContain('B2')
    expect(html).toContain('</table>')
  })

  it('should include Excel XML namespaces', () => {
    const data: InternalClipboardCell[][] = [
      [{ value: 'Test', isFormula: false }]
    ]
    const html = generateExcelHtml(data, [])
    
    expect(html).toContain('xmlns:x="urn:schemas-microsoft-com:office:excel"')
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"')
  })

  it('should include ProgId meta tag', () => {
    const data: InternalClipboardCell[][] = [
      [{ value: 'Test', isFormula: false }]
    ]
    const html = generateExcelHtml(data, [])
    
    expect(html).toContain('name=ProgId content=Excel.Sheet')
  })

  it('should generate style classes for styled cells', () => {
    const data: InternalClipboardCell[][] = [
      [{ 
        value: 'Bold', 
        isFormula: false,
        style: { bold: true }
      }]
    ]
    const html = generateExcelHtml(data, [])
    
    expect(html).toContain('class=xl')
    expect(html).toContain('font-weight:700')
  })

  it('should handle background color', () => {
    const data: InternalClipboardCell[][] = [
      [{ 
        value: 'Yellow', 
        isFormula: false,
        style: { backgroundColor: '#ffff00' }
      }]
    ]
    const html = generateExcelHtml(data, [])
    
    expect(html).toContain('background:#ffff00')
    expect(html).toContain('mso-pattern:black none')
  })

  it('should handle borders', () => {
    const data: InternalClipboardCell[][] = [
      [{ 
        value: 'Bordered', 
        isFormula: false,
        border: { 
          top: { style: 'thin', color: '#000000', width: 1 },
          bottom: { style: 'thin', color: '#000000', width: 1 }
        }
      }]
    ]
    const html = generateExcelHtml(data, [])
    
    expect(html).toContain('border:')
  })

  it('should handle merged regions', () => {
    const data: InternalClipboardCell[][] = [
      [{ value: 'Merged', isFormula: false }, { value: '', isFormula: false }],
      [{ value: '', isFormula: false }, { value: '', isFormula: false }]
    ]
    const mergedRegions = [{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }]
    const html = generateExcelHtml(data, mergedRegions)
    
    expect(html).toContain('rowspan=2')
    expect(html).toContain('colspan=2')
  })

  it('should escape HTML characters', () => {
    const data: InternalClipboardCell[][] = [
      [{ value: '<script>alert("XSS")</script>', isFormula: false }]
    ]
    const html = generateExcelHtml(data, [])
    
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})

describe('clipboard - parseExcelHtml', () => {
  it('should parse simple HTML table', () => {
    const html = `
      <html><body>
        <table>
          <tr><td>A1</td><td>B1</td></tr>
          <tr><td>A2</td><td>B2</td></tr>
        </table>
      </body></html>
    `
    const result = parseExcelHtml(html)
    
    expect(result).not.toBeNull()
    expect(result!.data).toHaveLength(2)
    expect(result!.data[0]).toHaveLength(2)
    expect(result!.data[0]![0]!.value).toBe('A1')
    expect(result!.data[0]![1]!.value).toBe('B1')
    expect(result!.data[1]![0]!.value).toBe('A2')
    expect(result!.data[1]![1]!.value).toBe('B2')
  })

  it('should parse merged cells', () => {
    const html = `
      <html><body>
        <table>
          <tr><td rowspan="2" colspan="2">Merged</td><td>C1</td></tr>
          <tr><td>C2</td></tr>
        </table>
      </body></html>
    `
    const result = parseExcelHtml(html)
    
    expect(result).not.toBeNull()
    expect(result!.mergedRegions).toHaveLength(1)
    expect(result!.mergedRegions[0]!).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1
    })
  })

  it('should parse inline styles', () => {
    const html = `
      <html><body>
        <table>
          <tr><td style="font-weight: bold; color: red;">Bold Red</td></tr>
        </table>
      </body></html>
    `
    const result = parseExcelHtml(html)
    
    expect(result).not.toBeNull()
    expect(result!.data[0]![0]!.style?.bold).toBe(true)
  })

  it('should return null for invalid HTML', () => {
    const html = '<div>Not a table</div>'
    const result = parseExcelHtml(html)
    
    expect(result).toBeNull()
  })

  it('should handle empty table', () => {
    const html = '<html><body><table></table></body></html>'
    const result = parseExcelHtml(html)
    
    expect(result).not.toBeNull()
    expect(result!.data).toHaveLength(0)
  })
})

describe('clipboard - copySingleCell', () => {
  it('should copy a simple cell', async () => {
    const source: CopySource = {
      getValue: () => 'Hello',
      getRawValue: () => 'Hello',
      getCellStyle: () => ({}),
      getCellBorder: () => undefined,
      getCellFormat: () => null,
      hasCellStyle: () => false,
      hasCellBorder: () => false,
      hasCellFormat: () => false,
      getMergedRegion: () => null
    }

    const result = await copySingleCell(0, 0, source)
    
    expect(result.tsv).toBe('Hello')
    expect(result.internalData).toHaveLength(1)
    expect(result.internalData[0]).toHaveLength(1)
    expect(result.internalData[0]![0]!.value).toBe('Hello')
    expect(result.internalData[0]![0]!.isFormula).toBe(false)
  })

  it('should copy a formula cell', async () => {
    const source: CopySource = {
      getValue: () => '10',
      getRawValue: () => '=A1+B1',
      getCellStyle: () => ({}),
      getCellBorder: () => undefined,
      getCellFormat: () => null,
      hasCellStyle: () => false,
      hasCellBorder: () => false,
      hasCellFormat: () => false,
      getMergedRegion: () => null
    }

    const result = await copySingleCell(0, 0, source)
    
    expect(result.tsv).toBe('10') // Display value
    expect(result.internalData[0]![0]!.value).toBe('=A1+B1') // Raw formula
    expect(result.internalData[0]![0]!.isFormula).toBe(true)
  })

  it('should copy cell with style', async () => {
    const testStyle: CellStyle = { bold: true, fontSize: 14 }
    const source: CopySource = {
      getValue: () => 'Styled',
      getRawValue: () => 'Styled',
      getCellStyle: () => testStyle,
      getCellBorder: () => undefined,
      getCellFormat: () => null,
      hasCellStyle: () => true,
      hasCellBorder: () => false,
      hasCellFormat: () => false,
      getMergedRegion: () => null
    }

    const result = await copySingleCell(0, 0, source)
    
    expect(result.internalData[0]![0]!.style).toEqual(testStyle)
  })

  it('should copy cell with border', async () => {
    const testBorder: CellBorder = { 
      top: { style: 'thin', color: '#000000', width: 1 } 
    }
    const source: CopySource = {
      getValue: () => 'Bordered',
      getRawValue: () => 'Bordered',
      getCellStyle: () => ({}),
      getCellBorder: () => testBorder,
      getCellFormat: () => null,
      hasCellStyle: () => false,
      hasCellBorder: () => true,
      hasCellFormat: () => false,
      getMergedRegion: () => null
    }

    const result = await copySingleCell(0, 0, source)
    
    expect(result.internalData[0]![0]!.border).toEqual(testBorder)
  })
})

describe('clipboard - copyRange', () => {
  it('should copy a range of cells', async () => {
    const data: { [key: string]: string } = {
      '0,0': 'A1', '0,1': 'B1',
      '1,0': 'A2', '1,1': 'B2'
    }
    const source: CopySource = {
      getValue: (r, c) => data[`${r},${c}`] || '',
      getRawValue: (r, c) => data[`${r},${c}`] || '',
      getCellStyle: () => ({}),
      getCellBorder: () => undefined,
      getCellFormat: () => null,
      hasCellStyle: () => false,
      hasCellBorder: () => false,
      hasCellFormat: () => false,
      getMergedRegion: () => null
    }

    const result = await copyRange(0, 0, 1, 1, source)
    
    expect(result.tsv).toBe('A1\tB1\nA2\tB2')
    expect(result.internalData).toHaveLength(2)
    expect(result.internalData[0]).toHaveLength(2)
    expect(result.internalData[0]![0]!.value).toBe('A1')
    expect(result.internalData[1]![1]!.value).toBe('B2')
  })

  it('should include merged regions in range', async () => {
    const source: CopySource = {
      getValue: () => 'Merged',
      getRawValue: () => 'Merged',
      getCellStyle: () => ({}),
      getCellBorder: () => undefined,
      getCellFormat: () => null,
      hasCellStyle: () => false,
      hasCellBorder: () => false,
      hasCellFormat: () => false,
      getMergedRegion: (r, c) => {
        if (r === 0 && c === 0) {
          return { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }
        }
        if (r <= 1 && c <= 1) {
          return { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }
        }
        return null
      }
    }

    const result = await copyRange(0, 0, 1, 1, source)
    
    expect(result.mergedRegions).toHaveLength(1)
    expect(result.mergedRegions[0]!).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1
    })
  })
})

describe('clipboard - pasteExternal', () => {
  it('should paste external data to target', () => {
    const pastedData: { [key: string]: string } = {}
    const target: PasteTarget = {
      setValue: (r, c, v) => { pastedData[`${r},${c}`] = v },
      copyCell: vi.fn(),
      setCellStyle: vi.fn(),
      setCellBorder: vi.fn(),
      setCellFormat: vi.fn(),
      clearCellStyle: vi.fn(),
      clearCellBorder: vi.fn(),
      clearCellFormat: vi.fn(),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn()
    }

    const data = [
      ['A1', 'B1'],
      ['A2', 'B2']
    ]

    pasteExternal(data, 0, 0, target)
    
    expect(pastedData['0,0']).toBe('A1')
    expect(pastedData['0,1']).toBe('B1')
    expect(pastedData['1,0']).toBe('A2')
    expect(pastedData['1,1']).toBe('B2')
  })

  it('should paste at specified offset', () => {
    const pastedData: { [key: string]: string } = {}
    const target: PasteTarget = {
      setValue: (r, c, v) => { pastedData[`${r},${c}`] = v },
      copyCell: vi.fn(),
      setCellStyle: vi.fn(),
      setCellBorder: vi.fn(),
      setCellFormat: vi.fn(),
      clearCellStyle: vi.fn(),
      clearCellBorder: vi.fn(),
      clearCellFormat: vi.fn(),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn()
    }

    const data = [['Value']]

    pasteExternal(data, 5, 3, target)
    
    expect(pastedData['5,3']).toBe('Value')
  })
})

describe('clipboard - pasteInternal', () => {
  it('should paste internal data with styles', () => {
    const pastedStyles: { [key: string]: CellStyle } = {}
    const pastedValues: { [key: string]: string } = {}
    
    const target: PasteTarget = {
      setValue: (r, c, v) => { pastedValues[`${r},${c}`] = v },
      copyCell: vi.fn(),
      setCellStyle: (r, c, s) => { pastedStyles[`${r},${c}`] = s },
      setCellBorder: vi.fn(),
      setCellFormat: vi.fn(),
      clearCellStyle: vi.fn(),
      clearCellBorder: vi.fn(),
      clearCellFormat: vi.fn(),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn()
    }

    const data: InternalClipboardCell[][] = [
      [{ value: 'Bold', isFormula: false, style: { bold: true } }]
    ]

    pasteInternal(data, 0, 0, 0, 0, target)
    
    expect(pastedValues['0,0']).toBe('Bold')
    expect(pastedStyles['0,0']).toEqual({ bold: true })
  })

  it('should use copyCell for formulas', () => {
    const copyCell = vi.fn()
    const target: PasteTarget = {
      setValue: vi.fn(),
      copyCell,
      setCellStyle: vi.fn(),
      setCellBorder: vi.fn(),
      setCellFormat: vi.fn(),
      clearCellStyle: vi.fn(),
      clearCellBorder: vi.fn(),
      clearCellFormat: vi.fn(),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn()
    }

    const data: InternalClipboardCell[][] = [
      [{ value: '=SUM(A1:A10)', isFormula: true }]
    ]

    pasteInternal(data, 0, 0, 5, 5, target)
    
    expect(copyCell).toHaveBeenCalledWith(0, 0, 5, 5)
  })

  it('should restore merged regions', () => {
    const mergeCells = vi.fn()
    const target: PasteTarget = {
      setValue: vi.fn(),
      copyCell: vi.fn(),
      setCellStyle: vi.fn(),
      setCellBorder: vi.fn(),
      setCellFormat: vi.fn(),
      clearCellStyle: vi.fn(),
      clearCellBorder: vi.fn(),
      clearCellFormat: vi.fn(),
      mergeCells,
      unmergeCells: vi.fn()
    }

    const data: InternalClipboardCell[][] = [
      [{ value: 'Merged', isFormula: false }, { value: '', isFormula: false }],
      [{ value: '', isFormula: false }, { value: '', isFormula: false }]
    ]
    const mergedRegions = [{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }]

    pasteInternal(data, 0, 0, 2, 2, target, mergedRegions)
    
    expect(mergeCells).toHaveBeenCalledWith(2, 2, 3, 3)
  })

  it('should clear existing styles when pasting cell without style', () => {
    const clearCellStyle = vi.fn()
    const target: PasteTarget = {
      setValue: vi.fn(),
      copyCell: vi.fn(),
      setCellStyle: vi.fn(),
      setCellBorder: vi.fn(),
      setCellFormat: vi.fn(),
      clearCellStyle,
      clearCellBorder: vi.fn(),
      clearCellFormat: vi.fn(),
      mergeCells: vi.fn(),
      unmergeCells: vi.fn()
    }

    const data: InternalClipboardCell[][] = [
      [{ value: 'NoStyle', isFormula: false }] // No style property
    ]

    pasteInternal(data, 0, 0, 0, 0, target)
    
    expect(clearCellStyle).toHaveBeenCalledWith(0, 0)
  })
})
