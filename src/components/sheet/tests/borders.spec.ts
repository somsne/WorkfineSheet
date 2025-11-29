/**
 * 单元格边框测试
 */

import { describe, it, expect, beforeEach } from 'vitest'

// 检测 CI 环境
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
import { SheetModel } from '../../../lib/SheetModel'
import type { CellBorder, BorderEdge } from '../types'

describe('单元格边框', () => {
  let model: SheetModel

  beforeEach(() => {
    model = new SheetModel()
  })

  describe('数据结构', () => {
    it('应该设置和获取单元格边框', () => {
      const border: CellBorder = {
        top: { style: 'thin', color: '#000000' },
        bottom: { style: 'thick', color: '#FF0000' }
      }
      
      model.setCellBorder(0, 0, border)
      const result = model.getCellBorder(0, 0)
      
      expect(result?.top?.style).toBe('thin')
      expect(result?.top?.color).toBe('#000000')
      expect(result?.bottom?.style).toBe('thick')
      expect(result?.bottom?.color).toBe('#FF0000')
    })

    it('应该合并边框设置', () => {
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      model.setCellBorder(0, 0, { bottom: { style: 'thick' } })
      
      const border = model.getCellBorder(0, 0)
      expect(border?.top?.style).toBe('thin')
      expect(border?.bottom?.style).toBe('thick')
    })

    it('应该清除单元格边框', () => {
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      model.clearCellBorder(0, 0)
      
      expect(model.getCellBorder(0, 0)).toBeUndefined()
    })

    it('应该检查单元格是否有边框', () => {
      expect(model.hasCellBorder(0, 0)).toBe(false)
      
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      expect(model.hasCellBorder(0, 0)).toBe(true)
      
      model.clearCellBorder(0, 0)
      expect(model.hasCellBorder(0, 0)).toBe(false)
    })

    it('应该获取有边框的单元格数量', () => {
      expect(model.getBorderedCellCount()).toBe(0)
      
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      model.setCellBorder(1, 1, { bottom: { style: 'thick' } })
      expect(model.getBorderedCellCount()).toBe(2)
      
      model.clearCellBorder(0, 0)
      expect(model.getBorderedCellCount()).toBe(1)
    })
  })

  describe('范围操作', () => {
    it('应该设置范围全边框', () => {
      const border: CellBorder = {
        top: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' }
      }
      
      model.setRangeBorder(0, 0, 2, 2, border)
      
      // 检查范围内所有单元格都有边框
      for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 2; c++) {
          const cellBorder = model.getCellBorder(r, c)
          expect(cellBorder?.top?.style).toBe('thin')
          expect(cellBorder?.right?.style).toBe('thin')
          expect(cellBorder?.bottom?.style).toBe('thin')
          expect(cellBorder?.left?.style).toBe('thin')
        }
      }
    })

    it('应该设置范围外边框', () => {
      const edge: BorderEdge = { style: 'thick', color: '#000000' }
      
      model.setRangeOuterBorder(0, 0, 2, 2, edge)
      
      // 检查四角单元格有两条边框
      const topLeft = model.getCellBorder(0, 0)
      expect(topLeft?.top?.style).toBe('thick')
      expect(topLeft?.left?.style).toBe('thick')
      
      const topRight = model.getCellBorder(0, 2)
      expect(topRight?.top?.style).toBe('thick')
      expect(topRight?.right?.style).toBe('thick')
      
      const bottomLeft = model.getCellBorder(2, 0)
      expect(bottomLeft?.bottom?.style).toBe('thick')
      expect(bottomLeft?.left?.style).toBe('thick')
      
      const bottomRight = model.getCellBorder(2, 2)
      expect(bottomRight?.bottom?.style).toBe('thick')
      expect(bottomRight?.right?.style).toBe('thick')
      
      // 检查边缘单元格有一条边框
      const topMiddle = model.getCellBorder(0, 1)
      expect(topMiddle?.top?.style).toBe('thick')
      expect(topMiddle?.bottom).toBeUndefined()
      expect(topMiddle?.left).toBeUndefined()
      expect(topMiddle?.right).toBeUndefined()
      
      const middleLeft = model.getCellBorder(1, 0)
      expect(middleLeft?.left?.style).toBe('thick')
      expect(middleLeft?.top).toBeUndefined()
      expect(middleLeft?.bottom).toBeUndefined()
      expect(middleLeft?.right).toBeUndefined()
      
      // 检查中心单元格无边框
      expect(model.getCellBorder(1, 1)).toBeUndefined()
    })

    it('应该清除范围边框', () => {
      model.setRangeBorder(0, 0, 2, 2, {
        top: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' }
      })
      
      model.clearRangeBorder(0, 0, 2, 2)
      
      for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 2; c++) {
          expect(model.getCellBorder(r, c)).toBeUndefined()
        }
      }
    })

    it('应该支持范围边框的部分设置', () => {
      // 先设置全边框
      model.setRangeBorder(0, 0, 2, 2, {
        top: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' }
      })
      
      // 再设置外边框（应该覆盖外层单元格）
      model.setRangeOuterBorder(0, 0, 2, 2, { style: 'thick', color: '#FF0000' })
      
      // 检查四角单元格的外边是 thick，内边还是 thin
      const topLeft = model.getCellBorder(0, 0)
      expect(topLeft?.top?.style).toBe('thick')
      expect(topLeft?.left?.style).toBe('thick')
      expect(topLeft?.bottom?.style).toBe('thin')
      expect(topLeft?.right?.style).toBe('thin')
    })
  })

  describe('边界情况', () => {
    it('应该处理部分边框', () => {
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      
      const border = model.getCellBorder(0, 0)
      expect(border?.top?.style).toBe('thin')
      expect(border?.right).toBeUndefined()
      expect(border?.bottom).toBeUndefined()
      expect(border?.left).toBeUndefined()
    })

    it('应该处理不存在的边框', () => {
      expect(model.getCellBorder(0, 0)).toBeUndefined()
    })

    it('应该支持所有边框样式', () => {
      const styles: Array<BorderEdge['style']> = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double', 'none']
      
      styles.forEach((style, index) => {
        model.setCellBorder(index, 0, { top: { style } })
        expect(model.getCellBorder(index, 0)?.top?.style).toBe(style)
      })
    })

    it('应该处理负数行列号', () => {
      expect(() => {
        model.setCellBorder(-1, -1, { top: { style: 'thin' } })
      }).not.toThrow()
      
      const border = model.getCellBorder(-1, -1)
      expect(border?.top?.style).toBe('thin')
    })

    it('应该处理大数行列号', () => {
      const row = 1000000
      const col = 1000000
      
      model.setCellBorder(row, col, { top: { style: 'thin' } })
      expect(model.getCellBorder(row, col)?.top?.style).toBe('thin')
    })

    it('空边框对象不应该改变单元格', () => {
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      model.setCellBorder(0, 0, {})
      
      const border = model.getCellBorder(0, 0)
      expect(border?.top?.style).toBe('thin')
    })

    it('应该支持自定义颜色', () => {
      model.setCellBorder(0, 0, {
        top: { style: 'thin', color: '#FF0000' },
        bottom: { style: 'thick', color: 'rgb(0, 255, 0)' }
      })
      
      const border = model.getCellBorder(0, 0)
      expect(border?.top?.color).toBe('#FF0000')
      expect(border?.bottom?.color).toBe('rgb(0, 255, 0)')
    })

    it('应该支持自定义宽度', () => {
      model.setCellBorder(0, 0, {
        top: { style: 'thin', width: 2 },
        bottom: { style: 'thick', width: 5 }
      })
      
      const border = model.getCellBorder(0, 0)
      expect(border?.top?.width).toBe(2)
      expect(border?.bottom?.width).toBe(5)
    })

    it('单行/单列范围应该正确设置外边框', () => {
      const edge: BorderEdge = { style: 'thick' }
      
      // 单行
      model.setRangeOuterBorder(0, 0, 0, 3, edge)
      expect(model.getCellBorder(0, 0)?.top?.style).toBe('thick')
      expect(model.getCellBorder(0, 0)?.bottom?.style).toBe('thick')
      expect(model.getCellBorder(0, 0)?.left?.style).toBe('thick')
      expect(model.getCellBorder(0, 3)?.right?.style).toBe('thick')
      
      model.clearRangeBorder(0, 0, 0, 3)
      
      // 单列
      model.setRangeOuterBorder(0, 0, 3, 0, edge)
      expect(model.getCellBorder(0, 0)?.top?.style).toBe('thick')
      expect(model.getCellBorder(0, 0)?.left?.style).toBe('thick')
      expect(model.getCellBorder(0, 0)?.right?.style).toBe('thick')
      expect(model.getCellBorder(3, 0)?.bottom?.style).toBe('thick')
    })

    it('单个单元格外边框应该设置四边', () => {
      const edge: BorderEdge = { style: 'thick', color: '#FF0000' }
      
      model.setRangeOuterBorder(0, 0, 0, 0, edge)
      
      const border = model.getCellBorder(0, 0)
      expect(border?.top?.style).toBe('thick')
      expect(border?.right?.style).toBe('thick')
      expect(border?.bottom?.style).toBe('thick')
      expect(border?.left?.style).toBe('thick')
      expect(border?.top?.color).toBe('#FF0000')
    })
  })

  describe.skipIf(isCI)('性能', () => {
    it('应该快速设置大量边框', () => {
      const start = performance.now()
      
      // 设置 100x100 的范围边框
      model.setRangeBorder(0, 0, 99, 99, {
        top: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' }
      })
      
      const end = performance.now()
      const time = end - start
      
      // 应该在 100ms 内完成
      expect(time).toBeLessThan(100)
      expect(model.getBorderedCellCount()).toBe(10000)
    })

    it('应该快速查询边框', () => {
      // 设置一些边框
      for (let i = 0; i < 1000; i++) {
        model.setCellBorder(i, 0, { top: { style: 'thin' } })
      }
      
      const start = performance.now()
      
      // 查询 1000 次
      for (let i = 0; i < 1000; i++) {
        model.getCellBorder(i, 0)
      }
      
      const end = performance.now()
      const time = end - start
      
      // 应该在 20ms 内完成
      expect(time).toBeLessThan(20)
    })

    it('应该快速清除大量边框', () => {
      // 先设置边框
      model.setRangeBorder(0, 0, 99, 99, {
        top: { style: 'thin' }
      })
      
      const start = performance.now()
      
      // 清除边框
      model.clearRangeBorder(0, 0, 99, 99)
      
      const end = performance.now()
      const time = end - start
      
      // 应该在 50ms 内完成
      expect(time).toBeLessThan(50)
      expect(model.getBorderedCellCount()).toBe(0)
    })
  })
})
