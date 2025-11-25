<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

export interface MenuItem {
  label: string
  action: () => void
  disabled?: boolean
  divider?: boolean
}

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const menuRef = ref<HTMLElement | null>(null)

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

function handleItemClick(item: MenuItem) {
  if (!item.disabled && !item.divider) {
    item.action()
    emit('close')
  }
}
</script>

<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="context-menu"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <div
      v-for="(item, index) in items"
      :key="index"
      :class="['menu-item', { disabled: item.disabled, divider: item.divider }]"
      @click="handleItemClick(item)"
    >
      {{ item.label }}
    </div>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 160px;
  z-index: 1000;
  font-size: 14px;
}

.menu-item {
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
}

.menu-item:hover:not(.disabled):not(.divider) {
  background: #f0f0f0;
}

.menu-item.disabled {
  color: #999;
  cursor: not-allowed;
}

.menu-item.divider {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
  padding: 0;
  cursor: default;
}
</style>
