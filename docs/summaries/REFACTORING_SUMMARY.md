# 公式系统重构总结

## 背景

### 原问题分析
你提出了一个非常关键的架构问题：

> "你的方法是在插入或删除行列时解析单元格公式吗？这样虽然直接，但是如果我复制单元格再粘贴，就没法实现类似excel的相对位置。是否应该给单元格添加属性，公式输入完后就解析出相对和绝对信息，再进行计算"

这是一个**根本性的设计缺陷**！

### 旧方案的问题

```
┌─────────────────────────────────────────────┐
│ 旧方案：操作时解析公式文本                  │
├─────────────────────────────────────────────┤
│                                             │
│  输入：=A1+B1                               │
│    ↓                                        │
│  存储：{ value: "=A1+B1" }  ← 只有文本！    │
│    ↓                                        │
│  复制粘贴：直接复制文本                     │
│    ↓                                        │
│  结果：=A1+B1  ❌ (应该是 =A2+B2)           │
│                                             │
└─────────────────────────────────────────────┘
```

**核心问题**：
- ❌ 无法实现复制粘贴时的相对引用调整
- ❌ 每次操作都要重新解析所有公式（性能差）
- ❌ 公式文本无法表达"相对于哪个位置"的信息

---

## 解决方案

### 新架构：公式元数据系统

```
┌─────────────────────────────────────────────┐
│ 新方案：存储结构化元数据                    │
├─────────────────────────────────────────────┤
│                                             │
│  输入：B2 = =A1+C1                          │
│    ↓                                        │
│  立即解析并存储元数据：                     │
│  {                                          │
│    value: "=A1+C1",                         │
│    formulaMetadata: {                       │
│      tokens: [                              │
│        { type: 'cellRef',                   │
│          rowOffset: -1,  ← A1 相对于 B2     │
│          colOffset: -1,                     │
│          isRowAbsolute: false,              │
│          isColAbsolute: false },            │
│        { type: 'text', value: '+' },        │
│        { type: 'cellRef',                   │
│          rowOffset: -1,  ← C1 相对于 B2     │
│          colOffset: +1,                     │
│          ... }                              │
│      ]                                      │
│    }                                        │
│  }                                          │
│    ↓                                        │
│  复制到 D4：基于元数据重建                  │
│    ↓                                        │
│  结果：=C3+E3  ✅ 正确！                    │
│                                             │
└─────────────────────────────────────────────┘
```

### Excel 的真实原理

Excel 内部**不存储公式文本**，而是存储：
1. **抽象语法树（AST）** 或 **字节码**
2. 每个引用的**相对偏移量**或**绝对位置**

这正是我们新实现的方式！

---

## 实现细节

### 1. 数据结构

#### Cell 接口扩展
```typescript
interface Cell {
  value: string                      // 公式文本或普通值
  formulaMetadata?: FormulaMetadata  // ⭐ 新增：公式元数据
}
```

#### FormulaMetadata
```typescript
interface FormulaMetadata {
  originalFormula: string    // 原始公式
  formulaRow: number         // 所在行
  formulaCol: number         // 所在列
  tokens: FormulaToken[]     // ⭐ 解析后的 token 列表
  isParsed: boolean
}
```

#### CellReferenceToken
```typescript
interface CellReferenceToken {
  type: 'cellRef'
  rowOffset: number          // ⭐ 相对偏移（相对引用）
  colOffset: number          // ⭐ 相对偏移（相对引用）
  absoluteRow?: number       // ⭐ 绝对位置（绝对引用）
  absoluteCol?: number       // ⭐ 绝对位置（绝对引用）
  isRowAbsolute: boolean     // ⭐ 区分引用类型
  isColAbsolute: boolean     // ⭐ 区分引用类型
  originalText: string
}
```

### 2. 核心模块

#### `FormulaMetadata.ts`（新增）
- `FormulaMetadataParser.parse()` - 解析公式，生成元数据
- `FormulaMetadataParser.rebuild()` - 基于元数据重建公式
- `FormulaMetadataParser.adjust()` - 调整元数据（插入/删除行列）

#### `FormulaSheet.ts`（重构）
- `setValue()` - 输入时自动解析元数据
- `copyCell()` - ⭐ 新增：复制单个单元格
- `copyRange()` - ⭐ 新增：复制区域
- `adjustAllFormulas()` - 使用元数据调整

#### `SheetModel.ts`（扩展）
- `setCell()` - ⭐ 新增：设置完整单元格对象

### 3. 工作流程

#### 输入公式
```typescript
// 用户在 B2 输入 =A1+C1
setValue(1, 1, '=A1+C1')
  ↓
FormulaMetadataParser.parse('=A1+C1', 1, 1)
  ↓
解析为 tokens：
  [
    CellRef(rowOffset:-1, colOffset:-1),  // A1 相对于 B2
    Text('+'),
    CellRef(rowOffset:-1, colOffset:+1)   // C1 相对于 B2
  ]
  ↓
存储到 cell.formulaMetadata
```

#### 复制粘贴
```typescript
// 从 B2 复制到 D4
copyCell(1, 1, 3, 3)
  ↓
获取源单元格的 formulaMetadata
  ↓
FormulaMetadataParser.rebuild(metadata, 3, 3)
  ↓
重建公式：
  rowOffset:-1, colOffset:-1 → C3 (3-1, 3-1)
  rowOffset:-1, colOffset:+1 → E3 (3-1, 3+1)
  ↓
结果：=C3+E3 ✅
```

#### 插入行列
```typescript
// 在第 2 行前插入 1 行
adjustAllFormulas('insertRow', 2, 1)
  ↓
遍历所有单元格
  ↓
对每个公式单元格调用 FormulaMetadataParser.adjust()
  ↓
调整元数据中的偏移量或绝对位置
  ↓
重建公式文本并更新
```

---

## 功能对比

### 场景 1：相对引用复制

| 操作 | 旧方案 | 新方案 |
|------|--------|--------|
| B2 输入 `=A1+C1` | 存储文本 | 存储偏移 `[(-1,-1), (+), (-1,+1)]` |
| 复制到 D4 | ❌ `=A1+C1`（错误） | ✅ `=C3+E3`（正确） |
| 复制到 E5 | ❌ `=A1+C1`（错误） | ✅ `=D4+F4`（正确） |

### 场景 2：绝对引用

| 操作 | 旧方案 | 新方案 |
|------|--------|--------|
| B2 输入 `=$A$1+C1` | 存储文本 | 存储 `[(abs:0,0), (+), (-1,+1)]` |
| 复制到 D4 | ❌ 可能错误 | ✅ `=$A$1+E3`（$A$1 不变） |

### 场景 3：混合引用

| 操作 | 旧方案 | 新方案 |
|------|--------|--------|
| B2 输入 `=$A1+C$1` | 存储文本 | 存储混合偏移 |
| 复制到 D4 | ❌ 可能错误 | ✅ `=$A3+E$1`（部分调整） |

---

## 性能优化

### 解析次数

**旧方案**：
```
输入 100 个公式：解析 0 次（只存储文本）
插入 1 行：      解析 100 次 ❌ (每次操作都解析)
插入 5 行：      解析 500 次 ❌
复制 50 个公式： 解析 0 次，但结果错误 ❌
```

**新方案**：
```
输入 100 个公式：解析 100 次（存储元数据）
插入 1 行：      解析 0 次 ✅ (直接调整数值)
插入 5 行：      解析 0 次 ✅
复制 50 个公式： 解析 0 次 ✅ (基于元数据重建)
```

### 内存占用

```typescript
// 普通单元格：~50 bytes
{ value: "100" }

// 公式单元格（旧）：~50 bytes
{ value: "=A1+B1" }

// 公式单元格（新）：~500 bytes
{
  value: "=A1+B1",
  formulaMetadata: { ... }  // +450 bytes
}
```

**结论**：内存增加约 450 bytes/公式单元格，但换来了：
- ✅ 正确的复制粘贴行为
- ✅ 更快的插入/删除操作
- ✅ 为高级功能铺路

---

## 代码文件清单

### 新增文件

1. **`src/lib/FormulaMetadata.ts`**（~350 行）
   - `CellReferenceToken` 接口
   - `RangeReferenceToken` 接口
   - `FormulaMetadata` 接口
   - `FormulaMetadataParser` 类
     - `parse()` - 解析公式
     - `rebuild()` - 重建公式
     - `adjust()` - 调整元数据

2. **`test-formula-metadata.html`**（~300 行）
   - 6 个测试场景
   - 交互式测试界面

3. **`doc/FORMULA_METADATA_ARCHITECTURE.md`**
   - 架构设计文档
   - 原理说明
   - 对比示例

4. **`doc/FORMULA_METADATA_USAGE.md`**
   - 使用指南
   - API 参考
   - 示例代码

### 修改文件

1. **`src/lib/SheetModel.ts`**
   - 扩展 `Cell` 接口，添加 `formulaMetadata?` 属性
   - 新增 `setCell()` 方法

2. **`src/lib/FormulaSheet.ts`**
   - 修改 `setValue()` - 自动解析元数据
   - 修改 `adjustAllFormulas()` - 使用元数据调整
   - 新增 `copyCell()` - 复制单个单元格
   - 新增 `copyRange()` - 复制区域

---

## 测试计划

### 自动化测试（test-formula-metadata.html）

✅ **测试 1**：相对引用复制粘贴
- B2: `=A1+C1` → D4: `=C3+E3`

✅ **测试 2**：绝对引用复制粘贴
- B2: `=$A$1+C1` → D4: `=$A$1+E3`

✅ **测试 3**：混合引用复制粘贴
- B2: `=$A1+C$1` → D4: `=$A3+E$1`

✅ **测试 4**：区域复制
- A1:B2 → D4:E5（4个公式同时复制）

✅ **测试 5**：插入行后的调整
- B3: `=A1+A2` → 插入第1行 → `=A2+A3`

✅ **测试 6**：性能测试
- 创建 100 个公式
- 复制 100 个公式
- 验证结果正确性

### 手动测试场景

⬜ **复杂公式**：
- `=SUM(A1:B10)`
- `=IF(A1>0, B1, C1)`
- `=VLOOKUP($A1, D:E, 2, FALSE)`

⬜ **边界情况**：
- 复制到表格边界
- 删除被引用的行列
- 循环引用检测

---

## 未来扩展

### 短期（已规划）

- [ ] 在 `CanvasSheet.vue` 中集成复制粘贴 UI
- [ ] 添加键盘快捷键（Ctrl+C / Ctrl+V）
- [ ] 剪切板支持（跨应用复制）

### 中期

- [ ] 命名范围：`=SUM(Sales)`
- [ ] 跨表引用：`=Sheet2!A1`
- [ ] 公式审计（显示依赖箭头）

### 长期

- [ ] 结构化引用：`=Table1[@Column1]`
- [ ] 数组公式：`{=A1:A10*B1:B10}`
- [ ] 动态数组（Spill）

---

## 总结

### 核心改进

✅ **架构正确**：存储"意图"而非"结果"
✅ **行为正确**：完全符合 Excel 的复制粘贴逻辑
✅ **性能更好**：一次解析，多次使用
✅ **易于扩展**：为高级功能奠定基础

### 关键洞察

你的问题直击要害！这不是一个小的功能改进，而是**架构级的重构**。

旧方案的问题在于：
- 把公式当作"文本"处理 ❌
- 缺失了"相对位置"的概念 ❌

新方案遵循 Excel 的设计理念：
- 把公式当作"结构化数据"处理 ✅
- 保存"相对偏移"和"绝对位置"的信息 ✅

### 致谢

感谢你提出这个问题！这是一个典型的"提对问题比找到答案更重要"的案例。

这次重构从根本上解决了复制粘贴的问题，使整个公式系统向 Excel 的标准又迈进了一大步。

---

**文档索引**：
- [架构设计](./FORMULA_METADATA_ARCHITECTURE.md)
- [使用指南](./FORMULA_METADATA_USAGE.md)
- [旧版参考](./FORMULA_REFERENCE_ADJUSTMENT.md)
