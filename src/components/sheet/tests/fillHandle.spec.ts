/**
 * 填充柄功能单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  calculateFillHandlePosition,
  isPointOnFillHandle,
  determineFillDirection,
  calculateFillRange,
  calculateClearRange,
  detectFillPattern,
  generateFillValues,
  adjustFormulaReferences,
  BUILT_IN_SEQUENCES
} from '../fillHandle'
import type { SelectionRange, FillHandleState, GeometryConfig, SizeAccess } from '../types'
import { DEFAULT_FILL_HANDLE_STATE, FILL_HANDLE_CONFIG } from '../types'

// ==================== 测试工具函数 ====================

function createDefaultGeometryConfig(): GeometryConfig {
  return {
    defaultRowHeight: 26,
    defaultColWidth: 100,
    rowHeaderWidth: 40,
    colHeaderHeight: 26
  }
}

function createDefaultSizeAccess(): SizeAccess {
  return {
    rowHeights: new Map(),
    colWidths: new Map(),
    hiddenRows: new Set(),
    hiddenCols: new Set()
  }
}

function createDefaultViewport() {
  return { scrollTop: 0, scrollLeft: 0 }
}

// ==================== 位置计算测试 ====================

describe('fillHandle 位置计算', () => {
  it('应该计算正确的填充柄位置', () => {
    const selectionRange: SelectionRange = {
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0
    }
    
    const result = calculateFillHandlePosition({
      selectionRange,
      viewport: createDefaultViewport(),
      geometryConfig: createDefaultGeometryConfig(),
      sizes: createDefaultSizeAccess(),
      canvasWidth: 800,
      canvasHeight: 600
    })
    
    expect(result.visible).toBe(true)
    // 第一个单元格右下角: rowHeaderWidth + colWidth - handleSize/2, colHeaderHeight + rowHeight - handleSize/2
    // 40 + 100 - 4 = 136, 26 + 26 - 4 = 48 (SIZE = 8)
    expect(result.rect.x).toBe(136)
    expect(result.rect.y).toBe(48)
  })
  
  it('选区范围变化时应该更新位置', () => {
    const selectionRange: SelectionRange = {
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 2
    }
    
    const result = calculateFillHandlePosition({
      selectionRange,
      viewport: createDefaultViewport(),
      geometryConfig: createDefaultGeometryConfig(),
      sizes: createDefaultSizeAccess(),
      canvasWidth: 800,
      canvasHeight: 600
    })
    
    expect(result.visible).toBe(true)
    // 3列 * 100 + 40 - 4 = 336 (SIZE = 8)
    // 3行 * 26 + 26 - 4 = 100 (SIZE = 8)
    expect(result.rect.x).toBe(336)
    expect(result.rect.y).toBe(100)
  })
  
  it('滚动后应该更新位置', () => {
    const selectionRange: SelectionRange = {
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0
    }
    
    const result = calculateFillHandlePosition({
      selectionRange,
      viewport: { scrollTop: 50, scrollLeft: 100 },
      geometryConfig: createDefaultGeometryConfig(),
      sizes: createDefaultSizeAccess(),
      canvasWidth: 800,
      canvasHeight: 600
    })
    
    // 136 - 100 = 36, 48 - 50 = -2 (SIZE = 8)
    expect(result.rect.x).toBe(36)
    expect(result.rect.y).toBe(-2)
  })
})

// ==================== 点击检测测试 ====================

describe('fillHandle 点击检测', () => {
  it('应该检测到鼠标在填充柄上', () => {
    const fillHandleState: FillHandleState = {
      ...DEFAULT_FILL_HANDLE_STATE,
      visible: true,
      rect: { x: 100, y: 100, width: FILL_HANDLE_CONFIG.SIZE, height: FILL_HANDLE_CONFIG.SIZE }
    }
    
    // 正中心
    expect(isPointOnFillHandle(103, 103, fillHandleState)).toBe(true)
    
    // 边缘（含 padding）
    const padding = FILL_HANDLE_CONFIG.HIT_AREA_PADDING
    expect(isPointOnFillHandle(100 - padding, 100, fillHandleState)).toBe(true)
    expect(isPointOnFillHandle(106 + padding, 106, fillHandleState)).toBe(true)
  })
  
  it('应该检测到鼠标不在填充柄上', () => {
    const fillHandleState: FillHandleState = {
      ...DEFAULT_FILL_HANDLE_STATE,
      visible: true,
      rect: { x: 100, y: 100, width: FILL_HANDLE_CONFIG.SIZE, height: FILL_HANDLE_CONFIG.SIZE }
    }
    
    // 远离填充柄
    expect(isPointOnFillHandle(50, 50, fillHandleState)).toBe(false)
    expect(isPointOnFillHandle(200, 200, fillHandleState)).toBe(false)
  })
  
  it('填充柄不可见时应该返回 false', () => {
    const fillHandleState: FillHandleState = {
      ...DEFAULT_FILL_HANDLE_STATE,
      visible: false,
      rect: { x: 100, y: 100, width: FILL_HANDLE_CONFIG.SIZE, height: FILL_HANDLE_CONFIG.SIZE }
    }
    
    expect(isPointOnFillHandle(103, 103, fillHandleState)).toBe(false)
  })
})

// ==================== 方向检测测试 ====================

describe('fillHandle 方向检测', () => {
  const sourceRange: SelectionRange = {
    startRow: 5,
    startCol: 5,
    endRow: 5,
    endCol: 5
  }
  
  it('向下拖拽应该返回 down', () => {
    const direction = determineFillDirection(
      100, 100, 100, 200, // 向下 100px
      sourceRange,
      createDefaultViewport(),
      createDefaultGeometryConfig(),
      createDefaultSizeAccess()
    )
    expect(direction).toBe('down')
  })
  
  it('向上拖拽应该返回 up', () => {
    const direction = determineFillDirection(
      100, 200, 100, 100, // 向上 100px
      sourceRange,
      createDefaultViewport(),
      createDefaultGeometryConfig(),
      createDefaultSizeAccess()
    )
    expect(direction).toBe('up')
  })
  
  it('向右拖拽应该返回 right', () => {
    const direction = determineFillDirection(
      100, 100, 200, 100, // 向右 100px
      sourceRange,
      createDefaultViewport(),
      createDefaultGeometryConfig(),
      createDefaultSizeAccess()
    )
    expect(direction).toBe('right')
  })
  
  it('向左拖拽应该返回 left', () => {
    const direction = determineFillDirection(
      200, 100, 100, 100, // 向左 100px
      sourceRange,
      createDefaultViewport(),
      createDefaultGeometryConfig(),
      createDefaultSizeAccess()
    )
    expect(direction).toBe('left')
  })
  
  it('对角拖拽应该返回主方向', () => {
    // 垂直移动更多
    const direction1 = determineFillDirection(
      100, 100, 110, 200,
      sourceRange,
      createDefaultViewport(),
      createDefaultGeometryConfig(),
      createDefaultSizeAccess()
    )
    expect(direction1).toBe('down')
    
    // 水平移动更多
    const direction2 = determineFillDirection(
      100, 100, 200, 110,
      sourceRange,
      createDefaultViewport(),
      createDefaultGeometryConfig(),
      createDefaultSizeAccess()
    )
    expect(direction2).toBe('right')
  })
})

// ==================== 填充区域计算测试 ====================

describe('fillHandle 填充区域计算', () => {
  it('向下填充应该计算正确的目标区域', () => {
    const result = calculateFillRange({
      sourceRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      currentRow: 3,
      currentCol: 0,
      direction: 'down',
      totalRows: 100,
      totalCols: 26
    })
    
    expect(result).toEqual({
      startRow: 1,
      startCol: 0,
      endRow: 3,
      endCol: 0
    })
  })
  
  it('向上填充应该计算正确的目标区域', () => {
    const result = calculateFillRange({
      sourceRange: { startRow: 5, startCol: 0, endRow: 5, endCol: 0 },
      currentRow: 2,
      currentCol: 0,
      direction: 'up',
      totalRows: 100,
      totalCols: 26
    })
    
    expect(result).toEqual({
      startRow: 2,
      startCol: 0,
      endRow: 4,
      endCol: 0
    })
  })
  
  it('向右填充应该计算正确的目标区域', () => {
    const result = calculateFillRange({
      sourceRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
      currentRow: 0,
      currentCol: 3,
      direction: 'right',
      totalRows: 100,
      totalCols: 26
    })
    
    expect(result).toEqual({
      startRow: 0,
      startCol: 1,
      endRow: 0,
      endCol: 3
    })
  })
  
  it('向左填充应该计算正确的目标区域', () => {
    const result = calculateFillRange({
      sourceRange: { startRow: 0, startCol: 5, endRow: 0, endCol: 5 },
      currentRow: 0,
      currentCol: 2,
      direction: 'left',
      totalRows: 100,
      totalCols: 26
    })
    
    expect(result).toEqual({
      startRow: 0,
      startCol: 2,
      endRow: 0,
      endCol: 4
    })
  })
  
  it('鼠标在源区域内时应该返回 null', () => {
    const result = calculateFillRange({
      sourceRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
      currentRow: 1,
      currentCol: 1,
      direction: 'down',
      totalRows: 100,
      totalCols: 26
    })
    
    expect(result).toBeNull()
  })
})

// ==================== 序列检测测试 ====================

describe('fillHandle 序列检测', () => {
  describe('数字序列', () => {
    it('单个数字应该返回 copy', () => {
      const pattern = detectFillPattern(['5'])
      expect(pattern.type).toBe('copy')
    })
    
    it('两个递增数字应该检测为等差序列', () => {
      const pattern = detectFillPattern(['1', '2'])
      expect(pattern.type).toBe('linear')
      expect(pattern.step).toBe(1)
    })
    
    it('步长为 2 的等差序列', () => {
      const pattern = detectFillPattern(['1', '3', '5'])
      expect(pattern.type).toBe('linear')
      expect(pattern.step).toBe(2)
    })
    
    it('递减序列', () => {
      const pattern = detectFillPattern(['10', '8', '6'])
      expect(pattern.type).toBe('linear')
      expect(pattern.step).toBe(-2)
    })
    
    it('非等差数字序列应该返回 copy', () => {
      const pattern = detectFillPattern(['1', '2', '4'])
      expect(pattern.type).toBe('copy')
    })
  })
  
  describe('内置序列', () => {
    it('检测中文星期', () => {
      const pattern = detectFillPattern(['周一'])
      expect(pattern.type).toBe('weekday')
      expect(pattern.values).toEqual(BUILT_IN_SEQUENCES.weekdaysCN)
      expect(pattern.startIndex).toBe(0)
    })
    
    it('检测英文星期', () => {
      const pattern = detectFillPattern(['Wednesday'])
      expect(pattern.type).toBe('weekday')
      expect(pattern.startIndex).toBe(2)
    })
    
    it('检测中文月份', () => {
      const pattern = detectFillPattern(['3月'])
      expect(pattern.type).toBe('month')
      expect(pattern.startIndex).toBe(2)
    })
    
    it('检测英文月份', () => {
      const pattern = detectFillPattern(['January'])
      expect(pattern.type).toBe('month')
      expect(pattern.startIndex).toBe(0)
    })
    
    it('大小写不敏感', () => {
      const pattern = detectFillPattern(['MONDAY'])
      expect(pattern.type).toBe('weekday')
    })
  })
  
  describe('文本+数字序列', () => {
    it('检测 Item1 模式', () => {
      const pattern = detectFillPattern(['Item1'])
      expect(pattern.type).toBe('linear')
      expect(pattern.values?.[0]).toBe('Item')
      expect(pattern.startIndex).toBe(1)
    })
    
    it('检测 Row10 模式', () => {
      const pattern = detectFillPattern(['Row10'])
      expect(pattern.type).toBe('linear')
      expect(pattern.values?.[0]).toBe('Row')
      expect(pattern.startIndex).toBe(10)
    })
  })
  
  describe('复制模式', () => {
    it('普通文本应该返回 copy', () => {
      const pattern = detectFillPattern(['Hello'])
      expect(pattern.type).toBe('copy')
    })
    
    it('空数组应该返回 copy', () => {
      const pattern = detectFillPattern([])
      expect(pattern.type).toBe('copy')
    })
  })
})

// ==================== 填充值生成测试 ====================

describe('fillHandle 填充值生成', () => {
  it('复制模式应该复制源值', () => {
    const result = generateFillValues({
      sourceValues: [['A']],
      pattern: { type: 'copy' },
      direction: 'down',
      targetRowCount: 3,
      targetColCount: 1
    })
    
    expect(result).toEqual([['A'], ['A'], ['A']])
  })
  
  it('等差序列应该生成正确的值', () => {
    const result = generateFillValues({
      sourceValues: [['1'], ['2']],
      pattern: { type: 'linear', step: 1 },
      direction: 'down',
      targetRowCount: 3,
      targetColCount: 1
    })
    
    expect(result).toEqual([['3'], ['4'], ['5']])
  })
  
  it('星期序列应该循环', () => {
    const result = generateFillValues({
      sourceValues: [['周六']],
      pattern: { 
        type: 'weekday', 
        values: BUILT_IN_SEQUENCES.weekdaysCN,
        startIndex: 5 // 周六
      },
      direction: 'down',
      targetRowCount: 3,
      targetColCount: 1
    })
    
    expect(result).toEqual([['周日'], ['周一'], ['周二']])
  })
  
  it('文本+数字应该递增数字', () => {
    const result = generateFillValues({
      sourceValues: [['Item1']],
      pattern: { 
        type: 'linear',
        values: ['Item'],
        startIndex: 1
      },
      direction: 'down',
      targetRowCount: 3,
      targetColCount: 1
    })
    
    expect(result).toEqual([['Item2'], ['Item3'], ['Item4']])
  })
  
  it('多列填充应该正确处理', () => {
    const result = generateFillValues({
      sourceValues: [['A', 'B']],
      pattern: { type: 'copy' },
      direction: 'down',
      targetRowCount: 2,
      targetColCount: 2
    })
    
    expect(result).toEqual([['A', 'B'], ['A', 'B']])
  })
  
  describe('反向填充', () => {
    it('向上填充数字序列应该递减', () => {
      const result = generateFillValues({
        sourceValues: [['5']],
        pattern: { type: 'linear', step: 1 },
        direction: 'up',
        targetRowCount: 3,
        targetColCount: 1
      })
      
      // 反向填充: 5 -> 4, 3, 2 (从底部到顶部)
      expect(result).toEqual([['2'], ['3'], ['4']])
    })
    
    it('向左填充数字序列应该递减', () => {
      const result = generateFillValues({
        sourceValues: [['10']],
        pattern: { type: 'linear', step: 2 },
        direction: 'left',
        targetRowCount: 1,
        targetColCount: 3
      })
      
      // 反向填充: 10 -> 8, 6, 4 (从右到左)
      expect(result).toEqual([['4', '6', '8']])
    })
    
    it('向上填充星期应该反向循环', () => {
      const result = generateFillValues({
        sourceValues: [['周一']],
        pattern: { 
          type: 'weekday', 
          values: BUILT_IN_SEQUENCES.weekdaysCN,
          startIndex: 0 // 周一
        },
        direction: 'up',
        targetRowCount: 3,
        targetColCount: 1
      })
      
      // 反向: 周一 -> 周日, 周六, 周五
      expect(result).toEqual([['周五'], ['周六'], ['周日']])
    })
    
    it('向上填充文本+数字应该递减', () => {
      const result = generateFillValues({
        sourceValues: [['Item5']],
        pattern: { 
          type: 'linear',
          values: ['Item'],
          startIndex: 5
        },
        direction: 'up',
        targetRowCount: 3,
        targetColCount: 1
      })
      
      // Item5 -> Item4, Item3, Item2 (从底到顶)
      expect(result).toEqual([['Item2'], ['Item3'], ['Item4']])
    })
  })
  
  describe('日期序列', () => {
    it('单个日期应该检测为日期模式', () => {
      expect(detectFillPattern(['2024-01-01'])).toEqual({ type: 'date' })
      expect(detectFillPattern(['2024/12/31'])).toEqual({ type: 'date' })
    })
    
    it('多个日期应该检测为日期模式', () => {
      expect(detectFillPattern(['2024-01-01', '2024-01-02', '2024-01-03'])).toEqual({ type: 'date' })
    })
    
    it('向下填充日期应该递增', () => {
      const result = generateFillValues({
        sourceValues: [['2024-01-01']],
        pattern: { type: 'date' },
        direction: 'down',
        targetRowCount: 3,
        targetColCount: 1
      })
      
      expect(result).toEqual([['2024-01-02'], ['2024-01-03'], ['2024-01-04']])
    })
    
    it('向上填充日期应该递减', () => {
      const result = generateFillValues({
        sourceValues: [['2024-01-05']],
        pattern: { type: 'date' },
        direction: 'up',
        targetRowCount: 3,
        targetColCount: 1
      })
      
      expect(result).toEqual([['2024-01-02'], ['2024-01-03'], ['2024-01-04']])
    })
    
    it('应该保持原始日期格式 (斜杠)', () => {
      const result = generateFillValues({
        sourceValues: [['2024/1/1']],
        pattern: { type: 'date' },
        direction: 'down',
        targetRowCount: 2,
        targetColCount: 1
      })
      
      expect(result).toEqual([['2024/1/2'], ['2024/1/3']])
    })
    
    it('应该处理月份跨越', () => {
      const result = generateFillValues({
        sourceValues: [['2024-01-30']],
        pattern: { type: 'date' },
        direction: 'down',
        targetRowCount: 3,
        targetColCount: 1
      })
      
      expect(result).toEqual([['2024-01-31'], ['2024-02-01'], ['2024-02-02']])
    })
  })
})

// ==================== 公式调整测试 ====================

describe('fillHandle 公式引用调整', () => {
  it('相对引用应该调整', () => {
    expect(adjustFormulaReferences('=A1', 1, 0)).toBe('=A2')
    expect(adjustFormulaReferences('=A1', 0, 1)).toBe('=B1')
    expect(adjustFormulaReferences('=A1', 2, 3)).toBe('=D3')
  })
  
  it('绝对引用应该保持不变', () => {
    expect(adjustFormulaReferences('=$A$1', 1, 1)).toBe('=$A$1')
  })
  
  it('混合引用应该部分调整', () => {
    expect(adjustFormulaReferences('=$A1', 1, 1)).toBe('=$A2') // 列绝对，行相对
    expect(adjustFormulaReferences('=A$1', 1, 1)).toBe('=B$1') // 列相对，行绝对
  })
  
  it('复杂公式应该正确调整', () => {
    expect(adjustFormulaReferences('=A1+B2', 1, 0)).toBe('=A2+B3')
    expect(adjustFormulaReferences('=SUM(A1:B5)', 2, 1)).toBe('=SUM(B3:C7)')
  })
  
  it('非公式应该原样返回', () => {
    expect(adjustFormulaReferences('Hello', 1, 1)).toBe('Hello')
    expect(adjustFormulaReferences('123', 1, 1)).toBe('123')
  })
  
  it('多列字母应该正确处理', () => {
    expect(adjustFormulaReferences('=AA1', 0, 1)).toBe('=AB1')
    expect(adjustFormulaReferences('=Z1', 0, 1)).toBe('=AA1')
  })
  
  it('负偏移不应低于边界', () => {
    expect(adjustFormulaReferences('=A1', -10, -10)).toBe('=A1') // 最小是 A1
  })
})

// ==================== 清除区域计算测试 ====================

describe('fillHandle 清除区域计算', () => {
  const sourceRange: SelectionRange = {
    startRow: 2,
    startCol: 2,
    endRow: 6,
    endCol: 4
  }
  
  describe('向上缩小', () => {
    it('应该返回要清除的下方行', () => {
      // 从 row 6 向上拖到 row 4，应该清除 row 5-6
      const result = calculateClearRange(sourceRange, 4, 3, 'up')
      expect(result).toEqual({
        startRow: 5,
        startCol: 2,
        endRow: 6,
        endCol: 4
      })
    })
    
    it('鼠标在源区域外应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 1, 3, 'up')
      expect(result).toBeNull()
    })
    
    it('鼠标在最后一行应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 6, 3, 'up')
      expect(result).toBeNull()
    })
  })
  
  describe('向下缩小', () => {
    it('应该返回要清除的上方行', () => {
      // 从 row 2 向下拖到 row 4，应该清除 row 2-3
      const result = calculateClearRange(sourceRange, 4, 3, 'down')
      expect(result).toEqual({
        startRow: 2,
        startCol: 2,
        endRow: 3,
        endCol: 4
      })
    })
    
    it('鼠标在源区域外应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 8, 3, 'down')
      expect(result).toBeNull()
    })
    
    it('鼠标在第一行应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 2, 3, 'down')
      expect(result).toBeNull()
    })
  })
  
  describe('向左缩小', () => {
    it('应该返回要清除的右方列', () => {
      // 从 col 4 向左拖到 col 3，应该清除 col 4
      const result = calculateClearRange(sourceRange, 4, 3, 'left')
      expect(result).toEqual({
        startRow: 2,
        startCol: 4,
        endRow: 6,
        endCol: 4
      })
    })
    
    it('鼠标在源区域外应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 4, 1, 'left')
      expect(result).toBeNull()
    })
    
    it('鼠标在最后一列应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 4, 4, 'left')
      expect(result).toBeNull()
    })
  })
  
  describe('向右缩小', () => {
    it('应该返回要清除的左方列', () => {
      // 从 col 2 向右拖到 col 3，应该清除 col 2
      const result = calculateClearRange(sourceRange, 4, 3, 'right')
      expect(result).toEqual({
        startRow: 2,
        startCol: 2,
        endRow: 6,
        endCol: 2
      })
    })
    
    it('鼠标在源区域外应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 4, 6, 'right')
      expect(result).toBeNull()
    })
    
    it('鼠标在第一列应该返回 null', () => {
      const result = calculateClearRange(sourceRange, 4, 2, 'right')
      expect(result).toBeNull()
    })
  })
  
  it('方向为 null 应该返回 null', () => {
    const result = calculateClearRange(sourceRange, 4, 3, null)
    expect(result).toBeNull()
  })
})
