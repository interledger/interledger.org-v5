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

function parseRedirectRule(value: unknown, at: string): RedirectRule | Error {
  if (!isRecord(value)) return new Error(`${at} is not an object`)
  const { source, destination, status, enabled, note } = value
  if (!isNonEmptyString(source)) return new Error(`${at}.source is not a path`)
  if (!isNonEmptyString(destination)) {
    return new Error(`${at}.destination is not a path`)
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

/**
 * Validates the shape of `src/config/redirects.json`. A missing category is
 * treated as empty; an unknown one is an error, since it means the CMS enum
 * and {@link REDIRECT_CATEGORIES} have drifted.
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
