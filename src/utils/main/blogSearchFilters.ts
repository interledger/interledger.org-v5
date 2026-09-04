import type { Locale } from './locales'

export interface BlogSearchFilters {
  q?: string
  lang: Locale
}

/**
 * Client-safe blog search matcher. Deliberately ignores category — search
 * results span every category in the selected content language; only the
 * TaxonomyFilter pills narrow by category, and they go inert while a search
 * query is active (see blog-search.ts).
 */
export function matchesBlogSearch(
  entry: { locale: Locale; searchText: string },
  filters: BlogSearchFilters
): boolean {
  if (entry.locale !== filters.lang) return false
  const query = filters.q?.trim().toLowerCase() ?? ''
  if (query && !entry.searchText.toLowerCase().includes(query)) return false
  return true
}

export function filterBlogPosts<
  T extends { locale: Locale; searchText: string }
>(entries: T[], filters: BlogSearchFilters): T[] {
  return entries.filter((entry) => matchesBlogSearch(entry, filters))
}
