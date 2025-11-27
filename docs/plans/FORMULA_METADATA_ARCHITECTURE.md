# 公式元数据架构 - 设计文档

## 问题分析

### 旧方案的局限性
原先的方案是在**插入/删除行列时**解析公式文本并调整引用：
```typescript
// 旧方案：操作时才解析
adjustAllFormulas(operation, index, count) {
  // 遍历所有单元格
  // 用正则表达式解析公式文本
  // 调整引用位置
  // 重新生成公式文本
}
```

**问题：**
1. ❌ **复制粘贴无法实现相对引用**
   - 复制 `=A1+B1` 到下一行，期望变成 `=A2+B2`
   - 但旧方案只在插入/删除时调整，复制粘贴时只能原样复制文本

2. ❌ **重复解析性能差**
   - 每次操作都要用正则表达式重新解析所有公式
   - 对于大量公式的表格，性能低下

3. ❌ **无法区分"相对于原位置"的偏移**
   - 公式文本 `=A1` 无法知道它是在 `B2` 输入的（相对偏移 -1, -1）
   - 还是在 `C3` 输入的（相对偏移 -2, -2）

---

## 新方案：公式元数据架构

### Excel 的真实原理
Excel 内部**不存储公式文本**，而是存储：
- 公式的**抽象语法树（AST）**
- 每个单元格引用的**相对偏移量**或**绝对位置**

### 核心设计

#### 1. 单元格引用的三种模式

| 模式 | 示例 | 存储内容 | 复制行为 |
|------|------|----------|----------|
| **相对引用** | `A1` | rowOffset: -1, colOffset: -1 | 自动调整 |
| **绝对引用** | `$A$1` | absoluteRow: 0, absoluteCol: 0 | 不变 |
| **混合引用** | `$A1` 或 `A$1` | 列绝对 / 行绝对 | 部分调整 |

#### 2. 数据结构

```typescript
// 单元格引用 Token
interface CellReferenceToken {
  type: 'cellRef'
  rowOffset: number        // 相对偏移（如果是相对引用）
  colOffset: number        // 相对偏移（如果是相对引用）
  absoluteRow?: number     // 绝对位置（如果是绝对引用）
  absoluteCol?: number     // 绝对位置（如果是绝对引用）
  isRowAbsolute: boolean   // 是否绝对引用
  isColAbsolute: boolean   // 是否绝对引用
}

// 公式元数据
interface FormulaMetadata {
  originalFormula: string   // 原始公式文本
  formulaRow: number        // 公式所在行
  formulaCol: number        // 公式所在列
  tokens: FormulaToken[]    // 解析后的 token 列表
  isParsed: boolean
}

// 单元格数据
interface Cell {
  value: string             // 显示的公式文本
  formulaMetadata?: FormulaMetadata  // 元数据
}
```

#### 3. 工作流程

##### 输入公式时（一次性解析）
```typescript
// 用户在 B2 输入: =A1+C1
setValue(1, 1, '=A1+C1') {
  // 1. 解析公式
  const metadata = FormulaMetadataParser.parse('=A1+C1', 1, 1)
  
  // 2. 存储元数据
  metadata.tokens = [
    { type: 'cellRef', rowOffset: -1, colOffset: -1, ... }, // A1 相对于 B2
    { type: 'text', value: '+' },
    { type: 'cellRef', rowOffset: -1, colOffset: 1, ... },  // C1 相对于 B2
  ]
  
  // 3. 保存到单元格
  cell.formulaMetadata = metadata
}
```

##### 复制粘贴时（基于元数据重建）
```typescript
// 从 B2 复制到 D4
copyCell(1, 1, 3, 3) {
  // 1. 获取源单元格元数据
  const metadata = cell.formulaMetadata
  
  // 2. 基于新位置重建公式
  const newFormula = FormulaMetadataParser.rebuild(metadata, 3, 3)
  // rowOffset: -1, colOffset: -1 → C3 (3-1, 3-1)
  // rowOffset: -1, colOffset: 1  → E3 (3-1, 3+1)
  // 结果: =C3+E3
  
  // 3. 设置到目标单元格
  setValue(3, 3, newFormula)
}
```

##### 插入行列时（调整元数据）
```typescript
// 在第 2 行前插入 1 行
adjustAllFormulas('insertRow', 2, 1) {
  // 遍历所有公式单元格
  forEach(cell => {
    // 调整元数据中的偏移量或绝对位置
    const newMetadata = FormulaMetadataParser.adjust(
      cell.formulaMetadata,
      'insertRow',
      2,
      1
    )
    
    // 重建公式文本
    const newFormula = rebuild(newMetadata, cell.row, cell.col)
    setValue(cell.row, cell.col, newFormula)
  })
}
```

---

## 对比示例

### 场景 1：复制粘贴

| 操作 | 旧方案 | 新方案 |
|------|--------|--------|
| 在 B2 输入 `=A1+C1` | 存储文本 `"=A1+C1"` | 存储偏移 `[(-1,-1), (+), (-1,+1)]` |
| 复制到 D4 | ❌ 得到 `=A1+C1`（错误） | ✅ 得到 `=C3+E3`（正确） |
| 复制到 E5 | ❌ 得到 `=A1+C1`（错误） | ✅ 得到 `=D4+F4`（正确） |

### 场景 2：绝对引用

| 操作 | 旧方案 | 新方案 |
|------|--------|--------|
| 在 B2 输入 `=$A$1+C1` | 存储文本 `"=$A$1+C1"` | 存储 `[(abs:0,0), (+), (-1,+1)]` |
| 复制到 D4 | ❌ 可能错误 | ✅ 得到 `=$A$1+E3`（$A$1 不变，C1 调整） |

### 场景 3：插入行

| 操作 | 旧方案 | 新方案 |
|------|--------|--------|
| B2: `=A1+C1` | 存储文本 | 存储偏移 |
| 在第 1 行前插入 | 临时解析调整 → `=A2+C2` | 直接调整偏移 → `=A2+C2` |
| 性能（1000 个公式） | ❌ 慢（每次解析 1000 次） | ✅ 快（直接修改数值） |

---

## 技术优势

### 1. ✅ 支持完整的 Excel 复制粘贴行为
```
源: B2 = =A1+C1
复制到 D4:
  旧方案: =A1+C1 ❌
  新方案: =C3+E3 ✅
```

### 2. ✅ 性能优化
- **输入时**：解析 1 次，存储元数据
- **复制时**：直接基于元数据重建，无需解析
- **插入/删除时**：只调整数值，无需正则匹配

### 3. ✅ 准确性
- 明确区分相对/绝对引用
- 保存引用的"意图"而非"结果"
- 避免复制粘贴后引用错乱

### 4. ✅ 可扩展性
- 支持范围引用 `A1:B3`
- 支持命名范围（未来）
- 支持跨表引用 `Sheet2!A1`（未来）

---

## 实现清单

### 已完成 ✅
- [x] `FormulaMetadata.ts` - 元数据数据结构和解析器
- [x] `SheetModel.ts` - 单元格添加 `formulaMetadata` 属性
- [x] `FormulaSheet.ts` - setValue 时自动解析元数据
- [x] `FormulaSheet.ts` - adjustAllFormulas 使用元数据调整
- [x] `FormulaSheet.ts` - copyCell / copyRange 支持相对引用

### 待集成
- [ ] 在 `CanvasSheet.vue` 中实现复制粘贴功能
- [ ] 测试各种复制粘贴场景
- [ ] 性能测试（大量公式）

---

## 使用示例

### 示例 1：基本复制粘贴
```typescript
const sheet = new FormulaSheet(model)

// 在 B2 输入公式
sheet.setValue(1, 1, '=A1+C1')  // 自动解析并存储元数据

// 复制到 D4
sheet.copyCell(1, 1, 3, 3)      // 自动调整为 =C3+E3

// 验证
console.log(sheet.getDisplayValue(3, 3))  // '=C3+E3'
```

### 示例 2：区域复制
```typescript
// 在 A1:B2 创建公式表
sheet.setValue(0, 0, '=C1')     // A1
sheet.setValue(0, 1, '=C2')     // B1
sheet.setValue(1, 0, '=C1+1')   // A2
sheet.setValue(1, 1, '=C2+1')   // B2

// 复制到 D4:E5
sheet.copyRange(0, 0, 1, 1, 3, 3)

// 结果：
// D4: =F4
// E4: =F5
// D5: =F4+1
// E5: =F5+1
```

### 示例 3：绝对引用
```typescript
// 在 B2 输入包含绝对引用的公式
sheet.setValue(1, 1, '=$A$1+C1')

// 复制到 D4
sheet.copyCell(1, 1, 3, 3)

// 结果: =$A$1+E3
// $A$1 保持不变，C1 调整为 E3
```

---

## 总结

新的元数据架构从根本上解决了公式引用的问题：

1. **存储意图而非结果** - 保存"相对偏移"而非"绝对位置"
2. **一次解析，多次使用** - 性能优化
3. **完整支持 Excel 行为** - 复制粘贴、插入删除都正确

这是一个更符合 Excel 内部实现的架构设计！
