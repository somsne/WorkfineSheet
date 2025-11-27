# 公式支持实现计划

**状态**: 🟡 进行中  
**日期**: 2025-11-25  
**版本**: 0.2.0-dev

## 已完成

✅ **Task 1: 分析 hot-formula-parser** (完成)
- 版本: 3.0.2
- 功能: 支持 Excel 公式、函数、运算符
- API: parse(), setVariable(), setFunction()
- 支持的函数: SUM, AVERAGE, COUNT, IF, AND, OR 等 100+

✅ **Task 2: 创建 FormulaEngine** (完成)
- 文件: `src/lib/FormulaEngine.ts` (240 行)
- 功能:
  - isFormula() - 检查是否为公式
  - evaluate() - 计算公式结果
  - extractCellReferences() - 提取单元格引用
  - getCellAddress() - 生成单元格地址
  - getRangeString() - 生成范围字符串
- 特性:
  - 完整的 TypeScript 类型支持
  - 支持绝对/相对引用
  - 错误处理

✅ **Task 3: 创建 FormulaSheet** (完成)
- 文件: `src/lib/FormulaSheet.ts` (100 行)
- 功能:
  - getValue() - 获取计算后的值
  - getDisplayValue() - 获取原始值（用于编辑）
  - setValue() - 设置单元格值
  - isFormula() - 检查是否公式
  - getCellAddress() - 生成地址
- 作用: 包装 SheetModel，支持透明的公式计算

✅ **Task 4: 改进 SheetOverlayInput** (完成)
- 新增功能:
  - formulaMode 计算属性 - 检测是否输入公式
  - cursorPos - 记录光标位置
  - insertCellReference() - 插入单元格引用
  - insertRangeReference() - 插入范围引用
  - 公式输入框样式（红色边框，浅红背景）
  - defineExpose() - 暴露方法给父组件
- 改进:
  - IME 支持保留
  - 光标位置追踪

## 待完成

🔴 **Task 5: 改进 CanvasSheet 集成**
优先级: 最高
工作量: 3-4 小时

需要完成:
- 使用 FormulaSheet 替代 SheetModel
- 添加公式单元格的特殊渲染（显示结果或错误）
- 实现公式输入时的单元格框选功能
  - 监听 Canvas 上的鼠标点击事件
  - 如果输入框处于公式模式，插入单元格引用而不是移动选择
  - 支持拖动框选范围
- 添加公式依赖关系追踪（可选）
- 公式错误提示

关键代码改动:
```typescript
// 初始化时
const model = new SheetModel()
const formulaSheet = new FormulaSheet(model)

// 获取值时
const displayValue = formulaSheet.getValue(row, col)

// 编辑保存时（需要调用底层 model）
formulaSheet.getModel().setValue(row, col, value)

// 公式输入框引用时
formulaInput.insertCellReference(cellAddress)
```

🔴 **Task 6: 实现单元格框选**
优先级: 高
工作量: 2-3 小时

需要完成:
- 检测输入框是否处于公式模式
- Canvas 点击事件改进
  - 如果输入框公式模式：插入单元格引用
  - 否则：正常选择单元格
- 拖动框选支持
  - 记录起始点和结束点
  - 实时显示选择框（虚线）
  - 释放鼠标时插入范围引用

🔴 **Task 7: 公式渲染和显示**
优先级: 高
工作量: 1-2 小时

需要完成:
- 区分显示公式内容 vs 计算结果
  - 编辑框中显示: `=SUM(A1:A10)`
  - 单元格中显示: `150` (计算结果)
- 公式错误显示
  - 单元格显示: `#DIV/0!` 或其他错误
  - 颜色标记（红色文本）
- 公式提示信息（可选）
  - Hover 时显示公式原文

🔴 **Task 8: 公式撤销/重做**
优先级: 中
工作量: 1 小时

需要完成:
- 公式编辑也应该支持撤销
- onOverlaySave 中的撤销逻辑已支持任意值
- 确保公式值计算不影响撤销

🔴 **Task 9: 文档和测试**
优先级: 中
工作量: 2-3 小时

需要完成:
- FORMULAS.md - 公式功能文档
  - 支持的函数列表
  - 使用示例
  - 限制说明
- 测试场景:
  - 基础公式 (=1+2, =SUM(A1:A3))
  - 单元格引用 (=A1*2, =A1+B1)
  - 范围函数 (=SUM(A1:A10), =AVERAGE(B1:B5))
  - 嵌套公式 (=IF(SUM(A1:A3)>10, "YES", "NO"))
  - 错误处理 (=1/0 显示 #DIV/0!)
  - 公式撤销/重做

## 支持的 Excel 函数列表

由 hot-formula-parser 提供的函数（100+）:

**数学函数:**
- ABS, ACOS, ACOSH, ASIN, ASINH, ATAN, ATAN2, ATANH
- CEILING, COS, COSH, DEGREES, EVEN, EXP, FACT
- FLOOR, INT, LN, LOG, LOG10, MOD, ODD, POWER
- PRODUCT, RADIANS, ROUND, ROUNDDOWN, ROUNDUP, SIGN
- SIN, SINH, SQRT, STDEV, SUM, SUMPRODUCT, TAN, TANH, TRUNC
- VAR, VARP, MIN, MAX, MEDIAN

**统计函数:**
- AVERAGE, COUNT, COUNTA, COUNTIF, COUNTBLANK
- LARGE, SMALL, PERCENTILE, QUARTILE
- STDEV, STDEVP, VAR, VARP

**文本函数:**
- CONCATENATE, FIND, LEFT, LEN, LOWER, MID
- REPLACE, RIGHT, SEARCH, SUBSTITUTE, TEXT, TRIM, UPPER
- VALUE

**日期函数:**
- DATE, DAY, HOUR, MINUTE, MONTH, SECOND, TIME, TIMEVALUE
- TODAY, WEEKDAY, YEAR

**逻辑函数:**
- AND, IF, NOT, OR, XOR, SWITCH

**查询函数:**
- CHOOSE, INDEX, MATCH, HLOOKUP, VLOOKUP

**其他:**
- ISNA, ISNUMBER, ISTEXT, ERROR.TYPE, ISERROR

## 技术架构

```
CanvasSheet.vue (主组件)
    ↓
FormulaSheet (包装类)
    ├─ SheetModel (底层数据)
    └─ FormulaEngine (计算引擎)
         └─ hot-formula-parser

SheetOverlayInput.vue (编辑框)
    ├─ 公式输入模式检测
    └─ 单元格引用插入
```

## 下一步行动

1. **立即** (30 分钟)
   - 阅读本计划
   - 确认需求范围

2. **第一阶段** (4 小时)
   - 完成 Task 5 (CanvasSheet 集成)
   - 实现基础公式计算显示

3. **第二阶段** (3 小时)
   - 完成 Task 6 (单元格框选)
   - 实现 Excel 风格的公式编辑体验

4. **第三阶段** (2 小时)
   - 完成 Task 7 (公式渲染)
   - 完成 Task 8 (撤销重做)

5. **最后阶段** (3 小时)
   - 完成 Task 9 (文档和测试)
   - 完整测试覆盖

**总估计工时**: 12-15 小时

## 实现注意事项

### 1. 单元格引用格式
```
绝对引用: $A$1
行锁定: A$1
列锁定: $A1
相对引用: A1 (当前不支持相对行列计算)
范围: A1:C5 或 $A$1:$C$5
```

### 2. 公式示例
```excel
=A1+B1              # 简单加法
=SUM(A1:A10)        # 范围求和
=IF(A1>10,"Y","N")  # 条件判断
=A1*2+B1*3          # 复杂表达式
=AVERAGE(A1:A5)     # 平均值
```

### 3. 错误处理
```
#ERROR!    - 一般错误
#DIV/0!    - 除以零
#NAME?     - 未定义的函数
#VALUE!    - 类型错误
#N/A       - 不可用
```

### 4. 性能考虑
- 避免循环引用检测（目前不支持）
- 缓存公式计算结果
- 限制公式深度（可选）

## 已知限制

❌ 当前不支持:
- 循环引用检测
- 相对行列引用计算（如 R1C1 格式）
- 数组公式
- 自定义函数（可扩展）
- 条件格式

✅ 将支持:
- 所有 Excel 标准函数
- 绝对引用
- 范围引用
- 嵌套公式
- 公式撤销/重做
- 公式错误显示

## 参考资源

- hot-formula-parser: https://github.com/handsontable/formula-parser
- Excel 函数文档: https://support.microsoft.com/en-us/office/excel-functions-alphabetical-b3944572-255d-4efb-bb96-c6d90033e188

---

**下一步**: 开始 Task 5 - CanvasSheet 集成
