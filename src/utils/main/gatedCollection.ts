import {
  getCollection,
  type CollectionEntry,
  type CollectionKey
} from 'astro:content'
import { defaultLocale } from './locales'
import {
  hideDrafts,
  hideFuturePosts,
  isDraft,
  isPublishedAt,
  resolveGateNow
} from './publishGate'

/**
 * The single reader for gated content collections.
 *
 * Two gates run here. Drafts (`draft: true`) are dropped from every collection,
 * and future-dated posts from the blog. Both are on for production builds only.
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
const DATE_GATED_COLLECTIONS = new Set<CollectionKey>(['foundation-blog'])

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
  hideDrafts?: boolean
  now?: Date
}

let testOverrides: PublishGateOverrides | null = null

/**
 * Test seam. `__HIDE_FUTURE_POSTS__` and `__HIDE_DRAFTS__` are Vite `define`s
 * and `BUILD_NOW` is fixed at import time, so none can be driven from a test
 * body; tests set
 * the gate explicitly here rather than reading ambient env, so a CI runner that
 * happens to export `CONTEXT` cannot flip them.
 */
export function setPublishGateForTests(
  overrides: PublishGateOverrides | null
): void {
  testOverrides = overrides
}

interface ResolvedGate {
  hidesFuturePosts: boolean
  hidesDrafts: boolean
  now: Date
}

function resolveGate(): ResolvedGate {
  return {
    hidesFuturePosts: testOverrides?.hideFuturePosts ?? hideFuturePosts(),
    hidesDrafts: testOverrides?.hideDrafts ?? hideDrafts(),
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
  draft?: unknown
  locale?: unknown
  pathSlug?: unknown
  localizes?: unknown
  section?: unknown
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
 * Identifies the original a translation points at.
 *
 * Cross-section collections (faqs, reports, profiles) can reuse one pathSlug
 * in two sections, so the section is part of the key. `section` is not
 * localized in Strapi, so a translation carries its original's section.
 * Collections without a section key on the slug alone.
 */
function originalKey(data: GatedEntryData, slug: string): string {
  return `${readString(data.section) ?? ''}/${slug}`
}

function defaultLocaleKeys<T>(entries: T[]): Set<string> {
  const keys = new Set<string>()
  for (const entry of entries) {
    const data = readData(entry)
    const slug = readString(data.pathSlug)
    if (data.locale === defaultLocale && slug) {
      keys.add(originalKey(data, slug))
    }
  }
  return keys
}

function localizesKey(entry: unknown): string | undefined {
  const data = readData(entry)
  const localizes = readString(data.localizes)
  return localizes ? originalKey(data, localizes) : undefined
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
 * Runs only inside the date-gated branch. With the gate off nothing is
 * removed, and a translation whose `localizes` never resolved is a
 * pre-existing content bug this deliberately does not touch.
 */
function dropOrphanedTranslations<T>(published: T[]): T[] {
  const survivingOriginals = defaultLocaleKeys(published)

  return published.filter((entry) => {
    const key = localizesKey(entry)
    return key === undefined || survivingOriginals.has(key)
  })
}

/**
 * Drops translations of the originals the draft gate removed.
 *
 * The same INTORG-1239 cascade as {@link dropOrphanedTranslations}, scoped to
 * what this gate removed: a draft original takes its translations with it.
 * A translation whose `localizes` never resolved is left alone, as before,
 * so turning the draft gate on changes nothing for a collection with no
 * drafts. A draft translation of a live original is dropped on its own, and
 * its route falls back to the original's content.
 */
function dropTranslationsOfRemoved<T>(entries: T[], kept: T[]): T[] {
  if (kept.length === entries.length) return kept

  const keptOriginals = defaultLocaleKeys(kept)
  const removedOriginals = new Set(
    [...defaultLocaleKeys(entries)].filter((key) => !keptOriginals.has(key))
  )
  if (removedOriginals.size === 0) return kept

  return kept.filter((entry) => {
    const key = localizesKey(entry)
    return key === undefined || !removedOriginals.has(key)
  })
}

/**
 * `getCollection`, with draft and future-dated entries removed on production.
 *
 * Collection-agnostic so the two callers that loop over every collection —
 * `getLocalizedPaths` and `buildMap` — can swap in without a type change:
 * passing a union of collection names still yields `CollectionEntry<union>[]`.
 * The draft gate applies to every collection, and one without a `draft` field
 * passes through. The date gate applies to `DATE_GATED_COLLECTIONS` only.
 */
export async function getGatedCollection<C extends CollectionKey>(
  collection: C
): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(collection)
  const { hidesFuturePosts, hidesDrafts, now } = resolveGate()

  const finished = hidesDrafts
    ? dropTranslationsOfRemoved(
        entries,
        entries.filter((entry) => !isDraft(readData(entry)))
      )
    : entries

  if (!hidesFuturePosts || !DATE_GATED_COLLECTIONS.has(collection)) {
    return finished
  }

  const published = finished.filter((entry) =>
    isPublishedAt(readPublishDate(entry), now)
  )
  return dropOrphanedTranslations(published)
}
