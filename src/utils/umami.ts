import { Marked, type RendererObject, type Tokens } from 'marked'

// Mirrors astro.config.mjs `i18n.locales`. Kept inline to avoid pulling the
// astro virtual modules into the unit-test runtime.
const LOCALE_CODES = ['en', 'es'] as const

export type UmamiSection =
  | 'hero'
  | 'nav'
  | 'footer'
  | 'card'
  | 'cta'
  | 'link'
  | 'featured_content'

export interface UmamiContext {
  /** Override the page segment directly (e.g. `home`, `foundation`). */
  page?: string
  /** Pathname used to derive the page segment when `page` is omitted. */
  pathname?: string
  /** Locale code emitted as `data-umami-event-lang`. */
  lang?: string
}

export interface UmamiAttrs {
  'data-umami-event': string
  'data-umami-event-link-text'?: string
  'data-umami-event-lang'?: string
  'data-umami-event-label'?: string
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
const MICROSITES = ['summit', 'hackathon'] as const
const HOME_SUFFIX = '_home'
const TITLE_LABEL_PREFIX = 'label:'

const localeSet = new Set<string>(LOCALE_CODES)
const micrositeSet = new Set<string>(MICROSITES)

function sanitizeText(value: string): string {
  return value.replace(UNSAFE_LABEL_CHARS, '').replace(/\s+/g, ' ').trim()
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char])
}

function stripTags(html: string): string {
  return html.replace(HTML_TAG, '')
}

function normaliseSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^\w]/g, '')
}

/**
 * Convert an href or path into a stable label segment.
 * External URLs collapse to host (sans `www.` and TLD); github gets
 * `github_org_repo`. Internal paths drop the locale prefix, then either
 * resolve to `{microsite}_home` / `foundation_home` or reduce to the last
 * two path segments joined with `_`.
 */
export function deriveLabel(href: string): string {
  if (/^https?:\/\//i.test(href)) {
    let url: URL
    try {
      url = new URL(href)
    } catch {
      return normaliseSegment(href)
    }
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      return ['github', ...parts.map(normaliseSegment)].join('_')
    }
    const hostParts = hostname.replace(/^www\./, '').split('.')
    return hostParts.slice(0, -1).map(normaliseSegment).join('_')
  }

  const raw = href.split('?')[0].split('#')[0]
  const segments = raw.split('/').filter(Boolean)
  const delocaled =
    segments.length > 0 && localeSet.has(segments[0].toLowerCase())
      ? segments.slice(1)
      : segments

  if (delocaled.length === 0) return 'foundation_home'

  if (delocaled.length === 1) {
    const seg = normaliseSegment(delocaled[0])
    return micrositeSet.has(delocaled[0].toLowerCase()) ? `${seg}_home` : seg
  }

  if (
    delocaled.length === 2 &&
    micrositeSet.has(delocaled[0].toLowerCase()) &&
    micrositeSet.has(delocaled[1].toLowerCase())
  ) {
    return `${normaliseSegment(delocaled[1])}_home`
  }

  return delocaled.slice(-2).map(normaliseSegment).join('_')
}

/**
 * Resolve the `page` segment for an event. Foundation root collapses to
 * `foundation`; any microsite home (e.g. `summit_home`) collapses to `home`
 * since the microsite is implicit from the URL dimension.
 */
export function derivePage({ page, pathname }: UmamiContext = {}): string {
  if (page) return normaliseSegment(page)
  const raw = deriveLabel(pathname ?? '/')
  if (raw === 'foundation_home') return 'foundation'
  if (raw.endsWith(HOME_SUFFIX)) return 'home'
  return raw
}

/**
 * Identify the microsite a pathname lives in (`foundation`, `summit`,
 * `hackathon`, …). Used to disambiguate microsite-home links: a link to the
 * current microsite's root reads as `home`, whereas the same link from
 * outside reads as the microsite's name.
 */
export function getMicrosite(pathname: string | undefined): string {
  if (!pathname) return 'foundation'
  const segments = pathname
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean)
    .filter((s) => !localeSet.has(s.toLowerCase()))
  if (segments.length === 0) return 'foundation'
  const first = segments[0].toLowerCase()
  if (!micrositeSet.has(first)) return 'foundation'
  const second = segments[1]?.toLowerCase()
  if (second && micrositeSet.has(second)) return second
  return first
}

/**
 * Resolve the `action` segment for an event. The foundation root always reads
 * as `home`. A microsite root reads as `home` from inside that microsite, or
 * as the microsite's name from outside (e.g. foundation → summit link).
 */
export function deriveAction(href: string, currentPath?: string): string {
  if (!href) return 'unknown'
  const raw = deriveLabel(href)
  if (raw === 'foundation_home') return 'home'
  if (raw.endsWith(HOME_SUFFIX)) {
    const dest = raw.slice(0, -HOME_SUFFIX.length)
    return getMicrosite(currentPath) === dest ? 'home' : dest
  }
  return raw
}

export interface BuildUmamiAttrsInput extends UmamiContext {
  section: UmamiSection
  href?: string | null
  linkText?: string | null
  ariaLabel?: string | null
  /**
   * Override for the action segment, used when the element has no `href`
   * (e.g. menu-toggle buttons) or when auto-derivation is undesirable.
   */
  action?: string | null
  /** Manual override for the `data-umami-event-label` property. Only meaningful when `section === 'link'`. */
  label?: string | null
}

/**
 * Build the full set of `data-umami-event*` attributes for a link.
 *
 * - Component-anchored links (`section !== 'link'`) emit `{page}:{section}:{action}`.
 * - Inline content links (`section === 'link'`) emit `{page}:link:{action}` by
 *   default. Authors may override the action with a `label:foo` markdown
 *   directive, which produces `{page}:link` plus `data-umami-event-label="foo"`.
 */
export function buildUmamiAttrs(input: BuildUmamiAttrsInput): UmamiAttrs {
  const page = derivePage(input)
  const text =
    sanitizeText(input.linkText ?? '') || sanitizeText(input.ariaLabel ?? '')
  const lang = input.lang?.trim() || undefined
  const label = input.label ? sanitizeText(input.label) : ''

  const actionOverride = input.action ? normaliseSegment(input.action) : ''
  const event =
    input.section === 'link' && label
      ? `${page}:link`
      : `${page}:${input.section}:${actionOverride || deriveAction(input.href ?? '', input.pathname)}`

  const attrs: UmamiAttrs = { 'data-umami-event': event }
  if (text) attrs['data-umami-event-link-text'] = text
  if (lang) attrs['data-umami-event-lang'] = lang
  if (label) attrs['data-umami-event-label'] = label
  return attrs
}

/**
 * Serialise umami attributes as an HTML attribute string (leading space).
 * Used by the markdown renderer; everything is HTML-escaped.
 */
export function umamiAttrsToHtml(attrs: UmamiAttrs): string {
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeHtml(value as string)}"`)
    .join('')
}

/**
 * Extract a `label:foo` directive from a markdown link title. Returns the
 * label and the cleaned title (which is `undefined` if the directive was the
 * entire title, so it doesn't leak onto the rendered `<a>`).
 */
export function extractTitleLabel(title: string | null | undefined): {
  label?: string
  title?: string
} {
  if (!title) return {}
  const trimmed = title.trim()
  if (!trimmed.toLowerCase().startsWith(TITLE_LABEL_PREFIX)) {
    return { title }
  }
  const label = sanitizeText(trimmed.slice(TITLE_LABEL_PREFIX.length))
  if (!label) return { title }
  return { label }
}

const markedCache = new Map<string, Marked>()

/** Returns a Marked instance whose link renderer injects umami attributes. */
export function createMarked(context: UmamiContext = {}): Marked {
  const page = derivePage(context)
  const lang = context.lang?.trim() || ''
  const cacheKey = `${page}|${lang}`
  const cached = markedCache.get(cacheKey)
  if (cached) return cached

  const renderer: RendererObject = {
    link({ href, title, tokens }: Tokens.Link) {
      const innerHtml = this.parser.parseInline(tokens)
      const { label, title: cleanedTitle } = extractTitleLabel(title)
      const attrs = buildUmamiAttrs({
        page,
        lang,
        section: 'link',
        linkText: stripTags(innerHtml),
        href,
        label
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
