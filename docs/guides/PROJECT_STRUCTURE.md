# 📁 WorkfineSheet 项目结构说明

## 项目目录结构

```
WorkfineSheet/
├── .backup/                    # 备份文件（不提交到版本控制）
│   └── CanvasSheet.vue.bak
├── .git/                       # Git 版本控制
├── coverage/                   # 测试覆盖率报告（自动生成）
├── dist/                       # 生产构建输出（自动生成）
├── docs/                       # 📚 项目文档
│   ├── ARCHITECTURE.md         # 架构设计文档
│   ├── API_REFERENCE.md        # API 参考文档
│   ├── COMPLETION_REPORT.md    # 完成报告
│   ├── TEST_SUMMARY.md         # 测试总结
│   ├── DEVELOPER_GUIDE.md      # 开发者指南
│   ├── FORMULA_*.md            # 公式相关文档
│   ├── PHASE*.md               # 各阶段文档
│   └── ...                     # 其他文档
├── node_modules/               # 依赖包（自动生成）
├── public/                     # 静态资源
├── src/                        # 📦 源代码
│   ├── api/                    # API 相关
│   ├── assets/                 # 静态资源（图片、样式等）
│   ├── components/             # Vue 组件
│   │   ├── sheet/              # Sheet 模块
│   │   │   ├── tests/          # ✅ 单元测试
│   │   │   │   ├── clipboard.spec.ts
│   │   │   │   ├── events.spec.ts
│   │   │   │   ├── geometry.spec.ts
│   │   │   │   └── references.spec.ts
│   │   │   ├── api.ts          # 公共 API
│   │   │   ├── clipboard.ts    # 剪贴板模块
│   │   │   ├── events.ts       # 事件管理模块
│   │   │   ├── geometry.ts     # 几何计算模块
│   │   │   ├── overlay.ts      # 覆盖层模块
│   │   │   ├── references.ts   # 公式引用模块
│   │   │   ├── renderCells.ts  # 单元格渲染
│   │   │   ├── renderCore.ts   # 渲染核心
│   │   │   ├── renderGrid.ts   # 网格渲染
│   │   │   ├── rowcol.ts       # 行列操作
│   │   │   ├── scrollbar.ts    # 滚动条模块
│   │   │   ├── selection.ts    # 选择模块
│   │   │   ├── types.ts        # 类型定义
│   │   │   └── uiMenus.ts      # UI 菜单模块
│   │   ├── CanvasSheet.vue     # 主组件
│   │   ├── ContextMenu.vue     # 上下文菜单
│   │   ├── InputDialog.vue     # 输入对话框
│   │   └── SheetOverlayInput.vue # 覆盖层输入
│   ├── lib/                    # 核心库
│   │   ├── FormulaEngine.ts    # 公式引擎
│   │   ├── FormulaSheet.ts     # 公式表格
│   │   ├── SheetModel.ts       # 数据模型
│   │   └── UndoRedoManager.ts  # 撤销重做
│   ├── types/                  # 类型定义
│   │   └── hot-formula-parser.d.ts
│   ├── App.vue                 # 根组件
│   ├── main.ts                 # 入口文件
│   ├── style.css               # 全局样式
│   └── env.d.ts                # 环境类型定义
├── tests/                      # 🧪 测试文件
│   ├── e2e/                    # E2E 测试（预留）
│   └── manual/                 # 手动测试 HTML
│       ├── async-test.html
│       ├── performance-test.html
│       ├── test-absolute-reference.html
│       ├── test-copy-paste-final.html
│       ├── test-copy-paste.html
│       ├── test-formula.js
│       ├── test-insert-complete.html
│       └── test-insert-row-bug.html
├── .gitignore                  # Git 忽略配置
├── index.html                  # HTML 入口
├── package.json                # 项目配置
├── package-lock.json           # 依赖锁定
├── README.md                   # 项目说明
├── refactor-progress.md        # 重构进度
├── tsconfig.json               # TypeScript 主配置
├── tsconfig.app.json           # 应用 TS 配置
├── tsconfig.node.json          # Node TS 配置
├── vite.config.ts              # Vite 构建配置
└── vitest.config.ts            # Vitest 测试配置
```

## 目录说明

### 📚 `/docs` - 文档目录
**用途**: 存放所有项目文档

**内容**:
- 架构设计文档
- API 参考
- 开发指南
- 测试报告
- 各阶段完成文档

**规范**:
- 使用 Markdown 格式
- 文件名使用 UPPER_SNAKE_CASE
- 保持文档更新同步

### 📦 `/src` - 源代码目录
**用途**: 存放所有源代码

**子目录**:
- `api/` - API 相关代码
- `assets/` - 静态资源（图片、字体等）
- `components/` - Vue 组件
- `lib/` - 核心库和工具
- `types/` - TypeScript 类型定义

### 🔧 `/src/components/sheet` - Sheet 模块
**用途**: 电子表格核心功能模块

**特点**:
- 模块化设计
- 单一职责
- 纯函数优先
- 完整类型定义

**测试**: 每个模块都有对应的单元测试在 `tests/` 目录

### 🧪 `/tests` - 测试目录
**用途**: 存放各种测试文件

**子目录**:
- `e2e/` - 端到端测试（预留）
- `manual/` - 手动测试 HTML 文件

**单元测试**: 位于 `src/components/sheet/tests/`

### 🏗️ 配置文件

#### TypeScript 配置
- `tsconfig.json` - 主配置（引用其他配置）
- `tsconfig.app.json` - 应用代码配置（target: ES2019）
- `tsconfig.node.json` - Node 工具配置

#### 构建配置
- `vite.config.ts` - Vite 构建配置
- `vitest.config.ts` - 测试框架配置

#### 项目配置
- `package.json` - NPM 包配置和脚本
- `.gitignore` - Git 忽略规则

## 文件命名规范

### 组件文件
- **Vue 组件**: PascalCase - `CanvasSheet.vue`
- **TypeScript 模块**: camelCase - `geometry.ts`
- **测试文件**: `*.spec.ts` - `geometry.spec.ts`

### 文档文件
- **Markdown 文档**: UPPER_SNAKE_CASE - `ARCHITECTURE.md`
- **特殊文档**: lowercase - `refactor-progress.md`

### 目录命名
- 小写字母，连字符分隔 - `sheet/`, `manual/`
- 保持简短和描述性

## 导入路径规范

### 相对导入
```typescript
// 同目录模块
import { parseCellAddr } from './references'

// 同级目录
import type { SizeAccess } from './types'

// 父级组件
import CanvasSheet from '../CanvasSheet.vue'
```

### 绝对导入
```typescript
// 从 src 根目录
import { FormulaSheet } from '@/lib/FormulaSheet'
import type { Cell } from '@/lib/SheetModel'
```

## 模块组织原则

### 1. 单一职责
每个模块只负责一个功能领域：
- `geometry.ts` - 几何计算
- `clipboard.ts` - 剪贴板操作
- `events.ts` - 事件管理

### 2. 依赖注入
通过配置对象传递依赖，避免全局状态：
```typescript
function drawGrid(ctx: CanvasRenderingContext2D, cfg: GridConfig) {
  // ...
}
```

### 3. 类型优先
所有公共接口都有完整的类型定义：
```typescript
export interface SizeAccess {
  rowHeights: Map<number, number>
  colWidths: Map<number, number>
  hiddenRows?: Set<number>
  hiddenCols?: Set<number>
}
```

### 4. 测试友好
纯函数设计，易于单元测试：
```typescript
// ✅ 易于测试
export function getRowHeight(row: number, sizes: SizeAccess, cfg: GeometryConfig): number {
  return sizes.hiddenRows?.has(row) ? 0 : sizes.rowHeights.get(row) ?? cfg.defaultRowHeight
}
```

## 构建产物

### `/dist` - 生产构建
```
dist/
├── index.html          # 入口 HTML
├── assets/
│   ├── index-*.css     # 样式
│   └── index-*.js      # JavaScript
└── ...
```

### `/coverage` - 测试覆盖率
```
coverage/
├── index.html          # 覆盖率报告
├── lcov-report/        # LCOV 报告
└── coverage-final.json # 覆盖率数据
```

## Git 版本控制

### 忽略的文件/目录
- `node_modules/` - 依赖包
- `dist/` - 构建产物
- `coverage/` - 测试报告
- `.backup/` - 备份文件
- `*.bak` - 备份文件
- `.DS_Store` - macOS 系统文件

### 提交规范
```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
test: 测试相关
refactor: 重构代码
style: 代码格式
chore: 构建/工具变更
```

## 开发工作流

### 1. 开发新功能
```bash
# 1. 创建新模块
src/components/sheet/newFeature.ts

# 2. 添加类型定义
src/components/sheet/types.ts

# 3. 编写单元测试
src/components/sheet/tests/newFeature.spec.ts

# 4. 运行测试
npm test

# 5. 更新文档
docs/ARCHITECTURE.md
```

### 2. 运行测试
```bash
# 运行所有测试
npm test

# 监视模式
npm test -- --watch

# 覆盖率报告
npm run test:coverage

# 测试 UI
npm run test:ui
```

### 3. 构建项目
```bash
# 开发模式
npm run dev

# 生产构建
npm run build

# 预览构建
npm run preview
```

## 维护建议

### 定期任务
1. **每周**:
   - 运行完整测试套件
   - 检查测试覆盖率
   - 更新文档

2. **每月**:
   - 审查依赖更新
   - 清理废弃代码
   - 优化性能

3. **每季度**:
   - 架构审查
   - 重构规划
   - 技术债务清理

### 代码审查检查项
- ✅ TypeScript 类型完整
- ✅ 单元测试覆盖
- ✅ 文档同步更新
- ✅ 命名规范遵守
- ✅ 无 console.log
- ✅ 无硬编码
- ✅ 错误处理完善

## 常见问题

### Q: 为什么测试文件在 `src/components/sheet/tests/` 而不是单独的 `tests/` 目录？
A: 单元测试和被测试的模块放在一起，便于维护和查找。`tests/` 目录主要用于 E2E 和手动测试。

### Q: 如何添加新的测试？
A: 在 `src/components/sheet/tests/` 创建 `*.spec.ts` 文件，Vitest 会自动发现并运行。

### Q: 备份文件应该提交吗？
A: 不应该。`.backup/` 和 `*.bak` 已经在 `.gitignore` 中排除。

### Q: 如何查看项目结构？
A: 使用 `tree` 命令（macOS: `brew install tree`）：
```bash
tree -L 3 -I 'node_modules|dist|coverage'
```

## 相关文档

- 📖 [架构设计](./ARCHITECTURE.md)
- 🧪 [测试总结](./TEST_SUMMARY.md)
- ✅ [完成报告](./COMPLETION_REPORT.md)
- 📚 [API 参考](./API_REFERENCE.md)
- 📝 [开发指南](./DEVELOPER_GUIDE.md)

---

**最后更新**: 2025-11-26  
**维护者**: WorkfineSheet Team
