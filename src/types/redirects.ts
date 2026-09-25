/**
 * Sections of `src/config/redirects.json`, in the order they are written.
 * Mirrored by the `category` enum of the Strapi `redirect` content type; a
 * test in `src/redirects.test.ts` keeps the two in step.
 */
export const REDIRECT_CATEGORIES = [
  'site_pages',
  'site_pages_es',
  'policy_advocacy',
  'blog_news_migration',
  'blog_taxonomy',
  'developers_blog_migration',
  'hackathon',
  'summit'
] as const

export type RedirectCategory = (typeof REDIRECT_CATEGORIES)[number]

export const REDIRECT_STATUSES = [301, 302] as const

export type RedirectStatus = (typeof REDIRECT_STATUSES)[number]

export interface RedirectRule {
  source: string
  destination: string
  status: RedirectStatus
  /**
   * Written only when false. A disabled rule stays in the file so re-seeding
   * Strapi keeps it, but never reaches Astro — editors switch redirects off
   * rather than deleting them.
   */
  enabled?: false
  /** Why the redirect exists, for readers of the JSON and editors in Strapi. */
  note?: string
}

/** The shape of `src/config/redirects.json`, written by Strapi. */
export type RedirectConfig = Record<RedirectCategory, RedirectRule[]>

/** The value Astro's `redirects` config accepts for one source. */
export type AstroRedirectTarget =
  | string
  | { status: RedirectStatus; destination: string }
