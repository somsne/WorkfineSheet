import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}', 'src/**/tests/**/*.{test,spec}.{js,ts}'],
    // 使用 forks 池替代默认的 threads，避免线程残留问题
    pool: 'forks',
    // 测试完成后立即退出，不等待
    teardownTimeout: 1000,
    // 隔离测试文件，避免内存泄漏累积
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
    },
  },
})
