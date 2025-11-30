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
  rowOperations: {
    insertRowAbove: (row: number, count?: number) => void
    insertRowBelow: (row: number, count?: number) => void
    deleteRow: (row: number, count?: number) => void
    showSetRowHeightDialog: (row: number) => void
  }
  colOperations: {
    insertColLeft: (col: number, count?: number) => void
    insertColRight: (col: number, count?: number) => void
    deleteCol: (col: number, count?: number) => void
    showSetColWidthDialog: (col: number) => void
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
  
  const { rowHeaderWidth, colHeaderHeight, getRowAtY, getColAtX, rowOperations, colOperations, selectionRange } = config
  
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
    
    menuState.items = [
      { label: `在上方插入${rowText}`, action: () => rowOperations.insertRowAbove(startRow, rowCount) },
      { label: `在下方插入${rowText}`, action: () => rowOperations.insertRowBelow(selectionRange && row >= selectionRange.startRow && row <= selectionRange.endRow ? selectionRange.endRow : row, rowCount) },
      { label: `删除${rowText}`, action: () => rowOperations.deleteRow(startRow, rowCount) },
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
    
    menuState.items = [
      { label: `在左侧插入${colText}`, action: () => colOperations.insertColLeft(startCol, colCount) },
      { label: `在右侧插入${colText}`, action: () => colOperations.insertColRight(selectionRange && col >= selectionRange.startCol && col <= selectionRange.endCol ? selectionRange.endCol : col, colCount) },
      { label: `删除${colText}`, action: () => colOperations.deleteCol(startCol, colCount) },
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
