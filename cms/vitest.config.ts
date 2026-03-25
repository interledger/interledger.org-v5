import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**']
  },
  resolve: {
    alias: {
      '@site': path.resolve(__dirname, '../src'),
      '@': path.resolve(__dirname, 'src')
    }
  }
})
