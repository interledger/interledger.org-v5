import type { MDXFile } from './scan'

/**
 * Extracts the base locale code from a full locale code.
 * 
 * Example: "es-419" -> "es", "en-US" -> "en"
 * This groups regional variants (like "es-419" and "es") under the same base locale.
 */
export function getLocaleBase(localeCode: string): string {
  return localeCode.split('-')[0]
}

/**
 * Marks a slug as processed for a given locale to prevent duplicate processing.
 * 
 * Groups slugs by locale base so regional variants (e.g., "es-419" and "es") 
 * are tracked together.
 */
export function addProcessedSlug(
  processedSlugs: Map<string, Set<string>>,
  localeCode: string,
  slug: string
): void {
  // Get the base locale (e.g., "es-419" -> "es")
  const localeForPath = getLocaleBase(localeCode)
  
  // Get or create the set of processed slugs for this locale base
  const slugSet = processedSlugs.get(localeForPath) ?? new Set()
  
  // Add this slug to the set
  slugSet.add(slug)
  
  // Store the updated set back in the map
  processedSlugs.set(localeForPath, slugSet)
}

/**
 * Checks if a slug has already been processed for a given locale.
 * 
 * Uses the locale base for lookup, so "es-419" and "es" are treated the same.
 */
export function isProcessed(
  processedSlugs: Map<string, Set<string>>,
  localeCode: string,
  slug: string
): boolean {
  const localeForPath = getLocaleBase(localeCode)
  
  // Check if we have processed slugs for this locale base
  if (!processedSlugs.has(localeForPath)) {
    return false
  }
  
  // Check if this specific slug has been processed
  return processedSlugs.get(localeForPath)!.has(slug)
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
 * Returns only one match per locale base (e.g., if both "es" and "es-419" files match,
 * only the first one found is returned).
 */
export function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[],
  processedSlugs: Map<string, Set<string>>
): LocaleMatch[] {
  // Map to store matches, keyed by locale base to ensure one match per locale
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

    // Get the base locale (e.g., "es-419" -> "es")
    const localeForPath = getLocaleBase(localeCode)
    
    // Only keep the first match per locale base
    // This prevents multiple regional variants from both matching
    if (!localeMatches.has(localeForPath)) {
      localeMatches.set(localeForPath, {
        localeMdx,
        matchReason: `localizes: ${englishMdx.slug}`
      })
    }
  }

  // Convert map values to array and return
  return Array.from(localeMatches.values())
}
