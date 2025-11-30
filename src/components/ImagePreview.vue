<script setup lang="ts">
/**
 * ImagePreview.vue
 * 单元格图片预览组件
 * - 中间显示当前选中图片的放大效果
 * - 底部显示所有图片的缩略图列表
 * - 支持键盘导航（左右箭头、ESC 关闭）
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { CellImage } from './sheet/types'

const props = defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 图片列表 */
  images: CellImage[]
  /** 初始显示的图片索引（默认为最后一个，即最新的图片） */
  initialIndex?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'remove', imageId: string): void
}>()

// 当前选中的图片索引
const currentIndex = ref(0)

// 缩略图容器引用
const thumbnailsRef = ref<HTMLElement | null>(null)

// 当前显示的图片
const currentImage = computed(() => {
  if (props.images.length === 0) return null
  return props.images[currentIndex.value] || props.images[0]
})

// 反向显示的图片列表（最新的在前）
const reversedImages = computed(() => {
  return [...props.images].reverse()
})

// 监听 visible 变化，重置索引
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    // 初始化为指定索引或最后一个（最新的图片）
    currentIndex.value = props.initialIndex ?? (props.images.length - 1)
    nextTick(() => {
      scrollToCurrentThumbnail()
    })
  }
})

// 监听图片列表变化
watch(() => props.images, () => {
  // 如果当前索引超出范围，调整到最后一个
  if (currentIndex.value >= props.images.length) {
    currentIndex.value = Math.max(0, props.images.length - 1)
  }
}, { deep: true })

// 选择图片
function selectImage(index: number) {
  if (index >= 0 && index < props.images.length) {
    currentIndex.value = index
    scrollToCurrentThumbnail()
  }
}

// 上一张
function prevImage() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    scrollToCurrentThumbnail()
  }
}

// 下一张
function nextImage() {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
    scrollToCurrentThumbnail()
  }
}

// 滚动到当前缩略图
function scrollToCurrentThumbnail() {
  nextTick(() => {
    const container = thumbnailsRef.value
    if (!container) return
    
    const thumbnails = container.querySelectorAll('.thumbnail-item')
    const currentThumb = thumbnails[currentIndex.value] as HTMLElement
    if (!currentThumb) return
    
    // 计算是否需要滚动
    const containerRect = container.getBoundingClientRect()
    const thumbRect = currentThumb.getBoundingClientRect()
    
    if (thumbRect.left < containerRect.left) {
      container.scrollLeft -= containerRect.left - thumbRect.left + 10
    } else if (thumbRect.right > containerRect.right) {
      container.scrollLeft += thumbRect.right - containerRect.right + 10
    }
  })
}

// 关闭预览
function close() {
  emit('close')
}

// 删除当前图片
function removeCurrentImage() {
  if (currentImage.value) {
    emit('remove', currentImage.value.id)
  }
}

// 键盘事件处理
function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  
  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      close()
      break
    case 'ArrowLeft':
      e.preventDefault()
      prevImage()
      break
    case 'ArrowRight':
      e.preventDefault()
      nextImage()
      break
    case 'Delete':
    case 'Backspace':
      e.preventDefault()
      removeCurrentImage()
      break
  }
}

// 注册/注销键盘事件
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div 
        v-if="visible" 
        class="image-preview-overlay"
        @click.self="close"
      >
        <div class="image-preview-container" @click.stop>
          <!-- 关闭按钮 -->
          <button class="close-btn" @click="close" title="关闭 (ESC)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="#fff" stroke-width="2"></line>
              <line x1="6" y1="6" x2="18" y2="18" stroke="#fff" stroke-width="2"></line>
            </svg>
          </button>
          
          <!-- 主预览区域 -->
          <div class="main-preview" @click.self="close">
            <template v-if="currentImage">
              <!-- 导航按钮：上一张 -->
              <button 
                class="nav-btn prev" 
                :disabled="currentIndex === 0"
                @click="prevImage"
                title="上一张 (←)"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <polyline points="15 18 9 12 15 6" stroke="#fff" stroke-width="2"></polyline>
                </svg>
              </button>
              
              <!-- 图片 -->
              <div class="image-wrapper">
                <img 
                  :src="currentImage.src" 
                  :alt="`图片 ${currentIndex + 1}`"
                  class="preview-image"
                />
              </div>
              
              <!-- 导航按钮：下一张 -->
              <button 
                class="nav-btn next" 
                :disabled="currentIndex === images.length - 1"
                @click="nextImage"
                title="下一张 (→)"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <polyline points="9 18 15 12 9 6" stroke="#fff" stroke-width="2"></polyline>
                </svg>
              </button>
            </template>
            
            <div v-else class="no-image">
              暂无图片
            </div>
          </div>
          
          <!-- 底部信息和缩略图 -->
          <div class="bottom-bar">
            <!-- 图片信息 -->
            <div class="image-info">
              <span class="image-count">{{ currentIndex + 1 }} / {{ images.length }}</span>
              <button 
                v-if="currentImage" 
                class="delete-btn" 
                @click="removeCurrentImage"
                title="删除此图片 (Delete)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                删除
              </button>
            </div>
            
            <!-- 缩略图列表（反向显示，最新的在前） -->
            <div v-if="images.length > 1" ref="thumbnailsRef" class="thumbnails-container">
              <div 
                v-for="(image, index) in reversedImages"
                :key="image.id"
                class="thumbnail-item"
                :class="{ active: (images.length - 1 - index) === currentIndex }"
                @click="selectImage(images.length - 1 - index)"
              >
                <img :src="image.src" :alt="`缩略图 ${images.length - index}`" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.image-preview-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.main-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 80px;
  position: relative;
  min-height: 0;
}

.image-wrapper {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: calc(100vh - 200px);
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 52px;
  height: 52px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, opacity 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.8);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn.prev {
  left: 20px;
}

.nav-btn.next {
  right: 20px;
}

.no-image {
  color: rgba(255, 255, 255, 0.5);
  font-size: 18px;
}

.bottom-bar {
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.5);
}

.image-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}



.image-count {
  color: white;
  font-weight: 500;
}

.delete-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}

.thumbnails-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.thumbnails-container::-webkit-scrollbar {
  height: 6px;
}

.thumbnails-container::-webkit-scrollbar-track {
  background: transparent;
}

.thumbnails-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.thumbnail-item {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s, transform 0.2s;
}

.thumbnail-item:hover {
  transform: scale(1.05);
}

.thumbnail-item.active {
  border-color: #3b82f6;
}

.thumbnail-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
