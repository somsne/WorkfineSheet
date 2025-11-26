import { describe, it, expect } from 'vitest'
import { parseCellAddr } from '../references'

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
