/**
 * 图片加载器模块
 * 负责图片的异步加载、缓存管理和资源释放
 */

/**
 * 图片加载结果
 */
export interface LoadedImage {
  element: HTMLImageElement
  naturalWidth: number
  naturalHeight: number
}

/**
 * 图片加载器
 * 使用 LRU 缓存策略管理已加载的图片
 */
export class ImageLoader {
  /** 图片缓存 (src -> HTMLImageElement) */
  private cache: Map<string, HTMLImageElement> = new Map()
  
  /** 正在加载的图片 Promise */
  private loading: Map<string, Promise<HTMLImageElement>> = new Map()
  
  /** 最大缓存数量 */
  private maxCacheSize: number
  
  /** 缓存访问顺序（用于 LRU） */
  private accessOrder: string[] = []
  
  constructor(maxCacheSize: number = 50) {
    this.maxCacheSize = maxCacheSize
  }
  
  /**
   * 加载图片
   * @param src 图片源（Data URL、Object URL 或普通 URL）
   * @returns Promise<LoadedImage>
   */
  async loadImage(src: string): Promise<LoadedImage> {
    // 检查缓存
    const cached = this.cache.get(src)
    if (cached) {
      this.updateAccessOrder(src)
      return {
        element: cached,
        naturalWidth: cached.naturalWidth,
        naturalHeight: cached.naturalHeight
      }
    }
    
    // 检查是否正在加载
    const loadingPromise = this.loading.get(src)
    if (loadingPromise) {
      const img = await loadingPromise
      return {
        element: img,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      }
    }
    
    // 开始加载
    const promise = this.doLoadImage(src)
    this.loading.set(src, promise)
    
    try {
      const img = await promise
      this.loading.delete(src)
      
      // 添加到缓存
      this.addToCache(src, img)
      
      return {
        element: img,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      }
    } catch (error) {
      this.loading.delete(src)
      throw error
    }
  }
  
  /**
   * 从缓存获取已加载的图片（同步方法）
   */
  getImage(src: string): HTMLImageElement | undefined {
    const img = this.cache.get(src)
    if (img) {
      this.updateAccessOrder(src)
    }
    return img
  }
  
  /**
   * 检查图片是否已加载
   */
  isLoaded(src: string): boolean {
    return this.cache.has(src)
  }
  
  /**
   * 预加载图片（不阻塞）
   */
  preload(src: string): void {
    if (!this.cache.has(src) && !this.loading.has(src)) {
      this.loadImage(src).catch(() => {
        // 预加载失败静默处理
      })
    }
  }
  
  /**
   * 释放 Object URL
   */
  static revokeObjectURL(url: string): void {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }
  
  /**
   * 从缓存中移除图片
   */
  removeFromCache(src: string): void {
    this.cache.delete(src)
    const idx = this.accessOrder.indexOf(src)
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1)
    }
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
    this.accessOrder = []
  }
  
  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 实际加载图片
   */
  private doLoadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      // 允许跨域（如果是外部 URL）
      if (!src.startsWith('data:') && !src.startsWith('blob:')) {
        img.crossOrigin = 'anonymous'
      }
      
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 50)}...`))
      
      img.src = src
    })
  }
  
  /**
   * 添加到缓存
   */
  private addToCache(src: string, img: HTMLImageElement): void {
    // 如果缓存已满，移除最早访问的
    while (this.cache.size >= this.maxCacheSize && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()
      if (oldest) {
        this.cache.delete(oldest)
      }
    }
    
    this.cache.set(src, img)
    this.accessOrder.push(src)
  }
  
  /**
   * 更新访问顺序（LRU）
   */
  private updateAccessOrder(src: string): void {
    const idx = this.accessOrder.indexOf(src)
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1)
    }
    this.accessOrder.push(src)
  }
}

/**
 * 计算适合显示的初始尺寸
 * @param naturalWidth 原始宽度
 * @param naturalHeight 原始高度
 * @param maxSize 最大边长
 * @returns 缩放后的尺寸
 */
export function calculateInitialSize(
  naturalWidth: number,
  naturalHeight: number,
  maxSize: number = 400
): { width: number; height: number } {
  if (naturalWidth <= maxSize && naturalHeight <= maxSize) {
    return { width: naturalWidth, height: naturalHeight }
  }
  
  const ratio = naturalWidth / naturalHeight
  
  if (naturalWidth > naturalHeight) {
    return {
      width: maxSize,
      height: Math.round(maxSize / ratio)
    }
  } else {
    return {
      width: Math.round(maxSize * ratio),
      height: maxSize
    }
  }
}

/**
 * 验证图片文件
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: '不支持的图片格式，请使用 PNG、JPG、GIF、WebP 或 SVG' }
  }
  
  // 检查文件大小（最大 10MB）
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: '图片文件过大，请选择小于 10MB 的图片' }
  }
  
  return { valid: true }
}

/**
 * 从文件创建 Data URL
 */
export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * 从文件创建 Object URL（更节省内存，但需要手动释放）
 */
export function fileToObjectURL(file: File): string {
  return URL.createObjectURL(file)
}
