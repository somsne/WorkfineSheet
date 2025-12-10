/**
 * WorkfineSheet API
 * 
 * 提供 Workbook、Sheet、Range 三层 API 的统一导出
 * 
 * ## 架构概述
 * 
 * ```
 * Workbook (工作簿)
 *    └── Sheet (工作表) × N
 *           └── Range (范围) - 动态创建
 *                  └── Cell (单元格)
 * ```
 * 
 * ## 使用示例
 * 
 * ```ts
 * import { Workbook, WorkbookAPI, SheetAPI, RangeAPI, rangeFromA1 } from '@/api'
 * 
 * // 创建工作簿
 * const workbook = new Workbook()
 * const api = new WorkbookAPI(workbook)
 * 
 * // 工作表操作
 * api.addSheet('数据表')
 * api.setActiveSheetByName('数据表')
 * 
 * // 获取活动工作表
 * const model = api.getActiveModel()!
 * const sheet = new SheetAPI(model)
 * 
 * // 单元格操作
 * sheet.setValue(0, 0, 'Hello')
 * sheet.setCellStyle(0, 0, { bold: true })
 * 
 * // 范围操作
 * const range = new RangeAPI(model, 0, 0, 9, 2)
 * range.setValues([['A', 'B', 'C'], ...])
 * range.setStyle({ backgroundColor: '#f0f0f0' })
 * range.setAllBorders({ style: 'thin', color: '#000' })
 * 
 * // 使用 A1 表示法
 * const headerRange = rangeFromA1(model, 'A1:C1')
 * headerRange.merge()
 * headerRange.setStyle({ bold: true, textAlign: 'center' })
 * ```
 */

// ==================== 工作簿 API ====================
export { 
  WorkbookAPI, 
  WorkbookEventTypes,
  type IWorkbookAPI,
  type SheetInfo,
  type SheetMetadata,
  type SheetViewState,
  type WorkbookEventType,
  type WorkbookEventListener,
  type WorkbookSnapshot
} from './WorkbookAPI'

// ==================== 工作表 API ====================
export {
  SheetAPI,
  CellStyleProperties,
  BorderStyles,
  type ISheetAPI,
  type Cell,
  type ModelSnapshot,
  type CellStyle,
  type CellBorder,
  type BorderEdge,
  type CellFormat,
  type MergedRegion,
  type MergedCellInfo,
  type FloatingImage,
  type CellImage,
  keyFor
} from './SheetAPI'

// ==================== 范围 API ====================
export {
  RangeAPI,
  rangeFromA1,
  type IRangeAPI,
  type RangeCoords,
  type CopyOptions
} from './RangeAPI'

// ==================== 核心类重导出 ====================
export { Workbook } from '../lib/Workbook'
export { SheetModel, DEFAULT_ROW_HEIGHT, DEFAULT_COL_WIDTH } from '../lib/SheetModel'
