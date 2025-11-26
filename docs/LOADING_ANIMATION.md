# 动态加载动画实现说明

## 概述

将公式计算时的静态 "⏳" 图标改为动态的 "..."、".."、"."、"" 循环动画，提供更好的视觉反馈。

## 实现细节

### 1. 动画状态管理

在 `FormulaSheet` 类中添加：

```typescript
private loadingAnimationFrame = 0
private loadingAnimationTimer: number | null = null
```

### 2. 动画控制方法

**启动动画** - 当有计算任务时自动启动：
```typescript
private startLoadingAnimation(): void {
  if (this.loadingAnimationTimer !== null) return
  
  this.loadingAnimationTimer = window.setInterval(() => {
    this.loadingAnimationFrame = (this.loadingAnimationFrame + 1) % 4
    // 触发UI重绘
  }, 500) // 每500ms更新一次
}
```

**停止动画** - 当所有任务完成时自动停止：
```typescript
private stopLoadingAnimation(): void {
  if (this.loadingAnimationTimer !== null) {
    clearInterval(this.loadingAnimationTimer)
    this.loadingAnimationTimer = null
    this.loadingAnimationFrame = 0
  }
}
```

**获取动态文本**：
```typescript
getLoadingText(): string {
  // 使用旋转的加载图标
  const spinners = ['◐', '◓', '◑', '◒']
  return spinners[this.loadingAnimationFrame % spinners.length] || '◐'
}
```

### 3. 动画效果

动画会在以下 4 个状态之间循环（每 150ms 切换一次）：

| 帧数 | 显示内容 | 说明 |
|-----|---------|------|
| 0   | `◐`     | 左半圆 |
| 1   | `◓`     | 下半圆 |
| 2   | `◑`     | 右半圆 |
| 3   | `◒`     | 上半圆 |

形成流畅的**顺时针旋转效果**，类似现代加载动画。

### 4. 自动触发机制

动画会在以下情况自动启动/停止：

```typescript
this.calculationQueue.onProgress((stats) => {
  // 如果有任务在处理，启动动画
  if (stats.pending > 0 || stats.processing > 0) {
    this.startLoadingAnimation()
  } else {
    // 所有任务完成，停止动画
    this.stopLoadingAnimation()
  }
})
```

### 5. UI 集成

在 `getValue()` 方法中使用动态文本：

```typescript
getValue(row: number, col: number): any {
  // ...
  
  // 如果正在计算，返回动态加载文本
  if (state && (state.state === 'pending' || state.state === 'calculating')) {
    return this.getLoadingText() // 动态 "...", "..", ".", ""
  }
  
  // 启动异步计算
  if (this.enableAsync) {
    this.getValueAsync(row, col, 'normal')
    return this.getLoadingText() // 动态文本
  }
}
```

## 用户体验改进

### 改进前
- 静态显示 "⏳"
- 无法判断是否真在计算
- 视觉上显得"卡住"

### 改进后
- 动态旋转的圆形图标 "◐◓◑◒"
- 明确表明正在计算
- 视觉上更加流畅
- 类似现代 App 的加载效果（如 macOS 的旋转加载）

## 性能影响

- **CPU 开销**：极小（每 150ms 一次定时器）
- **内存开销**：忽略不计（只有 2 个变量）
- **UI 重绘**：仅当有计算任务时才触发
- **总体影响**：几乎为零

## 测试建议

1. 打开开发环境：`npm run dev`
2. 输入大量公式（如复制粘贴 100 个公式）
3. 观察单元格中的旋转圆形 "◐◓◑◒" 动画效果
4. 验证计算完成后动画自动停止

## 配置选项

如需调整动画速度，修改定时器间隔：

```typescript
this.loadingAnimationTimer = window.setInterval(() => {
  // ...
}, 150) // 修改这个值（毫秒）
```

- 更快动画：`100ms`（更快旋转）
- 更慢动画：`300ms`（更慢旋转）
- 推荐值：`150ms`（流畅且不刺眼）

## 扩展可能性

未来可以考虑：

1. **自定义动画样式**：允许用户选择不同的加载动画
2. **进度百分比**：显示 "计算中 25%"
3. **彩色动画**：使用不同颜色表示不同优先级
4. **旋转图标**：使用 CSS 动画实现旋转效果

## 兼容性

- ✅ 所有现代浏览器
- ✅ 不依赖外部库
- ✅ 向后兼容（同步模式仍然工作）
- ✅ 不影响现有功能
