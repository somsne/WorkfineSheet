/**
 * 剪贴板处理模块
 * 
 * 功能概述：
 * - 内部剪贴板：保留公式、样式、边框、格式、合并单元格
 * - Excel 互操作：与 Office 365 Excel 双向复制粘贴
 * - 外部文本：支持 TSV/CSV 格式粘贴
 * 
 * 剪贴板格式：
 * - text/html: Excel 兼容的 HTML 表格（使用 <style> 定义类样式）
 * - text/plain: TSV 纯文本（后备格式）
 * 
 * 核心函数：
 * - copySingleCell / copyRange: 复制单元格/区域
 * - pasteInternal / pasteExternal: 粘贴数据
 * - generateExcelHtml: 生成 Excel 兼容 HTML
 * - parseExcelHtml: 解析 Excel HTML 格式
 * - writeToClipboardWithHtml / readFromClipboardWithHtml: 剪贴板读写
 * 
 * @see docs/features/CLIPBOARD.md 完整文档
 */

import type { InternalClipboardCell, CellStyle, CellBorder, CellFormat, MergedRegion, BorderEdge, BorderStyle } from './types'

export interface InternalClipboard {
  data: InternalClipboardCell[][] | null
  startRow: number
  startCol: number
  /** 复制区域内的合并单元格信息（相对坐标） */
  mergedRegions: Array<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  }>
}

export interface CopySource {
  getValue: (row: number, col: number) => string
  getRawValue: (row: number, col: number) => string
  getCellStyle: (row: number, col: number) => CellStyle
  getCellBorder: (row: number, col: number) => CellBorder | undefined
  getCellFormat: (row: number, col: number) => CellFormat | null
  hasCellStyle: (row: number, col: number) => boolean
  hasCellBorder: (row: number, col: number) => boolean
  hasCellFormat: (row: number, col: number) => boolean
  getMergedRegion: (row: number, col: number) => MergedRegion | null
}

export interface PasteTarget {
  setValue: (row: number, col: number, value: string) => void
  copyCell: (srcRow: number, srcCol: number, destRow: number, destCol: number) => void
  setCellStyle: (row: number, col: number, style: CellStyle) => void
  setCellBorder: (row: number, col: number, border: CellBorder) => void
  setCellFormat: (row: number, col: number, format: CellFormat) => void
  clearCellStyle: (row: number, col: number) => void
  clearCellBorder: (row: number, col: number) => void
  clearCellFormat: (row: number, col: number) => void
  mergeCells: (startRow: number, startCol: number, endRow: number, endCol: number) => void
  unmergeCells: (row: number, col: number) => void
}

/**
 * 复制单个单元格
 */
export async function copySingleCell(
  row: number,
  col: number,
  source: CopySource
): Promise<{ tsv: string; html: string; internalData: InternalClipboardCell[][]; mergedRegions: InternalClipboard['mergedRegions'] }> {
  const value = source.getValue(row, col)
  const rawValue = source.getRawValue(row, col)
  
  const cell: InternalClipboardCell = { 
    value: rawValue, 
    isFormula: rawValue.startsWith('=') 
  }
  
  // 复制样式
  if (source.hasCellStyle(row, col)) {
    cell.style = { ...source.getCellStyle(row, col) }
  }
  
  // 复制边框
  if (source.hasCellBorder(row, col)) {
    const border = source.getCellBorder(row, col)
    if (border) {
      cell.border = { ...border }
    }
  }
  
  // 复制格式
  if (source.hasCellFormat(row, col)) {
    const format = source.getCellFormat(row, col)
    if (format) {
      cell.format = { ...format }
    }
  }
  
  const internalData = [[cell]]
  
  // 检查合并单元格
  const mergedRegions: InternalClipboard['mergedRegions'] = []
  const merged = source.getMergedRegion(row, col)
  if (merged && merged.startRow === row && merged.startCol === col) {
    // 单个单元格复制时，合并区域相对坐标从 0,0 开始
    mergedRegions.push({
      startRow: 0,
      startCol: 0,
      endRow: merged.endRow - merged.startRow,
      endCol: merged.endCol - merged.startCol
    })
  }
  
  // 生成 Excel 兼容的 HTML
  const html = generateExcelHtml(internalData, mergedRegions)
  
  return {
    tsv: value,
    html,
    internalData,
    mergedRegions
  }
}

/**
 * 复制选区范围
 */
export async function copyRange(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  source: CopySource
): Promise<{ tsv: string; html: string; internalData: InternalClipboardCell[][]; mergedRegions: InternalClipboard['mergedRegions'] }> {
  let tsv = ''
  const internalData: InternalClipboardCell[][] = []
  const mergedRegions: InternalClipboard['mergedRegions'] = []
  const processedMergeIds = new Set<string>()
  
  for (let r = startRow; r <= endRow; r++) {
    const row: string[] = []
    const internalRow: InternalClipboardCell[] = []
    
    for (let c = startCol; c <= endCol; c++) {
      // 复制到Excel时只复制计算结果值，不复制公式
      const value = source.getValue(r, c)
      row.push(value)
      
      // 保存原始值到内部剪贴板（包括公式）
      const rawValue = source.getRawValue(r, c)
      const cell: InternalClipboardCell = { 
        value: rawValue, 
        isFormula: rawValue.startsWith('=') 
      }
      
      // 复制样式
      if (source.hasCellStyle(r, c)) {
        cell.style = { ...source.getCellStyle(r, c) }
      }
      
      // 复制边框
      if (source.hasCellBorder(r, c)) {
        const border = source.getCellBorder(r, c)
        if (border) {
          cell.border = { ...border }
        }
      }
      
      // 复制格式
      if (source.hasCellFormat(r, c)) {
        const format = source.getCellFormat(r, c)
        if (format) {
          cell.format = { ...format }
        }
      }
      
      // 检查合并单元格（只记录一次）
      const merged = source.getMergedRegion(r, c)
      if (merged) {
        const mergeId = `${merged.startRow},${merged.startCol}`
        if (!processedMergeIds.has(mergeId)) {
          processedMergeIds.add(mergeId)
          // 检查合并区域是否完全在复制范围内
          if (merged.startRow >= startRow && merged.endRow <= endRow &&
              merged.startCol >= startCol && merged.endCol <= endCol) {
            // 转换为相对坐标
            mergedRegions.push({
              startRow: merged.startRow - startRow,
              startCol: merged.startCol - startCol,
              endRow: merged.endRow - startRow,
              endCol: merged.endCol - startCol
            })
          }
        }
      }
      
      internalRow.push(cell)
    }
    
    tsv += row.join('\t') + '\n'
    internalData.push(internalRow)
  }
  
  // 去掉最后的换行符
  tsv = tsv.slice(0, -1)
  
  // 生成 Excel 兼容的 HTML
  const html = generateExcelHtml(internalData, mergedRegions)
  
  return {
    tsv,
    html,
    internalData,
    mergedRegions
  }
}

/**
 * 粘贴内部剪贴板数据（保留公式、样式、格式、合并单元格）
 * Excel 行为：无论是否有选区，都从起始位置按照剪贴板数据大小粘贴
 */
export function pasteInternal(
  data: InternalClipboardCell[][],
  srcStartRow: number,
  srcStartCol: number,
  destStartRow: number,
  destStartCol: number,
  target: PasteTarget,
  mergedRegions?: InternalClipboard['mergedRegions']
): void {
  // 按照剪贴板数据的实际大小粘贴
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] || { value: '', isFormula: false }
      const srcRow = srcStartRow + r
      const srcCol = srcStartCol + c
      const destRow = destStartRow + r
      const destCol = destStartCol + c
      
      // 先取消目标位置可能存在的合并单元格
      target.unmergeCells(destRow, destCol)
      
      if (cell.isFormula) {
        // 公式：使用 copyCell 保持相对/绝对引用
        target.copyCell(srcRow, srcCol, destRow, destCol)
      } else {
        // 普通值：直接设置
        target.setValue(destRow, destCol, cell.value)
      }
      
      // 粘贴样式
      if (cell.style) {
        target.setCellStyle(destRow, destCol, { ...cell.style })
      } else {
        target.clearCellStyle(destRow, destCol)
      }
      
      // 粘贴边框
      if (cell.border) {
        target.setCellBorder(destRow, destCol, { ...cell.border })
      } else {
        target.clearCellBorder(destRow, destCol)
      }
      
      // 粘贴格式
      if (cell.format) {
        target.setCellFormat(destRow, destCol, { ...cell.format })
      } else {
        target.clearCellFormat(destRow, destCol)
      }
    }
  }
  
  // 恢复合并单元格
  if (mergedRegions && mergedRegions.length > 0) {
    for (const region of mergedRegions) {
      const destMergeStartRow = destStartRow + region.startRow
      const destMergeStartCol = destStartCol + region.startCol
      const destMergeEndRow = destStartRow + region.endRow
      const destMergeEndCol = destStartCol + region.endCol
      
      target.mergeCells(destMergeStartRow, destMergeStartCol, destMergeEndRow, destMergeEndCol)
    }
  }
}

/**
 * 粘贴外部数据（从系统剪贴板）
 * Excel 行为：无论是否有选区，都从起始位置按照剪贴板数据大小粘贴
 */
export function pasteExternal(
  data: string[][],
  destStartRow: number,
  destStartCol: number,
  target: PasteTarget
): void {
  // 按照剪贴板数据的实际大小粘贴
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const value = row[c] || ''
      const destRow = destStartRow + r
      const destCol = destStartCol + c
      
      target.setValue(destRow, destCol, value)
    }
  }
}

/**
 * 解析 CSV 行（处理引号和转义）
 */
export function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 双引号转义
        current += '"'
        i++ // 跳过下一个引号
      } else {
        // 切换引号状态
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // 分隔符
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  cells.push(current)
  return cells
}

/**
 * 解析剪贴板文本为二维数组
 */
export function parseClipboardText(text: string): string[][] {
  // 尝试检测格式：TSV (制表符) 或 CSV (逗号)
  const hasTab = text.includes('\t')
  const delimiter = hasTab ? '\t' : ','
  
  // 解析为二维数组
  const lines = text.split('\n')
  const data: string[][] = []
  
  for (const line of lines) {
    if (!line) {
      // 空行也要保留，保持行对齐
      data.push([])
      continue
    }
    
    if (delimiter === ',') {
      // CSV 格式：处理引号
      const cells = parseCSVLine(line)
      data.push(cells)
    } else {
      // TSV 格式：直接分割，并去除每个单元格的首尾空白（包括\r）
      const cells = line.split('\t').map(cell => cell.trim())
      data.push(cells)
    }
  }
  
  return data
}

/**
 * 写入系统剪贴板
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    // 检查 Clipboard API 是否可用
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
    
    // 降级方案：使用 execCommand（已废弃但兼容性好）
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch (err) {
    console.error('Failed to write to clipboard:', err)
    return false
  }
}

/**
 * 从系统剪贴板读取
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    // 检查 Clipboard API 是否可用
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText()
      return text || null
    }
    // 降级方案：无法主动读取剪贴板，返回 null
    return null
  } catch (err) {
    console.error('Failed to read from clipboard:', err)
    return null
  }
}

/**
 * 检查内部剪贴板是否有效（5秒内）
 */
export function isInternalClipboardValid(lastCopyTimestamp: number, maxAge: number = 5000): boolean {
  return (Date.now() - lastCopyTimestamp) < maxAge
}

// ==================== Excel HTML 格式支持 ====================

/**
 * 将颜色转换为 Excel 兼容的格式
 */
function normalizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined
  // 如果已经是 #RRGGBB 格式，直接返回
  if (color.startsWith('#') && color.length === 7) {
    return color
  }
  // 处理 rgb() 格式
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0')
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0')
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return color
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
}

/**
 * 生成 Excel 兼容的 HTML 表格
 * 包含完整的 HTML 结构和 meta 标签，确保 Excel 能正确识别
 * 模仿 Excel 的 HTML 格式：使用 <style> 标签定义类
 */
export function generateExcelHtml(
  data: InternalClipboardCell[][],
  mergedRegions: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>
): string {
  // 创建合并单元格查找表
  const mergeMap = new Map<string, { rowspan: number; colspan: number; isMain: boolean }>()
  for (const region of mergedRegions) {
    for (let r = region.startRow; r <= region.endRow; r++) {
      for (let c = region.startCol; c <= region.endCol; c++) {
        const key = `${r},${c}`
        if (r === region.startRow && c === region.startCol) {
          mergeMap.set(key, {
            rowspan: region.endRow - region.startRow + 1,
            colspan: region.endCol - region.startCol + 1,
            isMain: true
          })
        } else {
          mergeMap.set(key, { rowspan: 0, colspan: 0, isMain: false })
        }
      }
    }
  }
  
  // 收集所有唯一的样式组合，生成 class
  const styleClasses = new Map<string, string>() // styleKey -> className
  let classIndex = 65 // 从 xl65 开始，模仿 Excel
  
  // 遍历所有单元格，收集样式
  for (let r = 0; r < data.length; r++) {
    const row = data[r] || []
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (cell) {
        const styleKey = generateExcelStyleKey(cell)
        if (styleKey && !styleClasses.has(styleKey)) {
          styleClasses.set(styleKey, `xl${classIndex++}`)
        }
      }
    }
  }
  
  // 生成 <style> 标签内容
  let styleContent = `
<!--table
	{mso-displayed-decimal-separator:"\\.";
	mso-displayed-thousand-separator:"\\,";}
td
	{padding-top:1px;
	padding-right:1px;
	padding-left:1px;
	mso-ignore:padding;
	color:black;
	font-size:12.0pt;
	font-weight:400;
	font-style:normal;
	text-decoration:none;
	font-family:Arial;
	mso-generic-font-family:auto;
	text-align:general;
	vertical-align:middle;
	border:none;
	mso-background-source:auto;
	mso-pattern:auto;
	white-space:nowrap;}
`
  
  // 为每个样式组合生成 class 定义
  for (const [styleKey, className] of styleClasses) {
    styleContent += generateExcelClassStyle(className, styleKey)
  }
  
  styleContent += '\n-->'
  
  // 生成 Excel 兼容的 HTML 结构
  let html = `<html xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=ProgId content=Excel.Sheet>
<meta name=Generator content="WorkfineSheet">
<style>
${styleContent}
</style>
</head>
<body>
<table border=0 cellpadding=0 cellspacing=0 style='border-collapse:collapse;'>
`
  
  for (let r = 0; r < data.length; r++) {
    html += '<tr>'
    const row = data[r] || []
    
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] || { value: '', isFormula: false }
      const key = `${r},${c}`
      const merge = mergeMap.get(key)
      
      // 跳过被合并的单元格
      if (merge && !merge.isMain) {
        continue
      }
      
      // 获取样式 class 和内联样式
      const styleKey = generateExcelStyleKey(cell)
      const className = styleKey ? styleClasses.get(styleKey) : null
      const classAttr = className ? ` class=${className}` : ''
      // 同时生成内联样式，确保浏览器能正确解析（用于本表复制粘贴）
      const inlineStyle = styleKey ? generateInlineStyleFromKey(styleKey) : ''
      const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : ''
      
      let mergeAttrs = ''
      if (merge && merge.isMain) {
        if (merge.rowspan > 1) mergeAttrs += ` rowspan=${merge.rowspan}`
        if (merge.colspan > 1) mergeAttrs += ` colspan=${merge.colspan}`
      }
      
      // 显示值
      const displayValue = cell.value
      
      html += `<td${mergeAttrs}${classAttr}${styleAttr}>${escapeHtml(displayValue)}</td>`
    }
    
    html += '</tr>\n'
  }
  
  html += '</table>\n</body>\n</html>'
  
  return html
}

/**
 * 生成样式的唯一键（用于合并相同样式）
 */
function generateExcelStyleKey(cell: InternalClipboardCell): string | null {
  const parts: string[] = []
  
  if (cell.style) {
    const s = cell.style
    if (s.fontFamily) parts.push(`ff:${s.fontFamily}`)
    if (s.fontSize) parts.push(`fs:${s.fontSize}`)
    if (s.bold) parts.push('b:1')
    if (s.italic) parts.push('i:1')
    if (s.underline) parts.push('u:1')
    if (s.strikethrough) parts.push('st:1')
    if (s.color) parts.push(`c:${s.color}`)
    if (s.backgroundColor) parts.push(`bg:${s.backgroundColor}`)
    if (s.textAlign) parts.push(`ta:${s.textAlign}`)
    if (s.verticalAlign) parts.push(`va:${s.verticalAlign}`)
  }
  
  if (cell.border) {
    const b = cell.border
    if (b.top) parts.push(`bt:${b.top.style || 'thin'}:${b.top.color || '#000'}`)
    if (b.right) parts.push(`br:${b.right.style || 'thin'}:${b.right.color || '#000'}`)
    if (b.bottom) parts.push(`bb:${b.bottom.style || 'thin'}:${b.bottom.color || '#000'}`)
    if (b.left) parts.push(`bl:${b.left.style || 'thin'}:${b.left.color || '#000'}`)
  }
  
  return parts.length > 0 ? parts.join('|') : null
}

/**
 * 根据样式键生成 Excel 格式的 class 样式定义
 */
function generateExcelClassStyle(className: string, styleKey: string): string {
  const styles: string[] = []
  const parts = styleKey.split('|')
  
  let hasBorder = false
  let borderStyle = '.5pt solid black'
  
  for (const part of parts) {
    const [key, value, extra] = part.split(':')
    
    switch (key) {
      case 'ff':
        styles.push(`font-family:${value}`)
        break
      case 'fs':
        styles.push(`font-size:${value}.0pt`)
        break
      case 'b':
        styles.push('font-weight:700')
        break
      case 'i':
        styles.push('font-style:italic')
        break
      case 'u':
        styles.push('text-decoration:underline')
        break
      case 'st':
        styles.push('text-decoration:line-through')
        break
      case 'c':
        styles.push(`color:${normalizeColor(value) || 'black'}`)
        break
      case 'bg':
        const bgColor = normalizeColor(value)
        if (bgColor) {
          styles.push(`background:${bgColor}`)
          styles.push('mso-pattern:black none')
        }
        break
      case 'ta':
        styles.push(`text-align:${value}`)
        break
      case 'va':
        styles.push(`vertical-align:${value}`)
        break
      case 'bt':
      case 'br':
      case 'bb':
      case 'bl':
        hasBorder = true
        // 解析边框样式和颜色
        const bStyle = value || 'thin'
        const bColor = normalizeColor(extra) || 'black'
        const width = bStyle === 'medium' ? '1.5pt' : bStyle === 'thick' ? '2.5pt' : '.5pt'
        const cssStyle = bStyle === 'dashed' ? 'dashed' : bStyle === 'dotted' ? 'dotted' : 'solid'
        borderStyle = `${width} ${cssStyle} ${bColor}`
        break
    }
  }
  
  // 如果有边框，添加边框样式
  if (hasBorder) {
    styles.push(`border:${borderStyle}`)
  }
  
  return `.${className}\n\t{${styles.join(';\n\t')}}\n`
}

/**
 * 根据样式键生成内联样式字符串（用于浏览器解析）
 * 与 generateExcelClassStyle 类似，但生成的是内联样式
 */
function generateInlineStyleFromKey(styleKey: string): string {
  const styles: string[] = []
  const parts = styleKey.split('|')
  
  let hasBorder = false
  let borderStyle = '.5pt solid black'
  
  for (const part of parts) {
    const [key, value, extra] = part.split(':')
    
    switch (key) {
      case 'ff':
        styles.push(`font-family:${value}`)
        break
      case 'fs':
        // 使用 px 而不是 pt，便于浏览器解析
        styles.push(`font-size:${value}px`)
        break
      case 'b':
        styles.push('font-weight:700')
        break
      case 'i':
        styles.push('font-style:italic')
        break
      case 'u':
        styles.push('text-decoration:underline')
        break
      case 'st':
        styles.push('text-decoration:line-through')
        break
      case 'c':
        styles.push(`color:${normalizeColor(value) || 'black'}`)
        break
      case 'bg':
        const bgColor = normalizeColor(value)
        if (bgColor) {
          styles.push(`background-color:${bgColor}`)
        }
        break
      case 'ta':
        styles.push(`text-align:${value}`)
        break
      case 'va':
        styles.push(`vertical-align:${value}`)
        break
      case 'bt':
      case 'br':
      case 'bb':
      case 'bl':
        hasBorder = true
        // 解析边框样式和颜色
        const bStyle = value || 'thin'
        const bColor = normalizeColor(extra) || 'black'
        const width = bStyle === 'medium' ? '2px' : bStyle === 'thick' ? '3px' : '1px'
        const cssStyle = bStyle === 'dashed' ? 'dashed' : bStyle === 'dotted' ? 'dotted' : 'solid'
        borderStyle = `${width} ${cssStyle} ${bColor}`
        break
    }
  }
  
  // 如果有边框，添加边框样式
  if (hasBorder) {
    styles.push(`border:${borderStyle}`)
  }
  
  return styles.join(';')
}

/**
 * 解析 Excel HTML 格式的剪贴板数据
 * Excel 使用 <style> 标签定义样式类，需要通过 getComputedStyle 获取实际样式
 */
export function parseExcelHtml(html: string): {
  data: InternalClipboardCell[][]
  mergedRegions: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>
} | null {
  try {
    // 创建临时容器并挂载到 DOM 以支持 getComputedStyle
    const tempContainer = document.createElement('div')
    tempContainer.style.cssText = 'position: absolute; left: -9999px; top: -9999px; visibility: hidden;'
    tempContainer.innerHTML = html
    document.body.appendChild(tempContainer)
    
    try {
      const table = tempContainer.querySelector('table')
      
      if (!table) {
        return null
      }
      
      const data: InternalClipboardCell[][] = []
      const mergedRegions: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }> = []
      
      // 创建列偏移跟踪（处理 rowspan）
      const colOffsets: (number | undefined)[][] = []
      
      const rows = table.querySelectorAll('tr')
      let rowIndex = 0
      
      rows.forEach((tr) => {
        const rowData: InternalClipboardCell[] = []
        const cells = tr.querySelectorAll('td, th')
        
        // 初始化列偏移数组
        if (!colOffsets[rowIndex]) {
          colOffsets[rowIndex] = []
        }
        
        let colIndex = 0
        const currentRow = colOffsets[rowIndex]!
        
        cells.forEach((td) => {
          // 跳过被 rowspan 占用的列
          while (currentRow[colIndex]) {
            currentRow[colIndex] = (currentRow[colIndex] || 0) - 1
            if (currentRow[colIndex] === 0) {
              currentRow[colIndex] = undefined
            }
            // 填充空单元格
          rowData.push({ value: '', isFormula: false })
          colIndex++
        }
        
        const cell = td as HTMLTableCellElement
        const rowspan = parseInt(cell.getAttribute('rowspan') || '1')
        const colspan = parseInt(cell.getAttribute('colspan') || '1')
        
        // 解析单元格内容
        const value = cell.textContent?.replace(/<br\s*\/?>/gi, '\n').trim() || ''
        const cellData: InternalClipboardCell = {
          value,
          isFormula: value.startsWith('=')
        }
        
        // 解析样式
        const style = parseStyleFromElement(cell)
        if (Object.keys(style).length > 0) {
          cellData.style = style
        }
        
        // 解析边框
        const border = parseBorderFromElement(cell)
        if (border) {
          cellData.border = border
        }
        
        rowData.push(cellData)
        
        // 记录合并区域
        if (rowspan > 1 || colspan > 1) {
          mergedRegions.push({
            startRow: rowIndex,
            startCol: colIndex,
            endRow: rowIndex + rowspan - 1,
            endCol: colIndex + colspan - 1
          })
          
          // 标记后续行的列偏移
          for (let r = 1; r < rowspan; r++) {
            if (!colOffsets[rowIndex + r]) {
              colOffsets[rowIndex + r] = []
            }
            const futureRow = colOffsets[rowIndex + r]!
            for (let c = 0; c < colspan; c++) {
              futureRow[colIndex + c] = rowspan - r
            }
          }
        }
        
        // 填充 colspan 的额外列
        for (let c = 1; c < colspan; c++) {
          rowData.push({ value: '', isFormula: false })
          colIndex++
        }
        
        colIndex++
      })
      
      // 处理行尾被 rowspan 占用的列
      while (currentRow[colIndex]) {
        currentRow[colIndex] = (currentRow[colIndex] || 0) - 1
        if (currentRow[colIndex] === 0) {
          currentRow[colIndex] = undefined
        }
        rowData.push({ value: '', isFormula: false })
        colIndex++
      }
      
      data.push(rowData)
      rowIndex++
    })
    
    return { data, mergedRegions }
    } finally {
      // 清理临时容器
      document.body.removeChild(tempContainer)
    }
  } catch (e) {
    console.error('Failed to parse Excel HTML:', e)
    return null
  }
}

/**
 * 从 HTML 元素解析样式
 * 使用 getComputedStyle 获取最终计算样式（支持 Excel 的 <style> 标签定义）
 */
function parseStyleFromElement(element: HTMLElement): CellStyle {
  const style: CellStyle = {}
  
  // 使用 getComputedStyle 获取计算后的样式（包括来自 <style> 标签的类样式）
  const computed = window.getComputedStyle(element)
  // 同时获取内联样式，优先使用内联样式的值（更准确）
  const inlineStyle = element.style
  
  // 字体 - 优先使用内联样式
  if (inlineStyle.fontFamily) {
    // 内联样式中的字体名，保留完整值（包括回退字体）
    const fontFamily = inlineStyle.fontFamily.replace(/['"]/g, '').trim()
    if (fontFamily) {
      style.fontFamily = fontFamily
    }
  } else if (computed.fontFamily) {
    // 回退到计算样式 - 只取第一个字体（过滤浏览器默认值）
    const fontFamily = computed.fontFamily.replace(/['"]/g, '').split(',')[0]
    if (fontFamily && fontFamily !== 'serif' && fontFamily !== 'sans-serif' && fontFamily !== 'Times New Roman' && fontFamily !== 'Times') {
      style.fontFamily = fontFamily.trim()
    }
  }
  
  // 字号 - 优先使用内联样式
  if (inlineStyle.fontSize) {
    const size = parseFloat(inlineStyle.fontSize)
    if (!isNaN(size) && size > 0) {
      style.fontSize = Math.round(size)
    }
  } else if (computed.fontSize) {
    const size = parseFloat(computed.fontSize)
    if (!isNaN(size) && size > 0) {
      style.fontSize = Math.round(size)
    }
  }
  
  if (computed.fontWeight === 'bold' || computed.fontWeight === '700' || parseInt(computed.fontWeight) >= 700) {
    style.bold = true
  }
  if (computed.fontStyle === 'italic') {
    style.italic = true
  }
  if (computed.textDecorationLine?.includes('underline') || computed.textDecoration?.includes('underline')) {
    style.underline = true
  }
  if (computed.textDecorationLine?.includes('line-through') || computed.textDecoration?.includes('line-through')) {
    style.strikethrough = true
  }
  
  // 颜色
  if (computed.color) {
    const textColor = normalizeColor(computed.color)
    if (textColor && textColor !== '#000000') style.color = textColor
  }
  if (computed.backgroundColor) {
    const bgColor = normalizeColor(computed.backgroundColor)
    // 排除默认透明和白色
    if (bgColor && bgColor !== '#ffffff' && bgColor !== 'transparent' && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      style.backgroundColor = bgColor
    }
  }
  
  // 对齐
  if (computed.textAlign) {
    const align = computed.textAlign.toLowerCase()
    if (align === 'left' || align === 'start') style.textAlign = 'left'
    else if (align === 'center') style.textAlign = 'center'
    else if (align === 'right' || align === 'end') style.textAlign = 'right'
  }
  if (computed.verticalAlign) {
    const va = computed.verticalAlign.toLowerCase()
    if (va === 'top') style.verticalAlign = 'top'
    else if (va === 'middle') style.verticalAlign = 'middle'
    else if (va === 'bottom') style.verticalAlign = 'bottom'
  }
  
  // 换行
  if (computed.whiteSpace === 'pre-wrap' || computed.whiteSpace === 'normal' || computed.wordWrap === 'break-word') {
    style.wrapText = true
  }
  
  return style
}

/**
 * 从 HTML 元素解析边框
 * 使用 getComputedStyle 获取计算后的边框样式
 */
function parseBorderFromElement(element: HTMLElement): CellBorder | null {
  const border: CellBorder = {}
  let hasBorder = false
  
  // 将 CSS border-style 映射到 BorderStyle
  const mapBorderStyle = (cssStyle: string, width: number): BorderStyle => {
    if (cssStyle === 'dashed') return 'dashed'
    if (cssStyle === 'dotted') return 'dotted'
    if (cssStyle === 'double') return 'double'
    // solid 根据宽度判断
    if (width >= 3) return 'thick'
    if (width >= 2) return 'medium'
    return 'thin'
  }
  
  // 从 getComputedStyle 解析单边边框
  // Excel 默认边框颜色是黑色，但浏览器可能解析为白色（当 Excel 未显式指定时）
  // 通过检查 style 属性判断是否显式指定了颜色
  const styleAttr = element.getAttribute('style') || ''
  const hasExplicitBorderColor = /border.*color|border.*#|border.*rgb/i.test(styleAttr)
  
  const parseBorderFromComputed = (
    widthVal: string, 
    styleVal: string, 
    colorVal: string
  ): BorderEdge | null => {
    const width = parseFloat(widthVal)
    if (isNaN(width) || width === 0 || styleVal === 'none') return null
    
    let color = normalizeColor(colorVal) || '#000000'
    
    // 如果颜色是白色且没有显式指定边框颜色，说明是浏览器默认值，使用 Excel 默认的黑色
    // 如果显式指定了白色边框，则保留白色
    if (color === '#ffffff' && !hasExplicitBorderColor) {
      color = '#000000'
    }
    
    const style = mapBorderStyle(styleVal, width)
    return { style, color, width: Math.round(width) || 1 }
  }
  
  // 使用 getComputedStyle 获取边框（支持 Excel 的 <style> 标签）
  const computed = window.getComputedStyle(element)
  
  const top = parseBorderFromComputed(
    computed.borderTopWidth,
    computed.borderTopStyle,
    computed.borderTopColor
  )
  if (top) { border.top = top; hasBorder = true }
  
  const right = parseBorderFromComputed(
    computed.borderRightWidth,
    computed.borderRightStyle,
    computed.borderRightColor
  )
  if (right) { border.right = right; hasBorder = true }
  
  const bottom = parseBorderFromComputed(
    computed.borderBottomWidth,
    computed.borderBottomStyle,
    computed.borderBottomColor
  )
  if (bottom) { border.bottom = bottom; hasBorder = true }
  
  const left = parseBorderFromComputed(
    computed.borderLeftWidth,
    computed.borderLeftStyle,
    computed.borderLeftColor
  )
  if (left) { border.left = left; hasBorder = true }
  
  return hasBorder ? border : null
}

/**
 * 写入系统剪贴板（同时写入 HTML 和纯文本格式）
 */
export async function writeToClipboardWithHtml(text: string, html: string): Promise<boolean> {
  try {
    // 方法1: 使用 Clipboard API 写入多种格式
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        const htmlBlob = new Blob([html], { type: 'text/html' })
        const textBlob = new Blob([text], { type: 'text/plain' })
        
        const clipboardItem = new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        })
        
        await navigator.clipboard.write([clipboardItem])
        return true
      } catch {
        // Clipboard API 失败，尝试 fallback 方法
      }
    }
    
    // 方法2: 使用 execCommand + contentEditable 元素（更好的 Excel 兼容性）
    const container = document.createElement('div')
    container.style.cssText = 'position: fixed; left: -9999px; top: -9999px;'
    container.innerHTML = html
    document.body.appendChild(container)
    
    // 创建选区
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(container)
    selection?.removeAllRanges()
    selection?.addRange(range)
    
    // 执行复制
    const success = document.execCommand('copy')
    
    // 清理
    selection?.removeAllRanges()
    document.body.removeChild(container)
    
    if (success) {
      return true
    }
    
    // 方法3: 降级到纯文本
    return writeToClipboard(text)
  } catch (err) {
    console.error('Failed to write HTML to clipboard:', err)
    // 降级：只写入纯文本
    return writeToClipboard(text)
  }
}

/**
 * 从系统剪贴板读取（优先读取 HTML 格式）
 */
export async function readFromClipboardWithHtml(): Promise<{
  text: string | null
  html: string | null
}> {
  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read()
      let text: string | null = null
      let html: string | null = null
      
      for (const item of items) {
        // 读取 HTML
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html')
          html = await blob.text()
        }
        // 读取纯文本
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          text = await blob.text()
        }
      }
      
      return { text, html }
    }
    
    // 降级：只读取纯文本
    const text = await readFromClipboard()
    return { text, html: null }
  } catch (err) {
    console.error('Failed to read HTML from clipboard:', err)
    const text = await readFromClipboard()
    return { text, html: null }
  }
}
