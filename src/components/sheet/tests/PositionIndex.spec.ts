/**
 * PositionIndex 单元测试
 * 验证位置索引的正确性和性能优化效果
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { PositionIndex, createPositionIndex } from '../PositionIndex'
import type { SizeAccess, GeometryConfig } from '../types'

describe('PositionIndex', () => {
  let posIndex: PositionIndex
  let sizes: SizeAccess
  let cfg: GeometryConfig
  
  beforeEach(() => {
    posIndex = createPositionIndex()
    sizes = {
      rowHeights: new Map(),
      colWidths: new Map(),
      hiddenRows: new Set(),
      hiddenCols: new Set()
    }
    cfg = {
      defaultRowHeight: 26,
      defaultColWidth: 100,
      rowHeaderWidth: 40,
      colHeaderHeight: 28
    }
  })
  
  describe('索引重建', () => {
    it('应正确构建默认高度的行索引', () => {
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      
      expect(posIndex.getRowTop(0)).toBe(0)
      expect(posIndex.getRowTop(1)).toBe(26)
      expect(posIndex.getRowTop(5)).toBe(26 * 5)
      expect(posIndex.getRowTop(10)).toBe(26 * 10)
    })
    
    it('应正确构建默认宽度的列索引', () => {
      posIndex.rebuildColIndex(sizes, cfg, 10)
      
      expect(posIndex.getColLeft(0)).toBe(0)
      expect(posIndex.getColLeft(1)).toBe(100)
      expect(posIndex.getColLeft(5)).toBe(100 * 5)
      expect(posIndex.getColLeft(10)).toBe(100 * 10)
    })
    
    it('应正确处理自定义行高', () => {
      sizes.rowHeights.set(2, 50) // 第3行高度为50
      sizes.rowHeights.set(5, 30) // 第6行高度为30
      
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      
      expect(posIndex.getRowTop(2)).toBe(26 * 2) // 0 + 26 + 26
      expect(posIndex.getRowTop(3)).toBe(26 * 2 + 50) // 前两行 + 自定义行
      expect(posIndex.getRowTop(6)).toBe(26 * 2 + 50 + 26 * 2 + 30)
    })
    
    it('应正确处理自定义列宽', () => {
      sizes.colWidths.set(1, 150) // 第2列宽度为150
      sizes.colWidths.set(3, 80)  // 第4列宽度为80
      
      posIndex.rebuildColIndex(sizes, cfg, 5)
      
      expect(posIndex.getColLeft(1)).toBe(100) // 第1列
      expect(posIndex.getColLeft(2)).toBe(100 + 150) // 第1列 + 自定义列
      expect(posIndex.getColLeft(4)).toBe(100 + 150 + 100 + 80)
    })
    
    it('应正确处理隐藏行', () => {
      sizes.hiddenRows = new Set([2, 4]) // 隐藏第3行和第5行
      
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      
      expect(posIndex.getRowTop(2)).toBe(26 * 2)
      expect(posIndex.getRowTop(3)).toBe(26 * 2) // 隐藏行高度为0
      expect(posIndex.getRowTop(5)).toBe(26 * 3) // 跳过了一个隐藏行
    })
    
    it('应正确处理隐藏列', () => {
      sizes.hiddenCols = new Set([1, 3])
      
      posIndex.rebuildColIndex(sizes, cfg, 5)
      
      expect(posIndex.getColLeft(2)).toBe(100) // 第2列，前面只有第1列可见
      expect(posIndex.getColLeft(4)).toBe(100 * 2) // 跳过了两个隐藏列
    })
    
    it('不应重复重建有效的索引', () => {
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      const firstTop5 = posIndex.getRowTop(5)
      
      // 再次调用不应改变结果
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      expect(posIndex.getRowTop(5)).toBe(firstTop5)
    })
    
    it('应在失效后重建索引', () => {
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      
      posIndex.invalidateRows()
      sizes.rowHeights.set(0, 50) // 修改第1行高度
      
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      expect(posIndex.getRowTop(1)).toBe(50) // 应反映新高度
    })
  })
  
  describe('位置查询', () => {
    beforeEach(() => {
      posIndex.rebuildRowIndex(sizes, cfg, 100)
      posIndex.rebuildColIndex(sizes, cfg, 50)
    })
    
    it('getRowHeight 应返回正确的行高', () => {
      expect(posIndex.getRowHeight(0)).toBe(26)
      expect(posIndex.getRowHeight(50)).toBe(26)
    })
    
    it('getColWidth 应返回正确的列宽', () => {
      expect(posIndex.getColWidth(0)).toBe(100)
      expect(posIndex.getColWidth(25)).toBe(100)
    })
    
    it('getTotalHeight 应返回正确的总高度', () => {
      expect(posIndex.getTotalHeight()).toBe(26 * 100)
    })
    
    it('getTotalWidth 应返回正确的总宽度', () => {
      expect(posIndex.getTotalWidth()).toBe(100 * 50)
    })
    
    it('边界情况：负数索引应返回0', () => {
      expect(posIndex.getRowTop(-1)).toBe(0)
      expect(posIndex.getColLeft(-5)).toBe(0)
    })
    
    it('边界情况：超出范围的索引应返回最后位置', () => {
      expect(posIndex.getRowTop(200)).toBe(26 * 100)
      expect(posIndex.getColLeft(100)).toBe(100 * 50)
    })
  })
  
  describe('二分查找', () => {
    beforeEach(() => {
      posIndex.rebuildRowIndex(sizes, cfg, 100)
      posIndex.rebuildColIndex(sizes, cfg, 50)
    })
    
    it('getRowAtY 应正确定位行', () => {
      expect(posIndex.getRowAtY(0)).toBe(0)
      expect(posIndex.getRowAtY(25)).toBe(0) // 在第1行内
      expect(posIndex.getRowAtY(26)).toBe(1) // 刚好到第2行
      expect(posIndex.getRowAtY(100)).toBe(3) // 26*3=78, 26*4=104
      expect(posIndex.getRowAtY(260)).toBe(10) // 26*10=260
    })
    
    it('getColAtX 应正确定位列', () => {
      expect(posIndex.getColAtX(0)).toBe(0)
      expect(posIndex.getColAtX(99)).toBe(0)
      expect(posIndex.getColAtX(100)).toBe(1)
      expect(posIndex.getColAtX(250)).toBe(2)
    })
    
    it('边界情况：负数坐标应返回0', () => {
      expect(posIndex.getRowAtY(-10)).toBe(0)
      expect(posIndex.getColAtX(-100)).toBe(0)
    })
    
    it('边界情况：超出总范围应返回最后一个索引', () => {
      expect(posIndex.getRowAtY(10000)).toBe(99)
      expect(posIndex.getColAtX(10000)).toBe(49)
    })
    
    it('应正确处理自定义尺寸', () => {
      sizes.rowHeights.set(5, 100) // 第6行高度为100
      posIndex.invalidateRows()
      posIndex.rebuildRowIndex(sizes, cfg, 100)
      
      // 第6行起始位置：5 * 26 = 130
      // 第6行结束位置：130 + 100 = 230
      // 第7行起始位置：230
      expect(posIndex.getRowAtY(130)).toBe(5)
      expect(posIndex.getRowAtY(200)).toBe(5)
      expect(posIndex.getRowAtY(230)).toBe(6)
    })
  })
  
  describe('可见范围计算', () => {
    beforeEach(() => {
      posIndex.rebuildRowIndex(sizes, cfg, 100)
      posIndex.rebuildColIndex(sizes, cfg, 50)
    })
    
    it('应正确计算从起始位置的可见范围', () => {
      const range = posIndex.getVisibleRange(500, 300, 0, 0, cfg)
      
      expect(range.startRow).toBe(0)
      expect(range.startCol).toBe(0)
      // 可见高度约 300-28=272, 272/26 ≈ 10.5 行
      expect(range.endRow).toBeGreaterThanOrEqual(10)
      // 可见宽度约 500-40=460, 460/100 = 4.6 列
      expect(range.endCol).toBeGreaterThanOrEqual(4)
    })
    
    it('应正确计算滚动后的可见范围', () => {
      const range = posIndex.getVisibleRange(500, 300, 260, 200, cfg)
      
      // scrollTop=260, 260/26=10
      expect(range.startRow).toBe(10)
      // scrollLeft=200, 200/100=2
      expect(range.startCol).toBe(2)
    })
  })
  
  describe('增量更新 - 行插入', () => {
    beforeEach(() => {
      posIndex.rebuildRowIndex(sizes, cfg, 10)
    })
    
    it('应正确处理在中间插入行', () => {
      const oldTop5 = posIndex.getRowTop(5)
      
      posIndex.insertRows(3, 2, 26) // 在第4行前插入2行
      
      expect(posIndex.totalRows).toBe(12)
      expect(posIndex.getRowTop(3)).toBe(26 * 3) // 插入位置不变
      expect(posIndex.getRowTop(5)).toBe(26 * 5) // 新插入的行
      expect(posIndex.getRowTop(7)).toBe(oldTop5 + 26 * 2) // 原第5行向下移动
    })
    
    it('应正确处理在开头插入行', () => {
      posIndex.insertRows(0, 3, 26)
      
      expect(posIndex.totalRows).toBe(13)
      expect(posIndex.getRowTop(0)).toBe(0)
      expect(posIndex.getRowTop(3)).toBe(26 * 3)
    })
    
    it('应正确处理在末尾插入行', () => {
      posIndex.insertRows(10, 5, 26)
      
      expect(posIndex.totalRows).toBe(15)
      expect(posIndex.getRowTop(10)).toBe(26 * 10)
      expect(posIndex.getRowTop(15)).toBe(26 * 15)
    })
    
    it('应正确处理自定义高度的插入', () => {
      posIndex.insertRows(5, 2, 26, [50, 30])
      
      expect(posIndex.getRowTop(6)).toBe(26 * 5 + 50)
      expect(posIndex.getRowTop(7)).toBe(26 * 5 + 50 + 30)
    })
  })
  
  describe('增量更新 - 行删除', () => {
    beforeEach(() => {
      posIndex.rebuildRowIndex(sizes, cfg, 10)
    })
    
    it('应正确处理删除中间行', () => {
      const oldTop7 = posIndex.getRowTop(7)
      
      posIndex.deleteRows(3, 2) // 删除第4、5行
      
      expect(posIndex.totalRows).toBe(8)
      expect(posIndex.getRowTop(3)).toBe(26 * 3)
      expect(posIndex.getRowTop(5)).toBe(oldTop7 - 26 * 2)
    })
    
    it('应正确处理删除开头行', () => {
      posIndex.deleteRows(0, 3)
      
      expect(posIndex.totalRows).toBe(7)
      expect(posIndex.getRowTop(0)).toBe(0)
      expect(posIndex.getTotalHeight()).toBe(26 * 7)
    })
    
    it('应正确处理删除末尾行', () => {
      posIndex.deleteRows(7, 3)
      
      expect(posIndex.totalRows).toBe(7)
      expect(posIndex.getTotalHeight()).toBe(26 * 7)
    })
    
    it('应处理删除超出范围的情况', () => {
      posIndex.deleteRows(8, 5) // 只有2行可删
      
      expect(posIndex.totalRows).toBe(8)
    })
  })
  
  describe('增量更新 - 列操作', () => {
    beforeEach(() => {
      posIndex.rebuildColIndex(sizes, cfg, 10)
    })
    
    it('应正确处理列插入', () => {
      posIndex.insertCols(5, 3, 100)
      
      expect(posIndex.totalCols).toBe(13)
      expect(posIndex.getColLeft(5)).toBe(100 * 5)
      expect(posIndex.getColLeft(8)).toBe(100 * 8)
    })
    
    it('应正确处理列删除', () => {
      posIndex.deleteCols(3, 2)
      
      expect(posIndex.totalCols).toBe(8)
      expect(posIndex.getColLeft(3)).toBe(100 * 3)
    })
    
    it('应正确处理自定义宽度的列插入', () => {
      posIndex.insertCols(2, 2, 100, [150, 80])
      
      expect(posIndex.getColLeft(3)).toBe(100 * 2 + 150)
      expect(posIndex.getColLeft(4)).toBe(100 * 2 + 150 + 80)
    })
  })
  
  describe('单行/单列高度更新', () => {
    beforeEach(() => {
      posIndex.rebuildRowIndex(sizes, cfg, 10)
      posIndex.rebuildColIndex(sizes, cfg, 10)
    })
    
    it('updateRowHeight 应正确更新单行高度', () => {
      const oldTop5 = posIndex.getRowTop(5)
      
      posIndex.updateRowHeight(3, 50) // 第4行改为50高
      
      expect(posIndex.getRowTop(4)).toBe(26 * 3 + 50)
      expect(posIndex.getRowTop(5)).toBe(oldTop5 + (50 - 26))
    })
    
    it('updateColWidth 应正确更新单列宽度', () => {
      const oldLeft5 = posIndex.getColLeft(5)
      
      posIndex.updateColWidth(2, 150)
      
      expect(posIndex.getColLeft(3)).toBe(100 * 2 + 150)
      expect(posIndex.getColLeft(5)).toBe(oldLeft5 + 50)
    })
    
    it('相同高度更新不应改变索引', () => {
      const oldTop5 = posIndex.getRowTop(5)
      
      posIndex.updateRowHeight(3, 26) // 没有变化
      
      expect(posIndex.getRowTop(5)).toBe(oldTop5)
    })
  })
  
  describe('性能验证', () => {
    it('应能快速构建大型索引', () => {
      const start = performance.now()
      posIndex.rebuildRowIndex(sizes, cfg, 10000)
      posIndex.rebuildColIndex(sizes, cfg, 1000)
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(100) // 应在100ms内完成
    })
    
    it('getRowTop 应为 O(1) 复杂度', () => {
      posIndex.rebuildRowIndex(sizes, cfg, 10000)
      
      const start = performance.now()
      for (let i = 0; i < 10000; i++) {
        posIndex.getRowTop(5000)
      }
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(50) // 10000次查询应在50ms内
    })
    
    it('getRowAtY 应为 O(log n) 复杂度', () => {
      posIndex.rebuildRowIndex(sizes, cfg, 10000)
      
      const start = performance.now()
      for (let i = 0; i < 10000; i++) {
        posIndex.getRowAtY(130000 * Math.random())
      }
      const duration = performance.now() - start
      
      expect(duration).toBeLessThan(50) // 10000次查询应在50ms内
    })
  })
})
