const normalizePathSlug = (slug: string) => slug.replace(/^\/+|\/+$/g, '')

const PROFILE_GRID_PATHSLUGS_RE =
  /<ProfileGrid\b[^>]*\bpathSlugs=\{\[([\s\S]*?)\]\}/g

const QUOTED_STRING_RE = /['"]([^'"]+)['"]/g

function pathSlugLookupCandidates(slug: string): string[] {
  const normalized = normalizePathSlug(slug)
  return [...new Set([normalized, `grant/${normalized}`])]
}

/** Resolves a grid pathSlug to a canonical profile pathSlug in the collection. */
export function resolveKnownProfilePathSlug(
  slug: string,
  knownPathSlugs: ReadonlySet<string>
): string | undefined {
  for (const candidate of pathSlugLookupCandidates(slug)) {
    if (knownPathSlugs.has(candidate)) return candidate
  }
  return undefined
}

/** Parses every `pathSlugs={[...]}` array on a ProfileGrid in MDX source. */
export function extractProfileGridPathSlugsFromMdx(body: string): string[][] {
  const grids: string[][] = []

  for (const match of body.matchAll(PROFILE_GRID_PATHSLUGS_RE)) {
    const raw = match[1]
    const slugs: string[] = []

    for (const slugMatch of raw.matchAll(QUOTED_STRING_RE)) {
      slugs.push(normalizePathSlug(slugMatch[1]))
    }

    if (slugs.length > 0) grids.push(slugs)
  }

  return grids
}

/**
 * Maps resolved grid members to palette indexes, preserving manual pathSlugs order
 * and skipping slugs that do not match a known profile — same rules as ProfileGrid.
 */
export function resolveGridColorIndexes(
  pathSlugs: string[],
  knownPathSlugs: ReadonlySet<string>
): Map<string, number> {
  const colorIndexByPathSlug = new Map<string, number>()
  let index = 0

  for (const slug of pathSlugs) {
    const resolved = resolveKnownProfilePathSlug(slug, knownPathSlugs)
    if (!resolved) continue
    colorIndexByPathSlug.set(resolved, index)
    index++
  }

  return colorIndexByPathSlug
}
