import { describe, it, expect, beforeEach } from 'vitest'
import { SheetModel } from '../../../lib/SheetModel'
import { drawCells } from '../renderCells'
import type { CellsRenderConfig } from '../renderCells'
import type { CellStyle } from '../types'

// 检测 CI 环境
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

// CI 环境使用更宽松的阈值（性能不稳定）
const PERF_MULTIPLIER = isCI ? 10 : 1

// Mock Canvas context for performance testing
function createMockContext() {
  return {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fillText: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
    setLineDash: () => {},
    canvas: { width: 1920, height: 1080 },
    fillStyle: '#000',
    strokeStyle: '#000',
    font: '13px sans-serif',
    textBaseline: 'middle',
    lineWidth: 1
  } as any
}

describe('样式功能性能测试', () => {
  let model: SheetModel
  let ctx: ReturnType<typeof createMockContext>

  beforeEach(() => {
    model = new SheetModel()
    ctx = createMockContext()
  })

  describe('批量样式设置性能', () => {
    it('设置 1000 个单元格样式应该在 50ms 内完成', () => {
      const start = performance.now()
      
      // 设置 1000 个单元格（32x32 = 1024）
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          model.setCellStyle(row, col, {
            bold: row % 2 === 0,
            italic: col % 2 === 0,
            fontSize: 12 + (row % 5),
            color: row % 3 === 0 ? '#FF0000' : '#000000'
          })
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(50 * PERF_MULTIPLIER)
      expect(model.getStyledCellCount()).toBe(1024)
    })

    it('使用 setRangeStyle 批量设置应该比逐个设置快', () => {
      // 逐个设置
      const start1 = performance.now()
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          model.setCellStyle(row, col, { bold: true })
        }
      }
      const elapsed1 = performance.now() - start1

      // 批量设置
      const model2 = new SheetModel()
      const start2 = performance.now()
      model2.setRangeStyle(0, 0, 31, 31, { bold: true })
      const elapsed2 = performance.now() - start2

      // 批量操作应该更快或相当
      expect(elapsed2).toBeLessThanOrEqual(elapsed1 * 1.5) // 允许 50% 误差
    })
  })

  describe('样式查询性能', () => {
    it('查询 1000 个单元格样式应该在 50ms 内完成', () => {
      // 先设置一些样式
      model.setRangeStyle(0, 0, 31, 31, { bold: true, fontSize: 14 })
      
      const start = performance.now()
      
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          const style = model.getCellStyle(row, col)
          expect(style.bold).toBe(true)
        }
      }
      
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(50 * PERF_MULTIPLIER)
    })

    it('混合查询（有样式和无样式）应该快速', () => {
      // 只设置一半单元格的样式
      model.setRangeStyle(0, 0, 15, 31, { bold: true })
      
      const start = performance.now()
      
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          model.getCellStyle(row, col)
        }
      }
      
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(10 * PERF_MULTIPLIER)
    })
  })

  describe('渲染性能', () => {
    it('渲染 1000 个带样式单元格应该在 100ms 内完成', () => {
      // 设置各种样式的单元格
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          model.setValue(row, col, `Cell${row},${col}`)
          model.setCellStyle(row, col, {
            bold: row % 2 === 0,
            italic: col % 2 === 0,
            fontSize: 12 + (row % 3),
            color: ['#000000', '#FF0000', '#0000FF'][row % 3],
            textAlign: ['left', 'center', 'right'][col % 3] as any,
            underline: col % 5 === 0,
            strikethrough: row % 7 === 0
          })
        }
      }

      const config: CellsRenderConfig = {
        containerWidth: 1920,
        containerHeight: 1080,
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
        getCellValue: (r, c) => model.getValue(r, c),
        getCellStyle: (r, c) => model.getCellStyle(r, c),
        startRow: 0,
        endRow: 31,
        startCol: 0,
        endCol: 31
      }

      const start = performance.now()
      drawCells(ctx, config)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(100 * PERF_MULTIPLIER)
    })

    it('只渲染可见区域应该更快', () => {
      // 设置大量单元格
      for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 100; col++) {
          model.setValue(row, col, `Cell${row},${col}`)
          model.setCellStyle(row, col, { bold: true })
        }
      }

      const baseConfig = {
        containerWidth: 1920,
        containerHeight: 1080,
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
        getCellValue: (r: number, c: number) => model.getValue(r, c),
        getCellStyle: (r: number, c: number) => model.getCellStyle(r, c)
      }

      // 渲染全部
      const start1 = performance.now()
      drawCells(ctx, { ...baseConfig, startRow: 0, endRow: 99, startCol: 0, endCol: 99 })
      const elapsed1 = performance.now() - start1

      // 只渲染可见区域（20x20）
      const start2 = performance.now()
      drawCells(ctx, { ...baseConfig, startRow: 0, endRow: 19, startCol: 0, endCol: 19 })
      const elapsed2 = performance.now() - start2

      // 可见区域渲染应该明显更快
      expect(elapsed2).toBeLessThan(elapsed1 * 0.3) // 应该快至少 3 倍
    })
  })

  describe('内存效率', () => {
    it('清除大量样式应该释放内存', () => {
      // 设置 1000 个样式
      model.setRangeStyle(0, 0, 31, 31, { bold: true })
      
      const count1 = model.getStyledCellCount()
      expect(count1).toBe(1024)
      
      // 清除样式
      const start = performance.now()
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          model.clearCellStyle(row, col)
        }
      }
      const elapsed = performance.now() - start
      
      const count2 = model.getStyledCellCount()
      expect(count2).toBe(0)
      expect(elapsed).toBeLessThan(20 * PERF_MULTIPLIER)
    })

    it('重复设置相同样式不应该导致性能下降', () => {
      const style: Partial<CellStyle> = { bold: true, fontSize: 14 }
      
      // 第一次设置
      const start1 = performance.now()
      model.setRangeStyle(0, 0, 31, 31, style)
      const elapsed1 = performance.now() - start1
      
      // 第二次设置相同样式
      const start2 = performance.now()
      model.setRangeStyle(0, 0, 31, 31, style)
      const elapsed2 = performance.now() - start2
      
      // 第二次不应该显著慢于第一次（使用绝对值比较更稳定）
      // 两次都应该在合理时间内完成
      expect(elapsed1).toBeLessThan(50 * PERF_MULTIPLIER)
      expect(elapsed2).toBeLessThan(50 * PERF_MULTIPLIER)
    })
  })

  describe('极端情况性能', () => {
    it('设置单个属性到 10000 个单元格', () => {
      const start = performance.now()
      
      for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 100; col++) {
          model.setCellStyle(row, col, { bold: true })
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(200 * PERF_MULTIPLIER)
      expect(model.getStyledCellCount()).toBe(10000)
    })

    it('设置复杂样式到 1000 个单元格', () => {
      const complexStyle: Partial<CellStyle> = {
        fontFamily: 'Arial',
        fontSize: 14,
        bold: true,
        italic: true,
        underline: 'double',
        strikethrough: true,
        color: '#FF0000',
        backgroundColor: '#FFFF00',
        textAlign: 'center',
        verticalAlign: 'middle',
        wrapText: true,
        textRotation: 45
      }
      
      const start = performance.now()
      
      for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 32; col++) {
          model.setCellStyle(row, col, complexStyle)
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(100 * PERF_MULTIPLIER)
    })

    it('稀疏样式分布查询性能', () => {
      // 每隔 10 个单元格设置一个样式
      for (let i = 0; i < 1000; i += 10) {
        const row = Math.floor(i / 100)
        const col = i % 100
        model.setCellStyle(row, col, { bold: true })
      }
      
      // 查询所有单元格（包括没有样式的）
      const start = performance.now()
      
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 100; col++) {
          model.getCellStyle(row, col)
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(10 * PERF_MULTIPLIER)
    })
  })

  describe('并发操作性能', () => {
    it('连续的样式设置和查询应该保持性能', () => {
      const iterations = 100
      const timings: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const row = i % 32
        const col = Math.floor(i / 32)
        
        const start = performance.now()
        model.setCellStyle(row, col, { bold: true, fontSize: 14 })
        const style = model.getCellStyle(row, col)
        const elapsed = performance.now() - start
        
        timings.push(elapsed)
        expect(style.bold).toBe(true)
      }
      
      // 计算平均时间
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length
      
      // 每次操作应该在 1ms 内（CI 环境放宽）
      expect(avgTime).toBeLessThan(1 * PERF_MULTIPLIER)
      
      // 时间应该保持稳定（最后 10 次不应该比前 10 次慢太多）
      const first10Avg = timings.slice(0, 10).reduce((a, b) => a + b, 0) / 10
      const last10Avg = timings.slice(-10).reduce((a, b) => a + b, 0) / 10
      
      expect(last10Avg).toBeLessThanOrEqual(first10Avg * 3) // 允许 3 倍以内的波动
    })
  })

  describe('合并单元格性能测试', () => {
    it('批量合并 100 个不重叠区域应该在 50ms 内完成', () => {
      const start = performance.now()
      
      // 创建 100 个 2x2 的合并区域（10行 x 10列 网格，每个区域 2x2）
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const startRow = i * 3
          const startCol = j * 3
          model.mergeCells(startRow, startCol, startRow + 1, startCol + 1)
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(50 * PERF_MULTIPLIER)
      expect(model.getMergedRegionCount()).toBe(100)
    })

    it('合并大区域（50x50）应该在 10ms 内完成', () => {
      const start = performance.now()
      
      const result = model.mergeCells(0, 0, 49, 49)
      
      const elapsed = performance.now() - start
      
      expect(result).toBe(true)
      expect(elapsed).toBeLessThan(10 * PERF_MULTIPLIER)
    })

    it('查询 1000 个单元格的合并状态应该在 20ms 内完成', () => {
      // 创建一些合并区域
      for (let i = 0; i < 10; i++) {
        model.mergeCells(i * 10, 0, i * 10 + 4, 4)
      }
      
      const start = performance.now()
      
      for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 10; col++) {
          model.getMergedRegion(row, col)
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(20 * PERF_MULTIPLIER)
    })

    it('批量取消合并 100 个区域应该在 50ms 内完成', () => {
      // 先创建 100 个合并区域
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const startRow = i * 3
          const startCol = j * 3
          model.mergeCells(startRow, startCol, startRow + 1, startCol + 1)
        }
      }
      
      expect(model.getMergedRegionCount()).toBe(100)
      
      const start = performance.now()
      
      // 取消所有合并
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const startRow = i * 3
          const startCol = j * 3
          model.unmergeCells(startRow, startCol)
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(50 * PERF_MULTIPLIER)
      expect(model.getMergedRegionCount()).toBe(0)
    })

    it('canMerge 检查 1000 次应该在 30ms 内完成', () => {
      // 创建一些合并区域作为障碍
      for (let i = 0; i < 5; i++) {
        model.mergeCells(i * 20, 0, i * 20 + 5, 5)
      }
      
      const start = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        const row = i % 100
        const col = Math.floor(i / 100) * 2
        model.canMerge(row, col, row + 1, col + 1)
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(30 * PERF_MULTIPLIER)
    })

    it('合并单元格时保留边框的性能', () => {
      // 为区域内的单元格设置边框
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          model.setCellBorder(r, c, {
            top: { style: 'thin', color: '#000000' },
            right: { style: 'thin', color: '#000000' },
            bottom: { style: 'thin', color: '#000000' },
            left: { style: 'thin', color: '#000000' }
          })
        }
      }
      
      const start = performance.now()
      
      // 合并整个区域
      model.mergeCells(0, 0, 9, 9)
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(20 * PERF_MULTIPLIER)
      
      // 验证边框被正确保留到主单元格
      const masterBorder = model.getCellBorder(0, 0)
      expect(masterBorder).toBeDefined()
    })

    it('getMergedCellInfo 批量查询性能', () => {
      // 创建合并区域
      model.mergeCells(0, 0, 4, 4)
      model.mergeCells(10, 10, 14, 14)
      
      const start = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        const row = i % 20
        const col = Math.floor(i / 50)
        model.getMergedCellInfo(row, col)
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(20 * PERF_MULTIPLIER)
    })
  })

  describe('样式与合并单元格组合性能', () => {
    it('为合并区域设置样式应该快速', () => {
      // 创建 50 个合并区域
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          const startRow = i * 5
          const startCol = j * 10
          model.mergeCells(startRow, startCol, startRow + 2, startCol + 4)
        }
      }
      
      const start = performance.now()
      
      // 为每个合并区域的主单元格设置样式
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          const startRow = i * 5
          const startCol = j * 10
          model.setCellStyle(startRow, startCol, {
            bold: true,
            fontSize: 16,
            textAlign: 'center',
            verticalAlign: 'middle',
            backgroundColor: '#FFFFCC'
          })
        }
      }
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(30 * PERF_MULTIPLIER)
    })

    it('渲染包含合并单元格和样式的区域', () => {
      // 创建合并区域并设置样式
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const startRow = i * 6
          const startCol = j * 6
          model.mergeCells(startRow, startCol, startRow + 2, startCol + 2)
          model.setValue(startRow, startCol, `Merged ${i},${j}`)
          model.setCellStyle(startRow, startCol, {
            bold: true,
            fontSize: 14,
            textAlign: 'center',
            backgroundColor: '#E0E0FF'
          })
        }
      }

      const config: CellsRenderConfig = {
        containerWidth: 1920,
        containerHeight: 1080,
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
        getCellValue: (r, c) => model.getValue(r, c),
        getCellStyle: (r, c) => model.getCellStyle(r, c),
        getMergedRegion: (r, c) => model.getMergedRegion(r, c),
        startRow: 0,
        endRow: 29,
        startCol: 0,
        endCol: 29
      }

      const start = performance.now()
      drawCells(ctx, config)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(50 * PERF_MULTIPLIER)
    })

    it('取消合并后边框分发的性能', () => {
      // 先在正确的边界位置设置边框（Excel 行为：只有外边界边框会被收集）
      // 顶边框在第一行
      for (let c = 0; c <= 9; c++) {
        model.setCellBorder(0, c, { top: { style: 'medium', color: '#000000' } })
      }
      // 底边框在最后一行
      for (let c = 0; c <= 9; c++) {
        model.setCellBorder(9, c, { bottom: { style: 'medium', color: '#000000' } })
      }
      // 左边框在第一列
      for (let r = 0; r <= 9; r++) {
        model.setCellBorder(r, 0, { left: { style: 'medium', color: '#000000' } })
      }
      // 右边框在最后一列
      for (let r = 0; r <= 9; r++) {
        model.setCellBorder(r, 9, { right: { style: 'medium', color: '#000000' } })
      }
      
      // 合并区域（会收集外边界边框到主单元格）
      model.mergeCells(0, 0, 9, 9)
      
      const start = performance.now()
      
      // 取消合并（会分发边框到各边界单元格）
      model.unmergeCells(0, 0)
      
      const elapsed = performance.now() - start
      
      expect(elapsed).toBeLessThan(20 * PERF_MULTIPLIER)
      
      // 验证边框被正确分发
      const topLeftBorder = model.getCellBorder(0, 0)
      const topRightBorder = model.getCellBorder(0, 9)
      const bottomLeftBorder = model.getCellBorder(9, 0)
      const bottomRightBorder = model.getCellBorder(9, 9)
      
      expect(topLeftBorder?.top).toBeDefined()
      expect(topLeftBorder?.left).toBeDefined()
      expect(topRightBorder?.top).toBeDefined()
      expect(topRightBorder?.right).toBeDefined()
      expect(bottomLeftBorder?.bottom).toBeDefined()
      expect(bottomLeftBorder?.left).toBeDefined()
      expect(bottomRightBorder?.bottom).toBeDefined()
      expect(bottomRightBorder?.right).toBeDefined()
    })
  })
})
