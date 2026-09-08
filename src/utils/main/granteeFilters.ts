import { generateSlug } from './slug'

export const ALL_GRANTEE_YEAR_SLUG = 'all'

/**
 * Tag-only listings share the `[year]` URL slot. Slugs that would be read as
 * a year (`all` or a 4-digit value) live under this prefix instead, e.g.
 * `/grant/grantee-directory/tag/all`. The `/all` redirect would otherwise
 * swallow a literal "all" tag, and a tag named `2024` would collide with
 * the year listing.
 */
export const GRANTEE_COLLIDING_TAG_PREFIX = 'tag'

export function isGranteeYearSlug(value: string): boolean {
  return value === ALL_GRANTEE_YEAR_SLUG || /^\d{4}$/.test(value)
}

/**
 * Tag slugs that cannot occupy `/grantee-directory/<slug>`: the all-years
 * sentinel, the reserved prefix itself, and any all-digit slug (years and
 * pagination pages like `/2`).
 */
export function isCollidingTagSlug(value: string): boolean {
  return (
    value === ALL_GRANTEE_YEAR_SLUG ||
    value === GRANTEE_COLLIDING_TAG_PREFIX ||
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
    if (isCollidingTagSlug(tagSegment)) {
      return `${directoryPath}/${GRANTEE_COLLIDING_TAG_PREFIX}/${tagSegment}`
    }
    return `${directoryPath}/${tagSegment}`
  }
  if (!tagSegment) return `${directoryPath}/${yearSegment}`
  if (isCollidingTagSlug(tagSegment)) {
    return `${directoryPath}/${yearSegment}/${GRANTEE_COLLIDING_TAG_PREFIX}/${tagSegment}`
  }
  return `${directoryPath}/${yearSegment}/${tagSegment}`
}

export interface GranteeFilters {
  q?: string
  year: string
  tag: string
}

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
