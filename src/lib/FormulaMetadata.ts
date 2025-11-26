/**
 * 公式元数据
 * 存储公式的结构化信息，用于支持相对引用和复制粘贴
 */

export interface CellReferenceToken {
  type: 'cellRef'
  rowOffset: number        // 相对于公式所在单元格的行偏移（如果是相对引用）
  colOffset: number        // 相对于公式所在单元格的列偏移（如果是相对引用）
  absoluteRow?: number     // 绝对行号（如果行是绝对引用）
  absoluteCol?: number     // 绝对列号（如果列是绝对引用）
  isRowAbsolute: boolean   // 行是否为绝对引用
  isColAbsolute: boolean   // 列是否为绝对引用
  originalText: string     // 原始文本，如 "A1", "$A$1"
}

export interface RangeReferenceToken {
  type: 'rangeRef'
  startRef: CellReferenceToken
  endRef: CellReferenceToken
  originalText: string     // 原始文本，如 "A1:B3"
}

export interface TextToken {
  type: 'text'
  value: string
}

export type FormulaToken = CellReferenceToken | RangeReferenceToken | TextToken

export interface FormulaMetadata {
  // 原始公式文本（用于显示和编辑）
  originalFormula: string
  
  // 公式所在的单元格位置（用于计算相对引用）
  formulaRow: number
  formulaCol: number
  
  // 解析后的 token 列表
  tokens: FormulaToken[]
  
  // 是否已解析
  isParsed: boolean
}

/**
 * 公式元数据解析器
 */
export class FormulaMetadataParser {
  /**
   * 解析公式，生成元数据
   * @param formula 原始公式文本（包含 '='）
   * @param formulaRow 公式所在的行号
   * @param formulaCol 公式所在的列号
   */
  static parse(formula: string, formulaRow: number, formulaCol: number): FormulaMetadata {
    if (!formula.startsWith('=')) {
      throw new Error('公式必须以 = 开头')
    }

    const expression = formula.substring(1)
    const tokens: FormulaToken[] = []
    
    // 匹配单元格引用或范围引用
    const refRegex = /(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?/g
    let lastIndex = 0
    let match

    while ((match = refRegex.exec(expression)) !== null) {
      // 添加引用之前的文本
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          value: expression.substring(lastIndex, match.index)
        })
      }

      const isRange = !!match[5] // 检查是否有冒号后的第二个引用

      if (isRange) {
        // 范围引用 A1:B3
        const startRef = this.parseCellRef(
          match[1] || '', match[2] || '', match[3] || '', match[4] || '',
          formulaRow, formulaCol, match[0]
        )
        const endRef = this.parseCellRef(
          match[5] || '', match[6] || '', match[7] || '', match[8] || '',
          formulaRow, formulaCol, match[0]
        )
        
        tokens.push({
          type: 'rangeRef',
          startRef,
          endRef,
          originalText: match[0]
        })
      } else {
        // 单个单元格引用
        const cellRef = this.parseCellRef(
          match[1] || '', match[2] || '', match[3] || '', match[4] || '',
          formulaRow, formulaCol, match[0]
        )
        tokens.push(cellRef)
      }

      lastIndex = refRegex.lastIndex
    }

    // 添加剩余的文本
    if (lastIndex < expression.length) {
      tokens.push({
        type: 'text',
        value: expression.substring(lastIndex)
      })
    }

    return {
      originalFormula: formula,
      formulaRow,
      formulaCol,
      tokens,
      isParsed: true
    }
  }

  /**
   * 解析单个单元格引用
   */
  private static parseCellRef(
    colAbsMarker: string,
    colLetters: string,
    rowAbsMarker: string,
    rowStr: string,
    formulaRow: number,
    formulaCol: number,
    originalText: string
  ): CellReferenceToken {
    const col = this.colLettersToNumber(colLetters.toUpperCase())
    const row = parseInt(rowStr, 10) - 1
    const isColAbsolute = !!colAbsMarker
    const isRowAbsolute = !!rowAbsMarker

    return {
      type: 'cellRef',
      rowOffset: isRowAbsolute ? 0 : row - formulaRow,
      colOffset: isColAbsolute ? 0 : col - formulaCol,
      absoluteRow: isRowAbsolute ? row : undefined,
      absoluteCol: isColAbsolute ? col : undefined,
      isRowAbsolute,
      isColAbsolute,
      originalText
    }
  }

  /**
   * 根据元数据和新位置重建公式
   * @param metadata 公式元数据
   * @param newRow 新的行号
   * @param newCol 新的列号
   */
  static rebuild(metadata: FormulaMetadata, newRow: number, newCol: number): string {
    let formula = '='
    
    for (const token of metadata.tokens) {
      if (token.type === 'text') {
        formula += token.value
      } else if (token.type === 'cellRef') {
        formula += this.rebuildCellRef(token, newRow, newCol)
      } else if (token.type === 'rangeRef') {
        const startRef = this.rebuildCellRef(token.startRef, newRow, newCol)
        const endRef = this.rebuildCellRef(token.endRef, newRow, newCol)
        formula += `${startRef}:${endRef}`
      }
    }
    
    return formula
  }

  /**
   * 重建单个单元格引用
   */
  private static rebuildCellRef(
    ref: CellReferenceToken,
    newRow: number,
    newCol: number
  ): string {
    // 计算实际的行列号
    const actualRow = ref.isRowAbsolute ? ref.absoluteRow! : newRow + ref.rowOffset
    const actualCol = ref.isColAbsolute ? ref.absoluteCol! : newCol + ref.colOffset

    // 构建引用字符串
    const colLetter = this.numberToColLetters(actualCol)
    const rowNum = actualRow + 1
    
    const colPrefix = ref.isColAbsolute ? '$' : ''
    const rowPrefix = ref.isRowAbsolute ? '$' : ''
    
    return `${colPrefix}${colLetter}${rowPrefix}${rowNum}`
  }

  /**
   * 调整元数据（用于插入/删除行列）
   * @param metadata 原始元数据
   * @param operation 操作类型
   * @param index 插入/删除的位置
   * @param count 插入/删除的数量
   */
  static adjust(
    metadata: FormulaMetadata,
    operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
    index: number,
    count: number = 1
  ): FormulaMetadata {
    // 计算公式单元格的新位置
    let newFormulaRow = metadata.formulaRow
    let newFormulaCol = metadata.formulaCol
    
    if (operation === 'insertRow' && metadata.formulaRow >= index) {
      newFormulaRow = metadata.formulaRow + count
    } else if (operation === 'deleteRow' && metadata.formulaRow > index) {
      newFormulaRow = metadata.formulaRow - count
    } else if (operation === 'insertCol' && metadata.formulaCol >= index) {
      newFormulaCol = metadata.formulaCol + count
    } else if (operation === 'deleteCol' && metadata.formulaCol > index) {
      newFormulaCol = metadata.formulaCol - count
    }
    
    const adjustedTokens = metadata.tokens.map(token => {
      if (token.type === 'text') {
        return token
      } else if (token.type === 'cellRef') {
        return this.adjustCellRef(token, operation, index, count, metadata.formulaRow, metadata.formulaCol)
      } else if (token.type === 'rangeRef') {
        return {
          ...token,
          startRef: this.adjustCellRef(token.startRef, operation, index, count, metadata.formulaRow, metadata.formulaCol),
          endRef: this.adjustCellRef(token.endRef, operation, index, count, metadata.formulaRow, metadata.formulaCol)
        }
      }
      return token
    })

    // 使用新的公式位置重建公式文本
    const newFormula = this.rebuild({ ...metadata, tokens: adjustedTokens }, newFormulaRow, newFormulaCol)

    return {
      ...metadata,
      originalFormula: newFormula,
      formulaRow: newFormulaRow,
      formulaCol: newFormulaCol,
      tokens: adjustedTokens
    }
  }

  /**
   * 调整单个单元格引用
   * 注意：这个方法只调整引用本身，不考虑公式单元格的位置变化
   * 公式单元格的位置变化由外层的 adjust() 方法处理
   */
  private static adjustCellRef(
    ref: CellReferenceToken,
    operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
    index: number,
    count: number,
    formulaRow: number,
    formulaCol: number
  ): CellReferenceToken {
    const newRef = { ...ref }

    // 计算当前引用的实际位置
    const actualRow = ref.isRowAbsolute ? ref.absoluteRow! : formulaRow + ref.rowOffset
    const actualCol = ref.isColAbsolute ? ref.absoluteCol! : formulaCol + ref.colOffset

    let newActualRow = actualRow
    let newActualCol = actualCol
    let isDeleted = false

    // 计算公式单元格的新位置
    let newFormulaRow = formulaRow
    let newFormulaCol = formulaCol
    
    switch (operation) {
      case 'insertRow':
        if (actualRow >= index) {
          newActualRow = actualRow + count
        }
        if (formulaRow >= index) {
          newFormulaRow = formulaRow + count
        }
        break

      case 'deleteRow':
        if (actualRow === index) {
          isDeleted = true
        } else if (actualRow > index) {
          newActualRow = actualRow - count
        }
        if (formulaRow > index) {
          newFormulaRow = formulaRow - count
        }
        break

      case 'insertCol':
        if (actualCol >= index) {
          newActualCol = actualCol + count
        }
        if (formulaCol >= index) {
          newFormulaCol = formulaCol + count
        }
        break

      case 'deleteCol':
        if (actualCol === index) {
          isDeleted = true
        } else if (actualCol > index) {
          newActualCol = actualCol - count
        }
        if (formulaCol > index) {
          newFormulaCol = formulaCol - count
        }
        break
    }

    if (isDeleted) {
      // 引用被删除，标记为 #REF!
      return {
        type: 'cellRef',
        rowOffset: 0,
        colOffset: 0,
        isRowAbsolute: false,
        isColAbsolute: false,
        originalText: '#REF!'
      }
    }

    // 更新引用 - 使用新的公式位置计算偏移
    if (ref.isRowAbsolute) {
      newRef.absoluteRow = newActualRow
    } else {
      newRef.rowOffset = newActualRow - newFormulaRow
    }

    if (ref.isColAbsolute) {
      newRef.absoluteCol = newActualCol
    } else {
      newRef.colOffset = newActualCol - newFormulaCol
    }

    // 重要：更新 originalText 以反映新的引用
    // 使用 rebuildCellRef 生成新的引用文本
    newRef.originalText = this.rebuildCellRef(newRef, newFormulaRow, newFormulaCol)

    return newRef
  }

  /**
   * 列字母转数字
   */
  private static colLettersToNumber(letters: string): number {
    let num = 0
    for (let i = 0; i < letters.length; i++) {
      num = num * 26 + (letters.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
    }
    return num - 1
  }

  /**
   * 数字转列字母
   */
  private static numberToColLetters(num: number): string {
    let letters = ''
    num += 1
    while (num > 0) {
      const remainder = (num - 1) % 26
      letters = String.fromCharCode('A'.charCodeAt(0) + remainder) + letters
      num = Math.floor((num - 1) / 26)
    }
    return letters
  }
}
