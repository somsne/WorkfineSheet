# GitHub Actions CI/CD 配置说明

## 📋 Workflow 功能

已创建的 GitHub Actions workflow (`.github/workflows/ci.yml`) 包含以下功能：

### 1. 🧪 单元测试 (test)
- **触发时机**: 推送到 main/develop 分支或创建 PR
- **测试环境**: Node.js 18.x 和 20.x（矩阵测试）
- **执行内容**:
  - 运行所有单元测试 (`npm test`)
  - 生成测试覆盖率报告 (`npm run test:coverage`)
  - 上传覆盖率到 Codecov（可选）

### 2. 🏗️ 构建测试 (build)
- **依赖**: 单元测试通过后执行
- **执行内容**:
  - TypeScript 类型检查 (`vue-tsc --noEmit`)
  - 生产环境构建 (`npm run build`)
  - 验证构建产物（检查 dist 目录）
  - 上传构建产物为 artifact（保留 7 天）

### 3. 📝 代码检查 (lint)
- **执行内容**:
  - ESLint 代码规范检查
  - 不阻塞 CI 流程（continue-on-error）

### 4. 📊 测试总结 (summary)
- **执行时机**: 所有任务完成后
- **功能**: 生成可视化的测试报告摘要

## 🚀 使用方法

### 1. 提交代码触发 CI
```bash
# 添加文件
git add .

# 提交（会自动触发 CI）
git commit -m "feat: 添加新功能"

# 推送到 GitHub
git push origin main
```

### 2. 查看 CI 结果
1. 访问 GitHub 仓库页面
2. 点击 **Actions** 标签
3. 查看最新的 workflow 运行结果
4. 点击具体的 workflow 查看详细日志

### 3. PR 自动测试
- 创建 Pull Request 时会自动触发 CI
- PR 页面会显示测试状态
- 只有 CI 通过才建议合并

## ⚙️ 自定义配置

### 修改触发分支
编辑 `.github/workflows/ci.yml`:
```yaml
on:
  push:
    branches: [ main, develop, feature/* ]  # 添加更多分支
```

### 修改 Node.js 版本
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # 添加或删除版本
```

### 禁用某个任务
注释掉不需要的 job:
```yaml
# lint:  # 暂时禁用代码检查
#   name: 代码检查
#   runs-on: ubuntu-latest
#   steps: ...
```

## 📊 状态徽章

在 README.md 中添加 CI 状态徽章：

```markdown
![CI Status](https://github.com/somsne/WorkfineSheet/actions/workflows/ci.yml/badge.svg)
```

## 🔧 故障排查

### 测试失败
1. 检查本地测试是否通过：`npm test`
2. 查看 GitHub Actions 日志中的错误信息
3. 确保所有依赖已正确安装

### 构建失败
1. 本地测试构建：`npm run build`
2. 检查 TypeScript 类型错误：`npx vue-tsc --noEmit`
3. 确认 package.json 中的脚本配置正确

### 依赖安装失败
- 确保 package-lock.json 已提交到仓库
- 检查是否有网络问题导致的依赖下载失败

## 📈 高级功能（可选）

### 1. 添加缓存加速
已默认启用 npm 缓存：
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'  # 自动缓存 node_modules
```

### 2. 集成 Codecov
如需要覆盖率报告：
1. 访问 https://codecov.io/
2. 使用 GitHub 账号登录
3. 添加仓库
4. workflow 会自动上传覆盖率

### 3. 自动部署
添加部署 job（构建成功后）：
```yaml
deploy:
  name: 部署到 GitHub Pages
  runs-on: ubuntu-latest
  needs: build
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm run build
    - uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

## 🎯 最佳实践

1. **频繁提交**: 每次小的改动都提交，让 CI 尽早发现问题
2. **本地测试**: 推送前先在本地运行 `npm test` 和 `npm run build`
3. **分支策略**: 使用 feature 分支开发，通过 PR 合并到 main
4. **修复失败**: CI 失败时优先修复，不要累积问题

## 📝 相关文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Vitest 文档](https://vitest.dev/)
- [Vite 文档](https://vitejs.dev/)

---

**创建日期**: 2025-11-26  
**维护者**: 根据项目需求更新配置
