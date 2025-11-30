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

describe('行列样式', () => {
  let model: SheetModel

  beforeEach(() => {
    model = new SheetModel()
  })

  describe('列样式', () => {
    it('应该设置和获取列样式', () => {
      model.setColStyle(0, { bold: true, backgroundColor: '#FF0000' })
      
      const colStyle = model.getColStyle(0)
      expect(colStyle).toBeDefined()
      expect(colStyle?.bold).toBe(true)
      expect(colStyle?.backgroundColor).toBe('#FF0000')
    })

    it('列样式应该影响该列所有单元格', () => {
      model.setColStyle(0, { bold: true })
      
      // 该列的任意行都应该有粗体
      expect(model.getCellStyle(0, 0).bold).toBe(true)
      expect(model.getCellStyle(5, 0).bold).toBe(true)
      expect(model.getCellStyle(100, 0).bold).toBe(true)
      
      // 其他列不受影响
      expect(model.getCellStyle(0, 1).bold).toBe(false)
    })

    it('应该清除列样式', () => {
      model.setColStyle(0, { bold: true })
      model.clearColStyle(0)
      
      expect(model.getColStyle(0)).toBeUndefined()
      expect(model.getCellStyle(0, 0).bold).toBe(false)
    })
  })

  describe('行样式', () => {
    it('应该设置和获取行样式', () => {
      model.setRowStyle(0, { italic: true, color: '#00FF00' })
      
      const rowStyle = model.getRowStyle(0)
      expect(rowStyle).toBeDefined()
      expect(rowStyle?.italic).toBe(true)
      expect(rowStyle?.color).toBe('#00FF00')
    })

    it('行样式应该影响该行所有单元格', () => {
      model.setRowStyle(0, { italic: true })
      
      // 该行的任意列都应该有斜体
      expect(model.getCellStyle(0, 0).italic).toBe(true)
      expect(model.getCellStyle(0, 5).italic).toBe(true)
      expect(model.getCellStyle(0, 100).italic).toBe(true)
      
      // 其他行不受影响
      expect(model.getCellStyle(1, 0).italic).toBe(false)
    })

    it('应该清除行样式', () => {
      model.setRowStyle(0, { italic: true })
      model.clearRowStyle(0)
      
      expect(model.getRowStyle(0)).toBeUndefined()
      expect(model.getCellStyle(0, 0).italic).toBe(false)
    })
  })

  describe('样式优先级', () => {
    it('单元格样式 > 行样式 > 列样式', () => {
      // 设置列样式（最低优先级）
      model.setColStyle(0, { bold: true, italic: true, underline: true })
      
      // 设置行样式（中等优先级）
      model.setRowStyle(0, { italic: false, underline: true })
      
      // 设置单元格样式（最高优先级）
      model.setCellStyle(0, 0, { underline: false })
      
      const style = model.getCellStyle(0, 0)
      // bold 来自列样式
      expect(style.bold).toBe(true)
      // italic 来自行样式（覆盖列样式）
      expect(style.italic).toBe(false)
      // underline 来自单元格样式（覆盖行和列样式）
      expect(style.underline).toBe(false)
    })

    it('行样式和列样式交叉的单元格应正确合并', () => {
      model.setColStyle(0, { backgroundColor: '#FF0000' })
      model.setRowStyle(1, { color: '#00FF00' })
      
      // 交叉点：应该同时有背景色（列）和文字颜色（行）
      const style = model.getCellStyle(1, 0)
      expect(style.backgroundColor).toBe('#FF0000')
      expect(style.color).toBe('#00FF00')
    })
  })

  describe('行/列样式覆盖单元格样式', () => {
    it('设置列样式时应清除该列单元格的相同属性', () => {
      // 先给单元格设置粗体
      model.setCellStyle(0, 0, { bold: true })
      model.setCellStyle(1, 0, { bold: true })
      expect(model.getCellStyle(0, 0).bold).toBe(true)
      expect(model.getCellStyle(1, 0).bold).toBe(true)
      
      // 设置整列为非粗体
      model.setColStyle(0, { bold: false })
      
      // 单元格的粗体属性应该被清除，显示列样式的值
      expect(model.getCellStyle(0, 0).bold).toBe(false)
      expect(model.getCellStyle(1, 0).bold).toBe(false)
    })

    it('设置行样式时应清除该行单元格的相同属性', () => {
      // 先给单元格设置斜体
      model.setCellStyle(0, 0, { italic: true })
      model.setCellStyle(0, 1, { italic: true })
      expect(model.getCellStyle(0, 0).italic).toBe(true)
      expect(model.getCellStyle(0, 1).italic).toBe(true)
      
      // 设置整行为非斜体
      model.setRowStyle(0, { italic: false })
      
      // 单元格的斜体属性应该被清除，显示行样式的值
      expect(model.getCellStyle(0, 0).italic).toBe(false)
      expect(model.getCellStyle(0, 1).italic).toBe(false)
    })

    it('设置列样式时不应影响其他属性', () => {
      // 给单元格设置多个属性
      model.setCellStyle(0, 0, { bold: true, italic: true, color: '#FF0000' })
      
      // 只设置列的粗体属性
      model.setColStyle(0, { bold: false })
      
      // bold 被清除并使用列样式，但 italic 和 color 保留
      const style = model.getCellStyle(0, 0)
      expect(style.bold).toBe(false)
      expect(style.italic).toBe(true)
      expect(style.color).toBe('#FF0000')
    })

    it('设置行样式时不应影响其他列的单元格', () => {
      // 给多列设置样式
      model.setCellStyle(0, 0, { bold: true })
      model.setCellStyle(0, 1, { bold: true })
      
      // 设置第0列的列样式
      model.setColStyle(0, { bold: false })
      
      // 第0列的单元格粗体被清除
      expect(model.getCellStyle(0, 0).bold).toBe(false)
      // 第1列的单元格粗体保留
      expect(model.getCellStyle(0, 1).bold).toBe(true)
    })
  })
})
