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
      :cell-value="formulaBarCellValue"
      :is-editing="formulaBarIsEditing"
      :editing-value="formulaBarEditingValue"
      :formula-references="formulaReferences"
      @navigate="handleFormulaBarNavigate"
      @select-range="handleFormulaBarSelectRange"
      @start-edit="handleFormulaBarStartEdit"
      @confirm="handleFormulaBarConfirm"
      @cancel="handleFormulaBarCancel"
      @input="handleFormulaBarInput"
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
        @selection-change="handleSelectionChange"
        @editing-state-change="handleEditingStateChange"
        @clipboard-change="handleClipboardChange"
        @clipboard-clear="handleClipboardClear"
        @cut-source-clear="handleCutSourceClear"
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
import type { WorkbookClipboard } from './sheet/types'
// @ts-ignore
import CanvasSheet from './CanvasSheet.vue'
// @ts-ignore
import SheetTabBar from './SheetTabBar.vue'
// @ts-ignore
import StyleToolbar from './StyleToolbar.vue'
// @ts-ignore
import FormulaBar from './FormulaBar.vue'

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
const formulaBarEditingValue = ref('')
const formulaReferences = ref<any[]>([])

/** 监听 CanvasSheet 选区变化 */
function handleSelectionChange(payload: {
  selected: { row: number; col: number }
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number }
  multiSelection?: { ranges: any[]; active: boolean }
  cellValue: string
  formulaReferences?: any[]
}) {
  currentSelection.value = payload.selected
  selectionRange.value = payload.selectionRange
  if (payload.multiSelection) {
    multiSelection.value = payload.multiSelection
  }
  
  // 更新公式栏状态
  formulaBarRow.value = payload.selectionRange.startRow
  formulaBarCol.value = payload.selectionRange.startCol
  formulaBarEndRow.value = payload.selectionRange.endRow
  formulaBarEndCol.value = payload.selectionRange.endCol
  formulaBarCellValue.value = payload.cellValue
  if (payload.formulaReferences) {
    formulaReferences.value = payload.formulaReferences
  }
}

/** 监听 CanvasSheet 编辑状态变化 */
function handleEditingStateChange(payload: {
  isEditing: boolean
  editingValue: string
  formulaReferences?: any[]
}) {
  formulaBarIsEditing.value = payload.isEditing
  formulaBarEditingValue.value = payload.editingValue
  if (payload.formulaReferences) {
    formulaReferences.value = payload.formulaReferences
  }
}

// ==================== 公式栏事件处理 ====================

/** 公式栏 - 导航到单元格 */
function handleFormulaBarNavigate(row: number, col: number) {
  canvasSheetRef.value?.selectCell?.(row, col)
}

/** 公式栏 - 选择范围 */
function handleFormulaBarSelectRange(startRow: number, startCol: number, endRow: number, endCol: number) {
  canvasSheetRef.value?.selectRange?.(startRow, startCol, endRow, endCol)
}

/** 公式栏 - 开始编辑 */
function handleFormulaBarStartEdit() {
  canvasSheetRef.value?.startEditingCurrentCell?.()
}

/** 公式栏 - 确认 */
function handleFormulaBarConfirm() {
  canvasSheetRef.value?.confirmEditing?.()
}

/** 公式栏 - 取消 */
function handleFormulaBarCancel() {
  canvasSheetRef.value?.cancelEditing?.()
}

/** 公式栏 - 输入变化 */
function handleFormulaBarInput(value: string) {
  canvasSheetRef.value?.setEditingValue?.(value)
}

// ==================== 跨 Sheet 共享状态 ====================

/** 跨 Sheet 格式刷状态 */
const crossSheetFormatPainter = ref<{
  mode: 'off' | 'single' | 'continuous'
  data: any
  sourceSheetId: string | null
}>({
  mode: 'off',
  data: null,
  sourceSheetId: null
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
  
  console.log(`Cut source cleared: Sheet ${sourceSheetId}, range [${startRow},${startCol}] to [${startRow + height - 1},${startCol + width - 1}]`)
}

/** 公式编辑状态（跨 Sheet 引用） */
const formulaEditState = ref<{
  active: boolean
  sourceSheetId: string | null
  row: number
  col: number
  value: string
} | null>(null)

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
    // 切换工作表后需要刷新 CanvasSheet 的数据
    nextTick(() => {
      syncSheetData()
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

/** 同步工作表数据到 CanvasSheet */
function syncSheetData() {
  // 切换后恢复跨 Sheet 共享的状态
  nextTick(() => {
    if (!canvasSheetRef.value) return
    
    // 恢复格式刷状态
    if (crossSheetFormatPainter.value.mode !== 'off' && crossSheetFormatPainter.value.data) {
      canvasSheetRef.value.setFormatPainterState?.(crossSheetFormatPainter.value)
      
      // 对于 single 模式，恢复后立即清除跨 Sheet 状态
      // 这样格式刷只能应用一次（在目标 Sheet 上）
      // continuous 模式则保持，允许在多个 Sheet 间连续应用
      if (crossSheetFormatPainter.value.mode === 'single') {
        crossSheetFormatPainter.value = {
          mode: 'off',
          data: null,
          sourceSheetId: null
        }
      }
    }
    
    // 剪贴板状态现在通过 props.clipboard 自动传递给 CanvasSheet
    // CanvasSheet 内部 watch 会自动处理蚂蚁线显示
  })
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
  const formatPainterState = canvasSheetRef.value.getFormatPainterState?.()
  if (formatPainterState) {
    if (formatPainterState.mode !== 'off') {
      // 格式刷激活状态，保存到跨 Sheet 状态
      crossSheetFormatPainter.value = {
        ...formatPainterState,
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
  
  // 检查是否正在编辑公式
  const formulaState = canvasSheetRef.value.getFormulaEditState?.()
  if (formulaState) {
    formulaEditState.value = {
      active: true,
      sourceSheetId: currentSheetId,
      row: formulaState.row,
      col: formulaState.col,
      value: formulaState.value
    }
  }
}

/** 切换工作表 */
function handleSheetChange(sheetId: string) {
  // 先保存当前 Sheet 的状态
  saveCurrentSheetState()
  
  // 切换到新的 Sheet
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

/** 跨工作表格式刷状态 */
const formatPainterState = ref<{
  active: boolean
  sourceSheetId: string | null
  sourceRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null
  formats: any | null
}>({
  active: false,
  sourceSheetId: null,
  sourceRange: null,
  formats: null
})

/** 激活跨工作表格式刷 */
function activateCrossSheetFormatPainter() {
  const activeSheet = workbook.value.getActiveSheet()
  if (!activeSheet || !canvasSheetRef.value) return
  
  // 从当前 CanvasSheet 获取选区
  // 注意：CanvasSheet 目前不暴露 getSelectionRange 和 getFormats，这是未来功能
  // const selection = canvasSheetRef.value.getSelectionRange?.()
  // if (!selection) return
  
  formatPainterState.value = {
    active: true,
    sourceSheetId: activeSheet.metadata.id,
    sourceRange: null, // TODO: 从 CanvasSheet 获取
    formats: null // TODO: 从 CanvasSheet 获取
  }
}

/** 应用跨工作表格式 */
function applyCrossSheetFormat() {
  if (!formatPainterState.value.active || !formatPainterState.value.formats) return
  if (!canvasSheetRef.value) return
  
  // TODO: 调用 CanvasSheet 的格式应用方法
  // canvasSheetRef.value.setFormats?.(formatPainterState.value.formats)
  
  // 清除格式刷状态
  formatPainterState.value = {
    active: false,
    sourceSheetId: null,
    sourceRange: null,
    formats: null
  }
}

// ==================== 公开 API ====================

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
  formatPainterState,
  
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
}
</style>
