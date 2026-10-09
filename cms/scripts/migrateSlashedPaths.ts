/**
 * Rewrites stored slugs and internal links to the `/path/` form the CMS now
 * saves (INTORG-1254), so the repo and Strapi agree before the next sync.
 *
 * Line by line on the frontmatter block only, so the body and every other
 * field stay byte for byte unchanged and the diff shows only the paths.
 * Imports `relativeLinks` directly: the barrel pulls in Strapi.
 */

import {
  normalizeRedirectInput,
  redirectConfigToEntries,
  serializeRedirectConfig,
  type RedirectConfig
} from '../src/utils/redirects'
import {
  mapOutsideMarkdownCode,
  slashInternalMarkdownLinks,
  toSlashedPath,
  toSlashedSlug
} from '../src/utils/relativeLinks'

/** A byte-order mark may precede it: some translated files carry one. */
const FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/

const SLUG_KEYS = ['pathSlug', 'localizes']

/** Frontmatter keys an editor fills with a link (see `HREF_LIKE_FIELDS`). */
const LINK_KEYS = [
  'href',
  'link',
  'ctaLink',
  'buttonLink',
  'primaryButtonLink',
  'secondaryButtonLink',
  'authorLink'
]

/** `  key: 'value'`: indent, key, quote, value. Block scalars do not match. */
const SCALAR_LINE = /^(\s*)([A-Za-z]+):(\s+)(['"]?)([^'"\s|>][^'"]*?)\4\s*$/

/** `  - 'value'` inside a list. */
const LIST_ITEM_LINE = /^(\s*-\s+)(['"]?)([^'"\s][^'"]*?)\2\s*$/

const RELATED_ARTICLES = /^relatedArticles:\s*$/

function rewriteScalar(line: string): string {
  const match = line.match(SCALAR_LINE)
  if (!match) return line
  const [, indent, key, gap, quote, value] = match
  let next = value
  if (SLUG_KEYS.includes(key)) next = toSlashedSlug(value)
  else if (LINK_KEYS.includes(key)) next = toSlashedPath(value)
  if (next === value) return line
  return `${indent}${key}:${gap}${quote}${next}${quote}`
}

function rewriteListItem(line: string): string {
  const match = line.match(LIST_ITEM_LINE)
  if (!match) return line
  const [, prefix, quote, value] = match
  return `${prefix}${quote}${toSlashedSlug(value)}${quote}`
}

/** Rewrites the frontmatter of one MDX file. Returns null when nothing changed. */
export function migrateFrontmatterPaths(raw: string): string | null {
  const match = raw.match(FRONTMATTER)
  if (!match) return null

  let inRelatedArticles = false
  const lines = match[1].split('\n').map((line) => {
    if (RELATED_ARTICLES.test(line)) {
      inRelatedArticles = true
      return line
    }
    if (inRelatedArticles && LIST_ITEM_LINE.test(line)) {
      return rewriteListItem(line)
    }
    inRelatedArticles = false
    return rewriteScalar(line)
  })

  const frontmatter = lines.join('\n')
  if (frontmatter === match[1]) return null
  return raw.replace(match[1], () => frontmatter)
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

/** Rewrites every `href` in a navigation JSON tree, in place. */
export function migrateNavigationHrefs(node: Json): void {
  if (Array.isArray(node)) {
    node.forEach(migrateNavigationHrefs)
    return
  }
  if (typeof node !== 'object' || node === null) return
  for (const [key, value] of Object.entries(node)) {
    if (key === 'href' && typeof value === 'string') {
      node[key] = toSlashedPath(value)
    } else {
      migrateNavigationHrefs(value)
    }
  }
}

/**
 * Rewrites `src/config/redirects.json` the way Strapi saves each row: sources
 * and on-site destinations as `/path/`. Serialized as the redirect lifecycle
 * writes the file, sort order included, so the next editor save changes
 * nothing.
 */
export function migrateRedirectConfig(
  config: Partial<RedirectConfig>
): RedirectConfig | Error {
  const entries = redirectConfigToEntries(config)
  if (entries instanceof Error) return entries
  for (const entry of entries) {
    normalizeRedirectInput(entry as unknown as Record<string, unknown>)
  }
  return serializeRedirectConfig(entries)
}

/**
 * Link props the block serializers write into MDX bodies, as JSX attributes
 * (`link="/x"`) or object keys (`{ link: '/x' }`). Each comes from a Strapi
 * link field the save hook now stores as `/path/`; `buttonUrl` and
 * `secondButtonUrl` carry a card CTA's `link`.
 */
const JSX_LINK_PROP =
  /\b(link|href|ctaLink|buttonLink|primaryButtonLink|secondaryButtonLink|authorLink|buttonUrl|secondButtonUrl)(=|:\s*)(["'])(\/(?!\/)[^"'\n]*)\3/g

function slashJsxLinkProps(prose: string): string {
  return prose.replace(
    JSX_LINK_PROP,
    (_prop, key: string, joiner: string, quote: string, path: string) =>
      `${key}${joiner}${quote}${toSlashedPath(path)}${quote}`
  )
}

/**
 * Rewrites the internal links written as Markdown or JSX in one MDX file,
 * outside code: Markdown links anywhere, including rich-text fields kept in
 * frontmatter (FAQ answers), and the link props above in the body. Plain
 * frontmatter link fields are {@link migrateFrontmatterPaths}' job. Returns
 * null when nothing changed.
 */
export function migrateBodyLinks(raw: string): string | null {
  const frontmatter = raw.match(FRONTMATTER)?.[0] ?? ''
  const body = raw.slice(frontmatter.length)
  const next =
    slashInternalMarkdownLinks(frontmatter) +
    slashInternalMarkdownLinks(mapOutsideMarkdownCode(body, slashJsxLinkProps))
  return next === raw ? null : next
}
