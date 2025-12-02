/**
 * 行列操作模块
 * 负责行列的插入、删除和尺寸设置
 */

import type { CellStyle, CellBorder, CellFormat, MergedRegion } from './types'

/**
 * 公式表接口（适配器模式）
 */
export interface FormulaSheetAdapter {
  adjustAllFormulasAsync(operation: string, index: number, count: number): Promise<void>
  getModel(): {
    forEach(callback: (row: number, col: number, cell: any) => void): void
    getCell(row: number, col: number): any
    setValue(row: number, col: number, value: string): void
    // 样式相关
    getCellStyle(row: number, col: number): CellStyle
    setCellStyle(row: number, col: number, style: Partial<CellStyle>): void
    hasCellStyle(row: number, col: number): boolean
    clearCellStyle(row: number, col: number): void
    // 边框相关
    getCellBorder(row: number, col: number): CellBorder | undefined
    setCellBorder(row: number, col: number, border: Partial<CellBorder>): void
    hasCellBorder(row: number, col: number): boolean
    clearCellBorder(row: number, col: number): void
    // 格式相关
    getCellFormat(row: number, col: number): CellFormat
    setCellFormat(row: number, col: number, format: CellFormat): void
    hasCellFormat(row: number, col: number): boolean
    clearCellFormat(row: number, col: number): void
    // 合并单元格相关
    getAllMergedRegions(): MergedRegion[]
    unmergeCells(row: number, col: number): MergedRegion | null
    mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): boolean
    // 单元格内嵌图片相关
    adjustCellImagesForRowInsert(row: number, count?: number): void
    adjustCellImagesForRowDelete(row: number, count?: number): void
    adjustCellImagesForColInsert(col: number, count?: number): void
    adjustCellImagesForColDelete(col: number, count?: number): void
    // 浮动图片相关
    adjustImagesForRowInsert(row: number, count?: number): void
    adjustImagesForRowDelete(row: number, count?: number): void
    adjustImagesForColInsert(col: number, count?: number): void
    adjustImagesForColDelete(col: number, count?: number): void
  }
}

/**
 * 尺寸配置（行高/列宽）
 */
export interface SizeConfig {
  rowHeights: Map<number, number>
  colWidths: Map<number, number>
  defaultRowHeight: number
  defaultColWidth: number
  totalRows: number
  totalCols: number
}

/**
 * 当前选中单元格
 */
export interface SelectedCell {
  row: number
  col: number
}

/**
 * 行列操作配置
 */
export interface RowColConfig {
  formulaSheet: FormulaSheetAdapter
  sizeConfig: SizeConfig
  selected: SelectedCell
  onRedraw: () => void
  /** 是否跳过重绘（用于批量操作时延迟重绘） */
  skipRedraw?: boolean
}

/**
 * 在指定行上方插入行
 */
export async function insertRowAbove(row: number, config: RowColConfig): Promise<void> {
  const { formulaSheet, sizeConfig, onRedraw } = config
  
  // 步骤1: 先异步调整所有公式（会自动移动公式单元格并更新引用）
  await formulaSheet.adjustAllFormulasAsync('insertRow', row, 1)
  
  // 步骤2: 获取底层模型，收集需要移动的非公式单元格数据
  const model = formulaSheet.getModel()
  const nonFormulaCellsToMove: Array<{ row: number; col: number; value: string }> = []
  
  model.forEach((r, c, cell) => {
    // 只处理非公式单元格，且位置在插入行之前（还未移动）
    if (r >= row && !cell.formulaMetadata) {
      nonFormulaCellsToMove.push({ 
        row: r, 
        col: c, 
        value: cell.value
      })
    }
  })
  
  // 按行号从大到小排序，避免覆盖
  nonFormulaCellsToMove.sort((a, b) => b.row - a.row)
  
  // 步骤3: 移动非公式单元格
  nonFormulaCellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c, '')  // 清空旧位置
    model.setValue(r + 1, c, value)  // 设置到新位置
  })
  
  // 步骤4: 移动样式 - 收集所有需要移动的样式
  const stylesToMove: Array<{ row: number; col: number; style: CellStyle }> = []
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    for (let r = sizeConfig.totalRows - 1; r >= row; r--) {
      if (model.hasCellStyle(r, c)) {
        stylesToMove.push({ row: r, col: c, style: model.getCellStyle(r, c) })
        model.clearCellStyle(r, c)
      }
    }
  }
  // 设置到新位置
  stylesToMove.forEach(({ row: r, col: c, style }) => {
    model.setCellStyle(r + 1, c, style)
  })
  
  // 步骤5: 移动边框 - 收集所有需要移动的边框
  const bordersToMove: Array<{ row: number; col: number; border: CellBorder }> = []
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    for (let r = sizeConfig.totalRows - 1; r >= row; r--) {
      if (model.hasCellBorder(r, c)) {
        bordersToMove.push({ row: r, col: c, border: model.getCellBorder(r, c)! })
        model.clearCellBorder(r, c)
      }
    }
  }
  // 设置到新位置
  bordersToMove.forEach(({ row: r, col: c, border }) => {
    model.setCellBorder(r + 1, c, border)
  })
  
  // 步骤6: 移动格式 - 收集所有需要移动的格式
  const formatsToMove: Array<{ row: number; col: number; format: CellFormat }> = []
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    for (let r = sizeConfig.totalRows - 1; r >= row; r--) {
      if (model.hasCellFormat(r, c)) {
        formatsToMove.push({ row: r, col: c, format: model.getCellFormat(r, c) })
        model.clearCellFormat(r, c)
      }
    }
  }
  // 设置到新位置
  formatsToMove.forEach(({ row: r, col: c, format }) => {
    model.setCellFormat(r + 1, c, format)
  })
  
  // 步骤7: 新行继承样式（Excel 行为：继承上方行的样式，如果是第0行则继承下方行）
  const sourceRow = row > 0 ? row - 1 : row + 1  // 继承源行
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    // 继承样式
    if (model.hasCellStyle(sourceRow, c)) {
      model.setCellStyle(row, c, model.getCellStyle(sourceRow, c))
    }
    // 继承边框
    if (model.hasCellBorder(sourceRow, c)) {
      model.setCellBorder(row, c, model.getCellBorder(sourceRow, c)!)
    }
    // 继承格式
    if (model.hasCellFormat(sourceRow, c)) {
      model.setCellFormat(row, c, model.getCellFormat(sourceRow, c))
    }
  }
  
  // 步骤8: 移动自定义行高
  const newRowHeights = new Map<number, number>()
  sizeConfig.rowHeights.forEach((height: number, r: number) => {
    if (r >= row) {
      newRowHeights.set(r + 1, height)
    } else {
      newRowHeights.set(r, height)
    }
  })
  sizeConfig.rowHeights = newRowHeights
  
  // 步骤9: 新行继承行高（Excel 行为：继承上方行的行高，如果是第0行则继承下方行）
  const heightSourceRow = row > 0 ? row - 1 : row + 1
  if (sizeConfig.rowHeights.has(heightSourceRow)) {
    sizeConfig.rowHeights.set(row, sizeConfig.rowHeights.get(heightSourceRow)!)
  }
  
  // 步骤10: 调整合并区域
  const mergedRegions = model.getAllMergedRegions()
  for (const region of mergedRegions) {
    // 取消原合并
    model.unmergeCells(region.startRow, region.startCol)
    
    let newStartRow = region.startRow
    let newEndRow = region.endRow
    
    if (row > region.startRow && row <= region.endRow) {
      // 插入位置在合并区域内部（不在起始行），扩展区域
      newEndRow = region.endRow + 1
      // 起始行不变
    } else if (row <= region.startRow) {
      // 插入位置在合并区域上方或起始行，整体下移
      newStartRow = region.startRow + 1
      newEndRow = region.endRow + 1
    }
    // 如果 row > region.endRow，合并区域不受影响，保持原位置
    
    // 重新合并（如果区域有变化或位置需要调整）
    if (newStartRow !== region.startRow || newEndRow !== region.endRow || row <= region.startRow) {
      model.mergeCells(newStartRow, region.startCol, newEndRow, region.endCol)
    } else {
      // 恢复原合并
      model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
    }
  }
  
  // 步骤11: 调整单元格内嵌图片位置
  model.adjustCellImagesForRowInsert(row, 1)
  
  // 步骤12: 调整浮动图片位置（根据锚点行移动）
  model.adjustImagesForRowInsert(row, 1)
  
  // 重新绘制（除非跳过）
  if (!config.skipRedraw) {
    onRedraw()
  }
}

/**
 * 批量在指定行上方插入多行（优化版本）
 * 相比循环调用 insertRowAbove，此函数一次性完成所有数据移动，性能提升显著
 */
export async function insertRowsAboveBatch(row: number, count: number, config: RowColConfig): Promise<void> {
  if (count <= 0) return
  if (count === 1) {
    // 单行插入走原路径
    return insertRowAbove(row, config)
  }
  
  const { formulaSheet, sizeConfig, onRedraw } = config
  
  // 步骤1: 批量调整所有公式
  await formulaSheet.adjustAllFormulasAsync('insertRow', row, count)
  
  // 步骤2: 获取底层模型，收集需要移动的非公式单元格数据
  const model = formulaSheet.getModel()
  const nonFormulaCellsToMove: Array<{ row: number; col: number; value: string }> = []
  
  model.forEach((r, c, cell) => {
    if (r >= row && !cell.formulaMetadata) {
      nonFormulaCellsToMove.push({ row: r, col: c, value: cell.value })
    }
  })
  
  nonFormulaCellsToMove.sort((a, b) => b.row - a.row)
  
  // 步骤3: 移动非公式单元格（一次性移动 count 行）
  nonFormulaCellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c, '')
    model.setValue(r + count, c, value)
  })
  
  // 步骤4-6: 合并遍历 - 同时收集样式、边框、格式（性能优化核心）
  const dataToMove: Array<{
    row: number
    col: number
    style?: CellStyle
    border?: CellBorder
    format?: CellFormat
  }> = []
  
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    for (let r = sizeConfig.totalRows - 1; r >= row; r--) {
      const hasStyle = model.hasCellStyle(r, c)
      const hasBorder = model.hasCellBorder(r, c)
      const hasFormat = model.hasCellFormat(r, c)
      
      if (hasStyle || hasBorder || hasFormat) {
        dataToMove.push({
          row: r,
          col: c,
          style: hasStyle ? model.getCellStyle(r, c) : undefined,
          border: hasBorder ? model.getCellBorder(r, c)! : undefined,
          format: hasFormat ? model.getCellFormat(r, c) : undefined
        })
        if (hasStyle) model.clearCellStyle(r, c)
        if (hasBorder) model.clearCellBorder(r, c)
        if (hasFormat) model.clearCellFormat(r, c)
      }
    }
  }
  
  // 设置到新位置
  dataToMove.forEach(({ row: r, col: c, style, border, format }) => {
    if (style) model.setCellStyle(r + count, c, style)
    if (border) model.setCellBorder(r + count, c, border)
    if (format) model.setCellFormat(r + count, c, format)
  })
  
  // 步骤7: 新行继承样式（所有新插入的行都从相同的源行继承）
  const sourceRow = row > 0 ? row - 1 : row + count  // 继承源行
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    const sourceStyle = model.hasCellStyle(sourceRow, c) ? model.getCellStyle(sourceRow, c) : null
    const sourceBorder = model.hasCellBorder(sourceRow, c) ? model.getCellBorder(sourceRow, c)! : null
    const sourceFormat = model.hasCellFormat(sourceRow, c) ? model.getCellFormat(sourceRow, c) : null
    
    // 为每个新行设置继承的样式
    for (let i = 0; i < count; i++) {
      const newRow = row + i
      if (sourceStyle) model.setCellStyle(newRow, c, sourceStyle)
      if (sourceBorder) model.setCellBorder(newRow, c, sourceBorder)
      if (sourceFormat) model.setCellFormat(newRow, c, sourceFormat)
    }
  }
  
  // 步骤8-9: 移动自定义行高并继承
  const newRowHeights = new Map<number, number>()
  sizeConfig.rowHeights.forEach((height: number, r: number) => {
    if (r >= row) {
      newRowHeights.set(r + count, height)
    } else {
      newRowHeights.set(r, height)
    }
  })
  sizeConfig.rowHeights = newRowHeights
  
  // 新行继承行高
  const heightSourceRow = row > 0 ? row - 1 : row + count
  if (sizeConfig.rowHeights.has(heightSourceRow)) {
    const inheritedHeight = sizeConfig.rowHeights.get(heightSourceRow)!
    for (let i = 0; i < count; i++) {
      sizeConfig.rowHeights.set(row + i, inheritedHeight)
    }
  }
  
  // 步骤10: 调整合并区域
  const mergedRegions = model.getAllMergedRegions()
  for (const region of mergedRegions) {
    model.unmergeCells(region.startRow, region.startCol)
    
    let newStartRow = region.startRow
    let newEndRow = region.endRow
    
    if (row > region.startRow && row <= region.endRow) {
      newEndRow = region.endRow + count
    } else if (row <= region.startRow) {
      newStartRow = region.startRow + count
      newEndRow = region.endRow + count
    }
    
    if (newStartRow !== region.startRow || newEndRow !== region.endRow || row <= region.startRow) {
      model.mergeCells(newStartRow, region.startCol, newEndRow, region.endCol)
    } else {
      model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
    }
  }
  
  // 步骤11-12: 调整图片位置
  model.adjustCellImagesForRowInsert(row, count)
  model.adjustImagesForRowInsert(row, count)
  
  // 重新绘制（只绘制一次！）
  if (!config.skipRedraw) {
    onRedraw()
  }
}

/**
 * 在指定行下方插入行
 */
export async function insertRowBelow(row: number, config: RowColConfig): Promise<void> {
  // 在下方插入等同于在 row+1 的上方插入
  await insertRowAbove(row + 1, config)
}

/**
 * 删除指定行
 */
export async function deleteRow(row: number, config: RowColConfig): Promise<void> {
  
  const { formulaSheet, sizeConfig, selected, onRedraw } = config
  
  // 步骤1: 先异步调整所有公式（会自动移动公式单元格并更新引用）
  await formulaSheet.adjustAllFormulasAsync('deleteRow', row, 1)
  
  // 步骤2: 获取底层模型，收集需要移动的非公式单元格数据
  const model = formulaSheet.getModel()
  const nonFormulaCellsToMove: Array<{ row: number; col: number; value: string }> = []
  
  model.forEach((r, c, cell) => {
    // 只处理非公式单元格
    if (r > row && !cell.formulaMetadata) {
      nonFormulaCellsToMove.push({ 
        row: r, 
        col: c, 
        value: cell.value
      })
    }
  })
  
  // 按行号从小到大排序，从前往后移动
  nonFormulaCellsToMove.sort((a, b) => a.row - b.row)
  
  // 步骤3: 清空被删除的行（非公式单元格）
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    const cell = model.getCell(row, c)
    if (cell && !cell.formulaMetadata) {
      model.setValue(row, c, '')
    }
  }
  
  // 步骤4: 移动非公式单元格
  nonFormulaCellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c, '')  // 清空旧位置
    model.setValue(r - 1, c, value)  // 设置到新位置
  })
  
  // 步骤5: 移动样式
  // 先清除被删除行的样式
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    model.clearCellStyle(row, c)
  }
  // 收集并移动需要上移的样式
  const stylesToMove: Array<{ row: number; col: number; style: CellStyle }> = []
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    for (let r = row + 1; r < sizeConfig.totalRows; r++) {
      if (model.hasCellStyle(r, c)) {
        stylesToMove.push({ row: r, col: c, style: model.getCellStyle(r, c) })
        model.clearCellStyle(r, c)
      }
    }
  }
  stylesToMove.forEach(({ row: r, col: c, style }) => {
    model.setCellStyle(r - 1, c, style)
  })
  
  // 步骤6: 移动边框
  // 先清除被删除行的边框
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    model.clearCellBorder(row, c)
  }
  // 收集并移动需要上移的边框
  const bordersToMove: Array<{ row: number; col: number; border: CellBorder }> = []
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    for (let r = row + 1; r < sizeConfig.totalRows; r++) {
      if (model.hasCellBorder(r, c)) {
        bordersToMove.push({ row: r, col: c, border: model.getCellBorder(r, c)! })
        model.clearCellBorder(r, c)
      }
    }
  }
  bordersToMove.forEach(({ row: r, col: c, border }) => {
    model.setCellBorder(r - 1, c, border)
  })
  
  // 步骤7: 移动格式
  // 先清除被删除行的格式
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    model.clearCellFormat(row, c)
  }
  // 收集并移动需要上移的格式
  const formatsToMove: Array<{ row: number; col: number; format: CellFormat }> = []
  for (let c = 0; c < sizeConfig.totalCols; c++) {
    for (let r = row + 1; r < sizeConfig.totalRows; r++) {
      if (model.hasCellFormat(r, c)) {
        formatsToMove.push({ row: r, col: c, format: model.getCellFormat(r, c) })
        model.clearCellFormat(r, c)
      }
    }
  }
  formatsToMove.forEach(({ row: r, col: c, format }) => {
    model.setCellFormat(r - 1, c, format)
  })
  
  // 步骤8: 移动自定义行高
  const newRowHeights = new Map<number, number>()
  sizeConfig.rowHeights.forEach((height: number, r: number) => {
    if (r < row) {
      newRowHeights.set(r, height)
    } else if (r > row) {
      newRowHeights.set(r - 1, height)
    }
  })
  sizeConfig.rowHeights = newRowHeights
  
  // 步骤9: 调整选择范围
  if (selected.row === row) {
    selected.row = Math.max(0, row - 1)
  } else if (selected.row > row) {
    selected.row--
  }
  
  // 步骤10: 调整合并区域
  // 对于删除行：
  // - 如果删除位置在合并区域内部，需要收缩合并区域（减少1行）
  // - 如果删除位置在合并区域下方，合并区域不受影响
  // - 如果删除位置在合并区域上方，合并区域位置需要上移
  // - 如果删除位置是合并区域的起始行且合并区域只有1行高，取消合并
  const mergedRegions = model.getAllMergedRegions()
  for (const region of mergedRegions) {
    // 取消原合并
    model.unmergeCells(region.startRow, region.startCol)
    
    if (row < region.startRow) {
      // 删除位置在合并区域上方，整体上移
      model.mergeCells(region.startRow - 1, region.startCol, region.endRow - 1, region.endCol)
    } else if (row > region.endRow) {
      // 删除位置在合并区域下方，保持原样
      model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
    } else {
      // 删除位置在合并区域内部
      const newEndRow = region.endRow - 1
      if (newEndRow >= region.startRow) {
        // 仍有多行，收缩区域
        model.mergeCells(region.startRow, region.startCol, newEndRow, region.endCol)
      }
      // 如果收缩后只有1行1列，不再合并
    }
  }
  
  // 步骤11: 调整单元格内嵌图片位置
  model.adjustCellImagesForRowDelete(row, 1)
  
  // 步骤12: 调整浮动图片位置（根据锚点行移动）
  model.adjustImagesForRowDelete(row, 1)
  
  // 重新绘制
  onRedraw()
}

/**
 * 在指定列左侧插入列
 */
export async function insertColLeft(col: number, config: RowColConfig): Promise<void> {
  
  const { formulaSheet, sizeConfig, onRedraw } = config
  
  // 步骤1: 先异步调整所有公式（会自动移动公式单元格并更新引用）
  await formulaSheet.adjustAllFormulasAsync('insertCol', col, 1)
  
  // 步骤2: 获取底层模型，收集需要移动的非公式单元格数据
  const model = formulaSheet.getModel()
  const nonFormulaCellsToMove: Array<{ row: number; col: number; value: string }> = []
  
  model.forEach((r, c, cell) => {
    // 只处理非公式单元格
    if (c >= col && !cell.formulaMetadata) {
      nonFormulaCellsToMove.push({ 
        row: r, 
        col: c, 
        value: cell.value
      })
    }
  })
  
  // 按列号从大到小排序，避免覆盖
  nonFormulaCellsToMove.sort((a, b) => b.col - a.col)
  
  // 步骤3: 移动非公式单元格
  nonFormulaCellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c, '')  // 清空旧位置
    model.setValue(r, c + 1, value)  // 设置到新位置
  })
  
  // 步骤4: 移动样式 - 收集所有需要移动的样式
  const stylesToMove: Array<{ row: number; col: number; style: CellStyle }> = []
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    for (let c = sizeConfig.totalCols - 1; c >= col; c--) {
      if (model.hasCellStyle(r, c)) {
        stylesToMove.push({ row: r, col: c, style: model.getCellStyle(r, c) })
        model.clearCellStyle(r, c)
      }
    }
  }
  // 设置到新位置
  stylesToMove.forEach(({ row: r, col: c, style }) => {
    model.setCellStyle(r, c + 1, style)
  })
  
  // 步骤5: 移动边框 - 收集所有需要移动的边框
  const bordersToMove: Array<{ row: number; col: number; border: CellBorder }> = []
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    for (let c = sizeConfig.totalCols - 1; c >= col; c--) {
      if (model.hasCellBorder(r, c)) {
        bordersToMove.push({ row: r, col: c, border: model.getCellBorder(r, c)! })
        model.clearCellBorder(r, c)
      }
    }
  }
  // 设置到新位置
  bordersToMove.forEach(({ row: r, col: c, border }) => {
    model.setCellBorder(r, c + 1, border)
  })
  
  // 步骤6: 移动格式 - 收集所有需要移动的格式
  const formatsToMove: Array<{ row: number; col: number; format: CellFormat }> = []
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    for (let c = sizeConfig.totalCols - 1; c >= col; c--) {
      if (model.hasCellFormat(r, c)) {
        formatsToMove.push({ row: r, col: c, format: model.getCellFormat(r, c) })
        model.clearCellFormat(r, c)
      }
    }
  }
  // 设置到新位置
  formatsToMove.forEach(({ row: r, col: c, format }) => {
    model.setCellFormat(r, c + 1, format)
  })
  
  // 步骤7: 新列继承样式（Excel 行为：继承左侧列的样式，如果是第0列则继承右侧列）
  const sourceCol = col > 0 ? col - 1 : col + 1  // 继承源列
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    // 继承样式
    if (model.hasCellStyle(r, sourceCol)) {
      model.setCellStyle(r, col, model.getCellStyle(r, sourceCol))
    }
    // 继承边框
    if (model.hasCellBorder(r, sourceCol)) {
      model.setCellBorder(r, col, model.getCellBorder(r, sourceCol)!)
    }
    // 继承格式
    if (model.hasCellFormat(r, sourceCol)) {
      model.setCellFormat(r, col, model.getCellFormat(r, sourceCol))
    }
  }
  
  // 步骤8: 移动自定义列宽
  const newColWidths = new Map<number, number>()
  sizeConfig.colWidths.forEach((width: number, c: number) => {
    if (c >= col) {
      newColWidths.set(c + 1, width)
    } else {
      newColWidths.set(c, width)
    }
  })
  sizeConfig.colWidths = newColWidths
  
  // 步骤9: 新列继承列宽（Excel 行为：继承左侧列的列宽，如果是第0列则继承右侧列）
  const widthSourceCol = col > 0 ? col - 1 : col + 1
  if (sizeConfig.colWidths.has(widthSourceCol)) {
    sizeConfig.colWidths.set(col, sizeConfig.colWidths.get(widthSourceCol)!)
  }
  
  // 步骤10: 调整合并区域
  // 对于插入列：
  // - 如果插入位置在合并区域内部（不在起始列），需要扩展合并区域（向右扩展1列）
  // - 如果插入位置在合并区域右侧，合并区域不受影响
  // - 如果插入位置在合并区域左侧或起始列，合并区域位置需要右移
  const mergedRegions = model.getAllMergedRegions()
  for (const region of mergedRegions) {
    // 取消原合并
    model.unmergeCells(region.startRow, region.startCol)
    
    let newStartCol = region.startCol
    let newEndCol = region.endCol
    
    if (col > region.startCol && col <= region.endCol) {
      // 插入位置在合并区域内部（不在起始列），扩展区域
      newEndCol = region.endCol + 1
      // 起始列不变
    } else if (col <= region.startCol) {
      // 插入位置在合并区域左侧或起始列，整体右移
      newStartCol = region.startCol + 1
      newEndCol = region.endCol + 1
    }
    // 如果 col > region.endCol，合并区域不受影响，保持原位置
    
    // 重新合并（如果区域有变化或位置需要调整）
    if (newStartCol !== region.startCol || newEndCol !== region.endCol || col <= region.startCol) {
      model.mergeCells(region.startRow, newStartCol, region.endRow, newEndCol)
    } else {
      // 恢复原合并
      model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
    }
  }
  
  // 步骤11: 调整单元格内嵌图片位置
  model.adjustCellImagesForColInsert(col, 1)
  
  // 步骤12: 调整浮动图片位置（根据锚点列移动）
  model.adjustImagesForColInsert(col, 1)
  
  // 重新绘制（除非跳过）
  if (!config.skipRedraw) {
    onRedraw()
  }
}

/**
 * 批量在指定列左侧插入多列（优化版本）
 */
export async function insertColsLeftBatch(col: number, count: number, config: RowColConfig): Promise<void> {
  if (count <= 0) return
  if (count === 1) {
    return insertColLeft(col, config)
  }
  
  const { formulaSheet, sizeConfig, onRedraw } = config
  
  // 步骤1: 批量调整所有公式
  await formulaSheet.adjustAllFormulasAsync('insertCol', col, count)
  
  // 步骤2: 获取底层模型，收集需要移动的非公式单元格数据
  const model = formulaSheet.getModel()
  const nonFormulaCellsToMove: Array<{ row: number; col: number; value: string }> = []
  
  model.forEach((r, c, cell) => {
    if (c >= col && !cell.formulaMetadata) {
      nonFormulaCellsToMove.push({ row: r, col: c, value: cell.value })
    }
  })
  
  nonFormulaCellsToMove.sort((a, b) => b.col - a.col)
  
  // 步骤3: 移动非公式单元格（一次性移动 count 列）
  nonFormulaCellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c, '')
    model.setValue(r, c + count, value)
  })
  
  // 步骤4-6: 合并遍历 - 同时收集样式、边框、格式
  const dataToMove: Array<{
    row: number
    col: number
    style?: CellStyle
    border?: CellBorder
    format?: CellFormat
  }> = []
  
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    for (let c = sizeConfig.totalCols - 1; c >= col; c--) {
      const hasStyle = model.hasCellStyle(r, c)
      const hasBorder = model.hasCellBorder(r, c)
      const hasFormat = model.hasCellFormat(r, c)
      
      if (hasStyle || hasBorder || hasFormat) {
        dataToMove.push({
          row: r,
          col: c,
          style: hasStyle ? model.getCellStyle(r, c) : undefined,
          border: hasBorder ? model.getCellBorder(r, c)! : undefined,
          format: hasFormat ? model.getCellFormat(r, c) : undefined
        })
        if (hasStyle) model.clearCellStyle(r, c)
        if (hasBorder) model.clearCellBorder(r, c)
        if (hasFormat) model.clearCellFormat(r, c)
      }
    }
  }
  
  // 设置到新位置
  dataToMove.forEach(({ row: r, col: c, style, border, format }) => {
    if (style) model.setCellStyle(r, c + count, style)
    if (border) model.setCellBorder(r, c + count, border)
    if (format) model.setCellFormat(r, c + count, format)
  })
  
  // 步骤7: 新列继承样式
  const sourceCol = col > 0 ? col - 1 : col + count
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    const sourceStyle = model.hasCellStyle(r, sourceCol) ? model.getCellStyle(r, sourceCol) : null
    const sourceBorder = model.hasCellBorder(r, sourceCol) ? model.getCellBorder(r, sourceCol)! : null
    const sourceFormat = model.hasCellFormat(r, sourceCol) ? model.getCellFormat(r, sourceCol) : null
    
    for (let i = 0; i < count; i++) {
      const newCol = col + i
      if (sourceStyle) model.setCellStyle(r, newCol, sourceStyle)
      if (sourceBorder) model.setCellBorder(r, newCol, sourceBorder)
      if (sourceFormat) model.setCellFormat(r, newCol, sourceFormat)
    }
  }
  
  // 步骤8-9: 移动自定义列宽并继承
  const newColWidths = new Map<number, number>()
  sizeConfig.colWidths.forEach((width: number, c: number) => {
    if (c >= col) {
      newColWidths.set(c + count, width)
    } else {
      newColWidths.set(c, width)
    }
  })
  sizeConfig.colWidths = newColWidths
  
  const widthSourceCol = col > 0 ? col - 1 : col + count
  if (sizeConfig.colWidths.has(widthSourceCol)) {
    const inheritedWidth = sizeConfig.colWidths.get(widthSourceCol)!
    for (let i = 0; i < count; i++) {
      sizeConfig.colWidths.set(col + i, inheritedWidth)
    }
  }
  
  // 步骤10: 调整合并区域
  const mergedRegions = model.getAllMergedRegions()
  for (const region of mergedRegions) {
    model.unmergeCells(region.startRow, region.startCol)
    
    let newStartCol = region.startCol
    let newEndCol = region.endCol
    
    if (col > region.startCol && col <= region.endCol) {
      newEndCol = region.endCol + count
    } else if (col <= region.startCol) {
      newStartCol = region.startCol + count
      newEndCol = region.endCol + count
    }
    
    if (newStartCol !== region.startCol || newEndCol !== region.endCol || col <= region.startCol) {
      model.mergeCells(region.startRow, newStartCol, region.endRow, newEndCol)
    } else {
      model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
    }
  }
  
  // 步骤11-12: 调整图片位置
  model.adjustCellImagesForColInsert(col, count)
  model.adjustImagesForColInsert(col, count)
  
  // 重新绘制（只绘制一次！）
  if (!config.skipRedraw) {
    onRedraw()
  }
}

/**
 * 在指定列右侧插入列
 */
export async function insertColRight(col: number, config: RowColConfig): Promise<void> {
  // 在右侧插入等同于在 col+1 的左侧插入
  await insertColLeft(col + 1, config)
}

/**
 * 删除指定列
 */
export async function deleteCol(col: number, config: RowColConfig): Promise<void> {
  
  const { formulaSheet, sizeConfig, selected, onRedraw } = config
  
  // 步骤1: 先异步调整所有公式（会自动移动公式单元格并更新引用）
  await formulaSheet.adjustAllFormulasAsync('deleteCol', col, 1)
  
  // 步骤2: 获取底层模型，收集需要移动的非公式单元格数据
  const model = formulaSheet.getModel()
  const nonFormulaCellsToMove: Array<{ row: number; col: number; value: string }> = []
  
  model.forEach((r, c, cell) => {
    // 只处理非公式单元格
    if (c > col && !cell.formulaMetadata) {
      nonFormulaCellsToMove.push({ 
        row: r, 
        col: c, 
        value: cell.value
      })
    }
  })
  
  // 按列号从小到大排序，从左往右移动
  nonFormulaCellsToMove.sort((a, b) => a.col - b.col)
  
  // 步骤3: 清空被删除的列（非公式单元格）
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    const cell = model.getCell(r, col)
    if (cell && !cell.formulaMetadata) {
      model.setValue(r, col, '')
    }
  }
  
  // 步骤4: 移动非公式单元格
  nonFormulaCellsToMove.forEach(({ row: r, col: c, value }) => {
    model.setValue(r, c, '')  // 清空旧位置
    model.setValue(r, c - 1, value)  // 设置到新位置
  })
  
  // 步骤5: 移动样式
  // 先清除被删除列的样式
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    model.clearCellStyle(r, col)
  }
  // 收集并移动需要左移的样式
  const stylesToMove: Array<{ row: number; col: number; style: CellStyle }> = []
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    for (let c = col + 1; c < sizeConfig.totalCols; c++) {
      if (model.hasCellStyle(r, c)) {
        stylesToMove.push({ row: r, col: c, style: model.getCellStyle(r, c) })
        model.clearCellStyle(r, c)
      }
    }
  }
  stylesToMove.forEach(({ row: r, col: c, style }) => {
    model.setCellStyle(r, c - 1, style)
  })
  
  // 步骤6: 移动边框
  // 先清除被删除列的边框
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    model.clearCellBorder(r, col)
  }
  // 收集并移动需要左移的边框
  const bordersToMove: Array<{ row: number; col: number; border: CellBorder }> = []
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    for (let c = col + 1; c < sizeConfig.totalCols; c++) {
      if (model.hasCellBorder(r, c)) {
        bordersToMove.push({ row: r, col: c, border: model.getCellBorder(r, c)! })
        model.clearCellBorder(r, c)
      }
    }
  }
  bordersToMove.forEach(({ row: r, col: c, border }) => {
    model.setCellBorder(r, c - 1, border)
  })
  
  // 步骤7: 移动格式
  // 先清除被删除列的格式
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    model.clearCellFormat(r, col)
  }
  // 收集并移动需要左移的格式
  const formatsToMove: Array<{ row: number; col: number; format: CellFormat }> = []
  for (let r = 0; r < sizeConfig.totalRows; r++) {
    for (let c = col + 1; c < sizeConfig.totalCols; c++) {
      if (model.hasCellFormat(r, c)) {
        formatsToMove.push({ row: r, col: c, format: model.getCellFormat(r, c) })
        model.clearCellFormat(r, c)
      }
    }
  }
  formatsToMove.forEach(({ row: r, col: c, format }) => {
    model.setCellFormat(r, c - 1, format)
  })
  
  // 步骤8: 移动自定义列宽
  const newColWidths = new Map<number, number>()
  sizeConfig.colWidths.forEach((width: number, c: number) => {
    if (c < col) {
      newColWidths.set(c, width)
    } else if (c > col) {
      newColWidths.set(c - 1, width)
    }
  })
  sizeConfig.colWidths = newColWidths
  
  // 步骤9: 调整选择范围
  if (selected.col === col) {
    selected.col = Math.max(0, col - 1)
  } else if (selected.col > col) {
    selected.col--
  }
  
  // 步骤10: 调整合并区域
  // 对于删除列：
  // - 如果删除位置在合并区域内部，需要收缩合并区域（减少1列）
  // - 如果删除位置在合并区域右侧，合并区域不受影响
  // - 如果删除位置在合并区域左侧，合并区域位置需要左移
  // - 如果删除位置是合并区域的起始列且合并区域只有1列宽，取消合并
  const mergedRegions = model.getAllMergedRegions()
  for (const region of mergedRegions) {
    // 取消原合并
    model.unmergeCells(region.startRow, region.startCol)
    
    if (col < region.startCol) {
      // 删除位置在合并区域左侧，整体左移
      model.mergeCells(region.startRow, region.startCol - 1, region.endRow, region.endCol - 1)
    } else if (col > region.endCol) {
      // 删除位置在合并区域右侧，保持原样
      model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
    } else {
      // 删除位置在合并区域内部
      const newEndCol = region.endCol - 1
      if (newEndCol >= region.startCol) {
        // 仍有多列，收缩区域
        model.mergeCells(region.startRow, region.startCol, region.endRow, newEndCol)
      }
      // 如果收缩后只有1行1列，不再合并
    }
  }
  
  // 步骤11: 调整单元格内嵌图片位置
  model.adjustCellImagesForColDelete(col, 1)
  
  // 步骤12: 调整浮动图片位置（根据锚点列移动）
  model.adjustImagesForColDelete(col, 1)
  
  // 重新绘制
  onRedraw()
}

/**
 * 输入对话框回调类型
 */
export type InputDialogCallback = (value: string) => void

/**
 * 输入对话框状态
 */
export interface InputDialogState {
  visible: boolean
  title: string
  defaultValue: string
  placeholder: string
  callback?: InputDialogCallback
}

/**
 * 显示设置行高对话框
 */
export function showSetRowHeightDialog(
  row: number,
  currentHeight: number,
  rowHeights: Map<number, number>,
  manualRowHeights: Set<number>,
  hiddenRows: Set<number>,
  dialogState: InputDialogState,
  onRedraw: () => void
): void {
  dialogState.title = '设置行高'
  dialogState.defaultValue = currentHeight.toString()
  dialogState.placeholder = '请输入行高（像素），0 表示隐藏'
  dialogState.callback = (value: string) => {
    const height = parseInt(value, 10)
    if (!isNaN(height)) {
      if (height <= 0) {
        // 高度 <= 0 等价于隐藏行
        hiddenRows.add(row)
      } else {
        hiddenRows.delete(row)
        rowHeights.set(row, height)
        // 记录为用户手动设置的行高
        manualRowHeights.add(row)
      }
      onRedraw()
    }
  }
  dialogState.visible = true
}

/**
 * 显示设置列宽对话框
 */
export function showSetColWidthDialog(
  col: number,
  currentWidth: number,
  colWidths: Map<number, number>,
  hiddenCols: Set<number>,
  dialogState: InputDialogState,
  onRedraw: () => void
): void {
  dialogState.title = '设置列宽'
  dialogState.defaultValue = currentWidth.toString()
  dialogState.placeholder = '请输入列宽（像素），0 表示隐藏'
  dialogState.callback = (value: string) => {
    const width = parseInt(value, 10)
    if (!isNaN(width)) {
      if (width <= 0) {
        // 宽度 <= 0 等价于隐藏列
        hiddenCols.add(col)
      } else {
        hiddenCols.delete(col)
        colWidths.set(col, width)
      }
      onRedraw()
    }
  }
  dialogState.visible = true
}
