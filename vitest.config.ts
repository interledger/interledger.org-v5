import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'cms/**'],
    coverage: {
      // Vitest only reports files a test imported unless `include` is explicit.
      // Listing all of src/ keeps untested modules visible in the report rather
      // than silently inflating the percentage.
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/*.types.ts',
        // Type-only modules: no runtime to cover.
        'src/types/**',
        // Generated output and test fixtures aren't ours to test.
        'src/generated/**',
        'src/data/roadmap/fixture.ts',
        // Declarative Astro collection config, exercised by the build not by tests.
        'src/content.config.ts'
      ],
      reporter: ['text', 'html', 'json-summary'],
      // Raise these as coverage improves: `pnpm test:coverage
      // --coverage.thresholds.autoUpdate` rewrites them in place. Run it locally
      // only — in CI it produces a config diff nothing can commit.
      thresholds: {
        statements: 33,
        branches: 35,
        functions: 32,
        lines: 33,
        // Already at ~95%. A glob threshold is an additional check, not a
        // carve-out from the global one, so this only ever tightens.
        'src/utils/shared/**': { statements: 90 }
      }
    }
  },
  resolve: {
    alias: {
      '@/utils': path.resolve(__dirname, 'src/utils'),
      '@': path.resolve(__dirname, 'src')
    }
  }
})
