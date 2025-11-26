/**
 * Shared types for WorkfineSheet refactor
 */

// 选择范围（含拖拽框）
export interface SelectionRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

// 单选状态
export interface SelectedCell {
  row: number
  col: number
}

// 拖拽选择状态
export interface DragState {
  isDragging: boolean
  startRow: number
  startCol: number
  currentRow: number
  currentCol: number
  // 刚完成拖拽，用于抑制 click 事件
  justFinishedDrag: boolean
}

// 视口滚动状态
export interface Viewport {
  scrollTop: number
  scrollLeft: number
}

// 自定义滚动条状态
export interface ScrollbarAxisState {
  visible: boolean
  trackSize: number
  thumbSize: number
  thumbPos: number
}

export interface ScrollbarState {
  v: ScrollbarAxisState
  h: ScrollbarAxisState
  dragging: '' | 'v' | 'h'
  startMousePos: number
  startScroll: number
}

// 覆盖层输入状态
export interface OverlayState {
  visible: boolean
  row: number
  col: number
  top: number
  left: number
  width: number
  height: number
  value: string
  mode: 'edit' | 'typing'
  originalValue: string
}

// 公式引用高亮
export interface FormulaReference {
  range: string
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  color: string
}

// 内部剪贴板单元格
export interface InternalClipboardCell {
  value: string
  isFormula: boolean
}

// 悬停状态（用于高亮调整分隔线）
export interface HoverState {
  type: '' | 'row' | 'col'
  index: number
}

// 几何配置与尺寸访问
export interface GeometryConfig {
  defaultRowHeight: number
  defaultColWidth: number
  rowHeaderWidth: number
  colHeaderHeight: number
}

export interface SizeAccess {
  rowHeights: Map<number, number>
  colWidths: Map<number, number>
  hiddenRows?: Set<number>
  hiddenCols?: Set<number>
  showGridFlag?: boolean
}
