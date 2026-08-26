/**
 * Locale Matching Utilities
 *
 * Functions for matching MDX files across locales:
 * - Building locale-to-identity maps for quick lookups
 * - Checking if MDX files exist for specific locale/identity combinations
 * - Finding locale files that translate English entries via the `localizes` field
 *
 * Entries are keyed by their identity, not by pathSlug alone: cross-section
 * content types reuse a pathSlug across sections (see entryIdentity.ts).
 */
import type { ContentTypeConfig } from './config'
import {
  identityForMdx,
  identityKey,
  type EntryIdentity
} from './entryIdentity'
import type { MDXFile } from './mdxTypes'

/** Config fields these helpers need. Keeps callers from passing a whole config. */
type IdentityConfig = Pick<ContentTypeConfig, 'sectionScopedIdentity'>

/**
 * Builds a map of all MDX entry identities grouped by locale.
 * Used to quickly check if an MDX file exists before deleting Strapi entries.
 *
 * @param mdxFiles - Array of MDX files to index
 * @param config - Content type config, for whether identity includes `section`
 * @returns Map where keys are locale codes and values are Sets of identity keys
 */
export function buildMdxSlugsByLocale(
  mdxFiles: MDXFile[],
  config: IdentityConfig
): Map<string, Set<string>> {
  const identitiesByLocale = new Map<string, Set<string>>()

  for (const mdx of mdxFiles) {
    const locale = mdx.locale || 'en'
    const keys = identitiesByLocale.get(locale) ?? new Set()
    keys.add(identityKey(identityForMdx(config, mdx)))
    identitiesByLocale.set(locale, keys)
  }

  return identitiesByLocale
}

/**
 * Checks if an MDX file exists for a given locale and entry identity.
 *
 * @param mdxSlugsByLocale - Map built by buildMdxSlugsByLocale
 * @param localeCode - Locale to check (e.g., 'en', 'es')
 * @param identity - Identity to look for
 * @returns True if a matching MDX file exists for that locale
 */
export function hasMdxFile(
  mdxSlugsByLocale: Map<string, Set<string>>,
  localeCode: string,
  identity: EntryIdentity
): boolean {
  return mdxSlugsByLocale.get(localeCode)?.has(identityKey(identity)) ?? false
}

/**
 * Represents a matched locale file that corresponds to an English entry.
 */
export interface LocaleMatch {
  /** The MDX file for the locale version */
  localeMdx: MDXFile
  /** Explanation of why this match was found (e.g., "localizes: about-us") */
  matchReason: string
}

/**
 * Finds locale files that translate an English entry via the `localizes` field.
 *
 * Searches through locale files to find those whose `localizes` frontmatter
 * field matches the English entry's pathSlug. For a section-scoped content
 * type the sections must match too, otherwise an ES file naming `localizes:
 * faq` would attach itself to every section that uses that slug.
 *
 * @param englishMdx - The English MDX file to find translations for
 * @param localeFiles - Array of non-English MDX files to search
 * @param config - Content type config, for whether identity includes `section`
 * @returns Array of matches with the locale file and match reason
 */
export function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[],
  config: IdentityConfig
): LocaleMatch[] {
  const matches: LocaleMatch[] = []

  for (const localeMdx of localeFiles) {
    // Skip if this file doesn't reference the English entry's pathSlug
    if (localeMdx.localizes !== englishMdx.pathSlug) {
      continue
    }

    if (
      config.sectionScopedIdentity &&
      localeMdx.section !== englishMdx.section
    ) {
      continue
    }

    matches.push({
      localeMdx,
      matchReason: `localizes: ${englishMdx.pathSlug}`
    })
  }

  return matches
}
