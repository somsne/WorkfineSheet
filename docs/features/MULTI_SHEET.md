# 多工作表 (Multi-Sheet Workbook) 功能文档

## 概述

WorkfineSheet 支持多工作表功能，允许在一个工作簿中管理多个工作表，实现类似 Excel 的多 Sheet 体验。

## 快速开始

### 使用 WorkbookSheet 组件

```vue
<template>
  <WorkbookSheet
    ref="workbookRef"
    :initial-sheets="['Sheet1', 'Sheet2']"
    @sheet-change="onSheetChange"
    @loaded="onLoaded"
  />
</template>

<script setup>
import { ref } from 'vue'
import WorkbookSheet from '@/components/WorkbookSheet.vue'

const workbookRef = ref(null)

const onSheetChange = (sheetId, sheetName) => {
  console.log(`切换到工作表: ${sheetName}`)
}

const onLoaded = () => {
  // 所有操作都自动作用于当前活动工作表
  workbookRef.value.setCellValue(0, 0, 'Hello')
  workbookRef.value.setCellStyle(0, 0, { bold: true })
}
</script>
```

### WorkbookSheet API

WorkbookSheet 代理了 CanvasSheet 的所有 API，操作自动作用于当前活动工作表：

```typescript
// 工作簿操作
workbook.addSheet('新工作表')
workbook.removeSheet(sheetId)
workbook.renameSheet(sheetId, '新名称')
workbook.setActiveSheet(sheetId)
workbook.getActiveSheetId()
workbook.getSheetCount()
workbook.toJSON() / fromJSON(data)

// 单元格操作（自动作用于当前活动工作表）
workbook.getCellValue(row, col)
workbook.setCellValue(row, col, value)
workbook.getCellStyle(row, col)
workbook.setCellStyle(row, col, style)
workbook.setRangeStyle(startRow, startCol, endRow, endCol, style)

// 边框操作
workbook.setAllBorders(startRow, startCol, endRow, endCol, borderStyle)
workbook.clearAllBorders(startRow, startCol, endRow, endCol)

// 合并单元格
workbook.mergeCells(startRow, startCol, endRow, endCol)
workbook.unmergeCells(row, col)

// 行列操作
workbook.insertRowAbove(row)
workbook.deleteRow(row)
workbook.insertColLeft(col)
workbook.deleteCol(col)

// 撤销/重做
workbook.undo()
workbook.redo()

// 格式刷
workbook.startFormatPainter()
workbook.stopFormatPainter()
```

## 核心特性

### 1. 工作簿管理
- 支持多个工作表（Sheet）
- 工作表增删改查
- 工作表排序和移动
- 工作表复制
- 工作表隐藏/显示
- 工作表标签颜色

### 2. 跨表公式引用
- 支持 `Sheet1!A1` 语法引用其他工作表单元格
- 支持 `'带空格的表名'!A1` 带引号的工作表名
- 支持跨表范围引用 `Sheet1!A1:B5`
- 自动依赖追踪

### 3. 格式刷跨表支持
- 格式刷激活状态跨工作表保持
- 支持在不同工作表间应用格式

## 数据结构

### Workbook 类

```typescript
import { Workbook } from '@/lib/Workbook'

// 创建工作簿（默认包含一个 Sheet1）
const workbook = new Workbook()

// 获取所有工作表
const sheets = workbook.getAllSheets()

// 获取活动工作表
const activeSheet = workbook.getActiveSheet()

// 获取活动工作表的数据模型
const model = workbook.getActiveModel()
```

### SheetMetadata 接口

```typescript
interface SheetMetadata {
  /** 工作表唯一 ID */
  id: string
  /** 工作表名称 */
  name: string
  /** 标签颜色（可选） */
  color?: string
  /** 是否可见 */
  visible: boolean
  /** 排序索引 */
  order: number
}
```

### SheetInfo 接口

```typescript
interface SheetInfo {
  /** 元数据 */
  metadata: SheetMetadata
  /** 数据模型 */
  model: SheetModel
}
```

## API 参考

### 工作表操作

#### addSheet(name?, index?)
添加新工作表

```typescript
// 添加工作表（自动命名）
const id1 = workbook.addSheet() // "Sheet2"

// 添加指定名称的工作表
const id2 = workbook.addSheet('数据表')

// 在指定位置插入
const id3 = workbook.addSheet('汇总', 1) // 插入到第二个位置
```

#### removeSheet(id)
删除工作表

```typescript
const sheet = workbook.getSheetByName('Sheet2')
workbook.removeSheet(sheet.metadata.id)
```

> ⚠️ 无法删除最后一个可见工作表

#### renameSheet(id, newName)
重命名工作表

```typescript
const sheet = workbook.getSheetByName('Sheet1')
workbook.renameSheet(sheet.metadata.id, '销售数据')
```

**命名限制：**
- 不能为空
- 不能包含 `\ / ? * [ ] : '` 字符
- 长度不超过 31 个字符
- 不能与现有工作表重名

#### duplicateSheet(id, newName?)
复制工作表

```typescript
const sheet = workbook.getSheetByName('模板')
const newId = workbook.duplicateSheet(sheet.metadata.id, '模板副本')
```

#### moveSheet(id, newIndex)
移动工作表位置

```typescript
const sheet = workbook.getSheetByName('Sheet3')
workbook.moveSheet(sheet.metadata.id, 0) // 移动到第一个位置
```

### 工作表切换

#### setActiveSheet(id)
切换活动工作表

```typescript
const sheet = workbook.getSheetByName('Sheet2')
workbook.setActiveSheet(sheet.metadata.id)
```

#### setActiveSheetByName(name)
通过名称切换活动工作表

```typescript
workbook.setActiveSheetByName('数据表')
```

### 显示/隐藏

#### setSheetVisibility(id, visible)
设置工作表可见性

```typescript
const sheet = workbook.getSheetByName('草稿')
workbook.setSheetVisibility(sheet.metadata.id, false) // 隐藏
workbook.setSheetVisibility(sheet.metadata.id, true)  // 显示
```

> ⚠️ 无法隐藏最后一个可见工作表

### 标签颜色

#### setSheetColor(id, color?)
设置标签颜色

```typescript
const sheet = workbook.getSheetByName('重要')
workbook.setSheetColor(sheet.metadata.id, '#ff0000') // 设置红色
workbook.setSheetColor(sheet.metadata.id, undefined) // 清除颜色
```

### 查询方法

```typescript
// 通过 ID 获取
const sheet = workbook.getSheetById(id)

// 通过名称获取
const sheet = workbook.getSheetByName('Sheet1')

// 获取所有工作表（按顺序）
const allSheets = workbook.getAllSheets()

// 获取所有可见工作表
const visibleSheets = workbook.getVisibleSheets()

// 获取工作表数量
const count = workbook.getSheetCount()

// 检查名称是否存在
const exists = workbook.hasSheetName('Sheet1')

// 获取所有工作表名称
const names = workbook.getSheetNames()
```

## 跨表公式

### 语法

| 格式 | 说明 | 示例 |
|------|------|------|
| `SheetName!A1` | 简单工作表名 | `=Sheet1!A1` |
| `'Sheet Name'!A1` | 带空格的工作表名 | `='销售数据'!A1` |
| `SheetName!A1:B5` | 跨表范围引用 | `=SUM(Sheet1!A1:A10)` |

### 示例

```typescript
// 在 Sheet2 中引用 Sheet1 的数据
const sheet2 = workbook.getSheetByName('Sheet2')
sheet2.model.setValue(0, 0, '=Sheet1!A1')

// 跨表求和
sheet2.model.setValue(0, 1, '=SUM(Sheet1!B1:B10)')

// 引用带空格的工作表名
sheet2.model.setValue(0, 2, "='销售数据'!C5")
```

### FormulaEngine 配置

```typescript
// 设置跨表取值回调
formulaEngine.setCrossSheetValueGetter(
  (sheetName, row, col) => {
    if (sheetName) {
      return workbook.getCellValueBySheetName(sheetName, row, col)
    }
    return currentModel.getValue(row, col)
  },
  'Sheet1' // 当前工作表名称
)
```

## 事件系统

### 事件类型

| 事件 | 说明 | 数据 |
|------|------|------|
| `sheetAdded` | 工作表添加 | `{ sheetId, sheetName }` |
| `sheetRemoved` | 工作表删除 | `{ sheetId, sheetName }` |
| `sheetRenamed` | 工作表重命名 | `{ sheetId, oldName, newName }` |
| `sheetMoved` | 工作表移动 | `{ sheetId, oldIndex, newIndex }` |
| `sheetActivated` | 工作表激活 | `{ sheetId, sheetName }` |
| `sheetVisibilityChanged` | 可见性变化 | `{ sheetId, visible }` |
| `sheetColorChanged` | 颜色变化 | `{ sheetId, color }` |

### 监听事件

```typescript
workbook.on('sheetActivated', (event) => {
  console.log(`切换到工作表: ${event.sheetName}`)
})

workbook.on('sheetRenamed', (event) => {
  console.log(`工作表重命名: ${event.oldName} → ${event.newName}`)
})

// 移除监听
workbook.off('sheetActivated', listener)
```

## UI 组件

### SheetTabBar

工作表标签栏组件，提供：

- 工作表标签显示
- 点击切换工作表
- 双击重命名
- 右键菜单（插入/删除/重命名/复制/隐藏）
- 拖拽排序
- 新建按钮
- 标签颜色设置
- 滚动导航（标签过多时）

```vue
<template>
  <SheetTabBar
    :sheets="workbook.getAllSheets()"
    :active-sheet-id="workbook.getActiveSheetId()"
    @switch="handleSwitch"
    @add="handleAdd"
    @remove="handleRemove"
    @rename="handleRename"
    @duplicate="handleDuplicate"
    @move="handleMove"
    @hide="handleHide"
    @unhide="handleUnhide"
    @set-color="handleSetColor"
  />
</template>
```

## 序列化

### 导出为 JSON

```typescript
const json = workbook.toJSON()
// {
//   version: '1.0',
//   activeSheetId: 'sheet_xxx',
//   sheetCounter: 3,
//   sheets: [...]
// }
```

### 从 JSON 导入

```typescript
const workbook = Workbook.fromJSON(json)
```

## 最佳实践

### 1. 工作表命名
- 使用有意义的名称（如"销售数据"、"汇总表"）
- 避免特殊字符
- 保持名称简短（<20字符）

### 2. 跨表引用
- 对于稳定的引用，使用完整的工作表名前缀
- 工作表重命名时，引用该表的公式会自动更新（TODO）

### 3. 性能考虑
- 避免过多的跨表引用（可能导致计算延迟）
- 大量数据时考虑分表存储

## 文件结构

```
src/lib/
├── Workbook.ts          # 工作簿模型
├── SheetModel.ts        # 工作表模型（已有）
├── FormulaEngine.ts     # 公式引擎（已扩展跨表支持）
└── tests/
    └── Workbook.spec.ts # 单元测试 (29 个测试)

src/components/
├── CanvasSheet.vue      # 单工作表组件（支持外部 model）
├── WorkbookSheet.vue    # 工作簿组件（包装 CanvasSheet）
└── sheet/
    ├── SheetTabBar.vue  # 标签栏组件
    └── composables/
        └── useSheetState.ts # 支持外部 model 注入
        
tests/
└── workbook-demo.html   # 多工作表演示页面
```

## 实现状态

### 已完成 ✅
- [x] Workbook 数据模型（工作表增删改查、排序、复制、隐藏显示、颜色）
- [x] SheetTabBar 标签栏组件（点击切换、双击重命名、右键菜单、拖拽排序）
- [x] 跨表单元格引用语法解析（Sheet1!A1, 'Sheet Name'!A1）
- [x] 跨表范围引用语法解析（Sheet1!A1:B5）
- [x] WorkbookSheet 包装组件
- [x] 工作簿序列化/反序列化（toJSON/fromJSON）
- [x] 事件系统（sheetAdded, sheetRemoved, sheetRenamed, 等）
- [x] 单元测试（29 个测试用例，100% 通过）
- [x] CanvasSheet 支持外部 SheetModel 注入
- [x] WorkbookSheet API 代理（所有操作自动作用于当前活动工作表）
- [x] 演示页面（tests/workbook-demo.html）

### 进行中 🔄
- [ ] 跨表格式刷完整支持

### 待实现 📋
- [ ] 工作表重命名时自动更新公式引用
- [ ] 3D 引用支持（Sheet1:Sheet3!A1）
- [ ] 跨表复制粘贴
- [ ] 全工作簿搜索替换
- [ ] 工作表保护功能
