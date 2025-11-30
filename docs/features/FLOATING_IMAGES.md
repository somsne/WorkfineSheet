# 浮动图片功能指南

## 概述

WorkfineSheet 支持在电子表格上插入和管理浮动图片（类似 Excel 的"放置在单元格上"模式）。图片独立于单元格绘制在内容画布（contentCanvas）上，支持选择、拖拽移动、调整大小和图层管理。

## 功能特性

### 1. 图片插入
- **工具栏按钮**：点击工具栏的 🖼️ 按钮选择本地图片文件
- **支持格式**：JPEG, PNG, GIF, WebP, BMP, SVG
- **最大文件大小**：10MB
- **插入位置**：默认插入到视口中心

### 2. 图片交互
- **选择**：单击图片选中，显示选中边框和调整手柄
- **拖拽移动**：选中后拖拽图片可移动位置
- **调整大小**：拖拽四角或四边的调整手柄
- **保持宽高比**：按住 Shift 键调整大小时保持宽高比（默认锁定）
- **删除**：选中图片后按 Delete/Backspace 键删除

### 3. 图层管理
- **右键菜单**：右键点击图片显示上下文菜单
  - 上移一层：将图片向上移动一层
  - 下移一层：将图片向下移动一层
- **快捷键**：（在 API 中可调用）
  - 置于顶层
  - 置于底层

### 4. 锚点系统
图片使用锚点定位系统：
- `anchorRow`, `anchorCol`：锚定到的单元格行列
- `offsetX`, `offsetY`：相对于锚点单元格左上角的像素偏移
- 当滚动表格时，图片随锚点单元格移动

## 使用方法

### 通过工具栏插入
1. 点击工具栏的图片按钮 (🖼️)
2. 选择本地图片文件
3. 图片自动插入到视口中心位置

### 通过 API 插入
```typescript
// 从文件插入
const imageId = await api.insertImage(file)

// 从 URL 插入
const imageId = await api.insertImageFromUrl('https://example.com/image.png', 200, 150)
```

### 操作图片
```typescript
// 选择图片
api.selectImage(imageId)

// 删除图片
api.deleteImage(imageId)

// 获取所有图片
const images = api.getAllImages()

// 图层操作
api.bringSelectedToFront()
api.sendSelectedToBack()
```

## 技术架构

### 文件结构
```
src/components/sheet/
├── images/
│   ├── index.ts           # 模块导出
│   ├── imageLoader.ts     # 图片加载与缓存
│   ├── imageGeometry.ts   # 位置计算
│   └── renderImages.ts    # 渲染逻辑
├── composables/
│   └── useSheetImages.ts  # 图片交互 composable
└── types.ts               # FloatingImage 类型定义
```

### 数据结构

```typescript
interface FloatingImage {
  id: string                    // 唯一标识
  src: string                   // 图片源 (Data URL 或外部 URL)
  naturalWidth: number          // 原始宽度
  naturalHeight: number         // 原始高度
  width: number                 // 显示宽度
  height: number                // 显示高度
  anchorRow: number             // 锚点行
  anchorCol: number             // 锚点列
  offsetX: number               // X 偏移
  offsetY: number               // Y 偏移
  zIndex: number                // 图层索引
  lockAspectRatio: boolean      // 锁定宽高比
  rotation: number              // 旋转角度（度）
  opacity: number               // 透明度 (0-1)
  locked: boolean               // 锁定状态
  hidden: boolean               // 隐藏状态
}
```

### 渲染流程
1. `CanvasSheet.vue` 在绘制单元格内容后调用 `renderFloatingImagesIfNeeded`
2. `renderImages.ts` 遍历所有图片，按 z-index 排序后绘制
3. 选中的图片额外绘制选中边框和调整手柄

### 交互流程
1. 鼠标事件首先传递给 `useSheetImages` 检查图片交互
2. 如果点击/拖拽在图片上，由图片模块处理
3. 否则传递给正常的单元格事件处理

## 配置常量

```typescript
const IMAGE_CONFIG = {
  HANDLE_SIZE: 8,              // 调整手柄大小
  SELECTION_COLOR: '#0066cc',  // 选中边框颜色
  SELECTION_WIDTH: 2,          // 选中边框宽度
  HANDLE_FILL_COLOR: '#ffffff', // 手柄填充色
  DEFAULT_MAX_SIZE: 400,       // 默认最大尺寸
  MIN_SIZE: 20,                // 最小尺寸
  CACHE_MAX_SIZE: 50           // LRU 缓存最大数量
}
```

## 撤销/重做支持

所有图片操作都支持撤销重做：
- 插入图片
- 删除图片
- 移动图片
- 调整大小
- 图层变更

## 限制与注意事项

1. **文件大小限制**：最大 10MB
2. **图片缓存**：LRU 策略，最多缓存 50 张图片
3. **跨域图片**：外部 URL 需要支持 CORS
4. **性能建议**：单个表格建议不超过 100 张图片

## 相关文档

- [图片 API 参考](../api/IMAGE_API.md)
- [API 参考](../api/API_REFERENCE.md)
