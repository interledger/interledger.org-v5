import { getCollection } from 'astro:content'

export interface TranslationEntry {
  en: string
  es: string
}

type TranslationCollection =
  | 'foundation-pages'
  | 'foundation-blog'
  | 'developers-blog'
  | 'summit-pages'

// Returns a map of pathSlug -> { en: slug, es: slug }
// Works from both sides: en slugs and es slugs are both indexed.
export async function buildTranslationMap(): Promise<
  Record<string, TranslationEntry>
> {
  const collectionNames: TranslationCollection[] = [
    'foundation-pages',
    'foundation-blog',
    'developers-blog',
    'summit-pages'
  ]

  const map: Record<string, TranslationEntry> = {}

  for (const name of collectionNames) {
    const entries = await getCollection(name)
    const enEntries = entries.filter((entry) => entry.data.locale === 'en')
    const esEntries = entries.filter((entry) => entry.data.locale === 'es')

    for (const esEntry of esEntries) {
      const { pathSlug, localizes } = esEntry.data
      if (!localizes) continue

      const pair: TranslationEntry = { en: localizes, es: pathSlug }
      map[pathSlug] = pair
      map[localizes] = pair
    }

    for (const enEntry of enEntries) {
      const { pathSlug } = enEntry.data
      if (!map[pathSlug]) {
        map[pathSlug] = { en: pathSlug, es: pathSlug }
      }
    }
  }

  return map
}
