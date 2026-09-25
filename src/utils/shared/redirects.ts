// Imported by astro.config.mjs (via the root redirects.ts), which loads before
// Vite's `@` alias exists — keep imports relative.
import {
  REDIRECT_CATEGORIES,
  REDIRECT_STATUSES,
  type AstroRedirectTarget,
  type RedirectCategory,
  type RedirectConfig,
  type RedirectRule,
  type RedirectStatus
} from '../../types/redirects'

/** Astro's default redirect status; emitted as a bare destination string. */
const DEFAULT_REDIRECT_STATUS: RedirectStatus = 301

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRedirectCategory(key: string): key is RedirectCategory {
  return (REDIRECT_CATEGORIES as readonly string[]).includes(key)
}

function isRedirectStatus(value: unknown): value is RedirectStatus {
  return (REDIRECT_STATUSES as readonly unknown[]).includes(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

// The same guardrails Strapi enforces on save (validateRedirectInput in
// cms/src/utils/redirects.ts), repeated here so a hand-edited or corrupted
// file fails the build instead of shipping. The two projects can't import each
// other; cms/src/utils/redirectPathCases.json pins both copies to one set of
// cases.

// A pattern, query or fragment rather than one literal path. `[` is Astro's
// dynamic-route syntax; `:`/`*` are Netlify's. Patterns belong in
// public/_redirects, where their order can be controlled: Astro's Netlify
// adapter emits a dynamic destination as a literal `*` and appends its rules
// after that file [INTORG-1112].
const NON_LITERAL_SOURCE = /[[\]:*?#\s]/
// `https://` followed directly by a host. The URL parser alone isn't enough:
// it skips extra slashes, so `https:///docs` would parse with host `docs`.
const HTTPS_WITH_HOST = /^https:\/\/[^/?#\s]/i

function sourceProblem(source: string): string | undefined {
  if (!source.startsWith('/')) return 'must start with /'
  if (source.includes('//')) return 'must not contain //'
  if (NON_LITERAL_SOURCE.test(source)) {
    return 'must be one literal path (no spaces, ?, #, :, * or [])'
  }
  return undefined
}

function isHttpsUrl(value: string): boolean {
  if (!HTTPS_WITH_HOST.test(value) || !URL.canParse(value)) return false
  return new URL(value).hostname !== ''
}

function destinationProblem(destination: string): string | undefined {
  if (destination.startsWith('//')) return 'must not start with //'
  if (destination.startsWith('/') || isHttpsUrl(destination)) return undefined
  return 'must start with / or be an https:// URL with a host'
}

function parseRedirectRule(value: unknown, at: string): RedirectRule | Error {
  if (!isRecord(value)) return new Error(`${at} is not an object`)
  const { source, destination, status, enabled, note } = value
  if (!isNonEmptyString(source)) return new Error(`${at}.source is not a path`)
  const badSource = sourceProblem(source)
  if (badSource) return new Error(`${at}.source "${source}" ${badSource}`)
  if (!isNonEmptyString(destination)) {
    return new Error(`${at}.destination is not a path`)
  }
  const badDestination = destinationProblem(destination)
  if (badDestination) {
    return new Error(`${at}.destination "${destination}" ${badDestination}`)
  }
  if (!isRedirectStatus(status)) {
    return new Error(
      `${at}.status must be one of ${REDIRECT_STATUSES.join(', ')}`
    )
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return new Error(`${at}.enabled is not a boolean`)
  }
  if (note !== undefined && typeof note !== 'string') {
    return new Error(`${at}.note is not a string`)
  }
  return {
    source,
    destination,
    status,
    ...(enabled === false ? { enabled } : {}),
    ...(note ? { note } : {})
  }
}

function parseRedirectRules(
  value: unknown,
  category: RedirectCategory
): RedirectRule[] | Error {
  if (value === undefined) return []
  if (!Array.isArray(value)) return new Error(`${category} is not an array`)
  const rules: RedirectRule[] = []
  for (const [index, item] of value.entries()) {
    const rule = parseRedirectRule(item, `${category}[${index}]`)
    if (rule instanceof Error) return rule
    rules.push(rule)
  }
  return rules
}

/** The first source listed more than once, across every category. */
function findDuplicateSource(config: RedirectConfig): string | undefined {
  const seen = new Set<string>()
  for (const category of REDIRECT_CATEGORIES) {
    for (const { source } of config[category]) {
      if (seen.has(source)) return source
      seen.add(source)
    }
  }
  return undefined
}

/**
 * Validates `src/config/redirects.json`: its shape, and the path rules Strapi
 * enforces on save. A missing category is treated as empty; an unknown one is
 * an error, since it means the CMS enum and {@link REDIRECT_CATEGORIES} have
 * drifted. A duplicate source is an error because {@link toAstroRedirects}
 * would otherwise keep only the last one, silently.
 */
export function parseRedirectConfig(json: unknown): RedirectConfig | Error {
  if (!isRecord(json)) return new Error('redirect config is not an object')

  const unknownKey = Object.keys(json).find((key) => !isRedirectCategory(key))
  if (unknownKey) return new Error(`unknown redirect category "${unknownKey}"`)

  const config = {} as RedirectConfig
  for (const category of REDIRECT_CATEGORIES) {
    const rules = parseRedirectRules(json[category], category)
    if (rules instanceof Error) return rules
    config[category] = rules
  }

  const duplicate = findDuplicateSource(config)
  if (duplicate) return new Error(`source "${duplicate}" is listed twice`)
  return config
}

/** Flattens the enabled rules into the record Astro's `redirects` accepts. */
export function toAstroRedirects(
  config: RedirectConfig
): Record<string, AstroRedirectTarget> {
  const redirects: Record<string, AstroRedirectTarget> = {}
  for (const category of REDIRECT_CATEGORIES) {
    for (const { source, destination, status, enabled } of config[category]) {
      if (enabled === false) continue
      redirects[source] =
        status === DEFAULT_REDIRECT_STATUS
          ? destination
          : { status, destination }
    }
  }
  return redirects
}
