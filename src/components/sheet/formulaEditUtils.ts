/**
 * 公式编辑工具函数
 * 
 * 本模块包含 FormulaBar 和 RichTextInput 共用的纯函数
 * 这些函数从两个组件中提取，统一维护以避免代码重复
 * 
 * @module formulaEditUtils
 */

import type { FormulaReference } from './types'

// ==================== 常量 ====================

/**
 * Excel 风格引用选择：操作符列表
 * 当光标在这些操作符后面时，进入可选择状态（可通过点击单元格插入引用）
 */
export const FORMULA_OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%', '!']

/**
 * 单元格引用正则表达式（仅本表引用）
 * 匹配：A1, $A$1, A1:B2, $A$1:$B$2 等
 */
export const CELL_REF_REGEX = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g

/**
 * 导航键列表
 */
export const NAVIGATION_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']

// ==================== 类型定义 ====================

/**
 * 键盘动作类型
 * 用于统一解析键盘事件
 */
export type KeyAction = 
  | { type: 'confirm' }                  // Enter (无修饰键)
  | { type: 'confirmAndMoveDown' }       // Enter (单元格编辑器默认行为)
  | { type: 'confirmAndMoveRight' }      // Tab
  | { type: 'cancel' }                   // Escape
  | { type: 'insertLineBreak' }          // Alt+Enter 或 Ctrl+Enter
  | { type: 'navigation'; key: string }  // 方向键等导航键
  | null                                 // 其他键，不处理

/**
 * 公式引用文本索引格式
 * 用于 FormulaBar 和 RichTextInput 的彩色高亮渲染
 */
export interface FormulaReferenceTextIndex {
  ref: string       // 引用文本，如 "A1" 或 "B2:C5"
  color: string     // 颜色，如 "#4472C4"
  startIndex: number // 在文本中的起始索引
  endIndex: number   // 在文本中的结束索引
}

// ==================== HTML 处理 ====================

/**
 * HTML 转义
 * 将特殊字符转换为 HTML 实体，防止 XSS
 * 
 * @param text - 原始文本
 * @returns 转义后的 HTML 安全文本
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * 根据颜色生成对应的浅色背景色
 * 类似 Element UI Tag 的 light 主题效果
 */
function getLightBackground(color: string): string {
  return `${color}1a`  // 添加 1a 后缀表示约 10% 透明度
}

/**
 * 根据颜色生成边框颜色
 * 类似 Element UI Tag 的 light 主题效果
 */
function getLightBorder(color: string): string {
  return `${color}4d`  // 添加 4d 后缀表示约 30% 透明度
}

/**
 * 生成带颜色高亮的公式 HTML
 * 
 * 引用样式说明：
 * - 正常状态（light 主题）：浅色背景 + 深色文字 + 浅色边框
 * - 当前可编辑引用（dark 主题）：深色背景 + 白色文字，表示可以被方向键或点击替换
 * 
 * 边界情况处理：
 * - 空文本返回零宽空格保持光标可见
 * - 超长文本（>10000字符）截断并警告
 * - 纯空格文本使用 &nbsp; 保证可见
 * - 换行符转换为 <br>
 * 
 * @param text - 公式文本
 * @param references - 引用列表（带文本索引）
 * @param options - 选项
 * @returns HTML 字符串
 */
export function generateFormulaHtml(
  text: string,
  references: FormulaReferenceTextIndex[],
  options: {
    /** 是否为公式模式（以 = 开头） */
    isFormula?: boolean
    /** 最大长度限制 */
    maxLength?: number
    /** 是否处于可选择状态 */
    isSelectableState?: boolean
    /** 当前光标位置的可编辑引用（该引用显示 dark 主题） */
    currentEditableRef?: { start: number; end: number } | null
  } = {}
): string {
  const { isFormula = text?.startsWith('=') ?? false, maxLength = 10000, isSelectableState = false, currentEditableRef = null } = options
  
  // 边界情况：空内容 - 使用零宽空格保持光标可见
  if (!text || text.length === 0) {
    return '\u200B'
  }
  
  // 边界情况：超长文本保护
  if (text.length > maxLength) {
    console.warn(`[formulaEditUtils] Text too long (${text.length} > ${maxLength}), truncating`)
    text = text.slice(0, maxLength) + '...'
  }
  
  // 非公式模式或无引用时，返回普通转义文本
  if (!isFormula || !references || references.length === 0) {
    let escaped = escapeHtml(text).replace(/\n/g, '<br>')
    
    // 边界情况：纯空格文本需要使用 &nbsp; 保证可见
    if (/^\s+$/.test(text)) {
      escaped = escaped.replace(/ /g, '&nbsp;')
    }
    
    // 如果原始文本以换行符结尾，添加零宽空格以便光标定位
    if (text.endsWith('\n')) {
      escaped += '\u200B'
    }
    
    return escaped || '\u200B'
  }
  
  // 构建字符级别的颜色数组
  const colors: (string | null)[] = new Array(text.length).fill(null)
  
  for (const ref of references) {
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
      const escapedSegment = escapeHtml(segment).replace(/\n/g, '<br>')
      
      // 判断当前段落是否是可编辑引用（光标所在的引用）
      const isCurrentEditable = currentEditableRef && 
        i >= currentEditableRef.start && 
        j <= currentEditableRef.end
      
      console.log('[generateFormulaHtml] 渲染引用段落', {
        segment,
        i,
        j,
        currentEditableRef,
        isSelectableState,
        isCurrentEditable
      })
      
      if (isSelectableState && isCurrentEditable) {
        // 当前可编辑引用：dark 主题（深色背景 + 白色文字），告知用户可以被替换
        html += `<span style="color: #fff; background-color: ${color}; border-radius: 4px; padding: 0 4px; margin: 0 1px;">${escapedSegment}</span>`
      } else {
        // 其他引用：light 主题（浅色背景 + 深色文字 + 浅色边框）
        const bgColor = getLightBackground(color)
        const borderColor = getLightBorder(color)
        html += `<span style="color: ${color}; background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 4px; padding: 0 4px; margin: 0 1px;">${escapedSegment}</span>`
      }
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
  
  // 如果原始文本以换行符结尾，需要在末尾添加零宽空格
  if (text.endsWith('\n')) {
    html += '\u200B'
  }
  
  return html || '\u200B'
}

// ==================== 光标位置管理 ====================

/**
 * 收集元素内所有文本节点
 * 
 * @param el - 容器元素
 * @returns 文本节点数组
 */
export function collectTextNodes(el: HTMLElement): Text[] {
  const textNodes: Text[] = []
  
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text)
    } else {
      node.childNodes.forEach(walk)
    }
  }
  
  walk(el)
  return textNodes
}

/**
 * 获取编辑器光标位置
 * 
 * 边界情况处理：
 * - 无选区时返回 0
 * - 编辑器未挂载时返回 0
 * - Range 异常时返回 0
 * 
 * @param el - 编辑器元素（contenteditable）
 * @returns 光标位置（字符偏移量）
 */
export function getEditorCursorPosition(el: HTMLElement | null): number {
  if (!el) return 0
  
  try {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return 0
    
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(el)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    
    return preCaretRange.toString().length
  } catch (error) {
    console.warn('[formulaEditUtils] getEditorCursorPosition error:', error)
    return 0
  }
}

/**
 * 设置编辑器光标位置
 * 
 * 边界情况处理：
 * - 负数位置设为 0
 * - 超出长度的位置设为末尾
 * - 无文本节点时设置到容器末尾
 * - Range 操作异常时捕获并警告
 * 
 * @param el - 编辑器元素（contenteditable）
 * @param position - 目标光标位置
 */
export function setEditorCursorPosition(el: HTMLElement | null, position: number): void {
  if (!el) return
  
  try {
    const selection = window.getSelection()
    if (!selection) return
    
    // 边界情况：负数位置
    if (position < 0) position = 0
    
    const range = document.createRange()
    const textNodes = collectTextNodes(el)
    
    let currentPos = 0
    for (const textNode of textNodes) {
      const nodeLength = textNode.length
      if (currentPos + nodeLength >= position) {
        // 边界情况：确保偏移量不超过节点长度
        const offset = Math.min(position - currentPos, nodeLength)
        range.setStart(textNode, offset)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      currentPos += nodeLength
    }
    
    // 如果位置超出或无文本节点，设置到末尾
    range.selectNodeContents(el)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  } catch (error) {
    console.warn('[formulaEditUtils] setEditorCursorPosition error:', error)
  }
}

/**
 * 获取编辑器文本选区
 * 
 * @param el - 编辑器元素
 * @returns 选区的起始和结束位置，如果没有选区返回 null
 */
export function getEditorSelection(el: HTMLElement | null): { start: number; end: number } | null {
  if (!el) return null
  
  try {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    
    const range = selection.getRangeAt(0)
    
    // 计算起始位置
    const startRange = document.createRange()
    startRange.selectNodeContents(el)
    startRange.setEnd(range.startContainer, range.startOffset)
    const start = startRange.toString().length
    
    // 计算结束位置
    const endRange = document.createRange()
    endRange.selectNodeContents(el)
    endRange.setEnd(range.endContainer, range.endOffset)
    const end = endRange.toString().length
    
    return { start, end }
  } catch (error) {
    console.warn('[formulaEditUtils] getEditorSelection error:', error)
    return null
  }
}

/**
 * 获取编辑器纯文本内容
 * 移除零宽空格等不可见字符
 * 
 * @param el - 编辑器元素
 * @returns 纯文本内容
 */
export function getEditorTextContent(el: HTMLElement | null): string {
  if (!el) return ''
  // innerText 会自动将 <br> 转换为 \n
  // 注：jsdom 中 innerText 可能返回空字符串，降级使用 textContent
  const text = el.innerText || el.textContent || ''
  // 移除零宽空格（用于光标定位的占位符）
  return text.replace(/\u200B/g, '')
}

// ==================== 键盘事件处理 ====================

/**
 * 解析键盘事件，返回对应的动作类型
 * 
 * @param e - 键盘事件
 * @param context - 上下文（'formulaBar' 或 'cell'）
 * @returns 动作类型，或 null 表示不处理
 */
export function parseKeyAction(
  e: KeyboardEvent, 
  context: 'formulaBar' | 'cell' = 'cell'
): KeyAction {
  // Alt+Enter 或 Ctrl+Enter：插入换行符（仅在单元格编辑器中）
  if (e.key === 'Enter' && (e.altKey || e.ctrlKey)) {
    if (context === 'cell') {
      return { type: 'insertLineBreak' }
    }
    // FormulaBar 不支持换行，当作普通 Enter 处理
    return { type: 'confirm' }
  }
  
  // 单独的 Enter
  if (e.key === 'Enter') {
    // FormulaBar: 确认编辑
    // Cell: 确认并向下移动（默认行为）
    return context === 'formulaBar' 
      ? { type: 'confirm' } 
      : { type: 'confirmAndMoveDown' }
  }
  
  // Tab：确认并向右移动
  if (e.key === 'Tab') {
    return { type: 'confirmAndMoveRight' }
  }
  
  // Escape：取消编辑
  if (e.key === 'Escape') {
    return { type: 'cancel' }
  }
  
  // 导航键
  if (NAVIGATION_KEYS.includes(e.key)) {
    return { type: 'navigation', key: e.key }
  }
  
  // 其他键不处理
  return null
}

/**
 * 阻止键盘事件默认行为和冒泡
 * 
 * @param e - 键盘事件
 * @param action - 动作类型
 */
export function preventKeyDefault(e: KeyboardEvent, action: KeyAction): void {
  if (!action) return
  
  switch (action.type) {
    case 'confirm':
    case 'confirmAndMoveDown':
    case 'confirmAndMoveRight':
    case 'cancel':
    case 'insertLineBreak':
      e.preventDefault()
      e.stopPropagation()
      break
    // 导航键不阻止默认行为
  }
}

// ==================== 公式引用转换 ====================

/**
 * 公式引用输入格式（兼容两种类型）
 * - range: 来自 types.ts 的 FormulaReference
 * - ref: 来自组件本地定义的旧版 FormulaReference
 */
interface FormulaReferenceInput {
  range?: string
  ref?: string
  color: string
  startIndex?: number
  endIndex?: number
}

/**
 * 生成带颜色高亮的公式 HTML（从 FormulaReference[] 生成）
 * 
 * 这是 FormulaBar 和 RichTextInput 共用的高层封装函数，
 * 内部调用 convertReferencesToTextIndex 和 generateFormulaHtml
 * 
 * @param text - 公式文本
 * @param references - 引用列表（支持 range 或 ref 字段）
 * @param isFormula - 是否为公式模式
 * @param isSelectableState - 是否处于可选择状态（引用可被替换）
 * @param currentEditableRef - 当前光标位置的可编辑引用（用于显示 dark 主题）
 * @returns HTML 字符串
 */
export function generateFormulaHtmlFromRefs(
  text: string,
  references: FormulaReferenceInput[] | undefined,
  isFormula: boolean,
  isSelectableState: boolean = false,
  currentEditableRef: { start: number; end: number } | null = null
): string {
  console.log('[generateFormulaHtmlFromRefs] 入参', {
    text,
    referencesCount: references?.length,
    isFormula,
    isSelectableState,
    currentEditableRef
  })
  
  if (!text || text.length === 0) {
    return '\u200B'
  }
  
  // 转换引用格式为 FormulaReferenceTextIndex
  // 兼容 range（新版）和 ref（旧版）字段
  const refs: FormulaReferenceTextIndex[] = (references || []).map(r => {
    const refText = r.range || r.ref || ''
    return {
      ref: refText,
      color: r.color,
      startIndex: r.startIndex ?? 0,
      endIndex: r.endIndex ?? 0
    }
  })
  
  // 重新计算文本索引（基于 ref 在 text 中的位置）
  const textUpper = text.toUpperCase()
  for (const ref of refs) {
    if (ref.startIndex === 0 && ref.endIndex === 0 && ref.ref) {
      const refUpper = ref.ref.toUpperCase()
      const startIndex = textUpper.indexOf(refUpper)
      if (startIndex !== -1) {
        ref.startIndex = startIndex
        ref.endIndex = startIndex + ref.ref.length
      }
    }
  }
  
  return generateFormulaHtml(text, refs, { isFormula, isSelectableState, currentEditableRef })
}

/**
 * 将公式引用（行列格式）转换为文本索引格式
 * 用于 FormulaBar 和 RichTextInput 的彩色高亮渲染
 * 
 * @param text - 公式文本
 * @param references - 引用列表（行列格式）
 * @returns 引用列表（文本索引格式）
 */
export function convertReferencesToTextIndex(
  text: string,
  references: FormulaReference[]
): FormulaReferenceTextIndex[] {
  const result: FormulaReferenceTextIndex[] = []
  
  if (!text || !references || references.length === 0) {
    return result
  }
  
  const textUpper = text.toUpperCase()
  
  for (const ref of references) {
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
}

// ==================== 可选择状态判断 ====================

/**
 * 判断当前光标位置是否可插入引用
 * 
 * 规则：光标前一个非空白字符必须是以下之一：
 * - `=` 等号
 * - `+` `-` `*` `/` `^` `&` 运算符
 * - `(` `,` `:` `<` `>` `!` 分隔符
 * 
 * @param value - 当前文本值
 * @param cursorPos - 光标位置
 * @returns 是否可插入引用
 */
export function isInSelectablePosition(value: string, cursorPos: number): boolean {
  if (!value || !value.startsWith('=')) return false
  if (cursorPos <= 0) return false
  
  // 检查光标前一个字符是否是操作符
  const prevChar = value.charAt(cursorPos - 1)
  if (prevChar && FORMULA_OPERATORS.includes(prevChar)) {
    return true
  }
  
  // 检查从最后一个操作符到光标之间是否只有空格或单元格引用开始部分
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = value.charAt(i)
    if (char && FORMULA_OPERATORS.includes(char)) {
      const between = value.substring(i + 1, cursorPos)
      // 如果之间只有空格，则可选择
      if (/^\s*$/.test(between)) {
        return true
      }
      // 如果是合法的单元格引用开始部分
      if (/^\s*\$?[A-Z]+\$?\d*$/i.test(between)) {
        return true
      }
      break
    }
  }
  
  return false
}

/**
 * 检查是否有文本选中
 * 
 * @returns 是否有非空选区
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection()
  return !!(selection && !selection.isCollapsed)
}
