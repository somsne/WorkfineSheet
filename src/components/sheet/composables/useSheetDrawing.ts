/**
 * useSheetDrawing - 电子表格绘制 composable
 * 封装所有绘制相关的方法：draw, drawGrid, drawCells, drawImeCompositionText
 */

import { setCanvasSize, createRedrawScheduler } from '../renderCore'
import { drawGrid as renderGrid } from '../renderGrid'
import type { GridRenderConfig } from '../renderGrid'
import { drawCells as renderCells } from '../renderCells'
import type { CellsRenderConfig } from '../renderCells'
import { updateScrollbars } from '../scrollbar'
import { getSelectionRangeText as getSelectionText } from '../selection'
import type { SheetState } from './useSheetState'
import type { SheetGeometry } from './useSheetGeometry'
import type { FillHandleComposable } from './useFillHandle'

export interface UseSheetDrawingOptions {
  state: SheetState
  geometry: SheetGeometry
  fillHandle?: FillHandleComposable
  /** 获取是否隐藏默认选区（跨 Sheet 引用模式） */
  getHideDefaultSelection?: () => boolean
}

export function useSheetDrawing({ state, geometry, fillHandle, getHideDefaultSelection }: UseSheetDrawingOptions) {
  const { 
    constants,
    container, gridCanvas, contentCanvas,
    model, formulaSheet,
    viewport, scrollbar,
    selected, selectionRange, dragState, multiSelection,
    overlay, imeState,
    formulaReferences, hoverState,
    copyRange, marchingAntsOffset
  } = state
  
  const {
    createSizeAccess, createGeometryConfig,
    getRowHeight, getColWidth, getRowTop, getColLeft,
    getVisibleRange, getTotalContentWidth, getTotalContentHeight
  } = geometry
  
  // 创建重绘调度器
  const { scheduleRedraw, cancelScheduled } = createRedrawScheduler(() => draw())
  
  // 蚂蚁线动画相关
  let marchingAntsAnimationId: number | null = null
  const MARCHING_ANTS_SPEED = 0.3 // 每帧移动的像素数
  
  /**
   * 启动蚂蚁线动画
   */
  function startMarchingAntsAnimation() {
    if (marchingAntsAnimationId !== null) return // 避免重复启动
    
    function animate() {
      // 检查是否还有有效的 copyRange，如果没有则停止动画
      if (!copyRange.visible || copyRange.startRow < 0) {
        stopMarchingAntsAnimation()
        return
      }
      
      marchingAntsOffset.value = (marchingAntsOffset.value + MARCHING_ANTS_SPEED) % 8
      draw() // 重绘以更新蚂蚁线位置
      marchingAntsAnimationId = requestAnimationFrame(animate)
    }
    
    marchingAntsAnimationId = requestAnimationFrame(animate)
  }
  
  /**
   * 停止蚂蚁线动画
   */
  function stopMarchingAntsAnimation() {
    if (marchingAntsAnimationId !== null) {
      cancelAnimationFrame(marchingAntsAnimationId)
      marchingAntsAnimationId = null
    }
  }
  
  // 绘制后回调（用于图片等附加绘制）
  let afterDrawCallback: (() => void) | null = null
  
  function setAfterDrawCallback(callback: (() => void) | null) {
    afterDrawCallback = callback
  }
  
  /**
   * 获取选择范围的文本表示 (如 "A1:B3", "3行 x 2列")
   */
  function getSelectionRangeText(startRow: number, startCol: number, endRow: number, endCol: number): string {
    return getSelectionText(startRow, startCol, endRow, endCol, (r, c) => formulaSheet.getCellAddress(r, c))
  }
  
  /**
   * 更新滚动条
   */
  function updateScrollbarsLocal(w: number, h: number) {
    updateScrollbars(viewport, scrollbar, {
      containerWidth: w,
      containerHeight: h,
      contentWidth: getTotalContentWidth(),
      contentHeight: getTotalContentHeight(),
      rowHeaderWidth: constants.ROW_HEADER_WIDTH,
      colHeaderHeight: constants.COL_HEADER_HEIGHT
    })
  }
  
  /**
   * 绘制网格
   */
  function drawGrid(w: number, h: number) {
    const canvas = gridCanvas.value!
    const ctx = canvas.getContext('2d')!
    
    const gridConfig: GridRenderConfig = {
      containerWidth: w,
      containerHeight: h,
      viewport,
      hoverState,
      totalRows: constants.DEFAULT_ROWS,
      totalCols: constants.DEFAULT_COLS,
      sizes: createSizeAccess(),
      geometryConfig: createGeometryConfig(),
      mergedRegions: model.getAllMergedRegions(),
      selected,
      selectionRange,
      multiSelection
    }
    
    renderGrid(ctx, gridConfig)
  }
  
  /**
   * 绘制单元格内容
   */
  function drawCells(w: number, h: number) {
    const canvas = contentCanvas.value!
    const ctx = canvas.getContext('2d')!
    
    const { startRow, endRow, startCol, endCol } = getVisibleRange(w, h)

    const cellsConfig: CellsRenderConfig = {
      containerWidth: w,
      containerHeight: h,
      viewport,
      selected,
      selectionRange,
      multiSelection,
      copyRange,
      marchingAntsOffset: marchingAntsOffset.value,
      dragState,
      formulaReferences: formulaReferences.value,
      sizes: createSizeAccess(),
      geometryConfig: createGeometryConfig(),
      getCellValue: (r, c) => formulaSheet.getFormattedValue(r, c),
      getCellStyle: (r, c) => model.getCellStyle(r, c),
      model: model,
      getSelectionRangeText,
      getMergedCellInfo: (r, c) => model.getMergedCellInfo(r, c),
      getMergedRegion: (r, c) => model.getMergedRegion(r, c),
      mergedRegions: model.getAllMergedRegions(),
      startRow,
      endRow,
      startCol,
      endCol,
      // 单元格内嵌图片
      getCellDisplayImage: (r, c) => model.getCellDisplayImage(r, c),
      getCellImageCount: (r, c) => model.getCellImageCount(r, c),
      // 跨 Sheet 引用模式下隐藏默认选区
      hideDefaultSelection: getHideDefaultSelection?.() ?? false
    }
    
    renderCells(ctx, cellsConfig)
  }
  
  /**
   * 在 canvas 上绘制 IME 组合中的文本
   */
  function drawImeCompositionText() {
    if (!contentCanvas.value) return
    const ctx = contentCanvas.value.getContext('2d')
    if (!ctx) return
    
    const row = selected.row
    const col = selected.col
    const text = imeState.compositionText
    
    // 获取单元格样式
    const cellStyle = model.getCellStyle(row, col)
    
    // 计算单元格位置
    const cellX = constants.ROW_HEADER_WIDTH + getColLeft(col) - viewport.scrollLeft
    const cellY = constants.COL_HEADER_HEIGHT + getRowTop(row) - viewport.scrollTop
    const cellWidth = getColWidth(col)
    const cellHeight = getRowHeight(row)
    
    // 确保在可见区域内
    if (cellX + cellWidth < constants.ROW_HEADER_WIDTH || cellY + cellHeight < constants.COL_HEADER_HEIGHT) {
      return
    }
    
    // 绘制背景覆盖单元格原内容
    ctx.save()
    ctx.beginPath()
    ctx.rect(
      Math.max(cellX, constants.ROW_HEADER_WIDTH),
      Math.max(cellY, constants.COL_HEADER_HEIGHT),
      cellWidth,
      cellHeight
    )
    ctx.clip()
    
    // 使用单元格背景色或白色
    ctx.fillStyle = cellStyle.backgroundColor || '#fff'
    ctx.fillRect(cellX, cellY, cellWidth, cellHeight)
    
    // 构建字体样式
    const fontSize = cellStyle.fontSize || 12
    const fontFamily = cellStyle.fontFamily || 'Arial, sans-serif'
    const fontWeight = cellStyle.bold ? 'bold' : 'normal'
    const fontStyle = cellStyle.italic ? 'italic' : 'normal'
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
    
    // 使用单元格文字颜色
    const textColor = cellStyle.color || '#000'
    ctx.fillStyle = textColor
    ctx.textBaseline = 'middle'
    
    // 计算文本位置（考虑对齐方式）
    const padding = 4
    let textX = cellX + padding
    const textY = cellY + cellHeight / 2
    
    // 水平对齐
    const textWidth = ctx.measureText(text).width
    if (cellStyle.textAlign === 'center') {
      textX = cellX + (cellWidth - textWidth) / 2
    } else if (cellStyle.textAlign === 'right') {
      textX = cellX + cellWidth - textWidth - padding
    }
    
    // 绘制文本
    ctx.fillText(text, textX, textY)
    
    // 绘制下划线表示这是组合中的文本
    ctx.strokeStyle = textColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(textX, textY + fontSize / 2 + 2)
    ctx.lineTo(textX + textWidth, textY + fontSize / 2 + 2)
    ctx.stroke()
    
    // 计算光标位置
    const cursorPos = imeState.cursorPos
    const textBeforeCursor = text.substring(0, cursorPos)
    const cursorOffsetX = ctx.measureText(textBeforeCursor).width
    const cursorX = textX + cursorOffsetX
    const cursorTop = textY - fontSize / 2
    const cursorBottom = textY + fontSize / 2
    
    // 绘制光标
    ctx.strokeStyle = textColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cursorX, cursorTop)
    ctx.lineTo(cursorX, cursorBottom)
    ctx.stroke()
    
    ctx.restore()
  }
  
  /**
   * 主绘制函数 - 用于关键更新，需要立即渲染
   */
  function draw() {
    if (!container.value || !gridCanvas.value || !contentCanvas.value) return
    const w = container.value.clientWidth
    const h = container.value.clientHeight
    
    // 确保 canvas 有合理的尺寸（切换 sheet 时容器尺寸可能暂时为 0）
    if (w < 100 || h < 100) {
      return
    }
    
    setCanvasSize(gridCanvas.value, w, h)
    setCanvasSize(contentCanvas.value, w, h)
    
    // 更新滚动条
    updateScrollbarsLocal(w, h)
    
    // 如果编辑框可见，随滚动动态更新其位置与尺寸
    if (overlay.visible) {
      overlay.top = constants.COL_HEADER_HEIGHT + getRowTop(overlay.row) - viewport.scrollTop
      overlay.left = constants.ROW_HEADER_WIDTH + getColLeft(overlay.col) - viewport.scrollLeft
      overlay.width = getColWidth(overlay.col)
      overlay.height = getRowHeight(overlay.row)
    }
    
    // 先绘制单元格内容，再绘制网格和表头（确保表头在最上层）
    drawCells(w, h)
    drawGrid(w, h)
    
    // 绘制填充柄和预览（跨 Sheet 引用模式下不显示）
    const hideSelection = getHideDefaultSelection?.() ?? false
    if (fillHandle && !hideSelection) {
      fillHandle.updateFillHandlePosition()
      const ctx = contentCanvas.value!.getContext('2d')!
      fillHandle.drawFillHandle(ctx)
      fillHandle.drawFillPreview(ctx)
    }
    
    // 如果正在 IME 组合中，在选中单元格上绘制组合文本
    if (imeState.isComposing && imeState.compositionText && selected.row >= 0 && selected.col >= 0 && !overlay.visible) {
      drawImeCompositionText()
    }
    
    // 调用绘制后回调
    if (afterDrawCallback) {
      afterDrawCallback()
    }
  }
  
  return {
    // 绘制方法
    draw,
    drawGrid,
    drawCells,
    drawImeCompositionText,
    
    // 辅助方法
    getSelectionRangeText,
    updateScrollbarsLocal,
    
    // 重绘调度
    scheduleRedraw,
    cancelScheduled,
    
    // 绘制后回调设置
    setAfterDrawCallback,
    
    // 蚂蚁线动画控制
    startMarchingAntsAnimation,
    stopMarchingAntsAnimation
  }
}

export type SheetDrawing = ReturnType<typeof useSheetDrawing>
