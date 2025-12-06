<template>
  <div class="workbook-container">
    <!-- 样式工具栏（Workbook 层级） -->
    <StyleToolbar 
      v-if="canvasSheetApi" 
      :api="canvasSheetApi" 
      :current-selection="currentSelection" 
      :selection-range="selectionRange" 
      :multi-selection="multiSelection" 
      :undo-redo-manager="workbookUndoRedo"
    />
    
    <!-- 公式栏（Workbook 层级） -->
    <FormulaBar
      ref="formulaBarRef"
      :row="formulaBarRow"
      :col="formulaBarCol"
      :end-row="formulaBarEndRow"
      :end-col="formulaBarEndCol"
      :is-editing="formulaBarIsEditing"
      :display-html="formulaBarDisplayHtml"
      :is-formula="formulaEditManager.state.isFormulaMode"
      :source-sheet-name="crossSheetSourceName"
      :cursor-position="formulaEditManager.state.cursorPosition"
      :active-source="formulaEditManager.state.source"
      @keydown="handleFormulaBarKeyDown"
      @value-change="handleFormulaBarValueChange"
      @cursor-change="handleFormulaBarCursorChange"
      @focus="handleFormulaBarFocus"
      @blur="handleFormulaBarBlur"
      @click="handleFormulaBarClick"
    />
    
    <!-- 主表格区域 -->
    <div class="workbook-main" ref="mainRef">
      <!-- 当前活动工作表的 CanvasSheet -->
      <CanvasSheet 
        v-if="activeSheetData" 
        ref="canvasSheetRef"
        :key="activeSheetId"
        :external-model="activeSheetData.model"
        :external-undo-redo="workbookUndoRedo"
        :skip-demo-data="true"
        :initial-view-state="activeSheetData.viewState"
        :clipboard="workbookClipboard"
        :sheet-id="activeSheetId ?? ''"
        :is-in-reference-select-mode="formulaEditManager.state.isInSelectableState"
        :is-cross-sheet-reference-mode="isCrossSheetReferenceMode"
        :external-formula-references="formulaReferencesForCanvas"
        @clipboard-change="handleClipboardChange"
        @clipboard-clear="handleClipboardClear"
        @cut-source-clear="handleCutSourceClear"
        @selection-change="handleSelectionChange"
        @editing-state-change="handleEditingStateChange"
        @open-overlay="handleOpenOverlay"
        @close-overlay="handleCloseOverlay"
        @overlay-position-update="handleOverlayPositionUpdate"
        @reference-select="handleReferenceSelect"
      />
      
      <!-- 全局 CellOverlay（Workbook 层级，不随 Sheet 切换销毁） -->
      <CellOverlay
        ref="globalOverlayRef"
        :visible="shouldShowOverlay"
        :hidden="isOverlayHidden"
        :display-html="globalOverlayDisplayHtml"
        :row="globalOverlay.row"
        :col="globalOverlay.col"
        :top="globalOverlay.top"
        :left="globalOverlay.left"
        :width="globalOverlay.width"
        :height="globalOverlay.height"
        :is-formula="globalOverlayIsFormula"
        :cell-style="globalOverlay.cellStyle"
        :viewport-width="mainRef?.clientWidth ?? 800"
        :is-selectable-state="formulaEditManager.state.isInSelectableState"
        :cursor-position="formulaEditManager.state.cursorPosition"
        :active-source="formulaEditManager.state.source"
        @keydown="handleOverlayKeyDown"
        @value-change="handleOverlayValueChange"
        @cursor-change="handleOverlayCursorChange"
        @focus="handleOverlayFocus"
        @blur="handleOverlayBlur"
        @click="handleOverlayClick"
      />
    </div>
    
    <!-- 底部标签栏 -->
    <SheetTabBar
      :sheets="sheets"
      :active-sheet-id="activeSheetId ?? ''"
      @switch="handleSheetChange"
      @add="handleSheetAdd"
      @remove="handleSheetDelete"
      @rename="handleSheetRename"
      @duplicate="handleSheetDuplicate"
      @move="handleSheetMove"
      @hide="handleSheetHide"
      @unhide="handleSheetUnhide"
      @set-color="handleSheetColorChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Workbook, type WorkbookEventType, type WorkbookEvent, type SheetInfo } from '../lib/Workbook'
import { UndoRedoManager } from '../lib/UndoRedoManager'
import { 
  createFormulaEditStateManager,
  formatCrossSheetReference,
  getCellAddress,
  findReferenceToReplace,
  parseCellReference
} from './sheet/formulaEditState'
import { parseFormulaReferencesWithSheet } from './sheet/references'
import type { WorkbookClipboard } from './sheet/types'
// @ts-ignore
import CanvasSheet from './CanvasSheet.vue'
// @ts-ignore
import SheetTabBar from './SheetTabBar.vue'
// @ts-ignore
import StyleToolbar from './StyleToolbar.vue'
// @ts-ignore
import FormulaBar from './FormulaBar.vue'
// @ts-ignore
import CellOverlay from './CellOverlay.vue'

// ==================== 调试日志 ====================

const DEBUG = false

function log(category: string, message: string, data?: any) {
  if (!DEBUG) return
  const timestamp = new Date().toISOString().slice(11, 23)
  const prefix = `[${timestamp}] [WorkbookSheet:${category}]`
  if (data !== undefined) {
    console.log(prefix, message, data)
  } else {
    console.log(prefix, message)
  }
}

// Props
interface Props {
  /** 初始工作表名称列表 */
  initialSheets?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  initialSheets: () => ['Sheet1']
})

// Emits
const emit = defineEmits<{
  /** 工作表切换事件 */
  (e: 'sheet-change', sheetId: string, sheetName: string): void
  /** 工作表添加事件 */
  (e: 'sheet-add', sheetId: string, sheetName: string): void
  /** 工作表删除事件 */
  (e: 'sheet-delete', sheetId: string, sheetName: string): void
  /** 工作表重命名事件 */
  (e: 'sheet-rename', sheetId: string, oldName: string, newName: string): void
  /** 工作簿加载完成事件 */
  (e: 'loaded'): void
}>()

// ==================== 核心状态 ====================

/** 工作簿实例 */
const workbook = ref(new Workbook())

/** 工作簿级别的撤销/重做管理器（所有 Sheet 共享） */
const workbookUndoRedo = new UndoRedoManager(100)

/** 公式编辑状态管理器（代理层） */
const formulaEditManager = createFormulaEditStateManager()

/** 跨 Sheet 引用模式：跳过下一次选区变化的引用插入（切换 Sheet 后的默认选区恢复） */
const skipNextSelectionReference = ref(false)

/** DOM 引用 */
const mainRef = ref<HTMLElement | null>(null)
const canvasSheetRef = ref<InstanceType<typeof CanvasSheet> | null>(null)
const formulaBarRef = ref<any>(null)

/** 活动工作表 ID */
const activeSheetId = computed(() => workbook.value.getActiveSheetId())

/** 活动工作表数据 */
const activeSheetData = computed(() => workbook.value.getActiveSheet())

/** 所有工作表列表 */
const sheets = computed<SheetInfo[]>(() => workbook.value.getAllSheets())

// ==================== CanvasSheet API 代理 ====================

/** 当前 CanvasSheet 的 API */
const canvasSheetApi = computed(() => {
  if (!canvasSheetRef.value) return null
  return canvasSheetRef.value
})

// ==================== 工具栏/公式栏 状态 ====================

/** 当前选区状态（用于工具栏） */
const currentSelection = ref({ row: 0, col: 0 })
const selectionRange = ref({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })
const multiSelection = ref<{
  ranges: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>
  active: boolean
}>({
  ranges: [],
  active: false
})

/** 公式栏状态 */
const formulaBarRow = ref(0)
const formulaBarCol = ref(0)
const formulaBarEndRow = ref(0)
const formulaBarEndCol = ref(0)
const formulaBarCellValue = ref('')
const formulaBarIsEditing = ref(false)

/** 公式栏 displayHtml（从 FormulaEditManager 获取） */
const formulaBarDisplayHtml = computed(() => {
  if (formulaBarIsEditing.value) {
    return formulaEditManager.displayHtml.value
  }
  // 非编辑状态，显示单元格值
  return formulaBarCellValue.value
})

/** 跨 Sheet 源名称（用于公式栏显示） */
const crossSheetSourceName = computed(() => {
  if (!formulaEditManager.isCrossSheetMode.value) {
    return ''
  }
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  if (!sourceSheetId) return ''
  
  const sheetInfo = workbook.value.getSheetById(sourceSheetId)
  return sheetInfo?.metadata?.name ?? ''
})

// ==================== 全局 CellOverlay 状态 ====================

/** CellOverlay 组件引用 */
const globalOverlayRef = ref<InstanceType<typeof CellOverlay> | null>(null)

/** 全局 Overlay 状态 */
const globalOverlay = ref<{
  visible: boolean
  row: number
  col: number
  top: number
  left: number
  width: number
  height: number
  cellStyle?: import('./sheet/types').CellStyle
}>({
  visible: false,
  row: 0,
  col: 0,
  top: 0,
  left: 0,
  width: 100,
  height: 26,
  cellStyle: undefined
})

/** Overlay displayHtml（从 FormulaEditManager 获取） */
const globalOverlayDisplayHtml = computed(() => {
  return formulaEditManager.displayHtml.value
})

/** Overlay 是否为公式模式 */
const globalOverlayIsFormula = computed(() => {
  return formulaEditManager.state.isFormulaMode
})

/** 是否处于跨 Sheet 引用模式（当前 Sheet 不是源 Sheet） */
const isCrossSheetReferenceMode = computed(() => {
  const active = formulaEditManager.state.active
  const isInSelectableState = formulaEditManager.state.isInSelectableState
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  const currentActiveSheetId = activeSheetId.value
  
  console.log('[isCrossSheetReferenceMode]', {
    active,
    isInSelectableState,
    sourceSheetId,
    currentActiveSheetId,
    result: active && isInSelectableState && currentActiveSheetId !== sourceSheetId
  })
  
  if (!active) return false
  if (!isInSelectableState) return false
  // 当前浏览的 Sheet 不是源 Sheet
  return currentActiveSheetId !== sourceSheetId
})

/** Overlay 是否应该显示（编辑状态时始终存在） */
const shouldShowOverlay = computed(() => {
  return globalOverlay.value.visible && formulaEditManager.state.active
})

/** Overlay 是否视觉隐藏（跨 Sheet 模式时隐藏但保持焦点） */
const isOverlayHidden = computed(() => {
  // 跨 Sheet 模式：只要 sourceSheetId !== currentSheetId 就隐藏
  // 不管是否处于可选择状态
  if (!formulaEditManager.state.active) return false
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  const currentActiveSheetId = activeSheetId.value
  return sourceSheetId !== null && currentActiveSheetId !== sourceSheetId
})

/** 
 * 公式引用列表（用于 Canvas 绘制引用区域边框）
 * 解析公式中的引用，并将 Sheet 名称转换为 sheetId
 */
const formulaReferencesForCanvas = computed(() => {
  if (!formulaEditManager.state.active) return []
  
  const currentValue = formulaEditManager.state.currentValue
  if (!currentValue.startsWith('=')) return []
  
  // 获取源 Sheet 名称（用于标识无前缀的引用）
  const sourceSheetId = formulaEditManager.state.sourceSheetId
  const sourceSheetInfo = sourceSheetId ? workbook.value.getSheetById(sourceSheetId) : null
  const sourceSheetName = sourceSheetInfo?.metadata?.name ?? '__current__'
  
  // 解析公式，按 Sheet 分组
  const referencesMap = parseFormulaReferencesWithSheet(currentValue, sourceSheetName)
  
  // 将 Sheet 名称转换为 sheetId，并合并所有引用
  const result: Array<{
    range: string
    startRow: number
    startCol: number
    endRow: number
    endCol: number
    color: string
    sheetId?: string
  }> = []
  
  for (const [sheetName, refs] of referencesMap) {
    // 查找 Sheet ID
    let sheetId: string | undefined
    if (sheetName === sourceSheetName || sheetName === '__current__') {
      sheetId = sourceSheetId || undefined
    } else {
      // 按名称查找 Sheet
      const sheet = workbook.value.getSheetByName(sheetName)
      sheetId = sheet?.metadata?.id
    }
    
    // 添加引用
    for (const ref of refs) {
      result.push({
        ...ref,
        sheetId
      })
    }
  }
  
  return result
})

/** 
 * 工作簿级别剪贴板状态
 * 直接传递给 CanvasSheet，无需中转同步
 */
const workbookClipboard = ref<WorkbookClipboard | null>(null)

/** 剪贴板变化处理（复制时调用） */
function handleClipboardChange(clipboard: WorkbookClipboard) {
  workbookClipboard.value = clipboard
}

/** 剪贴板清除处理（ESC 取消时调用） */
function handleClipboardClear() {
  workbookClipboard.value = null
}

/** 跨 Sheet 剪切源清除处理（在目标 Sheet 粘贴后清除源 Sheet 内容） */
function handleCutSourceClear(payload: {
  sourceSheetId: string
  startRow: number
  startCol: number
  height: number
  width: number
}) {
  const { sourceSheetId, startRow, startCol, height, width } = payload
  
  // 查找源 Sheet 的数据
  const sourceSheetData = workbook.value.getSheetById(sourceSheetId)
  if (!sourceSheetData) {
    console.warn(`Source sheet ${sourceSheetId} not found for cut operation`)
    return
  }
  
  const model = sourceSheetData.model
  
  // 清除源区域的内容和格式
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const row = startRow + r
      const col = startCol + c
      // 清除值
      model.setValue(row, col, '')
      // 清除样式
      model.clearCellStyle(row, col)
      // 清除边框
      model.clearCellBorder(row, col)
      // 清除格式
      model.clearCellFormat(row, col)
      // 解除合并（如果是合并区域的左上角）
      const merged = model.getMergedRegion(row, col)
      if (merged && merged.startRow === row && merged.startCol === col) {
        model.unmergeCells(row, col)
      }
    }
  }
  
}

// ==================== CanvasSheet 事件处理 ====================

/** 选区变化类型 */
interface SelectionChangePayload {
  selected: { row: number; col: number }
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number }
  multiSelection?: { ranges: any[]; active: boolean }
  cellValue: string
  formulaReferences?: any[]
}

/** 编辑状态变化类型 */
interface EditingStateChangePayload {
  isEditing: boolean
  editingValue: string
  formulaReferences?: any[]
}

/**
 * 处理选区变化事件
 * 核心职责：
 * 1. 更新公式栏显示的位置和值
 * 2. 在公式编辑的可选择状态下，插入单元格引用
 */
function handleSelectionChange(payload: SelectionChangePayload) {
  const { selected, selectionRange, multiSelection, cellValue } = payload
  
  log('selectionChange', '选区变化', {
    selected,
    selectionRange,
    isEditing: formulaEditManager.state.active,
    shouldInsertReference: formulaEditManager.shouldInsertReference.value
  })
  
  // 更新工具栏状态
  currentSelection.value = { row: selected.row, col: selected.col }
  selectionRange.startRow = selectionRange.startRow
  selectionRange.startCol = selectionRange.startCol
  selectionRange.endRow = selectionRange.endRow
  selectionRange.endCol = selectionRange.endCol
  
  if (multiSelection) {
    multiSelection.ranges = multiSelection.ranges
    multiSelection.active = multiSelection.active
  }
  
  // 更新公式栏位置
  formulaBarRow.value = selectionRange.startRow
  formulaBarCol.value = selectionRange.startCol
  formulaBarEndRow.value = selectionRange.endRow
  formulaBarEndCol.value = selectionRange.endCol
  
  // 检查是否应该插入引用（公式编辑模式且光标在可插入位置）
  if (formulaEditManager.shouldInsertReference.value) {
    // 跳过切换 Sheet 后的第一次选区变化（恢复默认选区触发的）
    if (skipNextSelectionReference.value) {
      console.log('[handleSelectionChange] 跳过切换 Sheet 后的默认选区引用插入')
      skipNextSelectionReference.value = false
      return
    }
    
    // 生成引用字符串
    let reference: string
    
    if (formulaEditManager.isCrossSheetMode.value) {
      // 跨 Sheet 引用
      const currentSheetId = formulaEditManager.state.currentSheetId
      const sheetInfo = currentSheetId ? workbook.value.getSheetById(currentSheetId) : null
      const sheetName = sheetInfo?.metadata?.name ?? 'Sheet1'
      
      reference = formatCrossSheetReference(
        sheetName,
        selectionRange.startRow,
        selectionRange.startCol,
        selectionRange.endRow !== selectionRange.startRow || selectionRange.endCol !== selectionRange.startCol
          ? selectionRange.endRow : undefined,
        selectionRange.endRow !== selectionRange.startRow || selectionRange.endCol !== selectionRange.startCol
          ? selectionRange.endCol : undefined
      )
    } else {
      // 同 Sheet 引用
      reference = formatCellReference(
        selectionRange.startRow,
        selectionRange.startCol,
        selectionRange.endRow,
        selectionRange.endCol
      )
    }
    
    // 插入引用
    formulaEditManager.insertReference(reference)
    
    // 进入方向键选择模式（使用选区左上角作为起始位置）
    formulaEditManager.enterArrowSelectMode(
      selectionRange.startRow,
      selectionRange.startCol,
      formulaEditManager.isCrossSheetMode.value ? activeSheetId.value ?? undefined : undefined
    )
    
    // 根据 source 决定焦点位置
    nextTick(() => {
      if (formulaEditManager.state.source === 'formulaBar') {
        formulaBarRef.value?.focus()
      } else {
        globalOverlayRef.value?.focus()
      }
    })
    
    log('selectionChange', '插入引用', { reference, newValue: formulaEditManager.state.currentValue })
    return  // 不更新 formulaBarCellValue，保持公式编辑状态
  }
  
  // 非编辑状态：更新公式栏显示的值
  if (!formulaEditManager.state.active) {
    formulaBarCellValue.value = cellValue
  }
}

/**
 * 处理编辑状态变化事件
 * 当 CanvasSheet 内部的 overlay 状态变化时调用
 */
function handleEditingStateChange(payload: EditingStateChangePayload) {
  const { isEditing, editingValue, formulaReferences } = payload
  
  log('editingStateChange', '编辑状态变化', {
    isEditing,
    editingValue: editingValue.substring(0, 50),
    hasRefs: formulaReferences?.length ?? 0
  })
  
  // 同步到 FormulaEditManager
  if (isEditing && !formulaEditManager.state.active) {
    // CanvasSheet 开始编辑，同步到 Manager
    const sel = canvasSheetRef.value?.getSelection?.() ?? { row: 0, col: 0 }
    formulaEditManager.startEdit({
      sheetId: activeSheetId.value ?? '',
      row: sel.row,
      col: sel.col,
      value: editingValue,
      source: 'cell',
      mode: 'edit'
    })
    formulaBarIsEditing.value = true
  } else if (isEditing && formulaEditManager.state.active) {
    // 编辑中值更新
    formulaEditManager.updateValue(editingValue)
  } else if (!isEditing && formulaEditManager.state.active) {
    // CanvasSheet 结束编辑
    formulaEditManager.reset()
    formulaBarIsEditing.value = false
  }
}

/**
 * 格式化单元格引用（同 Sheet）
 */
function formatCellReference(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): string {
  const startAddr = getCellAddress(startRow, startCol)
  
  if (startRow === endRow && startCol === endCol) {
    return startAddr
  }
  
  const endAddr = getCellAddress(endRow, endCol)
  return `${startAddr}:${endAddr}`
}

// ==================== FormulaBar 事件处理 ====================

/**
 * FormulaBar 键盘事件
 * 与 Overlay 保持一致的行为
 */
function handleFormulaBarKeyDown(event: KeyboardEvent) {
  log('formulaBar', 'keydown', { key: event.key })
  
  // Enter 确认编辑
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    confirmFormulaEdit()
    // 移动到下一行
    const sel = canvasSheetRef.value?.getSelection?.() ?? { row: 0, col: 0 }
    canvasSheetRef.value?.selectRange?.(sel.row + 1, sel.col, sel.row + 1, sel.col)
    // 聚焦回 imeProxy 以便继续输入
    nextTick(() => {
      canvasSheetRef.value?.focusImeProxy?.()
    })
    return
  }
  
  // Escape 取消编辑
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelFormulaEdit()
    // 聚焦回 imeProxy
    nextTick(() => {
      canvasSheetRef.value?.focusImeProxy?.()
    })
    return
  }
  
  // Tab 确认并移动
  if (event.key === 'Tab') {
    event.preventDefault()
    confirmFormulaEdit()
    // 移动到下一个单元格
    const sel = canvasSheetRef.value?.getSelection?.() ?? { row: 0, col: 0 }
    const direction = event.shiftKey ? -1 : 1
    const newCol = sel.col + direction
    if (newCol >= 0) {
      canvasSheetRef.value?.selectRange?.(sel.row, newCol, sel.row, newCol)
    }
    // 聚焦回 imeProxy 以便继续输入
    nextTick(() => {
      canvasSheetRef.value?.focusImeProxy?.()
    })
    return
  }
  
  // 方向键处理（与 Overlay 保持一致）
  const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  if (arrowKeys.includes(event.key)) {
    const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right'
    }
    const direction = directionMap[event.key]!
    
    // 如果方向键调整引用功能被禁用，让方向键移动光标
    if (!formulaEditManager.state.arrowSelectEnabled) {
      console.log('[handleFormulaBarKeyDown] arrowSelectEnabled=false，允许方向键移动光标')
      return
    }
    
    // 情况1: 已经在方向键选择模式，继续移动选择
    if (formulaEditManager.state.arrowSelectMode) {
      event.preventDefault()
      event.stopPropagation()
      
      const newPos = formulaEditManager.arrowMove(direction)
      if (newPos) {
        updateArrowSelectReference(newPos.row, newPos.col)
      }
      return
    }
    
    // 情况2: 公式模式且处于可选择状态，进入方向键选择模式
    if (formulaEditManager.state.isFormulaMode && formulaEditManager.state.isInSelectableState) {
      event.preventDefault()
      event.stopPropagation()
      
      const isCrossSheet = isCrossSheetReferenceMode.value
      
      // 检查是否有现有引用需要替换（以被替换引用的位置为起点）
      const existingRef = findReferenceToReplace(
        formulaEditManager.state.currentValue,
        formulaEditManager.state.cursorPosition
      )
      
      let startRow: number
      let startCol: number
      let hasExistingRef = false
      
      if (existingRef) {
        // 解析现有引用的位置
        const parsed = parseCellReference(existingRef.ref)
        if (parsed) {
          startRow = parsed.startRow
          startCol = parsed.startCol
          hasExistingRef = true
          console.log('[handleFormulaBarKeyDown] 替换现有引用', { existingRef: existingRef.ref, startRow, startCol })
        }
      }
      
      if (!hasExistingRef) {
        // 没有现有引用，确定起始位置
        if (isCrossSheet) {
          // 跨 Sheet：从 A1 开始
          startRow = 0
          startCol = 0
        } else {
          // 同 Sheet：从编辑单元格开始
          startRow = formulaEditManager.state.row
          startCol = formulaEditManager.state.col
        }
      }
      
      // 根据方向计算第一个选择位置
      let row = startRow!
      let col = startCol!
      
      if (hasExistingRef || !isCrossSheet) {
        // 有现有引用或同 Sheet 时，根据方向移动
        switch (direction) {
          case 'up': row = Math.max(0, row - 1); break
          case 'down': row = row + 1; break
          case 'left': col = Math.max(0, col - 1); break
          case 'right': col = col + 1; break
        }
      }
      // 跨 Sheet 且没有现有引用时，第一次就是 A1，不移动
      
      // 进入方向键选择模式并插入引用
      formulaEditManager.enterArrowSelectMode(row, col, activeSheetId.value ?? undefined)
      insertArrowSelectReference(row, col)
      
      // 更新画布选区显示（用于显示引用边框）
      if (!isCrossSheet) {
        canvasSheetRef.value?.selectRange?.(row, col, row, col)
      }
      return
    }
    
    // 情况3: 非选择引用状态（普通文本编辑或公式编辑但光标不在操作符后）
    // FormulaBar 中应该允许方向键移动光标，不要拦截
    // 直接让浏览器处理方向键的默认行为（在 contenteditable 中移动光标）
    console.log('[handleFormulaBarKeyDown] 情况3: 允许方向键移动光标，不退出编辑')
    return
  }
}

/**
 * FormulaBar 值变化（内容和光标位置）
 */
function handleFormulaBarValueChange(payload: { value: string; cursorPosition: number }) {
  console.log('[WorkbookSheet] handleFormulaBarValueChange', payload)
  
  if (!formulaEditManager.state.active) {
    // 开始新编辑
    const sel = canvasSheetRef.value?.getSelection?.() ?? { row: 0, col: 0 }
    formulaEditManager.startEdit({
      sheetId: activeSheetId.value ?? '',
      row: sel.row,
      col: sel.col,
      value: payload.value,
      source: 'formulaBar',
      mode: 'typing'
    })
    formulaBarIsEditing.value = true
    
    // 打开 Overlay 同步显示（但不聚焦）
    openOverlayForCell(sel.row, sel.col)
    return
  }
  
  // 输入字符时退出方向键选择模式
  if (formulaEditManager.state.arrowSelectMode) {
    formulaEditManager.exitArrowSelectMode()
  }
  
  // 直接使用 FormulaBar 提供的完整值和光标位置
  formulaEditManager.updateValue(payload.value, payload.cursorPosition)
}

/**
 * FormulaBar 光标变化（仅位置变化，不含内容变化）
 */
function handleFormulaBarCursorChange(payload: { cursorPosition: number; selection?: { start: number; end: number } }) {
  console.log('[WorkbookSheet] handleFormulaBarCursorChange', payload)
  
  if (!formulaEditManager.state.active) return
  
  // 用户用鼠标调整了光标位置，禁用方向键调整引用功能
  formulaEditManager.disableArrowSelect()
  
  // 更新光标位置
  formulaEditManager.updateCursorPosition(payload.cursorPosition, payload.selection)
}

/**
 * FormulaBar 获得焦点
 */
function handleFormulaBarFocus() {
  log('formulaBar', 'focus')
  if (formulaEditManager.state.active) {
    formulaEditManager.switchSource('formulaBar')
  }
}

/**
 * FormulaBar 失去焦点
 * 与 Overlay 保持一致的逻辑
 */
function handleFormulaBarBlur(event: FocusEvent) {
  log('formulaBar', 'blur')
  
  console.log('[handleFormulaBarBlur]', {
    relatedTarget: event.relatedTarget,
    isInSelectableState: formulaEditManager.state.isInSelectableState,
    isFormulaMode: formulaEditManager.state.isFormulaMode
  })
  
  // 检查焦点是否转移到 Overlay
  const relatedTarget = event.relatedTarget as HTMLElement
  if (relatedTarget && globalOverlayRef.value) {
    const overlayEl = (globalOverlayRef.value as any).$el || globalOverlayRef.value
    if (overlayEl && overlayEl.contains(relatedTarget)) {
      console.log('[handleFormulaBarBlur] 焦点转移到 Overlay，不关闭')
      return
    }
  }
  
  // 在公式可选择状态下，如果点击的是 Sheet 标签区域，不关闭（允许跨 Sheet 选择）
  if (formulaEditManager.state.active && 
      formulaEditManager.state.isFormulaMode && 
      formulaEditManager.state.isInSelectableState) {
    // 检查是否点击了 Sheet 标签区域
    if (relatedTarget) {
      const sheetTabBar = document.querySelector('.sheet-tab-bar')
      if (sheetTabBar && sheetTabBar.contains(relatedTarget)) {
        console.log('[handleFormulaBarBlur] 公式可选择状态，点击 Sheet 标签，不关闭')
        return
      }
    }
    // 在跨 Sheet 引用模式下，点击目标 Sheet 的单元格也不关闭
    if (isCrossSheetReferenceMode.value) {
      console.log('[handleFormulaBarBlur] 跨 Sheet 引用模式，不关闭')
      return
    }
    // 同 Sheet 公式可选择状态，点击单元格选择引用，不关闭
    console.log('[handleFormulaBarBlur] 公式可选择状态，等待引用选择')
    return
  }
  
  // 焦点转移到其他地方，保存并关闭
  if (formulaEditManager.state.active) {
    console.log('[handleFormulaBarBlur] 保存并关闭')
    confirmFormulaEdit()
  }
}

/**
 * FormulaBar 点击
 */
function handleFormulaBarClick() {
  // 禁用方向键调整引用功能（用户点击了输入区域）
  formulaEditManager.disableArrowSelect()
  
  if (!formulaEditManager.state.active) {
    // 开始编辑当前单元格
    const sel = canvasSheetRef.value?.getSelection?.() ?? { row: 0, col: 0 }
    const cellValue = canvasSheetRef.value?.getRawCellValue?.(sel.row, sel.col) ?? ''
    
    formulaEditManager.startEdit({
      sheetId: activeSheetId.value ?? '',
      row: sel.row,
      col: sel.col,
      value: cellValue,
      source: 'formulaBar',
      mode: 'edit'
    })
    formulaBarIsEditing.value = true
    
    // 打开 Overlay 同步显示（但不聚焦）
    openOverlayForCell(sel.row, sel.col)
    
    // 聚焦到公式栏输入区
    nextTick(() => {
      formulaBarRef.value?.focus()
    })
  } else {
    // 已在编辑中，切换焦点到公式栏
    formulaEditManager.switchSource('formulaBar')
  }
}

/**
 * 确认公式编辑
 */
function confirmFormulaEdit() {
  const result = formulaEditManager.confirmEdit()
  if (!result) return
  
  log('formulaEdit', '确认编辑', result)
  
  // 如果是跨 Sheet 模式，需要切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    // 先保存当前 Sheet 状态
    saveCurrentSheetState()
    // 切回源 Sheet
    workbook.value.setActiveSheet(result.sheetId)
    // 等待 Sheet 切换完成后保存值
    nextTick(() => {
      const sheetData = workbook.value.getSheetById(result.sheetId)
      if (sheetData) {
        sheetData.model.setValue(result.row, result.col, result.value)
        canvasSheetRef.value?.redraw?.()
      }
    })
  } else {
    // 同 Sheet，直接保存
    const sheetData = workbook.value.getSheetById(result.sheetId)
    if (sheetData) {
      sheetData.model.setValue(result.row, result.col, result.value)
      canvasSheetRef.value?.redraw?.()
    }
  }
  
  formulaBarIsEditing.value = false
}

/**
 * 取消公式编辑
 */
function cancelFormulaEdit() {
  const result = formulaEditManager.cancelEdit()
  if (!result) return
  
  log('formulaEdit', '取消编辑', result)
  
  // 如果是跨 Sheet 模式，需要切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    // 先保存当前 Sheet 状态
    saveCurrentSheetState()
    // 切回源 Sheet
    workbook.value.setActiveSheet(result.sheetId)
  }
  
  formulaBarIsEditing.value = false
  globalOverlay.value.visible = false
}

// ==================== CellOverlay 事件处理 ====================

/**
 * 打开 Overlay 显示单元格内容（不聚焦，用于 FormulaBar 编辑时同步显示）
 */
function openOverlayForCell(row: number, col: number) {
  const position = canvasSheetRef.value?.getCellPosition?.(row, col)
  if (!position) return
  
  const cellStyle = canvasSheetRef.value?.getCellStyle?.(row, col)
  
  globalOverlay.value = {
    visible: true,
    row,
    col,
    top: position.top,
    left: position.left,
    width: position.width,
    height: position.height,
    cellStyle
  }
}

/**
 * CanvasSheet 请求打开 Overlay
 */
function handleOpenOverlay(payload: {
  sheetId: string
  row: number
  col: number
  value: string
  top: number
  left: number
  width: number
  height: number
  mode: 'edit' | 'typing'
  cellStyle?: import('./sheet/types').CellStyle
}) {
  log('overlay', '打开 Overlay', payload)
  
  // 更新 Overlay 位置和尺寸
  globalOverlay.value = {
    visible: true,
    row: payload.row,
    col: payload.col,
    top: payload.top,
    left: payload.left,
    width: payload.width,
    height: payload.height,
    cellStyle: payload.cellStyle
  }
  
  // 启动编辑状态
  formulaEditManager.startEdit({
    sheetId: payload.sheetId,
    row: payload.row,
    col: payload.col,
    value: payload.value,
    source: 'cell',
    mode: payload.mode
  })
  formulaBarIsEditing.value = true
  
  // 聚焦 Overlay
  nextTick(() => {
    globalOverlayRef.value?.focus()
  })
}

/**
 * CanvasSheet 请求关闭 Overlay
 */
function handleCloseOverlay() {
  log('overlay', '关闭 Overlay')
  globalOverlay.value.visible = false
  
  if (formulaEditManager.state.active) {
    formulaEditManager.reset()
    formulaBarIsEditing.value = false
  }
}

/**
 * 公式引用选择（点击单元格时，在引用选择模式下触发）
 */
function handleReferenceSelect(payload: {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}) {
  log('overlay', '引用选择', payload)
  
  if (!formulaEditManager.state.active) return
  
  // 检查是否是跨 Sheet 引用
  const isCrossSheet = activeSheetId.value !== formulaEditManager.state.sourceSheetId
  
  // 获取当前 Sheet 名称（用于跨 Sheet 引用）
  let sheetName: string | null = null
  if (isCrossSheet && activeSheetId.value) {
    const sheetInfo = workbook.value.getSheetById(activeSheetId.value)
    sheetName = sheetInfo?.metadata?.name ?? null
  }
  
  // 生成引用字符串
  let cellRef: string
  if (payload.startRow === payload.endRow && payload.startCol === payload.endCol) {
    // 单个单元格
    cellRef = getCellAddress(payload.startRow, payload.startCol)
  } else {
    // 区域
    cellRef = `${getCellAddress(payload.startRow, payload.startCol)}:${getCellAddress(payload.endRow, payload.endCol)}`
  }
  
  // 如果是跨 Sheet，添加 Sheet 名称前缀
  let refStr: string
  if (isCrossSheet && sheetName) {
    // 检查 Sheet 名称是否需要引号（包含空格或特殊字符）
    const needsQuotes = /[\s!'"]/.test(sheetName) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(sheetName)
    if (needsQuotes) {
      // 转义内部的单引号
      const escapedName = sheetName.replace(/'/g, "''")
      refStr = `'${escapedName}'!${cellRef}`
    } else {
      refStr = `${sheetName}!${cellRef}`
    }
  } else {
    refStr = cellRef
  }
  
  // 插入引用到当前值
  formulaEditManager.insertReference(refStr)
  
  // 启用方向键调整引用功能（用户点击了 sheet 选择引用）
  formulaEditManager.enableArrowSelect()
  
  // 更新方向键选择位置（以新选择区域的左上角为准）
  formulaEditManager.updateArrowSelectPosition(
    payload.startRow,
    payload.startCol,
    activeSheetId.value ?? undefined
  )
  
  // 根据 source 决定焦点位置
  nextTick(() => {
    if (formulaEditManager.state.source === 'formulaBar') {
      formulaBarRef.value?.focus()
    } else {
      globalOverlayRef.value?.focus()
    }
  })
}

/**
 * Overlay 位置更新（滚动时）
 */
function handleOverlayPositionUpdate(payload: {
  top: number
  left: number
  width: number
  height: number
}) {
  globalOverlay.value.top = payload.top
  globalOverlay.value.left = payload.left
  globalOverlay.value.width = payload.width
  globalOverlay.value.height = payload.height
}

/**
 * Overlay 键盘事件
 */
function handleOverlayKeyDown(event: KeyboardEvent) {
  log('overlay', 'keydown', { key: event.key })
  
  // Enter 确认编辑
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    confirmOverlayEdit()
    // 移动到下一行
    const sel = canvasSheetRef.value?.getSelection?.() ?? { row: 0, col: 0 }
    canvasSheetRef.value?.selectRange?.(sel.row + 1, sel.col, sel.row + 1, sel.col)
    // 聚焦回 imeProxy 以便继续输入
    nextTick(() => {
      canvasSheetRef.value?.focusImeProxy?.()
    })
    return
  }
  
  // Escape 取消编辑
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelOverlayEdit()
    // 聚焦回 imeProxy
    nextTick(() => {
      canvasSheetRef.value?.focusImeProxy?.()
    })
    return
  }
  
  // Tab 确认并移动到下一列
  if (event.key === 'Tab') {
    event.preventDefault()
    confirmOverlayEdit()
    const sel = canvasSheetRef.value?.getSelection?.() ?? { row: 0, col: 0 }
    const direction = event.shiftKey ? -1 : 1
    const newCol = sel.col + direction
    if (newCol >= 0) {
      canvasSheetRef.value?.selectRange?.(sel.row, newCol, sel.row, newCol)
    }
    // 聚焦回 imeProxy 以便继续输入
    nextTick(() => {
      canvasSheetRef.value?.focusImeProxy?.()
    })
    return
  }
  
  // 方向键处理
  const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  if (arrowKeys.includes(event.key)) {
    const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right'
    }
    const direction = directionMap[event.key]!
    
    // 如果方向键调整引用功能被禁用，让方向键移动光标
    if (!formulaEditManager.state.arrowSelectEnabled) {
      console.log('[handleOverlayKeyDown] arrowSelectEnabled=false，允许方向键移动光标')
      return
    }
    
    // 情况1: 已经在方向键选择模式，继续移动选择
    if (formulaEditManager.state.arrowSelectMode) {
      event.preventDefault()
      event.stopPropagation()
      
      const newPos = formulaEditManager.arrowMove(direction)
      if (newPos) {
        updateArrowSelectReference(newPos.row, newPos.col)
      }
      return
    }
    
    // 情况2: 公式模式且处于可选择状态，进入方向键选择模式
    if (formulaEditManager.state.isFormulaMode && formulaEditManager.state.isInSelectableState) {
      event.preventDefault()
      event.stopPropagation()
      
      const isCrossSheet = isCrossSheetReferenceMode.value
      
      // 检查是否有现有引用需要替换（以被替换引用的位置为起点）
      const existingRef = findReferenceToReplace(
        formulaEditManager.state.currentValue,
        formulaEditManager.state.cursorPosition
      )
      
      let startRow: number
      let startCol: number
      let hasExistingRef = false
      
      if (existingRef) {
        // 解析现有引用的位置
        const parsed = parseCellReference(existingRef.ref)
        if (parsed) {
          startRow = parsed.startRow
          startCol = parsed.startCol
          hasExistingRef = true
          console.log('[handleOverlayKeyDown] 替换现有引用', { existingRef: existingRef.ref, startRow, startCol })
        }
      }
      
      if (!hasExistingRef) {
        // 没有现有引用，确定起始位置
        if (isCrossSheet) {
          // 跨 Sheet：从 A1 开始
          startRow = 0
          startCol = 0
        } else {
          // 同 Sheet：从编辑单元格开始
          startRow = formulaEditManager.state.row
          startCol = formulaEditManager.state.col
        }
      }
      
      // 根据方向计算第一个选择位置
      let row = startRow!
      let col = startCol!
      
      if (hasExistingRef || !isCrossSheet) {
        // 有现有引用或同 Sheet 时，根据方向移动
        switch (direction) {
          case 'up': row = Math.max(0, row - 1); break
          case 'down': row = row + 1; break
          case 'left': col = Math.max(0, col - 1); break
          case 'right': col = col + 1; break
        }
      }
      // 跨 Sheet 且没有现有引用时，第一次就是 A1，不移动
      
      // 进入方向键选择模式并插入引用
      formulaEditManager.enterArrowSelectMode(row, col, activeSheetId.value ?? undefined)
      insertArrowSelectReference(row, col)
      
      // 更新画布选区显示（用于显示引用边框）
      if (!isCrossSheet) {
        canvasSheetRef.value?.selectRange?.(row, col, row, col)
      }
      return
    }
    
    // 情况3: 非选择引用状态（普通文本编辑或公式编辑但光标不在操作符后）
    // 公式模式下，方向键应该移动光标，不退出编辑
    if (formulaEditManager.state.isFormulaMode) {
      // 让方向键移动光标（浏览器默认行为）
      console.log('[handleOverlayKeyDown] 情况3a: 公式模式，允许方向键移动光标')
      return
    }
    
    // 普通文本编辑模式下，退出编辑模式，提交内容，然后移动选区
    event.preventDefault()
    event.stopPropagation()
    
    // 如果在跨 Sheet 模式，先切回源 Sheet
    const wasInCrossSheetMode = isCrossSheetReferenceMode.value
    
    // 确认编辑并获取源单元格位置
    const editResult = formulaEditManager.confirmEdit()
    if (editResult) {
      // 保存值
      const sheetData = workbook.value.getSheetById(editResult.sheetId)
      if (sheetData) {
        sheetData.model.setValue(editResult.row, editResult.col, editResult.value)
      }
      
      // 如果是跨 Sheet 模式，切回源 Sheet
      if (wasInCrossSheetMode) {
        skipNextSelectionReference.value = true
        saveCurrentSheetState()
        workbook.value.setActiveSheet(editResult.sheetId)
      }
      
      // 关闭 overlay
      globalOverlay.value.visible = false
      formulaBarIsEditing.value = false
      
      // 根据方向移动选区
      nextTick(() => {
        let newRow = editResult.row
        let newCol = editResult.col
        switch (direction) {
          case 'up': newRow = Math.max(0, newRow - 1); break
          case 'down': newRow = newRow + 1; break
          case 'left': newCol = Math.max(0, newCol - 1); break
          case 'right': newCol = newCol + 1; break
        }
        canvasSheetRef.value?.selectRange?.(newRow, newCol, newRow, newCol)
        canvasSheetRef.value?.focusImeProxy?.()
      })
    }
    return
  }
}

/**
 * 方向键选择模式：插入第一个引用
 */
function insertArrowSelectReference(row: number, col: number) {
  const isCrossSheet = isCrossSheetReferenceMode.value
  let reference: string
  
  if (isCrossSheet) {
    const sheetInfo = activeSheetId.value ? workbook.value.getSheetById(activeSheetId.value) : null
    const sheetName = sheetInfo?.metadata?.name ?? 'Sheet1'
    reference = formatCrossSheetReference(sheetName, row, col)
  } else {
    reference = getCellAddress(row, col)
  }
  
  formulaEditManager.insertReference(reference)
  
  // 保持焦点在 Overlay
  nextTick(() => {
    globalOverlayRef.value?.focus()
  })
}

/**
 * 方向键选择模式：更新引用（替换最后一个引用）
 */
function updateArrowSelectReference(row: number, col: number) {
  const isCrossSheet = formulaEditManager.state.arrowSelectSheetId !== formulaEditManager.state.sourceSheetId
  let reference: string
  
  if (isCrossSheet) {
    const sheetInfo = formulaEditManager.state.arrowSelectSheetId 
      ? workbook.value.getSheetById(formulaEditManager.state.arrowSelectSheetId) 
      : null
    const sheetName = sheetInfo?.metadata?.name ?? 'Sheet1'
    reference = formatCrossSheetReference(sheetName, row, col)
  } else {
    reference = getCellAddress(row, col)
  }
  
  // 使用 insertReference 会自动替换当前位置的引用
  formulaEditManager.insertReference(reference)
  
  // 更新画布选区显示
  if (!isCrossSheet) {
    canvasSheetRef.value?.selectRange?.(row, col, row, col)
  }
  
  // 保持焦点
  nextTick(() => {
    globalOverlayRef.value?.focus()
  })
}

/**
 * Overlay 值变化（内容和光标位置）
 */
function handleOverlayValueChange(payload: { value: string; cursorPosition: number }) {
  console.log('[WorkbookSheet] handleOverlayValueChange', payload)
  
  if (!formulaEditManager.state.active) {
    return
  }
  
  // 输入字符时退出方向键选择模式
  if (formulaEditManager.state.arrowSelectMode) {
    formulaEditManager.exitArrowSelectMode()
  }
  
  // 直接使用 CellOverlay 提供的完整值和光标位置
  formulaEditManager.updateValue(payload.value, payload.cursorPosition)
}

/**
 * Overlay 光标变化（仅位置变化，不含内容变化）
 */
function handleOverlayCursorChange(payload: { cursorPosition: number; selection?: { start: number; end: number } }) {
  console.log('[WorkbookSheet] handleOverlayCursorChange', payload)
  
  if (!formulaEditManager.state.active) return
  
  // 用户用鼠标调整了光标位置，禁用方向键调整引用功能
  formulaEditManager.disableArrowSelect()
  
  // 更新光标位置
  formulaEditManager.updateCursorPosition(payload.cursorPosition, payload.selection)
}

/**
 * Overlay 获得焦点
 */
function handleOverlayFocus() {
  log('overlay', 'focus')
  if (formulaEditManager.state.active) {
    formulaEditManager.switchSource('cell')
  }
}

/**
 * Overlay 被点击（禁用方向键调整引用功能）
 */
function handleOverlayClick() {
  log('overlay', 'click')
  // 禁用方向键调整引用功能（用户点击了输入区域）
  formulaEditManager.disableArrowSelect()
}

/**
 * Overlay 失去焦点
 */
function handleOverlayBlur(event: FocusEvent) {
  log('overlay', 'blur')
  
  console.log('[handleOverlayBlur]', {
    relatedTarget: event.relatedTarget,
    isInSelectableState: formulaEditManager.state.isInSelectableState,
    isFormulaMode: formulaEditManager.state.isFormulaMode
  })
  
  // 检查焦点是否转移到公式栏
  const relatedTarget = event.relatedTarget as HTMLElement
  if (relatedTarget && formulaBarRef.value) {
    // 如果焦点转移到公式栏，不关闭 overlay
    const formulaBarEl = formulaBarRef.value.$el || formulaBarRef.value
    if (formulaBarEl && formulaBarEl.contains(relatedTarget)) {
      console.log('[handleOverlayBlur] 焦点转移到公式栏，不关闭')
      return
    }
  }
  
  // 在公式可选择状态下，如果点击的是 Sheet 标签区域，不关闭（允许跨 Sheet 选择）
  if (formulaEditManager.state.active && 
      formulaEditManager.state.isFormulaMode && 
      formulaEditManager.state.isInSelectableState) {
    // 检查是否点击了 Sheet 标签区域
    if (relatedTarget) {
      const sheetTabBar = document.querySelector('.sheet-tab-bar')
      if (sheetTabBar && sheetTabBar.contains(relatedTarget)) {
        console.log('[handleOverlayBlur] 公式可选择状态，点击 Sheet 标签，不关闭')
        return
      }
    }
    // 在跨 Sheet 引用模式下，点击目标 Sheet 的单元格也不关闭
    if (isCrossSheetReferenceMode.value) {
      console.log('[handleOverlayBlur] 跨 Sheet 引用模式，不关闭')
      return
    }
    // 同 Sheet 公式可选择状态，点击单元格选择引用，不关闭
    console.log('[handleOverlayBlur] 公式可选择状态，等待引用选择')
    return
  }
  
  // 焦点转移到其他地方，保存并关闭
  if (formulaEditManager.state.active) {
    console.log('[handleOverlayBlur] 保存并关闭')
    confirmOverlayEdit()
  }
}

/**
 * 确认 Overlay 编辑
 */
function confirmOverlayEdit() {
  const result = formulaEditManager.confirmEdit()
  if (!result) return
  
  log('overlay', '确认编辑', result)
  
  // 关闭 overlay
  globalOverlay.value.visible = false
  
  // 如果是跨 Sheet 模式，需要切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    // 标记跳过下一次选区引用插入（切换 Sheet 时恢复选区会触发）
    skipNextSelectionReference.value = true
    saveCurrentSheetState()
    workbook.value.setActiveSheet(result.sheetId)
    nextTick(() => {
      const sheetData = workbook.value.getSheetById(result.sheetId)
      if (sheetData) {
        sheetData.model.setValue(result.row, result.col, result.value)
        // 选中编辑的单元格
        canvasSheetRef.value?.selectRange?.(result.row, result.col, result.row, result.col)
        canvasSheetRef.value?.redraw?.()
        // 聚焦回 imeProxy
        canvasSheetRef.value?.focusImeProxy?.()
      }
    })
  } else {
    // 同 Sheet，直接保存
    const sheetData = workbook.value.getSheetById(result.sheetId)
    if (sheetData) {
      sheetData.model.setValue(result.row, result.col, result.value)
      canvasSheetRef.value?.redraw?.()
    }
  }
  
  formulaBarIsEditing.value = false
}

/**
 * 取消 Overlay 编辑
 */
function cancelOverlayEdit() {
  const result = formulaEditManager.cancelEdit()
  if (!result) return
  
  log('overlay', '取消编辑', result)
  
  // 关闭 overlay
  globalOverlay.value.visible = false
  
  // 如果是跨 Sheet 模式，需要切回源 Sheet
  if (result.sheetId !== activeSheetId.value) {
    // 标记跳过下一次选区引用插入（切换 Sheet 时恢复选区会触发）
    skipNextSelectionReference.value = true
    saveCurrentSheetState()
    workbook.value.setActiveSheet(result.sheetId)
    nextTick(() => {
      // 选中原来编辑的单元格
      canvasSheetRef.value?.selectRange?.(result.row, result.col, result.row, result.col)
      canvasSheetRef.value?.redraw?.()
      // 聚焦回 imeProxy
      canvasSheetRef.value?.focusImeProxy?.()
    })
  }
  
  formulaBarIsEditing.value = false
}

// ==================== 初始化 ====================

onMounted(() => {
  initWorkbook()
  setupEventListeners()
  // 在捕获阶段监听键盘事件，以便在 CanvasSheet 处理之前拦截 undo/redo
  document.addEventListener('keydown', handleGlobalKeyDown, true)
  
})

onBeforeUnmount(() => {
  // 清理事件监听器
  cleanupEventListeners()
  document.removeEventListener('keydown', handleGlobalKeyDown, true)
})

/**
 * 全局键盘事件处理（捕获阶段）
 * 拦截所有撤销/重做快捷键，统一在 WorkbookSheet 中处理选区跳转
 */
function handleGlobalKeyDown(e: KeyboardEvent) {
  // 只处理 Ctrl/Cmd + Z (撤销) 和 Ctrl/Cmd + Y / Ctrl/Cmd + Shift + Z (重做)
  const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey
  const isRedo = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
  
  if (!isUndo && !isRedo) return
  
  // 检查是否有可撤销/重做的操作
  const targetSheetId = isUndo 
    ? workbookUndoRedo.peekUndoSheetId() 
    : workbookUndoRedo.peekRedoSheetId()
  
  // 如果没有可撤销/重做的操作，不拦截
  if (!targetSheetId) return
  
  // 拦截所有撤销/重做操作，统一处理选区跳转
  e.preventDefault()
  e.stopPropagation()
  
  if (isUndo) {
    undo()
  } else {
    redo()
  }
}

/** 初始化工作簿 */
function initWorkbook() {
  // 如果有初始工作表配置，清除默认的 Sheet1 并添加配置的工作表
  if (props.initialSheets.length > 0) {
    const defaultSheet = workbook.value.getSheetByName('Sheet1')
    const firstSheetName = props.initialSheets[0]
    
    // 如果第一个初始工作表不是 Sheet1，需要先重命名或删除
    if (firstSheetName && firstSheetName !== 'Sheet1' && defaultSheet) {
      workbook.value.renameSheet(defaultSheet.metadata.id, firstSheetName)
    }
    
    // 添加其余工作表
    for (let i = 1; i < props.initialSheets.length; i++) {
      workbook.value.addSheet(props.initialSheets[i])
    }
  }
  
  emit('loaded')
}

// ==================== 事件处理 ====================

/** 事件处理器引用（用于卸载） */
const eventHandlers: { [K in WorkbookEventType]?: (event: WorkbookEvent) => void } = {}

/** 设置工作簿事件监听 */
function setupEventListeners() {
  eventHandlers.sheetActivated = (event) => {
    emit('sheet-change', event.sheetId, event.sheetName ?? '')
    
    // 恢复跨 Sheet 格式刷状态
    nextTick(() => {
      if (crossSheetFormatPainter.value.mode !== 'off' && canvasSheetRef.value) {
        canvasSheetRef.value.setFormatPainterState?.({
          mode: crossSheetFormatPainter.value.mode,
          data: crossSheetFormatPainter.value.data
        })
      }
    })
  }
  
  eventHandlers.sheetAdded = (event) => {
    emit('sheet-add', event.sheetId, event.sheetName ?? '')
  }
  
  eventHandlers.sheetRemoved = (event) => {
    emit('sheet-delete', event.sheetId, event.sheetName ?? '')
  }
  
  eventHandlers.sheetRenamed = (event) => {
    emit('sheet-rename', event.sheetId, event.oldName ?? '', event.newName ?? '')
  }
  
  // 注册所有事件监听器
  for (const [event, handler] of Object.entries(eventHandlers)) {
    workbook.value.on(event as WorkbookEventType, handler as any)
  }
}

/** 清理事件监听 */
function cleanupEventListeners() {
  for (const [event, handler] of Object.entries(eventHandlers)) {
    workbook.value.off(event as WorkbookEventType, handler as any)
  }
}


// ==================== 标签栏事件处理 ====================

/** 保存当前 Sheet 的视图状态 */
function saveCurrentSheetState() {
  const currentSheetId = workbook.value.getActiveSheetId()
  if (!currentSheetId || !canvasSheetRef.value) return
  
  // 保存视图状态到 Workbook
  const viewState = canvasSheetRef.value.getViewState?.()
  if (viewState) {
    workbook.value.saveSheetViewState(currentSheetId, viewState)
  }
  
  // 保存格式刷状态（跨 Sheet 共享）
  const fpState = canvasSheetRef.value.getFormatPainterState?.()
  if (fpState) {
    if (fpState.mode !== 'off') {
      // 格式刷激活状态，保存到跨 Sheet 状态
      crossSheetFormatPainter.value = {
        mode: fpState.mode,
        data: fpState.data,
        sourceSheetId: currentSheetId
      }
    } else {
      // 格式刷已关闭（可能是 single 模式应用后自动关闭），清除跨 Sheet 状态
      crossSheetFormatPainter.value = {
        mode: 'off',
        data: null,
        sourceSheetId: null
      }
    }
  }
  
  // 剪贴板状态现在由 workbookClipboard 直接管理，无需在这里保存
}

/** 切换工作表 */
function handleSheetChange(sheetId: string) {
  console.log('[handleSheetChange] 开始切换', {
    targetSheetId: sheetId,
    currentSheetId: activeSheetId.value,
    formulaEditActive: formulaEditManager.state.active,
    formulaEditSource: formulaEditManager.state.source,
    isFormulaMode: formulaEditManager.state.isFormulaMode,
    isInSelectableState: formulaEditManager.state.isInSelectableState,
    sourceSheetId: formulaEditManager.state.sourceSheetId,
    currentValue: formulaEditManager.state.currentValue
  })
  
  // 情况1: 正在编辑公式且处于可插入引用状态 → 进入跨 Sheet 引用模式
  if (formulaEditManager.state.active && formulaEditManager.state.isInSelectableState) {
    console.log('[handleSheetChange] 进入跨 Sheet 引用模式')
    
    // 标记跳过下一次选区变化的引用插入（切换 Sheet 时会恢复目标 Sheet 的默认选区）
    skipNextSelectionReference.value = true
    
    // 切换 FormulaEditManager 的当前 Sheet（不结束编辑）
    formulaEditManager.switchSheet(sheetId)
    
    // 保存当前 Sheet 状态（不包括编辑状态，因为还在编辑中）
    saveCurrentSheetState()
    
    // 切换显示的 Sheet
    workbook.value.setActiveSheet(sheetId)
    
    console.log('[handleSheetChange] 跨 Sheet 模式切换完成', {
      newActiveSheetId: activeSheetId.value,
      managerSourceSheetId: formulaEditManager.state.sourceSheetId,
      managerCurrentSheetId: formulaEditManager.state.currentSheetId,
      isCrossSheetReferenceMode: isCrossSheetReferenceMode.value
    })
    return
  }
  
  // 情况2: 正在编辑但不是公式或不在可插入位置 → 保存后切换
  if (formulaEditManager.state.active) {
    console.log('[handleSheetChange] 保存编辑后切换')
    
    const result = formulaEditManager.confirmEdit()
    if (result) {
      // 保存值到源 Sheet
      const sourceSheetData = workbook.value.getSheetById(result.sheetId)
      if (sourceSheetData) {
        sourceSheetData.model.setValue(result.row, result.col, result.value)
      }
    }
    formulaBarIsEditing.value = false
  }
  
  // 情况3: 普通切换
  console.log('[handleSheetChange] 普通切换')
  saveCurrentSheetState()
  workbook.value.setActiveSheet(sheetId)
}

/** 添加工作表 */
function handleSheetAdd(index?: number) {
  const newSheetId = workbook.value.addSheet(undefined, index)
  // 切换到新创建的工作表
  workbook.value.setActiveSheet(newSheetId)
}

/** 重命名工作表 */
function handleSheetRename(sheetId: string, newName: string) {
  try {
    workbook.value.renameSheet(sheetId, newName)
  } catch (error) {
    console.error('重命名失败:', error)
  }
}

/** 删除工作表 */
function handleSheetDelete(sheetId: string) {
  try {
    workbook.value.removeSheet(sheetId)
    // 删除 Sheet 后清空撤销/重做栈，因为相关操作已无效
    workbookUndoRedo.clear()
  } catch (error) {
    console.error('删除失败:', error)
  }
}

/** 复制工作表 */
function handleSheetDuplicate(sheetId: string) {
  workbook.value.duplicateSheet(sheetId)
}

/** 移动工作表 */
function handleSheetMove(sheetId: string, newIndex: number) {
  workbook.value.moveSheet(sheetId, newIndex)
}

/** 隐藏工作表 */
function handleSheetHide(sheetId: string) {
  try {
    workbook.value.setSheetVisibility(sheetId, false)
  } catch (error) {
    console.error('隐藏失败:', error)
  }
}

/** 显示隐藏的工作表 */
function handleSheetUnhide(sheetId: string) {
  workbook.value.setSheetVisibility(sheetId, true)
}

/** 设置工作表颜色 */
function handleSheetColorChange(sheetId: string, color: string | undefined) {
  workbook.value.setSheetColor(sheetId, color)
}

// ==================== 跨工作表操作 ====================

/** 跨工作表格式刷状态（与 CanvasSheet.getFormatPainterState() 兼容） */
const crossSheetFormatPainter = ref<{
  mode: 'off' | 'single' | 'continuous'
  data: any | null
  sourceSheetId: string | null
}>({
  mode: 'off',
  data: null,
  sourceSheetId: null
})

/** 激活跨工作表格式刷（由 CanvasSheet 内部调用 startFormatPainter 触发，这里不需要额外操作） */
function activateCrossSheetFormatPainter() {
  // 格式刷的激活由 CanvasSheet.startFormatPainter() 处理
  // 跨 Sheet 状态会在 saveCurrentSheetState() 中保存
}

/** 应用跨工作表格式（由 CanvasSheet 内部调用 applyFormatPainter 触发，这里不需要额外操作） */
function applyCrossSheetFormat() {
  // 格式的应用由 CanvasSheet.applyFormatPainter() 处理
  // 状态更新会在 saveCurrentSheetState() 中保存
}// ==================== 公开 API ====================

/** 获取工作簿实例 */
function getWorkbook() {
  return workbook.value
}

/** 获取当前活动工作表的 CanvasSheet 引用 */
function getActiveCanvasSheet(): InstanceType<typeof CanvasSheet> | null {
  return canvasSheetRef.value
}

/** 获取指定工作表的数据 */
function getSheetData(sheetId: string) {
  return workbook.value.getSheetById(sheetId)
}

/** 添加工作表 */
function addSheet(name?: string, insertIndex?: number): string {
  return workbook.value.addSheet(name, insertIndex)
}

/** 删除工作表 */
function removeSheet(sheetId: string): boolean {
  const result = workbook.value.removeSheet(sheetId)
  if (result) {
    // 删除 Sheet 后清空撤销/重做栈，因为相关操作已无效
    workbookUndoRedo.clear()
  }
  return result
}

/** 重命名工作表 */
function renameSheet(sheetId: string, newName: string): void {
  workbook.value.renameSheet(sheetId, newName)
}

/** 设置活动工作表 */
function setActiveSheet(sheetId: string): void {
  workbook.value.setActiveSheet(sheetId)
}

/** 获取活动工作表 ID */
function getActiveSheetId(): string | null {
  return workbook.value.getActiveSheetId()
}

/** 获取工作表数量 */
function getSheetCount(): number {
  return workbook.value.getSheetCount()
}

/** 导出工作簿为 JSON */
function toJSON(): object {
  return workbook.value.toJSON()
}

/** 从 JSON 加载工作簿 */
function fromJSON(data: object): void {
  workbook.value = Workbook.fromJSON(data)
  setupEventListeners()
}

/** 获取指定工作表单元格的值（用于跨表引用） */
function getCrossSheetValue(sheetName: string, row: number, col: number): string {
  return workbook.value.getCellValueBySheetName(sheetName, row, col)
}

// ==================== CanvasSheet API 代理 ====================
// 这些方法代理到当前活动工作表的 CanvasSheet，确保操作正确的工作表

/** 获取当前选中的单元格 */
function getSelection() {
  return canvasSheetRef.value?.getSelection?.() ?? { row: -1, col: -1 }
}

/** 设置选中的单元格 */
function setSelection(row: number, col: number) {
  canvasSheetRef.value?.setSelection?.(row, col)
}

/** 获取选择范围 */
function getSelectionRange() {
  return canvasSheetRef.value?.getSelectionRange?.() ?? { startRow: -1, startCol: -1, endRow: -1, endCol: -1 }
}

/** 获取单元格值 */
function getCellValue(row: number, col: number): string {
  return canvasSheetRef.value?.getCellValue?.(row, col) ?? ''
}

/** 设置单元格值 */
function setCellValue(row: number, col: number, value: string) {
  canvasSheetRef.value?.setCellValue?.(row, col, value)
}

/** 获取单元格样式 */
function getCellStyle(row: number, col: number) {
  return canvasSheetRef.value?.getCellStyle?.(row, col) ?? {}
}

/** 设置单元格样式 */
function setCellStyle(row: number, col: number, style: any) {
  canvasSheetRef.value?.setCellStyle?.(row, col, style)
}

/** 清除单元格样式 */
function clearCellStyle(row: number, col: number) {
  canvasSheetRef.value?.clearCellStyle?.(row, col)
}

/** 批量设置范围样式 */
function setRangeStyle(startRow: number, startCol: number, endRow: number, endCol: number, style: any) {
  canvasSheetRef.value?.setRangeStyle?.(startRow, startCol, endRow, endCol, style)
}

// ==================== 样式快捷方法 ====================

/** 设置粗体 */
function setBold(row: number, col: number, bold: boolean) {
  canvasSheetRef.value?.setBold?.(row, col, bold)
}

/** 设置斜体 */
function setItalic(row: number, col: number, italic: boolean) {
  canvasSheetRef.value?.setItalic?.(row, col, italic)
}

/** 设置下划线 */
function setUnderline(row: number, col: number, underline: boolean | 'single' | 'double') {
  canvasSheetRef.value?.setUnderline?.(row, col, underline)
}

/** 设置删除线 */
function setStrikethrough(row: number, col: number, strikethrough: boolean) {
  canvasSheetRef.value?.setStrikethrough?.(row, col, strikethrough)
}

/** 设置字体 */
function setFontFamily(row: number, col: number, fontFamily: string) {
  canvasSheetRef.value?.setFontFamily?.(row, col, fontFamily)
}

/** 设置字号 */
function setFontSize(row: number, col: number, fontSize: number) {
  canvasSheetRef.value?.setFontSize?.(row, col, fontSize)
}

/** 设置字体颜色 */
function setTextColor(row: number, col: number, color: string) {
  canvasSheetRef.value?.setTextColor?.(row, col, color)
}

/** 设置背景色 */
function setBackgroundColor(row: number, col: number, color: string) {
  canvasSheetRef.value?.setBackgroundColor?.(row, col, color)
}

/** 设置水平对齐 */
function setTextAlign(row: number, col: number, align: 'left' | 'center' | 'right') {
  canvasSheetRef.value?.setTextAlign?.(row, col, align)
}

/** 设置垂直对齐 */
function setVerticalAlign(row: number, col: number, align: 'top' | 'middle' | 'bottom') {
  canvasSheetRef.value?.setVerticalAlign?.(row, col, align)
}

/** 设置自动换行 */
function setWrapText(row: number, col: number, wrap: boolean) {
  canvasSheetRef.value?.setWrapText?.(row, col, wrap)
}

/** 设置文字旋转角度 */
function setTextRotation(row: number, col: number, rotation: number) {
  canvasSheetRef.value?.setTextRotation?.(row, col, rotation)
}

/** 获取单元格边框 */
function getCellBorder(row: number, col: number) {
  return canvasSheetRef.value?.getCellBorder?.(row, col)
}

/** 设置单元格边框 */
function setCellBorder(row: number, col: number, border: any) {
  canvasSheetRef.value?.setCellBorder?.(row, col, border)
}

/** 清除单元格边框 */
function clearCellBorder(row: number, col: number) {
  canvasSheetRef.value?.clearCellBorder?.(row, col)
}

/** 设置区域所有边框 */
function setAllBorders(startRow: number, startCol: number, endRow: number, endCol: number, borderStyle: any) {
  canvasSheetRef.value?.setAllBorders?.(startRow, startCol, endRow, endCol, borderStyle)
}

/** 设置区域外边框 */
function setOuterBorder(startRow: number, startCol: number, endRow: number, endCol: number, borderStyle: any) {
  canvasSheetRef.value?.setOuterBorder?.(startRow, startCol, endRow, endCol, borderStyle)
}

/** 清除区域所有边框 */
function clearAllBorders(startRow: number, startCol: number, endRow: number, endCol: number) {
  canvasSheetRef.value?.clearAllBorders?.(startRow, startCol, endRow, endCol)
}

/** 设置范围边框（所有单元格全边框） */
function setRangeBorder(startRow: number, startCol: number, endRow: number, endCol: number, border: any) {
  canvasSheetRef.value?.setRangeBorder?.(startRow, startCol, endRow, endCol, border)
}

/** 设置范围外边框（只设置最外层） */
function setRangeOuterBorder(startRow: number, startCol: number, endRow: number, endCol: number, edge: any) {
  canvasSheetRef.value?.setRangeOuterBorder?.(startRow, startCol, endRow, endCol, edge)
}

/** 清除范围边框 */
function clearRangeBorder(startRow: number, startCol: number, endRow: number, endCol: number) {
  canvasSheetRef.value?.clearRangeBorder?.(startRow, startCol, endRow, endCol)
}

/** 获取单元格格式 */
function getCellFormat(row: number, col: number) {
  return canvasSheetRef.value?.getCellFormat?.(row, col)
}

/** 设置单元格格式 */
function setCellFormat(row: number, col: number, format: any) {
  canvasSheetRef.value?.setCellFormat?.(row, col, format)
}

/** 清除单元格格式 */
function clearCellFormat(row: number, col: number) {
  canvasSheetRef.value?.clearCellFormat?.(row, col)
}

/** 批量设置范围格式 */
function setRangeFormat(startRow: number, startCol: number, endRow: number, endCol: number, format: any) {
  canvasSheetRef.value?.setRangeFormat?.(startRow, startCol, endRow, endCol, format)
}

/** 获取格式化后的显示值 */
function getFormattedValue(row: number, col: number): string {
  return canvasSheetRef.value?.getFormattedValue?.(row, col) ?? ''
}

/** 合并单元格 */
function mergeCells(startRow: number, startCol: number, endRow: number, endCol: number) {
  canvasSheetRef.value?.mergeCells?.(startRow, startCol, endRow, endCol)
}

/** 取消合并单元格 */
function unmergeCells(row: number, col: number) {
  canvasSheetRef.value?.unmergeCells?.(row, col)
}

/** 检查是否可以合并指定范围 */
function canMerge(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
  return canvasSheetRef.value?.canMerge?.(startRow, startCol, endRow, endCol) ?? false
}

/** 获取单元格的合并信息 */
function getMergedCellInfo(row: number, col: number) {
  return canvasSheetRef.value?.getMergedCellInfo?.(row, col) ?? { isMerged: false, isHidden: false }
}

/** 获取包含指定单元格的合并区域 */
function getMergedRegion(row: number, col: number) {
  return canvasSheetRef.value?.getMergedRegion?.(row, col) ?? null
}

/** 获取所有合并区域 */
function getAllMergedRegions() {
  return canvasSheetRef.value?.getAllMergedRegions?.() ?? []
}

/** 检查合并操作是否会丢失数据 */
function hasDataToLose(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
  return canvasSheetRef.value?.hasDataToLose?.(startRow, startCol, endRow, endCol) ?? false
}

/** 合并当前选择范围 */
function mergeSelection(): boolean {
  return canvasSheetRef.value?.mergeSelection?.() ?? false
}

/** 取消当前选择范围内的所有合并 */
function unmergeSelection() {
  canvasSheetRef.value?.unmergeSelection?.()
}

/** 
 * 撤销
 * 自动切换到操作所在的 Sheet 并选中受影响区域
 */
function undo() {
  // 获取即将撤销的操作信息
  const targetSheetId = workbookUndoRedo.peekUndoSheetId()
  
  // 先执行撤销操作（数据层立即生效）
  const action = workbookUndoRedo.undo()
  if (!action) return
  
  // 如果操作在不同 Sheet，切换过去
  if (targetSheetId && targetSheetId !== activeSheetId.value) {
    // 先保存当前 Sheet 状态
    saveCurrentSheetState()
    
    // 在切换之前，更新目标 Sheet 的 viewState（包含选区信息）
    // 这样新挂载的 CanvasSheet 会使用更新后的选区
    if (action.undoSelection) {
      const targetViewState = workbook.value.getSheetViewState(targetSheetId)
      if (targetViewState) {
        workbook.value.saveSheetViewState(targetSheetId, {
          ...targetViewState,
          activeCell: { 
            row: action.undoSelection.startRow, 
            col: action.undoSelection.startCol 
          },
          selectionRange: {
            startRow: action.undoSelection.startRow,
            startCol: action.undoSelection.startCol,
            endRow: action.undoSelection.endRow,
            endCol: action.undoSelection.endCol
          }
        })
      }
    }
    
    // 切换到目标 Sheet
    workbook.value.setActiveSheet(targetSheetId)
  } else {
    // 同一 Sheet，直接选中并重绘
    if (action.undoSelection && canvasSheetRef.value) {
      canvasSheetRef.value.selectRange?.(
        action.undoSelection.startRow,
        action.undoSelection.startCol,
        action.undoSelection.endRow,
        action.undoSelection.endCol
      )
    }
    canvasSheetRef.value?.redraw?.()
  }
}

/** 
 * 重做
 * 自动切换到操作所在的 Sheet 并选中受影响区域
 */
function redo() {
  // 获取即将重做的操作信息
  const targetSheetId = workbookUndoRedo.peekRedoSheetId()
  
  // 先执行重做操作（数据层立即生效）
  const action = workbookUndoRedo.redo()
  if (!action) return
  
  // 如果操作在不同 Sheet，切换过去
  if (targetSheetId && targetSheetId !== activeSheetId.value) {
    // 先保存当前 Sheet 状态
    saveCurrentSheetState()
    
    // 在切换之前，更新目标 Sheet 的 viewState（包含选区信息）
    // 这样新挂载的 CanvasSheet 会使用更新后的选区
    if (action.redoSelection) {
      const targetViewState = workbook.value.getSheetViewState(targetSheetId)
      if (targetViewState) {
        workbook.value.saveSheetViewState(targetSheetId, {
          ...targetViewState,
          activeCell: { 
            row: action.redoSelection.startRow, 
            col: action.redoSelection.startCol 
          },
          selectionRange: {
            startRow: action.redoSelection.startRow,
            startCol: action.redoSelection.startCol,
            endRow: action.redoSelection.endRow,
            endCol: action.redoSelection.endCol
          }
        })
      }
    }
    
    // 切换到目标 Sheet
    workbook.value.setActiveSheet(targetSheetId)
  } else {
    // 同一 Sheet，直接选中并重绘
    if (action.redoSelection && canvasSheetRef.value) {
      canvasSheetRef.value.selectRange?.(
        action.redoSelection.startRow,
        action.redoSelection.startCol,
        action.redoSelection.endRow,
        action.redoSelection.endCol
      )
    }
    canvasSheetRef.value?.redraw?.()
  }
}

/** 检查是否可以撤销 */
function canUndo(): boolean {
  return canvasSheetRef.value?.canUndo?.() ?? false
}

/** 检查是否可以重做 */
function canRedo(): boolean {
  return canvasSheetRef.value?.canRedo?.() ?? false
}

/** 刷新绘制 */
function redraw() {
  canvasSheetRef.value?.redraw?.()
}

/** 隐藏行 */
function hideRow(row: number) {
  canvasSheetRef.value?.hideRow?.(row)
}

/** 取消隐藏行 */
function unhideRow(row: number) {
  canvasSheetRef.value?.unhideRow?.(row)
}

/** 隐藏列 */
function hideColumn(col: number) {
  canvasSheetRef.value?.hideColumn?.(col)
}

/** 取消隐藏列 */
function unhideColumn(col: number) {
  canvasSheetRef.value?.unhideColumn?.(col)
}

/** 在指定行上方插入行 */
function insertRowAbove(row: number) {
  return canvasSheetRef.value?.insertRowAbove?.(row)
}

/** 在指定行下方插入行 */
function insertRowBelow(row: number) {
  return canvasSheetRef.value?.insertRowBelow?.(row)
}

/** 删除指定行 */
function deleteRow(row: number) {
  return canvasSheetRef.value?.deleteRow?.(row)
}

/** 在指定列左侧插入列 */
function insertColLeft(col: number) {
  return canvasSheetRef.value?.insertColLeft?.(col)
}

/** 在指定列右侧插入列 */
function insertColRight(col: number) {
  return canvasSheetRef.value?.insertColRight?.(col)
}

/** 删除指定列 */
function deleteCol(col: number) {
  return canvasSheetRef.value?.deleteCol?.(col)
}

/** 获取行高 */
function getRowHeight(row: number) {
  return canvasSheetRef.value?.getRowHeight?.(row) ?? 26
}

/** 设置行高 */
function setRowHeight(row: number, height: number) {
  canvasSheetRef.value?.setRowHeight?.(row, height)
}

/** 获取列宽 */
function getColWidth(col: number) {
  return canvasSheetRef.value?.getColWidth?.(col) ?? 100
}

/** 设置列宽 */
function setColWidth(col: number, width: number) {
  canvasSheetRef.value?.setColWidth?.(col, width)
}

/** 设置网格线显示状态 */
function setShowGridLines(show: boolean) {
  canvasSheetRef.value?.setShowGridLines?.(show)
}

/** 获取网格线显示状态 */
function getShowGridLines(): boolean {
  return canvasSheetRef.value?.getShowGridLines?.() ?? true
}

// ==================== 冻结 API ====================

/** 设置冻结行数 */
function setFrozenRows(count: number) {
  canvasSheetRef.value?.setFrozenRows?.(count)
}

/** 获取冻结行数 */
function getFrozenRows(): number {
  return canvasSheetRef.value?.getFrozenRows?.() ?? 0
}

/** 设置冻结列数 */
function setFrozenColumns(count: number) {
  canvasSheetRef.value?.setFrozenColumns?.(count)
}

/** 获取冻结列数 */
function getFrozenColumns(): number {
  return canvasSheetRef.value?.getFrozenColumns?.() ?? 0
}

// ==================== 图片 API ====================

/** 从文件插入图片 */
function insertImage(file: File): Promise<string | null> {
  return canvasSheetRef.value?.insertImage?.(file) ?? Promise.resolve(null)
}

/** 从 URL 插入图片 */
function insertImageFromUrl(url: string, width?: number, height?: number): Promise<string | null> {
  return canvasSheetRef.value?.insertImageFromUrl?.(url, width, height) ?? Promise.resolve(null)
}

/** 删除图片 */
function deleteImage(imageId: string) {
  canvasSheetRef.value?.deleteImage?.(imageId)
}

/** 获取所有图片 */
function getAllImages() {
  return canvasSheetRef.value?.getAllImages?.() ?? []
}

/** 获取选中的图片 ID */
function getSelectedImageId(): string | null {
  return canvasSheetRef.value?.getSelectedImageId?.() ?? null
}

/** 选中图片 */
function selectImage(imageId: string) {
  canvasSheetRef.value?.selectImage?.(imageId)
}

/** 清除图片选择 */
function clearImageSelection() {
  canvasSheetRef.value?.clearImageSelection?.()
}

// ==================== 单元格图片 API ====================

/** 从文件插入单元格图片 */
function insertCellImage(file: File, row?: number, col?: number): Promise<string | null> {
  return canvasSheetRef.value?.insertCellImage?.(file, row, col) ?? Promise.resolve(null)
}

/** 从 URL 插入单元格图片 */
function insertCellImageFromUrl(url: string, row?: number, col?: number): Promise<string | null> {
  return canvasSheetRef.value?.insertCellImageFromUrl?.(url, row, col) ?? Promise.resolve(null)
}

/** 获取单元格的所有图片 */
function getCellImages(row: number, col: number) {
  return canvasSheetRef.value?.getCellImages?.(row, col) ?? []
}

/** 获取单元格当前显示的图片 */
function getCellDisplayImage(row: number, col: number) {
  return canvasSheetRef.value?.getCellDisplayImage?.(row, col) ?? null
}

/** 获取单元格图片数量 */
function getCellImageCount(row: number, col: number): number {
  return canvasSheetRef.value?.getCellImageCount?.(row, col) ?? 0
}

/** 移除单元格的某张图片 */
function removeCellImage(row: number, col: number, imageId: string) {
  canvasSheetRef.value?.removeCellImage?.(row, col, imageId)
}

/** 清除单元格的所有图片 */
function clearCellImages(row: number, col: number) {
  canvasSheetRef.value?.clearCellImages?.(row, col)
}

/** 更新单元格图片的对齐方式 */
function updateCellImageAlignment(row: number, col: number, imageId: string, horizontalAlign?: any, verticalAlign?: any) {
  canvasSheetRef.value?.updateCellImageAlignment?.(row, col, imageId, horizontalAlign, verticalAlign)
}

/** 为当前选中单元格插入图片 */
function insertImageToSelection(file: File, horizontalAlign?: any, verticalAlign?: any): Promise<string | null> {
  return canvasSheetRef.value?.insertImageToSelection?.(file, horizontalAlign, verticalAlign) ?? Promise.resolve(null)
}

/** 打开单元格图片预览 */
function openCellImagePreview(row: number, col: number) {
  canvasSheetRef.value?.openCellImagePreview?.(row, col)
}

/** 关闭单元格图片预览 */
function closeCellImagePreview() {
  canvasSheetRef.value?.closeCellImagePreview?.()
}

/** 激活格式刷（单次模式） */
function startFormatPainter() {
  canvasSheetRef.value?.startFormatPainter?.()
}

/** 激活格式刷（连续模式） */
function startFormatPainterContinuous() {
  canvasSheetRef.value?.startFormatPainterContinuous?.()
}

/** 停止格式刷 */
function stopFormatPainter() {
  canvasSheetRef.value?.stopFormatPainter?.()
}

/** 获取格式刷模式 */
function getFormatPainterMode(): 'off' | 'single' | 'continuous' {
  return canvasSheetRef.value?.getFormatPainterMode?.() ?? 'off'
}

/** 应用格式到当前选区 */
function applyFormatPainter() {
  canvasSheetRef.value?.applyFormatPainter?.()
}

// 暴露 API
defineExpose({
  // 工作簿操作
  getWorkbook,
  getActiveCanvasSheet,
  getSheetData,
  addSheet,
  removeSheet,
  renameSheet,
  setActiveSheet,
  getActiveSheetId,
  getSheetCount,
  toJSON,
  fromJSON,
  getCrossSheetValue,
  
  // 跨表格式刷
  activateCrossSheetFormatPainter,
  applyCrossSheetFormat,
  crossSheetFormatPainter,
  
  // 代理到当前活动工作表的 API
  // 选择
  getSelection,
  setSelection,
  getSelectionRange,
  
  // 单元格值
  getCellValue,
  setCellValue,
  
  // 样式
  getCellStyle,
  setCellStyle,
  clearCellStyle,
  setRangeStyle,
  // 样式快捷方法
  setBold,
  setItalic,
  setUnderline,
  setStrikethrough,
  setFontFamily,
  setFontSize,
  setTextColor,
  setBackgroundColor,
  setTextAlign,
  setVerticalAlign,
  setWrapText,
  setTextRotation,
  
  // 边框
  getCellBorder,
  setCellBorder,
  clearCellBorder,
  setAllBorders,
  setOuterBorder,
  clearAllBorders,
  setRangeBorder,
  setRangeOuterBorder,
  clearRangeBorder,
  
  // 格式
  getCellFormat,
  setCellFormat,
  clearCellFormat,
  setRangeFormat,
  getFormattedValue,
  
  // 合并
  mergeCells,
  unmergeCells,
  canMerge,
  getMergedCellInfo,
  getMergedRegion,
  getAllMergedRegions,
  hasDataToLose,
  mergeSelection,
  unmergeSelection,
  
  // 撤销/重做
  undo,
  redo,
  canUndo,
  canRedo,
  
  // 绘制
  redraw,
  
  // 行列显示
  hideRow,
  unhideRow,
  hideColumn,
  unhideColumn,
  
  // 行列操作
  insertRowAbove,
  insertRowBelow,
  deleteRow,
  insertColLeft,
  insertColRight,
  deleteCol,
  
  // 尺寸
  getRowHeight,
  setRowHeight,
  getColWidth,
  setColWidth,
  
  // 网格线
  setShowGridLines,
  getShowGridLines,
  
  // 冻结
  setFrozenRows,
  getFrozenRows,
  setFrozenColumns,
  getFrozenColumns,
  
  // 图片
  insertImage,
  insertImageFromUrl,
  deleteImage,
  getAllImages,
  getSelectedImageId,
  selectImage,
  clearImageSelection,
  
  // 单元格图片
  insertCellImage,
  insertCellImageFromUrl,
  getCellImages,
  getCellDisplayImage,
  getCellImageCount,
  removeCellImage,
  clearCellImages,
  updateCellImageAlignment,
  insertImageToSelection,
  openCellImagePreview,
  closeCellImagePreview,
  
  // 格式刷
  startFormatPainter,
  startFormatPainterContinuous,
  stopFormatPainter,
  getFormatPainterMode,
  applyFormatPainter
})
</script>

<style scoped>
.workbook-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.workbook-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

/* 跨 Sheet 公式编辑时隐藏源 Sheet（但保留在 DOM 中以维持 CellOverlay 状态） */
.source-sheet-hidden {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  visibility: hidden;
  pointer-events: none;
}
</style>
