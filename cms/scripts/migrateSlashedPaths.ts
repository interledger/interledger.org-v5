/**
 * Rewrites stored slugs and internal links to the `/path/` form the CMS now
 * saves (INTORG-1254), so the repo and Strapi agree before the next sync.
 *
 * Line by line on the frontmatter block only, so the body and every other
 * field stay byte for byte unchanged and the diff shows only the paths.
 * Imports `relativeLinks` directly: the barrel pulls in Strapi.
 */

import { toSlashedPath, toSlashedSlug } from '../src/utils/relativeLinks'

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
