/**
 * 渲染缓存管理器
 * 
 * 用于缓存已渲染的区块，减少重复渲染开销。
 * 
 * 工作原理：
 * 1. 将画布划分为固定大小的区块（如 10x10 单元格）
 * 2. 每个区块渲染一次后缓存为 ImageData 或 OffscreenCanvas
 * 3. 滚动时复用已缓存的区块，只渲染新进入视口的区块
 * 4. 数据变更时使相关区块缓存失效
 * 
 * 适用场景：
 * - 大数据量表格
 * - 频繁滚动操作
 * - 相对静态的数据（不频繁编辑）
 */

/**
 * 区块坐标
 */
export interface BlockCoord {
  blockRow: number
  blockCol: number
}

/**
 * 区块键
 */
export type BlockKey = string

/**
 * 缓存的区块数据
 */
export interface CachedBlock {
  /** 区块坐标 */
  coord: BlockCoord
  /** 缓存的图像数据 */
  imageData?: ImageData
  /** 或使用 OffscreenCanvas（性能更好） */
  offscreenCanvas?: OffscreenCanvas
  /** 区块在单元格中的范围 */
  cellRange: {
    startRow: number
    endRow: number
    startCol: number
    endCol: number
  }
  /** 缓存创建时间 */
  createdAt: number
  /** 最后访问时间 */
  lastAccessedAt: number
  /** 版本号（用于失效检测） */
  version: number
}

/**
 * 缓存配置
 */
export interface RenderCacheConfig {
  /** 区块行数（单元格） */
  blockRows: number
  /** 区块列数（单元格） */
  blockCols: number
  /** 最大缓存区块数 */
  maxCachedBlocks: number
  /** 缓存过期时间（毫秒），0 表示不过期 */
  cacheExpireMs: number
  /** 是否使用 OffscreenCanvas（如果支持） */
  useOffscreenCanvas: boolean
}

const DEFAULT_CONFIG: RenderCacheConfig = {
  blockRows: 10,
  blockCols: 10,
  maxCachedBlocks: 100,
  cacheExpireMs: 0, // 不自动过期
  useOffscreenCanvas: typeof OffscreenCanvas !== 'undefined'
}

/**
 * 生成区块键
 */
function blockKey(blockRow: number, blockCol: number): BlockKey {
  return `${blockRow},${blockCol}`
}

/**
 * 判断对象是否类似 ImageData（鸭子类型检查）
 * 避免在 Node 测试环境中依赖全局 ImageData 类型
 */
function isImageDataLike(obj: unknown): obj is ImageData {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'data' in obj &&
    'width' in obj &&
    'height' in obj &&
    (obj as ImageData).data instanceof Uint8ClampedArray
  )
}

/**
 * 解析区块键
 */
function parseBlockKey(key: BlockKey): BlockCoord {
  const [blockRow, blockCol] = key.split(',').map(Number)
  return { blockRow: blockRow!, blockCol: blockCol! }
}

export class RenderCacheManager {
  private cache: Map<BlockKey, CachedBlock> = new Map()
  private config: RenderCacheConfig
  private currentVersion: number = 0
  
  // 失效的区块集合（用于批量失效后只重绘必要区块）
  private invalidatedBlocks: Set<BlockKey> = new Set()
  
  constructor(config: Partial<RenderCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * 获取单元格所属的区块坐标
   */
  getCellBlock(row: number, col: number): BlockCoord {
    return {
      blockRow: Math.floor(row / this.config.blockRows),
      blockCol: Math.floor(col / this.config.blockCols)
    }
  }
  
  /**
   * 获取区块的单元格范围
   */
  getBlockCellRange(blockRow: number, blockCol: number): {
    startRow: number
    endRow: number
    startCol: number
    endCol: number
  } {
    return {
      startRow: blockRow * this.config.blockRows,
      endRow: (blockRow + 1) * this.config.blockRows - 1,
      startCol: blockCol * this.config.blockCols,
      endCol: (blockCol + 1) * this.config.blockCols - 1
    }
  }
  
  /**
   * 获取可见区域涉及的所有区块
   */
  getVisibleBlocks(
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
  ): BlockCoord[] {
    const startBlock = this.getCellBlock(startRow, startCol)
    const endBlock = this.getCellBlock(endRow, endCol)
    
    const blocks: BlockCoord[] = []
    for (let br = startBlock.blockRow; br <= endBlock.blockRow; br++) {
      for (let bc = startBlock.blockCol; bc <= endBlock.blockCol; bc++) {
        blocks.push({ blockRow: br, blockCol: bc })
      }
    }
    
    return blocks
  }
  
  /**
   * 获取缓存的区块
   */
  getBlock(blockRow: number, blockCol: number): CachedBlock | null {
    const key = blockKey(blockRow, blockCol)
    const block = this.cache.get(key)
    
    if (!block) return null
    
    // 检查版本
    if (block.version !== this.currentVersion) {
      this.cache.delete(key)
      return null
    }
    
    // 检查过期
    if (this.config.cacheExpireMs > 0) {
      const now = Date.now()
      if (now - block.createdAt > this.config.cacheExpireMs) {
        this.cache.delete(key)
        return null
      }
    }
    
    // 更新访问时间
    block.lastAccessedAt = Date.now()
    
    return block
  }
  
  /**
   * 检查区块是否已缓存且有效
   */
  hasValidCache(blockRow: number, blockCol: number): boolean {
    return this.getBlock(blockRow, blockCol) !== null
  }
  
  /**
   * 缓存区块
   */
  setBlock(
    blockRow: number,
    blockCol: number,
    data: ImageData | OffscreenCanvas
  ): void {
    const key = blockKey(blockRow, blockCol)
    const cellRange = this.getBlockCellRange(blockRow, blockCol)
    const now = Date.now()
    
    const block: CachedBlock = {
      coord: { blockRow, blockCol },
      cellRange,
      createdAt: now,
      lastAccessedAt: now,
      version: this.currentVersion
    }
    
    // 使用鸭子类型检查，避免在 Node 测试环境中依赖 ImageData 全局类型
    if (isImageDataLike(data)) {
      block.imageData = data as ImageData
    } else {
      block.offscreenCanvas = data as OffscreenCanvas
    }
    
    this.cache.set(key, block)
    
    // 清理过多的缓存
    this.evictIfNeeded()
    
    // 从失效集合中移除
    this.invalidatedBlocks.delete(key)
  }
  
  /**
   * 使单元格相关的区块缓存失效
   */
  invalidateCell(row: number, col: number): void {
    const { blockRow, blockCol } = this.getCellBlock(row, col)
    this.invalidateBlock(blockRow, blockCol)
  }
  
  /**
   * 使单元格区域的所有区块缓存失效
   */
  invalidateCellRange(
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
  ): void {
    const blocks = this.getVisibleBlocks(startRow, endRow, startCol, endCol)
    for (const { blockRow, blockCol } of blocks) {
      this.invalidateBlock(blockRow, blockCol)
    }
  }
  
  /**
   * 使指定区块缓存失效
   */
  invalidateBlock(blockRow: number, blockCol: number): void {
    const key = blockKey(blockRow, blockCol)
    this.cache.delete(key)
    this.invalidatedBlocks.add(key)
  }
  
  /**
   * 使所有缓存失效
   */
  invalidateAll(): void {
    // 增加版本号，使所有旧缓存失效
    this.currentVersion++
    this.cache.clear()
    this.invalidatedBlocks.clear()
  }
  
  /**
   * 使行相关的所有区块失效
   */
  invalidateRow(row: number): void {
    const blockRow = Math.floor(row / this.config.blockRows)
    
    // 遍历所有可能的列区块
    for (const [key, block] of this.cache) {
      if (block.coord.blockRow === blockRow) {
        this.cache.delete(key)
        this.invalidatedBlocks.add(key)
      }
    }
  }
  
  /**
   * 使列相关的所有区块失效
   */
  invalidateCol(col: number): void {
    const blockCol = Math.floor(col / this.config.blockCols)
    
    for (const [key, block] of this.cache) {
      if (block.coord.blockCol === blockCol) {
        this.cache.delete(key)
        this.invalidatedBlocks.add(key)
      }
    }
  }
  
  /**
   * 使指定行及其之后的所有区块失效
   * 用于行插入/删除操作
   */
  invalidateRowsFrom(startRow: number): void {
    const startBlockRow = Math.floor(startRow / this.config.blockRows)
    
    for (const [key, block] of this.cache) {
      if (block.coord.blockRow >= startBlockRow) {
        this.cache.delete(key)
        this.invalidatedBlocks.add(key)
      }
    }
  }
  
  /**
   * 使指定列及其之后的所有区块失效
   * 用于列插入/删除操作
   */
  invalidateColsFrom(startCol: number): void {
    const startBlockCol = Math.floor(startCol / this.config.blockCols)
    
    for (const [key, block] of this.cache) {
      if (block.coord.blockCol >= startBlockCol) {
        this.cache.delete(key)
        this.invalidatedBlocks.add(key)
      }
    }
  }
  
  /**
   * 获取失效的区块列表（用于增量重绘）
   */
  getInvalidatedBlocks(): BlockCoord[] {
    return Array.from(this.invalidatedBlocks).map(parseBlockKey)
  }
  
  /**
   * 清除失效区块记录
   */
  clearInvalidatedBlocks(): void {
    this.invalidatedBlocks.clear()
  }
  
  /**
   * 清理过多的缓存（LRU 策略）
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.config.maxCachedBlocks) return
    
    // 按最后访问时间排序，删除最旧的
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt)
    
    const toRemove = entries.slice(0, entries.length - this.config.maxCachedBlocks)
    for (const [key] of toRemove) {
      this.cache.delete(key)
    }
  }
  
  /**
   * 获取缓存统计信息
   */
  getStats(): {
    cachedBlocks: number
    maxBlocks: number
    invalidatedBlocks: number
    version: number
  } {
    return {
      cachedBlocks: this.cache.size,
      maxBlocks: this.config.maxCachedBlocks,
      invalidatedBlocks: this.invalidatedBlocks.size,
      version: this.currentVersion
    }
  }
  
  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.invalidatedBlocks.clear()
  }
  
  /**
   * 创建用于渲染单个区块的离屏画布
   */
  createBlockCanvas(
    blockRow: number,
    blockCol: number,
    getRowHeight: (row: number) => number,
    getColWidth: (col: number) => number
  ): OffscreenCanvas | HTMLCanvasElement {
    const cellRange = this.getBlockCellRange(blockRow, blockCol)
    
    // 计算区块像素尺寸
    let width = 0
    let height = 0
    
    for (let c = cellRange.startCol; c <= cellRange.endCol; c++) {
      width += getColWidth(c)
    }
    for (let r = cellRange.startRow; r <= cellRange.endRow; r++) {
      height += getRowHeight(r)
    }
    
    if (this.config.useOffscreenCanvas && typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height)
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      return canvas
    }
  }
}

/**
 * 创建渲染缓存管理器实例
 */
export function createRenderCacheManager(config?: Partial<RenderCacheConfig>): RenderCacheManager {
  return new RenderCacheManager(config)
}
