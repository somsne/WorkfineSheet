/**
 * 菜单与对话框模块
 * 负责右键菜单和输入对话框的生成与状态管理
 */

/**
 * 菜单项接口
 */
export interface MenuItem {
  label: string
  action: () => void
  disabled?: boolean
  divider?: boolean
}

/**
 * 右键菜单状态
 */
export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  items: MenuItem[]
  targetRow: number
  targetCol: number
}

/**
 * 选区范围
 */
export interface SelectionRangeInfo {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

/**
 * 右键菜单配置
 */
export interface ContextMenuConfig {
  rowHeaderWidth: number
  colHeaderHeight: number
  getRowAtY: (y: number) => number
  getColAtX: (x: number) => number
  /** 当前选区，用于计算多选行列数量 */
  selectionRange?: SelectionRangeInfo
  /** 隐藏的行集合 */
  hiddenRows?: Set<number>
  /** 隐藏的列集合 */
  hiddenCols?: Set<number>
  rowOperations: {
    insertRowAbove: (row: number, count?: number) => void
    insertRowBelow: (row: number, count?: number) => void
    deleteRow: (row: number, count?: number) => void
    showSetRowHeightDialog: (row: number) => void
    hideRows: (startRow: number, endRow: number) => void
    unhideRows: (startRow: number, endRow: number) => void
  }
  colOperations: {
    insertColLeft: (col: number, count?: number) => void
    insertColRight: (col: number, count?: number) => void
    deleteCol: (col: number, count?: number) => void
    showSetColWidthDialog: (col: number) => void
    hideCols: (startCol: number, endCol: number) => void
    unhideCols: (startCol: number, endCol: number) => void
  }
}

/**
 * 处理右键菜单事件
 * 根据点击位置（行头、列头或其他区域）生成相应的菜单项
 * 当选中多行/列时，支持批量插入/删除
 */
export function handleContextMenu(
  e: MouseEvent,
  containerRect: DOMRect,
  config: ContextMenuConfig,
  menuState: ContextMenuState
): void {
  const x = e.clientX - containerRect.left
  const y = e.clientY - containerRect.top
  
  menuState.x = e.clientX
  menuState.y = e.clientY
  
  const { rowHeaderWidth, colHeaderHeight, getRowAtY, getColAtX, rowOperations, colOperations, selectionRange, hiddenRows, hiddenCols } = config
  
  // 判断点击位置
  if (x < rowHeaderWidth && y > colHeaderHeight) {
    // 点击行头
    const row = getRowAtY(y)
    menuState.targetRow = row
    menuState.targetCol = -1
    
    // 计算选中的行数
    let rowCount = 1
    let startRow = row
    if (selectionRange && selectionRange.startRow !== -1 && selectionRange.endRow !== -1) {
      // 检查点击的行是否在选区范围内
      if (row >= selectionRange.startRow && row <= selectionRange.endRow) {
        rowCount = selectionRange.endRow - selectionRange.startRow + 1
        startRow = selectionRange.startRow
      }
    }
    
    const rowText = rowCount > 1 ? `${rowCount} 行` : '行'
    const endRow = selectionRange && row >= selectionRange.startRow && row <= selectionRange.endRow ? selectionRange.endRow : row
    
    // 检查选区范围内是否有隐藏行（用于判断是否显示取消隐藏选项）
    let hasHiddenRowsInRange = false
    if (hiddenRows) {
      for (let r = startRow; r <= endRow; r++) {
        if (hiddenRows.has(r)) {
          hasHiddenRowsInRange = true
          break
        }
      }
    }
    
    // 检查选区前面是否有连续隐藏的行（用于单行选择时取消隐藏前面的行）
    let hasHiddenRowsBefore = false
    let hiddenRowsBeforeStart = startRow
    if (hiddenRows && startRow > 0) {
      // 向前查找连续隐藏的行
      let checkRow = startRow - 1
      while (checkRow >= 0 && hiddenRows.has(checkRow)) {
        hiddenRowsBeforeStart = checkRow
        hasHiddenRowsBefore = true
        checkRow--
      }
    }
    
    menuState.items = [
      { label: `在上方插入${rowText}`, action: () => rowOperations.insertRowAbove(startRow, rowCount) },
      { label: `在下方插入${rowText}`, action: () => rowOperations.insertRowBelow(endRow, rowCount) },
      { label: `删除${rowText}`, action: () => rowOperations.deleteRow(startRow, rowCount) },
      { label: '', action: () => {}, divider: true },
      { label: `隐藏${rowText}`, action: () => rowOperations.hideRows(startRow, endRow) },
      { label: '取消隐藏', action: () => {
        if (hasHiddenRowsInRange) {
          // 取消隐藏选区内的隐藏行
          rowOperations.unhideRows(startRow, endRow)
        } else if (hasHiddenRowsBefore) {
          // 取消隐藏选区前面的连续隐藏行
          rowOperations.unhideRows(hiddenRowsBeforeStart, startRow - 1)
        }
      }, disabled: !hasHiddenRowsInRange && !hasHiddenRowsBefore },
      { label: '', action: () => {}, divider: true },
      { label: '设置行高...', action: () => rowOperations.showSetRowHeightDialog(row) }
    ]
    menuState.visible = true
  } else if (y < colHeaderHeight && x > rowHeaderWidth) {
    // 点击列头
    const col = getColAtX(x)
    menuState.targetRow = -1
    menuState.targetCol = col
    
    // 计算选中的列数
    let colCount = 1
    let startCol = col
    if (selectionRange && selectionRange.startCol !== -1 && selectionRange.endCol !== -1) {
      // 检查点击的列是否在选区范围内
      if (col >= selectionRange.startCol && col <= selectionRange.endCol) {
        colCount = selectionRange.endCol - selectionRange.startCol + 1
        startCol = selectionRange.startCol
      }
    }
    
    const colText = colCount > 1 ? `${colCount} 列` : '列'
    const endCol = selectionRange && col >= selectionRange.startCol && col <= selectionRange.endCol ? selectionRange.endCol : col
    
    // 检查选区范围内是否有隐藏列（用于判断是否显示取消隐藏选项）
    let hasHiddenColsInRange = false
    if (hiddenCols) {
      for (let c = startCol; c <= endCol; c++) {
        if (hiddenCols.has(c)) {
          hasHiddenColsInRange = true
          break
        }
      }
    }
    
    // 检查选区前面是否有连续隐藏的列（用于单列选择时取消隐藏前面的列）
    let hasHiddenColsBefore = false
    let hiddenColsBeforeStart = startCol
    if (hiddenCols && startCol > 0) {
      // 向前查找连续隐藏的列
      let checkCol = startCol - 1
      while (checkCol >= 0 && hiddenCols.has(checkCol)) {
        hiddenColsBeforeStart = checkCol
        hasHiddenColsBefore = true
        checkCol--
      }
    }
    
    menuState.items = [
      { label: `在左侧插入${colText}`, action: () => colOperations.insertColLeft(startCol, colCount) },
      { label: `在右侧插入${colText}`, action: () => colOperations.insertColRight(endCol, colCount) },
      { label: `删除${colText}`, action: () => colOperations.deleteCol(startCol, colCount) },
      { label: '', action: () => {}, divider: true },
      { label: `隐藏${colText}`, action: () => colOperations.hideCols(startCol, endCol) },
      { label: '取消隐藏', action: () => {
        if (hasHiddenColsInRange) {
          // 取消隐藏选区内的隐藏列
          colOperations.unhideCols(startCol, endCol)
        } else if (hasHiddenColsBefore) {
          // 取消隐藏选区前面的连续隐藏列
          colOperations.unhideCols(hiddenColsBeforeStart, startCol - 1)
        }
      }, disabled: !hasHiddenColsInRange && !hasHiddenColsBefore },
      { label: '', action: () => {}, divider: true },
      { label: '设置列宽...', action: () => colOperations.showSetColWidthDialog(col) }
    ]
    menuState.visible = true
  }
  // 其他区域不显示菜单（已屏蔽默认菜单）
}

/**
 * 输入对话框状态
 */
export interface InputDialogState {
  visible: boolean
  title: string
  defaultValue: string
  placeholder: string
  callback: ((value: string) => void) | null
}

/**
 * 输入对话框确认处理
 */
export function handleInputDialogConfirm(value: string, dialogState: InputDialogState): void {
  if (dialogState.callback) {
    dialogState.callback(value)
  }
  dialogState.visible = false
}

/**
 * 关闭输入对话框
 */
export function closeInputDialog(dialogState: InputDialogState): void {
  dialogState.visible = false
}
