import { blogRouteShape } from './tagFilter'
import { podcastRouteShape } from './podcastPagination'
import { summitRouteShape } from './summit-talks-speakers'

/**
 * How to recognize a paginated URL for one section and safely strip its
 * trailing page number. Each section exports its own shape next to its
 * pagination code (blogRouteShape, podcastRouteShape, summitRouteShape) and
 * registers it in PAGINATED_ROUTE_SHAPES below.
 */
export interface PaginatedRouteShape {
  /** Does this basePath + slug belong to this section at all? */
  matches(basePath: string, parts: string[]): boolean
  /** With the trailing digit removed, is this still a real route — i.e. was
   *  the digit actually a page number, not part of the route's own slug? */
  isValidListingPrefix(prefixParts: string[]): boolean
}

/**
 * Every paginated section on the site registers its shape here (each shape
 * lives next to the pagination code it describes). Adding a new paginated
 * route means adding its shape to its own module and registering it here —
 * nothing else needs to change.
 */
export const PAGINATED_ROUTE_SHAPES: PaginatedRouteShape[] = [
  blogRouteShape,
  podcastRouteShape,
  summitRouteShape
]

/**
 * True when `parts`'s trailing digit (if any) is safe to treat as a page
 * number for the section rooted at `basePath`, rather than part of a real
 * content pathSlug (e.g. a numeric category name or a summit year) that just
 * happens to look like one.
 */
export function hasStrippablePageNumber(
  basePath: string,
  parts: string[]
): boolean {
  const last = parts.at(-1)
  if (!last || !/^\d+$/.test(last) || Number(last) <= 0) return false

  const shape = PAGINATED_ROUTE_SHAPES.find((s) => s.matches(basePath, parts))
  return shape ? shape.isValidListingPrefix(parts.slice(0, -1)) : false
}
