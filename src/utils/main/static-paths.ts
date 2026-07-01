import { getCollection } from 'astro:content'
import { defaultLocale, type Locale } from './i18'

export type CollectionType =
  | 'foundation-pages'
  | 'grant-pages'
  | 'summit-pages'
  | 'foundation-blog'
  | 'developers-blog'
  | 'ambassadors'

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
