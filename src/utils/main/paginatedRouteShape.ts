/**
 * Declares how to recognize and safely strip a trailing pagination segment
 * from a URL slug, for one paginated route family (blog, podcast, summit
 * talks/speakers, ...).
 *
 * Each paginated section owns and exports its own shape from the same module
 * that defines its pagination (see blogRouteShape in tagFilter.ts,
 * podcastRouteShape in podcastPagination.ts, summitRouteShape in
 * summit-talks-speakers.ts). Adding a new paginated route means adding a
 * shape next to the code that creates it and registering it in
 * languageSwitcherHrefs.ts's PAGINATED_ROUTE_SHAPES — not reverse-engineering
 * a new special case from scratch in an unrelated i18n utility.
 */
export interface PaginatedRouteShape {
  /** True if this basePath + slug parts (page number still present, if any)
   *  belong to this section's paginated routes at all. */
  matches(basePath: string, parts: string[]): boolean
  /** Given `parts` with the trailing digit already removed, true if that's a
   *  real, valid non-paginated route for this section — i.e. the digit was
   *  safe to treat as a page number rather than part of a real content slug
   *  (e.g. a numeric category name or a summit year) that only looks like one. */
  isValidListingPrefix(prefixParts: string[]): boolean
}
