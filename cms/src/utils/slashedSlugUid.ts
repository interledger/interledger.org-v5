/**
 * Keeps the admin's UID helpers (Generate, the Available badge) right for a
 * uid `pathSlug` stored as `/slug/` (INTORG-1254).
 *
 * Strapi's content-manager `uid` service compares raw strings: Generate looks
 * for collisions with `$startsWith: 'my-title'` and the badge counts exact
 * matches. Neither sees a stored `/my-title/`, so Generate stops adding `-1`
 * and the badge says Available until the save fails on the unique check.
 */

import { bareSlug, slugVariants, toSlashedSlug } from './relativeLinks'

/** uid fields stored with surrounding slashes. */
const SLASHED_UID_FIELDS = new Set(['pathSlug'])

export interface UidParams {
  contentTypeUID: string
  field: string
  value: string
  locale?: string
}

/** The slice of the content-manager `uid` service this patch replaces. */
export interface UidService {
  findUniqueUID: (params: UidParams) => Promise<string>
  checkUIDAvailability: (params: UidParams) => Promise<boolean>
}

/** The slice of the document service the patched methods query. */
export interface UidDocuments {
  findMany: (options: Record<string, unknown>) => Promise<unknown[]>
  count: (options: Record<string, unknown>) => Promise<number>
}

/**
 * The first free stored slug for `base`: `/base/`, else `/base-1/`,
 * `/base-2/`… as Strapi numbers them. `taken` may hold either form.
 */
export function nextFreeSlashedSlug(base: string, taken: string[]): string {
  const bare = bareSlug(base)
  const takenBare = new Set(taken.map(bareSlug))
  if (!takenBare.has(bare)) return toSlashedSlug(bare)
  let suffix = 1
  while (takenBare.has(`${bare}-${suffix}`)) suffix += 1
  return toSlashedSlug(`${bare}-${suffix}`)
}

function storedValue(document: unknown, field: string): string {
  const value = (document as Record<string, unknown> | null)?.[field]
  return typeof value === 'string' ? value : ''
}

/**
 * Patch the content-manager `uid` service in place so slashed uid fields
 * compare by bare slug. Other uid fields keep Strapi's behaviour.
 */
export function patchUidServiceForSlashedSlugs(
  service: UidService,
  documents: (contentTypeUID: string) => UidDocuments
): void {
  const findUniqueUID = service.findUniqueUID.bind(service)
  const checkUIDAvailability = service.checkUIDAvailability.bind(service)

  service.findUniqueUID = async (params) => {
    if (!SLASHED_UID_FIELDS.has(params.field)) return findUniqueUID(params)
    const bare = bareSlug(params.value)
    const found = await documents(params.contentTypeUID).findMany({
      filters: {
        $or: [
          { [params.field]: { $startsWith: bare } },
          { [params.field]: { $startsWith: `/${bare}` } }
        ]
      },
      fields: [params.field],
      locale: params.locale,
      status: 'draft'
    })
    const taken = found.map((document) => storedValue(document, params.field))
    return nextFreeSlashedSlug(bare, taken)
  }

  service.checkUIDAvailability = async (params) => {
    if (!SLASHED_UID_FIELDS.has(params.field)) {
      return checkUIDAvailability(params)
    }
    const count = await documents(params.contentTypeUID).count({
      filters: { [params.field]: { $in: slugVariants(params.value) } },
      locale: params.locale,
      status: 'draft'
    })
    return count === 0
  }
}
