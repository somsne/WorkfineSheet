/**
 * OffscreenCanvas 渲染通信协议
 * 定义主线程与 Worker 之间的消息类型
 */

// ==================== 基础类型 ====================

/** 可见范围 */
export interface VisibleRange {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

/** 视口状态 */
export interface ViewportState {
  scrollTop: number
  scrollLeft: number
}

/** 选择状态 */
export interface SelectionState {
  row: number
  col: number
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

/** 拖拽状态 */
export interface DragStateData {
  isDragging: boolean
  startRow: number
  startCol: number
  currentRow: number
  currentCol: number
}

/** 单元格数据 */
export interface CellData {
  row: number
  col: number
  value: string | number | null
}

/** 单元格样式数据 (可序列化版本) */
export interface CellStyleData {
  row: number
  col: number
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean | 'single' | 'double'
  strikethrough?: boolean
  color?: string
  backgroundColor?: string
  textAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  wrapText?: boolean
  textRotation?: number
}

/** 几何配置 */
export interface GeometryConfigData {
  defaultRowHeight: number
  defaultColWidth: number
  rowHeaderWidth: number
  colHeaderHeight: number
}

/** 尺寸数据 (可序列化版本) */
export interface SizeData {
  rowHeights: [number, number][]  // [row, height] pairs
  colWidths: [number, number][]   // [col, width] pairs
  hiddenRows: number[]
  hiddenCols: number[]
}

/** 合并单元格区域 */
export interface MergedRegionData {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

// ==================== 主线程 → Worker 消息 ====================

/** 初始化消息 */
export interface InitMessage {
  type: 'init'
  canvas: OffscreenCanvas
  dpr: number
  config: GeometryConfigData
  totalRows: number
  totalCols: number
}

/** 调整大小消息 */
export interface ResizeMessage {
  type: 'resize'
  width: number
  height: number
  dpr: number
}

/** 设置视口消息 */
export interface SetViewportMessage {
  type: 'setViewport'
  viewport: ViewportState
}

/** 更新数据消息 */
export interface UpdateDataMessage {
  type: 'updateData'
  cells: CellData[]
  fullUpdate: boolean  // true = 全量更新, false = 增量更新
}

/** 更新样式消息 */
export interface UpdateStylesMessage {
  type: 'updateStyles'
  styles: CellStyleData[]
}

/** 设置选择消息 */
export interface SetSelectionMessage {
  type: 'setSelection'
  selection: SelectionState
}

/** 设置拖拽状态消息 */
export interface SetDragStateMessage {
  type: 'setDragState'
  dragState: DragStateData
}

/** 设置尺寸消息 */
export interface SetSizesMessage {
  type: 'setSizes'
  sizes: SizeData
}

/** 设置合并单元格消息 */
export interface SetMergedRegionsMessage {
  type: 'setMergedRegions'
  regions: MergedRegionData[]
}

/** 请求渲染消息 */
export interface RenderMessage {
  type: 'render'
  frameId: number
}

/** 销毁消息 */
export interface DestroyMessage {
  type: 'destroy'
}

/** 主线程发送给 Worker 的所有消息类型 */
export type MainToWorkerMessage =
  | InitMessage
  | ResizeMessage
  | SetViewportMessage
  | UpdateDataMessage
  | UpdateStylesMessage
  | SetSelectionMessage
  | SetDragStateMessage
  | SetSizesMessage
  | SetMergedRegionsMessage
  | RenderMessage
  | DestroyMessage

// ==================== Worker → 主线程消息 ====================

/** Worker 就绪消息 */
export interface WorkerReadyMessage {
  type: 'ready'
}

/** 渲染完成消息 */
export interface RenderCompleteMessage {
  type: 'rendered'
  frameId: number
  renderTime: number
  cellsRendered: number
}

/** 错误消息 */
export interface ErrorMessage {
  type: 'error'
  message: string
  stack?: string
}

/** 性能指标消息 */
export interface PerformanceMetricsMessage {
  type: 'metrics'
  fps: number
  avgRenderTime: number
  memoryUsage?: number
}

/** Worker 发送给主线程的所有消息类型 */
export type WorkerToMainMessage =
  | WorkerReadyMessage
  | RenderCompleteMessage
  | ErrorMessage
  | PerformanceMetricsMessage

// ==================== 辅助类型 ====================

/** Worker 事件处理器类型 */
export type WorkerMessageHandler = (message: WorkerToMainMessage) => void

/** 特性检测结果 */
export interface FeatureSupport {
  offscreenCanvas: boolean
  sharedArrayBuffer: boolean
  webWorkers: boolean
}

/**
 * 检测浏览器特性支持
 */
export function detectFeatureSupport(): FeatureSupport {
  return {
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    webWorkers: typeof Worker !== 'undefined'
  }
}

/**
 * 检查是否支持 OffscreenCanvas 渲染
 */
export function isOffscreenRenderingSupported(): boolean {
  const support = detectFeatureSupport()
  return support.offscreenCanvas && support.webWorkers
}
