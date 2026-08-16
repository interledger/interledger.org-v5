/**
 * How to recognize a paginated URL for one section and safely strip its
 * trailing page number. Each section exports its own shape next to its
 * pagination code (blogRouteShape, podcastRouteShape, summitRouteShape) and
 * registers it in languageSwitcherHrefs.ts's PAGINATED_ROUTE_SHAPES.
 */
export interface PaginatedRouteShape {
  /** Does this basePath + slug belong to this section at all? */
  matches(basePath: string, parts: string[]): boolean
  /** With the trailing digit removed, is this still a real route — i.e. was
   *  the digit actually a page number, not part of the route's own slug? */
  isValidListingPrefix(prefixParts: string[]): boolean
}
