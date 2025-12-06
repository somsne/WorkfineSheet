/**
 * 公式编辑状态管理
 * 
 * 核心职责：
 * 1. 管理编辑状态（active, source, row, col, value 等）
 * 2. 管理公式引用解析
 * 3. 支持跨 Sheet 公式引用
 * 
 * 设计原则：
 * - 单一数据源：所有编辑状态存储在这里
 * - 纯状态管理：不包含 UI 控制逻辑
 */

import { reactive, computed } from 'vue'
import { parseAllFormulaReferences } from './references'
import { generateFormulaHtmlFromRefs } from './formulaEditUtils'
import type { FormulaReference } from './types'

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
  /** 当前光标位置的可编辑引用（用于替换） */
  currentEditableRef: { start: number; end: number; ref: string } | null
  
  // ===== 方向键选择模式 =====
  /** 方向键调整引用功能是否启用（点击输入框时禁用，点击 sheet 选择引用时启用） */
  arrowSelectEnabled: boolean
  /** 是否处于方向键选择模式（通过方向键选择了引用后进入） */
  arrowSelectMode: boolean
  /** 方向键选择的当前行 */
  arrowSelectRow: number
  /** 方向键选择的当前列 */
  arrowSelectCol: number
  /** 方向键选择的 Sheet ID（跨 Sheet 时使用） */
  arrowSelectSheetId: string | null
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

// ==================== 纯函数工具 ====================

// Excel 风格引用选择：操作符列表
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%', '!']

/**
 * 判断当前光标位置是否可插入引用
 */
export function isInSelectablePosition(value: string, cursorPos: number): boolean {
  if (!value || !value.startsWith('=')) {
    console.log('[isInSelectablePosition] 不是公式', { value, cursorPos })
    return false
  }
  if (cursorPos <= 0) {
    console.log('[isInSelectablePosition] 光标位置无效', { value, cursorPos })
    return false
  }
  
  const prevChar = value.charAt(cursorPos - 1)
  if (prevChar && OPERATORS.includes(prevChar)) {
    console.log('[isInSelectablePosition] 前一个字符是操作符', { value, cursorPos, prevChar })
    return true
  }
  
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = value.charAt(i)
    if (char && OPERATORS.includes(char)) {
      const between = value.substring(i + 1, cursorPos)
      if (/^\s*$/.test(between)) {
        console.log('[isInSelectablePosition] 操作符后只有空白', { value, cursorPos, char, between })
        return true
      }
      if (/^\s*\$?[A-Z]+\$?\d*$/i.test(between)) {
        console.log('[isInSelectablePosition] 正在输入引用', { value, cursorPos, char, between })
        return true
      }
      console.log('[isInSelectablePosition] 操作符后不是引用', { value, cursorPos, char, between })
      break
    }
  }
  
  console.log('[isInSelectablePosition] 未找到操作符', { value, cursorPos })
  return false
}

/**
 * 查找需要替换的引用
 * 返回光标位置附近的单元格引用信息
 * 
 * 优先匹配跨 Sheet 引用，避免只匹配到引用的一部分
 */
export function findReferenceToReplace(
  value: string,
  cursorPos: number
): { start: number; end: number; ref: string } | null {
  if (!value || !value.startsWith('=')) return null
  
  // 跨 Sheet 引用正则：'Sheet Name'!A1:B2 或 Sheet1!A1:B2
  // 注意：使用 [^\s!()\[\],:+\-*/&<>=^%]+ 匹配非引号的 Sheet 名称（支持中文等非 ASCII 字符）
  const crossSheetRefPattern = /(?:'[^']+'|[^\s!()\[\],:+\-*/&<>=^%]+)!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/gi
  // 普通引用正则：A1:B2 或 A1
  const simpleRefPattern = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/gi
  
  // 收集所有匹配（跨 Sheet 优先）
  const allMatches: Array<{ start: number; end: number; ref: string; isCrossSheet: boolean }> = []
  
  // 先收集跨 Sheet 引用
  let match: RegExpExecArray | null
  crossSheetRefPattern.lastIndex = 0
  while ((match = crossSheetRefPattern.exec(value)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      ref: match[0],
      isCrossSheet: true
    })
  }
  
  // 再收集普通引用
  simpleRefPattern.lastIndex = 0
  while ((match = simpleRefPattern.exec(value)) !== null) {
    const start = match.index
    const end = start + match[0].length
    
    // 检查这个普通引用是否被跨 Sheet 引用包含
    const isPartOfCrossSheet = allMatches.some(m => 
      m.isCrossSheet && start >= m.start && end <= m.end
    )
    
    if (!isPartOfCrossSheet) {
      allMatches.push({
        start,
        end,
        ref: match[0],
        isCrossSheet: false
      })
    }
  }
  
  console.log('[findReferenceToReplace]', {
    value,
    cursorPos,
    allMatches
  })
  
  // 找到光标位置所在的引用
  for (const m of allMatches) {
    if (cursorPos >= m.start && cursorPos <= m.end) {
      console.log('[findReferenceToReplace] 找到匹配', m)
      return { start: m.start, end: m.end, ref: m.ref }
    }
  }
  
  console.log('[findReferenceToReplace] 未找到匹配')
  return null
}

/**
 * 插入或替换单元格引用
 * 
 * 替换逻辑优先级：
 * 1. 如果有文本选中，替换选中内容
 * 2. 如果光标位置在引用中（如 "A1" 或 "Sheet1!A1"），替换该引用
 * 3. 如果光标在操作符后面正在输入引用（如 "=SUM(A"），替换正在输入的部分
 * 4. 否则，在光标位置插入
 */
export function insertOrReplaceReference(
  currentValue: string,
  cursorPos: number,
  selection: { start: number; end: number } | null,
  reference: string
): InsertReferenceResult {
  let newValue: string
  let newCursorPos: number
  
  // 有文本选中 - 替换选中内容
  if (selection && selection.start !== selection.end) {
    const beforeSelection = currentValue.substring(0, selection.start)
    const afterSelection = currentValue.substring(selection.end)
    newValue = beforeSelection + reference + afterSelection
    newCursorPos = selection.start + reference.length
    return { newValue, newCursorPos }
  }
  
  // 查找光标位置附近的已存在引用
  const existingRef = findReferenceToReplace(currentValue, cursorPos)
  if (existingRef) {
    // 替换已存在的引用
    const beforeRef = currentValue.substring(0, existingRef.start)
    const afterRef = currentValue.substring(existingRef.end)
    newValue = beforeRef + reference + afterRef
    newCursorPos = existingRef.start + reference.length
    return { newValue, newCursorPos }
  }
  
  // 查找光标前正在输入的引用片段（如 "A" 或 "A1" 或 "Sheet1!A"）
  const partialRef = findPartialReferenceBeforeCursor(currentValue, cursorPos)
  if (partialRef) {
    // 替换正在输入的部分引用
    const beforePartial = currentValue.substring(0, partialRef.start)
    const afterCursor = currentValue.substring(cursorPos)
    newValue = beforePartial + reference + afterCursor
    newCursorPos = partialRef.start + reference.length
    return { newValue, newCursorPos }
  }
  
  // 在光标位置插入
  const beforeCursor = currentValue.substring(0, cursorPos)
  const afterCursor = currentValue.substring(cursorPos)
  newValue = beforeCursor + reference + afterCursor
  newCursorPos = cursorPos + reference.length
  
  return { newValue, newCursorPos }
}

/**
 * 查找光标前正在输入的部分引用
 * 例如：=SUM(A 中的 "A"，或 =Sheet1!B 中的 "Sheet1!B"
 */
export function findPartialReferenceBeforeCursor(
  value: string,
  cursorPos: number
): { start: number; partial: string } | null {
  if (!value || !value.startsWith('=') || cursorPos <= 0) return null
  
  // 从光标位置向前查找，直到遇到操作符
  let startPos = cursorPos
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = value.charAt(i)
    if (OPERATORS.includes(char)) {
      startPos = i + 1
      break
    }
    if (i === 0) {
      startPos = 1 // 跳过 '='
    }
  }
  
  const partial = value.substring(startPos, cursorPos)
  
  // 如果是空白或者只有空白，不算部分引用
  if (!partial || /^\s*$/.test(partial)) return null
  
  // 检查是否看起来像部分引用（字母、数字、$、!、' 的组合）
  if (/^[\s]*(?:'[^']*'?|[A-Z$\d!])+$/i.test(partial)) {
    return { start: startPos, partial }
  }
  
  return null
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
  const needsQuotes = /[\s'!\[\]]/.test(targetSheetName)
  const quotedName = needsQuotes ? `'${targetSheetName.replace(/'/g, "''")}'` : targetSheetName
  const startAddr = getCellAddress(startRow, startCol)
  
  if (endRow !== undefined && endCol !== undefined && (endRow !== startRow || endCol !== startCol)) {
    const endAddr = getCellAddress(endRow, endCol)
    return `${quotedName}!${startAddr}:${endAddr}`
  }
  
  return `${quotedName}!${startAddr}`
}

/**
 * 解析单元格引用字符串，返回行列位置和 Sheet 名称
 * 支持格式：A1, Sheet1!A1, 'Sheet Name'!A1, A1:B2, Sheet1!A1:B2
 */
export function parseCellReference(ref: string): {
  sheetName?: string
  startRow: number
  startCol: number
  endRow?: number
  endCol?: number
} | null {
  if (!ref) return null
  
  // 匹配 Sheet 名称（可选）和单元格引用
  // 格式: ['Sheet Name'!]A1[:B2] 或 [SheetName!]A1[:B2]
  const match = ref.match(/^(?:(?:'([^']+)'|([^\s!()\[\],:+\-*/&<>=^%]+))!)?(\$?[A-Z]+)(\$?\d+)(?::(\$?[A-Z]+)(\$?\d+))?$/i)
  
  if (!match) return null
  
  const sheetName = match[1] || match[2] // 引号内的名称或普通名称
  const startColStr = match[3]?.replace('$', '')
  const startRowStr = match[4]?.replace('$', '')
  
  // 如果没有列或行字符串，返回 null（正则匹配成功时不应发生）
  if (!startColStr || !startRowStr) return null
  const endColStr = match[5]?.replace('$', '')
  const endRowStr = match[6]?.replace('$', '')
  
  // 将列字母转换为数字（A=0, B=1, ...）
  const colToNum = (col: string): number => {
    let result = 0
    for (let i = 0; i < col.length; i++) {
      result = result * 26 + (col.charCodeAt(i) - 64)
    }
    return result - 1
  }
  
  const startCol = colToNum(startColStr.toUpperCase())
  const startRow = parseInt(startRowStr, 10) - 1
  
  const result: ReturnType<typeof parseCellReference> = {
    startRow,
    startCol
  }
  
  if (sheetName) {
    result.sheetName = sheetName
  }
  
  if (endColStr && endRowStr) {
    result.endRow = parseInt(endRowStr, 10) - 1
    result.endCol = colToNum(endColStr.toUpperCase())
  }
  
  return result
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
    currentSheetId: null,
    currentEditableRef: null,
    // 方向键选择模式
    arrowSelectEnabled: true,  // 默认启用（新建公式时）
    arrowSelectMode: false,
    arrowSelectRow: 0,
    arrowSelectCol: 0,
    arrowSelectSheetId: null
  })
  
  // ==================== 计算属性 ====================
  
  /** 是否正在编辑 */
  const isEditing = computed(() => state.active)
  
  /** 是否跨 Sheet 模式（在非源 Sheet 上浏览） */
  const isCrossSheetMode = computed(() => 
    state.active && state.sourceSheetId !== null && state.currentSheetId !== null && state.sourceSheetId !== state.currentSheetId
  )
  
  /** 是否应该插入引用（点击单元格时判断） */
  const shouldInsertReference = computed(() =>
    state.active && state.isFormulaMode && state.isInSelectableState
  )
  
  /**
   * 公式引用（带文本索引）
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
   * 生成 displayHtml
   */
  const displayHtml = computed(() => {
    console.log('[FormulaEditManager.displayHtml] 计算 displayHtml', {
      currentValue: state.currentValue,
      isFormulaMode: state.isFormulaMode,
      isInSelectableState: state.isInSelectableState,
      currentEditableRef: state.currentEditableRef,
      refsCount: textFormulaReferences.value.length
    })
    return generateFormulaHtmlFromRefs(
      state.currentValue,
      textFormulaReferences.value,
      state.isFormulaMode,
      state.isInSelectableState,
      state.currentEditableRef
    )
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
    console.log('[FormulaEditManager.startEdit]', options)
    
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
    
    // 新建公式时启用方向键调整引用功能，编辑已有公式时禁用
    // typing 模式表示新输入，edit 模式表示编辑已有内容
    state.arrowSelectEnabled = options.mode === 'typing'
    state.arrowSelectMode = false
    state.arrowSelectRow = 0
    state.arrowSelectCol = 0
    state.arrowSelectSheetId = null
    
    if (state.isFormulaMode) {
      state.formulaReferences = parseAllFormulaReferences(options.value)
      state.isInSelectableState = isInSelectablePosition(options.value, state.cursorPosition)
      // 初始化当前光标位置的可编辑引用
      state.currentEditableRef = findReferenceToReplace(options.value, state.cursorPosition)
    } else {
      state.formulaReferences = []
      state.isInSelectableState = false
      state.currentEditableRef = null
    }
    
    console.log('[FormulaEditManager.startEdit] 完成', {
      isFormulaMode: state.isFormulaMode,
      isInSelectableState: state.isInSelectableState,
      sourceSheetId: state.sourceSheetId,
      currentSheetId: state.currentSheetId,
      currentEditableRef: state.currentEditableRef
    })
  }
  
  /**
   * 更新编辑值
   */
  function updateValue(value: string, cursorPos?: number) {
    state.currentValue = value
    state.isFormulaMode = value.startsWith('=')
    
    if (cursorPos !== undefined) {
      state.cursorPosition = cursorPos
    }
    
    if (state.isFormulaMode) {
      state.formulaReferences = parseAllFormulaReferences(value)
      state.isInSelectableState = isInSelectablePosition(value, state.cursorPosition)
      // 更新当前光标位置的可编辑引用
      state.currentEditableRef = findReferenceToReplace(value, state.cursorPosition)
    } else {
      state.formulaReferences = []
      state.isInSelectableState = false
      state.currentEditableRef = null
    }
    
    console.log('[FormulaEditManager.updateValue]', {
      value,
      cursorPos,
      isFormulaMode: state.isFormulaMode,
      isInSelectableState: state.isInSelectableState,
      currentEditableRef: state.currentEditableRef
    })
  }
  
  /**
   * 更新光标位置
   */
  function updateCursorPosition(pos: number, selection?: { start: number; end: number } | null) {
    state.cursorPosition = pos
    state.selectionRange = selection ?? null
    state.hasTextSelection = selection ? selection.start !== selection.end : false
    
    if (state.isFormulaMode) {
      state.isInSelectableState = isInSelectablePosition(state.currentValue, pos)
      // 更新当前光标位置的可编辑引用
      state.currentEditableRef = findReferenceToReplace(state.currentValue, pos)
      console.log('[FormulaEditManager.updateCursorPosition] 更新 currentEditableRef', {
        pos,
        currentEditableRef: state.currentEditableRef
      })
    } else {
      state.currentEditableRef = null
    }
  }
  
  /**
   * 切换当前 Sheet
   */
  function switchSheet(sheetId: string) {
    console.log('[FormulaEditManager.switchSheet]', {
      from: state.currentSheetId,
      to: sheetId,
      sourceSheetId: state.sourceSheetId,
      active: state.active,
      isInSelectableState: state.isInSelectableState
    })
    state.currentSheetId = sheetId
  }
  
  /**
   * 切换编辑来源（cell <-> formulaBar）
   * 用于焦点在两个编辑器之间切换时同步状态
   */
  function switchSource(source: 'cell' | 'formulaBar') {
    if (!state.active) return
    state.source = source
  }
  
  /**
   * 插入单元格引用
   */
  function insertReference(reference: string): InsertReferenceResult | null {
    if (!state.active || !state.isFormulaMode) {
      return null
    }
    
    console.log('[FormulaEditManager.insertReference] 开始', {
      currentValue: state.currentValue,
      cursorPosition: state.cursorPosition,
      reference,
      arrowSelectMode: state.arrowSelectMode
    })
    
    const result = insertOrReplaceReference(
      state.currentValue,
      state.cursorPosition,
      state.hasTextSelection ? state.selectionRange : null,
      reference
    )
    
    console.log('[FormulaEditManager.insertReference] 结果', {
      newValue: result.newValue,
      newCursorPos: result.newCursorPos
    })
    
    state.currentValue = result.newValue
    state.cursorPosition = result.newCursorPos
    state.selectionRange = null
    state.hasTextSelection = false
    state.formulaReferences = parseAllFormulaReferences(result.newValue)
    state.isInSelectableState = isInSelectablePosition(result.newValue, result.newCursorPos)
    
    // 更新 currentEditableRef 指向刚刚插入的引用
    state.currentEditableRef = findReferenceToReplace(result.newValue, result.newCursorPos)
    console.log('[FormulaEditManager.insertReference] 更新 currentEditableRef', {
      currentEditableRef: state.currentEditableRef
    })
    
    return result
  }
  
  /**
   * 确认编辑
   */
  function confirmEdit(): { sheetId: string; row: number; col: number; value: string } | null {
    if (!state.active) {
      return null
    }
    
    const result = {
      sheetId: state.sourceSheetId!,
      row: state.row,
      col: state.col,
      value: state.currentValue
    }
    
    reset()
    return result
  }
  
  /**
   * 取消编辑
   */
  function cancelEdit(): { sheetId: string; row: number; col: number; value: string } | null {
    if (!state.active) {
      return null
    }
    
    const result = {
      sheetId: state.sourceSheetId!,
      row: state.row,
      col: state.col,
      value: state.originalValue
    }
    
    reset()
    return result
  }
  
  /**
   * 重置状态
   */
  function reset() {
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
    state.currentEditableRef = null
    // 方向键选择模式
    state.arrowSelectEnabled = true  // 重置为启用（下次新建公式时生效）
    state.arrowSelectMode = false
    state.arrowSelectRow = 0
    state.arrowSelectCol = 0
    state.arrowSelectSheetId = null
  }
  
  /**
   * 进入方向键选择模式
   * @param row 选择的行
   * @param col 选择的列
   * @param sheetId 选择的 Sheet（跨 Sheet 时）
   */
  function enterArrowSelectMode(row: number, col: number, sheetId?: string) {
    state.arrowSelectMode = true
    state.arrowSelectRow = row
    state.arrowSelectCol = col
    state.arrowSelectSheetId = sheetId ?? state.currentSheetId
    console.log('[FormulaEditManager.enterArrowSelectMode]', {
      row, col, sheetId: state.arrowSelectSheetId
    })
  }
  
  /**
   * 退出方向键选择模式（输入字符时调用）
   */
  function exitArrowSelectMode() {
    if (state.arrowSelectMode) {
      console.log('[FormulaEditManager.exitArrowSelectMode]')
      state.arrowSelectMode = false
    }
  }
  
  /**
   * 禁用方向键调整引用功能
   * 当用户点击 FormulaBar 或 CellOverlay 输入区域时调用
   */
  function disableArrowSelect() {
    console.log('[FormulaEditManager.disableArrowSelect]')
    state.arrowSelectEnabled = false
    state.arrowSelectMode = false
  }
  
  /**
   * 启用方向键调整引用功能
   * 当用户点击 sheet 选择引用时调用
   */
  function enableArrowSelect() {
    console.log('[FormulaEditManager.enableArrowSelect]')
    state.arrowSelectEnabled = true
  }
  
  /**
   * 更新方向键选择位置（点击选择新区域时调用）
   * 不改变 arrowSelectMode 状态，只更新位置
   * @param row 新的行位置
   * @param col 新的列位置
   * @param sheetId 新的 Sheet ID（可选）
   */
  function updateArrowSelectPosition(row: number, col: number, sheetId?: string) {
    state.arrowSelectRow = row
    state.arrowSelectCol = col
    if (sheetId !== undefined) {
      state.arrowSelectSheetId = sheetId
    }
    console.log('[FormulaEditManager.updateArrowSelectPosition]', {
      row, col, sheetId: state.arrowSelectSheetId
    })
  }
  
  /**
   * 方向键移动选择
   * @param direction 方向
   * @returns 新的选择位置，如果不在方向键选择模式则返回 null
   */
  function arrowMove(direction: 'up' | 'down' | 'left' | 'right'): { row: number; col: number } | null {
    if (!state.arrowSelectMode) return null
    
    let { arrowSelectRow: row, arrowSelectCol: col } = state
    
    switch (direction) {
      case 'up':
        row = Math.max(0, row - 1)
        break
      case 'down':
        row = row + 1
        break
      case 'left':
        col = Math.max(0, col - 1)
        break
      case 'right':
        col = col + 1
        break
    }
    
    state.arrowSelectRow = row
    state.arrowSelectCol = col
    
    console.log('[FormulaEditManager.arrowMove]', { direction, row, col })
    
    return { row, col }
  }
  
  /**
   * 获取方向键选择的起始位置
   * @param isCrossSheet 是否跨 Sheet
   * @returns 起始位置
   */
  function getArrowSelectStartPosition(isCrossSheet: boolean): { row: number; col: number } {
    if (isCrossSheet) {
      // 跨 Sheet：从 A1 开始
      return { row: 0, col: 0 }
    } else {
      // 同 Sheet：从编辑单元格开始
      return { row: state.row, col: state.col }
    }
  }

  return {
    state: state as Readonly<FormulaEditState>,
    // 计算属性
    isEditing,
    isCrossSheetMode,
    shouldInsertReference,
    textFormulaReferences,
    displayHtml,
    // 方法
    startEdit,
    updateValue,
    updateCursorPosition,
    switchSource,
    switchSheet,
    insertReference,
    confirmEdit,
    cancelEdit,
    reset,
    // 方向键选择模式
    enterArrowSelectMode,
    exitArrowSelectMode,
    disableArrowSelect,
    enableArrowSelect,
    updateArrowSelectPosition,
    arrowMove,
    getArrowSelectStartPosition
  }
}

export type FormulaEditStateManager = ReturnType<typeof createFormulaEditStateManager>
