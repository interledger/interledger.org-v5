/**
 * MDX AST serialization utilities shared across block handlers.
 */

import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'
import type { Root, RootContent } from 'mdast'

/**
 * Serialize mdast children to a trimmed markdown string.
 *
 * Uses consistent options across all handlers:
 * - `mdxJsxToMarkdown` extension so inline HTML tags (e.g. `<em>`, `<strong>`)
 *   parsed by remark-mdx are handled correctly
 * - `bullet: '-'` so unordered lists always use `-` markers
 */
export function childrenToMarkdown(children: RootContent[]): string {
  return toMarkdown({ type: 'root', children } as Root, {
    extensions: [mdxJsxToMarkdown()],
    bullet: '-'
  }).trim()
}

/** Minimal source-text context a handler needs to prefer raw slicing. */
export interface SourceTextContext {
  sourceText?: string
  sourceTextWasProvided?: boolean
}

/**
 * Extract markdown content from JSX children, preferring a raw source slice
 * over AST re-serialization. `childrenToMarkdown` escapes anything that
 * merely looks like markdown syntax (e.g. a literal `[^1]` becomes `\[^1]`),
 * so slicing the source bytes avoids corrupting text that was never
 * ambiguous. Falls back to `childrenToMarkdown` when no source text is
 * available (e.g. tests that omit it).
 */
export function extractChildrenContent(
  children: RootContent[] | undefined,
  ctx: SourceTextContext
): string | undefined {
  if (!children || children.length === 0) return undefined

  if (ctx.sourceText && ctx.sourceTextWasProvided !== false) {
    const first = children[0]
    const last = children[children.length - 1]
    if (
      first.position?.start.offset != null &&
      last.position?.end.offset != null
    ) {
      const raw = ctx.sourceText
        .slice(first.position.start.offset, last.position.end.offset)
        .trim()
      if (raw) return raw
    }
  }

  return childrenToMarkdown(children)
}
