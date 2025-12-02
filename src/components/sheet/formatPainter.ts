/**
 * 格式刷模块
 * 提供格式复制和应用功能
 */

import type { CellStyle, CellBorder, CellFormat, MergedRegion } from './types'
import { DEFAULT_FONT_FAMILY } from './defaultFont'

/**
 * 单元格完整格式（样式 + 边框 + 数字格式）
 */
export interface CellFullFormat {
  style: Partial<CellStyle>
  border?: CellBorder
  format?: CellFormat
}

/**
 * 相对位置的合并区域信息
 */
export interface RelativeMergedRegion {
  /** 相对起始行（相对于源区域左上角） */
  relStartRow: number
  /** 相对起始列 */
  relStartCol: number
  /** 相对结束行 */
  relEndRow: number
  /** 相对结束列 */
  relEndCol: number
}

/**
 * 格式刷数据
 * 支持单个单元格或区域的格式
 */
export interface FormatPainterData {
  /** 源区域的格式数据，按相对位置存储 */
  formats: Map<string, CellFullFormat>
  /** 源区域的行数 */
  rows: number
  /** 源区域的列数 */
  cols: number
  /** 是否为整行选择 */
  isFullRow: boolean
  /** 是否为整列选择 */
  isFullColumn: boolean
  /** 行样式（整行选择时使用） */
  rowStyles?: Map<number, Partial<CellStyle>>
  /** 列样式（整列选择时使用） */
  colStyles?: Map<number, Partial<CellStyle>>
  /** 行格式（整行选择时使用） */
  rowFormats?: Map<number, CellFormat>
  /** 列格式（整列选择时使用） */
  colFormats?: Map<number, CellFormat>
  /** 合并区域信息（相对位置） */
  mergedRegions?: RelativeMergedRegion[]
}

/**
 * 格式刷模式
 */
export type FormatPainterMode = 'off' | 'single' | 'continuous'

/**
 * 格式刷状态
 */
export interface FormatPainterState {
  /** 当前模式 */
  mode: FormatPainterMode
  /** 复制的格式数据 */
  data: FormatPainterData | null
}

/**
 * 生成相对位置的 key
 */
function relativeKey(row: number, col: number): string {
  return `${row},${col}`
}

/**
 * 从源区域提取格式数据
 */
export function extractFormats(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  getCellStyle: (row: number, col: number) => CellStyle,
  getCellBorder: (row: number, col: number) => CellBorder | undefined,
  getCellFormat: (row: number, col: number) => CellFormat,
  options?: {
    isFullRow?: boolean
    isFullColumn?: boolean
    getRowStyle?: (row: number) => Partial<CellStyle> | undefined
    getColStyle?: (col: number) => Partial<CellStyle> | undefined
    getRowFormat?: (row: number) => CellFormat | undefined
    getColFormat?: (col: number) => CellFormat | undefined
    getMergedRegion?: (row: number, col: number) => MergedRegion | null
  }
): FormatPainterData {
  const formats = new Map<string, CellFullFormat>()
  const rows = endRow - startRow + 1
  const cols = endCol - startCol + 1
  
  // 收集合并区域（去重）
  const mergedRegions: RelativeMergedRegion[] = []
  const seenMergeKeys = new Set<string>()
  
  // 提取每个单元格的格式
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const relRow = r - startRow
      const relCol = c - startCol
      const key = relativeKey(relRow, relCol)
      
      const style = getCellStyle(r, c)
      const border = getCellBorder(r, c)
      const format = getCellFormat(r, c)
      
      // 只存储非默认的样式属性
      const stylePartial: Partial<CellStyle> = {}
      if (style.fontFamily !== DEFAULT_FONT_FAMILY) stylePartial.fontFamily = style.fontFamily
      if (style.fontSize !== 12) stylePartial.fontSize = style.fontSize
      if (style.bold) stylePartial.bold = style.bold
      if (style.italic) stylePartial.italic = style.italic
      if (style.underline) stylePartial.underline = style.underline
      if (style.strikethrough) stylePartial.strikethrough = style.strikethrough
      if (style.color !== '#000000') stylePartial.color = style.color
      if (style.backgroundColor !== '#FFFFFF') stylePartial.backgroundColor = style.backgroundColor
      if (style.textAlign !== 'left') stylePartial.textAlign = style.textAlign
      if (style.verticalAlign !== 'middle') stylePartial.verticalAlign = style.verticalAlign
      if (style.wrapText) stylePartial.wrapText = style.wrapText
      if (style.textRotation !== 0) stylePartial.textRotation = style.textRotation
      
      formats.set(key, {
        style: stylePartial,
        border: border ? { ...border } : undefined,
        format: format.type !== 'general' ? { ...format } : undefined
      })
      
      // 提取合并区域信息
      if (options?.getMergedRegion) {
        const region = options.getMergedRegion(r, c)
        if (region) {
          // 使用主单元格位置作为唯一标识
          const mergeKey = `${region.startRow},${region.startCol}`
          if (!seenMergeKeys.has(mergeKey)) {
            seenMergeKeys.add(mergeKey)
            // 只记录完全在源区域内的合并区域
            if (region.startRow >= startRow && region.endRow <= endRow &&
                region.startCol >= startCol && region.endCol <= endCol) {
              mergedRegions.push({
                relStartRow: region.startRow - startRow,
                relStartCol: region.startCol - startCol,
                relEndRow: region.endRow - startRow,
                relEndCol: region.endCol - startCol
              })
            }
          }
        }
      }
    }
  }
  
  const result: FormatPainterData = {
    formats,
    rows,
    cols,
    isFullRow: options?.isFullRow ?? false,
    isFullColumn: options?.isFullColumn ?? false,
    mergedRegions: mergedRegions.length > 0 ? mergedRegions : undefined
  }
  
  // 如果是整行选择，提取行样式
  if (options?.isFullRow && options.getRowStyle) {
    result.rowStyles = new Map()
    for (let r = startRow; r <= endRow; r++) {
      const rowStyle = options.getRowStyle(r)
      if (rowStyle) {
        result.rowStyles.set(r - startRow, rowStyle)
      }
    }
  }
  
  // 如果是整列选择，提取列样式
  if (options?.isFullColumn && options.getColStyle) {
    result.colStyles = new Map()
    for (let c = startCol; c <= endCol; c++) {
      const colStyle = options.getColStyle(c)
      if (colStyle) {
        result.colStyles.set(c - startCol, colStyle)
      }
    }
  }
  
  // 提取行格式
  if (options?.isFullRow && options.getRowFormat) {
    result.rowFormats = new Map()
    for (let r = startRow; r <= endRow; r++) {
      const rowFormat = options.getRowFormat(r)
      if (rowFormat) {
        result.rowFormats.set(r - startRow, rowFormat)
      }
    }
  }
  
  // 提取列格式
  if (options?.isFullColumn && options.getColFormat) {
    result.colFormats = new Map()
    for (let c = startCol; c <= endCol; c++) {
      const colFormat = options.getColFormat(c)
      if (colFormat) {
        result.colFormats.set(c - startCol, colFormat)
      }
    }
  }
  
  return result
}

/**
 * 应用格式到目标区域
 */
export function applyFormats(
  data: FormatPainterData,
  targetStartRow: number,
  targetStartCol: number,
  targetEndRow: number,
  targetEndCol: number,
  setCellStyle: (row: number, col: number, style: Partial<CellStyle>) => void,
  setCellBorder: (row: number, col: number, border: CellBorder) => void,
  clearCellBorder: (row: number, col: number) => void,
  setCellFormat: (row: number, col: number, format: CellFormat) => void,
  options?: {
    setRowStyle?: (row: number, style: Partial<CellStyle>) => void
    setColStyle?: (col: number, style: Partial<CellStyle>) => void
    setRowFormat?: (row: number, format: CellFormat) => void
    setColFormat?: (col: number, format: CellFormat) => void
    mergeCells?: (startRow: number, startCol: number, endRow: number, endCol: number) => boolean
    unmergeCells?: (row: number, col: number) => boolean
    getMergedRegion?: (row: number, col: number) => MergedRegion | null
  }
): void {
  // 如果源是整列且目标也是整列，使用列样式
  if (data.isFullColumn && data.colStyles && options?.setColStyle) {
    for (let tc = targetStartCol; tc <= targetEndCol; tc++) {
      const srcColIdx = (tc - targetStartCol) % data.cols
      const srcStyle = data.colStyles.get(srcColIdx)
      if (srcStyle) {
        options.setColStyle(tc, srcStyle)
      }
    }
    
    // 应用列格式
    if (data.colFormats && options?.setColFormat) {
      for (let tc = targetStartCol; tc <= targetEndCol; tc++) {
        const srcColIdx = (tc - targetStartCol) % data.cols
        const srcFormat = data.colFormats.get(srcColIdx)
        if (srcFormat) {
          options.setColFormat(tc, srcFormat)
        }
      }
    }
    return
  }
  
  // 如果源是整行且目标也是整行，使用行样式
  if (data.isFullRow && data.rowStyles && options?.setRowStyle) {
    for (let tr = targetStartRow; tr <= targetEndRow; tr++) {
      const srcRowIdx = (tr - targetStartRow) % data.rows
      const srcStyle = data.rowStyles.get(srcRowIdx)
      if (srcStyle) {
        options.setRowStyle(tr, srcStyle)
      }
    }
    
    // 应用行格式
    if (data.rowFormats && options?.setRowFormat) {
      for (let tr = targetStartRow; tr <= targetEndRow; tr++) {
        const srcRowIdx = (tr - targetStartRow) % data.rows
        const srcFormat = data.rowFormats.get(srcRowIdx)
        if (srcFormat) {
          options.setRowFormat(tr, srcFormat)
        }
      }
    }
    return
  }
  
  // 先清除目标区域的合并单元格
  if (options?.unmergeCells && options?.getMergedRegion) {
    const processedMerges = new Set<string>()
    for (let tr = targetStartRow; tr <= targetEndRow; tr++) {
      for (let tc = targetStartCol; tc <= targetEndCol; tc++) {
        const region = options.getMergedRegion(tr, tc)
        if (region) {
          const key = `${region.startRow},${region.startCol}`
          if (!processedMerges.has(key)) {
            processedMerges.add(key)
            options.unmergeCells(region.startRow, region.startCol)
          }
        }
      }
    }
  }
  
  // 普通单元格格式应用（平铺模式）
  for (let tr = targetStartRow; tr <= targetEndRow; tr++) {
    for (let tc = targetStartCol; tc <= targetEndCol; tc++) {
      // 计算源格式的相对位置（支持平铺）
      const srcRow = (tr - targetStartRow) % data.rows
      const srcCol = (tc - targetStartCol) % data.cols
      const key = relativeKey(srcRow, srcCol)
      
      const format = data.formats.get(key)
      if (format) {
        // 应用样式
        if (Object.keys(format.style).length > 0) {
          setCellStyle(tr, tc, format.style)
        }
        
        // 应用边框
        if (format.border) {
          setCellBorder(tr, tc, format.border)
        } else {
          clearCellBorder(tr, tc)
        }
        
        // 应用数字格式
        if (format.format) {
          setCellFormat(tr, tc, format.format)
        }
      }
    }
  }
  
  // 应用合并单元格（平铺模式）
  if (data.mergedRegions && data.mergedRegions.length > 0 && options?.mergeCells) {
    // 计算目标区域相对于源区域的平铺次数
    const targetRows = targetEndRow - targetStartRow + 1
    const targetCols = targetEndCol - targetStartCol + 1
    const tilesRows = Math.ceil(targetRows / data.rows)
    const tilesCols = Math.ceil(targetCols / data.cols)
    
    for (let tileRow = 0; tileRow < tilesRows; tileRow++) {
      for (let tileCol = 0; tileCol < tilesCols; tileCol++) {
        const offsetRow = tileRow * data.rows
        const offsetCol = tileCol * data.cols
        
        for (const region of data.mergedRegions) {
          const newStartRow = targetStartRow + offsetRow + region.relStartRow
          const newStartCol = targetStartCol + offsetCol + region.relStartCol
          const newEndRow = targetStartRow + offsetRow + region.relEndRow
          const newEndCol = targetStartCol + offsetCol + region.relEndCol
          
          // 确保合并区域在目标范围内
          if (newEndRow <= targetEndRow && newEndCol <= targetEndCol) {
            options.mergeCells(newStartRow, newStartCol, newEndRow, newEndCol)
          }
        }
      }
    }
  }
}

/**
 * 创建格式刷初始状态
 */
export function createFormatPainterState(): FormatPainterState {
  return {
    mode: 'off',
    data: null
  }
}
