import {
  getCollection,
  type CollectionEntry,
  type CollectionKey
} from 'astro:content'
import type { BlogCollectionType } from '@/content.config'
import { sortByPublishDateDesc } from './blog'
import { defaultLocale, type Locale } from './locales'
import { hideFuturePosts, isPublishedAt, resolveGateNow } from './publishGate'

/**
 * The single reader for gated content collections.
 *
 * Blog posts are read from six independent places — listings and pagination,
 * the search index, static paths, the featured strip, the post detail page and
 * the language-switcher map — and nothing funnelled them through a shared
 * loader. Six separate date filters would drift, and a route set that
 * disagreed with the translation map or the category pills is exactly the way
 * a future-dated post leaks onto production. Everything reads through here
 * instead, so the gate runs in one place.
 *
 * Gating in the `glob()` loader itself was the alternative. It was rejected
 * because the loader is incremental and persists its output in
 * `.astro/data-store.json`: the cutoff would freeze at whenever the loader last
 * ran rather than at build time, and flipping the flag would need a cache wipe.
 */

/**
 * Collections whose `date` field is a publish date rather than just display
 * metadata. Keyed by collection name on purpose — `reports` also has a `date`,
 * but it is an object (`{ publishDate, lastUpdated }`), so sniffing for the
 * field would gate the wrong thing.
 */
const GATED_COLLECTIONS = new Set<CollectionKey>(['foundation-blog'])

/**
 * Frozen once, at module load.
 *
 * A production build that starts at 23:59:50 UTC would otherwise gate the
 * listing on one day and the static paths on the next, emitting a post's URL
 * while no listing links to it. One module reading one instant removes that.
 *
 * The same freeze means a dev server left running past midnight keeps
 * yesterday's cutoff — harmless, since the gate is off in dev.
 */
const BUILD_NOW = resolveGateNow()

interface PublishGateOverrides {
  hideFuturePosts?: boolean
  now?: Date
}

let testOverrides: PublishGateOverrides | null = null

/**
 * Test seam. `__HIDE_FUTURE_POSTS__` is a Vite `define` and `BUILD_NOW` is
 * fixed at import time, so neither can be driven from a test body; tests set
 * the gate explicitly here rather than reading ambient env, so a CI runner that
 * happens to export `CONTEXT` cannot flip them.
 */
export function setPublishGateForTests(
  overrides: PublishGateOverrides | null
): void {
  testOverrides = overrides
}

function resolveGate(): { enabled: boolean; now: Date } {
  return {
    enabled: testOverrides?.hideFuturePosts ?? hideFuturePosts(),
    now: testOverrides?.now ?? BUILD_NOW
  }
}

/**
 * Reads frontmatter off an entry of an unknown collection.
 *
 * Typed as `unknown` rather than narrowed: `collection !== 'foundation-blog'`
 * does not narrow the generic `C`, so `entry.data` stays opaque inside a
 * generic function. Each field is therefore guarded at the point of use.
 */
interface GatedEntryData {
  date?: unknown
  locale?: unknown
  pathSlug?: unknown
  localizes?: unknown
}

function readData(entry: unknown): GatedEntryData {
  return (entry as { data?: GatedEntryData })?.data ?? {}
}

/**
 * The `instanceof Date` guard is what keeps an object-shaped `date` (see
 * `reports`) out of trouble.
 */
function readPublishDate(entry: unknown): Date | undefined {
  const value = readData(entry).date
  return value instanceof Date ? value : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Drops translations whose original did not survive the date gate.
 *
 * The gate filters each entry on its own `date`, but `getLocalizedPaths` builds
 * every non-default-locale route from the *default-locale* entry list — so a
 * translation is only reachable when its `localizes` target is still there.
 * Nothing forces a translation to carry its original's date, so a translation
 * dated in the past outlives a scheduled original: the listing, the category
 * pills, the cross-language routes and the search index would all advertise a
 * URL that was never built (INTORG-1239).
 *
 * Runs only inside the gated branch. With the gate off nothing is removed, and
 * a translation whose `localizes` never resolved is a pre-existing content bug
 * this deliberately does not touch.
 */
function dropOrphanedTranslations<T>(published: T[]): T[] {
  const survivingOriginals = new Set(
    published
      .filter((entry) => readData(entry).locale === defaultLocale)
      .map((entry) => readString(readData(entry).pathSlug))
      .filter((slug): slug is string => slug !== undefined)
  )

  return published.filter((entry) => {
    const localizes = readString(readData(entry).localizes)
    if (!localizes) return true
    return survivingOriginals.has(localizes)
  })
}

/**
 * `getCollection`, with future-dated entries removed on production.
 *
 * Collection-agnostic so the two callers that loop over every collection —
 * `getLocalizedPaths` and `buildMap` — can swap in without a type change:
 * passing a union of collection names still yields `CollectionEntry<union>[]`.
 * Ungated collections pass straight through.
 */
export async function getGatedCollection<C extends CollectionKey>(
  collection: C
): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(collection)
  if (!GATED_COLLECTIONS.has(collection)) return entries

  const { enabled, now } = resolveGate()
  if (!enabled) return entries

  const published = entries.filter((entry) =>
    isPublishedAt(readPublishDate(entry), now)
  )
  return dropOrphanedTranslations(published)
}

/**
 * Blog posts, gated and newest-first, optionally scoped to one content locale.
 *
 * This is what every blog reader should call. Sorting here rather than at each
 * call site is deliberate: the listing order is a property of the collection,
 * not of whoever happens to be rendering it.
 */
export async function getBlogPosts({
  collection = 'foundation-blog',
  locale
}: {
  collection?: BlogCollectionType
  locale?: Locale
} = {}): Promise<CollectionEntry<'foundation-blog'>[]> {
  const entries = await getGatedCollection(collection)
  const scoped = locale
    ? entries.filter((entry) => entry.data.locale === locale)
    : entries

  return sortByPublishDateDesc(scoped)
}
