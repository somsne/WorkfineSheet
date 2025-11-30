# 图片 API 参考

## 概述

WorkfineSheet 提供了完整的图片管理 API，通过 `SheetAPI` 接口访问。

## ImageAPI 接口

```typescript
interface ImageAPI {
  /** 从文件插入图片 */
  insertImage(file: File): Promise<string | null>
  
  /** 从 URL 插入图片 */
  insertImageFromUrl(url: string, width?: number, height?: number): Promise<string | null>
  
  /** 删除图片 */
  deleteImage(id: string): boolean
  
  /** 获取所有图片 */
  getAllImages(): Map<string, FloatingImage>
  
  /** 选择图片 */
  selectImage(id: string | null): void
  
  /** 将选中图片置于顶层 */
  bringSelectedToFront(): void
  
  /** 将选中图片置于底层 */
  sendSelectedToBack(): void
}
```

## 方法详解

### insertImage(file: File)

从本地文件插入图片。

**参数**：
- `file: File` - 图片文件对象

**返回值**：
- `Promise<string | null>` - 成功返回图片 ID，失败返回 null

**示例**：
```typescript
// 从 input 元素获取文件
const input = document.querySelector('input[type="file"]')
const file = input.files[0]

const imageId = await api.insertImage(file)
if (imageId) {
  console.log('图片插入成功:', imageId)
}
```

**支持的格式**：
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)
- SVG (.svg)

**限制**：
- 最大文件大小：10MB

---

### insertImageFromUrl(url: string, width?: number, height?: number)

从 URL 插入图片。

**参数**：
- `url: string` - 图片 URL（支持 Data URL 和 HTTP(S) URL）
- `width?: number` - 可选，指定显示宽度
- `height?: number` - 可选，指定显示高度

**返回值**：
- `Promise<string | null>` - 成功返回图片 ID，失败返回 null

**示例**：
```typescript
// 从网络 URL 插入（需要 CORS 支持）
const imageId = await api.insertImageFromUrl(
  'https://example.com/photo.png',
  200, // 宽度
  150  // 高度
)

// 从 Data URL 插入
const dataUrl = 'data:image/png;base64,iVBORw0KGgo...'
const imageId = await api.insertImageFromUrl(dataUrl)
```

**注意事项**：
- 外部 URL 需要服务器支持 CORS
- 如果不指定宽高，将自动计算合适的尺寸

---

### deleteImage(id: string)

删除指定图片。

**参数**：
- `id: string` - 图片 ID

**返回值**：
- `boolean` - 删除成功返回 true，图片不存在返回 false

**示例**：
```typescript
const deleted = api.deleteImage('img_12345')
```

---

### getAllImages()

获取所有浮动图片。

**返回值**：
- `Map<string, FloatingImage>` - 图片 ID 到图片对象的映射

**示例**：
```typescript
const images = api.getAllImages()
images.forEach((image, id) => {
  console.log(`图片 ${id}: ${image.width}x${image.height}`)
})
```

---

### selectImage(id: string | null)

选择指定图片或取消选择。

**参数**：
- `id: string | null` - 图片 ID，传 null 取消选择

**示例**：
```typescript
// 选择图片
api.selectImage('img_12345')

// 取消选择
api.selectImage(null)
```

---

### bringSelectedToFront()

将当前选中的图片移动到最顶层。

**示例**：
```typescript
api.selectImage('img_12345')
api.bringSelectedToFront()
```

---

### sendSelectedToBack()

将当前选中的图片移动到最底层。

**示例**：
```typescript
api.selectImage('img_12345')
api.sendSelectedToBack()
```

---

## FloatingImage 类型

```typescript
interface FloatingImage {
  /** 唯一标识符 */
  id: string
  
  /** 图片源 (Data URL 或外部 URL) */
  src: string
  
  /** 原始宽度（像素） */
  naturalWidth: number
  
  /** 原始高度（像素） */
  naturalHeight: number
  
  /** 显示宽度（像素） */
  width: number
  
  /** 显示高度（像素） */
  height: number
  
  /** 锚点行索引 */
  anchorRow: number
  
  /** 锚点列索引 */
  anchorCol: number
  
  /** 相对锚点单元格的 X 偏移（像素） */
  offsetX: number
  
  /** 相对锚点单元格的 Y 偏移（像素） */
  offsetY: number
  
  /** 图层索引（数值越大越靠上） */
  zIndex: number
  
  /** 是否锁定宽高比 */
  lockAspectRatio: boolean
  
  /** 旋转角度（度） */
  rotation: number
  
  /** 透明度 (0-1) */
  opacity: number
  
  /** 是否锁定（不可移动/调整） */
  locked: boolean
  
  /** 是否隐藏 */
  hidden: boolean
}
```

## 完整示例

```typescript
// 获取 SheetAPI 实例
const api: SheetAPI = sheetComponent.value?.getAPI()

// 1. 从文件插入图片
async function handleFileUpload(file: File) {
  const imageId = await api.insertImage(file)
  if (imageId) {
    // 插入成功后自动选中
    api.selectImage(imageId)
  }
}

// 2. 批量从 URL 插入
async function loadImages(urls: string[]) {
  for (const url of urls) {
    await api.insertImageFromUrl(url)
  }
}

// 3. 管理图层
function arrangeImages() {
  const images = api.getAllImages()
  const ids = Array.from(images.keys())
  
  // 选择第一张图片并置于顶层
  if (ids.length > 0) {
    api.selectImage(ids[0])
    api.bringSelectedToFront()
  }
}

// 4. 清除所有图片
function clearAllImages() {
  const images = api.getAllImages()
  images.forEach((_, id) => {
    api.deleteImage(id)
  })
}
```

## 事件处理

图片操作会触发重绘，无需手动调用刷新方法。所有操作都支持撤销/重做：

```typescript
// 插入图片后可以撤销
await api.insertImage(file)
api.undo()  // 撤销插入

// 删除图片后可以还原
api.deleteImage(imageId)
api.undo()  // 还原删除
```

## 相关文档

- [浮动图片功能指南](../features/FLOATING_IMAGES.md)
- [API 参考](./API_REFERENCE.md)
