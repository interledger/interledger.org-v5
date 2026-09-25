/**
 * Strapi-owned redirects, written to `src/config/redirects.json` for Astro.
 *
 * Editors own literal `source → destination` pairs only. Rules with a
 * `:param` or `*` stay in `public/_redirects`, where a developer controls
 * their order — so pattern characters are rejected here, not just discouraged.
 *
 * Redirects are switched off, never deleted: a delete is permanent and, once
 * git-synced, only recoverable from history. A disabled redirect stays in the
 * JSON (so a re-seed keeps it) but never reaches Astro.
 *
 * The JSON shape mirrors `RedirectConfig` in `src/types/redirects.ts`; the
 * src suite checks this schema's category enum against it.
 */

import { errors } from '@strapi/utils'

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

/** Editor-facing redirect type → the HTTP status Astro emits. */
export const REDIRECT_TYPE_STATUS = {
  permanent: 301,
  temporary: 302
} as const

export type RedirectType = keyof typeof REDIRECT_TYPE_STATUS

export type RedirectStatus = (typeof REDIRECT_TYPE_STATUS)[RedirectType]

/** A redirect as stored in Strapi. */
export interface RedirectEntry {
  source: string
  destination: string
  category: RedirectCategory
  redirectType?: RedirectType | null
  /** Null on rows stored before the field existed, which count as enabled. */
  enabled?: boolean | null
  note?: string | null
}

/** One rule in `src/config/redirects.json`. */
export interface RedirectRule {
  source: string
  destination: string
  status: RedirectStatus
  /** Written only when false, so an enabled rule stays one line shorter. */
  enabled?: false
  note?: string
}

export type RedirectConfig = Record<RedirectCategory, RedirectRule[]>

// Anything that makes a source a pattern, a query or a fragment rather than
// one literal path. `[` is Astro's dynamic-route syntax; `:`/`*` are Netlify's.
const NON_LITERAL_SOURCE = /[[\]:*?#\s]/

// `https://` followed directly by a host. The URL parser alone isn't enough:
// it skips extra slashes, so `https:///docs` would parse with host `docs`.
const HTTPS_WITH_HOST = /^https:\/\/[^/?#\s]/i

/**
 * True for an absolute `https:` URL with a host, so `http://…`,
 * `https:///path` and a bare `https://` are all rejected.
 */
function isHttpsUrl(value: string): boolean {
  if (!HTTPS_WITH_HOST.test(value) || !URL.canParse(value)) return false
  return new URL(value).hostname !== ''
}

/** Trims and drops a trailing slash, which Astro would ignore anyway. */
export function normalizeRedirectSource(source: string): string {
  const trimmed = source.trim()
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed
}

function withoutTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

interface FieldError {
  path: string[]
  message: string
}

function sourceError(source: unknown): string | undefined {
  if (typeof source !== 'string' || source.trim() === '') {
    return 'Enter the old path, e.g. /old-page'
  }
  const normalized = normalizeRedirectSource(source)
  if (!normalized.startsWith('/')) {
    return 'The old path must start with / (a path on this site, not a full URL)'
  }
  if (normalized.includes('//')) return 'The old path contains //'
  if (NON_LITERAL_SOURCE.test(normalized)) {
    return 'The old path must be one exact path: no spaces, ?, #, :, * or []. Ask a developer for pattern redirects.'
  }
  return undefined
}

function destinationError(
  destination: unknown,
  source: unknown
): string | undefined {
  if (typeof destination !== 'string' || destination.trim() === '') {
    return 'Enter the new path, e.g. /new-page'
  }
  const trimmed = destination.trim()
  if (!trimmed.startsWith('/') && !isHttpsUrl(trimmed)) {
    return 'The new path must start with / or be a full https:// URL'
  }
  if (trimmed.startsWith('//')) return 'The new path must not start with //'
  if (
    typeof source === 'string' &&
    withoutTrailingSlash(trimmed) === normalizeRedirectSource(source)
  ) {
    return 'The new path is the same as the old one'
  }
  return undefined
}

/**
 * Checks one redirect write and reports every bad field at once. On update,
 * the admin sends only changed fields, so a field absent from `data` is left
 * alone — the stored value already passed this check.
 */
export function validateRedirectInput(
  data: Record<string, unknown>,
  { isCreate }: { isCreate: boolean }
): errors.ValidationError | undefined {
  const fieldErrors: FieldError[] = []

  if (isCreate || 'source' in data) {
    const message = sourceError(data.source)
    if (message) fieldErrors.push({ path: ['source'], message })
  }
  if (isCreate || 'destination' in data) {
    const message = destinationError(data.destination, data.source)
    if (message) fieldErrors.push({ path: ['destination'], message })
  }

  if (fieldErrors.length === 0) return undefined
  return new errors.ValidationError(fieldErrors[0]!.message, {
    errors: fieldErrors.map(({ path, message }) => ({
      path,
      message,
      name: 'ValidationError'
    }))
  })
}

/** Normalizes `source` in place so the stored value is the canonical path. */
export function normalizeRedirectInput(data: Record<string, unknown>): void {
  if (typeof data.source === 'string') {
    data.source = normalizeRedirectSource(data.source)
  }
  if (typeof data.destination === 'string') {
    data.destination = data.destination.trim()
  }
}

function compareBySource(a: RedirectRule, b: RedirectRule): number {
  if (a.source < b.source) return -1
  return a.source > b.source ? 1 : 0
}

/** A stored `enabled` of null predates the field, so it means enabled. */
export function isRedirectEnabled(entry: { enabled?: unknown }): boolean {
  return entry.enabled !== false
}

function toRedirectRule(entry: RedirectEntry): RedirectRule {
  const status = REDIRECT_TYPE_STATUS[entry.redirectType ?? 'permanent']
  const note = entry.note?.trim()
  return {
    source: entry.source,
    destination: entry.destination,
    status,
    ...(isRedirectEnabled(entry) ? {} : { enabled: false as const }),
    ...(note ? { note } : {})
  }
}

/**
 * Groups stored redirects into the JSON Astro reads. Every category is
 * written, even when empty, and each is sorted by source (code-point order,
 * so the result doesn't depend on the server's locale) to keep diffs small.
 */
export function serializeRedirectConfig(
  entries: RedirectEntry[]
): RedirectConfig {
  const config = Object.fromEntries(
    REDIRECT_CATEGORIES.map((category) => [category, [] as RedirectRule[]])
  ) as RedirectConfig

  for (const entry of entries) {
    const rules = config[entry.category]
    if (!rules) {
      console.warn(
        `⚠️  Redirect ${entry.source} has unknown category "${entry.category}" — skipped`
      )
      continue
    }
    rules.push(toRedirectRule(entry))
  }

  for (const category of REDIRECT_CATEGORIES) {
    config[category].sort(compareBySource)
  }
  return config
}

/** The slice of the Strapi document service the link check needs. */
export interface RedirectFinder {
  findMany: (options: Record<string, unknown>) => Promise<unknown[]>
  findOne: (options: Record<string, unknown>) => Promise<unknown>
}

export interface RedirectLinkCheck {
  documents: RedirectFinder
  /** Raw `ctx.params.data` from the document-service middleware. */
  data: Record<string, unknown>
  /** Present on update, absent on create. */
  documentId?: string
}

interface StoredRedirect {
  documentId?: unknown
  source?: unknown
  destination?: unknown
  enabled?: unknown
}

interface EffectiveRedirect {
  source?: string
  destination?: string
  enabled: boolean
}

const LINK_FIELDS = ['source', 'destination', 'enabled']

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined
}

/**
 * The source, destination and enabled state this write ends up with. An admin
 * update sends only the changed fields, so the rest comes from the stored entry.
 */
async function resolveEffectiveRedirect(
  check: RedirectLinkCheck
): Promise<EffectiveRedirect> {
  const { data } = check
  const needsStored =
    check.documentId !== undefined &&
    !(
      asNonEmptyString(data.source) &&
      asNonEmptyString(data.destination) &&
      typeof data.enabled === 'boolean'
    )
  const stored = needsStored
    ? ((await check.documents.findOne({
        documentId: check.documentId,
        fields: LINK_FIELDS
      })) as StoredRedirect | null)
    : null

  const source =
    asNonEmptyString(data.source) ?? asNonEmptyString(stored?.source)
  return {
    source: source && normalizeRedirectSource(source),
    destination:
      asNonEmptyString(data.destination) ??
      asNonEmptyString(stored?.destination),
    enabled: isRedirectEnabled('enabled' in data ? data : (stored ?? {}))
  }
}

/**
 * Another enabled redirect matching `filters`. Filtered for `enabled` here,
 * not in the query: rows stored before the field existed hold null, which a
 * SQL `enabled = true` would miss.
 */
async function findOtherEnabledRedirect(
  check: RedirectLinkCheck,
  filters: Record<string, unknown>
): Promise<StoredRedirect | undefined> {
  const matches = (await check.documents.findMany({
    filters,
    fields: LINK_FIELDS
  })) as StoredRedirect[]
  return matches.find(
    (entry) => entry.documentId !== check.documentId && isRedirectEnabled(entry)
  )
}

function linkError(
  field: 'source' | 'destination',
  message: string
): errors.ValidationError {
  return new errors.ValidationError(message, {
    errors: [{ path: [field], message, name: 'ValidationError' }]
  })
}

/**
 * Rejects a redirect that points at itself or would form a chain with another
 * enabled one. A chain costs visitors an extra hop, and `src/redirects.test.ts`
 * fails on one, so letting it through here would block the next developer PR.
 * Re-enabling a redirect runs the chain check again, since the other side of
 * the chain may have changed while it was off.
 */
export async function validateRedirectLinks(
  check: RedirectLinkCheck
): Promise<errors.ValidationError | undefined> {
  const { source, destination, enabled } = await resolveEffectiveRedirect(check)
  // Missing or malformed values are validateRedirectInput's job.
  if (!source || !destination) return undefined

  const target = withoutTrailingSlash(destination)
  if (target === source) {
    return linkError('destination', 'The new path is the same as the old one')
  }
  // A disabled redirect never reaches Astro, so it can't be part of a chain.
  if (!enabled) return undefined

  const onward = await findOtherEnabledRedirect(check, { source: target })
  if (onward) {
    return linkError(
      'destination',
      `${target} already redirects to ${String(onward.destination)}. Point this redirect straight at ${String(onward.destination)} instead.`
    )
  }

  const incoming = await findOtherEnabledRedirect(check, {
    destination: { $in: [source, `${source}/`] }
  })
  if (incoming) {
    return linkError(
      'source',
      `${String(incoming.source)} already redirects to ${source}. Update that redirect to point at ${destination} instead, then save this one.`
    )
  }
  return undefined
}

function statusToRedirectType(status: number): RedirectType | Error {
  const match = (
    Object.entries(REDIRECT_TYPE_STATUS) as [RedirectType, number][]
  ).find(([, code]) => code === status)
  return match ? match[0] : new Error(`Unsupported redirect status ${status}`)
}

/**
 * The inverse of {@link serializeRedirectConfig}: flattens the grouped JSON
 * into the rows Strapi stores. Used to seed Strapi from the committed file.
 */
export function redirectConfigToEntries(
  config: Partial<RedirectConfig>
): RedirectEntry[] | Error {
  const entries: RedirectEntry[] = []
  for (const category of REDIRECT_CATEGORIES) {
    for (const rule of config[category] ?? []) {
      const redirectType = statusToRedirectType(rule.status)
      if (redirectType instanceof Error) {
        return new Error(`${rule.source}: ${redirectType.message}`)
      }
      entries.push({
        source: rule.source,
        destination: rule.destination,
        category,
        redirectType,
        enabled: isRedirectEnabled(rule),
        note: rule.note ?? null
      })
    }
  }
  return entries
}

/**
 * Refuses every delete. Returned rather than thrown so the middleware owns
 * control flow; the admin shows the message as a toast.
 */
export function redirectDeleteError(): errors.ValidationError {
  return new errors.ValidationError(
    'Redirects can’t be deleted. Switch “Enabled” off instead — the redirect stops working on the next deploy and can be switched back on at any time.'
  )
}
