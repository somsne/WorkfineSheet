/**
 * Workbook 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Workbook } from '../Workbook'

describe('Workbook', () => {
  let workbook: Workbook

  beforeEach(() => {
    workbook = new Workbook()
  })

  describe('初始化', () => {
    it('应该默认创建一个名为 Sheet1 的工作表', () => {
      const sheets = workbook.getAllSheets()
      expect(sheets.length).toBe(1)
      expect(sheets[0]!.metadata.name).toBe('Sheet1')
      expect(sheets[0]!.metadata.visible).toBe(true)
    })

    it('应该将第一个工作表设为活动工作表', () => {
      const activeSheet = workbook.getActiveSheet()
      expect(activeSheet).toBeDefined()
      expect(activeSheet?.metadata.name).toBe('Sheet1')
    })
  })

  describe('添加工作表', () => {
    it('应该添加新工作表', () => {
      const newId = workbook.addSheet('Sheet2')
      expect(newId).toBeDefined()
      
      const sheets = workbook.getAllSheets()
      expect(sheets.length).toBe(2)
      expect(sheets[1]!.metadata.name).toBe('Sheet2')
    })

    it('应该自动生成唯一名称', () => {
      workbook.addSheet() // Sheet2
      workbook.addSheet() // Sheet3
      
      const sheets = workbook.getAllSheets()
      expect(sheets.length).toBe(3)
      expect(sheets[1]!.metadata.name).toBe('Sheet2')
      expect(sheets[2]!.metadata.name).toBe('Sheet3')
    })

    it('重复名称应该抛出错误', () => {
      expect(() => workbook.addSheet('Sheet1')).toThrow('已存在')
    })

    it('应该支持在指定位置插入', () => {
      workbook.addSheet('Sheet2')
      workbook.addSheet('Sheet3', 1) // 在 Sheet1 后面插入
      
      const sheets = workbook.getAllSheets()
      expect(sheets[0]!.metadata.name).toBe('Sheet1')
      expect(sheets[1]!.metadata.name).toBe('Sheet3')
      expect(sheets[2]!.metadata.name).toBe('Sheet2')
    })
  })

  describe('删除工作表', () => {
    beforeEach(() => {
      workbook.addSheet('Sheet2')
      workbook.addSheet('Sheet3')
    })

    it('应该删除指定工作表', () => {
      const sheet2 = workbook.getSheetByName('Sheet2')
      expect(sheet2).toBeDefined()
      
      workbook.removeSheet(sheet2!.metadata.id)
      
      expect(workbook.getSheetCount()).toBe(2)
      expect(workbook.getSheetByName('Sheet2')).toBeUndefined()
    })

    it('删除活动工作表后应该切换到其他工作表', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      workbook.setActiveSheet(sheet1!.metadata.id)
      
      workbook.removeSheet(sheet1!.metadata.id)
      
      const activeSheet = workbook.getActiveSheet()
      expect(activeSheet).toBeDefined()
      expect(activeSheet?.metadata.name).not.toBe('Sheet1')
    })

    it('不能删除最后一个可见工作表', () => {
      // 删除 Sheet2 和 Sheet3
      const sheet2 = workbook.getSheetByName('Sheet2')
      const sheet3 = workbook.getSheetByName('Sheet3')
      workbook.removeSheet(sheet2!.metadata.id)
      workbook.removeSheet(sheet3!.metadata.id)
      
      // 尝试删除 Sheet1 应该失败
      const sheet1 = workbook.getSheetByName('Sheet1')
      expect(() => workbook.removeSheet(sheet1!.metadata.id)).toThrow('最后一个')
    })
  })

  describe('重命名工作表', () => {
    it('应该重命名工作表', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      workbook.renameSheet(sheet1!.metadata.id, '数据表')
      
      expect(workbook.getSheetByName('数据表')).toBeDefined()
      expect(workbook.getSheetByName('Sheet1')).toBeUndefined()
    })

    it('不能重命名为已存在的名称', () => {
      workbook.addSheet('Sheet2')
      const sheet1 = workbook.getSheetByName('Sheet1')
      
      expect(() => workbook.renameSheet(sheet1!.metadata.id, 'Sheet2')).toThrow('已存在')
    })

    it('不能包含特殊字符', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      expect(() => workbook.renameSheet(sheet1!.metadata.id, 'Sheet/1')).toThrow('不能包含')
      expect(() => workbook.renameSheet(sheet1!.metadata.id, 'Sheet?1')).toThrow('不能包含')
    })

    it('名称不能超过 31 个字符', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      const longName = 'a'.repeat(32)
      expect(() => workbook.renameSheet(sheet1!.metadata.id, longName)).toThrow('31')
    })
  })

  describe('复制工作表', () => {
    it('应该复制工作表', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      sheet1!.model.setValue(0, 0, 'Hello')
      
      const newId = workbook.duplicateSheet(sheet1!.metadata.id)
      const newSheet = workbook.getSheetById(newId)
      
      expect(newSheet).toBeDefined()
      expect(newSheet?.metadata.name).toBe('Sheet1 (副本)')
      expect(newSheet?.model.getValue(0, 0)).toBe('Hello')
    })

    it('复制时应该自动处理名称冲突', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      workbook.duplicateSheet(sheet1!.metadata.id) // Sheet1 (副本)
      workbook.duplicateSheet(sheet1!.metadata.id) // Sheet1 (副本) 1
      
      expect(workbook.getSheetByName('Sheet1 (副本)')).toBeDefined()
      expect(workbook.getSheetByName('Sheet1 (副本) 1')).toBeDefined()
    })
  })

  describe('移动工作表', () => {
    beforeEach(() => {
      workbook.addSheet('Sheet2')
      workbook.addSheet('Sheet3')
    })

    it('应该移动工作表到新位置', () => {
      const sheet3 = workbook.getSheetByName('Sheet3')
      workbook.moveSheet(sheet3!.metadata.id, 0)
      
      const sheets = workbook.getAllSheets()
      expect(sheets[0]!.metadata.name).toBe('Sheet3')
      expect(sheets[1]!.metadata.name).toBe('Sheet1')
      expect(sheets[2]!.metadata.name).toBe('Sheet2')
    })
  })

  describe('显示/隐藏工作表', () => {
    beforeEach(() => {
      workbook.addSheet('Sheet2')
    })

    it('应该隐藏工作表', () => {
      const sheet2 = workbook.getSheetByName('Sheet2')
      workbook.setSheetVisibility(sheet2!.metadata.id, false)
      
      expect(sheet2?.metadata.visible).toBe(false)
      expect(workbook.getVisibleSheets().length).toBe(1)
    })

    it('隐藏活动工作表后应该切换到其他可见工作表', () => {
      const sheet2 = workbook.getSheetByName('Sheet2')
      workbook.setActiveSheet(sheet2!.metadata.id)
      
      workbook.setSheetVisibility(sheet2!.metadata.id, false)
      
      const activeSheet = workbook.getActiveSheet()
      expect(activeSheet?.metadata.name).toBe('Sheet1')
    })

    it('不能隐藏最后一个可见工作表', () => {
      const sheet2 = workbook.getSheetByName('Sheet2')
      workbook.setSheetVisibility(sheet2!.metadata.id, false)
      
      const sheet1 = workbook.getSheetByName('Sheet1')
      expect(() => workbook.setSheetVisibility(sheet1!.metadata.id, false)).toThrow('最后一个')
    })
  })

  describe('标签颜色', () => {
    it('应该设置标签颜色', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      workbook.setSheetColor(sheet1!.metadata.id, '#ff0000')
      
      expect(sheet1?.metadata.color).toBe('#ff0000')
    })

    it('应该清除标签颜色', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      workbook.setSheetColor(sheet1!.metadata.id, '#ff0000')
      workbook.setSheetColor(sheet1!.metadata.id, undefined)
      
      expect(sheet1?.metadata.color).toBeUndefined()
    })
  })

  describe('事件系统', () => {
    it('应该触发 sheetAdded 事件', () => {
      const listener = vi.fn()
      workbook.on('sheetAdded', listener)
      
      workbook.addSheet('NewSheet')
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'sheetAdded',
        sheetName: 'NewSheet'
      }))
    })

    it('应该触发 sheetRenamed 事件', () => {
      const listener = vi.fn()
      workbook.on('sheetRenamed', listener)
      
      const sheet1 = workbook.getSheetByName('Sheet1')
      workbook.renameSheet(sheet1!.metadata.id, 'NewName')
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'sheetRenamed',
        oldName: 'Sheet1',
        newName: 'NewName'
      }))
    })

    it('应该支持移除事件监听器', () => {
      const listener = vi.fn()
      workbook.on('sheetAdded', listener)
      workbook.off('sheetAdded', listener)
      
      workbook.addSheet('NewSheet')
      
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('跨表引用', () => {
    beforeEach(() => {
      workbook.addSheet('Sheet2')
      const sheet1 = workbook.getSheetByName('Sheet1')
      const sheet2 = workbook.getSheetByName('Sheet2')
      
      sheet1!.model.setValue(0, 0, '100')
      sheet2!.model.setValue(0, 0, '200')
    })

    it('应该通过名称获取单元格值', () => {
      const value = workbook.getCellValueBySheetName('Sheet1', 0, 0)
      expect(value).toBe('100')
    })

    it('不存在的工作表应该抛出错误', () => {
      expect(() => workbook.getCellValueBySheetName('NotExist', 0, 0)).toThrow('不存在')
    })

    it('应该获取所有工作表名称', () => {
      const names = workbook.getSheetNames()
      expect(names).toContain('Sheet1')
      expect(names).toContain('Sheet2')
    })
  })

  describe('序列化', () => {
    it('应该正确导出为 JSON', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      sheet1!.model.setValue(0, 0, 'Test')
      
      const json = workbook.toJSON()
      
      expect(json).toHaveProperty('version', '1.0')
      expect(json).toHaveProperty('sheets')
      expect((json as any).sheets.length).toBe(1)
    })

    it('应该正确从 JSON 导入', () => {
      const sheet1 = workbook.getSheetByName('Sheet1')
      sheet1!.model.setValue(0, 0, 'Test')
      
      const json = workbook.toJSON()
      const newWorkbook = Workbook.fromJSON(json)
      
      expect(newWorkbook.getSheetCount()).toBe(1)
      const newSheet = newWorkbook.getSheetByName('Sheet1')
      expect(newSheet?.model.getValue(0, 0)).toBe('Test')
    })
  })
})
