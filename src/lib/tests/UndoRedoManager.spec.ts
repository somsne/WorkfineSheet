/**
 * UndoRedoManager 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UndoRedoManager, type UndoRedoAction, type AffectedRange } from '../UndoRedoManager'

describe('UndoRedoManager', () => {
  let manager: UndoRedoManager

  beforeEach(() => {
    manager = new UndoRedoManager()
  })

  describe('基本操作', () => {
    it('初始状态应该没有可撤销/重做的操作', () => {
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(false)
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(0)
    })

    it('execute 应该执行操作并记录到撤销栈', () => {
      let value = 0
      const action: UndoRedoAction = {
        name: '设置值',
        undo: () => { value = 0 },
        redo: () => { value = 1 }
      }

      manager.execute(action)

      expect(value).toBe(1)
      expect(manager.canUndo()).toBe(true)
      expect(manager.canRedo()).toBe(false)
      expect(manager.getUndoCount()).toBe(1)
    })

    it('record 应该只记录操作，不执行 redo', () => {
      let value = 5
      const action: UndoRedoAction = {
        name: '设置值',
        undo: () => { value = 0 },
        redo: () => { value = 10 }
      }

      manager.record(action)

      expect(value).toBe(5) // 值不变
      expect(manager.canUndo()).toBe(true)
      expect(manager.getUndoCount()).toBe(1)
    })

    it('undo 应该执行撤销并移到重做栈', () => {
      let value = 0
      const action: UndoRedoAction = {
        name: '设置值',
        undo: () => { value = 0 },
        redo: () => { value = 1 }
      }

      manager.execute(action)
      expect(value).toBe(1)

      const undoneAction = manager.undo()

      expect(value).toBe(0)
      expect(undoneAction).toBe(action)
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(true)
      expect(manager.getRedoCount()).toBe(1)
    })

    it('redo 应该执行重做并移到撤销栈', () => {
      let value = 0
      const action: UndoRedoAction = {
        name: '设置值',
        undo: () => { value = 0 },
        redo: () => { value = 1 }
      }

      manager.execute(action)
      manager.undo()
      expect(value).toBe(0)

      const redoneAction = manager.redo()

      expect(value).toBe(1)
      expect(redoneAction).toBe(action)
      expect(manager.canUndo()).toBe(true)
      expect(manager.canRedo()).toBe(false)
    })

    it('新操作应该清空重做栈', () => {
      manager.execute({
        name: '操作1',
        undo: () => {},
        redo: () => {}
      })
      manager.undo()
      expect(manager.canRedo()).toBe(true)

      // 执行新操作
      manager.execute({
        name: '操作2',
        undo: () => {},
        redo: () => {}
      })

      expect(manager.canRedo()).toBe(false)
      expect(manager.getRedoCount()).toBe(0)
    })

    it('空栈时 undo 应该返回 null', () => {
      expect(manager.undo()).toBeNull()
    })

    it('空栈时 redo 应该返回 null', () => {
      expect(manager.redo()).toBeNull()
    })
  })

  describe('操作名称', () => {
    it('getLastUndoName 应该返回最后一个操作的名称', () => {
      manager.execute({
        name: '操作A',
        undo: () => {},
        redo: () => {}
      })
      manager.execute({
        name: '操作B',
        undo: () => {},
        redo: () => {}
      })

      expect(manager.getLastUndoName()).toBe('操作B')
    })

    it('getLastRedoName 应该返回最后一个重做操作的名称', () => {
      manager.execute({
        name: '操作A',
        undo: () => {},
        redo: () => {}
      })
      manager.undo()

      expect(manager.getLastRedoName()).toBe('操作A')
    })

    it('空栈时 getLastUndoName 应该返回 null', () => {
      expect(manager.getLastUndoName()).toBeNull()
    })

    it('空栈时 getLastRedoName 应该返回 null', () => {
      expect(manager.getLastRedoName()).toBeNull()
    })
  })

  describe('历史大小限制', () => {
    it('应该限制撤销栈大小', () => {
      const smallManager = new UndoRedoManager(3)

      for (let i = 0; i < 5; i++) {
        smallManager.execute({
          name: `操作${i}`,
          undo: () => {},
          redo: () => {}
        })
      }

      expect(smallManager.getUndoCount()).toBe(3)
      expect(smallManager.getLastUndoName()).toBe('操作4')
    })
  })

  describe('clear 方法', () => {
    it('应该清空所有历史', () => {
      manager.execute({
        name: '操作1',
        undo: () => {},
        redo: () => {}
      })
      manager.execute({
        name: '操作2',
        undo: () => {},
        redo: () => {}
      })
      manager.undo()

      manager.clear()

      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(false)
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(0)
    })
  })

  describe('变化监听器', () => {
    it('execute 应该触发变化通知', () => {
      const listener = vi.fn()
      manager.addChangeListener(listener)

      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {}
      })

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('record 应该触发变化通知', () => {
      const listener = vi.fn()
      manager.addChangeListener(listener)

      manager.record({
        name: '操作',
        undo: () => {},
        redo: () => {}
      })

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('undo 应该触发变化通知', () => {
      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {}
      })

      const listener = vi.fn()
      manager.addChangeListener(listener)
      manager.undo()

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('redo 应该触发变化通知', () => {
      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {}
      })
      manager.undo()

      const listener = vi.fn()
      manager.addChangeListener(listener)
      manager.redo()

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('应该可以移除监听器', () => {
      const listener = vi.fn()
      const unsubscribe = manager.addChangeListener(listener)

      unsubscribe()

      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {}
      })

      expect(listener).not.toHaveBeenCalled()
    })

    it('removeChangeListener 应该移除监听器', () => {
      const listener = vi.fn()
      manager.addChangeListener(listener)
      manager.removeChangeListener(listener)

      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {}
      })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('多 Sheet 支持', () => {
    it('execute 应该记录 sheetId', () => {
      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_1'
      })

      expect(manager.peekUndoSheetId()).toBe('sheet_1')
    })

    it('peekUndoSheetId 应该返回下一个要撤销操作的 sheetId', () => {
      manager.execute({
        name: '操作1',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_1'
      })
      manager.execute({
        name: '操作2',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_2'
      })

      expect(manager.peekUndoSheetId()).toBe('sheet_2')
    })

    it('peekRedoSheetId 应该返回下一个要重做操作的 sheetId', () => {
      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_1'
      })
      manager.undo()

      expect(manager.peekRedoSheetId()).toBe('sheet_1')
    })

    it('空栈时 peekUndoSheetId 应该返回 undefined', () => {
      expect(manager.peekUndoSheetId()).toBeUndefined()
    })

    it('空栈时 peekRedoSheetId 应该返回 undefined', () => {
      expect(manager.peekRedoSheetId()).toBeUndefined()
    })

    it('撤销后应该更新 peekUndoSheetId', () => {
      manager.execute({
        name: '操作1',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_1'
      })
      manager.execute({
        name: '操作2',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_2'
      })

      manager.undo() // 撤销 sheet_2 的操作

      expect(manager.peekUndoSheetId()).toBe('sheet_1')
      expect(manager.peekRedoSheetId()).toBe('sheet_2')
    })
  })

  describe('选区信息支持', () => {
    it('execute 应该记录 undoSelection 和 redoSelection', () => {
      const undoSelection: AffectedRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }
      const redoSelection: AffectedRange = { startRow: 1, startCol: 1, endRow: 1, endCol: 1 }

      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {},
        undoSelection,
        redoSelection
      })

      const action = manager.undo()
      expect(action?.undoSelection).toEqual(undoSelection)
      expect(action?.redoSelection).toEqual(redoSelection)
    })

    it('undo 返回的操作应该包含选区信息', () => {
      const undoSelection: AffectedRange = { startRow: 5, startCol: 3, endRow: 5, endCol: 3 }

      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_1',
        undoSelection
      })

      const action = manager.undo()

      expect(action).not.toBeNull()
      expect(action?.sheetId).toBe('sheet_1')
      expect(action?.undoSelection).toEqual(undoSelection)
    })

    it('redo 返回的操作应该包含选区信息', () => {
      const redoSelection: AffectedRange = { startRow: 10, startCol: 5, endRow: 12, endCol: 8 }

      manager.execute({
        name: '操作',
        undo: () => {},
        redo: () => {},
        sheetId: 'sheet_2',
        redoSelection
      })
      manager.undo()

      const action = manager.redo()

      expect(action).not.toBeNull()
      expect(action?.sheetId).toBe('sheet_2')
      expect(action?.redoSelection).toEqual(redoSelection)
    })
  })

  describe('复杂操作序列', () => {
    it('应该正确处理多次撤销和重做', () => {
      let value = 0
      
      manager.execute({
        name: '设置为1',
        undo: () => { value = 0 },
        redo: () => { value = 1 }
      })
      manager.execute({
        name: '设置为2',
        undo: () => { value = 1 },
        redo: () => { value = 2 }
      })
      manager.execute({
        name: '设置为3',
        undo: () => { value = 2 },
        redo: () => { value = 3 }
      })

      expect(value).toBe(3)

      manager.undo() // 3 -> 2
      expect(value).toBe(2)

      manager.undo() // 2 -> 1
      expect(value).toBe(1)

      manager.redo() // 1 -> 2
      expect(value).toBe(2)

      manager.undo() // 2 -> 1
      manager.undo() // 1 -> 0
      expect(value).toBe(0)

      manager.redo() // 0 -> 1
      manager.redo() // 1 -> 2
      manager.redo() // 2 -> 3
      expect(value).toBe(3)

      // 再撤销后新操作，重做栈应该被清空
      manager.undo() // 3 -> 2
      manager.execute({
        name: '设置为10',
        undo: () => { value = 2 },
        redo: () => { value = 10 }
      })
      expect(value).toBe(10)
      expect(manager.canRedo()).toBe(false)
    })

    it('应该正确处理跨 Sheet 操作序列', () => {
      const values: Record<string, number> = {
        sheet_1: 0,
        sheet_2: 0
      }

      manager.execute({
        name: 'Sheet1 操作',
        undo: () => { values.sheet_1 = 0 },
        redo: () => { values.sheet_1 = 1 },
        sheetId: 'sheet_1',
        undoSelection: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }
      })

      manager.execute({
        name: 'Sheet2 操作',
        undo: () => { values.sheet_2 = 0 },
        redo: () => { values.sheet_2 = 1 },
        sheetId: 'sheet_2',
        undoSelection: { startRow: 1, startCol: 1, endRow: 1, endCol: 1 }
      })

      expect(values.sheet_1).toBe(1)
      expect(values.sheet_2).toBe(1)

      // 撤销 Sheet2 操作
      let action = manager.undo()
      expect(action?.sheetId).toBe('sheet_2')
      expect(values.sheet_2).toBe(0)
      expect(values.sheet_1).toBe(1)

      // 撤销 Sheet1 操作
      action = manager.undo()
      expect(action?.sheetId).toBe('sheet_1')
      expect(values.sheet_1).toBe(0)

      // 重做 Sheet1 操作
      action = manager.redo()
      expect(action?.sheetId).toBe('sheet_1')
      expect(values.sheet_1).toBe(1)
    })
  })
})
