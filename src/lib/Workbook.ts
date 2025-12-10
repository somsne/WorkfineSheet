/**
 * Workbook - 工作簿模型
 * 管理多个工作表（SheetModel），支持工作表的增删改查、切换、排序等操作
 * 
 * Excel 工作簿结构：
 * - 一个工作簿包含多个工作表
 * - 每个工作表有唯一的名称
 * - 工作表之间可以通过公式相互引用（Sheet1!A1）
 */

import { SheetModel, type ModelSnapshot } from './SheetModel'

/**
 * 工作表视图状态（用于切换时保存/恢复）
 */
export interface SheetViewState {
  /** 活动单元格（焦点位置） */
  activeCell: { row: number; col: number }
  /** 选择范围 */
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number }
  /** 滚动位置 */
  scrollPosition: { scrollTop: number; scrollLeft: number }
  /** 是否显示网格线 */
  showGridLines?: boolean
}

/**
 * 工作表元数据
 */
export interface SheetMetadata {
  /** 工作表唯一 ID */
  id: string
  /** 工作表名称（显示在标签上） */
  name: string
  /** 标签颜色（可选） */
  color?: string
  /** 是否隐藏 */
  visible: boolean
  /** 排序索引 */
  order: number
}

/**
 * 工作表完整信息
 */
export interface SheetInfo {
  /** 元数据 */
  metadata: SheetMetadata
  /** 数据模型 */
  model: SheetModel
  /** 视图状态（用于切换时保存/恢复） */
  viewState: SheetViewState
}

/**
 * 工作簿快照（用于撤销/重做）
 */
export interface WorkbookSnapshot {
  /** 所有工作表的快照 */
  sheets: Map<string, {
    metadata: SheetMetadata
    modelSnapshot: ModelSnapshot
  }>
  /** 活动工作表 ID */
  activeSheetId: string
}

/**
 * 工作簿事件类型
 */
export type WorkbookEventType = 
  | 'sheetAdded'
  | 'sheetRemoved'
  | 'sheetRenamed'
  | 'sheetMoved'
  | 'sheetActivated'
  | 'sheetVisibilityChanged'
  | 'sheetColorChanged'

/**
 * 工作簿事件数据
 */
export interface WorkbookEvent {
  type: WorkbookEventType
  sheetId: string
  sheetName?: string
  oldName?: string
  newName?: string
  oldIndex?: number
  newIndex?: number
  visible?: boolean
  color?: string
}

/**
 * 事件监听器类型
 */
export type WorkbookEventListener = (event: WorkbookEvent) => void

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 创建默认的视图状态
 */
function createDefaultViewState(): SheetViewState {
  return {
    activeCell: { row: 0, col: 0 },
    selectionRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    scrollPosition: { scrollTop: 0, scrollLeft: 0 },
    showGridLines: true
  }
}

/**
 * 工作簿类
 */
export class Workbook {
  /** 工作表存储：id -> SheetInfo */
  private sheets: Map<string, SheetInfo> = new Map()
  
  /** 活动工作表 ID */
  private activeSheetId: string = ''
  
  /** 事件监听器 */
  private eventListeners: Map<WorkbookEventType, Set<WorkbookEventListener>> = new Map()
  
  /** 工作表名称计数器（用于生成默认名称） */
  private sheetCounter: number = 0

  /** 批量操作模式标志 */
  private batchMode: boolean = false
  
  /** 批量操作完成回调 */
  private batchCompleteCallbacks: Array<() => void> = []

  constructor() {
    // 默认创建一个空白工作表
    this.addSheet('Sheet1')
  }

  // ==================== 批量操作 ====================

  /**
   * 批量操作模式
   * 在回调函数执行期间，表格不重绘，公式不计算
   * 执行完成后统一触发计算和绘制
   * 
   * @param callback 批量操作回调函数，可以是同步或异步函数
   * @returns 如果 callback 返回值，则返回该值
   * 
   * @example
   * // 同步批量操作
   * workbook.batch(() => {
   *   for (let i = 0; i < 1000; i++) {
   *     model.setValue(i, 0, `Row ${i}`)
   *   }
   * })
   * 
   * @example
   * // 异步批量操作
   * await workbook.batch(async () => {
   *   const data = await fetchData()
   *   for (const item of data) {
   *     model.setValue(item.row, item.col, item.value)
   *   }
   * })
   */
  batch<T>(callback: () => T): T {
    // 如果已经在批量模式中，直接执行（支持嵌套）
    if (this.batchMode) {
      return callback()
    }
    
    // 进入批量模式
    this.batchMode = true
    
    try {
      const result = callback()
      
      // 处理异步函数
      if (result instanceof Promise) {
        return result.then((value) => {
          this.endBatch()
          return value
        }).catch((error) => {
          this.endBatch()
          throw error
        }) as T
      }
      
      // 同步函数，直接结束批量模式
      this.endBatch()
      return result
    } catch (error) {
      // 发生错误也要结束批量模式
      this.endBatch()
      throw error
    }
  }

  /**
   * 结束批量操作
   */
  private endBatch(): void {
    this.batchMode = false
    
    // 触发批量完成回调
    for (const callback of this.batchCompleteCallbacks) {
      try {
        callback()
      } catch (err) {
        console.error('[Workbook] 批量完成回调错误:', err)
      }
    }
  }

  /**
   * 是否处于批量操作模式
   */
  isInBatchMode(): boolean {
    return this.batchMode
  }

  /**
   * 注册批量操作完成回调
   * 当批量操作完成后会调用所有注册的回调
   * 组件可以在回调中执行重绘等操作
   */
  onBatchComplete(callback: () => void): void {
    this.batchCompleteCallbacks.push(callback)
  }

  /**
   * 移除批量操作完成回调
   */
  offBatchComplete(callback: () => void): void {
    const index = this.batchCompleteCallbacks.indexOf(callback)
    if (index !== -1) {
      this.batchCompleteCallbacks.splice(index, 1)
    }
  }

  // ==================== 工作表查询方法 ====================

  /**
   * 获取所有工作表信息（按顺序）
   */
  getAllSheets(): SheetInfo[] {
    return Array.from(this.sheets.values())
      .sort((a, b) => a.metadata.order - b.metadata.order)
  }

  /**
   * 获取所有可见的工作表
   */
  getVisibleSheets(): SheetInfo[] {
    return this.getAllSheets().filter(s => s.metadata.visible)
  }

  /**
   * 根据 ID 获取工作表
   */
  getSheetById(id: string): SheetInfo | undefined {
    return this.sheets.get(id)
  }

  /**
   * 根据名称获取工作表
   */
  getSheetByName(name: string): SheetInfo | undefined {
    for (const sheet of this.sheets.values()) {
      if (sheet.metadata.name === name) {
        return sheet
      }
    }
    return undefined
  }

  /**
   * 获取活动工作表
   */
  getActiveSheet(): SheetInfo | undefined {
    return this.sheets.get(this.activeSheetId)
  }

  /**
   * 获取活动工作表 ID
   */
  getActiveSheetId(): string {
    return this.activeSheetId
  }

  /**
   * 获取活动工作表的 Model
   */
  getActiveModel(): SheetModel | undefined {
    return this.getActiveSheet()?.model
  }

  /**
   * 获取工作表数量
   */
  getSheetCount(): number {
    return this.sheets.size
  }

  /**
   * 检查工作表名称是否存在
   */
  hasSheetName(name: string): boolean {
    return this.getSheetByName(name) !== undefined
  }

  // ==================== 工作表操作方法 ====================

  /**
   * 添加新工作表
   * @param name 工作表名称（可选，默认自动生成）
   * @param index 插入位置（可选，默认添加到末尾）
   * @returns 新工作表的 ID
   */
  addSheet(name?: string, index?: number): string {
    // 生成唯一名称
    const sheetName = name || this.generateUniqueName()
    
    // 检查名称是否重复
    if (this.hasSheetName(sheetName)) {
      throw new Error(`工作表名称 "${sheetName}" 已存在`)
    }

    // 生成 ID
    const id = generateId()
    
    // 计算排序索引
    const allSheets = this.getAllSheets()
    let order: number
    if (index !== undefined && index >= 0 && index <= allSheets.length) {
      // 在指定位置插入，需要调整后续工作表的 order
      order = index
      for (const sheet of allSheets) {
        if (sheet.metadata.order >= index) {
          sheet.metadata.order++
        }
      }
    } else {
      // 添加到末尾
      order = allSheets.length
    }

    // 创建工作表
    const model = new SheetModel()
    
    const sheetInfo: SheetInfo = {
      metadata: {
        id,
        name: sheetName,
        visible: true,
        order
      },
      model,
      viewState: createDefaultViewState()
    }

    this.sheets.set(id, sheetInfo)
    
    // 如果是第一个工作表，设为活动
    if (this.sheets.size === 1) {
      this.activeSheetId = id
    }

    // 触发事件
    this.emitEvent({
      type: 'sheetAdded',
      sheetId: id,
      sheetName
    })

    return id
  }

  /**
   * 删除工作表
   * @param id 工作表 ID
   * @returns 是否删除成功
   */
  removeSheet(id: string): boolean {
    const sheet = this.sheets.get(id)
    if (!sheet) {
      return false
    }

    // 至少保留一个可见工作表
    const visibleSheets = this.getVisibleSheets()
    if (visibleSheets.length <= 1 && sheet.metadata.visible) {
      throw new Error('无法删除最后一个可见工作表')
    }

    const removedOrder = sheet.metadata.order
    const sheetName = sheet.metadata.name
    
    // 删除工作表
    this.sheets.delete(id)
    
    // 调整其他工作表的 order
    for (const s of this.sheets.values()) {
      if (s.metadata.order > removedOrder) {
        s.metadata.order--
      }
    }

    // 如果删除的是活动工作表，切换到其他工作表
    if (this.activeSheetId === id) {
      const remaining = this.getVisibleSheets()
      if (remaining.length > 0 && remaining[0]) {
        this.activeSheetId = remaining[0].metadata.id
        this.emitEvent({
          type: 'sheetActivated',
          sheetId: this.activeSheetId,
          sheetName: remaining[0].metadata.name
        })
      }
    }

    // 触发事件
    this.emitEvent({
      type: 'sheetRemoved',
      sheetId: id,
      sheetName
    })

    return true
  }

  /**
   * 重命名工作表
   * @param id 工作表 ID
   * @param newName 新名称
   */
  renameSheet(id: string, newName: string): void {
    const sheet = this.sheets.get(id)
    if (!sheet) {
      throw new Error(`工作表 ID "${id}" 不存在`)
    }

    // 名称不能为空
    if (!newName || newName.trim() === '') {
      throw new Error('工作表名称不能为空')
    }

    // 名称不能包含特殊字符
    if (/[\\\/\?\*\[\]:']/.test(newName)) {
      throw new Error('工作表名称不能包含 \\ / ? * [ ] : \' 字符')
    }

    // 名称长度限制
    if (newName.length > 31) {
      throw new Error('工作表名称不能超过 31 个字符')
    }

    // 检查名称是否重复
    const existing = this.getSheetByName(newName)
    if (existing && existing.metadata.id !== id) {
      throw new Error(`工作表名称 "${newName}" 已存在`)
    }

    const oldName = sheet.metadata.name
    sheet.metadata.name = newName

    // 触发事件
    this.emitEvent({
      type: 'sheetRenamed',
      sheetId: id,
      oldName,
      newName
    })
  }

  /**
   * 复制工作表
   * @param id 源工作表 ID
   * @param newName 新名称（可选）
   * @returns 新工作表 ID
   */
  duplicateSheet(id: string, newName?: string): string {
    const source = this.sheets.get(id)
    if (!source) {
      throw new Error(`工作表 ID "${id}" 不存在`)
    }

    // 生成新名称
    const baseName = newName || `${source.metadata.name} (副本)`
    let finalName = baseName
    let counter = 1
    while (this.hasSheetName(finalName)) {
      finalName = `${baseName} ${counter++}`
    }

    // 创建新工作表
    const newId = this.addSheet(finalName, source.metadata.order + 1)
    const newSheet = this.sheets.get(newId)!

    // 复制数据
    const snapshot = source.model.createSnapshot()
    newSheet.model.restoreFromSnapshot(snapshot)

    // 复制颜色
    if (source.metadata.color) {
      newSheet.metadata.color = source.metadata.color
    }

    return newId
  }

  /**
   * 移动工作表到新位置
   * @param id 工作表 ID
   * @param newIndex 新位置索引
   */
  moveSheet(id: string, newIndex: number): void {
    const sheet = this.sheets.get(id)
    if (!sheet) {
      throw new Error(`工作表 ID "${id}" 不存在`)
    }

    const allSheets = this.getAllSheets()
    const oldIndex = sheet.metadata.order
    
    // 边界检查
    const clampedIndex = Math.max(0, Math.min(newIndex, allSheets.length - 1))
    
    if (oldIndex === clampedIndex) {
      return // 位置没变
    }

    // 调整其他工作表的 order
    if (oldIndex < clampedIndex) {
      // 向后移动：中间的工作表 order 减 1
      for (const s of allSheets) {
        if (s.metadata.order > oldIndex && s.metadata.order <= clampedIndex) {
          s.metadata.order--
        }
      }
    } else {
      // 向前移动：中间的工作表 order 加 1
      for (const s of allSheets) {
        if (s.metadata.order >= clampedIndex && s.metadata.order < oldIndex) {
          s.metadata.order++
        }
      }
    }

    sheet.metadata.order = clampedIndex

    // 触发事件
    this.emitEvent({
      type: 'sheetMoved',
      sheetId: id,
      sheetName: sheet.metadata.name,
      oldIndex,
      newIndex: clampedIndex
    })
  }

  /**
   * 切换活动工作表
   * @param id 工作表 ID
   */
  setActiveSheet(id: string): void {
    const sheet = this.sheets.get(id)
    if (!sheet) {
      throw new Error(`工作表 ID "${id}" 不存在`)
    }

    if (!sheet.metadata.visible) {
      throw new Error('无法激活隐藏的工作表')
    }

    if (this.activeSheetId === id) {
      return // 已经是活动工作表
    }

    this.activeSheetId = id

    // 触发事件
    this.emitEvent({
      type: 'sheetActivated',
      sheetId: id,
      sheetName: sheet.metadata.name
    })
  }

  /**
   * 保存工作表的视图状态
   * @param id 工作表 ID
   * @param viewState 视图状态
   */
  saveSheetViewState(id: string, viewState: SheetViewState): void {
    const sheet = this.sheets.get(id)
    if (sheet) {
      sheet.viewState = { ...viewState }
    }
  }

  /**
   * 获取工作表的视图状态
   * @param id 工作表 ID
   */
  getSheetViewState(id: string): SheetViewState | undefined {
    const sheet = this.sheets.get(id)
    return sheet?.viewState
  }

  /**
   * 根据名称切换活动工作表
   * @param name 工作表名称
   */
  setActiveSheetByName(name: string): void {
    const sheet = this.getSheetByName(name)
    if (!sheet) {
      throw new Error(`工作表 "${name}" 不存在`)
    }
    this.setActiveSheet(sheet.metadata.id)
  }

  /**
   * 显示/隐藏工作表
   * @param id 工作表 ID
   * @param visible 是否可见
   */
  setSheetVisibility(id: string, visible: boolean): void {
    const sheet = this.sheets.get(id)
    if (!sheet) {
      throw new Error(`工作表 ID "${id}" 不存在`)
    }

    // 不能隐藏最后一个可见工作表
    if (!visible) {
      const visibleSheets = this.getVisibleSheets()
      if (visibleSheets.length <= 1 && sheet.metadata.visible) {
        throw new Error('无法隐藏最后一个可见工作表')
      }
    }

    if (sheet.metadata.visible === visible) {
      return // 状态没变
    }

    sheet.metadata.visible = visible

    // 如果隐藏的是活动工作表，切换到其他可见工作表
    if (!visible && this.activeSheetId === id) {
      const visibleSheets = this.getVisibleSheets()
      if (visibleSheets.length > 0 && visibleSheets[0]) {
        this.activeSheetId = visibleSheets[0].metadata.id
        this.emitEvent({
          type: 'sheetActivated',
          sheetId: this.activeSheetId,
          sheetName: visibleSheets[0].metadata.name
        })
      }
    }

    // 触发事件
    this.emitEvent({
      type: 'sheetVisibilityChanged',
      sheetId: id,
      sheetName: sheet.metadata.name,
      visible
    })
  }

  /**
   * 设置工作表标签颜色
   * @param id 工作表 ID
   * @param color 颜色值（如 '#ff0000'）或 undefined 清除颜色
   */
  setSheetColor(id: string, color?: string): void {
    const sheet = this.sheets.get(id)
    if (!sheet) {
      throw new Error(`工作表 ID "${id}" 不存在`)
    }

    sheet.metadata.color = color

    // 触发事件
    this.emitEvent({
      type: 'sheetColorChanged',
      sheetId: id,
      sheetName: sheet.metadata.name,
      color
    })
  }

  // ==================== 事件系统 ====================

  /**
   * 添加事件监听器
   */
  on(type: WorkbookEventType, listener: WorkbookEventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set())
    }
    this.eventListeners.get(type)!.add(listener)
  }

  /**
   * 移除事件监听器
   */
  off(type: WorkbookEventType, listener: WorkbookEventListener): void {
    this.eventListeners.get(type)?.delete(listener)
  }

  /**
   * 触发事件
   */
  private emitEvent(event: WorkbookEvent): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (err) {
          console.error('[Workbook] 事件处理器错误:', err)
        }
      }
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 生成唯一的工作表名称
   */
  private generateUniqueName(): string {
    this.sheetCounter++
    let name = `Sheet${this.sheetCounter}`
    while (this.hasSheetName(name)) {
      this.sheetCounter++
      name = `Sheet${this.sheetCounter}`
    }
    return name
  }

  // ==================== 序列化 ====================

  /**
   * 创建工作簿快照（用于撤销/重做）
   */
  createSnapshot(): WorkbookSnapshot {
    const sheetsSnapshot = new Map<string, {
      metadata: SheetMetadata
      modelSnapshot: ModelSnapshot
    }>()

    for (const [id, sheet] of this.sheets.entries()) {
      sheetsSnapshot.set(id, {
        metadata: { ...sheet.metadata },
        modelSnapshot: sheet.model.createSnapshot()
      })
    }

    return {
      sheets: sheetsSnapshot,
      activeSheetId: this.activeSheetId
    }
  }

  /**
   * 从快照恢复工作簿状态
   */
  restoreFromSnapshot(snapshot: WorkbookSnapshot): void {
    // 清空当前工作表
    this.sheets.clear()

    // 恢复所有工作表
    for (const [id, data] of snapshot.sheets.entries()) {
      const model = new SheetModel()
      model.restoreFromSnapshot(data.modelSnapshot)
      
      this.sheets.set(id, {
        metadata: { ...data.metadata },
        model,
        viewState: createDefaultViewState()
      })
    }

    this.activeSheetId = snapshot.activeSheetId
  }

  /**
   * 导出为 JSON（用于持久化）
   */
  toJSON(): object {
    const sheets: Array<{
      metadata: SheetMetadata
      data: object
    }> = []

    for (const sheet of this.getAllSheets()) {
      sheets.push({
        metadata: { ...sheet.metadata },
        data: this.serializeModel(sheet.model)
      })
    }

    return {
      version: '1.0',
      activeSheetId: this.activeSheetId,
      sheetCounter: this.sheetCounter,
      sheets
    }
  }

  /**
   * 从 JSON 导入
   */
  static fromJSON(json: any): Workbook {
    const workbook = new Workbook()
    
    // 清空默认创建的工作表
    workbook.sheets.clear()
    workbook.sheetCounter = json.sheetCounter || 0

    // 导入所有工作表
    for (const sheetData of json.sheets || []) {
      const model = new SheetModel()
      workbook.deserializeModel(model, sheetData.data)
      
      workbook.sheets.set(sheetData.metadata.id, {
        metadata: { ...sheetData.metadata },
        model,
        viewState: sheetData.viewState || createDefaultViewState()
      })
    }

    const firstSheet = workbook.getAllSheets()[0]
    workbook.activeSheetId = json.activeSheetId || 
      (workbook.sheets.size > 0 && firstSheet ? firstSheet.metadata.id : '')

    return workbook
  }

  /**
   * 序列化单个 SheetModel（简化版，完整版需要遍历所有数据）
   */
  private serializeModel(model: SheetModel): object {
    const cells: Array<{ r: number; c: number; v: string }> = []
    model.forEach((r, c, cell) => {
      cells.push({ r, c, v: cell.value })
    })
    // TODO: 序列化样式、边框、合并单元格、图片等
    return { cells }
  }

  /**
   * 反序列化到 SheetModel
   */
  private deserializeModel(model: SheetModel, data: any): void {
    for (const cell of data.cells || []) {
      model.setValue(cell.r, cell.c, cell.v)
    }
    // TODO: 反序列化样式、边框、合并单元格、图片等
  }

  // ==================== 跨表引用支持 ====================

  /**
   * 根据工作表名称获取单元格值（用于跨表公式计算）
   * @param sheetName 工作表名称
   * @param row 行号
   * @param col 列号
   */
  getCellValueBySheetName(sheetName: string, row: number, col: number): string {
    const sheet = this.getSheetByName(sheetName)
    if (!sheet) {
      throw new Error(`工作表 "${sheetName}" 不存在`)
    }
    return sheet.model.getValue(row, col)
  }

  /**
   * 获取所有工作表名称列表
   */
  getSheetNames(): string[] {
    return this.getAllSheets().map(s => s.metadata.name)
  }
}
