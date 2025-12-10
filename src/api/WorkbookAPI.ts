/**
 * WorkbookAPI - 工作簿 API 包装
 * 
 * 提供对 Workbook 类的完整 API 描述和类型安全的包装
 */

import { Workbook, type SheetInfo, type SheetMetadata, type SheetViewState, type WorkbookEventType, type WorkbookEventListener, type WorkbookSnapshot } from '../lib/Workbook'
import { SheetModel } from '../lib/SheetModel'

/**
 * 工作簿 API 接口
 * 
 * 用于管理多个工作表（Sheet），支持工作表的增删改查、切换、排序等操作
 */
export interface IWorkbookAPI {
  // ==================== 工作表查询方法 ====================

  /**
   * 获取所有工作表信息（按顺序排列）
   * @returns 工作表信息数组
   * @example
   * ```ts
   * const sheets = workbook.getAllSheets()
   * sheets.forEach(sheet => console.log(sheet.metadata.name))
   * ```
   */
  getAllSheets(): SheetInfo[]

  /**
   * 获取所有可见的工作表
   * @returns 可见工作表信息数组
   */
  getVisibleSheets(): SheetInfo[]

  /**
   * 根据 ID 获取工作表
   * @param id 工作表唯一 ID
   * @returns 工作表信息，不存在则返回 undefined
   */
  getSheetById(id: string): SheetInfo | undefined

  /**
   * 根据名称获取工作表
   * @param name 工作表名称
   * @returns 工作表信息，不存在则返回 undefined
   * @example
   * ```ts
   * const sheet = workbook.getSheetByName('Sheet1')
   * if (sheet) {
   *   console.log(sheet.model.getValue(0, 0))
   * }
   * ```
   */
  getSheetByName(name: string): SheetInfo | undefined

  /**
   * 获取当前活动工作表
   * @returns 活动工作表信息
   */
  getActiveSheet(): SheetInfo | undefined

  /**
   * 获取当前活动工作表 ID
   * @returns 活动工作表 ID
   */
  getActiveSheetId(): string

  /**
   * 获取当前活动工作表的数据模型
   * @returns SheetModel 实例
   */
  getActiveModel(): SheetModel | undefined

  /**
   * 获取工作表数量
   * @returns 工作表数量
   */
  getSheetCount(): number

  /**
   * 检查工作表名称是否已存在
   * @param name 工作表名称
   * @returns 是否存在
   */
  hasSheetName(name: string): boolean

  /**
   * 获取所有工作表名称列表
   * @returns 名称数组
   */
  getSheetNames(): string[]

  // ==================== 工作表操作方法 ====================

  /**
   * 添加新工作表
   * @param name 工作表名称（可选，默认自动生成如 Sheet2）
   * @param index 插入位置（可选，默认添加到末尾）
   * @returns 新工作表的 ID
   * @throws 如果名称已存在则抛出错误
   * @example
   * ```ts
   * // 添加到末尾
   * const id1 = workbook.addSheet('数据表')
   * 
   * // 插入到第二个位置
   * const id2 = workbook.addSheet('汇总表', 1)
   * ```
   */
  addSheet(name?: string, index?: number): string

  /**
   * 删除工作表
   * @param id 工作表 ID
   * @returns 是否删除成功
   * @throws 如果是最后一个可见工作表则抛出错误
   */
  removeSheet(id: string): boolean

  /**
   * 重命名工作表
   * @param id 工作表 ID
   * @param newName 新名称
   * @throws 名称为空、包含非法字符、超过31字符、已存在时抛出错误
   * @example
   * ```ts
   * workbook.renameSheet(sheetId, '销售数据')
   * ```
   */
  renameSheet(id: string, newName: string): void

  /**
   * 复制工作表
   * @param id 源工作表 ID
   * @param newName 新名称（可选，默认为"原名称 (副本)"）
   * @returns 新工作表的 ID
   * @example
   * ```ts
   * const newId = workbook.duplicateSheet(originalId, '备份表')
   * ```
   */
  duplicateSheet(id: string, newName?: string): string

  /**
   * 移动工作表到新位置
   * @param id 工作表 ID
   * @param newIndex 新位置索引（0-based）
   * @example
   * ```ts
   * // 将工作表移动到第一个位置
   * workbook.moveSheet(sheetId, 0)
   * ```
   */
  moveSheet(id: string, newIndex: number): void

  /**
   * 切换活动工作表
   * @param id 工作表 ID
   * @throws 如果工作表不存在或已隐藏则抛出错误
   */
  setActiveSheet(id: string): void

  /**
   * 根据名称切换活动工作表
   * @param name 工作表名称
   * @throws 如果工作表不存在则抛出错误
   */
  setActiveSheetByName(name: string): void

  /**
   * 显示/隐藏工作表
   * @param id 工作表 ID
   * @param visible 是否可见
   * @throws 如果是最后一个可见工作表且要隐藏则抛出错误
   */
  setSheetVisibility(id: string, visible: boolean): void

  /**
   * 设置工作表标签颜色
   * @param id 工作表 ID
   * @param color 颜色值（如 '#ff0000'）或 undefined 清除颜色
   * @example
   * ```ts
   * workbook.setSheetColor(sheetId, '#3366ff')
   * workbook.setSheetColor(sheetId, undefined) // 清除颜色
   * ```
   */
  setSheetColor(id: string, color?: string): void

  // ==================== 视图状态管理 ====================

  /**
   * 保存工作表的视图状态（用于切换时保存/恢复）
   * @param id 工作表 ID
   * @param viewState 视图状态
   */
  saveSheetViewState(id: string, viewState: SheetViewState): void

  /**
   * 获取工作表的视图状态
   * @param id 工作表 ID
   * @returns 视图状态
   */
  getSheetViewState(id: string): SheetViewState | undefined

  // ==================== 事件系统 ====================

  /**
   * 添加事件监听器
   * @param type 事件类型
   * @param listener 监听器函数
   * @example
   * ```ts
   * workbook.on('sheetAdded', (event) => {
   *   console.log(`新增工作表: ${event.sheetName}`)
   * })
   * ```
   */
  on(type: WorkbookEventType, listener: WorkbookEventListener): void

  /**
   * 移除事件监听器
   * @param type 事件类型
   * @param listener 监听器函数
   */
  off(type: WorkbookEventType, listener: WorkbookEventListener): void

  // ==================== 跨表引用支持 ====================

  /**
   * 根据工作表名称获取单元格值（用于跨表公式计算）
   * @param sheetName 工作表名称
   * @param row 行号（0-based）
   * @param col 列号（0-based）
   * @returns 单元格值
   * @throws 如果工作表不存在则抛出错误
   * @example
   * ```ts
   * // 获取 Sheet2 的 A1 单元格值
   * const value = workbook.getCellValueBySheetName('Sheet2', 0, 0)
   * ```
   */
  getCellValueBySheetName(sheetName: string, row: number, col: number): string

  // ==================== 序列化 ====================

  /**
   * 创建工作簿快照（用于撤销/重做）
   * @returns 工作簿快照
   */
  createSnapshot(): WorkbookSnapshot

  /**
   * 从快照恢复工作簿状态
   * @param snapshot 工作簿快照
   */
  restoreFromSnapshot(snapshot: WorkbookSnapshot): void

  /**
   * 导出为 JSON（用于持久化）
   * @returns JSON 对象
   * @example
   * ```ts
   * const json = workbook.toJSON()
   * localStorage.setItem('workbook', JSON.stringify(json))
   * ```
   */
  toJSON(): object
}

/**
 * 工作簿事件类型说明
 */
export const WorkbookEventTypes = {
  /** 工作表添加 */
  sheetAdded: 'sheetAdded',
  /** 工作表删除 */
  sheetRemoved: 'sheetRemoved',
  /** 工作表重命名 */
  sheetRenamed: 'sheetRenamed',
  /** 工作表移动 */
  sheetMoved: 'sheetMoved',
  /** 工作表切换（激活） */
  sheetActivated: 'sheetActivated',
  /** 工作表可见性变更 */
  sheetVisibilityChanged: 'sheetVisibilityChanged',
  /** 工作表颜色变更 */
  sheetColorChanged: 'sheetColorChanged'
} as const

/**
 * 工作簿 API 包装类
 * 
 * @example
 * ```ts
 * import { WorkbookAPI } from './api/WorkbookAPI'
 * import { Workbook } from './lib/Workbook'
 * 
 * const workbook = new Workbook()
 * const api = new WorkbookAPI(workbook)
 * 
 * // 添加工作表
 * const sheetId = api.addSheet('数据表')
 * 
 * // 监听事件
 * api.on('sheetRenamed', (event) => {
 *   console.log(`${event.oldName} -> ${event.newName}`)
 * })
 * 
 * // 切换工作表
 * api.setActiveSheet(sheetId)
 * ```
 */
export class WorkbookAPI implements IWorkbookAPI {
  private workbook: Workbook

  constructor(workbook: Workbook) {
    this.workbook = workbook
  }

  // ==================== 工作表查询方法 ====================

  getAllSheets(): SheetInfo[] {
    return this.workbook.getAllSheets()
  }

  getVisibleSheets(): SheetInfo[] {
    return this.workbook.getVisibleSheets()
  }

  getSheetById(id: string): SheetInfo | undefined {
    return this.workbook.getSheetById(id)
  }

  getSheetByName(name: string): SheetInfo | undefined {
    return this.workbook.getSheetByName(name)
  }

  getActiveSheet(): SheetInfo | undefined {
    return this.workbook.getActiveSheet()
  }

  getActiveSheetId(): string {
    return this.workbook.getActiveSheetId()
  }

  getActiveModel(): SheetModel | undefined {
    return this.workbook.getActiveModel()
  }

  getSheetCount(): number {
    return this.workbook.getSheetCount()
  }

  hasSheetName(name: string): boolean {
    return this.workbook.hasSheetName(name)
  }

  getSheetNames(): string[] {
    return this.workbook.getSheetNames()
  }

  // ==================== 工作表操作方法 ====================

  addSheet(name?: string, index?: number): string {
    return this.workbook.addSheet(name, index)
  }

  removeSheet(id: string): boolean {
    return this.workbook.removeSheet(id)
  }

  renameSheet(id: string, newName: string): void {
    this.workbook.renameSheet(id, newName)
  }

  duplicateSheet(id: string, newName?: string): string {
    return this.workbook.duplicateSheet(id, newName)
  }

  moveSheet(id: string, newIndex: number): void {
    this.workbook.moveSheet(id, newIndex)
  }

  setActiveSheet(id: string): void {
    this.workbook.setActiveSheet(id)
  }

  setActiveSheetByName(name: string): void {
    this.workbook.setActiveSheetByName(name)
  }

  setSheetVisibility(id: string, visible: boolean): void {
    this.workbook.setSheetVisibility(id, visible)
  }

  setSheetColor(id: string, color?: string): void {
    this.workbook.setSheetColor(id, color)
  }

  // ==================== 视图状态管理 ====================

  saveSheetViewState(id: string, viewState: SheetViewState): void {
    this.workbook.saveSheetViewState(id, viewState)
  }

  getSheetViewState(id: string): SheetViewState | undefined {
    return this.workbook.getSheetViewState(id)
  }

  // ==================== 事件系统 ====================

  on(type: WorkbookEventType, listener: WorkbookEventListener): void {
    this.workbook.on(type, listener)
  }

  off(type: WorkbookEventType, listener: WorkbookEventListener): void {
    this.workbook.off(type, listener)
  }

  // ==================== 跨表引用支持 ====================

  getCellValueBySheetName(sheetName: string, row: number, col: number): string {
    return this.workbook.getCellValueBySheetName(sheetName, row, col)
  }

  // ==================== 序列化 ====================

  createSnapshot(): WorkbookSnapshot {
    return this.workbook.createSnapshot()
  }

  restoreFromSnapshot(snapshot: WorkbookSnapshot): void {
    this.workbook.restoreFromSnapshot(snapshot)
  }

  toJSON(): object {
    return this.workbook.toJSON()
  }

  /**
   * 从 JSON 创建工作簿
   * @param json JSON 数据
   * @returns 新的 WorkbookAPI 实例
   */
  static fromJSON(json: any): WorkbookAPI {
    return new WorkbookAPI(Workbook.fromJSON(json))
  }

  /**
   * 获取底层 Workbook 实例
   */
  getWorkbook(): Workbook {
    return this.workbook
  }
}

// 重新导出类型
export type { SheetInfo, SheetMetadata, SheetViewState, WorkbookEventType, WorkbookEventListener, WorkbookSnapshot }
