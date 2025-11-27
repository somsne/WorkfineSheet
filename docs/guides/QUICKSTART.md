# 快速开始指南

## 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0

## 安装依赖

```bash
cd /Users/chenliang/Desktop/WorkSpace/WorkfineSuite/WorkfineSheet
npm install
```

## 开发模式

使用正确的 Node.js 版本：

```bash
nvm use 20.19.0
npm run dev
```

访问：http://localhost:5174

## 生产构建

```bash
npm run build
```

## 项目结构

```
WorkfineSheet/
├── src/
│   ├── components/
│   │   ├── CanvasSheet.vue      # 主电子表格组件
│   │   └── SheetOverlayInput.vue # 编辑输入框
│   ├── lib/
│   │   ├── SheetModel.ts        # 数据模型
│   │   └── UndoRedoManager.ts   # 撤销重做
│   ├── App.vue
│   ├── main.ts
│   └── env.d.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## 核心概念

### Canvas Sheet 组件
主要的电子表格实现，包含：
- 双层 Canvas 渲染（表头和内容）
- 虚拟化滚动
- 单元格选择和编辑
- 剪贴板操作
- 撤销/重做

### Sheet Model
数据层，使用稀疏 Map 存储单元格值

### Undo/Redo Manager
操作历史管理，支持任意操作的记录和恢复

## 使用示例

### 基本导航
```
使用箭头键上下左右移动
Shift + 箭头键 快速移动（5 步）
Enter 向下移动
Tab 向右移动
```

### 编辑单元格
```
双击或直接输入任何字符以开始编辑
Enter 保存
Escape 取消
```

### 撤销/重做
```
Ctrl+Z / Cmd+Z 撤销
Ctrl+Y / Cmd+Y 重做
```

### 剪贴板
```
Ctrl+C / Cmd+C 复制
Ctrl+V / Cmd+V 粘贴
```

## 常见问题

### Q: 如何切换 Node.js 版本？
```bash
nvm use 20.19.0
```

### Q: 如何查看所有快捷键？
参考 `FEATURES.md` 中的快捷键速查表

### Q: 撤销/重做有什么限制？
默认记录最多 100 个操作，可在初始化时调整：
```typescript
const undoRedo = new UndoRedoManager(200) // 增加到 200 条
```

### Q: 如何修改表格大小？
编辑 `CanvasSheet.vue` 中的常量：
```typescript
const DEFAULT_ROWS = 1000  // 修改行数
const DEFAULT_COLS = 50     // 修改列数
```

### Q: 性能如何？
- 虚拟化渲染，仅显示可见单元格
- 稀疏数据存储，只占用非空单元格的内存
- 支持 1000+ 行的实时滚动

## 调试技巧

### 启用开发者工具
按 F12 打开浏览器开发者工具

### 查看性能
- Performance 标签：查看帧率和渲染时间
- Network 标签：检查资源加载
- Console 标签：查看错误和警告

### 修改示例数据
编辑 `CanvasSheet.vue` 中的初始化代码：
```typescript
model.setValue(0, 0, 'Header 1')
model.setValue(1, 0, 'Data 1')
```

## 贡献指南

1. 修改代码时保持 TypeScript 严格模式
2. 运行 `npm run build` 验证没有编译错误
3. 测试新功能的撤销/重做
4. 更新 `FEATURES.md` 文档

## 许可证

MIT
