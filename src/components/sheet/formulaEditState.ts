/**
 * 公式编辑状态管理（代理层模式）
 * 
 * 核心职责：
 * 1. 统一管理 FormulaBar 和 RichTextInput 的编辑状态
 * 2. 支持编辑源切换（cell ↔ formulaBar）
 * 3. 支持跨 Sheet 公式引用
 * 
 * 设计原则：
 * - 单一数据源：所有编辑状态存储在这里
 * - 焦点独占：任意时刻只有一个编辑源拥有焦点
 * - 不存在竞争：input 和 formulaBar 不会同时更新状态
 */

import { reactive, computed } from 'vue'
import { parseAllFormulaReferences } from './references'
import type { FormulaReference } from './types'

// ==================== 调试日志 ====================

const DEBUG = true  // 开启调试日志

function log(category: string, message: string, data?: any) {
  if (!DEBUG) return
  const timestamp = new Date().toISOString().slice(11, 23)
  const prefix = `[${timestamp}] [FormulaEdit:${category}]`
  if (data !== undefined) {
    console.log(prefix, message, data)
  } else {
    console.log(prefix, message)
  }
}

// ==================== 类型定义 ====================

/**
 * 公式编辑状态
 */
export interface FormulaEditState {
  /** 是否正在编辑 */
  active: boolean
  /** 编辑来源：单元格内编辑器 或 公式栏 */
  source: 'cell' | 'formulaBar' | null
  /** 编辑模式：edit（编辑已有内容）或 typing（输入新内容） */
  mode: 'edit' | 'typing'
  /** 正在编辑的单元格所在 Sheet ID */
  sourceSheetId: string | null
  /** 正在编辑的单元格行号 */
  row: number
  /** 正在编辑的单元格列号 */
  col: number
  /** 原始值（用于取消时恢复） */
  originalValue: string
  /** 当前编辑的值 */
  currentValue: string
  /** 是否为公式模式（以 = 开头） */
  isFormulaMode: boolean
  /** 公式引用列表 */
  formulaReferences: FormulaReference[]
  /** 光标位置 */
  cursorPosition: number
  /** 选中范围（如果有） */
  selectionRange: { start: number; end: number } | null
  /** 是否处于可插入引用状态 */
  isInSelectableState: boolean
  /** 是否有文本选中（用于判断替换还是插入） */
  hasTextSelection: boolean
  /** 当前浏览的 Sheet ID（跨 Sheet 编辑时可能不同于 sourceSheetId） */
  currentSheetId: string | null
}

/**
 * 引用插入结果
 */
export interface InsertReferenceResult {
  /** 插入后的新文本 */
  newValue: string
  /** 新的光标位置 */
  newCursorPos: number
}

// ==================== 判断逻辑 ====================

// Excel 风格引用选择：操作符列表
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%', '!']

// 单元格引用正则表达式（仅本表引用）
const CELL_REF_REGEX = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g

// 跨 Sheet 引用正则表达式
// 匹配格式：'Sheet Name'!A1:B2 或 SheetName!A1:B2
// 必须排在单元格引用之前检查
const CROSS_SHEET_REF_REGEX = /(?:'([^']+)'|([A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*))!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/gi

/**
 * 判断当前光标位置是否可插入引用
 * 
 * 规则：光标前一个非空白字符必须是以下之一：
 * - `=` 等号
 * - `+` `-` `*` `/` `^` `&` 运算符
 * - `(` `,` `:` `<` `>` `!` 分隔符
 * - 或者光标在公式起始位置
 */
export function isInSelectablePosition(value: string, cursorPos: number): boolean {
  if (!value || !value.startsWith('=')) return false
  if (cursorPos <= 0) return false
  
  // 检查光标前一个字符是否是操作符
  const prevChar = value.charAt(cursorPos - 1)
  if (prevChar && OPERATORS.includes(prevChar)) {
    return true
  }
  
  // 检查从最后一个操作符到光标之间是否只有空格或者是单元格引用的开始部分
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = value.charAt(i)
    if (char && OPERATORS.includes(char)) {
      // 找到操作符，检查之间的内容
      const between = value.substring(i + 1, cursorPos)
      // 如果之间只有空格，则可选择
      if (/^\s*$/.test(between)) {
        return true
      }
      // 如果是合法的单元格引用开始部分（必须以字母或$开头，后面可以是字母、$、数字）
      // 例如：A, A1, $A, $A$1, AB, AB1 等
      // 不能是纯数字如 123
      if (/^\s*\$?[A-Z]+\$?\d*$/i.test(between)) {
        return true
      }
      break
    }
  }
  
  return false
}

/**
 * 查找光标位置要替换的引用
 * 支持跨 Sheet 引用和本表引用
 * @returns 要替换的引用的起始和结束位置，如果没有则返回 null
 */
export function findReferenceToReplace(
  value: string, 
  cursorPos: number
): { start: number; end: number; ref: string } | null {
  if (!value || !value.startsWith('=')) return null
  
  // 先检查跨 Sheet 引用（优先级更高，因为它包含本表引用作为子串）
  CROSS_SHEET_REF_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CROSS_SHEET_REF_REGEX.exec(value)) !== null) {
    const start = match.index
    const end = start + match[0].length
    
    // 检查光标是否在这个引用内或紧跟在后面
    if (cursorPos >= start && cursorPos <= end) {
      return {
        start,
        end,
        ref: match[0]
      }
    }
  }
  
  // 再检查本表引用
  CELL_REF_REGEX.lastIndex = 0
  while ((match = CELL_REF_REGEX.exec(value)) !== null) {
    const start = match.index
    const end = start + match[0].length
    
    // 检查这个引用是否是跨表引用的一部分（已被处理）
    // 检查前面是否有 ! 符号
    if (start > 0 && value.charAt(start - 1) === '!') {
      continue // 这是跨表引用的单元格部分，跳过
    }
    
    // 检查光标是否在这个引用内或紧跟在后面
    if (cursorPos >= start && cursorPos <= end) {
      return {
        start,
        end,
        ref: match[0]
      }
    }
  }
  
  return null
}

/**
 * 插入或替换单元格引用
 * 
 * 当前简化版本：暂时禁用"替换已有引用"功能，只支持：
 * 1. 替换选中文本
 * 2. 在光标位置插入
 * 
 * TODO: 后续重新实现"点击替换当前引用"功能
 */
export function insertOrReplaceReference(
  currentValue: string,
  cursorPos: number,
  selection: { start: number; end: number } | null,
  reference: string
): InsertReferenceResult {
  let newValue: string
  let newCursorPos: number
  
  // 情况 1：有文本选中 - 替换选中内容
  if (selection && selection.start !== selection.end) {
    const beforeSelection = currentValue.substring(0, selection.start)
    const afterSelection = currentValue.substring(selection.end)
    newValue = beforeSelection + reference + afterSelection
    newCursorPos = selection.start + reference.length
    return { newValue, newCursorPos }
  }
  
  // 情况 2：在光标位置插入（暂时禁用替换已有引用功能）
  const beforeCursor = currentValue.substring(0, cursorPos)
  const afterCursor = currentValue.substring(cursorPos)
  newValue = beforeCursor + reference + afterCursor
  newCursorPos = cursorPos + reference.length
  
  return { newValue, newCursorPos }
}

/**
 * 生成跨 Sheet 引用字符串
 */
export function formatCrossSheetReference(
  targetSheetName: string,
  startRow: number,
  startCol: number,
  endRow?: number,
  endCol?: number
): string {
  // 如果名称包含空格或特殊字符，需要用单引号包裹
  const needsQuotes = /[\s'!\[\]]/.test(targetSheetName)
  const quotedName = needsQuotes ? `'${targetSheetName.replace(/'/g, "''")}'` : targetSheetName
  
  // 生成单元格地址
  const startAddr = getCellAddress(startRow, startCol)
  
  if (endRow !== undefined && endCol !== undefined && (endRow !== startRow || endCol !== startCol)) {
    const endAddr = getCellAddress(endRow, endCol)
    return `${quotedName}!${startAddr}:${endAddr}`
  }
  
  return `${quotedName}!${startAddr}`
}

/**
 * 获取单元格地址（如 A1, B2）
 */
export function getCellAddress(row: number, col: number): string {
  let colName = ''
  let c = col
  while (c >= 0) {
    colName = String.fromCharCode(65 + (c % 26)) + colName
    c = Math.floor(c / 26) - 1
  }
  return `${colName}${row + 1}`
}

// ==================== 统一动作流程类型定义 ====================

/**
 * 编辑动作结果
 */
export interface EditActionResult {
  /** 是否成功 */
  success: boolean
  /** 需要执行的 UI 动作 */
  actions: EditUIAction[]
  /** 保存数据（confirm 时返回） */
  saveData?: { sheetId: string; row: number; col: number; value: string }
  /** 恢复数据（cancel 时返回） */
  restoreData?: { sheetId: string; row: number; col: number; value: string }
}

/**
 * UI 动作类型
 */
export type EditUIAction = 
  | { type: 'openOverlay'; row: number; col: number; value: string }
  | { type: 'closeOverlay' }
  | { type: 'syncOverlayValue'; value: string }
  | { type: 'focusFormulaBar' }
  | { type: 'focusOverlay' }
  | { type: 'switchSheet'; sheetId: string }
  | { type: 'selectCell'; row: number; col: number }
  | { type: 'setCellValue'; row: number; col: number; value: string }
  | { type: 'updateFormulaBarDisplay'; row: number; col: number; value: string }

// ==================== 状态管理器 ====================

/**
 * 创建公式编辑状态管理器
 */
export function createFormulaEditStateManager() {
  // 核心状态
  const state = reactive<FormulaEditState>({
    active: false,
    source: null,
    mode: 'edit',
    sourceSheetId: null,
    row: -1,
    col: -1,
    originalValue: '',
    currentValue: '',
    isFormulaMode: false,
    formulaReferences: [],
    cursorPosition: 0,
    selectionRange: null,
    isInSelectableState: false,
    hasTextSelection: false,
    currentSheetId: null
  })
  
  // 计算属性
  const isEditing = computed(() => state.active)
  const isCrossSheetEditing = computed(() => 
    state.active && state.sourceSheetId !== null && state.currentSheetId !== state.sourceSheetId
  )
  
  /**
   * 为 FormulaBar 和 RichTextInput 转换的公式引用格式
   * 包含字符串索引而不是行列索引
   */
  const textFormulaReferences = computed(() => {
    const refs = state.formulaReferences
    const text = state.currentValue
    const result: Array<{ ref: string; color: string; startIndex: number; endIndex: number }> = []
    
    if (!state.isFormulaMode || refs.length === 0) {
      return result
    }
    
    for (const ref of refs) {
      const textUpper = text.toUpperCase()
      const refUpper = ref.range.toUpperCase()
      
      let searchStart = 0
      while (searchStart < text.length) {
        const startIndex = textUpper.indexOf(refUpper, searchStart)
        if (startIndex === -1) break
        
        const endIndex = startIndex + ref.range.length
        result.push({
          ref: ref.range,
          color: ref.color,
          startIndex,
          endIndex
        })
        
        searchStart = endIndex
      }
    }
    
    return result
  })
  
  /**
   * 开始编辑
   */
  function startEdit(options: {
    sheetId: string
    row: number
    col: number
    value: string
    source: 'cell' | 'formulaBar'
    mode: 'edit' | 'typing'
  }) {
    log('startEdit', `source=${options.source}, mode=${options.mode}, cell=[${options.row},${options.col}]`, {
      sheetId: options.sheetId,
      value: options.value.substring(0, 50) + (options.value.length > 50 ? '...' : '')
    })
    
    state.active = true
    state.source = options.source
    state.mode = options.mode
    state.sourceSheetId = options.sheetId
    state.currentSheetId = options.sheetId
    state.row = options.row
    state.col = options.col
    state.originalValue = options.value
    state.currentValue = options.value
    state.isFormulaMode = options.value.startsWith('=')
    state.cursorPosition = options.value.length
    state.selectionRange = null
    state.hasTextSelection = false
    
    // 解析公式引用
    if (state.isFormulaMode) {
      state.formulaReferences = parseAllFormulaReferences(options.value)
      state.isInSelectableState = isInSelectablePosition(options.value, state.cursorPosition)
    } else {
      state.formulaReferences = []
      state.isInSelectableState = false
    }
    
    log('startEdit', `完成: isFormulaMode=${state.isFormulaMode}, isInSelectableState=${state.isInSelectableState}`)
  }
  
  /**
   * 切换编辑源（不结束编辑）
   * 用于在单元格编辑和公式栏编辑之间切换
   */
  function switchSource(newSource: 'cell' | 'formulaBar') {
    if (!state.active) {
      log('switchSource', '忽略: 未在编辑状态')
      return
    }
    
    const oldSource = state.source
    if (oldSource === newSource) {
      log('switchSource', `忽略: 源相同 (${newSource})`)
      return
    }
    
    log('switchSource', `${oldSource} → ${newSource}`, {
      currentValue: state.currentValue.substring(0, 30),
      cursorPosition: state.cursorPosition
    })
    
    state.source = newSource
    // 不改变其他状态（value, row, col, cursorPosition 等保持不变）
  }
  
  /**
   * 更新编辑值
   */
  function updateValue(value: string, cursorPos?: number) {
    const oldValue = state.currentValue
    const oldCursor = state.cursorPosition
    
    state.currentValue = value
    state.isFormulaMode = value.startsWith('=')
    
    if (cursorPos !== undefined) {
      state.cursorPosition = cursorPos
    }
    
    // 更新公式引用
    if (state.isFormulaMode) {
      state.formulaReferences = parseAllFormulaReferences(value)
      state.isInSelectableState = isInSelectablePosition(value, state.cursorPosition)
    } else {
      state.formulaReferences = []
      state.isInSelectableState = false
    }
    
    // 只在值或光标变化时记录日志
    if (oldValue !== value || oldCursor !== state.cursorPosition) {
      log('updateValue', `cursor: ${oldCursor} → ${state.cursorPosition}, isSelectable=${state.isInSelectableState}`, {
        value: value.substring(0, 50)
      })
    }
  }
  
  /**
   * 更新光标位置
   */
  function updateCursorPosition(pos: number, selection?: { start: number; end: number } | null) {
    const oldPos = state.cursorPosition
    const oldSelectable = state.isInSelectableState
    
    state.cursorPosition = pos
    state.selectionRange = selection ?? null
    state.hasTextSelection = selection ? selection.start !== selection.end : false
    
    // 更新可选择状态
    if (state.isFormulaMode) {
      state.isInSelectableState = isInSelectablePosition(state.currentValue, pos)
    }
    
    // 记录光标位置变化
    if (oldPos !== pos || oldSelectable !== state.isInSelectableState) {
      log('updateCursorPosition', `${oldPos} → ${pos}, isSelectable: ${oldSelectable} → ${state.isInSelectableState}`, {
        hasSelection: state.hasTextSelection,
        selectionRange: selection
      })
    }
  }
  
  /**
   * 切换当前 Sheet（跨 Sheet 编辑时）
   */
  function switchSheet(sheetId: string) {
    const oldSheetId = state.currentSheetId
    state.currentSheetId = sheetId
    
    log('switchSheet', `${oldSheetId} → ${sheetId}`, {
      sourceSheetId: state.sourceSheetId,
      isCrossSheet: sheetId !== state.sourceSheetId
    })
  }
  
  /**
   * 判断是否处于跨 Sheet 模式
   * 条件：活跃 + 公式栏编辑 + 公式模式 + 当前Sheet不是源Sheet
   */
  function isCrossSheetMode(currentSheetId: string): boolean {
    const result = state.active && 
                   state.source === 'formulaBar' &&
                   state.isFormulaMode &&
                   state.sourceSheetId !== currentSheetId
    
    if (result) {
      log('isCrossSheetMode', `true: 当前在 ${currentSheetId}, 源在 ${state.sourceSheetId}`)
    }
    
    return result
  }
  
  /**
   * 插入单元格引用
   */
  function insertReference(reference: string): InsertReferenceResult | null {
    if (!state.active || !state.isFormulaMode) {
      log('insertReference', '忽略: 未在公式编辑模式')
      return null
    }
    
    log('insertReference', `插入引用: ${reference}`, {
      cursorPosition: state.cursorPosition,
      isInSelectableState: state.isInSelectableState,
      hasTextSelection: state.hasTextSelection
    })
    
    const result = insertOrReplaceReference(
      state.currentValue,
      state.cursorPosition,
      state.hasTextSelection ? state.selectionRange : null,
      reference
    )
    
    // 更新状态
    state.currentValue = result.newValue
    state.cursorPosition = result.newCursorPos
    state.selectionRange = null
    state.hasTextSelection = false
    state.formulaReferences = parseAllFormulaReferences(result.newValue)
    state.isInSelectableState = isInSelectablePosition(result.newValue, result.newCursorPos)
    
    log('insertReference', `完成: newValue="${result.newValue}", newCursor=${result.newCursorPos}`)
    
    return result
  }
  
  /**
   * 插入跨 Sheet 引用
   */
  function insertCrossSheetReference(
    targetSheetName: string,
    startRow: number,
    startCol: number,
    endRow?: number,
    endCol?: number
  ): InsertReferenceResult | null {
    const reference = formatCrossSheetReference(targetSheetName, startRow, startCol, endRow, endCol)
    log('insertCrossSheetReference', `生成跨Sheet引用: ${reference}`)
    return insertReference(reference)
  }
  
  /**
   * 确认编辑
   * @returns 返回最终值，如果未在编辑则返回 null
   */
  function confirmEdit(): { sheetId: string; row: number; col: number; value: string } | null {
    if (!state.active) {
      log('confirmEdit', '忽略: 未在编辑状态')
      return null
    }
    
    const result = {
      sheetId: state.sourceSheetId!,
      row: state.row,
      col: state.col,
      value: state.currentValue
    }
    
    log('confirmEdit', `保存到 [${result.row},${result.col}]@${result.sheetId}`, {
      value: result.value.substring(0, 50)
    })
    
    reset()
    return result
  }
  
/**
 * 取消编辑
 * @returns 返回原始值和位置，如果未在编辑则返回 null
 */
function cancelEdit(): { sheetId: string; row: number; col: number; value: string } | null {
  if (!state.active) {
    log('cancelEdit', '忽略: 未在编辑状态')
    return null
  }
  
  const result = {
    sheetId: state.sourceSheetId!,
    row: state.row,
    col: state.col,
    value: state.originalValue
  }
  
  log('cancelEdit', `取消编辑，恢复到 [${result.row},${result.col}]@${result.sheetId}`)
  
  reset()
  return result
}

/**
 * 重置状态
 */
function reset() {
  log('reset', '重置编辑状态')
  
  state.active = false
  state.source = null
  state.mode = 'edit'
  state.sourceSheetId = null
  state.currentSheetId = null
  state.row = -1
  state.col = -1
  state.originalValue = ''
  state.currentValue = ''
  state.isFormulaMode = false
  state.formulaReferences = []
  state.cursorPosition = 0
  state.selectionRange = null
  state.isInSelectableState = false
  state.hasTextSelection = false
}

// ==================== 统一动作流程 ====================
// 类型 EditActionResult 和 EditUIAction 已在函数外部定义并导出

/**
 * 动作：开始单元格编辑
 * 触发：双击单元格 / F2 / 直接打字
 */
function actionStartCellEdit(options: {
  sheetId: string
  row: number
  col: number
  value: string
  mode: 'edit' | 'typing'
}): EditActionResult {
  log('action', `开始单元格编辑 [${options.row},${options.col}]`)
  
  startEdit({
    ...options,
    source: 'cell'
  })
  
  return {
    success: true,
    actions: [
      { type: 'openOverlay', row: options.row, col: options.col, value: options.value }
    ]
  }
}

/**
 * 动作：开始公式栏编辑
 * 触发：点击公式栏
 */
function actionStartFormulaBarEdit(options: {
  sheetId: string
  row: number
  col: number
  value: string
}): EditActionResult {
  log('action', `开始公式栏编辑 [${options.row},${options.col}]`)
  
  // 如果已在单元格编辑，切换到公式栏
  if (state.active && state.source === 'cell') {
    log('action', '从单元格切换到公式栏编辑')
    switchSource('formulaBar')
    return {
      success: true,
      actions: [
        { type: 'focusFormulaBar' }
        // 保持 overlay 显示，但焦点移到公式栏
      ]
    }
  }
  
  // 开始新的公式栏编辑
  startEdit({
    ...options,
    source: 'formulaBar',
    mode: 'edit'
  })
  
  return {
    success: true,
    actions: [
      // 公式栏编辑时也打开 overlay 同步显示
      { type: 'openOverlay', row: options.row, col: options.col, value: options.value },
      { type: 'focusFormulaBar' }
    ]
  }
}

/**
 * 动作：切换编辑源到公式栏
 * 触发：单元格编辑中点击公式栏（focus 事件）
 */
function actionSwitchToFormulaBar(): EditActionResult {
  if (!state.active) {
    log('action', '切换到公式栏失败: 未在编辑状态')
    return { success: false, actions: [] }
  }
  
  if (state.source === 'formulaBar') {
    log('action', '切换到公式栏: 已经是公式栏编辑')
    return { success: true, actions: [] }
  }
  
  log('action', '切换到公式栏编辑')
  switchSource('formulaBar')
  
  return {
    success: true,
    actions: [
      { type: 'focusFormulaBar' }
    ]
  }
}

/**
 * 动作：切换编辑源到单元格
 * 触发：公式栏编辑中双击单元格
 */
function actionSwitchToCell(): EditActionResult {
  if (!state.active) {
    log('action', '切换到单元格失败: 未在编辑状态')
    return { success: false, actions: [] }
  }
  
  if (state.source === 'cell') {
    log('action', '切换到单元格: 已经是单元格编辑')
    return { success: true, actions: [] }
  }
  
  log('action', '切换到单元格编辑')
  switchSource('cell')
  
  return {
    success: true,
    actions: [
      { type: 'openOverlay', row: state.row, col: state.col, value: state.currentValue },
      { type: 'focusOverlay' }
    ]
  }
}

/**
 * 动作：输入变化
 * 触发：FormulaBar 或 RichTextInput 的 input 事件
 */
function actionInput(value: string, cursorPos?: number): EditActionResult {
  if (!state.active) {
    return { success: false, actions: [] }
  }
  
  const oldSource = state.source
  updateValue(value, cursorPos)
  
  const actions: EditUIAction[] = []
  
  // 如果是公式栏编辑，同步到 overlay
  if (oldSource === 'formulaBar') {
    actions.push({ type: 'syncOverlayValue', value })
  }
  
  return { success: true, actions }
}

/**
 * 动作：确认编辑（Enter 键）
 * 触发：FormulaBar 或 RichTextInput 的 Enter 键
 */
function actionConfirm(): EditActionResult {
  if (!state.active) {
    log('action', '确认失败: 未在编辑状态')
    return { success: false, actions: [] }
  }
  
  const sourceSheetId = state.sourceSheetId!
  const currentSheetId = state.currentSheetId
  const row = state.row
  const col = state.col
  const value = state.currentValue
  
  log('action', `确认编辑 [${row},${col}]@${sourceSheetId}`)
  
  const saveData = confirmEdit()
  if (!saveData) {
    return { success: false, actions: [] }
  }
  
  const actions: EditUIAction[] = []
  
  // 如果跨 Sheet，先切回源 Sheet
  if (currentSheetId && currentSheetId !== sourceSheetId) {
    actions.push({ type: 'switchSheet', sheetId: sourceSheetId })
  }
  
  // 保存值
  actions.push({ type: 'setCellValue', row, col, value })
  
  // 关闭 overlay
  actions.push({ type: 'closeOverlay' })
  
  return {
    success: true,
    actions,
    saveData
  }
}

/**
 * 动作：确认编辑并移动（Tab 键）
 * 触发：FormulaBar 或 RichTextInput 的 Tab 键
 */
function actionConfirmAndMoveRight(): EditActionResult {
  const result = actionConfirm()
  if (!result.success || !result.saveData) {
    return result
  }
  
  const { row, col } = result.saveData
  // Tab 键向右移动逻辑：
  // - 不是最后一列时向右移动
  // - 最后一列时移动到下一行第一列
  // 注意：这里只提供基础的 col+1 逻辑，边界处理由 executeUIActions 的 selectCell 实现
  result.actions.push({ 
    type: 'selectCell', 
    row: row, 
    col: col + 1 
  })
  
  return result
}

/**
 * 动作：取消编辑（Escape 键）
 * 触发：FormulaBar 或 RichTextInput 的 Escape 键
 */
function actionCancel(): EditActionResult {
  if (!state.active) {
    log('action', '取消失败: 未在编辑状态')
    return { success: false, actions: [] }
  }
  
  const sourceSheetId = state.sourceSheetId!
  const currentSheetId = state.currentSheetId
  const row = state.row
  const col = state.col
  const originalValue = state.originalValue
  
  log('action', `取消编辑 [${row},${col}]@${sourceSheetId}`)
  
  const restoreData = cancelEdit()
  if (!restoreData) {
    return { success: false, actions: [] }
  }
  
  const actions: EditUIAction[] = []
  
  // 如果跨 Sheet，先切回源 Sheet
  if (currentSheetId && currentSheetId !== sourceSheetId) {
    actions.push({ type: 'switchSheet', sheetId: sourceSheetId })
  }
  
  // 关闭 overlay
  actions.push({ type: 'closeOverlay' })
  
  // 恢复公式栏显示原值
  actions.push({ type: 'updateFormulaBarDisplay', row, col, value: originalValue })
  
  return {
    success: true,
    actions,
    restoreData
  }
}

/**
 * 动作：失焦确认（Blur 事件）
 * 触发：FormulaBar 的 blur 事件
 * 注意：公式模式且可选择状态时不触发（用户在点击单元格）
 */
function actionBlurConfirm(): EditActionResult {
  if (!state.active) {
    return { success: false, actions: [] }
  }
  
  // 公式模式且可选择状态，不确认（用户在点击单元格选择引用）
  if (state.isFormulaMode && state.isInSelectableState) {
    log('action', '失焦忽略: 公式模式可选择状态')
    return { success: false, actions: [] }
  }
  
  log('action', '失焦确认')
  return actionConfirm()
}

/**
 * 动作：选区变化时处理
 * 触发：CanvasSheet 的 selection-change 事件
 * @returns 是否消费了此事件（公式模式插入引用时返回 true）
 */
function actionSelectionChange(
  currentSheetId: string,
  _selection: { row: number; col: number },
  range: { startRow: number; startCol: number; endRow: number; endCol: number },
  getSheetName: () => string
): { consumed: boolean; actions: EditUIAction[] } {
  // 不在编辑状态，不处理
  if (!state.active) {
    return { consumed: false, actions: [] }
  }
  
  // 只有公式栏编辑 + 公式模式 + 可插入状态才处理
  if (state.source !== 'formulaBar' || !state.isFormulaMode || !state.isInSelectableState) {
    return { consumed: false, actions: [] }
  }
  
  log('action', '选区变化，准备插入引用')
  
  let reference: string
  
  // 判断是否跨 Sheet
  if (isCrossSheetMode(currentSheetId)) {
    const sheetName = getSheetName()
    log('action', `跨Sheet模式，目标Sheet: ${sheetName}`)
    
    // 判断是单个单元格还是范围
    const { startRow, startCol, endRow, endCol } = range
    if (startRow === endRow && startCol === endCol) {
      reference = formatCrossSheetReference(sheetName, startRow, startCol)
    } else {
      reference = formatCrossSheetReference(sheetName, startRow, startCol, endRow, endCol)
    }
  } else {
    // 同 Sheet 引用
    const { startRow, startCol, endRow, endCol } = range
    if (startRow === endRow && startCol === endCol) {
      reference = getCellAddress(startRow, startCol)
    } else {
      reference = `${getCellAddress(startRow, startCol)}:${getCellAddress(endRow, endCol)}`
    }
  }
  
  log('action', `插入引用: ${reference}`)
  insertReference(reference)
  
  return {
    consumed: true,
    actions: [
      { type: 'syncOverlayValue', value: state.currentValue }
    ]
  }
}

/**
 * 动作：切换 Sheet
 * 触发：点击 Sheet 标签
 * @returns 是否允许切换
 */
function actionSheetChange(targetSheetId: string): { 
  allowSwitch: boolean
  actions: EditUIAction[] 
  needConfirm?: boolean
} {
  // 不在编辑状态，允许切换
  if (!state.active) {
    return { allowSwitch: true, actions: [] }
  }
  
  // 单元格编辑 → 需要先确认编辑
  if (state.source === 'cell') {
    log('action', 'Sheet切换: 单元格编辑中，需要先确认')
    return { 
      allowSwitch: true, 
      actions: [],
      needConfirm: true  // 让调用方先调用 confirmEditing
    }
  }
  
  // 公式栏编辑
  if (state.source === 'formulaBar') {
    if (state.isFormulaMode) {
      // 公式模式 → 进入跨 Sheet 模式，只切换显示
      log('action', 'Sheet切换: 公式栏公式模式，进入跨Sheet模式')
      switchSheet(targetSheetId)
      return { allowSwitch: true, actions: [] }
    } else {
      // 非公式模式 → 需要先确认编辑
      log('action', 'Sheet切换: 公式栏非公式模式，需要先确认')
      return { 
        allowSwitch: true, 
        actions: [],
        needConfirm: true
      }
    }
  }
  
  return { allowSwitch: true, actions: [] }
}

/**
 * 动作：确认编辑并向下移动（Enter 键默认行为）
 * 触发：RichTextInput 的 Enter 键
 */
function actionConfirmAndMoveDown(): EditActionResult {
  const result = actionConfirm()
  if (!result.success || !result.saveData) {
    return result
  }
  
  // 添加移动到下一行的动作
  result.actions.push({ 
    type: 'selectCell', 
    row: result.saveData.row + 1, 
    col: result.saveData.col 
  })
  
  return result
}

/**
 * 动作：光标位置变化
 * 触发：FormulaBar 或 RichTextInput 光标移动
 * 用于更新 isInSelectableState
 */
function actionCursorPositionChange(
  cursorPos: number,
  selection?: { start: number; end: number } | null
): EditActionResult {
  if (!state.active) {
    return { success: false, actions: [] }
  }
  
  updateCursorPosition(cursorPos, selection)
  
  return { success: true, actions: [] }
}

/**
 * 动作：双击请求编辑（跨 Sheet 公式模式下）
 * 触发：CanvasSheet emit('request-edit')
 * 当用户在公式栏编辑公式时双击单元格，切换到单元格编辑
 */
function actionRequestEdit(row: number, col: number): EditActionResult {
  // 不在编辑状态
  if (!state.active) {
    return { success: false, actions: [] }
  }
  
  // 如果是公式栏编辑 + 公式模式，切换到单元格编辑
  if (state.source === 'formulaBar' && state.isFormulaMode) {
    log('action', `双击请求编辑，从公式栏切换到单元格 [${row},${col}]`)
    switchSource('cell')
    
    return {
      success: true,
      actions: [
        { type: 'selectCell', row: state.row, col: state.col },
        { type: 'openOverlay', row: state.row, col: state.col, value: state.currentValue },
        { type: 'focusOverlay' }
      ]
    }
  }
  
  return { success: false, actions: [] }
}

/**
 * 动作：单元格编辑状态变化
 * 触发：CanvasSheet emit('editing-state-change')
 * 处理来自 CanvasSheet 的编辑状态变化通知
 */
function actionEditingStateChange(payload: {
  isEditing: boolean
  row: number
  col: number
  value: string
  mode?: 'edit' | 'typing'
  cursorPosition?: number
  sheetId: string
}): EditActionResult {
  if (payload.isEditing) {
    // 开始编辑
    // 如果当前不在编辑或者是单元格编辑，则更新状态
    if (!state.active || state.source === 'cell') {
      startEdit({
        source: 'cell',
        sheetId: payload.sheetId,
        row: payload.row,
        col: payload.col,
        value: payload.value,
        mode: payload.mode ?? 'edit'
      })
      
      if (payload.cursorPosition !== undefined) {
        updateCursorPosition(payload.cursorPosition)
      }
      
      return { success: true, actions: [] }
    }
  } else {
    // 结束编辑
    if (state.active && state.source === 'cell') {
      log('action', '单元格编辑结束')
      reset()
      return { success: true, actions: [] }
    }
  }
  
  return { success: false, actions: [] }
}

  return {
    // 状态（只读）
    state: state as Readonly<FormulaEditState>,
    
    // 计算属性
    isEditing,
    isCrossSheetEditing,
    textFormulaReferences,
    
    // 基础方法
    startEdit,
    switchSource,
    updateValue,
    updateCursorPosition,
    switchSheet,
    isCrossSheetMode,
    insertReference,
    insertCrossSheetReference,
    confirmEdit,
    cancelEdit,
    reset,
    
    // 统一动作流程 (新增)
    actionStartCellEdit,
    actionStartFormulaBarEdit,
    actionSwitchToFormulaBar,
    actionSwitchToCell,
    actionInput,
    actionConfirm,
    actionConfirmAndMoveRight,
    actionConfirmAndMoveDown,
    actionCancel,
    actionBlurConfirm,
    actionCursorPositionChange,
    actionSelectionChange,
    actionSheetChange,
    actionRequestEdit,
    actionEditingStateChange
  }
}

export type FormulaEditStateManager = ReturnType<typeof createFormulaEditStateManager>

// 注意：EditActionResult 和 EditUIAction 类型已在文件上方通过 export interface/type 导出
