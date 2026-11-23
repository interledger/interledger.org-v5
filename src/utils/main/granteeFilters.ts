import { foldSearchText } from '../shared/foldSearchText'
import { joinPagePath } from '../shared/url'
import { generateSlug } from './slug'

export const ALL_GRANTEE_YEAR_SLUG = 'all'

/** Path segment for every tag listing: `/grantee-directory/tag/<slug>`. */
export const GRANTEE_TAG_PREFIX = 'tag'

export function isGranteeYearSlug(value: string): boolean {
  return /^\d{4}$/.test(value)
}

/** Builds a directory listing URL, e.g. `/grant/grantee-directory/2024/`. */
export function getGranteeFilterUrl(
  directoryPath: string,
  year?: string,
  tag?: string
): string {
  const tagSlug = tag?.trim()
  return joinPagePath(
    directoryPath,
    year?.trim() ?? '',
    tagSlug ? `${GRANTEE_TAG_PREFIX}/${tagSlug}` : ''
  )
}

export interface GranteeFilters {
  q?: string
  year: string
  tag: string
}

/** The fields a project needs for the year and tag filters. */
export interface FilterableGranteeProject {
  year: string
  tags: string[]
}

/** The fields a grantee needs to be filtered: its projects and its search text. */
export interface FilterableGrantee {
  projects: FilterableGranteeProject[]
  searchText: string
}

function matchesYearAndTag(
  project: FilterableGranteeProject,
  { year, tag }: GranteeFilters
): boolean {
  if (year && project.year !== year) return false
  return (
    !tag || project.tags.some((projectTag) => generateSlug(projectTag) === tag)
  )
}

/**
 * A grantee matches when one of its projects has both the year and the tag,
 * so 2024 + Privacy needs a 2024 Privacy project, not a 2024 project and an
 * older Privacy one. The query matches the grantee's whole search text.
 * Structural, so the build listing and the lighter client search entry both
 * fit. Both sides are folded, so case and accents never matter.
 */
export function matchesGranteeFilters(
  grantee: FilterableGrantee,
  filters: GranteeFilters
): boolean {
  if (
    !grantee.projects.some((project) => matchesYearAndTag(project, filters))
  ) {
    return false
  }
  const query = foldSearchText(filters.q?.trim() ?? '')
  return !query || foldSearchText(grantee.searchText).includes(query)
}

export function filterGrantees<T extends FilterableGrantee>(
  grantees: T[],
  filters: GranteeFilters
): T[] {
  return grantees.filter((grantee) => matchesGranteeFilters(grantee, filters))
}
