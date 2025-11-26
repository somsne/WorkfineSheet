import { describe, it, expect } from 'vitest'
import { parseCSVLine } from '../clipboard'

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
