/**
 * 撤销/重做管理器
 * 支持任意的操作历史记录和状态恢复
 * 
 * 支持两种模式：
 * 1. 单 Sheet 模式：操作只在单个 Sheet 内有效
 * 2. 多 Sheet 模式：操作记录 sheetId，支持跨 Sheet 撤销/重做
 */

/** 受影响的区域信息 */
export interface AffectedRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export interface UndoRedoAction {
  name: string
  undo: () => void
  redo: () => void
  /** 操作所属的 Sheet ID（可选，用于多 Sheet 模式） */
  sheetId?: string
  /** 撤销后应选中的区域（可选） */
  undoSelection?: AffectedRange
  /** 重做后应选中的区域（可选） */
  redoSelection?: AffectedRange
}

export class UndoRedoManager {
  private undoStack: UndoRedoAction[] = []
  private redoStack: UndoRedoAction[] = []
  private maxHistorySize: number = 100
  /** 变化监听器列表 */
  private changeListeners: Array<() => void> = []

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize
  }

  /**
   * 添加变化监听器
   * 当撤销/重做栈变化时会调用
   * @returns 取消监听的函数
   */
  addChangeListener(listener: () => void): () => void {
    this.changeListeners.push(listener)
    return () => {
      this.removeChangeListener(listener)
    }
  }

  /**
   * 移除变化监听器
   */
  removeChangeListener(listener: () => void): void {
    const index = this.changeListeners.indexOf(listener)
    if (index !== -1) {
      this.changeListeners.splice(index, 1)
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyChange(): void {
    for (const listener of this.changeListeners) {
      listener()
    }
  }

  /**
   * 执行操作并记录到撤销栈
   */
  execute(action: UndoRedoAction): void {
    // 先执行 redo，这样当前状态就是执行后的状态
    action.redo()
    
    // 清空重做栈（因为有新操作）
    this.redoStack = []
    
    // 添加到撤销栈
    this.undoStack.push(action)
    
    // 限制历史大小
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }
    
    this.notifyChange()
  }

  /**
   * 只记录操作到撤销栈（不执行 redo）
   * 用于操作已经手动执行后的场景
   */
  record(action: UndoRedoAction): void {
    // 清空重做栈（因为有新操作）
    this.redoStack = []
    
    // 添加到撤销栈
    this.undoStack.push(action)
    
    // 限制历史大小
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }
    
    this.notifyChange()
  }

  /**
   * 撤销上一步操作
   * @returns 撤销的操作（包含 sheetId），如果没有可撤销的操作则返回 null
   */
  undo(): UndoRedoAction | null {
    if (this.undoStack.length === 0) return null
    
    const action = this.undoStack.pop()!
    action.undo()
    this.redoStack.push(action)
    
    this.notifyChange()
    return action
  }

  /**
   * 重做下一步操作
   * @returns 重做的操作（包含 sheetId），如果没有可重做的操作则返回 null
   */
  redo(): UndoRedoAction | null {
    if (this.redoStack.length === 0) return null
    
    const action = this.redoStack.pop()!
    action.redo()
    this.undoStack.push(action)
    
    this.notifyChange()
    return action
  }

  /**
   * 获取下一个要撤销的操作的 sheetId（不执行撤销）
   */
  peekUndoSheetId(): string | undefined {
    if (this.undoStack.length === 0) return undefined
    return this.undoStack[this.undoStack.length - 1]?.sheetId
  }

  /**
   * 获取下一个要重做的操作的 sheetId（不执行重做）
   */
  peekRedoSheetId(): string | undefined {
    if (this.redoStack.length === 0) return undefined
    return this.redoStack[this.redoStack.length - 1]?.sheetId
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * 获取撤销栈大小
   */
  getUndoCount(): number {
    return this.undoStack.length
  }

  /**
   * 获取重做栈大小
   */
  getRedoCount(): number {
    return this.redoStack.length
  }

  /**
   * 清空所有历史记录
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  /**
   * 获取撤销栈中最后一个操作的名称
   */
  getLastUndoName(): string | null {
    if (this.undoStack.length === 0) return null
    return this.undoStack[this.undoStack.length - 1]?.name ?? null
  }

  /**
   * 获取重做栈中最后一个操作的名称
   */
  getLastRedoName(): string | null {
    if (this.redoStack.length === 0) return null
    return this.redoStack[this.redoStack.length - 1]?.name ?? null
  }
}
