import { ui } from '../../data/ui'
import { getHostname, isExternalHref } from '../shared/url'
import { escapeHtml, isSiteHostname } from './umami'

const OPENS_NEW_TAB_LABEL_KEY = 'aria.opens_new_tab' as const
const DEFAULT_LOCALE = 'en' as const
const PROTOCOL_RELATIVE_PREFIX = '//'

export const NEW_TAB_LINK_ATTRS = {
  target: '_blank',
  rel: 'noopener noreferrer'
} as const

export type NewTabLinkAttrs = typeof NEW_TAB_LINK_ATTRS | Record<string, never>

/**
 * `target`/`rel` for an off-site http(s) link, `{}` for anything else.
 * Absolute links to the site's own domain, relative paths, fragments,
 * `mailto:`/`tel:` and unparseable URLs stay in the same tab.
 */
export function getNewTabLinkAttrs(
  href: string | null | undefined
): NewTabLinkAttrs {
  const trimmed = (href ?? '').trim()
  const isWebUrl =
    isExternalHref(trimmed) || trimmed.startsWith(PROTOCOL_RELATIVE_PREFIX)
  if (!isWebUrl) return {}

  const hostname = getHostname(trimmed)
  if (!hostname || isSiteHostname(hostname)) return {}
  return NEW_TAB_LINK_ATTRS
}

/** Localized screen-reader hint appended to links that open a new tab. */
export function getOpensNewTabLabel(lang?: string): string {
  const locale = lang && lang in ui ? (lang as keyof typeof ui) : DEFAULT_LOCALE
  return ui[locale][OPENS_NEW_TAB_LABEL_KEY]
}

export interface NewTabLinkHtml {
  /** Leading-space attribute string for the opening `<a>` tag. */
  attrs: string
  /** Visually hidden hint to place inside the link, after its text. */
  hint: string
}

/**
 * HTML fragments for renderers that build `<a>` tags as strings. Both are
 * empty when the link stays in the same tab.
 */
export function buildNewTabLinkHtml(
  href: string | null | undefined,
  lang?: string
): NewTabLinkHtml {
  const attrs = getNewTabLinkAttrs(href)
  if (!('target' in attrs)) return { attrs: '', hint: '' }

  return {
    attrs: ` target="${attrs.target}" rel="${attrs.rel}"`,
    // Leading space so the hint isn't read run-on with the link text.
    hint: `<span class="sr-only"> ${escapeHtml(getOpensNewTabLabel(lang))}</span>`
  }
}
