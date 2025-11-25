/**
 * 带公式支持的电子表格模型
 * 包装 SheetModel 并提供公式计算功能
 * 
 * v2.0: 支持异步计算队列，避免阻塞 UI
 */

import { SheetModel } from './SheetModel'
import { FormulaEngine } from './FormulaEngine'
import { FormulaMetadataParser } from './FormulaMetadata'
import { FormulaCalculationQueue, type QueueStats } from './FormulaCalculationQueue'

// 单元格计算状态
export type CellCalculationState = 'idle' | 'pending' | 'calculating' | 'completed' | 'error'

export interface CellState {
  state: CellCalculationState
  value?: any
  error?: string
}

export class FormulaSheet {
  private model: SheetModel
  private formulaEngine: FormulaEngine
  private formulaCache: Map<string, any> = new Map()
  private computingSet: Set<string> = new Set() // 用于检测循环引用
  private dependencyGraph: Map<string, Set<string>> = new Map()
  
  // 异步计算相关
  private calculationQueue: FormulaCalculationQueue
  private cellStates: Map<string, CellState> = new Map()
  private enableAsync = true // 是否启用异步计算
  private onStateChangeCallbacks: Array<(row: number, col: number, state: CellState) => void> = []
  private onQueueStatsCallbacks: Array<(stats: QueueStats) => void> = []

  constructor(model: SheetModel, enableAsync = true) {
    this.model = model
    this.enableAsync = enableAsync
    
    // 创建公式引擎，传递单元格值获取函数
    this.formulaEngine = new FormulaEngine((row, col) => this.getComputedValue(row, col))
    
    // 创建计算队列
    this.calculationQueue = new FormulaCalculationQueue(
      (formula: string, row: number, col: number) => this.calculateFormula(formula, row, col)
    )
    
    // 监听队列进度
    this.calculationQueue.onProgress((stats) => {
      this.onQueueStatsCallbacks.forEach(callback => callback(stats))
    })
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

    // 在公式引擎递归取值时，必须同步计算以避免占位符导致的错误
    const result = this.getValueSync(row, col)
    
    // 如果结果是错误，返回 0 而不是错误信息
    // 这样可以避免在嵌套公式中显示错误信息
    if (typeof result === 'string' && result.startsWith('#')) {
      console.log(`[FormulaSheet] 单元格 ${this.getCellAddress(row, col)} 计算错误: ${result}，返回 0`)
      return 0
    }

    return result
  }

  /**
   * 同步计算公式（内部使用）
   */
  private calculateFormula(formula: string, row: number, col: number): any {
    const cellKey = `${row}_${col}`
    
    // 检测循环引用
    if (this.computingSet.has(cellKey)) {
      console.error(`[FormulaSheet] 循环引用检测: ${this.getCellAddress(row, col)}`)
      return '#CIRCULAR!'
    }

    // 标记为正在计算
    this.computingSet.add(cellKey)

    try {
      // 计算公式
      const result = this.formulaEngine.evaluate(formula)
      const finalResult = result.error || result.result
      
      console.log(`[FormulaSheet] 计算: ${this.getCellAddress(row, col)} = ${finalResult}`)
      return finalResult
    } catch (err) {
      console.error(`[FormulaSheet] 计算异常: ${this.getCellAddress(row, col)}`, err)
      return '#ERROR!'
    } finally {
      // 移除标记
      this.computingSet.delete(cellKey)
    }
  }

  /**
   * 获取单元格的显示值（如果是公式则异步计算）
   * 支持递归计算和缓存
   */
  getValue(row: number, col: number): any {
    const cellKey = `${row}_${col}`
    
    // 检查缓存
    if (this.formulaCache.has(cellKey)) {
      return this.formulaCache.get(cellKey)
    }

    const rawValue = this.getRawValue(row, col)

    // 如果不是公式，直接返回
    if (!this.formulaEngine.isFormula(rawValue)) {
      return rawValue
    }

    // 如果已经有状态且正在计算，返回计算中标记
    const state = this.cellStates.get(cellKey)
    if (state && (state.state === 'pending' || state.state === 'calculating')) {
      return '···' // 返回计算中标记（中文省略号替换为中点）
    }

    // 启动异步计算
    if (this.enableAsync) {
      this.getValueAsync(row, col, 'normal')
      return '···' // 返回计算中标记（中文省略号替换为中点）
    } else {
      // 同步模式（用于测试或特殊场景）
      return this.getValueSync(row, col)
    }
  }

  /**
   * 同步获取单元格值（旧逻辑，用于兼容）
   */
  getValueSync(row: number, col: number): any {
    const cellKey = `${row}_${col}`
    
    // 检查缓存
    if (this.formulaCache.has(cellKey)) {
      return this.formulaCache.get(cellKey)
    }

    const rawValue = this.getRawValue(row, col)

    // 如果不是公式，直接返回
    if (!this.formulaEngine.isFormula(rawValue)) {
      return rawValue
    }

    const result = this.calculateFormula(rawValue, row, col)
    
    // 缓存结果
    this.formulaCache.set(cellKey, result)
    return result
  }

  /**
   * 异步获取单元格值
   */
  async getValueAsync(
    row: number,
    col: number,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<any> {
    const cellKey = `${row}_${col}`
    
    // 检查缓存
    if (this.formulaCache.has(cellKey)) {
      return this.formulaCache.get(cellKey)
    }

    const rawValue = this.getRawValue(row, col)

    // 如果不是公式，直接返回
    if (!this.formulaEngine.isFormula(rawValue)) {
      return rawValue
    }

    // 更新状态为待计算
    this.updateCellState(row, col, { state: 'pending' })

    try {
      // 添加到计算队列
      const result = await this.calculationQueue.addTask(row, col, rawValue, priority)
      
      // 缓存结果
      this.formulaCache.set(cellKey, result)
      
      // 更新状态为完成
      this.updateCellState(row, col, { state: 'completed', value: result })
      
      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '#ERROR!'
      
      // 更新状态为错误
      this.updateCellState(row, col, { state: 'error', error: errorMsg })
      
      return errorMsg
    }
  }

  /**
   * 更新单元格计算状态
   */
  private updateCellState(row: number, col: number, state: CellState): void {
    const cellKey = `${row}_${col}`
    this.cellStates.set(cellKey, state)
    
    // 触发状态变更回调
    this.onStateChangeCallbacks.forEach(callback => callback(row, col, state))
  }

  /**
   * 获取单元格计算状态
   */
  getCellState(row: number, col: number): CellState | undefined {
    const cellKey = `${row}_${col}`
    return this.cellStates.get(cellKey)
  }

  /**
   * 注册状态变更回调
   */
  onCellStateChange(callback: (row: number, col: number, state: CellState) => void): void {
    this.onStateChangeCallbacks.push(callback)
  }

  /**
   * 注册队列统计回调
   */
  onQueueStats(callback: (stats: QueueStats) => void): void {
    this.onQueueStatsCallbacks.push(callback)
  }

  /**
   * 获取队列统计信息
   */
  getQueueStats(): QueueStats {
    return this.calculationQueue.getStats()
  }

  /**
   * 设置是否启用异步计算
   */
  setAsyncMode(enable: boolean): void {
    this.enableAsync = enable
  }

  /**
   * 批量异步计算多个单元格
   */
  async calculateBatch(
    cells: Array<{ row: number; col: number }>,
    priority: 'high' | 'normal' | 'low' = 'low'
  ): Promise<void> {
    const tasks = cells
      .map(({ row, col }) => {
        const formula = this.getRawValue(row, col)
        if (this.formulaEngine.isFormula(formula)) {
          return { row, col, formula }
        }
        return null
      })
      .filter((task): task is { row: number; col: number; formula: string } => task !== null)

    await this.calculationQueue.addBatchTasks(tasks, priority)
  }

  /**
   * 获取原始值（用于编辑框显示）
   */
  getDisplayValue(row: number, col: number): string {
    return this.getRawValue(row, col)
  }

  /**
   * 设置单元格值
   * 如果值是公式，自动解析并存储元数据，并触发高优先级异步计算
   */
  setValue(row: number, col: number, value: string): void {
    const cellKey = `${row}_${col}`
    
    // 清除该单元格的旧状态和缓存
    this.cellStates.delete(cellKey)
    this.formulaCache.delete(cellKey)
    
    // 如果是公式，解析并存储元数据
    if (this.formulaEngine.isFormula(value)) {
      try {
        const metadata = FormulaMetadataParser.parse(value, row, col)
        // 创建包含元数据的单元格
        const cell = {
          value: value,
          formulaMetadata: metadata
        }
        this.model.setCell(row, col, cell)
        
        // 触发高优先级异步计算（用户输入）
        if (this.enableAsync) {
          this.getValueAsync(row, col, 'high')
        }
      } catch (err) {
        console.error(`[FormulaSheet] 公式解析失败: ${value}`, err)
        this.model.setValue(row, col, value)
      }
    } else {
      this.model.setValue(row, col, value)
    }
    
    // 清空缓存（影响依赖的单元格）
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
    this.cellStates.clear()
  }

  /**
   * 公开方法：清空计算缓存（用于行列操作等需要刷新的场景）
   */
  clearFormulaCache(): void {
    this.clearCache()
    // 取消所有待处理的计算任务
    this.calculationQueue.cancelAllPending()
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

  /**
   * 调整所有公式的引用（用于插入/删除行列）- 同步版本
   * 使用新的元数据系统
   * @param operation 操作类型
   * @param index 插入/删除的行号或列号
   * @param count 插入/删除的数量
   */
  adjustAllFormulas(
    operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
    index: number,
    count: number = 1
  ): void {
    const adjustedCells: Array<{ 
      oldRow: number
      oldCol: number
      newRow: number
      newCol: number
      newValue: string 
    }> = []

    // 遍历所有单元格，找到包含公式的单元格
    this.model.forEach((r, c, cell) => {
      if (cell.formulaMetadata) {
        // 使用元数据调整（会自动计算新位置并调整引用）
        const adjustedMetadata = FormulaMetadataParser.adjust(
          cell.formulaMetadata,
          operation,
          index,
          count
        )
        
        // adjustedMetadata.originalFormula 已经是调整后的公式文本
        // adjustedMetadata.formulaRow/formulaCol 已经是新位置
        const adjustedFormula = adjustedMetadata.originalFormula
        const newRow = adjustedMetadata.formulaRow
        const newCol = adjustedMetadata.formulaCol
        
        // 记录需要更新的单元格
        adjustedCells.push({ 
          oldRow: r, 
          oldCol: c, 
          newRow, 
          newCol, 
          newValue: adjustedFormula 
        })
      }
    })

    // 先清除所有旧位置的单元格（对于位置改变的情况）
    for (const { oldRow, oldCol, newRow, newCol } of adjustedCells) {
      if (oldRow !== newRow || oldCol !== newCol) {
        this.model.setValue(oldRow, oldCol, '')
      }
    }

    // 临时禁用异步模式，直接设置值
    const wasAsync = this.enableAsync
    this.enableAsync = false
    
    // 更新所有调整后的公式到新位置
    for (const { newRow, newCol, newValue } of adjustedCells) {
      this.setValue(newRow, newCol, newValue)
    }
    
    // 恢复异步模式
    this.enableAsync = wasAsync

    // 清空缓存，强制重新计算
    this.clearCache()
  }

  /**
   * 调整所有公式的引用（异步版本，适用于大量公式）
   * @param operation 操作类型
   * @param index 插入/删除的行号或列号
   * @param count 插入/删除的数量
   * @param onProgress 进度回调
   */
  async adjustAllFormulasAsync(
    operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
    index: number,
    count: number = 1,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const adjustedCells: Array<{ 
      oldRow: number
      oldCol: number
      newRow: number
      newCol: number
      newValue: string 
    }> = []

    // 遍历所有单元格，找到包含公式的单元格
    this.model.forEach((r, c, cell) => {
      if (cell.formulaMetadata) {
        const adjustedMetadata = FormulaMetadataParser.adjust(
          cell.formulaMetadata,
          operation,
          index,
          count
        )
        
        const adjustedFormula = adjustedMetadata.originalFormula
        const newRow = adjustedMetadata.formulaRow
        const newCol = adjustedMetadata.formulaCol
        
        adjustedCells.push({ 
          oldRow: r, 
          oldCol: c, 
          newRow, 
          newCol, 
          newValue: adjustedFormula 
        })
      }
    })

    const total = adjustedCells.length
    
    // 先清除所有旧位置的单元格
    for (const { oldRow, oldCol, newRow, newCol } of adjustedCells) {
      if (oldRow !== newRow || oldCol !== newCol) {
        this.model.setValue(oldRow, oldCol, '')
      }
    }

    // 批量更新，每 50 个公式暂停一帧
    const batchSize = 50
    for (let i = 0; i < adjustedCells.length; i++) {
      const { newRow, newCol, newValue } = adjustedCells[i]
      this.setValue(newRow, newCol, newValue)
      
      // 报告进度
      if (onProgress && (i % batchSize === 0 || i === adjustedCells.length - 1)) {
        onProgress(i + 1, total)
      }
      
      // 每处理 batchSize 个公式暂停一帧
      if ((i + 1) % batchSize === 0 && i < adjustedCells.length - 1) {
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
      }
    }

    // 清空缓存
    this.clearCache()
  }

  /**
   * 复制单元格到新位置（支持公式相对引用）
   * @param fromRow 源行号
   * @param fromCol 源列号
   * @param toRow 目标行号
   * @param toCol 目标列号
   */
  copyCell(fromRow: number, fromCol: number, toRow: number, toCol: number): void {
    const cell = this.model.getCell(fromRow, fromCol)
    if (!cell) {
      // 源单元格为空，清除目标单元格
      this.setValue(toRow, toCol, '')
      return
    }

    // 如果源单元格有公式元数据，使用元数据重建公式
    if (cell.formulaMetadata) {
      const newFormula = FormulaMetadataParser.rebuild(cell.formulaMetadata, toRow, toCol)
      this.setValue(toRow, toCol, newFormula)
    } else {
      // 普通值，直接复制
      this.setValue(toRow, toCol, cell.value)
    }
  }

  /**
   * 批量复制区域（支持公式相对引用）
   * @param fromStartRow 源起始行
   * @param fromStartCol 源起始列
   * @param fromEndRow 源结束行
   * @param fromEndCol 源结束列
   * @param toStartRow 目标起始行
   * @param toStartCol 目标起始列
   */
  copyRange(
    fromStartRow: number,
    fromStartCol: number,
    fromEndRow: number,
    fromEndCol: number,
    toStartRow: number,
    toStartCol: number
  ): void {
    const rowCount = fromEndRow - fromStartRow + 1
    const colCount = fromEndCol - fromStartCol + 1

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        this.copyCell(
          fromStartRow + r,
          fromStartCol + c,
          toStartRow + r,
          toStartCol + c
        )
      }
    }
  }
}
