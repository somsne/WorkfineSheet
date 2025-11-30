<template>
  <div class="style-toolbar">
    <!-- 撤销还原 -->
    <button 
      @click="doUndo" 
      class="style-btn undo-btn" 
      :class="{ disabled: !canUndo }"
      :disabled="!canUndo"
      :title="undoTitle"
    >
      <span class="undo-icon">↩</span>
    </button>
    
    <button 
      @click="doRedo" 
      class="style-btn redo-btn" 
      :class="{ disabled: !canRedo }"
      :disabled="!canRedo"
      :title="redoTitle"
    >
      <span class="redo-icon">↪</span>
    </button>

    <div class="separator"></div>

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

    <div class="separator"></div>

    <!-- 合并单元格 -->
    <div class="merge-dropdown">
      <button 
        @click="toggleMergeMenu" 
        class="style-btn merge-btn" 
        title="合并单元格"
      >
        <span class="merge-icon">⬚</span>
      </button>
      <div v-if="showMergeMenu" class="merge-menu">
        <div class="merge-menu-item" @click="doMergeCells">
          <span class="merge-type-icon">⬚</span>
          <span>合并单元格</span>
        </div>
        <div class="merge-menu-item" @click="doUnmergeCells">
          <span class="merge-type-icon">⊞</span>
          <span>取消合并</span>
        </div>
      </div>
    </div>

    <div class="separator"></div>

    <!-- 插入图片 -->
    <button 
      @click="triggerImageUpload" 
      class="style-btn" 
      title="插入图片"
    >
      🖼️
    </button>
    <input 
      ref="imageInput" 
      type="file" 
      accept="image/*" 
      style="display: none;" 
      @change="handleImageUpload"
    />

    <div class="separator"></div>

    <!-- 单元格格式 -->
    <div class="format-dropdown">
      <button 
        @click="toggleFormatMenu" 
        class="style-btn format-btn" 
        title="单元格格式"
      >
        <span class="format-icon">123</span>
      </button>
      <div v-if="showFormatMenu" class="format-menu">
        <!-- 常规 -->
        <div class="format-menu-item" @click="applyFormat('general')">
          <span class="format-type-icon">Aa</span>
          <span>常规</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('text')">
          <span class="format-type-icon">T</span>
          <span>文本</span>
        </div>
        <div class="format-menu-divider"></div>
        
        <!-- 数字格式 -->
        <div class="format-menu-section">数字格式</div>
        <div class="format-menu-item" @click="applyFormat('number')">
          <span class="format-type-icon">1</span>
          <span>数字</span>
          <span class="format-example">1234</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('decimal2')">
          <span class="format-type-icon">.0</span>
          <span>两位小数</span>
          <span class="format-example">1234.50</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('thousands')">
          <span class="format-type-icon">,</span>
          <span>千分位</span>
          <span class="format-example">1,234.56</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('percent')">
          <span class="format-type-icon">%</span>
          <span>百分比</span>
          <span class="format-example">85.60%</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('permille')">
          <span class="format-type-icon">‰</span>
          <span>千分率</span>
          <span class="format-example">35.60‰</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('currencyCNY')">
          <span class="format-type-icon">¥</span>
          <span>人民币</span>
          <span class="format-example">¥1,234.56</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('currencyUSD')">
          <span class="format-type-icon">$</span>
          <span>美元</span>
          <span class="format-example">$1,234.56</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('scientific')">
          <span class="format-type-icon">E</span>
          <span>科学计数</span>
          <span class="format-example">1.23e+7</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('fraction')">
          <span class="format-type-icon">½</span>
          <span>分数</span>
          <span class="format-example">3/4</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('negativeRed')">
          <span class="format-type-icon" style="color: #dc2626;">-</span>
          <span>负数红色</span>
          <span class="format-example" style="color: #dc2626;">-1,234</span>
        </div>
        <div class="format-menu-divider"></div>
        
        <!-- 日期格式 -->
        <div class="format-menu-section">日期格式</div>
        <div class="format-menu-item" @click="applyFormat('date-ymd-pad')">
          <span class="format-type-icon">📅</span>
          <span>年-月-日</span>
          <span class="format-example">2024-03-15</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('date-ymd-cn')">
          <span class="format-type-icon">日</span>
          <span>中文日期</span>
          <span class="format-example">2024年3月15日</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('time-hms')">
          <span class="format-type-icon">⏰</span>
          <span>时间</span>
          <span class="format-example">14:30:45</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('datetime-pad')">
          <span class="format-type-icon">🕐</span>
          <span>日期时间</span>
          <span class="format-example">2024-03-15 14:30</span>
        </div>
        <div class="format-menu-divider"></div>
        
        <!-- 文本验证 -->
        <div class="format-menu-section">文本验证</div>
        <div class="format-menu-item" @click="applyFormat('idCard')">
          <span class="format-type-icon">🪪</span>
          <span>身份证</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('phone')">
          <span class="format-type-icon">📱</span>
          <span>手机号</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('telephone')">
          <span class="format-type-icon">☎️</span>
          <span>固定电话</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('email')">
          <span class="format-type-icon">✉️</span>
          <span>邮箱</span>
        </div>
        <div class="format-menu-item" @click="applyFormat('hyperlink')">
          <span class="format-type-icon">🔗</span>
          <span>超链接</span>
        </div>
        <div class="format-menu-divider"></div>
        
        <!-- 清除格式 -->
        <div class="format-menu-item format-clear" @click="clearFormat">
          <span class="format-type-icon">✕</span>
          <span>清除格式</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import type { SheetAPI } from './sheet/api'
import type { CellStyle, BorderStyle, CellFormatType } from './sheet/types'

const props = defineProps<{
  api: SheetAPI
  currentSelection: { row: number; col: number }
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number }
  multiSelection?: { 
    ranges: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>
    active: boolean
  }
}>()

// 检测是否为 macOS
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const modKey = isMac ? '⌘' : 'Ctrl'

// 撤销还原状态
const canUndo = ref(false)
const canRedo = ref(false)

// 计算撤销还原按钮的提示文字
const undoTitle = computed(() => `撤销 (${modKey}+Z)`)
const redoTitle = computed(() => isMac ? `还原 (${modKey}+Shift+Z)` : `还原 (${modKey}+Y)`)

// 更新撤销还原状态
function updateUndoRedoState() {
  canUndo.value = props.api.canUndo()
  canRedo.value = props.api.canRedo()
}

// 撤销操作
function doUndo() {
  if (props.api.canUndo()) {
    props.api.undo()
    updateUndoRedoState()
  }
}

// 还原操作
function doRedo() {
  if (props.api.canRedo()) {
    props.api.redo()
    updateUndoRedoState()
  }
}

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

// 点击外部关闭菜单
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.border-dropdown')) {
    showBorderMenu.value = false
  }
  if (!target.closest('.format-dropdown')) {
    showFormatMenu.value = false
  }
  if (!target.closest('.merge-dropdown')) {
    showMergeMenu.value = false
  }
}

// 定时器 ID，用于更新撤销还原状态
let undoRedoTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // 初始化撤销还原状态
  updateUndoRedoState()
  // 定期更新撤销还原状态（因为操作可能来自快捷键）
  undoRedoTimer = setInterval(updateUndoRedoState, 200)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  if (undoRedoTimer) {
    clearInterval(undoRedoTimer)
    undoRedoTimer = null
  }
})

// 监听选区变化，更新工具栏状态（同时监听 currentSelection 和 selectionRange）
watch(() => [
  props.currentSelection.row, 
  props.currentSelection.col,
  props.selectionRange.startRow,
  props.selectionRange.startCol
], () => {
  updateToolbarState()
  updateUndoRedoState()
}, { immediate: true })

// 辅助函数：应用样式到选区或单个单元格（支持多选）
function applyStyleToSelection(style: Partial<CellStyle>) {
  // 检查是否有有效的选区（整行/整列选择时 currentSelection 可能为 -1）
  const hasValidSelection = props.currentSelection.row >= 0 && props.currentSelection.col >= 0
  const hasValidRange = props.selectionRange.startRow >= 0 && props.selectionRange.startCol >= 0
  
  if (!hasValidSelection && !hasValidRange) return
  
  // 如果有多选区域且处于激活状态，则应用到所有多选区域
  if (props.multiSelection?.active && props.multiSelection.ranges.length > 0) {
    // 应用到所有历史多选区域
    for (const range of props.multiSelection.ranges) {
      props.api.setRangeStyle(
        range.startRow,
        range.startCol,
        range.endRow,
        range.endCol,
        style
      )
    }
  }
  
  // 总是应用到当前选区（包括单选和最新的选区）
  if (props.selectionRange.startRow >= 0 && props.selectionRange.startCol >= 0) {
    // 应用到当前选区
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
  // 整行/整列选择时使用选区起始位置获取样式
  let row = props.currentSelection.row
  let col = props.currentSelection.col
  
  if (row < 0 || col < 0) {
    // 如果 currentSelection 无效，使用 selectionRange 的起始位置
    if (props.selectionRange.startRow >= 0 && props.selectionRange.startCol >= 0) {
      row = props.selectionRange.startRow
      col = props.selectionRange.startCol
    } else {
      return
    }
  }
  
  const style: CellStyle = props.api.getCellStyle(row, col)
  
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

// 获取所有选区（包括多选区域），用于边框、格式等操作
function getAllSelectionRanges(): Array<{ startRow: number; startCol: number; endRow: number; endCol: number }> {
  const ranges: Array<{ startRow: number; startCol: number; endRow: number; endCol: number }> = []
  
  // 如果有多选区域且处于激活状态
  if (props.multiSelection?.active && props.multiSelection.ranges.length > 0) {
    ranges.push(...props.multiSelection.ranges)
  }
  
  // 添加当前选区
  const currentRange = getSelectionRange()
  if (currentRange.startRow >= 0 && currentRange.startCol >= 0) {
    ranges.push(currentRange)
  }
  
  return ranges
}

function applyAllBorders() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  for (const range of ranges) {
    props.api.setAllBorders(
      range.startRow,
      range.startCol,
      range.endRow,
      range.endCol,
      { style: borderStyle.value, color: borderColor.value }
    )
  }
  showBorderMenu.value = false
}

function applyOuterBorder() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  for (const range of ranges) {
    props.api.setOuterBorder(
      range.startRow,
      range.startCol,
      range.endRow,
      range.endCol,
      { style: borderStyle.value, color: borderColor.value }
    )
  }
  showBorderMenu.value = false
}

function applyTopBorder() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        if (row === range.startRow) {
          props.api.setCellBorder(row, col, {
            top: { style: borderStyle.value, color: borderColor.value }
          })
        }
      }
    }
  }
  showBorderMenu.value = false
}

function applyBottomBorder() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        if (row === range.endRow) {
          props.api.setCellBorder(row, col, {
            bottom: { style: borderStyle.value, color: borderColor.value }
          })
        }
      }
    }
  }
  showBorderMenu.value = false
}

function applyLeftBorder() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        if (col === range.startCol) {
          props.api.setCellBorder(row, col, {
            left: { style: borderStyle.value, color: borderColor.value }
          })
        }
      }
    }
  }
  showBorderMenu.value = false
}

function applyRightBorder() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        if (col === range.endCol) {
          props.api.setCellBorder(row, col, {
            right: { style: borderStyle.value, color: borderColor.value }
          })
        }
      }
    }
  }
  showBorderMenu.value = false
}

function clearBorders() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  for (const range of ranges) {
    props.api.clearAllBorders(
      range.startRow,
      range.startCol,
      range.endRow,
      range.endCol
    )
  }
  showBorderMenu.value = false
}

// 网格线功能
function toggleGridLines() {
  showGridLines.value = !showGridLines.value
  props.api.setShowGridLines(showGridLines.value)
}

// 单元格格式功能
const showFormatMenu = ref(false)

function toggleFormatMenu() {
  showFormatMenu.value = !showFormatMenu.value
  // 关闭其他菜单
  showBorderMenu.value = false
  showMergeMenu.value = false
}

// 合并单元格功能
const showMergeMenu = ref(false)

function toggleMergeMenu() {
  showMergeMenu.value = !showMergeMenu.value
  // 关闭其他菜单
  showBorderMenu.value = false
  showFormatMenu.value = false
}

function doMergeCells() {
  const result = props.api.mergeSelection()
  if (!result) {
    // 合并失败，可能是因为只选择了一个单元格或与现有合并冲突
    console.warn('无法合并单元格：请选择多个单元格或检查是否与现有合并区域冲突')
  }
  showMergeMenu.value = false
}

function doUnmergeCells() {
  props.api.unmergeSelection()
  showMergeMenu.value = false
}

// 图片上传相关
const imageInput = ref<HTMLInputElement | null>(null)

function triggerImageUpload() {
  imageInput.value?.click()
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  try {
    await props.api.insertImage(file)
  } catch (error) {
    console.error('插入图片失败:', error)
  }
  
  // 清除 input 以便能再次选择同一文件
  input.value = ''
}

function applyFormat(formatType: CellFormatType) {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  // 应用格式到所有选区
  for (const range of ranges) {
    props.api.setRangeFormat(
      range.startRow,
      range.startCol,
      range.endRow,
      range.endCol,
      { type: formatType }
    )
  }
  showFormatMenu.value = false
}

function clearFormat() {
  const ranges = getAllSelectionRanges()
  if (ranges.length === 0) return
  
  // 清除所有选区内单元格的格式
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        props.api.clearCellFormat(row, col)
      }
    }
  }
  showFormatMenu.value = false
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

.style-btn.disabled,
.style-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.style-btn.disabled:hover,
.style-btn:disabled:hover {
  background: var(--btn-bg, white);
  border-color: var(--btn-border, #d0d0d0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transform: none;
}

.undo-icon,
.redo-icon {
  font-size: 16px;
  font-weight: bold;
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

/* 格式下拉菜单 */
.format-dropdown {
  position: relative;
}

.format-btn {
  font-size: 12px;
  font-weight: bold;
}

.format-icon {
  font-size: 11px;
  letter-spacing: -1px;
}

.format-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--menu-bg, white);
  border: 1px solid var(--menu-border, #d0d0d0);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 240px;
  max-height: 450px;
  overflow-y: auto;
  z-index: 1000;
}

.format-menu-section {
  padding: 8px 12px 4px 12px;
  font-size: 11px;
  color: var(--label-text, #888);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.format-menu-item {
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

.format-menu-item:hover {
  background: var(--menu-hover, #f0f0f0);
}

.format-menu-item.format-clear {
  color: var(--error-color, #dc2626);
}

.format-type-icon {
  font-size: 14px;
  width: 24px;
  text-align: center;
  color: var(--icon-color, #666);
}

.format-example {
  margin-left: auto;
  font-size: 12px;
  color: var(--hint-color, #999);
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
}

.format-menu-divider {
  height: 1px;
  background: var(--menu-border, #e0e0e0);
  margin: 6px 0;
}

/* 合并单元格下拉菜单 */
.merge-dropdown {
  position: relative;
}

.merge-btn {
  font-size: 16px;
  font-weight: normal;
}

.merge-icon {
  font-size: 14px;
}

.merge-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--menu-bg, white);
  border: 1px solid var(--menu-border, #d0d0d0);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 160px;
  z-index: 1000;
}

.merge-menu-item {
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

.merge-menu-item:hover {
  background: var(--menu-hover, #f0f0f0);
}

.merge-type-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
  color: var(--icon-color, #666);
}

/* 夜间模式 - 系统偏好 */
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

  .format-menu {
    --menu-bg: #2d2d2d;
    --menu-border: #505050;
    --menu-text: #e0e0e0;
    --menu-hover: #3a3a3a;
    --icon-color: #b0b0b0;
    --label-text: #b0b0b0;
    --hint-color: #888;
    --error-color: #ef4444;
  }

  .merge-menu {
    --menu-bg: #2d2d2d;
    --menu-border: #505050;
    --menu-text: #e0e0e0;
    --menu-hover: #3a3a3a;
    --icon-color: #b0b0b0;
  }
}

/* 夜间模式 - 手动切换 */
:global(html.dark) .style-toolbar {
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

:global(html.dark) .border-menu {
  --menu-bg: #2d2d2d;
  --menu-border: #505050;
  --menu-text: #e0e0e0;
  --menu-hover: #3a3a3a;
  --icon-color: #b0b0b0;
  --label-text: #b0b0b0;
}

:global(html.dark) .format-menu {
  --menu-bg: #2d2d2d;
  --menu-border: #505050;
  --menu-text: #e0e0e0;
  --menu-hover: #3a3a3a;
  --icon-color: #b0b0b0;
  --label-text: #b0b0b0;
  --hint-color: #888;
  --error-color: #ef4444;
}

:global(html.dark) .merge-menu {
  --menu-bg: #2d2d2d;
  --menu-border: #505050;
  --menu-text: #e0e0e0;
  --menu-hover: #3a3a3a;
  --icon-color: #b0b0b0;
}
</style>
