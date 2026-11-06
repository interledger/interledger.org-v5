/** One blog pathSlug segment. Same set as `BLOG_SLUG_SEGMENT` in the CMS. */
const BLOG_SLUG_SEGMENT = '[A-Za-z0-9._~-]+'

const BLOG_ARTICLE_PATH = new RegExp(`^/blog/(${BLOG_SLUG_SEGMENT})/?$`)

/**
 * `/blog/my-post/` and a legacy bare `my-post` both become `my-post`.
 * Lowercased so `/blog/Interledger-Universe/` matches the post slug
 * `interledger-universe`.
 *
 * Lives in `src/schemas` on purpose. CMS vitest transforms
 * `content.ts` with only `cms/` installed (`src/schemas/tsconfig.json`).
 * An import from outside this folder uses the repo tsconfig, which
 * extends `astro/tsconfigs/strict`, and that job fails.
 */
export function relatedArticlePathSlug(value: string): string {
  const match = BLOG_ARTICLE_PATH.exec(value.trim())
  const segment = match?.[1] ?? value.trim().replace(/^\/+|\/+$/g, '')
  return segment.toLowerCase()
}
