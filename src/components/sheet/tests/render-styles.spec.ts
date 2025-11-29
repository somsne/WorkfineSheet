import { describe, it, expect, beforeEach, vi } from 'vitest'
import { drawCells } from '../renderCells'
import type { CellsRenderConfig } from '../renderCells'

// Mock Canvas context
function createMockContext() {
  const measurements = new Map<string, number>()
  
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => {
      const width = measurements.get(text) || text.length * 8
      return { width }
    }),
    setLineDash: vi.fn(),
    canvas: { width: 800, height: 600 },
    fillStyle: '#000',
    strokeStyle: '#000',
    font: '13px sans-serif',
    textBaseline: 'middle',
    lineWidth: 1,
    _setMeasurement: (text: string, width: number) => {
      measurements.set(text, width)
    }
  } as any
}

describe('单元格样式渲染', () => {
  let ctx: ReturnType<typeof createMockContext>
  let baseConfig: CellsRenderConfig

  beforeEach(() => {
    ctx = createMockContext()
    baseConfig = {
      containerWidth: 800,
      containerHeight: 600,
      viewport: { scrollTop: 0, scrollLeft: 0 },
      selected: { row: -1, col: -1 },
      selectionRange: { startRow: -1, startCol: -1, endRow: -1, endCol: -1 },
      dragState: {
        isDragging: false,
        startRow: -1,
        startCol: -1,
        currentRow: -1,
        currentCol: -1
      },
      formulaReferences: [],
      sizes: {
        rowHeights: new Map(),
        colWidths: new Map()
      },
      geometryConfig: {
        defaultRowHeight: 25,
        defaultColWidth: 100,
        rowHeaderWidth: 50,
        colHeaderHeight: 30
      },
      getCellValue: () => null,
      startRow: 0,
      endRow: 10,
      startCol: 0,
      endCol: 10
    }
  })

  describe('字体样式渲染', () => {
    it('应该应用粗体样式', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Bold Text' : null),
        getCellStyle: (r, c) => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: r === 0 && c === 0,
          italic: false,
          underline: false,
          strikethrough: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 验证字体被设置为包含 bold
      const fontCalls = (ctx.font as any).toString()
      expect(fontCalls).toContain('bold')
    })

    it('应该应用斜体样式', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Italic Text' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: true,
          underline: false,
          strikethrough: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 验证字体包含 italic
      const fontCalls = (ctx.font as any).toString()
      expect(fontCalls).toContain('italic')
    })

    it('应该应用自定义字体和字号', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Custom Font' : null),
        getCellStyle: () => ({
          fontFamily: 'Microsoft YaHei',
          fontSize: 18,
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
        })
      }

      drawCells(ctx, config)

      const fontCalls = (ctx.font as any).toString()
      expect(fontCalls).toContain('18px')
      expect(fontCalls).toContain('Microsoft YaHei')
    })

    it('应该同时应用粗体和斜体', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Bold Italic' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: true,
          italic: true,
          underline: false,
          strikethrough: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      const fontCalls = (ctx.font as any).toString()
      expect(fontCalls).toContain('bold')
      expect(fontCalls).toContain('italic')
    })
  })

  describe('颜色渲染', () => {
    it('应该应用自定义文字颜色', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Red Text' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          color: '#FF0000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 验证 fillStyle 被设置为红色
      expect(ctx.fillStyle).toBe('#FF0000')
    })

    it('应该使用默认黑色当 color 为 undefined', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Text' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          color: undefined,
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 当 color 为 undefined 时，使用默认文字颜色 (浅色模式下为 #000000)
      expect(ctx.fillStyle).toBe('#000000')
    })
  })

  describe('文本装饰渲染', () => {
    it('应该绘制下划线', () => {
      ctx._setMeasurement('Underline', 60)
      
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Underline' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: 'single',
          strikethrough: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 验证调用了 stroke (用于绘制线条)
      expect(ctx.stroke).toHaveBeenCalled()
      expect(ctx.moveTo).toHaveBeenCalled()
      expect(ctx.lineTo).toHaveBeenCalled()
    })

    it('应该绘制双下划线', () => {
      ctx._setMeasurement('Double', 50)
      
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Double' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: 'double',
          strikethrough: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 双下划线应该调用两次 stroke
      expect(ctx.stroke).toHaveBeenCalledTimes(2)
    })

    it('应该绘制删除线', () => {
      ctx._setMeasurement('Strike', 50)
      
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Strike' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: true,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      expect(ctx.stroke).toHaveBeenCalled()
      expect(ctx.moveTo).toHaveBeenCalled()
      expect(ctx.lineTo).toHaveBeenCalled()
    })

    it('应该同时绘制下划线和删除线', () => {
      ctx._setMeasurement('Both', 40)
      
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Both' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: 'single',
          strikethrough: true,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 两种装饰各调用一次 stroke
      expect(ctx.stroke).toHaveBeenCalledTimes(2)
    })
  })

  describe('多行文本样式', () => {
    it('应该对多行文本应用样式', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Line1\nLine2' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: true,
          italic: false,
          underline: false,
          strikethrough: false,
          color: '#FF0000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 验证每行都被绘制（在默认行高25px内，18px行高可以显示2行）
      expect(ctx.fillText).toHaveBeenCalledTimes(2)
      // 验证字体样式被应用
      expect((ctx.font as any).toString()).toContain('bold')
      // 验证颜色被应用
      expect(ctx.fillStyle).toBe('#FF0000')
    })

    it('应该对多行文本应用下划线', () => {
      ctx._setMeasurement('Line1', 40)
      ctx._setMeasurement('Line2', 40)
      
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Line1\nLine2' : null),
        getCellStyle: () => ({
          fontFamily: 'Arial',
          fontSize: 14,
          bold: false,
          italic: false,
          underline: 'single',
          strikethrough: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          verticalAlign: 'middle',
          wrapText: false,
          textRotation: 0
        })
      }

      drawCells(ctx, config)

      // 每行都应该绘制下划线
      expect(ctx.stroke).toHaveBeenCalledTimes(2)
    })
  })

  describe('无样式回退', () => {
    it('没有 getCellStyle 时应该使用默认样式', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Default' : null),
        getCellStyle: undefined
      }

      drawCells(ctx, config)

      // 应该使用默认字体
      expect((ctx.font as any).toString()).toContain('13px')
      expect((ctx.font as any).toString()).toContain('sans-serif')
    })
  })

  describe('边界情况', () => {
    it('空单元格不应该渲染样式', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: () => null,
        getCellStyle: () => ({
          fontFamily: 'Arial',
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
        })
      }

      drawCells(ctx, config)

      // 空单元格不应该调用 fillText
      expect(ctx.fillText).not.toHaveBeenCalled()
    })

    it('应该处理 undefined 字体属性', () => {
      const config: CellsRenderConfig = {
        ...baseConfig,
        getCellValue: (r, c) => (r === 0 && c === 0 ? 'Text' : null),
        getCellStyle: () => ({
          fontFamily: undefined,
          fontSize: undefined,
          bold: undefined,
          italic: undefined,
          underline: undefined,
          strikethrough: undefined,
          color: undefined,
          backgroundColor: undefined,
          textAlign: undefined,
          verticalAlign: undefined,
          wrapText: undefined,
          textRotation: undefined
        } as any)
      }

      expect(() => {
        drawCells(ctx, config)
      }).not.toThrow()
    })
  })
})
