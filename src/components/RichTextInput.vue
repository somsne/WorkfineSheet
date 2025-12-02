<script setup lang="ts">
import { nextTick, ref, watch, computed } from 'vue'

/**
 * 公式引用信息
 */
interface FormulaReference {
  ref: string       // 如 "A1" 或 "B2:C5"
  color: string     // 如 "#FF0000"
  startIndex: number
  endIndex: number
}

/**
 * 单元格样式
 */
interface CellStyle {
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  color?: string
  backgroundColor?: string
  underline?: boolean | 'single' | 'double'  // 统一类型：boolean | 'single' | 'double'
  strikethrough?: boolean
  wrapText?: boolean  // 自动换行
  textAlign?: 'left' | 'center' | 'right'  // 水平对齐
  verticalAlign?: 'top' | 'middle' | 'bottom'  // 垂直对齐
}

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
  cellStyle?: CellStyle
  formulaReferences?: FormulaReference[]
  viewportWidth?: number  // 可视区域宽度，用于计算右边界
}>()

const emit = defineEmits<{
  (e: 'save', val: string): void
  (e: 'cancel'): void
  (e: 'cellclick', row: number, col: number): void
  (e: 'input-change'): void
}>()

const internal = ref(props.value ?? '')
let editorRef: HTMLDivElement | null = null
let isInitialized = false  // 防止重复初始化
const isComposing = ref(false)
const cursorPos = ref(0)
const isCancelling = ref(false)
let pendingCursorPos: number | null = null  // 待设置的光标位置（用于插入引用后）

// 回调 ref 函数
function setEditorRef(el: any) {
  editorRef = el as HTMLDivElement | null
  // 当编辑器挂载且 visible=true 时，初始化内容
  // 只在第一次初始化，防止父组件重新渲染时覆盖用户输入
  if (el && props.visible && !isInitialized) {
    nextTick(() => {
      initializeEditor()
    })
  }
}

// 初始化编辑器内容
function initializeEditor() {
  if (!editorRef) return
  
  isInitialized = true  // 标记已初始化
  internal.value = props.value ?? ''
  updateEditorContent(internal.value, false)
  
  // 检查焦点是否在 FormulaBar 中
  // 如果是，说明用户从 FormulaBar 启动编辑，不要抢夺焦点
  const activeElement = document.activeElement as HTMLElement | null
  const isFormulaBarFocused = activeElement?.closest('.formula-bar') !== null
  
  
  // 在测试环境中，focus 和 setCursorPosition 可能会失败
  try {
    // 只有在焦点不在 FormulaBar 时才聚焦
    if (!isFormulaBarFocused) {
      editorRef.focus()
      const len = internal.value.length
      setCursorPosition(len)
      cursorPos.value = len
    } else {
    }
    
    // 初始化时更新可选择状态（对于输入 = 进入公式模式的情况）
    updateSelectableState()
  } catch (error) {
    // 测试环境中可能无法设置光标，忽略错误
    console.warn('[RichTextInput] initializeEditor error:', error)
  }
  
  adjustSize()
}

// 自动调整大小
const autoWidth = ref(props.width)
const autoHeight = ref(props.height)

// 公式相关状态
const formulaMode = computed(() => internal.value?.startsWith('=') ?? false)
const isInSelectableState = ref(false)
const lastOperatorPos = ref(-1)
const hasTextSelection = ref(false)

// Excel 风格引用选择：操作符列表
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%']

// 单元格引用正则表达式（支持绝对引用和区域引用）
// 匹配：A1, $A$1, A1:B2, $A$1:$B$2 等
const CELL_REF_REGEX = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g

// ==================== 光标位置管理 ====================

/**
 * 获取当前光标位置（字符偏移量）
 * 边界情况处理：
 * - 无选区时返回 0
 * - 编辑器未挂载时返回 0
 * - Range 异常时返回 0
 */
function getCursorPosition(): number {
  try {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef) return 0
    
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(editorRef)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    
    return preCaretRange.toString().length
  } catch (error) {
    console.warn('[RichTextInput] getCursorPosition error:', error)
    return 0
  }
}

/**
 * 设置光标到指定位置
 * 边界情况处理：
 * - 负数位置设为 0
 * - 超出长度的位置设为末尾
 * - 无文本节点时设置到容器末尾
 * - Range 操作异常时捕获并警告
 */
function setCursorPosition(position: number) {
  if (!editorRef) return
  
  try {
    const selection = window.getSelection()
    if (!selection) return
    
    // 边界情况：负数位置
    if (position < 0) position = 0
    
    const range = document.createRange()
    
    let currentPos = 0
    const walker = document.createTreeWalker(
      editorRef,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let node: Node | null
    while ((node = walker.nextNode())) {
      const textLength = node.textContent?.length || 0
      if (currentPos + textLength >= position) {
        // 边界情况：确保偏移量不超过节点长度
        const offset = Math.min(position - currentPos, textLength)
        range.setStart(node, offset)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      currentPos += textLength
    }
    
    // 如果位置超出或无文本节点，设置到末尾
    range.selectNodeContents(editorRef)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  } catch (error) {
    console.warn('[RichTextInput] setCursorPosition error:', error)
  }
}

/**
 * 获取纯文本内容
 */
function getTextContent(): string {
  // innerText 会自动将 <br> 转换为 \n，并去除大部分不可见字符
  const text = editorRef?.innerText || ''
  // 移除零宽空格（用于光标定位的占位符）
  return text.replace(/\u200B/g, '')
}

// ==================== HTML 转义 ====================

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ==================== 公式彩色渲染 ====================

/**
 * 生成公式的彩色 HTML
 * 边界情况处理：
 * - 空文本返回 <br> 保持高度
 * - 纯空格文本使用 &nbsp; 保证可见
 * - 超长文本（>10000字符）截断并警告
 */
function generateFormulaHtml(text: string): string {
  // 边界情况：空内容 - 使用零宽空格而不是 <br>
  // <br> 可能会干扰 IME 输入法的组合状态
  if (!text || text.length === 0) {
    return '\u200B'  // 零宽空格，保持光标可见但不干扰 IME
  }
  
  // 边界情况：超长文本保护（防止性能问题）
  const MAX_LENGTH = 10000
  if (text.length > MAX_LENGTH) {
    console.warn(`[RichTextInput] Text too long (${text.length} > ${MAX_LENGTH}), truncating`)
    text = text.slice(0, MAX_LENGTH) + '...'
  }
  
  if (!formulaMode.value || !props.formulaReferences || props.formulaReferences.length === 0) {
    // 非公式模式或无引用，返回普通转义文本
    let escaped = escapeHtml(text).replace(/\n/g, '<br>')
    // 边界情况：纯空格文本需要使用 &nbsp; 保证可见
    if (/^\s+$/.test(text)) {
      escaped = escaped.replace(/ /g, '&nbsp;')
    }
    
    // 如果原始文本以换行符结尾，添加零宽空格以便光标定位
    if (text.endsWith('\n')) {
      escaped += '\u200B'
    }
    
    return escaped || '<br>'
  }
  
  // 构建字符级别的颜色数组
  const colors: (string | null)[] = new Array(text.length).fill(null)
  
  for (const ref of props.formulaReferences) {
    // 边界情况：检查索引有效性
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
      // 找到连续的相同颜色
      let j = i
      while (j < text.length && colors[j] === color) {
        j++
      }
      const segment = text.slice(i, j)
      html += `<span style="color: ${color};">${escapeHtml(segment).replace(/\n/g, '<br>')}</span>`
      i = j
    } else {
      // 找到连续的无颜色文本
      let j = i
      while (j < text.length && !colors[j]) {
        j++
      }
      const segment = text.slice(i, j)
      html += escapeHtml(segment).replace(/\n/g, '<br>')
      i = j
    }
  }
  
  // 如果原始文本以换行符结尾，需要在生成的 HTML 末尾添加零宽空格
  // 这样用户可以在最后一个空行上继续输入（光标可以定位）
  if (text.endsWith('\n')) {
    html += '\u200B' // 零宽空格
  }
  
  return html || '\u200B' // 空内容用零宽空格保持光标可见
}

/**
 * 更新编辑器内容（保持光标位置）
 */
function updateEditorContent(text: string, preserveCursor: boolean = true) {
  if (!editorRef) return
  
  // 关键：在 IME 组合期间不更新编辑器内容，否则会中断输入法
  if (isComposing.value) return
  
  // 检查焦点是否在 FormulaBar 中，如果是则不设置光标（避免抢夺焦点）
  const activeElement = document.activeElement as HTMLElement | null
  const isFormulaBarFocused = activeElement?.closest('.formula-bar') !== null
  
  const currentPos = preserveCursor ? getCursorPosition() : text.length
  const html = generateFormulaHtml(text)
  
  // 性能优化：只在内容真正变化时更新 innerHTML
  if (editorRef.innerHTML !== html) {
    editorRef.innerHTML = html
  }
  
  // 只有在 RichTextInput 有焦点或应该有焦点时才设置光标位置
  if (!isFormulaBarFocused) {
    nextTick(() => {
      setCursorPosition(currentPos)
    })
  }
}

// ==================== 事件处理 ====================

/**
 * 输入事件（带防抖优化）
 */
function handleInput(e: Event) {
  if (isComposing.value) return
  
  // 获取文本：优先从 editorRef，其次从 event.target
  let text = ''
  if (editorRef) {
    text = editorRef.innerText
  } else if (e.target) {
    const target = e.target as HTMLDivElement
    text = target.innerText
  } else {
    return // 无法获取文本，跳过
  }
  
  internal.value = text
  cursorPos.value = getCursorPosition()
  
  // 更新可选择状态和文本选择状态
  if (formulaMode.value) {
    updateSelectableState()
    
    // 检查是否有文本选择
    const selection = window.getSelection()
    hasTextSelection.value = !!(selection && !selection.isCollapsed)
  }
  
  // 🔧 关键修复：不在 handleInput 中调用 updateEditorContent
  // 彩色渲染由 watch(formulaReferences) 统一处理
  // 这样可以避免在用户输入时被覆盖
  
  // 调整大小
  adjustSize()
  
  // 通知父组件（这会触发 CanvasSheet 更新 formulaReferences）
  emit('input-change')
}

/**
 * 键盘按下事件
 */
function handleKeyDown(e: KeyboardEvent) {
  // Alt+Enter 或 Ctrl+Enter：插入换行符
  if (e.key === 'Enter' && (e.altKey || e.ctrlKey)) {
    e.preventDefault()
    e.stopPropagation()
    insertLineBreak()
    return
  }
  
  // 单独的 Enter：保存
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    emit('save', internal.value)
    return
  }
  
  // Escape：取消
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    isCancelling.value = true
    emit('cancel')
    return
  }
  
  // Tab：切换单元格（暂时不处理）
  if (e.key === 'Tab') {
    e.preventDefault()
    // TODO: 实现 Tab 切换单元格
    return
  }
  
  // 方向键等导航键
  const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (navigationKeys.includes(e.key)) {
    nextTick(() => {
      cursorPos.value = getCursorPosition()
      // 光标移动后，更新可选择状态
      if (formulaMode.value) {
        updateSelectableState()
      }
    })
    return
  }
}

/**
 * 插入换行符
 */
function insertLineBreak() {
  const selection = window.getSelection()
  if (!selection || !editorRef) {
    // 测试环境降级：直接在文本中插入换行符
    const text = internal.value || ''
    internal.value = text + '\n'
    nextTick(() => {
      emit('input-change')
    })
    return
  }
  
  const range = selection.getRangeAt(0)
  range.deleteContents()
  
  // 插入 <br> 标签
  const br = document.createElement('br')
  range.insertNode(br)
  
  // 移动光标到 <br> 之后
  // 注意：某些测试环境（JSDOM）可能不支持这些方法，需要错误处理
  try {
    range.setStartAfter(br)
    range.setEndAfter(br)
    
    // 关键：检查是否在末尾，如果是则插入一个零宽空格来"撑开"位置
    // 这样光标就能定位在换行后的新行
    const nextSibling = br.nextSibling
    if (!nextSibling || (nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent === '')) {
      // 在末尾：插入零宽空格
      const textNode = document.createTextNode('\u200B')  // 零宽空格
      range.insertNode(textNode)
      // 光标定位在零宽空格之后
      range.setStartAfter(textNode)
      range.setEndAfter(textNode)
    }
    
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  } catch (error) {
    // 测试环境可能不支持 Range API，降级处理
    console.warn('[RichTextInput] Range API error:', error)
  }
  
  // 更新内部值
  nextTick(() => {
    internal.value = getTextContent()
    cursorPos.value = getCursorPosition()
    adjustSize()
    emit('input-change')
  })
}

/**
 * 粘贴事件（只粘贴纯文本）
 * 边界情况处理：
 * - 空剪贴板内容
 * - 超长文本限制
 * - 清理多余换行和空格
 */
function handlePaste(e: ClipboardEvent) {
  e.preventDefault()
  
  try {
    let text = e.clipboardData?.getData('text/plain') || ''
    
    // 边界情况：空内容
    if (!text) return
    
    // 边界情况：超长文本限制
    const MAX_PASTE_LENGTH = 5000
    if (text.length > MAX_PASTE_LENGTH) {
      console.warn(`[RichTextInput] Pasted text too long (${text.length} > ${MAX_PASTE_LENGTH}), truncating`)
      text = text.slice(0, MAX_PASTE_LENGTH)
    }
    
    // 获取当前光标位置
    const cursorPosition = getCursorPosition()
    const currentText = internal.value
    
    // 在光标位置插入文本
    const before = currentText.slice(0, cursorPosition)
    const after = currentText.slice(cursorPosition)
    const newText = before + text + after
    
    // 直接更新 internal.value，避免从 DOM 读取导致的换行符问题
    internal.value = newText
    
    // 计算新的光标位置
    const newCursorPos = cursorPosition + text.length
    
    // 更新编辑器内容
    updateEditorContent(newText, false)
    
    // 设置光标到插入文本后的位置
    nextTick(() => {
      setCursorPosition(newCursorPos)
      cursorPos.value = newCursorPos
      
      // 更新可选择状态
      if (formulaMode.value) {
        updateSelectableState()
        const selection = window.getSelection()
        hasTextSelection.value = !!(selection && !selection.isCollapsed)
      }
      
      // 调整大小
      adjustSize()
      
      // 通知父组件
      emit('input-change')
    })
  } catch (error) {
    console.warn('[RichTextInput] handlePaste error:', error)
  }
}

/**
 * 复制事件
 */
function handleCopy(e: ClipboardEvent) {
  const selection = window.getSelection()
  const text = selection?.toString() || ''
  
  e.clipboardData?.setData('text/plain', text)
  e.preventDefault()
}

/**
 * 输入法事件
 */
function handleCompositionStart(e: CompositionEvent) {
  // 如果已经在组合中，忽略重复的 compositionstart 事件
  // 这是某些浏览器/输入法的已知问题
  if (isComposing.value) {
    e.stopPropagation()
    return
  }
  isComposing.value = true
}

function handleCompositionUpdate(_e: CompositionEvent) {
  // 组合更新事件，目前不需要特殊处理
}

function handleCompositionEnd(e: CompositionEvent) {
  isComposing.value = false
  // 使用实际的 compositionend 事件来触发 input 处理
  handleInput(e)
  // 触发 input-change 事件
  emit('input-change')
}

/**
 * 失焦事件
 */
function handleBlur(e: FocusEvent) {
  if (isCancelling.value) return
  if (formulaMode.value) return // 公式模式不自动保存
  
  // 检查焦点是否转移到 FormulaBar（公式栏）
  // 如果是，不触发保存，让 FormulaBar 接管编辑
  const relatedTarget = e.relatedTarget as HTMLElement | null
  if (relatedTarget) {
    // 检查是否是 FormulaBar 的输入区域
    const isFormulaBar = relatedTarget.closest('.formula-bar') !== null
    if (isFormulaBar) {
      return
    }
  }
  
  emit('save', internal.value)
}

/**
 * 点击事件
 */
function handleClick() {
  nextTick(() => {
    cursorPos.value = getCursorPosition()
    // 点击后，更新可选择状态
    if (formulaMode.value) {
      updateSelectableState()
    }
  })
}

// ==================== 尺寸调整 ====================

// 测量元素缓存（避免重复创建）
let measureElement: HTMLSpanElement | null = null

/**
 * 获取测量元素（懒加载）
 */
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

/**
 * 测量文本宽度
 */
function measureTextWidth(text: string): number {
  const span = getMeasureElement()
  span.style.fontFamily = props.cellStyle?.fontFamily || 'Arial, sans-serif'
  span.style.fontSize = `${props.cellStyle?.fontSize || 12}px`
  span.style.fontWeight = props.cellStyle?.bold ? 'bold' : 'normal'
  span.style.fontStyle = props.cellStyle?.italic ? 'italic' : 'normal'
  span.textContent = text || ' '  // 空字符串用空格占位
  return span.offsetWidth
}

/**
 * 计算换行后的高度
 */
function calculateWrappedHeight(text: string, containerWidth: number): number {
  const span = getMeasureElement()
  span.style.fontFamily = props.cellStyle?.fontFamily || 'Arial, sans-serif'
  span.style.fontSize = `${props.cellStyle?.fontSize || 12}px`
  span.style.fontWeight = props.cellStyle?.bold ? 'bold' : 'normal'
  span.style.fontStyle = props.cellStyle?.italic ? 'italic' : 'normal'
  span.style.whiteSpace = 'pre-wrap'
  span.style.wordBreak = 'break-all'
  span.style.lineHeight = `${(props.cellStyle?.fontSize || 12) * 1.2}px`
  span.style.width = `${containerWidth}px`
  span.style.display = 'block'
  span.textContent = text || ' '
  const height = span.offsetHeight
  // 恢复默认状态
  span.style.whiteSpace = 'pre'
  span.style.width = 'auto'
  span.style.display = 'inline'
  span.style.lineHeight = ''
  return height
}

/**
 * 根据内容自动调整大小
 * 
 * 规则：
 * 1. 设置了自动换行 (wrapText=true)：宽度固定为单元格宽度，高度根据内容扩展
 * 2. 未设置自动换行 + 未靠近右边界：向右扩展
 * 3. 未设置自动换行 + 靠近右边界：停止扩展，内容换行
 */
function adjustSize() {
  if (!editorRef) return
  
  const text = internal.value || ''
  const wrapText = props.cellStyle?.wrapText ?? false
  const fontSize = props.cellStyle?.fontSize || 12
  const lineHeight = fontSize * 1.2
  // box-sizing: content-box, padding: 0px 2px
  // 内容宽度 = width, 文本可用宽度 = width - padding(4px)
  // 与 renderCells.ts 中的 wrapText padding (4px) 完全一致
  const paddingHorizontal = 4
  const paddingVertical = 0
  const minWidth = props.width
  const minHeight = props.height
  
  // 情况 1: 设置了自动换行 - 宽度固定为单元格宽度
  if (wrapText) {
    // box-sizing: content-box，所以 content width = 单元格宽度 - padding
    // 这样 content + padding = 单元格宽度
    autoWidth.value = minWidth - paddingHorizontal
    // 计算换行后的高度
    const contentWidth = minWidth - paddingHorizontal
    const wrappedHeight = calculateWrappedHeight(text, contentWidth)
    autoHeight.value = Math.max(minHeight, wrappedHeight + paddingVertical)
    return
  }
  
  // 情况 2 和 3: 未设置自动换行
  // 按行分割（Alt+Enter 手动换行）
  const trimmedText = text.replace(/\n+$/, '')
  const lines = trimmedText ? trimmedText.split('\n') : ['']
  
  // 测量每行宽度，取最大值
  let maxLineWidth = 0
  for (const line of lines) {
    const lineWidth = measureTextWidth(line)
    maxLineWidth = Math.max(maxLineWidth, lineWidth)
  }
  
  // requiredWidth 是需要的总宽度（content + padding）
  const requiredWidth = maxLineWidth + paddingHorizontal
  
  // 计算右边界限制
  const viewportRight = props.viewportWidth ?? Infinity
  const maxAllowedWidth = viewportRight - props.left
  
  // 情况 2a: 宽度未超过右边界 - 向右扩展
  if (requiredWidth <= maxAllowedWidth) {
    // box-sizing: content-box，autoWidth 是 content 宽度
    // 总宽度 = content + padding，所以 content = 总宽度 - padding
    const totalWidth = Math.max(minWidth, requiredWidth)
    autoWidth.value = totalWidth - paddingHorizontal
    // 高度根据行数计算
    autoHeight.value = Math.max(minHeight, lines.length * lineHeight + paddingVertical)
  } 
  // 情况 2b: 宽度超过右边界 - 限制宽度，内容换行
  else {
    const constrainedWidth = Math.max(minWidth, maxAllowedWidth)
    // content 宽度 = 总宽度 - padding
    autoWidth.value = constrainedWidth - paddingHorizontal
    // 计算换行后的高度
    const contentWidth = constrainedWidth - paddingHorizontal
    const wrappedHeight = calculateWrappedHeight(text, contentWidth)
    autoHeight.value = Math.max(minHeight, wrappedHeight + paddingVertical)
  }
}

// ==================== 样式 ====================

/**
 * 编辑器样式
 */
const editorStyle = computed(() => {
  const verticalAlign = props.cellStyle?.verticalAlign || 'middle'
  
  const style: Record<string, string> = {
    width: `${autoWidth.value}px`,
    height: `${autoHeight.value}px`,
    boxSizing: 'content-box',
    padding: '0px 2px',
    fontSize: `${props.cellStyle?.fontSize || 12}px`,
    fontFamily: props.cellStyle?.fontFamily || 'Arial, sans-serif',
    lineHeight: `${(props.cellStyle?.fontSize || 12) * 1.2}px`,
    border: isInSelectableState.value 
      ? '2px solid #10b981'
      : formulaMode.value 
        ? '2px solid #ef4444'
        : '2px solid #3b82f6',
    outline: 'none',
    backgroundColor: formulaMode.value 
      ? '#fef2f2' 
      : (props.cellStyle?.backgroundColor || 'white'),
    color: props.cellStyle?.color || '#000000',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    caretColor: '#000000',
    // 水平对齐
    textAlign: props.cellStyle?.textAlign || 'left',
    // 垂直对齐：使用 table-cell + vertical-align（不会导致 span 换行）
    display: 'table-cell',
    verticalAlign: verticalAlign === 'top' ? 'top' : verticalAlign === 'bottom' ? 'bottom' : 'middle',
  }
  
  // 应用粗体和斜体（公式模式除外）
  if (!formulaMode.value) {
    if (props.cellStyle?.bold) {
      style.fontWeight = 'bold'
    }
    if (props.cellStyle?.italic) {
      style.fontStyle = 'italic'
    }
    
    // 应用文本装饰：下划线和删除线
    const decorations: string[] = []
    if (props.cellStyle?.underline) {
      decorations.push(props.cellStyle.underline === 'double' ? 'underline' : 'underline')
    }
    if (props.cellStyle?.strikethrough) {
      decorations.push('line-through')
    }
    if (decorations.length > 0) {
      style.textDecoration = decorations.join(' ')
      // 双下划线样式
      if (props.cellStyle?.underline === 'double') {
        style.textDecorationStyle = 'double'
      }
    }
  }
  
  return style
})

// ==================== 生命周期 ====================

watch(
  () => props.visible,
  (v) => {
    if (v) {
      isCancelling.value = false
      isInSelectableState.value = false
      lastOperatorPos.value = -1
      hasTextSelection.value = false
      autoWidth.value = props.width
      autoHeight.value = props.height
      
      // 初始化会在 setEditorRef 回调中处理
    } else {
      // visible 变为 false 时，重置初始化标记，以便下次打开时能正常初始化
      isInitialized = false
    }
  }
)

// 🔧 监听 props.value 变化，同步来自 FormulaBar 的输入
watch(
  () => props.value,
  (newValue) => {
    // 只有当编辑器可见时才处理
    if (!props.visible || !editorRef) return
    
    // 检查焦点是否在 FormulaBar 中
    const activeElement = document.activeElement as HTMLElement | null
    const isFormulaBarFocused = activeElement?.closest('.formula-bar') !== null
    
    // 如果焦点在 FormulaBar，更新 internal.value 和 DOM（但不设置光标，避免抢夺焦点）
    if (isFormulaBarFocused) {
      if (newValue !== internal.value) {
        internal.value = newValue
        // 更新 DOM 显示（不设置光标）
        const html = generateFormulaHtml(newValue)
        if (editorRef.innerHTML !== html) {
          editorRef.innerHTML = html
        }
      }
      return
    }
    
    // 如果焦点在 RichTextInput，跳过（用户正在输入）
    const hasFocus = document.activeElement === editorRef
    if (hasFocus) {
      return
    }
    
    // 焦点在其他地方，同步值
    if (newValue !== internal.value) {
      internal.value = newValue
      updateEditorContent(newValue, false)
    }
  }
)

// 监听公式引用变化，重新渲染彩色文本
watch(
  () => props.formulaReferences,
  () => {
    if (formulaMode.value && props.visible && editorRef) {
      // 如果焦点在 FormulaBar 中，不要更新内容（让 FormulaBar 自己处理）
      const activeElement = document.activeElement as HTMLElement | null
      const isFormulaBarFocused = activeElement?.closest('.formula-bar') !== null
      if (isFormulaBarFocused) {
        return
      }
      
      // 使用 internal.value，因为 formulaReferences 的 startIndex/endIndex 是基于它计算的
      // 不要使用 editorRef.innerText，因为它可能与 internal.value 不同步
      const currentText = internal.value
      
      // 如果有待设置的光标位置（刚插入引用），使用它
      if (pendingCursorPos !== null) {
        updateEditorContent(currentText, false)
        nextTick(() => {
          setCursorPosition(pendingCursorPos!)
        })
      } else {
        updateEditorContent(currentText, true)
      }
    }
  },
  { deep: true }
)

// ==================== Excel 风格引用选择 ====================

/**
 * 更新可选择状态
 * 当光标在操作符后面时，进入可选择状态
 */
function updateSelectableState() {
  if (!formulaMode.value) {
    isInSelectableState.value = false
    lastOperatorPos.value = -1
    return
  }
  
  const text = internal.value
  const pos = cursorPos.value
  
  // 检查光标前一个字符是否是操作符
  if (pos > 0 && text) {
    const prevChar = text.charAt(pos - 1)
    if (prevChar && OPERATORS.includes(prevChar)) {
      isInSelectableState.value = true
      lastOperatorPos.value = pos - 1
      return
    }
  }
  
  // 检查从最后一个操作符到光标之间是否只有空格或者是单元格引用
  if (text) {
    for (let i = pos - 1; i >= 0; i--) {
      const char = text.charAt(i)
      if (char && OPERATORS.includes(char)) {
        // 找到操作符，检查之间的内容
        const between = text.substring(i + 1, pos)
        // 如果之间只有空格，或者是合法的单元格引用开始部分，则可选择
        if (/^\s*$/.test(between) || /^\s*\$?[A-Z]*\$?\d*$/.test(between)) {
          isInSelectableState.value = true
          lastOperatorPos.value = i
          return
        }
        break
      }
    }
  }
  
  isInSelectableState.value = false
}

/**
 * 查找光标位置要替换的引用
 * 返回要替换的引用的起始和结束位置，如果没有则返回 null
 */
function findReferenceToReplace(): { start: number; end: number; ref: string } | null {
  if (!formulaMode.value) return null
  
  const text = internal.value
  const pos = cursorPos.value
  
  // 重置正则表达式的 lastIndex
  CELL_REF_REGEX.lastIndex = 0
  
  let match: RegExpExecArray | null
  while ((match = CELL_REF_REGEX.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    
    // 检查光标是否在这个引用内或紧跟在后面
    if (pos >= start && pos <= end) {
      return {
        start,
        end,
        ref: match[0]
      }
    }
  }
  
  return null
}

// ==================== 暴露方法 ====================

/**
 * 插入单元格引用
 * @returns 返回插入后的完整文本，用于立即更新 formulaReferences
 */
function insertCellReference(cellAddress: string): string {
  if (!formulaMode.value || !editorRef) return ''
  
  const currentText = internal.value
  
  // 检查是否需要替换已有的引用
  const existingRef = findReferenceToReplace()
  
  let newText: string
  let newCursorPos: number
  
  if (existingRef) {
    // 替换已有的引用
    const beforeRef = currentText.substring(0, existingRef.start)
    const afterRef = currentText.substring(existingRef.end)
    newText = beforeRef + cellAddress + afterRef
    newCursorPos = existingRef.start + cellAddress.length
  } else {
    // 在光标位置插入引用
    const beforeCursor = currentText.substring(0, cursorPos.value)
    const afterCursor = currentText.substring(cursorPos.value)
    newText = beforeCursor + cellAddress + afterCursor
    newCursorPos = cursorPos.value + cellAddress.length
  }
  
  // 更新内容
  internal.value = newText
  cursorPos.value = newCursorPos
  
  // 保存待设置的光标位置，在 watch(formulaReferences) 触发时使用
  pendingCursorPos = newCursorPos
  
  // 重新渲染
  updateEditorContent(newText, false)  // 先不保持光标，避免使用旧位置
  
  // 设置光标位置
  nextTick(() => {
    setCursorPosition(newCursorPos)
    // 更新可选择状态
    updateSelectableState()
    // 清除待设置的位置
    setTimeout(() => {
      pendingCursorPos = null
    }, 200)  // 等待足够长的时间，确保 watch 已经触发
  })
  
  emit('input-change')
  
  return newText
}

/**
 * 插入区域引用
 */
function insertRangeReference(startAddr: string, endAddr: string): string {
  return insertCellReference(`${startAddr}:${endAddr}`)
}

defineExpose({
  // 使用 getter 确保返回最新值
  get formulaMode() { return formulaMode.value },
  get isInSelectableState() { return isInSelectableState.value },
  get hasTextSelection() { return hasTextSelection.value },
  insertCellReference,
  insertRangeReference,
  getCurrentValue: () => internal.value,
  getEditorElement: () => editorRef
})
</script>

<template>
  <div 
    v-if="visible" 
    :style="{ 
      position: 'absolute', 
      top: (top - 2) + 'px', 
      left: (left - 2) + 'px', 
      zIndex: 1000 
    }"
    @mousedown.stop
    @click.stop
  >
    <div
      :ref="setEditorRef"
      contenteditable="true"
      @input="handleInput"
      @keydown="handleKeyDown"
      @paste="handlePaste"
      @copy="handleCopy"
      @compositionstart="handleCompositionStart"
      @compositionupdate="handleCompositionUpdate"
      @compositionend="handleCompositionEnd"
      @blur="handleBlur"
      @click.stop="handleClick"
      :style="editorStyle"
    />
  </div>
</template>

<style scoped>
/* 光标样式 */
div[contenteditable] {
  caret-color: var(--caret-color, #000);
  cursor: text; /* 文本编辑光标 */
  user-select: text; /* 确保可以选中文本 */
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* 彩色引用 span 也确保可选中 */
div[contenteditable] span {
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
}

/* 选区背景色 */
div[contenteditable]::selection,
div[contenteditable] span::selection {
  background-color: var(--selection-bg, rgba(0, 120, 215, 0.3));
}

/* 空内容占位 */
div[contenteditable]:empty::before {
  content: '';
  color: var(--placeholder-color, #999);
}

/* 暗黑模式支持 - 系统偏好 */
@media (prefers-color-scheme: dark) {
  div[contenteditable] {
    --caret-color: #fff;
  }
  
  div[contenteditable]::selection,
  div[contenteditable] span::selection {
    --selection-bg: rgba(100, 180, 255, 0.4);
  }
  
  div[contenteditable]:empty::before {
    --placeholder-color: #666;
  }
}

/* 暗黑模式支持 - 手动切换 */
:global(html.dark) div[contenteditable] {
  --caret-color: #fff;
}

:global(html.dark) div[contenteditable]::selection,
:global(html.dark) div[contenteditable] span::selection {
  --selection-bg: rgba(100, 180, 255, 0.4);
}

:global(html.dark) div[contenteditable]:empty::before {
  --placeholder-color: #666;
}
</style>
