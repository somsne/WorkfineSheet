# RichTextInput 快速使用指南

## 🚀 快速开始

### 基本使用

```vue
<script setup>
import { ref } from 'vue'
import RichTextInput from '@/components/RichTextInput.vue'

const editorVisible = ref(true)
const editorValue = ref('Hello World')

function handleSave(value) {
  console.log('保存:', value)
  editorVisible.value = false
}

function handleCancel() {
  console.log('取消')
  editorVisible.value = false
}
</script>

<template>
  <RichTextInput
    :visible="editorVisible"
    :value="editorValue"
    :left="100"
    :top="100"
    @save="handleSave"
    @cancel="handleCancel"
  />
</template>
```

---

## 📝 常见使用场景

### 场景 1: 普通文本编辑

```vue
<RichTextInput
  :visible="true"
  :value="cellValue"
  :left="cellRect.left"
  :top="cellRect.top"
  @save="updateCell"
  @cancel="closeEditor"
/>
```

### 场景 2: 公式编辑（带彩色引用）

```vue
<script setup>
const formulaValue = ref('=A1+B2')
const formulaRefs = computed(() => {
  // 解析公式中的引用
  const refs = []
  const regex = /\$?[A-Z]+\$?\d+/g
  let match
  while ((match = regex.exec(formulaValue.value)) !== null) {
    refs.push({
      ref: match[0],
      start: match.index,
      end: match.index + match[0].length
    })
  }
  return refs
})
</script>

<template>
  <RichTextInput
    :visible="true"
    :value="formulaValue"
    :is-formula="true"
    :formula-references="formulaRefs"
    @input-change="updateFormula"
    @save="saveFormula"
  />
</template>
```

### 场景 3: Excel 风格引用选择

```vue
<script setup>
const richTextRef = ref(null)

function handleCellClick(cellAddress) {
  // 检查是否处于可选择状态
  if (richTextRef.value?.isInSelectableState) {
    // 插入或替换单元格引用
    richTextRef.value.insertCellReference(cellAddress)
  }
}
</script>

<template>
  <RichTextInput
    ref="richTextRef"
    :visible="true"
    :value="formulaValue"
    :is-formula="true"
    :formula-references="formulaRefs"
  />
  
  <!-- 单元格网格 -->
  <div class="cells-grid">
    <div 
      v-for="cell in cells" 
      :key="cell.address"
      @click="handleCellClick(cell.address)"
    >
      {{ cell.address }}
    </div>
  </div>
</template>
```

---

## 🎯 Props 说明

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `visible` | `boolean` | `false` | 是否显示编辑器 |
| `value` | `string` | `''` | 初始值 |
| `left` | `number` | `0` | 左侧位置（px） |
| `top` | `number` | `0` | 顶部位置（px） |
| `isFormula` | `boolean` | `false` | 是否为公式模式 |
| `formulaReferences` | `Array` | `[]` | 公式引用数组 |
| `onCellReferenceInsert` | `Function` | `undefined` | 单元格引用插入回调 |

---

## 📤 Events 说明

| Event | 参数 | 说明 |
|-------|------|------|
| `save` | `(value: string)` | 用户按 Enter 保存 |
| `cancel` | - | 用户按 Escape 取消 |
| `input-change` | `(value?: string)` | 内容变化时触发 |

---

## 🔑 暴露的方法和属性

通过 `ref` 可以访问以下方法和属性：

```typescript
// 获取组件实例
const richTextRef = ref<InstanceType<typeof RichTextInput>>()

// 访问属性
richTextRef.value.formulaMode          // 是否为公式模式
richTextRef.value.isInSelectableState  // 是否可选择单元格
richTextRef.value.hasTextSelection     // 是否有文本选择

// 调用方法
richTextRef.value.insertCellReference('A1')        // 插入单元格引用
richTextRef.value.insertRangeReference('A1', 'B2') // 插入区域引用
richTextRef.value.getCurrentValue()                // 获取当前值
richTextRef.value.getEditorElement()               // 获取编辑器元素
```

---

## ⌨️ 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 保存并关闭 |
| `Escape` | 取消并关闭 |
| `Alt + Enter` | 插入换行符 |
| `Tab` | 被拦截（可扩展为切换单元格） |

---

## 🎨 样式定制

### 修改边框颜色

```css
/* 正常状态 */
.rich-text-input {
  border: 1px solid #your-color;
}

/* 可选择状态（绿色边框） */
.rich-text-input.selectable {
  border: 2px solid #your-color;
}
```

### 修改引用颜色

在 `formulaReferences` 中为每个引用指定颜色：

```javascript
const formulaRefs = computed(() => [
  { ref: 'A1', start: 1, end: 3, color: '#FF5722' },
  { ref: 'B2', start: 4, end: 6, color: '#2196F3' }
])
```

---

## 🐛 常见问题

### Q: 为什么编辑器不显示？

A: 检查以下几点：
1. `visible` prop 是否为 `true`
2. `left` 和 `top` 是否在可见区域内
3. 父元素是否有 `position: relative`

### Q: 为什么彩色引用不显示？

A: 检查以下几点：
1. `isFormula` prop 是否为 `true`
2. `formulaReferences` 是否正确传入
3. 引用的 `start` 和 `end` 位置是否正确

### Q: 为什么单元格点击不插入引用？

A: 检查以下几点：
1. 编辑器是否处于公式模式
2. 光标是否在操作符后面（应该有绿色边框）
3. 是否调用了 `insertCellReference` 方法

### Q: 如何处理超长文本？

A: 组件已自动优化：
- 短文本（<500字符）：立即更新
- 长文本（≥500字符）：使用 300ms 防抖

### Q: 如何支持多行文本？

A: 使用 `Alt + Enter` 插入换行符，组件会自动调整高度。

---

## 💡 最佳实践

### 1. 使用 computed 计算 formulaReferences

```javascript
const formulaRefs = computed(() => {
  if (!value.value.startsWith('=')) return []
  // 解析逻辑...
  return refs
})
```

### 2. 监听 input-change 更新数据

```javascript
function handleInputChange(newValue) {
  // 实时更新数据，而不是等保存时
  cellValue.value = newValue
}
```

### 3. 使用 nextTick 确保 DOM 更新

```javascript
nextTick(() => {
  richTextRef.value?.focus()
})
```

### 4. 正确处理取消操作

```javascript
function handleCancel() {
  // 恢复原值
  editorValue.value = originalValue
  editorVisible.value = false
}
```

---

## 🔗 相关文档

- [完整 API 文档](./API.md)
- [Excel 引用选择功能](./EXCEL_SELECTION.md)
- [完成总结](./COMPLETION_SUMMARY.md)
- [测试页面](../public/test-excel-selection.html)

---

## 📞 支持

如有问题，请查看：
1. 单元测试：`src/components/tests/RichTextInput.spec.ts`
2. 示例页面：`public/test-excel-selection.html`
3. 组件源码：`src/components/RichTextInput.vue`

---

**Happy Coding! 🎉**
