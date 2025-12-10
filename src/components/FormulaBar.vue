<script setup lang="ts">
/**
 * FormulaBar - 公式栏组件（纯展示视图）
 * 
 * 职责：
 * - 名称框：显示当前单元格地址，支持跳转
 * - 公式输入区：渲染外部下发的 displayHtml
 * - 转发所有事件到父组件
 * - 处理 IME 输入
 * 
 * 不负责：
 * - 编辑状态管理（由 FormulaEditManager 处理）
 * - 公式解析和高亮生成（由父组件处理）
 * - 键盘逻辑解析（由父组件处理）
 * - 光标位置管理（由父组件控制）
 */

import { ref, computed, nextTick, watch } from 'vue'

// ==================== Props ====================

interface Props {
  /** 当前选中的行 */
  row: number
  /** 当前选中的列 */
  col: number
  /** 选区结束行（范围选择时） */
  endRow?: number
  /** 选区结束列（范围选择时） */
  endCol?: number
  /** 是否处于编辑状态（由 FormulaEditManager 下发） */
  isEditing: boolean
  /** 格式化后的 displayHtml（由 FormulaEditManager 下发） */
  displayHtml: string
  /** 是否为公式模式（由 FormulaEditManager 下发） */
  isFormula?: boolean
  /** 跨 Sheet 模式时的源 Sheet 名称（用于名称框显示） */
  sourceSheetName?: string
  /** 光标位置（由 FormulaEditManager 下发） */
  cursorPosition?: number
  /** 当前活动的输入源（用于判断是否应该恢复光标） */
  activeSource?: 'cell' | 'formulaBar' | null
}

const props = withDefaults(defineProps<Props>(), {
  endRow: -1,
  endCol: -1,
  isFormula: false,
  sourceSheetName: '',
  cursorPosition: -1,
  activeSource: null
})

// ==================== Emits ====================

const emit = defineEmits<{
  /** 导航到指定单元格 */
  (e: 'navigate', row: number, col: number): void
  /** 选择范围 */
  (e: 'select-range', startRow: number, startCol: number, endRow: number, endCol: number): void
  /** 键盘事件转发 */
  (e: 'keydown', event: KeyboardEvent): void
  /** 值变化（包含完整值和光标位置） */
  (e: 'value-change', payload: { value: string; cursorPosition: number }): void
  /** 光标位置变化（不含内容变化） */
  (e: 'cursor-change', payload: { cursorPosition: number; selection?: { start: number; end: number } }): void
  /** 焦点事件 */
  (e: 'focus'): void
  (e: 'blur', event: FocusEvent): void
  /** 点击公式输入区（用于开始编辑或切换焦点） */
  (e: 'click'): void
}>()

// ==================== Refs ====================

const nameBoxRef = ref<HTMLInputElement | null>(null)
const formulaInputRef = ref<HTMLDivElement | null>(null)

// ==================== 拖动调整高度 ====================

const barHeight = ref(26)  // 默认高度 26px
const isResizing = ref(false)
let startY = 0
let startHeight = 0

function handleResizeStart(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  startY = e.clientY
  startHeight = barHeight.value
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeEnd)
}

function handleResizeMove(e: MouseEvent) {
  if (!isResizing.value) return
  const delta = e.clientY - startY
  const newHeight = Math.max(26, Math.min(200, startHeight + delta))  // 最小 26px，最大 200px
  barHeight.value = newHeight
}

function handleResizeEnd() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)
}

// ==================== 名称框状态（仅名称框需要） ====================

const nameBoxEditing = ref(false)
const nameBoxValue = ref('')

// ==================== IME State (唯一内部状态) ====================

const isComposing = ref(false)

// ==================== 待恢复的选区（用于非编辑状态拖选后进入编辑时恢复） ====================

let pendingSelection: { start: number; end: number } | null = null

// 标记是否刚刚恢复了选区范围（用于跳过 cursorPosition watch）
let justRestoredSelection = false

// ==================== 名称框逻辑 ====================

function colToLetter(col: number): string {
  let result = ''
  let n = col
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

function getCellAddress(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`
}

function parseCellAddress(address: string): { row: number; col: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(address.trim().toUpperCase())
  if (!match) return null
  
  const colStr = match[1]!
  const rowStr = match[2]!
  
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  col -= 1
  
  const row = parseInt(rowStr, 10) - 1
  
  if (row < 0 || col < 0) return null
  return { row, col }
}

function parseRangeAddress(address: string): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const parts = address.trim().toUpperCase().split(':')
  if (parts.length === 1) {
    const cell = parseCellAddress(parts[0]!)
    if (!cell) return null
    return { startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col }
  } else if (parts.length === 2) {
    const start = parseCellAddress(parts[0]!)
    const end = parseCellAddress(parts[1]!)
    if (!start || !end) return null
    return {
      startRow: Math.min(start.row, end.row),
      startCol: Math.min(start.col, end.col),
      endRow: Math.max(start.row, end.row),
      endCol: Math.max(start.col, end.col)
    }
  }
  return null
}

function formatSheetName(name: string): string {
  const needsQuotes = /[\s'!\[\]]/.test(name)
  if (needsQuotes) {
    return `'${name.replace(/'/g, "''")}'`
  }
  return name
}

const displayAddress = computed(() => {
  if (props.sourceSheetName && props.isEditing) {
    const startAddr = getCellAddress(props.row, props.col)
    const formattedName = formatSheetName(props.sourceSheetName)
    
    if (props.endRow >= 0 && props.endCol >= 0 && 
        (props.endRow !== props.row || props.endCol !== props.col)) {
      const endAddr = getCellAddress(props.endRow, props.endCol)
      return `${formattedName}!${startAddr}:${endAddr}`
    }
    
    return `${formattedName}!${startAddr}`
  }
  
  const startAddr = getCellAddress(props.row, props.col)
  
  if (props.endRow >= 0 && props.endCol >= 0 && 
      (props.endRow !== props.row || props.endCol !== props.col)) {
    const endAddr = getCellAddress(props.endRow, props.endCol)
    return `${startAddr}:${endAddr}`
  }
  
  return startAddr
})

function handleNameBoxClick() {
  nameBoxEditing.value = true
  nameBoxValue.value = displayAddress.value
  nextTick(() => {
    nameBoxRef.value?.select()
  })
}

function handleNameBoxBlur() {
  if (nameBoxEditing.value) {
    commitNameBoxNavigation()
  }
}

function handleNameBoxKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitNameBoxNavigation()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelNameBoxEdit()
  }
}

function handleNameBoxInput(e: Event) {
  const target = e.target as HTMLInputElement
  nameBoxValue.value = target.value
}

function commitNameBoxNavigation() {
  const value = nameBoxValue.value.trim()
  if (!value) {
    cancelNameBoxEdit()
    return
  }
  
  const range = parseRangeAddress(value)
  if (range) {
    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      emit('navigate', range.startRow, range.startCol)
    } else {
      emit('select-range', range.startRow, range.startCol, range.endRow, range.endCol)
    }
  }
  
  nameBoxEditing.value = false
}

function cancelNameBoxEdit() {
  nameBoxEditing.value = false
  nameBoxValue.value = ''
}

// ==================== 公式输入区事件处理（只转发） ====================

/**
 * 获取当前光标位置和选区
 */
function getCurrentCursorInfo(): { cursorPosition: number; selection?: { start: number; end: number } } {
  const selection = window.getSelection()
  let selectionStart = 0
  let selectionEnd = 0
  
  if (selection && selection.rangeCount > 0 && formulaInputRef.value) {
    const range = selection.getRangeAt(0)
    
    // 计算选区起始位置
    const preStartRange = document.createRange()
    preStartRange.selectNodeContents(formulaInputRef.value)
    preStartRange.setEnd(range.startContainer, range.startOffset)
    selectionStart = preStartRange.toString().replace(/\u200B/g, '').length
    
    // 计算选区结束位置
    const preEndRange = document.createRange()
    preEndRange.selectNodeContents(formulaInputRef.value)
    preEndRange.setEnd(range.endContainer, range.endOffset)
    selectionEnd = preEndRange.toString().replace(/\u200B/g, '').length
  }
  
  if (selectionStart !== selectionEnd) {
    return {
      cursorPosition: selectionEnd,
      selection: { start: selectionStart, end: selectionEnd }
    }
  }
  return { cursorPosition: selectionStart }
}

function handleFormulaInputClick() {
  console.log('[FormulaBar] handleFormulaInputClick 开始', { 
    isEditing: props.isEditing, 
    pendingSelection,
    currentSelection: getCurrentCursorInfo()
  })
  
  // 如果还没有在编辑状态，立即设置 contenteditable 并聚焦
  if (!props.isEditing && formulaInputRef.value) {
    // 使用 mouseup 时保存的选区（因为设置 contenteditable 会清除选区）
    const savedSelection = pendingSelection
    pendingSelection = null  // 用完清除
    
    console.log('[FormulaBar] 进入编辑模式，savedSelection=', savedSelection)
    
    formulaInputRef.value.contentEditable = 'true'
    formulaInputRef.value.focus()
    
    // 如果之前有选区，恢复它
    if (savedSelection && savedSelection.start !== savedSelection.end) {
      console.log('[FormulaBar] 恢复选区', savedSelection)
      justRestoredSelection = true  // 标记刚恢复了选区，跳过后续的 cursorPosition watch
      restoreSelectionRange(savedSelection.start, savedSelection.end)
      // 延迟清除标志
      setTimeout(() => { justRestoredSelection = false }, 50)
    }
  }
  emit('click')
  
  // 在 click 后发送光标变化事件（延迟到下一帧确保光标已更新）
  requestAnimationFrame(() => {
    const cursorInfo = getCurrentCursorInfo()
    console.log('[FormulaBar] handleFormulaInputClick cursor-change', cursorInfo)
    emit('cursor-change', cursorInfo)
  })
}

/**
 * 处理鼠标释放事件（拖拽选择后）
 */
function handleMouseUp() {
  console.log('[FormulaBar] handleMouseUp', { isEditing: props.isEditing })
  
  // 非编辑状态下，保存选区供 click 时恢复
  if (!props.isEditing) {
    const cursorInfo = getCurrentCursorInfo()
    console.log('[FormulaBar] handleMouseUp 非编辑状态，cursorInfo=', cursorInfo)
    if (cursorInfo.selection && cursorInfo.selection.start !== cursorInfo.selection.end) {
      pendingSelection = cursorInfo.selection
      console.log('[FormulaBar] handleMouseUp: 保存选区到 pendingSelection', pendingSelection)
    } else {
      console.log('[FormulaBar] handleMouseUp: 没有有效选区')
    }
    return
  }
  
  // 编辑状态下，延迟获取选区，确保浏览器已更新
  requestAnimationFrame(() => {
    const cursorInfo = getCurrentCursorInfo()
    console.log('[FormulaBar] handleMouseUp cursor-change', cursorInfo)
    emit('cursor-change', cursorInfo)
  })
}

/**
 * 处理鼠标按下事件
 */
function handleMouseDown() {
  console.log('[FormulaBar] handleMouseDown', { isEditing: props.isEditing })
  // 清除之前的待恢复选区
  pendingSelection = null
}

function handleKeyDown(e: KeyboardEvent) {
  if (isComposing.value) return
  emit('keydown', e)
}

/**
 * beforeinput - 捕获字符输入前的事件
 * 阻止默认行为，由 Manager 统一处理（与 CellOverlay 保持一致）
 */
function handleBeforeInput(e: InputEvent) {
  // IME 组合期间允许默认行为
  if (isComposing.value) return
  
  // 阻止默认行为，统一由 Manager 处理
  e.preventDefault()
  
  if (!formulaInputRef.value) return
  
  // 获取当前选区信息
  const selection = window.getSelection()
  let selectionStart = 0
  let selectionEnd = 0
  
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    
    // 计算选区起始位置
    const preStartRange = document.createRange()
    preStartRange.selectNodeContents(formulaInputRef.value)
    preStartRange.setEnd(range.startContainer, range.startOffset)
    selectionStart = preStartRange.toString().replace(/\u200B/g, '').length
    
    // 计算选区结束位置
    const preEndRange = document.createRange()
    preEndRange.selectNodeContents(formulaInputRef.value)
    preEndRange.setEnd(range.endContainer, range.endOffset)
    selectionEnd = preEndRange.toString().replace(/\u200B/g, '').length
  }
  
  // 是否有选中文本
  const hasSelection = selectionStart !== selectionEnd
  
  // 获取当前完整文本
  const currentValue = (formulaInputRef.value.textContent || '').replace(/\u200B/g, '')
  
  // 根据输入类型处理
  const inputType = e.inputType
  let newValue = currentValue
  let newCursorPos = selectionStart
  
  if (inputType === 'insertText' && e.data) {
    // 插入文本（如果有选区，先删除选区）
    newValue = currentValue.slice(0, selectionStart) + e.data + currentValue.slice(selectionEnd)
    newCursorPos = selectionStart + e.data.length
  } else if (inputType === 'deleteContentBackward') {
    // 退格删除
    if (hasSelection) {
      // 删除选区
      newValue = currentValue.slice(0, selectionStart) + currentValue.slice(selectionEnd)
      newCursorPos = selectionStart
    } else if (selectionStart > 0) {
      // 删除光标前一个字符
      newValue = currentValue.slice(0, selectionStart - 1) + currentValue.slice(selectionStart)
      newCursorPos = selectionStart - 1
    }
  } else if (inputType === 'deleteContentForward') {
    // Delete 键删除
    if (hasSelection) {
      // 删除选区
      newValue = currentValue.slice(0, selectionStart) + currentValue.slice(selectionEnd)
      newCursorPos = selectionStart
    } else if (selectionStart < currentValue.length) {
      // 删除光标后一个字符
      newValue = currentValue.slice(0, selectionStart) + currentValue.slice(selectionStart + 1)
      newCursorPos = selectionStart
    }
  } else if (inputType === 'insertLineBreak' || inputType === 'insertParagraph') {
    // 换行（Shift+Enter）- 先删除选区（如有），再插入换行
    newValue = currentValue.slice(0, selectionStart) + '\n' + currentValue.slice(selectionEnd)
    newCursorPos = selectionStart + 1
  } else {
    // 其他类型不处理
    console.log('[FormulaBar] unhandled inputType:', inputType)
    return
  }
  
  console.log('[FormulaBar] beforeinput', { inputType, data: e.data, selectionStart, selectionEnd, newValue, newCursorPos })
  
  emit('value-change', { value: newValue, cursorPosition: newCursorPos })
}

/**
 * input - 内容变化后的事件（仅用于 IME 结束后的同步）
 */
function handleInput() {
  // 普通输入已在 beforeinput 处理，这里只处理 IME 结束后的情况
  // IME 结束后会触发 input，但 compositionend 已经处理了
}

/**
 * 恢复光标位置
 */
/**
 * 检查当前输入源是否是 FormulaBar
 */
function isActiveSource(): boolean {
  return props.activeSource === 'formulaBar'
}

/**
 * 恢复光标位置（仅当 activeSource 是 formulaBar 时）
 */
function restoreCursorPosition(pos: number) {
  if (!formulaInputRef.value) return
  
  // 只有当 activeSource 是 formulaBar 时才恢复光标，避免夺取 Overlay 的焦点
  if (!isActiveSource()) return
  
  const selection = window.getSelection()
  if (!selection) return
  
  console.log('[FormulaBar] restoreCursorPosition', { pos })
  
  // 遍历文本节点找到正确位置
  const walker = document.createTreeWalker(
    formulaInputRef.value,
    NodeFilter.SHOW_TEXT,
    null
  )
  
  let currentPos = 0
  let node: Text | null = null
  
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent?.replace(/\u200B/g, '') || ''
    const len = text.length
    
    if (currentPos + len >= pos) {
      const offset = pos - currentPos
      const range = document.createRange()
      range.setStart(node, Math.min(offset, node.length))
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      console.log('[FormulaBar] restoreCursorPosition: 成功设置光标', { node: node.textContent, offset })
      return
    }
    currentPos += len
  }
  
  // 如果没找到，放在末尾
  const range = document.createRange()
  range.selectNodeContents(formulaInputRef.value)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  console.log('[FormulaBar] restoreCursorPosition: 放在末尾')
}

/**
 * 恢复选区范围（用于从非编辑状态进入编辑状态时保留用户选择）
 */
function restoreSelectionRange(start: number, end: number) {
  if (!formulaInputRef.value) return
  
  const selection = window.getSelection()
  if (!selection) return
  
  console.log('[FormulaBar] restoreSelectionRange', { start, end })
  
  // 遍历文本节点找到起始和结束位置
  const walker = document.createTreeWalker(
    formulaInputRef.value,
    NodeFilter.SHOW_TEXT,
    null
  )
  
  let currentPos = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0
  let node: Text | null = null
  
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent?.replace(/\u200B/g, '') || ''
    const len = text.length
    
    // 找起始位置
    if (!startNode && currentPos + len >= start) {
      startNode = node
      startOffset = start - currentPos
    }
    
    // 找结束位置
    if (currentPos + len >= end) {
      endNode = node
      endOffset = end - currentPos
      break
    }
    
    currentPos += len
  }
  
  if (startNode && endNode) {
    try {
      const range = document.createRange()
      range.setStart(startNode, Math.min(startOffset, startNode.length))
      range.setEnd(endNode, Math.min(endOffset, endNode.length))
      selection.removeAllRanges()
      selection.addRange(range)
      console.log('[FormulaBar] restoreSelectionRange: 成功恢复选区')
    } catch (e) {
      console.warn('[FormulaBar] restoreSelectionRange: 恢复失败', e)
    }
  }
}

function handleFocus() {
  emit('focus')
}

function handleBlur(e: FocusEvent) {
  emit('blur', e)
}

// ==================== IME 处理 ====================

function handleCompositionStart() {
  isComposing.value = true
}

function handleCompositionEnd(_e: CompositionEvent) {
  isComposing.value = false
  
  if (!formulaInputRef.value) return
  
  // IME 输入完成后，读取当前 DOM 的完整内容（已包含 IME 输入的字符）
  const currentValue = (formulaInputRef.value.textContent || '').replace(/\u200B/g, '')
  
  // 计算光标位置
  const selection = window.getSelection()
  let cursorPos = currentValue.length
  
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(formulaInputRef.value)
    preRange.setEnd(range.startContainer, range.startOffset)
    cursorPos = preRange.toString().replace(/\u200B/g, '').length
  }
  
  console.log('[FormulaBar] compositionend', { currentValue, cursorPos })
  
  // 通知 Manager 同步完整内容（与 beforeinput 保持一致的处理方式）
  emit('value-change', { value: currentValue, cursorPosition: cursorPos })
}

// ==================== 剪贴板事件 ====================

/**
 * 处理粘贴事件 - 粘贴纯文本并同步到 Manager
 */
function handlePaste(e: ClipboardEvent) {
  e.preventDefault()
  e.stopPropagation()  // 阻止事件冒泡到 sheet
  
  if (!formulaInputRef.value || !props.isEditing) return
  
  // 获取纯文本内容
  const text = e.clipboardData?.getData('text/plain') || ''
  if (!text) return
  
  // 获取当前选区
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  
  const range = selection.getRangeAt(0)
  
  // 检查选区是否在 formulaInputRef 内
  if (!formulaInputRef.value.contains(range.startContainer) && range.startContainer !== formulaInputRef.value) {
    // 选区不在输入区域内，插入到末尾
    const currentValue = (formulaInputRef.value.textContent || '').replace(/\u200B/g, '')
    const newValue = currentValue + text
    const newCursorPos = newValue.length
    emit('value-change', { value: newValue, cursorPosition: newCursorPos })
    return
  }
  
  // 计算选区位置
  const preStartRange = document.createRange()
  preStartRange.selectNodeContents(formulaInputRef.value)
  preStartRange.setEnd(range.startContainer, range.startOffset)
  const selectionStart = preStartRange.toString().replace(/\u200B/g, '').length
  
  const preEndRange = document.createRange()
  preEndRange.selectNodeContents(formulaInputRef.value)
  preEndRange.setEnd(range.endContainer, range.endOffset)
  const selectionEnd = preEndRange.toString().replace(/\u200B/g, '').length
  
  // 获取当前值并插入粘贴内容（替换选中部分）
  const currentValue = (formulaInputRef.value.textContent || '').replace(/\u200B/g, '')
  const newValue = currentValue.slice(0, selectionStart) + text + currentValue.slice(selectionEnd)
  const newCursorPos = selectionStart + text.length
  
  console.log('[FormulaBar] paste', { text, selectionStart, selectionEnd, currentValue, newValue, newCursorPos })
  
  emit('value-change', { value: newValue, cursorPosition: newCursorPos })
}

// ==================== Watch ====================

// displayHtml 变化时更新内容并恢复光标
watch(() => props.displayHtml, (html) => {
  if (!formulaInputRef.value) return
  
  // 如果内容相同，不更新 innerHTML，避免丢失选区
  if (formulaInputRef.value.innerHTML === html) {
    console.log('[FormulaBar] watch displayHtml: 内容相同，跳过更新')
    return
  }
  
  console.log('[FormulaBar] watch displayHtml: 更新内容', { html: html?.substring(0, 50), cursorPosition: props.cursorPosition })
  
  formulaInputRef.value.innerHTML = html
  
  // 如果刚刚恢复了选区范围，跳过光标恢复（避免覆盖选区）
  if (justRestoredSelection) {
    console.log('[FormulaBar] watch displayHtml: 跳过光标恢复（刚恢复了选区）')
    return
  }
  
  // 如果正在编辑，恢复光标位置（使用 Manager 提供的位置）
  if (props.isEditing && props.cursorPosition !== undefined && props.cursorPosition >= 0) {
    nextTick(() => {
      restoreCursorPosition(props.cursorPosition!)
    })
  }
}, { immediate: true })

// 光标位置变化时恢复光标
watch(() => props.cursorPosition, (pos) => {
  // 如果刚刚恢复了选区范围，跳过光标恢复（避免覆盖选区）
  if (justRestoredSelection) {
    console.log('[FormulaBar] watch cursorPosition: 跳过（刚恢复了选区）')
    return
  }
  if (props.isEditing && pos !== undefined && pos >= 0 && formulaInputRef.value) {
    console.log('[FormulaBar] watch cursorPosition: 恢复光标', { pos })
    nextTick(() => {
      restoreCursorPosition(pos)
    })
  }
})

// isEditing 变化时更新 contenteditable
watch(() => props.isEditing, () => {
  // contenteditable 由模板绑定控制
})

// formulaInputRef 挂载时初始化（只在非编辑状态）
watch(() => formulaInputRef.value, (el) => {
  if (el && props.displayHtml && !props.isEditing) {
    el.innerHTML = props.displayHtml
  }
}, { immediate: true })

// ==================== 暴露方法 ====================

function focus() {
  formulaInputRef.value?.focus()
}

function getEditorElement() {
  return formulaInputRef.value
}

defineExpose({
  focus,
  getEditorElement
})
</script>

<template>
  <div class="formula-bar-wrapper">
    <div class="formula-bar" :style="{ height: barHeight + 'px' }">
      <!-- 名称框 -->
      <div class="name-box-container">
        <input
          ref="nameBoxRef"
          type="text"
          class="name-box"
          :value="nameBoxEditing ? nameBoxValue : displayAddress"
          :readonly="!nameBoxEditing"
          @click="handleNameBoxClick"
          @blur="handleNameBoxBlur"
          @keydown="handleNameBoxKeydown"
          @input="handleNameBoxInput"
        />
      </div>
      
      <!-- 分隔线 -->
      <div class="separator"></div>
      
      <!-- 公式输入区 -->
      <div class="formula-input-container">
        <div
          ref="formulaInputRef"
          class="formula-input"
          :class="{ 'formula-mode': isFormula, 'editing': isEditing }"
          :contenteditable="isEditing"
          @mousedown="handleMouseDown"
          @click="handleFormulaInputClick"
          @mouseup="handleMouseUp"
          @keydown="handleKeyDown"
          @beforeinput="handleBeforeInput"
          @input="handleInput"
          @focus="handleFocus"
          @blur="handleBlur"
          @paste="handlePaste"
          @compositionstart="handleCompositionStart"
          @compositionend="handleCompositionEnd"
        ></div>
      </div>
    </div>
    <!-- 拖动手柄 -->
    <div class="resize-handle" @mousedown="handleResizeStart"></div>
  </div>
</template>

<style scoped>
.formula-bar-wrapper {
  position: relative;
}

.formula-bar {
  display: flex;
  align-items: stretch;
  min-height: 30px;
  background: #f3f3f3;
  border-bottom: 1px solid #d4d4d4;
  padding: 0;
  gap: 0;
  user-select: none;
}

.resize-handle {
  height: 2px;
  padding: 1px 0;
  cursor: ns-resize;
  background-clip: content-box;
}

.name-box-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  flex-shrink: 0;
  padding: 4px 3px;
}

.name-box {
  width: 100%;
  height: 100%;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 12px;
  font-family: inherit;
  text-align: center;
  background: #fff;
  color: #333;
  outline: none;
  cursor: pointer;
}

.name-box:focus {
  border-color: #217346;
  cursor: text;
}

.name-box:hover:not(:focus) {
  border-color: #c0c0c0;
}

.separator {
  width: 1px;
  background: #d4d4d4;
  margin: 4px 0;
}

.formula-input-container {
  flex: 1;
  display: flex;
  align-items: stretch;
  padding: 3px 4px;
  min-width: 0;
}

.formula-input {
  width: 100%;
  min-height: 20px;
  line-height: 20px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 12px;
  font-family: inherit;
  background: #fff;
  color: #333 !important;
  outline: none;
  cursor: pointer;
  overflow: hidden;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;  /* 覆盖父级的 user-select: none */
  -webkit-user-select: text;
}

.formula-input:focus,
.formula-input.editing {
  border-color: #217346;
  cursor: text;
  caret-color: #333;  /* 确保光标可见 */
}

.formula-input:hover:not(:focus):not(.editing) {
  border-color: #c0c0c0;
}

.formula-input.formula-mode {
  color: inherit;
}
</style>
