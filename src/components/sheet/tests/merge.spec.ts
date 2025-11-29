/**
 * 合并单元格功能单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { SheetModel } from '../../../lib/SheetModel'

describe('SheetModel 合并单元格', () => {
  let model: SheetModel

  beforeEach(() => {
    model = new SheetModel()
  })

  describe('mergeCells - 合并单元格', () => {
    it('应该成功合并 2x2 区域', () => {
      const result = model.mergeCells(0, 0, 1, 1)
      
      expect(result).toBe(true)
      expect(model.getMergedRegionCount()).toBe(1)
    })

    it('应该成功合并 3x2 区域', () => {
      const result = model.mergeCells(0, 0, 2, 1)
      
      expect(result).toBe(true)
      const region = model.getMergedRegion(0, 0)
      expect(region).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 2,
        endCol: 1
      })
    })

    it('应该自动规范化坐标（start > end）', () => {
      const result = model.mergeCells(2, 2, 0, 0)
      
      expect(result).toBe(true)
      const region = model.getMergedRegion(0, 0)
      expect(region?.startRow).toBe(0)
      expect(region?.startCol).toBe(0)
      expect(region?.endRow).toBe(2)
      expect(region?.endCol).toBe(2)
    })

    it('单个单元格不应该合并', () => {
      const result = model.mergeCells(0, 0, 0, 0)
      
      expect(result).toBe(false)
      expect(model.getMergedRegionCount()).toBe(0)
    })

    it('应该拒绝与现有合并区域部分重叠的合并', () => {
      // 先合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 尝试合并 B2:C3（部分重叠）
      const result = model.mergeCells(1, 1, 2, 2)
      
      expect(result).toBe(false)
      expect(model.getMergedRegionCount()).toBe(1)
    })

    it('应该允许完全包含现有合并区域的合并', () => {
      // 先合并 B2:C3
      model.mergeCells(1, 1, 2, 2)
      
      // 合并更大的区域 A1:D4
      const result = model.mergeCells(0, 0, 3, 3)
      
      expect(result).toBe(true)
    })
  })

  describe('unmergeCells - 取消合并', () => {
    it('应该成功取消合并', () => {
      model.mergeCells(0, 0, 1, 1)
      
      const region = model.unmergeCells(0, 0)
      
      expect(region).not.toBeNull()
      expect(region?.startRow).toBe(0)
      expect(region?.startCol).toBe(0)
      expect(model.getMergedRegionCount()).toBe(0)
    })

    it('应该能通过合并区域内任意单元格取消合并', () => {
      model.mergeCells(0, 0, 2, 2)
      
      // 通过右下角单元格取消
      const region = model.unmergeCells(2, 2)
      
      expect(region).not.toBeNull()
      expect(model.getMergedRegionCount()).toBe(0)
    })

    it('对非合并单元格调用应返回 null', () => {
      const region = model.unmergeCells(0, 0)
      
      expect(region).toBeNull()
    })
  })

  describe('getMergedCellInfo - 获取合并信息', () => {
    beforeEach(() => {
      // 合并 A1:C3
      model.mergeCells(0, 0, 2, 2)
    })

    it('主单元格应该返回正确的信息', () => {
      const info = model.getMergedCellInfo(0, 0)
      
      expect(info.isMerged).toBe(true)
      expect(info.isMaster).toBe(true)
      expect(info.region).toBeDefined()
      expect(info.region?.startRow).toBe(0)
      expect(info.region?.startCol).toBe(0)
    })

    it('非主单元格应该返回 isMaster = false', () => {
      const info = model.getMergedCellInfo(1, 1)
      
      expect(info.isMerged).toBe(true)
      expect(info.isMaster).toBe(false)
      expect(info.region?.startRow).toBe(0)
    })

    it('右下角单元格应该属于合并区域', () => {
      const info = model.getMergedCellInfo(2, 2)
      
      expect(info.isMerged).toBe(true)
      expect(info.isMaster).toBe(false)
    })

    it('合并区域外的单元格应该返回 isMerged = false', () => {
      const info = model.getMergedCellInfo(3, 3)
      
      expect(info.isMerged).toBe(false)
      expect(info.isMaster).toBe(false)
      expect(info.region).toBeUndefined()
    })
  })

  describe('getMergedRegion - 获取合并区域', () => {
    it('应该通过任意单元格获取合并区域', () => {
      model.mergeCells(0, 0, 2, 2)
      
      // 通过各个位置都能获取到同一个区域
      const region1 = model.getMergedRegion(0, 0)
      const region2 = model.getMergedRegion(1, 1)
      const region3 = model.getMergedRegion(2, 2)
      
      expect(region1).toEqual(region2)
      expect(region2).toEqual(region3)
    })

    it('非合并单元格应返回 null', () => {
      const region = model.getMergedRegion(5, 5)
      
      expect(region).toBeNull()
    })
  })

  describe('getAllMergedRegions - 获取所有合并区域', () => {
    it('没有合并时应返回空数组', () => {
      const regions = model.getAllMergedRegions()
      
      expect(regions).toEqual([])
    })

    it('应该返回所有合并区域', () => {
      model.mergeCells(0, 0, 1, 1)  // A1:B2
      model.mergeCells(3, 3, 4, 4)  // D4:E5
      model.mergeCells(0, 5, 2, 6)  // F1:G3
      
      const regions = model.getAllMergedRegions()
      
      expect(regions.length).toBe(3)
    })
  })

  describe('canMerge - 检查是否可以合并', () => {
    it('空区域应该可以合并', () => {
      const result = model.canMerge(0, 0, 2, 2)
      
      expect(result).toBe(true)
    })

    it('与现有区域部分重叠时不可合并', () => {
      model.mergeCells(0, 0, 2, 2)
      
      const result = model.canMerge(1, 1, 3, 3)
      
      expect(result).toBe(false)
    })

    it('完全包含现有区域时可以合并', () => {
      model.mergeCells(1, 1, 2, 2)
      
      const result = model.canMerge(0, 0, 3, 3)
      
      expect(result).toBe(true)
    })

    it('完全不重叠时可以合并', () => {
      model.mergeCells(0, 0, 1, 1)
      
      const result = model.canMerge(3, 3, 4, 4)
      
      expect(result).toBe(true)
    })
  })

  describe('hasDataToLose - 检查数据丢失', () => {
    it('空区域不会丢失数据', () => {
      const result = model.hasDataToLose(0, 0, 2, 2)
      
      expect(result).toBe(false)
    })

    it('只有一个单元格有值时不会丢失数据', () => {
      model.setValue(0, 0, 'test')
      
      const result = model.hasDataToLose(0, 0, 2, 2)
      
      expect(result).toBe(false)
    })

    it('多个单元格有值时会丢失数据', () => {
      model.setValue(0, 0, 'A')
      model.setValue(1, 1, 'B')
      
      const result = model.hasDataToLose(0, 0, 2, 2)
      
      expect(result).toBe(true)
    })

    it('主单元格有值，其他单元格也有值时会丢失数据', () => {
      model.setValue(0, 0, 'master')
      model.setValue(0, 1, 'other')
      
      const result = model.hasDataToLose(0, 0, 1, 1)
      
      expect(result).toBe(true)
    })
  })

  describe('isMergedCell 和 isMasterCell', () => {
    beforeEach(() => {
      model.mergeCells(0, 0, 2, 2)
    })

    it('isMergedCell 应该正确判断', () => {
      expect(model.isMergedCell(0, 0)).toBe(true)
      expect(model.isMergedCell(1, 1)).toBe(true)
      expect(model.isMergedCell(2, 2)).toBe(true)
      expect(model.isMergedCell(3, 3)).toBe(false)
    })

    it('isMasterCell 应该只对主单元格返回 true', () => {
      expect(model.isMasterCell(0, 0)).toBe(true)
      expect(model.isMasterCell(1, 1)).toBe(false)
      expect(model.isMasterCell(2, 2)).toBe(false)
      expect(model.isMasterCell(3, 3)).toBe(false)
    })
  })

  describe('forEachMergedRegion - 遍历合并区域', () => {
    it('应该遍历所有合并区域', () => {
      model.mergeCells(0, 0, 1, 1)
      model.mergeCells(3, 3, 4, 4)
      
      const regions: Array<{ startRow: number; startCol: number }> = []
      model.forEachMergedRegion((region) => {
        regions.push({ startRow: region.startRow, startCol: region.startCol })
      })
      
      expect(regions.length).toBe(2)
      expect(regions).toContainEqual({ startRow: 0, startCol: 0 })
      expect(regions).toContainEqual({ startRow: 3, startCol: 3 })
    })
  })

  describe('clearAllMergedRegions - 清除所有合并', () => {
    it('应该清除所有合并区域', () => {
      model.mergeCells(0, 0, 1, 1)
      model.mergeCells(3, 3, 4, 4)
      model.mergeCells(6, 6, 7, 7)
      
      expect(model.getMergedRegionCount()).toBe(3)
      
      model.clearAllMergedRegions()
      
      expect(model.getMergedRegionCount()).toBe(0)
      expect(model.isMergedCell(0, 0)).toBe(false)
      expect(model.isMergedCell(3, 3)).toBe(false)
    })
  })

  describe('多个合并区域', () => {
    it('应该支持多个独立的合并区域', () => {
      model.mergeCells(0, 0, 1, 1)   // A1:B2
      model.mergeCells(0, 3, 2, 4)   // D1:E3
      model.mergeCells(4, 0, 5, 2)   // A5:C6
      
      expect(model.getMergedRegionCount()).toBe(3)
      
      // 验证各区域独立
      const info1 = model.getMergedCellInfo(0, 0)
      const info2 = model.getMergedCellInfo(0, 3)
      const info3 = model.getMergedCellInfo(4, 0)
      
      expect(info1.region?.endRow).toBe(1)
      expect(info2.region?.endRow).toBe(2)
      expect(info3.region?.endCol).toBe(2)
    })

    it('取消一个合并不应影响其他合并', () => {
      model.mergeCells(0, 0, 1, 1)
      model.mergeCells(3, 3, 4, 4)
      
      model.unmergeCells(0, 0)
      
      expect(model.getMergedRegionCount()).toBe(1)
      expect(model.isMergedCell(0, 0)).toBe(false)
      expect(model.isMergedCell(3, 3)).toBe(true)
    })
  })

  describe('合并单元格边框处理（Excel 行为）', () => {
    it('应该保留合并区域的顶边框', () => {
      // 在第一行的单元格设置顶边框
      model.setCellBorder(0, 0, { top: { style: 'thin', color: '#000000' } })
      model.setCellBorder(0, 1, { top: { style: 'medium', color: '#ff0000' } })
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证主单元格保留了顶边框（使用第一个找到的）
      const masterBorder = model.getCellBorder(0, 0)
      expect(masterBorder?.top).toBeDefined()
      expect(masterBorder?.top?.style).toBe('thin')
    })

    it('应该保留合并区域的底边框', () => {
      // 在最后一行的单元格设置底边框
      model.setCellBorder(1, 0, { bottom: { style: 'medium', color: '#00ff00' } })
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证主单元格保留了底边框
      const masterBorder = model.getCellBorder(0, 0)
      expect(masterBorder?.bottom).toBeDefined()
      expect(masterBorder?.bottom?.style).toBe('medium')
    })

    it('应该保留合并区域的左边框', () => {
      // 在第一列的单元格设置左边框
      model.setCellBorder(0, 0, { left: { style: 'thick', color: '#0000ff' } })
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证主单元格保留了左边框
      const masterBorder = model.getCellBorder(0, 0)
      expect(masterBorder?.left).toBeDefined()
      expect(masterBorder?.left?.style).toBe('thick')
    })

    it('应该保留合并区域的右边框', () => {
      // 在最后一列的单元格设置右边框
      model.setCellBorder(0, 1, { right: { style: 'dashed', color: '#ff00ff' } })
      model.setCellBorder(1, 1, { right: { style: 'dotted', color: '#00ffff' } })
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证主单元格保留了右边框（使用第一个找到的）
      const masterBorder = model.getCellBorder(0, 0)
      expect(masterBorder?.right).toBeDefined()
      expect(masterBorder?.right?.style).toBe('dashed')
    })

    it('应该清除非主单元格的边框', () => {
      // 设置多个单元格的边框
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      model.setCellBorder(0, 1, { top: { style: 'thin' }, right: { style: 'thin' } })
      model.setCellBorder(1, 0, { left: { style: 'thin' }, bottom: { style: 'thin' } })
      model.setCellBorder(1, 1, { right: { style: 'thin' }, bottom: { style: 'thin' } })
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证非主单元格没有边框
      expect(model.getCellBorder(0, 1)).toBeUndefined()
      expect(model.getCellBorder(1, 0)).toBeUndefined()
      expect(model.getCellBorder(1, 1)).toBeUndefined()
    })

    it('应该将所有外边框合并到主单元格', () => {
      // 设置完整的外边框
      model.setCellBorder(0, 0, { top: { style: 'thin', color: '#ff0000' }, left: { style: 'thin', color: '#00ff00' } })
      model.setCellBorder(0, 1, { top: { style: 'thin', color: '#0000ff' }, right: { style: 'medium', color: '#ff00ff' } })
      model.setCellBorder(1, 0, { left: { style: 'thick', color: '#00ffff' }, bottom: { style: 'dashed', color: '#ffff00' } })
      model.setCellBorder(1, 1, { right: { style: 'dotted', color: '#ffffff' }, bottom: { style: 'double', color: '#000000' } })
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证主单元格有所有外边框
      const masterBorder = model.getCellBorder(0, 0)
      expect(masterBorder?.top).toBeDefined()
      expect(masterBorder?.right).toBeDefined()
      expect(masterBorder?.bottom).toBeDefined()
      expect(masterBorder?.left).toBeDefined()
    })

    it('合并没有边框的单元格不应产生边框', () => {
      // 不设置任何边框
      model.setValue(0, 0, 'test')
      model.setValue(1, 1, 'test2')
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证主单元格没有边框
      expect(model.getCellBorder(0, 0)).toBeUndefined()
    })

    it('应该清除内部边框（单元格之间的边框）', () => {
      // 设置内部边框（单元格右边框 = 下一单元格的左边框在视觉上）
      model.setCellBorder(0, 0, { right: { style: 'thin' } })  // A1 的右边框（内部）
      model.setCellBorder(0, 1, { left: { style: 'thin' } })   // B1 的左边框（内部）
      model.setCellBorder(0, 0, { bottom: { style: 'thin' } }) // A1 的底边框（内部）
      model.setCellBorder(1, 0, { top: { style: 'thin' } })    // A2 的顶边框（内部）
      
      // 合并 A1:B2
      model.mergeCells(0, 0, 1, 1)
      
      // 验证主单元格只有外边框，没有内部边框
      // 注意：A1 的 right 和 bottom 是内部边框，应该被清除
      // 但如果 A1 有 top 和 left，它们是外边框，应该保留
      const masterBorder = model.getCellBorder(0, 0)
      // 内部边框应该被清除（没有设置外边框，所以应该是 undefined）
      expect(masterBorder).toBeUndefined()
    })
  })

  describe('取消合并单元格边框处理（Excel 行为）', () => {
    it('取消合并时应该将顶边框分配到第一行的所有单元格', () => {
      // 先合并，再设置边框（这样边框存储在主单元格）
      model.mergeCells(0, 0, 1, 2)  // A1:C2
      model.setCellBorder(0, 0, { top: { style: 'medium', color: '#ff0000' } })
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证第一行的所有单元格都有顶边框
      expect(model.getCellBorder(0, 0)?.top?.style).toBe('medium')
      expect(model.getCellBorder(0, 1)?.top?.style).toBe('medium')
      expect(model.getCellBorder(0, 2)?.top?.style).toBe('medium')
    })

    it('取消合并时应该将底边框分配到最后一行的所有单元格', () => {
      // 先合并，再设置边框
      model.mergeCells(0, 0, 1, 2)  // A1:C2
      model.setCellBorder(0, 0, { bottom: { style: 'thick', color: '#00ff00' } })
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证最后一行的所有单元格都有底边框
      expect(model.getCellBorder(1, 0)?.bottom?.style).toBe('thick')
      expect(model.getCellBorder(1, 1)?.bottom?.style).toBe('thick')
      expect(model.getCellBorder(1, 2)?.bottom?.style).toBe('thick')
    })

    it('取消合并时应该将左边框分配到第一列的所有单元格', () => {
      // 先合并，再设置边框
      model.mergeCells(0, 0, 2, 1)  // A1:B3
      model.setCellBorder(0, 0, { left: { style: 'dashed', color: '#0000ff' } })
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证第一列的所有单元格都有左边框
      expect(model.getCellBorder(0, 0)?.left?.style).toBe('dashed')
      expect(model.getCellBorder(1, 0)?.left?.style).toBe('dashed')
      expect(model.getCellBorder(2, 0)?.left?.style).toBe('dashed')
    })

    it('取消合并时应该将右边框分配到最后一列的所有单元格', () => {
      // 先合并，再设置边框
      model.mergeCells(0, 0, 2, 1)  // A1:B3
      model.setCellBorder(0, 0, { right: { style: 'dotted', color: '#ff00ff' } })
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证最后一列的所有单元格都有右边框
      expect(model.getCellBorder(0, 1)?.right?.style).toBe('dotted')
      expect(model.getCellBorder(1, 1)?.right?.style).toBe('dotted')
      expect(model.getCellBorder(2, 1)?.right?.style).toBe('dotted')
    })

    it('取消合并时应该正确分配所有边框', () => {
      // 先合并，再设置完整边框
      model.mergeCells(0, 0, 1, 1)  // A1:B2
      model.setCellBorder(0, 0, { 
        top: { style: 'thin', color: '#ff0000' }, 
        left: { style: 'thin', color: '#00ff00' },
        right: { style: 'medium', color: '#0000ff' },
        bottom: { style: 'thick', color: '#ffff00' }
      })
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证边框分配
      // 顶边框：A1, B1
      expect(model.getCellBorder(0, 0)?.top).toBeDefined()
      expect(model.getCellBorder(0, 1)?.top).toBeDefined()
      
      // 底边框：A2, B2
      expect(model.getCellBorder(1, 0)?.bottom).toBeDefined()
      expect(model.getCellBorder(1, 1)?.bottom).toBeDefined()
      
      // 左边框：A1, A2
      expect(model.getCellBorder(0, 0)?.left).toBeDefined()
      expect(model.getCellBorder(1, 0)?.left).toBeDefined()
      
      // 右边框：B1, B2
      expect(model.getCellBorder(0, 1)?.right).toBeDefined()
      expect(model.getCellBorder(1, 1)?.right).toBeDefined()
    })

    it('取消合并没有边框的单元格不应产生边框', () => {
      // 合并没有边框的单元格
      model.setValue(0, 0, 'test')
      model.mergeCells(0, 0, 1, 1)
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证没有边框
      expect(model.getCellBorder(0, 0)).toBeUndefined()
      expect(model.getCellBorder(0, 1)).toBeUndefined()
      expect(model.getCellBorder(1, 0)).toBeUndefined()
      expect(model.getCellBorder(1, 1)).toBeUndefined()
    })

    it('角落单元格应该有两个边框', () => {
      // 先合并，再设置四个边框
      model.mergeCells(0, 0, 1, 1)  // A1:B2
      model.setCellBorder(0, 0, { 
        top: { style: 'thin' }, 
        left: { style: 'thin' },
        right: { style: 'thin' },
        bottom: { style: 'thin' }
      })
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证角落单元格有两个边框
      const topLeft = model.getCellBorder(0, 0)
      expect(topLeft?.top).toBeDefined()
      expect(topLeft?.left).toBeDefined()
      
      const topRight = model.getCellBorder(0, 1)
      expect(topRight?.top).toBeDefined()
      expect(topRight?.right).toBeDefined()
      
      const bottomLeft = model.getCellBorder(1, 0)
      expect(bottomLeft?.bottom).toBeDefined()
      expect(bottomLeft?.left).toBeDefined()
      
      const bottomRight = model.getCellBorder(1, 1)
      expect(bottomRight?.bottom).toBeDefined()
      expect(bottomRight?.right).toBeDefined()
    })

    it('合并后设置边框再取消合并应正确分配', () => {
      // 设置边框后合并（边框会整合到主单元格）
      model.setCellBorder(0, 0, { top: { style: 'thin' } })
      model.setCellBorder(0, 1, { top: { style: 'medium' }, right: { style: 'thick' } })
      model.setCellBorder(1, 0, { bottom: { style: 'dashed' }, left: { style: 'dotted' } })
      model.setCellBorder(1, 1, { bottom: { style: 'double' }, right: { style: 'thin' } })
      
      // 合并（边框整合到主单元格）
      model.mergeCells(0, 0, 1, 1)
      
      // 验证合并后主单元格有所有外边框
      const merged = model.getCellBorder(0, 0)
      expect(merged?.top).toBeDefined()
      expect(merged?.right).toBeDefined()
      expect(merged?.bottom).toBeDefined()
      expect(merged?.left).toBeDefined()
      
      // 取消合并
      model.unmergeCells(0, 0)
      
      // 验证边框正确分配
      expect(model.getCellBorder(0, 0)?.top).toBeDefined()
      expect(model.getCellBorder(0, 1)?.top).toBeDefined()
      expect(model.getCellBorder(0, 1)?.right).toBeDefined()
      expect(model.getCellBorder(1, 1)?.right).toBeDefined()
      expect(model.getCellBorder(1, 0)?.bottom).toBeDefined()
      expect(model.getCellBorder(1, 1)?.bottom).toBeDefined()
      expect(model.getCellBorder(0, 0)?.left).toBeDefined()
      expect(model.getCellBorder(1, 0)?.left).toBeDefined()
    })
  })
})
