import { describe, it, expect } from 'vitest'
import { SheetModel } from '../SheetModel'
import { FormulaSheet } from '../FormulaSheet'

describe('FormulaSheet 依赖更新', () => {
  it('修改被引用单元格后，公式应该重新计算', () => {
    const model = new SheetModel()
    const formulaSheet = new FormulaSheet(model, false) // 禁用异步
    
    // A1 = 10
    formulaSheet.setValue(0, 0, '10')
    // B1 = =A1*2
    formulaSheet.setValue(0, 1, '=A1*2')
    
    console.log('初始状态:')
    console.log('A1 getValue:', formulaSheet.getValue(0, 0))
    console.log('B1 getValue:', formulaSheet.getValue(0, 1))
    
    expect(formulaSheet.getValue(0, 1)).toBe(20)
    
    // 修改 A1 = 5
    formulaSheet.setValue(0, 0, '5')
    
    console.log('修改 A1 = 5 后:')
    console.log('A1 getValue:', formulaSheet.getValue(0, 0))
    console.log('B1 getValue:', formulaSheet.getValue(0, 1))
    
    // B1 应该重新计算为 10
    expect(formulaSheet.getValue(0, 1)).toBe(10)
  })
  
  it('异步模式：修改被引用单元格后，公式应该重新计算', async () => {
    const model = new SheetModel()
    const formulaSheet = new FormulaSheet(model, true) // 启用异步
    
    // A1 = 10
    formulaSheet.setValue(0, 0, '10')
    // B1 = =A1*2
    formulaSheet.setValue(0, 1, '=A1*2')
    
    // 等待异步计算
    await new Promise(resolve => setTimeout(resolve, 100))
    
    console.log('异步初始状态:')
    console.log('A1 getValue:', formulaSheet.getValue(0, 0))
    console.log('B1 getValue:', formulaSheet.getValue(0, 1))
    
    expect(formulaSheet.getValue(0, 1)).toBe(20)
    
    // 修改 A1 = 5
    formulaSheet.setValue(0, 0, '5')
    
    // 手动触发 B1 的重新计算（模拟渲染时调用 getValue）
    const firstRead = formulaSheet.getValue(0, 1)
    console.log('修改后第一次读取 B1:', firstRead)
    
    // 等待异步计算
    await new Promise(resolve => setTimeout(resolve, 200))
    
    console.log('异步修改 A1 = 5 后:')
    console.log('A1 getValue:', formulaSheet.getValue(0, 0))
    console.log('B1 getValue:', formulaSheet.getValue(0, 1))
    
    // B1 应该重新计算为 10
    expect(formulaSheet.getValue(0, 1)).toBe(10)
  })
})
