/**
 * Render core helpers: device pixel ratio, canvas size, and redraw scheduler.
 * Keep draw function in component; provide a scheduler that triggers draw at most once per frame.
 */

export function devicePixelRatioSafe(): number {
  return (typeof window !== 'undefined' && (window.devicePixelRatio || 1)) || 1
}

/**
 * 设置 Canvas 尺寸（仅在尺寸变化时更新，避免 Layout Thrashing）
 * @returns true 如果尺寸发生了变化
 */
export function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): boolean {
  const dpr = devicePixelRatioSafe()
  const newWidth = Math.floor(width * dpr)
  const newHeight = Math.floor(height * dpr)
  
  // 检查是否需要更新（避免不必要的 DOM 操作触发重排）
  if (canvas.width === newWidth && canvas.height === newHeight) {
    // 即使尺寸相同，也需要重置变换矩阵（因为 clearRect 等操作可能影响它）
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return false
  }
  
  canvas.width = newWidth
  canvas.height = newHeight
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return true
}

export function createRedrawScheduler(drawFn: () => void) {
  let scheduled = false
  let rafId: number | null = null

  function scheduleRedraw() {
    if (scheduled) return
    scheduled = true
    rafId = requestAnimationFrame(() => {
      scheduled = false
      rafId = null
      drawFn()
    })
  }

  function cancelScheduled() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
      scheduled = false
    }
  }

  return { scheduleRedraw, cancelScheduled }
}
