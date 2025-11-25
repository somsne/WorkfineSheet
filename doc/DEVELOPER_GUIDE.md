# 📖 Excel 公式支持 - 开发者指南

**项目**: WorkfineSheet - Excel 兼容电子表格  
**功能**: 完整的公式计算和引用支持  
**状态**: Phase 2 完成 | 准备 Phase 3  
**更新**: 2025-11-25

---

## 🎯 快速开始

### 1. 项目概览

这是一个 Vue 3 + TypeScript 的电子表格应用，现已支持 Excel 公式。

```
当前能做的:
✅ 输入公式 (例如 =SUM(A1:A10))
✅ 自动计算结果
✅ 在公式中点击其他单元格选择范围
✅ 撤销/重做公式编辑
✅ 100+ 种 Excel 函数支持
```

### 2. 架构概览

```
应用层 (Vue 3 Components)
  ↓
画布层 (CanvasSheet) ← 单元格显示、事件处理
  ↓
公式层 (FormulaSheet) ← 自动计算、值转换
  ↓
计算层 (FormulaEngine) ← 公式解析、函数执行
  ↓
库层 (hot-formula-parser) ← 低级公式处理
```

### 3. 核心文件

| 文件 | 大小 | 职责 |
|------|------|------|
| FormulaEngine.ts | 240 行 | 🔧 公式计算引擎 |
| FormulaSheet.ts | 100 行 | 📊 数据包装层 |
| CanvasSheet.vue | 730 行 | 🎨 主画布组件 |
| SheetOverlayInput.vue | 220 行 | 📝 编辑框 |

---

## 🔍 功能深入说明

### FormulaEngine - 公式计算引擎

**职责**: 解析和计算 Excel 公式

**关键方法**:
```typescript
// 检查是否是公式
isFormula("=SUM(A1:A10)")  // true
isFormula("Hello")         // false

// 计算公式
evaluate("=100+200")       // { result: 300, error: null }
evaluate("=1/0")           // { result: null, error: "#DIV/0!" }

// 提取单元格引用
extractCellReferences("=SUM(A1:B2,C1)")  
// 返回: [A1, A2, B1, B2, C1]

// 生成单元格地址
getCellAddress(0, 0)       // "A1"
getCellAddress(0, 0, true) // "$A$1"

// 生成范围字符串
getRangeString(0, 0, 2, 1) // "A1:B3"
```

**使用示例**:
```typescript
import { FormulaEngine } from './lib/FormulaEngine'

const engine = new FormulaEngine((row, col) => {
  // 这个回调用于获取单元格值
  return sheetModel.getValue(row, col)
})

const result = engine.evaluate('=SUM(B1:B3)')
if (result.error) {
  console.error('公式错误:', result.error)
} else {
  console.log('计算结果:', result.result)
}
```

### FormulaSheet - 公式包装层

**职责**: 为 SheetModel 添加公式支持

**关键方法**:
```typescript
// 获取显示值 (自动计算公式)
getValue(row, col)        // 255 (计算结果)

// 获取编辑值 (原始公式)
getDisplayValue(row, col) // "=100+150" (原始值)

// 设置值并清除缓存
setValue(row, col, value)

// 访问底层模型
getModel()  // SheetModel 实例

// 生成单元格地址
getCellAddress(row, col)
getRangeString(startRow, startCol, endRow, endCol)
```

**使用示例**:
```typescript
import { FormulaSheet } from './lib/FormulaSheet'

const model = new SheetModel()
const sheet = new FormulaSheet(model)

// 设置数据
sheet.getModel().setValue(0, 0, 100)
sheet.getModel().setValue(0, 1, 150)
sheet.getModel().setValue(0, 2, '=A1+B1')

// 显示值 (自动计算)
console.log(sheet.getValue(0, 2))  // 250

// 编辑时显示原始值
console.log(sheet.getDisplayValue(0, 2))  // "=A1+B1"
```

### SheetOverlayInput - 编辑框

**职责**: 处理单元格编辑和公式输入

**新增公开方法**:
```typescript
// 检查是否在公式模式
if (overlayInput.formulaMode) {
  // 当前正在编辑公式
}

// 在光标位置插入单元格地址
overlayInput.insertCellReference("A1")
// 结果: 编辑框内容从 "=S" 变为 "=SA1"

// 在光标位置插入范围
overlayInput.insertRangeReference("A1", "B3")
// 结果: 编辑框内容从 "=SUM(" 变为 "=SUM(A1:B3"
```

**样式表现**:
```css
/* 普通模式 */
border: 2px solid #3b82f6;      /* 蓝色 */
background-color: white;

/* 公式模式 */
border: 2px solid #ef4444;      /* 红色 */
background-color: #fef2f2;      /* 浅红 */
font-family: monospace;          /* 等宽字体 */
```

### CanvasSheet - 主画布

**关键修改**:
```typescript
// 使用 FormulaSheet 显示计算结果
const displayValue = formulaSheet.getValue(r, c)
ctx.fillText(String(displayValue), x, y)

// 编辑时显示原始公式
const editValue = formulaSheet.getDisplayValue(row, col)
openOverlay(row, col, editValue, 'edit')

// 保存时操作底层模型
formulaSheet.getModel().setValue(row, col, newValue)

// 公式模式下拦截单击
if (overlay.visible && overlayInput.value?.formulaMode) {
  // 点击插入单元格地址
  overlayInput.value.insertCellReference(cellAddr)
}
```

---

## 🧪 测试和验证

### 快速验证清单

```
[ ] 编译无误
    npm run build

[ ] 开发服务器运行
    npm run dev

[ ] 基础公式计算
    - 单元格 D2: 显示 250 (不是 "=B2+C2")
    - 单元格 D3: 显示 50

[ ] 编辑框样式
    - 双击单元格
    - 编辑框显示原始公式
    - 边框为红色
    - 背景为浅红色

[ ] 单元格引用插入
    - 在编辑框输入 "="
    - 点击其他单元格
    - 地址被插入

[ ] 范围选择
    - 在编辑框中拖动
    - 范围被插入 (A1:B2 格式)

[ ] 撤销/重做
    - Ctrl+Z 撤销
    - Ctrl+Y 重做
    - 公式编辑也被记录
```

### 调试技巧

在浏览器控制台运行:
```javascript
// 检查 FormulaSheet 状态
const formulaSheet = window.__formulaSheet
formulaSheet.getValue(1, 3)        // 检查计算结果
formulaSheet.getDisplayValue(1, 3) // 检查原始值

// 测试公式计算
const engine = new FormulaEngine(...)
engine.evaluate('=SUM(1,2,3)')     // {result: 6, error: null}

// 检查编辑框
document.querySelector('input').value  // 查看当前内容
document.querySelector('input').style  // 查看样式
```

---

## 📚 支持的 Excel 函数

### 数学函数 (20+)
```
SUM, AVERAGE, COUNT, MIN, MAX
ROUND, CEILING, FLOOR, ABS, SQRT
POWER, MOD, PRODUCT, SIGN, ODD, EVEN
SUBTOTAL, INT, LN, LOG, LOG10, EXP
```

### 统计函数 (15+)
```
STDEV, VAR, MEDIAN, PERCENTILE
LARGE, SMALL, QUARTILE, COUNTA
COUNTIF, COUNTIFS, RANK, MODE
SKEW, KURT, STANDARDIZE
```

### 文本函数 (10+)
```
CONCATENATE, LEFT, RIGHT, MID, LEN
UPPER, LOWER, TRIM, FIND, SUBSTITUTE
REPLACE, EXACT, TEXT, VALUE
```

### 日期函数 (10+)
```
DATE, TODAY, YEAR, MONTH, DAY
WEEKDAY, HOUR, MINUTE, SECOND
DATEDIF, NOW, TIME
```

### 逻辑函数 (5+)
```
IF, AND, OR, NOT, XOR
```

### 查询函数 (5+)
```
VLOOKUP, HLOOKUP, INDEX, MATCH, CHOOSE
```

**总计**: 100+ 函数

### 函数使用示例

```excel
=SUM(A1:A10)              // 求和
=AVERAGE(B1:B5)           // 平均值
=IF(C1>100,"高","低")     // 条件
=COUNT(D:D)               // 计数
=VLOOKUP(E1,F1:G10,2,0)   // 查询
=CONCATENATE(A1,B1)       // 文本连接
=DATE(2025,11,25)         // 日期
=ROUND(3.14159,2)         // 四舍五入到 3.14
```

---

## 🔄 数据流

### 显示流程
```
1. 用户看到单元格
2. CanvasSheet.drawCells() 被调用
3. 调用 formulaSheet.getValue(r, c)
4. FormulaSheet 检查是否公式
   - 如果是公式: 调用 FormulaEngine 计算
   - 如果不是: 返回原始值
5. 画布显示计算结果
```

### 编辑流程
```
1. 用户双击单元格
2. CanvasSheet.onDoubleClick() 被调用
3. 调用 formulaSheet.getDisplayValue(r, c)
4. FormulaSheet 返回原始值或公式
5. 编辑框打开，显示原始内容
6. 用户输入公式时，框变红色
7. 用户按 Enter
8. onOverlaySave() 调用 formulaSheet.getModel().setValue()
9. 底层模型更新
10. draw() 重新绘制，显示新的计算结果
```

### 单元格引用流程
```
1. 用户在编辑框输入 "="
2. 编辑框检测 formulaMode = true
3. 编辑框样式变红
4. 用户点击单元格 B1
5. Canvas onClick 被阻止
6. Canvas onMouseUp 检测 formulaMode
7. 调用 overlayInput.insertCellReference("B1")
8. 编辑框内容变为 "=B1"
9. 编辑框保持打开，用户可继续输入
10. 用户拖动从 B2 到 B3
11. onMouseUp 调用 insertRangeReference("B2", "B3")
12. 编辑框内容变为 "=B1B2:B3" (用户在步骤 11 前已输入完 B1)
```

---

## 🚀 下一步开发 (Phase 3)

### 任务清单

```
[ ] 改进拖动选择的视觉反馈
    - 拖动时显示虚线框
    - 显示范围地址
    - 高亮选择区域

[ ] Excel 风格交互
    - Shift+Click 扩展选择
    - Ctrl+Click 多选
    - 双击填充公式

[ ] 性能优化
    - 公式缓存机制
    - 依赖追踪
    - 大数据集优化
```

### 预计时间
- Phase 3: 2-3 小时
- Phase 4: 1-2 小时  
- Phase 5: 2-3 小时
- **总计**: 12-15 小时

---

## 📊 项目统计

### 代码行数
```
FormulaEngine.ts:      240 行
FormulaSheet.ts:       100 行
CanvasSheet.vue:       730 行 (+50 修改)
SheetOverlayInput.vue: 220 行 (+1 修改)
类型定义:              30 行
文档:                  1600+ 行
────────────────────────────
总计:                  2900+ 行
```

### 功能覆盖
```
✅ 公式解析和计算
✅ 100+ Excel 函数
✅ 单元格引用支持
✅ 范围选择支持
✅ 撤销/重做
✅ 编辑模式提示
🟡 错误处理和显示 (Phase 4)
🟡 性能缓存 (Phase 4)
🟡 依赖追踪 (Phase 5)
```

---

## 💡 最佳实践

### 1. 添加新函数

如果需要添加新的 Excel 函数支持，hot-formula-parser 已经内置了 100+ 个。如果需要自定义函数:

```typescript
// 在 FormulaEngine.ts 中
setFunction(functionName, implementation)

// 例子: 自定义 DOUBLE 函数
parser.setFunction('DOUBLE', (params: number[]) => {
  return params[0] * 2
})
```

### 2. 调试公式

```typescript
// 检查公式是否正确
console.log(formulaEngine.isFormula("=SUM(A1:A10)"))  // true

// 查看提取的单元格引用
console.log(formulaEngine.extractCellReferences("=SUM(A1:B2)"))
// [{ row: 0, col: 0, isAbsolute: false, ... }, ...]

// 计算公式
const result = formulaEngine.evaluate("=1+1")
console.log(result)  // { result: 2, error: null }
```

### 3. 性能优化

```typescript
// 使用公式缓存 (当前还未实现)
// 下一步: 在 FormulaSheet 中添加缓存
const cache = new Map<string, any>()

// 监听依赖变化时清除缓存
// 下一步: 实现依赖追踪
```

---

## 🐛 常见问题

### Q: 公式未显示结果?
A: 检查:
1. FormulaSheet 是否初始化
2. getValue() 是否被调用
3. hot-formula-parser 是否加载
4. 浏览器控制台是否有错误

### Q: 单元格引用无法插入?
A: 检查:
1. 编辑框是否进入公式模式 (输入 "=")
2. overlayInput.value 是否为 null
3. insertCellReference() 是否暴露
4. Canvas 点击是否被拦截

### Q: 撤销/重做不工作?
A: 检查:
1. UndoRedoManager 是否初始化
2. onOverlaySave() 中是否调用 undoRedo.execute()
3. Ctrl+Z / Ctrl+Y 快捷键是否绑定

---

## 📝 参考文档

### 相关文件
- `PHASE2_COMPLETE.md` - 详细实现说明
- `FORMULA_TEST.md` - 完整测试清单
- `QUICK_TEST.md` - 快速测试指南
- `FORMULA_PLAN.md` - 总体规划

### 外部参考
- [hot-formula-parser 文档](https://npm.im/hot-formula-parser)
- [Excel 函数列表](https://support.microsoft.com/en-us/office/excel-functions-by-category)
- [Vue 3 文档](https://vuejs.org/)

---

## 🎯 总结

**关键点**:
1. 公式通过 FormulaEngine 计算
2. FormulaSheet 提供透明的数据包装
3. SheetOverlayInput 支持单元格引用插入
4. CanvasSheet 集成所有功能
5. 100+ Excel 函数已支持

**下一步**:
1. 验证基础功能工作正常
2. 开始 Phase 3 (单元格框选优化)
3. 继续完成 Phase 4-5

**预计完成**:
- 基础功能: ✅ 已完成
- 完整功能: 12-15 小时

---

**准备好开始开发了吗?** 🚀

有任何问题，查看上面的文档或检查代码注释。

---

**最后更新**: 2025-11-25  
**维护者**: GitHub Copilot  
**许可证**: MIT
