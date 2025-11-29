/**
 * useFillHandle - 填充柄 composable
 * 处理填充柄的状态管理、交互和填充执行
 */

import { reactive } from 'vue'
import type { 
  FillHandleState, 
  SelectionRange,
  GeometryConfig,
  SizeAccess,
  FillOptionsMenuState,
  FillOptionType
} from '../types'
import { DEFAULT_FILL_HANDLE_STATE, DEFAULT_FILL_OPTIONS_MENU_STATE } from '../types'
import {
  calculateFillHandlePosition,
  isPointOnFillHandle,
  determineFillDirection,
  calculateFillRange,
  calculateClearRange,
  detectFillPattern,
  generateFillValues,
  adjustFormulaReferences,
  drawFillHandle,
  drawFillPreview
} from '../fillHandle'
import { getRowAtY, getColAtX } from '../geometry'
import type { SheetModel } from '../../../lib/SheetModel'
import type { FormulaSheet } from '../../../lib/FormulaSheet'
import type { UndoRedoManager } from '../../../lib/UndoRedoManager'

export interface UseFillHandleOptions {
  /** 获取选择范围 */
  getSelectionRange: () => SelectionRange
  /** 获取视口 */
  getViewport: () => { scrollTop: number; scrollLeft: number }
  /** 获取几何配置 */
  getGeometryConfig: () => GeometryConfig
  /** 获取尺寸访问 */
  getSizeAccess: () => SizeAccess
  /** 获取画布尺寸 */
  getCanvasSize: () => { width: number; height: number }
  /** 获取数据模型 */
  getModel: () => SheetModel
  /** 获取公式表 */
  getFormulaSheet: () => FormulaSheet
  /** 获取撤销管理器 */
  getUndoRedoManager: () => UndoRedoManager
  /** 总行数 */
  totalRows: number
  /** 总列数 */
  totalCols: number
  /** 触发重绘 */
  scheduleRedraw: () => void
  /** 更新选择范围 */
  updateSelectionRange: (range: SelectionRange) => void
}

export interface FillHandleComposable {
  /** 填充柄状态 */
  fillHandleState: FillHandleState
  /** 填充选项菜单状态 */
  fillOptionsMenu: FillOptionsMenuState
  /** 更新填充柄位置 */
  updateFillHandlePosition: () => void
  /** 检测点是否在填充柄上 */
  isOnFillHandle: (x: number, y: number) => boolean
  /** 开始填充柄拖拽 */
  startFillHandleDrag: (x: number, y: number) => boolean
  /** 更新填充柄拖拽 */
  updateFillHandleDrag: (x: number, y: number) => void
  /** 结束填充柄拖拽 */
  endFillHandleDrag: () => void
  /** 执行填充操作 */
  executeFill: (fillType?: FillOptionType) => void
  /** 绘制填充柄 */
  drawFillHandle: (ctx: CanvasRenderingContext2D) => void
  /** 绘制填充预览 */
  drawFillPreview: (ctx: CanvasRenderingContext2D) => void
  /** 获取鼠标样式 */
  getCursor: (x: number, y: number) => string | null
  /** 双击填充柄快速填充 */
  handleDoubleClick: (x: number, y: number) => boolean
  /** 处理填充选项选择 */
  handleFillOptionSelect: (type: FillOptionType) => void
  /** 关闭填充选项菜单 */
  closeFillOptionsMenu: () => void
}

export function useFillHandle(options: UseFillHandleOptions): FillHandleComposable {
  const {
    getSelectionRange,
    getViewport,
    getGeometryConfig,
    getSizeAccess,
    getCanvasSize,
    getModel,
    getFormulaSheet,
    getUndoRedoManager,
    totalRows,
    totalCols,
    scheduleRedraw,
    updateSelectionRange
  } = options
  
  // 填充柄状态
  const fillHandleState = reactive<FillHandleState>({ ...DEFAULT_FILL_HANDLE_STATE })
  
  // 填充选项菜单状态
  const fillOptionsMenu = reactive<FillOptionsMenuState>({ ...DEFAULT_FILL_OPTIONS_MENU_STATE })
  
  // 拖拽起始位置
  let dragStartX = 0
  let dragStartY = 0
  
  /**
   * 更新填充柄位置
   */
  function updateFillHandlePosition(): void {
    const selectionRange = getSelectionRange()
    const viewport = getViewport()
    const geometryConfig = getGeometryConfig()
    const sizes = getSizeAccess()
    const canvasSize = getCanvasSize()
    
    const newState = calculateFillHandlePosition({
      selectionRange,
      viewport,
      geometryConfig,
      sizes,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height
    })
    
    // 只有在非拖拽状态时更新位置
    if (!fillHandleState.dragging) {
      Object.assign(fillHandleState, newState)
    }
  }
  
  /**
   * 检测点是否在填充柄上
   */
  function isOnFillHandle(x: number, y: number): boolean {
    return isPointOnFillHandle(x, y, fillHandleState)
  }
  
  /**
   * 开始填充柄拖拽
   */
  function startFillHandleDrag(x: number, y: number): boolean {
    if (!isOnFillHandle(x, y)) return false
    
    const selectionRange = getSelectionRange()
    
    fillHandleState.dragging = true
    fillHandleState.sourceRange = { ...selectionRange }
    fillHandleState.previewRange = null
    fillHandleState.direction = null
    
    dragStartX = x
    dragStartY = y
    
    return true
  }
  
  /**
   * 更新填充柄拖拽
   */
  function updateFillHandleDrag(x: number, y: number): void {
    if (!fillHandleState.dragging || !fillHandleState.sourceRange) return
    
    const viewport = getViewport()
    const geometryConfig = getGeometryConfig()
    const sizes = getSizeAccess()
    
    // 确定填充方向
    const direction = determineFillDirection(
      dragStartX,
      dragStartY,
      x,
      y,
      fillHandleState.sourceRange,
      viewport,
      geometryConfig,
      sizes
    )
    
    fillHandleState.direction = direction
    
    // 计算当前鼠标位置对应的单元格
    const currentRow = getRowAtY(y, viewport, sizes, geometryConfig, totalRows)
    const currentCol = getColAtX(x, viewport, sizes, geometryConfig, totalCols)
    
    // 先尝试计算填充目标区域
    const targetRange = calculateFillRange({
      sourceRange: fillHandleState.sourceRange,
      currentRow,
      currentCol,
      direction,
      totalRows,
      totalCols
    })
    
    // 如果没有填充区域，检查是否是清除模式（反向缩小选区）
    if (!targetRange) {
      const clearRange = calculateClearRange(
        fillHandleState.sourceRange,
        currentRow,
        currentCol,
        direction
      )
      // 用 previewRange 存储清除区域，但标记为负向（通过检查与源区域的关系）
      fillHandleState.previewRange = clearRange
    } else {
      fillHandleState.previewRange = targetRange
    }
    
    scheduleRedraw()
  }
  
  /**
   * 判断是否为清除模式（previewRange 由 calculateClearRange 返回，表示要清除的区域）
   * calculateClearRange 只在鼠标在源区域内部时才返回非空值
   */
  function isClearMode(): boolean {
    const { sourceRange, previewRange } = fillHandleState
    if (!sourceRange || !previewRange) return false
    
    // 清除模式：previewRange 完全在 sourceRange 内部（由 calculateClearRange 产生）
    // 注意：previewRange 是要清除的区域，而不是保留的区域
    return (
      previewRange.startRow >= sourceRange.startRow &&
      previewRange.endRow <= sourceRange.endRow &&
      previewRange.startCol >= sourceRange.startCol &&
      previewRange.endCol <= sourceRange.endCol
    )
  }
  
  /**
   * 执行清除操作（清空值但保留样式）
   * previewRange 是要清除的区域（由 calculateClearRange 返回）
   */
  function executeClear(): void {
    const { sourceRange, previewRange, direction } = fillHandleState
    if (!sourceRange || !previewRange) return
    
    const model = getModel()
    const formulaSheet = getFormulaSheet()
    const undoRedoManager = getUndoRedoManager()
    
    // previewRange 就是要清除的区域
    const clearArea = previewRange
    
    // 收集旧值（用于撤销）
    const oldValues: Map<string, string> = new Map()
    
    for (let r = clearArea.startRow; r <= clearArea.endRow; r++) {
      for (let c = clearArea.startCol; c <= clearArea.endCol; c++) {
        const key = `${r},${c}`
        oldValues.set(key, model.getValue(r, c))
      }
    }
    
    // 执行清除
    for (let r = clearArea.startRow; r <= clearArea.endRow; r++) {
      for (let c = clearArea.startCol; c <= clearArea.endCol; c++) {
        model.setValue(r, c, '')
      }
    }
    
    // 清除公式缓存
    formulaSheet.clearFormulaCache()
    
    // 注册撤销操作
    undoRedoManager.execute({
      name: '清除',
      redo: () => {
        for (let r = clearArea.startRow; r <= clearArea.endRow; r++) {
          for (let c = clearArea.startCol; c <= clearArea.endCol; c++) {
            model.setValue(r, c, '')
          }
        }
        formulaSheet.clearFormulaCache()
        scheduleRedraw()
      },
      undo: () => {
        for (const [key, value] of oldValues) {
          const [r, c] = key.split(',').map(Number)
          model.setValue(r!, c!, value)
        }
        formulaSheet.clearFormulaCache()
        scheduleRedraw()
      }
    })
    
    // 计算新的选择范围（保留区域 = 源区域 - 清除区域）
    let newSelectionRange: SelectionRange
    
    if (direction === 'up') {
      // 向上缩小：保留区域是源区域的上半部分
      newSelectionRange = {
        startRow: sourceRange.startRow,
        startCol: sourceRange.startCol,
        endRow: clearArea.startRow - 1,
        endCol: sourceRange.endCol
      }
    } else if (direction === 'down') {
      // 向下缩小：保留区域是源区域的下半部分
      newSelectionRange = {
        startRow: clearArea.endRow + 1,
        startCol: sourceRange.startCol,
        endRow: sourceRange.endRow,
        endCol: sourceRange.endCol
      }
    } else if (direction === 'left') {
      // 向左缩小：保留区域是源区域的左半部分
      newSelectionRange = {
        startRow: sourceRange.startRow,
        startCol: sourceRange.startCol,
        endRow: sourceRange.endRow,
        endCol: clearArea.startCol - 1
      }
    } else {
      // 向右缩小：保留区域是源区域的右半部分
      newSelectionRange = {
        startRow: sourceRange.startRow,
        startCol: clearArea.endCol + 1,
        endRow: sourceRange.endRow,
        endCol: sourceRange.endCol
      }
    }
    
    updateSelectionRange(newSelectionRange)
  }
  
  /**
   * 结束填充柄拖拽
   */
  function endFillHandleDrag(): void {
    if (!fillHandleState.dragging) return
    
    // 如果有预览区域
    if (fillHandleState.previewRange && fillHandleState.sourceRange) {
      // 判断是填充模式还是清除模式
      if (isClearMode()) {
        // 清除模式：清空值但保留样式
        executeClear()
        // 清除菜单状态
        fillOptionsMenu.sourceRange = null
        fillOptionsMenu.targetRange = null
        fillOptionsMenu.direction = null
      } else {
        // 填充模式
        // 保存范围用于菜单操作
        fillOptionsMenu.sourceRange = { ...fillHandleState.sourceRange }
        fillOptionsMenu.targetRange = { ...fillHandleState.previewRange }
        fillOptionsMenu.direction = fillHandleState.direction
        fillOptionsMenu.selectedType = 'series'
        
        // 执行默认填充（序列填充）
        executeFill('series')
      }
    }
    
    // 重置状态
    fillHandleState.dragging = false
    fillHandleState.previewRange = null
    fillHandleState.direction = null
    
    // 更新填充柄位置
    updateFillHandlePosition()
    scheduleRedraw()
  }
  
  /**
   * 执行填充操作
   * @param fillType 填充类型，默认为 'series'
   */
  function executeFill(fillType: FillOptionType = 'series'): void {
    // 优先使用菜单中保存的范围（用于切换填充类型）
    const sourceRange = fillOptionsMenu.sourceRange ?? fillHandleState.sourceRange
    const previewRange = fillOptionsMenu.targetRange ?? fillHandleState.previewRange
    const direction = fillOptionsMenu.direction ?? fillHandleState.direction
    
    if (!sourceRange || !previewRange || !direction) return
    
    const model = getModel()
    const formulaSheet = getFormulaSheet()
    const undoRedoManager = getUndoRedoManager()
    
    // 收集源区域的值
    const sourceValues: string[][] = []
    for (let r = sourceRange.startRow; r <= sourceRange.endRow; r++) {
      const row: string[] = []
      for (let c = sourceRange.startCol; c <= sourceRange.endCol; c++) {
        row.push(model.getValue(r, c))
      }
      sourceValues.push(row)
    }
    
    // 根据填充类型确定模式
    let pattern = detectFillPattern(sourceValues.flat())
    
    // 如果是复制模式或仅值模式，强制使用 copy
    if (fillType === 'copy' || fillType === 'valuesOnly') {
      pattern = { type: 'copy' }
    }
    
    // 收集旧值（用于撤销）
    const oldValues: Map<string, string> = new Map()
    const oldStyles: Map<string, any> = new Map()
    const oldFormats: Map<string, any> = new Map()
    const oldBorders: Map<string, any> = new Map()
    
    for (let r = previewRange.startRow; r <= previewRange.endRow; r++) {
      for (let c = previewRange.startCol; c <= previewRange.endCol; c++) {
        const key = `${r},${c}`
        oldValues.set(key, model.getValue(r, c))
        oldStyles.set(key, model.getCellStyle(r, c))
        oldFormats.set(key, model.getCellFormat(r, c))
        oldBorders.set(key, model.getCellBorder(r, c))
      }
    }
    
    // 计算填充值
    const targetRowCount = previewRange.endRow - previewRange.startRow + 1
    const targetColCount = previewRange.endCol - previewRange.startCol + 1
    
    const fillValues = generateFillValues({
      sourceValues,
      pattern,
      direction,
      targetRowCount,
      targetColCount
    })
    
    // 执行填充
    const newValues: Map<string, string> = new Map()
    const sourceRowCount = sourceRange.endRow - sourceRange.startRow + 1
    const sourceColCount = sourceRange.endCol - sourceRange.startCol + 1
    
    // 根据填充类型决定是否复制值/样式/格式
    const includeValues = fillType !== 'formatsOnly'
    const includeStyles = fillType !== 'valuesOnly'
    
    for (let tr = 0; tr < targetRowCount; tr++) {
      for (let tc = 0; tc < targetColCount; tc++) {
        const targetRow = previewRange.startRow + tr
        const targetCol = previewRange.startCol + tc
        const key = `${targetRow},${targetCol}`
        
        // 计算对应的源单元格
        const sourceRow = sourceRange.startRow + (tr % sourceRowCount)
        const sourceCol = sourceRange.startCol + (tc % sourceColCount)
        
        if (includeValues) {
          // 获取源值
          let sourceValue = model.getValue(sourceRow, sourceCol)
          let fillValue = fillValues[tr]?.[tc] ?? sourceValue
          
          // 处理公式
          if (sourceValue.startsWith('=')) {
            // 计算行列偏移
            const rowOffset = targetRow - sourceRow
            const colOffset = targetCol - sourceCol
            fillValue = adjustFormulaReferences(sourceValue, rowOffset, colOffset)
          }
          
          newValues.set(key, fillValue)
          
          // 设置值
          model.setValue(targetRow, targetCol, fillValue)
        }
        
        if (includeStyles) {
          // 复制样式
          const sourceStyle = model.getCellStyle(sourceRow, sourceCol)
          if (sourceStyle) {
            model.setCellStyle(targetRow, targetCol, { ...sourceStyle })
          }
          
          // 复制格式
          const sourceFormat = model.getCellFormat(sourceRow, sourceCol)
          if (sourceFormat) {
            model.setCellFormat(targetRow, targetCol, { ...sourceFormat })
          }
          
          // 复制边框
          const sourceBorder = model.getCellBorder(sourceRow, sourceCol)
          if (sourceBorder) {
            model.setCellBorder(targetRow, targetCol, { ...sourceBorder })
          }
        }
      }
    }
    
    // 清除公式缓存
    formulaSheet.clearFormulaCache()
    
    // 注册撤销操作
    undoRedoManager.execute({
      name: '填充',
      redo: () => {
        for (const [key, value] of newValues) {
          const [r, c] = key.split(',').map(Number)
          model.setValue(r!, c!, value)
        }
        // 重新应用样式、格式、边框...
        for (let tr = 0; tr < targetRowCount; tr++) {
          for (let tc = 0; tc < targetColCount; tc++) {
            const targetRow = previewRange.startRow + tr
            const targetCol = previewRange.startCol + tc
            const sourceRow = sourceRange.startRow + (tr % sourceRowCount)
            const sourceCol = sourceRange.startCol + (tc % sourceColCount)
            
            const sourceStyle = model.getCellStyle(sourceRow, sourceCol)
            if (sourceStyle) model.setCellStyle(targetRow, targetCol, { ...sourceStyle })
            
            const sourceFormat = model.getCellFormat(sourceRow, sourceCol)
            if (sourceFormat) model.setCellFormat(targetRow, targetCol, { ...sourceFormat })
            
            const sourceBorder = model.getCellBorder(sourceRow, sourceCol)
            if (sourceBorder) model.setCellBorder(targetRow, targetCol, { ...sourceBorder })
          }
        }
        formulaSheet.clearFormulaCache()
        scheduleRedraw()
      },
      undo: () => {
        for (const [key, value] of oldValues) {
          const [r, c] = key.split(',').map(Number)
          model.setValue(r!, c!, value)
        }
        for (const [key, style] of oldStyles) {
          const [r, c] = key.split(',').map(Number)
          if (style) {
            model.setCellStyle(r!, c!, style)
          } else {
            model.clearCellStyle(r!, c!)
          }
        }
        for (const [key, format] of oldFormats) {
          const [r, c] = key.split(',').map(Number)
          if (format) {
            model.setCellFormat(r!, c!, format)
          } else {
            model.clearCellFormat(r!, c!)
          }
        }
        for (const [key, border] of oldBorders) {
          const [r, c] = key.split(',').map(Number)
          if (border) {
            model.setCellBorder(r!, c!, border)
          } else {
            model.clearCellBorder(r!, c!)
          }
        }
        formulaSheet.clearFormulaCache()
        scheduleRedraw()
      }
    })
    
    // 扩展选择范围到包含填充区域
    const newSelectionRange: SelectionRange = {
      startRow: Math.min(sourceRange.startRow, previewRange.startRow),
      startCol: Math.min(sourceRange.startCol, previewRange.startCol),
      endRow: Math.max(sourceRange.endRow, previewRange.endRow),
      endCol: Math.max(sourceRange.endCol, previewRange.endCol)
    }
    updateSelectionRange(newSelectionRange)
  }
  
  /**
   * 绘制填充柄
   */
  function drawFillHandleOnCanvas(ctx: CanvasRenderingContext2D): void {
    const geometryConfig = getGeometryConfig()
    drawFillHandle({
      ctx,
      fillHandleState,
      geometryConfig
    })
  }
  
  /**
   * 绘制填充预览
   */
  function drawFillPreviewOnCanvas(ctx: CanvasRenderingContext2D): void {
    const viewport = getViewport()
    const geometryConfig = getGeometryConfig()
    const sizes = getSizeAccess()
    drawFillPreview(ctx, fillHandleState, viewport, geometryConfig, sizes)
  }
  
  /**
   * 获取鼠标样式
   */
  function getCursor(x: number, y: number): string | null {
    if (fillHandleState.dragging) {
      return 'crosshair'
    }
    if (isOnFillHandle(x, y)) {
      return 'crosshair'
    }
    return null
  }
  
  /**
   * 双击填充柄快速填充
   * 自动向下填充到相邻列数据的末尾行
   * @returns true 如果执行了填充
   */
  function handleDoubleClick(x: number, y: number): boolean {
    if (!isOnFillHandle(x, y)) return false
    
    const selectionRange = getSelectionRange()
    const model = getModel()
    
    // 清除菜单状态，避免影响填充
    fillOptionsMenu.sourceRange = null
    fillOptionsMenu.targetRange = null
    fillOptionsMenu.direction = null
    
    // 查找左侧相邻列数据的末尾行
    const leftCol = selectionRange.startCol - 1
    const rightCol = selectionRange.endCol + 1
    
    let targetEndRow = selectionRange.endRow
    
    // 检查左侧列
    if (leftCol >= 0) {
      for (let r = selectionRange.endRow + 1; r < totalRows; r++) {
        const value = model.getValue(r, leftCol)
        if (!value || value.trim() === '') {
          break
        }
        targetEndRow = r
      }
    }
    
    // 检查右侧列
    if (rightCol < totalCols && targetEndRow === selectionRange.endRow) {
      for (let r = selectionRange.endRow + 1; r < totalRows; r++) {
        const value = model.getValue(r, rightCol)
        if (!value || value.trim() === '') {
          break
        }
        targetEndRow = r
      }
    }
    
    // 如果没有找到数据，向下填充 10 行作为默认
    if (targetEndRow === selectionRange.endRow) {
      targetEndRow = Math.min(selectionRange.endRow + 10, totalRows - 1)
    }
    
    // 如果目标行和当前行相同，不执行填充
    if (targetEndRow <= selectionRange.endRow) {
      return false
    }
    
    // 设置填充状态
    fillHandleState.sourceRange = { ...selectionRange }
    fillHandleState.direction = 'down'
    fillHandleState.previewRange = {
      startRow: selectionRange.endRow + 1,
      startCol: selectionRange.startCol,
      endRow: targetEndRow,
      endCol: selectionRange.endCol
    }
    
    // 执行填充
    executeFill()
    
    // 重置状态
    fillHandleState.dragging = false
    fillHandleState.previewRange = null
    fillHandleState.direction = null
    
    updateFillHandlePosition()
    scheduleRedraw()
    
    return true
  }
  
  /**
   * 处理填充选项选择
   * 用户在菜单中切换填充类型时调用
   */
  function handleFillOptionSelect(type: FillOptionType): void {
    if (!fillOptionsMenu.sourceRange || !fillOptionsMenu.targetRange) return
    
    const undoRedoManager = getUndoRedoManager()
    
    // 先撤销上一次填充
    undoRedoManager.undo()
    
    // 用新类型重新执行填充
    fillOptionsMenu.selectedType = type
    executeFill(type)
    
    scheduleRedraw()
  }
  
  /**
   * 关闭填充选项菜单
   */
  function closeFillOptionsMenu(): void {
    fillOptionsMenu.visible = false
    fillOptionsMenu.sourceRange = null
    fillOptionsMenu.targetRange = null
  }
  
  return {
    fillHandleState,
    fillOptionsMenu,
    updateFillHandlePosition,
    isOnFillHandle,
    startFillHandleDrag,
    updateFillHandleDrag,
    endFillHandleDrag,
    executeFill,
    drawFillHandle: drawFillHandleOnCanvas,
    drawFillPreview: drawFillPreviewOnCanvas,
    getCursor,
    handleDoubleClick,
    handleFillOptionSelect,
    closeFillOptionsMenu
  }
}
