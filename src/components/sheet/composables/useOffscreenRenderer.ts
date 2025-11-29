/**
 * useOffscreenRenderer - Vue Composable for OffscreenCanvas rendering
 * 
 * 提供在 Vue 组件中使用 OffscreenCanvas + Web Worker 渲染的能力
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import type {
  CellData,
  CellStyleData,
  ViewportState,
  SelectionState,
  DragStateData,
  SizeData,
  MergedRegionData,
  GeometryConfigData
} from '../../../workers/renderProtocol'
import { isOffscreenRenderingSupported, detectFeatureSupport } from '../../../workers/renderProtocol'

export interface UseOffscreenRendererOptions {
  /** Canvas 元素引用 */
  canvasRef: Ref<HTMLCanvasElement | null>
  /** 几何配置 */
  config: GeometryConfigData
  /** 总行数 */
  totalRows: number
  /** 总列数 */
  totalCols: number
  /** 是否启用（默认自动检测） */
  enabled?: boolean
}

export interface OffscreenRendererState {
  /** 是否支持 OffscreenCanvas */
  isSupported: boolean
  /** 是否已初始化 */
  isInitialized: boolean
  /** 是否已就绪 */
  isReady: boolean
  /** 当前 FPS */
  fps: number
  /** 平均渲染时间 (ms) */
  avgRenderTime: number
  /** 最后一帧渲染的单元格数 */
  lastCellsRendered: number
  /** 错误信息 */
  error: string | null
}

/**
 * OffscreenCanvas 渲染 Composable
 */
export function useOffscreenRenderer(options: UseOffscreenRendererOptions) {
  const { canvasRef, config, totalRows, totalCols, enabled = true } = options
  
  // 状态
  const state = ref<OffscreenRendererState>({
    isSupported: false,
    isInitialized: false,
    isReady: false,
    fps: 0,
    avgRenderTime: 0,
    lastCellsRendered: 0,
    error: null
  })
  
  // Worker 实例
  let worker: Worker | null = null
  let frameId = 0
  let pendingRender = false
  let renderTimes: number[] = []
  
  /**
   * 检测特性支持
   */
  function checkSupport(): boolean {
    const support = detectFeatureSupport()
    state.value.isSupported = support.offscreenCanvas && support.webWorkers
    return state.value.isSupported
  }
  
  /**
   * 创建 Worker 代码
   * 使用内联方式避免跨域问题
   */
  function createWorkerCode(): string {
    return `
      // OffscreenCanvas 渲染 Worker
      let canvas = null
      let ctx = null
      let dpr = 1
      let width = 0
      let height = 0
      let cells = new Map()
      let styles = new Map()
      let rowHeights = new Map()
      let colWidths = new Map()
      let hiddenRows = new Set()
      let hiddenCols = new Set()
      let mergedRegions = []
      let selection = { row: -1, col: -1, startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
      let dragState = { isDragging: false, startRow: -1, startCol: -1, currentRow: -1, currentCol: -1 }
      let viewport = { scrollTop: 0, scrollLeft: 0 }
      
      const config = {
        defaultRowHeight: ${config.defaultRowHeight},
        defaultColWidth: ${config.defaultColWidth},
        rowHeaderWidth: ${config.rowHeaderWidth},
        colHeaderHeight: ${config.colHeaderHeight}
      }
      const totalRows = ${totalRows}
      const totalCols = ${totalCols}
      
      function getRowHeight(row) {
        if (hiddenRows.has(row)) return 0
        return rowHeights.get(row) || config.defaultRowHeight
      }
      
      function getColWidth(col) {
        if (hiddenCols.has(col)) return 0
        return colWidths.get(col) || config.defaultColWidth
      }
      
      function getRowTop(row) {
        let top = 0
        for (let r = 0; r < row; r++) top += getRowHeight(r)
        return top
      }
      
      function getColLeft(col) {
        let left = 0
        for (let c = 0; c < col; c++) left += getColWidth(c)
        return left
      }
      
      function getVisibleRange() {
        let startRow = 0, accY = 0
        while (startRow < totalRows && accY + getRowHeight(startRow) < viewport.scrollTop) {
          accY += getRowHeight(startRow++)
        }
        
        let endRow = startRow
        accY = getRowTop(startRow) - viewport.scrollTop + config.colHeaderHeight
        while (endRow < totalRows && accY < height) {
          accY += getRowHeight(endRow++)
        }
        endRow = Math.min(endRow, totalRows - 1)
        
        let startCol = 0, accX = 0
        while (startCol < totalCols && accX + getColWidth(startCol) < viewport.scrollLeft) {
          accX += getColWidth(startCol++)
        }
        
        let endCol = startCol
        accX = getColLeft(startCol) - viewport.scrollLeft + config.rowHeaderWidth
        while (endCol < totalCols && accX < width) {
          accX += getColWidth(endCol++)
        }
        endCol = Math.min(endCol, totalCols - 1)
        
        return { startRow, endRow, startCol, endCol }
      }
      
      function getColLabel(c) {
        let label = '', n = c
        while (n >= 0) {
          label = String.fromCharCode(65 + (n % 26)) + label
          if (n < 26) break
          n = Math.floor(n / 26) - 1
        }
        return label
      }
      
      function render(frameId) {
        if (!ctx || !canvas) {
          self.postMessage({ type: 'error', message: 'Canvas not initialized' })
          return
        }
        
        const startTime = performance.now()
        ctx.clearRect(0, 0, width, height)
        
        const { startRow, endRow, startCol, endCol } = getVisibleRange()
        
        // 背景
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, width, config.colHeaderHeight)
        ctx.fillRect(0, 0, config.rowHeaderWidth, height)
        
        // 网格线
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 1
        
        for (let c = startCol; c <= endCol + 1; c++) {
          const x = config.rowHeaderWidth + getColLeft(c) - viewport.scrollLeft
          if (x >= config.rowHeaderWidth && x <= width) {
            ctx.beginPath()
            ctx.moveTo(x, config.colHeaderHeight)
            ctx.lineTo(x, height)
            ctx.stroke()
          }
        }
        
        for (let r = startRow; r <= endRow + 1; r++) {
          const y = config.colHeaderHeight + getRowTop(r) - viewport.scrollTop
          if (y >= config.colHeaderHeight && y <= height) {
            ctx.beginPath()
            ctx.moveTo(config.rowHeaderWidth, y)
            ctx.lineTo(width, y)
            ctx.stroke()
          }
        }
        
        // 表头
        ctx.fillStyle = '#333'
        ctx.font = '12px Arial'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        
        for (let c = startCol; c <= endCol; c++) {
          const x = config.rowHeaderWidth + getColLeft(c) - viewport.scrollLeft
          const w = getColWidth(c)
          if (x + w > config.rowHeaderWidth && x < width) {
            ctx.fillText(getColLabel(c), x + w / 2, config.colHeaderHeight / 2)
          }
        }
        
        for (let r = startRow; r <= endRow; r++) {
          const y = config.colHeaderHeight + getRowTop(r) - viewport.scrollTop
          const h = getRowHeight(r)
          if (y + h > config.colHeaderHeight && y < height) {
            ctx.fillText(String(r + 1), config.rowHeaderWidth / 2, y + h / 2)
          }
        }
        
        // 分隔线
        ctx.strokeStyle = '#999'
        ctx.beginPath()
        ctx.moveTo(0, config.colHeaderHeight)
        ctx.lineTo(width, config.colHeaderHeight)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(config.rowHeaderWidth, 0)
        ctx.lineTo(config.rowHeaderWidth, height)
        ctx.stroke()
        
        // 单元格内容
        ctx.save()
        ctx.beginPath()
        ctx.rect(config.rowHeaderWidth, config.colHeaderHeight, width - config.rowHeaderWidth, height - config.colHeaderHeight)
        ctx.clip()
        
        let cellsRendered = 0
        for (let r = startRow; r <= endRow; r++) {
          const cellY = config.colHeaderHeight + getRowTop(r) - viewport.scrollTop
          const rowHeight = getRowHeight(r)
          if (rowHeight === 0) continue
          
          for (let c = startCol; c <= endCol; c++) {
            const cellX = config.rowHeaderWidth + getColLeft(c) - viewport.scrollLeft
            const colWidth = getColWidth(c)
            if (colWidth === 0) continue
            
            const key = r + ',' + c
            const cell = cells.get(key)
            const style = styles.get(key)
            
            // 背景色
            if (style && style.backgroundColor && style.backgroundColor !== '#FFFFFF') {
              ctx.fillStyle = style.backgroundColor
              ctx.fillRect(cellX + 0.5, cellY + 0.5, colWidth - 1, rowHeight - 1)
            }
            
            // 内容
            if (cell && cell.value !== null && cell.value !== undefined) {
              ctx.font = style ? buildFont(style) : '12px Arial'
              ctx.fillStyle = (style && style.color) || '#000'
              ctx.textBaseline = 'middle'
              ctx.textAlign = 'left'
              
              const padding = 4
              let textX = cellX + padding
              const textY = cellY + rowHeight / 2
              
              if (style && style.textAlign === 'center') {
                const metrics = ctx.measureText(String(cell.value))
                textX = cellX + (colWidth - metrics.width) / 2
              } else if (style && style.textAlign === 'right') {
                const metrics = ctx.measureText(String(cell.value))
                textX = cellX + colWidth - metrics.width - padding
              }
              
              ctx.save()
              ctx.beginPath()
              ctx.rect(cellX, cellY, colWidth, rowHeight)
              ctx.clip()
              ctx.fillText(String(cell.value), textX, textY)
              ctx.restore()
            }
            
            cellsRendered++
          }
        }
        ctx.restore()
        
        // 选择高亮
        if (selection.row >= 0 && selection.col >= 0) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(config.rowHeaderWidth, config.colHeaderHeight, width - config.rowHeaderWidth, height - config.colHeaderHeight)
          ctx.clip()
          
          if (selection.endRow >= 0 && selection.endCol >= 0) {
            const sx = config.rowHeaderWidth + getColLeft(selection.startCol) - viewport.scrollLeft
            const sy = config.colHeaderHeight + getRowTop(selection.startRow) - viewport.scrollTop
            const ex = config.rowHeaderWidth + getColLeft(selection.endCol + 1) - viewport.scrollLeft
            const ey = config.colHeaderHeight + getRowTop(selection.endRow + 1) - viewport.scrollTop
            
            ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
            ctx.fillRect(sx, sy, ex - sx, ey - sy)
            ctx.strokeStyle = '#3b82f6'
            ctx.lineWidth = 2
            ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
          }
          
          const sx = config.rowHeaderWidth + getColLeft(selection.col) - viewport.scrollLeft
          const sy = config.colHeaderHeight + getRowTop(selection.row) - viewport.scrollTop
          const w = getColWidth(selection.col)
          const h = getRowHeight(selection.row)
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 2
          ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1)
          
          ctx.restore()
        }
        
        // 拖拽框
        if (dragState.isDragging && dragState.startRow >= 0) {
          const sr = Math.min(dragState.startRow, dragState.currentRow)
          const sc = Math.min(dragState.startCol, dragState.currentCol)
          const er = Math.max(dragState.startRow, dragState.currentRow)
          const ec = Math.max(dragState.startCol, dragState.currentCol)
          
          const sx = config.rowHeaderWidth + getColLeft(sc) - viewport.scrollLeft
          const sy = config.colHeaderHeight + getRowTop(sr) - viewport.scrollTop
          const ex = config.rowHeaderWidth + getColLeft(ec + 1) - viewport.scrollLeft
          const ey = config.colHeaderHeight + getRowTop(er + 1) - viewport.scrollTop
          
          ctx.save()
          ctx.beginPath()
          ctx.rect(config.rowHeaderWidth, config.colHeaderHeight, width - config.rowHeaderWidth, height - config.colHeaderHeight)
          ctx.clip()
          ctx.strokeStyle = '#10b981'
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])
          ctx.strokeRect(sx + 0.5, sy + 0.5, ex - sx - 1, ey - sy - 1)
          ctx.setLineDash([])
          ctx.restore()
        }
        
        const renderTime = performance.now() - startTime
        self.postMessage({ type: 'rendered', frameId, renderTime, cellsRendered })
      }
      
      function buildFont(style) {
        const parts = []
        if (style.italic) parts.push('italic')
        if (style.bold) parts.push('bold')
        parts.push((style.fontSize || 12) + 'px')
        parts.push(style.fontFamily || 'Arial, sans-serif')
        return parts.join(' ')
      }
      
      self.onmessage = (e) => {
        const msg = e.data
        
        switch (msg.type) {
          case 'init':
            canvas = msg.canvas
            ctx = canvas.getContext('2d')
            dpr = msg.dpr
            width = canvas.width / dpr
            height = canvas.height / dpr
            ctx.scale(dpr, dpr)
            self.postMessage({ type: 'ready' })
            break
            
          case 'resize':
            canvas.width = Math.floor(msg.width * msg.dpr)
            canvas.height = Math.floor(msg.height * msg.dpr)
            width = msg.width
            height = msg.height
            dpr = msg.dpr
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.scale(dpr, dpr)
            break
            
          case 'setViewport':
            viewport = msg.viewport
            break
            
          case 'updateData':
            if (msg.fullUpdate) cells.clear()
            for (const c of msg.cells) cells.set(c.row + ',' + c.col, c)
            break
            
          case 'updateStyles':
            for (const s of msg.styles) styles.set(s.row + ',' + s.col, s)
            break
            
          case 'setSelection':
            selection = msg.selection
            break
            
          case 'setDragState':
            dragState = msg.dragState
            break
            
          case 'setSizes':
            rowHeights.clear()
            colWidths.clear()
            hiddenRows.clear()
            hiddenCols.clear()
            for (const [r, h] of msg.sizes.rowHeights) rowHeights.set(r, h)
            for (const [c, w] of msg.sizes.colWidths) colWidths.set(c, w)
            for (const r of msg.sizes.hiddenRows) hiddenRows.add(r)
            for (const c of msg.sizes.hiddenCols) hiddenCols.add(c)
            break
            
          case 'setMergedRegions':
            mergedRegions = msg.regions
            break
            
          case 'render':
            render(msg.frameId)
            break
            
          case 'destroy':
            canvas = null
            ctx = null
            cells.clear()
            styles.clear()
            break
        }
      }
    `
  }
  
  /**
   * 初始化 Worker
   */
  async function init(): Promise<boolean> {
    if (!enabled || !checkSupport()) {
      return false
    }
    
    const canvas = canvasRef.value
    if (!canvas) {
      state.value.error = 'Canvas element not found'
      return false
    }
    
    try {
      // 创建内联 Worker
      const workerCode = createWorkerCode()
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      
      worker = new Worker(workerUrl)
      
      // 监听消息
      worker.onmessage = handleMessage
      worker.onerror = (e) => {
        state.value.error = e.message
        console.error('[useOffscreenRenderer] Worker error:', e)
      }
      
      // 转移 Canvas 控制权
      const offscreen = canvas.transferControlToOffscreen()
      const dpr = window.devicePixelRatio || 1
      
      offscreen.width = Math.floor(canvas.clientWidth * dpr)
      offscreen.height = Math.floor(canvas.clientHeight * dpr)
      
      worker.postMessage({
        type: 'init',
        canvas: offscreen,
        dpr
      }, [offscreen])
      
      state.value.isInitialized = true
      
      // 清理 URL
      URL.revokeObjectURL(workerUrl)
      
      return true
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : 'Init failed'
      console.error('[useOffscreenRenderer] Init error:', error)
      return false
    }
  }
  
  /**
   * 销毁 Worker
   */
  function destroy(): void {
    if (worker) {
      worker.postMessage({ type: 'destroy' })
      worker.terminate()
      worker = null
    }
    state.value.isReady = false
    state.value.isInitialized = false
  }
  
  /**
   * 处理 Worker 消息
   */
  function handleMessage(e: MessageEvent): void {
    const msg = e.data
    
    switch (msg.type) {
      case 'ready':
        state.value.isReady = true
        break
        
      case 'rendered':
        pendingRender = false
        state.value.lastCellsRendered = msg.cellsRendered
        
        renderTimes.push(msg.renderTime)
        if (renderTimes.length > 60) renderTimes.shift()
        
        state.value.avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
        state.value.fps = state.value.avgRenderTime > 0 ? 1000 / state.value.avgRenderTime : 0
        break
        
      case 'error':
        state.value.error = msg.message
        break
    }
  }
  
  // ==================== 公开方法 ====================
  
  /**
   * 调整大小
   */
  function resize(width: number, height: number): void {
    if (!worker || !state.value.isReady) return
    
    const dpr = window.devicePixelRatio || 1
    worker.postMessage({ type: 'resize', width, height, dpr })
  }
  
  /**
   * 设置视口
   */
  function setViewport(viewport: ViewportState): void {
    if (!worker || !state.value.isReady) return
    worker.postMessage({ type: 'setViewport', viewport })
  }
  
  /**
   * 更新数据
   */
  function updateData(cells: CellData[], fullUpdate = false): void {
    if (!worker || !state.value.isReady) return
    worker.postMessage({ type: 'updateData', cells, fullUpdate })
  }
  
  /**
   * 更新样式
   */
  function updateStyles(styles: CellStyleData[]): void {
    if (!worker || !state.value.isReady) return
    worker.postMessage({ type: 'updateStyles', styles })
  }
  
  /**
   * 设置选择
   */
  function setSelection(selection: SelectionState): void {
    if (!worker || !state.value.isReady) return
    worker.postMessage({ type: 'setSelection', selection })
  }
  
  /**
   * 设置拖拽状态
   */
  function setDragState(dragState: DragStateData): void {
    if (!worker || !state.value.isReady) return
    worker.postMessage({ type: 'setDragState', dragState })
  }
  
  /**
   * 设置尺寸数据
   */
  function setSizes(sizes: SizeData): void {
    if (!worker || !state.value.isReady) return
    worker.postMessage({ type: 'setSizes', sizes })
  }
  
  /**
   * 设置合并单元格
   */
  function setMergedRegions(regions: MergedRegionData[]): void {
    if (!worker || !state.value.isReady) return
    worker.postMessage({ type: 'setMergedRegions', regions })
  }
  
  /**
   * 请求渲染
   */
  function render(): void {
    if (!worker || !state.value.isReady || pendingRender) return
    
    pendingRender = true
    frameId++
    worker.postMessage({ type: 'render', frameId })
  }
  
  /**
   * 调度下一帧渲染
   */
  function scheduleRender(): void {
    requestAnimationFrame(() => render())
  }
  
  // ==================== 生命周期 ====================
  
  onMounted(() => {
    if (enabled) {
      init()
    }
  })
  
  onUnmounted(() => {
    destroy()
  })
  
  return {
    // 状态
    state,
    
    // 方法
    init,
    destroy,
    resize,
    setViewport,
    updateData,
    updateStyles,
    setSelection,
    setDragState,
    setSizes,
    setMergedRegions,
    render,
    scheduleRender,
    
    // 工具
    checkSupport,
    isOffscreenRenderingSupported
  }
}

export type UseOffscreenRendererReturn = ReturnType<typeof useOffscreenRenderer>
