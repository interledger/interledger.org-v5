import { generateSlug } from './slug'

export const ALL_GRANTEE_YEAR_SLUG = 'all'

/** Path segment for every tag listing: `/grantee-directory/tag/<slug>`. */
export const GRANTEE_TAG_PREFIX = 'tag'

export function isGranteeYearSlug(value: string): boolean {
  return /^\d{4}$/.test(value)
}

/**
 * Tag slugs whose *old* URLs already lived under `/tag/` because they
 * collided with the year/pagination slot. Used only to emit redirects from
 * those pre-prefix bookmarks; new URLs always use `GRANTEE_TAG_PREFIX`.
 */
export function isCollidingTagSlug(value: string): boolean {
  return (
    value === ALL_GRANTEE_YEAR_SLUG ||
    value === GRANTEE_TAG_PREFIX ||
    /^\d+$/.test(value)
  )
}

/** Builds a directory listing URL, e.g. `/grant/grantee-directory/2024`. */
export function getGranteeFilterUrl(
  directoryPath: string,
  year?: string,
  tag?: string
): string {
  const yearSegment = year?.trim() || undefined
  const tagSegment = tag?.trim() || undefined
  if (!yearSegment && !tagSegment) return directoryPath
  if (!yearSegment) {
    return `${directoryPath}/${GRANTEE_TAG_PREFIX}/${tagSegment}`
  }
  if (!tagSegment) return `${directoryPath}/${yearSegment}`
  return `${directoryPath}/${yearSegment}/${GRANTEE_TAG_PREFIX}/${tagSegment}`
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
