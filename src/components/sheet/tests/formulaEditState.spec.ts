import { describe, it, expect, beforeEach } from 'vitest'
import {
  createFormulaEditStateManager,
  isInSelectablePosition,
  findReferenceToReplace,
  insertOrReplaceReference,
  formatCrossSheetReference,
  getCellAddress
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

  describe('switchSource', () => {
    it('应该切换编辑源但保留其他状态', () => {
      manager.startEdit({
        source: 'cell',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1+B1',
        mode: 'edit'
      })
      manager.updateValue('=A1+B1+C1')

      manager.switchSource('formulaBar')

      expect(manager.state.source).toBe('formulaBar')
      expect(manager.state.currentValue).toBe('=A1+B1+C1')
      expect(manager.state.row).toBe(0)
      expect(manager.state.col).toBe(0)
    })

    it('未在编辑时应该忽略切换', () => {
      manager.switchSource('formulaBar')
      expect(manager.state.source).toBeNull()
    })

    it('相同源应该忽略切换', () => {
      manager.startEdit({
        source: 'cell',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'test',
        mode: 'edit'
      })

      manager.switchSource('cell')
      expect(manager.state.source).toBe('cell')
    })
  })

  describe('isCrossSheetMode', () => {
    it('非活跃状态返回 false', () => {
      expect(manager.isCrossSheetMode('sheet1')).toBe(false)
    })

    it('单元格编辑返回 false', () => {
      manager.startEdit({
        source: 'cell',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1',
        mode: 'edit'
      })

      expect(manager.isCrossSheetMode('sheet2')).toBe(false)
    })

    it('公式栏编辑非公式返回 false', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'hello',
        mode: 'edit'
      })

      expect(manager.isCrossSheetMode('sheet2')).toBe(false)
    })

    it('公式栏编辑公式且不同 Sheet 返回 true', () => {
      manager.startEdit({
        source: 'formulaBar',
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })

      expect(manager.isCrossSheetMode('sheet1')).toBe(false)
      expect(manager.isCrossSheetMode('sheet2')).toBe(true)
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

  describe('insertCrossSheetReference', () => {
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

    it('应该插入跨 Sheet 引用', () => {
      const result = manager.insertCrossSheetReference('Sheet2', 0, 0)

      expect(result).not.toBeNull()
      expect(result!.newValue).toBe('=Sheet2!A1')
      expect(manager.state.currentValue).toBe('=Sheet2!A1')
    })

    it('应该插入带范围的跨 Sheet 引用', () => {
      const result = manager.insertCrossSheetReference('Sheet2', 0, 0, 2, 2)

      expect(result).not.toBeNull()
      expect(result!.newValue).toBe('=Sheet2!A1:C3')
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

  // ==================== 统一动作流程测试 ====================

  describe('actionStartCellEdit', () => {
    it('应该启动单元格编辑并返回打开 overlay 的动作', () => {
      const result = manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: 'hello',
        mode: 'edit'
      })

      expect(result.success).toBe(true)
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0]).toEqual({
        type: 'openOverlay',
        row: 1,
        col: 2,
        value: 'hello'
      })
      expect(manager.state.active).toBe(true)
      expect(manager.state.source).toBe('cell')
    })
  })

  describe('actionStartFormulaBarEdit', () => {
    it('应该启动公式栏编辑并返回打开 overlay 和聚焦公式栏的动作', () => {
      const result = manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1'
      })

      expect(result.success).toBe(true)
      expect(result.actions).toHaveLength(2)
      expect(result.actions[0]).toEqual({
        type: 'openOverlay',
        row: 0,
        col: 0,
        value: '=A1'
      })
      expect(result.actions[1]).toEqual({ type: 'focusFormulaBar' })
      expect(manager.state.active).toBe(true)
      expect(manager.state.source).toBe('formulaBar')
    })

    it('从单元格编辑切换到公式栏时应该返回聚焦公式栏的动作', () => {
      // 先启动单元格编辑
      manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1',
        mode: 'edit'
      })

      // 切换到公式栏
      const result = manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1'
      })

      expect(result.success).toBe(true)
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0]).toEqual({ type: 'focusFormulaBar' })
      expect(manager.state.source).toBe('formulaBar')
    })
  })

  describe('actionSwitchToFormulaBar', () => {
    it('单元格编辑时应该切换到公式栏', () => {
      manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'test',
        mode: 'edit'
      })

      const result = manager.actionSwitchToFormulaBar()

      expect(result.success).toBe(true)
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0]).toEqual({ type: 'focusFormulaBar' })
      expect(manager.state.source).toBe('formulaBar')
    })

    it('未在编辑时应该返回失败', () => {
      const result = manager.actionSwitchToFormulaBar()

      expect(result.success).toBe(false)
      expect(result.actions).toHaveLength(0)
    })

    it('已在公式栏编辑时应该返回成功但无动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'test'
      })

      const result = manager.actionSwitchToFormulaBar()

      expect(result.success).toBe(true)
      expect(result.actions).toHaveLength(0)
    })
  })

  describe('actionInput', () => {
    it('公式栏编辑时应该返回同步 overlay 的动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })

      const result = manager.actionInput('=A1', 3)

      expect(result.success).toBe(true)
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0]).toEqual({
        type: 'syncOverlayValue',
        value: '=A1'
      })
      expect(manager.state.currentValue).toBe('=A1')
      expect(manager.state.cursorPosition).toBe(3)
    })

    it('单元格编辑时应该返回空动作列表', () => {
      manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '',
        mode: 'typing'
      })

      const result = manager.actionInput('hello', 5)

      expect(result.success).toBe(true)
      expect(result.actions).toHaveLength(0)
      expect(manager.state.currentValue).toBe('hello')
    })

    it('未在编辑时应该返回失败', () => {
      const result = manager.actionInput('test', 4)

      expect(result.success).toBe(false)
      expect(result.actions).toHaveLength(0)
    })
  })

  describe('actionConfirm', () => {
    it('公式栏编辑时应该返回保存数据和关闭 overlay 的动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: 'original'
      })
      manager.actionInput('new value', 9)

      const result = manager.actionConfirm()

      expect(result.success).toBe(true)
      expect(result.saveData).toEqual({
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: 'new value'
      })
      expect(result.actions).toContainEqual({ type: 'setCellValue', row: 1, col: 2, value: 'new value' })
      expect(result.actions).toContainEqual({ type: 'closeOverlay' })
      expect(manager.state.active).toBe(false)
    })

    it('跨 Sheet 编辑时应该返回切换 Sheet 的动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })
      manager.switchSheet('sheet2')

      const result = manager.actionConfirm()

      expect(result.success).toBe(true)
      expect(result.actions[0]).toEqual({ type: 'switchSheet', sheetId: 'sheet1' })
    })

    it('未在编辑时应该返回失败', () => {
      const result = manager.actionConfirm()

      expect(result.success).toBe(false)
    })
  })

  describe('actionConfirmAndMoveRight', () => {
    it('应该返回确认动作和移动到右边的动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 2,
        value: 'test'
      })

      const result = manager.actionConfirmAndMoveRight()

      expect(result.success).toBe(true)
      expect(result.actions).toContainEqual({ type: 'selectCell', row: 0, col: 3 })
    })
  })

  describe('actionCancel', () => {
    it('应该返回恢复数据和关闭 overlay 的动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: 'original'
      })
      manager.actionInput('changed', 7)

      const result = manager.actionCancel()

      expect(result.success).toBe(true)
      expect(result.restoreData).toEqual({
        sheetId: 'sheet1',
        row: 1,
        col: 2,
        value: 'original'
      })
      expect(result.actions).toContainEqual({ type: 'closeOverlay' })
      expect(result.actions).toContainEqual({ 
        type: 'updateFormulaBarDisplay', 
        row: 1, 
        col: 2, 
        value: 'original' 
      })
      expect(manager.state.active).toBe(false)
    })

    it('跨 Sheet 编辑时应该返回切换回源 Sheet 的动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })
      manager.switchSheet('sheet2')

      const result = manager.actionCancel()

      expect(result.success).toBe(true)
      expect(result.actions[0]).toEqual({ type: 'switchSheet', sheetId: 'sheet1' })
    })

    it('未在编辑时应该返回失败', () => {
      const result = manager.actionCancel()

      expect(result.success).toBe(false)
    })
  })

  describe('actionBlurConfirm', () => {
    it('普通编辑时应该确认', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'test'
      })

      const result = manager.actionBlurConfirm()

      expect(result.success).toBe(true)
      expect(manager.state.active).toBe(false)
    })

    it('公式模式可选择状态时应该忽略', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })
      // 此时 isFormulaMode=true, isInSelectableState=true

      const result = manager.actionBlurConfirm()

      expect(result.success).toBe(false)
      expect(manager.state.active).toBe(true)  // 仍在编辑
    })

    it('未在编辑时应该返回失败', () => {
      const result = manager.actionBlurConfirm()

      expect(result.success).toBe(false)
    })
  })

  describe('actionSelectionChange', () => {
    it('公式栏公式模式可插入时应该插入引用并返回同步动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })

      const result = manager.actionSelectionChange(
        'sheet1',
        { row: 2, col: 3 },
        { startRow: 2, startCol: 3, endRow: 2, endCol: 3 },
        () => 'Sheet1'
      )

      expect(result.consumed).toBe(true)
      expect(result.actions).toHaveLength(1)
      expect(result.actions[0]).toEqual({
        type: 'syncOverlayValue',
        value: '=D3'
      })
      expect(manager.state.currentValue).toBe('=D3')
    })

    it('跨 Sheet 时应该插入带 Sheet 名称的引用', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })
      manager.switchSheet('sheet2')

      const result = manager.actionSelectionChange(
        'sheet2',
        { row: 0, col: 0 },
        { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        () => 'Sheet2'
      )

      expect(result.consumed).toBe(true)
      expect(manager.state.currentValue).toBe('=Sheet2!A1')
    })

    it('范围选择应该插入范围引用', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })

      const result = manager.actionSelectionChange(
        'sheet1',
        { row: 0, col: 0 },
        { startRow: 0, startCol: 0, endRow: 2, endCol: 3 },
        () => 'Sheet1'
      )

      expect(result.consumed).toBe(true)
      expect(manager.state.currentValue).toBe('=A1:D3')
    })

    it('未在编辑时应该不消费事件', () => {
      const result = manager.actionSelectionChange(
        'sheet1',
        { row: 0, col: 0 },
        { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        () => 'Sheet1'
      )

      expect(result.consumed).toBe(false)
    })

    it('单元格编辑时应该不消费事件', () => {
      manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=',
        mode: 'edit'
      })

      const result = manager.actionSelectionChange(
        'sheet1',
        { row: 1, col: 1 },
        { startRow: 1, startCol: 1, endRow: 1, endCol: 1 },
        () => 'Sheet1'
      )

      expect(result.consumed).toBe(false)
    })
  })

  describe('actionSheetChange', () => {
    it('未在编辑时应该允许切换', () => {
      const result = manager.actionSheetChange('sheet2')

      expect(result.allowSwitch).toBe(true)
      expect(result.needConfirm).toBeUndefined()
    })

    it('单元格编辑时应该需要先确认', () => {
      manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'test',
        mode: 'edit'
      })

      const result = manager.actionSheetChange('sheet2')

      expect(result.allowSwitch).toBe(true)
      expect(result.needConfirm).toBe(true)
    })

    it('公式栏公式模式应该允许切换（跨 Sheet 模式）', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '='
      })

      const result = manager.actionSheetChange('sheet2')

      expect(result.allowSwitch).toBe(true)
      expect(result.needConfirm).toBeUndefined()
      expect(manager.state.currentSheetId).toBe('sheet2')
    })

    it('公式栏非公式模式应该需要先确认', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'hello'  // 非公式
      })

      const result = manager.actionSheetChange('sheet2')

      expect(result.allowSwitch).toBe(true)
      expect(result.needConfirm).toBe(true)
    })
  })

  describe('actionConfirmAndMoveDown', () => {
    it('应该返回确认动作和移动到下一行的动作', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 2,
        col: 0,
        value: 'test'
      })

      const result = manager.actionConfirmAndMoveDown()

      expect(result.success).toBe(true)
      expect(result.actions).toContainEqual({ type: 'selectCell', row: 3, col: 0 })
    })
  })

  describe('actionCursorPositionChange', () => {
    it('应该更新光标位置', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1+B2'
      })

      const result = manager.actionCursorPositionChange(3)

      expect(result.success).toBe(true)
      expect(manager.state.cursorPosition).toBe(3)
    })

    it('应该更新选择范围', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1+B2'
      })

      const result = manager.actionCursorPositionChange(3, { start: 1, end: 3 })

      expect(result.success).toBe(true)
      expect(manager.state.selectionRange).toEqual({ start: 1, end: 3 })
      expect(manager.state.hasTextSelection).toBe(true)
    })

    it('未在编辑时应该返回失败', () => {
      const result = manager.actionCursorPositionChange(5)

      expect(result.success).toBe(false)
    })
  })

  describe('actionRequestEdit', () => {
    it('公式栏公式模式时应该切换到单元格编辑', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1+'
      })

      const result = manager.actionRequestEdit(0, 0)

      expect(result.success).toBe(true)
      expect(manager.state.source).toBe('cell')
      expect(result.actions).toContainEqual({ type: 'focusOverlay' })
    })

    it('未在编辑时应该返回失败', () => {
      const result = manager.actionRequestEdit(0, 0)

      expect(result.success).toBe(false)
    })

    it('单元格编辑时应该返回失败', () => {
      manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1',
        mode: 'edit'
      })

      const result = manager.actionRequestEdit(1, 1)

      expect(result.success).toBe(false)
    })
  })

  describe('actionEditingStateChange', () => {
    it('开始编辑应该设置状态', () => {
      const result = manager.actionEditingStateChange({
        isEditing: true,
        row: 1,
        col: 2,
        value: 'hello',
        mode: 'edit',
        sheetId: 'sheet1'
      })

      expect(result.success).toBe(true)
      expect(manager.state.active).toBe(true)
      expect(manager.state.source).toBe('cell')
      expect(manager.state.row).toBe(1)
      expect(manager.state.col).toBe(2)
    })

    it('结束编辑应该重置状态', () => {
      manager.actionStartCellEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: 'test',
        mode: 'edit'
      })

      const result = manager.actionEditingStateChange({
        isEditing: false,
        row: 0,
        col: 0,
        value: '',
        sheetId: 'sheet1'
      })

      expect(result.success).toBe(true)
      expect(manager.state.active).toBe(false)
    })

    it('公式栏编辑时应该忽略单元格编辑状态变化', () => {
      manager.actionStartFormulaBarEdit({
        sheetId: 'sheet1',
        row: 0,
        col: 0,
        value: '=A1'
      })

      const result = manager.actionEditingStateChange({
        isEditing: true,
        row: 1,
        col: 1,
        value: 'other',
        sheetId: 'sheet1'
      })

      expect(result.success).toBe(false)
      expect(manager.state.source).toBe('formulaBar')  // 保持公式栏编辑
    })
  })
})
