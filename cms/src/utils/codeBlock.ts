/**
 * Languages the CodeBlock component supports. Single source of truth for both
 * the MDX import parser (`scripts/sync-mdx/codeBlockHandler.ts`) and the Strapi
 * component schema (`src/components/blocks/code-block.json`).
 *
 * The Strapi schema is JSON and can't import this, so `codeBlock.test.ts`
 * asserts its `language` enum stays in sync with this list.
 */
export const CODE_BLOCK_LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'html',
  'css',
  'bash',
  'json',
  'yaml',
  'python',
  'rust',
  'go',
  'sql',
  'markdown',
  'php',
  'java',
  'ini',
  'graphql',
  'http',
  'nginx',
  'xml',
  'webidl',
  'text'
] as const

export type CodeBlockLanguage = (typeof CODE_BLOCK_LANGUAGES)[number]
