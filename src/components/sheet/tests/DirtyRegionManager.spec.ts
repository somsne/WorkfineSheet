/**
 * 脏区域管理器测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  DirtyRegionManager,
  createDirtyRegionManager
} from '../DirtyRegionManager'

describe('DirtyRegionManager', () => {
  let manager: DirtyRegionManager

  beforeEach(() => {
    manager = createDirtyRegionManager()
  })

  describe('基础功能', () => {
    it('初始状态应该没有脏区域', () => {
      expect(manager.hasDirtyRegions()).toBe(false)
      expect(manager.needsFullRedraw()).toBe(true) // 没有脏区域时需要全量重绘
      expect(manager.getDirtyCount()).toBe(0)
    })

    it('标记单个单元格为脏', () => {
      manager.markCellDirty(5, 10)
      
      expect(manager.hasDirtyRegions()).toBe(true)
      expect(manager.needsFullRedraw()).toBe(false)
      expect(manager.getDirtyCount()).toBe(1)
      
      const regions = manager.getDirtyCellRegions()
      expect(regions.length).toBe(1)
      expect(regions[0]).toEqual({
        startRow: 5,
        endRow: 5,
        startCol: 10,
        endCol: 10
      })
    })

    it('标记区域为脏', () => {
      manager.markCellsDirty({
        startRow: 0,
        endRow: 5,
        startCol: 0,
        endCol: 3
      })
      
      expect(manager.hasDirtyRegions()).toBe(true)
      expect(manager.getDirtyCount()).toBe(1)
    })

    it('清空脏区域', () => {
      manager.markCellDirty(0, 0)
      manager.markCellDirty(1, 1)
      expect(manager.getDirtyCount()).toBe(2)
      
      manager.clear()
      expect(manager.hasDirtyRegions()).toBe(false)
      expect(manager.getDirtyCount()).toBe(0)
    })
  })

  describe('全量重绘触发', () => {
    it('标记滚动应该触发全量重绘', () => {
      manager.markScrolled()
      
      expect(manager.needsFullRedraw()).toBe(true)
      expect(manager.isForceFullRedraw()).toBe(true)
    })

    it('标记窗口大小变化应该触发全量重绘', () => {
      manager.markResized()
      
      expect(manager.needsFullRedraw()).toBe(true)
      expect(manager.isForceFullRedraw()).toBe(true)
    })

    it('手动标记全量重绘', () => {
      manager.markCellDirty(0, 0)
      manager.markFullRedraw()
      
      expect(manager.needsFullRedraw()).toBe(true)
      expect(manager.getDirtyCount()).toBe(0) // 清空了脏区域列表
    })

    it('超大区域应该自动触发全量重绘', () => {
      // 默认阈值是 100 个单元格
      manager.markCellsDirty({
        startRow: 0,
        endRow: 10,
        startCol: 0,
        endCol: 10
      }) // 11 * 11 = 121 > 100
      
      expect(manager.needsFullRedraw()).toBe(true)
      expect(manager.isForceFullRedraw()).toBe(true)
    })

    it('过多脏区域应该自动触发全量重绘', () => {
      // 默认阈值是 10 个矩形
      for (let i = 0; i < 15; i++) {
        manager.markCellDirty(i, i)
      }
      
      expect(manager.needsFullRedraw()).toBe(true)
      expect(manager.isForceFullRedraw()).toBe(true)
    })
  })

  describe('区域合并', () => {
    it('合并多个脏区域', () => {
      manager.markCellDirty(0, 0)
      manager.markCellDirty(5, 10)
      manager.markCellDirty(3, 5)
      
      const merged = manager.getMergedDirtyCellRegion()
      
      expect(merged).toEqual({
        startRow: 0,
        endRow: 5,
        startCol: 0,
        endCol: 10
      })
    })

    it('没有脏区域时返回 null', () => {
      expect(manager.getMergedDirtyCellRegion()).toBeNull()
    })
  })

  describe('选区变化', () => {
    it('标记选区变化应该添加两个脏区域', () => {
      const oldSelection = { startRow: 0, endRow: 2, startCol: 0, endCol: 2 }
      const newSelection = { startRow: 5, endRow: 7, startCol: 5, endCol: 7 }
      
      manager.markSelectionDirty(oldSelection, newSelection)
      
      expect(manager.getDirtyCount()).toBe(2)
    })

    it('只有新选区时只添加一个脏区域', () => {
      const newSelection = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }
      
      manager.markSelectionDirty(null, newSelection)
      
      expect(manager.getDirtyCount()).toBe(1)
    })
  })

  describe('像素矩形转换', () => {
    it('应该正确将单元格区域转换为像素矩形', () => {
      const region = { startRow: 2, endRow: 4, startCol: 1, endCol: 3 }
      
      // Mock 函数
      const getRowTop = (row: number) => row * 25
      const getColLeft = (col: number) => col * 100
      const getRowHeight = () => 25
      const getColWidth = () => 100
      const viewport = { scrollTop: 0, scrollLeft: 0 }
      const headerOffsets = { rowHeaderWidth: 50, colHeaderHeight: 30 }
      
      const rect = manager.cellRegionToRect(
        region,
        getRowTop, getColLeft, getRowHeight, getColWidth,
        viewport, headerOffsets
      )
      
      // x = 50 + 1*100 - 0 = 150
      // y = 30 + 2*25 - 0 = 80
      // width = 3 * 100 = 300
      // height = 3 * 25 = 75
      expect(rect).toEqual({
        x: 150,
        y: 80,
        width: 300,
        height: 75
      })
    })

    it('应该考虑滚动偏移', () => {
      const region = { startRow: 2, endRow: 2, startCol: 1, endCol: 1 }
      
      const getRowTop = (row: number) => row * 25
      const getColLeft = (col: number) => col * 100
      const getRowHeight = () => 25
      const getColWidth = () => 100
      const viewport = { scrollTop: 100, scrollLeft: 200 }
      const headerOffsets = { rowHeaderWidth: 50, colHeaderHeight: 30 }
      
      const rect = manager.cellRegionToRect(
        region,
        getRowTop, getColLeft, getRowHeight, getColWidth,
        viewport, headerOffsets
      )
      
      // x = 50 + 100 - 200 = -50
      // y = 30 + 50 - 100 = -20
      expect(rect.x).toBe(-50)
      expect(rect.y).toBe(-20)
    })
  })

  describe('自定义配置', () => {
    it('应该支持自定义阈值', () => {
      const customManager = createDirtyRegionManager({
        maxDirtyCells: 10,
        maxDirtyRects: 3
      })
      
      // 超过 10 个单元格应该触发全量重绘
      customManager.markCellsDirty({
        startRow: 0,
        endRow: 3,
        startCol: 0,
        endCol: 3
      }) // 4 * 4 = 16 > 10
      
      expect(customManager.needsFullRedraw()).toBe(true)
    })
  })

  describe('getDirtyRects', () => {
    it('应该返回所有脏区域的像素矩形', () => {
      manager.markCellDirty(0, 0)
      manager.markCellDirty(1, 1)
      
      const getRowTop = (row: number) => row * 25
      const getColLeft = (col: number) => col * 100
      const getRowHeight = () => 25
      const getColWidth = () => 100
      const viewport = { scrollTop: 0, scrollLeft: 0 }
      const headerOffsets = { rowHeaderWidth: 50, colHeaderHeight: 30 }
      
      const rects = manager.getDirtyRects(
        getRowTop, getColLeft, getRowHeight, getColWidth,
        viewport, headerOffsets
      )
      
      expect(rects.length).toBe(2)
    })

    it('全量重绘模式下应该返回空数组', () => {
      manager.markFullRedraw()
      
      const rects = manager.getDirtyRects(
        () => 0, () => 0, () => 25, () => 100,
        { scrollTop: 0, scrollLeft: 0 },
        { rowHeaderWidth: 50, colHeaderHeight: 30 }
      )
      
      expect(rects.length).toBe(0)
    })
  })
})
