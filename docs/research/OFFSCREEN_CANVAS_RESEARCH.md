# OffscreenCanvas + Web Worker 多线程渲染研究

## 1. 概述

本文档研究在 WorkfineSheet 项目中使用 OffscreenCanvas 结合 Web Workers 来提升表格渲染性能的可行性、实现方案和注意事项。

## 2. 技术背景

### 2.1 OffscreenCanvas 简介

OffscreenCanvas 是一个可以在 Web Worker 中使用的 Canvas API，允许在后台线程进行 Canvas 渲染，从而避免阻塞主线程。

**主要优势：**
- **非阻塞渲染**：复杂的绘制操作在 Worker 线程执行，不会阻塞主线程的用户交互
- **并行处理**：多个 Worker 可以同时处理不同的渲染任务
- **更好的帧率稳定性**：主线程专注于事件处理，渲染线程专注于绘制

**基本用法：**
```javascript
// 主线程
const canvas = document.getElementById('myCanvas')
const offscreen = canvas.transferControlToOffscreen()

const worker = new Worker('render-worker.js')
worker.postMessage({ canvas: offscreen }, [offscreen])

// Worker 线程 (render-worker.js)
self.onmessage = (e) => {
  const canvas = e.data.canvas
  const ctx = canvas.getContext('2d')
  // 在 Worker 中进行渲染
}
```

### 2.2 Web Workers 数据通信方式

#### 2.2.1 postMessage (结构化克隆)
- **优点**：简单易用，支持大多数数据类型
- **缺点**：数据需要序列化/反序列化，有性能开销
- **适用场景**：小到中等规模的数据传输

#### 2.2.2 Transferable Objects (可转移对象)
- **优点**：零拷贝传输，极高性能
- **缺点**：原线程失去对数据的访问权
- **支持类型**：ArrayBuffer, MessagePort, ImageBitmap, OffscreenCanvas
- **适用场景**：大型二进制数据

#### 2.2.3 SharedArrayBuffer + Atomics
- **优点**：真正的共享内存，支持原子操作
- **缺点**：需要特殊 HTTP 头，有安全限制
- **适用场景**：需要频繁读写的共享状态

**所需 HTTP 头：**
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## 3. 架构设计方案

### 3.1 方案一：单 Worker 渲染架构

```
┌─────────────────────┐      ┌─────────────────────┐
│     主线程          │      │    渲染 Worker      │
│                     │      │                     │
│  - 事件处理         │      │  - OffscreenCanvas  │
│  - 数据模型更新     │ ───► │  - Grid 绘制        │
│  - 滚动/缩放控制    │ ◄─── │  - Cell 渲染        │
│  - DOM 操作         │      │  - 选择高亮         │
└─────────────────────┘      └─────────────────────┘
```

**适用场景**：大部分表格应用
**优点**：架构简单，主线程始终流畅
**缺点**：复杂渲染仍可能导致帧延迟

### 3.2 方案二：分层 Worker 架构

```
┌─────────────────────┐
│      主线程         │
│                     │
│  - 事件处理         │
│  - 协调各 Worker    │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌──────────┐ ┌──────────┐
│Grid Worker│ │Cell Worker│
│           │ │           │
│ 网格线    │ │ 单元格内容 │
│ 表头     │ │ 样式渲染   │
└──────────┘ └──────────┘
```

**适用场景**：超大规模表格
**优点**：最大化并行度
**缺点**：架构复杂，需要同步多个 Canvas 层

### 3.3 方案三：预渲染 + 位图缓存架构

```
┌─────────────────────┐      ┌─────────────────────┐
│     主线程          │      │   预渲染 Worker     │
│                     │      │                     │
│  - Canvas 合成      │      │  - 分块渲染         │
│  - 缓存管理         │ ───► │  - ImageBitmap 生成 │
│  - 滚动优化         │ ◄─── │  - 后台预加载       │
└─────────────────────┘      └─────────────────────┘
                                      │
                        ┌─────────────┴─────────────┐
                        │       Bitmap 缓存池       │
                        │  ┌─────┐ ┌─────┐ ┌─────┐  │
                        │  │Tile1│ │Tile2│ │Tile3│  │
                        │  └─────┘ └─────┘ └─────┘  │
                        └───────────────────────────┘
```

**适用场景**：需要快速滚动的大表格
**优点**：极致的滚动性能
**缺点**：内存占用较大，实现复杂

## 4. 推荐实现方案

针对 WorkfineSheet 项目，推荐采用 **方案一：单 Worker 渲染架构** 作为首选，原因如下：

1. **架构简洁**：与现有代码结构兼容性好
2. **调试方便**：单一渲染线程易于调试和维护
3. **性能足够**：对于中等规模表格已经足够
4. **渐进增强**：可以后续升级到更复杂架构

### 4.1 文件结构

```
src/workers/
├── OffscreenRenderer.ts      # 渲染 Worker 主类
├── offscreen-worker.ts       # Worker 入口文件
├── renderProtocol.ts         # 通信协议定义
└── SharedDataBuffer.ts       # 共享数据缓冲区（可选）

src/components/sheet/
├── useOffscreenRenderer.ts   # Vue Composable 封装
└── ...
```

### 4.2 通信协议设计

```typescript
// renderProtocol.ts

/** 主线程发送给 Worker 的消息类型 */
export type MainToWorkerMessage = 
  | { type: 'init'; canvas: OffscreenCanvas; dpr: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'setViewport'; scrollTop: number; scrollLeft: number }
  | { type: 'updateData'; cells: CellData[]; range: Range }
  | { type: 'updateStyles'; styles: StyleData[] }
  | { type: 'setSelection'; selection: SelectionData }
  | { type: 'render' }

/** Worker 发送给主线程的消息类型 */
export type WorkerToMainMessage =
  | { type: 'ready' }
  | { type: 'rendered'; frameId: number; renderTime: number }
  | { type: 'error'; message: string }
```

## 5. 浏览器兼容性分析

### 5.1 OffscreenCanvas 支持情况

| 浏览器 | 版本 | 支持情况 | 备注 |
|--------|------|----------|------|
| Chrome | 69+  | ✅ 完全支持 | |
| Firefox | 105+ | ✅ 完全支持 | 需要 flag 在 44+ |
| Safari | 16.4+ | ✅ 完全支持 | iOS 16.4+ |
| Edge | 79+  | ✅ 完全支持 | Chromium 内核 |
| IE | - | ❌ 不支持 | |

**全球覆盖率**：约 93% (2024年11月数据)

### 5.2 SharedArrayBuffer 支持情况

| 浏览器 | 支持情况 | 备注 |
|--------|----------|------|
| Chrome | ✅ 需要安全上下文 | COOP/COEP 头 |
| Firefox | ✅ 需要安全上下文 | COOP/COEP 头 |
| Safari | ✅ 16.4+ | COOP/COEP 头 |
| Edge | ✅ 需要安全上下文 | COOP/COEP 头 |

**注意**：SharedArrayBuffer 在 2018 年因 Spectre 漏洞被禁用，后来通过 COOP/COEP 头重新启用。

### 5.3 降级策略

```typescript
// 特性检测
export function checkOffscreenCanvasSupport(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
}

export function checkSharedArrayBufferSupport(): boolean {
  return typeof SharedArrayBuffer !== 'undefined'
}

// 使用示例
const renderer = checkOffscreenCanvasSupport()
  ? new OffscreenRenderer()  // 使用 Worker 渲染
  : new MainThreadRenderer() // 降级到主线程渲染
```

## 6. 性能优化策略

### 6.1 数据同步优化

#### 策略一：增量更新
只同步变化的数据，而非全量数据：
```typescript
// 差异计算
const changes = computeChanges(prevData, newData)
worker.postMessage({ type: 'updateData', changes })
```

#### 策略二：脏矩形渲染
只重绘变化的区域：
```typescript
interface DirtyRect {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}
```

### 6.2 图片资源优化

在 Worker 中使用 ImageBitmap 替代 Image：
```typescript
// 主线程
const response = await fetch(imageUrl)
const blob = await response.blob()
const bitmap = await createImageBitmap(blob)
worker.postMessage({ type: 'setImage', bitmap }, [bitmap])

// Worker
ctx.drawImage(bitmap, x, y)
```

### 6.3 字体预加载
```typescript
// 确保字体在 Worker 中可用
document.fonts.load('12px Arial').then(() => {
  worker.postMessage({ type: 'fontsReady' })
})
```

## 7. 实现注意事项

### 7.1 事件处理
- 事件监听必须在主线程
- Worker 只负责渲染，不处理交互逻辑
- 需要建立高效的事件→渲染映射

### 7.2 DOM 访问限制
Worker 线程无法访问：
- document
- window
- DOM 元素
- localStorage/sessionStorage

### 7.3 调试技巧
- Chrome DevTools 支持 Worker 调试
- 可以在 Worker 中使用 console.log
- 使用 performance.now() 进行性能分析

## 8. 参考资料

- [MDN: OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [MDN: SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [Can I Use: OffscreenCanvas](https://caniuse.com/offscreencanvas)
- [Chrome Developers: Off-main-thread Canvas](https://developer.chrome.com/blog/offscreen-canvas/)

## 9. 结论

OffscreenCanvas + Web Worker 方案对于大型表格应用具有显著的性能优势，特别是在以下场景：
- 大量单元格需要渲染（10万+）
- 复杂的单元格样式（背景色、边框、字体样式）
- 频繁的滚动和缩放操作
- 需要保持主线程响应性

建议分阶段实施：
1. 第一阶段：实现基本的 OffscreenCanvas 渲染
2. 第二阶段：优化数据同步和增量更新
3. 第三阶段：考虑 SharedArrayBuffer 进一步优化（如有需要）
