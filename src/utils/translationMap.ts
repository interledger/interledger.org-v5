import { getCollection } from 'astro:content'
import { defaultLocale, switcherLocales, type Locale } from '@/utils/i18'
import { ROUTE_BASES, type RouteCollection } from '@/utils/routes'
import { YEARS } from './sessionize'
import { getTalks, getSpeakers } from './extractSessionize'
import { generateSlug } from './slug'

export type TranslationEntry = Record<Locale, string>

function createFallbackEntry(defaultSlug: string): TranslationEntry {
  return Object.fromEntries(
    switcherLocales.map((locale) => [locale, defaultSlug])
  ) as TranslationEntry
}

// Returns a map of pathSlug -> { [locale]: slug }.
// Every EN entry is indexed for all locales using the EN slug as the fallback URL.
// Localized entries overwrite that fallback for their own locale and are indexed
// from both the localized slug and the EN slug they translate.
export async function buildMap(): Promise<Record<string, TranslationEntry>> {
  const collectionNames = Object.keys(ROUTE_BASES) as RouteCollection[]

  const map: Record<string, TranslationEntry> = {}

  for (const name of collectionNames) {
    const entries = await getCollection(name)
    const defaultEntries = entries.filter(
      (entry) => entry.data.locale === defaultLocale
    )
    const localizedEntries = entries.filter(
      (entry) => entry.data.locale && entry.data.locale !== defaultLocale
    )

    for (const defaultEntry of defaultEntries) {
      const { pathSlug } = defaultEntry.data
      map[pathSlug] = createFallbackEntry(pathSlug)
    }

    for (const localizedEntry of localizedEntries) {
      const { pathSlug, localizes, locale } = localizedEntry.data
      if (!localizes) continue
      if (!locale) continue

      const pair = map[localizes] ?? createFallbackEntry(localizes)
      pair[locale as Locale] = pathSlug
      map[pathSlug] = pair
      map[localizes] = pair
    }
  }

  // Create map entries for sessionize pages, as they are not part of the
  // content collections and need to be added manually
  // The pages will have the same slug across all locales
  for (const year of YEARS) {
    map[`${year}/talks`] = createFallbackEntry(`${year}/talks`)
    map[`${year}/speakers`] = createFallbackEntry(`${year}/speakers`)

    const talks = await getTalks(year)
    for (const talk of talks) {
      const id = generateSlug(talk.title)
      map[`${year}/talk/${id}`] = createFallbackEntry(`${year}/talk/${id}`)
    }

    const speakers = await getSpeakers(year)
    for (const speaker of speakers) {
      const id = generateSlug(speaker.name)
      map[`${year}/speaker/${id}`] = createFallbackEntry(
        `${year}/speaker/${id}`
      )
    }
  }
  return map
}
