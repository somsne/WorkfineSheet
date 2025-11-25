# Excel 公式引用自动调整功能

## 功能概述

实现了类似 Excel 的公式引用自动调整功能。当插入或删除行/列时，所有公式中的单元格引用会自动更新，就像 Excel 一样。

## Excel 引用模式

### 1. 相对引用（Relative Reference）
- 格式：`A1`, `B2`, `C3`
- 行为：当插入/删除行列时，引用会自动调整
- 示例：
  - 公式 `=A1+B1` 在行1上方插入新行后变为 `=A2+B2`
  - 公式 `=A1+B1` 在列A左侧插入新列后变为 `=B1+C1`

### 2. 绝对引用（Absolute Reference）
- 格式：`$A$1`, `$B$2`, `$C$3`
- 行为：插入/删除行列时，引用**不会**自动调整
- 用途：引用固定的单元格（如常量、标题等）

### 3. 混合引用（Mixed Reference）
- 格式：`$A1`（列绝对，行相对）或 `A$1`（行绝对，列相对）
- 行为：
  - `$A1`：插入/删除列时不变，插入/删除行时调整
  - `A$1`：插入/删除行时不变，插入/删除列时调整

## 实现细节

### 核心函数

#### 1. `FormulaEngine.adjustFormulaReferences()`
```typescript
adjustFormulaReferences(
  formula: string,
  operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
  index: number,
  count: number = 1
): string
```

**功能**：调整单个公式中的所有引用

**调整规则**：
- **插入行**：相对引用的行号 >= 插入位置时，行号 +1
- **删除行**：
  - 引用的行被删除 → 标记为 `#REF!`
  - 引用的行 > 删除位置 → 行号 -1
- **插入列**：相对引用的列号 >= 插入位置时，列号 +1
- **删除列**：
  - 引用的列被删除 → 标记为 `#REF!`
  - 引用的列 > 删除位置 → 列号 -1

#### 2. `FormulaSheet.adjustAllFormulas()`
```typescript
adjustAllFormulas(
  operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
  index: number,
  count: number = 1
): void
```

**功能**：遍历所有单元格，调整所有包含公式的单元格

**流程**：
1. 遍历模型中的所有单元格
2. 识别包含公式的单元格
3. 调用 `adjustFormulaReferences` 调整公式
4. 如果公式有变化，更新单元格值
5. 清空公式缓存，强制重新计算

### 集成到行列操作

在 `CanvasSheet.vue` 的插入/删除操作中，流程如下：

1. **调整公式引用**（在移动数据之前）
2. 移动单元格数据
3. 更新自定义行高/列宽
4. 清空公式缓存
5. 重新绘制

## 测试场景

### 场景1：插入行 - 相对引用调整
```
初始状态：
A1: 10
A2: 20
A3: =A1+A2  // 结果: 30

操作：在行1上方插入新行

预期结果：
A1: (空)
A2: 10
A3: 20
A4: =A2+A3  // 公式自动调整，结果仍为: 30
```

### 场景2：删除行 - #REF! 错误
```
初始状态：
A1: 10
A2: 20
A3: =A1+A2  // 结果: 30

操作：删除行1

预期结果：
A1: 20
A2: =#REF!+A1  // A1被删除，引用变为#REF!
```

### 场景3：绝对引用不变
```
初始状态：
A1: 100  (常量)
A2: 5
A3: =A2*$A$1  // 结果: 500

操作：在行1上方插入新行

预期结果：
A1: (空)
A2: 100
A3: 5
A4: =A3*$A$2  // A3调整为A4，但$A$1调整为$A$2（因为常量位置变了）
```

**注意**：当前实现中，绝对引用在物理移动行列时不会调整。如果需要更智能的行为，可以扩展实现。

### 场景4：插入列 - 公式调整
```
初始状态：
A1: 10
B1: 20
C1: =A1+B1  // 结果: 30

操作：在列A左侧插入新列

预期结果：
A1: (空)
B1: 10
C1: 20
D1: =B1+C1  // 公式自动调整，结果仍为: 30
```

## 技术亮点

### 1. 正则表达式匹配
使用正则表达式 `/(\$?)([A-Za-z]+)(\$?)(\d+)/g` 匹配所有引用格式：
- 支持相对引用：`A1`, `B2`
- 支持绝对引用：`$A$1`, `$B$2`
- 支持混合引用：`$A1`, `A$1`
- 大小写不敏感：`a1` 和 `A1` 都能识别

### 2. 从后往前替换
为避免字符串索引错位，替换时从后往前进行：
```typescript
replacements.sort((a, b) => b.index - a.index)
for (const { original, adjusted, index } of replacements) {
  adjustedExpression =
    adjustedExpression.substring(0, index) +
    adjusted +
    adjustedExpression.substring(index + original.length)
}
```

### 3. #REF! 错误处理
当引用的单元格被删除时，自动标记为 `#REF!` 错误，与 Excel 行为一致。

### 4. 范围引用支持
虽然当前主要处理单个单元格引用，但正则表达式也能匹配范围引用（如 `A1:B3`）中的各个部分，每个单元格引用都会被独立调整。

## 已知限制

1. **范围引用**：`A1:B3` 格式的范围引用会被拆分为独立的单元格引用处理，可能不完全符合 Excel 的范围调整逻辑
2. **命名范围**：不支持命名范围（Named Ranges）
3. **跨表引用**：不支持跨工作表引用（如 `Sheet2!A1`）
4. **结构化引用**：不支持表格结构化引用（如 `Table1[@Column1]`）

## 未来增强

1. 完整的范围引用调整逻辑
2. 支持命名范围
3. 支持多工作表
4. 更智能的绝对引用处理
5. 性能优化（批量操作时）

## 使用示例

```typescript
// 在行3上方插入一行
formulaSheet.adjustAllFormulas('insertRow', 3, 1)

// 删除列B（列号1）
formulaSheet.adjustAllFormulas('deleteCol', 1, 1)

// 插入3列，从列C（列号2）开始
formulaSheet.adjustAllFormulas('insertCol', 2, 3)
```
