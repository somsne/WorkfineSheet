/**
 * 填充柄（Fill Handle）模块
 * 处理填充柄的渲染、交互和填充逻辑
 */

import type { 
  SelectionRange, 
  FillHandleState, 
  FillDirection, 
  FillPattern,
  GeometryConfig, 
  SizeAccess
} from './types'
import { FILL_HANDLE_CONFIG, DEFAULT_FILL_HANDLE_STATE } from './types'
import { getRowTop, getColLeft, getRowHeight, getColWidth } from './geometry'

// ==================== 填充柄位置计算 ====================

export interface FillHandlePositionConfig {
  selectionRange: SelectionRange
  viewport: { scrollTop: number; scrollLeft: number }
  geometryConfig: GeometryConfig
  sizes: SizeAccess
  canvasWidth: number
  canvasHeight: number
}

/**
 * 计算填充柄位置
 * @returns 填充柄状态，包含位置信息
 */
export function calculateFillHandlePosition(config: FillHandlePositionConfig): FillHandleState {
  const { selectionRange, viewport, geometryConfig, sizes, canvasWidth, canvasHeight } = config
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig
  
  // 获取选区右下角单元格的位置
  const endRow = selectionRange.endRow
  const endCol = selectionRange.endCol
  
  // 计算右下角单元格的右下角坐标
  const cellRight = rowHeaderWidth + getColLeft(endCol, sizes, geometryConfig) + 
    getColWidth(endCol, sizes, geometryConfig) - viewport.scrollLeft
  const cellBottom = colHeaderHeight + getRowTop(endRow, sizes, geometryConfig) + 
    getRowHeight(endRow, sizes, geometryConfig) - viewport.scrollTop
  
  // 填充柄居中放置在右下角
  const handleSize = FILL_HANDLE_CONFIG.SIZE
  const x = cellRight - handleSize / 2
  const y = cellBottom - handleSize / 2
  
  // 检查是否在可见区域内
  const visible = x >= rowHeaderWidth - handleSize && 
                  x <= canvasWidth &&
                  y >= colHeaderHeight - handleSize && 
                  y <= canvasHeight
  
  return {
    ...DEFAULT_FILL_HANDLE_STATE,
    visible,
    rect: { x, y, width: handleSize, height: handleSize },
    sourceRange: { ...selectionRange }
  }
}

// ==================== 填充柄渲染 ====================

export interface DrawFillHandleConfig {
  ctx: CanvasRenderingContext2D
  fillHandleState: FillHandleState
  geometryConfig: GeometryConfig
}

/**
 * 绘制填充柄
 */
export function drawFillHandle(config: DrawFillHandleConfig): void {
  const { ctx, fillHandleState, geometryConfig } = config
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig
  
  if (!fillHandleState.visible) return
  
  const { rect } = fillHandleState
  
  // 如果填充柄在表头区域，不绘制
  if (rect.x + rect.width <= rowHeaderWidth || rect.y + rect.height <= colHeaderHeight) {
    return
  }
  
  ctx.save()
  
  // 设置裁剪区域，防止绘制到表头区域
  ctx.beginPath()
  ctx.rect(rowHeaderWidth, colHeaderHeight, ctx.canvas.width - rowHeaderWidth, ctx.canvas.height - colHeaderHeight)
  ctx.clip()
  
  // 绘制填充柄（实心方块）
  ctx.fillStyle = FILL_HANDLE_CONFIG.COLOR
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  
  // 绘制白色边框使其更明显
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1)
  
  ctx.restore()
}

/**
 * 绘制填充预览区域
 */
export function drawFillPreview(
  ctx: CanvasRenderingContext2D,
  fillHandleState: FillHandleState,
  viewport: { scrollTop: number; scrollLeft: number },
  geometryConfig: GeometryConfig,
  sizes: SizeAccess
): void {
  if (!fillHandleState.dragging || !fillHandleState.previewRange) return
  
  const { rowHeaderWidth, colHeaderHeight } = geometryConfig
  const { previewRange, sourceRange } = fillHandleState
  
  if (!sourceRange) return
  
  ctx.save()
  
  // 设置裁剪区域
  ctx.beginPath()
  ctx.rect(rowHeaderWidth, colHeaderHeight, ctx.canvas.width - rowHeaderWidth, ctx.canvas.height - colHeaderHeight)
  ctx.clip()
  
  // 计算预览区域位置（排除源区域）
  const previewLeft = rowHeaderWidth + getColLeft(previewRange.startCol, sizes, geometryConfig) - viewport.scrollLeft
  const previewTop = colHeaderHeight + getRowTop(previewRange.startRow, sizes, geometryConfig) - viewport.scrollTop
  
  let previewWidth = 0
  for (let c = previewRange.startCol; c <= previewRange.endCol; c++) {
    previewWidth += getColWidth(c, sizes, geometryConfig)
  }
  
  let previewHeight = 0
  for (let r = previewRange.startRow; r <= previewRange.endRow; r++) {
    previewHeight += getRowHeight(r, sizes, geometryConfig)
  }
  
  // 绘制虚线边框
  ctx.strokeStyle = FILL_HANDLE_CONFIG.PREVIEW_BORDER_COLOR
  ctx.lineWidth = 2
  ctx.setLineDash([...FILL_HANDLE_CONFIG.PREVIEW_BORDER_DASH])
  ctx.strokeRect(previewLeft, previewTop, previewWidth, previewHeight)
  
  // 绘制半透明背景
  ctx.fillStyle = 'rgba(26, 115, 232, 0.1)'
  ctx.fillRect(previewLeft, previewTop, previewWidth, previewHeight)
  
  ctx.restore()
}

// ==================== 填充柄交互检测 ====================

/**
 * 检测鼠标是否在填充柄上
 */
export function isPointOnFillHandle(
  x: number, 
  y: number, 
  fillHandleState: FillHandleState
): boolean {
  if (!fillHandleState.visible) return false
  
  const { rect } = fillHandleState
  const padding = FILL_HANDLE_CONFIG.HIT_AREA_PADDING
  
  return x >= rect.x - padding &&
         x <= rect.x + rect.width + padding &&
         y >= rect.y - padding &&
         y <= rect.y + rect.height + padding
}

/**
 * 根据拖拽位置确定填充方向
 */
export function determineFillDirection(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  _sourceRange: SelectionRange,
  _viewport: { scrollTop: number; scrollLeft: number },
  _geometryConfig: GeometryConfig,
  _sizes: SizeAccess
): FillDirection {
  const deltaX = currentX - startX
  const deltaY = currentY - startY
  
  // 判断主要拖拽方向
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    // 水平拖拽
    return deltaX > 0 ? 'right' : 'left'
  } else {
    // 垂直拖拽
    return deltaY > 0 ? 'down' : 'up'
  }
}

// ==================== 填充区域计算 ====================

export interface CalculateFillRangeConfig {
  sourceRange: SelectionRange
  currentRow: number
  currentCol: number
  direction: FillDirection
  totalRows: number
  totalCols: number
}

/**
 * 计算填充目标区域（排除源区域）
 * 返回 null 表示鼠标在源区域内部（可能是清除操作）
 */
export function calculateFillRange(config: CalculateFillRangeConfig): SelectionRange | null {
  const { sourceRange, currentRow, currentCol, direction, totalRows, totalCols } = config
  
  if (!direction) return null
  
  let targetRange: SelectionRange | null = null
  
  switch (direction) {
    case 'down':
      // 向下填充：从源区域下方开始
      if (currentRow > sourceRange.endRow) {
        targetRange = {
          startRow: sourceRange.endRow + 1,
          startCol: sourceRange.startCol,
          endRow: Math.min(currentRow, totalRows - 1),
          endCol: sourceRange.endCol
        }
      }
      break
      
    case 'up':
      // 向上填充：从源区域上方开始
      if (currentRow < sourceRange.startRow) {
        targetRange = {
          startRow: Math.max(currentRow, 0),
          startCol: sourceRange.startCol,
          endRow: sourceRange.startRow - 1,
          endCol: sourceRange.endCol
        }
      }
      break
      
    case 'right':
      // 向右填充：从源区域右边开始
      if (currentCol > sourceRange.endCol) {
        targetRange = {
          startRow: sourceRange.startRow,
          startCol: sourceRange.endCol + 1,
          endRow: sourceRange.endRow,
          endCol: Math.min(currentCol, totalCols - 1)
        }
      }
      break
      
    case 'left':
      // 向左填充：从源区域左边开始
      if (currentCol < sourceRange.startCol) {
        targetRange = {
          startRow: sourceRange.startRow,
          startCol: Math.max(currentCol, 0),
          endRow: sourceRange.endRow,
          endCol: sourceRange.startCol - 1
        }
      }
      break
  }
  
  return targetRange
}

/**
 * 计算清除区域（反向拖拽时缩小选区，清除被取消的单元格）
 * 返回需要清除的区域，如果不需要清除则返回 null
 */
export function calculateClearRange(
  sourceRange: SelectionRange,
  currentRow: number,
  currentCol: number,
  direction: FillDirection
): SelectionRange | null {
  if (!direction) return null
  
  // 只有反向拖拽且在源区域内部时才清除
  switch (direction) {
    case 'up':
      // 向上拖拽，鼠标在源区域内部（缩小选区）
      if (currentRow >= sourceRange.startRow && currentRow < sourceRange.endRow) {
        return {
          startRow: currentRow + 1,
          startCol: sourceRange.startCol,
          endRow: sourceRange.endRow,
          endCol: sourceRange.endCol
        }
      }
      break
      
    case 'down':
      // 向下拖拽，鼠标在源区域内部（缩小选区）
      if (currentRow > sourceRange.startRow && currentRow <= sourceRange.endRow) {
        return {
          startRow: sourceRange.startRow,
          startCol: sourceRange.startCol,
          endRow: currentRow - 1,
          endCol: sourceRange.endCol
        }
      }
      break
      
    case 'left':
      // 向左拖拽，鼠标在源区域内部（缩小选区）
      if (currentCol >= sourceRange.startCol && currentCol < sourceRange.endCol) {
        return {
          startRow: sourceRange.startRow,
          startCol: currentCol + 1,
          endRow: sourceRange.endRow,
          endCol: sourceRange.endCol
        }
      }
      break
      
    case 'right':
      // 向右拖拽，鼠标在源区域内部（缩小选区）
      if (currentCol > sourceRange.startCol && currentCol <= sourceRange.endCol) {
        return {
          startRow: sourceRange.startRow,
          startCol: sourceRange.startCol,
          endRow: sourceRange.endRow,
          endCol: currentCol - 1
        }
      }
      break
  }
  
  return null
}

// ==================== 序列检测 ====================

/**
 * 内置序列定义
 */
export const BUILT_IN_SEQUENCES = {
  // 中文星期
  weekdaysCN: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  // 英文星期（全称）
  weekdaysEN: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  // 英文星期（简写）
  weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  // 中文月份
  monthsCN: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  // 英文月份（全称）
  monthsEN: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  // 英文月份（简写）
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  // 季度
  quartersCN: ['第一季度', '第二季度', '第三季度', '第四季度'],
  quartersEN: ['Q1', 'Q2', 'Q3', 'Q4']
}

/**
 * 检测值是否是数字
 */
function isNumericValue(value: string): boolean {
  if (!value || value.trim() === '') return false
  return !isNaN(Number(value))
}

/**
 * 检测序列模式
 * @param values 源区域的值数组
 * @returns 检测到的填充模式
 */
export function detectFillPattern(values: string[]): FillPattern {
  if (values.length === 0) {
    return { type: 'copy' }
  }
  
  // 日期正则
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/
  
  // 单个值：检测是否属于内置序列
  if (values.length === 1) {
    const value = values[0]!
    
    // 检测日期格式
    if (datePattern.test(value)) {
      return { type: 'date' }
    }
    
    // 检测内置序列
    for (const [key, sequence] of Object.entries(BUILT_IN_SEQUENCES)) {
      const index = sequence.findIndex(s => s.toLowerCase() === value.toLowerCase())
      if (index !== -1) {
        const type = key.startsWith('weekday') ? 'weekday' : 
                     key.startsWith('month') ? 'month' : 'custom'
        return { 
          type, 
          values: sequence, 
          startIndex: index 
        }
      }
    }
    
    // 检测 "文本+数字" 模式，如 Item1, Row1
    const match = value.match(/^(.+?)(\d+)$/)
    if (match) {
      return { 
        type: 'linear', 
        step: 1,
        values: [match[1]!], // 保存前缀
        startIndex: parseInt(match[2]!, 10)
      }
    }
    
    // 默认复制模式
    return { type: 'copy' }
  }
  
  // 多个数字值：检测等差序列
  if (values.every(isNumericValue)) {
    const nums = values.map(Number)
    const diffs: number[] = []
    
    for (let i = 1; i < nums.length; i++) {
      diffs.push(nums[i]! - nums[i - 1]!)
    }
    
    // 检查是否是等差序列
    const allSameDiff = diffs.every(d => d === diffs[0])
    if (allSameDiff && diffs[0] !== 0) {
      return { type: 'linear', step: diffs[0] }
    }
  }
  
  // 检测日期序列
  if (values.every(v => datePattern.test(v))) {
    return { type: 'date' }
  }
  
  // 默认复制模式
  return { type: 'copy' }
}

// ==================== 填充值生成 ====================

export interface GenerateFillValuesConfig {
  sourceValues: string[][]  // 二维数组：[row][col]
  pattern: FillPattern
  direction: FillDirection
  targetRowCount: number
  targetColCount: number
}

/**
 * 生成填充值
 * @returns 二维数组的填充值
 */
export function generateFillValues(config: GenerateFillValuesConfig): string[][] {
  const { sourceValues, pattern, direction, targetRowCount, targetColCount } = config
  
  if (!sourceValues.length || !sourceValues[0]?.length) {
    return []
  }
  
  const sourceRowCount = sourceValues.length
  const sourceColCount = sourceValues[0].length
  
  // 判断是否是反向填充
  const isReverse = direction === 'up' || direction === 'left'
  
  const result: string[][] = []
  
  for (let tr = 0; tr < targetRowCount; tr++) {
    const row: string[] = []
    for (let tc = 0; tc < targetColCount; tc++) {
      // 计算对应的源单元格索引（循环）
      const sourceRow = tr % sourceRowCount
      const sourceCol = tc % sourceColCount
      const sourceValue = sourceValues[sourceRow]?.[sourceCol] ?? ''
      
      // 计算在填充序列中的位置
      let fillIndex: number
      if (direction === 'down' || direction === 'up') {
        fillIndex = tr + 1 // 从源区域下一行开始
        if (direction === 'up') {
          // 反向：从目标区域的最后一行开始
          fillIndex = targetRowCount - tr
        }
      } else {
        fillIndex = tc + 1
        if (direction === 'left') {
          fillIndex = targetColCount - tc
        }
      }
      
      const filledValue = generateSingleFillValue(sourceValue, pattern, fillIndex, sourceValues.flat(), isReverse)
      row.push(filledValue)
    }
    result.push(row)
  }
  
  return result
}

/**
 * 生成单个填充值
 */
function generateSingleFillValue(
  sourceValue: string, 
  pattern: FillPattern, 
  fillIndex: number,
  allSourceValues: string[],
  isReverse: boolean = false
): string {
  // 反向填充时，fillIndex 应该是负数方向
  const effectiveIndex = isReverse ? -fillIndex : fillIndex
  
  switch (pattern.type) {
    case 'copy':
      return sourceValue
      
    case 'linear': {
      // 检查是否是 "文本+数字" 模式
      if (pattern.values && pattern.values[0] && pattern.startIndex !== undefined) {
        const prefix = pattern.values[0]
        const newNum = pattern.startIndex + effectiveIndex
        return `${prefix}${Math.max(0, newNum)}` // 防止负数
      }
      
      // 纯数字等差序列
      if (isNumericValue(sourceValue) && pattern.step !== undefined) {
        // 反向时使用第一个值作为基准
        const baseValue = isReverse 
          ? Number(allSourceValues[0]) 
          : Number(allSourceValues[allSourceValues.length - 1])
        return String(baseValue + pattern.step * effectiveIndex)
      }
      return sourceValue
    }
    
    case 'weekday':
    case 'month':
    case 'custom': {
      if (pattern.values && pattern.startIndex !== undefined) {
        const sequence = pattern.values
        // 使用模运算处理循环，包括反向
        let newIndex = (pattern.startIndex + effectiveIndex) % sequence.length
        // 处理负数取模
        if (newIndex < 0) newIndex += sequence.length
        return sequence[newIndex] ?? sourceValue
      }
      return sourceValue
    }
    
    case 'date': {
      // 日期序列填充
      const date = parseDate(sourceValue)
      if (date) {
        date.setDate(date.getDate() + effectiveIndex)
        return formatDateLike(date, sourceValue)
      }
      return sourceValue
    }
      
    default:
      return sourceValue
  }
}

/**
 * 解析日期字符串
 */
function parseDate(value: string): Date | null {
  // 支持 yyyy-MM-dd 和 yyyy/MM/dd 格式
  const match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (match) {
    const year = parseInt(match[1]!, 10)
    const month = parseInt(match[2]!, 10) - 1 // Date 的月份从 0 开始
    const day = parseInt(match[3]!, 10)
    return new Date(year, month, day)
  }
  return null
}

/**
 * 格式化日期，保持原始格式
 */
function formatDateLike(date: Date, originalFormat: string): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  // 检测原始格式是否有前导零
  const hasPadding = /\d{4}[-/]\d{2}[-/]\d{2}/.test(originalFormat)
  const separator = originalFormat.includes('/') ? '/' : '-'
  
  if (hasPadding) {
    return `${year}${separator}${String(month).padStart(2, '0')}${separator}${String(day).padStart(2, '0')}`
  } else {
    return `${year}${separator}${month}${separator}${day}`
  }
}

// ==================== 公式填充 ====================

/**
 * 调整公式中的相对引用
 * @param formula 原公式
 * @param rowOffset 行偏移量
 * @param colOffset 列偏移量
 * @returns 调整后的公式
 */
export function adjustFormulaReferences(
  formula: string,
  rowOffset: number,
  colOffset: number
): string {
  if (!formula.startsWith('=')) return formula
  
  // 匹配单元格引用：$?[A-Z]+$?\d+
  // $A$1 = 绝对引用（不变）
  // $A1 = 列绝对，行相对
  // A$1 = 列相对，行绝对
  // A1 = 相对引用（都变）
  const cellRefRegex = /(\$?)([A-Z]+)(\$?)(\d+)/gi
  
  return formula.replace(cellRefRegex, (_match, colAbsolute, colLetter, rowAbsolute, rowNum) => {
    let newColLetter = colLetter
    let newRowNum = rowNum
    
    // 调整列（如果不是绝对引用）
    if (!colAbsolute) {
      const colIndex = columnLetterToIndex(colLetter)
      const newColIndex = Math.max(0, colIndex + colOffset)
      newColLetter = indexToColumnLetter(newColIndex)
    }
    
    // 调整行（如果不是绝对引用）
    if (!rowAbsolute) {
      const newRow = Math.max(1, parseInt(rowNum, 10) + rowOffset)
      newRowNum = String(newRow)
    }
    
    return `${colAbsolute}${newColLetter}${rowAbsolute}${newRowNum}`
  })
}

/**
 * 列字母转索引 (A=0, B=1, ..., Z=25, AA=26)
 */
function columnLetterToIndex(letter: string): number {
  let index = 0
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1
  }
  return index - 1
}

/**
 * 索引转列字母
 */
function indexToColumnLetter(index: number): string {
  let letter = ''
  let i = index + 1
  while (i > 0) {
    const remainder = (i - 1) % 26
    letter = String.fromCharCode('A'.charCodeAt(0) + remainder) + letter
    i = Math.floor((i - 1) / 26)
  }
  return letter
}
