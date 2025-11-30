/**
 * 事件管理模块
 * 负责统一管理事件监听器的注册和清理
 */

/**
 * 事件处理器映射
 */
export interface EventHandlers {
  // 容器事件
  onMouseDown: (e: MouseEvent) => void
  onClick: (e: MouseEvent) => void
  onDoubleClick: (e: MouseEvent) => void
  onMouseMove: (e: MouseEvent) => void
  onWheel: (e: WheelEvent) => void
  
  // 全局事件
  onMouseUp: (e: MouseEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  onPaste: (e: ClipboardEvent) => void
  onResize: () => void
  onCompositionStart: (e: CompositionEvent) => void
  
  // 滚动条全局拖拽事件
  onGlobalMouseMove: (e: MouseEvent) => void
  onGlobalMouseUp: () => void
}

/**
 * 事件管理器
 */
export class EventManager {
  private container: HTMLElement | null = null
  private handlers: EventHandlers | null = null
  private registered = false

  /**
   * 注册所有事件监听器
   */
  register(container: HTMLElement, handlers: EventHandlers): void {
    if (this.registered) {
      console.warn('Events already registered')
      return
    }

    this.container = container
    this.handlers = handlers

    // 容器事件
    container.addEventListener('mousedown', handlers.onMouseDown)
    container.addEventListener('click', handlers.onClick)
    container.addEventListener('dblclick', handlers.onDoubleClick)
    container.addEventListener('mousemove', handlers.onMouseMove)
    container.addEventListener('wheel', handlers.onWheel, { passive: false })

    // 全局事件
    window.addEventListener('mouseup', handlers.onMouseUp)
    window.addEventListener('keydown', handlers.onKeyDown)
    window.addEventListener('paste', handlers.onPaste)
    window.addEventListener('resize', handlers.onResize)
    window.addEventListener('compositionstart', handlers.onCompositionStart)
    window.addEventListener('mousemove', handlers.onGlobalMouseMove)
    window.addEventListener('mouseup', handlers.onGlobalMouseUp)

    this.registered = true
  }

  /**
   * 移除所有事件监听器
   */
  unregister(): void {
    if (!this.registered || !this.container || !this.handlers) {
      return
    }

    // 容器事件
    this.container.removeEventListener('mousedown', this.handlers.onMouseDown)
    this.container.removeEventListener('click', this.handlers.onClick)
    this.container.removeEventListener('dblclick', this.handlers.onDoubleClick)
    this.container.removeEventListener('mousemove', this.handlers.onMouseMove)
    this.container.removeEventListener('wheel', this.handlers.onWheel)

    // 全局事件
    window.removeEventListener('mouseup', this.handlers.onMouseUp)
    window.removeEventListener('keydown', this.handlers.onKeyDown)
    window.removeEventListener('paste', this.handlers.onPaste)
    window.removeEventListener('resize', this.handlers.onResize)
    window.removeEventListener('compositionstart', this.handlers.onCompositionStart)
    window.removeEventListener('mousemove', this.handlers.onGlobalMouseMove)
    window.removeEventListener('mouseup', this.handlers.onGlobalMouseUp)

    this.container = null
    this.handlers = null
    this.registered = false
  }

  /**
   * 检查是否已注册
   */
  isRegistered(): boolean {
    return this.registered
  }
}

/**
 * 创建事件管理器实例
 */
export function createEventManager(): EventManager {
  return new EventManager()
}
