import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      // Vitest only reports files a test imported unless `include` is explicit.
      // Scoped to the code we actually author: the MDX sync pipeline, the block
      // serializers, the shared utils, and the content-type lifecycle hooks.
      include: [
        'scripts/**/*.ts',
        'src/serializers/**/*.ts',
        'src/utils/**/*.ts',
        'src/index.ts',
        'src/api/**/lifecycles.ts'
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/*.types.ts',
        // One-time migrations, already run against production content.
        'scripts/migrate-*.ts'
      ],
      reporter: ['text', 'html', 'json-summary'],
      // Raise these as coverage improves — `--coverage.thresholds.autoUpdate`
      // rewrites them in place. Run it locally only; in CI it produces a config
      // diff nothing can commit.
      thresholds: {
        statements: 54,
        branches: 57,
        functions: 57,
        lines: 55
      }
    }
  },
  resolve: {
    alias: {
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@': path.resolve(__dirname, 'src'),
      '@site': path.resolve(__dirname, '../src')
    }
  }
})
