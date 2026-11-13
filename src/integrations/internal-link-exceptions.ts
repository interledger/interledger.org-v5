/**
 * Internal link targets exempted from `validate-internal-links`.
 *
 * Write each target exactly as the audit reports it: a normalised path, no
 * trailing slash, optional `#fragment`. Matched exactly — no globs, so a
 * whole class of broken target means the resolver needs fixing, not a
 * wildcard here. Every entry needs a comment saying why. Entries that stop
 * being needed are warned about, not failed.
 *
 * To defer a redirect whose destination 404s, list its **source**. Listing the
 * destination would also hide direct links to that path.
 */
export const INTERNAL_LINK_EXCEPTIONS: readonly string[] = []
