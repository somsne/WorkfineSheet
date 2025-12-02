# 撤销/重做指南

## 概述

WorkfineSheet v0.3.3 实现了工作簿级别的撤销/重做功能，支持跨 Sheet 操作追踪和自动选区恢复。

## 核心特性

### 1. 工作簿级别 UndoRedo（v0.3.3）

- **统一管理**：所有 Sheet 共享同一个 `UndoRedoManager`，操作记录在工作簿级别
- **跨 Sheet 撤销**：撤销时自动切换到操作所在的 Sheet
- **选区恢复**：撤销/重做后自动选中受影响的单元格区域

### 2. 架构设计

```
WorkbookSheet
├── workbookUndoRedo (UndoRedoManager)  // 共享实例
├── handleGlobalKeyDown()               // 全局键盘监听
├── undo() / redo()                     // 带 Sheet 切换的操作
│
└── CanvasSheet
    ├── props.externalUndoRedo          // 接收共享实例
    ├── undoRedoWithSheetId             // 包装器，自动添加 sheetId
    │
    └── Composables
        ├── useSheetInput      → undoRedoExecutor
        ├── useSheetImages     → undoRedoExecutor
        ├── useRowColOperations → undoRedoExecutor
        └── useFillHandle      → getSheetId()
```

### 3. UndoRedoAction 接口

```typescript
interface UndoRedoAction {
  name: string                    // 操作名称（用于显示）
  undo: () => void               // 撤销函数
  redo: () => void               // 重做函数
  sheetId?: string               // 操作所属的 Sheet ID
  undoSelection?: AffectedRange  // 撤销后选中的区域
  redoSelection?: AffectedRange  // 重做后选中的区域
}

interface AffectedRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}
```

## 使用方法

### 在 Composable 中记录操作

```typescript
// 使用 undoRedoWithSheetId 包装器（自动添加 sheetId 和当前选区）
undoRedoWithSheetId.execute({
  name: '设置单元格值',
  undo: () => {
    model.setValue(row, col, oldValue)
    scheduleRedraw()
  },
  redo: () => {
    model.setValue(row, col, newValue)
    scheduleRedraw()
  }
})
```

### 自定义选区

```typescript
// 如需指定不同的选区，可以显式提供
undoRedoWithSheetId.execute({
  name: '填充',
  undoSelection: { ...sourceRange },      // 撤销后选中源区域
  redoSelection: { ...newSelectionRange }, // 重做后选中扩展区域
  undo: () => { /* ... */ },
  redo: () => { /* ... */ }
})
```

### 监听变化

```typescript
// StyleToolbar 使用监听器高效更新按钮状态
const removeListener = undoRedoManager.addChangeListener(() => {
  canUndo.value = undoRedoManager.canUndo()
  canRedo.value = undoRedoManager.canRedo()
})

// 组件卸载时移除
onBeforeUnmount(() => {
  removeListener()
})
```

## 快捷键

| 快捷键 | 操作 |
|--------|------|
| Ctrl/Cmd + Z | 撤销 |
| Ctrl/Cmd + Y | 重做 |
| Ctrl/Cmd + Shift + Z | 重做（macOS 风格） |

## 注意事项

### 删除 Sheet 时清空历史

删除 Sheet 后，相关的撤销/重做操作已无效，因此会自动清空历史：

```typescript
function handleSheetDelete(sheetId: string) {
  workbook.value.removeSheet(sheetId)
  workbookUndoRedo.clear()  // 清空历史
}
```

### record vs execute

- `execute(action)`: 先执行 redo，再记录到栈（用于新操作）
- `record(action)`: 只记录，不执行（用于操作已手动执行后）

```typescript
// 操作已执行，只需记录
model.setValue(row, col, newValue)
undoRedoExec.record({
  name: '设置值',
  undo: () => model.setValue(row, col, oldValue),
  redo: () => model.setValue(row, col, newValue)
})
```

## 测试

测试文件：`src/lib/tests/UndoRedoManager.spec.ts`

运行测试：
```bash
nvm use 20 && npm test -- UndoRedoManager
```

覆盖内容：
- 基本操作（execute, record, undo, redo）
- 操作名称获取
- 历史大小限制
- 变化监听器
- 多 Sheet 支持（sheetId, peekUndoSheetId, peekRedoSheetId）
- 选区信息支持
- 复杂操作序列

## 版本历史

### v0.3.3 (2025-01)
- ✨ 实现工作簿级别 UndoRedo（所有 Sheet 共享）
- ✨ 跨 Sheet 撤销/重做自动切换 Sheet
- ✨ 撤销/重做后自动恢复选区
- ✨ UndoRedoManager 增加 sheetId、undoSelection、redoSelection
- ✨ UndoRedoManager 增加变化监听器（changeListeners）
- ✨ StyleToolbar 使用监听器替代轮询更新按钮状态
- ✨ 添加 31 个 UndoRedoManager 单元测试
