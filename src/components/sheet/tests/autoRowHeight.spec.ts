/**
 * @vitest-environment jsdom
 * 
 * 自动行高计算单元测试
 * 
 * 注意：由于 jsdom 不支持真实的布局计算（offsetWidth/offsetHeight 返回 0），
 * 这里的测试主要验证逻辑流程和边界情况，而不是精确的像素值。
 * 真实的像素级测试在 tests/autorowheight-performance.html 中进行。
 */

import { describe, it, expect } from 'vitest'

// 检测 CI 环境
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

// 模拟行高计算的逻辑函数（不依赖 DOM 测量的纯逻辑部分）

/**
 * 判断是否需要更新行高
 * Excel 行为：只要该行设置过行高（无论值是多少），就不再自动调整
 * @param hasCustomRowHeight 用户是否设置过该行的行高（rowHeights.has(row)）
 * @param requiredHeight 文本所需的高度
 * @param hasWrapText 是否启用自动换行
 * @param currentHeight 当前行高
 */
function shouldUpdateRowHeight(
  hasCustomRowHeight: boolean,
  requiredHeight: number,
  hasWrapText: boolean,
  currentHeight: number = 25
): boolean {
  if (!hasWrapText) return false
  if (hasCustomRowHeight) return false  // 用户设置过行高，不自动调整
  return requiredHeight > currentHeight
}

/**
 * 估算文本需要的行数（基于字符数和容器宽度）
 * 这是一个简化的估算，实际测量在浏览器中进行
 */
function estimateLineCount(
  text: string,
  containerWidth: number,
  avgCharWidth: number = 8
): number {
  if (!text) return 1
  
  const lines = text.split('\n')
  let totalLines = 0
  
  for (const line of lines) {
    const lineWidth = line.length * avgCharWidth
    const linesNeeded = Math.max(1, Math.ceil(lineWidth / containerWidth))
    totalLines += linesNeeded
  }
  
  return totalLines
}

/**
 * 基于行数估算高度
 */
function estimateHeight(
  lineCount: number,
  fontSize: number = 13,
  lineHeightMultiplier: number = 1.4,
  padding: number = 4
): number {
  const lineHeight = fontSize * lineHeightMultiplier
  return Math.ceil(lineCount * lineHeight) + padding
}

/**
 * 格式化样式字符串（用于测试 DOM 元素创建）
 */
function formatMeasureStyleCSS(
  containerWidth: number,
  style: { fontFamily?: string; fontSize?: number; bold?: boolean; italic?: boolean } = {}
): string {
  return `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    width: ${containerWidth - 8}px;
    font-family: ${style.fontFamily || 'sans-serif'};
    font-size: ${style.fontSize || 13}px;
    font-weight: ${style.bold ? 'bold' : 'normal'};
    font-style: ${style.italic ? 'italic' : 'normal'};
    line-height: ${(style.fontSize || 13) * 1.4}px;
    display: block;
  `
}

describe('自动行高计算 - 逻辑测试', () => {
  describe('shouldUpdateRowHeight - 行高更新判断', () => {
    it('非换行单元格不应该更新行高', () => {
      // hasCustomRowHeight=false, requiredHeight=50, hasWrapText=false
      expect(shouldUpdateRowHeight(false, 50, false)).toBe(false)
    })
    
    it('用户设置过行高后不应该自动调整（Excel行为）', () => {
      // 即使设置的是默认值25，只要设置过就不自动调整
      expect(shouldUpdateRowHeight(true, 50, true)).toBe(false)
      expect(shouldUpdateRowHeight(true, 80, true)).toBe(false)
      // 即使需要更多空间，也不自动调整
      expect(shouldUpdateRowHeight(true, 100, true)).toBe(false)
    })
    
    it('换行单元格且未设置过行高时应该自动更新', () => {
      // hasCustomRowHeight=false, 需要高度50，有换行
      expect(shouldUpdateRowHeight(false, 50, true)).toBe(true)
    })
    
    it('内容不需要更多空间时不应该更新', () => {
      // hasCustomRowHeight=false, 但所需高度不超过当前高度
      expect(shouldUpdateRowHeight(false, 20, true, 25)).toBe(false)
      expect(shouldUpdateRowHeight(false, 25, true, 25)).toBe(false)
    })
    
    it('刚好超过当前高度应该更新', () => {
      expect(shouldUpdateRowHeight(false, 26, true, 25)).toBe(true)
    })
  })
  
  describe('estimateLineCount - 行数估算', () => {
    it('空字符串应该返回1行', () => {
      expect(estimateLineCount('', 100)).toBe(1)
    })
    
    it('短文本应该返回1行', () => {
      expect(estimateLineCount('Hi', 100)).toBe(1)
    })
    
    it('包含换行符的文本应该增加行数', () => {
      expect(estimateLineCount('Line1\nLine2', 100)).toBe(2)
      expect(estimateLineCount('L1\nL2\nL3', 100)).toBe(3)
    })
    
    it('长文本应该根据宽度换行', () => {
      const text = 'ABCDEFGHIJ'  // 10个字符，每个约8px = 80px
      expect(estimateLineCount(text, 100)).toBe(1)  // 80 < 100，1行
      expect(estimateLineCount(text, 50)).toBe(2)   // 80 > 50，需要2行
      expect(estimateLineCount(text, 30)).toBe(3)   // 需要3行
    })
    
    it('宽容器应该减少行数', () => {
      const text = 'A very long text that needs wrapping'  // 约36*8 = 288px
      expect(estimateLineCount(text, 100)).toBeGreaterThan(estimateLineCount(text, 300))
    })
  })
  
  describe('estimateHeight - 高度估算', () => {
    it('单行文本应该返回基础高度 + padding', () => {
      const height = estimateHeight(1, 13, 1.4, 4)
      expect(height).toBeGreaterThan(15)
      expect(height).toBeLessThan(25)
    })
    
    it('多行应该增加高度', () => {
      const height1 = estimateHeight(1)
      const height3 = estimateHeight(3)
      expect(height3).toBeGreaterThan(height1 * 2)
    })
    
    it('大字体应该增加高度', () => {
      const small = estimateHeight(1, 12)
      const large = estimateHeight(1, 24)
      expect(large).toBeGreaterThan(small)
    })
    
    it('高度应该包含 padding', () => {
      const withPadding = estimateHeight(1, 13, 1.4, 10)
      const noPadding = estimateHeight(1, 13, 1.4, 0)
      expect(withPadding).toBe(noPadding + 10)
    })
  })
  
  describe('formatMeasureStyleCSS - CSS 样式生成', () => {
    it('应该生成正确的默认样式', () => {
      const css = formatMeasureStyleCSS(100)
      expect(css).toContain('width: 92px')  // 100 - 8
      expect(css).toContain('font-family: sans-serif')
      expect(css).toContain('font-size: 13px')
      expect(css).toContain('font-weight: normal')
      expect(css).toContain('font-style: normal')
    })
    
    it('应该支持自定义字体大小', () => {
      const css = formatMeasureStyleCSS(100, { fontSize: 16 })
      expect(css).toContain('font-size: 16px')
      expect(css).toContain('line-height: 22.4px')  // 16 * 1.4
    })
    
    it('应该支持粗体和斜体', () => {
      const css = formatMeasureStyleCSS(100, { bold: true, italic: true })
      expect(css).toContain('font-weight: bold')
      expect(css).toContain('font-style: italic')
    })
    
    it('应该包含正确的布局样式', () => {
      const css = formatMeasureStyleCSS(100)
      expect(css).toContain('white-space: pre-wrap')
      expect(css).toContain('word-break: break-word')
      expect(css).toContain('display: block')
    })
  })
  
  describe('DOM 元素创建测试', () => {
    it('应该能创建测量元素并添加到 body', () => {
      const span = document.createElement('span')
      span.style.cssText = formatMeasureStyleCSS(100)
      span.textContent = 'Test'
      
      document.body.appendChild(span)
      expect(document.body.contains(span)).toBe(true)
      
      document.body.removeChild(span)
      expect(document.body.contains(span)).toBe(false)
    })
    
    it('应该能正确设置文本内容', () => {
      const span = document.createElement('span')
      span.textContent = 'Hello World'
      expect(span.textContent).toBe('Hello World')
    })
    
    it('空文本应该设置为空格占位', () => {
      const span = document.createElement('span')
      const text = ''
      span.textContent = text || ' '
      expect(span.textContent).toBe(' ')
    })
  })
})

describe('自动行高计算 - 集成测试', () => {
  describe('完整流程模拟', () => {
    it('应该正确判断短文本不需要调整行高', () => {
      const text = 'Hi'
      const containerWidth = 200
      const hasCustomRowHeight = false  // 用户未设置过行高
      const hasWrapText = true
      const currentRowHeight = 25
      
      // 估算
      const lineCount = estimateLineCount(text, containerWidth)
      const requiredHeight = estimateHeight(lineCount)
      
      expect(lineCount).toBe(1)
      // 短文本不需要超过默认高度
      expect(shouldUpdateRowHeight(hasCustomRowHeight, requiredHeight, hasWrapText, currentRowHeight)).toBe(false)
    })
    
    it('应该正确判断长文本需要调整行高', () => {
      const text = '这是一段很长的中文文本，需要在单元格中自动换行显示，测试自动行高功能'
      const containerWidth = 100
      const hasCustomRowHeight = false  // 用户未设置过行高
      const hasWrapText = true
      const currentRowHeight = 25
      
      // 估算（中文字符平均约 13px）
      const lineCount = estimateLineCount(text, containerWidth, 13)
      const requiredHeight = estimateHeight(lineCount)
      
      expect(lineCount).toBeGreaterThan(2)
      expect(requiredHeight).toBeGreaterThan(40)
      expect(shouldUpdateRowHeight(hasCustomRowHeight, requiredHeight, hasWrapText, currentRowHeight)).toBe(true)
    })
    
    it('应该正确处理包含换行符的文本', () => {
      const text = 'Line1\nLine2\nLine3'
      const containerWidth = 200
      const hasCustomRowHeight = false
      const hasWrapText = true
      const currentRowHeight = 25
      
      const lineCount = estimateLineCount(text, containerWidth)
      const requiredHeight = estimateHeight(lineCount)
      
      expect(lineCount).toBe(3)
      expect(requiredHeight).toBeGreaterThan(50)
      expect(shouldUpdateRowHeight(hasCustomRowHeight, requiredHeight, hasWrapText, currentRowHeight)).toBe(true)
    })
    
    it('用户设置过行高后即使内容更长也不自动调整', () => {
      const text = '这是一段很长的中文文本，需要在单元格中自动换行显示'
      const containerWidth = 100
      const hasCustomRowHeight = true  // 用户设置过行高
      const hasWrapText = true
      const currentRowHeight = 25  // 即使设置的是默认值
      
      const lineCount = estimateLineCount(text, containerWidth, 13)
      const requiredHeight = estimateHeight(lineCount)
      
      // 即使需要更多空间，也不自动调整
      expect(requiredHeight).toBeGreaterThan(currentRowHeight)
      expect(shouldUpdateRowHeight(hasCustomRowHeight, requiredHeight, hasWrapText, currentRowHeight)).toBe(false)
    })
  })
  
  describe('边界情况', () => {
    it('空文本应该返回最小行数', () => {
      expect(estimateLineCount('', 100)).toBe(1)
      expect(estimateLineCount('', 10)).toBe(1)
    })
    
    it('极窄容器应该增加行数', () => {
      const text = 'Test'
      expect(estimateLineCount(text, 10, 8)).toBeGreaterThan(estimateLineCount(text, 100, 8))
    })
    
    it('纯空格应该正确计算', () => {
      expect(estimateLineCount('     ', 100)).toBe(1)
    })
    
    it('纯换行符应该增加行数', () => {
      expect(estimateLineCount('\n\n\n', 100)).toBe(4)  // 空行也占一行
    })
    
    it('混合内容应该正确计算', () => {
      const text = 'Short\n\nA very long line that will wrap'
      const lines = estimateLineCount(text, 100, 8)
      expect(lines).toBeGreaterThan(3)
    })
  })
  
  describe('列宽与行高关系', () => {
    it('更窄的列应该需要更多行', () => {
      const text = 'This is a test text'
      const wide = estimateLineCount(text, 200)
      const narrow = estimateLineCount(text, 50)
      
      expect(narrow).toBeGreaterThan(wide)
    })
    
    it('列宽变化应该影响所需行高', () => {
      const text = 'A B C D E F G H I J'
      const widths = [50, 100, 150, 200]
      const lineCounts = widths.map(w => estimateLineCount(text, w))
      
      // 宽度增加，行数应该减少或保持不变
      for (let i = 1; i < lineCounts.length; i++) {
        expect(lineCounts[i]!).toBeLessThanOrEqual(lineCounts[i - 1]!)
      }
    })
  })
})

describe.skipIf(isCI)('自动行高计算 - 性能测试', () => {
  it('行数估算应该快速完成', () => {
    const start = performance.now()
    
    for (let i = 0; i < 10000; i++) {
      estimateLineCount(`Test string ${i} with some content`, 100)
    }
    
    const elapsed = performance.now() - start
    // 10000 次估算应该在 100ms 内完成
    expect(elapsed).toBeLessThan(100)
  })
  
  it('高度估算应该快速完成', () => {
    const start = performance.now()
    
    for (let i = 0; i < 10000; i++) {
      estimateHeight(i % 10 + 1, 13, 1.4, 4)
    }
    
    const elapsed = performance.now() - start
    // 10000 次估算应该在 50ms 内完成
    expect(elapsed).toBeLessThan(50)
  })
  
  it('DOM 元素创建和删除应该快速完成', () => {
    const start = performance.now()
    
    for (let i = 0; i < 1000; i++) {
      const span = document.createElement('span')
      span.style.cssText = formatMeasureStyleCSS(100)
      span.textContent = `Test ${i}`
      document.body.appendChild(span)
      document.body.removeChild(span)
    }
    
    const elapsed = performance.now() - start
    // 1000 次 DOM 操作应该在 500ms 内完成
    expect(elapsed).toBeLessThan(500)
  })
})
