/**
 * 图片几何计算模块
 * 负责计算图片在视口中的位置、控制点位置等
 */

import type {
  FloatingImage,
  ImagePosition,
  HandlePosition,
  ResizeHandle,
  Viewport,
  GeometryConfig,
  SizeAccess
} from '../types'
import { IMAGE_CONFIG } from '../types'
import { getRowTop, getColLeft } from '../geometry'

/**
 * 计算图片在视口中的位置
 * @param image 图片对象
 * @param viewport 视口状态
 * @param sizes 尺寸访问器
 * @param config 几何配置
 * @returns 图片位置信息
 */
export function calculateImagePosition(
  image: FloatingImage,
  viewport: Viewport,
  sizes: SizeAccess,
  config: GeometryConfig
): ImagePosition {
  const { rowHeaderWidth, colHeaderHeight } = config
  
  // 计算锚点单元格的位置
  const cellX = getColLeft(image.anchorCol, sizes, config)
  const cellY = getRowTop(image.anchorRow, sizes, config)
  
  // 图片位置 = 单元格位置 + 偏移 + 表头 - 滚动
  const x = rowHeaderWidth + cellX + image.offsetX - viewport.scrollLeft
  const y = colHeaderHeight + cellY + image.offsetY - viewport.scrollTop
  
  return {
    x,
    y,
    width: image.width,
    height: image.height,
    visible: true // 可见性在渲染时进一步判断
  }
}

/**
 * 检查图片是否在可见区域内
 */
export function isImageVisible(
  pos: ImagePosition,
  containerWidth: number,
  containerHeight: number,
  config: GeometryConfig
): boolean {
  const { rowHeaderWidth, colHeaderHeight } = config
  
  // 检查是否完全在可见区域外
  if (pos.x + pos.width < rowHeaderWidth) return false
  if (pos.y + pos.height < colHeaderHeight) return false
  if (pos.x > containerWidth) return false
  if (pos.y > containerHeight) return false
  
  return true
}

/**
 * 计算图片的 8 个控制点位置
 */
export function getResizeHandles(pos: ImagePosition): HandlePosition[] {
  const { x, y, width, height } = pos
  const halfW = width / 2
  const halfH = height / 2
  
  return [
    // 上排
    { type: 'nw', x, y },
    { type: 'n', x: x + halfW, y },
    { type: 'ne', x: x + width, y },
    // 中排
    { type: 'w', x, y: y + halfH },
    { type: 'e', x: x + width, y: y + halfH },
    // 下排
    { type: 'sw', x, y: y + height },
    { type: 's', x: x + halfW, y: y + height },
    { type: 'se', x: x + width, y: y + height }
  ]
}

/**
 * 检查点是否在图片区域内
 */
export function isPointInImage(
  x: number,
  y: number,
  imagePos: ImagePosition
): boolean {
  return (
    x >= imagePos.x &&
    x <= imagePos.x + imagePos.width &&
    y >= imagePos.y &&
    y <= imagePos.y + imagePos.height
  )
}

/**
 * 检查点是否在控制点上
 * @returns 控制点类型，如果不在任何控制点上返回 null
 */
export function getHandleAtPoint(
  x: number,
  y: number,
  imagePos: ImagePosition
): ResizeHandle | null {
  const handles = getResizeHandles(imagePos)
  const hitArea = IMAGE_CONFIG.HANDLE_HIT_AREA
  
  for (const handle of handles) {
    if (
      x >= handle.x - hitArea &&
      x <= handle.x + hitArea &&
      y >= handle.y - hitArea &&
      y <= handle.y + hitArea
    ) {
      return handle.type
    }
  }
  
  return null
}

/**
 * 根据控制点类型获取光标样式
 */
export function getCursorForHandle(handle: ResizeHandle | null): string {
  if (!handle) return 'default'
  
  const cursorMap: Record<ResizeHandle, string> = {
    'nw': 'nwse-resize',
    'n': 'ns-resize',
    'ne': 'nesw-resize',
    'w': 'ew-resize',
    'e': 'ew-resize',
    'sw': 'nesw-resize',
    's': 'ns-resize',
    'se': 'nwse-resize'
  }
  
  return cursorMap[handle]
}

/**
 * 计算调整大小后的新尺寸
 * @param originalWidth 原始宽度
 * @param originalHeight 原始高度
 * @param handle 控制点类型
 * @param deltaX X 方向变化量
 * @param deltaY Y 方向变化量
 * @param lockAspectRatio 是否锁定宽高比
 * @param minSize 最小尺寸
 */
export function calculateResizedDimensions(
  originalWidth: number,
  originalHeight: number,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  lockAspectRatio: boolean,
  minSize: number = IMAGE_CONFIG.MIN_SIZE
): { width: number; height: number; offsetDeltaX: number; offsetDeltaY: number } {
  let newWidth = originalWidth
  let newHeight = originalHeight
  let offsetDeltaX = 0
  let offsetDeltaY = 0
  
  const aspectRatio = originalWidth / originalHeight
  
  // 根据控制点调整尺寸
  switch (handle) {
    case 'e':
      newWidth = Math.max(minSize, originalWidth + deltaX)
      if (lockAspectRatio) {
        newHeight = newWidth / aspectRatio
      }
      break
      
    case 'w':
      newWidth = Math.max(minSize, originalWidth - deltaX)
      offsetDeltaX = originalWidth - newWidth
      if (lockAspectRatio) {
        newHeight = newWidth / aspectRatio
        // 垂直居中调整
        offsetDeltaY = (originalHeight - newHeight) / 2
      }
      break
      
    case 's':
      newHeight = Math.max(minSize, originalHeight + deltaY)
      if (lockAspectRatio) {
        newWidth = newHeight * aspectRatio
      }
      break
      
    case 'n':
      newHeight = Math.max(minSize, originalHeight - deltaY)
      offsetDeltaY = originalHeight - newHeight
      if (lockAspectRatio) {
        newWidth = newHeight * aspectRatio
        // 水平居中调整
        offsetDeltaX = (originalWidth - newWidth) / 2
      }
      break
      
    case 'se':
      newWidth = Math.max(minSize, originalWidth + deltaX)
      newHeight = Math.max(minSize, originalHeight + deltaY)
      if (lockAspectRatio) {
        // 取较大的变化比例
        const scaleX = newWidth / originalWidth
        const scaleY = newHeight / originalHeight
        const scale = Math.max(scaleX, scaleY)
        newWidth = originalWidth * scale
        newHeight = originalHeight * scale
      }
      break
      
    case 'sw':
      newWidth = Math.max(minSize, originalWidth - deltaX)
      newHeight = Math.max(minSize, originalHeight + deltaY)
      offsetDeltaX = originalWidth - newWidth
      if (lockAspectRatio) {
        const scaleX = newWidth / originalWidth
        const scaleY = newHeight / originalHeight
        const scale = Math.max(scaleX, scaleY)
        newWidth = originalWidth * scale
        newHeight = originalHeight * scale
        offsetDeltaX = originalWidth - newWidth
      }
      break
      
    case 'ne':
      newWidth = Math.max(minSize, originalWidth + deltaX)
      newHeight = Math.max(minSize, originalHeight - deltaY)
      offsetDeltaY = originalHeight - newHeight
      if (lockAspectRatio) {
        const scaleX = newWidth / originalWidth
        const scaleY = newHeight / originalHeight
        const scale = Math.max(scaleX, scaleY)
        newWidth = originalWidth * scale
        newHeight = originalHeight * scale
        offsetDeltaY = originalHeight - newHeight
      }
      break
      
    case 'nw':
      newWidth = Math.max(minSize, originalWidth - deltaX)
      newHeight = Math.max(minSize, originalHeight - deltaY)
      offsetDeltaX = originalWidth - newWidth
      offsetDeltaY = originalHeight - newHeight
      if (lockAspectRatio) {
        const scaleX = newWidth / originalWidth
        const scaleY = newHeight / originalHeight
        const scale = Math.max(scaleX, scaleY)
        newWidth = originalWidth * scale
        newHeight = originalHeight * scale
        offsetDeltaX = originalWidth - newWidth
        offsetDeltaY = originalHeight - newHeight
      }
      break
  }
  
  return {
    width: Math.round(newWidth),
    height: Math.round(newHeight),
    offsetDeltaX: Math.round(offsetDeltaX),
    offsetDeltaY: Math.round(offsetDeltaY)
  }
}

/**
 * 根据视口坐标计算锚点单元格和偏移
 * 用于移动图片后更新锚点
 */
export function calculateAnchorFromPosition(
  viewportX: number,
  viewportY: number,
  viewport: Viewport,
  sizes: SizeAccess,
  config: GeometryConfig,
  totalRows: number,
  totalCols: number
): { anchorRow: number; anchorCol: number; offsetX: number; offsetY: number } {
  const { rowHeaderWidth, colHeaderHeight, defaultRowHeight, defaultColWidth } = config
  
  // 转换为内容区域坐标
  const contentX = viewportX - rowHeaderWidth + viewport.scrollLeft
  const contentY = viewportY - colHeaderHeight + viewport.scrollTop
  
  // 找到锚点单元格
  let anchorCol = 0
  let accX = 0
  for (let c = 0; c < totalCols; c++) {
    const w = sizes.colWidths.get(c) ?? defaultColWidth
    if (accX + w > contentX) {
      anchorCol = c
      break
    }
    accX += w
    anchorCol = c
  }
  
  let anchorRow = 0
  let accY = 0
  for (let r = 0; r < totalRows; r++) {
    const h = sizes.rowHeights.get(r) ?? defaultRowHeight
    if (accY + h > contentY) {
      anchorRow = r
      break
    }
    accY += h
    anchorRow = r
  }
  
  // 计算在锚点单元格内的偏移
  const cellX = getColLeft(anchorCol, sizes, config)
  const cellY = getRowTop(anchorRow, sizes, config)
  
  const offsetX = contentX - cellX
  const offsetY = contentY - cellY
  
  return { anchorRow, anchorCol, offsetX, offsetY }
}
