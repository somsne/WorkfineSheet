/**
 * useSheetGeometry - 电子表格几何计算 composable
 * 封装所有行高、列宽、位置计算相关的方法
 * 
 * 性能优化 v1.1.0：
 * - 使用 PositionIndex 预计算位置索引
 * - getRowTop/getColLeft: O(n) → O(1)
 * - getRowAtY/getColAtX: O(n) → O(log n)
 * 
 * 性能优化 v1.2.0：
 * - 使用 toRaw() 绕过 Vue Proxy，减少响应式开销
 * - 渲染路径中数据只读，不需要响应式追踪
 */

import { toRaw } from 'vue'
import type { GeometryConfig, SizeAccess } from '../types'
import {
  ensureVisible as geomEnsureVisible
} from '../geometry'
import { createPositionIndex, type PositionIndex } from '../PositionIndex'
import type { SheetState } from './useSheetState'

export interface UseSheetGeometryOptions {
  state: SheetState
  onDraw: () => void
}

export function useSheetGeometry({ state, onDraw }: UseSheetGeometryOptions) {
  const { constants, rowHeights, colWidths, hiddenRows, hiddenCols, showGridLines, totalRows, totalCols, viewport, container } = state
  
  // 创建位置索引实例
  const positionIndex: PositionIndex = createPositionIndex()
  
  // 创建几何配置对象
  function createGeometryConfig(): GeometryConfig {
    return {
      defaultRowHeight: constants.ROW_HEIGHT,
      defaultColWidth: constants.COL_WIDTH,
      rowHeaderWidth: constants.ROW_HEADER_WIDTH,
      colHeaderHeight: constants.COL_HEADER_HEIGHT
    }
  }
  
  // 创建 SizeAccess 对象（使用 toRaw 绕过 Vue Proxy，提升渲染性能）
  function createSizeAccess(): SizeAccess {
    return {
      rowHeights: toRaw(rowHeights.value),
      colWidths: toRaw(colWidths.value),
      hiddenRows: toRaw(hiddenRows.value),
      hiddenCols: toRaw(hiddenCols.value),
      showGridFlag: showGridLines.value
    }
  }
  
  /**
   * 确保位置索引是最新的
   * 在需要使用索引前调用
   */
  function ensurePositionIndex(): void {
    const sizes = createSizeAccess()
    const cfg = createGeometryConfig()
    positionIndex.rebuildRowIndex(sizes, cfg, totalRows.value)
    positionIndex.rebuildColIndex(sizes, cfg, totalCols.value)
  }
  
  /**
   * 使位置索引失效（当行高/列宽/隐藏状态变化时调用）
   */
  function invalidatePositionIndex(): void {
    positionIndex.invalidateAll()
  }
  
  /**
   * 使行索引失效
   */
  function invalidateRowIndex(): void {
    positionIndex.invalidateRows()
  }
  
  /**
   * 使列索引失效
   */
  function invalidateColIndex(): void {
    positionIndex.invalidateCols()
  }
  
  // 获取指定行的高度 - 使用位置索引 O(1)
  function getRowHeight(row: number): number {
    ensurePositionIndex()
    return positionIndex.getRowHeight(row)
  }
  
  // 获取指定列的宽度 - 使用位置索引 O(1)
  function getColWidth(col: number): number {
    ensurePositionIndex()
    return positionIndex.getColWidth(col)
  }
  
  // 获取从0到指定行的累计高度 - 使用位置索引 O(1)
  function getRowTop(row: number): number {
    ensurePositionIndex()
    return positionIndex.getRowTop(row)
  }
  
  // 获取从0到指定列的累计宽度 - 使用位置索引 O(1)
  function getColLeft(col: number): number {
    ensurePositionIndex()
    return positionIndex.getColLeft(col)
  }
  
  // 根据 Y 坐标（含滚动偏移）获取行号 - 使用位置索引 O(log n)
  function getRowAtY(y: number): number {
    ensurePositionIndex()
    const offsetY = y + viewport.scrollTop - constants.COL_HEADER_HEIGHT
    return positionIndex.getRowAtY(offsetY)
  }
  
  // 根据 X 坐标（含滚动偏移）获取列号 - 使用位置索引 O(log n)
  function getColAtX(x: number): number {
    ensurePositionIndex()
    const offsetX = x + viewport.scrollLeft - constants.ROW_HEADER_WIDTH
    return positionIndex.getColAtX(offsetX)
  }
  
  // 获取可见范围 - 使用位置索引优化
  function getVisibleRange(w: number, h: number) {
    ensurePositionIndex()
    return positionIndex.getVisibleRange(
      w, h,
      viewport.scrollTop,
      viewport.scrollLeft,
      createGeometryConfig()
    )
  }
  
  // 确保指定单元格可见（自动滚动）
  function ensureVisible(row: number, col: number) {
    if (!container.value) return
    const w = container.value.clientWidth
    const h = container.value.clientHeight
    const next = geomEnsureVisible(row, col, viewport, w, h, createSizeAccess(), createGeometryConfig())
    viewport.scrollTop = next.scrollTop
    viewport.scrollLeft = next.scrollLeft
    onDraw()
  }
  
  // 获取总内容高度（不包括列表头高度）- 使用位置索引 O(1)
  function getTotalContentHeight(): number {
    ensurePositionIndex()
    return positionIndex.getTotalHeight()
  }
  
  // 获取总内容宽度（不包括行表头宽度）- 使用位置索引 O(1)
  function getTotalContentWidth(): number {
    ensurePositionIndex()
    return positionIndex.getTotalWidth()
  }
  
  return {
    // 配置创建
    createGeometryConfig,
    createSizeAccess,
    
    // 位置索引管理
    positionIndex,
    ensurePositionIndex,
    invalidatePositionIndex,
    invalidateRowIndex,
    invalidateColIndex,
    
    // 单元格尺寸
    getRowHeight,
    getColWidth,
    
    // 位置计算（已优化）
    getRowTop,
    getColLeft,
    getRowAtY,
    getColAtX,
    
    // 可见范围（已优化）
    getVisibleRange,
    ensureVisible,
    
    // 总尺寸（已优化）
    getTotalContentHeight,
    getTotalContentWidth
  }
}

export type SheetGeometry = ReturnType<typeof useSheetGeometry>
