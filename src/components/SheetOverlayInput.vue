<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch, computed } from 'vue'

const props = defineProps<{
  visible: boolean
  value: string
  row: number
  col: number
  top: number
  left: number
  width: number
  height: number
  mode: 'edit' | 'typing'
  isFormula?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', val: string): void
  (e: 'cancel'): void
  (e: 'cellclick', row: number, col: number): void
  (e: 'input-change'): void
}>()

const internal = ref(props.value ?? '')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const awaitingComposition = ref(false)
const preCompositionBuffer = ref('')
const isComposing = ref(false)
const preCompositionTimer = ref<number | null>(null)

// 自动调整大小
const autoWidth = ref(props.width)
const autoHeight = ref(props.height)

// 公式相关状态
const formulaMode = computed(() => internal.value.startsWith('='))
const cursorPos = ref(0)
const isCancelling = ref(false)  // 标记是否正在取消（ESC键）

// Excel 风格的引用选择状态
// 当光标位于操作符之后时，进入"可选状态"，此时点击单元格会替换而不是插入
const isInSelectableState = ref(false)  // 是否处于可选状态
const lastOperatorPos = ref(-1)  // 最后一个操作符的位置
const lastInputWasOperator = ref(false)  // 标记最后一次输入是否是操作符
const hasTextSelection = ref(false)  // 是否有文本选中（用于判断是否可以替换）

// 定义触发可选状态的操作符
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^']

function clearPreCompositionTimer() {
  if (preCompositionTimer.value !== null) {
    window.clearTimeout(preCompositionTimer.value)
    preCompositionTimer.value = null
  }
}

const PRE_COMPOSITION_TIMEOUT = 800

function schedulePreCompositionTimeout() {
  clearPreCompositionTimer()
  preCompositionTimer.value = window.setTimeout(() => {
    awaitingComposition.value = false
    preCompositionBuffer.value = ''
    preCompositionTimer.value = null
  }, PRE_COMPOSITION_TIMEOUT)
}

function resetCompositionGuards(mode: 'edit' | 'typing') {
  awaitingComposition.value = mode === 'typing'
  isComposing.value = false
  preCompositionBuffer.value = ''
  clearPreCompositionTimer()
}

/**
 * 检查输入框中是否选中了文本，以及选中的是否是单元格引用
 */
function checkTextSelection() {
  if (!inputRef.value) {
    hasTextSelection.value = false
    return
  }
  
  const start = inputRef.value.selectionStart ?? 0
  const end = inputRef.value.selectionEnd ?? 0
  
  if (start === end) {
    // 没有选中文本
    hasTextSelection.value = false
    return
  }
  
  const selectedText = internal.value.substring(start, end)
  // 检查选中的文本是否是单元格引用（如 A1、A1:B2）
  const isCellReference = /^[A-Za-z]+\d+(?::[A-Za-z]+\d+)?$/.test(selectedText.trim())
  hasTextSelection.value = isCellReference
}

/**
 * 检测光标是否在可选状态（操作符之后）
 * Excel 逻辑：只有在用户刚刚输入操作符后，才进入可选状态
 * 打开编辑框或移动光标不会自动进入可选状态
 */
function updateSelectableState(justInputted: boolean = false) {
  if (!formulaMode.value) {
    isInSelectableState.value = false
    lastOperatorPos.value = -1
    lastInputWasOperator.value = false
    return
  }
  
  const value = internal.value
  const pos = cursorPos.value
  
  // 检查光标前是否紧跟着操作符（允许有空格）
  let checkPos = pos - 1
  
  // 跳过光标前的空格
  while (checkPos >= 0 && value[checkPos] === ' ') {
    checkPos--
  }
  
  // 检查是否是操作符
  const hasOperatorBefore = checkPos >= 0 && OPERATORS.includes(value[checkPos] || '')
  
  if (hasOperatorBefore && justInputted) {
    // 只有在刚刚输入了操作符时才进入可选状态
    isInSelectableState.value = true
    lastOperatorPos.value = checkPos
    lastInputWasOperator.value = true
  } else if (!hasOperatorBefore || (isInSelectableState.value && checkPos !== lastOperatorPos.value)) {
    // 情况1: 光标前没有操作符
    // 情况2: 光标移动到了不同的操作符位置（说明用户移动了光标）
    // 这两种情况都退出可选状态
    isInSelectableState.value = false
    lastOperatorPos.value = -1
    lastInputWasOperator.value = false
  }
  // 如果光标仍在同一个操作符后面且当前在可选状态，保持状态
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      internal.value = props.value ?? ''
      isCancelling.value = false  // 重置取消标志
      isInSelectableState.value = false  // 重置可选状态
      lastOperatorPos.value = -1
      lastInputWasOperator.value = false
      autoWidth.value = props.width  // 重置宽度
      autoHeight.value = props.height  // 重置高度
      resetCompositionGuards(props.mode)
      nextTick(() => {
        if (inputRef.value) {
          inputRef.value.focus()
          const len = inputRef.value.value.length
          inputRef.value.setSelectionRange(len, len)
          cursorPos.value = len
          // 打开编辑框时不自动进入可选状态
          // updateSelectableState() 不调用
          // 根据内容调整大小
          adjustSize()
        }
      })
    } else {
      resetCompositionGuards('edit')
    }
  }
)

function onKeydown(e: KeyboardEvent) {
  // Alt+Enter 或 Ctrl+Enter：插入换行符
  if (e.key === 'Enter' && (e.altKey || e.ctrlKey)) {
    e.preventDefault()
    e.stopPropagation()
    
    // 在光标位置插入换行符
    if (inputRef.value) {
      const start = inputRef.value.selectionStart ?? 0
      const end = inputRef.value.selectionEnd ?? 0
      const value = internal.value
      
      internal.value = value.substring(0, start) + '\n' + value.substring(end)
      
      nextTick(() => {
        if (inputRef.value) {
          const newPos = start + 1
          inputRef.value.setSelectionRange(newPos, newPos)
          cursorPos.value = newPos
          adjustSize()
        }
      })
    }
    return
  }
  
  // 单独的 Enter：保存
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    emit('save', internal.value)
    return
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    isCancelling.value = true  // 标记为取消操作
    emit('cancel')
    return
  }
  
  // 方向键、Home、End 等移动光标的键
  const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  
  if (navigationKeys.includes(e.key)) {
    // 移动光标时，如果移出了操作符后的位置，退出可选状态
    nextTick(() => {
      if (inputRef.value) {
        cursorPos.value = inputRef.value.selectionStart ?? 0
        // 移动光标不算输入，可能需要退出可选状态
        updateSelectableState(false)
      }
    })
    return
  }
  
  // 记录光标位置供公式单元格引用使用
  if (inputRef.value) {
    nextTick(() => {
      if (inputRef.value) {
        cursorPos.value = inputRef.value.selectionStart ?? 0
      }
    })
  }
}

function onBlur() {
  // 如果是通过ESC取消，不要保存
  if (isCancelling.value) {
    return
  }
  // 如果在公式模式下，延迟保存以允许单元格选择
  if (formulaMode.value) {
    // 在公式模式下，不自动保存，等待用户按回车
    return
  }
  emit('save', internal.value)
}

function onCompositionStartInput(_e: CompositionEvent) {
  isComposing.value = true
  awaitingComposition.value = false
  clearPreCompositionTimer()
  if (preCompositionBuffer.value && inputRef.value) {
    const currentValue = inputRef.value.value
    if (currentValue.endsWith(preCompositionBuffer.value)) {
      const nextValue = currentValue.slice(0, currentValue.length - preCompositionBuffer.value.length)
      inputRef.value.value = nextValue
      internal.value = nextValue
    }
    preCompositionBuffer.value = ''
  }
}

function onCompositionUpdateInput(_e: CompositionEvent) {
  // IME 更新中...
}

function onCompositionEndInput(_e: CompositionEvent) {
  isComposing.value = false
}

function onBeforeInput(e: InputEvent) {
  if (
    awaitingComposition.value &&
    !isComposing.value &&
    e.inputType === 'insertText' &&
    typeof e.data === 'string' &&
    e.data.length === 1
  ) {
    preCompositionBuffer.value += e.data
    schedulePreCompositionTimeout()
  }
}

function onInput(e: InputEvent) {
  // 更新光标位置
  if (inputRef.value) {
    nextTick(() => {
      if (inputRef.value) {
        cursorPos.value = inputRef.value.selectionStart ?? 0
        // 检查是否刚刚输入了内容（而不是删除）
        const justInputted = e.inputType === 'insertText' || e.inputType === 'insertCompositionText'
        updateSelectableState(justInputted)  // 更新可选状态
        // 自动调整大小
        adjustSize()
      }
    })
  }
  // 通知父组件值已变化
  emit('input-change')
}

/**
 * 根据内容自动调整 textarea 大小
 */
function adjustSize() {
  if (!inputRef.value) return
  
  const lines = internal.value.split('\n')
  const lineCount = lines.length
  
  // 计算高度：基于行数
  const minHeight = props.height
  let newHeight = minHeight
  
  if (lineCount > 1) {
    // 多行时才需要扩展高度
    // lineHeight 18px + padding 上下各2px + border 上下各2px
    // 每行占用 18px，加上 padding 和 border
    const lineHeight = 18
    const paddingVertical = 4 // 2px * 2
    const borderVertical = 4 // 2px * 2
    newHeight = Math.max(minHeight, lineCount * lineHeight + paddingVertical + borderVertical)
  }
  
  // 计算需要的宽度（基于内容）
  const maxLineLength = Math.max(...lines.map(line => line.length), 10)
  const charWidth = 7.8 // sans-serif 13px 的大约字符宽度
  const minWidth = props.width
  const paddingHorizontal = 8 // 4px * 2
  const borderHorizontal = 4 // 2px * 2
  const newWidth = Math.max(minWidth, maxLineLength * charWidth + paddingHorizontal + borderHorizontal)
  
  // 更新尺寸
  autoWidth.value = newWidth
  autoHeight.value = newHeight
}

/**
 * 检测应该替换的引用位置
 * Excel 逻辑：
 * 1. 如果在可选状态（操作符后），返回操作符后到光标位置的内容（如果是引用）
 * 2. 如果不在可选状态，检查光标附近是否有引用
 */
function findReferenceToReplace(): { start: number, end: number } | null {
  const value = internal.value
  const pos = cursorPos.value
  
  // 情况1: 在可选状态下，替换操作符后的内容
  if (isInSelectableState.value && lastOperatorPos.value >= 0) {
    const afterOperator = lastOperatorPos.value + 1
    
    // 跳过操作符后的空格
    let start = afterOperator
    while (start < pos && value[start] === ' ') {
      start++
    }
    
    // 如果操作符后到光标位置有内容，检查是否是引用
    if (start < pos) {
      const textAfterOp = value.substring(start, pos).trim()
      // 检查是否是单元格引用格式
      if (/^[A-Za-z]+\d+(?::[A-Za-z]+\d+)?$/.test(textAfterOp)) {
        return { start, end: pos }
      }
    }
    
    // 操作符后无内容或不是引用格式，返回插入位置
    return { start: pos, end: pos }
  }
  
  // 情况2: 不在可选状态，检查光标附近是否有引用
  const refRegex = /\b([A-Za-z]+\d+(?::[A-Za-z]+\d+)?)\b/g
  
  let match
  while ((match = refRegex.exec(value)) !== null) {
    const start = match.index
    const end = start + match[0].length
    
    // 如果光标在引用内部或紧邻引用（前后1个字符内）
    if (pos >= start - 1 && pos <= end + 1) {
      return { start, end }
    }
  }
  
  return null
}

function insertCellReference(cellAddress: string) {
  if (!formulaMode.value) return
  
  if (!inputRef.value) return
  
  const value = internal.value
  
  let newValue: string
  let newPos: number
  
  // 情况1: 用户选中了单元格引用文本（如双击选中了 "D3"）
  if (hasTextSelection.value) {
    const start = inputRef.value.selectionStart ?? 0
    const end = inputRef.value.selectionEnd ?? 0
    // 替换选中的文本
    newValue = value.substring(0, start) + cellAddress + value.substring(end)
    newPos = start + cellAddress.length
  }
  // 情况2: 在可选状态下（操作符后）才使用替换逻辑
  else if (isInSelectableState.value) {
    // 使用 Excel 风格的引用替换逻辑
    const refToReplace = findReferenceToReplace()
    
    if (refToReplace) {
      // 替换找到的引用或在指定位置插入
      newValue = value.substring(0, refToReplace.start) + cellAddress + value.substring(refToReplace.end)
      newPos = refToReplace.start + cellAddress.length
    } else {
      // 在光标位置插入
      const start = cursorPos.value
      newValue = value.substring(0, start) + cellAddress + value.substring(start)
      newPos = start + cellAddress.length
    }
  }
  // 情况3: 非可选状态且没有选中文本
  // 这种情况下，Excel 不会插入引用（这个函数不应该被调用）
  // 但为了防御性编程，我们还是提供一个默认行为
  else {
    // 直接返回，不插入任何内容
    return
  }
  
  internal.value = newValue
  // 通知父组件：通过点击/拖拽插入了引用，触发公式引用高亮更新
  emit('input-change')
  
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.setSelectionRange(newPos, newPos)
      inputRef.value.focus()
      cursorPos.value = newPos
      // 插入引用后，继续保持绿框状态（可选状态）
      // 这样用户可以继续点击其他单元格来替换刚插入的引用
      // isInSelectableState 保持为 true
      hasTextSelection.value = false  // 清除文本选择状态
      // lastOperatorPos 保持不变，这样下次 findReferenceToReplace 可以找到刚插入的引用
      // lastOperatorPos.value 不需要修改
      lastInputWasOperator.value = false
      // 插入引用后根据内容调整大小
      adjustSize()
    }
  })
}

function insertRangeReference(startAddr: string, endAddr: string) {
  if (!formulaMode.value) return
  
  const rangeRef = `${startAddr}:${endAddr}`
  insertCellReference(rangeRef)
}

function onClick() {
  // 点击输入框时更新光标位置和可选状态
  if (inputRef.value) {
    nextTick(() => {
      if (inputRef.value) {
        cursorPos.value = inputRef.value.selectionStart ?? 0
        checkTextSelection()  // 检查是否选中了单元格引用
        // 点击不算输入，可能需要退出可选状态
        updateSelectableState(false)
      }
    })
  }
}

// 监听选择变化
function onSelect() {
  checkTextSelection()
}

onBeforeUnmount(() => {
  clearPreCompositionTimer()
})

// 暴露方法和状态供父组件使用
// 注意：暴露 computed 和 ref 时，父组件需要访问 .value
defineExpose({
  formulaMode,  // computed，父组件访问 .formulaMode.value
  isInSelectableState,  // ref，父组件访问 .isInSelectableState.value
  hasTextSelection,  // ref，父组件访问 .hasTextSelection.value
  insertCellReference,
  insertRangeReference,
  getCurrentValue: () => internal.value,
  getInputElement: () => inputRef.value  // 暴露输入框元素
})
</script>

<template>
  <div v-if="visible" :style="{ position: 'absolute', top: top + 'px', left: left + 'px', zIndex: 100 }">
    <textarea
      ref="inputRef"
      v-model="internal"
      @keydown="onKeydown"
      @click="onClick"
      @select="onSelect"
      @blur="onBlur"
      @compositionstart="onCompositionStartInput"
      @compositionupdate="onCompositionUpdateInput"
      @compositionend="onCompositionEndInput"
      @beforeinput="onBeforeInput"
      @input="onInput"
      :style="{ 
        width: autoWidth + 'px',
        height: autoHeight + 'px',
        boxSizing: 'border-box', 
        padding: '2px 4px',
        fontSize: '13px',
        fontFamily: 'sans-serif',
        lineHeight: '18px',
        border: isInSelectableState 
          ? '2px solid #10b981'  // 绿色表示可选状态（可替换）
          : formulaMode 
            ? '2px solid #ef4444'  // 红色表示公式模式
            : '2px solid #3b82f6',  // 蓝色表示普通编辑
        outline: 'none',
        backgroundColor: formulaMode ? '#fef2f2' : 'white',
        resize: 'none',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }"
    />
  </div>
</template>

