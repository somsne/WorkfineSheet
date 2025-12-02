/**
 * 格式刷模块测试
 */
import { describe, it, expect } from 'vitest'
import { 
  extractFormats, 
  applyFormats, 
  createFormatPainterState 
} from '../formatPainter'
import type { CellStyle, CellBorder, CellFormat, MergedRegion } from '../types'
import { DEFAULT_FONT_FAMILY } from '../defaultFont'

// 创建默认样式
function createDefaultStyle(): CellStyle {
  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 12,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    color: '#000000',
    backgroundColor: '#FFFFFF',
    textAlign: 'left',
    verticalAlign: 'middle',
    wrapText: false,
    textRotation: 0
  }
}

// 创建默认格式
function createDefaultFormat(): CellFormat {
  return { type: 'general' }
}

describe('格式刷模块', () => {
  describe('createFormatPainterState', () => {
    it('应该创建初始状态', () => {
      const state = createFormatPainterState()
      expect(state.mode).toBe('off')
      expect(state.data).toBeNull()
    })
  })

  describe('extractFormats', () => {
    it('应该提取单个单元格的格式', () => {
      const style: CellStyle = { ...createDefaultStyle(), bold: true, fontSize: 14 }
      const border: CellBorder = { top: { style: 'thin', color: '#000000' } }
      const format: CellFormat = { type: 'number', decimalPlaces: 2 }

      const data = extractFormats(
        0, 0, 0, 0,
        () => style,
        () => border,
        () => format
      )

      expect(data.rows).toBe(1)
      expect(data.cols).toBe(1)
      const cellFormat = data.formats.get('0,0')
      expect(cellFormat?.style.bold).toBe(true)
      expect(cellFormat?.style.fontSize).toBe(14)
      expect(cellFormat?.border).toEqual(border)
      expect(cellFormat?.format).toEqual(format)
    })

    it('应该提取多个单元格的格式', () => {
      const styles = new Map<string, CellStyle>()
      styles.set('0,0', { ...createDefaultStyle(), bold: true })
      styles.set('0,1', { ...createDefaultStyle(), italic: true })
      styles.set('1,0', { ...createDefaultStyle(), underline: true })
      styles.set('1,1', { ...createDefaultStyle(), strikethrough: true })

      const data = extractFormats(
        0, 0, 1, 1,
        (r, c) => styles.get(`${r},${c}`) || createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat()
      )

      expect(data.rows).toBe(2)
      expect(data.cols).toBe(2)
      expect(data.formats.get('0,0')?.style.bold).toBe(true)
      expect(data.formats.get('0,1')?.style.italic).toBe(true)
      expect(data.formats.get('1,0')?.style.underline).toBe(true)
      expect(data.formats.get('1,1')?.style.strikethrough).toBe(true)
    })

    it('应该只存储非默认样式属性', () => {
      const style = createDefaultStyle() // 全部默认值

      const data = extractFormats(
        0, 0, 0, 0,
        () => style,
        () => undefined,
        () => createDefaultFormat()
      )

      const cellFormat = data.formats.get('0,0')
      expect(Object.keys(cellFormat?.style || {}).length).toBe(0)
    })

    it('应该提取合并单元格信息', () => {
      const mergedRegion: MergedRegion = {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1
      }

      const data = extractFormats(
        0, 0, 1, 1,
        () => createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat(),
        {
          getMergedRegion: (r, c) => {
            if (r <= 1 && c <= 1) return mergedRegion
            return null
          }
        }
      )

      expect(data.mergedRegions).toBeDefined()
      expect(data.mergedRegions?.length).toBe(1)
      expect(data.mergedRegions?.[0]).toEqual({
        relStartRow: 0,
        relStartCol: 0,
        relEndRow: 1,
        relEndCol: 1
      })
    })

    it('应该只提取完全在源区域内的合并单元格', () => {
      // 合并区域超出源区域范围
      const mergedRegion: MergedRegion = {
        startRow: 0, startCol: 0, endRow: 2, endCol: 2
      }

      const data = extractFormats(
        0, 0, 1, 1, // 源区域是 2x2
        () => createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat(),
        {
          getMergedRegion: (r, c) => {
            if (r <= 2 && c <= 2) return mergedRegion
            return null
          }
        }
      )

      // 合并区域超出源区域，不应被提取
      expect(data.mergedRegions).toBeUndefined()
    })

    it('应该去重合并单元格区域', () => {
      const mergedRegion: MergedRegion = {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1
      }

      const data = extractFormats(
        0, 0, 1, 1,
        () => createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat(),
        {
          getMergedRegion: (r, c) => {
            // 4个单元格都返回同一个合并区域
            if (r <= 1 && c <= 1) return mergedRegion
            return null
          }
        }
      )

      // 应该只记录一次
      expect(data.mergedRegions?.length).toBe(1)
    })
  })

  describe('applyFormats', () => {
    it('应该应用样式到目标区域', () => {
      const appliedStyles = new Map<string, Partial<CellStyle>>()

      const data = extractFormats(
        0, 0, 0, 0,
        () => ({ ...createDefaultStyle(), bold: true, color: '#FF0000' }),
        () => undefined,
        () => createDefaultFormat()
      )

      applyFormats(
        data,
        2, 2, 2, 2,
        (r, c, style) => appliedStyles.set(`${r},${c}`, style),
        () => {},
        () => {},
        () => {}
      )

      expect(appliedStyles.get('2,2')?.bold).toBe(true)
      expect(appliedStyles.get('2,2')?.color).toBe('#FF0000')
    })

    it('应该平铺应用格式到更大区域', () => {
      const styles = new Map<string, CellStyle>()
      styles.set('0,0', { ...createDefaultStyle(), bold: true })
      styles.set('0,1', { ...createDefaultStyle(), italic: true })

      const data = extractFormats(
        0, 0, 0, 1, // 1x2 源区域
        (r, c) => styles.get(`${r},${c}`) || createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat()
      )

      const appliedStyles = new Map<string, Partial<CellStyle>>()

      applyFormats(
        data,
        0, 0, 0, 3, // 1x4 目标区域
        (r, c, style) => appliedStyles.set(`${r},${c}`, style),
        () => {},
        () => {},
        () => {}
      )

      // 应该平铺：0->bold, 1->italic, 2->bold, 3->italic
      expect(appliedStyles.get('0,0')?.bold).toBe(true)
      expect(appliedStyles.get('0,1')?.italic).toBe(true)
      expect(appliedStyles.get('0,2')?.bold).toBe(true)
      expect(appliedStyles.get('0,3')?.italic).toBe(true)
    })

    it('应该应用边框', () => {
      const border: CellBorder = { 
        top: { style: 'thin', color: '#000000' },
        bottom: { style: 'medium', color: '#FF0000' }
      }

      const data = extractFormats(
        0, 0, 0, 0,
        () => createDefaultStyle(),
        () => border,
        () => createDefaultFormat()
      )

      const appliedBorders = new Map<string, CellBorder>()
      const clearedBorders = new Set<string>()

      applyFormats(
        data,
        1, 1, 1, 1,
        () => {},
        (r, c, b) => appliedBorders.set(`${r},${c}`, b),
        (r, c) => clearedBorders.add(`${r},${c}`),
        () => {}
      )

      expect(appliedBorders.get('1,1')).toEqual(border)
    })

    it('应该清除无边框单元格的边框', () => {
      const data = extractFormats(
        0, 0, 0, 0,
        () => createDefaultStyle(),
        () => undefined, // 无边框
        () => createDefaultFormat()
      )

      const clearedBorders = new Set<string>()

      applyFormats(
        data,
        1, 1, 1, 1,
        () => {},
        () => {},
        (r, c) => clearedBorders.add(`${r},${c}`),
        () => {}
      )

      expect(clearedBorders.has('1,1')).toBe(true)
    })

    it('应该应用合并单元格', () => {
      const mergedRegion: MergedRegion = {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1
      }

      const data = extractFormats(
        0, 0, 1, 1,
        () => createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat(),
        {
          getMergedRegion: (r, c) => {
            if (r <= 1 && c <= 1) return mergedRegion
            return null
          }
        }
      )

      const mergedCells: Array<[number, number, number, number]> = []

      applyFormats(
        data,
        2, 2, 3, 3, // 目标区域
        () => {},
        () => {},
        () => {},
        () => {},
        {
          getMergedRegion: () => null,
          mergeCells: (r1, c1, r2, c2) => {
            mergedCells.push([r1, c1, r2, c2])
            return true
          },
          unmergeCells: () => true
        }
      )

      expect(mergedCells.length).toBe(1)
      expect(mergedCells[0]).toEqual([2, 2, 3, 3])
    })

    it('应该清除目标区域已有的合并单元格', () => {
      const data = extractFormats(
        0, 0, 0, 0,
        () => createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat()
      )

      const existingMerge: MergedRegion = {
        startRow: 2, startCol: 2, endRow: 3, endCol: 3
      }
      const unmergedCells: Array<[number, number]> = []

      applyFormats(
        data,
        2, 2, 3, 3,
        () => {},
        () => {},
        () => {},
        () => {},
        {
          getMergedRegion: (r, c) => {
            if (r >= 2 && r <= 3 && c >= 2 && c <= 3) return existingMerge
            return null
          },
          mergeCells: () => true,
          unmergeCells: (r, c) => {
            unmergedCells.push([r, c])
            return true
          }
        }
      )

      // 应该清除目标区域的合并单元格
      expect(unmergedCells.length).toBe(1)
      expect(unmergedCells[0]).toEqual([2, 2]) // 主单元格位置
    })

    it('应该平铺应用合并单元格到更大区域', () => {
      const mergedRegion: MergedRegion = {
        startRow: 0, startCol: 0, endRow: 0, endCol: 1
      }

      // 源区域：1x2，包含一个水平合并
      const data = extractFormats(
        0, 0, 0, 1,
        () => createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat(),
        {
          getMergedRegion: (r, c) => {
            if (r === 0 && c <= 1) return mergedRegion
            return null
          }
        }
      )

      const mergedCells: Array<[number, number, number, number]> = []

      // 目标区域：1x4，应该平铺 2 次合并
      applyFormats(
        data,
        0, 0, 0, 3,
        () => {},
        () => {},
        () => {},
        () => {},
        {
          getMergedRegion: () => null,
          mergeCells: (r1, c1, r2, c2) => {
            mergedCells.push([r1, c1, r2, c2])
            return true
          },
          unmergeCells: () => true
        }
      )

      expect(mergedCells.length).toBe(2)
      expect(mergedCells[0]).toEqual([0, 0, 0, 1]) // 第一个 tile
      expect(mergedCells[1]).toEqual([0, 2, 0, 3]) // 第二个 tile
    })

    it('不应用超出目标范围的合并单元格', () => {
      // 源区域 2x2，包含一个跨越整个区域的合并
      const mergedRegion: MergedRegion = {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1
      }

      const data = extractFormats(
        0, 0, 1, 1,
        () => createDefaultStyle(),
        () => undefined,
        () => createDefaultFormat(),
        {
          getMergedRegion: (r, c) => {
            if (r <= 1 && c <= 1) return mergedRegion
            return null
          }
        }
      )

      const mergedCells: Array<[number, number, number, number]> = []

      // 目标区域只有 1x3，不能完整容纳 2x2 的合并
      applyFormats(
        data,
        0, 0, 0, 2,
        () => {},
        () => {},
        () => {},
        () => {},
        {
          getMergedRegion: () => null,
          mergeCells: (r1, c1, r2, c2) => {
            mergedCells.push([r1, c1, r2, c2])
            return true
          },
          unmergeCells: () => true
        }
      )

      // 合并区域超出目标范围，不应应用
      expect(mergedCells.length).toBe(0)
    })
  })
})
