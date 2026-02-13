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
  if (!processedSlugs.has(localeForPath)) {
    processedSlugs.set(localeForPath, new Set())
  }
  processedSlugs.get(localeForPath)!.add(slug)
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
 */
export function findMatchingLocales(
  englishMdx: MDXFile,
  localeFiles: MDXFile[],
  processedSlugs: Map<string, Set<string>>
): LocaleMatch[] {
  const candidateLocales = localeFiles
    .filter(
      (localeMdx) => !isProcessed(processedSlugs, localeMdx.locale || 'en', localeMdx.slug)
    )
    .filter((localeMdx) => {
      const localeLocalizes =
        localeMdx.localizes || localeMdx.frontmatter.localizes
      return localeLocalizes === englishMdx.slug
    })
    .map((localeMdx): LocaleMatch => ({
      localeMdx,
      matchReason: `localizes: ${englishMdx.slug}`
    }))

  const localeMatches = new Map<string, LocaleMatch>()
  for (const candidate of candidateLocales) {
    const localeForPath = getLocaleBase(candidate.localeMdx.locale || 'en')
    if (!localeMatches.has(localeForPath)) {
      localeMatches.set(localeForPath, candidate)
    }
  }

  return Array.from(localeMatches.values())
}
