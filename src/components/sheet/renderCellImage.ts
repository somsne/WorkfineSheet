/**
 * Cell embedded image rendering module
 * Renders images inside cells with proper alignment and aspect ratio preservation
 */

import type { CellImage, CellImageAlignment, CellImageVerticalAlign } from './types'
import { CELL_IMAGE_CONFIG } from './types'

/**
 * 图片缓存管理器
 * 使用 LRU 缓存策略，避免重复加载图片
 */
class ImageCache {
  private cache: Map<string, HTMLImageElement> = new Map()
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map()
  private maxSize: number = 100
  
  /**
   * 获取或加载图片
   * @param src 图片源
   * @returns Promise<HTMLImageElement> 或 undefined（如果图片已在缓存中）
   */
  get(src: string): HTMLImageElement | undefined {
    return this.cache.get(src)
  }
  
  /**
   * 异步加载图片
   * @param src 图片源
   * @returns Promise<HTMLImageElement>
   */
  async load(src: string): Promise<HTMLImageElement> {
    // 检查缓存
    const cached = this.cache.get(src)
    if (cached) {
      return cached
    }
    
    // 检查是否正在加载
    const loading = this.loadingPromises.get(src)
    if (loading) {
      return loading
    }
    
    // 创建加载 Promise
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onload = () => {
        // 清理旧缓存
        if (this.cache.size >= this.maxSize) {
          const firstKey = this.cache.keys().next().value
          if (firstKey) this.cache.delete(firstKey)
        }
        
        this.cache.set(src, img)
        this.loadingPromises.delete(src)
        resolve(img)
      }
      
      img.onerror = () => {
        this.loadingPromises.delete(src)
        reject(new Error(`Failed to load image: ${src}`))
      }
      
      img.src = src
    })
    
    this.loadingPromises.set(src, promise)
    return promise
  }
  
  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear()
    this.loadingPromises.clear()
  }
}

// 全局图片缓存实例
export const imageCache = new ImageCache()

/**
 * 计算保持宽高比的图片尺寸
 * @param naturalWidth 图片原始宽度
 * @param naturalHeight 图片原始高度
 * @param maxWidth 最大宽度（单元格宽度减去内边距）
 * @param maxHeight 最大高度（单元格高度减去内边距）
 * @returns 计算后的宽度和高度
 */
export function calculateImageSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: 0, height: 0 }
  }
  
  const aspectRatio = naturalWidth / naturalHeight
  
  let width = naturalWidth
  let height = naturalHeight
  
  // 如果宽度超出，按宽度缩放
  if (width > maxWidth) {
    width = maxWidth
    height = width / aspectRatio
  }
  
  // 如果高度超出，按高度缩放
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }
  
  return { width, height }
}

/**
 * 计算图片在单元格内的位置
 * @param cellX 单元格左上角 X
 * @param cellY 单元格左上角 Y
 * @param cellWidth 单元格宽度
 * @param cellHeight 单元格高度
 * @param imageWidth 图片显示宽度
 * @param imageHeight 图片显示高度
 * @param horizontalAlign 水平对齐
 * @param verticalAlign 垂直对齐
 * @returns 图片绘制位置 { x, y }
 */
export function calculateImagePosition(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  imageWidth: number,
  imageHeight: number,
  horizontalAlign: CellImageAlignment,
  verticalAlign: CellImageVerticalAlign
): { x: number; y: number } {
  const padding = CELL_IMAGE_CONFIG.PADDING
  
  // 计算水平位置
  let x: number
  switch (horizontalAlign) {
    case 'left':
      x = cellX + padding
      break
    case 'center':
      x = cellX + (cellWidth - imageWidth) / 2
      break
    case 'right':
      x = cellX + cellWidth - imageWidth - padding
      break
    default:
      x = cellX + (cellWidth - imageWidth) / 2
  }
  
  // 计算垂直位置
  let y: number
  switch (verticalAlign) {
    case 'top':
      y = cellY + padding
      break
    case 'middle':
      y = cellY + (cellHeight - imageHeight) / 2
      break
    case 'bottom':
      y = cellY + cellHeight - imageHeight - padding
      break
    default:
      y = cellY + (cellHeight - imageHeight) / 2
  }
  
  return { x, y }
}

/**
 * 将单元格的 textAlign 转换为图片的 horizontalAlign
 */
function cellTextAlignToImageAlign(textAlign?: 'left' | 'center' | 'right'): CellImageAlignment {
  switch (textAlign) {
    case 'left': return 'left'
    case 'center': return 'center'
    case 'right': return 'right'
    default: return 'center'
  }
}

/**
 * 将单元格的 verticalAlign 转换为图片的 verticalAlign
 */
function cellVerticalAlignToImageAlign(verticalAlign?: 'top' | 'middle' | 'bottom'): CellImageVerticalAlign {
  switch (verticalAlign) {
    case 'top': return 'top'
    case 'middle': return 'middle'
    case 'bottom': return 'bottom'
    default: return 'middle'
  }
}

/**
 * 渲染单元格内嵌图片
 * @param ctx Canvas 上下文
 * @param image 单元格图片数据
 * @param cellX 单元格左上角 X（视口坐标）
 * @param cellY 单元格左上角 Y（视口坐标）
 * @param cellWidth 单元格宽度
 * @param cellHeight 单元格高度
 * @param imageCount 该单元格的图片总数（用于显示角标）
 * @param rowHeaderWidth 行头宽度（用于裁剪）
 * @param colHeaderHeight 列头高度（用于裁剪）
 * @param cellTextAlign 单元格文本水平对齐（可选，用于继承对齐方式）
 * @param cellVerticalAlign 单元格垂直对齐（可选，用于继承对齐方式）
 * @returns 是否成功渲染
 */
export function renderCellImage(
  ctx: CanvasRenderingContext2D,
  image: CellImage,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  imageCount: number,
  rowHeaderWidth: number,
  colHeaderHeight: number,
  cellTextAlign?: 'left' | 'center' | 'right',
  cellVerticalAlign?: 'top' | 'middle' | 'bottom'
): boolean {
  const padding = CELL_IMAGE_CONFIG.PADDING
  const minSize = CELL_IMAGE_CONFIG.MIN_DISPLAY_SIZE
  
  // 单元格太小，不显示图片
  const availableWidth = cellWidth - padding * 2
  const availableHeight = cellHeight - padding * 2
  if (availableWidth < minSize || availableHeight < minSize) {
    return false
  }
  
  // 从缓存获取图片
  const cachedImage = imageCache.get(image.src)
  if (!cachedImage) {
    // 异步加载图片（渲染会在下次重绘时更新）
    imageCache.load(image.src).catch(() => {
      // 加载失败，静默处理
    })
    return false
  }
  
  // 计算图片显示尺寸（保持宽高比）
  const { width: imageWidth, height: imageHeight } = calculateImageSize(
    image.naturalWidth,
    image.naturalHeight,
    availableWidth,
    availableHeight
  )
  
  if (imageWidth <= 0 || imageHeight <= 0) {
    return false
  }
  
  // 使用单元格样式的对齐方式（优先于图片自身的对齐设置）
  const horizontalAlign = cellTextAlignToImageAlign(cellTextAlign)
  const verticalAlign = cellVerticalAlignToImageAlign(cellVerticalAlign)
  
  // 计算图片位置
  const { x: imageX, y: imageY } = calculateImagePosition(
    cellX,
    cellY,
    cellWidth,
    cellHeight,
    imageWidth,
    imageHeight,
    horizontalAlign,
    verticalAlign
  )
  
  // 保存上下文状态
  ctx.save()
  
  // 创建单元格裁剪区域
  ctx.beginPath()
  ctx.rect(
    Math.max(cellX + 1, rowHeaderWidth),
    Math.max(cellY + 1, colHeaderHeight),
    cellWidth - 2,
    cellHeight - 2
  )
  ctx.clip()
  
  // 绘制图片
  ctx.drawImage(cachedImage, imageX, imageY, imageWidth, imageHeight)
  
  // 如果有多张图片，绘制角标
  if (imageCount > 1) {
    drawImageBadge(ctx, cellX, cellY, cellWidth, imageCount)
  }
  
  ctx.restore()
  
  return true
}

/**
 * 绘制图片数量角标
 * @param ctx Canvas 上下文
 * @param cellX 单元格左上角 X
 * @param cellY 单元格左上角 Y
 * @param cellWidth 单元格宽度
 * @param count 图片数量
 */
function drawImageBadge(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellWidth: number,
  count: number
): void {
  const { BADGE_SIZE, BADGE_FONT_SIZE, BADGE_BG_COLOR, BADGE_TEXT_COLOR } = CELL_IMAGE_CONFIG
  
  // 角标位置（右上角）
  const badgeX = cellX + cellWidth - BADGE_SIZE - 2
  const badgeY = cellY + 2
  
  // 绘制圆角矩形背景
  const radius = 3
  ctx.fillStyle = BADGE_BG_COLOR
  ctx.beginPath()
  ctx.moveTo(badgeX + radius, badgeY)
  ctx.lineTo(badgeX + BADGE_SIZE - radius, badgeY)
  ctx.arcTo(badgeX + BADGE_SIZE, badgeY, badgeX + BADGE_SIZE, badgeY + radius, radius)
  ctx.lineTo(badgeX + BADGE_SIZE, badgeY + BADGE_SIZE - radius)
  ctx.arcTo(badgeX + BADGE_SIZE, badgeY + BADGE_SIZE, badgeX + BADGE_SIZE - radius, badgeY + BADGE_SIZE, radius)
  ctx.lineTo(badgeX + radius, badgeY + BADGE_SIZE)
  ctx.arcTo(badgeX, badgeY + BADGE_SIZE, badgeX, badgeY + BADGE_SIZE - radius, radius)
  ctx.lineTo(badgeX, badgeY + radius)
  ctx.arcTo(badgeX, badgeY, badgeX + radius, badgeY, radius)
  ctx.closePath()
  ctx.fill()
  
  // 绘制数字
  ctx.fillStyle = BADGE_TEXT_COLOR
  ctx.font = `${BADGE_FONT_SIZE}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(count), badgeX + BADGE_SIZE / 2, badgeY + BADGE_SIZE / 2)
}

/**
 * 检测点击是否命中单元格图片
 * @param clickX 点击位置 X（相对于 canvas）
 * @param clickY 点击位置 Y（相对于 canvas）
 * @param image 图片数据
 * @param cellX 单元格左上角 X
 * @param cellY 单元格左上角 Y
 * @param cellWidth 单元格宽度
 * @param cellHeight 单元格高度
 * @param cellTextAlign 单元格水平对齐方式（可选，用于覆盖图片默认对齐）
 * @param cellVerticalAlign 单元格垂直对齐方式（可选，用于覆盖图片默认对齐）
 * @returns 是否命中图片
 */
export function hitTestCellImage(
  clickX: number,
  clickY: number,
  image: CellImage,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  cellTextAlign?: 'left' | 'center' | 'right',
  cellVerticalAlign?: 'top' | 'middle' | 'bottom'
): boolean {
  const padding = CELL_IMAGE_CONFIG.PADDING
  const availableWidth = cellWidth - padding * 2
  const availableHeight = cellHeight - padding * 2
  
  // 计算图片显示尺寸
  const { width: imageWidth, height: imageHeight } = calculateImageSize(
    image.naturalWidth,
    image.naturalHeight,
    availableWidth,
    availableHeight
  )
  
  if (imageWidth <= 0 || imageHeight <= 0) {
    return false
  }
  
  // 根据单元格对齐方式映射水平对齐
  let effectiveHAlign = image.horizontalAlign || 'center'
  if (cellTextAlign) {
    effectiveHAlign = cellTextAlign
  }
  
  // 根据单元格对齐方式映射垂直对齐
  let effectiveVAlign = image.verticalAlign || 'middle'
  if (cellVerticalAlign) {
    effectiveVAlign = cellVerticalAlign
  }
  
  // 计算图片位置
  const { x: imageX, y: imageY } = calculateImagePosition(
    cellX,
    cellY,
    cellWidth,
    cellHeight,
    imageWidth,
    imageHeight,
    effectiveHAlign,
    effectiveVAlign
  )
  
  // 检测点击是否在图片范围内
  return (
    clickX >= imageX &&
    clickX <= imageX + imageWidth &&
    clickY >= imageY &&
    clickY <= imageY + imageHeight
  )
}
