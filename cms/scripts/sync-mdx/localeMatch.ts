import type { MDXFile } from './scan'

/**
 * Builds a map of all MDX slugs by locale.
 * Used to prevent deleting Strapi entries that have corresponding MDX files.
 */
export function buildMdxSlugsByLocale(mdxFiles: MDXFile[]): Map<string, Set<string>> {
  const slugsByLocale = new Map<string, Set<string>>()
  
  for (const mdx of mdxFiles) {
    const locale = mdx.locale || 'en'
    const slugSet = slugsByLocale.get(locale) ?? new Set()
    slugSet.add(mdx.slug)
    slugsByLocale.set(locale, slugSet)
  }
  
  return slugsByLocale
}

/**
 * Checks if a slug exists in MDX files for a given locale.
 */
export function hasMdxFile(
  mdxSlugsByLocale: Map<string, Set<string>>,
  localeCode: string,
  slug: string
): boolean {
  return mdxSlugsByLocale.get(localeCode)?.has(slug) ?? false
}

/**
 * Represents a matched locale file that corresponds to an English entry.
 */
export interface LocaleMatch {
  /** The MDX file for the locale version */
  localeMdx: MDXFile
  /** Explanation of why this match was found */
  matchReason: string
}

/**
 * Finds locale files that match an English entry via the `localizes` field.
 * 
 * Searches through locale files to find those that reference the English entry's slug
 * in their `localizes` frontmatter field.
 * 
 * Returns one match per locale (e.g., if multiple "es" files match, only the first is returned).
 * 
 * @param matchedSlugs - Set of locale file slugs that have already been matched (to avoid duplicates)
 */
export function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[],
  matchedSlugs: Set<string>
): LocaleMatch[] {
  // Map to store matches, keyed by locale to ensure one match per locale
  const localeMatches = new Map<string, LocaleMatch>()

  for (const localeMdx of localeFiles) {
    const localeCode = localeMdx.locale || 'en'
    const slugKey = `${localeCode}:${localeMdx.slug}`
    
    // Skip if this file has already been matched to another English entry
    if (matchedSlugs.has(slugKey)) {
      continue
    }
    
    // Skip if this file doesn't reference the English entry's slug
    if (localeMdx.localizes !== englishMdx.slug) {
      continue
    }

    // Only keep the first match per locale
    if (!localeMatches.has(localeCode)) {
      localeMatches.set(localeCode, {
        localeMdx,
        matchReason: `localizes: ${englishMdx.slug}`
      })
      matchedSlugs.add(slugKey)
    }
  }

  return Array.from(localeMatches.values())
}
