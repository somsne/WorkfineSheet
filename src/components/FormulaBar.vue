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
import type { FormulaReferenceTextIndex } from './sheet/formulaEditUtils'
import {
  FORMULA_OPERATORS,
  generateFormulaHtmlFromRefs,
  getEditorCursorPosition,
  setEditorCursorPosition,
  getEditorTextContent,
  hasTextSelection as hasTextSelectionUtil,
  parseKeyAction,
  preventKeyDefault,
  isInSelectablePosition
} from './sheet/formulaEditUtils'

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
  formulaReferences?: FormulaReferenceTextIndex[]
  /** 跨 Sheet 模式时的源 Sheet 名称（用于名称框显示） */
  sourceSheetName?: string
}

const props = withDefaults(defineProps<Props>(), {
  endRow: -1,
  endCol: -1,
  editingValue: '',
  formulaReferences: () => [],
  sourceSheetName: ''
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
  /** Tab 键确认并向右移动 */
  (e: 'tab'): void
  /** 失焦确认（非公式选择模式） */
  (e: 'blur'): void
  /** 输入值变化（包含光标位置） */
  (e: 'input', value: string, cursorPosition: number): void
  /** 获得焦点（用于编辑源切换） */
  (e: 'focus'): void
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
 * 格式化 Sheet 名称（如需要则添加引号）
 */
function formatSheetName(name: string): string {
  const needsQuotes = /[\s'!\[\]]/.test(name)
  if (needsQuotes) {
    return `'${name.replace(/'/g, "''")}'`
  }
  return name
}

/**
 * 名称框显示的地址
 * - 跨 Sheet 模式：显示 Sheet1!A1 格式（源单元格）
 * - 普通模式：显示 A1 或 A1:B5 格式
 */
const displayAddress = computed(() => {
  // 跨 Sheet 模式：显示源 Sheet 的单元格地址
  if (props.sourceSheetName && props.isEditing) {
    const startAddr = getCellAddress(props.row, props.col)
    const formattedName = formatSheetName(props.sourceSheetName)
    
    // 检查是否有范围选择
    if (props.endRow >= 0 && props.endCol >= 0 && 
        (props.endRow !== props.row || props.endCol !== props.col)) {
      const endAddr = getCellAddress(props.endRow, props.endCol)
      return `${formattedName}!${startAddr}:${endAddr}`
    }
    
    return `${formattedName}!${startAddr}`
  }
  
  // 普通模式
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
/** 待恢复的光标位置（用于跨 Sheet 切换时保持光标） */
const pendingCursorPosition = ref<number | null>(null)

// 公式编辑相关状态
const isInSelectableState = ref(false)
const lastOperatorPos = ref(-1)
const hasTextSelectionState = ref(false)
const cursorPos = ref(0)

// ==================== 以下常量已迁移到 formulaEditUtils.ts ====================
// @deprecated OPERATORS - 使用 FORMULA_OPERATORS
// @deprecated CELL_REF_REGEX - 使用 formulaEditUtils 中的版本

/**
 * 公式输入区失焦处理
 * - 如果是公式模式，不触发保存（与 RichTextInput 行为一致）
 * - 否则触发确认
 */
function handleFormulaBlur() {
  // 如果不在编辑状态，不处理
  if (!props.isEditing) return
  
  // 公式模式不自动保存（与 RichTextInput 保持一致）
  // 用户可能在点击单元格选择引用，或者在公式中间编辑
  if (isFormula.value) {
    return
  }
  
  // 其他情况，触发确认
  emit('blur')
}

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

// ==================== 以下方法已迁移到 formulaEditUtils.ts ====================

/**
 * @deprecated 使用 formulaEditUtils.escapeHtml
 * HTML 转义 - 保留用于向后兼容，后期删除
 */
// function escapeHtml(text: string): string { ... }

// ==================== 以下方法已迁移到 formulaEditUtils.ts ====================

/**
 * @deprecated 使用 getEditorCursorPosition
 * 获取光标位置 - 保留包装函数用于向后兼容
 */
function getCursorPosition(): number {
  return getEditorCursorPosition(formulaInputRef.value)
}

/**
 * @deprecated 使用 setEditorCursorPosition
 * 设置光标位置 - 保留包装函数用于向后兼容
 */
function setCursorPosition(position: number) {
  setEditorCursorPosition(formulaInputRef.value, position)
}

/**
 * 更新编辑器内容
 * @param preserveCursor - 是否保持光标位置
 * @param forceUpdate - 是否强制更新（跳过 isLocalInput 检查，用于 formulaReferences 变化时）
 */
function updateEditorContent(preserveCursor: boolean = true, forceUpdate: boolean = false) {

  if (!formulaInputRef.value || isComposing.value) return
  
  // 如果 FormulaBar 持有焦点，先保存光标位置
  const hasFocus = document.activeElement === formulaInputRef.value
  
  // 如果是本地输入触发的更新，并且 FormulaBar 仍然持有焦点，跳过（避免光标跳动）
  // 但如果是强制更新（如 formulaReferences 变化），则不跳过
  if (isLocalInput.value && hasFocus && !forceUpdate) {
    return
  }
  
  // 优先使用待恢复的光标位置（跨 Sheet 切换时设置）
  let targetCursorPos: number
  if (pendingCursorPosition.value !== null) {
    targetCursorPos = pendingCursorPosition.value
    pendingCursorPosition.value = null // 清除待恢复位置
  } else {
    targetCursorPos = preserveCursor && hasFocus ? getCursorPosition() : displayValue.value.length
  }
  
  const html = generateFormulaHtmlFromRefs(displayValue.value, props.formulaReferences, isFormula.value)
  
  
  // 检查 HTML 是否真的需要更新
  if (formulaInputRef.value.innerHTML !== html) {
    formulaInputRef.value.innerHTML = html
    
    // 立即恢复光标位置（不要等 nextTick，因为那样可能太晚）
    if (preserveCursor && hasFocus && props.isEditing) {
      setCursorPosition(targetCursorPos)
    }
  } else if (pendingCursorPosition.value === null && targetCursorPos !== getCursorPosition()) {
    // HTML 没变但需要恢复光标位置（跨 Sheet 切换后）
    if (hasFocus && props.isEditing) {
      setCursorPosition(targetCursorPos)
    }
  }
}

// 监听 formulaReferences 变化，更新高亮
watch(() => props.formulaReferences, () => {
  if (props.isEditing) {
    // 强制更新，即使 isLocalInput=true 也要更新颜色高亮
    updateEditorContent(true, true)
  }
}, { deep: true })

// 监听 editingValue 变化，同步显示内容（当从单元格编辑器输入时）
watch(() => props.editingValue, () => {
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
    el.innerHTML = generateFormulaHtmlFromRefs(displayValue.value, props.formulaReferences, isFormula.value)
  }
}, { immediate: true })

// 监听编辑状态变化
watch(() => props.isEditing, (editing) => {
  // 编辑状态变化时更新内容显示
  if (!editing) {
    // 编辑结束，更新显示
    updateEditorContent(false)
  }
})

/**
 * 公式输入区点击 - 进入编辑并获取焦点
 */
function handleFormulaInputClick(_e: MouseEvent) {
  if (!props.isEditing) {
    emit('start-edit')
    // 编辑开始后，确保 FormulaBar 获得焦点
    // 使用较长的延迟确保在 RichTextInput 初始化完成后再聚焦
    // RichTextInput 在 nextTick 中初始化，我们需要在它之后执行
    setTimeout(() => {
      if (formulaInputRef.value && props.isEditing) {
        formulaInputRef.value.focus()
        // 将光标移到末尾
        setCursorPosition(displayValue.value.length)
        
        // 再次确认焦点（防止被其他代码抢走）
        setTimeout(() => {
          if (formulaInputRef.value && props.isEditing && document.activeElement !== formulaInputRef.value) {
            formulaInputRef.value.focus()
            setCursorPosition(displayValue.value.length)
          }
        }, 50)
      }
    }, 0)
  } else {
    // 已经在编辑状态，确保焦点在 FormulaBar
    formulaInputRef.value?.focus()
    // 通知父组件焦点已切换到 FormulaBar
    emit('focus')
  }
}

/**
 * 公式输入区输入事件
 */
function handleFormulaInput() {
  if (isComposing.value) return
  
  // 使用通用函数获取文本（自动移除零宽空格）
  const text = getEditorTextContent(formulaInputRef.value)
  // 更新光标位置
  const newCursorPos = getCursorPosition()
  cursorPos.value = newCursorPos
  
  // 标记为本地输入，避免后续的 watch 触发内容更新导致光标跳动
  // 这个标志会保持到下一个事件循环，确保所有 watch 都被跳过
  isLocalInput.value = true
  emit('input', text, newCursorPos)
  
  // 立即更新可选择状态（不等 nextTick，因为鼠标点击可能立即发生）
  updateSelectableState()
  
  // 更新文本选择状态（使用通用函数）
  hasTextSelectionState.value = hasTextSelectionUtil()
  
  // 在下一个事件循环重置标志（确保所有同步的 watch 都已执行完）
  setTimeout(() => {
    isLocalInput.value = false
  }, 0)
}

/**
 * 公式输入区键盘事件
 * 使用 parseKeyAction 统一解析键盘事件
 */
function handleFormulaKeydown(e: KeyboardEvent) {
  const action = parseKeyAction(e, 'formulaBar')
  
  if (action) {
    preventKeyDefault(e, action)
    
    switch (action.type) {
      case 'confirm':
        emit('confirm')
        break
      case 'confirmAndMoveRight':
        emit('tab')
        break
      case 'cancel':
        emit('cancel')
        break
      case 'navigation':
        // 导航键：更新光标位置和可选择状态
        nextTick(() => {
          cursorPos.value = getCursorPosition()
          updateSelectableState()
          hasTextSelectionState.value = hasTextSelectionUtil()
        })
        break
    }
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
 * 使用 formulaEditUtils.isInSelectablePosition
 * @param textOverride 可选，覆盖使用的文本
 * @param posOverride 可选，覆盖使用的光标位置
 */
function updateSelectableState(textOverride?: string, posOverride?: number) {
  // 使用传入的值或从 DOM/state 获取
  const text = getEditorTextContent(formulaInputRef.value) || textOverride || displayValue.value
  const pos = posOverride ?? cursorPos.value
  
  // 使用通用函数判断
  isInSelectableState.value = isInSelectablePosition(text, pos)
  
  // 更新 lastOperatorPos（用于插入引用时的位置计算）
  if (isInSelectableState.value && text) {
    for (let i = pos - 1; i >= 0; i--) {
      const char = text.charAt(i)
      if (char && FORMULA_OPERATORS.includes(char)) {
        lastOperatorPos.value = i
        return
      }
    }
  }
  lastOperatorPos.value = -1
}

// 为了向后兼容，创建别名
function updateSelectableStateWithText(text: string, pos: number) {
  updateSelectableState(text, pos)
}

/**
 * @deprecated 使用 formulaEditUtils.findReferenceToReplace
 * 查找光标位置要替换的引用 - 暂时保留，因为有特殊的 lastOperatorPos 逻辑
 */
function findReferenceToReplace(): { start: number; end: number; ref: string } | null {
  const text = getEditorTextContent(formulaInputRef.value) || displayValue.value
  const isFormulaText = text?.startsWith('=') ?? false
  if (!isFormulaText) return null
  
  const pos = cursorPos.value
  
  // 匹配跨 Sheet 引用和普通引用
  // 跨 Sheet: 'Sheet Name'!A1:B2 或 SheetName!A1:B2
  // 普通: A1:B2 或 A1
  const crossSheetRegex = /(?:'[^']+'|[A-Za-z\u4e00-\u9fa5_][A-Za-z0-9\u4e00-\u9fa5_]*)!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/gi
  const simpleRegex = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/gi
  
  // 先尝试匹配跨 Sheet 引用（更长的匹配优先）
  crossSheetRegex.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = crossSheetRegex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (pos >= start && pos <= end) {
      return { start, end, ref: match[0] }
    }
  }
  
  // 再尝试匹配普通引用
  simpleRegex.lastIndex = 0
  while ((match = simpleRegex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (pos >= start && pos <= end) {
      // 检查这个匹配是否是跨 Sheet 引用的一部分（已被上面处理）
      // 通过检查前面是否有 ! 来判断
      if (start > 0 && text[start - 1] === '!') {
        continue // 跳过，这是跨 Sheet 引用的一部分
      }
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
  
  // 使用通用函数获取当前文本
  const text = getEditorTextContent(formulaInputRef.value) || displayValue.value
  const pos = cursorPos.value
  
  
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
  
  
  // 直接更新 formulaInputRef 的内容（立即生效）
  const html = generateFormulaHtmlFromRefs(newText, props.formulaReferences, isFormula.value)
  formulaInputRef.value.innerHTML = html
  
  // 更新光标位置
  cursorPos.value = newCursorPos
  
  // 发送更新到父组件
  isLocalInput.value = true
  emit('input', newText, newCursorPos)
  
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
 * 使用通用函数获取文本
 */
function getCurrentValue(): string {
  // 优先返回 formulaInputRef 的实际内容（最新的输入）
  // 使用通用函数（自动移除零宽空格）
  if (formulaInputRef.value) {
    return getEditorTextContent(formulaInputRef.value) || displayValue.value
  }
  return displayValue.value.replace(/\u200B/g, '')
}

// 暴露给父组件
defineExpose({
  // 使用 getter 确保返回最新值
  get formulaMode() { return isFormula.value },
  get isInSelectableState() { return isInSelectableState.value },
  get hasTextSelection() { return hasTextSelectionState.value },
  insertCellReference,
  insertRangeReference,
  getCurrentValue,
  getEditorElement: () => formulaInputRef.value,
  setCursorPosition,
  getCursorPosition,
  focus: () => formulaInputRef.value?.focus(),
  /** 设置待恢复的光标位置（用于跨 Sheet 切换时保持光标） */
  setPendingCursorPosition: (pos: number) => { pendingCursorPosition.value = pos }
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
        @blur="handleFormulaBlur"
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
  color: #333 !important;
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

</style>
