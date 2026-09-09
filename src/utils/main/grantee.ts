import type { PaginateFunction } from 'astro'
import type { Locale } from './locales'
import { generateSlug } from './slug'
import {
  ALL_GRANTEE_YEAR_SLUG,
  GRANTEE_TAG_PREFIX,
  filterGrantees,
  isCollidingTagSlug,
  isGranteeYearSlug
} from './granteeFilters'
import {
  ensureAbsoluteUrl,
  getHostname,
  isExternalHref,
  isSafeMarkdownHref
} from '../shared/url'
import type { PaginatedRouteShape } from './paginatedRouteShape'

export {
  ALL_GRANTEE_YEAR_SLUG,
  GRANTEE_TAG_PREFIX,
  filterGrantees,
  getGranteeFilterUrl,
  isCollidingTagSlug,
  isGranteeYearSlug,
  matchesGranteeFilters,
  type GranteeFilters
} from './granteeFilters'

export const GRANTEE_PAGE_SIZE = 10

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

export interface Grantee {
  id: string
  name: string
  program: string
  programKey: string
  year: string
  startMonth: string
  startLabel: string
  country: string
  countryKey: string
  leaders: string[]
  tags: string[]
  description: string | null
  projectUrls: string[]
  budget: number | null
  budgetLabel: string | null
  searchText: string
}

export interface GranteeFilterOption {
  value: string
  label: string
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

function parseProjectUrls(value: unknown): string[] {
  return asStringList(value)
    .map((raw) => ensureAbsoluteUrl(raw))
    .filter((href) => {
      if (!isSafeMarkdownHref(href) || !isExternalHref(href)) return false
      // Reject single-label hosts like "TBD" or "pending" — `new URL` accepts them.
      const hostname = getHostname(href)
      return hostname !== null && hostname.includes('.')
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toGrantee(value: unknown, locale: Locale): Grantee | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  if (!isRecord(value.fields)) return null

  const fields = value.fields
  const name = asTrimmedString(fields['Project Name'])
  if (!name) return null

  const program = asTrimmedString(fields['Secondary Grant Program Name']) ?? ''
  const year = asTrimmedString(fields.Year) ?? ''
  const startMonth = asTrimmedString(fields['Start Month']) ?? ''
  const country = normalizeCountry(asTrimmedString(fields.Country) ?? '')
  const leaders = asStringList(fields['Project Leader'])
  const tags = asStringList(fields['Thematic Tag'])
  const description = asTrimmedString(fields['Project Description']) ?? null
  const budget = asFiniteNumber(fields['Total budget approved']) ?? null

  const searchText = [
    name,
    program,
    year,
    country,
    ...leaders,
    ...tags,
    description ?? ''
  ]
    .join(' ')
    .toLowerCase()

  return {
    id: value.id,
    name,
    program,
    programKey: generateSlug(program),
    year,
    startMonth,
    startLabel: startMonth ? formatStartMonth(startMonth, locale) : '',
    country,
    countryKey: generateSlug(country),
    leaders,
    tags,
    description,
    projectUrls: parseProjectUrls(fields['Project Links']),
    budget,
    budgetLabel: budget === null ? null : formatBudgetAmount(budget),
    searchText
  }
}

function compareGrantees(a: Grantee, b: Grantee): number {
  if (a.startMonth !== b.startMonth) {
    return a.startMonth < b.startMonth ? 1 : -1
  }
  return a.name.localeCompare(b.name)
}

const parsedRecordsCache = new WeakMap<object, Map<Locale, Grantee[] | Error>>()

function parseGranteeRecordsUncached(
  data: object,
  locale: Locale
): Grantee[] | Error {
  if (!Array.isArray(data)) {
    return new Error('Grantee dump is not an array')
  }

  return data
    .map((record) => toGrantee(record, locale))
    .filter((grantee): grantee is Grantee => grantee !== null)
    .sort(compareGrantees)
}

/**
 * Parse the Airtable dump once per (dump, locale). Each directory
 * `getStaticPaths` used to re-run the markdown pass; listing + search +
 * redirects share one in-memory result for the imported JSON.
 */
export function parseGranteeRecords(
  data: unknown,
  locale: Locale
): Grantee[] | Error {
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

export function uniqueFilterOptions(
  grantees: Grantee[],
  key: 'year' | 'tag'
): GranteeFilterOption[] {
  const seen = new Map<string, string>()

  for (const grantee of grantees) {
    if (key === 'year' && grantee.year) {
      seen.set(grantee.year, grantee.year)
    } else if (key === 'tag') {
      for (const tag of grantee.tags) {
        const slug = generateSlug(tag)
        if (slug) seen.set(slug, tag)
      }
    }
  }

  const options = [...seen.entries()].map(([value, label]) => ({
    value,
    label
  }))

  if (key === 'year') {
    return options.sort((a, b) => b.label.localeCompare(a.label))
  }
  return options.sort((a, b) => a.label.localeCompare(b.label))
}

export interface GranteeListingData {
  grantees: Grantee[]
  years: GranteeFilterOption[]
  tags: GranteeFilterOption[]
}

export function getGranteeListingData(
  data: unknown,
  locale: Locale
): GranteeListingData | Error {
  const grantees = parseGranteeRecords(data, locale)
  if (grantees instanceof Error) return grantees
  return {
    grantees,
    years: uniqueFilterOptions(grantees, 'year'),
    tags: uniqueFilterOptions(grantees, 'tag')
  }
}

/**
 * A single grantee's fields as shipped in the client-side search catalog
 * (see `grantee-search-index.json.ts` and `src/scripts/grantee-search.ts`).
 * Trimmed to what a slim search-result row needs — no raw markdown, no
 * derived slugs that the full `GranteeCard` computes for itself.
 */
interface GranteeListingPageProps {
  years: GranteeFilterOption[]
  tags: GranteeFilterOption[]
  selectedYear?: string
  selectedTag?: string
}

function listingProps(
  years: GranteeFilterOption[],
  tags: GranteeFilterOption[],
  selectedYear: string | undefined,
  selectedTag: string | undefined
): GranteeListingPageProps {
  return {
    years,
    tags,
    selectedYear,
    selectedTag
  }
}

export function paginateGranteesByYear({
  paginate,
  grantees,
  years,
  tags
}: {
  paginate: PaginateFunction
  grantees: Grantee[]
  years: GranteeFilterOption[]
  tags: GranteeFilterOption[]
}) {
  return years.flatMap((year) => {
    const entries = filterGrantees(grantees, {
      q: '',
      year: year.value,
      tag: ''
    })
    return paginate(entries, {
      params: { year: year.value },
      pageSize: GRANTEE_PAGE_SIZE,
      props: listingProps(years, tags, year.value, undefined)
    })
  })
}

type TagListingArgs = {
  paginate: PaginateFunction
  grantees: Grantee[]
  years: GranteeFilterOption[]
  tags: GranteeFilterOption[]
}

type DirectoryRedirect = {
  params: Record<string, string>
  redirect: string
}

function tagListingPath(directoryPath: string, tag: string, year?: string) {
  return year
    ? `${directoryPath}/${year}/${GRANTEE_TAG_PREFIX}/${tag}`
    : `${directoryPath}/${GRANTEE_TAG_PREFIX}/${tag}`
}

function paginatedRedirects(
  params: Record<string, string>,
  dest: string,
  entryCount: number
): DirectoryRedirect[] {
  const pages = Math.max(1, Math.ceil(entryCount / GRANTEE_PAGE_SIZE))
  const redirects: DirectoryRedirect[] = [{ params, redirect: dest }]
  for (let page = 2; page <= pages; page++) {
    redirects.push({
      params: { ...params, page: String(page) },
      redirect: `${dest}/${page}`
    })
  }
  return redirects
}

/** Tag-only listings at `/grantee-directory/tag/<slug>`. */
export function paginateGranteesByTag({
  paginate,
  grantees,
  years,
  tags
}: TagListingArgs) {
  return tags.flatMap((tag) => {
    const entries = filterGrantees(grantees, {
      q: '',
      year: '',
      tag: tag.value
    })
    return paginate(entries, {
      params: { tag: tag.value },
      pageSize: GRANTEE_PAGE_SIZE,
      props: listingProps(years, tags, undefined, tag.value)
    })
  })
}

/** Year + tag listings at `/grantee-directory/<year>/tag/<slug>`. */
export function paginateGranteesByYearAndTag({
  paginate,
  grantees,
  years,
  tags
}: TagListingArgs) {
  return years.flatMap((year) =>
    tags.flatMap((tag) => {
      const entries = filterGrantees(grantees, {
        q: '',
        year: year.value,
        tag: tag.value
      })
      return paginate(entries, {
        params: { year: year.value, tag: tag.value },
        pageSize: GRANTEE_PAGE_SIZE,
        props: listingProps(years, tags, year.value, tag.value)
      })
    })
  )
}

/** Old `/<tag>` bookmarks that used the year slot → `/tag/<slug>`. */
export function legacyUnprefixedTagRedirects(
  listing: GranteeListingData,
  directoryPath: string
): DirectoryRedirect[] {
  return listing.tags.flatMap((tag) => {
    if (isCollidingTagSlug(tag.value)) return []
    const entries = filterGrantees(listing.grantees, {
      q: '',
      year: '',
      tag: tag.value
    })
    return paginatedRedirects(
      { year: tag.value },
      tagListingPath(directoryPath, tag.value),
      entries.length
    )
  })
}

/** Old `/<year>/<tag>` bookmarks → `/<year>/tag/<slug>`. */
export function legacyYearAndTagRedirects(
  listing: GranteeListingData,
  directoryPath: string
): DirectoryRedirect[] {
  return listing.years.flatMap((year) =>
    listing.tags.flatMap((tag) => {
      if (isCollidingTagSlug(tag.value)) return []
      const entries = filterGrantees(listing.grantees, {
        q: '',
        year: year.value,
        tag: tag.value
      })
      return paginatedRedirects(
        { year: year.value, tag: tag.value },
        tagListingPath(directoryPath, tag.value, year.value),
        entries.length
      )
    })
  )
}

/** Old `/all/<tag>` bookmarks → current tag-only URLs. */
export function legacyAllYearsRedirects(
  listing: GranteeListingData,
  directoryPath: string
): { params: { page: string }; redirect: string }[] {
  const redirects: { params: { page: string }; redirect: string }[] = []
  const seen = new Set<string>()

  const add = (page: string, redirect: string) => {
    if (seen.has(page)) return
    seen.add(page)
    redirects.push({ params: { page }, redirect })
  }

  for (const tag of listing.tags) {
    const dest = tagListingPath(directoryPath, tag.value)
    const entries = filterGrantees(listing.grantees, {
      q: '',
      year: '',
      tag: tag.value
    })
    const pages = Math.max(1, Math.ceil(entries.length / GRANTEE_PAGE_SIZE))
    add(tag.value, dest)
    for (let page = 2; page <= pages; page++) {
      add(`${tag.value}/${page}`, `${dest}/${page}`)
    }
  }

  add(
    ALL_GRANTEE_YEAR_SLUG,
    tagListingPath(directoryPath, ALL_GRANTEE_YEAR_SLUG)
  )

  const unfilteredPages = Math.max(
    1,
    Math.ceil(listing.grantees.length / GRANTEE_PAGE_SIZE)
  )
  for (let page = 2; page <= unfilteredPages; page++) {
    const slug = String(page)
    if (seen.has(slug)) continue
    add(slug, `${directoryPath}/${slug}`)
  }

  return redirects
}
