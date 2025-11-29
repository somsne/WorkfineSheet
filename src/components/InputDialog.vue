<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  title: string
  defaultValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'confirm', value: string): void
  (e: 'cancel'): void
}>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.visible, (visible) => {
  if (visible) {
    inputValue.value = props.defaultValue
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  }
})

function handleConfirm() {
  emit('confirm', inputValue.value)
}

function handleCancel() {
  emit('cancel')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleConfirm()
  } else if (e.key === 'Escape') {
    handleCancel()
  }
}
</script>

<template>
  <div v-if="visible" class="dialog-overlay" @mousedown="handleCancel">
    <div class="dialog-box" @mousedown.stop>
      <div class="dialog-title">{{ title }}</div>
      <div class="dialog-content">
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          :placeholder="placeholder"
          @keydown="handleKeydown"
          @keydown.stop
          @keyup.stop
          @keypress.stop
        />
      </div>
      <div class="dialog-actions">
        <button @click="handleCancel">取消</button>
        <button class="primary" @click="handleConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog-box {
  background: white;
  border-radius: 8px;
  padding: 20px;
  min-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.dialog-content {
  margin-bottom: 20px;
}

.dialog-content input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.dialog-content input:focus {
  outline: none;
  border-color: #3b82f6;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-actions button {
  padding: 6px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.dialog-actions button:hover {
  background: #f0f0f0;
}

.dialog-actions button.primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.dialog-actions button.primary:hover {
  background: #2563eb;
}

/* 暗黑模式支持 - 手动切换 */
:global(html.dark) .dialog-box {
  background: #2d2d2d;
}

:global(html.dark) .dialog-title {
  color: #e0e0e0;
}

:global(html.dark) .dialog-content input {
  background: #3a3a3a;
  border-color: #505050;
  color: #e0e0e0;
}

:global(html.dark) .dialog-content input:focus {
  border-color: #3b82f6;
}

:global(html.dark) .dialog-actions button {
  background: #3a3a3a;
  border-color: #505050;
  color: #e0e0e0;
}

:global(html.dark) .dialog-actions button:hover {
  background: #4a4a4a;
}

:global(html.dark) .dialog-actions button.primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

:global(html.dark) .dialog-actions button.primary:hover {
  background: #2563eb;
}

/* 暗黑模式支持 - 系统偏好 (仅在自动模式下生效) */
@media (prefers-color-scheme: dark) {
  :global(html:not(.theme-manual)) .dialog-box {
    background: #2d2d2d;
  }

  :global(html:not(.theme-manual)) .dialog-title {
    color: #e0e0e0;
  }

  :global(html:not(.theme-manual)) .dialog-content input {
    background: #3a3a3a;
    border-color: #505050;
    color: #e0e0e0;
  }

  :global(html:not(.theme-manual)) .dialog-content input:focus {
    border-color: #3b82f6;
  }

  :global(html:not(.theme-manual)) .dialog-actions button {
    background: #3a3a3a;
    border-color: #505050;
    color: #e0e0e0;
  }

  :global(html:not(.theme-manual)) .dialog-actions button:hover {
    background: #4a4a4a;
  }

  :global(html:not(.theme-manual)) .dialog-actions button.primary {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  :global(html:not(.theme-manual)) .dialog-actions button.primary:hover {
    background: #2563eb;
  }
}
</style>
