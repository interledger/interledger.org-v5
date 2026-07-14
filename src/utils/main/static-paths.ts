import { getCollection } from 'astro:content'
import {
  crossSectionCollections,
  type CrossSectionCollection
} from '@/lib/templates'
import { defaultLocale, type Locale } from './i18'

export type CollectionType =
  | 'foundation-pages'
  | 'grant-pages'
  | 'grant-overview-pages'
  | 'summit-pages'
  | 'foundation-blog'
  | 'developers-blog'
  | 'profiles'

type Entry = Awaited<ReturnType<typeof getCollection>>[number]

type LocalizedPath = {
  params: Record<string, string>
  props: {
    slug: string
    locale: Locale
    isFallback: boolean
  }
}

type Options = {
  excludeSlug?: string
}

/**
 * Builds static paths for a localized collection route.
 *
 * EN routes: one path per EN entry.
 *
 * ES routes: one path per EN entry, resolved as follows:
 *   - If an ES entry exists with `localizes === enEntry.pathSlug`,
 *     emit the ES slug with locale 'es' and `isFallback: false`.
 *   - Otherwise, emit the EN slug with locale defaultLocale.
 *     Mark that path with `isFallback: true`.
 *
 * This is intentionally one-way:
 *   - EN is canonical
 *   - ES may fall back to EN content
 *   - EN never falls back to ES content
 */
export async function getLocalizedPaths(
  collection: CollectionType,
  lang: Locale,
  paramName: string,
  options: Options = {}
): Promise<LocalizedPath[]> {
  const allEntries = await getCollection(collection)

  const defaultEntries = getEntriesForDefaultLocale(
    allEntries,
    defaultLocale,
    options.excludeSlug
  )

  if (lang === defaultLocale) {
    return defaultEntries.map((entry) =>
      toPath(
        paramName,
        routeSegmentForCollection(entry.data),
        defaultLocale,
        false
      )
    )
  }

  const localizedEntriesByLocalizes = indexLocalizedEntriesByLocalizes(
    allEntries,
    lang
  )

  return defaultEntries.map((enEntry) => {
    const localizedEntry = localizedEntriesByLocalizes.get(
      enEntry.data.pathSlug
    )
    return localizedEntry
      ? toPath(
          paramName,
          routeSegmentForCollection(localizedEntry.data),
          lang,
          false
        )
      : toPath(
          paramName,
          routeSegmentForCollection(enEntry.data),
          defaultLocale,
          true
        )
  })
}

/** URL segment from collection entry (`pathSlug` is normalized by content schemas). */
function routeSegmentForCollection(data: Entry['data']): string {
  return (data as { pathSlug: string }).pathSlug
}

/** Site sections a cross-section entry can live in. Matches the `section` frontmatter field. */
export type SiteSection = 'foundation' | 'summit' | 'hackathon'

/** Render-dispatch discriminant for cross-section template collections. */
type CrossSectionKind = 'profile' | 'faq'

type CrossSectionPath = {
  params: Record<string, string>
  props: {
    slug: string
    locale: Locale
    isFallback: boolean
    kind: CrossSectionKind
  }
}

function toCrossSectionPath(
  paramName: string,
  slug: string,
  locale: Locale,
  isFallback: boolean,
  kind: CrossSectionKind
): CrossSectionPath {
  return {
    params: { [paramName]: slug },
    props: { slug, locale, isFallback, kind }
  }
}

/**
 * Builds static paths for a cross-section template collection within a
 * single site section.
 *
 * Every entry in `collection` lives in one flat collection but renders under
 * different URL trees driven by the `section` frontmatter field. The route
 * param and `props.slug` are both the section-relative `pathSlug` (no section
 * prefix).
 *
 * Localization follows the same EN-canonical / ES-fallback rules as
 * {@link getLocalizedPaths}.
 */
async function getSectionFilteredPaths(
  collection: CrossSectionCollection,
  kind: CrossSectionKind,
  section: SiteSection,
  lang: Locale,
  paramName: string
): Promise<CrossSectionPath[]> {
  const allEntries = await getCollection(collection)

  const enEntries = allEntries.filter(
    (e) => e.data.locale === defaultLocale && e.data.section === section
  )

  if (lang === defaultLocale) {
    return enEntries.map((e) =>
      toCrossSectionPath(
        paramName,
        routeSegmentForCollection(e.data),
        defaultLocale,
        false,
        kind
      )
    )
  }

  const localizedByLocalizes = indexLocalizedEntriesByLocalizes(
    allEntries,
    lang
  )

  return enEntries.map((enEntry) => {
    const enSlug = routeSegmentForCollection(enEntry.data)
    const localizedEntry = localizedByLocalizes.get(enSlug)
    return localizedEntry
      ? toCrossSectionPath(
          paramName,
          routeSegmentForCollection(localizedEntry.data),
          lang,
          false,
          kind
        )
      : toCrossSectionPath(paramName, enSlug, defaultLocale, true, kind)
  })
}

async function getPathsForCrossSectionCollection(
  collection: CrossSectionCollection,
  section: SiteSection,
  lang: Locale,
  paramName: string
): Promise<CrossSectionPath[]> {
  switch (collection) {
    case 'profiles':
      return getSectionFilteredPaths(
        'profiles',
        'profile',
        section,
        lang,
        paramName
      )
    case 'faqs':
      return getSectionFilteredPaths('faqs', 'faq', section, lang, paramName)
    default: {
      const _exhaustive: never = collection
      return _exhaustive
    }
  }
}

/**
 * Builds static paths for all cross-section template collections in a section.
 * Driven by {@link crossSectionCollections} — add new template types there.
 */
export async function getCrossSectionPaths(
  section: SiteSection,
  lang: Locale,
  paramName: string
): Promise<CrossSectionPath[]> {
  const results = await Promise.all(
    crossSectionCollections.map((collection) =>
      getPathsForCrossSectionCollection(collection, section, lang, paramName)
    )
  )
  return results.flat()
}

function getEntriesForDefaultLocale(
  entries: Entry[],
  locale: Locale,
  excludeSlug: string | undefined
): Entry[] {
  return entries
    .filter((e) => e.data.locale === locale)
    .filter((e) => {
      if (!excludeSlug) return true
      return routeSegmentForCollection(e.data) !== excludeSlug
    })
}

/**
 * Builds a Map of ES entries keyed by their `localizes` field,
 * which references the EN pathSlug they translate.
 */
function indexLocalizedEntriesByLocalizes(
  entries: Entry[],
  lang: Locale
): Map<string, Entry> {
  const map = new Map<string, Entry>()
  for (const entry of entries) {
    if (entry.data.locale === lang && entry.data.localizes) {
      map.set(entry.data.localizes, entry)
    }
  }
  return map
}

function toPath(
  paramName: string,
  slug: string,
  locale: Locale,
  isFallback: boolean
): LocalizedPath {
  return {
    params: { [paramName]: slug },
    props: { slug, locale, isFallback }
  }
}
