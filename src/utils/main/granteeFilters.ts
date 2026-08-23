import { generateSlug } from './slug'

export const ALL_GRANTEE_YEAR_SLUG = 'all'

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
  if (query && !grantee.searchText.includes(query)) return false
  return true
}

export function filterGrantees<
  T extends { year: string; tags: string[]; searchText: string }
>(grantees: T[], filters: GranteeFilters): T[] {
  return grantees.filter((grantee) => matchesGranteeFilters(grantee, filters))
}
