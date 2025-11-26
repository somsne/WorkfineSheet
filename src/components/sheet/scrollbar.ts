/**
 * Scrollbar management module: handles viewport scrolling and custom scrollbar rendering.
 * Manages viewport state, scrollbar visibility/sizing, and drag interactions.
 */

import type { Viewport, ScrollbarState } from './types'

export interface ScrollbarConfig {
  containerWidth: number
  containerHeight: number
  contentWidth: number
  contentHeight: number
  rowHeaderWidth: number
  colHeaderHeight: number
  minThumbSize?: number
}

/**
 * Update scrollbar state based on container and content dimensions.
 */
export function updateScrollbars(
  viewport: Viewport,
  scrollbar: ScrollbarState,
  config: ScrollbarConfig
) {
  const {
    containerWidth: w,
    containerHeight: h,
    contentWidth: contentW,
    contentHeight: contentH,
    rowHeaderWidth,
    colHeaderHeight,
    minThumbSize = 20
  } = config

  // Track size is the visible area (excluding row/col headers)
  const trackH = Math.max(0, h - colHeaderHeight)
  const trackW = Math.max(0, w - rowHeaderWidth)

  // Vertical scrollbar
  scrollbar.v.trackSize = trackH
  if (contentH <= trackH || trackH === 0) {
    scrollbar.v.visible = false
    viewport.scrollTop = 0
    scrollbar.v.thumbSize = 0
    scrollbar.v.thumbPos = 0
  } else {
    scrollbar.v.visible = true
    const thumbLen = Math.max(minThumbSize, Math.floor(trackH * trackH / contentH))
    const maxThumbPos = trackH - thumbLen
    const maxScroll = contentH - trackH
    const pos = Math.floor((viewport.scrollTop / maxScroll) * maxThumbPos)
    scrollbar.v.thumbSize = thumbLen
    scrollbar.v.thumbPos = Math.max(0, Math.min(maxThumbPos, pos))
  }

  // Horizontal scrollbar
  scrollbar.h.trackSize = trackW
  if (contentW <= trackW || trackW === 0) {
    scrollbar.h.visible = false
    viewport.scrollLeft = 0
    scrollbar.h.thumbSize = 0
    scrollbar.h.thumbPos = 0
  } else {
    scrollbar.h.visible = true
    const thumbLen = Math.max(minThumbSize, Math.floor(trackW * trackW / contentW))
    const maxThumbPos = trackW - thumbLen
    const maxScroll = contentW - trackW
    const pos = Math.floor((viewport.scrollLeft / maxScroll) * maxThumbPos)
    scrollbar.h.thumbSize = thumbLen
    scrollbar.h.thumbPos = Math.max(0, Math.min(maxThumbPos, pos))
  }
}

/**
 * Handle mouse wheel scrolling.
 * Returns true if scroll position changed.
 */
export function handleWheel(
  e: WheelEvent,
  viewport: Viewport,
  config: {
    containerWidth: number
    containerHeight: number
    contentWidth: number
    contentHeight: number
    rowHeaderWidth: number
    colHeaderHeight: number
  }
): boolean {
  const {
    containerWidth: w,
    containerHeight: h,
    contentWidth,
    contentHeight,
    rowHeaderWidth,
    colHeaderHeight
  } = config

  let changed = false

  // Scroll vertically or horizontally
  if (e.shiftKey || e.deltaX !== 0) {
    // Horizontal scroll
    const trackW = Math.max(0, w - rowHeaderWidth)
    const maxScrollLeft = Math.max(0, contentWidth - trackW)
    const newScrollLeft = Math.max(0, Math.min(
      viewport.scrollLeft + (e.deltaY || e.deltaX),
      maxScrollLeft
    ))
    if (newScrollLeft !== viewport.scrollLeft) {
      viewport.scrollLeft = newScrollLeft
      changed = true
    }
  } else {
    // Vertical scroll
    const trackH = Math.max(0, h - colHeaderHeight)
    const maxScrollTop = Math.max(0, contentHeight - trackH)
    const newScrollTop = Math.max(0, Math.min(
      viewport.scrollTop + e.deltaY,
      maxScrollTop
    ))
    if (newScrollTop !== viewport.scrollTop) {
      viewport.scrollTop = newScrollTop
      changed = true
    }
  }

  return changed
}

/**
 * Handle scrollbar thumb drag.
 * Returns true if scroll position changed.
 */
export function handleScrollbarDrag(
  scrollbar: ScrollbarState,
  viewport: Viewport,
  mousePos: { x: number; y: number },
  config: {
    containerWidth: number
    containerHeight: number
    contentWidth: number
    contentHeight: number
    rowHeaderWidth: number
    colHeaderHeight: number
  }
): boolean {
  const {
    containerWidth: w,
    containerHeight: h,
    contentWidth,
    contentHeight,
    rowHeaderWidth,
    colHeaderHeight
  } = config

  let changed = false

  if (scrollbar.dragging === 'v') {
    const trackH = Math.max(0, h - colHeaderHeight)
    const thumbMovable = Math.max(1, trackH - scrollbar.v.thumbSize)
    const maxScroll = Math.max(1, contentHeight - trackH)
    const delta = mousePos.y - scrollbar.startMousePos
    const scrollDelta = delta * (maxScroll / thumbMovable)
    const newScrollTop = Math.max(0, Math.min(scrollbar.startScroll + scrollDelta, maxScroll))
    if (newScrollTop !== viewport.scrollTop) {
      viewport.scrollTop = newScrollTop
      changed = true
    }
  } else if (scrollbar.dragging === 'h') {
    const trackW = Math.max(0, w - rowHeaderWidth)
    const thumbMovable = Math.max(1, trackW - scrollbar.h.thumbSize)
    const maxScroll = Math.max(1, contentWidth - trackW)
    const delta = mousePos.x - scrollbar.startMousePos
    const scrollDelta = delta * (maxScroll / thumbMovable)
    const newScrollLeft = Math.max(0, Math.min(scrollbar.startScroll + scrollDelta, maxScroll))
    if (newScrollLeft !== viewport.scrollLeft) {
      viewport.scrollLeft = newScrollLeft
      changed = true
    }
  }

  return changed
}

/**
 * Start vertical scrollbar drag.
 */
export function startVerticalDrag(
  scrollbar: ScrollbarState,
  viewport: Viewport,
  mouseY: number
) {
  scrollbar.dragging = 'v'
  scrollbar.startMousePos = mouseY
  scrollbar.startScroll = viewport.scrollTop
}

/**
 * Start horizontal scrollbar drag.
 */
export function startHorizontalDrag(
  scrollbar: ScrollbarState,
  viewport: Viewport,
  mouseX: number
) {
  scrollbar.dragging = 'h'
  scrollbar.startMousePos = mouseX
  scrollbar.startScroll = viewport.scrollLeft
}

/**
 * End scrollbar drag.
 */
export function endDrag(scrollbar: ScrollbarState) {
  scrollbar.dragging = ''
}
