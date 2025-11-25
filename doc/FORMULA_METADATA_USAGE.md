# 公式元数据系统 - 使用指南

## 概述

新的公式元数据系统已经实现，完全支持 Excel 风格的公式相对/绝对引用，并在复制粘贴时自动调整引用位置。

## 核心改进

### 之前的问题 ❌
```typescript
// 旧方案：只在插入/删除行列时调整公式
// 在 B2 输入 =A1+C1
setValue(1, 1, '=A1+C1')  // 只存储文本

// 复制粘贴
copyCell(1, 1, 3, 3)  // ❌ 仍然是 =A1+C1（错误！）
```

### 现在的解决方案 ✅
```typescript
// 新方案：存储公式的结构化元数据
// 在 B2 输入 =A1+C1
setValue(1, 1, '=A1+C1')
// 自动解析并存储：
// - A1: rowOffset=-1, colOffset=-1 (相对于B2)
// - C1: rowOffset=-1, colOffset=+1 (相对于B2)

// 复制粘贴到 D4
copyCell(1, 1, 3, 3)
// ✅ 自动重建为 =C3+E3（正确！）
```

## API 参考

### FormulaSheet 新增方法

#### copyCell() - 复制单个单元格
```typescript
/**
 * 复制单元格到新位置（支持公式相对引用）
 * @param fromRow 源行号（0-based）
 * @param fromCol 源列号（0-based）
 * @param toRow 目标行号（0-based）
 * @param toCol 目标列号（0-based）
 */
copyCell(fromRow: number, fromCol: number, toRow: number, toCol: number): void

// 示例：
sheet.copyCell(1, 1, 3, 3)  // 从 B2 复制到 D4
```

#### copyRange() - 复制区域
```typescript
/**
 * 批量复制区域（支持公式相对引用）
 * @param fromStartRow 源起始行
 * @param fromStartCol 源起始列
 * @param fromEndRow 源结束行
 * @param fromEndCol 源结束列
 * @param toStartRow 目标起始行
 * @param toStartCol 目标起始列
 */
copyRange(
  fromStartRow: number,
  fromStartCol: number,
  fromEndRow: number,
  fromEndCol: number,
  toStartRow: number,
  toStartCol: number
): void

// 示例：
sheet.copyRange(0, 0, 1, 1, 3, 3)  // 从 A1:B2 复制到 D4:E5
```

### FormulaMetadataParser - 底层工具

#### parse() - 解析公式
```typescript
/**
 * 解析公式，生成元数据
 * @param formula 原始公式文本（包含 '='）
 * @param formulaRow 公式所在的行号
 * @param formulaCol 公式所在的列号
 * @returns FormulaMetadata
 */
static parse(formula: string, formulaRow: number, formulaCol: number): FormulaMetadata

// 示例：
const metadata = FormulaMetadataParser.parse('=A1+$B$2', 1, 1)
// 返回包含 tokens 的元数据对象
```

#### rebuild() - 重建公式
```typescript
/**
 * 根据元数据和新位置重建公式
 * @param metadata 公式元数据
 * @param newRow 新的行号
 * @param newCol 新的列号
 * @returns 重建后的公式文本
 */
static rebuild(metadata: FormulaMetadata, newRow: number, newCol: number): string

// 示例：
const newFormula = FormulaMetadataParser.rebuild(metadata, 3, 3)
```

#### adjust() - 调整元数据
```typescript
/**
 * 调整元数据（用于插入/删除行列）
 * @param metadata 原始元数据
 * @param operation 操作类型
 * @param index 插入/删除的位置
 * @param count 插入/删除的数量
 * @returns 调整后的元数据
 */
static adjust(
  metadata: FormulaMetadata,
  operation: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
  index: number,
  count: number = 1
): FormulaMetadata
```

## 使用示例

### 示例 1：基本复制粘贴

```typescript
const model = new SheetModel()
const sheet = new FormulaSheet(model)

// 设置一些数值
sheet.setValue(0, 0, '10')   // A1 = 10
sheet.setValue(0, 2, '20')   // C1 = 20

// 在 B2 输入公式
sheet.setValue(1, 1, '=A1+C1')

// 验证计算结果
console.log(sheet.getValue(1, 1))  // 30

// 复制到 D4
sheet.copyCell(1, 1, 3, 3)

// 查看目标单元格的公式
console.log(sheet.getDisplayValue(3, 3))  // '=C3+E3'
```

### 示例 2：绝对引用

```typescript
// 在 B2 输入包含绝对引用的公式
sheet.setValue(1, 1, '=$A$1+C1')

// 复制到 D4
sheet.copyCell(1, 1, 3, 3)

// $A$1 保持不变，C1 调整为 E3
console.log(sheet.getDisplayValue(3, 3))  // '=$A$1+E3'
```

### 示例 3：混合引用

```typescript
// 在 B2 输入混合引用
sheet.setValue(1, 1, '=$A1+C$1')

// 复制到 D4
sheet.copyCell(1, 1, 3, 3)

// $A1: 列绝对，行相对 → $A3
// C$1: 列相对，行绝对 → E$1
console.log(sheet.getDisplayValue(3, 3))  // '=$A3+E$1'
```

### 示例 4：区域复制

```typescript
// 创建一个公式表
sheet.setValue(0, 0, '=B1')     // A1
sheet.setValue(0, 1, '=C1')     // B1
sheet.setValue(1, 0, '=B1+1')   // A2
sheet.setValue(1, 1, '=C1+1')   // B2

// 复制整个区域到 D4:E5
sheet.copyRange(0, 0, 1, 1, 3, 3)

// 验证结果
console.log(sheet.getDisplayValue(3, 3))  // '=E4'     (D4)
console.log(sheet.getDisplayValue(3, 4))  // '=F4'     (E4)
console.log(sheet.getDisplayValue(4, 3))  // '=E4+1'   (D5)
console.log(sheet.getDisplayValue(4, 4))  // '=F4+1'   (E5)
```

### 示例 5：在 Vue 组件中使用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FormulaSheet } from '@/lib/FormulaSheet'
import { SheetModel } from '@/lib/SheetModel'

const model = new SheetModel()
const sheet = new FormulaSheet(model)

// 复制操作
function handleCopy(fromRow: number, fromCol: number, toRow: number, toCol: number) {
  sheet.copyCell(fromRow, fromCol, toRow, toCol)
  // 触发重新渲染
  forceUpdate()
}

// 区域复制
function handleCopyRange(selection: Selection, targetRow: number, targetCol: number) {
  const { startRow, startCol, endRow, endCol } = selection
  sheet.copyRange(startRow, startCol, endRow, endCol, targetRow, targetCol)
  forceUpdate()
}
</script>
```

## 数据结构

### Cell 接口
```typescript
interface Cell {
  value: string                      // 显示的值（公式文本或普通值）
  formulaMetadata?: FormulaMetadata  // 公式元数据（仅公式单元格有）
}
```

### FormulaMetadata 接口
```typescript
interface FormulaMetadata {
  originalFormula: string    // 原始公式文本
  formulaRow: number         // 公式所在行
  formulaCol: number         // 公式所在列
  tokens: FormulaToken[]     // 解析后的 token 列表
  isParsed: boolean          // 是否已解析
}
```

### FormulaToken 类型
```typescript
// 单元格引用
interface CellReferenceToken {
  type: 'cellRef'
  rowOffset: number          // 相对行偏移
  colOffset: number          // 相对列偏移
  absoluteRow?: number       // 绝对行号（如果是绝对引用）
  absoluteCol?: number       // 绝对列号（如果是绝对引用）
  isRowAbsolute: boolean     // 行是否绝对
  isColAbsolute: boolean     // 列是否绝对
  originalText: string       // 原始文本
}

// 范围引用
interface RangeReferenceToken {
  type: 'rangeRef'
  startRef: CellReferenceToken
  endRef: CellReferenceToken
  originalText: string
}

// 文本片段
interface TextToken {
  type: 'text'
  value: string
}

type FormulaToken = CellReferenceToken | RangeReferenceToken | TextToken
```

## 性能考虑

### 解析时机
- ✅ **一次解析**：公式输入时立即解析并存储元数据
- ✅ **快速复制**：复制时直接基于元数据重建，无需重新解析
- ✅ **缓存友好**：元数据可长期保存，无需每次计算时解析

### 内存占用
```typescript
// 普通单元格
{ value: "100" }  // ~50 bytes

// 公式单元格
{
  value: "=A1+B1",
  formulaMetadata: {
    originalFormula: "=A1+B1",
    formulaRow: 1,
    formulaCol: 1,
    tokens: [...],  // 3-5 个 token，每个 ~100 bytes
    isParsed: true
  }
}
// 总计 ~500 bytes
```

**结论**：内存开销合理，换来的是复制粘贴的正确性和性能提升。

## 测试

### 运行测试页面
```bash
# 启动开发服务器
npm run dev

# 访问测试页面
open http://localhost:5173/test-formula-metadata.html
```

### 测试覆盖
- ✅ 相对引用复制粘贴
- ✅ 绝对引用复制粘贴
- ✅ 混合引用复制粘贴
- ✅ 区域复制
- ✅ 插入/删除行列后的引用调整
- ✅ 性能测试（100+ 公式）

## 迁移指南

### 从旧版本升级

如果你之前使用的是老的公式系统，现在可以无缝升级：

```typescript
// ✅ 老代码继续工作
sheet.setValue(0, 0, '=A1+B1')  // 自动解析元数据

// ✅ 新功能立即可用
sheet.copyCell(0, 0, 1, 1)      // 公式自动调整
```

无需修改现有代码！

## 未来扩展

### 已规划的功能
- [ ] 命名范围支持（`=SUM(Sales)`）
- [ ] 跨表引用（`=Sheet2!A1`）
- [ ] 结构化引用（`=Table1[@Column1]`）
- [ ] 公式审计（显示引用箭头）
- [ ] 撤销/重做支持

## 常见问题

### Q: 旧数据兼容性？
A: 完全兼容！旧的单元格只有 `value` 字段，新系统会在首次编辑时自动添加元数据。

### Q: 性能影响？
A: 解析只在输入时进行一次，复制粘贴更快（不需要重新解析）。

### Q: 元数据占用空间？
A: 每个公式单元格约增加 500 bytes，对于现代应用可忽略。

### Q: 如何禁用元数据？
A: 暂时不支持禁用，但可以选择不使用 `copyCell()`，直接用 `setValue()` 复制文本。

## 总结

新的公式元数据系统从根本上解决了复制粘贴时公式引用的问题，使表格的行为完全符合 Excel 标准。这是一个架构级的改进，为未来的高级功能奠定了基础。

🎉 **核心优势**：
- ✅ 完整的 Excel 复制粘贴行为
- ✅ 更快的性能（一次解析，多次使用）
- ✅ 更准确的引用调整
- ✅ 为高级功能铺路

---

**相关文档**：
- [公式元数据架构设计](./FORMULA_METADATA_ARCHITECTURE.md)
- [公式引用调整（旧版）](./FORMULA_REFERENCE_ADJUSTMENT.md)
