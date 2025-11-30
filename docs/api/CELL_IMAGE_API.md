# 单元格内嵌图片 API 参考

## 概述

本文档描述单元格内嵌图片功能的完整 API 接口。

## SheetAPI 方法

### 插入图片

#### insertCellImage

从文件插入图片到单元格。

```typescript
insertCellImage(file: File, row?: number, col?: number): Promise<string | null>
```

**参数：**
- `file` - 图片文件对象
- `row` - 目标行（可选，默认当前选中行）
- `col` - 目标列（可选，默认当前选中列）

**返回值：**
- 成功返回图片 ID（字符串）
- 失败返回 `null`

**示例：**
```typescript
const input = document.createElement('input')
input.type = 'file'
input.accept = 'image/*'
input.onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    const imageId = await api.insertCellImage(file, 0, 0)
    console.log('Inserted image:', imageId)
  }
}
input.click()
```

---

#### insertCellImageFromUrl

从 URL 插入图片到单元格。

```typescript
insertCellImageFromUrl(url: string, row?: number, col?: number): Promise<string | null>
```

**参数：**
- `url` - 图片 URL 或 DataURL
- `row` - 目标行（可选，默认当前选中行）
- `col` - 目标列（可选，默认当前选中列）

**返回值：**
- 成功返回图片 ID
- 失败返回 `null`

**示例：**
```typescript
const imageId = await api.insertCellImageFromUrl(
  'https://example.com/image.png',
  5,
  3
)
```

---

### 获取图片信息

#### getCellImages

获取单元格的所有图片。

```typescript
getCellImages(row: number, col: number): CellImage[]
```

**参数：**
- `row` - 行索引
- `col` - 列索引

**返回值：**
- 图片数组，按添加时间排序（最早的在前）

**示例：**
```typescript
const images = api.getCellImages(0, 0)
images.forEach(img => {
  console.log(`Image ${img.id}: ${img.naturalWidth}x${img.naturalHeight}`)
})
```

---

#### getCellDisplayImage

获取单元格显示的图片（最新添加的一张）。

```typescript
getCellDisplayImage(row: number, col: number): CellImage | null
```

**参数：**
- `row` - 行索引
- `col` - 列索引

**返回值：**
- 返回最新的图片对象，无图片时返回 `null`

---

#### getCellImageCount

获取单元格的图片数量。

```typescript
getCellImageCount(row: number, col: number): number
```

**参数：**
- `row` - 行索引
- `col` - 列索引

**返回值：**
- 图片数量

---

### 删除图片

#### removeCellImage

删除单元格中的指定图片。

```typescript
removeCellImage(row: number, col: number, imageId: string): void
```

**参数：**
- `row` - 行索引
- `col` - 列索引
- `imageId` - 要删除的图片 ID

**示例：**
```typescript
const images = api.getCellImages(0, 0)
if (images.length > 0) {
  api.removeCellImage(0, 0, images[0].id)
}
```

---

#### clearCellImages

清空单元格的所有图片。

```typescript
clearCellImages(row: number, col: number): void
```

**参数：**
- `row` - 行索引
- `col` - 列索引

**示例：**
```typescript
api.clearCellImages(0, 0)
```

---

### 对齐方式

#### updateCellImageAlignment

更新单元格图片的对齐方式。

```typescript
updateCellImageAlignment(
  row: number, 
  col: number, 
  imageId: string, 
  alignment: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'middle' | 'bottom'
  }
): void
```

**参数：**
- `row` - 行索引
- `col` - 列索引
- `imageId` - 图片 ID
- `alignment` - 对齐方式对象

**示例：**
```typescript
const displayImage = api.getCellDisplayImage(0, 0)
if (displayImage) {
  api.updateCellImageAlignment(0, 0, displayImage.id, {
    horizontal: 'center',
    vertical: 'middle'
  })
}
```

> **注意**：实际显示时，图片对齐会优先使用单元格的 `textAlign` 和 `verticalAlign` 样式。

---

### 预览控制

#### openCellImagePreview

打开单元格图片预览窗口。

```typescript
openCellImagePreview(row: number, col: number): void
```

**参数：**
- `row` - 行索引
- `col` - 列索引

**示例：**
```typescript
// 打开 A1 单元格的图片预览
api.openCellImagePreview(0, 0)
```

---

#### closeCellImagePreview

关闭图片预览窗口。

```typescript
closeCellImagePreview(): void
```

---

## 类型定义

### CellImage

```typescript
interface CellImage {
  /** 唯一标识符 */
  id: string
  
  /** 图片源（URL 或 DataURL） */
  src: string
  
  /** 图片原始宽度 */
  naturalWidth: number
  
  /** 图片原始高度 */
  naturalHeight: number
  
  /** 水平对齐方式 */
  horizontalAlign?: 'left' | 'center' | 'right'
  
  /** 垂直对齐方式 */
  verticalAlign?: 'top' | 'middle' | 'bottom'
  
  /** 添加时间戳 */
  addedAt: number
}
```

### CellImageAlignment

```typescript
type CellImageAlignment = 'left' | 'center' | 'right'
```

### CellImageVerticalAlign

```typescript
type CellImageVerticalAlign = 'top' | 'middle' | 'bottom'
```

---

## 内部方法（Composables）

以下方法在 `useSheetImages` composable 中使用，通常不直接调用：

### insertCellImage (内部)

```typescript
async function insertCellImage(
  row: number,
  col: number,
  file: File
): Promise<string | null>
```

### insertCellImageFromUrl (内部)

```typescript
async function insertCellImageFromUrl(
  row: number,
  col: number,
  url: string
): Promise<string | null>
```

### checkCellImageClick

检测点击是否命中单元格内嵌图片。

```typescript
function checkCellImageClick(
  x: number, 
  y: number
): { row: number; col: number } | null
```

---

## 渲染相关函数

### renderCellImage

渲染单元格内嵌图片。

```typescript
function renderCellImage(
  ctx: CanvasRenderingContext2D,
  image: CellImage,
  imgElement: HTMLImageElement,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  cellTextAlign?: 'left' | 'center' | 'right',
  cellVerticalAlign?: 'top' | 'middle' | 'bottom'
): void
```

### hitTestCellImage

检测点击是否命中图片区域。

```typescript
function hitTestCellImage(
  clickX: number,
  clickY: number,
  image: CellImage,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  cellTextAlign?: 'left' | 'center' | 'right',
  cellVerticalAlign?: 'top' | 'middle' | 'bottom'
): boolean
```

### calculateImageSize

计算图片在单元格内的显示尺寸（保持宽高比）。

```typescript
function calculateImageSize(
  naturalWidth: number,
  naturalHeight: number,
  availableWidth: number,
  availableHeight: number
): { width: number; height: number }
```

### calculateImagePosition

计算图片在单元格内的显示位置。

```typescript
function calculateImagePosition(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  imageWidth: number,
  imageHeight: number,
  horizontalAlign: 'left' | 'center' | 'right',
  verticalAlign: 'top' | 'middle' | 'bottom'
): { x: number; y: number }
```

---

## 配置常量

```typescript
const CELL_IMAGE_CONFIG = {
  PADDING: 4,        // 图片与单元格边框的内边距
  BADGE_SIZE: 18,    // 多图角标尺寸
  BADGE_OFFSET: 4    // 角标距离单元格边角的偏移
}
```

---

## 事件

### 图片预览事件

预览组件通过 `emit` 发出以下事件：

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `close` | - | 关闭预览 |
| `select` | `index: number` | 选择缩略图 |
| `remove` | `imageId: string` | 删除图片 |

---

## 使用示例

### 完整工作流程

```typescript
// 1. 插入图片
const imageId = await api.insertCellImageFromUrl(
  'data:image/png;base64,iVBORw0KGgo...',
  0,
  0
)

// 2. 获取图片信息
const count = api.getCellImageCount(0, 0)
console.log(`Cell has ${count} image(s)`)

// 3. 更新对齐方式
if (imageId) {
  api.updateCellImageAlignment(0, 0, imageId, {
    horizontal: 'center',
    vertical: 'middle'
  })
}

// 4. 打开预览
api.openCellImagePreview(0, 0)

// 5. 删除图片
if (imageId) {
  api.removeCellImage(0, 0, imageId)
}
```
