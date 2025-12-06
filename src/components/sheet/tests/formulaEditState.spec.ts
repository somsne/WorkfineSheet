import { describe, it, expect, beforeEach } from 'vitest'
import {
  createFormulaEditStateManager,
  isInSelectablePosition,
  findReferenceToReplace,
  insertOrReplaceReference,
  formatCrossSheetReference,
  getCellAddress,
  findPartialReferenceBeforeCursor,
  parseCellReference
} from '../formulaEditState'

describe('formulaEditState - 辅助函数', () => {
  describe('getCellAddress', () => {
    it('应该正确生成单元格地址', () => {
      expect(getCellAddress(0, 0)).toBe('A1')
      expect(getCellAddress(0, 1)).toBe('B1')
      expect(getCellAddress(1, 0)).toBe('A2')
      expect(getCellAddress(9, 25)).toBe('Z10')
    })

    it('应该正确处理多字母列', () => {
      expect(getCellAddress(0, 26)).toBe('AA1')
      expect(getCellAddress(0, 27)).toBe('AB1')
      expect(getCellAddress(0, 51)).toBe('AZ1')
      expect(getCellAddress(0, 52)).toBe('BA1')
    })
  })

  describe('isInSelectablePosition', () => {
    it('非公式返回 false', () => {
      expect(isInSelectablePosition('hello', 5)).toBe(false)
      expect(isInSelectablePosition('123', 2)).toBe(false)
    })

    it('空值或无效光标返回 false', () => {
      expect(isInSelectablePosition('', 0)).toBe(false)
      expect(isInSelectablePosition('=', 0)).toBe(false)
      expect(isInSelectablePosition('=', -1)).toBe(false)
    })

    it('等号后可选择', () => {
      expect(isInSelectablePosition('=', 1)).toBe(true)
      expect(isInSelectablePosition('= ', 2)).toBe(true)
    })

    it('操作符后可选择', () => {
      expect(isInSelectablePosition('=A1+', 4)).toBe(true)
      expect(isInSelectablePosition('=A1-', 4)).toBe(true)
      expect(isInSelectablePosition('=A1*', 4)).toBe(true)
      expect(isInSelectablePosition('=A1/', 4)).toBe(true)
      expect(isInSelectablePosition('=SUM(', 5)).toBe(true)
      expect(isInSelectablePosition('=A1,', 4)).toBe(true)
    })

    it('引用后可选择（部分引用视为继续输入）', () => {
      // 当前实现：A1 等引用视为继续输入状态，允许用鼠标点击选择覆盖
      // 这是设计选择：光标在引用后时，点击其他单元格会替换该引用
      expect(isInSelectablePosition('=A1', 3)).toBe(true)
      // 函数名后也是可选择的（可以继续输入括号或其他）
      expect(isInSelectablePosition('=SUM', 4)).toBe(true)
    })

    it('引用输入中可选择（部分引用）', () => {
      expect(isInSelectablePosition('=A', 2)).toBe(true)
      expect(isInSelectablePosition('=AB', 3)).toBe(true)
      expect(isInSelectablePosition('=$A', 3)).toBe(true)
    })
  })

  describe('findReferenceToReplace', () => {
    it('非公式返回 null', () => {
      expect(findReferenceToReplace('A1', 1)).toBeNull()
    })

    it('找到光标位置的引用', () => {
      const result = findReferenceToReplace('=A1+B2', 3)
      expect(result).toEqual({ start: 1, end: 3, ref: 'A1' })
    })

    it('找到光标在引用末尾的情况', () => {
      const result = findReferenceToReplace('=A1', 3)
      expect(result).toEqual({ start: 1, end: 3, ref: 'A1' })
    })

    it('找到范围引用', () => {
      const result = findReferenceToReplace('=SUM(A1:B2)', 9)
      expect(result).toEqual({ start: 5, end: 10, ref: 'A1:B2' })
    })

    it('光标在操作符位置找到后面的引用', () => {
      // 光标位置 4 是 B2 引用的起始位置，会找到 B2
      const result = findReferenceToReplace('=A1+B2', 4)
      expect(result).toEqual({ start: 4, end: 6, ref: 'B2' })
    })

    it('找到跨 Sheet 引用', () => {
      // "=Sheet2!A1+B2" 中，Sheet2!A1 是从索引 1 到 10 (不含 10)
      const result = findReferenceToReplace("=Sheet2!A1+B2", 5)
      expect(result).toEqual({ start: 1, end: 10, ref: 'Sheet2!A1' })
    })

    it('找到带引号的跨 Sheet 引用', () => {
      // "='Sheet 2'!A1+B2" 中，'Sheet 2'!A1 是从索引 1 到 13 (不含 13)
      const result = findReferenceToReplace("='Sheet 2'!A1+B2", 8)
      expect(result).toEqual({ start: 1, end: 13, ref: "'Sheet 2'!A1" })
    })
  })

  describe('insertOrReplaceReference', () => {
    it('在光标位置插入引用', () => {
      const result = insertOrReplaceReference('=', 1, null, 'A1')
      expect(result.newValue).toBe('=A1')
      expect(result.newCursorPos).toBe(3)
    })

    it('替换选中的文本', () => {
      const result = insertOrReplaceReference('=A1+B2', 1, { start: 1, end: 3 }, 'C3')
      expect(result.newValue).toBe('=C3+B2')
      expect(result.newCursorPos).toBe(3)
    })

    it('在操作符后插入', () => {
      const result = insertOrReplaceReference('=A1+', 4, null, 'B2')
      expect(result.newValue).toBe('=A1+B2')
      expect(result.newCursorPos).toBe(6)
    })
  })

  describe('formatCrossSheetReference', () => {
    it('生成简单的跨 Sheet 引用', () => {
      expect(formatCrossSheetReference('Sheet2', 0, 0)).toBe('Sheet2!A1')
      expect(formatCrossSheetReference('Sheet2', 1, 1)).toBe('Sheet2!B2')
    })

    it('包含空格的 Sheet 名需要引号', () => {
      expect(formatCrossSheetReference('My Sheet', 0, 0)).toBe("'My Sheet'!A1")
    })

    it('包含特殊字符的 Sheet 名需要引号', () => {
      expect(formatCrossSheetReference("Sheet's", 0, 0)).toBe("'Sheet''s'!A1")
      expect(formatCrossSheetReference('Sheet!1', 0, 0)).toBe("'Sheet!1'!A1")
    })

    it('生成范围引用', () => {
      expect(formatCrossSheetReference('Sheet2', 0, 0, 2, 2)).toBe('Sheet2!A1:C3')
    })

    it('单单元格范围不生成范围格式', () => {
      expect(formatCrossSheetReference('Sheet2', 0, 0, 0, 0)).toBe('Sheet2!A1')
    })
  })
})

describe('formulaEditState - FormulaEditManager', () => {
  let manager: ReturnType<typeof createFormulaEditStateManager>

  beforeEach(() => {
    manager = createFormulaEditStateManager()
  })

  describe('初始状态', () => {
    it('应该处于非活跃状态', () => {
      expect(manager.state.active).toBe(false)
      expect(manager.state.source).toBeNull()
    })
  })

  describe('startEdit', () => {
    it('应该正确设置单元格编辑状态', () => {
      manager.startEdit({
        source: 'cell',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'hello',
        mode: 'edit'
      })

      expect(manager.state.active).toBe(true)
      expect(manager.state.source).toBe('cell')
      expect(manager.state.sourceSheetId).toBe('sheet1')
      expect(manager.state.row).toBe(0)
      expect(manager.state.col).toBe(0)
      expect(manager.state.currentValue).toBe('hello')
      expect(manager.state.isFormulaMode).toBe(false)
    })

    it('应该正确设置公式栏编辑状态', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: '=A1+B1',
        mode: 'edit'
      })

      expect(manager.state.active).toBe(true)
      expect(manager.state.source).toBe('formulaBar')
      expect(manager.state.isFormulaMode).toBe(true)
      expect(manager.state.formulaReferences.length).toBeGreaterThan(0)
    })

    it('typing 模式应该保留原值但标记为 typing', () => {
      manager.startEdit({
        source: 'cell',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'original',
        mode: 'typing'
      })

      expect(manager.state.mode).toBe('typing')
      expect(manager.state.originalValue).toBe('original')
      expect(manager.state.currentValue).toBe('original')
    })
  })

  describe('updateValue', () => {
    beforeEach(() => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })
    })

    it('应该更新值和光标位置', () => {
      manager.updateValue('=A1', 3)

      expect(manager.state.currentValue).toBe('=A1')
      expect(manager.state.cursorPosition).toBe(3)
    })

    it('应该更新公式模式标记', () => {
      manager.updateValue('hello')
      expect(manager.state.isFormulaMode).toBe(false)

      manager.updateValue('=SUM(A1)')
      expect(manager.state.isFormulaMode).toBe(true)
    })

    it('应该更新公式引用', () => {
      manager.updateValue('=A1+B2', 6)
      expect(manager.state.formulaReferences.length).toBe(2)
    })

    it('应该更新可选择状态', () => {
      manager.updateValue('=A1+', 4)
      expect(manager.state.isInSelectableState).toBe(true)

      // 当前实现：光标在引用后面也是可选择的（可以替换引用）
      manager.updateValue('=A1+B2', 6)
      expect(manager.state.isInSelectableState).toBe(true)
    })
  })

  describe('updateCursorPosition', () => {
    beforeEach(() => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1+B2',
        mode: 'edit'
      })
    })

    it('应该更新光标位置', () => {
      manager.updateCursorPosition(3)
      expect(manager.state.cursorPosition).toBe(3)
    })

    it('应该更新选择范围', () => {
      manager.updateCursorPosition(3, { start: 1, end: 3 })
      expect(manager.state.selectionRange).toEqual({ start: 1, end: 3 })
      expect(manager.state.hasTextSelection).toBe(true)
    })

    it('应该根据光标位置更新可选择状态', () => {
      manager.updateCursorPosition(4) // 在 + 号后
      expect(manager.state.isInSelectableState).toBe(true)

      // 当前实现：光标在引用内/后也是可选择的
      manager.updateCursorPosition(3) // 在 A1 后
      expect(manager.state.isInSelectableState).toBe(true)
    })
  })

  describe('insertReference', () => {
    beforeEach(() => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })
    })

    it('应该插入引用', () => {
      const result = manager.insertReference('A1')

      expect(result).not.toBeNull()
      expect(result!.newValue).toBe('=A1')
      expect(manager.state.currentValue).toBe('=A1')
    })

    it('未在公式模式应该返回 null', () => {
      manager.updateValue('hello')
      const result = manager.insertReference('A1')
      expect(result).toBeNull()
    })
  })

  describe('confirmEdit', () => {
    it('应该返回编辑结果并重置状态', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: '=A1',
        mode: 'edit'
      })
      manager.updateValue('=A1+B1')

      const result = manager.confirmEdit()

      expect(result).toEqual({
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: '=A1+B1'
      })
      expect(manager.state.active).toBe(false)
    })

    it('未在编辑时返回 null', () => {
      const result = manager.confirmEdit()
      expect(result).toBeNull()
    })
  })

  describe('cancelEdit', () => {
    it('应该返回原始值并重置状态', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: '=A1',
        mode: 'edit'
      })
      manager.updateValue('=A1+B1')

      const result = manager.cancelEdit()

      expect(result).toEqual({
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: '=A1'  // 原始值
      })
      expect(manager.state.active).toBe(false)
    })

    it('未在编辑时返回 null', () => {
      const result = manager.cancelEdit()
      expect(result).toBeNull()
    })
  })

  describe('reset', () => {
    it('应该重置所有状态', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: '=A1+B1',
        mode: 'edit'
      })

      manager.reset()

      expect(manager.state.active).toBe(false)
      expect(manager.state.source).toBeNull()
      expect(manager.state.sourceSheetId).toBeNull()
      expect(manager.state.currentValue).toBe('')
      expect(manager.state.formulaReferences).toEqual([])
    })
  })

  describe('switchSheet', () => {
    it('应该更新当前 Sheet ID', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })

      manager.switchSheet('sheet2')

      expect(manager.state.currentSheetId).toBe('sheet2')
      expect(manager.state.sourceSheetId).toBe('sheet1')
    })
  })

  describe('switchSource', () => {
    it('应该更新编辑来源', () => {
      manager.startEdit({
        source: 'cell',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1',
        mode: 'edit'
      })

      expect(manager.state.source).toBe('cell')

      manager.switchSource('formulaBar')
      expect(manager.state.source).toBe('formulaBar')

      manager.switchSource('cell')
      expect(manager.state.source).toBe('cell')
    })

    it('未在编辑时不应更新', () => {
      manager.switchSource('formulaBar')
      expect(manager.state.source).toBeNull()
    })
  })

  describe('isCrossSheetMode 计算属性', () => {
    it('未编辑时应为 false', () => {
      expect(manager.isCrossSheetMode.value).toBe(false)
    })

    it('在源 Sheet 编辑时应为 false', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })
      expect(manager.isCrossSheetMode.value).toBe(false)
    })

    it('切换到其他 Sheet 时应为 true', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })
      
      manager.switchSheet('sheet2')
      expect(manager.isCrossSheetMode.value).toBe(true)
    })

    it('切回源 Sheet 时应为 false', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })
      
      manager.switchSheet('sheet2')
      expect(manager.isCrossSheetMode.value).toBe(true)
      
      manager.switchSheet('sheet1')
      expect(manager.isCrossSheetMode.value).toBe(false)
    })
  })

  describe('shouldInsertReference 计算属性', () => {
    it('未编辑时应为 false', () => {
      expect(manager.shouldInsertReference.value).toBe(false)
    })

    it('非公式模式应为 false', () => {
      manager.startEdit({
        source: 'cell',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'hello',
        mode: 'edit'
      })
      expect(manager.shouldInsertReference.value).toBe(false)
    })

    it('公式模式且光标在可选择位置应为 true', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })
      // 光标在 = 后面
      expect(manager.shouldInsertReference.value).toBe(true)
    })

    it('光标在操作符后应为 true', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1+',
        mode: 'edit'
      })
      expect(manager.shouldInsertReference.value).toBe(true)
    })

    it('跨 Sheet 模式下应该正确判断', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=SUM(',
        mode: 'edit'
      })
      
      manager.switchSheet('sheet2')
      // 跨 Sheet 且光标在 ( 后面
      expect(manager.isCrossSheetMode.value).toBe(true)
      expect(manager.shouldInsertReference.value).toBe(true)
    })
  })
})

describe('formulaEditState - findPartialReferenceBeforeCursor', () => {
  it('非公式返回 null', () => {
    expect(findPartialReferenceBeforeCursor('hello', 5)).toBeNull()
  })

  it('光标在开头返回 null', () => {
    expect(findPartialReferenceBeforeCursor('=', 0)).toBeNull()
  })

  it('找到部分列引用', () => {
    const result = findPartialReferenceBeforeCursor('=A', 2)
    expect(result).toEqual({ start: 1, partial: 'A' })
  })

  it('找到部分单元格引用', () => {
    const result = findPartialReferenceBeforeCursor('=A1', 3)
    expect(result).toEqual({ start: 1, partial: 'A1' })
  })

  it('在操作符后找到部分引用', () => {
    const result = findPartialReferenceBeforeCursor('=A1+B', 5)
    expect(result).toEqual({ start: 4, partial: 'B' })
  })

  it('在函数括号后找到部分引用', () => {
    const result = findPartialReferenceBeforeCursor('=SUM(A', 6)
    expect(result).toEqual({ start: 5, partial: 'A' })
  })

  it('空白后无部分引用', () => {
    const result = findPartialReferenceBeforeCursor('=SUM( ', 6)
    expect(result).toBeNull()
  })

  it('找到带$的部分引用', () => {
    const result = findPartialReferenceBeforeCursor('=$A', 3)
    expect(result).toEqual({ start: 1, partial: '$A' })
  })
})

describe('formulaEditState - parseCellReference', () => {
  it('空字符串返回 null', () => {
    expect(parseCellReference('')).toBeNull()
  })

  it('无效引用返回 null', () => {
    expect(parseCellReference('hello')).toBeNull()
    expect(parseCellReference('123')).toBeNull()
    expect(parseCellReference('=')).toBeNull()
  })

  it('解析简单单元格引用', () => {
    const result = parseCellReference('A1')
    expect(result).toEqual({ startRow: 0, startCol: 0 })
  })

  it('解析大列号引用', () => {
    const result = parseCellReference('Z10')
    expect(result).toEqual({ startRow: 9, startCol: 25 })
  })

  it('解析多字母列引用', () => {
    const result = parseCellReference('AA1')
    expect(result).toEqual({ startRow: 0, startCol: 26 })
  })

  it('解析带绝对引用符号的引用', () => {
    expect(parseCellReference('$A$1')).toEqual({ startRow: 0, startCol: 0 })
    expect(parseCellReference('$A1')).toEqual({ startRow: 0, startCol: 0 })
    expect(parseCellReference('A$1')).toEqual({ startRow: 0, startCol: 0 })
  })

  it('解析范围引用', () => {
    const result = parseCellReference('A1:B3')
    expect(result).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 1
    })
  })

  it('解析跨 Sheet 简单引用', () => {
    const result = parseCellReference('Sheet2!A1')
    expect(result).toEqual({
      sheetName: 'Sheet2',
      startRow: 0,
      startCol: 0
    })
  })

  it('解析跨 Sheet 范围引用', () => {
    const result = parseCellReference('Sheet2!A1:B3')
    expect(result).toEqual({
      sheetName: 'Sheet2',
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 1
    })
  })

  it('解析带引号的 Sheet 名称', () => {
    const result = parseCellReference("'Sheet 2'!A1")
    expect(result).toEqual({
      sheetName: 'Sheet 2',
      startRow: 0,
      startCol: 0
    })
  })

  it('解析中文 Sheet 名称', () => {
    const result = parseCellReference('格式示例!A1')
    expect(result).toEqual({
      sheetName: '格式示例',
      startRow: 0,
      startCol: 0
    })
  })

  it('解析带引号的中文 Sheet 名称', () => {
    const result = parseCellReference("'格式 示例'!A1")
    expect(result).toEqual({
      sheetName: '格式 示例',
      startRow: 0,
      startCol: 0
    })
  })

  it('解析小写列名（大小写不敏感）', () => {
    const result = parseCellReference('a1')
    expect(result).toEqual({ startRow: 0, startCol: 0 })
  })

  it('解析跨 Sheet 带绝对引用的范围', () => {
    const result = parseCellReference("'My Data'!$A$1:$C$10")
    expect(result).toEqual({
      sheetName: 'My Data',
      startRow: 0,
      startCol: 0,
      endRow: 9,
      endCol: 2
    })
  })
})
