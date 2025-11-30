<template>
  <div class="workbook-container">
    <!-- 主表格区域 -->
    <div class="workbook-main" ref="mainRef">
      <!-- 当前活动工作表的 CanvasSheet -->
      <CanvasSheet 
        v-if="activeSheetData" 
        ref="canvasSheetRef"
        :key="activeSheetId"
        :external-model="activeSheetData.model"
        :skip-demo-data="true"
        :initial-view-state="activeSheetData.viewState"
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
import CanvasSheet from './CanvasSheet.vue'
import SheetTabBar from './sheet/SheetTabBar.vue'

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

/** DOM 引用 */
const mainRef = ref<HTMLElement | null>(null)
const canvasSheetRef = ref<InstanceType<typeof CanvasSheet> | null>(null)

/** 活动工作表 ID */
const activeSheetId = computed(() => workbook.value.getActiveSheetId())

/** 活动工作表数据 */
const activeSheetData = computed(() => workbook.value.getActiveSheet())

/** 所有工作表列表 */
const sheets = computed<SheetInfo[]>(() => workbook.value.getAllSheets())

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

/** 跨 Sheet 剪贴板状态 */
const crossSheetClipboard = ref<{
  data: any
  startRow: number
  startCol: number
  mergedRegions: any[]
  tsvContent: string
  copyTs: number
  sourceSheetId: string | null
  copyRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null
}>({
  data: null,
  startRow: -1,
  startCol: -1,
  mergedRegions: [],
  tsvContent: '',
  copyTs: 0,
  sourceSheetId: null,
  copyRange: null
})

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
})

onBeforeUnmount(() => {
  // 清理事件监听器
  cleanupEventListeners()
})

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
    }
    
    // 恢复剪贴板状态
    if (crossSheetClipboard.value.data) {
      const currentSheetId = workbook.value.getActiveSheetId()
      // 只有切换回复制源 sheet 时才恢复蚂蚁线
      const shouldShowMarchingAnts = crossSheetClipboard.value.sourceSheetId === currentSheetId
      canvasSheetRef.value.setClipboardState?.({
        ...crossSheetClipboard.value,
        // 如果不是源 sheet，不显示蚂蚁线
        copyRange: shouldShowMarchingAnts ? crossSheetClipboard.value.copyRange : null
      })
    }
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
  if (formatPainterState && formatPainterState.mode !== 'off') {
    crossSheetFormatPainter.value = {
      ...formatPainterState,
      sourceSheetId: currentSheetId
    }
  }
  
  // 保存剪贴板状态（跨 Sheet 共享）
  const clipboardState = canvasSheetRef.value.getClipboardState?.()
  if (clipboardState && clipboardState.data) {
    // 检查是否是新的复制操作（通过 copyRange 是否存在判断）
    const hasNewCopyRange = clipboardState.copyRange !== null
    // 如果当前 sheet 有新的 copyRange，说明在这里执行了复制，更新 sourceSheetId
    // 否则保留原来的 sourceSheetId 和 copyRange
    if (hasNewCopyRange) {
      // 新的复制操作
      crossSheetClipboard.value = {
        ...clipboardState,
        sourceSheetId: currentSheetId
      }
    } else {
      // 保留原来的 sourceSheetId 和 copyRange
      crossSheetClipboard.value = {
        ...clipboardState,
        sourceSheetId: crossSheetClipboard.value.sourceSheetId,
        copyRange: crossSheetClipboard.value.copyRange
      }
    }
  }
  
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
function handleSheetAdd() {
  const newSheetId = workbook.value.addSheet()
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
  return workbook.value.removeSheet(sheetId)
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

/** 合并单元格 */
function mergeCells(startRow: number, startCol: number, endRow: number, endCol: number) {
  canvasSheetRef.value?.mergeCells?.(startRow, startCol, endRow, endCol)
}

/** 取消合并单元格 */
function unmergeCells(row: number, col: number) {
  canvasSheetRef.value?.unmergeCells?.(row, col)
}

/** 撤销 */
function undo() {
  canvasSheetRef.value?.undo?.()
}

/** 重做 */
function redo() {
  canvasSheetRef.value?.redo?.()
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
  
  // 边框
  getCellBorder,
  setCellBorder,
  clearCellBorder,
  setAllBorders,
  setOuterBorder,
  clearAllBorders,
  
  // 格式
  getCellFormat,
  setCellFormat,
  clearCellFormat,
  
  // 合并
  mergeCells,
  unmergeCells,
  
  // 撤销/重做
  undo,
  redo,
  
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
  
  // 格式刷
  startFormatPainter,
  startFormatPainterContinuous,
  stopFormatPainter,
  getFormatPainterMode
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
