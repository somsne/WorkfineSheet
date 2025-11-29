import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readdirSync } from 'fs'

// 获取 tests 目录下所有 HTML 文件作为多页面入口
function getTestPages() {
  const testsDir = resolve(__dirname, 'tests')
  const entries: Record<string, string> = {}
  
  try {
    const files = readdirSync(testsDir)
    files.forEach(file => {
      if (file.endsWith('.html')) {
        const name = file.replace('.html', '')
        entries[`tests/${name}`] = resolve(testsDir, file)
      }
    })
  } catch {
    // tests 目录不存在时忽略
  }
  
  return entries
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? '/WorkfineSheet/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...getTestPages()
      }
    }
  }
})
