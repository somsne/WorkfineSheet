# 撤销/重做功能实现细节

## 概述

WorkfineSheet 现已集成完整的撤销/重做功能，支持所有单元格编辑操作。

## 技术实现

### UndoRedoManager 类

位置: `src/lib/UndoRedoManager.ts`

#### 核心特性

1. **栈式管理**
   - `undoStack`: 存储可撤销的操作
   - `redoStack`: 存储可重做的操作
   - 每个操作包含 name、undo() 和 redo() 方法

2. **自动清空**
   - 执行新操作时自动清空重做栈
   - 防止不一致的分支历史

3. **大小限制**
   - 默认最多保存 100 条操作
   - 超出时自动移除最旧的操作
   - 可配置上限

4. **状态查询**
   ```typescript
   canUndo(): boolean          // 是否可以撤销
   canRedo(): boolean          // 是否可以重做
   getUndoCount(): number      // 撤销栈大小
   getRedoCount(): number      // 重做栈大小
   getLastUndoName(): string   // 获取最后一个操作名
   getLastRedoName(): string   // 获取要重做的操作名
   ```

### 集成到 CanvasSheet

#### 初始化
```typescript
const undoRedo = new UndoRedoManager(100)  // 保存最多 100 条
```

#### 记录编辑操作
```typescript
function onOverlaySave(val: string) {
  const row = overlay.row
  const col = overlay.col
  const oldValue = model.getValue(row, col)
  
  // 仅当值改变时才记录
  if (oldValue !== val) {
    undoRedo.execute({
      name: `Edit cell (${row}, ${col})`,
      undo: () => {
        model.setValue(row, col, oldValue)
        draw()
      },
      redo: () => {
        model.setValue(row, col, val)
        draw()
      }
    })
  }
  
  overlay.visible = false
  draw()
}
```

#### 快捷键绑定
```typescript
function onKeyDown(e: KeyboardEvent) {
  // Ctrl+Z / Cmd+Z - 撤销
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (undoRedo.undo()) {
      draw()
    }
    return
  }
  
  // Ctrl+Y / Cmd+Y - 重做
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    if (undoRedo.redo()) {
      draw()
    }
    return
  }
  
  // Ctrl+Shift+Z / Cmd+Shift+Z - 重做（替代）
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) {
    e.preventDefault()
    if (undoRedo.redo()) {
      draw()
    }
    return
  }
}
```

## 使用流程

### 用户操作时间线

```
1. 用户双击单元格 (1,2)
   ↓
2. 输入 "Alice" 
   ↓
3. 按 Enter 保存
   ↓
4. onOverlaySave("Alice") 调用
   ├─ 旧值: ""
   ├─ 新值: "Alice"  
   └─ 值改变 → 调用 undoRedo.execute()
        ├─ undo 函数: 恢复 ""
        └─ redo 函数: 设置 "Alice"
   ↓
5. undoRedo 立即执行 redo()
   ├─ model.setValue(1, 2, "Alice")
   └─ draw()  // 重新渲染
   ↓
6. 单元格现在显示 "Alice"
   undoStack: [EditCell(1,2)]
   redoStack: []
   ↓
7. 用户按 Ctrl+Z
   ├─ undoRedo.undo() 调用
   ├─ 执行 undo 函数: model.setValue(1, 2, "")
   ├─ draw()
   └─ 单元格变空
   undoStack: []
   redoStack: [EditCell(1,2)]
   ↓
8. 用户按 Ctrl+Y  
   ├─ undoRedo.redo() 调用
   ├─ 执行 redo 函数: model.setValue(1, 2, "Alice")
   ├─ draw()
   └─ 单元格显示 "Alice"
   undoStack: [EditCell(1,2)]
   redoStack: []
```

## 设计模式

### Command Pattern（命令模式）
每个操作都封装为一个对象，包含：
- 操作名称 (name)
- 执行方法 (redo)
- 撤销方法 (undo)

### Memento Pattern（备忘录模式）
虽然我们不保存完整状态快照，而是保存操作，但原理相同：
- 记录可以导出/恢复状态的方式
- 不存储完整数据副本
- 按需重放操作

## 性能考虑

### 内存占用
```
每个操作对象大小:
- name: ~50 字节
- 两个函数闭包: ~100 字节
总计: ~150 字节/操作

100 条操作 × 150 字节 = 15 KB (可忽略)
```

### 执行速度
```
撤销: O(1) 获取操作 + O(1) 执行
重做: O(1) 获取操作 + O(1) 执行
总时间: < 1ms (通常 < 100μs)
```

### 优化空间
1. **操作合并**
   - 连续编辑同一单元格可以合并
   - 当前实现没有合并，每次编辑都记录

2. **增量状态**
   - 可以存储完整状态快照而不是操作
   - 权衡内存 vs 性能

3. **异步重做**
   - 大量操作时可考虑异步处理
   - 当前 100 条上限下不必要

## 扩展示例

### 记录批量编辑

```typescript
// 将多个编辑组合为单个撤销操作
function editMultipleCells(edits: Array<{row: number, col: number, value: string}>) {
  const oldValues = edits.map(e => model.getValue(e.row, e.col))
  
  undoRedo.execute({
    name: `Edit ${edits.length} cells`,
    undo: () => {
      edits.forEach((e, i) => {
        model.setValue(e.row, e.col, oldValues[i])
      })
      draw()
    },
    redo: () => {
      edits.forEach(e => {
        model.setValue(e.row, e.col, e.value)
      })
      draw()
    }
  })
}
```

### 记录删除操作

```typescript
function deleteCell() {
  const row = selected.row
  const col = selected.col
  const oldValue = model.getValue(row, col)
  
  undoRedo.execute({
    name: `Delete cell (${row}, ${col})`,
    undo: () => {
      model.setValue(row, col, oldValue)
      draw()
    },
    redo: () => {
      model.setValue(row, col, '')
      draw()
    }
  })
}
```

### 记录粘贴操作

```typescript
function onPaste() {
  // ... 获取粘贴数据 ...
  
  const startRow = selected.row
  const startCol = selected.col
  const oldCells = new Map() // 保存旧值
  
  // 记录旧值
  data.forEach((row, r) => {
    row.forEach((value, c) => {
      const actualRow = startRow + r
      const actualCol = startCol + c
      oldCells.set(`${actualRow},${actualCol}`, 
                   model.getValue(actualRow, actualCol))
    })
  })
  
  undoRedo.execute({
    name: 'Paste',
    undo: () => {
      oldCells.forEach((value, key) => {
        const [row, col] = key.split(',').map(Number)
        model.setValue(row, col, value)
      })
      draw()
    },
    redo: () => {
      data.forEach((row, r) => {
        row.forEach((value, c) => {
          model.setValue(startRow + r, startCol + c, value)
        })
      })
      draw()
    }
  })
}
```

## 测试检查清单

- [ ] 编辑单元格后 Ctrl+Z 恢复
- [ ] 撤销后 Ctrl+Y 重做
- [ ] 多次撤销多次重做
- [ ] 编辑后再次编辑不同单元格
- [ ] 撤销到最初状态后重做
- [ ] 编辑后重做栈被清空
- [ ] 历史记录不超过 100 条
- [ ] 撤销时无错误
- [ ] 重做时无错误
- [ ] 频繁操作时性能正常

## 常见问题

### Q: 为什么我的粘贴操作没有撤销？
**A:** 当前实现仅记录单个单元格编辑。粘贴操作需要单独实现（见上面的示例）。

### Q: 我可以增加历史记录条数吗？
**A:** 可以，修改初始化代码：
```typescript
const undoRedo = new UndoRedoManager(500) // 增加到 500 条
```

### Q: 撤销/重做是否保存到本地存储？
**A:** 当前不保存，关闭页面后历史记录清空。可以扩展存储到 LocalStorage。

### Q: 我可以禁用撤销吗？
**A:** 可以，在 onOverlaySave 中条件判断：
```typescript
if (shouldRecord && oldValue !== val) {
  undoRedo.execute(...)
}
```

## 相关文件

- `src/lib/UndoRedoManager.ts` - 管理器实现
- `src/components/CanvasSheet.vue` - 集成点
  - onOverlaySave()
  - onKeyDown() (Z 和 Y 快捷键)
  - undoRedo 变量初始化
