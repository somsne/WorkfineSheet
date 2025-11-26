import { describe, it, expect, beforeEach } from 'vitest'
import { SheetModel } from '../../../lib/SheetModel'
import { DEFAULT_CELL_STYLE } from '../types'
import type { CellStyle } from '../types'

describe('单元格样式 - 数据模型', () => {
  let model: SheetModel

  beforeEach(() => {
    model = new SheetModel()
  })

  describe('setCellStyle / getCellStyle', () => {
    it('应该设置和获取单元格样式', () => {
      const style: Partial<CellStyle> = { bold: true, fontSize: 16 }
      
      model.setCellStyle(0, 0, style)
      const result = model.getCellStyle(0, 0)
      
      expect(result.bold).toBe(true)
      expect(result.fontSize).toBe(16)
    })

    it('应该合并样式而不是替换', () => {
      model.setCellStyle(0, 0, { bold: true })
      model.setCellStyle(0, 0, { italic: true })
      
      const style = model.getCellStyle(0, 0)
      expect(style.bold).toBe(true)
      expect(style.italic).toBe(true)
    })

    it('未设置样式的单元格应返回默认样式', () => {
      const style = model.getCellStyle(10, 10)
      expect(style).toEqual(DEFAULT_CELL_STYLE)
    })

    it('应该正确设置所有样式属性', () => {
      const customStyle: Partial<CellStyle> = {
        fontFamily: 'Microsoft YaHei',
        fontSize: 14,
        bold: true,
        italic: true,
        underline: 'double',
        strikethrough: true,
        color: '#FF0000',
        backgroundColor: '#FFFF00',
        textAlign: 'center',
        verticalAlign: 'top',
        wrapText: true,
        textRotation: 45
      }

      model.setCellStyle(0, 0, customStyle)
      const result = model.getCellStyle(0, 0)

      expect(result.fontFamily).toBe('Microsoft YaHei')
      expect(result.fontSize).toBe(14)
      expect(result.bold).toBe(true)
      expect(result.italic).toBe(true)
      expect(result.underline).toBe('double')
      expect(result.strikethrough).toBe(true)
      expect(result.color).toBe('#FF0000')
      expect(result.backgroundColor).toBe('#FFFF00')
      expect(result.textAlign).toBe('center')
      expect(result.verticalAlign).toBe('top')
      expect(result.wrapText).toBe(true)
      expect(result.textRotation).toBe(45)
    })
  })

  describe('setRangeStyle', () => {
    it('应该批量设置范围样式', () => {
      const style: Partial<CellStyle> = { color: '#FF0000', bold: true }
      
      model.setRangeStyle(0, 0, 2, 2, style)
      
      expect(model.getCellStyle(0, 0).color).toBe('#FF0000')
      expect(model.getCellStyle(0, 0).bold).toBe(true)
      expect(model.getCellStyle(1, 1).color).toBe('#FF0000')
      expect(model.getCellStyle(1, 1).bold).toBe(true)
      expect(model.getCellStyle(2, 2).color).toBe('#FF0000')
      expect(model.getCellStyle(2, 2).bold).toBe(true)
    })

    it('批量设置应该对每个单元格都生效', () => {
      model.setRangeStyle(0, 0, 1, 1, { fontSize: 20 })
      
      expect(model.getCellStyle(0, 0).fontSize).toBe(20)
      expect(model.getCellStyle(0, 1).fontSize).toBe(20)
      expect(model.getCellStyle(1, 0).fontSize).toBe(20)
      expect(model.getCellStyle(1, 1).fontSize).toBe(20)
    })

    it('范围外的单元格不应该被影响', () => {
      model.setRangeStyle(0, 0, 1, 1, { fontSize: 20 })
      
      expect(model.getCellStyle(2, 2).fontSize).toBe(DEFAULT_CELL_STYLE.fontSize)
      expect(model.getCellStyle(5, 5).fontSize).toBe(DEFAULT_CELL_STYLE.fontSize)
    })
  })

  describe('clearCellStyle', () => {
    it('应该清除单元格样式', () => {
      model.setCellStyle(0, 0, { bold: true, fontSize: 20 })
      expect(model.hasCellStyle(0, 0)).toBe(true)
      
      model.clearCellStyle(0, 0)
      expect(model.hasCellStyle(0, 0)).toBe(false)
      
      const style = model.getCellStyle(0, 0)
      expect(style).toEqual(DEFAULT_CELL_STYLE)
    })

    it('清除不存在的样式不应该报错', () => {
      expect(() => {
        model.clearCellStyle(10, 10)
      }).not.toThrow()
    })
  })

  describe('hasCellStyle', () => {
    it('应该正确判断单元格是否有自定义样式', () => {
      expect(model.hasCellStyle(0, 0)).toBe(false)
      
      model.setCellStyle(0, 0, { bold: true })
      expect(model.hasCellStyle(0, 0)).toBe(true)
      
      model.clearCellStyle(0, 0)
      expect(model.hasCellStyle(0, 0)).toBe(false)
    })
  })

  describe('getStyledCellCount', () => {
    it('应该返回正确的样式单元格数量', () => {
      expect(model.getStyledCellCount()).toBe(0)
      
      model.setCellStyle(0, 0, { bold: true })
      expect(model.getStyledCellCount()).toBe(1)
      
      model.setCellStyle(1, 1, { italic: true })
      expect(model.getStyledCellCount()).toBe(2)
      
      model.clearCellStyle(0, 0)
      expect(model.getStyledCellCount()).toBe(1)
    })

    it('批量设置后应该正确计数', () => {
      model.setRangeStyle(0, 0, 2, 2, { bold: true })
      // 3x3 = 9 个单元格
      expect(model.getStyledCellCount()).toBe(9)
    })
  })

  describe('样式合并逻辑', () => {
    it('应该保留未修改的样式属性', () => {
      model.setCellStyle(0, 0, { bold: true, fontSize: 16 })
      model.setCellStyle(0, 0, { italic: true })
      
      const style = model.getCellStyle(0, 0)
      expect(style.bold).toBe(true)
      expect(style.fontSize).toBe(16)
      expect(style.italic).toBe(true)
    })

    it('应该覆盖相同的属性', () => {
      model.setCellStyle(0, 0, { fontSize: 16 })
      model.setCellStyle(0, 0, { fontSize: 20 })
      
      const style = model.getCellStyle(0, 0)
      expect(style.fontSize).toBe(20)
    })
  })

  describe('边界情况', () => {
    it('应该处理负数行列号', () => {
      expect(() => {
        model.setCellStyle(-1, -1, { bold: true })
      }).not.toThrow()
      
      const style = model.getCellStyle(-1, -1)
      expect(style.bold).toBe(true)
    })

    it('应该处理大数行列号', () => {
      const row = 1000000
      const col = 1000000
      
      model.setCellStyle(row, col, { bold: true })
      expect(model.getCellStyle(row, col).bold).toBe(true)
    })

    it('空样式对象不应该改变单元格', () => {
      model.setCellStyle(0, 0, { bold: true })
      model.setCellStyle(0, 0, {})
      
      const style = model.getCellStyle(0, 0)
      expect(style.bold).toBe(true)
    })
  })
})

describe('单元格样式 - 类型定义', () => {
  it('DEFAULT_CELL_STYLE 应该包含所有属性', () => {
    expect(DEFAULT_CELL_STYLE).toHaveProperty('fontFamily')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('fontSize')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('bold')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('italic')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('underline')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('strikethrough')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('color')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('backgroundColor')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('textAlign')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('verticalAlign')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('wrapText')
    expect(DEFAULT_CELL_STYLE).toHaveProperty('textRotation')
  })

  it('DEFAULT_CELL_STYLE 应该有正确的默认值', () => {
    expect(DEFAULT_CELL_STYLE.fontFamily).toBe('Arial, sans-serif')
    expect(DEFAULT_CELL_STYLE.fontSize).toBe(12)
    expect(DEFAULT_CELL_STYLE.bold).toBe(false)
    expect(DEFAULT_CELL_STYLE.italic).toBe(false)
    expect(DEFAULT_CELL_STYLE.underline).toBe(false)
    expect(DEFAULT_CELL_STYLE.strikethrough).toBe(false)
    expect(DEFAULT_CELL_STYLE.color).toBe('#000000')
    expect(DEFAULT_CELL_STYLE.backgroundColor).toBe('#FFFFFF')
    expect(DEFAULT_CELL_STYLE.textAlign).toBe('left')
    expect(DEFAULT_CELL_STYLE.verticalAlign).toBe('middle')
    expect(DEFAULT_CELL_STYLE.wrapText).toBe(false)
    expect(DEFAULT_CELL_STYLE.textRotation).toBe(0)
  })
})
