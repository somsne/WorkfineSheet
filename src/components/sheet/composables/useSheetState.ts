/**
 * useSheetState - 电子表格状态管理 composable
 * 集中管理所有响应式状态，包括：
 * - 数据模型 (model, formulaSheet, undoRedo)
 * - 视口状态 (viewport, scrollbar)
 * - 选择状态 (selected, selectionRange, dragState)
 * - 编辑状态 (overlay, imeState)
 * - 行列尺寸 (rowHeights, colWidths, hiddenRows, hiddenCols)
 * - UI 状态 (contextMenu, inputDialog, calculationProgress)
 */

import { ref, reactive, computed } from 'vue'
import { SheetModel } from '../../../lib/SheetModel'
import { UndoRedoManager } from '../../../lib/UndoRedoManager'
import { FormulaSheet } from '../../../lib/FormulaSheet'
import { initializeDemoData } from '../../../lib/demoData'
import { parseFormulaReferences } from '../references'

// ==================== 类型定义 ====================

/** 内部剪贴板单元格接口 */
export interface InternalClipboardCell {
  value: string  // 原始值或公式
  isFormula: boolean
}

/** 公式引用高亮显示接口 */
export interface FormulaReference {
  range: string  // 如 "A1" 或 "A1:B3"
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  color: string
}

/** 常量配置 */
export interface SheetConstants {
  ROW_HEIGHT: number
  COL_WIDTH: number
  ROW_HEADER_WIDTH: number
  COL_HEADER_HEIGHT: number
  DEFAULT_ROWS: number
  DEFAULT_COLS: number
  RESIZE_HANDLE_SIZE: number
}

/** 滚动条状态 */
export interface ScrollbarState {
  v: {
    visible: boolean
    trackSize: number
    thumbSize: number
    thumbPos: number
  }
  h: {
    visible: boolean
    trackSize: number
    thumbSize: number
    thumbPos: number
  }
  dragging: '' | 'v' | 'h'
  startMousePos: number
  startScroll: number
}

/** 右键菜单项 */
export interface ContextMenuItem {
  label: string
  action: () => void
  disabled?: boolean
  divider?: boolean
}

/** 右键菜单状态 */
export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  targetRow: number
  targetCol: number
}

/** 输入对话框状态 */
export interface InputDialogState {
  visible: boolean
  title: string
  defaultValue: string
  placeholder: string
  callback: ((value: string) => void) | null
}

// ==================== 默认常量 ====================

export const DEFAULT_CONSTANTS: SheetConstants = {
  ROW_HEIGHT: 26,
  COL_WIDTH: 100,
  ROW_HEADER_WIDTH: 40,
  COL_HEADER_HEIGHT: 26,
  DEFAULT_ROWS: 200,
  DEFAULT_COLS: 50,
  RESIZE_HANDLE_SIZE: 4  // 拖动调整的检测区域（分隔线两侧各2px）
}

/** useSheetState 配置选项 */
export interface SheetStateOptions {
  /** 常量配置 */
  constants?: SheetConstants
  /** 外部传入的 SheetModel（多工作表模式使用） */
  externalModel?: SheetModel
  /** 是否跳过演示数据初始化 */
  skipDemoData?: boolean
}

// ==================== Composable ====================

export function useSheetState(options: SheetStateOptions = {}) {
  const constants = options.constants ?? DEFAULT_CONSTANTS
  
  // ==================== DOM 引用 ====================
  const container = ref<HTMLElement | null>(null)
  const gridCanvas = ref<HTMLCanvasElement | null>(null)
  const contentCanvas = ref<HTMLCanvasElement | null>(null)
  const overlayInput = ref<any>(null)
  const imeProxy = ref<HTMLTextAreaElement | null>(null)
  
  // ==================== 核心数据模型 ====================
  // 如果提供了外部 model，使用外部的；否则创建新的
  const model = options.externalModel ?? new SheetModel()
  const formulaSheet = new FormulaSheet(model, true) // 启用异步计算
  const undoRedo = new UndoRedoManager(100)
  
  // 只有在没有外部 model 且没有跳过演示数据时才初始化演示数据
  if (!options.externalModel && !options.skipDemoData) {
    initializeDemoData(model)
  }
  
  // ==================== 自定义行高和列宽 ====================
  const rowHeights = ref<Map<number, number>>(new Map())
  const colWidths = ref<Map<number, number>>(new Map())
  // 用户手动设置的行高（区分于自动换行调整的行高）
  const manualRowHeights = ref<Set<number>>(new Set())

  // ==================== 隐藏行列状态 ====================
  const hiddenRows = ref<Set<number>>(new Set())
  const hiddenCols = ref<Set<number>>(new Set())
  
  // ==================== 网格线显示开关 ====================
  const showGridLines = ref<boolean>(true)
  
  // ==================== 调整大小状态 ====================
  const resizeState = reactive({
    isResizing: false,
    type: '' as 'row' | 'col' | '',
    index: -1,
    startPos: 0,
    startSize: 0
  })
  
  // ==================== 悬停状态（用于高亮显示可调整的分隔线）====================
  const hoverState = reactive({
    type: '' as 'row' | 'col' | '',
    index: -1
  })
  
  // ==================== 视口状态 ====================
  const viewport = reactive({
    scrollTop: 0,
    scrollLeft: 0
  })
  
  // ==================== 滚动条状态 ====================
  const scrollbar = reactive<ScrollbarState>({
    v: {
      visible: true,
      trackSize: 0,
      thumbSize: 0,
      thumbPos: 0
    },
    h: {
      visible: true,
      trackSize: 0,
      thumbSize: 0,
      thumbPos: 0
    },
    dragging: '',
    startMousePos: 0,
    startScroll: 0
  })
  
  // ==================== 选择状态 ====================
  const selected = reactive({ row: -1, col: -1 })
  
  const selectionRange = reactive({
    startRow: -1,
    startCol: -1,
    endRow: -1,
    endCol: -1
  })
  
  const dragState = reactive({
    isDragging: false,
    startRow: -1,
    startCol: -1,
    currentRow: -1,
    currentCol: -1,
    justFinishedDrag: false  // 标记刚完成拖动，用于阻止 onClick
  })
  
  // ==================== 多选区状态（Ctrl+点击） ====================
  const multiSelection = reactive<{
    ranges: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>
    active: boolean
  }>({
    ranges: [],
    active: false
  })
  
  // ==================== 编辑器覆盖层状态 ====================
  const overlay = reactive({
    visible: false,
    row: 0,
    col: 0,
    top: 0,
    left: 0,
    width: constants.COL_WIDTH,
    height: constants.ROW_HEIGHT,
    value: '',
    mode: 'edit' as 'edit' | 'typing',
    originalValue: ''  // 保存编辑前的原始值，用于 ESC 取消
  })
  
  // ==================== IME 输入状态 ====================
  const imeState = reactive({
    isComposing: false,
    compositionText: '',
    cursorPos: 0
  })
  
  // ==================== 内部剪贴板 ====================
  const internalClipboard = reactive<{
    data: InternalClipboardCell[][] | null
    startRow: number
    startCol: number
    /** 复制时写入系统剪贴板的 TSV 内容（用于比较） */
    tsvContent: string
    /** 复制区域内的合并单元格信息（相对坐标） */
    mergedRegions: Array<{
      startRow: number
      startCol: number
      endRow: number
      endCol: number
    }>
  }>({
    data: null,
    startRow: -1,
    startCol: -1,
    tsvContent: '',
    mergedRegions: []
  })
  const lastCopyTs = ref(0)
  
  // ==================== 蚂蚁线（复制区域高亮） ====================
  /** 复制区域范围（用于绘制蚂蚁线） */
  const copyRange = reactive<{
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    visible: boolean
  }>({
    startRow: -1,
    startCol: -1,
    endRow: -1,
    endCol: -1,
    visible: false
  })
  
  /** 蚂蚁线动画偏移量 */
  const marchingAntsOffset = ref(0)
  
  // ==================== 公式引用高亮 ====================
  const formulaReferences = ref<FormulaReference[]>([])
  
  // 为 RichTextInput 转换 FormulaReference 格式
  const richTextFormulaReferences = computed(() => {
    const refs = formulaReferences.value
    const text = (overlayInput.value as any)?.getCurrentValue?.() || overlay.value
    const result: Array<{ ref: string; color: string; startIndex: number; endIndex: number }> = []
    
    for (const ref of refs) {
      const textUpper = text.toUpperCase()
      const refUpper = ref.range.toUpperCase()
      
      let searchStart = 0
      while (searchStart < text.length) {
        const startIndex = textUpper.indexOf(refUpper, searchStart)
        if (startIndex === -1) break
        
        const endIndex = startIndex + ref.range.length
        result.push({
          ref: ref.range,
          color: ref.color,
          startIndex,
          endIndex
        })
        
        searchStart = endIndex
      }
    }
    
    return result
  })
  
  // ==================== 右键菜单状态 ====================
  const contextMenu = reactive<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
    targetRow: -1,
    targetCol: -1
  })
  
  // ==================== 格式刷状态 ====================
  const formatPainter = reactive<{
    mode: 'off' | 'single' | 'continuous'
    data: import('../formatPainter').FormatPainterData | null
  }>({
    mode: 'off',
    data: null
  })
  
  // ==================== 输入对话框状态 ====================
  const inputDialog = reactive<InputDialogState>({
    visible: false,
    title: '',
    defaultValue: '',
    placeholder: '',
    callback: null
  })
  
  // ==================== 计算进度状态 ====================
  const calculationProgress = reactive({
    visible: false,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  })
  
  // ==================== 公式引用更新 ====================
  let updateReferencesTimer: number | null = null
  
  function updateFormulaReferences() {
    if (updateReferencesTimer !== null) {
      clearTimeout(updateReferencesTimer)
    }
    
    updateReferencesTimer = window.setTimeout(() => {
      console.log('[DEBUG updateFormulaReferences] overlay.visible:', overlay.visible)
      console.log('[DEBUG updateFormulaReferences] overlayInput.value:', !!overlayInput.value)
      if (overlayInput.value) {
        console.log('[DEBUG updateFormulaReferences] formulaMode:', (overlayInput.value as any).formulaMode)
      }
      
      if (overlay.visible && overlayInput.value && (overlayInput.value as any).formulaMode) {
        const currentValue = (overlayInput.value as any).getCurrentValue?.() || overlay.value
        console.log('[DEBUG updateFormulaReferences] currentValue:', currentValue)
        formulaReferences.value = parseFormulaReferences(currentValue)
        console.log('[DEBUG updateFormulaReferences] formulaReferences:', formulaReferences.value)
      } else {
        console.log('[DEBUG updateFormulaReferences] clearing references')
        formulaReferences.value = []
      }
      updateReferencesTimer = null
    }, 100)
  }
  
  // ==================== 快照管理（用于撤销/重做）====================
  function saveRowHeightsSnapshot(): Map<number, number> {
    return new Map(rowHeights.value)
  }
  
  function restoreRowHeights(snapshot: Map<number, number>) {
    rowHeights.value.clear()
    snapshot.forEach((height, row) => {
      rowHeights.value.set(row, height)
    })
  }
  
  function saveColWidthsSnapshot(): Map<number, number> {
    return new Map(colWidths.value)
  }
  
  function restoreColWidths(snapshot: Map<number, number>) {
    colWidths.value.clear()
    snapshot.forEach((width, col) => {
      colWidths.value.set(col, width)
    })
  }
  
  // ==================== 清除选区 ====================
  function clearSelectionRange() {
    selectionRange.startRow = -1
    selectionRange.startCol = -1
    selectionRange.endRow = -1
    selectionRange.endCol = -1
  }
  
  // ==================== 重置拖拽状态 ====================
  function clearDragState() {
    dragState.isDragging = false
    dragState.startRow = -1
    dragState.startCol = -1
    dragState.currentRow = -1
    dragState.currentCol = -1
    dragState.justFinishedDrag = false
  }
  
  return {
    // 常量
    constants,
    
    // DOM 引用
    container,
    gridCanvas,
    contentCanvas,
    overlayInput,
    imeProxy,
    
    // 核心数据模型
    model,
    formulaSheet,
    undoRedo,
    
    // 行高列宽
    rowHeights,
    colWidths,
    manualRowHeights,
    hiddenRows,
    hiddenCols,
    showGridLines,
    
    // 调整大小和悬停
    resizeState,
    hoverState,
    
    // 视口和滚动
    viewport,
    scrollbar,
    
    // 选择状态
    selected,
    selectionRange,
    dragState,
    multiSelection,
    
    // 编辑器
    overlay,
    imeState,
    
    // 剪贴板
    internalClipboard,
    lastCopyTs,
    
    // 蚂蚁线（复制区域高亮）
    copyRange,
    marchingAntsOffset,
    
    // 公式引用
    formulaReferences,
    richTextFormulaReferences,
    updateFormulaReferences,
    
    // UI 状态
    contextMenu,
    formatPainter,
    inputDialog,
    calculationProgress,
    
    // 快照管理
    saveRowHeightsSnapshot,
    restoreRowHeights,
    saveColWidthsSnapshot,
    restoreColWidths,
    
    // 辅助方法
    clearSelectionRange,
    clearDragState
  }
}

export type SheetState = ReturnType<typeof useSheetState>
