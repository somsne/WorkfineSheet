/**
 * 渲染缓存管理器测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  RenderCacheManager,
  createRenderCacheManager
} from '../RenderCacheManager'

// Mock ImageData for test environment
class MockImageData {
  width: number
  height: number
  data: Uint8ClampedArray
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}

// 创建 mock 数据的辅助函数
function createMockData(width: number, height: number): any {
  return new MockImageData(width, height) as unknown as ImageData
}

describe('RenderCacheManager', () => {
  let manager: RenderCacheManager

  beforeEach(() => {
    manager = createRenderCacheManager({
      blockRows: 10,
      blockCols: 10,
      maxCachedBlocks: 50,
      useOffscreenCanvas: false // 测试环境可能不支持
    })
  })

  describe('区块坐标计算', () => {
    it('应该正确计算单元格所属区块', () => {
      expect(manager.getCellBlock(0, 0)).toEqual({ blockRow: 0, blockCol: 0 })
      expect(manager.getCellBlock(5, 5)).toEqual({ blockRow: 0, blockCol: 0 })
      expect(manager.getCellBlock(10, 10)).toEqual({ blockRow: 1, blockCol: 1 })
      expect(manager.getCellBlock(25, 35)).toEqual({ blockRow: 2, blockCol: 3 })
    })

    it('应该正确计算区块的单元格范围', () => {
      expect(manager.getBlockCellRange(0, 0)).toEqual({
        startRow: 0, endRow: 9,
        startCol: 0, endCol: 9
      })
      
      expect(manager.getBlockCellRange(2, 3)).toEqual({
        startRow: 20, endRow: 29,
        startCol: 30, endCol: 39
      })
    })

    it('应该正确获取可见区域的区块', () => {
      const blocks = manager.getVisibleBlocks(5, 25, 10, 35)
      
      // 从 block(0,1) 到 block(2,3)
      expect(blocks).toContainEqual({ blockRow: 0, blockCol: 1 })
      expect(blocks).toContainEqual({ blockRow: 0, blockCol: 2 })
      expect(blocks).toContainEqual({ blockRow: 0, blockCol: 3 })
      expect(blocks).toContainEqual({ blockRow: 1, blockCol: 1 })
      expect(blocks).toContainEqual({ blockRow: 2, blockCol: 3 })
      expect(blocks.length).toBe(9) // 3行 x 3列
    })
  })

  describe('缓存操作', () => {
    it('应该正确缓存和获取区块', () => {
      const imageData = createMockData(100, 100)
      manager.setBlock(0, 0, imageData)
      
      expect(manager.hasValidCache(0, 0)).toBe(true)
      
      const block = manager.getBlock(0, 0)
      expect(block).not.toBeNull()
      expect(block?.imageData).toBe(imageData)
    })

    it('未缓存的区块应该返回 null', () => {
      expect(manager.hasValidCache(5, 5)).toBe(false)
      expect(manager.getBlock(5, 5)).toBeNull()
    })

    it('应该正确失效单个单元格的缓存', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      expect(manager.hasValidCache(0, 0)).toBe(true)
      
      // 失效 (5,5) 单元格，它属于区块 (0,0)
      manager.invalidateCell(5, 5)
      
      expect(manager.hasValidCache(0, 0)).toBe(false)
    })

    it('应该正确失效单元格区域的缓存', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      manager.setBlock(0, 1, createMockData(100, 100))
      manager.setBlock(1, 0, createMockData(100, 100))
      manager.setBlock(1, 1, createMockData(100, 100))
      
      // 失效区域 (5,5) 到 (15,15)，涉及区块 (0,0), (0,1), (1,0), (1,1)
      manager.invalidateCellRange(5, 15, 5, 15)
      
      expect(manager.hasValidCache(0, 0)).toBe(false)
      expect(manager.hasValidCache(0, 1)).toBe(false)
      expect(manager.hasValidCache(1, 0)).toBe(false)
      expect(manager.hasValidCache(1, 1)).toBe(false)
    })

    it('应该正确失效整行的缓存', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      manager.setBlock(0, 1, createMockData(100, 100))
      manager.setBlock(0, 2, createMockData(100, 100))
      manager.setBlock(1, 0, createMockData(100, 100))
      
      // 失效第 5 行（属于区块行 0）
      manager.invalidateRow(5)
      
      expect(manager.hasValidCache(0, 0)).toBe(false)
      expect(manager.hasValidCache(0, 1)).toBe(false)
      expect(manager.hasValidCache(0, 2)).toBe(false)
      expect(manager.hasValidCache(1, 0)).toBe(true) // 不受影响
    })

    it('应该正确失效整列的缓存', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      manager.setBlock(1, 0, createMockData(100, 100))
      manager.setBlock(0, 1, createMockData(100, 100))
      
      // 失效第 5 列（属于区块列 0）
      manager.invalidateCol(5)
      
      expect(manager.hasValidCache(0, 0)).toBe(false)
      expect(manager.hasValidCache(1, 0)).toBe(false)
      expect(manager.hasValidCache(0, 1)).toBe(true) // 不受影响
    })

    it('应该正确失效指定行及之后的缓存', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      manager.setBlock(1, 0, createMockData(100, 100))
      manager.setBlock(2, 0, createMockData(100, 100))
      
      // 从第 10 行开始失效（区块行 >= 1）
      manager.invalidateRowsFrom(10)
      
      expect(manager.hasValidCache(0, 0)).toBe(true)  // 区块行 0，不受影响
      expect(manager.hasValidCache(1, 0)).toBe(false) // 区块行 1，受影响
      expect(manager.hasValidCache(2, 0)).toBe(false) // 区块行 2，受影响
    })
  })

  describe('全量失效', () => {
    it('invalidateAll 应该使所有缓存失效', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      manager.setBlock(1, 1, createMockData(100, 100))
      manager.setBlock(2, 2, createMockData(100, 100))
      
      manager.invalidateAll()
      
      expect(manager.hasValidCache(0, 0)).toBe(false)
      expect(manager.hasValidCache(1, 1)).toBe(false)
      expect(manager.hasValidCache(2, 2)).toBe(false)
      expect(manager.getStats().cachedBlocks).toBe(0)
    })

    it('版本号增加应该使旧缓存失效', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      const oldVersion = manager.getStats().version
      
      manager.invalidateAll()
      
      expect(manager.getStats().version).toBe(oldVersion + 1)
    })
  })

  describe('失效区块跟踪', () => {
    it('应该跟踪失效的区块', () => {
      manager.setBlock(0, 0, createMockData(100, 100))
      manager.setBlock(1, 1, createMockData(100, 100))
      
      manager.invalidateCell(5, 5)   // 失效 (0,0)
      manager.invalidateCell(15, 15) // 失效 (1,1)
      
      const invalidated = manager.getInvalidatedBlocks()
      expect(invalidated).toContainEqual({ blockRow: 0, blockCol: 0 })
      expect(invalidated).toContainEqual({ blockRow: 1, blockCol: 1 })
    })

    it('设置新缓存应该从失效列表中移除', () => {
      manager.invalidateCell(5, 5)
      expect(manager.getInvalidatedBlocks()).toContainEqual({ blockRow: 0, blockCol: 0 })
      
      manager.setBlock(0, 0, createMockData(100, 100))
      expect(manager.getInvalidatedBlocks()).not.toContainEqual({ blockRow: 0, blockCol: 0 })
    })

    it('clearInvalidatedBlocks 应该清空失效列表', () => {
      manager.invalidateCell(5, 5)
      manager.clearInvalidatedBlocks()
      
      expect(manager.getInvalidatedBlocks().length).toBe(0)
    })
  })

  describe('LRU 缓存淘汰', () => {
    it('超过最大缓存数时应该淘汰最旧的', () => {
      // 使用假时间来确保时间戳不同
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
      
      const smallManager = createRenderCacheManager({
        blockRows: 10,
        blockCols: 10,
        maxCachedBlocks: 5,
        useOffscreenCanvas: false
      })
      
      // 添加 5 个区块，每个间隔 100ms
      for (let i = 0; i < 5; i++) {
        smallManager.setBlock(i, 0, createMockData(10, 10))
        vi.advanceTimersByTime(100)
      }
      
      // 访问第一个区块，更新其访问时间
      vi.advanceTimersByTime(100)
      smallManager.getBlock(0, 0)
      
      // 再添加一个，应该淘汰最少访问的（应该是 block 1，因为 block 0 刚访问过）
      vi.advanceTimersByTime(100)
      smallManager.setBlock(5, 0, createMockData(10, 10))
      
      expect(smallManager.getStats().cachedBlocks).toBe(5)
      expect(smallManager.hasValidCache(5, 0)).toBe(true) // 新添加的
      expect(smallManager.hasValidCache(0, 0)).toBe(true) // 刚访问过的
      
      vi.useRealTimers()
    })
  })

  describe('缓存过期', () => {
    it('过期的缓存应该被视为无效', () => {
      const expiringManager = createRenderCacheManager({
        blockRows: 10,
        blockCols: 10,
        cacheExpireMs: 100, // 100ms 过期
        useOffscreenCanvas: false
      })
      
      expiringManager.setBlock(0, 0, createMockData(10, 10))
      expect(expiringManager.hasValidCache(0, 0)).toBe(true)
      
      // 模拟时间流逝
      vi.useFakeTimers()
      vi.advanceTimersByTime(150)
      
      expect(expiringManager.hasValidCache(0, 0)).toBe(false)
      
      vi.useRealTimers()
    })
  })

  describe('统计信息', () => {
    it('应该返回正确的统计信息', () => {
      manager.setBlock(0, 0, createMockData(10, 10))
      manager.setBlock(1, 1, createMockData(10, 10))
      manager.invalidateCell(25, 25) // 失效 (2,2)
      
      const stats = manager.getStats()
      expect(stats.cachedBlocks).toBe(2)
      expect(stats.invalidatedBlocks).toBe(1)
      expect(stats.maxBlocks).toBe(50)
    })
  })

  describe('区块画布创建', () => {
    it('应该创建正确尺寸的画布', () => {
      const getRowHeight = (row: number) => row < 5 ? 25 : 30
      const getColWidth = (col: number) => col < 5 ? 100 : 120
      
      const canvas = manager.createBlockCanvas(0, 0, getRowHeight, getColWidth)
      
      // 区块 (0,0) 包含行 0-9，列 0-9
      // 高度: 5*25 + 5*30 = 125 + 150 = 275
      // 宽度: 5*100 + 5*120 = 500 + 600 = 1100
      expect(canvas.width).toBe(1100)
      expect(canvas.height).toBe(275)
    })
  })

  describe('clear', () => {
    it('应该清空所有缓存和失效记录', () => {
      manager.setBlock(0, 0, createMockData(10, 10))
      manager.invalidateCell(25, 25)
      
      manager.clear()
      
      expect(manager.getStats().cachedBlocks).toBe(0)
      expect(manager.getStats().invalidatedBlocks).toBe(0)
    })
  })
})
