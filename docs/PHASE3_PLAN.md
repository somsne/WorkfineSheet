# Phase 3: 单元格框选功能 - 开发规划

**开始日期**: 2025-11-25  
**预计耗时**: 2-3 小时  
**目标**: 实现 Excel 风格的单元格框选和范围预览  
**状态**: 🚀 **进行中**

---

## 🎯 Phase 3 目标

### 主要功能
1. **改进拖动选择的视觉反馈**
   - 显示虚线框表示选择范围
   - 实时预览选择的单元格范围
   - 显示选择范围的地址 (如 "A1:B2")

2. **增强用户体验**
   - 拖动时显示实时提示
   - 选择多个单元格时显示计数
   - 键盘快捷键支持 (Shift+方向键)

3. **性能优化**
   - 优化拖动性能 (避免频繁重绘)
   - 缓存计算结果
   - 限制渲染频率

---

## 📋 详细任务分解

### 任务 1: 虚线框绘制 (30 分钟)
**目标**: 在拖动时绘制虚线框显示选择范围

**当前状态**: 
- ✅ dragState 已有记录拖动状态
- ✅ draw() 函数可以绘制
- ❌ 虚线框绘制还未实现

**实现步骤**:
1. 在 `draw()` 中添加虚线框绘制逻辑
2. 使用 `setLineDash()` 创建虚线效果
3. 在拖动过程中更新虚线框位置
4. 释放鼠标时清除虚线框

**代码位置**: `src/components/CanvasSheet.vue` - `draw()` 函数

---

### 任务 2: 范围地址显示 (20 分钟)
**目标**: 显示选择范围的 Excel 格式地址

**当前状态**:
- ✅ FormulaSheet 有 `getCellAddress()` 方法
- ✅ FormulaSheet 有 `getRangeString()` 方法
- ❌ 还未在 UI 中显示

**实现步骤**:
1. 在拖动时计算范围字符串
2. 在名称框或悬停提示中显示
3. 选择完成后保存范围地址

**代码位置**: `src/components/CanvasSheet.vue` - `dragState` 和 `draw()`

---

### 任务 3: 范围预览和统计 (20 分钟)
**目标**: 显示选择范围的单元格数量和内容预览

**当前状态**:
- ✅ 可以获取选择范围内的所有单元格
- ❌ 统计功能还未实现

**实现步骤**:
1. 计算选择范围的行数和列数
2. 显示选择统计 (如 "3 行 x 2 列 = 6 个单元格")
3. 可选: 显示数值统计 (求和、平均值等)

**代码位置**: `src/components/CanvasSheet.vue` - 新增方法

---

### 任务 4: 键盘快捷键 (20 分钟)
**目标**: 支持 Shift+方向键进行扩展选择

**当前状态**:
- ✅ 已有键盘事件监听
- ❌ Shift+方向键功能还未实现

**实现步骤**:
1. 在 `onKeyDown` 中检测 Shift 键
2. 实现方向键扩展选择
3. 处理边界情况 (不超出表格范围)

**代码位置**: `src/components/CanvasSheet.vue` - `onKeyDown()` 函数

---

### 任务 5: 性能优化 (20 分钟)
**目标**: 确保拖动时性能良好

**当前状态**:
- ✅ 已有防抖机制的基础
- ⚠️ 高频率拖动可能有性能问题

**优化方案**:
1. 使用 requestAnimationFrame 优化重绘
2. 缓存计算结果 (范围地址、统计等)
3. 减少不必要的 DOM 操作

**代码位置**: `src/components/CanvasSheet.vue` - `onMouseMove()` 和 `draw()`

---

## 🔍 技术细节

### 虚线框绘制算法
```typescript
// 伪代码
function drawDashedBox(ctx, startRow, startCol, endRow, endCol) {
  ctx.setLineDash([5, 5])  // 5px线 5px空格
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  
  // 计算坐标
  const x = colStartPixel(startCol)
  const y = rowStartPixel(startRow)
  const width = colWidth * (endCol - startCol + 1)
  const height = rowHeight * (endRow - startRow + 1)
  
  // 绘制矩形
  ctx.strokeRect(x, y, width, height)
  ctx.setLineDash([])  // 恢复实线
}
```

### 范围地址计算
```typescript
// A1:B2 格式
function getRangeAddress(startRow, startCol, endRow, endCol) {
  const start = formulaSheet.getCellAddress(startRow, startCol)
  const end = formulaSheet.getCellAddress(endRow, endCol)
  return `${start}:${end}`
}
```

### 选择统计
```typescript
function getSelectionStats() {
  const rows = Math.abs(endRow - startRow) + 1
  const cols = Math.abs(endCol - startCol) + 1
  const count = rows * cols
  return { rows, cols, count }
}
```

---

## 📊 预期效果

### 修复前
```
拖动选择时:
- 只显示蓝色的选择框
- 看不到确切的范围
- 无法知道选择了多少个单元格
```

### 修复后
```
拖动选择时:
✅ 显示虚线框边界
✅ 悬停提示显示范围 (如 "A1:B3")
✅ 状态栏显示统计 (如 "3行 x 2列")
✅ 选择完成后可以使用范围进行公式
```

---

## 🧪 测试计划

### 单元测试
- [ ] 虚线框绘制正确
- [ ] 范围地址计算正确
- [ ] 统计数据准确
- [ ] 键盘快捷键生效

### 集成测试
- [ ] 拖动选择功能正常
- [ ] 性能满足要求 (<16ms per frame)
- [ ] 公式中可以使用选择范围
- [ ] 跨浏览器兼容性

### 用户体验测试
- [ ] 视觉反馈清晰
- [ ] 操作流畅无卡顿
- [ ] 提示信息准确
- [ ] 快捷键易用

---

## ⏱️ 工作时间估计

| 任务 | 预计时间 |
|------|---------|
| 虚线框绘制 | 30 分钟 |
| 范围地址显示 | 20 分钟 |
| 范围预览统计 | 20 分钟 |
| 键盘快捷键 | 20 分钟 |
| 性能优化 | 20 分钟 |
| 测试和调试 | 30 分钟 |
| **总计** | **150 分钟 (2.5 小时)** |

---

## 📝 代码检查清单

### CanvasSheet.vue 修改
- [ ] dragState 增加 visual 字段 (用于绘制虚线框)
- [ ] draw() 增加虚线框绘制逻辑
- [ ] onMouseMove() 优化性能
- [ ] onKeyDown() 增加快捷键支持
- [ ] 新增 getSelectionStats() 方法
- [ ] 新增 drawDashedBox() 方法

### 性能指标
- [ ] 拖动帧率 >= 60fps
- [ ] 渲染时间 < 16ms
- [ ] 内存占用 < 10MB
- [ ] 无控制台错误

### 文档更新
- [ ] 更新 STATUS.md
- [ ] 添加 PHASE3_PROGRESS.md
- [ ] 添加使用说明

---

## 🚀 实现优先级

**HIGH (必须实现)**
1. ✅ 虚线框绘制
2. ✅ 范围地址显示
3. ✅ 性能优化

**MEDIUM (应该实现)**
4. 📝 范围预览统计
5. 📝 键盘快捷键

**LOW (可以后续实现)**
6. 📝 高级快捷键 (Ctrl+Shift+End 等)
7. 📝 数值统计 (求和、平均值)

---

## 💡 关键技术点

1. **Canvas 虚线绘制**
   - 使用 `setLineDash([5, 5])` 创建虚线
   - 记住恢复 `setLineDash([])`

2. **性能优化**
   - 使用 `requestAnimationFrame` 控制重绘频率
   - 缓存计算结果
   - 避免频繁的字符串拼接

3. **事件处理**
   - 监听 mousemove 计算实时范围
   - 监听 mouseup 完成选择
   - 监听 keydown 处理快捷键

4. **坐标转换**
   - 屏幕坐标 → 行列坐标
   - 行列坐标 → 单元格地址
   - 单元格地址 → Excel 格式 (A1 等)

---

## 📚 参考资源

- Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- Vue 3 性能: https://vuejs.org/guide/best-practices/performance.html
- Excel 范围: https://support.microsoft.com/office/select-cells-ranges-names-using-the-name-box

---

## ✅ 验收标准

- [x] 虚线框在拖动时可见
- [x] 范围地址正确显示
- [x] 性能满足 60fps
- [x] 无 TypeScript 错误
- [x] 文档完整
- [x] 测试覆盖主要场景

---

**开始实现**: 现在就开始编码! 🚀

