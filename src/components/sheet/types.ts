/**
 * Shared types for WorkfineSheet refactor
 */

import { DEFAULT_FONT_FAMILY } from './defaultFont'

// 选择范围（含拖拽框）
export interface SelectionRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

// 多选区（Ctrl+点击产生的多个不连续选区）
export interface MultiSelectionState {
  /** 所有选中的区域（不包括当前正在选择的区域） */
  ranges: SelectionRange[]
  /** 是否处于多选模式 */
  active: boolean
}

// 单选状态
export interface SelectedCell {
  row: number
  col: number
}

// 拖拽选择状态
export interface DragState {
  isDragging: boolean
  startRow: number
  startCol: number
  currentRow: number
  currentCol: number
  // 刚完成拖拽，用于抑制 click 事件
  justFinishedDrag: boolean
}

// 视口滚动状态
export interface Viewport {
  scrollTop: number
  scrollLeft: number
}

// 自定义滚动条状态
export interface ScrollbarAxisState {
  visible: boolean
  trackSize: number
  thumbSize: number
  thumbPos: number
}

export interface ScrollbarState {
  v: ScrollbarAxisState
  h: ScrollbarAxisState
  dragging: '' | 'v' | 'h'
  startMousePos: number
  startScroll: number
}

// 覆盖层输入状态
export interface OverlayState {
  visible: boolean
  row: number
  col: number
  top: number
  left: number
  width: number
  height: number
  value: string
  mode: 'edit' | 'typing'
  originalValue: string
}

// 公式引用高亮
export interface FormulaReference {
  range: string
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  color: string
}

// 内部剪贴板单元格
export interface InternalClipboardCell {
  value: string
  isFormula: boolean
  style?: CellStyle
  border?: CellBorder
  format?: CellFormat
}

// 工作簿级别剪贴板状态（跨 Sheet 共享）
export interface WorkbookClipboard {
  /** 复制的单元格数据 */
  data: InternalClipboardCell[][] | null
  /** 复制起始行 */
  startRow: number
  /** 复制起始列 */
  startCol: number
  /** 复制区域内的合并单元格信息（相对坐标） */
  mergedRegions: Array<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  }>
  /** 复制时写入系统剪贴板的 TSV 内容（用于比较） */
  tsvContent: string
  /** 复制时间戳 */
  copyTs: number
  /** 复制源 Sheet ID（用于判断蚂蚁线显示） */
  sourceSheetId: string | null
  /** 复制区域范围（用于绘制蚂蚁线） */
  copyRange: {
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  } | null
  /** 是否为剪切操作（true=剪切，false=复制） */
  isCut: boolean
}

// 悬停状态（用于高亮调整分隔线）
export interface HoverState {
  type: '' | 'row' | 'col'
  index: number
}

// 几何配置与尺寸访问
export interface GeometryConfig {
  defaultRowHeight: number
  defaultColWidth: number
  rowHeaderWidth: number
  colHeaderHeight: number
}

export interface SizeAccess {
  rowHeights: Map<number, number>
  colWidths: Map<number, number>
  hiddenRows?: Set<number>
  hiddenCols?: Set<number>
  showGridFlag?: boolean
}

// ==================== 单元格样式 ====================

/**
 * 单元格样式接口
 * 定义单元格的外观属性，包括字体、颜色、对齐等
 */
export interface CellStyle {
  // 字体相关
  fontFamily?: string          // 字体名称，如 'Arial', 'Microsoft YaHei'
  fontSize?: number            // 字号 (px)，范围 9-72
  bold?: boolean               // 粗体
  italic?: boolean             // 斜体
  underline?: boolean | 'single' | 'double'  // 下划线：false | true(单) | 'single' | 'double'
  strikethrough?: boolean      // 删除线
  
  // 颜色相关
  color?: string               // 字体颜色，支持 hex (#000000) 或 rgb (rgb(0,0,0))
  backgroundColor?: string     // 背景色，支持 hex (#FFFFFF) 或 rgb (rgb(255,255,255))
  
  // 对齐相关
  textAlign?: 'left' | 'center' | 'right'           // 水平对齐
  verticalAlign?: 'top' | 'middle' | 'bottom'       // 垂直对齐
  
  // 文本处理
  wrapText?: boolean           // 自动换行
  textRotation?: number        // 文字旋转角度 (0-360 度)
}

/**
 * 默认单元格样式
 */
export const DEFAULT_CELL_STYLE: CellStyle = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 12,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: '#000000',
  backgroundColor: '#FFFFFF',
  textAlign: 'left',
  verticalAlign: 'middle',
  wrapText: false,
  textRotation: 0
}

/**
 * 样式键类型（用于类型安全）
 */
export type StyleKey = keyof CellStyle

/**
 * 样式值类型
 */
export type StyleValue = CellStyle[StyleKey]

// ==================== 单元格边框 ====================

/**
 * 边框线型
 */
export type BorderStyle = 
  | 'none'        // 无边框
  | 'thin'        // 细线 (1px)
  | 'medium'      // 中等线 (2px)
  | 'thick'       // 粗线 (3px)
  | 'dashed'      // 虚线
  | 'dotted'      // 点线
  | 'double'      // 双线

/**
 * 单条边框配置
 */
export interface BorderEdge {
  style: BorderStyle
  color?: string  // 默认 #000000
  width?: number  // 自定义宽度，覆盖 style 预设
}

/**
 * 单元格四边边框
 */
export interface CellBorder {
  top?: BorderEdge
  right?: BorderEdge
  bottom?: BorderEdge
  left?: BorderEdge
}

/**
 * 边框预设配置
 */
export const BORDER_PRESETS = {
  thin: { width: 1, pattern: [] as number[] },
  medium: { width: 2, pattern: [] as number[] },
  thick: { width: 3, pattern: [] as number[] },
  dashed: { width: 1, pattern: [4, 2] },
  dotted: { width: 1, pattern: [1, 1] },
  double: { width: 3, pattern: [] as number[] }
} as const

/**
 * 默认边框样式
 */
export const DEFAULT_BORDER_EDGE: Required<BorderEdge> = {
  style: 'thin',
  color: '#000000',
  width: 1
}

// ==================== 单元格格式 ====================

/**
 * 格式类型枚举
 * 
 * 文本类 (text)
 * - general: 常规（默认）
 * - text: 文本（保留前导零）
 * - idCard: 身份证（中国18位校验）
 * - email: 邮箱
 * - phone: 手机号码（中国格式，支持+86）
 * - telephone: 电话号码（中国本土格式化：区号-号码）
 * - hyperlink: 超链接
 * 
 * 数值类 (number)
 * - number: 整数 1234
 * - decimal2: 两位小数 1234.12
 * - percent: 百分比 12.34%
 * - permille: 千分比 12.34‰
 * - currencyCNY: 人民币 ¥1,234.12
 * - currencyUSD: 美元 $1,234.12
 * - thousands: 千分位 1,234.12
 * - scientific: 科学计数法 1.23E+03
 * - fraction: 分数 1/2
 * - negativeRed: 负数红色显示
 * 
 * 日期时间类 (date) - 32种格式
 * 
 * 自定义 (custom)
 * - Excel 格式字符串，如 "#,##0.00"
 */
export type CellFormatType =
  // 文本类
  | 'general'      // 常规（默认）
  | 'text'         // 文本
  | 'idCard'       // 身份证
  | 'email'        // 邮箱
  | 'phone'        // 手机号码
  | 'telephone'    // 电话号码
  | 'hyperlink'    // 超链接
  // 数值类
  | 'number'       // 整数
  | 'decimal2'     // 两位小数
  | 'percent'      // 百分比
  | 'permille'     // 千分比
  | 'currencyCNY'  // 人民币
  | 'currencyUSD'  // 美元
  | 'thousands'    // 千分位
  | 'scientific'   // 科学计数法
  | 'fraction'     // 分数
  | 'negativeRed'  // 负数红色
  // 日期时间类 - 年份
  | 'date-y'           // 2019
  | 'date-y-cn'        // 2019年
  // 日期时间类 - 年月
  | 'date-ym'          // 2019-1
  | 'date-ym-pad'      // 2019-01
  | 'date-ym-slash'    // 2019/1
  | 'date-ym-slash-pad'// 2019/01
  | 'date-ym-cn'       // 2019年1月
  | 'date-ym-cn-pad'   // 2019年01月
  | 'date-m-cn'        // 1月
  // 日期时间类 - 年月日
  | 'date-ymd'         // 2019-1-1
  | 'date-ymd-pad'     // 2019-01-01
  | 'date-ymd-slash'   // 2019/1/1
  | 'date-ymd-slash-pad' // 2019/01/01
  | 'date-ymd-cn'      // 2019年1月1日
  | 'date-ymd-cn-pad'  // 2019年01月01日
  | 'date-md'          // 1-1
  | 'date-md-pad'      // 01-01
  | 'date-md-slash'    // 1/1
  | 'date-md-slash-pad'// 01/01
  | 'date-md-cn'       // 1月1日
  | 'date-md-cn-pad'   // 01月01日
  // 日期时间类 - 完整日期时间
  | 'datetime'         // 2019-1-1 1:01:01
  | 'datetime-pad'     // 2019-01-01 1:01:01
  | 'datetime-slash'   // 2019/1/1 1:01:01
  | 'datetime-slash-pad' // 2019/01/01 1:01:01
  | 'datetime-cn'      // 2019年1月1日 1时01分01秒
  | 'datetime-cn-pad'  // 2019年01月01日 1时01分01秒
  // 日期时间类 - 时间
  | 'time-hm'          // 1:01
  | 'time-hm-cn'       // 1时01分
  | 'time-hms'         // 1:01:01
  | 'time-hms-cn'      // 1时01分01秒
  // 自定义
  | 'custom'           // Excel 格式字符串

/**
 * 单元格格式接口
 */
export interface CellFormat {
  /** 格式类型 */
  type: CellFormatType
  /** 自定义格式字符串（仅当 type 为 'custom' 时使用） */
  pattern?: string
  /** 小数位数（用于数值类型，覆盖默认值） */
  decimalPlaces?: number
  /** 负数颜色（用于 negativeRed 等格式） */
  negativeColor?: string
}

/**
 * 默认单元格格式
 */
export const DEFAULT_CELL_FORMAT: CellFormat = {
  type: 'general'
}

/**
 * 格式类型到分类的映射
 */
export const FORMAT_CATEGORIES = {
  text: ['general', 'text', 'idCard', 'email', 'phone', 'telephone', 'hyperlink'] as CellFormatType[],
  number: ['number', 'decimal2', 'percent', 'permille', 'currencyCNY', 'currencyUSD', 'thousands', 'scientific', 'fraction', 'negativeRed'] as CellFormatType[],
  date: [
    'date-y', 'date-y-cn',
    'date-ym', 'date-ym-pad', 'date-ym-slash', 'date-ym-slash-pad', 'date-ym-cn', 'date-ym-cn-pad', 'date-m-cn',
    'date-ymd', 'date-ymd-pad', 'date-ymd-slash', 'date-ymd-slash-pad', 'date-ymd-cn', 'date-ymd-cn-pad',
    'date-md', 'date-md-pad', 'date-md-slash', 'date-md-slash-pad', 'date-md-cn', 'date-md-cn-pad',
    'datetime', 'datetime-pad', 'datetime-slash', 'datetime-slash-pad', 'datetime-cn', 'datetime-cn-pad',
    'time-hm', 'time-hm-cn', 'time-hms', 'time-hms-cn'
  ] as CellFormatType[],
  custom: ['custom'] as CellFormatType[]
}

/**
 * 格式选项（用于 UI 下拉菜单）
 */
export const FORMAT_OPTIONS = [
  {
    label: '文本',
    value: 'text-group',
    children: [
      { label: '常规', value: 'general' },
      { label: '文本', value: 'text' },
      { label: '身份证', value: 'idCard' },
      { label: '邮箱', value: 'email' },
      { label: '手机号码', value: 'phone' },
      { label: '电话号码', value: 'telephone' },
      { label: '超链接', value: 'hyperlink' }
    ]
  },
  {
    label: '数值',
    value: 'number-group',
    children: [
      { label: '1234', value: 'number' },
      { label: '1234.12', value: 'decimal2' },
      { label: '1234.12%', value: 'percent' },
      { label: '1234.12‰', value: 'permille' },
      { label: '1,234.12', value: 'thousands' },
      { label: '¥1,234.12', value: 'currencyCNY' },
      { label: '$1,234.12', value: 'currencyUSD' },
      { label: '1.23E+03', value: 'scientific' },
      { label: '1/2', value: 'fraction' },
      { label: '-1234 (红色)', value: 'negativeRed' }
    ]
  },
  {
    label: '日期',
    value: 'date-group',
    children: [
      { label: '2019', value: 'date-y' },
      { label: '2019年', value: 'date-y-cn' },
      { label: '2019-1', value: 'date-ym' },
      { label: '2019-01', value: 'date-ym-pad' },
      { label: '2019/1', value: 'date-ym-slash' },
      { label: '2019/01', value: 'date-ym-slash-pad' },
      { label: '2019年1月', value: 'date-ym-cn' },
      { label: '2019年01月', value: 'date-ym-cn-pad' },
      { label: '1月', value: 'date-m-cn' },
      { label: '2019-1-1', value: 'date-ymd' },
      { label: '2019-01-01', value: 'date-ymd-pad' },
      { label: '2019/1/1', value: 'date-ymd-slash' },
      { label: '2019/01/01', value: 'date-ymd-slash-pad' },
      { label: '2019年1月1日', value: 'date-ymd-cn' },
      { label: '2019年01月01日', value: 'date-ymd-cn-pad' },
      { label: '1-1', value: 'date-md' },
      { label: '01-01', value: 'date-md-pad' },
      { label: '1/1', value: 'date-md-slash' },
      { label: '01/01', value: 'date-md-slash-pad' },
      { label: '1月1日', value: 'date-md-cn' },
      { label: '01月01日', value: 'date-md-cn-pad' },
      { label: '2019-1-1 1:01:01', value: 'datetime' },
      { label: '2019-01-01 1:01:01', value: 'datetime-pad' },
      { label: '2019/1/1 1:01:01', value: 'datetime-slash' },
      { label: '2019/01/01 1:01:01', value: 'datetime-slash-pad' },
      { label: '2019年1月1日 1时01分01秒', value: 'datetime-cn' },
      { label: '2019年01月01日 1时01分01秒', value: 'datetime-cn-pad' },
      { label: '1:01', value: 'time-hm' },
      { label: '1时01分', value: 'time-hm-cn' },
      { label: '1:01:01', value: 'time-hms' },
      { label: '1时01分01秒', value: 'time-hms-cn' }
    ]
  },
  {
    label: '自定义',
    value: 'custom-group',
    children: [
      { label: '自定义格式...', value: 'custom' }
    ]
  }
]

// ==================== 合并单元格 ====================

/**
 * 合并单元格区域
 * 定义一个合并区域的范围，以左上角单元格为主单元格
 */
export interface MergedRegion {
  /** 起始行（主单元格行号，0-based） */
  startRow: number
  /** 起始列（主单元格列号，0-based） */
  startCol: number
  /** 结束行（包含，0-based） */
  endRow: number
  /** 结束列（包含，0-based） */
  endCol: number
}

/**
 * 合并单元格查询结果
 * 用于查询某个单元格的合并状态
 */
export interface MergedCellInfo {
  /** 是否是合并区域的一部分 */
  isMerged: boolean
  /** 是否是主单元格（左上角） */
  isMaster: boolean
  /** 所属的合并区域（如果有） */
  region?: MergedRegion
}

/**
 * 合并单元格的跨度信息
 * 用于渲染时计算单元格的实际尺寸
 */
export interface MergedSpan {
  /** 行跨度（合并了多少行） */
  rowSpan: number
  /** 列跨度（合并了多少列） */
  colSpan: number
}

// ==================== 填充柄（Fill Handle）====================

/**
 * 填充方向
 */
export type FillDirection = 'down' | 'up' | 'right' | 'left' | null

/**
 * 填充柄状态
 */
export interface FillHandleState {
  /** 是否显示填充柄 */
  visible: boolean
  /** 填充柄位置（相对于 canvas） */
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  /** 是否正在拖拽 */
  dragging: boolean
  /** 填充方向 */
  direction: FillDirection
  /** 预览区域（填充目标） */
  previewRange: SelectionRange | null
  /** 源区域（被复制的区域） */
  sourceRange: SelectionRange | null
}

/**
 * 填充柄配置常量
 */
export const FILL_HANDLE_CONFIG = {
  /** 填充柄尺寸（像素） */
  SIZE: 8,
  /** 填充柄颜色 */
  COLOR: '#1a73e8',
  /** 预览边框颜色 */
  PREVIEW_BORDER_COLOR: '#1a73e8',
  /** 预览边框虚线样式 */
  PREVIEW_BORDER_DASH: [3, 3],
  /** 鼠标悬停检测范围（像素） */
  HIT_AREA_PADDING: 5
} as const

/**
 * 序列填充模式
 */
export type FillPatternType = 
  | 'copy'      // 复制填充
  | 'linear'    // 线性序列（等差）
  | 'date'      // 日期序列
  | 'weekday'   // 星期序列
  | 'month'     // 月份序列
  | 'custom'    // 自定义序列

/**
 * 序列模式检测结果
 */
export interface FillPattern {
  type: FillPatternType
  /** 等差步长（用于 linear 类型） */
  step?: number
  /** 自定义序列值（用于 weekday/month 等） */
  values?: string[]
  /** 起始索引（用于循环序列） */
  startIndex?: number
}

/**
 * 填充操作
 */
export interface FillOperation {
  /** 源区域 */
  sourceRange: SelectionRange
  /** 目标区域 */
  targetRange: SelectionRange
  /** 填充方向 */
  direction: FillDirection
  /** 填充模式 */
  pattern: FillPattern
  /** 是否包含样式 */
  includeStyle: boolean
  /** 是否包含格式 */
  includeFormat: boolean
}

/**
 * 填充选项类型
 */
export type FillOptionType = 
  | 'copy'           // 复制单元格
  | 'series'         // 填充序列
  | 'formatsOnly'    // 仅填充格式
  | 'valuesOnly'     // 不带格式填充

/**
 * 填充选项菜单状态
 */
export interface FillOptionsMenuState {
  /** 是否显示 */
  visible: boolean
  /** 菜单位置 X */
  x: number
  /** 菜单位置 Y */
  y: number
  /** 源区域 */
  sourceRange: SelectionRange | null
  /** 目标区域 */
  targetRange: SelectionRange | null
  /** 填充方向 */
  direction: FillDirection
  /** 当前选中的填充类型 */
  selectedType: FillOptionType
}

/**
 * 默认填充选项菜单状态
 */
export const DEFAULT_FILL_OPTIONS_MENU_STATE: FillOptionsMenuState = {
  visible: false,
  x: 0,
  y: 0,
  sourceRange: null,
  targetRange: null,
  direction: null,
  selectedType: 'series'
}

/**
 * 默认填充柄状态
 */
export const DEFAULT_FILL_HANDLE_STATE: FillHandleState = {
  visible: false,
  rect: { x: 0, y: 0, width: FILL_HANDLE_CONFIG.SIZE, height: FILL_HANDLE_CONFIG.SIZE },
  dragging: false,
  direction: null,
  previewRange: null,
  sourceRange: null
}

// ==================== 单元格内嵌图片 ====================

/**
 * 单元格内嵌图片
 * 图片嵌入在单元格内部，跟随单元格大小变化
 * 一个单元格可以有多张图片，但只显示最新的一张
 */
export interface CellImage {
  /** 唯一标识 */
  id: string
  
  /** 图片源 (Data URL、Blob URL 或 远程 URL) */
  src: string
  
  /** 原始图片宽度 */
  naturalWidth: number
  
  /** 原始图片高度 */
  naturalHeight: number
  
  /** 水平对齐 */
  horizontalAlign: CellImageAlignment
  
  /** 垂直对齐 */
  verticalAlign: CellImageVerticalAlign
  
  /** 添加时间戳（用于排序，显示最新的图片） */
  timestamp: number
}

/**
 * 单元格内嵌图片水平对齐方式
 */
export type CellImageAlignment = 'left' | 'center' | 'right'

/**
 * 单元格内嵌图片垂直对齐方式
 */
export type CellImageVerticalAlign = 'top' | 'middle' | 'bottom'

/**
 * 单元格图片配置常量
 */
export const CELL_IMAGE_CONFIG = {
  /** 图片与单元格边界的内边距 */
  PADDING: 2,
  /** 角标大小 */
  BADGE_SIZE: 16,
  /** 角标字体大小 */
  BADGE_FONT_SIZE: 10,
  /** 角标背景颜色 */
  BADGE_BG_COLOR: 'rgba(0, 0, 0, 0.6)',
  /** 角标文字颜色 */
  BADGE_TEXT_COLOR: '#ffffff',
  /** 最小显示尺寸（小于此尺寸不显示图片） */
  MIN_DISPLAY_SIZE: 10
} as const

/**
 * 图片预览状态
 */
export interface ImagePreviewState {
  /** 是否显示预览 */
  visible: boolean
  /** 当前单元格行 */
  row: number
  /** 当前单元格列 */
  col: number
  /** 当前显示的图片索引 */
  currentIndex: number
  /** 图片列表 */
  images: CellImage[]
}

/**
 * 默认图片预览状态
 */
export const DEFAULT_IMAGE_PREVIEW_STATE: ImagePreviewState = {
  visible: false,
  row: -1,
  col: -1,
  currentIndex: 0,
  images: []
}

// ==================== 浮动图片 ====================

/**
 * 浮动图片数据结构
 * 图片锚定在某个单元格上，滚动时跟随单元格移动
 */
export interface FloatingImage {
  /** 唯一标识 */
  id: string
  
  /** 图片源 (Data URL 或 Object URL) */
  src: string
  
  /** 原始图片尺寸 */
  naturalWidth: number
  naturalHeight: number
  
  // ========== 锚点定位 ==========
  /** 锚定单元格行（左上角） */
  anchorRow: number
  /** 锚定单元格列（左上角） */
  anchorCol: number
  /** 锚点内 X 偏移（相对于锚定单元格左上角的像素偏移） */
  offsetX: number
  /** 锚点内 Y 偏移（相对于锚定单元格左上角的像素偏移） */
  offsetY: number
  
  // ========== 尺寸 ==========
  /** 显示宽度 (像素) */
  width: number
  /** 显示高度 (像素) */
  height: number
  /** 是否锁定宽高比 */
  lockAspectRatio: boolean
  
  // ========== 样式 ==========
  /** 旋转角度 (度，0-360) */
  rotation: number
  /** 透明度 (0-1) */
  opacity: number
  /** 边框样式 */
  border?: ImageBorder
  /** 圆角 (像素) */
  borderRadius?: number
  /** 阴影 */
  shadow?: ImageShadow
  
  // ========== 层级 ==========
  /** 层级顺序 (越大越靠上) */
  zIndex: number
  
  // ========== 状态 ==========
  /** 是否锁定（防止编辑） */
  locked: boolean
  /** 是否隐藏 */
  hidden: boolean
}

/**
 * 图片边框样式
 */
export interface ImageBorder {
  width: number
  color: string
  style: 'solid' | 'dashed' | 'dotted'
}

/**
 * 图片阴影样式
 */
export interface ImageShadow {
  offsetX: number
  offsetY: number
  blur: number
  color: string
}

/**
 * 调整大小控制点类型
 */
export type ResizeHandle = 
  | 'nw' | 'n' | 'ne'   // 上排: 左上、上中、右上
  | 'w'  | 'e'          // 中排: 左中、右中
  | 'sw' | 's' | 'se'   // 下排: 左下、下中、右下

/**
 * 图片选择状态
 */
export interface ImageSelectionState {
  /** 选中的图片 ID 列表 */
  selectedIds: string[]
  /** 是否正在拖拽移动 */
  isDragging: boolean
  /** 是否正在调整大小 */
  isResizing: boolean
  /** 调整大小的控制点 */
  resizeHandle: ResizeHandle | null
  /** 拖拽起始位置 */
  dragStart: { x: number; y: number } | null
  /** 原始图片状态（用于撤销） */
  originalState: FloatingImage[] | null
}

/**
 * 默认图片选择状态
 */
export const DEFAULT_IMAGE_SELECTION_STATE: ImageSelectionState = {
  selectedIds: [],
  isDragging: false,
  isResizing: false,
  resizeHandle: null,
  dragStart: null,
  originalState: null
}

/**
 * 图片在视口中的计算位置
 */
export interface ImagePosition {
  /** 视口中的 X 坐标 */
  x: number
  /** 视口中的 Y 坐标 */
  y: number
  /** 显示宽度 */
  width: number
  /** 显示高度 */
  height: number
  /** 是否在可见区域内 */
  visible: boolean
}

/**
 * 图片渲染配置
 */
export interface ImageRenderConfig {
  containerWidth: number
  containerHeight: number
  viewport: Viewport
  geometryConfig: GeometryConfig
  sizes: SizeAccess
  images: FloatingImage[]
  selectedIds: string[]
  isResizing: boolean
  resizeHandle: ResizeHandle | null
}

/**
 * 控制点位置信息
 */
export interface HandlePosition {
  type: ResizeHandle
  x: number
  y: number
}

/**
 * 图片配置常量
 */
export const IMAGE_CONFIG = {
  /** 控制点大小 */
  HANDLE_SIZE: 8,
  /** 控制点边框宽度 */
  HANDLE_BORDER_WIDTH: 1,
  /** 选择框颜色 */
  SELECTION_COLOR: '#1a73e8',
  /** 选择框线宽 */
  SELECTION_LINE_WIDTH: 2,
  /** 控制点填充色 */
  HANDLE_FILL_COLOR: '#ffffff',
  /** 控制点悬停检测范围 */
  HANDLE_HIT_AREA: 10,
  /** 最小图片尺寸 */
  MIN_SIZE: 20,
  /** 默认插入尺寸（最大边） */
  DEFAULT_MAX_SIZE: 400
} as const
