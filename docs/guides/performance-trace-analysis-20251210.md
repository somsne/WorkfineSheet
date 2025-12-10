# 性能跟踪分析报告 (2025-12-10 最新版)

**测试场景**: 批量插入行并填充数据  
**总采样数**: 64,153 个  
**操作耗时**: 约 4.5 秒

---

## 一、CPU 采样热点分析

### 1.1 总体分布

| 类别 | 采样占比 | 说明 |
|------|---------|------|
| 空闲 (idle) | 36.2% | 等待/空闲时间 |
| Vue 响应式系统 | ~20% | Proxy get/set、toTypeString 等 |
| Canvas 操作 | ~12% | set font、set width、fillText 等 |
| SheetModel 数据访问 | ~8% | getCellStyle、getCellFormat 等 |
| 渲染函数 | ~5% | drawCells、renderCellContent |
| GC 垃圾回收 | 1.5% | garbage collector |
| 其他 | ~17% | 程序逻辑、几何计算等 |

### 1.2 热点函数详细统计

#### Vue 响应式开销 (~20%)

| 函数 | 采样数 | 占比 | 问题 |
|------|-------|------|------|
| `get` (Proxy) | 6,449 | 10.1% | **最大瓶颈** - 响应式属性读取 |
| `(anonymous)` vue.js | 1,778 | 2.8% | Vue 内部匿名函数 |
| `toTypeString` | 1,400 | 2.2% | 类型检查 |
| `has` (Proxy) | 755 | 1.2% | 属性存在检查 |
| `toRaw` | 713 | 1.1% | 获取原始对象 |
| `isRef2` | 468 | 0.7% | ref 类型检查 |
| `getProto` | 458 | 0.7% | 原型检查 |
| `hasOwn` | 416 | 0.6% | 属性检查 |
| `createReactiveObject` | 358 | 0.6% | 创建响应式对象 |
| `track` | 223 | 0.3% | 依赖追踪 |

#### Canvas 操作开销 (~12%)

| 函数 | 采样数 | 占比 | 问题 |
|------|-------|------|------|
| `set font` | 4,035 | **6.3%** | **字体设置仍是大瓶颈** |
| `set width` | 2,126 | 3.3% | 线宽设置 |
| `save` | 1,078 | 1.7% | 状态保存 |
| `fillText` | 963 | 1.5% | 文本绘制 |
| `clip` | 862 | 1.3% | 裁剪区域 |
| `restore` | 442 | 0.7% | 状态恢复 |
| `measureText` | 289 | 0.5% | 文本测量 |
| `rect` | 155 | 0.2% | 矩形绘制 |
| `stroke` | 154 | 0.2% | 描边 |

#### SheetModel 数据访问 (~8%)

| 函数 | 采样数 | 占比 | 问题 |
|------|-------|------|------|
| `getCellStyle` | 1,300 | 2.0% | 样式查询 |
| `getCellFormat` | 1,196 | 1.9% | 格式查询 |
| `getMergedCellInfo` | 723 | 1.1% | 合并单元格信息 |
| `getCellImages` | 446 | 0.7% | 单元格图片 |
| `getCell` | 367 | 0.6% | 单元格数据 |
| `getCellBorder` | 332 | 0.5% | 边框查询 |
| `keyFor` | 326 | 0.5% | 键生成 |

#### 渲染函数 (~5%)

| 函数 | 采样数 | 占比 |
|------|-------|------|
| `drawCells` | 1,082 | 1.7% |
| `renderCellContent` | 1,039 | 1.6% |
| `getRowHeight` | 1,061 | 1.7% |
| `drawGrid` | 532 | 0.8% |
| `measure` | 490 | 0.8% |
| `buildFontString` | 313 | 0.5% |

---

## 二、仍需优化的瓶颈

### P0 - 高优先级 (预期收益 > 500ms)

#### 1. Vue Proxy `get` 开销 (10.1%)

**问题**: 每次访问响应式对象属性都触发 Proxy 拦截  
**影响**: 约 450ms (10% × 4.5s)

**优化方案 A - 批量操作使用 `toRaw()`**:
```typescript
// 在批量渲染时，先获取原始对象避免 Proxy 开销
import { toRaw } from 'vue'

function drawCells(sheetState: SheetState) {
  // 渲染循环开始前获取原始数据
  const rawState = toRaw(sheetState)
  const rawModel = toRaw(rawState.model)
  
  // 使用原始对象进行渲染，避免触发响应式
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = rawModel.getCell(r, c)
      // ...
    }
  }
}
```

**优化方案 B - 使用 `shallowRef` 减少深度响应**:
```typescript
// 对于大型数据结构，使用 shallowRef 避免深度响应
const model = shallowRef(new SheetModel())

// 更新时需要手动触发
model.value = model.value // 触发更新
```

#### 2. Canvas `set font` 仍然过高 (6.3%)

**问题**: 字体设置仍占 6.3%，之前的优化可能未完全生效  
**影响**: 约 280ms

**检查点**:
- 确认 `currentFont` 缓存是否在所有渲染路径生效
- 检查 `ctx.restore()` 后是否正确重置 `currentFont`
- 考虑使用单一字体或预定义字体集

**优化方案 - 字体规范化**:
```typescript
// 预定义字体字符串，避免重复构建
const FONT_CACHE = new Map<string, string>()

function getFont(size: number, weight: string, family: string): string {
  const key = `${size}|${weight}|${family}`
  if (!FONT_CACHE.has(key)) {
    FONT_CACHE.set(key, `${weight} ${size}px ${family}`)
  }
  return FONT_CACHE.get(key)!
}
```

### P1 - 中优先级 (预期收益 100-500ms)

#### 3. Canvas `set width` (3.3%)

**问题**: 线宽设置频繁  
**影响**: 约 150ms

**优化方案**:
```typescript
let currentLineWidth = -1

function setLineWidth(ctx: CanvasRenderingContext2D, width: number) {
  if (currentLineWidth !== width) {
    ctx.lineWidth = width
    currentLineWidth = width
  }
}
```

#### 4. `getCellStyle` / `getCellFormat` (2.0% + 1.9%)

**问题**: 每个单元格都查询样式和格式  
**影响**: 约 175ms

**优化方案 - 行级缓存**:
```typescript
// 在渲染一行前，批量获取该行所有样式
function getRowStyles(row: number, startCol: number, endCol: number): Map<number, CellStyle> {
  const styles = new Map<number, CellStyle>()
  // 一次性收集该行所有样式
  for (const [key, style] of this.cellStyles.entries()) {
    const [r, c] = key.split(',').map(Number)
    if (r === row && c >= startCol && c <= endCol) {
      styles.set(c, style)
    }
  }
  return styles
}
```

#### 5. `save` / `restore` (1.7% + 0.7%)

**问题**: 频繁保存/恢复 Canvas 状态  
**影响**: 约 100ms

**优化方案 - 减少状态保存**:
```typescript
// 只在必要时（如处理合并单元格裁剪）使用 save/restore
// 对于普通单元格，手动管理状态而非使用 save/restore
```

### P2 - 低优先级 (预期收益 < 100ms)

#### 6. `buildFontString` (0.5%)
- 考虑字体字符串池化

#### 7. `keyFor` (0.5%)
- 考虑使用数字键而非字符串键

#### 8. GC 压力 (1.5%)
- 减少临时对象创建
- 复用数组和对象

---

## 三、批量操作优化建议

### 当前已实现

| 优化项 | 状态 | 阈值 |
|--------|------|------|
| 稀疏键移动 | ✅ | count ≥ 100 |
| 稀疏样式继承 | ✅ | count ≥ 100 |
| 公式数量检查 | ✅ | count ≥ 100 |
| 撤销栈清空选项 | ✅ | 可配置 |

### 建议新增

#### 1. 批量数据填充 API

```typescript
/**
 * 高性能批量设置值
 * 避免逐个单元格触发响应式更新
 */
setValuesBatch(data: Array<{row: number, col: number, value: string}>): void {
  // 使用 toRaw 避免响应式开销
  const rawCells = toRaw(this.cells)
  
  for (const {row, col, value} of data) {
    const key = keyFor(row, col)
    if (value === '') {
      rawCells.delete(key)
    } else {
      rawCells.set(key, { value })
    }
  }
  
  // 批量完成后触发一次更新
  triggerRef(this.cells)
}
```

#### 2. 渲染时使用原始对象

```typescript
// useSheetDrawing.ts
function drawSheet() {
  // 渲染前获取原始对象
  const rawModel = toRaw(formulaSheet.getModel())
  const rawState = toRaw(state)
  
  // 使用原始对象进行渲染
  drawCells(ctx, rawModel, rawState, ...)
}
```

#### 3. 线宽状态缓存

```typescript
// renderCore.ts 或 renderCells.ts
let currentLineWidth = -1

export function setLineWidthIfNeeded(ctx: CanvasRenderingContext2D, width: number) {
  if (currentLineWidth !== width) {
    ctx.lineWidth = width
    currentLineWidth = width
  }
}

export function resetLineWidthCache() {
  currentLineWidth = -1
}
```

#### 4. 行级数据预取

```typescript
// 在渲染一行前，预取该行所有数据
interface RowRenderData {
  styles: Map<number, CellStyle>
  formats: Map<number, CellFormat>
  borders: Map<number, CellBorder>
  mergedInfo: Map<number, MergedCellInfo>
}

function prefetchRowData(model: SheetModel, row: number, startCol: number, endCol: number): RowRenderData {
  // 批量获取，减少多次 Map 查询
}
```

---

## 四、预期优化效果

| 优化项 | 当前占比 | 预期减少 | 预期节省 |
|--------|---------|---------|---------|
| Vue Proxy `get` 优化 | 10.1% | 50% | ~225ms |
| `set font` 进一步优化 | 6.3% | 30% | ~85ms |
| `set width` 缓存 | 3.3% | 60% | ~90ms |
| 样式/格式行级缓存 | 3.9% | 40% | ~70ms |
| save/restore 减少 | 2.4% | 50% | ~55ms |
| **总计** | | | **~525ms (12%)** |

---

## 五、实施优先级

1. **第一阶段 (P0)**: Vue `toRaw()` 优化渲染路径
2. **第二阶段 (P0)**: 验证字体缓存是否完全生效
3. **第三阶段 (P1)**: 添加线宽缓存
4. **第四阶段 (P1)**: 行级数据预取
5. **第五阶段 (P2)**: 减少 save/restore 使用

---

## 六、结论

当前最大的性能瓶颈是 **Vue 响应式系统的 Proxy 开销**（10.1%），其次是 **Canvas 字体设置**（6.3%）。建议优先使用 `toRaw()` 在渲染路径中绕过响应式系统，可带来约 10-15% 的性能提升。
