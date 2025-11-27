<template>
  <div class="style-toolbar">
    <!-- 字体选择 -->
    <select v-model="fontFamily" @change="applyFontFamily" class="font-select">
      <!-- macOS 系统字体 -->
      <option value="-apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif">SF Pro (系统)</option>
      <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
      <option value="'PingFang SC', 'Microsoft YaHei', sans-serif">苹方/微软雅黑</option>
      <option value="'STHeiti', 'Microsoft YaHei', sans-serif">华文黑体</option>
      <option value="'STSong', 'SimSun', serif">华文宋体/宋体</option>
      <option value="'STKaiti', 'KaiTi', serif">华文楷体/楷体</option>
      <option value="'Menlo', 'Monaco', 'Courier New', monospace">Menlo/Monaco</option>
      
      <!-- 通用字体 -->
      <option value="Arial, sans-serif">Arial</option>
      <option value="'Times New Roman', 'Times', serif">Times New Roman</option>
      <option value="'Courier New', 'Courier', monospace">Courier New</option>
      <option value="Georgia, serif">Georgia</option>
      <option value="Verdana, sans-serif">Verdana</option>
    </select>

    <!-- 字号选择 -->
    <select v-model="fontSize" @change="applyFontSize" class="font-size-select">
      <option value="9">9</option>
      <option value="10">10</option>
      <option value="11">11</option>
      <option value="12">12</option>
      <option value="14">14</option>
      <option value="16">16</option>
      <option value="18">18</option>
      <option value="20">20</option>
      <option value="24">24</option>
      <option value="28">28</option>
      <option value="36">36</option>
      <option value="48">48</option>
      <option value="72">72</option>
    </select>

    <div class="separator"></div>

    <!-- 样式按钮 -->
    <button 
      :class="{ active: bold }" 
      @click="toggleBold" 
      class="style-btn" 
      title="粗体 (Ctrl+B)"
    >
      <strong>B</strong>
    </button>
    
    <button 
      :class="{ active: italic }" 
      @click="toggleItalic" 
      class="style-btn" 
      title="斜体 (Ctrl+I)"
    >
      <em>I</em>
    </button>
    
    <button 
      :class="{ active: underline }" 
      @click="toggleUnderline" 
      class="style-btn" 
      title="下划线 (Ctrl+U)"
    >
      <u>U</u>
    </button>
    
    <button 
      :class="{ active: strikethrough }" 
      @click="toggleStrikethrough" 
      class="style-btn" 
      title="删除线"
    >
      <s>S</s>
    </button>

    <div class="separator"></div>

    <!-- 颜色选择 -->
    <div class="color-picker">
      <label title="字体颜色">
        <span class="color-label">A</span>
        <input type="color" v-model="textColor" @change="applyTextColor" />
      </label>
    </div>

    <div class="color-picker">
      <label title="背景色">
        <span class="color-label" style="background: #eee;">□</span>
        <input type="color" v-model="backgroundColor" @change="applyBackgroundColor" />
      </label>
    </div>

    <div class="separator"></div>

    <!-- 水平对齐 -->
    <select v-model="textAlign" @change="applyTextAlign" class="align-select" title="水平对齐">
      <option value="left">左对齐</option>
      <option value="center">居中</option>
      <option value="right">右对齐</option>
    </select>

    <!-- 垂直对齐 -->
    <select v-model="verticalAlign" @change="applyVerticalAlign" class="align-select" title="垂直对齐">
      <option value="top">顶部</option>
      <option value="middle">居中</option>
      <option value="bottom">底部</option>
    </select>

    <div class="separator"></div>

    <!-- 换行按钮 -->
    <button 
      :class="{ active: wrapText }" 
      @click="toggleWrapText" 
      class="style-btn" 
      title="自动换行"
    >
      ⏎
    </button>

    <div class="separator"></div>

    <!-- 边框设置 -->
    <div class="border-dropdown">
      <button 
        @click="toggleBorderMenu" 
        class="style-btn border-btn" 
        title="边框设置"
      >
        ▦
      </button>
      <div v-if="showBorderMenu" class="border-menu">
        <div class="border-menu-item" @click="applyAllBorders">
          <span class="border-icon">⊞</span>
          <span>所有边框</span>
        </div>
        <div class="border-menu-item" @click="applyOuterBorder">
          <span class="border-icon">▢</span>
          <span>外边框</span>
        </div>
        <div class="border-menu-item" @click="applyTopBorder">
          <span class="border-icon">⎺</span>
          <span>上边框</span>
        </div>
        <div class="border-menu-item" @click="applyBottomBorder">
          <span class="border-icon">⎽</span>
          <span>下边框</span>
        </div>
        <div class="border-menu-item" @click="applyLeftBorder">
          <span class="border-icon">⎸</span>
          <span>左边框</span>
        </div>
        <div class="border-menu-item" @click="applyRightBorder">
          <span class="border-icon">⎹</span>
          <span>右边框</span>
        </div>
        <div class="border-menu-divider"></div>
        <div class="border-menu-item" @click="clearBorders">
          <span class="border-icon">○</span>
          <span>清除边框</span>
        </div>
        <div class="border-menu-divider"></div>
        <div class="border-style-section">
          <label>边框样式：</label>
          <select v-model="borderStyle" class="border-style-select">
            <option value="thin">细线</option>
            <option value="medium">中等</option>
            <option value="thick">粗线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
            <option value="double">双线</option>
          </select>
        </div>
        <div class="border-color-section">
          <label>边框颜色：</label>
          <input type="color" v-model="borderColor" class="border-color-input" />
        </div>
      </div>
    </div>

    <div class="separator"></div>

    <!-- 网格线切换 -->
    <button 
      :class="{ active: showGridLines }" 
      @click="toggleGridLines" 
      class="style-btn" 
      title="显示/隐藏网格线"
    >
      ⊞
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { SheetAPI } from './sheet/api'
import type { CellStyle, BorderStyle } from './sheet/types'

const props = defineProps<{
  api: SheetAPI
  currentSelection: { row: number; col: number }
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number }
}>()

// 当前样式状态
const fontFamily = ref('Arial, sans-serif')
const fontSize = ref(12)
const bold = ref(false)
const italic = ref(false)
const underline = ref(false)
const strikethrough = ref(false)
const textColor = ref('#000000')
const backgroundColor = ref('#FFFFFF')
const textAlign = ref<'left' | 'center' | 'right'>('left')
const verticalAlign = ref<'top' | 'middle' | 'bottom'>('middle')
const wrapText = ref(false)

// 边框设置状态
const showBorderMenu = ref(false)
const borderStyle = ref<BorderStyle>('thin')
const borderColor = ref('#000000')

// 网格线状态
const showGridLines = ref(true)

// 点击外部关闭边框菜单
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.border-dropdown')) {
    showBorderMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 监听选区变化，更新工具栏状态
watch(() => [props.currentSelection.row, props.currentSelection.col], () => {
  updateToolbarState()
}, { immediate: true })

// 辅助函数：应用样式到选区或单个单元格
function applyStyleToSelection(style: Partial<CellStyle>) {
  if (props.currentSelection.row < 0 || props.currentSelection.col < 0) return
  
  // 检查是否有选区
  if (props.selectionRange.startRow >= 0 && props.selectionRange.startCol >= 0) {
    // 应用到整个选区
    props.api.setRangeStyle(
      props.selectionRange.startRow,
      props.selectionRange.startCol,
      props.selectionRange.endRow,
      props.selectionRange.endCol,
      style
    )
  } else {
    // 应用到当前单元格
    props.api.setCellStyle(props.currentSelection.row, props.currentSelection.col, style)
  }
}

function updateToolbarState() {
  if (props.currentSelection.row < 0 || props.currentSelection.col < 0) return
  
  const style: CellStyle = props.api.getCellStyle(
    props.currentSelection.row,
    props.currentSelection.col
  )
  
  fontFamily.value = style.fontFamily || 'Arial, sans-serif'
  fontSize.value = style.fontSize || 12
  bold.value = style.bold || false
  italic.value = style.italic || false
  underline.value = !!style.underline
  strikethrough.value = style.strikethrough || false
  textColor.value = style.color || '#000000'
  backgroundColor.value = style.backgroundColor || '#FFFFFF'
  textAlign.value = style.textAlign || 'left'
  verticalAlign.value = style.verticalAlign || 'middle'
  wrapText.value = style.wrapText || false
}

function applyFontFamily() {
  applyStyleToSelection({ fontFamily: fontFamily.value })
}

function applyFontSize() {
  applyStyleToSelection({ fontSize: Number(fontSize.value) })
}

function toggleBold() {
  bold.value = !bold.value
  applyStyleToSelection({ bold: bold.value })
}

function toggleItalic() {
  italic.value = !italic.value
  applyStyleToSelection({ italic: italic.value })
}

function toggleUnderline() {
  underline.value = !underline.value
  applyStyleToSelection({ underline: underline.value })
}

function toggleStrikethrough() {
  strikethrough.value = !strikethrough.value
  applyStyleToSelection({ strikethrough: strikethrough.value })
}

function applyTextColor() {
  applyStyleToSelection({ color: textColor.value })
}

function applyBackgroundColor() {
  applyStyleToSelection({ backgroundColor: backgroundColor.value })
}

function applyTextAlign() {
  applyStyleToSelection({ textAlign: textAlign.value })
}

function applyVerticalAlign() {
  applyStyleToSelection({ verticalAlign: verticalAlign.value })
}

function toggleWrapText() {
  wrapText.value = !wrapText.value
  applyStyleToSelection({ wrapText: wrapText.value })
}

// 边框功能
function toggleBorderMenu() {
  showBorderMenu.value = !showBorderMenu.value
}

function getSelectionRange() {
  if (props.selectionRange.startRow >= 0 && props.selectionRange.startCol >= 0) {
    return {
      startRow: props.selectionRange.startRow,
      startCol: props.selectionRange.startCol,
      endRow: props.selectionRange.endRow,
      endCol: props.selectionRange.endCol
    }
  }
  return {
    startRow: props.currentSelection.row,
    startCol: props.currentSelection.col,
    endRow: props.currentSelection.row,
    endCol: props.currentSelection.col
  }
}

function applyAllBorders() {
  const range = getSelectionRange()
  if (range.startRow < 0 || range.startCol < 0) return
  
  props.api.setAllBorders(
    range.startRow,
    range.startCol,
    range.endRow,
    range.endCol,
    { style: borderStyle.value, color: borderColor.value }
  )
  showBorderMenu.value = false
}

function applyOuterBorder() {
  const range = getSelectionRange()
  if (range.startRow < 0 || range.startCol < 0) return
  
  props.api.setOuterBorder(
    range.startRow,
    range.startCol,
    range.endRow,
    range.endCol,
    { style: borderStyle.value, color: borderColor.value }
  )
  showBorderMenu.value = false
}

function applyTopBorder() {
  const range = getSelectionRange()
  if (range.startRow < 0 || range.startCol < 0) return
  
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (row === range.startRow) {
        props.api.setCellBorder(row, col, {
          top: { style: borderStyle.value, color: borderColor.value }
        })
      }
    }
  }
  showBorderMenu.value = false
}

function applyBottomBorder() {
  const range = getSelectionRange()
  if (range.startRow < 0 || range.startCol < 0) return
  
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (row === range.endRow) {
        props.api.setCellBorder(row, col, {
          bottom: { style: borderStyle.value, color: borderColor.value }
        })
      }
    }
  }
  showBorderMenu.value = false
}

function applyLeftBorder() {
  const range = getSelectionRange()
  if (range.startRow < 0 || range.startCol < 0) return
  
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (col === range.startCol) {
        props.api.setCellBorder(row, col, {
          left: { style: borderStyle.value, color: borderColor.value }
        })
      }
    }
  }
  showBorderMenu.value = false
}

function applyRightBorder() {
  const range = getSelectionRange()
  if (range.startRow < 0 || range.startCol < 0) return
  
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (col === range.endCol) {
        props.api.setCellBorder(row, col, {
          right: { style: borderStyle.value, color: borderColor.value }
        })
      }
    }
  }
  showBorderMenu.value = false
}

function clearBorders() {
  const range = getSelectionRange()
  if (range.startRow < 0 || range.startCol < 0) return
  
  props.api.clearAllBorders(
    range.startRow,
    range.startCol,
    range.endRow,
    range.endCol
  )
  showBorderMenu.value = false
}

// 网格线功能
function toggleGridLines() {
  showGridLines.value = !showGridLines.value
  props.api.setShowGridLines(showGridLines.value)
}

// 初始化网格线状态
onMounted(() => {
  showGridLines.value = props.api.getShowGridLines()
})
</script>

<style scoped>
.style-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--toolbar-bg, linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%));
  border-bottom: 1px solid var(--toolbar-border, #d0d0d0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
  min-height: 48px;
}

.font-select,
.font-size-select,
.align-select {
  padding: 6px 10px;
  border: 1px solid var(--select-border, #d0d0d0);
  border-radius: 4px;
  background: var(--select-bg, white);
  color: var(--select-text, #000);
  font-size: 13px;
  height: 32px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.font-select {
  min-width: 140px;
}

.font-size-select {
  width: 65px;
}

.align-select {
  width: 90px;
}

.font-select:hover,
.font-size-select:hover,
.align-select:hover {
  border-color: var(--select-border-hover, #999);
}

.font-select:focus,
.font-size-select:focus,
.align-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* 夜间模式下的 option 元素 */
.font-select option,
.font-size-select option,
.align-select option {
  background: var(--select-bg, white);
  color: var(--select-text, #000);
}

.separator {
  width: 1px;
  height: 24px;
  background: var(--separator-color, #d0d0d0);
  margin: 0 6px;
}

.style-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--btn-border, #d0d0d0);
  border-radius: 4px;
  background: var(--btn-bg, white);
  color: var(--btn-text, #000);
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.style-btn:hover {
  background: var(--btn-bg-hover, #f0f0f0);
  border-color: var(--btn-border-hover, #999);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.style-btn:active {
  transform: translateY(1px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.style-btn.active {
  background: #3b82f6;
  border-color: #2563eb;
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.style-btn.active:hover {
  background: #2563eb;
  border-color: #1d4ed8;
}

.color-picker {
  position: relative;
}

.color-picker label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--btn-border, #d0d0d0);
  border-radius: 4px;
  background: var(--btn-bg, white);
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.color-picker label:hover {
  background: var(--btn-bg-hover, #f0f0f0);
  border-color: var(--btn-border-hover, #999);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-picker label:active {
  transform: translateY(1px);
}

.color-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--btn-text, #000);
  pointer-events: none;
}

.color-picker input[type="color"] {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  cursor: pointer;
}

/* 边框下拉菜单 */
.border-dropdown {
  position: relative;
}

.border-btn {
  font-size: 16px;
  font-weight: normal;
}

.border-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--menu-bg, white);
  border: 1px solid var(--menu-border, #d0d0d0);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 200px;
  z-index: 1000;
}

.border-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
  color: var(--menu-text, #333);
  user-select: none;
}

.border-menu-item:hover {
  background: var(--menu-hover, #f0f0f0);
}

.border-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  color: var(--icon-color, #666);
}

.border-menu-divider {
  height: 1px;
  background: var(--menu-border, #e0e0e0);
  margin: 6px 0;
}

.border-style-section,
.border-color-section {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.border-style-section label,
.border-color-section label {
  font-size: 12px;
  color: var(--label-text, #666);
  white-space: nowrap;
}

.border-style-select {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--select-border, #d0d0d0);
  border-radius: 4px;
  background: var(--select-bg, white);
  color: var(--select-text, #000);
  font-size: 12px;
  cursor: pointer;
}

.border-color-input {
  width: 40px;
  height: 24px;
  border: 1px solid var(--select-border, #d0d0d0);
  border-radius: 4px;
  cursor: pointer;
}

/* 夜间模式 */
@media (prefers-color-scheme: dark) {
  .style-toolbar {
    --toolbar-bg: linear-gradient(to bottom, #2a2a2a 0%, #1e1e1e 100%);
    --toolbar-border: #404040;
    --select-bg: #2d2d2d;
    --select-text: #e0e0e0;
    --select-border: #505050;
    --select-border-hover: #707070;
    --separator-color: #505050;
    --btn-bg: #2d2d2d;
    --btn-text: #e0e0e0;
    --btn-border: #505050;
    --btn-border-hover: #707070;
    --btn-bg-hover: #3a3a3a;
  }

  .border-menu {
    --menu-bg: #2d2d2d;
    --menu-border: #505050;
    --menu-text: #e0e0e0;
    --menu-hover: #3a3a3a;
    --icon-color: #b0b0b0;
    --label-text: #b0b0b0;
  }
}
</style>
