import { isExternalHref, getHostname } from '../shared/url'
import { isPreviewPathname } from '../shared/demoPaths'
import { getExternalGroupName, OTHER_EXTERNAL } from './umamiExternalDomains'
import { LOCALE_CODES } from './localeCodes'

export type UmamiLabel =
  | 'button_cta'
  | 'button_card'
  | 'button_form'
  | 'button_ui'
  | 'nav'
  | 'toggle'
  | 'link'

export type UmamiSection = 'foundation' | 'summit' | 'hackathon'
export type UmamiDestinationSection = UmamiSection | 'external'

export interface BuildUmamiAttrsInput {
  label: UmamiLabel
  baseComponent: string
  href?: string | null
  linkText?: string | null
  /**
   * Fallback source for `link_text` when there's no visible text (icon-only
   * links/buttons). Only ever read as an input here — `buildUmamiAttrs` never
   * emits an `aria-label` HTML attribute itself, so callers still need to set
   * the real `aria-label` on the element separately for accessibility. Reuse
   * one local value for both rather than computing/typing it twice.
   */
  ariaLabel?: string | null
  lang?: string
  pathname?: string
  currentPath?: string
}

export interface UmamiAttrs {
  'data-umami-event': UmamiLabel
  'data-umami-event-base-component': string
  'data-umami-event-link-text'?: string
  'data-umami-event-lang'?: string
  'data-umami-event-current-path': string
  'data-umami-event-current-section': UmamiSection
  'data-umami-event-destination-path'?: string
  'data-umami-event-destination-section'?: UmamiDestinationSection
}

export interface UmamiTrackAttrs {
  'data-track-event': UmamiLabel
  'data-track-event-base-component': string
  'data-track-event-link-text'?: string
  'data-track-event-lang'?: string
  'data-track-event-current-path': string
  'data-track-event-current-section': UmamiSection
  'data-track-event-destination-path'?: string
  'data-track-event-destination-section'?: UmamiDestinationSection
}

const UNSAFE_LABEL_CHARS = /[<>`"'{}[\]]/g
const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}
const HOME_SUFFIX = '_home'
const TITLE_LABEL_PREFIX = 'label:'
export const DEFAULT_INLINE_LINK_BASE_COMPONENT = 'inline_link'

// Absolute links to the site's own domain must classify as internal
const SITE_HOSTNAMES = new Set(['interledger.org', 'www.interledger.org'])

const MICROSITE_SEGMENTS = new Set(['summit', 'hackathon'])
// Purely-numeric or date-shaped segments (2026, 2026-01, 2026-01-07)
// identify an edition, not content, and are dropped during grouping.
const NUMERIC_OR_DATE_SEGMENT = /^\d+(-\d+)*$/

const localeSet = new Set<string>(LOCALE_CODES)

function sanitizeText(value: string): string {
  return value.replace(UNSAFE_LABEL_CHARS, '').replace(/\s+/g, ' ').trim()
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char])
}

function normaliseSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^\w]/g, '')
}

/** Splits a path/href into lowercased, non-empty segments (drops query/hash). */
function getPathSegments(rawPath: string): string[] {
  return rawPath
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean)
    .map((s) => s.toLowerCase())
}

/** Drops a leading segment only if it's an exact match in `locales`. */
function stripLocalePrefix(segments: string[]): string[] {
  return segments.length > 0 && localeSet.has(segments[0])
    ? segments.slice(1)
    : segments
}

/**
 * Classifies which section a set of (locale-stripped) segments belongs to.
 * `hackathon` nests under `summit` in the URL (`/summit/hackathon/...`), so
 * its presence must win over a bare `summit` segment.
 */
function classifySectionFromSegments(segments: string[]): UmamiSection {
  if (segments.includes('hackathon')) return 'hackathon'
  if (segments.includes('summit')) return 'summit'
  return 'foundation'
}

function stripMicrositeSegments(segments: string[]): string[] {
  return segments.filter((s) => !MICROSITE_SEGMENTS.has(s))
}

function dropDateSegments(segments: string[]): string[] {
  return segments.filter((s) => !NUMERIC_OR_DATE_SEGMENT.test(s))
}

/** Reduces delocaled, microsite-stripped segments to one grouped value. */
function groupContentSegments(
  segments: string[],
  section: UmamiSection
): string {
  const content = dropDateSegments(segments)
  if (content.length === 0) return `${section}${HOME_SUFFIX}`
  return normaliseSegment(content[0])
}

/**
 * Rewrites an absolute link to the site's own domain into a relative path,
 * so it flows through the internal classification pipeline instead of the
 * external one. Non-matching or unparseable hrefs are returned unchanged.
 */
function stripKnownOrigin(href: string): string {
  try {
    const url = new URL(href)
    return SITE_HOSTNAMES.has(url.hostname.toLowerCase())
      ? `${url.pathname}${url.search}${url.hash}`
      : href
  } catch {
    return href
  }
}

/** Always-internal: the current page's grouped path + section. */
function getCurrentPath(pathname: string): {
  path: string
  section: UmamiSection
} {
  const delocaled = stripLocalePrefix(getPathSegments(pathname))
  const section = classifySectionFromSegments(delocaled)
  const path = groupContentSegments(stripMicrositeSegments(delocaled), section)
  return { path, section }
}

function getExternalDestination(href: string): {
  path: string
  section: 'external'
} {
  const hostname = getHostname(href)
  return {
    path: hostname ? getExternalGroupName(hostname) : OTHER_EXTERNAL,
    section: 'external'
  }
}

/**
 * Destination classification for a link's `href`. Returns `null` for
 * destination-less interactions (e.g. `toggle`-style state changes with no
 * href at all).
 */
function getDestination(href: string | null | undefined): {
  path: string
  section: UmamiDestinationSection
} | null {
  const trimmed = (href ?? '').trim()
  if (!trimmed) return null

  const normalized = stripKnownOrigin(trimmed)
  if (isExternalHref(normalized)) return getExternalDestination(normalized)

  const delocaled = stripLocalePrefix(getPathSegments(normalized))
  const section = classifySectionFromSegments(delocaled)
  const path = groupContentSegments(stripMicrositeSegments(delocaled), section)
  return { path, section }
}

/**
 * Build the full set of `data-umami-event*` attributes for an interaction.
 *
 * `current_path`/`current_section` are always present. `destination_path`/
 * `destination_section` are present only when `href` resolves to a real
 * destination — omitted for destination-less `toggle` interactions.
 */
export function buildUmamiAttrs(input: BuildUmamiAttrsInput): UmamiAttrs {
  // Preview/QA routes (design-system previews, draft-content previews) are
  // never real traffic — never emit tracking attributes for them. Checked
  // here, once, so every call site is covered automatically instead of each
  // needing its own opt-out.
  if (isPreviewPathname(input.pathname ?? '')) return {} as UmamiAttrs

  const { path: derivedPath, section } = getCurrentPath(input.pathname ?? '/')
  const currentPath = input.currentPath?.trim() || derivedPath

  const text =
    sanitizeText(input.linkText ?? '') || sanitizeText(input.ariaLabel ?? '')
  const lang = input.lang?.trim() || undefined
  const destination = getDestination(input.href)

  const attrs: UmamiAttrs = {
    'data-umami-event': input.label,
    'data-umami-event-base-component': normaliseSegment(input.baseComponent),
    'data-umami-event-current-path': currentPath,
    'data-umami-event-current-section': section
  }
  if (text) attrs['data-umami-event-link-text'] = text
  if (lang) attrs['data-umami-event-lang'] = lang
  if (destination) {
    attrs['data-umami-event-destination-path'] = destination.path
    attrs['data-umami-event-destination-section'] = destination.section
  }
  return attrs
}

/**
 * Same event name and properties as `buildUmamiAttrs`, rendered under a
 * `data-track-event*` prefix instead of `data-umami-event*`.
 *
 * Umami's bundled script auto-intercepts clicks on any element carrying
 * `data-umami-event`: for same-tab `<a>` clicks it calls `preventDefault()`,
 * awaits its tracking fetch, and only then navigates. That guards against
 * losing outbound-link clicks when the page unloads mid-request, but it adds
 * a needless delay to ordinary same-tab in-site navigation. Nav links use
 * this variant instead, paired with `initNavClickTracking` (`header-nav.ts`),
 * which fires the identical event via `window.umami.track()` without
 * blocking the click.
 */
export function buildDeferredUmamiAttrs(
  input: BuildUmamiAttrsInput
): UmamiTrackAttrs {
  const attrs = buildUmamiAttrs(input)
  const trackAttrs: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    trackAttrs[key.replace('data-umami-event', 'data-track-event')] =
      value as string
  }
  return trackAttrs as unknown as UmamiTrackAttrs
}

/**
 * Shared Umami attrs for a desktop nav submenu's open/close toggle button,
 * used by both `FoundationNavMenu.astro` and `MicrositeNavMenu.astro` — kept
 * in one place so the two don't drift on label/base_component. No `href`:
 * toggling a submenu open/closed has no destination.
 */
export function buildSubmenuToggleUmamiAttrs(
  pathname: string,
  lang: string,
  groupLabel: string
): UmamiTrackAttrs {
  return buildDeferredUmamiAttrs({
    pathname,
    lang,
    label: 'toggle',
    baseComponent: 'submenu',
    linkText: groupLabel
  })
}

/**
 * Shared Umami attrs for a summit session-title link, used by both
 * `SessionCard.astro` (single card) and `SessionsList.astro` (full listing) —
 * kept in one place so the two don't drift on base_component.
 */
export function buildSessionCardUmamiAttrs(
  pathname: string,
  lang: string,
  href: string,
  title: string
): UmamiAttrs {
  return buildUmamiAttrs({
    pathname,
    lang,
    label: 'button_card',
    baseComponent: 'session_cards',
    href,
    linkText: title
  })
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
 * Extract a `label:foo` directive from a markdown link title, used to
 * override the rendered link's `base_component` (defaulting otherwise to
 * `inline_link`). Returns the override and the cleaned title (which is
 * `undefined` if the directive was the entire title, so it doesn't leak onto
 * the rendered `<a>`).
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
