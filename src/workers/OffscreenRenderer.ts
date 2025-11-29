/**
 * OffscreenCanvas 渲染器
 * 主线程端的封装类，管理与 Worker 的通信
 */

import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  CellData,
  CellStyleData,
  GeometryConfigData,
  SizeData,
  ViewportState,
  SelectionState,
  DragStateData,
  MergedRegionData
} from './renderProtocol'
import { isOffscreenRenderingSupported, detectFeatureSupport } from './renderProtocol'

export interface OffscreenRendererConfig {
  canvas: HTMLCanvasElement
  config: GeometryConfigData
  totalRows: number
  totalCols: number
  onReady?: () => void
  onRenderComplete?: (frameId: number, renderTime: number, cellsRendered: number) => void
  onError?: (message: string) => void
  onMetrics?: (fps: number, avgRenderTime: number) => void
}

export class OffscreenRenderer {
  private worker: Worker | null = null
  private canvas: HTMLCanvasElement
  private config: GeometryConfigData
  private totalRows: number
  private totalCols: number
  private isReady = false
  private pendingRender = false
  private frameId = 0
  private lastRenderTimes: number[] = []
  
  // 回调
  private onReady?: () => void
  private onRenderComplete?: (frameId: number, renderTime: number, cellsRendered: number) => void
  private onError?: (message: string) => void
  private onMetrics?: (fps: number, avgRenderTime: number) => void

  constructor(options: OffscreenRendererConfig) {
    this.canvas = options.canvas
    this.config = options.config
    this.totalRows = options.totalRows
    this.totalCols = options.totalCols
    this.onReady = options.onReady
    this.onRenderComplete = options.onRenderComplete
    this.onError = options.onError
    this.onMetrics = options.onMetrics
  }

  /**
   * 检查是否支持 OffscreenCanvas 渲染
   */
  static isSupported(): boolean {
    return isOffscreenRenderingSupported()
  }

  /**
   * 获取特性支持详情
   */
  static getFeatureSupport() {
    return detectFeatureSupport()
  }

  /**
   * 初始化渲染器
   */
  async init(): Promise<boolean> {
    if (!OffscreenRenderer.isSupported()) {
      console.warn('[OffscreenRenderer] OffscreenCanvas not supported, falling back to main thread rendering')
      return false
    }

    try {
      // 创建 Worker
      // 使用 Vite 的 worker 导入语法
      this.worker = new Worker(
        new URL('./offscreen-worker.ts', import.meta.url),
        { type: 'module' }
      )

      // 监听消息
      this.worker.onmessage = this.handleMessage.bind(this)
      this.worker.onerror = (e) => {
        console.error('[OffscreenRenderer] Worker error:', e)
        this.onError?.(e.message)
      }

      // 转移 Canvas 控制权
      const offscreen = this.canvas.transferControlToOffscreen()
      const dpr = window.devicePixelRatio || 1

      // 设置 Canvas 尺寸
      offscreen.width = Math.floor(this.canvas.clientWidth * dpr)
      offscreen.height = Math.floor(this.canvas.clientHeight * dpr)

      // 发送初始化消息
      this.postMessage({
        type: 'init',
        canvas: offscreen,
        dpr,
        config: this.config,
        totalRows: this.totalRows,
        totalCols: this.totalCols
      }, [offscreen])

      return true
    } catch (error) {
      console.error('[OffscreenRenderer] Init failed:', error)
      this.onError?.(error instanceof Error ? error.message : 'Init failed')
      return false
    }
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    if (this.worker) {
      this.postMessage({ type: 'destroy' })
      this.worker.terminate()
      this.worker = null
    }
    this.isReady = false
  }

  /**
   * 调整大小
   */
  resize(width: number, height: number): void {
    if (!this.isReady) return
    
    const dpr = window.devicePixelRatio || 1
    this.postMessage({
      type: 'resize',
      width,
      height,
      dpr
    })
  }

  /**
   * 设置视口
   */
  setViewport(viewport: ViewportState): void {
    if (!this.isReady) return
    
    this.postMessage({
      type: 'setViewport',
      viewport
    })
  }

  /**
   * 更新数据
   */
  updateData(cells: CellData[], fullUpdate = false): void {
    if (!this.isReady) return
    
    this.postMessage({
      type: 'updateData',
      cells,
      fullUpdate
    })
  }

  /**
   * 更新样式
   */
  updateStyles(styles: CellStyleData[]): void {
    if (!this.isReady) return
    
    this.postMessage({
      type: 'updateStyles',
      styles
    })
  }

  /**
   * 设置选择
   */
  setSelection(selection: SelectionState): void {
    if (!this.isReady) return
    
    this.postMessage({
      type: 'setSelection',
      selection
    })
  }

  /**
   * 设置拖拽状态
   */
  setDragState(dragState: DragStateData): void {
    if (!this.isReady) return
    
    this.postMessage({
      type: 'setDragState',
      dragState
    })
  }

  /**
   * 设置尺寸数据
   */
  setSizes(sizes: SizeData): void {
    if (!this.isReady) return
    
    this.postMessage({
      type: 'setSizes',
      sizes
    })
  }

  /**
   * 设置合并单元格
   */
  setMergedRegions(regions: MergedRegionData[]): void {
    if (!this.isReady) return
    
    this.postMessage({
      type: 'setMergedRegions',
      regions
    })
  }

  /**
   * 请求渲染
   */
  render(): void {
    if (!this.isReady) return
    if (this.pendingRender) return
    
    this.pendingRender = true
    this.frameId++
    
    this.postMessage({
      type: 'render',
      frameId: this.frameId
    })
  }

  /**
   * 调度下一帧渲染
   */
  scheduleRender(): void {
    requestAnimationFrame(() => {
      this.render()
    })
  }

  /**
   * 是否已就绪
   */
  get ready(): boolean {
    return this.isReady
  }

  /**
   * 获取平均渲染时间
   */
  getAverageRenderTime(): number {
    if (this.lastRenderTimes.length === 0) return 0
    return this.lastRenderTimes.reduce((a, b) => a + b, 0) / this.lastRenderTimes.length
  }

  /**
   * 获取预估 FPS
   */
  getEstimatedFPS(): number {
    const avgTime = this.getAverageRenderTime()
    return avgTime > 0 ? 1000 / avgTime : 0
  }

  // ==================== 私有方法 ====================

  private postMessage(message: MainToWorkerMessage, transfer?: Transferable[]): void {
    if (!this.worker) return
    
    if (transfer) {
      this.worker.postMessage(message, transfer)
    } else {
      this.worker.postMessage(message)
    }
  }

  private handleMessage(e: MessageEvent<WorkerToMainMessage>): void {
    const msg = e.data

    switch (msg.type) {
      case 'ready':
        this.isReady = true
        console.log('[OffscreenRenderer] Worker ready')
        this.onReady?.()
        break

      case 'rendered':
        this.pendingRender = false
        this.lastRenderTimes.push(msg.renderTime)
        if (this.lastRenderTimes.length > 60) {
          this.lastRenderTimes.shift()
        }
        this.onRenderComplete?.(msg.frameId, msg.renderTime, msg.cellsRendered)
        break

      case 'error':
        console.error('[OffscreenRenderer] Worker error:', msg.message)
        this.onError?.(msg.message)
        break

      case 'metrics':
        this.onMetrics?.(msg.fps, msg.avgRenderTime)
        break
    }
  }
}

/**
 * 创建 OffscreenRenderer 的工厂函数
 * 如果不支持则返回 null
 */
export function createOffscreenRenderer(
  options: OffscreenRendererConfig
): OffscreenRenderer | null {
  if (!OffscreenRenderer.isSupported()) {
    return null
  }
  return new OffscreenRenderer(options)
}
