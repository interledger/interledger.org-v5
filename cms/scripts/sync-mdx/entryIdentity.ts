/**
 * Entry identity for the MDX to Strapi sync.
 *
 * Most content types are identified by `locale` plus `pathSlug`. The
 * cross-section collections (faqs, profiles, reports) are not: they live in
 * one flat collection but render under different URL trees, so their
 * `pathSlug` is relative to the `section` frontmatter field. Two sections can
 * both use the slug `faq`, which is exactly what broke the foundation FAQ
 * (INTORG-1132): the sync looked the entry up by pathSlug alone, found the
 * hackathon FAQ, and overwrote it instead of creating a second entry.
 *
 * For a section-scoped content type the identity is therefore
 * (locale, section, pathSlug). This module builds that key and nothing else,
 * so every lookup, orphan check and collision check agrees on what "the same
 * entry" means.
 */
import type { ContentTypeConfig } from './config'
import type { MDXFile } from './mdxTypes'
import type { StrapiEntry } from './strapiClient'

/** Separator that cannot appear in a section name or a pathSlug. */
const KEY_SEPARATOR = '\0'

/** Identity of one entry within a single content type and locale. */
export interface EntryIdentity {
  pathSlug: string
  /** null when the content type is not section-scoped. */
  section: string | null
}

/** Identity of an MDX file, honoring whether its content type is section-scoped. */
export function identityForMdx(
  config: Pick<ContentTypeConfig, 'sectionScopedIdentity'>,
  mdx: MDXFile
): EntryIdentity {
  return {
    pathSlug: mdx.pathSlug,
    section: config.sectionScopedIdentity ? mdx.section : null
  }
}

/** Identity of a Strapi entry, honoring whether its content type is section-scoped. */
export function identityForEntry(
  config: Pick<ContentTypeConfig, 'sectionScopedIdentity'>,
  entry: StrapiEntry
): EntryIdentity {
  return {
    pathSlug: entry.pathSlug,
    section: config.sectionScopedIdentity
      ? ((entry.section as string | undefined) ?? null)
      : null
  }
}

/**
 * Stable string key for an identity within one locale.
 * Falls back to the bare pathSlug when the content type is not section-scoped,
 * so non-cross-section types keep their existing keys.
 */
export function identityKey(identity: EntryIdentity): string {
  return identity.section === null
    ? identity.pathSlug
    : `${identity.section}${KEY_SEPARATOR}${identity.pathSlug}`
}

/** Human-readable identity for log lines, e.g. `faq (hackathon)`. */
export function formatIdentity(identity: EntryIdentity): string {
  return identity.section === null
    ? identity.pathSlug
    : `${identity.pathSlug} (${identity.section})`
}
