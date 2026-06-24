// Server-only environment config for the roadmap Linear sync. Imported by the
// build-snapshot module and the Netlify sync functions ONLY — never by the
// roadmap page, so a missing LINEAR_API_KEY fails the sync job loudly without
// breaking page rendering (the page reads the blob and shows an empty state).

// Vite sets PROD; in the Netlify Function runtime import.meta.env is undefined,
// so this defaults to true — missing required vars throw rather than silently
// returning null.
const isProd = import.meta.env?.PROD !== false

// Netlify CLI sets NETLIFY_DEV=true when running `netlify dev` locally.
export const isNetlifyDev = process.env.NETLIFY_DEV === 'true'

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

// Bearer token for the manual POST /api/roadmap-sync trigger.
export const API_SECRET = requireEnv('API_SECRET')

// Optional: Netlify Personal Access Token for purging the CDN cache after a sync.
export const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN ?? null

// Auto-injected by Netlify; set manually for local `netlify dev`.
export const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID ?? null
