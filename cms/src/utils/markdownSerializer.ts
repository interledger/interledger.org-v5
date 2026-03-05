/**
 * Shared markdown serialization helpers for MDX AST children.
 */

import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx'
import { toMarkdown } from 'mdast-util-to-markdown'

const MDX_JSX_MARKDOWN_EXTENSIONS = [mdxJsxToMarkdown()]

/**
 * Serialize JSX children to markdown.
 *
 * mdxJsxToMarkdown is required because remark-mdx parses inline HTML tags
 * like <em> and <strong> as mdxJsxTextElement nodes, which base toMarkdown
 * cannot serialize on its own.
 */
export function serializeChildrenToMarkdown(children: unknown[]): string {
  if (!children.length) return ''

  return toMarkdown({ type: 'root', children } as any, {
    extensions: MDX_JSX_MARKDOWN_EXTENSIONS
  }).trim()
}
