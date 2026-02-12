import type { MDXFile } from './scan'

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
    .filter((localeMdx) => {
      const localeCode = localeMdx.locale || 'en'
      const localeForPath = localeCode.split('-')[0]
      if (
        processedSlugs.has(localeForPath) &&
        processedSlugs.get(localeForPath)!.has(localeMdx.slug)
      ) {
        return false
      }
      return true
    })
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
    const localeForPath = (candidate.localeMdx.locale || 'en').split('-')[0]
    if (!localeMatches.has(localeForPath)) {
      localeMatches.set(localeForPath, candidate)
    }
  }

  return Array.from(localeMatches.values())
}
