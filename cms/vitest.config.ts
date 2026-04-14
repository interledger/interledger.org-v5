import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**']
  },
  resolve: {
    alias: {
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@': path.resolve(__dirname, 'src'),
      '@site': path.resolve(__dirname, '../src')
    }
  }
})
