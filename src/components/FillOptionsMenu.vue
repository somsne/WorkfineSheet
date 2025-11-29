<script setup lang="ts">
/**
 * FillOptionsMenu - 填充选项菜单组件
 * 在填充操作完成后显示，允许用户选择不同的填充方式
 */
import { ref, watch, nextTick, onBeforeUnmount, computed } from 'vue'
import type { FillOptionType, FillDirection } from './sheet/types'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  direction: FillDirection
  selectedType: FillOptionType
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', type: FillOptionType): void
}>()

const menuRef = ref<HTMLElement | null>(null)
const expanded = ref(false)

// 根据方向计算可用选项
const availableOptions = computed(() => {
  const options: { type: FillOptionType; label: string; icon: string }[] = [
    { type: 'copy', label: '复制单元格', icon: '📋' },
    { type: 'series', label: '填充序列', icon: '🔢' },
    { type: 'formatsOnly', label: '仅填充格式', icon: '🎨' },
    { type: 'valuesOnly', label: '不带格式填充', icon: '📝' }
  ]
  return options
})

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

// 按 ESC 关闭菜单
function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

watch(() => props.visible, (visible) => {
  if (visible) {
    expanded.value = false
    nextTick(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    })
  } else {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})

function toggleExpanded() {
  expanded.value = !expanded.value
}

function handleOptionClick(type: FillOptionType) {
  emit('select', type)
  expanded.value = false
}
</script>

<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="fill-options-menu"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <!-- 触发按钮 -->
    <button 
      class="fill-options-trigger"
      @click="toggleExpanded"
      :title="expanded ? '关闭填充选项' : '填充选项'"
    >
      <span class="trigger-icon">▼</span>
    </button>
    
    <!-- 展开的选项列表 -->
    <div v-if="expanded" class="fill-options-dropdown">
      <div
        v-for="option in availableOptions"
        :key="option.type"
        :class="['fill-option-item', { selected: option.type === selectedType }]"
        @click="handleOptionClick(option.type)"
      >
        <span class="option-icon">{{ option.icon }}</span>
        <span class="option-label">{{ option.label }}</span>
        <span v-if="option.type === selectedType" class="option-check">✓</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fill-options-menu {
  position: fixed;
  z-index: 1001;
}

.fill-options-trigger {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #ccc;
  border-radius: 2px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #666;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.fill-options-trigger:hover {
  background: #f0f0f0;
  border-color: #999;
}

.trigger-icon {
  font-size: 8px;
}

.fill-options-dropdown {
  position: absolute;
  top: 22px;
  left: 0;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  padding: 4px 0;
}

.fill-option-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
}

.fill-option-item:hover {
  background: #f5f5f5;
}

.fill-option-item.selected {
  background: #e8f0fe;
}

.option-icon {
  margin-right: 8px;
  font-size: 14px;
}

.option-label {
  flex: 1;
}

.option-check {
  color: #1a73e8;
  font-weight: bold;
}
</style>
