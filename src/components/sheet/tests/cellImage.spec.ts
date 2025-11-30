/**
 * 单元格内嵌图片功能测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SheetModel } from '../../../lib/SheetModel'
import { calculateImageSize, calculateImagePosition, hitTestCellImage } from '../renderCellImage'
import type { CellImage } from '../types'

describe('单元格内嵌图片', () => {
  let model: SheetModel

  beforeEach(() => {
    model = new SheetModel()
  })

  describe('SheetModel 图片方法', () => {
    it('应该能添加单元格图片', () => {
      const imageData = {
        src: 'data:image/png;base64,test',
        naturalWidth: 100,
        naturalHeight: 100,
        horizontalAlign: 'center' as const,
        verticalAlign: 'middle' as const
      }

      const imageId = model.addCellImage(0, 0, imageData)

      expect(imageId).toBeDefined()
      expect(typeof imageId).toBe('string')

      const images = model.getCellImages(0, 0)
      expect(images.length).toBe(1)
      expect(images[0]!.src).toBe(imageData.src)
      expect(images[0]!.naturalWidth).toBe(100)
      expect(images[0]!.naturalHeight).toBe(100)
    })

    it('应该能添加多张图片到同一单元格', () => {
      const image1 = {
        src: 'data:image/png;base64,test1',
        naturalWidth: 100,
        naturalHeight: 100,
        horizontalAlign: 'center' as const,
        verticalAlign: 'middle' as const
      }
      const image2 = {
        src: 'data:image/png;base64,test2',
        naturalWidth: 200,
        naturalHeight: 150,
        horizontalAlign: 'left' as const,
        verticalAlign: 'top' as const
      }

      model.addCellImage(0, 0, image1)
      model.addCellImage(0, 0, image2)

      const images = model.getCellImages(0, 0)
      expect(images.length).toBe(2)
      expect(model.getCellImageCount(0, 0)).toBe(2)
    })

    it('getCellDisplayImage 应该返回最新的图片', () => {
      const image1 = {
        src: 'data:image/png;base64,old',
        naturalWidth: 100,
        naturalHeight: 100,
        horizontalAlign: 'center' as const,
        verticalAlign: 'middle' as const
      }
      const image2 = {
        src: 'data:image/png;base64,new',
        naturalWidth: 200,
        naturalHeight: 150,
        horizontalAlign: 'left' as const,
        verticalAlign: 'top' as const
      }

      model.addCellImage(0, 0, image1)
      model.addCellImage(0, 0, image2)

      const displayImage = model.getCellDisplayImage(0, 0)
      expect(displayImage).not.toBeNull()
      expect(displayImage?.src).toBe('data:image/png;base64,new')
    })

    it('应该能删除指定的图片', () => {
      const image1 = {
        src: 'data:image/png;base64,test1',
        naturalWidth: 100,
        naturalHeight: 100,
        horizontalAlign: 'center' as const,
        verticalAlign: 'middle' as const
      }
      const image2 = {
        src: 'data:image/png;base64,test2',
        naturalWidth: 200,
        naturalHeight: 150,
        horizontalAlign: 'left' as const,
        verticalAlign: 'top' as const
      }

      const id1 = model.addCellImage(0, 0, image1)
      model.addCellImage(0, 0, image2)

      expect(model.getCellImageCount(0, 0)).toBe(2)

      const removed = model.removeCellImage(0, 0, id1)
      expect(removed).not.toBeNull()
      expect(removed?.src).toBe('data:image/png;base64,test1')
      expect(model.getCellImageCount(0, 0)).toBe(1)
    })

    it('应该能清除单元格所有图片', () => {
      model.addCellImage(0, 0, {
        src: 'data:image/png;base64,test1',
        naturalWidth: 100,
        naturalHeight: 100,
        horizontalAlign: 'center' as const,
        verticalAlign: 'middle' as const
      })
      model.addCellImage(0, 0, {
        src: 'data:image/png;base64,test2',
        naturalWidth: 200,
        naturalHeight: 150,
        horizontalAlign: 'left' as const,
        verticalAlign: 'top' as const
      })

      expect(model.getCellImageCount(0, 0)).toBe(2)

      const removed = model.clearCellImages(0, 0)
      expect(removed.length).toBe(2)
      expect(model.getCellImageCount(0, 0)).toBe(0)
    })

    it('应该能更新图片对齐方式', () => {
      const imageId = model.addCellImage(0, 0, {
        src: 'data:image/png;base64,test',
        naturalWidth: 100,
        naturalHeight: 100,
        horizontalAlign: 'center' as const,
        verticalAlign: 'middle' as const
      })

      model.updateCellImageAlignment(0, 0, imageId, 'left', 'top')

      const images = model.getCellImages(0, 0)
      expect(images[0]!.horizontalAlign).toBe('left')
      expect(images[0]!.verticalAlign).toBe('top')
    })

    it('空单元格应该返回空数组和 undefined', () => {
      expect(model.getCellImages(0, 0)).toEqual([])
      expect(model.getCellImageCount(0, 0)).toBe(0)
      expect(model.getCellDisplayImage(0, 0)).toBeUndefined()
    })
  })

  describe('图片尺寸计算', () => {
    it('小于容器的图片应该保持原尺寸', () => {
      const result = calculateImageSize(50, 50, 100, 100)
      expect(result.width).toBe(50)
      expect(result.height).toBe(50)
    })

    it('宽度超出时应该按宽度缩放', () => {
      const result = calculateImageSize(200, 100, 100, 100)
      expect(result.width).toBe(100)
      expect(result.height).toBe(50)
    })

    it('高度超出时应该按高度缩放', () => {
      const result = calculateImageSize(100, 200, 100, 100)
      expect(result.width).toBe(50)
      expect(result.height).toBe(100)
    })

    it('宽高都超出时应该按比例缩放到适合容器', () => {
      const result = calculateImageSize(400, 200, 100, 100)
      expect(result.width).toBe(100)
      expect(result.height).toBe(50)
    })

    it('正方形图片应该正确缩放', () => {
      const result = calculateImageSize(200, 200, 100, 50)
      expect(result.width).toBe(50)
      expect(result.height).toBe(50)
    })

    it('零尺寸应该返回零', () => {
      const result = calculateImageSize(0, 0, 100, 100)
      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
    })
  })

  describe('图片位置计算', () => {
    const cellX = 100
    const cellY = 50
    const cellWidth = 200
    const cellHeight = 100
    const imageWidth = 80
    const imageHeight = 60

    it('左上对齐', () => {
      const pos = calculateImagePosition(
        cellX, cellY, cellWidth, cellHeight,
        imageWidth, imageHeight,
        'left', 'top'
      )
      expect(pos.x).toBe(cellX + 2) // padding = 2
      expect(pos.y).toBe(cellY + 2)
    })

    it('居中对齐', () => {
      const pos = calculateImagePosition(
        cellX, cellY, cellWidth, cellHeight,
        imageWidth, imageHeight,
        'center', 'middle'
      )
      expect(pos.x).toBe(cellX + (cellWidth - imageWidth) / 2)
      expect(pos.y).toBe(cellY + (cellHeight - imageHeight) / 2)
    })

    it('右下对齐', () => {
      const pos = calculateImagePosition(
        cellX, cellY, cellWidth, cellHeight,
        imageWidth, imageHeight,
        'right', 'bottom'
      )
      expect(pos.x).toBe(cellX + cellWidth - imageWidth - 2) // padding = 2
      expect(pos.y).toBe(cellY + cellHeight - imageHeight - 2)
    })
  })

  describe('图片点击检测', () => {
    const mockImage: CellImage = {
      id: 'test-id',
      src: 'test.png',
      naturalWidth: 100,
      naturalHeight: 100,
      horizontalAlign: 'center',
      verticalAlign: 'middle',
      timestamp: Date.now()
    }

    it('点击图片区域内应该返回 true', () => {
      // 单元格 200x100，图片 80x80（缩放后），居中
      // 图片位置: x = 100 + (200-80)/2 = 160, y = 50 + (100-80)/2 = 60
      const result = hitTestCellImage(
        165, 65, // 点击位置（在图片区域内）
        mockImage,
        100, 50, // 单元格位置
        200, 100 // 单元格尺寸
      )
      expect(result).toBe(true)
    })

    it('点击图片区域外应该返回 false', () => {
      const result = hitTestCellImage(
        105, 55, // 点击位置（在单元格内但不在图片上）
        mockImage,
        100, 50,
        200, 100
      )
      expect(result).toBe(false)
    })
  })
})
