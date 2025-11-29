/**
 * useSheetGeometry - 电子表格几何计算 composable
 * 封装所有行高、列宽、位置计算相关的方法
 */

import type { GeometryConfig, SizeAccess } from '../types'
import {
  getRowHeight as geomGetRowHeight,
  getColWidth as geomGetColWidth,
  getRowTop as geomGetRowTop,
  getColLeft as geomGetColLeft,
  getRowAtY as geomGetRowAtY,
  getColAtX as geomGetColAtX,
  getVisibleRange as geomGetVisibleRange,
  ensureVisible as geomEnsureVisible
} from '../geometry'
import type { SheetState } from './useSheetState'

export interface UseSheetGeometryOptions {
  state: SheetState
  onDraw: () => void
}

export function useSheetGeometry({ state, onDraw }: UseSheetGeometryOptions) {
  const { constants, rowHeights, colWidths, hiddenRows, hiddenCols, showGridLines, viewport, container } = state
  
  // 创建几何配置对象
  function createGeometryConfig(): GeometryConfig {
    return {
      defaultRowHeight: constants.ROW_HEIGHT,
      defaultColWidth: constants.COL_WIDTH,
      rowHeaderWidth: constants.ROW_HEADER_WIDTH,
      colHeaderHeight: constants.COL_HEADER_HEIGHT
    }
  }
  
  // 创建 SizeAccess 对象
  function createSizeAccess(): SizeAccess {
    return {
      rowHeights: rowHeights.value,
      colWidths: colWidths.value,
      hiddenRows: hiddenRows.value,
      hiddenCols: hiddenCols.value,
      showGridFlag: showGridLines.value
    }
  }
  
  // 获取指定行的高度
  function getRowHeight(row: number): number {
    return geomGetRowHeight(row, createSizeAccess(), createGeometryConfig())
  }
  
  // 获取指定列的宽度
  function getColWidth(col: number): number {
    return geomGetColWidth(col, createSizeAccess(), createGeometryConfig())
  }
  
  // 获取从0到指定行的累计高度
  function getRowTop(row: number): number {
    return geomGetRowTop(row, createSizeAccess(), createGeometryConfig())
  }
  
  // 获取从0到指定列的累计宽度
  function getColLeft(col: number): number {
    return geomGetColLeft(col, createSizeAccess(), createGeometryConfig())
  }
  
  // 根据 Y 坐标（含滚动偏移）获取行号
  function getRowAtY(y: number): number {
    return geomGetRowAtY(y, viewport, createSizeAccess(), createGeometryConfig(), constants.DEFAULT_ROWS)
  }
  
  // 根据 X 坐标（含滚动偏移）获取列号
  function getColAtX(x: number): number {
    return geomGetColAtX(x, viewport, createSizeAccess(), createGeometryConfig(), constants.DEFAULT_COLS)
  }
  
  // 获取可见范围
  function getVisibleRange(w: number, h: number) {
    return geomGetVisibleRange(w, h, viewport, createSizeAccess(), createGeometryConfig(), constants.DEFAULT_ROWS, constants.DEFAULT_COLS)
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
  
  // 获取总内容高度（不包括列表头高度）
  function getTotalContentHeight(): number {
    return getRowTop(constants.DEFAULT_ROWS)
  }
  
  // 获取总内容宽度（不包括行表头宽度）
  function getTotalContentWidth(): number {
    return getColLeft(constants.DEFAULT_COLS)
  }
  
  return {
    // 配置创建
    createGeometryConfig,
    createSizeAccess,
    
    // 单元格尺寸
    getRowHeight,
    getColWidth,
    
    // 位置计算
    getRowTop,
    getColLeft,
    getRowAtY,
    getColAtX,
    
    // 可见范围
    getVisibleRange,
    ensureVisible,
    
    // 总尺寸
    getTotalContentHeight,
    getTotalContentWidth
  }
}

export type SheetGeometry = ReturnType<typeof useSheetGeometry>
