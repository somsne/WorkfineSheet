/**
 * Render core helpers: device pixel ratio, canvas size, and redraw scheduler.
 * Keep draw function in component; provide a scheduler that triggers draw at most once per frame.
 */

export function devicePixelRatioSafe(): number {
  return (typeof window !== 'undefined' && (window.devicePixelRatio || 1)) || 1
}

export function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = devicePixelRatioSafe()
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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
