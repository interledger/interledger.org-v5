import type { Locale } from './locales'
import { foldSearchText } from '../shared/foldSearchText'
import {
  ensureAbsoluteUrl,
  getHostname,
  isExternalHref,
  isSafeMarkdownHref
} from '../shared/url'
import { createPlainTextVariants } from './create-excerpt'
import { GRANTEE_TAG_PREFIX, isGranteeYearSlug } from './granteeFilters'
import type { PaginatedRouteShape } from './paginatedRouteShape'
import type { GranteeFieldName } from './airtableRecords'

// Reads the published projects in grantee-data.json. The directory groups
// them under their grantee in granteeDirectory.ts.

export const granteeRouteShape: PaginatedRouteShape = {
  matches: (basePath, parts) => {
    if (basePath !== '/grant' || parts[0] !== 'grantee-directory') return false
    const last = parts.at(-1)
    // Years are 4-digit values in the path, not listing page numbers.
    return !last || !isGranteeYearSlug(last)
  },
  isValidListingPrefix: (prefixParts) => {
    if (prefixParts[0] !== 'grantee-directory') return false
    if (prefixParts.length === 1) return true
    // `/2024` — not `/tag` (incomplete) and not a leftover unprefixed tag.
    if (prefixParts.length === 2) return isGranteeYearSlug(prefixParts[1])
    // `/tag/privacy` — `/tag/2` is a tag named "2", not page 2 of `/tag`.
    if (prefixParts.length === 3) {
      return prefixParts[1] === GRANTEE_TAG_PREFIX
    }
    // `/2024/tag/privacy`
    return (
      prefixParts.length === 4 &&
      isGranteeYearSlug(prefixParts[1]) &&
      prefixParts[2] === GRANTEE_TAG_PREFIX
    )
  }
}

/** One published project (a grant) from grantee-data.json. */
export interface GranteeProject {
  id: string
  name: string
  program: string
  year: string
  startMonth: string
  startLabel: string
  country: string
  tags: string[]
  budget: number | null
  budgetLabel: string | null
  /**
   * Usable web links from Project Links. These are the forum reports for
   * grants that have no report page yet. Text that is not a URL is dropped.
   */
  reportUrls: string[]
  /**
   * Folded text the search matches. It also holds the project leaders and
   * the description, which the card does not show, so a search for a
   * person or a topic still finds the grantee.
   */
  searchText: string
}

const COUNTRY_ALIASES: Record<string, string> = {
  us: 'United States',
  usa: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'united states': 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  'united kingdom': 'United Kingdom',
  nl: 'Netherlands',
  netherlands: 'Netherlands',
  'the netherlands': 'Netherlands',
  "cote d'ivoire": "Côte d'Ivoire",
  "côte d'ivoire": "Côte d'Ivoire"
}

export function normalizeCountry(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  const key = trimmed.toLowerCase().replace(/['’]/g, "'")
  return COUNTRY_ALIASES[key] ?? trimmed
}

export function formatBudgetAmount(value: number): string {
  const hasCents = !Number.isInteger(value)
  return value
    .toLocaleString('en-US', {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2
    })
    .replace(/,/g, ' ')
}

export function formatStartMonth(startMonth: string, locale: Locale): string {
  const match = /^(\d{4})-(\d{2})$/.exec(startMonth)
  if (!match) return startMonth

  const month = Number(match[2])
  if (month < 1 || month > 12) return startMonth

  const date = new Date(Date.UTC(Number(match[1]), month - 1, 1))
  const localeTag = locale === 'es' ? 'es-ES' : 'en-US'
  const formatted = new Intl.DateTimeFormat(localeTag, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = asTrimmedString(item)
      return text ? [text] : []
    })
  }
  const single = asTrimmedString(value)
  return single ? [single] : []
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// Free text is allowed in the column. Keep only absolute http(s) links, and
// reject a single-label host such as "pending": `new URL` accepts it.
function parseProjectUrls(value: unknown): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const raw of asStringList(value)) {
    const href = ensureAbsoluteUrl(raw)
    if (!isSafeMarkdownHref(href) || !isExternalHref(href)) continue
    const hostname = getHostname(href)
    if (!hostname?.includes('.')) continue
    if (seen.has(href)) continue
    seen.add(href)
    urls.push(href)
  }
  return urls
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Plain text without Markdown syntax, so a query never has to type `**`.
function descriptionSearchText(text: string): string {
  return collapseWhitespace(createPlainTextVariants(text).search)
}

function toGranteeProject(
  value: unknown,
  locale: Locale
): GranteeProject | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  if (!isRecord(value.fields)) return null

  // Typed by the sync's column map, so the editor flags a key the sync never writes.
  const fields: Partial<Record<GranteeFieldName, unknown>> = value.fields
  const name = asTrimmedString(fields['Project Name'])
  if (!name) return null

  const program = asTrimmedString(fields['Secondary Grant Program Name']) ?? ''
  const year = asTrimmedString(fields.Year) ?? ''
  const startMonth = asTrimmedString(fields['Start Month']) ?? ''
  const country = normalizeCountry(asTrimmedString(fields.Country) ?? '')
  const leaders = asStringList(fields['Project Leader'])
  const tags = asStringList(fields['Thematic Tag'])
  const description = asTrimmedString(fields['Project Description'])
  const budget = asFiniteNumber(fields['Total budget approved']) ?? null
  const reportUrls = parseProjectUrls(fields['Project Links'])

  const searchText = foldSearchText(
    [
      name,
      program,
      year,
      country,
      ...leaders,
      ...tags,
      description ? descriptionSearchText(description) : ''
    ].join(' ')
  )

  return {
    id: value.id,
    name,
    program,
    year,
    startMonth,
    startLabel: startMonth ? formatStartMonth(startMonth, locale) : '',
    country,
    tags,
    budget,
    budgetLabel: budget === null ? null : formatBudgetAmount(budget),
    reportUrls,
    searchText
  }
}

/** Newest start month first, then by name. */
export function compareByStartMonth(
  a: { startMonth: string; name: string },
  b: { startMonth: string; name: string }
): number {
  if (a.startMonth !== b.startMonth) {
    return a.startMonth < b.startMonth ? 1 : -1
  }
  return a.name.localeCompare(b.name)
}

const parsedRecordsCache = new WeakMap<
  object,
  Map<Locale, GranteeProject[] | Error>
>()

function parseGranteeRecordsUncached(
  data: object,
  locale: Locale
): GranteeProject[] | Error {
  if (!Array.isArray(data)) {
    return new Error('Grantee dump is not an array')
  }

  return data
    .map((record) => toGranteeProject(record, locale))
    .filter((project): project is GranteeProject => project !== null)
    .sort(compareByStartMonth)
}

/**
 * Parse the Airtable dump once per (dump, locale). Directory listing
 * `getStaticPaths` share one in-memory result for the imported JSON module.
 */
export function parseGranteeRecords(
  data: unknown,
  locale: Locale
): GranteeProject[] | Error {
  if (typeof data !== 'object' || data === null) {
    return new Error('Grantee dump is not an array')
  }

  let byLocale = parsedRecordsCache.get(data)
  if (!byLocale) {
    byLocale = new Map()
    parsedRecordsCache.set(data, byLocale)
  }

  const cached = byLocale.get(locale)
  if (cached !== undefined) return cached

  const parsed = parseGranteeRecordsUncached(data, locale)
  byLocale.set(locale, parsed)
  return parsed
}
