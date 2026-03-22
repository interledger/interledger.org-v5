import { getCollection } from 'astro:content'
import { defaultLocale, type Locale } from '@/utils/i18'

export type CollectionType =
  | 'foundation-pages'
  | 'summit-pages'
  | 'foundation-blog'
  | 'developers-blog'

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
 *     emit the ES slug with locale 'es'.
 *   - Otherwise, emit the EN slug with locale defaultLocale, flagged as a fallback.
 *     This ensures no EN-only page produces a 404 under /es/.
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
      toPath(paramName, entry.data.pathSlug, defaultLocale, false)
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
      ? toPath(paramName, localizedEntry.data.pathSlug, lang, false)
      : toPath(paramName, enEntry.data.pathSlug, defaultLocale, true)
  })
}

function getEntriesForDefaultLocale(
  entries: Entry[],
  locale: Locale,
  excludeSlug?: string
): Entry[] {
  return entries
    .filter((e) => e.data.locale === locale)
    .filter((e) => !excludeSlug || e.data.pathSlug !== excludeSlug)
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
