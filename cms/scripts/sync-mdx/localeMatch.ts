/**
 * Locale Matching Utilities
 *
 * Functions for matching MDX files across locales:
 * - Building locale-to-pathSlug maps for quick lookups
 * - Checking if MDX files exist for specific locale/pathSlug combinations
 * - Finding locale files that translate English entries via the `localizes` field
 */
import type { MDXFile } from './mdxTypes'

/**
 * Builds a map of all MDX pathSlugs grouped by locale.
 * Used to quickly check if an MDX file exists before deleting Strapi entries.
 *
 * @param mdxFiles - Array of MDX files to index
 * @returns Map where keys are locale codes and values are Sets of pathSlugs
 */
export function buildMdxSlugsByLocale(
  mdxFiles: MDXFile[]
): Map<string, Set<string>> {
  const pathSlugsByLocale = new Map<string, Set<string>>()

  for (const mdx of mdxFiles) {
    const locale = mdx.locale || 'en'
    const pathSlugSet = pathSlugsByLocale.get(locale) ?? new Set()
    pathSlugSet.add(mdx.pathSlug)
    pathSlugsByLocale.set(locale, pathSlugSet)
  }

  return pathSlugsByLocale
}

/**
 * Checks if a pathSlug exists in MDX files for a given locale.
 *
 * @param mdxSlugsByLocale - Map built by buildMdxSlugsByLocale
 * @param localeCode - Locale to check (e.g., 'en', 'es')
 * @param pathSlug - PathSlug to look for
 * @returns True if the pathSlug exists for that locale
 */
export function hasMdxFile(
  mdxSlugsByLocale: Map<string, Set<string>>,
  localeCode: string,
  pathSlug: string
): boolean {
  return mdxSlugsByLocale.get(localeCode)?.has(pathSlug) ?? false
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
 * field matches the English entry's pathSlug.
 *
 * @param englishMdx - The English MDX file to find translations for
 * @param localeFiles - Array of non-English MDX files to search
 * @returns Array of matches with the locale file and match reason
 */
export function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[]
): LocaleMatch[] {
  const matches: LocaleMatch[] = []

  for (const localeMdx of localeFiles) {
    // Skip if this file doesn't reference the English entry's pathSlug
    if (localeMdx.localizes !== englishMdx.pathSlug) {
      continue
    }

    matches.push({
      localeMdx,
      matchReason: `localizes: ${englishMdx.pathSlug}`
    })
  }

  return matches
}
