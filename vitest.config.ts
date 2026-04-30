import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'cms/**']
  },
  resolve: {
    alias: {
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@': path.resolve(__dirname, 'src')
    }
  }
})
