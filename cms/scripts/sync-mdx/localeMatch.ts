import type { MDXFile } from './scan'

/**
 * Marks a slug as processed for a given locale to prevent duplicate processing.
 */
export function addProcessedSlug(
  processedSlugs: Map<string, Set<string>>,
  localeCode: string,
  slug: string
): void {
  // Get or create the set of processed slugs for this locale
  const slugSet = processedSlugs.get(localeCode) ?? new Set()
  
  // Add this slug to the set
  slugSet.add(slug)
  
  // Store the updated set back in the map
  processedSlugs.set(localeCode, slugSet)
}

/**
 * Checks if a slug has already been processed for a given locale.
 */
export function isProcessed(
  processedSlugs: Map<string, Set<string>>,
  localeCode: string,
  slug: string
): boolean {
  // Check if we have processed slugs for this locale
  const slugSet = processedSlugs.get(localeCode)
  if (!slugSet) {
    return false
  }
  
  // Check if this specific slug has been processed
  return slugSet.has(slug)
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
 */
export function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[],
  processedSlugs: Map<string, Set<string>>
): LocaleMatch[] {
  // Map to store matches, keyed by locale to ensure one match per locale
  const localeMatches = new Map<string, LocaleMatch>()

  // Search through all locale files
  for (const localeMdx of localeFiles) {
    const localeCode = localeMdx.locale || 'en'
    
    // Skip if this file has already been processed
    if (isProcessed(processedSlugs, localeCode, localeMdx.slug)) {
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
    }
  }

  // Convert map values to array and return
  return Array.from(localeMatches.values())
}
