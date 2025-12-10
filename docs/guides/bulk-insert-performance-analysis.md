# 批量插入性能分析报告

**测试场景**: 插入 1800 行，填充 60,000 个单元格  
**总耗时**: 约 5.87 秒  
**测试日期**: 2025-12-10

## 优化实施状态

| 优化项 | 状态 | 实施日期 | 预期收益 |
|--------|------|----------|----------|
| A. 移除调试 forEach | ✅ 已完成 | 2025-12-10 | -785 ms |
| B. 字体设置缓存 | ✅ 已完成 | 2025-12-10 | -350 ms |
| C. 移除调试日志 | ✅ 已完成 | 2025-12-10 | - |
| D. 几何计算缓存 | ✅ 已完成 | 2025-12-10 | -400 ms |
| E. measureText 缓存 | ✅ 已完成 | 2025-12-10 | -65 ms |
| **F. 批量插入自动优化** | ✅ **已完成** | 2025-12-10 | **count≥100 时 60%+ 提升** |

**预计优化效果**: 约 1,600 ms（27% 提升） + 大批量插入 60%+ 提升

---

## 批量插入自动优化

### 工作原理

`insertRowsAboveBatch` 和 `insertColsLeftBatch` 现在会根据插入数量自动选择路径：

- **count < 100**: 使用标准路径（遍历 model.forEach）
- **count ≥ 100**: 自动切换高性能稀疏键移动

### 新增 SheetModel 方法

| 方法 | 说明 |
|------|------|
| `inheritRowStylesSparse(sourceRow, targetRow, count)` | 稀疏版样式继承 |
| `shiftAllDataRowsDown(startRow, count)` | 一次性移动所有数据 |
| `shiftAllDataColsRight(startCol, count)` | 一次性移动所有列数据 |
| `countFormulaCellsFromRow(row)` | 计算指定行及以下的公式数量 |
| `countFormulaCellsFromCol(col)` | 计算指定列及以后的公式数量 |

### 可选配置

通过 `bulkOptions` 可进一步控制行为：

```typescript
await insertRowsAboveBatch(row, 1800, {
  formulaSheet,
  sizeConfig,
  selected,
  onRedraw,
  bulkOptions: {
    bulkThreshold: 100,          // 自定义阈值（默认 100）
    skipFormulaAdjust: true,     // 跳过公式调整（如果确定无公式）
    onClearUndoStack: () => {    // 大批量时清空撤销栈
      undoRedoManager.clear()
    }
  }
})
```

---

## 一、性能概览

### 1.1 总体时间分布

| 类别 | 耗时 | 占比 |
|------|------|------|
| Native/Browser API | 6,329 ms | 55.0% |
| Vue.js 响应式系统 | 2,328 ms | 20.2% |
| SheetModel 数据操作 | 1,492 ms | 13.0% |
| geometry.ts 几何计算 | 556 ms | 4.8% |
| renderCells.ts 渲染 | 401 ms | 3.5% |
| useSheetDrawing.ts | 174 ms | 1.5% |
| FormulaSheet.ts | 102 ms | 0.9% |
| 其他 | 132 ms | 1.1% |

**总采样时间**: 11,514 ms

### 1.2 关键发现

1. **SheetModel.forEach 是最大瓶颈** - 785 ms（6.8%），被调用 5949 次
2. **Vue 响应式开销巨大** - 2,328 ms（20.2%），大量 Proxy get/set 操作
3. **Canvas 字体操作耗时** - `set font` 472 ms，`save/restore` 187 ms
4. **GC 压力显著** - 垃圾回收 346 ms，内存分配频繁
5. **几何计算重复** - `getColWidth` 2790 次（365 ms），`getRowHeight` 1227 次（163 ms）

---

## 二、热点分析

### 2.1 SheetModel.ts 热点

| 函数 | 调用次数 | 耗时 | 问题 |
|------|---------|------|------|
| `forEach` | 5949 | 785 ms | **每次渲染都遍历全部单元格** |
| `getCellStyle` | 1338 | 174 ms | Map 查找开销 |
| `getCellFormat` | 1283 | 170 ms | Map 查找开销 |
| `getMergedCellInfo` | 836 | 110 ms | 合并单元格检测 |
| `getCellImages` | 427 | 55 ms | 图片数据获取 |
| `getCell` | 414 | 54 ms | 单元格数据获取 |
| `getCellBorder` | 356 | 47 ms | 边框数据获取 |
| `keyFor` | 298 | 37 ms | 键生成 |

**根本原因**: `forEach` 遍历整个 `cells` Map，每次渲染都执行。60k 单元格 × 49 帧渲染 ≈ 近 300 万次迭代。

### 2.2 Vue.js 响应式开销

| 函数 | 调用次数 | 耗时 | 说明 |
|------|---------|------|------|
| `get` (Proxy) | 6947 | 864 ms | 响应式属性读取 |
| `(anonymous)` | 2406 | 300 ms | 内部回调 |
| `has` | 1550 | 183 ms | 属性存在检查 |
| `toTypeString` | 1398 | 176 ms | 类型检查 |
| `toRaw` | 1277 | 158 ms | 获取原始对象 |
| `createReactiveObject` | 909 | 119 ms | 创建响应式对象 |

**根本原因**: 渲染过程中大量访问响应式数据，每次访问都触发 Proxy 拦截。

### 2.3 geometry.ts 几何计算

| 函数 | 调用次数 | 耗时 | 问题 |
|------|---------|------|------|
| `getColWidth` | 2790 | 365 ms | 每个单元格都调用 |
| `getRowHeight` | 1227 | 163 ms | 每个单元格都调用 |
| `getColLeft` | 174 | 23 ms | - |
| `getRowTop` | 36 | 5 ms | - |

**根本原因**: 虽然已有 PositionIndex 优化，但 `getColWidth/getRowHeight` 仍被高频调用。

### 2.4 Canvas API 开销

| API | 调用次数 | 耗时 | 说明 |
|-----|---------|------|------|
| `set font` | 4194 | 472 ms | **最耗时的 Canvas 操作** |
| `set width` | 2139 | 269 ms | 设置线宽 |
| `save` | 1045 | 134 ms | 状态保存 |
| `measureText` | 1040 | 131 ms | 文本测量 |
| `clip` | 977 | 124 ms | 裁剪区域 |
| `fillText` | 891 | 106 ms | 文本绘制 |
| `restore` | 412 | 53 ms | 状态恢复 |

**根本原因**: 
1. 每个单元格都设置 font，即使字体相同
2. save/clip/restore 次数过多
3. measureText 重复计算相同文本

### 2.5 GC 压力

| 事件 | 次数 | 总耗时 | 最大单次 |
|------|------|--------|----------|
| MajorGC | 5 | 220 ms | 139 ms |
| V8.GC_MARK_COMPACTOR | 5 | 220 ms | 139 ms |
| CppGC.ConcurrentSweep | 2 | 171 ms | 142 ms |

**根本原因**: 大量临时对象创建（字符串拼接、数组创建等）。

---

## 三、优化建议

### 3.1 🔴 高优先级

#### A. 渲染时避免遍历全部单元格

**问题**: `forEach` 遍历 60k 单元格，每次渲染都执行  
**方案**: 只遍历可见区域的单元格

```typescript
// 优化前：遍历全部
model.forEach((row, col, cell) => { ... })

// 优化后：只遍历可见区域
for (let row = visibleStartRow; row <= visibleEndRow; row++) {
  for (let col = visibleStartCol; col <= visibleEndCol; col++) {
    const cell = model.getCell(row, col)
    if (cell) { ... }
  }
}
```

**预期收益**: 减少 90%+ 的迭代次数

#### B. 缓存字体设置

**问题**: 每个单元格都 `set font`，即使字体相同  
**方案**: 按字体分组渲染，减少 font 切换

```typescript
// 优化前：每个单元格设置
for (const cell of cells) {
  ctx.font = buildFontString(cell.style)
  ctx.fillText(...)
}

// 优化后：按字体分组
const cellsByFont = groupBy(cells, c => buildFontString(c.style))
for (const [font, fontCells] of cellsByFont) {
  ctx.font = font
  for (const cell of fontCells) {
    ctx.fillText(...)
  }
}
```

**预期收益**: 减少 80%+ 的 font 设置调用

#### C. 批量操作使用原始对象

**问题**: 批量插入时触发大量 Vue 响应式追踪  
**方案**: 使用 `toRaw()` 或 `shallowRef()` 避免深度响应式

```typescript
// 批量操作时暂时使用原始对象
const rawModel = toRaw(model)
for (let i = 0; i < 1800; i++) {
  rawModel.setValue(row + i, col, value)
}
// 操作完成后触发一次更新
triggerRef(modelRef)
```

**预期收益**: 减少 50%+ Vue 开销

### 3.2 🟡 中优先级

#### D. 缓存几何计算结果

**问题**: `getColWidth` 被调用 2790 次  
**方案**: 在渲染帧内缓存宽高

```typescript
const widthCache = new Map<number, number>()
const heightCache = new Map<number, number>()

function getCachedWidth(col: number) {
  if (!widthCache.has(col)) {
    widthCache.set(col, getColWidth(col, ...))
  }
  return widthCache.get(col)!
}

// 每帧结束时清空缓存
requestAnimationFrame(() => {
  widthCache.clear()
  heightCache.clear()
})
```

**预期收益**: 减少 60%+ 几何计算

#### E. measureText 缓存

**问题**: 相同文本重复测量  
**方案**: 使用 LRU 缓存

```typescript
const textMetricsCache = new LRUCache<string, TextMetrics>(1000)

function cachedMeasureText(ctx: CanvasRenderingContext2D, text: string, font: string) {
  const key = `${font}|${text}`
  if (!textMetricsCache.has(key)) {
    ctx.font = font
    textMetricsCache.set(key, ctx.measureText(text))
  }
  return textMetricsCache.get(key)!
}
```

**预期收益**: 减少 50%+ measureText 调用

#### F. 减少 save/restore 调用

**问题**: 每个单元格都 save/restore  
**方案**: 分区域批量处理（已有 D3 优化，可进一步优化）

**预期收益**: 减少 30%+ 状态操作

### 3.3 🟢 低优先级

#### G. 对象池减少 GC

**问题**: 大量临时对象导致 GC 压力  
**方案**: 使用对象池复用常用对象

```typescript
// 复用渲染上下文对象
const renderContext = {
  row: 0,
  col: 0,
  x: 0,
  y: 0,
  width: 0,
  height: 0
}

// 渲染时复用而非创建新对象
renderContext.row = row
renderContext.col = col
// ...
```

**预期收益**: 减少 30%+ GC 时间

#### H. 异步分帧渲染

**问题**: 5.87 秒的长任务阻塞 UI  
**方案**: 使用 `requestIdleCallback` 分帧处理

```typescript
async function batchInsert(rows: number, data: any[]) {
  const CHUNK_SIZE = 100
  for (let i = 0; i < rows; i += CHUNK_SIZE) {
    await new Promise(resolve => requestIdleCallback(resolve))
    insertChunk(i, Math.min(i + CHUNK_SIZE, rows), data)
  }
}
```

**预期收益**: UI 保持响应，用户体验提升

---

## 四、优化优先级矩阵

| 方案 | 预期收益 | 实施难度 | 优先级 |
|------|---------|---------|--------|
| A. 避免全量遍历 | 🔥🔥🔥🔥🔥 | 中 | P0 |
| B. 缓存字体设置 | 🔥🔥🔥🔥 | 低 | P0 |
| C. 批量操作用原始对象 | 🔥🔥🔥🔥 | 低 | P0 |
| D. 缓存几何计算 | 🔥🔥🔥 | 低 | P1 |
| E. measureText 缓存 | 🔥🔥 | 低 | P1 |
| F. 减少 save/restore | 🔥🔥 | 已完成部分 | P2 |
| G. 对象池 | 🔥 | 中 | P2 |
| H. 异步分帧 | 🔥🔥 | 中 | P2 |

---

## 五、总结

### 5.1 核心瓶颈

1. **数据遍历效率** (785 ms) - forEach 遍历 60k 单元格
2. **Vue 响应式开销** (2,328 ms) - 批量操作触发过多追踪
3. **Canvas 字体操作** (472 ms) - 频繁设置相同字体
4. **几何计算重复** (528 ms) - getColWidth/getRowHeight 高频调用

### 5.2 预期优化效果

实施 P0 级别优化后，预期总耗时可从 5.87 秒降至 **1.5-2 秒**：

- 避免全量遍历: -700 ms
- 批量用原始对象: -1,000 ms
- 缓存字体设置: -350 ms
- 几何计算缓存: -400 ms

**总计可优化**: ~2,450 ms（约 42% 提升）

### 5.3 后续建议

1. 实施 P0 优化后重新跑性能测试
2. 考虑添加进度指示器提升用户体验
3. 超大批量操作考虑 Web Worker 分离

---

## 六、优化实施记录 (2025-12-10)

### ✅ A. 移除调试 forEach

**修改文件**: `src/components/sheet/composables/useSheetDrawing.ts`

**问题**: 每次渲染都调用 `model.forEach(() => cellCount++)` 来计数，60k 单元格 × 49 帧 = 近 300 万次迭代。

**解决**: 移除调试代码

```diff
- // 调试日志
- let cellCount = 0
- model.forEach(() => cellCount++)
```

**同时修复**: `src/components/sheet/composables/useSheetState.ts` 中的类似调试代码

---

### ✅ B. 字体设置缓存

**修改文件**: `src/components/sheet/renderCells.ts`

**问题**: 每个单元格都调用 `ctx.font = buildFontString(style)`，即使字体相同。

**解决**: 跟踪当前字体，只在变化时设置

```typescript
// 性能优化：跟踪当前字体和颜色，避免重复设置
let currentFont = ''
let currentFillStyle = ''

// 在 renderCellContent 中
const font = buildFontString(style)
if (font !== currentFont) {
  ctx.font = font
  currentFont = font
}
```

---

### ✅ D. 几何计算缓存

**修改文件**: `src/components/sheet/renderCells.ts`

**问题**: `getColWidth` 和 `getColLeft` 在内层循环中被每个单元格调用。

**解决**: 在渲染循环前预计算所有可见列的宽度和位置

```typescript
// 性能优化：预计算可见列的宽度和左边位置
const colWidthCache: number[] = []
const colLeftCache: number[] = []
for (let c = startCol; c <= endCol; c++) {
  colWidthCache[c - startCol] = getColWidth(c, sizes, geometryConfig)
  colLeftCache[c - startCol] = getColLeft(c, sizes, geometryConfig)
}

// 内层循环使用缓存
const cacheIdx = c - startCol
const colWidth = colWidthCache[cacheIdx]!
const cellX = rowHeaderWidth + colLeftCache[cacheIdx]! - viewport.scrollLeft
```

---

### ✅ E. measureText 缓存

**修改文件**: `src/components/sheet/renderCells.ts`

**问题**: 相同文本和字体组合的 `measureText` 被重复调用。

**解决**: 实现 LRU 缓存

```typescript
class TextMeasureCache {
  private cache = new Map<string, number>()
  private maxSize: number
  
  constructor(maxSize = 500) {
    this.maxSize = maxSize
  }
  
  measure(ctx: CanvasRenderingContext2D, text: string, font: string): number {
    const key = `${font}|${text}`
    const cached = this.cache.get(key)
    if (cached !== undefined) {
      // LRU: 将访问过的项移到末尾
      this.cache.delete(key)
      this.cache.set(key, cached)
      return cached
    }
    
    const width = ctx.measureText(text).width
    
    // 缓存大小限制
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, width)
    return width
  }
}

const textMeasureCache = new TextMeasureCache()

// 使用：
const textWidth = textMeasureCache.measure(ctx, text, font)
```

---

## 七、测试验证

优化后运行全部测试：
- **958 个测试全部通过**
- 无功能回归
