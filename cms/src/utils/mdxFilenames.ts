/**
 * The MDX filename contract.
 *
 * Every Strapi lifecycle writes its MDX file to a path derived from the
 * entry's own fields, never from the file already on disk. A file whose name
 * does not match that derivation is a latent duplicate: the next publish
 * writes the derived name beside it and both files then map to one Strapi
 * entry (INTORG-1237).
 *
 * This module owns the derivation so the lifecycles and
 * `scripts/check-mdx-filenames.ts` cannot drift apart. Keep it free of
 * project-internal imports beyond `./locales` — the check script runs in a CI
 * job that installs cms dependencies with `--ignore-scripts`, so it must not
 * reach prettier, sharp or Strapi.
 */

import { defaultLang } from './locales'

/** Site section whose entries route from the root, so they take no prefix. */
const ROOT_SECTION = 'foundation'

/** Trims the leading and trailing slashes a CMS-authored pathSlug may carry. */
function trimSlashes(pathSlug: string): string {
  return pathSlug.replace(/^\/+|\/+$/g, '')
}

/**
 * Returns the slug to use as the MDX filename for a given locale.
 * Non-default locales use the English slug so filenames stay locale-independent
 * (e.g. es/about-us.mdx, not es/sobre-nosotros.mdx).
 */
export function resolveFilenameSlug(
  locale: string,
  ownSlug: string,
  englishSlug?: string | null
): string {
  return locale !== defaultLang && englishSlug ? englishSlug : ownSlug
}

/**
 * Converts a pathSlug to a flat MDX filename stem (no extension).
 * Slashes become hyphens so storage stays flat regardless of URL depth.
 */
export function pathSlugToMdxFilename(pathSlug: string): string {
  return trimSlashes(pathSlug).replace(/\//g, '-')
}

/**
 * Flat MDX filename stem for a cross-section entry (no extension).
 *
 * `pathSlug` on faqs, profiles and reports is relative to the `section` field,
 * so two sections can hold the same slug and `pathSlugToMdxFilename` alone
 * would send both to one file (INTORG-1132). The stem therefore mirrors the
 * public URL: `foundation` routes from the root and takes no prefix, every
 * other section is prefixed with its own name.
 *
 * ('faq', 'hackathon') -> 'hackathon-faq'
 * ('faq', 'foundation') -> 'faq'
 * ('grant/grantmaking-faq', 'foundation') -> 'grant-grantmaking-faq'
 */
export function sectionScopedMdxFilename(
  pathSlug: string,
  section?: string | null
): string {
  const slug = trimSlashes(pathSlug)
  const needsPrefix = Boolean(section) && section !== ROOT_SECTION
  return pathSlugToMdxFilename(needsPrefix ? `${section}/${slug}` : slug)
}

/**
 * How a collection turns entry fields into a filename. One of:
 *
 * - `page`: the pathSlug is the path. `grant/fellowship` becomes
 *   `grant/fellowship.mdx`, so the tree mirrors the URL.
 * - `blog`: flat, with the publication date as a sortable prefix.
 * - `flat`: flat, one file per entry, slashes flattened to hyphens.
 * - `flat-section`: flat, prefixed with the section for cross-section types.
 */
export type MdxNamingRule = 'page' | 'blog' | 'flat' | 'flat-section'

/** Entry fields the filename is derived from. */
export interface MdxNameFields {
  /** URL path of the entry, relative to its section where one applies. */
  pathSlug: string
  /** Locale of this file. Defaults to {@link defaultLang}. */
  locale?: string | null
  /**
   * The English entry's pathSlug, carried in `localizes` frontmatter.
   * Ignored for the default locale. When a localized entry has no English
   * counterpart, the entry falls back to its own pathSlug.
   */
  englishSlug?: string | null
  /** Publication date as `YYYY-MM-DD`. Required by the `blog` rule only. */
  date?: string | null
  /** Site section. Read by the `flat-section` rule only. */
  section?: string | null
}

/**
 * Path of the MDX file within its collection directory, excluding the locale
 * folder. Throws when `pathSlug` is empty, because no filename can be derived
 * without it.
 */
export function mdxSubpath(rule: MdxNamingRule, fields: MdxNameFields): string {
  const locale = (fields.locale || defaultLang).trim() || defaultLang
  const ownSlug = trimSlashes(String(fields.pathSlug ?? '')).trim()

  if (!ownSlug) {
    throw new Error('pathSlug is required')
  }

  const slug = resolveFilenameSlug(locale, ownSlug, fields.englishSlug)

  if (rule === 'page') return `${trimSlashes(slug)}.mdx`
  if (rule === 'blog') {
    const date = (fields.date ?? '').trim()
    return `${date ? `${date}-` : ''}${pathSlugToMdxFilename(slug)}.mdx`
  }
  if (rule === 'flat-section') {
    return `${sectionScopedMdxFilename(slug, fields.section)}.mdx`
  }
  return `${pathSlugToMdxFilename(slug)}.mdx`
}

/**
 * Path of the MDX file relative to its collection directory, locale folder
 * included. This is the form the content check compares against disk.
 */
export function mdxRelativePath(
  rule: MdxNamingRule,
  fields: MdxNameFields
): string {
  const locale = (fields.locale || defaultLang).trim() || defaultLang
  const subpath = mdxSubpath(rule, fields)
  return locale === defaultLang ? subpath : `${locale}/${subpath}`
}
