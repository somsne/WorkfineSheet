/**
 * 脏区域管理器
 * 
 * 用于跟踪需要重绘的区域，减少不必要的全量渲染。
 * 
 * 工作原理：
 * 1. 当数据/样式变化时，标记受影响的单元格区域为"脏"
 * 2. 渲染时只重绘脏区域，而不是整个画布
 * 3. 滚动等操作仍需全量重绘
 * 
 * 适用场景：
 * - 编辑单个单元格
 * - 修改样式
 * - 粘贴数据到小范围
 * 
 * 不适用场景（自动回退到全量重绘）：
 * - 滚动
 * - 窗口大小变化
 * - 大范围数据变更
 */

/**
 * 矩形区域
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 单元格区域（行列坐标）
 */
export interface CellRegion {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

/**
 * 脏区域类型
 */
export type DirtyType = 
  | 'cell'       // 单元格内容变化
  | 'style'      // 样式变化
  | 'selection'  // 选区变化
  | 'scroll'     // 滚动
  | 'resize'     // 窗口大小变化
  | 'full'       // 强制全量重绘

/**
 * 脏区域条目
 */
interface DirtyEntry {
  type: DirtyType
  region?: CellRegion
  rect?: Rect
}

/**
 * 脏区域阈值配置
 */
export interface DirtyRegionConfig {
  /** 超过此单元格数量时回退到全量重绘 */
  maxDirtyCells: number
  /** 超过此矩形数量时回退到全量重绘 */
  maxDirtyRects: number
  /** 脏区域占可见区域比例超过此值时回退到全量重绘 */
  fullRedrawRatio: number
}

const DEFAULT_CONFIG: DirtyRegionConfig = {
  maxDirtyCells: 100,
  maxDirtyRects: 10,
  fullRedrawRatio: 0.5
}

export class DirtyRegionManager {
  private dirtyEntries: DirtyEntry[] = []
  private forceFullRedraw: boolean = false
  private config: DirtyRegionConfig
  
  constructor(config: Partial<DirtyRegionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * 标记单元格区域为脏
   */
  markCellsDirty(region: CellRegion, type: DirtyType = 'cell'): void {
    // 计算区域大小
    const cellCount = (region.endRow - region.startRow + 1) * (region.endCol - region.startCol + 1)
    
    // 如果区域太大，直接标记为全量重绘
    if (cellCount > this.config.maxDirtyCells) {
      this.markFullRedraw()
      return
    }
    
    this.dirtyEntries.push({ type, region })
    
    // 检查是否超过阈值
    if (this.dirtyEntries.length > this.config.maxDirtyRects) {
      this.markFullRedraw()
    }
  }
  
  /**
   * 标记单个单元格为脏
   */
  markCellDirty(row: number, col: number, type: DirtyType = 'cell'): void {
    this.markCellsDirty({
      startRow: row,
      endRow: row,
      startCol: col,
      endCol: col
    }, type)
  }
  
  /**
   * 标记选区变化
   */
  markSelectionDirty(oldRegion: CellRegion | null, newRegion: CellRegion | null): void {
    if (oldRegion) {
      this.markCellsDirty(oldRegion, 'selection')
    }
    if (newRegion) {
      this.markCellsDirty(newRegion, 'selection')
    }
  }
  
  /**
   * 标记需要全量重绘
   */
  markFullRedraw(): void {
    this.forceFullRedraw = true
    this.dirtyEntries = []
  }
  
  /**
   * 标记滚动（需要全量重绘）
   */
  markScrolled(): void {
    this.markFullRedraw()
  }
  
  /**
   * 标记窗口大小变化（需要全量重绘）
   */
  markResized(): void {
    this.markFullRedraw()
  }
  
  /**
   * 检查是否需要全量重绘
   */
  needsFullRedraw(): boolean {
    return this.forceFullRedraw || this.dirtyEntries.length === 0
  }
  
  /**
   * 检查是否有脏区域
   */
  hasDirtyRegions(): boolean {
    return this.forceFullRedraw || this.dirtyEntries.length > 0
  }
  
  /**
   * 获取所有脏单元格区域
   */
  getDirtyCellRegions(): CellRegion[] {
    if (this.forceFullRedraw) return []
    
    return this.dirtyEntries
      .filter(e => e.region)
      .map(e => e.region!)
  }
  
  /**
   * 获取合并后的脏单元格区域（包围矩形）
   */
  getMergedDirtyCellRegion(): CellRegion | null {
    const regions = this.getDirtyCellRegions()
    if (regions.length === 0) return null
    
    let startRow = Infinity
    let endRow = -Infinity
    let startCol = Infinity
    let endCol = -Infinity
    
    for (const region of regions) {
      startRow = Math.min(startRow, region.startRow)
      endRow = Math.max(endRow, region.endRow)
      startCol = Math.min(startCol, region.startCol)
      endCol = Math.max(endCol, region.endCol)
    }
    
    return { startRow, endRow, startCol, endCol }
  }
  
  /**
   * 将单元格区域转换为像素矩形
   */
  cellRegionToRect(
    region: CellRegion,
    getRowTop: (row: number) => number,
    getColLeft: (col: number) => number,
    getRowHeight: (row: number) => number,
    getColWidth: (col: number) => number,
    viewport: { scrollTop: number; scrollLeft: number },
    headerOffsets: { rowHeaderWidth: number; colHeaderHeight: number }
  ): Rect {
    const x = headerOffsets.rowHeaderWidth + getColLeft(region.startCol) - viewport.scrollLeft
    const y = headerOffsets.colHeaderHeight + getRowTop(region.startRow) - viewport.scrollTop
    
    // 计算区域宽高
    let width = 0
    for (let c = region.startCol; c <= region.endCol; c++) {
      width += getColWidth(c)
    }
    
    let height = 0
    for (let r = region.startRow; r <= region.endRow; r++) {
      height += getRowHeight(r)
    }
    
    return { x, y, width, height }
  }
  
  /**
   * 获取所有脏区域的像素矩形
   */
  getDirtyRects(
    getRowTop: (row: number) => number,
    getColLeft: (col: number) => number,
    getRowHeight: (row: number) => number,
    getColWidth: (col: number) => number,
    viewport: { scrollTop: number; scrollLeft: number },
    headerOffsets: { rowHeaderWidth: number; colHeaderHeight: number }
  ): Rect[] {
    if (this.forceFullRedraw) return []
    
    return this.dirtyEntries
      .filter(e => e.region)
      .map(e => this.cellRegionToRect(
        e.region!,
        getRowTop, getColLeft, getRowHeight, getColWidth,
        viewport, headerOffsets
      ))
  }
  
  /**
   * 清空脏区域
   */
  clear(): void {
    this.dirtyEntries = []
    this.forceFullRedraw = false
  }
  
  /**
   * 获取脏区域数量（用于调试）
   */
  getDirtyCount(): number {
    return this.dirtyEntries.length
  }
  
  /**
   * 检查是否强制全量重绘
   */
  isForceFullRedraw(): boolean {
    return this.forceFullRedraw
  }
}

/**
 * 创建脏区域管理器实例
 */
export function createDirtyRegionManager(config?: Partial<DirtyRegionConfig>): DirtyRegionManager {
  return new DirtyRegionManager(config)
}
