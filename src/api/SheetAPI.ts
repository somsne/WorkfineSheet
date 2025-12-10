/**
 * SheetAPI - 工作表（Sheet）API 包装
 * 
 * 提供对 SheetModel 类的完整 API 描述和类型安全的包装
 * SheetModel 是单个工作表的数据模型，负责管理单元格数据、样式、边框、格式、合并区域和图片
 */

import { SheetModel, type Cell, type ModelSnapshot, keyFor } from '../lib/SheetModel'
import type { 
  CellStyle, 
  CellBorder, 
  BorderEdge, 
  CellFormat, 
  MergedRegion, 
  MergedCellInfo, 
  FloatingImage, 
  CellImage 
} from '../components/sheet/types'

/**
 * 工作表 API 接口
 * 
 * 用于管理单个工作表的所有数据，包括：
 * - 单元格值
 * - 单元格样式
 * - 单元格边框
 * - 单元格格式
 * - 合并单元格
 * - 浮动图片
 * - 单元格内嵌图片
 */
export interface ISheetAPI {
  // ==================== 单元格值操作 ====================

  /**
   * 获取单元格完整对象
   * @param row 行号（0-based）
   * @param col 列号（0-based）
   * @returns 单元格对象，不存在返回 null
   */
  getCell(row: number, col: number): Cell | null

  /**
   * 获取单元格值
   * @param row 行号（0-based）
   * @param col 列号（0-based）
   * @returns 单元格值，不存在返回空字符串
   * @example
   * ```ts
   * const value = sheet.getValue(0, 0) // 获取 A1 单元格值
   * ```
   */
  getValue(row: number, col: number): string

  /**
   * 设置单元格值
   * @param row 行号（0-based）
   * @param col 列号（0-based）
   * @param value 值（字符串，以 = 开头表示公式）
   * @example
   * ```ts
   * sheet.setValue(0, 0, 'Hello')      // 设置文本
   * sheet.setValue(0, 1, '100')        // 设置数字
   * sheet.setValue(0, 2, '=A1+B1')     // 设置公式
   * ```
   */
  setValue(row: number, col: number, value: string): void

  /**
   * 批量设置范围内的值
   * @param startRow 起始行（0-based）
   * @param startCol 起始列（0-based）
   * @param values 值的二维数组
   * @example
   * ```ts
   * // 从 A1 开始设置 3x3 的数据
   * sheet.setValues(0, 0, [
   *   ['姓名', '年龄', '城市'],
   *   ['张三', '25', '北京'],
   *   ['李四', '30', '上海']
   * ])
   * ```
   */
  setValues(startRow: number, startCol: number, values: string[][]): void

  /**
   * 批量获取范围内的值
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @returns 值的二维数组
   * @example
   * ```ts
   * const values = sheet.getValues(0, 0, 2, 2) // 获取 A1:C3 的值
   * // [['A1', 'B1', 'C1'], ['A2', 'B2', 'C2'], ['A3', 'B3', 'C3']]
   * ```
   */
  getValues(startRow: number, startCol: number, endRow: number, endCol: number): string[][]

  /**
   * 清除范围内的所有值
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   */
  clearValues(startRow: number, startCol: number, endRow: number, endCol: number): void

  /**
   * 设置完整的单元格对象（包含元数据）
   * @param row 行号
   * @param col 列号
   * @param cell 单元格对象
   */
  setCell(row: number, col: number, cell: Cell): void

  /**
   * 遍历所有有数据的单元格
   * @param fn 回调函数
   * @example
   * ```ts
   * sheet.forEach((row, col, cell) => {
   *   console.log(`(${row}, ${col}): ${cell.value}`)
   * })
   * ```
   */
  forEach(fn: (row: number, col: number, cell: Cell) => void): void

  /**
   * 获取有数据的范围（数据边界）
   * @returns 包含数据的最小矩形范围，如果没有数据返回 null
   * @example
   * ```ts
   * const range = sheet.getDataRange()
   * if (range) {
   *   console.log(`数据范围: (${range.startRow}, ${range.startCol}) - (${range.endRow}, ${range.endCol})`)
   * }
   * ```
   */
  getDataRange(): { startRow: number; startCol: number; endRow: number; endCol: number } | null

  /**
   * 获取单元格总数（有数据的单元格）
   */
  getCellCount(): number

  /**
   * 清空整个工作表（所有数据、样式、边框、格式、合并区域）
   */
  clear(): void

  // ==================== 样式管理 ====================

  /**
   * 设置单元格样式（合并现有样式）
   * @param row 行号
   * @param col 列号
   * @param style 样式对象（部分属性）
   * @example
   * ```ts
   * sheet.setCellStyle(0, 0, {
   *   bold: true,
   *   fontSize: 14,
   *   backgroundColor: '#ffff00'
   * })
   * ```
   */
  setCellStyle(row: number, col: number, style: Partial<CellStyle>): void

  /**
   * 获取单元格样式
   * 样式优先级：单元格样式 > 行样式 > 列样式 > 默认样式
   * @param row 行号
   * @param col 列号
   * @returns 完整的单元格样式
   */
  getCellStyle(row: number, col: number): CellStyle

  /**
   * 清除单元格样式
   * @param row 行号
   * @param col 列号
   */
  clearCellStyle(row: number, col: number): void

  /**
   * 设置整行样式
   * @param row 行号
   * @param style 样式对象
   */
  setRowStyle(row: number, style: Partial<CellStyle>): void

  /**
   * 获取整行样式
   * @param row 行号
   * @returns 行样式，未设置返回 undefined
   */
  getRowStyle(row: number): CellStyle | undefined

  /**
   * 清除整行样式
   * @param row 行号
   */
  clearRowStyle(row: number): void

  /**
   * 设置整列样式
   * @param col 列号
   * @param style 样式对象
   */
  setColStyle(col: number, style: Partial<CellStyle>): void

  /**
   * 获取整列样式
   * @param col 列号
   * @returns 列样式，未设置返回 undefined
   */
  getColStyle(col: number): CellStyle | undefined

  /**
   * 清除整列样式
   * @param col 列号
   */
  clearColStyle(col: number): void

  /**
   * 批量设置范围样式
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param style 样式对象
   * @example
   * ```ts
   * // 设置 A1:C3 区域背景色
   * sheet.setRangeStyle(0, 0, 2, 2, { backgroundColor: '#e0e0e0' })
   * ```
   */
  setRangeStyle(startRow: number, startCol: number, endRow: number, endCol: number, style: Partial<CellStyle>): void

  /**
   * 检查单元格是否有自定义样式
   * @param row 行号
   * @param col 列号
   */
  hasCellStyle(row: number, col: number): boolean

  /**
   * 获取有样式的单元格数量
   */
  getStyledCellCount(): number

  // ==================== 边框管理 ====================

  /**
   * 设置单元格边框（合并现有边框）
   * @param row 行号
   * @param col 列号
   * @param border 边框对象（部分属性）
   * @example
   * ```ts
   * sheet.setCellBorder(0, 0, {
   *   bottom: { style: 'thin', color: '#000000' }
   * })
   * ```
   */
  setCellBorder(row: number, col: number, border: Partial<CellBorder>): void

  /**
   * 获取单元格边框
   * @param row 行号
   * @param col 列号
   * @returns 边框对象，未设置返回 undefined
   */
  getCellBorder(row: number, col: number): CellBorder | undefined

  /**
   * 清除单元格边框
   * @param row 行号
   * @param col 列号
   */
  clearCellBorder(row: number, col: number): void

  /**
   * 批量设置范围边框（所有单元格全边框）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param border 边框对象
   */
  setRangeBorder(startRow: number, startCol: number, endRow: number, endCol: number, border: Partial<CellBorder>): void

  /**
   * 设置范围外边框（只设置最外层四边）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param edge 边框样式
   */
  setRangeOuterBorder(startRow: number, startCol: number, endRow: number, endCol: number, edge: BorderEdge): void

  /**
   * 清除范围边框
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   */
  clearRangeBorder(startRow: number, startCol: number, endRow: number, endCol: number): void

  /**
   * 检查单元格是否有边框
   * @param row 行号
   * @param col 列号
   */
  hasCellBorder(row: number, col: number): boolean

  /**
   * 获取有边框的单元格数量
   */
  getBorderedCellCount(): number

  // ==================== 格式管理 ====================

  /**
   * 设置单元格格式
   * @param row 行号
   * @param col 列号
   * @param format 格式对象
   * @example
   * ```ts
   * // 设置数字格式
   * sheet.setCellFormat(0, 0, { type: 'number', decimals: 2 })
   * // 设置日期格式
   * sheet.setCellFormat(0, 1, { type: 'date', pattern: 'YYYY-MM-DD' })
   * ```
   */
  setCellFormat(row: number, col: number, format: CellFormat): void

  /**
   * 获取单元格格式
   * 格式优先级：单元格格式 > 行格式 > 列格式 > 默认格式
   * @param row 行号
   * @param col 列号
   * @returns 单元格格式
   */
  getCellFormat(row: number, col: number): CellFormat

  /**
   * 清除单元格格式
   * @param row 行号
   * @param col 列号
   */
  clearCellFormat(row: number, col: number): void

  /**
   * 设置整行格式
   * @param row 行号
   * @param format 格式对象
   */
  setRowFormat(row: number, format: CellFormat): void

  /**
   * 获取整行格式
   * @param row 行号
   */
  getRowFormat(row: number): CellFormat | undefined

  /**
   * 清除整行格式
   * @param row 行号
   */
  clearRowFormat(row: number): void

  /**
   * 设置整列格式
   * @param col 列号
   * @param format 格式对象
   */
  setColFormat(col: number, format: CellFormat): void

  /**
   * 获取整列格式
   * @param col 列号
   */
  getColFormat(col: number): CellFormat | undefined

  /**
   * 清除整列格式
   * @param col 列号
   */
  clearColFormat(col: number): void

  /**
   * 批量设置范围格式
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @param format 格式对象
   */
  setRangeFormat(startRow: number, startCol: number, endRow: number, endCol: number, format: CellFormat): void

  /**
   * 检查单元格是否有自定义格式
   * @param row 行号
   * @param col 列号
   */
  hasCellFormat(row: number, col: number): boolean

  /**
   * 获取有格式的单元格数量
   */
  getFormattedCellCount(): number

  /**
   * 遍历所有有格式的单元格
   * @param fn 回调函数
   */
  forEachFormat(fn: (row: number, col: number, format: CellFormat) => void): void

  // ==================== 合并单元格管理 ====================

  /**
   * 合并单元格
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   * @returns 是否合并成功（有冲突返回 false）
   * @example
   * ```ts
   * // 合并 A1:B2
   * const success = sheet.mergeCells(0, 0, 1, 1)
   * ```
   */
  mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): boolean

  /**
   * 取消合并单元格
   * @param row 合并区域内任意单元格的行号
   * @param col 合并区域内任意单元格的列号
   * @returns 被取消的合并区域，不存在返回 null
   */
  unmergeCells(row: number, col: number): MergedRegion | null

  /**
   * 检查区域是否可以合并（无冲突）
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   */
  canMerge(startRow: number, startCol: number, endRow: number, endCol: number): boolean

  /**
   * 获取单元格的合并信息
   * @param row 行号
   * @param col 列号
   * @returns 合并信息
   * @example
   * ```ts
   * const info = sheet.getMergedCellInfo(0, 0)
   * if (info.isMerged && info.isMaster) {
   *   console.log('这是合并区域的主单元格')
   * }
   * ```
   */
  getMergedCellInfo(row: number, col: number): MergedCellInfo

  /**
   * 获取包含指定单元格的合并区域
   * @param row 行号
   * @param col 列号
   * @returns 合并区域，不在任何合并区域内返回 null
   */
  getMergedRegion(row: number, col: number): MergedRegion | null

  /**
   * 获取所有合并区域
   */
  getAllMergedRegions(): MergedRegion[]

  /**
   * 检查合并操作是否会丢失数据
   * @returns 是否会丢失数据（除主单元格外还有其他单元格有值）
   */
  hasDataToLose(startRow: number, startCol: number, endRow: number, endCol: number): boolean

  /**
   * 获取合并区域数量
   */
  getMergedRegionCount(): number

  /**
   * 检查单元格是否在合并区域内
   * @param row 行号
   * @param col 列号
   */
  isMergedCell(row: number, col: number): boolean

  /**
   * 检查单元格是否是合并区域的主单元格（左上角）
   * @param row 行号
   * @param col 列号
   */
  isMasterCell(row: number, col: number): boolean

  /**
   * 遍历所有合并区域
   * @param fn 回调函数
   */
  forEachMergedRegion(fn: (region: MergedRegion) => void): void

  /**
   * 清除所有合并区域
   */
  clearAllMergedRegions(): void

  // ==================== 行列尺寸管理 ====================

  /**
   * 获取行高
   * @param row 行号（0-based）
   * @returns 行高（像素），未设置返回默认行高
   */
  getRowHeight(row: number): number

  /**
   * 设置行高
   * @param row 行号（0-based）
   * @param height 行高（像素），设置为 0 或负数表示隐藏行
   */
  setRowHeight(row: number, height: number): void

  /**
   * 批量设置行高
   * @param rows 行号数组
   * @param height 行高（像素）
   * @example
   * ```ts
   * // 将第 1-5 行设置为 30px
   * sheet.setRowsHeight([0, 1, 2, 3, 4], 30)
   * ```
   */
  setRowsHeight(rows: number[], height: number): void

  /**
   * 获取列宽
   * @param col 列号（0-based）
   * @returns 列宽（像素），未设置返回默认列宽
   */
  getColWidth(col: number): number

  /**
   * 设置列宽
   * @param col 列号（0-based）
   * @param width 列宽（像素），设置为 0 或负数表示隐藏列
   */
  setColWidth(col: number, width: number): void

  /**
   * 批量设置列宽
   * @param cols 列号数组
   * @param width 列宽（像素）
   * @example
   * ```ts
   * // 将 A-E 列设置为 120px
   * sheet.setColsWidth([0, 1, 2, 3, 4], 120)
   * ```
   */
  setColsWidth(cols: number[], width: number): void

  /**
   * 获取默认行高
   */
  getDefaultRowHeight(): number

  /**
   * 获取默认列宽
   */
  getDefaultColWidth(): number

  // ==================== 行列隐藏/显示 ====================

  /**
   * 检查行是否隐藏
   * @param row 行号
   */
  isRowHidden(row: number): boolean

  /**
   * 隐藏行
   * @param row 行号
   */
  hideRow(row: number): void

  /**
   * 批量隐藏行
   * @param rows 行号数组
   * @example
   * ```ts
   * sheet.hideRows([2, 3, 4]) // 隐藏第 3-5 行
   * ```
   */
  hideRows(rows: number[]): void

  /**
   * 隐藏行范围
   * @param startRow 起始行
   * @param endRow 结束行
   * @example
   * ```ts
   * sheet.hideRowRange(2, 10) // 隐藏第 3-11 行
   * ```
   */
  hideRowRange(startRow: number, endRow: number): void

  /**
   * 显示行
   * @param row 行号
   */
  showRow(row: number): void

  /**
   * 批量显示行
   * @param rows 行号数组
   */
  showRows(rows: number[]): void

  /**
   * 显示行范围
   * @param startRow 起始行
   * @param endRow 结束行
   */
  showRowRange(startRow: number, endRow: number): void

  /**
   * 检查列是否隐藏
   * @param col 列号
   */
  isColHidden(col: number): boolean

  /**
   * 隐藏列
   * @param col 列号
   */
  hideCol(col: number): void

  /**
   * 批量隐藏列
   * @param cols 列号数组
   * @example
   * ```ts
   * sheet.hideCols([1, 2, 3]) // 隐藏 B-D 列
   * ```
   */
  hideCols(cols: number[]): void

  /**
   * 隐藏列范围
   * @param startCol 起始列
   * @param endCol 结束列
   */
  hideColRange(startCol: number, endCol: number): void

  /**
   * 显示列
   * @param col 列号
   */
  showCol(col: number): void

  /**
   * 批量显示列
   * @param cols 列号数组
   */
  showCols(cols: number[]): void

  /**
   * 显示列范围
   * @param startCol 起始列
   * @param endCol 结束列
   */
  showColRange(startCol: number, endCol: number): void

  /**
   * 获取所有隐藏的行
   * @returns 隐藏的行号数组
   */
  getHiddenRows(): number[]

  /**
   * 获取所有隐藏的列
   * @returns 隐藏的列号数组
   */
  getHiddenCols(): number[]

  // ==================== 单元格内嵌图片管理 ====================

  /**
   * 添加单元格图片
   * @param row 行号
   * @param col 列号
   * @param imageData 图片数据（不含 id 和 timestamp）
   * @returns 图片 ID
   * @example
   * ```ts
   * const imageId = sheet.addCellImage(0, 0, {
   *   src: 'data:image/png;base64,...',
   *   width: 100,
   *   height: 100,
   *   horizontalAlign: 'center',
   *   verticalAlign: 'middle'
   * })
   * ```
   */
  addCellImage(row: number, col: number, imageData: Omit<CellImage, 'id' | 'timestamp'>): string

  /**
   * 获取单元格的所有图片（按时间戳排序，最新的在最后）
   * @param row 行号
   * @param col 列号
   */
  getCellImages(row: number, col: number): CellImage[]

  /**
   * 获取单元格显示的图片（最新的一张）
   * @param row 行号
   * @param col 列号
   */
  getCellDisplayImage(row: number, col: number): CellImage | undefined

  /**
   * 获取单元格图片数量
   * @param row 行号
   * @param col 列号
   */
  getCellImageCount(row: number, col: number): number

  /**
   * 移除单元格的某张图片
   * @param row 行号
   * @param col 列号
   * @param imageId 图片 ID
   * @returns 被移除的图片
   */
  removeCellImage(row: number, col: number, imageId: string): CellImage | undefined

  /**
   * 清除单元格的所有图片
   * @param row 行号
   * @param col 列号
   * @returns 被清除的图片数组
   */
  clearCellImages(row: number, col: number): CellImage[]

  /**
   * 更新单元格图片的对齐方式
   * @param row 行号
   * @param col 列号
   * @param imageId 图片 ID
   * @param horizontalAlign 水平对齐
   * @param verticalAlign 垂直对齐
   */
  updateCellImageAlignment(
    row: number,
    col: number,
    imageId: string,
    horizontalAlign?: 'left' | 'center' | 'right',
    verticalAlign?: 'top' | 'middle' | 'bottom'
  ): void

  /**
   * 检查单元格是否有图片
   * @param row 行号
   * @param col 列号
   */
  hasCellImage(row: number, col: number): boolean

  /**
   * 获取有图片的单元格数量
   */
  getCellsWithImageCount(): number

  /**
   * 遍历所有有图片的单元格
   * @param fn 回调函数
   */
  forEachCellImage(fn: (row: number, col: number, images: CellImage[]) => void): void

  // ==================== 浮动图片管理 ====================

  /**
   * 添加浮动图片
   * @param imageData 图片数据（不含 id 和 zIndex）
   * @returns 图片 ID
   * @example
   * ```ts
   * const imageId = sheet.addFloatingImage({
   *   src: 'data:image/png;base64,...',
   *   x: 100,
   *   y: 100,
   *   width: 200,
   *   height: 150,
   *   anchorRow: 5,
   *   anchorCol: 3
   * })
   * ```
   */
  addFloatingImage(imageData: Omit<FloatingImage, 'id' | 'zIndex'>): string

  /**
   * 获取浮动图片
   * @param id 图片 ID
   */
  getFloatingImage(id: string): FloatingImage | undefined

  /**
   * 更新浮动图片
   * @param id 图片 ID
   * @param updates 更新的属性
   */
  updateFloatingImage(id: string, updates: Partial<FloatingImage>): void

  /**
   * 删除浮动图片
   * @param id 图片 ID
   */
  deleteFloatingImage(id: string): boolean

  /**
   * 恢复浮动图片（用于撤销/重做）
   * @param image 完整的图片对象
   */
  restoreFloatingImage(image: FloatingImage): void

  /**
   * 获取所有浮动图片（按 zIndex 排序，从下到上）
   */
  getAllFloatingImages(): FloatingImage[]

  /**
   * 获取浮动图片数量
   */
  getFloatingImageCount(): number

  /**
   * 将图片移到最上层
   * @param id 图片 ID
   */
  bringImageToFront(id: string): void

  /**
   * 将图片移到最下层
   * @param id 图片 ID
   */
  sendImageToBack(id: string): void

  /**
   * 将图片上移一层
   * @param id 图片 ID
   */
  bringImageForward(id: string): void

  /**
   * 将图片下移一层
   * @param id 图片 ID
   */
  sendImageBackward(id: string): void

  // ==================== 快照管理 ====================

  /**
   * 创建模型快照（用于撤销操作）
   * @returns 模型状态快照
   */
  createSnapshot(): ModelSnapshot

  /**
   * 从快照恢复模型状态
   * @param snapshot 模型状态快照
   */
  restoreFromSnapshot(snapshot: ModelSnapshot): void
}

/**
 * 单元格样式属性说明
 */
export const CellStyleProperties = {
  // 字体
  fontFamily: '字体名称',
  fontSize: '字体大小（像素）',
  bold: '粗体',
  italic: '斜体',
  underline: '下划线（boolean | "single" | "double"）',
  strikethrough: '删除线',
  color: '字体颜色',
  
  // 背景
  backgroundColor: '背景颜色',
  
  // 对齐
  textAlign: '水平对齐（left | center | right）',
  verticalAlign: '垂直对齐（top | middle | bottom）',
  
  // 其他
  wrapText: '自动换行',
  textRotation: '文字旋转角度'
} as const

/**
 * 边框样式说明
 */
export const BorderStyles = {
  thin: '细线',
  medium: '中等',
  thick: '粗线',
  dashed: '虚线',
  dotted: '点线',
  double: '双线'
} as const

/**
 * 工作表 API 包装类
 * 
 * @example
 * ```ts
 * import { SheetAPI } from './api/SheetAPI'
 * import { SheetModel } from './lib/SheetModel'
 * 
 * const model = new SheetModel()
 * const api = new SheetAPI(model)
 * 
 * // 设置单元格值
 * api.setValue(0, 0, 'Hello World')
 * 
 * // 设置样式
 * api.setCellStyle(0, 0, { bold: true, fontSize: 16 })
 * 
 * // 合并单元格
 * api.mergeCells(0, 0, 1, 1)
 * ```
 */
export class SheetAPI implements ISheetAPI {
  private model: SheetModel

  constructor(model: SheetModel) {
    this.model = model
  }

  // ==================== 单元格值操作 ====================

  getCell(row: number, col: number): Cell | null {
    return this.model.getCell(row, col)
  }

  getValue(row: number, col: number): string {
    return this.model.getValue(row, col)
  }

  setValue(row: number, col: number, value: string): void {
    this.model.setValue(row, col, value)
  }

  setValues(startRow: number, startCol: number, values: string[][]): void {
    for (let i = 0; i < values.length; i++) {
      const row = values[i]
      if (row) {
        for (let j = 0; j < row.length; j++) {
          this.model.setValue(startRow + i, startCol + j, row[j] ?? '')
        }
      }
    }
  }

  getValues(startRow: number, startCol: number, endRow: number, endCol: number): string[][] {
    const result: string[][] = []
    for (let r = startRow; r <= endRow; r++) {
      const row: string[] = []
      for (let c = startCol; c <= endCol; c++) {
        row.push(this.model.getValue(r, c))
      }
      result.push(row)
    }
    return result
  }

  clearValues(startRow: number, startCol: number, endRow: number, endCol: number): void {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        this.model.setValue(r, c, '')
      }
    }
  }

  setCell(row: number, col: number, cell: Cell): void {
    this.model.setCell(row, col, cell)
  }

  forEach(fn: (row: number, col: number, cell: Cell) => void): void {
    this.model.forEach(fn)
  }

  getDataRange(): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
    let minRow = Infinity
    let minCol = Infinity
    let maxRow = -1
    let maxCol = -1
    let hasData = false
    
    this.model.forEach((row, col) => {
      hasData = true
      if (row < minRow) minRow = row
      if (col < minCol) minCol = col
      if (row > maxRow) maxRow = row
      if (col > maxCol) maxCol = col
    })
    
    if (!hasData) return null
    
    return {
      startRow: minRow,
      startCol: minCol,
      endRow: maxRow,
      endCol: maxCol
    }
  }

  getCellCount(): number {
    let count = 0
    this.model.forEach(() => count++)
    return count
  }

  clear(): void {
    // 清除所有单元格数据
    const cellsToDelete: Array<{ row: number; col: number }> = []
    this.model.forEach((row, col) => {
      cellsToDelete.push({ row, col })
    })
    for (const { row, col } of cellsToDelete) {
      this.model.setValue(row, col, '')
      this.model.clearCellStyle(row, col)
      this.model.clearCellBorder(row, col)
      this.model.clearCellFormat(row, col)
    }
    // 清除所有合并区域
    this.model.clearAllMergedRegions()
  }

  // ==================== 样式管理 ====================

  setCellStyle(row: number, col: number, style: Partial<CellStyle>): void {
    this.model.setCellStyle(row, col, style)
  }

  getCellStyle(row: number, col: number): CellStyle {
    return this.model.getCellStyle(row, col)
  }

  clearCellStyle(row: number, col: number): void {
    this.model.clearCellStyle(row, col)
  }

  setRowStyle(row: number, style: Partial<CellStyle>): void {
    this.model.setRowStyle(row, style)
  }

  getRowStyle(row: number): CellStyle | undefined {
    return this.model.getRowStyle(row)
  }

  clearRowStyle(row: number): void {
    this.model.clearRowStyle(row)
  }

  setColStyle(col: number, style: Partial<CellStyle>): void {
    this.model.setColStyle(col, style)
  }

  getColStyle(col: number): CellStyle | undefined {
    return this.model.getColStyle(col)
  }

  clearColStyle(col: number): void {
    this.model.clearColStyle(col)
  }

  setRangeStyle(startRow: number, startCol: number, endRow: number, endCol: number, style: Partial<CellStyle>): void {
    this.model.setRangeStyle(startRow, startCol, endRow, endCol, style)
  }

  hasCellStyle(row: number, col: number): boolean {
    return this.model.hasCellStyle(row, col)
  }

  getStyledCellCount(): number {
    return this.model.getStyledCellCount()
  }

  // ==================== 边框管理 ====================

  setCellBorder(row: number, col: number, border: Partial<CellBorder>): void {
    this.model.setCellBorder(row, col, border)
  }

  getCellBorder(row: number, col: number): CellBorder | undefined {
    return this.model.getCellBorder(row, col)
  }

  clearCellBorder(row: number, col: number): void {
    this.model.clearCellBorder(row, col)
  }

  setRangeBorder(startRow: number, startCol: number, endRow: number, endCol: number, border: Partial<CellBorder>): void {
    this.model.setRangeBorder(startRow, startCol, endRow, endCol, border)
  }

  setRangeOuterBorder(startRow: number, startCol: number, endRow: number, endCol: number, edge: BorderEdge): void {
    this.model.setRangeOuterBorder(startRow, startCol, endRow, endCol, edge)
  }

  clearRangeBorder(startRow: number, startCol: number, endRow: number, endCol: number): void {
    this.model.clearRangeBorder(startRow, startCol, endRow, endCol)
  }

  hasCellBorder(row: number, col: number): boolean {
    return this.model.hasCellBorder(row, col)
  }

  getBorderedCellCount(): number {
    return this.model.getBorderedCellCount()
  }

  // ==================== 格式管理 ====================

  setCellFormat(row: number, col: number, format: CellFormat): void {
    this.model.setCellFormat(row, col, format)
  }

  getCellFormat(row: number, col: number): CellFormat {
    return this.model.getCellFormat(row, col)
  }

  clearCellFormat(row: number, col: number): void {
    this.model.clearCellFormat(row, col)
  }

  setRowFormat(row: number, format: CellFormat): void {
    this.model.setRowFormat(row, format)
  }

  getRowFormat(row: number): CellFormat | undefined {
    return this.model.getRowFormat(row)
  }

  clearRowFormat(row: number): void {
    this.model.clearRowFormat(row)
  }

  setColFormat(col: number, format: CellFormat): void {
    this.model.setColFormat(col, format)
  }

  getColFormat(col: number): CellFormat | undefined {
    return this.model.getColFormat(col)
  }

  clearColFormat(col: number): void {
    this.model.clearColFormat(col)
  }

  setRangeFormat(startRow: number, startCol: number, endRow: number, endCol: number, format: CellFormat): void {
    this.model.setRangeFormat(startRow, startCol, endRow, endCol, format)
  }

  hasCellFormat(row: number, col: number): boolean {
    return this.model.hasCellFormat(row, col)
  }

  getFormattedCellCount(): number {
    return this.model.getFormattedCellCount()
  }

  forEachFormat(fn: (row: number, col: number, format: CellFormat) => void): void {
    this.model.forEachFormat(fn)
  }

  // ==================== 合并单元格管理 ====================

  mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    return this.model.mergeCells(startRow, startCol, endRow, endCol)
  }

  unmergeCells(row: number, col: number): MergedRegion | null {
    return this.model.unmergeCells(row, col)
  }

  canMerge(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    return this.model.canMerge(startRow, startCol, endRow, endCol)
  }

  getMergedCellInfo(row: number, col: number): MergedCellInfo {
    return this.model.getMergedCellInfo(row, col)
  }

  getMergedRegion(row: number, col: number): MergedRegion | null {
    return this.model.getMergedRegion(row, col)
  }

  getAllMergedRegions(): MergedRegion[] {
    return this.model.getAllMergedRegions()
  }

  hasDataToLose(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    return this.model.hasDataToLose(startRow, startCol, endRow, endCol)
  }

  getMergedRegionCount(): number {
    return this.model.getMergedRegionCount()
  }

  isMergedCell(row: number, col: number): boolean {
    return this.model.isMergedCell(row, col)
  }

  isMasterCell(row: number, col: number): boolean {
    return this.model.isMasterCell(row, col)
  }

  forEachMergedRegion(fn: (region: MergedRegion) => void): void {
    this.model.forEachMergedRegion(fn)
  }

  clearAllMergedRegions(): void {
    this.model.clearAllMergedRegions()
  }

  // ==================== 行高列宽管理 ====================

  getRowHeight(row: number): number {
    return this.model.getRowHeight(row)
  }

  setRowHeight(row: number, height: number): void {
    this.model.setRowHeight(row, height)
  }

  setRowsHeight(rows: number[], height: number): void {
    this.model.setRowsHeight(rows, height)
  }

  getColWidth(col: number): number {
    return this.model.getColWidth(col)
  }

  setColWidth(col: number, width: number): void {
    this.model.setColWidth(col, width)
  }

  setColsWidth(cols: number[], width: number): void {
    this.model.setColsWidth(cols, width)
  }

  getDefaultRowHeight(): number {
    return this.model.getDefaultRowHeight()
  }

  getDefaultColWidth(): number {
    return this.model.getDefaultColWidth()
  }

  // ==================== 行列隐藏/显示 ====================

  isRowHidden(row: number): boolean {
    return this.model.isRowHidden(row)
  }

  hideRow(row: number): void {
    this.model.hideRow(row)
  }

  hideRows(rows: number[]): void {
    this.model.hideRows(rows)
  }

  hideRowRange(startRow: number, endRow: number): void {
    this.model.hideRowRange(startRow, endRow)
  }

  showRow(row: number): void {
    this.model.showRow(row)
  }

  showRows(rows: number[]): void {
    this.model.showRows(rows)
  }

  showRowRange(startRow: number, endRow: number): void {
    this.model.showRowRange(startRow, endRow)
  }

  isColHidden(col: number): boolean {
    return this.model.isColHidden(col)
  }

  hideCol(col: number): void {
    this.model.hideCol(col)
  }

  hideCols(cols: number[]): void {
    this.model.hideCols(cols)
  }

  hideColRange(startCol: number, endCol: number): void {
    this.model.hideColRange(startCol, endCol)
  }

  showCol(col: number): void {
    this.model.showCol(col)
  }

  showCols(cols: number[]): void {
    this.model.showCols(cols)
  }

  showColRange(startCol: number, endCol: number): void {
    this.model.showColRange(startCol, endCol)
  }

  getHiddenRows(): number[] {
    return this.model.getHiddenRows()
  }

  getHiddenCols(): number[] {
    return this.model.getHiddenCols()
  }

  // ==================== 单元格内嵌图片管理 ====================

  addCellImage(row: number, col: number, imageData: Omit<CellImage, 'id' | 'timestamp'>): string {
    return this.model.addCellImage(row, col, imageData)
  }

  getCellImages(row: number, col: number): CellImage[] {
    return this.model.getCellImages(row, col)
  }

  getCellDisplayImage(row: number, col: number): CellImage | undefined {
    return this.model.getCellDisplayImage(row, col)
  }

  getCellImageCount(row: number, col: number): number {
    return this.model.getCellImageCount(row, col)
  }

  removeCellImage(row: number, col: number, imageId: string): CellImage | undefined {
    return this.model.removeCellImage(row, col, imageId)
  }

  clearCellImages(row: number, col: number): CellImage[] {
    return this.model.clearCellImages(row, col)
  }

  updateCellImageAlignment(
    row: number,
    col: number,
    imageId: string,
    horizontalAlign?: 'left' | 'center' | 'right',
    verticalAlign?: 'top' | 'middle' | 'bottom'
  ): void {
    this.model.updateCellImageAlignment(row, col, imageId, horizontalAlign, verticalAlign)
  }

  hasCellImage(row: number, col: number): boolean {
    return this.model.hasCellImage(row, col)
  }

  getCellsWithImageCount(): number {
    return this.model.getCellsWithImageCount()
  }

  forEachCellImage(fn: (row: number, col: number, images: CellImage[]) => void): void {
    this.model.forEachCellImage(fn)
  }

  // ==================== 浮动图片管理 ====================

  addFloatingImage(imageData: Omit<FloatingImage, 'id' | 'zIndex'>): string {
    return this.model.addFloatingImage(imageData)
  }

  getFloatingImage(id: string): FloatingImage | undefined {
    return this.model.getFloatingImage(id)
  }

  updateFloatingImage(id: string, updates: Partial<FloatingImage>): void {
    this.model.updateFloatingImage(id, updates)
  }

  deleteFloatingImage(id: string): boolean {
    return this.model.deleteFloatingImage(id)
  }

  restoreFloatingImage(image: FloatingImage): void {
    this.model.restoreFloatingImage(image)
  }

  getAllFloatingImages(): FloatingImage[] {
    return this.model.getAllFloatingImages()
  }

  getFloatingImageCount(): number {
    return this.model.getFloatingImageCount()
  }

  bringImageToFront(id: string): void {
    this.model.bringImageToFront(id)
  }

  sendImageToBack(id: string): void {
    this.model.sendImageToBack(id)
  }

  bringImageForward(id: string): void {
    this.model.bringImageForward(id)
  }

  sendImageBackward(id: string): void {
    this.model.sendImageBackward(id)
  }

  // ==================== 快照管理 ====================

  createSnapshot(): ModelSnapshot {
    return this.model.createSnapshot()
  }

  restoreFromSnapshot(snapshot: ModelSnapshot): void {
    this.model.restoreFromSnapshot(snapshot)
  }

  /**
   * 获取底层 SheetModel 实例
   */
  getModel(): SheetModel {
    return this.model
  }
}

// 重新导出类型
export type { Cell, ModelSnapshot, CellStyle, CellBorder, BorderEdge, CellFormat, MergedRegion, MergedCellInfo, FloatingImage, CellImage }
export { keyFor }
