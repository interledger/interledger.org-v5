/**
 * Strapi-owned redirects, written to `src/config/redirects.json` for Astro.
 *
 * Editors own literal `source → destination` pairs only. Rules with a
 * `:param` or `*` stay in `public/_redirects`, where a developer controls
 * their order — so pattern characters are rejected here, not just discouraged.
 *
 * Editors switch redirects off rather than delete them: a delete is permanent
 * and, once git-synced, only recoverable from history. A disabled redirect
 * stays in the JSON (so a re-seed keeps it) but never reaches Astro. Removal
 * is a code change: drop the entry from the JSON and the sync deletes the row.
 *
 * The JSON shape mirrors `RedirectConfig` in `src/types/redirects.ts`; the
 * src suite checks this schema's category enum against it.
 */

import { errors } from '@strapi/utils'
import { createAsyncLock } from './asyncLock'

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

// Browsers read `\` as `/` and drop tabs and line breaks, so `/\evil.example`
// or `/<tab>/evil.example` becomes the off-site `//evil.example`.
const URL_SLASH_LOOKALIKE = /[\\\t\n\r]/

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

/**
 * The on-site path a destination sends visitors to, in the form sources are
 * stored in: query, fragment and trailing slash dropped. Netlify matches a
 * source by path alone, so `/second?x=1` and `/second#top` still hit a
 * `/second` redirect. Undefined for an external https URL, which leaves the
 * site and can't chain with our rules.
 */
export function redirectTargetPath(destination: string): string | undefined {
  const trimmed = destination.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined
  return withoutTrailingSlash(trimmed.split(/[?#]/, 1)[0]!)
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
  if (URL_SLASH_LOOKALIKE.test(trimmed)) {
    return 'The new path must not contain backslashes or line breaks'
  }
  if (
    typeof source === 'string' &&
    redirectTargetPath(trimmed) === normalizeRedirectSource(source)
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
/**
 * Another enabled redirect matching `filters` and, when given, `matches`: the
 * query narrows the candidates and `matches` makes the exact call where a
 * filter can't express it.
 */
async function findOtherEnabledRedirect(
  check: RedirectLinkCheck,
  filters: Record<string, unknown>,
  matches: (entry: StoredRedirect) => boolean = () => true
): Promise<StoredRedirect | undefined> {
  const candidates = (await check.documents.findMany({
    filters,
    fields: LINK_FIELDS
  })) as StoredRedirect[]
  return candidates.find(
    (entry) =>
      entry.documentId !== check.documentId &&
      isRedirectEnabled(entry) &&
      matches(entry)
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

  const target = redirectTargetPath(destination)
  if (target === source) {
    return linkError('destination', 'The new path is the same as the old one')
  }
  // A disabled redirect never reaches Astro, so it can't be part of a chain.
  if (!enabled) return undefined

  const onward =
    target && (await findOtherEnabledRedirect(check, { source: target }))
  if (onward) {
    return linkError(
      'destination',
      `${target} already redirects to ${String(onward.destination)}. Point this redirect straight at ${String(onward.destination)} instead.`
    )
  }

  // Every destination whose path is this source, whatever query, fragment
  // or trailing slash follows it: the prefix narrows, the path decides.
  const incoming = await findOtherEnabledRedirect(
    check,
    { destination: { $startsWith: source } },
    (entry) =>
      typeof entry.destination === 'string' &&
      redirectTargetPath(entry.destination) === source
  )
  if (incoming) {
    return linkError(
      'source',
      `${String(incoming.source)} already redirects to ${source}. Update that redirect to point at ${destination} instead, then save this one.`
    )
  }
  return undefined
}

/** One redirect create or update, as the document-service middleware sees it. */
export interface RedirectWrite {
  documents: RedirectFinder
  /** Raw `ctx.params.data`; normalized in place before it is saved. */
  data: Record<string, unknown>
  /** Present on update, absent on create. */
  documentId?: string
  isCreate: boolean
}

// validateRedirectLinks reads the other redirects and then the write lands, so
// two saves checked side by side (/a → /b and /b → /c) could each pass before
// the other's row exists and commit a chain together. Holding one lock from
// the check until the row is written closes that gap.
const redirectWriteLock = createAsyncLock()

/**
 * Normalizes, validates and saves one redirect as a single critical section:
 * no other redirect write is checked or saved in between. Returns the saved
 * document, or the error to refuse the write with: a field-level
 * ValidationError from the checks, or whatever `save` failed with (e.g.
 * Strapi's own unique-source error), unchanged.
 */
export function validateAndSaveRedirect<T>(
  write: RedirectWrite,
  save: () => Promise<T>
): Promise<T | Error> {
  return redirectWriteLock.run(async () => {
    normalizeRedirectInput(write.data)
    const invalid =
      validateRedirectInput(write.data, { isCreate: write.isCreate }) ??
      (await validateRedirectLinks({
        documents: write.documents,
        data: write.data,
        documentId: write.documentId
      }))
    return invalid ?? save()
  })
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRedirectCategory(key: string): key is RedirectCategory {
  return (REDIRECT_CATEGORIES as readonly string[]).includes(key)
}

function ruleShapeProblem(value: unknown): string | undefined {
  if (!isRecord(value)) return 'is not an object'
  const { source, destination, status, enabled, note } = value
  if (typeof source !== 'string') return 'source is not a string'
  if (typeof destination !== 'string') return 'destination is not a string'
  if (typeof status !== 'number') return 'status is not a number'
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return 'enabled is not a boolean'
  }
  if (note !== undefined && typeof note !== 'string') {
    return 'note is not a string'
  }
  return undefined
}

/** Every structural problem in the grouped JSON, as `where: what` lines. */
function configShapeProblems(json: unknown): string[] {
  if (!isRecord(json)) return ['redirect config is not an object']
  const problems: string[] = []
  for (const [key, rules] of Object.entries(json)) {
    if (!isRedirectCategory(key)) {
      problems.push(`unknown redirect category "${key}"`)
      continue
    }
    if (!Array.isArray(rules)) {
      problems.push(`${key} is not an array`)
      continue
    }
    rules.forEach((rule, index) => {
      const problem = ruleShapeProblem(rule)
      if (problem) problems.push(`${key}[${index}] ${problem}`)
    })
  }
  return problems
}

/**
 * The per-row checks Strapi applies on save, plus a canonical-source check:
 * Strapi stores the normalized source, so `/old/` in the file would never
 * match its stored row and every re-seed would try to create it again.
 */
function entryProblems(entry: RedirectEntry): string[] {
  const problems: string[] = []
  const badSource = sourceError(entry.source)
  if (badSource) problems.push(`${entry.source}: ${badSource}`)
  else if (normalizeRedirectSource(entry.source) !== entry.source) {
    problems.push(
      `${entry.source}: write it as ${normalizeRedirectSource(entry.source)}`
    )
  }
  const badDestination = destinationError(entry.destination, entry.source)
  if (badDestination) problems.push(`${entry.source}: ${badDestination}`)
  return problems
}

function duplicateSourceProblems(entries: RedirectEntry[]): string[] {
  const seen = new Set<string>()
  const problems: string[] = []
  for (const { source } of entries) {
    if (seen.has(source)) problems.push(`${source}: listed more than once`)
    seen.add(source)
  }
  return problems
}

/**
 * Every enabled redirect whose destination is another enabled redirect's
 * source — the chains {@link validateRedirectLinks} refuses one write at a
 * time, found across a whole set at once.
 */
export function findRedirectChains(entries: RedirectEntry[]): string[] {
  const enabled = entries.filter(isRedirectEnabled)
  const onwardBySource = new Map(
    enabled.map((entry) => [entry.source, entry.destination])
  )
  const problems: string[] = []
  for (const { source, destination } of enabled) {
    const target = redirectTargetPath(destination)
    // A self-redirect is reported as one, not as a chain to itself.
    if (target === undefined || target === source) continue
    const onward = onwardBySource.get(target)
    if (onward !== undefined) {
      problems.push(
        `${source}: ${target} already redirects to ${onward}; point it straight there`
      )
    }
  }
  return problems
}

function problemsError(problems: string[]): Error {
  return new Error(
    `${problems.length} invalid redirect(s):\n  ${problems.join('\n  ')}`
  )
}

/**
 * Parses `src/config/redirects.json` into Strapi rows, applying every check
 * Strapi would apply on save — shape, path rules, self-redirects, duplicate
 * sources and chains — and reporting all problems at once. The seed writes one
 * row per request, so it must reject a bad file before the first write rather
 * than leave Strapi half-seeded.
 */
export function parseRedirectConfigFile(
  json: unknown
): RedirectEntry[] | Error {
  const shapeProblems = configShapeProblems(json)
  if (shapeProblems.length > 0) return problemsError(shapeProblems)

  const entries = redirectConfigToEntries(json as Partial<RedirectConfig>)
  if (entries instanceof Error) return entries

  const problems = [
    ...entries.flatMap(entryProblems),
    ...duplicateSourceProblems(entries),
    ...findRedirectChains(entries)
  ]
  return problems.length > 0 ? problemsError(problems) : entries
}

/**
 * Stored redirects whose source the file no longer has: the rows the sync
 * deletes so Strapi mirrors redirects.json, as sync:mdx does for MDX files.
 * Matched on the exact source, the same key the sync looks rows up by.
 */
export function findOrphanedRedirects<T extends Pick<RedirectEntry, 'source'>>(
  entries: Pick<RedirectEntry, 'source'>[],
  stored: Iterable<T>
): T[] {
  const fileSources = new Set(entries.map((entry) => entry.source))
  return [...stored].filter((row) => !fileSources.has(row.source))
}

/**
 * Refuses an editor's delete. Returned rather than thrown so the middleware owns
 * control flow; the admin shows the message as a toast.
 */
export function redirectDeleteError(): errors.ValidationError {
  return new errors.ValidationError(
    'Redirects can’t be deleted. Switch “Enabled” off instead — the redirect stops working on the next deploy and can be switched back on at any time.'
  )
}
