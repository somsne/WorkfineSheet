# 合并单元格功能设计文档

> 版本: 1.0.0  
> 日期: 2025-11-29

## 1. Excel 合并单元格行为分析

### 1.1 合并操作

#### 数据处理规则
1. **保留左上角单元格的值**：合并区域只保留主单元格（左上角）的值
2. **其他单元格值丢失**：合并时如果区域内有多个单元格有值，Excel 会提示：
   > "合并单元格时，只保留左上角单元格的值，并删除其他值。"
3. **合并空单元格**：如果所有单元格都为空，直接合并，无提示
4. **单一有值单元格**：如果只有一个单元格有值，直接合并到主单元格

#### 样式处理
- 合并后的单元格使用主单元格的样式
- 其他单元格的样式被丢弃
- 合并单元格默认居中对齐（水平和垂直）

### 1.2 网格线处理

#### 合并后的网格线
```
合并前:                     合并后:
┌───┬───┬───┐              ┌───────────┐
│ A │ B │ C │              │           │
├───┼───┼───┤      →       │  合并区域  │
│ D │ E │ F │              │           │
└───┴───┴───┘              └───────────┘
```

- **内部网格线消失**：合并区域内的网格线不绘制
- **外边框保留**：合并区域的外边框正常显示
- **邻近单元格边框**：与合并区域相邻的单元格边框正常显示

### 1.3 拆分单元格

#### 拆分行为
1. **值保留在主单元格**：拆分后，原合并单元格的值只保留在左上角
2. **其他单元格为空**：拆分产生的其他单元格为空
3. **样式不扩散**：拆分后样式只保留在主单元格

#### 网格线恢复
- 拆分后，内部网格线恢复显示
- 无需特殊处理，正常渲染即可

### 1.4 功能关联分析

| 功能 | 与合并单元格的交互 |
|------|-------------------|
| **渲染** | 内部网格线不绘制、单元格内容居中 |
| **选择** | 点击合并区域任意位置选中主单元格，框选扩展到完整区域 |
| **编辑** | 编辑合并单元格等同于编辑主单元格 |
| **复制粘贴** | 复制合并单元格复制整个区域，粘贴时保持合并状态 |
| **行列插入** | 在合并区域内插入行列需扩展合并区域 |
| **行列删除** | 删除涉及合并区域的行列需调整或解除合并 |
| **公式引用** | 引用合并单元格 = 引用主单元格 |
| **边框** | 合并区域只显示外边框，内部边框被忽略 |
| **格式** | 合并区域使用主单元格的格式 |

---

## 2. 数据结构设计

### 2.1 合并区域接口

```typescript
// types.ts 新增

/**
 * 合并单元格区域
 */
export interface MergedRegion {
  /** 起始行（主单元格行号） */
  startRow: number
  /** 起始列（主单元格列号） */
  startCol: number
  /** 结束行（包含） */
  endRow: number
  /** 结束列（包含） */
  endCol: number
}

/**
 * 合并单元格查询结果
 */
export interface MergedCellInfo {
  /** 是否是合并区域的一部分 */
  isMerged: boolean
  /** 是否是主单元格（左上角） */
  isMaster: boolean
  /** 所属的合并区域（如果有） */
  region?: MergedRegion
}
```

### 2.2 存储方案

在 `SheetModel` 中添加合并区域存储：

```typescript
// SheetModel.ts

export class SheetModel {
  // ... 现有字段
  
  // 合并区域存储
  // Key: "startRow,startCol" (主单元格坐标)
  private mergedRegions: Map<CellKey, MergedRegion> = new Map()
  
  // 反向索引：快速查找某个单元格属于哪个合并区域
  // Key: "row,col" → "startRow,startCol"
  private mergedCellIndex: Map<CellKey, CellKey> = new Map()
}
```

### 2.3 存储示例

合并 A1:C3 区域：
```
mergedRegions: {
  "0,0": { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }
}

mergedCellIndex: {
  "0,0": "0,0",  // A1 (主单元格)
  "0,1": "0,0",  // B1
  "0,2": "0,0",  // C1
  "1,0": "0,0",  // A2
  "1,1": "0,0",  // B2
  "1,2": "0,0",  // C2
  "2,0": "0,0",  // A3
  "2,1": "0,0",  // B3
  "2,2": "0,0",  // C3
}
```

---

## 3. API 设计

### 3.1 SheetModel 方法

```typescript
// ==================== 合并单元格管理 ====================

/**
 * 合并单元格
 * @returns 是否成功合并
 */
mergeCells(
  startRow: number, 
  startCol: number, 
  endRow: number, 
  endCol: number
): boolean

/**
 * 取消合并单元格
 * @param row 合并区域内任意单元格的行号
 * @param col 合并区域内任意单元格的列号
 * @returns 是否成功取消
 */
unmergeCells(row: number, col: number): boolean

/**
 * 获取单元格的合并信息
 */
getMergedCellInfo(row: number, col: number): MergedCellInfo

/**
 * 检查区域是否可以合并（无冲突）
 */
canMerge(
  startRow: number, 
  startCol: number, 
  endRow: number, 
  endCol: number
): boolean

/**
 * 获取合并区域（如果存在）
 */
getMergedRegion(row: number, col: number): MergedRegion | null

/**
 * 获取所有合并区域
 */
getAllMergedRegions(): MergedRegion[]

/**
 * 检查区域内是否有数据会丢失（用于显示提示）
 */
hasDataToLose(
  startRow: number, 
  startCol: number, 
  endRow: number, 
  endCol: number
): boolean
```

### 3.2 SheetAPI 公开方法

```typescript
// api.ts 新增

interface MergeAPI {
  /**
   * 合并选中的单元格区域
   * @param showWarning 是否显示数据丢失警告（默认 true）
   * @returns 是否成功
   */
  mergeSelection(showWarning?: boolean): boolean
  
  /**
   * 合并指定区域
   */
  mergeCells(
    startRow: number, 
    startCol: number, 
    endRow: number, 
    endCol: number,
    showWarning?: boolean
  ): boolean
  
  /**
   * 取消合并当前选中单元格所在的合并区域
   */
  unmergeSelection(): boolean
  
  /**
   * 取消指定单元格的合并
   */
  unmergeCells(row: number, col: number): boolean
  
  /**
   * 获取单元格的合并信息
   */
  getMergedCellInfo(row: number, col: number): MergedCellInfo
  
  /**
   * 检查单元格是否在合并区域内
   */
  isMergedCell(row: number, col: number): boolean
}
```

---

## 4. 渲染实现

### 4.1 网格线处理 (renderGrid.ts)

修改 `drawGrid` 函数，在绘制网格线时跳过合并区域内部：

```typescript
// 伪代码
function shouldDrawGridLine(
  lineType: 'row' | 'col',
  index: number,
  position: number,
  mergedRegions: MergedRegion[]
): boolean {
  // 检查这条线是否在某个合并区域内部
  for (const region of mergedRegions) {
    if (lineType === 'row') {
      // 水平线：检查是否在合并区域的行范围内（不包括顶边和底边）
      if (index > region.startRow && index <= region.endRow) {
        // 检查列位置是否在合并区域内
        if (position >= region.startCol && position <= region.endCol) {
          return false // 不绘制
        }
      }
    } else {
      // 垂直线：检查是否在合并区域的列范围内（不包括左边和右边）
      if (index > region.startCol && index <= region.endCol) {
        // 检查行位置是否在合并区域内
        if (position >= region.startRow && position <= region.endRow) {
          return false // 不绘制
        }
      }
    }
  }
  return true // 绘制
}
```

### 4.2 单元格渲染 (renderCells.ts)

修改 `drawCells` 函数：

```typescript
// 伪代码
function drawCell(row: number, col: number, ...) {
  const mergeInfo = getMergedCellInfo(row, col)
  
  if (mergeInfo.isMerged) {
    if (!mergeInfo.isMaster) {
      // 非主单元格：跳过渲染（被合并覆盖）
      return
    }
    
    // 主单元格：使用扩展的尺寸渲染
    const region = mergeInfo.region!
    const width = calculateMergedWidth(region)
    const height = calculateMergedHeight(region)
    
    // 绘制合并单元格的背景
    drawCellBackground(x, y, width, height, style)
    
    // 绘制合并单元格的内容（居中）
    drawCellContent(x, y, width, height, value, style)
  } else {
    // 普通单元格：正常渲染
    drawNormalCell(...)
  }
}
```

### 4.3 边框渲染

合并单元格的边框处理：
- 只绘制合并区域的外边框
- 内部边框设置被忽略

```typescript
function drawMergedCellBorder(region: MergedRegion, border: CellBorder) {
  // 只绘制外边框
  drawBorderEdge('top', region.startRow, region.startCol, region.endCol)
  drawBorderEdge('bottom', region.endRow, region.startCol, region.endCol)
  drawBorderEdge('left', region.startCol, region.startRow, region.endRow)
  drawBorderEdge('right', region.endCol, region.startRow, region.endRow)
}
```

---

## 5. 交互处理

### 5.1 点击选择

```typescript
function handleCellClick(row: number, col: number) {
  const mergeInfo = getMergedCellInfo(row, col)
  
  if (mergeInfo.isMerged) {
    // 选中主单元格
    const region = mergeInfo.region!
    selectCell(region.startRow, region.startCol)
    
    // 选区自动扩展到整个合并区域
    setSelectionRange(
      region.startRow, 
      region.startCol, 
      region.endRow, 
      region.endCol
    )
  } else {
    selectCell(row, col)
  }
}
```

### 5.2 框选扩展

```typescript
function expandSelectionToMerged(selection: SelectionRange): SelectionRange {
  let { startRow, startCol, endRow, endCol } = selection
  let changed = true
  
  // 迭代扩展，直到不再变化
  while (changed) {
    changed = false
    
    // 检查选区内所有单元格
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const mergeInfo = getMergedCellInfo(r, c)
        if (mergeInfo.isMerged) {
          const region = mergeInfo.region!
          
          // 扩展选区以包含整个合并区域
          if (region.startRow < startRow) {
            startRow = region.startRow
            changed = true
          }
          if (region.startCol < startCol) {
            startCol = region.startCol
            changed = true
          }
          if (region.endRow > endRow) {
            endRow = region.endRow
            changed = true
          }
          if (region.endCol > endCol) {
            endCol = region.endCol
            changed = true
          }
        }
      }
    }
  }
  
  return { startRow, startCol, endRow, endCol }
}
```

### 5.3 编辑行为

- 双击合并区域任意位置 → 编辑主单元格
- 输入覆盖层定位到合并区域的位置和尺寸
- 完成编辑后值保存到主单元格

---

## 6. 行列操作兼容

### 6.1 插入行列

```typescript
function adjustMergedRegionsOnInsertRow(insertAt: number, count: number) {
  for (const region of getAllMergedRegions()) {
    if (insertAt <= region.startRow) {
      // 插入点在合并区域上方：整体下移
      region.startRow += count
      region.endRow += count
    } else if (insertAt <= region.endRow) {
      // 插入点在合并区域内部：扩展区域
      region.endRow += count
    }
    // 插入点在合并区域下方：不影响
  }
  
  // 重建索引
  rebuildMergedCellIndex()
}
```

### 6.2 删除行列

```typescript
function adjustMergedRegionsOnDeleteRow(deleteAt: number, count: number) {
  const deleteEnd = deleteAt + count - 1
  
  for (const region of getAllMergedRegions()) {
    if (deleteEnd < region.startRow) {
      // 删除区域在合并区域上方：整体上移
      region.startRow -= count
      region.endRow -= count
    } else if (deleteAt > region.endRow) {
      // 删除区域在合并区域下方：不影响
    } else if (deleteAt <= region.startRow && deleteEnd >= region.endRow) {
      // 删除区域完全包含合并区域：移除合并
      removeMergedRegion(region)
    } else {
      // 部分重叠：收缩或调整
      const overlapStart = Math.max(deleteAt, region.startRow)
      const overlapEnd = Math.min(deleteEnd, region.endRow)
      const overlapCount = overlapEnd - overlapStart + 1
      
      if (deleteAt <= region.startRow) {
        // 删除影响到起始行
        region.startRow = deleteAt
      }
      region.endRow -= overlapCount
      
      // 如果收缩后只剩一行/列，取消合并
      if (region.startRow === region.endRow && region.startCol === region.endCol) {
        removeMergedRegion(region)
      }
    }
  }
  
  rebuildMergedCellIndex()
}
```

---

## 7. 复制粘贴处理

### 7.1 复制

```typescript
function copyMergedCells(selection: SelectionRange): ClipboardData {
  // 扩展选区到完整的合并区域
  const expanded = expandSelectionToMerged(selection)
  
  // 复制数据，标记合并区域
  const data: ClipboardData = {
    cells: [],
    mergedRegions: []
  }
  
  for (let r = expanded.startRow; r <= expanded.endRow; r++) {
    const row = []
    for (let c = expanded.startCol; c <= expanded.endCol; c++) {
      const mergeInfo = getMergedCellInfo(r, c)
      if (mergeInfo.isMerged && !mergeInfo.isMaster) {
        // 非主单元格：复制为空
        row.push({ value: '', isMerged: true })
      } else {
        row.push({ value: getValue(r, c), isMerged: mergeInfo.isMaster })
      }
    }
    data.cells.push(row)
  }
  
  // 记录相对合并区域
  for (const region of getMergedRegionsInRange(expanded)) {
    data.mergedRegions.push({
      startRow: region.startRow - expanded.startRow,
      startCol: region.startCol - expanded.startCol,
      endRow: region.endRow - expanded.startRow,
      endCol: region.endCol - expanded.startCol
    })
  }
  
  return data
}
```

### 7.2 粘贴

```typescript
function pasteMergedCells(data: ClipboardData, destRow: number, destCol: number) {
  // 粘贴值
  for (let r = 0; r < data.cells.length; r++) {
    for (let c = 0; c < data.cells[r].length; c++) {
      setValue(destRow + r, destCol + c, data.cells[r][c].value)
    }
  }
  
  // 应用合并区域
  for (const region of data.mergedRegions) {
    mergeCells(
      destRow + region.startRow,
      destCol + region.startCol,
      destRow + region.endRow,
      destCol + region.endCol
    )
  }
}
```

---

## 8. 撤销/重做支持

### 8.1 合并命令

```typescript
const mergeCommand: Command = {
  name: '合并单元格',
  redo: () => {
    // 保存被覆盖的值（用于撤销恢复）
    const overwrittenValues = collectValues(region)
    model.mergeCells(startRow, startCol, endRow, endCol)
    return overwrittenValues
  },
  undo: (overwrittenValues) => {
    model.unmergeCells(startRow, startCol)
    // 恢复被覆盖的值
    restoreValues(overwrittenValues)
  }
}
```

### 8.2 取消合并命令

```typescript
const unmergeCommand: Command = {
  name: '取消合并单元格',
  redo: () => {
    const region = model.getMergedRegion(row, col)
    const masterValue = model.getValue(region.startRow, region.startCol)
    model.unmergeCells(row, col)
    return { region, masterValue }
  },
  undo: ({ region, masterValue }) => {
    model.mergeCells(region.startRow, region.startCol, region.endRow, region.endCol)
    model.setValue(region.startRow, region.startCol, masterValue)
  }
}
```

---

## 9. 实现计划

### Phase 1: 数据层 (1天)
- [ ] 定义 `MergedRegion` 和 `MergedCellInfo` 类型
- [ ] `SheetModel` 添加合并区域存储和索引
- [ ] 实现基础 CRUD 方法
- [ ] 编写单元测试

### Phase 2: 渲染层 (1.5天)
- [ ] 修改 `renderGrid.ts` 支持合并区域网格线处理
- [ ] 修改 `renderCells.ts` 支持合并单元格渲染
- [ ] 合并单元格背景和内容绘制
- [ ] 边框渲染适配

### Phase 3: 交互层 (1天)
- [ ] 点击选择逻辑
- [ ] 框选扩展逻辑
- [ ] 编辑行为适配
- [ ] 覆盖层尺寸调整

### Phase 4: API 和命令 (0.5天)
- [ ] `SheetAPI` 公开方法
- [ ] 撤销/重做命令注册
- [ ] 工具栏按钮集成

### Phase 5: 兼容性 (1天)
- [ ] 行列操作兼容
- [ ] 复制粘贴兼容
- [ ] 公式引用兼容

### Phase 6: 测试和文档 (0.5天)
- [ ] 完整单元测试
- [ ] API 文档
- [ ] 使用指南

---

## 10. 测试用例

### 合并操作
- [ ] 合并空单元格
- [ ] 合并有值单元格（单个值）
- [ ] 合并有值单元格（多个值，测试警告）
- [ ] 合并已合并区域（冲突检测）
- [ ] 取消合并

### 渲染
- [ ] 合并区域网格线不显示
- [ ] 合并单元格内容居中
- [ ] 合并单元格背景正确
- [ ] 相邻单元格边框正确

### 交互
- [ ] 点击合并区域选中主单元格
- [ ] 框选包含合并区域自动扩展
- [ ] 双击编辑合并单元格
- [ ] Tab/Enter 键跳过合并区域

### 行列操作
- [ ] 在合并区域上方插入行
- [ ] 在合并区域内插入行
- [ ] 删除合并区域部分行
- [ ] 删除完整合并区域

### 复制粘贴
- [ ] 复制合并单元格
- [ ] 粘贴保持合并状态
- [ ] 外部粘贴（不保持合并）
