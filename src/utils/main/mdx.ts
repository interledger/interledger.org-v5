import { Marked, type RendererObject, type Tokens } from 'marked'
import { isSafeMarkdownHref } from '../shared/url'
import {
  buildUmamiAttrs,
  escapeHtml,
  extractTitleLabel,
  umamiAttrsToHtml,
  DEFAULT_INLINE_LINK_BASE_COMPONENT
} from './umami'
import { getTableScrollAriaLabel } from './getTableScrollAriaLabel'
import { wrapScrollableTables } from './wrapScrollableTables'

export interface UmamiContext {
  pathname?: string
  page?: string
  lang?: string
}

const HTML_TAG = /<[^>]*>/g

function stripTags(html: string): string {
  return html.replace(HTML_TAG, '')
}

const markedCache = new Map<string, Marked>()

/**
 * Returns a Marked instance whose link renderer injects umami attributes
 * and drops any link whose href isn't a safe scheme (see
 * `isSafeMarkdownHref`) rather than rendering it.
 */
export function createMarked(context: UmamiContext = {}): Marked {
  const pathname = context.pathname ?? '/'
  const currentPath = context.page?.trim() || undefined
  const lang = context.lang?.trim() || ''
  const cacheKey = `${pathname}|${currentPath ?? ''}|${lang}`
  const cached = markedCache.get(cacheKey)
  if (cached) return cached

  const renderer: RendererObject = {
    // Marked passes raw HTML found in the markdown source straight through
    // unescaped by default (e.g. `<script>`, `<img onerror=...>`), independent
    // of the href-scheme check below. Escape it instead — this is untrusted
    // editor-supplied content rendered via `set:html`.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text)
    },
    link({ href, title, tokens }: Tokens.Link) {
      const innerHtml = this.parser.parseInline(tokens)
      // Marked only HTML-escapes href, it doesn't restrict schemes — drop
      // the link (keep the text) rather than emitting a javascript:/data:
      // href from editor-supplied markdown.
      if (!isSafeMarkdownHref(href ?? '')) return innerHtml
      const { label: baseComponentOverride, title: cleanedTitle } =
        extractTitleLabel(title)
      const attrs = buildUmamiAttrs({
        pathname,
        currentPath,
        lang,
        label: 'link',
        baseComponent:
          baseComponentOverride || DEFAULT_INLINE_LINK_BASE_COMPONENT,
        linkText: stripTags(innerHtml),
        href
      })
      const titleAttr = cleanedTitle
        ? ` title="${escapeHtml(cleanedTitle)}"`
        : ''
      return `<a href="${escapeHtml(href ?? '')}"${titleAttr}${umamiAttrsToHtml(attrs)}>${innerHtml}</a>`
    }
  }
  const instance = new Marked()
  instance.use({ renderer })
  markedCache.set(cacheKey, instance)
  return instance
}

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
