/**
 * 带公式支持的电子表格模型
 * 包装 SheetModel 并提供公式计算功能
 */

import { SheetModel } from './SheetModel'
import { FormulaEngine } from './FormulaEngine'

export class FormulaSheet {
  private model: SheetModel
  private formulaEngine: FormulaEngine
  private formulaCache: Map<string, any> = new Map()
  private computingSet: Set<string> = new Set() // 用于检测循环引用
  private dependencyGraph: Map<string, Set<string>> = new Map()

  constructor(model: SheetModel) {
    this.model = model
    // 创建公式引擎，传递单元格值获取函数
    this.formulaEngine = new FormulaEngine((row, col) => this.getComputedValue(row, col))
  }

  /**
   * 获取单元格的原始值（不计算公式）
   */
  private getRawValue(row: number, col: number): any {
    return this.model.getValue(row, col)
  }

  /**
   * 获取单元格的计算值（递归计算公式）
   * 这是提供给 FormulaEngine 的回调函数
   */
  private getComputedValue(row: number, col: number): any {
    const rawValue = this.getRawValue(row, col)

    // 如果不是公式，直接返回
    if (!this.formulaEngine.isFormula(rawValue)) {
      return rawValue
    }

    // 计算公式并返回结果
    const result = this.getValue(row, col)
    
    // 如果结果是错误，返回 0 而不是错误信息
    // 这样可以避免在嵌套公式中显示错误信息
    if (typeof result === 'string' && result.startsWith('#')) {
      console.log(`[FormulaSheet] 单元格 ${this.getCellAddress(row, col)} 计算错误: ${result}，返回 0`)
      return 0
    }

    return result
  }

  /**
   * 获取单元格的显示值（如果是公式则计算）
   * 支持递归计算和缓存
   */
  getValue(row: number, col: number): any {
    const cellKey = `${row}_${col}`
    
    // 检查缓存 - 使用缓存时不打印日志，降低噪声
    if (this.formulaCache.has(cellKey)) {
      return this.formulaCache.get(cellKey)
    }

    const rawValue = this.getRawValue(row, col)

    // 如果不是公式，直接返回
    if (!this.formulaEngine.isFormula(rawValue)) {
      return rawValue
    }

    // 检测循环引用
    if (this.computingSet.has(cellKey)) {
      console.error(`[FormulaSheet] 循环引用检测: ${this.getCellAddress(row, col)}`)
      const result = '#CIRCULAR!'
      this.formulaCache.set(cellKey, result)
      return result
    }

    // 标记为正在计算
    this.computingSet.add(cellKey)

    try {
      // 计算公式
      const result = this.formulaEngine.evaluate(rawValue)

      let finalResult = result.error || result.result

      // 缓存结果
      this.formulaCache.set(cellKey, finalResult)

      // 只在实际计算时打印日志
      console.log(`[FormulaSheet] 计算: ${this.getCellAddress(row, col)} = ${finalResult}`)

      return finalResult
    } catch (err) {
      console.error(`[FormulaSheet] 计算异常: ${this.getCellAddress(row, col)}`, err)
      const result = '#ERROR!'
      this.formulaCache.set(cellKey, result)
      return result
    } finally {
      // 移除标记
      this.computingSet.delete(cellKey)
    }
  }

  /**
   * 获取原始值（用于编辑框显示）
   */
  getDisplayValue(row: number, col: number): string {
    return this.getRawValue(row, col)
  }

  /**
   * 设置单元格值
   */
  setValue(row: number, col: number, value: string): void {
    this.model.setValue(row, col, value)
    // 清空缓存
    this.clearCache()
  }

  /**
   * 检查值是否为公式
   */
  isFormula(value: string): boolean {
    return this.formulaEngine.isFormula(value)
  }

  /**
   * 获取公式中的单元格引用
   */
  getFormulaReferences(formula: string): Array<{ row: number; col: number }> {
    const references = this.formulaEngine.extractCellReferences(formula)
    return references.map(ref => ({ row: ref.row, col: ref.col }))
  }

  /**
   * 清空计算缓存
   */
  private clearCache(): void {
    this.formulaCache.clear()
    this.dependencyGraph.clear()
  }

  /**
   * 公开方法：清空计算缓存（用于行列操作等需要刷新的场景）
   */
  clearFormulaCache(): void {
    this.clearCache()
  }

  /**
   * 获取单元格地址
   */
  getCellAddress(row: number, col: number): string {
    return this.formulaEngine.getCellAddress(row, col)
  }

  /**
   * 获取范围字符串
   */
  getRangeString(startRow: number, startCol: number, endRow: number, endCol: number): string {
    return this.formulaEngine.getRangeString(startRow, startCol, endRow, endCol)
  }

  /**
   * 获取底层模型（用于高级操作）
   */
  getModel(): SheetModel {
    return this.model
  }

  /**
   * 获取公式引擎（用于自定义函数）
   */
  getFormulaEngine(): FormulaEngine {
    return this.formulaEngine
  }
}
