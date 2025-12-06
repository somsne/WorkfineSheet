# 全局 CellOverlay 方案

## 概述

将 CellOverlay 提升到 WorkbookSheet 层级，作为全局唯一的单元格编辑器。CellOverlay **永不释放**，不需要时只是隐藏，这样在跨 Sheet 公式编辑时无需担心组件销毁问题。

---

## 1. 核心设计原则

### 1.1 CellOverlay 永不释放

```
┌─────────────────────────────────────────────────────────────┐
│                    WorkbookSheet                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              FormulaBar (编辑大脑)                      │  │
│  │         统一管理编辑状态、公式解析、引用插入             │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑↓ 同步                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         CellOverlay (全局唯一，永不释放)                │  │
│  │    - 隐藏/显示切换，不销毁组件                          │  │
│  │    - 跨 Sheet 时保持实例                                │  │
│  │    - 位置/内容由 WorkbookSheet 控制                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   CanvasSheet   │    │   CanvasSheet   │   (可切换)      │
│  │    (Sheet1)     │    │    (Sheet2)     │                 │
│  └─────────────────┘    └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 优势

| 优势 | 说明 |
|------|------|
| **跨 Sheet 无缝** | 切换 Sheet 不影响编辑状态，overlay 实例始终存在 |
| **状态保持** | IME 输入状态、光标位置、选区等都能保持 |
| **性能优化** | 避免频繁创建/销毁 DOM 元素 |
| **简化逻辑** | 不需要处理组件生命周期相关的边界情况 |

### 1.3 FormulaBar 为中心

- **FormulaBar** 是编辑的"大脑"，负责状态管理
- **CellOverlay** 是编辑的"视图"，负责显示和输入
- 两者通过 **FormulaEditManager** 协调同步

---

## 2. 状态管理

### 2.1 全局 Overlay 状态

```typescript
// WorkbookSheet.vue
const globalOverlay = reactive({
  // 可见性
  visible: false,
  
  // 关联信息
  sheetId: '',           // 编辑所在的 Sheet ID（源 Sheet）
  row: 0,
  col: 0,
  
  // 位置和尺寸
  top: 0,
  left: 0,
  width: 100,
  height: 24,
  
  // 内容
  value: '',
  mode: 'edit' as 'edit' | 'typing',
  
  // 样式（从源单元格获取）
  cellStyle: undefined as CellStyle | undefined
})
```

### 2.2 Overlay 可见性控制

```typescript
// 是否显示 Overlay 的计算属性
const shouldShowOverlay = computed(() => {
  // 基础条件：必须 visible
  if (!globalOverlay.visible) return false
  
  const mgr = formulaEditManager
  
  // 情况1：未在编辑，不显示
  if (!mgr.state.active) return false
  
  // 情况2：跨 Sheet 模式，隐藏 overlay（公式栏是主编辑器）
  if (mgr.isCrossSheetMode(activeSheetId.value)) {
    return false
  }
  
  // 情况3：源 Sheet 匹配，显示 overlay
  return globalOverlay.sheetId === activeSheetId.value
})
```

### 2.3 状态流转

```
┌─────────────────────────────────────────────────────────────┐
│                    Overlay 状态流转                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [隐藏] ──双击单元格──→ [显示@Sheet1]                        │
│    ↑                        │                                │
│    │                        │ 切换到 Sheet2                  │
│    │                        ↓                                │
│    │                   [隐藏] (跨 Sheet 模式)                │
│    │                        │                                │
│    │                        │ 切回 Sheet1                    │
│    │                        ↓                                │
│    │                   [显示@Sheet1] (恢复)                  │
│    │                        │                                │
│    │                        │ Enter/Escape                   │
│    │                        ↓                                │
│    └───────────────── [隐藏]                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 编辑源与 Overlay 的关系

### 3.1 编辑源定义

| 编辑源 | 触发方式 | Overlay 状态 | FormulaBar 状态 |
|--------|----------|--------------|-----------------|
| `cell` | 双击/F2/打字 | 显示，可编辑 | 只读同步显示 |
| `formulaBar` | 点击公式栏 | 显示，只读同步 | 获得焦点，可编辑 |

### 3.2 编辑源切换

```typescript
// 从 cell 切换到 formulaBar（点击公式栏）
function handleFormulaBarFocus() {
  const mgr = formulaEditManager
  
  if (mgr.state.active && mgr.state.source === 'cell') {
    // 同步当前值到公式栏
    const currentValue = globalOverlayRef.value?.getCurrentValue?.() ?? globalOverlay.value
    mgr.switchSource('formulaBar')
    mgr.updateValue(currentValue)
  }
}

// 从 formulaBar 切换到 cell（点击 overlay）
function handleGlobalOverlayClick() {
  const mgr = formulaEditManager
  
  if (mgr.state.active && mgr.state.source === 'formulaBar') {
    mgr.switchSource('cell')
    globalOverlayRef.value?.focus?.()
  }
}
```

### 3.3 输入同步

```typescript
// cell 源：overlay 输入 → 同步到 FormulaBar
function handleGlobalOverlayInputChange() {
  const value = globalOverlayRef.value?.getCurrentValue?.() ?? globalOverlay.value
  const mgr = formulaEditManager
  
  if (mgr.state.source === 'cell') {
    mgr.updateValue(value)
    formulaBarEditingValue.value = value  // 同步到公式栏显示
  }
  
  updateGlobalOverlayFormulaRefs(value)
}

// formulaBar 源：公式栏输入 → 同步到 overlay
function handleFormulaBarInput(value: string, cursorPos?: number) {
  const mgr = formulaEditManager
  
  if (mgr.state.source === 'formulaBar') {
    mgr.updateValue(value, cursorPos)
    globalOverlay.value = value  // 同步到 overlay
  }
}
```

---

## 4. 跨 Sheet 编辑处理

### 4.1 切换 Sheet 时的行为

```typescript
function handleSheetChange(targetSheetId: string) {
  const mgr = formulaEditManager
  
  // 情况1：未在编辑 → 正常切换，overlay 保持隐藏
  if (!mgr.state.active) {
    workbook.value.setActiveSheet(targetSheetId)
    return
  }
  
  // 情况2：cell 源编辑 → 保存并隐藏 overlay
  if (mgr.state.source === 'cell') {
    // 保存当前编辑
    const value = globalOverlayRef.value?.getCurrentValue?.() ?? globalOverlay.value
    canvasSheetRef.value?.confirmEditingWithDirection?.(value, 'none')
    
    // 隐藏 overlay（不销毁）
    globalOverlay.visible = false
    mgr.reset()
    
    // 切换 Sheet
    workbook.value.setActiveSheet(targetSheetId)
    return
  }
  
  // 情况3：formulaBar 源编辑
  if (mgr.state.source === 'formulaBar') {
    if (mgr.state.isFormulaMode) {
      // 公式模式 → 进入跨 Sheet 模式
      // overlay 隐藏，但 FormulaEditManager 状态保持
      globalOverlay.visible = false
      workbook.value.setActiveSheet(targetSheetId)
      // 不调用 mgr.reset()，保持编辑状态
    } else {
      // 非公式模式 → 确认编辑
      handleFormulaBarConfirm()
      workbook.value.setActiveSheet(targetSheetId)
    }
  }
}
```

### 4.2 跨 Sheet 模式下切回源 Sheet

```typescript
function handleSheetChange(targetSheetId: string) {
  const mgr = formulaEditManager
  
  // 如果正在跨 Sheet 编辑，且切回源 Sheet
  if (mgr.state.active && 
      mgr.state.source === 'formulaBar' && 
      targetSheetId === mgr.state.sourceSheetId) {
    
    workbook.value.setActiveSheet(targetSheetId)
    
    // 恢复显示 overlay
    nextTick(() => {
      globalOverlay.visible = true
      // 重新计算 overlay 位置
      updateOverlayPosition(mgr.state.row, mgr.state.col)
    })
    return
  }
  
  // ... 其他情况
}
```

### 4.3 跨 Sheet 选区处理

```typescript
function handleSelectionChange(payload: SelectionPayload) {
  const mgr = formulaEditManager
  
  // 跨 Sheet 公式模式：插入跨 Sheet 引用
  if (mgr.isCrossSheetMode(activeSheetId.value) && mgr.state.isInSelectableState) {
    const sheetName = workbook.value.getActiveSheet()?.metadata?.name ?? ''
    const reference = formatCrossSheetReference(
      sheetName, 
      payload.selected.row, 
      payload.selected.col
    )
    
    mgr.insertReference(reference)
    
    // 更新公式栏显示
    formulaBarEditingValue.value = mgr.state.currentValue
    return
  }
  
  // 同 Sheet 公式模式：插入普通引用
  if (mgr.state.active && 
      mgr.state.source === 'formulaBar' && 
      mgr.state.isFormulaMode && 
      mgr.state.isInSelectableState) {
    
    const reference = getCellAddress(payload.selected.row, payload.selected.col)
    mgr.insertReference(reference)
    
    // 同步到 overlay 和公式栏
    globalOverlay.value = mgr.state.currentValue
    formulaBarEditingValue.value = mgr.state.currentValue
    return
  }
  
  // 非编辑状态：正常更新选区显示
  updateFormulaBarDisplay(payload)
}
```

---

## 5. 事件处理流程

### 5.1 打开 Overlay (CanvasSheet → WorkbookSheet)

```typescript
// CanvasSheet 发出事件
emit('open-overlay', {
  sheetId: props.sheetId,
  row, col, value,
  top, left, width, height,
  mode: 'edit',
  cellStyle
})

// WorkbookSheet 处理
function handleOpenOverlay(payload: GlobalOverlayPayload) {
  // 更新 overlay 状态
  Object.assign(globalOverlay, {
    visible: true,
    sheetId: payload.sheetId,
    row: payload.row,
    col: payload.col,
    value: payload.value,
    top: payload.top,
    left: payload.left,
    width: payload.width,
    height: payload.height,
    mode: payload.mode,
    cellStyle: payload.cellStyle
  })
  
  // 同步启动 FormulaEditManager
  const mgr = formulaEditManager
  if (!mgr.state.active) {
    mgr.startEdit({
      source: 'cell',
      sheetId: payload.sheetId,
      row: payload.row,
      col: payload.col,
      value: payload.value,
      mode: payload.mode
    })
  }
  
  // 更新公式引用
  updateGlobalOverlayFormulaRefs(payload.value)
  
  // 聚焦 overlay
  nextTick(() => {
    globalOverlayRef.value?.focus?.()
  })
}
```

### 5.2 关闭 Overlay

```typescript
// 隐藏 overlay（不销毁）
function hideGlobalOverlay() {
  globalOverlay.visible = false
  // 不重置其他状态，方便恢复
}

// 完全关闭编辑（隐藏 + 重置状态）
function closeGlobalOverlay() {
  globalOverlay.visible = false
  globalOverlay.value = ''
  globalOverlay.sheetId = ''
  globalOverlayFormulaRefs.value = []
}
```

### 5.3 确认编辑 (Enter/Tab/Blur)

```typescript
function handleGlobalOverlayEnter(val: string) {
  const mgr = formulaEditManager
  
  // 如果是 formulaBar 源，应该由公式栏处理
  if (mgr.state.source === 'formulaBar') {
    handleFormulaBarConfirm()
    return
  }
  
  // cell 源：直接保存
  canvasSheetRef.value?.confirmEditingWithDirection?.(val, 'down')
  
  // 隐藏 overlay
  hideGlobalOverlay()
  
  // 重置状态
  mgr.reset()
  resetFormulaBarUI()
}

function handleGlobalOverlayTab(val: string) {
  const mgr = formulaEditManager
  
  if (mgr.state.source === 'formulaBar') {
    handleFormulaBarTab()
    return
  }
  
  canvasSheetRef.value?.confirmEditingWithDirection?.(val, 'right')
  hideGlobalOverlay()
  mgr.reset()
  resetFormulaBarUI()
}

function handleGlobalOverlayBlur(val: string) {
  const mgr = formulaEditManager
  
  // 跨 Sheet 模式下不处理 blur（焦点可能在目标 Sheet）
  if (mgr.isCrossSheetMode(activeSheetId.value)) {
    return
  }
  
  if (mgr.state.source === 'formulaBar') {
    // 公式栏源，blur 时不保存（用户可能点击其他地方）
    return
  }
  
  // cell 源：blur 保存
  canvasSheetRef.value?.confirmEditingWithDirection?.(val, 'none')
  hideGlobalOverlay()
  mgr.reset()
  resetFormulaBarUI()
}
```

### 5.4 取消编辑 (Escape)

```typescript
function handleGlobalOverlayCancel() {
  const mgr = formulaEditManager
  
  // 跨 Sheet 模式：切回源 Sheet
  if (mgr.isCrossSheetMode(activeSheetId.value)) {
    workbook.value.setActiveSheet(mgr.state.sourceSheetId!)
    nextTick(() => {
      // 恢复 overlay 显示原值
      globalOverlay.visible = true
      globalOverlay.value = mgr.state.originalValue
      globalOverlayRef.value?.focus?.()
    })
    return
  }
  
  // 取消编辑
  canvasSheetRef.value?.cancelEditing?.()
  hideGlobalOverlay()
  mgr.reset()
  resetFormulaBarUI()
}
```

---

## 6. Overlay 位置更新

### 6.1 滚动时更新位置

```typescript
// CanvasSheet 滚动时通知位置更新
emit('overlay-position-update', {
  top: newTop,
  left: newLeft,
  width: cellWidth,
  height: cellHeight
})

// WorkbookSheet 处理
function handleOverlayPositionUpdate(payload: OverlayPosition) {
  if (globalOverlay.visible && globalOverlay.sheetId === activeSheetId.value) {
    globalOverlay.top = payload.top
    globalOverlay.left = payload.left
    globalOverlay.width = payload.width
    globalOverlay.height = payload.height
  }
}
```

### 6.2 切回源 Sheet 时重新计算位置

```typescript
function updateOverlayPosition(row: number, col: number) {
  const position = canvasSheetRef.value?.getCellPosition?.(row, col)
  if (position) {
    globalOverlay.top = position.top
    globalOverlay.left = position.left
    globalOverlay.width = position.width
    globalOverlay.height = position.height
  }
}
```

---

## 7. 模板结构

```vue
<template>
  <div class="workbook-sheet">
    <!-- 公式栏 -->
    <FormulaBar ... />
    
    <!-- 主表格区域 -->
    <div class="workbook-main" ref="mainRef">
      <!-- 当前 Sheet -->
      <CanvasSheet 
        v-if="activeSheetData"
        :use-global-overlay="true"
        @open-overlay="handleOpenOverlay"
        @close-overlay="handleCloseOverlay"
        @overlay-position-update="handleOverlayPositionUpdate"
        ...
      />
      
      <!-- 全局 CellOverlay（永不释放，只隐藏/显示） -->
      <CellOverlayAdapter
        ref="globalOverlayRef"
        v-show="shouldShowOverlay"
        :visible="globalOverlay.visible"
        :value="globalOverlay.value"
        :row="globalOverlay.row"
        :col="globalOverlay.col"
        :top="globalOverlay.top"
        :left="globalOverlay.left"
        :width="globalOverlay.width"
        :height="globalOverlay.height"
        :mode="globalOverlay.mode"
        :is-formula="globalOverlay.value.startsWith('=')"
        :cell-style="globalOverlay.cellStyle"
        :formula-references="globalOverlayFormulaRefs"
        :viewport-width="mainRef?.clientWidth ?? 800"
        :external-display-html="overlayDisplayHtml"
        @enter="handleGlobalOverlayEnter"
        @tab="handleGlobalOverlayTab"
        @blur="handleGlobalOverlayBlur"
        @cancel="handleGlobalOverlayCancel"
        @input-change="handleGlobalOverlayInputChange"
        @click="handleGlobalOverlayClick"
      />
    </div>
    
    <!-- 底部标签栏 -->
    <SheetTabBar ... />
  </div>
</template>
```

**关键点**：使用 `v-show` 而非 `v-if`，确保组件永不销毁。

---

## 8. 实现检查清单

### 8.1 已完成 ✅

- [x] 全局 CellOverlay 架构基础
- [x] CanvasSheet 发送 open-overlay/close-overlay 事件
- [x] useSheetInput 支持全局 overlay 模式
- [x] 基础的 Enter/Tab/Blur/Cancel 处理

### 8.2 待实现 🔧

| 序号 | 任务 | 优先级 | 说明 |
|------|------|--------|------|
| 1 | `handleOpenOverlay` 同步启动 FormulaEditManager | P0 | 确保编辑状态一致 |
| 2 | `shouldShowOverlay` 计算属性 | P0 | 控制跨 Sheet 时隐藏 |
| 3 | `handleSheetChange` 处理跨 Sheet 逻辑 | P0 | 核心流程 |
| 4 | Enter/Tab/Blur/Cancel 检查 source | P0 | 避免重复处理 |
| 5 | `handleSelectionChange` 跨 Sheet 引用插入 | P0 | 核心功能 |
| 6 | Overlay 输入同步到 FormulaEditManager | P0 | 状态一致性 |
| 7 | 模板改用 `v-show` | P0 | 永不释放 |
| 8 | 点击 overlay 切换编辑源 | P1 | 完整的源切换 |
| 9 | 滚动时更新 overlay 位置 | P1 | 跟随单元格 |
| 10 | 切回源 Sheet 恢复 overlay | P1 | 跨 Sheet 返回 |

---

## 9. 与现有代码的差异

### 9.1 当前实现

```typescript
// 当前：v-if 控制，切换时销毁组件
<CellOverlayAdapter v-if="globalOverlay.visible" ... />

// 当前：事件处理不检查 source
function handleGlobalOverlayEnter(val: string) {
  // 直接保存，不管 source 是什么
}
```

### 9.2 目标实现

```typescript
// 目标：v-show 控制，永不销毁
<CellOverlayAdapter v-show="shouldShowOverlay" ... />

// 目标：事件处理检查 source
function handleGlobalOverlayEnter(val: string) {
  if (mgr.state.source === 'formulaBar') {
    handleFormulaBarConfirm()  // 委托给公式栏处理
    return
  }
  // cell 源才直接处理
}
```

---

## 10. 相关文档

| 文档 | 说明 |
|------|------|
| [FORMULA_EDITING_SYSTEM.md](./FORMULA_EDITING_SYSTEM.md) | 公式编辑系统完整文档 |
| [CROSS_SHEET_INPUT_BEHAVIOR.md](./CROSS_SHEET_INPUT_BEHAVIOR.md) | 跨 Sheet 输入行为规范 |
| [FORMULA_INPUT_BEHAVIOR.md](./FORMULA_INPUT_BEHAVIOR.md) | 公式输入行为规范 |
| `src/components/sheet/formulaEditState.ts` | FormulaEditManager 实现 |
