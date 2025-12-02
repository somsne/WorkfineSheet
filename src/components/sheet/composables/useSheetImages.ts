/**
 * 图片交互 Composable
 * 负责处理图片的鼠标交互、选择、拖拽、调整大小等
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type {
  FloatingImage,
  ResizeHandle,
  Viewport,
  SizeAccess,
  GeometryConfig,
  CellImageAlignment,
  CellImageVerticalAlign,
  ImagePreviewState
} from '../types'
import { IMAGE_CONFIG, DEFAULT_IMAGE_PREVIEW_STATE } from '../types'
import type { SheetModel } from '../../../lib/SheetModel'
import type { UndoRedoManager } from '../../../lib/UndoRedoManager'
import {
  ImageLoader,
  calculateImagePosition,
  isPointInImage,
  getHandleAtPoint,
  getCursorForHandle,
  calculateResizedDimensions,
  calculateAnchorFromPosition,
  isImageVisible,
  calculateInitialSize,
  fileToDataURL
} from '../images'
import { hitTestCellImage, imageCache } from '../renderCellImage'
import { getRowTop, getColLeft, getRowHeight, getColWidth } from '../geometry'

export interface UseSheetImagesOptions {
  model: SheetModel
  undoRedo: UndoRedoManager
  /** 可选的 UndoRedo 执行器，如果提供则使用它而不是 undoRedo（用于添加 sheetId） */
  undoRedoExecutor?: {
    execute(action: { name: string; undo: () => void; redo: () => void }): void
    record(action: { name: string; undo: () => void; redo: () => void }): void
  }
  /** 视口状态（reactive 对象） */
  viewport: Viewport
  /** 获取尺寸访问器的函数 */
  getSizes: () => SizeAccess
  /** 获取几何配置的函数 */
  getGeometryConfig: () => GeometryConfig
  /** 获取容器宽度的函数 */
  getContainerWidth: () => number
  /** 获取容器高度的函数 */
  getContainerHeight: () => number
  /** 获取容器元素的函数 */
  getContainer: () => HTMLElement | null
  totalRows: number
  totalCols: number
  requestDraw: () => void
}

/** 简化的图片选择状态（用于渲染） */
export interface SimpleImageSelectionState {
  imageId: string
  isResizing: boolean
  resizeHandle: ResizeHandle | null
}

export interface UseSheetImagesReturn {
  // 状态
  imageLoader: ImageLoader
  selectedImageId: Ref<string | null>
  isImageDragging: Ref<boolean>
  isImageResizing: Ref<boolean>
  resizeHandle: Ref<ResizeHandle | null>
  imageSelectionState: ComputedRef<SimpleImageSelectionState | null>
  
  // 单元格图片预览状态
  imagePreviewState: Ref<ImagePreviewState>
  
  // 方法
  handleImageMouseDown: (e: MouseEvent) => boolean
  handleImageMouseMove: (e: MouseEvent) => boolean
  handleGlobalImageMouseMove: (e: MouseEvent) => boolean
  handleImageMouseUp: () => void
  handleImageKeyDown: (e: KeyboardEvent) => boolean
  insertImage: (file: File) => Promise<string | null>
  insertImageFromUrl: (url: string, initialWidth?: number, initialHeight?: number) => Promise<string | null>
  deleteSelectedImage: () => void
  clearImageSelection: () => void
  getImageAtPoint: (x: number, y: number) => FloatingImage | null
  getImageCursor: (x: number, y: number) => string | null
  bringSelectedImageForward: () => void
  sendSelectedImageBackward: () => void
  bringSelectedImageToFront: () => void
  sendSelectedImageToBack: () => void
  
  // 单元格内嵌图片方法
  insertCellImage: (row: number, col: number, file: File, horizontalAlign?: CellImageAlignment, verticalAlign?: CellImageVerticalAlign) => Promise<string | null>
  insertCellImageFromUrl: (row: number, col: number, url: string, horizontalAlign?: CellImageAlignment, verticalAlign?: CellImageVerticalAlign) => Promise<string | null>
  removeCellImage: (row: number, col: number, imageId: string) => void
  clearCellImages: (row: number, col: number) => void
  updateCellImageAlignment: (row: number, col: number, imageId: string, horizontalAlign?: CellImageAlignment, verticalAlign?: CellImageVerticalAlign) => void
  openCellImagePreview: (row: number, col: number) => void
  closeCellImagePreview: () => void
  handleCellImageRemove: (imageId: string) => void
  checkCellImageClick: (x: number, y: number) => { row: number; col: number } | null
}

/**
 * 图片交互 Composable
 */
export function useSheetImages(options: UseSheetImagesOptions): UseSheetImagesReturn {
  const {
    model,
    undoRedo,
    undoRedoExecutor,
    viewport,
    getSizes,
    getGeometryConfig,
    getContainerWidth,
    getContainerHeight,
    getContainer,
    totalRows,
    totalCols,
    requestDraw
  } = options
  
  // 使用传入的执行器或默认的 undoRedo
  const undoRedoExec = undoRedoExecutor ?? undoRedo

  // 图片加载器
  const imageLoader = new ImageLoader()

  // 选中的图片 ID
  const selectedImageId = ref<string | null>(null)

  // 拖拽状态
  const isImageDragging = ref(false)
  const isImageResizing = ref(false)
  const resizeHandle = ref<ResizeHandle | null>(null)

  // 拖拽/调整大小起始信息
  let dragStartX = 0
  let dragStartY = 0
  let dragStartImage: FloatingImage | null = null

  // 计算选中图片的简化状态
  const imageSelectionState = computed<SimpleImageSelectionState | null>(() => {
    if (!selectedImageId.value) return null

    const image = model.getFloatingImage(selectedImageId.value)
    if (!image) return null

    return {
      imageId: image.id,
      isResizing: isImageResizing.value,
      resizeHandle: resizeHandle.value
    }
  })

  /**
   * 获取指定位置的图片（按 zIndex 从高到低检查）
   */
  function getImageAtPoint(x: number, y: number): FloatingImage | null {
    const images = model.getAllFloatingImages()
    // 按 zIndex 从高到低排序
    const sortedImages = [...images].sort((a, b) => b.zIndex - a.zIndex)

    for (const image of sortedImages) {
      const pos = calculateImagePosition(
        image,
        viewport,
        getSizes(),
        getGeometryConfig()
      )

      if (!isImageVisible(pos, getContainerWidth(), getContainerHeight(), getGeometryConfig())) {
        continue
      }

      if (isPointInImage(x, y, pos)) {
        return image
      }
    }

    return null
  }

  /**
   * 获取光标样式（用于图片区域的光标）
   */
  function getImageCursor(x: number, y: number): string | null {
    // 如果有选中的图片，检查是否在控制点上
    if (selectedImageId.value) {
      const image = model.getFloatingImage(selectedImageId.value)
      if (image) {
        const pos = calculateImagePosition(
          image,
          viewport,
          getSizes(),
          getGeometryConfig()
        )

        const handle = getHandleAtPoint(x, y, pos)
        if (handle) {
          return getCursorForHandle(handle)
        }

        if (isPointInImage(x, y, pos)) {
          return 'move'
        }
      }
    }

    // 检查是否悬停在其他图片上
    const hoverImage = getImageAtPoint(x, y)
    if (hoverImage) {
      return 'pointer'
    }

    return null
  }

  /**
   * 处理图片鼠标按下
   * @returns 是否已处理该事件
   */
  function handleImageMouseDown(e: MouseEvent): boolean {
    const x = e.offsetX
    const y = e.offsetY

    // 如果有选中的图片，先检查是否点击了控制点
    if (selectedImageId.value) {
      const image = model.getFloatingImage(selectedImageId.value)
      if (image) {
        const pos = calculateImagePosition(
          image,
          viewport,
          getSizes(),
          getGeometryConfig()
        )

        const handle = getHandleAtPoint(x, y, pos)
        if (handle) {
          // 开始调整大小
          isImageResizing.value = true
          resizeHandle.value = handle
          dragStartX = x
          dragStartY = y
          dragStartImage = { ...image }
          return true
        }

        if (isPointInImage(x, y, pos)) {
          // 开始拖拽
          isImageDragging.value = true
          dragStartX = x
          dragStartY = y
          dragStartImage = { ...image }
          return true
        }
      }
    }

    // 检查是否点击了其他图片
    const clickedImage = getImageAtPoint(x, y)
    if (clickedImage) {
      selectedImageId.value = clickedImage.id
      // 开始拖拽
      isImageDragging.value = true
      dragStartX = x
      dragStartY = y
      dragStartImage = { ...clickedImage }
      requestDraw()
      return true
    }

    // 点击空白区域，清除选择
    if (selectedImageId.value) {
      selectedImageId.value = null
      requestDraw()
    }

    return false
  }

  /**
   * 处理图片鼠标移动
   * @returns 是否已处理该事件
   */
  function handleImageMouseMove(e: MouseEvent): boolean {
    const x = e.offsetX
    const y = e.offsetY

    if (isImageDragging.value && dragStartImage) {
      // 计算移动距离
      const deltaX = x - dragStartX
      const deltaY = y - dragStartY

      // 计算新的偏移量
      const newOffsetX = dragStartImage.offsetX + deltaX
      const newOffsetY = dragStartImage.offsetY + deltaY

      // 更新图片位置
      model.updateFloatingImage(dragStartImage.id, {
        offsetX: newOffsetX,
        offsetY: newOffsetY
      })

      requestDraw()
      return true
    }

    if (isImageResizing.value && dragStartImage && resizeHandle.value) {
      // 计算调整量
      const deltaX = x - dragStartX
      const deltaY = y - dragStartY

      // 计算新尺寸
      const lockAspectRatio = e.shiftKey
      const result = calculateResizedDimensions(
        dragStartImage.width,
        dragStartImage.height,
        resizeHandle.value,
        deltaX,
        deltaY,
        lockAspectRatio,
        IMAGE_CONFIG.MIN_SIZE
      )

      // 更新图片尺寸和位置
      model.updateFloatingImage(dragStartImage.id, {
        width: result.width,
        height: result.height,
        offsetX: dragStartImage.offsetX + result.offsetDeltaX,
        offsetY: dragStartImage.offsetY + result.offsetDeltaY
      })

      requestDraw()
      return true
    }

    return false
  }

  /**
   * 处理全局鼠标移动（用于鼠标移出容器时继续拖拽/调整大小）
   * @returns 是否已处理该事件
   */
  function handleGlobalImageMouseMove(e: MouseEvent): boolean {
    // 只在拖拽或调整大小状态下处理
    if (!isImageDragging.value && !isImageResizing.value) {
      return false
    }
    if (!dragStartImage) {
      return false
    }

    // 获取容器位置
    const container = getContainer()
    if (!container) return false

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isImageDragging.value) {
      // 计算移动距离
      const deltaX = x - dragStartX
      const deltaY = y - dragStartY

      // 计算新的偏移量
      const newOffsetX = dragStartImage.offsetX + deltaX
      const newOffsetY = dragStartImage.offsetY + deltaY

      // 更新图片位置
      model.updateFloatingImage(dragStartImage.id, {
        offsetX: newOffsetX,
        offsetY: newOffsetY
      })

      requestDraw()
      return true
    }

    if (isImageResizing.value && resizeHandle.value) {
      // 计算调整量
      const deltaX = x - dragStartX
      const deltaY = y - dragStartY

      // 计算新尺寸
      const lockAspectRatio = e.shiftKey
      const result = calculateResizedDimensions(
        dragStartImage.width,
        dragStartImage.height,
        resizeHandle.value,
        deltaX,
        deltaY,
        lockAspectRatio,
        IMAGE_CONFIG.MIN_SIZE
      )

      // 更新图片尺寸和位置
      model.updateFloatingImage(dragStartImage.id, {
        width: result.width,
        height: result.height,
        offsetX: dragStartImage.offsetX + result.offsetDeltaX,
        offsetY: dragStartImage.offsetY + result.offsetDeltaY
      })

      requestDraw()
      return true
    }

    return false
  }

  /**
   * 处理图片鼠标抬起
   */
  function handleImageMouseUp(): void {
    if ((isImageDragging.value || isImageResizing.value) && dragStartImage) {
      const image = model.getFloatingImage(dragStartImage.id)
      if (image) {
        // 重新计算锚点（如果移动了较大距离）
        if (isImageDragging.value) {
          const pos = calculateImagePosition(
            image,
            viewport,
            getSizes(),
            getGeometryConfig()
          )

          const newAnchor = calculateAnchorFromPosition(
            pos.x,
            pos.y,
            viewport,
            getSizes(),
            getGeometryConfig(),
            totalRows,
            totalCols
          )

          // 注册撤销操作
          const oldImage = { ...dragStartImage }
          const newImage = {
            ...image,
            anchorRow: newAnchor.anchorRow,
            anchorCol: newAnchor.anchorCol,
            offsetX: newAnchor.offsetX,
            offsetY: newAnchor.offsetY
          }

          undoRedoExec.execute({
            name: '移动图片',
            redo: () => {
              model.updateFloatingImage(image.id, {
                anchorRow: newImage.anchorRow,
                anchorCol: newImage.anchorCol,
                offsetX: newImage.offsetX,
                offsetY: newImage.offsetY
              })
              requestDraw()
            },
            undo: () => {
              model.updateFloatingImage(image.id, {
                anchorRow: oldImage.anchorRow,
                anchorCol: oldImage.anchorCol,
                offsetX: oldImage.offsetX,
                offsetY: oldImage.offsetY
              })
              requestDraw()
            }
          })
        } else if (isImageResizing.value) {
          // 注册撤销操作
          const oldImage = { ...dragStartImage }
          const newImage = { ...image }

          undoRedoExec.execute({
            name: '调整图片大小',
            redo: () => {
              model.updateFloatingImage(image.id, {
                width: newImage.width,
                height: newImage.height,
                offsetX: newImage.offsetX,
                offsetY: newImage.offsetY
              })
              requestDraw()
            },
            undo: () => {
              model.updateFloatingImage(image.id, {
                width: oldImage.width,
                height: oldImage.height,
                offsetX: oldImage.offsetX,
                offsetY: oldImage.offsetY
              })
              requestDraw()
            }
          })
        }
      }
    }

    isImageDragging.value = false
    isImageResizing.value = false
    resizeHandle.value = null
    dragStartImage = null
  }

  /**
   * 处理图片键盘事件
   * @returns 是否已处理该事件
   */
  function handleImageKeyDown(e: KeyboardEvent): boolean {
    if (!selectedImageId.value) return false

    // Delete / Backspace 删除图片
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedImage()
      return true
    }

    // Escape 取消选择
    if (e.key === 'Escape') {
      clearImageSelection()
      return true
    }

    // 方向键微调位置
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const image = model.getFloatingImage(selectedImageId.value)
      if (!image) return false

      const step = e.shiftKey ? 10 : 1
      let deltaX = 0
      let deltaY = 0

      switch (e.key) {
        case 'ArrowUp': deltaY = -step; break
        case 'ArrowDown': deltaY = step; break
        case 'ArrowLeft': deltaX = -step; break
        case 'ArrowRight': deltaX = step; break
      }

      const oldOffsetX = image.offsetX
      const oldOffsetY = image.offsetY
      const newOffsetX = oldOffsetX + deltaX
      const newOffsetY = oldOffsetY + deltaY

      undoRedoExec.execute({
        name: '移动图片',
        redo: () => {
          model.updateFloatingImage(image.id, { offsetX: newOffsetX, offsetY: newOffsetY })
          requestDraw()
        },
        undo: () => {
          model.updateFloatingImage(image.id, { offsetX: oldOffsetX, offsetY: oldOffsetY })
          requestDraw()
        }
      })

      e.preventDefault()
      return true
    }

    return false
  }

  /**
   * 插入图片（从文件）
   */
  async function insertImage(file: File): Promise<string | null> {
    try {
      const dataUrl = await fileToDataURL(file)
      const loadedImg = await imageLoader.loadImage(dataUrl)

      // 计算初始显示尺寸
      const size = calculateInitialSize(
        loadedImg.naturalWidth,
        loadedImg.naturalHeight,
        IMAGE_CONFIG.DEFAULT_MAX_SIZE
      )

      // 计算插入位置（视口中心）
      const centerX = getContainerWidth() / 2
      const centerY = getContainerHeight() / 2

      const anchor = calculateAnchorFromPosition(
        centerX - size.width / 2,
        centerY - size.height / 2,
        viewport,
        getSizes(),
        getGeometryConfig(),
        totalRows,
        totalCols
      )

      // 创建图片对象
      const imageData = {
        src: dataUrl,
        naturalWidth: loadedImg.naturalWidth,
        naturalHeight: loadedImg.naturalHeight,
        width: size.width,
        height: size.height,
        anchorRow: anchor.anchorRow,
        anchorCol: anchor.anchorCol,
        offsetX: anchor.offsetX,
        offsetY: anchor.offsetY,
        lockAspectRatio: true,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false
      }
      
      const imageId = model.addFloatingImage(imageData)
      
      // 保存完整图片数据用于撤销/重做
      const fullImageData = model.getFloatingImage(imageId)!

      // 记录撤销操作（图片已经添加，使用 record 而非 execute）
      undoRedoExec.record({
        name: '插入图片',
        redo: () => {
          model.restoreFloatingImage(fullImageData)
          selectedImageId.value = imageId
          requestDraw()
        },
        undo: () => {
          model.deleteFloatingImage(imageId)
          if (selectedImageId.value === imageId) {
            selectedImageId.value = null
          }
          requestDraw()
        }
      })

      // 选中新插入的图片
      selectedImageId.value = imageId
      requestDraw()

      return imageId
    } catch (error) {
      console.error('Failed to insert image:', error)
      return null
    }
  }

  /**
   * 插入图片（从 URL）
   */
  async function insertImageFromUrl(
    url: string,
    initialWidth?: number,
    initialHeight?: number
  ): Promise<string | null> {
    try {
      const img = await imageLoader.loadImage(url)

      // 计算初始显示尺寸
      const size = initialWidth && initialHeight
        ? { width: initialWidth, height: initialHeight }
        : calculateInitialSize(
            img.naturalWidth,
            img.naturalHeight,
            IMAGE_CONFIG.DEFAULT_MAX_SIZE
          )

      // 计算插入位置（视口中心）
      const centerX = getContainerWidth() / 2
      const centerY = getContainerHeight() / 2

      const anchor = calculateAnchorFromPosition(
        centerX - size.width / 2,
        centerY - size.height / 2,
        viewport,
        getSizes(),
        getGeometryConfig(),
        totalRows,
        totalCols
      )

      // 创建图片对象
      const imageData = {
        src: url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: size.width,
        height: size.height,
        anchorRow: anchor.anchorRow,
        anchorCol: anchor.anchorCol,
        offsetX: anchor.offsetX,
        offsetY: anchor.offsetY,
        lockAspectRatio: true,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false
      }
      
      const imageId = model.addFloatingImage(imageData)
      
      // 保存完整图片数据用于撤销/重做
      const fullImageData = model.getFloatingImage(imageId)!

      // 记录撤销操作（图片已经添加，使用 record 而非 execute）
      undoRedoExec.record({
        name: '插入图片',
        redo: () => {
          model.restoreFloatingImage(fullImageData)
          selectedImageId.value = imageId
          requestDraw()
        },
        undo: () => {
          model.deleteFloatingImage(imageId)
          if (selectedImageId.value === imageId) {
            selectedImageId.value = null
          }
          requestDraw()
        }
      })

      // 选中新插入的图片
      selectedImageId.value = imageId
      requestDraw()

      return imageId
    } catch (error) {
      console.error('Failed to insert image from URL:', error)
      return null
    }
  }

  /**
   * 删除选中的图片
   */
  function deleteSelectedImage(): void {
    if (!selectedImageId.value) return

    const image = model.getFloatingImage(selectedImageId.value)
    if (!image) return

    const deletedImage = { ...image }
    const imageId = selectedImageId.value

    undoRedoExec.execute({
      name: '删除图片',
      redo: () => {
        model.deleteFloatingImage(imageId)
        if (selectedImageId.value === imageId) {
          selectedImageId.value = null
        }
        requestDraw()
      },
      undo: () => {
        model.restoreFloatingImage(deletedImage)
        selectedImageId.value = imageId
        requestDraw()
      }
    })
  }

  /**
   * 清除图片选择
   */
  function clearImageSelection(): void {
    if (selectedImageId.value) {
      selectedImageId.value = null
      requestDraw()
    }
  }

  /**
   * 上移一层
   */
  function bringSelectedImageForward(): void {
    if (!selectedImageId.value) return

    const image = model.getFloatingImage(selectedImageId.value)
    if (!image) return

    const allImages = model.getAllFloatingImages()
    const sortedImages = [...allImages].sort((a, b) => a.zIndex - b.zIndex)
    const currentIndex = sortedImages.findIndex(img => img.id === image.id)

    if (currentIndex < sortedImages.length - 1) {
      const targetImage = sortedImages[currentIndex + 1]
      if (!targetImage) return
      
      const oldZIndex = image.zIndex
      const targetId = targetImage.id
      const newZIndex = targetImage.zIndex

      undoRedoExec.execute({
        name: '上移一层',
        redo: () => {
          model.bringImageForward(image.id)
          requestDraw()
        },
        undo: () => {
          // 恢复原来的 zIndex
          model.updateFloatingImage(image.id, { zIndex: oldZIndex })
          model.updateFloatingImage(targetId, { zIndex: newZIndex })
          requestDraw()
        }
      })
    }
  }

  /**
   * 下移一层
   */
  function sendSelectedImageBackward(): void {
    if (!selectedImageId.value) return

    const image = model.getFloatingImage(selectedImageId.value)
    if (!image) return

    const allImages = model.getAllFloatingImages()
    const sortedImages = [...allImages].sort((a, b) => a.zIndex - b.zIndex)
    const currentIndex = sortedImages.findIndex(img => img.id === image.id)

    if (currentIndex > 0) {
      const targetImage = sortedImages[currentIndex - 1]
      if (!targetImage) return
      
      const oldZIndex = image.zIndex
      const targetId = targetImage.id
      const newZIndex = targetImage.zIndex

      undoRedoExec.execute({
        name: '下移一层',
        redo: () => {
          model.sendImageBackward(image.id)
          requestDraw()
        },
        undo: () => {
          // 恢复原来的 zIndex
          model.updateFloatingImage(image.id, { zIndex: oldZIndex })
          model.updateFloatingImage(targetId, { zIndex: newZIndex })
          requestDraw()
        }
      })
    }
  }

  /**
   * 置于顶层
   */
  function bringSelectedImageToFront(): void {
    if (!selectedImageId.value) return

    const image = model.getFloatingImage(selectedImageId.value)
    if (!image) return

    const oldZIndex = image.zIndex

    undoRedoExec.execute({
      name: '置于顶层',
      redo: () => {
        model.bringImageToFront(image.id)
        requestDraw()
      },
      undo: () => {
        model.updateFloatingImage(image.id, { zIndex: oldZIndex })
        requestDraw()
      }
    })
  }

  /**
   * 置于底层
   */
  function sendSelectedImageToBack(): void {
    if (!selectedImageId.value) return

    const image = model.getFloatingImage(selectedImageId.value)
    if (!image) return

    const oldZIndex = image.zIndex

    undoRedoExec.execute({
      name: '置于底层',
      redo: () => {
        model.sendImageToBack(image.id)
        requestDraw()
      },
      undo: () => {
        model.updateFloatingImage(image.id, { zIndex: oldZIndex })
        requestDraw()
      }
    })
  }

  // ==================== 单元格内嵌图片方法 ====================
  
  // 图片预览状态
  const imagePreviewState = ref<ImagePreviewState>({ ...DEFAULT_IMAGE_PREVIEW_STATE })

  /**
   * 插入单元格内嵌图片（从文件）
   */
  async function insertCellImage(
    row: number,
    col: number,
    file: File,
    horizontalAlign: CellImageAlignment = 'center',
    verticalAlign: CellImageVerticalAlign = 'middle'
  ): Promise<string | null> {
    try {
      const dataUrl = await fileToDataURL(file)
      
      // 预加载图片获取原始尺寸
      const img = await imageCache.load(dataUrl)
      
      const imageData = {
        src: dataUrl,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        horizontalAlign,
        verticalAlign
      }
      
      const imageId = model.addCellImage(row, col, imageData)
      
      // 保存完整图片数据用于撤销/重做
      const addedImage = model.getCellImages(row, col).find(i => i.id === imageId)
      if (!addedImage) return null

      // 记录撤销操作
      undoRedoExec.record({
        name: '插入单元格图片',
        redo: () => {
          model.addCellImage(row, col, { ...imageData, id: imageId, timestamp: addedImage.timestamp } as any)
          requestDraw()
        },
        undo: () => {
          model.removeCellImage(row, col, imageId)
          requestDraw()
        }
      })

      requestDraw()
      return imageId
    } catch (error) {
      console.error('Failed to insert cell image:', error)
      return null
    }
  }

  /**
   * 插入单元格内嵌图片（从 URL）
   */
  async function insertCellImageFromUrl(
    row: number,
    col: number,
    url: string,
    horizontalAlign: CellImageAlignment = 'center',
    verticalAlign: CellImageVerticalAlign = 'middle'
  ): Promise<string | null> {
    try {
      // 预加载图片获取原始尺寸
      const img = await imageCache.load(url)
      
      const imageData = {
        src: url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        horizontalAlign,
        verticalAlign
      }
      
      const imageId = model.addCellImage(row, col, imageData)
      
      // 保存完整图片数据用于撤销/重做
      const addedImage = model.getCellImages(row, col).find(i => i.id === imageId)
      if (!addedImage) return null

      // 记录撤销操作
      undoRedoExec.record({
        name: '插入单元格图片',
        redo: () => {
          model.addCellImage(row, col, { ...imageData, id: imageId, timestamp: addedImage.timestamp } as any)
          requestDraw()
        },
        undo: () => {
          model.removeCellImage(row, col, imageId)
          requestDraw()
        }
      })

      requestDraw()
      return imageId
    } catch (error) {
      console.error('Failed to insert cell image from URL:', error)
      return null
    }
  }

  /**
   * 移除单元格的某张图片
   */
  function removeCellImage(row: number, col: number, imageId: string): void {
    const removedImage = model.removeCellImage(row, col, imageId)
    if (!removedImage) return

    undoRedoExec.record({
      name: '删除单元格图片',
      redo: () => {
        model.removeCellImage(row, col, imageId)
        requestDraw()
      },
      undo: () => {
        // 恢复图片（需要重新添加）
        model.addCellImage(row, col, {
          src: removedImage.src,
          naturalWidth: removedImage.naturalWidth,
          naturalHeight: removedImage.naturalHeight,
          horizontalAlign: removedImage.horizontalAlign,
          verticalAlign: removedImage.verticalAlign
        })
        requestDraw()
      }
    })

    requestDraw()
  }

  /**
   * 清除单元格的所有图片
   */
  function clearCellImages(row: number, col: number): void {
    const removedImages = model.clearCellImages(row, col)
    if (removedImages.length === 0) return

    undoRedoExec.record({
      name: '清除单元格图片',
      redo: () => {
        model.clearCellImages(row, col)
        requestDraw()
      },
      undo: () => {
        // 恢复所有图片
        for (const img of removedImages) {
          model.addCellImage(row, col, {
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            horizontalAlign: img.horizontalAlign,
            verticalAlign: img.verticalAlign
          })
        }
        requestDraw()
      }
    })

    requestDraw()
  }

  /**
   * 更新单元格图片的对齐方式
   */
  function updateCellImageAlignment(
    row: number,
    col: number,
    imageId: string,
    horizontalAlign?: CellImageAlignment,
    verticalAlign?: CellImageVerticalAlign
  ): void {
    const images = model.getCellImages(row, col)
    const image = images.find(i => i.id === imageId)
    if (!image) return

    const oldHAlign = image.horizontalAlign
    const oldVAlign = image.verticalAlign

    undoRedoExec.execute({
      name: '更新图片对齐',
      redo: () => {
        model.updateCellImageAlignment(row, col, imageId, horizontalAlign, verticalAlign)
        requestDraw()
      },
      undo: () => {
        model.updateCellImageAlignment(row, col, imageId, oldHAlign, oldVAlign)
        requestDraw()
      }
    })
  }

  /**
   * 打开单元格图片预览
   */
  function openCellImagePreview(row: number, col: number): void {
    const images = model.getCellImages(row, col)
    if (images.length === 0) return

    imagePreviewState.value = {
      visible: true,
      row,
      col,
      currentIndex: images.length - 1, // 默认显示最新的图片
      images: [...images]
    }
  }

  /**
   * 关闭单元格图片预览
   */
  function closeCellImagePreview(): void {
    imagePreviewState.value = { ...DEFAULT_IMAGE_PREVIEW_STATE }
  }

  /**
   * 处理预览中删除图片
   */
  function handleCellImageRemove(imageId: string): void {
    const { row, col } = imagePreviewState.value
    if (row < 0 || col < 0) return

    removeCellImage(row, col, imageId)

    // 更新预览状态
    const updatedImages = model.getCellImages(row, col)
    if (updatedImages.length === 0) {
      closeCellImagePreview()
    } else {
      imagePreviewState.value.images = [...updatedImages]
      if (imagePreviewState.value.currentIndex >= updatedImages.length) {
        imagePreviewState.value.currentIndex = updatedImages.length - 1
      }
    }
  }

  /**
   * 检测点击是否命中单元格内嵌图片
   * @returns 命中的单元格坐标，或 null
   */
  function checkCellImageClick(x: number, y: number): { row: number; col: number } | null {
    const config = getGeometryConfig()
    const sizes = getSizes()
    
    // 检查是否在数据区域内（不在表头区域）
    if (x < config.rowHeaderWidth || y < config.colHeaderHeight) {
      return null
    }
    
    // 计算点击位置对应的行列
    const scrollLeft = viewport.scrollLeft
    const scrollTop = viewport.scrollTop
    
    // 简化计算：遍历找到点击位置对应的单元格
    let accY = config.colHeaderHeight - scrollTop
    let clickedRow = -1
    for (let r = 0; r < totalRows; r++) {
      const rh = getRowHeight(r, sizes, config)
      if (y >= accY && y < accY + rh) {
        clickedRow = r
        break
      }
      accY += rh
      if (accY > getContainerHeight()) break
    }
    
    let accX = config.rowHeaderWidth - scrollLeft
    let clickedCol = -1
    for (let c = 0; c < totalCols; c++) {
      const cw = getColWidth(c, sizes, config)
      if (x >= accX && x < accX + cw) {
        clickedCol = c
        break
      }
      accX += cw
      if (accX > getContainerWidth()) break
    }
    
    if (clickedRow < 0 || clickedCol < 0) return null
    
    // 检查该单元格是否有图片
    const displayImage = model.getCellDisplayImage(clickedRow, clickedCol)
    if (!displayImage) return null
    
    // 计算单元格位置
    const cellX = config.rowHeaderWidth + getColLeft(clickedCol, sizes, config) - scrollLeft
    const cellY = config.colHeaderHeight + getRowTop(clickedRow, sizes, config) - scrollTop
    const cellWidth = getColWidth(clickedCol, sizes, config)
    const cellHeight = getRowHeight(clickedRow, sizes, config)
    
    // 获取单元格样式用于对齐方式
    const cellStyle = model.getCellStyle(clickedRow, clickedCol)
    const cellTextAlign = cellStyle?.textAlign as 'left' | 'center' | 'right' | undefined
    const cellVerticalAlign = cellStyle?.verticalAlign as 'top' | 'middle' | 'bottom' | undefined
    
    // 检测点击是否在图片区域内（使用单元格对齐方式）
    if (hitTestCellImage(x, y, displayImage, cellX, cellY, cellWidth, cellHeight, cellTextAlign, cellVerticalAlign)) {
      return { row: clickedRow, col: clickedCol }
    }
    
    return null
  }

  return {
    imageLoader,
    selectedImageId,
    isImageDragging,
    isImageResizing,
    resizeHandle,
    imageSelectionState,
    imagePreviewState,
    handleImageMouseDown,
    handleImageMouseMove,
    handleGlobalImageMouseMove,
    handleImageMouseUp,
    handleImageKeyDown,
    insertImage,
    insertImageFromUrl,
    deleteSelectedImage,
    clearImageSelection,
    getImageAtPoint,
    getImageCursor,
    bringSelectedImageForward,
    sendSelectedImageBackward,
    bringSelectedImageToFront,
    sendSelectedImageToBack,
    // 单元格内嵌图片方法
    insertCellImage,
    insertCellImageFromUrl,
    removeCellImage,
    clearCellImages,
    updateCellImageAlignment,
    openCellImagePreview,
    closeCellImagePreview,
    handleCellImageRemove,
    checkCellImageClick
  }
}
