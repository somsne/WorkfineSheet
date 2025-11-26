# WorkfineSheet - Canvas 电子表格

一个使用 Vue 3、TypeScript 和 Canvas 2D 构建的高性能网页电子表格组件。

## 特性

✅ **高性能渲染**
- 双层 Canvas 架构
- 虚拟化滚动，仅渲染可见单元格
- 支持 1000+ 行 x 50+ 列

✅ **完整的键盘导航**
- 方向键移动
- Tab/Enter 快速导航
- Shift 快速跳跃

✅ **编辑功能**
- 双击或直接输入编辑单元格
- 支持 HTML 输入框
- Enter 确认，Escape 取消

✅ **撤销/重做** ⭐ NEW
- Ctrl+Z / Cmd+Z 撤销
- Ctrl+Y / Cmd+Y 重做
- 支持最多 100 条历史记录

✅ **剪贴板操作**
- Ctrl+C / Cmd+C 复制
- Ctrl+V / Cmd+V 粘贴
- 支持 CSV 格式

✅ **响应式设计**
- 自适应容器大小
- 鼠标滚轮支持
- 完整的视觉反馈

## 快速开始

### 1. 安装依赖
```bash
cd WorkfineSheet
npm install
```

### 2. 启动开发服务器
```bash
nvm use 20.19.0
npm run dev
```

### 3. 打开浏览器
```
http://localhost:5174
```

## 项目结构

```
WorkfineSheet/
├── src/
│   ├── components/
│   │   ├── CanvasSheet.vue          # 主电子表格（718 行）
│   │   └── SheetOverlayInput.vue    # 编辑框（150 行）
│   ├── lib/
│   │   ├── SheetModel.ts            # 数据模型
│   │   └── UndoRedoManager.ts       # 撤销重做 ⭐ NEW
│   ├── App.vue                      # 应用入口
│   ├── main.ts                      # 主文件
│   └── env.d.ts                     # 类型定义
├── vite.config.ts                   # Vite 配置
├── tsconfig.json                    # TypeScript 配置
├── package.json                     # 依赖配置
├── FEATURES.md                      # 功能文档 ⭐ NEW
├── QUICKSTART.md                    # 快速开始 ⭐ NEW
└── README.md                        # 本文件
```

## 核心技术

- **Vue 3** - 渐进式框架
- **TypeScript** - 类型安全
- **Canvas 2D** - 高性能渲染
- **Vite** - 现代构建工具

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| ↑↓←→ | 移动单元格 |
| Shift+↑↓←→ | 快速移动 |
| Enter | 向下移动 |
| Tab | 向右移动 |
| 双击 | 编辑模式 |
| Escape | 取消编辑 |
| Ctrl+C | 复制 |
| Ctrl+V | 粘贴 |
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |

## 文件说明

### src/components/CanvasSheet.vue (718 行)
主要的电子表格组件，包含：
- 双层 Canvas 渲染（表头 + 内容）
- 虚拟化滚动和选择逻辑
- 键盘和鼠标事件处理
- 剪贴板操作
- 撤销/重做集成

**最近更新（2025-11-25）：**
- ✅ 清理了 DEBUG_IME 调试代码
- ✅ 移除了未使用的 IME 相关函数
- ✅ 集成了 UndoRedoManager
- ✅ 添加了撤销/重做快捷键

### src/components/SheetOverlayInput.vue (150 行)
编辑框组件，提供：
- 绝对定位的 HTML input 元素
- IME 组合事件处理
- 字符预缓冲机制
- 焦点和光标管理

### src/lib/SheetModel.ts
数据模型：
- 稀疏 Map 存储（只存储非空单元格）
- getValue(row, col) 获取单元格值
- setValue(row, col, value) 设置单元格值
- forEach(callback) 遍历所有单元格

### src/lib/UndoRedoManager.ts ⭐ NEW (120 行)
撤销/重做管理器：
- execute(action) 执行并记录操作
- undo() 撤销
- redo() 重做
- canUndo() / canRedo() 检查是否可操作
- 可配置的历史记录大小

## 架构设计

### 渲染架构
```
SheetContainer
├── gridCanvas (z-index: 10)
│   └── 行号和列字母表头
├── contentCanvas (z-index: 20)
│   ├── 网格线
│   ├── 单元格内容
│   └── 选择高亮
└── SheetOverlayInput
    └── 编辑框（绝对定位）
```

### 数据流
```
用户操作
    ↓
onKeyDown / onMouseDown
    ↓
更新 selected / selectionRange
    ↓
执行 draw()
    ↓
Canvas 重新渲染
    ↓
（如果有编辑）undoRedo.execute()
```

### 撤销/重做流程
```
用户编辑单元格
    ↓
onOverlaySave()
    ↓
检查值是否改变
    ↓
undoRedo.execute({
  undo: () => model.setValue(oldValue),
  redo: () => model.setValue(newValue)
})
    ↓
值被立即写入（redo 自动执行）
    ↓
Ctrl+Z → 调用 undo()
Ctrl+Y → 调用 redo()
```

## 性能优化

1. **虚拟化渲染**
   - getVisibleRange() 计算可见范围
   - 只渲染可见单元格
   - Canvas 请求动画帧同步

2. **稀疏数据结构**
   - Map 存储而非 2D 数组
   - 减少内存占用
   - O(1) 查询时间

3. **自动清理**
   - 绘制时清除 Canvas
   - 及时释放资源
   - 无内存泄漏

## 已知限制

1. **IME 支持** - 中文输入需要改进
2. **单元格样式** - 尚未支持格式化
3. **公式** - hot-formula-parser 已安装但未集成
4. **冻结窗格** - 尚未实现
5. **行列宽度调整** - 尚未实现

## 开发指南

### 修改常量
编辑 `CanvasSheet.vue` 顶部的常量：
```typescript
const ROW_HEIGHT = 26
const COL_WIDTH = 100
const ROW_HEADER_WIDTH = 40
const COL_HEADER_HEIGHT = 26
const DEFAULT_ROWS = 1000
const DEFAULT_COLS = 50
```

### 添加初始数据
在 model 初始化后添加：
```typescript
model.setValue(0, 0, 'Header')
model.setValue(1, 0, 'Data')
```

### 自定义快捷键
在 `onKeyDown()` 中添加新的条件分支

### 扩展 UndoRedoManager
使用 execute() 方法记录任何操作：
```typescript
undoRedo.execute({
  name: '操作名称',
  undo: () => { /* 恢复逻辑 */ },
  redo: () => { /* 执行逻辑 */ }
})
```

## 构建与部署

### 开发构建
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

构建输出在 `dist/` 目录

### 预览
```bash
npm run preview
```

## 许可证

MIT

## 更新日志

### 2025-11-25
- ✅ 清理 DEBUG_IME 调试代码
- ✅ 删除未使用的 IME 函数
- ✅ 实现 UndoRedoManager 类
- ✅ 集成撤销/重做功能
- ✅ 添加文档 (FEATURES.md, QUICKSTART.md)

### 2025-11-24
- ✅ 修复 A 列和第一行头部显示
- ✅ 改进 Enter/Tab 导航
- ✅ 实现鼠标拖动选择
- ✅ 添加自动滚动功能
- ✅ 改进输入框焦点管理

### 2025-11-23
- ✅ 初始项目设置
- ✅ Canvas 双层架构
- ✅ 基础渲染和选择
- ✅ 键盘导航
- ✅ 剪贴板操作

## 联系方式

如有问题或建议，请提交 Issue 或 PR。

---

**最后更新**: 2025-11-25
**版本**: 0.0.1-dev
**状态**: 🟢 开发中
