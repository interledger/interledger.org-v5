import { generateSlug } from './slug'

export const ALL_GRANTEE_YEAR_SLUG = 'all'

export function isGranteeYearSlug(value: string): boolean {
  return value === ALL_GRANTEE_YEAR_SLUG || /^\d{4}$/.test(value)
}

/** Builds a directory listing URL, e.g. `/grant/grantee-directory/2024`. */
export function getGranteeFilterUrl(
  directoryPath: string,
  year?: string,
  tag?: string
): string {
  if (!year && !tag) return directoryPath
  const yearPath = `${directoryPath}/${year || ALL_GRANTEE_YEAR_SLUG}`
  if (!tag) return yearPath
  return `${yearPath}/${tag}`
}

export interface GranteeFilters {
  q?: string
  year: string
  tag: string
}

/**
 * Structural rather than `Pick<Grantee, …>` so any record carrying these three
 * fields can be filtered — the client-side search index ships a lighter entry
 * shape than `Grantee`. Because that widening drops the guarantee that
 * `searchText` was lower-cased upstream, the query comparison lower-cases both
 * sides here.
 */
export function matchesGranteeFilters(
  grantee: { year: string; tags: string[]; searchText: string },
  filters: GranteeFilters
): boolean {
  if (filters.year && grantee.year !== filters.year) return false
  if (
    filters.tag &&
    !grantee.tags.some((tag) => generateSlug(tag) === filters.tag)
  ) {
    return false
  }
  const query = filters.q?.trim().toLowerCase() ?? ''
  if (query && !grantee.searchText.toLowerCase().includes(query)) return false
  return true
}

export function filterGrantees<
  T extends { year: string; tags: string[]; searchText: string }
>(grantees: T[], filters: GranteeFilters): T[] {
  return grantees.filter((grantee) => matchesGranteeFilters(grantee, filters))
}
