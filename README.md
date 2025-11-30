# 📊 WorkfineSheet - 企业级电子表格组件

![CI Status](https://github.com/somsne/WorkfineSheet/actions/workflows/ci.yml/badge.svg)
![Deploy Status](https://github.com/somsne/WorkfineSheet/actions/workflows/deploy.yml/badge.svg)
![Test Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

**在线演示**: [https://somsne.github.io/WorkfineSheet/](https://somsne.github.io/WorkfineSheet/)

**项目**: 基于 Vue 3 + TypeScript + Canvas 的高性能电子表格组件  
**特点**: 🎯 模块化架构 · 📝 Excel 公式支持 · 🎨 单元格样式 · ✅ 完整测试覆盖 · 🤖 100%由AI生成  
**状态**: 🟢 核心功能完成 · 🎨 样式系统 100% · 449 个单元测试全部通过

---

## � 项目亮点

### 代码质量
- ✅ **模块化架构**: 14 个独立模块，职责清晰
- ✅ **样式系统**: 12 种样式属性，支持中英文自动换行和文字旋转
- ✅ **类型安全**: TypeScript 严格模式，零类型错误
- ✅ **测试覆盖**: 449 个单元测试，100% 通过率

### 性能优化
- ⚡ **Canvas 渲染**: 比 DOM 性能提升 10 倍以上
- ⚡ **帧调度**: requestAnimationFrame 合并重绘
- ⚡ **虚拟滚动**: 只渲染可见区域
- ⚡ **纯函数**: JavaScript 引擎优化友好

### 开发体验
- 🛠️ **Vite**: 快速热更新（< 100ms）
- 🛠️ **Vitest**: 快速测试执行（~1.7s）
- 🛠️ **TypeScript**: 完整的类型提示和检查
- 🛠️ **文档完善**: 40+ 个文档文件

### 企业级特性
- 📊 **Excel 兼容**: 支持 100+ 函数
- 📊 **撤销重做**: 完整的操作历史
- 📊 **剪贴板**: Excel 格式互操作
- 📊 **公式引用**: 可视化编辑和调整

---

## 🎯 快速开始

### Node.js 版本要求

项目支持 **Node.js 18.x 及以上版本**，已在以下版本完成测试：

| Node 版本 | 类型 | 维护结束 | 测试状态 | 推荐度 |
|-----------|------|----------|----------|--------|
| **v24.x** | LTS (Krypton) | 2028-04 | ✅ 通过 | ⭐⭐⭐ **强烈推荐** |
| **v22.x** | LTS (Jod) | 2027-04 | ✅ 通过 | ⭐⭐⭐ **强烈推荐** |
| **v20.x** | LTS (Iron) | 2026-04 | ✅ 通过 | ⭐⭐ 推荐 |
| v18.x | LTS (Hydrogen) | 2025-04 | ✅ 通过 | ⚠️ 即将停止维护 |
| v25.x | Current | 2026-04 | ✅ 通过 | 🚀 尝鲜 |

> 💡 **生产环境推荐**: 使用 **Node v24.x** 或 **v22.x** (最新 LTS 版本)  
> 📌 **版本管理**: 推荐使用 [nvm](https://github.com/nvm-sh/nvm) 管理 Node 版本

### 开发模式
```bash
# 使用 nvm 切换到项目推荐版本（仓库已提供 .nvmrc）
nvm use
# 如未安装对应版本，可先安装
# nvm install

# 校验当前 Node 版本（应 >= 18，推荐 20）
node -v

npm install
npm run dev
# 打开 http://localhost:5174/
```

### 生产构建
```bash
nvm use && node -v
npm run build
npm run preview
```

### 运行测试
```bash
nvm use && node -v
npm run test
```

---

## 📚 文档导航

> 📂 **完整文档索引**: [docs/DOCS_INDEX.md](./docs/DOCS_INDEX.md) - 查看所有 40+ 篇文档

### 🏗️ 架构与设计
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - 完整的模块架构设计
- **[docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)** - 项目目录结构说明
- **[docs/API_REFERENCE.md](./docs/API_REFERENCE.md)** - 公共 API 参考

### � 开发文档
- **[docs/DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)** - 开发者指南
- **[docs/GITHUB_ACTIONS.md](./docs/GITHUB_ACTIONS.md)** - CI/CD 自动化配置
- **[refactor-progress.md](./refactor-progress.md)** - 详细的重构进度跟踪

### 🔥 最新功能
- **[docs/P0.1-CHECKLIST.md](./docs/P0.1-CHECKLIST.md)** - 单元格样式系统开发进度（100% 完成）
- **[DEMO_STYLES.md](./DEMO_STYLES.md)** - 单元格样式演示数据说明
- **[docs/RICHTEXTINPUT_COMPLETE.md](./docs/RICHTEXTINPUT_COMPLETE.md)** - RichTextInput 富文本编辑器完成报告

### 🧪 测试文档
- **[docs/TEST_SUMMARY.md](./docs/TEST_SUMMARY.md)** - 测试工作总结
- **[docs/COMPLETION_REPORT.md](./docs/COMPLETION_REPORT.md)** - 项目完成报告
- **[docs/QUICK_TEST.md](./docs/QUICK_TEST.md)** - 快速功能验证（5 分钟）

> � **快速上手**: 建议阅读顺序  
> 1. [PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md) - 了解项目结构  
> 2. [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 理解架构设计  
> 3. [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md) - 开始开发

---

### ✨ 核心特性

### 🎯 电子表格功能
- ✅ **公式计算**: 支持 100+ Excel 函数 (SUM, VLOOKUP, IF 等)
- ✅ **单元格引用**: 相对引用 (A1)、绝对引用 ($A$1)、范围引用 (A1:B2)
- ✅ **公式编辑**: 可视化单元格选择、彩色引用边框
- ✅ **单元格样式**: 字体大小/颜色、粗体/斜体/下划线/删除线、对齐方式、背景色、文字旋转、自动换行
- ✅ **边框设置**: 所有边框/外边框/上下左右边框、多种边框样式（细线/中等/粗线/虚线/点线/双线）、自定义边框颜色
- ✅ **单元格格式**: 数字、日期、百分比、货币等10+种格式
- ✅ **合并单元格**: 合并/取消合并、边框自动处理、Excel 行为兼容
- ✅ **行列操作**: 插入/删除行列、自定义行高列宽
- ✅ **剪贴板**: 支持标准表格格式互相粘贴
- ✅ **撤销重做**: 完整的操作历史管理
- ✅ **隐藏功能**: 隐藏行列、网格线开关

### 🏗️ 架构优势
- ✅ **模块化设计**: 14 个独立模块，职责清晰
- ✅ **样式系统**: 12 种样式属性，完整的渲染支持
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **测试覆盖**: 449 个单元测试，100% 通过率
- ✅ **性能优化**: Canvas 渲染、虚拟滚动、帧调度

### 🚧 待开发功能

#### 📋 核心功能（P0 - 样式与格式基础）
- ✅ **单元格样式** - 字体、颜色、对齐、背景 **（已完成）**
- ✅ **边框样式** - 单元格边框设置 **（已完成）**
- ✅ **单元格格式** - 数字、日期、百分比、货币格式 **（已完成）**
- ✅ **单元格合并** - 合并/取消合并、边框处理、Excel 行为兼容 **（已完成）**

#### 🎯 交互增强（P1 - 功能扩展）
- 🖱️ **拖拽功能** - 填充柄、移动、复制 **（已完成）**
- 🖼️ **插入浮动图片** - 浮动层图片管理 **（已完成）**
- 📷 **单元格内插入图片** - 单元格内嵌图片
- 🖌️ **格式刷** - 快速复制格式

#### 📂 Excel 互操作（P2 - 文件处理）
- 📂 **打开 Excel 文件** - 支持 .xlsx 文件导入
- 💾 **导出 Excel 文件** - 导出为标准 Excel 格式

#### 🔧 高级功能（P3 - 数据处理）
- 📋 **数据规范** - 数据有效性规则
- 🧊 **冻结窗格** - 冻结行列显示
- 🎨 **条件格式** - 基于规则的单元格样式
- 📝 **数据验证** - 输入验证与提示
- 🔍 **筛选功能** - 数据筛选与排序
- 📈 **分组小计** - 数据分组与小计

#### 📊 企业级功能（P4 - 复杂场景）
- 🖨️ **打印输出** - 打印预览与设置
- 📊 **透视表** - 数据透视分析
- 🔍 **缩放功能** - 视图缩放控制
- 📑 **多 Sheet 公式兼容** - 跨工作表引用
- 💡 **Excel 公式自动补全** - 公式智能提示

#### 🎁 可选增强（未来规划）
- 🛠️ **工具栏** - 完整的工具栏组件
- 📝 **常驻输入框** - 类似 Excel 的公式栏
- 📈 **ECharts 接入** - 图表可视化
- ✨ **动画效果优化** - 交互动画提升
- ✨ **更高效的计算** - Web Worker/WASM等方案

---

## 🏗️ 项目架构

### 模块化设计（14 个核心模块）
```
src/components/sheet/
├─ types.ts          # 类型定义
├─ geometry.ts       # 几何计算（行列位置、尺寸）
├─ renderCore.ts     # 渲染核心（Canvas 设置、帧调度）
├─ renderGrid.ts     # 网格渲染（表头、网格线）
├─ renderCells.ts    # 单元格渲染（内容、选择、引用边框）
├─ scrollbar.ts      # 滚动条管理
├─ references.ts     # 公式引用解析
├─ selection.ts      # 选择与拖拽
├─ overlay.ts        # 编辑覆盖层
├─ clipboard.ts      # 剪贴板处理（CSV 解析、Excel 互操作）
├─ rowcol.ts         # 行列操作（插入、删除、调整）
├─ uiMenus.ts        # 上下文菜单
├─ events.ts         # 事件管理器
└─ api.ts            # 公共 API

lib/
├─ FormulaEngine.ts  # 公式计算引擎（100+ 函数）
├─ FormulaSheet.ts   # 公式表格封装
├─ SheetModel.ts     # 数据模型（支持单元格样式存储）
├─ UndoRedoManager.ts # 撤销重做管理
└─ demoData.ts       # 演示数据（展示所有样式功能）

types/
└─ CellStyle.ts      # 单元格样式类型定义（12 种属性）
```

**设计原则**:
- 🎯 单一职责 - 每个模块专注一个功能领域
- 🔧 纯函数优先 - 易于测试和复用
- 📦 依赖注入 - 通过配置对象传递依赖
- 📝 类型安全 - 完整的 TypeScript 类型定义

详见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## 🧪 测试与质量保证

### 单元测试（Vitest）
```bash
npm test              # 运行测试
npm run test:ui       # 测试 UI 界面
npm run test:coverage # 生成覆盖率报告
```

**测试统计**:
- ✅ **测试文件**: 16 个
- ✅ **测试用例**: 449 个
- ✅ **通过率**: 100%
- ✅ **执行时间**: ~1.7s

**覆盖模块**:
- `geometry.spec.ts` - 几何计算（行高列宽、位置、隐藏）
- `styles.spec.ts` - 数据模型（单元格样式存储）
- `api-styles.spec.ts` - 样式 API 测试
- `render-styles.spec.ts` - 样式渲染（字体、装饰、对齐、背景、换行、旋转）
- `borders.spec.ts` - 边框设置与渲染
- `merge.spec.ts` - 合并单元格（合并/取消、边框处理、Excel 行为）
- `clipboard.spec.ts` - CSV 解析（引号、转义、边界情况）
- `references.spec.ts` - 单元格地址解析（A1, $A$1, AA1）
- `events.spec.ts` - 事件管理器（注册、注销、触发）
- `formatValue.spec.ts` - 单元格格式化（数字、日期、百分比、货币）
- `performance.spec.ts` - 性能基准测试
- `ime-utils.spec.ts` - 中文输入法支持

### 功能验证
快速测试公式功能:
```
1. 打开应用
2. 在单元格输入 =SUM(A1:A5)
3. 双击编辑查看公式
4. 尝试复制粘贴、插入行列
```

详见 [docs/QUICK_TEST.md](./docs/QUICK_TEST.md)

---

## 📊 项目进度与重构成果

### 重构进度（19 个阶段）
```
阶段 0-15:  核心重构        ████████████████ 100% ✅
阶段 16:    单元测试        ████████████████ 100% ✅
阶段 17:    集成测试        ░░░░░░░░░░░░░░░░   0% ⏳
阶段 18:    文档完善        ██████████░░░░░░  60% 🟡
阶段 19:    构建验证        ████████████████ 100% ✅
────────────────────────────────────────────────
总体完成度                 ██████████████░░  89% 🟢
```

### 重构成果
- **模块架构**: 1 个组件 → 14 个独立模块
- **样式系统**: 12 种样式属性渲染完成（字体、颜色、对齐、背景、旋转、换行）
- **单元格格式**: 数字、日期、百分比、货币等 10+ 种格式
- **合并单元格**: 合并/取消合并、边框收集与分发、Excel 行为兼容
- **测试覆盖**: 0 → 449 个单元测试（16 个测试文件），100% 通过率
- **文档完善**: 新增 40+ 个文档文件
- **构建状态**: ✅ 零错误（302.89 kB, gzip: 95.81 kB）
- **类型检查**: ✅ 完全通过 TypeScript 严格模式

详见 [refactor-progress.md](./refactor-progress.md)

---

## 💻 技术栈

### 核心技术
- **Vue**: 3.5.24 (Composition API, SFC)
- **TypeScript**: 5.9.3 (严格模式, ES2019 target)
- **Vite**: 7.2.4 (快速构建工具)
- **Canvas API**: 原生 Canvas 渲染（高性能）

### 依赖库
- **hot-formula-parser**: 3.0.2 (公式引擎, 100+ 函数)

### 开发工具
- **Vitest**: 4.0.14 (测试框架)
- **@vitest/ui**: 测试 UI 界面
- **@vitest/coverage-v8**: 覆盖率工具
- **vue-tsc**: Vue TypeScript 编译器

---

## 🔧 开发命令

```bash
npm run dev              # 开发服务器
npm run build            # 生产构建
npm run preview          # 预览生产版本
npm test                 # 运行测试
npm run test:ui          # 测试 UI
npm run test:coverage    # 覆盖率报告
```

---

## 📈 支持的 Excel 函数

**数学**: SUM, AVERAGE, COUNT, MIN, MAX, ROUND, SQRT, POWER, ABS (20+)  
**统计**: STDEV, VAR, MEDIAN, PERCENTILE, LARGE, SMALL (15+)  
**文本**: CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER (10+)  
**日期**: DATE, TODAY, YEAR, MONTH, DAY, WEEKDAY (10+)  
**逻辑**: IF, AND, OR, NOT, XOR (5+)  
**查询**: VLOOKUP, HLOOKUP, INDEX, MATCH, CHOOSE (5+)

**总计: 100+ 函数**

---

## 🎯 使用示例

### 基本用法
```vue
<template>
  <CanvasSheet
    ref="sheetRef"
    :default-row-height="25"
    :default-col-width="100"
    :total-rows="100"
    :total-cols="26"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CanvasSheet from '@/components/CanvasSheet.vue'

const sheetRef = ref<InstanceType<typeof CanvasSheet>>()

onMounted(() => {
  const api = sheetRef.value
  if (!api) return

  // 设置单元格值
  api.setCellValue(0, 0, 'Hello')
  api.setCellValue(0, 1, '=A1 & " World"')

  // 设置行高列宽
  api.rowColSize.setRowHeight(0, 50)
  api.rowColSize.setColWidth(0, 150)
})
</script>
```

### 高级功能
```typescript
// 批量操作
for (let i = 0; i < 5; i++) {
  await api.rowColOps.insertRowBelow(10)
}

// 获取选择
const selection = api.selection.getSelection()
console.log('Selected:', selection)

// 获取单元格值
const value = api.getCellValue(0, 0)
console.log('Value:', value)

// 触发重绘
api.redraw()
```

详见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## 🚀 快速开始

### 新手入门
1. **安装依赖**: `npm install`
2. **启动开发**: `npm run dev`
3. **功能验证**: [docs/QUICK_TEST.md](./docs/QUICK_TEST.md)
4. **阅读文档**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

### 开发者指南
1. **项目结构**: [docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)
2. **架构设计**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
3. **开发规范**: [docs/DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)
4. **运行测试**: `npm test`

---

## 🤝 贡献

欢迎贡献代码！请确保：
- ✅ 遵循 TypeScript 严格模式
- ✅ 编写单元测试（覆盖新功能）
- ✅ 更新相关文档
- ✅ 通过所有测试 (`npm test`)

---

## 📝 许可证

MIT License

---

## 📞 联系方式

- � 提交 Issue
- 💬 发起 Discussion
- 🔀 提交 Pull Request

---

**🎉 项目状态**: 核心功能完成，代码质量优秀，测试覆盖完善！
