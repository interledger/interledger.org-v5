import { createMarked, type UmamiContext } from './umami'
import { getTableScrollAriaLabel } from './getTableScrollAriaLabel'
import { wrapScrollableTables } from './wrapScrollableTables'

export async function parseMarkdown(
  text: string | null | undefined,
  context: UmamiContext = {}
): Promise<string> {
  if (!text) return ''
  const html = await createMarked(context).parse(text)
  return wrapScrollableTables(html, getTableScrollAriaLabel(context.lang))
}

export function parseMarkdownInline(
  text: string | null | undefined,
  context: UmamiContext = {}
): string {
  if (!text) return ''
  return createMarked(context).parseInline(text) as string
}
