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
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    })
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
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
    @mousedown.stop
    @contextmenu.stop.prevent
  >
    <div
      v-for="(item, index) in items"
      :key="index"
      :class="['menu-item', { disabled: item.disabled, divider: item.divider }]"
      @click.stop="handleItemClick(item)"
    >
      {{ item.label }}
    </div>
  </div>
</template>

<style scoped>
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
  user-select: none;
}

.menu-item:hover:not(.disabled):not(.divider) {
  background: #f0f0f0;
}

.menu-item.disabled {
  color: #999;
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background: transparent;
}

.menu-item.divider {
  height: 1px;
  background: #e5e5e5;
  margin: 4px 0;
  padding: 0;
  cursor: default;
}
</style>
