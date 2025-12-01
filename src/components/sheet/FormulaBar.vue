<script setup lang="ts">
/**
 * FormulaBar - 公式栏组件
 * 
 * 功能：
 * - 名称框：显示当前单元格地址，支持跳转
 * - 操作按钮：确认/取消编辑
 * - 公式输入区：显示和编辑单元格内容，支持彩色公式引用
 */

import { ref, computed, nextTick, watch } from 'vue'

/**
 * 公式引用信息
 */
interface FormulaReference {
  ref: string       // 如 "A1" 或 "B2:C5"
  color: string     // 如 "#4472C4"
  startIndex: number
  endIndex: number
}

// Props
interface Props {
  /** 当前选中的行 */
  row: number
  /** 当前选中的列 */
  col: number
  /** 选区结束行（范围选择时） */
  endRow?: number
  /** 选区结束列（范围选择时） */
  endCol?: number
  /** 当前单元格的值 */
  cellValue: string
  /** 是否处于编辑状态 */
  isEditing: boolean
  /** 编辑中的值 */
  editingValue?: string
  /** 公式引用列表（用于彩色高亮） */
  formulaReferences?: FormulaReference[]
}

const props = withDefaults(defineProps<Props>(), {
  endRow: -1,
  endCol: -1,
  editingValue: '',
  formulaReferences: () => []
})

// Emits
const emit = defineEmits<{
  /** 导航到指定单元格 */
  (e: 'navigate', row: number, col: number): void
  /** 选择范围 */
  (e: 'select-range', startRow: number, startCol: number, endRow: number, endCol: number): void
  /** 开始编辑 */
  (e: 'start-edit'): void
  /** 确认编辑 */
  (e: 'confirm'): void
  /** 取消编辑 */
  (e: 'cancel'): void
  /** 输入值变化 */
  (e: 'input', value: string): void
}>()

// ==================== 名称框 ====================

const nameBoxRef = ref<HTMLInputElement | null>(null)
const nameBoxEditing = ref(false)
const nameBoxValue = ref('')

/**
 * 列号转字母 (0 -> A, 25 -> Z, 26 -> AA)
 */
function colToLetter(col: number): string {
  let result = ''
  let n = col
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

/**
 * 生成单元格地址
 */
function getCellAddress(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`
}

/**
 * 解析单元格地址
 */
function parseCellAddress(address: string): { row: number; col: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(address.trim().toUpperCase())
  if (!match) return null
  
  const colStr = match[1]!
  const rowStr = match[2]!
  
  // 列字母转数字
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  col -= 1 // 0-indexed
  
  const row = parseInt(rowStr, 10) - 1 // 0-indexed
  
  if (row < 0 || col < 0) return null
  return { row, col }
}

/**
 * 解析范围地址 (A1:B5)
 */
function parseRangeAddress(address: string): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const parts = address.trim().toUpperCase().split(':')
  if (parts.length === 1) {
    // 单个单元格
    const cell = parseCellAddress(parts[0]!)
    if (!cell) return null
    return { startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col }
  } else if (parts.length === 2) {
    // 范围
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

/**
 * 名称框显示的地址
 */
const displayAddress = computed(() => {
  const startAddr = getCellAddress(props.row, props.col)
  
  // 检查是否有范围选择
  if (props.endRow >= 0 && props.endCol >= 0 && 
      (props.endRow !== props.row || props.endCol !== props.col)) {
    const endAddr = getCellAddress(props.endRow, props.endCol)
    return `${startAddr}:${endAddr}`
  }
  
  return startAddr
})

/**
 * 名称框点击 - 选中内容
 */
function handleNameBoxClick() {
  nameBoxEditing.value = true
  nameBoxValue.value = displayAddress.value
  nextTick(() => {
    nameBoxRef.value?.select()
  })
}

/**
 * 名称框失焦 - 导航或取消
 */
function handleNameBoxBlur() {
  if (nameBoxEditing.value) {
    commitNameBoxNavigation()
  }
}

/**
 * 名称框键盘事件
 */
function handleNameBoxKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitNameBoxNavigation()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelNameBoxEdit()
  }
}

/**
 * 名称框输入事件
 */
function handleNameBoxInput(e: Event) {
  const target = e.target as HTMLInputElement
  nameBoxValue.value = target.value
}

/**
 * 提交名称框导航
 */
function commitNameBoxNavigation() {
  const value = nameBoxValue.value.trim()
  if (!value) {
    cancelNameBoxEdit()
    return
  }
  
  const range = parseRangeAddress(value)
  if (range) {
    if (range.startRow === range.endRow && range.startCol === range.endCol) {
      // 单个单元格 - 导航
      emit('navigate', range.startRow, range.startCol)
    } else {
      // 范围 - 选择
      emit('select-range', range.startRow, range.startCol, range.endRow, range.endCol)
    }
  }
  
  nameBoxEditing.value = false
}

/**
 * 取消名称框编辑
 */
function cancelNameBoxEdit() {
  nameBoxEditing.value = false
  nameBoxValue.value = ''
}

// ==================== 公式输入区 ====================

const formulaInputRef = ref<HTMLDivElement | null>(null)
const isComposing = ref(false)
/** 标记是否是从 FormulaBar 发起的输入（避免循环更新） */
const isLocalInput = ref(false)

// 公式编辑相关状态
const isInSelectableState = ref(false)
const lastOperatorPos = ref(-1)
const hasTextSelection = ref(false)
const cursorPos = ref(0)

// Excel 风格引用选择：操作符列表
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%']

// 单元格引用正则表达式
const CELL_REF_REGEX = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g

/**
 * 显示的值（编辑时显示编辑值，否则显示单元格值）
 */
const displayValue = computed(() => {
  if (props.isEditing) {
    return props.editingValue
  }
  return props.cellValue
})

/**
 * 是否为公式
 */
const isFormula = computed(() => {
  const value = displayValue.value
  return typeof value === 'string' && value.startsWith('=')
})

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 生成带颜色高亮的公式 HTML
 */
function generateFormulaHtml(text: string): string {
  if (!text) return '\u200B'
  
  // 非公式或无引用时，返回普通文本
  if (!isFormula.value || !props.formulaReferences || props.formulaReferences.length === 0) {
    return escapeHtml(text)
  }
  
  // 构建字符级别的颜色数组
  const colors: (string | null)[] = new Array(text.length).fill(null)
  
  for (const ref of props.formulaReferences) {
    const startIdx = Math.max(0, Math.min(ref.startIndex, text.length))
    const endIdx = Math.max(0, Math.min(ref.endIndex, text.length))
    
    for (let i = startIdx; i < endIdx; i++) {
      colors[i] = ref.color
    }
  }
  
  // 生成 HTML
  let html = ''
  let i = 0
  while (i < text.length) {
    const color = colors[i]
    if (color) {
      let j = i
      while (j < text.length && colors[j] === color) {
        j++
      }
      const segment = text.slice(i, j)
      html += `<span style="color: ${color};">${escapeHtml(segment)}</span>`
      i = j
    } else {
      let j = i
      while (j < text.length && !colors[j]) {
        j++
      }
      const segment = text.slice(i, j)
      html += escapeHtml(segment)
      i = j
    }
  }
  
  return html || '\u200B'
}

/**
 * 获取光标位置
 */
function getCursorPosition(): number {
  try {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !formulaInputRef.value) return 0
    
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(formulaInputRef.value)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    
    return preCaretRange.toString().length
  } catch {
    return 0
  }
}

/**
 * 设置光标位置
 */
function setCursorPosition(position: number) {
  console.log('[FormulaBar] setCursorPosition', { position, formulaInputRef: !!formulaInputRef.value })
  if (!formulaInputRef.value) return
  
  try {
    const selection = window.getSelection()
    if (!selection) return
    
    const range = document.createRange()
    
    // 遍历节点找到正确的位置
    let charCount = 0
    const textNodes: Text[] = []
    
    function collectTextNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text)
      } else {
        node.childNodes.forEach(collectTextNodes)
      }
    }
    collectTextNodes(formulaInputRef.value)
    
    console.log('[FormulaBar] setCursorPosition: textNodes count =', textNodes.length, 'total text length =', textNodes.reduce((sum, n) => sum + n.length, 0))
    
    for (const textNode of textNodes) {
      const nodeLength = textNode.length
      if (charCount + nodeLength >= position) {
        range.setStart(textNode, position - charCount)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        console.log('[FormulaBar] setCursorPosition: 设置到位置', position, '在节点内偏移', position - charCount)
        return
      }
      charCount += nodeLength
    }
    
    // 如果位置超出，设置到末尾
    if (textNodes.length > 0) {
      const lastNode = textNodes[textNodes.length - 1]!
      range.setStart(lastNode, lastNode.length)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      console.log('[FormulaBar] setCursorPosition: 位置超出，设置到末尾')
    }
  } catch (e) {
    console.log('[FormulaBar] setCursorPosition error:', e)
  }
}

/**
 * 更新编辑器内容
 * @param preserveCursor - 是否保持光标位置
 * @param forceUpdate - 是否强制更新（跳过 isLocalInput 检查，用于 formulaReferences 变化时）
 */
function updateEditorContent(preserveCursor: boolean = true, forceUpdate: boolean = false) {
  console.log('[FormulaBar] updateEditorContent', {
    preserveCursor,
    forceUpdate,
    isLocalInput: isLocalInput.value,
    isComposing: isComposing.value,
    activeElement: document.activeElement === formulaInputRef.value ? 'FormulaBar' : 'Other'
  })
  if (!formulaInputRef.value || isComposing.value) return
  
  // 如果 FormulaBar 持有焦点，先保存光标位置
  const hasFocus = document.activeElement === formulaInputRef.value
  
  // 如果是本地输入触发的更新，并且 FormulaBar 仍然持有焦点，跳过（避免光标跳动）
  // 但如果是强制更新（如 formulaReferences 变化），则不跳过
  if (isLocalInput.value && hasFocus && !forceUpdate) {
    console.log('[FormulaBar] updateEditorContent: isLocalInput=true 且 hasFocus, 跳过')
    return
  }
  
  const currentPos = preserveCursor && hasFocus ? getCursorPosition() : displayValue.value.length
  const html = generateFormulaHtml(displayValue.value)
  
  console.log('[FormulaBar] updateEditorContent: 更新内容', {
    currentPos,
    displayValue: displayValue.value,
    htmlLength: html.length,
    hasFocus
  })
  
  // 检查 HTML 是否真的需要更新
  if (formulaInputRef.value.innerHTML !== html) {
    formulaInputRef.value.innerHTML = html
    
    // 立即恢复光标位置（不要等 nextTick，因为那样可能太晚）
    if (preserveCursor && hasFocus && props.isEditing) {
      setCursorPosition(currentPos)
    }
  }
}

// 监听 formulaReferences 变化，更新高亮
watch(() => props.formulaReferences, () => {
  console.log('[FormulaBar] watch formulaReferences 变化')
  if (props.isEditing) {
    // 强制更新，即使 isLocalInput=true 也要更新颜色高亮
    updateEditorContent(true, true)
  }
}, { deep: true })

// 监听 editingValue 变化，同步显示内容（当从单元格编辑器输入时）
watch(() => props.editingValue, (newVal, oldVal) => {
  console.log('[FormulaBar] watch editingValue 变化', { newVal, oldVal })
  if (props.isEditing) {
    updateEditorContent(true)
  }
})

// 监听 cellValue 变化，更新显示内容（当切换单元格时）
watch(() => props.cellValue, () => {
  if (!props.isEditing) {
    updateEditorContent(false)
  }
})

// 初始化时设置内容（非编辑状态）
watch(() => formulaInputRef.value, (el) => {
  if (el && !props.isEditing) {
    el.innerHTML = generateFormulaHtml(displayValue.value)
  }
}, { immediate: true })

// 监听编辑状态变化
watch(() => props.isEditing, (editing, oldEditing) => {
  console.log('[FormulaBar] watch isEditing 变化', { 
    editing, 
    oldEditing, 
    row: props.row, 
    col: props.col 
  })
  // 编辑状态变化时更新内容显示
  if (!editing) {
    // 编辑结束，更新显示
    updateEditorContent(false)
  }
})

/**
 * 公式输入区点击 - 进入编辑并获取焦点
 */
function handleFormulaInputClick(e: MouseEvent) {
  console.log('[FormulaBar] handleFormulaInputClick', {
    isEditing: props.isEditing,
    row: props.row,
    col: props.col,
    cellValue: props.cellValue,
    target: e.target,
    currentTarget: e.currentTarget
  })
  if (!props.isEditing) {
    console.log('[FormulaBar] 发送 start-edit 事件')
    emit('start-edit')
    // 编辑开始后，确保 FormulaBar 获得焦点
    // 使用较长的延迟确保在 RichTextInput 初始化完成后再聚焦
    // RichTextInput 在 nextTick 中初始化，我们需要在它之后执行
    setTimeout(() => {
      console.log('[FormulaBar] setTimeout 后尝试 focus', {
        formulaInputRef: formulaInputRef.value,
        isEditing: props.isEditing
      })
      if (formulaInputRef.value && props.isEditing) {
        formulaInputRef.value.focus()
        // 将光标移到末尾
        setCursorPosition(displayValue.value.length)
        console.log('[FormulaBar] 设置焦点完成, activeElement:', document.activeElement)
        
        // 再次确认焦点（防止被其他代码抢走）
        setTimeout(() => {
          if (formulaInputRef.value && props.isEditing && document.activeElement !== formulaInputRef.value) {
            console.log('[FormulaBar] 焦点被抢走，重新聚焦')
            formulaInputRef.value.focus()
            setCursorPosition(displayValue.value.length)
          }
        }, 50)
      }
    }, 0)
  } else {
    // 已经在编辑状态，确保焦点在 FormulaBar
    console.log('[FormulaBar] 已在编辑状态，聚焦 FormulaBar')
    formulaInputRef.value?.focus()
  }
}

/**
 * 公式输入区输入事件
 */
function handleFormulaInput() {
  console.log('[FormulaBar] handleFormulaInput', {
    isComposing: isComposing.value,
    text: formulaInputRef.value?.innerText,
    isEditing: props.isEditing
  })
  if (isComposing.value) return
  
  const text = formulaInputRef.value?.innerText ?? ''
  // 更新光标位置
  const newCursorPos = getCursorPosition()
  cursorPos.value = newCursorPos
  console.log('[FormulaBar] handleFormulaInput: cursorPos =', newCursorPos, 'text =', text)
  
  // 标记为本地输入，避免后续的 watch 触发内容更新导致光标跳动
  // 这个标志会保持到下一个事件循环，确保所有 watch 都被跳过
  isLocalInput.value = true
  console.log('[FormulaBar] 发送 input 事件, text:', text)
  emit('input', text)
  
  // 立即更新可选择状态（不等 nextTick，因为鼠标点击可能立即发生）
  updateSelectableState()
  
  // 更新文本选择状态
  const selection = window.getSelection()
  hasTextSelection.value = !!(selection && !selection.isCollapsed)
  
  // 在下一个事件循环重置标志（确保所有同步的 watch 都已执行完）
  setTimeout(() => {
    isLocalInput.value = false
  }, 0)
}

/**
 * 公式输入区键盘事件
 */
function handleFormulaKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.altKey) {
    e.preventDefault()
    emit('confirm')
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancel')
  }
  
  // 导航键：更新光标位置和可选择状态
  const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (navigationKeys.includes(e.key)) {
    nextTick(() => {
      cursorPos.value = getCursorPosition()
      updateSelectableState()
      const selection = window.getSelection()
      hasTextSelection.value = !!(selection && !selection.isCollapsed)
    })
  }
}

/**
 * IME 输入开始
 */
function handleCompositionStart() {
  isComposing.value = true
}

/**
 * IME 输入结束
 */
function handleCompositionEnd() {
  isComposing.value = false
  handleFormulaInput()
}

// ==================== 操作按钮 ====================

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}

// ==================== 公式引用插入 ====================

/**
 * 更新可选择状态
 * 当光标在操作符后面时，进入可选择状态
 * @param textOverride 可选，覆盖使用的文本
 * @param posOverride 可选，覆盖使用的光标位置
 */
function updateSelectableState(textOverride?: string, posOverride?: number) {
  // 使用传入的值或从 DOM/state 获取
  const text = (textOverride ?? formulaInputRef.value?.innerText ?? displayValue.value).replace(/\u200B/g, '')
  const pos = posOverride ?? cursorPos.value
  const isFormulaText = text?.startsWith('=') ?? false
  
  console.log('[FormulaBar] updateSelectableState', {
    text,
    isFormulaText,
    cursorPos: pos,
    displayValue: displayValue.value
  })
  
  if (!isFormulaText) {
    isInSelectableState.value = false
    lastOperatorPos.value = -1
    console.log('[FormulaBar] updateSelectableState: 非公式，不可选择')
    return
  }
  
  // 检查光标前一个字符是否是操作符
  if (pos > 0 && text) {
    const prevChar = text.charAt(pos - 1)
    console.log('[FormulaBar] updateSelectableState: prevChar =', prevChar, 'pos =', pos)
    if (prevChar && OPERATORS.includes(prevChar)) {
      isInSelectableState.value = true
      lastOperatorPos.value = pos - 1
      console.log('[FormulaBar] updateSelectableState: 操作符后，可选择')
      return
    }
  }
  
  // 检查从最后一个操作符到光标之间是否只有空格或者是单元格引用
  if (text) {
    for (let i = pos - 1; i >= 0; i--) {
      const char = text.charAt(i)
      if (char && OPERATORS.includes(char)) {
        const between = text.substring(i + 1, pos)
        if (/^\s*$/.test(between) || /^\s*\$?[A-Z]*\$?\d*$/.test(between)) {
          isInSelectableState.value = true
          lastOperatorPos.value = i
          console.log('[FormulaBar] updateSelectableState: 操作符后有引用模式，可选择')
          return
        }
        break
      }
    }
  }
  
  isInSelectableState.value = false
  console.log('[FormulaBar] updateSelectableState: 不满足条件，不可选择')
}

// 为了向后兼容，创建别名
function updateSelectableStateWithText(text: string, pos: number) {
  updateSelectableState(text, pos)
}

/**
 * 查找光标位置要替换的引用
 */
function findReferenceToReplace(): { start: number; end: number; ref: string } | null {
  const text = (formulaInputRef.value?.innerText ?? displayValue.value).replace(/\u200B/g, '')
  const isFormulaText = text?.startsWith('=') ?? false
  if (!isFormulaText) return null
  
  const pos = cursorPos.value
  
  CELL_REF_REGEX.lastIndex = 0
  
  let match: RegExpExecArray | null
  while ((match = CELL_REF_REGEX.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (pos >= start && pos <= end) {
      return { start, end, ref: match[0] }
    }
  }
  
  return null
}

/**
 * 插入单元格引用
 * @returns 插入后的新文本值
 */
function insertCellReference(ref: string): string {
  if (!formulaInputRef.value) return displayValue.value
  
  // 获取当前文本（移除零宽空格）
  const text = (formulaInputRef.value.innerText ?? displayValue.value).replace(/\u200B/g, '')
  const pos = cursorPos.value
  
  console.log('[FormulaBar] insertCellReference', { ref, text, pos, lastOperatorPos: lastOperatorPos.value })
  
  // 检查是否需要替换现有引用
  const existingRef = findReferenceToReplace()
  
  let newText: string
  let newCursorPos: number
  
  if (existingRef) {
    newText = text.substring(0, existingRef.start) + ref + text.substring(existingRef.end)
    newCursorPos = existingRef.start + ref.length
  } else if (lastOperatorPos.value >= 0 && lastOperatorPos.value < pos) {
    const beforeOperator = text.substring(0, lastOperatorPos.value + 1)
    const afterCursor = text.substring(pos)
    newText = beforeOperator + ref + afterCursor
    newCursorPos = beforeOperator.length + ref.length
  } else {
    newText = text.substring(0, pos) + ref + text.substring(pos)
    newCursorPos = pos + ref.length
  }
  
  console.log('[FormulaBar] insertCellReference: newText =', newText, 'newCursorPos =', newCursorPos)
  
  // 直接更新 formulaInputRef 的内容（立即生效）
  const html = generateFormulaHtml(newText)
  formulaInputRef.value.innerHTML = html
  
  // 更新光标位置
  cursorPos.value = newCursorPos
  
  // 发送更新到父组件
  isLocalInput.value = true
  emit('input', newText)
  
  nextTick(() => {
    if (formulaInputRef.value) {
      formulaInputRef.value.focus()
      setCursorPosition(newCursorPos)
      // 更新可选择状态（使用新文本）
      updateSelectableStateWithText(newText, newCursorPos)
    }
    setTimeout(() => {
      isLocalInput.value = false
    }, 0)
  })
  
  // 返回新的文本值，供调用者使用
  return newText
}

/**
 * 插入区域引用
 */
function insertRangeReference(startAddr: string, endAddr: string): string {
  return insertCellReference(`${startAddr}:${endAddr}`)
}

/**
 * 获取当前值
 */
function getCurrentValue(): string {
  // 优先返回 formulaInputRef 的实际内容（最新的输入）
  // 因为 displayValue 可能还没更新
  // 移除零宽空格
  if (formulaInputRef.value) {
    return (formulaInputRef.value.innerText ?? displayValue.value).replace(/\u200B/g, '')
  }
  return displayValue.value.replace(/\u200B/g, '')
}

// 暴露给父组件
defineExpose({
  // 使用 getter 确保返回最新值
  get formulaMode() { return isFormula.value },
  get isInSelectableState() { return isInSelectableState.value },
  get hasTextSelection() { return hasTextSelection.value },
  insertCellReference,
  insertRangeReference,
  getCurrentValue,
  getEditorElement: () => formulaInputRef.value
})
</script>

<template>
  <div class="formula-bar">
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
    
    <!-- 分隔线（随 action-buttons 一起隐藏） -->
    <div class="separator" style="display: none;"></div>
    
    <!-- 操作按钮（暂时隐藏） -->
    <div class="action-buttons" style="display: none;">
      <button 
        class="action-btn cancel-btn"
        :class="{ visible: isEditing }"
        :disabled="!isEditing"
        @click="handleCancel"
        title="取消 (Esc)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
      <button 
        class="action-btn confirm-btn"
        :class="{ visible: isEditing }"
        :disabled="!isEditing"
        @click="handleConfirm"
        title="确认 (Enter)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
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
        @click="handleFormulaInputClick"
        @input="handleFormulaInput"
        @keydown="handleFormulaKeydown"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.formula-bar {
  display: flex;
  align-items: stretch;
  height: 26px;
  background: #f3f3f3;
  border-bottom: 1px solid #d4d4d4;
  padding: 0;
  gap: 0;
  user-select: none;
}

/* 名称框 */
.name-box-container {
  display: flex;
  align-items: center;
  width: 80px;
  flex-shrink: 0;
  padding: 0 2px;
}

.name-box {
  width: 100%;
  height: 20px;
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

/* 分隔线 */
.separator {
  width: 1px;
  background: #d4d4d4;
  margin: 4px 0;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: #999;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.15s;
}

.action-btn.visible {
  opacity: 1;
}

.action-btn:hover:not(:disabled) {
  background: #e0e0e0;
}

.action-btn:disabled {
  cursor: default;
}

.cancel-btn.visible {
  color: #c42b1c;
}

.confirm-btn.visible {
  color: #217346;
}

/* 公式输入区 */
.formula-input-container {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 4px;
  min-width: 0;
}

.formula-input {
  width: 100%;
  height: 20px;
  line-height: 20px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 2px;
  font-size: 12px;
  font-family: inherit;
  background: #fff;
  color: #333;
  outline: none;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.formula-input:focus,
.formula-input.editing {
  border-color: #217346;
  cursor: text;
}

.formula-input:hover:not(:focus):not(.editing) {
  border-color: #c0c0c0;
}

.formula-input.formula-mode {
  /* 公式模式时不设置整体颜色，让引用颜色显示出来 */
  color: inherit;
}

/* 深色模式 */
:global(html.dark) .formula-bar {
  background: #2d2d2d;
  border-bottom-color: #404040;
}

:global(html.dark) .name-box {
  background: #3a3a3a;
  color: #e0e0e0;
  border-color: transparent;
}

:global(html.dark) .name-box:focus {
  border-color: #4ade80;
}

:global(html.dark) .name-box:hover:not(:focus) {
  border-color: #505050;
}

:global(html.dark) .separator {
  background: #505050;
}

:global(html.dark) .action-btn {
  color: #888;
}

:global(html.dark) .action-btn:hover:not(:disabled) {
  background: #3a3a3a;
}

:global(html.dark) .cancel-btn.visible {
  color: #f87171;
}

:global(html.dark) .confirm-btn.visible {
  color: #4ade80;
}

:global(html.dark) .formula-input {
  background: #3a3a3a;
  color: #e0e0e0;
  border-color: transparent;
}

:global(html.dark) .formula-input:focus,
:global(html.dark) .formula-input.editing {
  border-color: #4ade80;
}

:global(html.dark) .formula-input:hover:not(:focus):not(.editing) {
  border-color: #505050;
}

:global(html.dark) .formula-input.formula-mode {
  color: #60a5fa;
}
</style>
