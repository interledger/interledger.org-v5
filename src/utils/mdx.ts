/**
 * Shared markdown/MDX utilities for Astro components
 */

import { marked } from 'marked'

/** Renders a full markdown string to HTML (block-level) */
export async function parseMarkdown(
  text: string | null | undefined
): Promise<string> {
  if (!text) return ''
  return marked.parse(text)
}

/** Renders an inline markdown string to HTML (no block wrapping) */
export function parseMarkdownInline(text: string | null | undefined): string {
  if (!text) return ''
  return marked.parseInline(text) as string
}
