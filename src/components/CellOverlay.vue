<script setup lang="ts">
/**
 * CellOverlay - 单元格编辑覆盖层（纯展示视图）
 * 
 * 职责：
 * - 渲染外部下发的 displayHtml
 * - 转发所有事件到父组件
 * - 应用单元格样式
 * - 自动调整尺寸
 * - 处理 IME 输入（保持内部状态）
 * 
 * 不负责：
 * - 编辑逻辑（由 FormulaEditManager 处理）
 * - 状态管理（由 FormulaEditManager 持有）
 * - 公式解析（由父组件处理）
 * - 光标位置管理（由父组件控制）
 */

import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { CellStyle } from './sheet/types'

// ==================== Props ====================

const props = withDefaults(defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 是否视觉隐藏（但保持焦点，用于跨 Sheet 引用模式） */
  hidden?: boolean
  /** 格式化后的 HTML（由外部生成） */
  displayHtml: string
  /** 单元格行号 */
  row: number
  /** 单元格列号 */
  col: number
  /** 顶部偏移 (px) */
  top: number
  /** 左侧偏移 (px) */
  left: number
  /** 单元格宽度 */
  width: number
  /** 单元格高度 */
  height: number
  /** 单元格样式 */
  cellStyle?: CellStyle
  /** 是否为公式模式 */
  isFormula?: boolean
  /** 是否处于可选择状态（公式模式下可插入引用） */
  isSelectableState?: boolean
  /** 可视区域宽度（用于计算右边界） */
  viewportWidth?: number
  /** 光标位置（由 Manager 控制） */
  cursorPosition?: number
  /** 当前活动的输入源（用于判断是否应该恢复光标） */
  activeSource?: 'cell' | 'formulaBar' | null
}>(), {
  hidden: false,
  isFormula: false,
  isSelectableState: false,
  cursorPosition: -1,
  activeSource: null
})

// ==================== Emits ====================

const emit = defineEmits<{
  // 键盘事件转发
  (e: 'keydown', event: KeyboardEvent): void
  // 值变化事件（包含完整值和光标位置）
  (e: 'value-change', payload: { value: string; cursorPosition: number }): void
  // 光标位置变化（不含内容变化）
  (e: 'cursor-change', payload: { cursorPosition: number; selection?: { start: number; end: number } }): void
  // 焦点事件
  (e: 'focus'): void
  (e: 'blur', event: FocusEvent): void
  // 点击事件（用于退出方向键选择模式）
  (e: 'click'): void
}>()

// ==================== Refs ====================

const containerRef = ref<HTMLDivElement>()
const displayRef = ref<HTMLDivElement>()

// ==================== IME State (唯一的内部状态) ====================

const isComposing = ref(false)

// ==================== 自动尺寸 ====================

// 初始尺寸：单元格宽高 + 4px（边框补偿 2px + 网格线 2px）
const autoWidth = ref(props.width + 4)
const autoHeight = ref(props.height + 4)

// ==================== Computed ====================

/**
 * 边框颜色（根据状态）
 */
const borderColor = computed(() => {
  if (props.isSelectableState) return '#10b981'  // 绿色
  if (props.isFormula) return '#ef4444'          // 红色
  return '#3b82f6'                                // 蓝色
})

/**
 * 背景颜色
 */
const backgroundColor = computed(() => {
  if (props.isFormula) return '#fef2f2'  // 淡红色
  return props.cellStyle?.backgroundColor || 'white'
})

/**
 * 显示区域样式（文本相关）
 */
const displayStyle = computed(() => {
  const style = props.cellStyle || {}
  const verticalAlign = style.verticalAlign || 'middle'
  
  // 计算 line-height
  const fontSize = style.fontSize || 12
  const lineHeight = fontSize * 1.2
  
  // 计算实际内容行数
  const text = extractTextFromHtml(props.displayHtml)
  const trimmedText = text.replace(/\n+$/, '')
  const lines = trimmedText ? trimmedText.split('\n') : ['']
  const lineCount = lines.length
  
  // 使用 padding 实现垂直居中
  let paddingTop = 0
  let paddingBottom = 0
  
  // 计算需要的垂直内边距
  // autoHeight 是容器高度（包含边框），边框宽度为 4px（2px x 2）
  const borderWidth = 4
  const contentHeight = lineCount * lineHeight
  const availableHeight = autoHeight.value - borderWidth
  if (availableHeight > contentHeight) {
    const extraSpace = availableHeight - contentHeight
    if (verticalAlign === 'top') {
      paddingTop = 0
      paddingBottom = extraSpace
    } else if (verticalAlign === 'bottom') {
      paddingTop = extraSpace
      paddingBottom = 0
    } else {
      // middle - 使用 round 确保对称
      paddingTop = Math.round(extraSpace / 2)
      paddingBottom = extraSpace - paddingTop
    }
  }
  
  return {
    fontSize: fontSize + 'px',
    fontFamily: style.fontFamily || 'Arial, sans-serif',
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: [
      style.underline ? 'underline' : '',
      style.strikethrough ? 'line-through' : ''
    ].filter(Boolean).join(' ') || 'none',
    color: style.color || '#000',
    textAlign: style.textAlign || 'left',
    lineHeight: lineHeight + 'px',
    paddingTop: paddingTop + 'px',
    paddingBottom: paddingBottom + 'px',
  }
})

/**
 * 容器定位样式（位置 + 尺寸 + 边框）
 */
const containerStyle = computed(() => ({
  position: 'absolute' as const,
  top: (props.top - 1) + 'px',  // 边框补偿 (1px 偏移，使 2px 边框中心对齐网格线)
  left: (props.left - 1) + 'px',
  width: autoWidth.value + 'px',
  height: autoHeight.value + 'px',
  border: '2px solid ' + borderColor.value,
  backgroundColor: backgroundColor.value,
  boxSizing: 'border-box' as const,
  zIndex: 1000,
}))

// ==================== 尺寸调整 ====================

let measureElement: HTMLSpanElement | null = null

function getMeasureElement(): HTMLSpanElement {
  if (!measureElement) {
    measureElement = document.createElement('span')
    measureElement.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      pointer-events: none;
    `
    document.body.appendChild(measureElement)
  }
  return measureElement
}

function measureTextWidth(text: string): number {
  const span = getMeasureElement()
  const style = props.cellStyle || {}
  span.style.fontFamily = style.fontFamily || 'Arial, sans-serif'
  span.style.fontSize = `${style.fontSize || 12}px`
  span.style.fontWeight = style.bold ? 'bold' : 'normal'
  span.style.fontStyle = style.italic ? 'italic' : 'normal'
  span.textContent = text || ' '
  return span.offsetWidth
}

function calculateWrappedHeight(text: string, containerWidth: number): number {
  const span = getMeasureElement()
  const style = props.cellStyle || {}
  span.style.fontFamily = style.fontFamily || 'Arial, sans-serif'
  span.style.fontSize = `${style.fontSize || 12}px`
  span.style.fontWeight = style.bold ? 'bold' : 'normal'
  span.style.fontStyle = style.italic ? 'italic' : 'normal'
  span.style.whiteSpace = 'pre-wrap'
  span.style.wordBreak = 'break-all'
  span.style.lineHeight = `${(style.fontSize || 12) * 1.2}px`
  span.style.width = `${containerWidth}px`
  span.style.display = 'block'
  span.textContent = text || ' '
  const height = span.offsetHeight
  // 恢复默认
  span.style.whiteSpace = 'pre'
  span.style.width = 'auto'
  span.style.display = 'inline'
  span.style.lineHeight = ''
  return height
}

function extractTextFromHtml(html: string): string {
  // 先将 <br> 标签转换为换行符，再提取文本
  const htmlWithNewlines = html.replace(/<br\s*\/?>/gi, '\n')
  const div = document.createElement('div')
  div.innerHTML = htmlWithNewlines
  return div.textContent?.replace(/\u200B/g, '') || ''
}

function adjustSize() {
  const text = extractTextFromHtml(props.displayHtml)
  const wrapText = props.cellStyle?.wrapText ?? false
  const paddingHorizontal = 4  // 内容区左右 padding
  const borderWidth = 4        // 2px 边框 x 2
  // 最小宽高 = 单元格宽高 + 4px（边框补偿 2px + 网格线 2px）
  const minWidth = props.width + 4
  const minHeight = props.height + 4
  
  // 调试：检查提取的文本和换行符
  console.log('[CellOverlay] adjustSize', { 
    displayHtml: props.displayHtml?.substring(0, 100), 
    extractedText: text,
    hasNewline: text.includes('\n'),
    lines: text.split('\n'),
    wrapText 
  })
  
  if (wrapText) {
    // 自动换行模式：宽度固定为单元格宽度，高度根据内容调整
    autoWidth.value = minWidth
    const contentWidth = minWidth - borderWidth - paddingHorizontal  // 实际可用内容宽度
    const wrappedHeight = calculateWrappedHeight(text, contentWidth)
    autoHeight.value = Math.max(minHeight, wrappedHeight + borderWidth)
    return
  }
  
  // 非换行模式：计算每行宽度，取最大值
  const trimmedText = text.replace(/\n+$/, '')
  const lines = trimmedText ? trimmedText.split('\n') : ['']
  
  let maxLineWidth = 0
  for (const line of lines) {
    const lineWidth = measureTextWidth(line)
    maxLineWidth = Math.max(maxLineWidth, lineWidth)
  }
  
  // 需要的容器宽度 = 最大行宽 + padding + 边框
  const requiredWidth = maxLineWidth + paddingHorizontal + borderWidth
  const viewportRight = props.viewportWidth ?? Infinity
  const maxAllowedWidth = viewportRight - props.left
  
  if (requiredWidth <= maxAllowedWidth) {
    // 容器宽度取 minWidth 和 requiredWidth 的最大值
    autoWidth.value = Math.max(minWidth, requiredWidth)
    // 高度根据行数计算
    const lineCount = lines.length
    const fontSize = props.cellStyle?.fontSize || 12
    const lineHeight = fontSize * 1.2
    const contentHeight = lineCount * lineHeight
    autoHeight.value = Math.max(minHeight, contentHeight + borderWidth)
  } else {
    // 超出视口，需要强制换行
    autoWidth.value = maxAllowedWidth
    const contentWidth = maxAllowedWidth - borderWidth - paddingHorizontal
    const wrappedHeight = calculateWrappedHeight(text, contentWidth)
    autoHeight.value = Math.max(minHeight, wrappedHeight + borderWidth)
  }
}

/**
 * 检查当前输入源是否是 Overlay（cell）
 */
function isActiveSource(): boolean {
  return props.activeSource === 'cell'
}

/**
 * 恢复光标位置（仅当 activeSource 是 cell 时）
 */
function restoreCursorPosition(pos: number) {
  if (!displayRef.value) return
  
  // 只有当 activeSource 是 cell 时才恢复光标，避免夺取 FormulaBar 的焦点
  if (!isActiveSource()) return
  
  const selection = window.getSelection()
  if (!selection) return
  
  // 遍历文本节点找到正确位置
  const walker = document.createTreeWalker(
    displayRef.value,
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
      return
    }
    currentPos += len
  }
  
  // 如果没找到，放在末尾
  const range = document.createRange()
  range.selectNodeContents(displayRef.value)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

// ==================== 事件处理（只转发，不处理逻辑） ====================

/**
 * 获取当前光标位置和选区
 */
function getCurrentCursorInfo(): { cursorPosition: number; selection?: { start: number; end: number } } {
  const selection = window.getSelection()
  let selectionStart = 0
  let selectionEnd = 0
  
  if (selection && selection.rangeCount > 0 && displayRef.value) {
    const range = selection.getRangeAt(0)
    
    // 计算选区起始位置
    const preStartRange = document.createRange()
    preStartRange.selectNodeContents(displayRef.value)
    preStartRange.setEnd(range.startContainer, range.startOffset)
    selectionStart = preStartRange.toString().replace(/\u200B/g, '').length
    
    // 计算选区结束位置
    const preEndRange = document.createRange()
    preEndRange.selectNodeContents(displayRef.value)
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

function focus() {
  displayRef.value?.focus()
}

/**
 * 处理点击事件 - 发送光标变化
 */
function handleClick() {
  emit('click')
  
  // 在 click 后发送光标变化事件（延迟到下一帧确保光标已更新）
  requestAnimationFrame(() => {
    const cursorInfo = getCurrentCursorInfo()
    console.log('[CellOverlay] handleClick cursor-change', cursorInfo)
    emit('cursor-change', cursorInfo)
  })
}

/**
 * 处理鼠标释放事件（拖拽选择后）
 */
function handleMouseUp() {
  // 延迟获取选区，确保浏览器已更新
  requestAnimationFrame(() => {
    const cursorInfo = getCurrentCursorInfo()
    console.log('[CellOverlay] handleMouseUp cursor-change', cursorInfo)
    emit('cursor-change', cursorInfo)
  })
}

/**
 * 键盘事件 - 大部分转发给父组件处理
 * 但剪切/复制/粘贴由浏览器原生处理
 */
function handleKeyDown(e: KeyboardEvent) {
  console.log('[CellOverlay] handleKeyDown', e.key, 'isComposing:', isComposing.value)
  // IME 组合期间不转发
  if (isComposing.value) return
  
  // Ctrl/Cmd + C/X/V 用于文本的剪切/复制/粘贴，不转发给父组件
  // 让浏览器原生处理这些操作
  const isMod = e.ctrlKey || e.metaKey
  if (isMod && (e.key === 'c' || e.key === 'x' || e.key === 'v')) {
    // 不阻止默认行为，让浏览器处理
    // 不转发给父组件
    console.log('[CellOverlay] 文本剪切/复制/粘贴，由浏览器处理')
    return
  }
  
  emit('keydown', e)
}

/**
 * beforeinput - 捕获字符输入前的事件
 * 阻止默认行为，由 Manager 统一处理
 */
function handleBeforeInput(e: InputEvent) {
  // IME 组合期间允许默认行为
  if (isComposing.value) return
  
  // 阻止默认行为，统一由 Manager 处理
  e.preventDefault()
  
  if (!displayRef.value) return
  
  // 获取当前选区信息
  const selection = window.getSelection()
  let selectionStart = 0
  let selectionEnd = 0
  
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    
    // 计算选区起始位置
    const preStartRange = document.createRange()
    preStartRange.selectNodeContents(displayRef.value)
    preStartRange.setEnd(range.startContainer, range.startOffset)
    selectionStart = preStartRange.toString().replace(/\u200B/g, '').length
    
    // 计算选区结束位置
    const preEndRange = document.createRange()
    preEndRange.selectNodeContents(displayRef.value)
    preEndRange.setEnd(range.endContainer, range.endOffset)
    selectionEnd = preEndRange.toString().replace(/\u200B/g, '').length
  }
  
  // 是否有选中文本
  const hasSelection = selectionStart !== selectionEnd
  
  // 获取当前完整文本
  const currentValue = (displayRef.value.textContent || '').replace(/\u200B/g, '')
  
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
    console.log('[CellOverlay] unhandled inputType:', inputType)
    return
  }
  
  console.log('[CellOverlay] beforeinput', { inputType, data: e.data, selectionStart, selectionEnd, hasSelection, newValue, newCursorPos })
  
  emit('value-change', { value: newValue, cursorPosition: newCursorPos })
}

/**
 * input - 内容变化后的事件（仅用于 IME 结束后的同步）
 */
function handleInput() {
  // 普通输入已在 beforeinput 处理，这里只处理 IME 结束后的情况
  // IME 结束后会触发 input，但 compositionend 已经处理了
}

// ==================== IME 处理（CellOverlay 唯一保留的状态逻辑） ====================

function handleCompositionStart() {
  isComposing.value = true
}

function handleCompositionUpdate(_e: CompositionEvent) {
  // 组合更新时不做处理，等待 compositionend
}

function handleCompositionEnd(_e: CompositionEvent) {
  isComposing.value = false
  
  if (!displayRef.value) return
  
  // IME 输入完成后，读取当前 DOM 的完整内容（已包含 IME 输入的字符）
  const currentValue = (displayRef.value.textContent || '').replace(/\u200B/g, '')
  
  // 计算光标位置
  const selection = window.getSelection()
  let cursorPos = currentValue.length
  
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const preRange = document.createRange()
    preRange.selectNodeContents(displayRef.value)
    preRange.setEnd(range.startContainer, range.startOffset)
    cursorPos = preRange.toString().replace(/\u200B/g, '').length
  }
  
  console.log('[CellOverlay] compositionend', { currentValue, cursorPos })
  
  // 通知 Manager 同步完整内容（与 beforeinput 保持一致的处理方式）
  emit('value-change', { value: currentValue, cursorPosition: cursorPos })
}

// ==================== 焦点事件（直接转发） ====================

function handleFocus() {
  emit('focus')
}

function handleBlur(e: FocusEvent) {
  emit('blur', e)
}

// ==================== 剪贴板事件（文本编辑） ====================

/**
 * 处理粘贴事件 - 粘贴纯文本并同步到 Manager
 */
function handlePaste(e: ClipboardEvent) {
  e.preventDefault()
  e.stopPropagation()  // 阻止事件冒泡到 sheet
  
  if (!displayRef.value) return
  
  // 获取纯文本内容
  const text = e.clipboardData?.getData('text/plain') || ''
  if (!text) return
  
  // 获取当前选区
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    console.log('[CellOverlay] paste: no selection')
    return
  }
  
  const range = selection.getRangeAt(0)
  
  // 检查选区是否在 displayRef 内
  if (!displayRef.value.contains(range.startContainer) && range.startContainer !== displayRef.value) {
    console.log('[CellOverlay] paste: selection not in displayRef')
    // 选区不在显示区域内，插入到末尾
    const currentValue = (displayRef.value.textContent || '').replace(/\u200B/g, '')
    const newValue = currentValue + text
    const newCursorPos = newValue.length
    emit('value-change', { value: newValue, cursorPosition: newCursorPos })
    return
  }
  
  // 计算选区位置
  const preStartRange = document.createRange()
  preStartRange.selectNodeContents(displayRef.value)
  preStartRange.setEnd(range.startContainer, range.startOffset)
  const selectionStart = preStartRange.toString().replace(/\u200B/g, '').length
  
  const preEndRange = document.createRange()
  preEndRange.selectNodeContents(displayRef.value)
  preEndRange.setEnd(range.endContainer, range.endOffset)
  const selectionEnd = preEndRange.toString().replace(/\u200B/g, '').length
  
  // 获取当前值并插入粘贴内容（替换选中部分）
  const currentValue = (displayRef.value.textContent || '').replace(/\u200B/g, '')
  const newValue = currentValue.slice(0, selectionStart) + text + currentValue.slice(selectionEnd)
  const newCursorPos = selectionStart + text.length
  
  console.log('[CellOverlay] paste', { text, selectionStart, selectionEnd, currentValue, newValue, newCursorPos })
  
  emit('value-change', { value: newValue, cursorPosition: newCursorPos })
}

/**
 * 处理剪切事件 - 复制选中文本到剪贴板并删除
 */
function handleCut(e: ClipboardEvent) {
  if (!displayRef.value) return
  
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  
  // 计算选区位置
  const range = selection.getRangeAt(0)
  const preStartRange = document.createRange()
  preStartRange.selectNodeContents(displayRef.value)
  preStartRange.setEnd(range.startContainer, range.startOffset)
  const selectionStart = preStartRange.toString().replace(/\u200B/g, '').length
  
  const preEndRange = document.createRange()
  preEndRange.selectNodeContents(displayRef.value)
  preEndRange.setEnd(range.endContainer, range.endOffset)
  const selectionEnd = preEndRange.toString().replace(/\u200B/g, '').length
  
  // 如果没有选中内容，不处理
  if (selectionStart === selectionEnd) {
    e.preventDefault()
    return
  }
  
  // 获取选中的文本
  const currentValue = (displayRef.value.textContent || '').replace(/\u200B/g, '')
  const selectedText = currentValue.slice(selectionStart, selectionEnd)
  
  // 写入剪贴板
  e.clipboardData?.setData('text/plain', selectedText)
  e.preventDefault()
  
  // 删除选中内容
  const newValue = currentValue.slice(0, selectionStart) + currentValue.slice(selectionEnd)
  const newCursorPos = selectionStart
  
  console.log('[CellOverlay] cut', { selectedText, selectionStart, selectionEnd, newValue, newCursorPos })
  
  emit('value-change', { value: newValue, cursorPosition: newCursorPos })
}

// ==================== Watch ====================

// displayHtml 变化时更新内容并恢复光标
watch(() => props.displayHtml, (html) => {
  if (displayRef.value) {
    displayRef.value.innerHTML = html
    
    // 恢复光标位置（使用 Manager 提供的位置）
    if (props.cursorPosition >= 0) {
      nextTick(() => {
        restoreCursorPosition(props.cursorPosition)
      })
    }
    
    nextTick(() => adjustSize())
  }
})

// 光标位置变化时恢复光标
watch(() => props.cursorPosition, (pos) => {
  if (pos >= 0 && displayRef.value) {
    nextTick(() => {
      restoreCursorPosition(pos)
    })
  }
})

// visible 变化时初始化
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      if (displayRef.value) {
        displayRef.value.innerHTML = props.displayHtml
        
        // 恢复光标位置到末尾
        if (props.cursorPosition >= 0) {
          restoreCursorPosition(props.cursorPosition)
        }
      }
      adjustSize()
    })
  }
})

// 尺寸变化时重新计算
watch([() => props.width, () => props.height], () => {
  adjustSize()
})

// ==================== 生命周期 ====================

onMounted(() => {
  if (displayRef.value && props.displayHtml) {
    displayRef.value.innerHTML = props.displayHtml
    nextTick(() => adjustSize())
  }
})

onBeforeUnmount(() => {
  if (measureElement && measureElement.parentNode) {
    measureElement.parentNode.removeChild(measureElement)
    measureElement = null
  }
})

// ==================== 暴露方法 ====================

defineExpose({
  focus,
  getDisplayElement: () => displayRef.value,
  getContainerElement: () => containerRef.value
})
</script>

<template>
  <div
    v-show="visible"
    ref="containerRef"
    class="cell-overlay"
    :class="{ 'cell-overlay--hidden': hidden }"
    :style="containerStyle"
    @mousedown.stop="handleClick"
    @click.stop
  >
    <!-- 显示区域（contenteditable 用于光标和输入） -->
    <div
      ref="displayRef"
      class="display-area"
      contenteditable="true"
      :style="displayStyle"
      @keydown="handleKeyDown"
      @beforeinput="handleBeforeInput"
      @input="handleInput"
      @compositionstart="handleCompositionStart"
      @compositionupdate="handleCompositionUpdate"
      @compositionend="handleCompositionEnd"
      @paste="handlePaste"
      @cut="handleCut"
      @focus="handleFocus"
      @blur="handleBlur"
      @mousedown.stop
      @mouseup="handleMouseUp"
    ></div>
  </div>
</template>

<style scoped>
.cell-overlay {
  box-sizing: border-box;
  background: #fff;
  overflow: visible;
}

.cell-overlay--hidden {
  /* 视觉隐藏但保持焦点和键盘输入 */
  opacity: 0;
  pointer-events: none;
}

.cell-overlay--hidden .display-area {
  /* 允许输入区域接收键盘事件 */
  pointer-events: auto;
}

.display-area {
  box-sizing: border-box;
  padding: 0 2px;
  outline: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-all;
  cursor: text;
  caret-color: #000;
  /* 使用 width: 100% 和 height: 100% 填满容器 */
  width: 100%;
  height: 100%;
  /* 移除 flex，使用 line-height 方式支持垂直居中 */
  /* 空内容时需要 min-height 保证光标可见 */
  min-height: 1.2em;
}

.display-area:focus {
  caret-color: #000;
}
</style>
