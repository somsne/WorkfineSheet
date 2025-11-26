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

// ==================== 单元格样式 ====================

/**
 * 单元格样式接口
 * 定义单元格的外观属性，包括字体、颜色、对齐等
 */
export interface CellStyle {
  // 字体相关
  fontFamily?: string          // 字体名称，如 'Arial', 'Microsoft YaHei'
  fontSize?: number            // 字号 (px)，范围 9-72
  bold?: boolean               // 粗体
  italic?: boolean             // 斜体
  underline?: boolean | 'single' | 'double'  // 下划线：false | true(单) | 'single' | 'double'
  strikethrough?: boolean      // 删除线
  
  // 颜色相关
  color?: string               // 字体颜色，支持 hex (#000000) 或 rgb (rgb(0,0,0))
  backgroundColor?: string     // 背景色，支持 hex (#FFFFFF) 或 rgb (rgb(255,255,255))
  
  // 对齐相关
  textAlign?: 'left' | 'center' | 'right'           // 水平对齐
  verticalAlign?: 'top' | 'middle' | 'bottom'       // 垂直对齐
  
  // 文本处理
  wrapText?: boolean           // 自动换行
  textRotation?: number        // 文字旋转角度 (0-360 度)
}

/**
 * 默认单元格样式
 */
export const DEFAULT_CELL_STYLE: CellStyle = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: '#000000',
  backgroundColor: '#FFFFFF',
  textAlign: 'left',
  verticalAlign: 'middle',
  wrapText: false,
  textRotation: 0
}

/**
 * 样式键类型（用于类型安全）
 */
export type StyleKey = keyof CellStyle

/**
 * 样式值类型
 */
export type StyleValue = CellStyle[StyleKey]
