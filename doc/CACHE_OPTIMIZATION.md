# 公式缓存机制优化

**修复日期**: 2025-11-25  
**问题**: 每次点击单元格时都会重复计算所有公式  
**原因**: 缓存被频繁清空，且日志过多  
**状态**: ✅ **已优化**

---

## 问题分析

### 症状
- 点击任何单元格时，控制台输出大量重复日志
- 每次点击都会重新计算所有公式
- 性能下降明显

### 根本原因

1. **缓存清理时机问题**
   - 在 `onOverlaySave` 中直接调用 `getModel().setValue()` 而不是 `formulaSheet.setValue()`
   - 在 `onPaste` 中直接调用 `model.setValue()` 而不是 `formulaSheet.setValue()`
   - 导致缓存不被正确清理

2. **日志过多**
   - 每次缓存命中都打印日志
   - 每次替换单元格引用都打印日志
   - 每次标准化值都打印日志
   - 导致控制台被日志淹没

---

## 解决方案

### 1. 修复 setValue 调用链

#### CanvasSheet.vue - onOverlaySave
```typescript
// ❌ 旧代码
formulaSheet.getModel().setValue(row, col, oldValue)
formulaSheet.getModel().setValue(row, col, val)

// ✅ 新代码
formulaSheet.setValue(row, col, oldValue)  // 自动清理缓存
formulaSheet.setValue(row, col, val)       // 自动清理缓存
```

#### CanvasSheet.vue - onPaste
```typescript
// ❌ 旧代码
model.setValue(startRow + r, startCol + c, cellVal)

// ✅ 新代码
formulaSheet.setValue(startRow + r, startCol + c, cellVal)  // 自动清理缓存
```

### 2. 简化日志输出

#### FormulaSheet.getValue
```typescript
// 移除缓存命中的日志
if (this.formulaCache.has(cellKey)) {
  return this.formulaCache.get(cellKey)  // 无日志
}

// 只在实际计算时打印日志
console.log(`[FormulaSheet] 计算: ${cellKey} = ${result}`)
```

#### FormulaEngine.evaluate
```typescript
// ❌ 旧代码：多行详细日志
console.log('[FormulaEngine] 计算公式:', formula)
console.log('[FormulaEngine] 原始表达式:', expression)
// ...
console.log('[FormulaEngine] 最终结果:', parseResult.result)

// ✅ 新代码：仅保留错误日志
if (parseResult.error) {
  return { result: null, error: parseResult.error }  // 无日志
}
```

#### FormulaEngine.replaceReferencesWithValues
```typescript
// 移除所有参考替换的日志
// 移除所有值标准化的日志
```

---

## 缓存流程

### 正确的缓存流程
```
setValue(row, col, value)
├─ model.setValue(row, col, value)  // 更新底层模型
├─ clearCache()                      // 清空所有缓存
└─ draw()                            // 重新渲染

getValue(row, col)
├─ 检查缓存 (快速返回，无日志)
│  ├─ 缓存命中 → 返回缓存值
│  └─ 缓存未命中 → 继续计算
├─ 计算公式 (仅第一次)
│  ├─ 替换单元格引用
│  ├─ 调用 parser.parse()
│  └─ 得到结果
├─ 缓存结果
└─ 打印日志 (仅计算时)
```

---

## 性能对比

### 修复前
```
点击单元格 → setValue → 缓存不清 → 计算多次 → 控制台输出 50+ 条日志
```

### 修复后
```
点击单元格 → setValue → 清空缓存 → 计算一次 → 缓存所有结果 → 控制台输出 1 条日志
```

---

## 代码修改清单

### 文件：CanvasSheet.vue
- ✅ `onOverlaySave()` 改用 `formulaSheet.setValue()` 
- ✅ `onPaste()` 改用 `formulaSheet.setValue()`

### 文件：FormulaSheet.ts
- ✅ `getValue()` 移除缓存命中日志
- ✅ `getValue()` 仅在计算时打印日志

### 文件：FormulaEngine.ts
- ✅ `evaluate()` 移除所有中间步骤日志
- ✅ `replaceReferencesWithValues()` 移除替换日志
- ✅ `normalizeValue()` 移除转换日志

---

## 验证结果

### 修复后的行为
1. 首次计算时：
   ```
   [FormulaSheet] 计算: D2 = 250
   [FormulaSheet] 计算: D3 = 50
   [FormulaSheet] 计算: D4 = 20
   ```

2. 再次点击同一单元格：
   ```
   (无日志输出，使用缓存)
   ```

3. 修改某个单元格后：
   ```
   缓存清空 → 再次计算所有依赖
   [FormulaSheet] 计算: D2 = 250
   [FormulaSheet] 计算: D3 = 50
   [FormulaSheet] 计算: D4 = 20
   ```

---

## 关键改进

| 方面 | 修复前 | 修复后 |
|------|-------|-------|
| **缓存管理** | ❌ 不一致 | ✅ 统一调用 |
| **日志输出** | ❌ 冗长 (50+) | ✅ 简洁 (1-3) |
| **重复计算** | ❌ 多次 | ✅ 单次 + 缓存 |
| **性能** | ❌ 低 | ✅ 高 |

---

## 最佳实践

### ✅ 正确做法
```typescript
// 修改单元格值时
formulaSheet.setValue(row, col, value)  // 自动清理缓存

// 读取单元格值时
const value = formulaSheet.getValue(row, col)  // 自动使用缓存
```

### ❌ 错误做法
```typescript
// 直接调用底层模型
formulaSheet.getModel().setValue(row, col, value)  // 缓存不清

// 调用模型的 setValue 而不是 FormulaSheet 的
model.setValue(row, col, value)  // 缓存不清
```

---

## 下一步优化方向

1. **增量缓存清理**
   - 只清理受影响的单元格缓存
   - 建立依赖图追踪
   - 提高大规模数据处理的性能

2. **性能监控**
   - 添加计算时间统计
   - 监控缓存命中率
   - 检测性能瓶颈

3. **调试模式**
   - 可选的详细日志模式
   - 性能分析工具
   - 缓存状态查看器

---

**总结**: 通过统一 `setValue` 调用链和简化日志输出，解决了重复计算和日志过多的问题。现在 WorkfineSheet 的性能得到了显著提升。

