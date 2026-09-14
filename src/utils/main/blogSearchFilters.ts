import { foldSearchText } from '../shared/foldSearchText'
import type { Locale } from './locales'

export interface BlogSearchFilters {
  q?: string
  lang: Locale
  /** Raw category term (e.g. `Policy and Advocacy`), not a slug. */
  category?: string
}

/**
 * Client-safe blog search matcher: content language AND category AND query,
 * so clicking a category pill mid-search narrows the same query rather than
 * leaving the results unchanged (see blog-search.ts, which keeps the pills
 * live and carries `?q=` in their hrefs).
 *
 * Structural rather than `Pick<BlogSearchEntry, …>` so any record carrying
 * these fields can be filtered. Both sides of the query comparison are folded
 * so a match holds regardless of case or accents (`politica` finds
 * `política`), even though the index builder already folds `searchText`.
 *
 * Categories compare as raw terms: `BlogSearchEntry.categories` and the
 * `selectedTerm` the listing routes on are both raw `BlogCategory` strings,
 * and the slug helper lives in `tagFilter.ts`, which imports `astro:content`
 * and must never reach the client bundle.
 */
export function matchesBlogSearch(
  entry: { locale: Locale; categories: string[]; searchText: string },
  filters: BlogSearchFilters
): boolean {
  if (entry.locale !== filters.lang) return false
  if (filters.category && !entry.categories.includes(filters.category)) {
    return false
  }
  const query = foldSearchText(filters.q?.trim() ?? '')
  if (query && !foldSearchText(entry.searchText).includes(query)) return false
  return true
}

export function filterBlogPosts<
  T extends { locale: Locale; categories: string[]; searchText: string }
>(entries: T[], filters: BlogSearchFilters): T[] {
  return entries.filter((entry) => matchesBlogSearch(entry, filters))
}
