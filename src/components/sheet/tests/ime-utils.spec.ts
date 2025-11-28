import { describe, it, expect } from 'vitest'

/**
 * IME 和文本处理相关的工具函数测试
 * 这些函数从 RichTextInput.vue 和 CanvasSheet.vue 中提取的核心逻辑
 */

// ==================== 从组件中提取的纯函数 ====================

/**
 * 规范化文本用于行数计算
 * 移除尾部换行符，避免空内容被计算为多行
 */
function normalizeTextForLineCount(text: string): string[] {
  const trimmedText = text.replace(/\n+$/, '')
  return trimmedText ? trimmedText.split('\n') : ['']
}

/**
 * 计算文本应该显示的行数
 */
function getLineCount(text: string): number {
  return normalizeTextForLineCount(text).length
}

/**
 * 计算编辑器高度
 * @param text 文本内容
 * @param minHeight 最小高度
 * @param lineHeight 行高
 * @param paddingVertical 垂直内边距
 * @param borderVertical 垂直边框
 */
function calculateEditorHeight(
  text: string,
  minHeight: number,
  lineHeight: number = 18,
  paddingVertical: number = 4,
  borderVertical: number = 4
): number {
  const lineCount = getLineCount(text)
  if (lineCount <= 1) {
    return minHeight
  }
  return Math.max(minHeight, lineCount * lineHeight + paddingVertical + borderVertical)
}

/**
 * 生成空内容的 HTML
 * 使用零宽空格而不是 <br>，避免干扰 IME 输入法
 */
function generateEmptyContentHtml(): string {
  return '\u200B'  // 零宽空格
}

/**
 * 检查文本是否是公式
 */
function isFormula(text: string): boolean {
  return text?.startsWith('=') ?? false
}

// 操作符列表
const OPERATORS = ['(', '=', '+', '-', '*', '/', '&', ',', ':', '<', '>', '^', '%']

/**
 * 检查是否应该进入可选择状态
 * 当光标在操作符后面时，可以点击选择单元格引用
 */
function shouldEnterSelectableState(text: string, cursorPos: number): boolean {
  // 非公式模式不进入可选择状态
  if (!isFormula(text)) return false
  
  // 检查光标前一个字符是否是操作符
  if (cursorPos > 0 && text) {
    const prevChar = text.charAt(cursorPos - 1)
    if (prevChar && OPERATORS.includes(prevChar)) {
      return true
    }
  }
  
  // 检查从最后一个操作符到光标之间是否只有空格或单元格引用的开始部分
  if (text) {
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = text.charAt(i)
      if (char && OPERATORS.includes(char)) {
        const between = text.substring(i + 1, cursorPos)
        // 如果之间只有空格，或者是合法的单元格引用开始部分，则可选择
        if (/^\s*$/.test(between) || /^\s*\$?[A-Z]*\$?\d*$/.test(between)) {
          return true
        }
        break
      }
    }
  }
  
  return false
}

/**
 * 查找最后一个操作符的位置
 */
function findLastOperatorPos(text: string, cursorPos: number): number {
  if (!isFormula(text)) return -1
  
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text.charAt(i)
    if (char && OPERATORS.includes(char)) {
      return i
    }
  }
  return -1
}

// ==================== 测试用例 ====================

describe('normalizeTextForLineCount', () => {
  it('空字符串返回单元素数组', () => {
    expect(normalizeTextForLineCount('')).toEqual([''])
  })
  
  it('单个换行符返回单元素数组', () => {
    expect(normalizeTextForLineCount('\n')).toEqual([''])
  })
  
  it('多个尾部换行符被移除', () => {
    expect(normalizeTextForLineCount('hello\n\n\n')).toEqual(['hello'])
  })
  
  it('正常单行文本', () => {
    expect(normalizeTextForLineCount('hello')).toEqual(['hello'])
  })
  
  it('正常多行文本', () => {
    expect(normalizeTextForLineCount('a\nb\nc')).toEqual(['a', 'b', 'c'])
  })
  
  it('多行文本带尾部换行', () => {
    expect(normalizeTextForLineCount('a\nb\nc\n')).toEqual(['a', 'b', 'c'])
  })
  
  it('只有换行符的文本', () => {
    expect(normalizeTextForLineCount('\n\n\n')).toEqual([''])
  })
})

describe('getLineCount', () => {
  it('空字符串返回 1 行', () => {
    expect(getLineCount('')).toBe(1)
  })
  
  it('单行文本返回 1 行', () => {
    expect(getLineCount('hello world')).toBe(1)
  })
  
  it('两行文本返回 2 行', () => {
    expect(getLineCount('line1\nline2')).toBe(2)
  })
  
  it('三行文本返回 3 行', () => {
    expect(getLineCount('a\nb\nc')).toBe(3)
  })
  
  it('尾部换行符不增加行数', () => {
    expect(getLineCount('hello\n')).toBe(1)
    expect(getLineCount('a\nb\n')).toBe(2)
  })
  
  it('只有换行符返回 1 行', () => {
    expect(getLineCount('\n')).toBe(1)
    expect(getLineCount('\n\n\n')).toBe(1)
  })
})

describe('calculateEditorHeight', () => {
  const minHeight = 26
  const lineHeight = 18
  const paddingVertical = 4
  const borderVertical = 4
  
  it('空内容返回最小高度', () => {
    expect(calculateEditorHeight('', minHeight, lineHeight, paddingVertical, borderVertical)).toBe(minHeight)
  })
  
  it('单行内容返回最小高度', () => {
    expect(calculateEditorHeight('hello', minHeight, lineHeight, paddingVertical, borderVertical)).toBe(minHeight)
  })
  
  it('删除内容后（只剩换行符）返回最小高度', () => {
    expect(calculateEditorHeight('\n', minHeight, lineHeight, paddingVertical, borderVertical)).toBe(minHeight)
  })
  
  it('多行内容返回计算高度', () => {
    const text = 'line1\nline2'
    const expectedHeight = 2 * lineHeight + paddingVertical + borderVertical  // 2 * 18 + 4 + 4 = 44
    expect(calculateEditorHeight(text, minHeight, lineHeight, paddingVertical, borderVertical)).toBe(expectedHeight)
  })
  
  it('三行内容返回更大高度', () => {
    const text = 'a\nb\nc'
    const expectedHeight = 3 * lineHeight + paddingVertical + borderVertical  // 3 * 18 + 4 + 4 = 62
    expect(calculateEditorHeight(text, minHeight, lineHeight, paddingVertical, borderVertical)).toBe(expectedHeight)
  })
  
  it('尾部换行符不影响高度计算', () => {
    expect(calculateEditorHeight('hello\n', minHeight)).toBe(minHeight)
    expect(calculateEditorHeight('a\nb\n', minHeight)).toBe(2 * 18 + 4 + 4)
  })
})

describe('generateEmptyContentHtml', () => {
  it('返回零宽空格而非 <br>', () => {
    const result = generateEmptyContentHtml()
    expect(result).toBe('\u200B')
    expect(result).not.toBe('<br>')
  })
  
  it('零宽空格长度为 1', () => {
    expect(generateEmptyContentHtml().length).toBe(1)
  })
})

describe('isFormula', () => {
  it('以 = 开头的是公式', () => {
    expect(isFormula('=A1+B2')).toBe(true)
    expect(isFormula('=SUM(A1:A10)')).toBe(true)
    expect(isFormula('=')).toBe(true)
  })
  
  it('不以 = 开头的不是公式', () => {
    expect(isFormula('hello')).toBe(false)
    expect(isFormula('123')).toBe(false)
    expect(isFormula(' =A1')).toBe(false)  // 前面有空格
  })
  
  it('空字符串不是公式', () => {
    expect(isFormula('')).toBe(false)
  })
  
  it('null/undefined 不是公式', () => {
    expect(isFormula(null as any)).toBe(false)
    expect(isFormula(undefined as any)).toBe(false)
  })
})

describe('shouldEnterSelectableState', () => {
  describe('非公式模式', () => {
    it('普通文本不进入可选择状态', () => {
      expect(shouldEnterSelectableState('hello', 5)).toBe(false)
    })
    
    it('空字符串不进入可选择状态', () => {
      expect(shouldEnterSelectableState('', 0)).toBe(false)
    })
  })
  
  describe('公式模式 - 操作符后', () => {
    it('= 后面应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=', 1)).toBe(true)
    })
    
    it('=A1+ 后面应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=A1+', 4)).toBe(true)
    })
    
    it('=A1- 后面应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=A1-', 4)).toBe(true)
    })
    
    it('=A1* 后面应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=A1*', 4)).toBe(true)
    })
    
    it('=A1/ 后面应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=A1/', 4)).toBe(true)
    })
    
    it('=SUM( 后面应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=SUM(', 5)).toBe(true)
    })
    
    it('=A1, 后面应进入可选择状态（逗号）', () => {
      expect(shouldEnterSelectableState('=A1,', 4)).toBe(true)
    })
    
    it('=A1: 后面应进入可选择状态（冒号，用于区域引用）', () => {
      expect(shouldEnterSelectableState('=A1:', 4)).toBe(true)
    })
  })
  
  describe('公式模式 - 可选择状态的边界情况', () => {
    // 注意：根据实际组件逻辑，只要光标位置到最近操作符之间的内容
    // 是合法的单元格引用模式（如 A1, $A$1），就会进入可选择状态
    // 这是为了支持"替换已有引用"的功能
    
    it('=A1 光标在引用中间，可以替换引用，应进入可选择状态', () => {
      // 光标在 A 和 1 之间，从 = 到光标之间是 "A"，匹配 /^\s*\$?[A-Z]*\$?\d*$/
      expect(shouldEnterSelectableState('=A1', 2)).toBe(true)
    })
    
    it('=A1+B2 光标在 B2 中间，可以替换引用，应进入可选择状态', () => {
      // 光标在 B 和 2 之间，从 + 到光标之间是 "B"，匹配 /^\s*\$?[A-Z]*\$?\d*$/
      expect(shouldEnterSelectableState('=A1+B2', 5)).toBe(true)
    })
    
    it('=A1+B2 光标在末尾，整个 B2 可以被替换，应进入可选择状态', () => {
      // 光标在末尾，从 + 到光标之间是 "B2"，匹配 /^\s*\$?[A-Z]*\$?\d*$/
      expect(shouldEnterSelectableState('=A1+B2', 6)).toBe(true)
    })
    
    it('=A1+123 光标在末尾，数字也匹配引用模式（因为正则允许）', () => {
      // 实际行为：正则 /^\s*\$?[A-Z]*\$?\d*$/ 中 [A-Z]* 可以为空，所以 123 也匹配
      // 这是一个设计选择，允许用户在数字位置选择单元格
      expect(shouldEnterSelectableState('=A1+123', 7)).toBe(true)
    })
    
    it('=A1+hello 光标在末尾，hello 不是引用，不应进入可选择状态', () => {
      // 小写字母不是合法的单元格引用
      expect(shouldEnterSelectableState('=A1+hello', 9)).toBe(false)
    })
  })
  
  describe('公式模式 - 操作符后有空格', () => {
    it('=A1+ 后面有空格应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=A1+ ', 5)).toBe(true)
    })
    
    it('=A1+  后面有多个空格应进入可选择状态', () => {
      expect(shouldEnterSelectableState('=A1+  ', 6)).toBe(true)
    })
  })
  
  describe('公式模式 - 部分输入的单元格引用', () => {
    it('=A1+B 应进入可选择状态（正在输入引用）', () => {
      expect(shouldEnterSelectableState('=A1+B', 5)).toBe(true)
    })
    
    it('=A1+$A 应进入可选择状态（绝对引用开始）', () => {
      expect(shouldEnterSelectableState('=A1+$A', 6)).toBe(true)
    })
    
    it('=A1+A1 应进入可选择状态（完整引用，可替换）', () => {
      expect(shouldEnterSelectableState('=A1+A1', 6)).toBe(true)
    })
  })
})

describe('findLastOperatorPos', () => {
  it('非公式返回 -1', () => {
    expect(findLastOperatorPos('hello', 5)).toBe(-1)
  })
  
  it('= 的位置', () => {
    expect(findLastOperatorPos('=A1', 3)).toBe(0)
  })
  
  it('+ 的位置', () => {
    expect(findLastOperatorPos('=A1+B2', 6)).toBe(3)
  })
  
  it('多个操作符取最后一个', () => {
    expect(findLastOperatorPos('=A1+B2*C3', 9)).toBe(6)  // * 在位置 6
  })
  
  it('括号也是操作符', () => {
    expect(findLastOperatorPos('=SUM(A1)', 8)).toBe(4)  // ( 在位置 4
  })
  
  it('光标在操作符前', () => {
    expect(findLastOperatorPos('=A1+B2', 3)).toBe(0)  // 光标在 + 前，返回 = 的位置
  })
})
