import { createMarked, type UmamiContext } from './umami'

export async function parseMarkdown(
  text: string | null | undefined,
  context: UmamiContext = {}
): Promise<string> {
  if (!text) return ''
  return createMarked(context).parse(text)
}

export function parseMarkdownInline(
  text: string | null | undefined,
  context: UmamiContext = {}
): string {
  if (!text) return ''
  return createMarked(context).parseInline(text) as string
}
