import { escDouble as esc } from '../shared'

interface CodeBlockBlock {
  code: string
  language: string
  title?: string
}

export function serialize(block: CodeBlockBlock): string {
  if (!block.code) throw new Error('CodeBlock block is missing code')
  if (!block.language) throw new Error('CodeBlock block is missing language')

  // Escape for use inside a JS template literal: backslashes first,
  // then backticks, then template-expression openers.
  const safeCode = block.code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')

  const attrs = [`language="${esc(block.language)}"`]
  if (block.title) attrs.push(`title="${esc(block.title)}"`)

  return `<CodeBlock ${attrs.join(' ')} code={\`${safeCode}\`} />`
}
