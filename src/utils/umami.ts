import { Marked, type RendererObject, type Tokens } from 'marked'

export interface UmamiLinkContext {
  /** Full prefix for the event label, e.g. "Ambassadors page" or "Our Team section". */
  pageLabel?: string
  /** Fallback used when pageLabel is not provided — derived into "{Path} page". */
  pathname?: string
}

const UNSAFE_LABEL_CHARS = /[<>`"'{}[\]]/g
const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}
const HTML_TAG = /<[^>]*>/g

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function sanitizeLabel(value: string): string {
  return value.replace(UNSAFE_LABEL_CHARS, '').replace(/\s+/g, ' ').trim()
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char])
}

function stripTags(html: string): string {
  return html.replace(HTML_TAG, '')
}

function pathnameToLabel(pathname: string | undefined): string {
  if (!pathname || pathname === '/') return 'Home page'
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== 'es')
    .map((segment) => segment.replace(/[-_]+/g, ' '))
    .map(toTitleCase)
  if (segments.length === 0) return 'Home page'
  return `${segments.join(' ')} page`
}

function hrefLabel(href: string): string {
  try {
    const url = new URL(href)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    return sanitizeLabel(`${url.hostname}${path}`)
  } catch {
    return sanitizeLabel(href.replace(/^\/+|\/+$/g, '') || href)
  }
}

export function resolvePageLabel(context: UmamiLinkContext = {}): string {
  const raw = context.pageLabel ?? pathnameToLabel(context.pathname)
  return sanitizeLabel(raw) || 'Home page'
}

export function buildUmamiEvent({
  pageLabel,
  linkText,
  ariaLabel,
  href
}: {
  pageLabel: string
  linkText?: string | null
  ariaLabel?: string | null
  href?: string | null
}): string {
  const label =
    sanitizeLabel(linkText ?? '') ||
    sanitizeLabel(ariaLabel ?? '') ||
    (href ? hrefLabel(href) : '') ||
    'Unknown link'
  return `${pageLabel} link - ${label}`
}

const markedCache = new Map<string, Marked>()

/** Returns a Marked instance whose link renderer injects data-umami-event. */
export function createMarked(context: UmamiLinkContext = {}): Marked {
  const pageLabel = resolvePageLabel(context)
  const cached = markedCache.get(pageLabel)
  if (cached) return cached

  const renderer: RendererObject = {
    link({ href, title, tokens }: Tokens.Link) {
      const innerHtml = this.parser.parseInline(tokens)
      const event = buildUmamiEvent({
        pageLabel,
        linkText: stripTags(innerHtml),
        href
      })
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a href="${escapeHtml(href ?? '')}"${titleAttr} data-umami-event="${escapeHtml(event)}">${innerHtml}</a>`
    }
  }
  const instance = new Marked()
  instance.use({ renderer })
  markedCache.set(pageLabel, instance)
  return instance
}
