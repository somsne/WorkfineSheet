<script setup lang="ts">
/**
 * SheetTabBar - 工作表标签栏组件
 * 
 * 功能：
 * - 显示所有工作表标签
 * - 点击切换工作表
 * - 双击重命名工作表
 * - 右键菜单（插入/删除/重命名/复制/移动/隐藏）
 * - 拖拽排序
 * - 新建工作表按钮
 * - 标签滚动导航
 */

import { ref, computed, watch, nextTick, onMounted, onUnmounted, type ComponentPublicInstance } from 'vue'
import type { SheetInfo } from '../../lib/Workbook'

// Props
const props = defineProps<{
  /** 所有工作表信息 */
  sheets: SheetInfo[]
  /** 当前活动工作表 ID */
  activeSheetId: string
}>()

// Events
const emit = defineEmits<{
  /** 切换工作表 */
  (e: 'switch', sheetId: string): void
  /** 新建工作表 */
  (e: 'add'): void
  /** 删除工作表 */
  (e: 'remove', sheetId: string): void
  /** 重命名工作表 */
  (e: 'rename', sheetId: string, newName: string): void
  /** 复制工作表 */
  (e: 'duplicate', sheetId: string): void
  /** 移动工作表 */
  (e: 'move', sheetId: string, newIndex: number): void
  /** 隐藏工作表 */
  (e: 'hide', sheetId: string): void
  /** 显示隐藏的工作表 */
  (e: 'unhide', sheetId: string): void
  /** 设置标签颜色 */
  (e: 'setColor', sheetId: string, color: string | undefined): void
}>()

// 状态
const tabsContainerRef = ref<HTMLElement | null>(null)
const editingSheetId = ref<string | null>(null)
const editingName = ref('')
let editInputElement: HTMLInputElement | null = null
const contextMenuVisible = ref(false)

// 函数式 ref 用于获取编辑输入框
function setEditInputRef(el: Element | ComponentPublicInstance | null) {
  editInputElement = el as HTMLInputElement | null
}
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuSheetId = ref<string | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

// 拖拽状态
const draggingSheetId = ref<string | null>(null)
const dragOverSheetId = ref<string | null>(null)
const dragOverPosition = ref<'left' | 'right' | null>(null)

// 可见工作表（排序后）
const visibleSheets = computed(() => {
  return props.sheets
    .filter(s => s.metadata.visible)
    .sort((a, b) => a.metadata.order - b.metadata.order)
})

// 隐藏的工作表
const hiddenSheets = computed(() => {
  return props.sheets.filter(s => !s.metadata.visible)
})

// 计算编辑输入框宽度 (根据内容自适应，最小50px)
const editInputWidth = computed(() => {
  const text = editingName.value || ''
  // 使用 ch 单位（大约是字符 '0' 的宽度），中文字符算 2 个
  const charCount = [...text].reduce((count, char) => {
    // 中文字符宽度约为英文的 1.5-2 倍
    return count + (char.charCodeAt(0) > 127 ? 1.8 : 1)
  }, 0)
  // 最小 50px，额外加一些 padding 空间
  const width = Math.max(50, charCount * 7 + 10)
  return `${width}px`
})

// 是否只剩一个可见工作表
const isLastVisibleSheet = computed(() => {
  return visibleSheets.value.length <= 1
})

// 当前右键菜单的工作表（用于未来扩展）
// const contextMenuSheet = computed(() => {
//   if (!contextMenuSheetId.value) return null
//   return props.sheets.find(s => s.metadata.id === contextMenuSheetId.value)
// })

// ==================== 标签切换 ====================

function handleTabClick(sheetId: string) {
  if (editingSheetId.value) return // 编辑中不切换
  emit('switch', sheetId)
}

// ==================== 重命名 ====================

function startRename(sheetId: string) {
  const sheet = props.sheets.find(s => s.metadata.id === sheetId)
  if (!sheet) return
  
  editingSheetId.value = sheetId
  editingName.value = sheet.metadata.name
  
  nextTick(() => {
    editInputElement?.focus()
    editInputElement?.select()
  })
}

function confirmRename() {
  if (!editingSheetId.value) return
  
  const newName = editingName.value.trim()
  if (newName && newName !== getSheetName(editingSheetId.value)) {
    emit('rename', editingSheetId.value, newName)
  }
  
  cancelRename()
}

function cancelRename() {
  editingSheetId.value = null
  editingName.value = ''
}

function handleRenameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    confirmRename()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    cancelRename()
  }
}

function getSheetName(sheetId: string): string {
  const sheet = props.sheets.find(s => s.metadata.id === sheetId)
  return sheet?.metadata.name || ''
}

// ==================== 右键菜单 ====================

function handleContextMenu(e: MouseEvent, sheetId: string) {
  e.preventDefault()
  contextMenuSheetId.value = sheetId
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuSheetId.value = null
}

function handleMenuAction(action: string) {
  if (!contextMenuSheetId.value) return
  
  const sheetId = contextMenuSheetId.value
  
  switch (action) {
    case 'rename':
      startRename(sheetId)
      break
    case 'delete':
      emit('remove', sheetId)
      break
    case 'duplicate':
      emit('duplicate', sheetId)
      break
    case 'hide':
      emit('hide', sheetId)
      break
    case 'insertBefore':
      // 在当前工作表之前插入
      const sheet = props.sheets.find(s => s.metadata.id === sheetId)
      if (sheet) {
        emit('add')
        // 移动到当前位置（通过 add 事件后处理）
      }
      break
    case 'insertAfter':
      emit('add')
      break
  }
  
  closeContextMenu()
}

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.context-menu') && !target.closest('.sheet-tab')) {
    closeContextMenu()
  }
}

// ==================== 拖拽排序 ====================

function handleDragStart(e: DragEvent, sheetId: string) {
  if (editingSheetId.value) {
    e.preventDefault()
    return
  }
  
  draggingSheetId.value = sheetId
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', sheetId)
  
  // 设置拖拽图像
  const target = e.target as HTMLElement
  e.dataTransfer!.setDragImage(target, target.offsetWidth / 2, target.offsetHeight / 2)
}

function handleDragOver(e: DragEvent, sheetId: string) {
  e.preventDefault()
  if (!draggingSheetId.value || draggingSheetId.value === sheetId) return
  
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const midX = rect.left + rect.width / 2
  
  dragOverSheetId.value = sheetId
  dragOverPosition.value = e.clientX < midX ? 'left' : 'right'
}

function handleDragLeave() {
  dragOverSheetId.value = null
  dragOverPosition.value = null
}

function handleDrop(e: DragEvent, targetSheetId: string) {
  e.preventDefault()
  
  if (!draggingSheetId.value || draggingSheetId.value === targetSheetId) {
    resetDragState()
    return
  }
  
  const targetSheet = props.sheets.find(s => s.metadata.id === targetSheetId)
  if (!targetSheet) {
    resetDragState()
    return
  }
  
  let newIndex = targetSheet.metadata.order
  if (dragOverPosition.value === 'right') {
    newIndex++
  }
  
  emit('move', draggingSheetId.value, newIndex)
  resetDragState()
}

function handleDragEnd() {
  resetDragState()
}

function resetDragState() {
  draggingSheetId.value = null
  dragOverSheetId.value = null
  dragOverPosition.value = null
}

// ==================== 滚动导航 ====================

function updateScrollState() {
  if (!tabsContainerRef.value) return
  
  const container = tabsContainerRef.value
  canScrollLeft.value = container.scrollLeft > 0
  canScrollRight.value = container.scrollLeft < container.scrollWidth - container.clientWidth - 1
}

function scrollLeft() {
  if (!tabsContainerRef.value) return
  tabsContainerRef.value.scrollBy({ left: -150, behavior: 'smooth' })
}

function scrollRight() {
  if (!tabsContainerRef.value) return
  tabsContainerRef.value.scrollBy({ left: 150, behavior: 'smooth' })
}

// 监听滚动
onMounted(() => {
  updateScrollState()
  tabsContainerRef.value?.addEventListener('scroll', updateScrollState)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  tabsContainerRef.value?.removeEventListener('scroll', updateScrollState)
  document.removeEventListener('click', handleClickOutside)
})

// 监听工作表变化，更新滚动状态
watch(() => props.sheets.length, () => {
  nextTick(updateScrollState)
})

// ==================== 颜色设置辅助方法 ====================

/** 设置标签颜色（用于模板中避免 TypeScript 非空断言） */
function setTabColor(color: string) {
  if (contextMenuSheetId.value) {
    emit('setColor', contextMenuSheetId.value, color)
    closeContextMenu()
  }
}

/** 清除标签颜色 */
function clearTabColor() {
  if (contextMenuSheetId.value) {
    emit('setColor', contextMenuSheetId.value, undefined)
    closeContextMenu()
  }
}

// 预设颜色
const presetColors = [
  '#ef4444', // 红
  '#f97316', // 橙
  '#eab308', // 黄
  '#22c55e', // 绿
  '#3b82f6', // 蓝
  '#8b5cf6', // 紫
  '#ec4899', // 粉
]
</script>

<template>
  <div class="sheet-tab-bar">
    <!-- 滚动左按钮 -->
    <button 
      v-if="canScrollLeft"
      class="scroll-btn scroll-left"
      @click="scrollLeft"
      title="向左滚动"
    >
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M8 2L4 6L8 10" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
    </button>
    
    <!-- 工作表标签容器 -->
    <div ref="tabsContainerRef" class="tabs-container">
      <div 
        v-for="sheet in visibleSheets"
        :key="sheet.metadata.id"
        class="sheet-tab"
        :class="{
          active: sheet.metadata.id === activeSheetId,
          dragging: sheet.metadata.id === draggingSheetId,
          'drag-over-left': sheet.metadata.id === dragOverSheetId && dragOverPosition === 'left',
          'drag-over-right': sheet.metadata.id === dragOverSheetId && dragOverPosition === 'right'
        }"
        :style="sheet.metadata.color ? { '--tab-color': sheet.metadata.color } : {}"
        draggable="true"
        @click="handleTabClick(sheet.metadata.id)"
        @dblclick="startRename(sheet.metadata.id)"
        @contextmenu="handleContextMenu($event, sheet.metadata.id)"
        @dragstart="handleDragStart($event, sheet.metadata.id)"
        @dragover="handleDragOver($event, sheet.metadata.id)"
        @dragleave="handleDragLeave"
        @drop="handleDrop($event, sheet.metadata.id)"
        @dragend="handleDragEnd"
      >
        <!-- 颜色条 -->
        <div v-if="sheet.metadata.color" class="tab-color-bar"></div>
        
        <!-- 标签名称（编辑模式） -->
        <input
          v-if="editingSheetId === sheet.metadata.id"
          :ref="setEditInputRef"
          v-model="editingName"
          class="tab-name-input"
          :style="{ width: editInputWidth }"
          @blur="confirmRename"
          @keydown.stop="handleRenameKeydown"
          @keyup.stop
          @keypress.stop
          @click.stop
          @mousedown.stop
          @input.stop
          @paste.stop
          @copy.stop
          @cut.stop
          @compositionstart.stop
          @compositionupdate.stop
          @compositionend.stop
          @focus.stop
        />
        
        <!-- 标签名称（显示模式） -->
        <span v-else class="tab-name">{{ sheet.metadata.name }}</span>
      </div>
      
      <!-- 新建工作表按钮（在标签右边） -->
      <button 
        class="add-sheet-btn-inline"
        @click.stop="emit('add')"
        title="新建工作表"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M5 1V9M1 5H9" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
    </div>
    
    <!-- 滚动右按钮 -->
    <button 
      v-if="canScrollRight"
      class="scroll-btn scroll-right"
      @click="scrollRight"
      title="向右滚动"
    >
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
    </button>
    
    <!-- 右键菜单 -->
    <Teleport to="body">
      <div 
        v-if="contextMenuVisible"
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      >
        <div class="menu-item" @click="handleMenuAction('rename')">
          重命名
        </div>
        <div class="menu-item" @click="handleMenuAction('duplicate')">
          复制工作表
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleMenuAction('insertBefore')">
          在前面插入
        </div>
        <div class="menu-item" @click="handleMenuAction('insertAfter')">
          在后面插入
        </div>
        <div class="menu-divider"></div>
        <div 
          class="menu-item"
          :class="{ disabled: isLastVisibleSheet }"
          @click="!isLastVisibleSheet && handleMenuAction('hide')"
        >
          隐藏
        </div>
        <div 
          class="menu-item"
          :class="{ disabled: isLastVisibleSheet }"
          @click="!isLastVisibleSheet && handleMenuAction('delete')"
        >
          删除
        </div>
        <div class="menu-divider"></div>
        <div class="menu-submenu">
          <span>标签颜色</span>
          <div class="color-picker">
            <div 
              v-for="color in presetColors"
              :key="color"
              class="color-option"
              :style="{ backgroundColor: color }"
              @click="setTabColor(color)"
            ></div>
            <div 
              class="color-option color-none"
              title="清除颜色"
              @click="clearTabColor()"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 2L10 10M10 2L2 10" stroke="#999" stroke-width="1.5"/>
              </svg>
            </div>
          </div>
        </div>
        
        <!-- 显示隐藏工作表 -->
        <template v-if="hiddenSheets.length > 0">
          <div class="menu-divider"></div>
          <div class="menu-submenu">
            <span>显示工作表</span>
            <div class="hidden-sheets-list">
              <div 
                v-for="sheet in hiddenSheets"
                :key="sheet.metadata.id"
                class="menu-item"
                @click="emit('unhide', sheet.metadata.id); closeContextMenu()"
              >
                {{ sheet.metadata.name }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sheet-tab-bar {
  display: flex;
  align-items: stretch;
  height: 26px;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  padding: 0;
  gap: 0;
  user-select: none;
}

.tabs-container {
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 0;
  scrollbar-width: none;
  align-items: stretch;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.sheet-tab {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #fff;
  border-right: 1px solid #e0e0e0;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  min-width: 60px;
  max-width: 150px;
  transition: background-color 0.15s, color 0.15s;
}

.sheet-tab:first-child {
  border-left: 1px solid #e0e0e0;
}

.sheet-tab:hover {
  background: #f5f5f5;
  color: #333;
}

.sheet-tab.active {
  background: #fff;
  color: #217346;
  font-weight: 500;
  border-top: 2px solid #217346;
  margin-top: -1px;
}

.sheet-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: #fff;
}

.sheet-tab.dragging {
  opacity: 0.5;
}

.sheet-tab.drag-over-left::before,
.sheet-tab.drag-over-right::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #217346;
}

.sheet-tab.drag-over-left::before {
  left: -1px;
}

.sheet-tab.drag-over-right::after {
  right: -1px;
}

.tab-color-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--tab-color);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-name-input {
  min-width: 50px;
  max-width: 200px;
  padding: 0 4px;
  border: 1px solid #217346;
  border-radius: 2px;
  font-size: 12px;
  outline: none;
  background: #fff;
  color: #333;
  box-sizing: border-box;
}

.scroll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 100%;
  border: none;
  border-right: 1px solid #e0e0e0;
  background: #fff;
  color: #666;
  cursor: pointer;
  flex-shrink: 0;
}

.scroll-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.scroll-btn.scroll-left {
  border-right: 1px solid #e0e0e0;
}

.scroll-btn.scroll-right {
  border-left: 1px solid #e0e0e0;
  border-right: none;
}

/* 标签右边的内联新增按钮 */
.add-sheet-btn-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  height: 100%;
  border: none;
  border-radius: 0;
  background: #fff;
  color: #666;
  cursor: pointer;
  flex-shrink: 0;
  outline: none;
}

.add-sheet-btn-inline:hover {
  background: #f5f5f5;
  color: #217346;
}

.add-sheet-btn-inline:focus {
  outline: none;
}

/* 保留原来的按钮样式以备后用 */
.add-sheet-btn {
  display: none; /* 隐藏旧按钮 */
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background: #fff;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 160px;
  z-index: 10000;
}

.menu-item {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
}

.menu-item:hover {
  background: #f0f0f0;
}

.menu-item.disabled {
  color: #999;
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background: transparent;
}

.menu-divider {
  height: 1px;
  background: #e5e5e5;
  margin: 4px 0;
}

.menu-submenu {
  padding: 6px 12px;
}

.menu-submenu > span {
  font-size: 12px;
  color: #666;
  display: block;
  margin-bottom: 6px;
}

.color-picker {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.color-option {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-none {
  background: #f5f5f5;
}

.hidden-sheets-list {
  max-height: 150px;
  overflow-y: auto;
}

/* 暗黑模式 */
:global(html.dark) .sheet-tab-bar {
  background: #2d2d2d;
  border-top-color: #404040;
}

:global(html.dark) .sheet-tab {
  background: #2d2d2d;
  border-color: #404040;
  color: #999;
}

:global(html.dark) .sheet-tab:hover {
  background: #3a3a3a;
  color: #ccc;
}

:global(html.dark) .sheet-tab.active {
  background: #2d2d2d;
  color: #4ade80;
  border-top-color: #4ade80;
}

:global(html.dark) .sheet-tab.active::after {
  background: #2d2d2d;
}

:global(html.dark) .scroll-btn {
  background: #2d2d2d;
  border-color: #404040;
  color: #999;
}

:global(html.dark) .scroll-btn:hover {
  background: #3a3a3a;
  color: #4ade80;
}

:global(html.dark) .add-sheet-btn-inline {
  background: #2d2d2d;
  border-color: #404040;
  color: #666;
}

:global(html.dark) .add-sheet-btn-inline:hover {
  background: #3a3a3a;
  color: #4ade80;
}

:global(html.dark) .tab-name-input {
  background: #3a3a3a;
  border-color: #4ade80;
  color: #e0e0e0;
}

:global(html.dark) .context-menu {
  background: #2d2d2d;
  border-color: #404040;
}

:global(html.dark) .menu-item {
  color: #e0e0e0;
}

:global(html.dark) .menu-item:hover {
  background: #3a3a3a;
}

:global(html.dark) .menu-divider {
  background: #404040;
}

:global(html.dark) .menu-submenu > span {
  color: #999;
}
</style>
