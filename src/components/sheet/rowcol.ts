/**
 * 行列操作模块
 * 负责行列的插入、删除和尺寸设置
 */

/**
 * 公式表接口（适配器模式）
 */
export interface FormulaSheetAdapter {
  adjustAllFormulasAsync(operation: string, index: number, count: number): Promise<void>
  getModel(): {
    forEach(callback: (row: number, col: number, cell: any) => void): void
    getCell(row: number, col: number): any
    setValue(row: number, col: number, value: string): void
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
}

/**
 * 在指定行上方插入行
 */
export async function insertRowAbove(row: number, config: RowColConfig): Promise<void> {
  console.log('在行', row, '上方插入行')
  
  const { formulaSheet, sizeConfig, onRedraw } = config
  
  // 步骤1: 先异步调整所有公式（会自动移动公式单元格并更新引用）
  // 这一步必须在移动非公式单元格之前，因为需要读取原始的元数据
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
  
  // 步骤4: 移动自定义行高
  const newRowHeights = new Map<number, number>()
  sizeConfig.rowHeights.forEach((height: number, r: number) => {
    if (r >= row) {
      newRowHeights.set(r + 1, height)
    } else {
      newRowHeights.set(r, height)
    }
  })
  sizeConfig.rowHeights = newRowHeights
  
  // 重新绘制
  onRedraw()
}

/**
 * 在指定行下方插入行
 */
export async function insertRowBelow(row: number, config: RowColConfig): Promise<void> {
  console.log('在行', row, '下方插入行')
  // 在下方插入等同于在 row+1 的上方插入
  await insertRowAbove(row + 1, config)
}

/**
 * 删除指定行
 */
export async function deleteRow(row: number, config: RowColConfig): Promise<void> {
  console.log('删除行', row)
  
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
  
  // 步骤5: 移动自定义行高
  const newRowHeights = new Map<number, number>()
  sizeConfig.rowHeights.forEach((height: number, r: number) => {
    if (r < row) {
      newRowHeights.set(r, height)
    } else if (r > row) {
      newRowHeights.set(r - 1, height)
    }
  })
  sizeConfig.rowHeights = newRowHeights
  
  // 步骤6: 调整选择范围
  if (selected.row === row) {
    selected.row = Math.max(0, row - 1)
  } else if (selected.row > row) {
    selected.row--
  }
  
  // 重新绘制
  onRedraw()
}

/**
 * 在指定列左侧插入列
 */
export async function insertColLeft(col: number, config: RowColConfig): Promise<void> {
  console.log('在列', col, '左侧插入列')
  
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
  
  // 步骤4: 移动自定义列宽
  const newColWidths = new Map<number, number>()
  sizeConfig.colWidths.forEach((width: number, c: number) => {
    if (c >= col) {
      newColWidths.set(c + 1, width)
    } else {
      newColWidths.set(c, width)
    }
  })
  sizeConfig.colWidths = newColWidths
  
  // 重新绘制
  onRedraw()
}

/**
 * 在指定列右侧插入列
 */
export async function insertColRight(col: number, config: RowColConfig): Promise<void> {
  console.log('在列', col, '右侧插入列')
  // 在右侧插入等同于在 col+1 的左侧插入
  await insertColLeft(col + 1, config)
}

/**
 * 删除指定列
 */
export async function deleteCol(col: number, config: RowColConfig): Promise<void> {
  console.log('删除列', col)
  
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
  
  // 步骤5: 移动自定义列宽
  const newColWidths = new Map<number, number>()
  sizeConfig.colWidths.forEach((width: number, c: number) => {
    if (c < col) {
      newColWidths.set(c, width)
    } else if (c > col) {
      newColWidths.set(c - 1, width)
    }
  })
  sizeConfig.colWidths = newColWidths
  
  // 步骤6: 调整选择范围
  if (selected.col === col) {
    selected.col = Math.max(0, col - 1)
  } else if (selected.col > col) {
    selected.col--
  }
  
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
  dialogState: InputDialogState,
  onRedraw: () => void
): void {
  dialogState.title = '设置行高'
  dialogState.defaultValue = currentHeight.toString()
  dialogState.placeholder = '请输入行高（像素）'
  dialogState.callback = (value: string) => {
    const height = parseInt(value, 10)
    if (!isNaN(height) && height > 0) {
      rowHeights.set(row, height)
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
  dialogState: InputDialogState,
  onRedraw: () => void
): void {
  dialogState.title = '设置列宽'
  dialogState.defaultValue = currentWidth.toString()
  dialogState.placeholder = '请输入列宽（像素）'
  dialogState.callback = (value: string) => {
    const width = parseInt(value, 10)
    if (!isNaN(width) && width > 0) {
      colWidths.set(col, width)
      onRedraw()
    }
  }
  dialogState.visible = true
}
