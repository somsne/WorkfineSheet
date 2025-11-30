# 单元格内嵌图片功能指南

## 概述

WorkfineSheet 支持在单元格内部嵌入图片（类似 Excel 的"放置在单元格中"模式）。图片跟随单元格大小自动适应，支持对齐方式、多图预览和删除管理。

## 功能特性

### 1. 图片插入
- **工具栏按钮**：点击工具栏的 📷 按钮选择本地图片文件
- **支持格式**：JPEG, PNG, GIF, WebP, BMP, SVG
- **支持多选**：可同时选择多个图片文件插入到当前单元格
- **最大文件大小**：10MB（单个）

### 2. 图片显示
- **自动适应**：图片自动缩放以适应单元格大小，保持宽高比
- **跟随对齐**：图片对齐方式跟随单元格的文本对齐设置
  - 水平对齐：左对齐 / 居中 / 右对齐
  - 垂直对齐：顶部 / 居中 / 底部
- **多图处理**：一个单元格可包含多张图片，默认显示最新添加的一张
- **角标计数**：当单元格有多张图片时，右上角显示数量角标

### 3. 图片预览
- **点击预览**：点击单元格图片打开全屏预览窗口
- **缩略图列表**：预览窗口底部显示所有图片缩略图（最新的在前）
- **导航切换**：左右箭头键或点击缩略图切换图片
- **关闭预览**：
  - 点击遮罩区域（图片外部）
  - 点击右上角关闭按钮
  - 按 ESC 键

### 4. 图片管理
- **删除图片**：在预览窗口中点击删除按钮可删除当前图片
- **清空图片**：通过 API 可清空单元格的所有图片

## 使用方法

### 通过工具栏插入

1. 选中目标单元格
2. 点击工具栏的图片下拉菜单
3. 选择「插入单元格图片」
4. 选择一个或多个图片文件
5. 图片自动插入到当前单元格

### 预览和管理

1. 点击带有图片的单元格
2. 预览窗口打开，显示大图和缩略图列表
3. 点击缩略图切换查看不同图片
4. 点击删除按钮可删除当前图片
5. 点击遮罩区域或按 ESC 关闭预览

## API 参考

### 插入图片

```typescript
// 从文件插入
const imageId = await api.insertCellImage(file, row?, col?)

// 从 URL 插入
const imageId = await api.insertCellImageFromUrl(url, row?, col?)
```

### 获取图片信息

```typescript
// 获取单元格所有图片
const images = api.getCellImages(row, col)

// 获取显示的图片（最新一张）
const displayImage = api.getCellDisplayImage(row, col)

// 获取图片数量
const count = api.getCellImageCount(row, col)
```

### 删除图片

```typescript
// 删除指定图片
api.removeCellImage(row, col, imageId)

// 清空所有图片
api.clearCellImages(row, col)
```

### 预览控制

```typescript
// 打开预览
api.openCellImagePreview(row, col)

// 关闭预览
api.closeCellImagePreview()
```

## 数据结构

### CellImage 接口

```typescript
interface CellImage {
  id: string                    // 唯一标识
  src: string                   // 图片 URL 或 DataURL
  naturalWidth: number          // 原始宽度
  naturalHeight: number         // 原始高度
  horizontalAlign?: 'left' | 'center' | 'right'   // 水平对齐
  verticalAlign?: 'top' | 'middle' | 'bottom'     // 垂直对齐
  addedAt: number               // 添加时间戳
}
```

## 与浮动图片的区别

| 特性 | 单元格内嵌图片 | 浮动图片 |
|------|--------------|---------|
| 位置 | 固定在单元格内 | 自由浮动 |
| 大小 | 自动适应单元格 | 可自由调整 |
| 对齐 | 跟随单元格对齐 | 无对齐概念 |
| 移动 | 随单元格移动 | 拖拽移动 |
| 交互 | 点击打开预览 | 点击选中编辑 |
| 数量 | 单元格可多张 | 独立存在 |
| 图层 | 无图层概念 | 支持图层排序 |

## 示例数据

演示区域位于 **L26-N30**，展示了：
- 不同对齐方式的图片显示效果（左/中/右对齐）
- 点击图片进入预览模式
- 多图显示最新图片并带角标

## 键盘快捷键

| 快捷键 | 功能 |
|--------|-----|
| ESC | 关闭图片预览 |
| ← | 预览中切换到上一张 |
| → | 预览中切换到下一张 |

## 注意事项

1. **图片对齐**：图片的实际显示位置由单元格的 `textAlign` 和 `verticalAlign` 样式决定
2. **点击区域**：只有点击图片本身（而非整个单元格）才会触发预览
3. **图片缓存**：已加载的图片会被缓存，重复显示时无需重新加载
4. **性能优化**：大量图片单元格滚动时采用延迟加载策略
