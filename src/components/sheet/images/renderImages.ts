/**
 * 图片渲染模块
 * 负责在 Canvas 上绘制浮动图片
 */

import type {
  FloatingImage,
  ImagePosition,
  ImageRenderConfig,
  Viewport,
  SizeAccess,
  GeometryConfig,
  ResizeHandle
} from '../types'
import { IMAGE_CONFIG } from '../types'
import { calculateImagePosition, isImageVisible, getResizeHandles } from './imageGeometry'
import { ImageLoader } from './imageLoader'

/**
 * 渲染所有浮动图片
 */
export function renderFloatingImages(
  ctx: CanvasRenderingContext2D,
  images: FloatingImage[],
  viewport: Viewport,
  sizes: SizeAccess,
  config: GeometryConfig,
  containerWidth: number,
  containerHeight: number,
  imageLoader: ImageLoader,
  selectedImageId: string | null = null,
  onImageLoaded?: () => void
): void {
  // 按 zIndex 排序，小的先绘制
  const sortedImages = [...images].sort((a, b) => a.zIndex - b.zIndex)
  
  for (const image of sortedImages) {
    const pos = calculateImagePosition(image, viewport, sizes, config)
    
    // 检查是否可见
    if (!isImageVisible(pos, containerWidth, containerHeight, config)) {
      continue
    }
    
    // 获取图片元素
    const imgElement = imageLoader.getImage(image.src)
    if (!imgElement) {
      // 图片未加载完成，触发加载
      imageLoader.loadImage(image.src).then(() => {
        // 加载完成后通知重绘
        onImageLoaded?.()
      }).catch(() => {
        // 加载失败，静默处理
      })
      // 绘制加载占位符
      renderImagePlaceholder(ctx, pos, 'loading')
      continue
    }
    
    // 绘制图片
    renderImage(ctx, imgElement, image, pos)
    
    // 如果是选中状态，绘制选择框
    if (image.id === selectedImageId) {
      renderImageSelection(ctx, pos)
    }
  }
}

/**
 * 渲染单个图片
 */
function renderImage(
  ctx: CanvasRenderingContext2D,
  imgElement: HTMLImageElement,
  image: FloatingImage,
  pos: ImagePosition
): void {
  ctx.save()
  
  // 应用透明度
  if (image.opacity !== undefined && image.opacity < 1) {
    ctx.globalAlpha = image.opacity
  }
  
  // 应用旋转
  if (image.rotation && image.rotation !== 0) {
    const centerX = pos.x + pos.width / 2
    const centerY = pos.y + pos.height / 2
    ctx.translate(centerX, centerY)
    ctx.rotate((image.rotation * Math.PI) / 180)
    ctx.translate(-centerX, -centerY)
  }
  
  // 绘制阴影（如果有）
  if (image.shadow) {
    ctx.shadowColor = image.shadow.color || 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = image.shadow.blur || 5
    ctx.shadowOffsetX = image.shadow.offsetX || 2
    ctx.shadowOffsetY = image.shadow.offsetY || 2
  }
  
  // 绘制图片
  ctx.drawImage(imgElement, pos.x, pos.y, pos.width, pos.height)
  
  // 清除阴影设置（边框不需要阴影）
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  
  // 绘制边框（如果有）
  if (image.border) {
    ctx.strokeStyle = image.border.color || '#000'
    ctx.lineWidth = image.border.width || 1
    ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
  }
  
  ctx.restore()
}

/**
 * 渲染图片占位符（加载中或加载失败）
 */
function renderImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  pos: ImagePosition,
  state: 'loading' | 'error'
): void {
  ctx.save()
  
  // 绘制背景
  ctx.fillStyle = state === 'loading' ? '#f0f0f0' : '#fff0f0'
  ctx.fillRect(pos.x, pos.y, pos.width, pos.height)
  
  // 绘制边框
  ctx.strokeStyle = state === 'loading' ? '#ddd' : '#f00'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
  
  // 绘制图标和文字
  const centerX = pos.x + pos.width / 2
  const centerY = pos.y + pos.height / 2
  
  ctx.fillStyle = state === 'loading' ? '#999' : '#f00'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const text = state === 'loading' ? '加载中...' : '加载失败'
  ctx.fillText(text, centerX, centerY)
  
  ctx.restore()
}

/**
 * 渲染图片选择框和控制点
 */
export function renderImageSelection(
  ctx: CanvasRenderingContext2D,
  pos: ImagePosition
): void {
  ctx.save()
  
  const { SELECTION_COLOR, SELECTION_LINE_WIDTH, HANDLE_SIZE, HANDLE_FILL_COLOR } = IMAGE_CONFIG
  
  // 绘制选择边框
  ctx.strokeStyle = SELECTION_COLOR
  ctx.lineWidth = SELECTION_LINE_WIDTH
  ctx.setLineDash([])
  ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
  
  // 绘制控制点
  const handles = getResizeHandles(pos)
  const halfHandle = HANDLE_SIZE / 2
  
  for (const handle of handles) {
    ctx.fillStyle = HANDLE_FILL_COLOR
    ctx.strokeStyle = SELECTION_COLOR
    ctx.lineWidth = 1
    
    // 绘制圆形控制点
    ctx.beginPath()
    ctx.arc(handle.x, handle.y, halfHandle, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  
  ctx.restore()
}

/**
 * 渲染图片移动时的预览框
 */
export function renderImageMovePreview(
  ctx: CanvasRenderingContext2D,
  pos: ImagePosition
): void {
  ctx.save()
  
  ctx.strokeStyle = IMAGE_CONFIG.SELECTION_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
  
  ctx.restore()
}

/**
 * 渲染图片调整大小时的预览框
 */
export function renderImageResizePreview(
  ctx: CanvasRenderingContext2D,
  pos: ImagePosition,
  originalPos: ImagePosition
): void {
  ctx.save()
  
  // 绘制原始位置（虚线）
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(originalPos.x, originalPos.y, originalPos.width, originalPos.height)
  
  // 绘制新位置（实线）
  ctx.strokeStyle = IMAGE_CONFIG.SELECTION_COLOR
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.strokeRect(pos.x, pos.y, pos.width, pos.height)
  
  // 显示尺寸信息
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  
  const sizeText = `${Math.round(pos.width)} × ${Math.round(pos.height)}`
  const textY = pos.y - 5
  const textX = pos.x + pos.width / 2
  
  // 绘制文字背景
  const textMetrics = ctx.measureText(sizeText)
  const padding = 4
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(
    textX - textMetrics.width / 2 - padding,
    textY - 14 - padding,
    textMetrics.width + padding * 2,
    14 + padding
  )
  
  // 绘制文字
  ctx.fillStyle = '#fff'
  ctx.fillText(sizeText, textX, textY)
  
  ctx.restore()
}

/**
 * 创建渲染配置
 */
export function createImageRenderConfig(
  containerWidth: number,
  containerHeight: number,
  viewport: Viewport,
  geometryConfig: GeometryConfig,
  sizes: SizeAccess,
  images: FloatingImage[],
  selectedIds: string[] = [],
  isResizing: boolean = false,
  resizeHandle: ResizeHandle | null = null
): ImageRenderConfig {
  return {
    containerWidth,
    containerHeight,
    viewport,
    geometryConfig,
    sizes,
    images,
    selectedIds,
    isResizing,
    resizeHandle
  }
}
