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
 * 右键菜单配置
 */
export interface ContextMenuConfig {
  rowHeaderWidth: number
  colHeaderHeight: number
  getRowAtY: (y: number) => number
  getColAtX: (x: number) => number
  rowOperations: {
    insertRowAbove: (row: number) => void
    insertRowBelow: (row: number) => void
    deleteRow: (row: number) => void
    showSetRowHeightDialog: (row: number) => void
  }
  colOperations: {
    insertColLeft: (col: number) => void
    insertColRight: (col: number) => void
    deleteCol: (col: number) => void
    showSetColWidthDialog: (col: number) => void
  }
}

/**
 * 处理右键菜单事件
 * 根据点击位置（行头、列头或其他区域）生成相应的菜单项
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
  
  const { rowHeaderWidth, colHeaderHeight, getRowAtY, getColAtX, rowOperations, colOperations } = config
  
  // 判断点击位置
  if (x < rowHeaderWidth && y > colHeaderHeight) {
    // 点击行头
    const row = getRowAtY(y)
    menuState.targetRow = row
    menuState.targetCol = -1
    menuState.items = [
      { label: '在上方插入行', action: () => rowOperations.insertRowAbove(row) },
      { label: '在下方插入行', action: () => rowOperations.insertRowBelow(row) },
      { label: '删除行', action: () => rowOperations.deleteRow(row) },
      { label: '', action: () => {}, divider: true },
      { label: '设置行高...', action: () => rowOperations.showSetRowHeightDialog(row) }
    ]
    menuState.visible = true
  } else if (y < colHeaderHeight && x > rowHeaderWidth) {
    // 点击列头
    const col = getColAtX(x)
    menuState.targetRow = -1
    menuState.targetCol = col
    menuState.items = [
      { label: '在左侧插入列', action: () => colOperations.insertColLeft(col) },
      { label: '在右侧插入列', action: () => colOperations.insertColRight(col) },
      { label: '删除列', action: () => colOperations.deleteCol(col) },
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
