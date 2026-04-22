import { createMarked, type UmamiLinkContext } from './umami'

export async function parseMarkdown(
  text: string | null | undefined,
  context: UmamiLinkContext = {}
): Promise<string> {
  if (!text) return ''
  return createMarked(context).parse(text)
}

export function parseMarkdownInline(
  text: string | null | undefined,
  context: UmamiLinkContext = {}
): string {
  if (!text) return ''
  return createMarked(context).parseInline(text) as string
}
