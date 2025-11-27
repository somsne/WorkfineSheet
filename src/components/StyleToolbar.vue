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
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SheetAPI } from './sheet/api'
import type { CellStyle } from './sheet/types'

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
</script>

<style scoped>
.style-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%);
  border-bottom: 1px solid #d0d0d0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
  min-height: 48px;
}

.font-select {
  padding: 6px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  min-width: 140px;
  height: 32px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.font-select:hover {
  border-color: #999;
}

.font-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.font-size-select {
  padding: 6px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  width: 65px;
  height: 32px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.font-size-select:hover {
  border-color: #999;
}

.font-size-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.align-select {
  padding: 6px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  width: 90px;
  height: 32px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.align-select:hover {
  border-color: #999;
}

.align-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.separator {
  width: 1px;
  height: 24px;
  background: #d0d0d0;
  margin: 0 6px;
}

.style-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
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
  background: #f0f0f0;
  border-color: #999;
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
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.color-picker label:hover {
  background: #f0f0f0;
  border-color: #999;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-picker label:active {
  transform: translateY(1px);
}

.color-label {
  font-weight: 600;
  font-size: 14px;
  pointer-events: none;
}

.color-picker input[type="color"] {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
