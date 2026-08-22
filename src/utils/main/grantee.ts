import type { PaginateFunction } from 'astro'
import type { Locale } from './locales'
import { generateSlug } from './slug'
import { truncateText } from './text'
import {
  ensureAbsoluteUrl,
  isExternalHref,
  isSafeMarkdownHref
} from '../shared/url'
import type { PaginatedRouteShape } from './paginatedRouteShape'

export const GRANTEE_PAGE_SIZE = 10
export const ALL_GRANTEE_YEAR_SLUG = 'all'

function isGranteeYearSlug(value: string): boolean {
  return value === ALL_GRANTEE_YEAR_SLUG || /^\d{4}$/.test(value)
}

export const granteeRouteShape: PaginatedRouteShape = {
  matches: (basePath, parts) => {
    if (basePath !== '/grant' || parts[0] !== 'grantee-directory') return false
    const last = parts.at(-1)
    // Years are 4-digit values in the path, not listing page numbers.
    return !last || !/^\d{4}$/.test(last)
  },
  isValidListingPrefix: (prefixParts) => {
    if (prefixParts[0] !== 'grantee-directory') return false
    if (prefixParts.length === 1) return true
    if (!isGranteeYearSlug(prefixParts[1])) return false
    return prefixParts.length === 2 || prefixParts.length === 3
  }
}

/** Builds a directory listing URL, e.g. `/grant/grantee-directory/2024`. */
export function getGranteeFilterUrl(
  directoryPath: string,
  year?: string,
  tag?: string
): string {
  if (!year && !tag) return directoryPath
  const yearPath = `${directoryPath}/${year || ALL_GRANTEE_YEAR_SLUG}`
  if (!tag) return yearPath
  return `${yearPath}/${tag}`
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
  projectUrl: string | null
  budget: number | null
  budgetLabel: string | null
  searchText: string
}

export interface GranteeFilters {
  q?: string
  year: string
  tag: string
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

function parseProjectUrl(value: unknown): string | null {
  const raw = asTrimmedString(value)
  if (!raw) return null
  const href = ensureAbsoluteUrl(raw)
  if (!isSafeMarkdownHref(href) || !isExternalHref(href)) return null
  return href
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Strips markdown syntax markers so searchText/search snippets read as plain
// prose — otherwise "**Payments**" only matches a query typed with asterisks.
function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
    description ? stripMarkdownSyntax(description) : ''
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
    projectUrl: parseProjectUrl(fields['Project Links']),
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

export function parseGranteeRecords(
  data: unknown,
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

export function matchesGranteeFilters(
  grantee: Pick<Grantee, 'year' | 'tags' | 'searchText'>,
  filters: GranteeFilters
): boolean {
  if (filters.year && grantee.year !== filters.year) return false
  if (
    filters.tag &&
    !grantee.tags.some((tag) => generateSlug(tag) === filters.tag)
  ) {
    return false
  }
  const query = filters.q?.trim().toLowerCase() ?? ''
  if (query && !grantee.searchText.includes(query)) return false
  return true
}

export function filterGrantees(
  grantees: Grantee[],
  filters: GranteeFilters
): Grantee[] {
  return grantees.filter((grantee) => matchesGranteeFilters(grantee, filters))
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
export interface GranteeSearchEntry {
  id: string
  name: string
  program: string
  year: string
  country: string
  startLabel: string
  leaders: string[]
  tags: string[]
  descriptionSnippet: string | null
  projectUrl: string | null
  budgetLabel: string | null
  searchText: string
}

const SEARCH_SNIPPET_MAX_LENGTH = 160

function toSearchSnippet(description: string | null): string | null {
  if (!description) return null
  return truncateText(
    stripMarkdownSyntax(description),
    SEARCH_SNIPPET_MAX_LENGTH
  )
}

function toGranteeSearchEntry(grantee: Grantee): GranteeSearchEntry {
  return {
    id: grantee.id,
    name: grantee.name,
    program: grantee.program,
    year: grantee.year,
    country: grantee.country,
    startLabel: grantee.startLabel,
    leaders: grantee.leaders,
    tags: grantee.tags,
    descriptionSnippet: toSearchSnippet(grantee.description),
    projectUrl: grantee.projectUrl,
    budgetLabel: grantee.budgetLabel,
    searchText: grantee.searchText
  }
}

/**
 * Build-time catalog for client-side grantee search. Small and locale-scoped
 * so it can be fetched once (lazily, on first search interaction) and reused
 * across every paginated/filtered directory route — see
 * `src/pages/grantee-search-index.json.ts`.
 */
export function getGranteeSearchIndex(
  data: unknown,
  locale: Locale
): GranteeSearchEntry[] {
  const grantees = parseGranteeRecords(data, locale)
  if (grantees instanceof Error) throw grantees
  return grantees.map(toGranteeSearchEntry)
}

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

export function paginateGranteesByYearAndTag({
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
  const yearSlugs = [
    ALL_GRANTEE_YEAR_SLUG,
    ...years.map((option) => option.value)
  ]

  return yearSlugs.flatMap((yearSlug) => {
    const yearFilter = yearSlug === ALL_GRANTEE_YEAR_SLUG ? '' : yearSlug

    return tags.flatMap((tag) => {
      const entries = filterGrantees(grantees, {
        q: '',
        year: yearFilter,
        tag: tag.value
      })

      return paginate(entries, {
        params: { year: yearSlug, tag: tag.value },
        pageSize: GRANTEE_PAGE_SIZE,
        props: listingProps(years, tags, yearFilter || undefined, tag.value)
      })
    })
  })
}
