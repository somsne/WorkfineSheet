import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSheetAPI } from '../api'
import type { SheetAPI } from '../api'
import type { CellStyle } from '../types'
import { DEFAULT_CELL_STYLE } from '../types'

describe('样式 API', () => {
  let api: SheetAPI
  let mockContext: any
  let cellStyles: Map<string, CellStyle>

  beforeEach(() => {
    cellStyles = new Map()
    
    mockContext = {
      // 尺寸
      getRowHeight: vi.fn(() => 25),
      getColWidth: vi.fn(() => 100),
      rowHeights: new Map(),
      colWidths: new Map(),
      manualRowHeights: new Set(),
      
      // 行列操作
      insertRowAbove: vi.fn(),
      insertRowBelow: vi.fn(),
      deleteRow: vi.fn(),
      insertColLeft: vi.fn(),
      insertColRight: vi.fn(),
      deleteCol: vi.fn(),
      
      // 选择
      selected: { row: 0, col: 0 },
      selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 },
      
      // 单元格值
      getCellValue: vi.fn(() => ''),
      setCellValue: vi.fn(),
      
      // 样式函数
      getCellStyleFn: vi.fn((row: number, col: number) => {
        const key = `${row},${col}`
        return cellStyles.get(key) || DEFAULT_CELL_STYLE
      }),
      setCellStyleFn: vi.fn((row: number, col: number, style: Partial<CellStyle>) => {
        const key = `${row},${col}`
        const current = cellStyles.get(key) || { ...DEFAULT_CELL_STYLE }
        cellStyles.set(key, { ...current, ...style })
      }),
      clearCellStyleFn: vi.fn((row: number, col: number) => {
        const key = `${row},${col}`
        cellStyles.delete(key)
      }),
      setRangeStyleFn: vi.fn((startRow: number, startCol: number, endRow: number, endCol: number, style: Partial<CellStyle>) => {
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            const key = `${row},${col}`
            const current = cellStyles.get(key) || { ...DEFAULT_CELL_STYLE }
            cellStyles.set(key, { ...current, ...style })
          }
        }
      }),
      
      // 绘制
      draw: vi.fn()
    }
    
    api = createSheetAPI(mockContext)
  })

  describe('getCellStyle', () => {
    it('应该返回单元格样式', () => {
      cellStyles.set('0,0', { ...DEFAULT_CELL_STYLE, bold: true })
      
      const style = api.getCellStyle(0, 0)
      expect(style.bold).toBe(true)
    })

    it('未设置样式应返回默认样式', () => {
      const style = api.getCellStyle(5, 5)
      expect(style).toEqual(DEFAULT_CELL_STYLE)
    })
  })

  describe('setCellStyle', () => {
    it('应该设置单元格样式', () => {
      api.setCellStyle(0, 0, { bold: true, fontSize: 16 })
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { bold: true, fontSize: 16 })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('应该触发重绘', () => {
      api.setCellStyle(0, 0, { bold: true })
      
      expect(mockContext.draw).toHaveBeenCalledTimes(1)
    })

    it('应该支持部分样式更新', () => {
      cellStyles.set('0,0', { ...DEFAULT_CELL_STYLE, bold: true })
      
      api.setCellStyle(0, 0, { italic: true })
      
      const style = api.getCellStyle(0, 0)
      expect(style.bold).toBe(true)
      expect(style.italic).toBe(true)
    })
  })

  describe('clearCellStyle', () => {
    it('应该清除单元格样式', () => {
      cellStyles.set('0,0', { ...DEFAULT_CELL_STYLE, bold: true })
      
      api.clearCellStyle(0, 0)
      
      expect(mockContext.clearCellStyleFn).toHaveBeenCalledWith(0, 0)
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('清除后应该返回默认样式', () => {
      cellStyles.set('0,0', { ...DEFAULT_CELL_STYLE, bold: true })
      api.clearCellStyle(0, 0)
      
      const style = api.getCellStyle(0, 0)
      expect(style).toEqual(DEFAULT_CELL_STYLE)
    })
  })

  describe('setRangeStyle', () => {
    it('应该批量设置范围样式', () => {
      api.setRangeStyle(0, 0, 2, 2, { bold: true })
      
      expect(mockContext.setRangeStyleFn).toHaveBeenCalledWith(0, 0, 2, 2, { bold: true })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('范围内所有单元格应该被设置', () => {
      api.setRangeStyle(0, 0, 1, 1, { fontSize: 18 })
      
      expect(api.getCellStyle(0, 0).fontSize).toBe(18)
      expect(api.getCellStyle(0, 1).fontSize).toBe(18)
      expect(api.getCellStyle(1, 0).fontSize).toBe(18)
      expect(api.getCellStyle(1, 1).fontSize).toBe(18)
    })

    it('范围外单元格不应该被影响', () => {
      api.setRangeStyle(0, 0, 1, 1, { fontSize: 18 })
      
      expect(api.getCellStyle(2, 2).fontSize).toBe(DEFAULT_CELL_STYLE.fontSize)
    })
  })

  describe('快捷方法 - 字体样式', () => {
    it('setBold 应该设置粗体', () => {
      api.setBold(0, 0, true)
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { bold: true })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('setItalic 应该设置斜体', () => {
      api.setItalic(0, 0, true)
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { italic: true })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('setUnderline 应该设置下划线', () => {
      api.setUnderline(0, 0, 'double')
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { underline: 'double' })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('setStrikethrough 应该设置删除线', () => {
      api.setStrikethrough(0, 0, true)
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { strikethrough: true })
      expect(mockContext.draw).toHaveBeenCalled()
    })
  })

  describe('快捷方法 - 字体属性', () => {
    it('setFontFamily 应该设置字体', () => {
      api.setFontFamily(0, 0, 'Microsoft YaHei')
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { fontFamily: 'Microsoft YaHei' })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('setFontSize 应该设置字号', () => {
      api.setFontSize(0, 0, 16)
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { fontSize: 16 })
      expect(mockContext.draw).toHaveBeenCalled()
    })
  })

  describe('快捷方法 - 颜色', () => {
    it('setTextColor 应该设置文字颜色', () => {
      api.setTextColor(0, 0, '#FF0000')
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { color: '#FF0000' })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('setBackgroundColor 应该设置背景色', () => {
      api.setBackgroundColor(0, 0, '#FFFF00')
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { backgroundColor: '#FFFF00' })
      expect(mockContext.draw).toHaveBeenCalled()
    })
  })

  describe('快捷方法 - 对齐', () => {
    it('setTextAlign 应该设置水平对齐', () => {
      api.setTextAlign(0, 0, 'center')
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { textAlign: 'center' })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('setVerticalAlign 应该设置垂直对齐', () => {
      api.setVerticalAlign(0, 0, 'top')
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { verticalAlign: 'top' })
      expect(mockContext.draw).toHaveBeenCalled()
    })
  })

  describe('快捷方法 - 其他', () => {
    it('setWrapText 应该设置自动换行', () => {
      api.setWrapText(0, 0, true)
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { wrapText: true })
      expect(mockContext.draw).toHaveBeenCalled()
    })

    it('setTextRotation 应该设置文字旋转', () => {
      api.setTextRotation(0, 0, 45)
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { textRotation: 45 })
      expect(mockContext.draw).toHaveBeenCalled()
    })
  })

  describe('链式操作', () => {
    it('应该支持连续调用多个样式方法', () => {
      api.setBold(0, 0, true)
      api.setItalic(0, 0, true)
      api.setFontSize(0, 0, 16)
      api.setTextColor(0, 0, '#FF0000')
      
      const style = api.getCellStyle(0, 0)
      expect(style.bold).toBe(true)
      expect(style.italic).toBe(true)
      expect(style.fontSize).toBe(16)
      expect(style.color).toBe('#FF0000')
    })

    it('每次调用都应该触发重绘', () => {
      api.setBold(0, 0, true)
      api.setItalic(0, 0, true)
      api.setFontSize(0, 0, 16)
      
      expect(mockContext.draw).toHaveBeenCalledTimes(3)
    })
  })

  describe('边界情况', () => {
    it('应该处理负数行列', () => {
      expect(() => {
        api.setCellStyle(-1, -1, { bold: true })
      }).not.toThrow()
    })

    it('应该处理大数行列', () => {
      expect(() => {
        api.setCellStyle(1000000, 1000000, { bold: true })
      }).not.toThrow()
    })

    it('空样式对象应该正常处理', () => {
      api.setCellStyle(0, 0, {})
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, {})
    })

    it('undefined 值应该正常处理', () => {
      api.setUnderline(0, 0, false)
      
      expect(mockContext.setCellStyleFn).toHaveBeenCalledWith(0, 0, { underline: false })
    })
  })

  describe('与选区交互', () => {
    it('应该可以获取当前选区并设置样式', () => {
      mockContext.selected = { row: 2, col: 3 }
      
      const selection = api.getSelection()
      api.setBold(selection.row, selection.col, true)
      
      expect(api.getCellStyle(2, 3).bold).toBe(true)
    })

    it('应该可以对选区范围批量设置样式', () => {
      mockContext.selectionRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }
      
      const range = api.getSelectionRange()
      api.setRangeStyle(range.startRow, range.startCol, range.endRow, range.endCol, { bold: true })
      
      expect(api.getCellStyle(0, 0).bold).toBe(true)
      expect(api.getCellStyle(1, 1).bold).toBe(true)
      expect(api.getCellStyle(2, 2).bold).toBe(true)
    })
  })
})
