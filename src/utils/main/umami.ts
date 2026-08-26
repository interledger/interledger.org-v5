import { hasUrlScheme, getHostname } from '../shared/url'
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

function normaliseSegment(value: string | undefined): string {
  return (value ?? '')
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

  // A hash-only href (`#section`, e.g. FaqSectionsNav's in-page jumps) is a
  // same-page anchor, not a navigation destination — treat it like a
  // destination-less interaction rather than letting the empty remainder
  // below collapse to `<section>_home`.
  if (normalized.startsWith('#')) return null

  // Anything else carrying a scheme (`mailto:`, `tel:`, `https:`, …) should register as external
  if (hasUrlScheme(normalized)) return getExternalDestination(normalized)

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
  // Run the override through the same normaliser the derived path's leaf
  // segment gets (see `groupContentSegments`), so a caller passing a
  // human-readable string (a section title, a CMS-authored context field)
  // still lands as one lowercase/underscored group instead of high-cardinality
  // free text alongside every derived `current_path` value.
  const trimmedOverride = input.currentPath?.trim()
  const currentPath = trimmedOverride
    ? normaliseSegment(trimmedOverride)
    : derivedPath

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
 * Shared Umami attrs for a top-level site-nav link (logo, menu item,
 * language toggle, submenu item) — used by `FoundationHeader.astro`,
 * `MicrositeHeader.astro`, `HackathonHeader.astro`, `MicrositeNavMenu.astro`,
 * and `NavMenuLink.astro` (which `FoundationNavMenu.astro` renders through).
 * Kept in one place so a header can't drift onto a made-up field name
 * instead of `label`/`baseComponent`.
 */
export function buildNavLinkUmamiAttrs(
  pathname: string,
  lang: string,
  href: string,
  linkText?: string,
  ariaLabel?: string
): UmamiTrackAttrs {
  return buildDeferredUmamiAttrs({
    pathname,
    lang,
    label: 'nav',
    baseComponent: 'menu',
    href,
    linkText,
    ariaLabel
  })
}

/**
 * Shared Umami attrs for a header/nav's CTA button — used by
 * `FoundationHeader.astro`, `MicrositeHeader.astro`, `HackathonHeader.astro`,
 * `FoundationNavActions.astro`, and `MicrositeNavActions.astro`. Kept
 * separate from `buildNavLinkUmamiAttrs` so a header's plain nav links and
 * its CTA are never tracked under the same bucket by accident.
 */
export function buildNavCtaUmamiAttrs(
  pathname: string,
  lang: string,
  href: string,
  linkText?: string
): UmamiTrackAttrs {
  return buildDeferredUmamiAttrs({
    pathname,
    lang,
    label: 'button_cta',
    baseComponent: 'menu',
    href,
    linkText
  })
}

/**
 * Shared Umami attrs for an in-page section-nav link (`FaqSectionsNav.astro`,
 * `ReportSectionsNav.astro`) — same `#id` anchor shape, distinguished by
 * `baseComponent` per content domain (`faq`, `report`).
 */
export function buildSectionNavLinkUmamiAttrs(
  pathname: string,
  lang: string,
  baseComponent: string,
  id: string,
  heading: string
): UmamiAttrs {
  return buildUmamiAttrs({
    pathname,
    lang,
    label: 'link',
    baseComponent,
    href: `#${id}`,
    linkText: heading
  })
}

export function umamiAttrsToHtml(attrs: UmamiAttrs): string {
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeHtml(value as string)}"`)
    .join('')
}

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
