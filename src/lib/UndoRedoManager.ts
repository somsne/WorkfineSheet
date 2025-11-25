/**
 * 撤销/重做管理器
 * 支持任意的操作历史记录和状态恢复
 */

interface UndoRedoAction {
  name: string
  undo: () => void
  redo: () => void
}

export class UndoRedoManager {
  private undoStack: UndoRedoAction[] = []
  private redoStack: UndoRedoAction[] = []
  private maxHistorySize: number = 100

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize
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
  }

  /**
   * 撤销上一步操作
   */
  undo(): boolean {
    if (this.undoStack.length === 0) return false
    
    const action = this.undoStack.pop()!
    action.undo()
    this.redoStack.push(action)
    
    return true
  }

  /**
   * 重做下一步操作
   */
  redo(): boolean {
    if (this.redoStack.length === 0) return false
    
    const action = this.redoStack.pop()!
    action.redo()
    this.undoStack.push(action)
    
    return true
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
