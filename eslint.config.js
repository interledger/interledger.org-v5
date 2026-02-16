import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import eslintPluginAstro from 'eslint-plugin-astro'

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginAstro.configs.recommended,
  globalIgnores([
    '**/dist/**',
    '.astro',
    'node_modules',
    'public',
    '**/*.min.js',
    'cms/strapi-server.js',
    'cms/copy-schemas.js',
    'cms/src/admin/app.tsx',
    'cms/src/index.ts',
    'src/pages/financial-services.astro'
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-console': 'error'
    }
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ]
    }
  },
  {
    files: ['**/*.astro'],
    rules: {
      'astro/no-set-text-directive': 'error'
    }
  },
  {
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },
  eslintConfigPrettier
])
