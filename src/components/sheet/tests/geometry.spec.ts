import { describe, it, expect } from 'vitest'
import { 
  getRowTop, 
  getColLeft, 
  getRowAtY,
  getColAtX, 
  getRowHeight, 
  getColWidth 
} from '../geometry'
import type { SizeAccess, GeometryConfig, Viewport } from '../types'

describe('geometry module', () => {
  const cfg: GeometryConfig = {
    defaultRowHeight: 25,
    defaultColWidth: 100,
    rowHeaderWidth: 50,
    colHeaderHeight: 30,
  }

  const createMockSizes = (
    customRowHeights: Record<number, number> = {},
    customColWidths: Record<number, number> = {},
    hiddenRows: Set<number> = new Set(),
    hiddenCols: Set<number> = new Set()
  ): SizeAccess => ({
    rowHeights: new Map(Object.entries(customRowHeights).map(([k, v]) => [Number(k), v])),
    colWidths: new Map(Object.entries(customColWidths).map(([k, v]) => [Number(k), v])),
    hiddenRows,
    hiddenCols,
    showGridFlag: true,
  })

  describe('getRowHeight', () => {
    it('should return default height for normal row', () => {
      const sizes = createMockSizes()
      expect(getRowHeight(0, sizes, cfg)).toBe(25)
      expect(getRowHeight(10, sizes, cfg)).toBe(25)
    })

    it('should return custom height when set', () => {
      const sizes = createMockSizes({ 5: 50 })
      expect(getRowHeight(5, sizes, cfg)).toBe(50)
    })

    it('should return 0 for hidden row', () => {
      const sizes = createMockSizes({}, {}, new Set([3]))
      expect(getRowHeight(3, sizes, cfg)).toBe(0)
    })

    it('should prioritize hidden over custom height', () => {
      const sizes = createMockSizes({ 5: 100 }, {}, new Set([5]))
      expect(getRowHeight(5, sizes, cfg)).toBe(0)
    })
  })

  describe('getColWidth', () => {
    it('should return default width for normal column', () => {
      const sizes = createMockSizes()
      expect(getColWidth(0, sizes, cfg)).toBe(100)
      expect(getColWidth(10, sizes, cfg)).toBe(100)
    })

    it('should return custom width when set', () => {
      const sizes = createMockSizes({}, { 3: 150 })
      expect(getColWidth(3, sizes, cfg)).toBe(150)
    })

    it('should return 0 for hidden column', () => {
      const sizes = createMockSizes({}, {}, new Set(), new Set([2]))
      expect(getColWidth(2, sizes, cfg)).toBe(0)
    })

    it('should prioritize hidden over custom width', () => {
      const sizes = createMockSizes({}, { 4: 200 }, new Set(), new Set([4]))
      expect(getColWidth(4, sizes, cfg)).toBe(0)
    })
  })

  describe('getRowTop', () => {
    it('should calculate top position for first rows', () => {
      const sizes = createMockSizes()
      expect(getRowTop(0, sizes, cfg)).toBe(0)
      expect(getRowTop(1, sizes, cfg)).toBe(25)
      expect(getRowTop(2, sizes, cfg)).toBe(50)
    })

    it('should account for custom row heights', () => {
      const sizes = createMockSizes({ 1: 50 })
      expect(getRowTop(0, sizes, cfg)).toBe(0)
      expect(getRowTop(1, sizes, cfg)).toBe(25)
      expect(getRowTop(2, sizes, cfg)).toBe(75) // 25 + 50
      expect(getRowTop(3, sizes, cfg)).toBe(100) // 25 + 50 + 25
    })

    it('should skip hidden rows', () => {
      const sizes = createMockSizes({}, {}, new Set([1]))
      expect(getRowTop(0, sizes, cfg)).toBe(0)
      expect(getRowTop(1, sizes, cfg)).toBe(25)
      expect(getRowTop(2, sizes, cfg)).toBe(25) // Row 1 is hidden (height 0)
      expect(getRowTop(3, sizes, cfg)).toBe(50)
    })
  })

  describe('getColLeft', () => {
    it('should calculate left position for first columns', () => {
      const sizes = createMockSizes()
      expect(getColLeft(0, sizes, cfg)).toBe(0)
      expect(getColLeft(1, sizes, cfg)).toBe(100)
      expect(getColLeft(2, sizes, cfg)).toBe(200)
    })

    it('should account for custom column widths', () => {
      const sizes = createMockSizes({}, { 1: 150 })
      expect(getColLeft(0, sizes, cfg)).toBe(0)
      expect(getColLeft(1, sizes, cfg)).toBe(100)
      expect(getColLeft(2, sizes, cfg)).toBe(250) // 100 + 150
      expect(getColLeft(3, sizes, cfg)).toBe(350) // 100 + 150 + 100
    })

    it('should skip hidden columns', () => {
      const sizes = createMockSizes({}, {}, new Set(), new Set([1]))
      expect(getColLeft(0, sizes, cfg)).toBe(0)
      expect(getColLeft(1, sizes, cfg)).toBe(100)
      expect(getColLeft(2, sizes, cfg)).toBe(100) // Col 1 is hidden (width 0)
      expect(getColLeft(3, sizes, cfg)).toBe(200)
    })
  })

  describe('getRowAtY and getColAtX', () => {
    it('should find row at Y position', () => {
      const sizes = createMockSizes()
      const viewport: Viewport = { scrollTop: 0, scrollLeft: 0 }
      
      // colHeaderHeight = 30, so Y position in content starts after that
      // Y=30 (just after header) -> row 0
      expect(getRowAtY(30, viewport, sizes, cfg, 100)).toBe(0)
      // Y=55 (30 header + 25 row0) -> row 1
      expect(getRowAtY(55, viewport, sizes, cfg, 100)).toBe(1)
    })

    it('should find column at X position', () => {
      const sizes = createMockSizes()
      const viewport: Viewport = { scrollTop: 0, scrollLeft: 0 }
      
      // rowHeaderWidth = 50, so X position in content starts after that
      // X=50 (just after header) -> col 0
      expect(getColAtX(50, viewport, sizes, cfg, 100)).toBe(0)
      // X=150 (50 header + 100 col0) -> col 1
      expect(getColAtX(150, viewport, sizes, cfg, 100)).toBe(1)
    })

    it('should account for scroll offset', () => {
      const sizes = createMockSizes()
      const viewport: Viewport = { scrollTop: 25, scrollLeft: 100 }
      
      // With scrollTop=25 and Y=30, offsetY = 30 + 25 - 30 = 25 (end of row 0)
      expect(getRowAtY(30, viewport, sizes, cfg, 100)).toBe(1)
      // With scrollLeft=100 and X=50, offsetX = 50 + 100 - 50 = 100 (end of col 0)
      expect(getColAtX(50, viewport, sizes, cfg, 100)).toBe(1)
    })
  })
})
