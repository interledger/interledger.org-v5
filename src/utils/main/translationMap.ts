import { getCollection } from 'astro:content'
import { defaultLocale, switcherLocales, type Locale } from './locales'
import { ROUTE_BASES, type RouteCollection } from './routes'
import { YEARS } from './sessionize'
import { getTalks, getSpeakers } from './extractSessionize'
import { generateSlug } from './slug'
import { crossSectionCollections } from '@/lib/templates'

type TranslationEntry = Record<Locale, string>

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

  // Cross-section entries (profiles, reports) can have pathSlugs that start
  // with a URL prefix that matches another route base (e.g.
  // 'grant/fellowship/andria-barrett' where '/grant' is also the grant-pages
  // base). routeContextFromPathname strips that prefix, so the switcher looks
  // up 'fellowship/andria-barrett' — not the full slug. Add alias entries
  // under the stripped key so the lookup succeeds.
  const nonEmptyBases = Object.values(ROUTE_BASES)
    .filter((b) => b.length > 0)
    .sort((a, b) => b.length - a.length)
    .map((b) => b.slice(1)) // remove leading /

  for (const collectionName of crossSectionCollections) {
    const crossSectionEntries = await getCollection(collectionName)
    for (const entry of crossSectionEntries) {
      const { pathSlug } = entry.data
      const matchingBase = nonEmptyBases.find((base) =>
        pathSlug.startsWith(`${base}/`)
      )
      if (!matchingBase) continue

      const fullEntry = map[pathSlug]
      if (!fullEntry) continue

      const strippedKey = pathSlug.slice(matchingBase.length + 1)
      const strippedEntry = Object.fromEntries(
        Object.entries(fullEntry).map(([locale, fullSlug]) => {
          const slug = fullSlug as string
          const stripped = slug.startsWith(`${matchingBase}/`)
            ? slug.slice(matchingBase.length + 1)
            : slug
          return [locale, stripped]
        })
      ) as TranslationEntry
      map[strippedKey] = strippedEntry
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
      map[`${year}/talks/${id}`] = createFallbackEntry(`${year}/talks/${id}`)
    }

    const speakers = await getSpeakers(year)
    for (const speaker of speakers) {
      const id = generateSlug(speaker.name)
      map[`${year}/speakers/${id}`] = createFallbackEntry(
        `${year}/speakers/${id}`
      )
    }
  }

  // Add hardcoded entries for routes that are not generated from content files
  const hardcodedRoutes = ['contact']
  for (const route of hardcodedRoutes) {
    map[route] = createFallbackEntry(route)
  }
  return map
}
