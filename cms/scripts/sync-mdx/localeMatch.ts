import type { MDXFile } from './scan'

/** Base locale from locale code (e.g. "es-419" -> "es"). */
export function getLocaleBase(localeCode: string): string {
  return localeCode.split('-')[0]
}

export function addProcessedSlug(
  processedSlugs: Map<string, Set<string>>,
  localeCode: string,
  slug: string
): void {
  const localeForPath = getLocaleBase(localeCode)
  const slugSet = processedSlugs.get(localeForPath) ?? new Set()
  slugSet.add(slug)
  processedSlugs.set(localeForPath, slugSet)
}

export function isProcessed(
  processedSlugs: Map<string, Set<string>>,
  localeCode: string,
  slug: string
): boolean {
  const localeForPath = getLocaleBase(localeCode)
  return processedSlugs.has(localeForPath) && processedSlugs.get(localeForPath)!.has(slug)
}

export interface LocaleMatch {
  localeMdx: MDXFile
  matchReason: string
}

/**
 * Find locale files that match an English entry via localizes field.
 * Returns one match per locale base (e.g., only one match for "es" even if both "es" and "es-419" match).
 */
export function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[],
  processedSlugs: Map<string, Set<string>>
): LocaleMatch[] {
  const localeMatches = new Map<string, LocaleMatch>()

  for (const localeMdx of localeFiles) {
    // Skip if already processed or doesn't match the English slug
    const localeCode = localeMdx.locale || 'en'
    if (
      isProcessed(processedSlugs, localeCode, localeMdx.slug) ||
      localeMdx.localizes !== englishMdx.slug
    ) {
      continue
    }

    // Keep only the first match per locale base
    const localeForPath = getLocaleBase(localeCode)
    if (!localeMatches.has(localeForPath)) {
      localeMatches.set(localeForPath, {
        localeMdx,
        matchReason: `localizes: ${englishMdx.slug}`
      })
    }
  }

  return Array.from(localeMatches.values())
}
