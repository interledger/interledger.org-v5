/**
 * Publish gate for future-dated content.
 *
 * Website changes are promoted from staging to production on a set cadence, so
 * a blog post scheduled for a future launch date would otherwise block every
 * unrelated promotion until its date arrived. On production the `date`
 * frontmatter field is therefore a real publish gate: a post dated in the
 * future is excluded from the collection entirely, so it cannot appear in a
 * listing, a filter, the search index or at its own URL.
 *
 * Staging, playground, deploy previews and local dev show everything, so
 * upcoming content stays fully reviewable before launch.
 *
 * This module has no imports on purpose: `astro.config.mjs` loads it directly
 * to freeze the decision into a Vite `define`, the same way it loads
 * `imageCdn.ts`.
 */

const MS_PER_DAY = 86_400_000

/**
 * Whether this build should hide future-dated posts.
 *
 * `BLOG_DATE_FILTER` is an explicit override — `on` or `off` — and wins over
 * everything. It is how the production behaviour gets verified locally, where
 * `CONTEXT` is absent.
 *
 * Otherwise it keys off Netlify's `CONTEXT`, which is set on every build of the
 * one site: `main` builds as `production`, `staging` and `playground` as
 * `branch-deploy`, PRs as `deploy-preview`. Local `astro dev` and `astro build`
 * get nothing, so they land on "show everything" by default — as does a
 * `playground` branch that never reaches Netlify at all.
 *
 * Keying off `CONTEXT` rather than `BRANCH` matches how
 * `netlify/plugins/robots-header` already decides what is production, and needs
 * no per-context env vars in netlify.toml.
 */
export function shouldHideFuturePosts(
  env: Record<string, string | undefined> = process.env
): boolean {
  const override = env.BLOG_DATE_FILTER?.trim().toLowerCase()
  if (override === 'on') return true
  if (override === 'off') return false
  return env.CONTEXT?.trim().toLowerCase() === 'production'
}

export function hideFuturePosts(): boolean {
  return typeof __HIDE_FUTURE_POSTS__ === 'boolean'
    ? __HIDE_FUTURE_POSTS__
    : shouldHideFuturePosts()
}

/**
 * Resolves the instant the gate measures "future" against.
 *
 * `BLOG_DATE_FILTER_AS_OF=<ISO date>` pins it, which is the only practical way
 * to verify the gate against real content — build twice with different values
 * rather than editing a post's date and remembering to revert it.
 */
export function resolveGateNow(
  env: Record<string, string | undefined> = process.env
): Date {
  const asOf = env.BLOG_DATE_FILTER_AS_OF?.trim()
  if (!asOf) return new Date()

  const pinned = new Date(asOf)
  if (Number.isNaN(pinned.getTime())) {
    // Silently ignoring a typo here would look like the gate misbehaving.
    console.warn(
      `[publishGate] ignoring unparseable BLOG_DATE_FILTER_AS_OF=${asOf}`
    )
    return new Date()
  }
  return pinned
}

/**
 * Whether `date` has been reached as of `now`, in UTC.
 *
 * "Reached" means strictly before the start of tomorrow UTC, rather than at or
 * before today's midnight: `z.coerce.date()` parses date-only frontmatter
 * (`2026-09-19`) as UTC midnight, but the same rule then stays correct if
 * Strapi ever emits a full timestamp — `2026-09-19T14:00:00Z` is still today.
 *
 * UTC throughout because the frontmatter values are UTC midnight and Netlify
 * builds run in UTC; reading via `getUTC*` also makes a developer's local
 * timezone irrelevant.
 *
 * A missing or unparseable date counts as published. Content must never be
 * hidden by a field nobody set.
 */
export function isPublishedAt(date: Date | undefined, now: Date): boolean {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return true

  const startOfNextUtcDay =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
    MS_PER_DAY

  return date.getTime() < startOfNextUtcDay
}
