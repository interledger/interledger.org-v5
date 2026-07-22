// Server-only environment config for the roadmap Linear sync. Imported by the
// build-snapshot module and the Netlify sync functions ONLY — never by the
// roadmap page, so a missing LINEAR_API_KEY fails the sync job loudly without
// breaking page rendering (the page reads the blob and shows an empty state).

// Vite sets PROD; in the Netlify Function runtime import.meta.env is undefined,
// so this defaults to true — missing required vars throw rather than silently
// returning null.
const isProd = import.meta.env?.PROD !== false

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value && isProd) {
    throw new Error(`${name} is required in production`)
  }
  return value ?? ''
}

// Linear API key for fetching roadmap data (read-only scope is sufficient).
export const LINEAR_API_KEY = requireEnv('LINEAR_API_KEY')

// Linear custom view that defines the public roadmap. Non-secret, so it ships as
// a default (the "Tech Team Roadmap" view from INTORG-636) and can be overridden.
export const LINEAR_CUSTOM_VIEW_ID =
  process.env.LINEAR_CUSTOM_VIEW_ID ?? '27df73bc-50ec-4fc1-bbb2-d906236a5bbc'

// Note: API_SECRET is intentionally NOT exported here. It is only used by the
// manual roadmap-sync-now function, which reads it directly. Keeping it out of
// this shared module means the scheduled sync (which imports LINEAR_CUSTOM_VIEW_ID
// from here via build-snapshot) does not fail at cold start when API_SECRET is
// unset, since it never uses it.

// Note: the sync functions' CDN cache purging uses Netlify's token-free
// purgeCache() from the function runtime (see
// netlify/functions/utils/purge-roadmap-cache.mts), so no NETLIFY_API_TOKEN /
// NETLIFY_SITE_ID is needed there. The separate netlify/plugins/purge-roadmap
// build plugin runs in the build context instead, where a purge-capable token
// isn't always auto-injected — it requires NETLIFY_API_TOKEN to be set
// (see README "CDN caching") and skips its post-deploy purge without it.
