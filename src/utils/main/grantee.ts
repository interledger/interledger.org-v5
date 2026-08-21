import type { Locale } from './locales'
import { generateSlug } from './slug'
import {
  ensureAbsoluteUrl,
  isExternalHref,
  isSafeMarkdownHref
} from '../shared/url'

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
