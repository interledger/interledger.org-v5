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
