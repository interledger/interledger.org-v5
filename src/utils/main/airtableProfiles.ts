import type {
  GranteeProfileContent,
  GranteeType,
  ParsedGranteeProfile,
  RawTableRecord,
  SyncedImageSource
} from '@/types/airtable'
import {
  describeValue,
  isStringArray,
  nonBlankString,
  readImageField
} from './airtableFieldValues'

// Record-shaping helpers for the grantee profile part of
// scripts/import-airtable.ts. A profile with a required value missing, or a
// value of the wrong shape, fails the whole sync and names the grantee. An
// optional text or link that is not valid is only left out, with a warning:
// the profile is still correct without it. Every grantee in the table is
// public (PRO-371), so there is no publish filter.

export const GRANTEE_TYPES: readonly GranteeType[] = [
  'Organisation',
  'Individual'
]

// The Grantees columns the sync reads, by field ID so a rename in Airtable
// changes nothing. Names are for error messages and match Airtable.
export const PROFILE_FIELDS = {
  name: { id: 'fldcZzRdAcQJ40dLh', name: 'Name' },
  slug: { id: 'fldtp82dMCjmjr7gS', name: 'Slug' },
  granteeType: { id: 'fldWYCm02AuELYtbw', name: 'Grantee Type' },
  formerlyKnownAs: { id: 'fldXE9JMCA97ExZYl', name: 'Formerly Known As' },
  description: { id: 'fldc2zDN8pnJX3dRR', name: 'Description' },
  country: { id: 'fldJkNUyrW5gXfPdG', name: 'Country' },
  website: { id: 'fldpTs62L6WHunwSR', name: 'Website' },
  twitter: { id: 'fld3T10rcjuL8Dd98', name: 'X / Twitter' },
  linkedIn: { id: 'fldK19CFIhfzCeRpB', name: 'LinkedIn' },
  bluesky: { id: 'fldKo5jpMoHJ2bN66', name: 'Bluesky' },
  grants: { id: 'fldc9Wi0mZwZXFeXA', name: 'Grants' },
  logo: { id: 'fldbL8WbThpsKU9DB', name: 'Logo' },
  grantCount: { id: 'fld2R3A3WDskWJmXN', name: 'Grant Count' },
  totalCommitted: { id: 'fldsX9MyDsB37agxB', name: 'Total Committed' },
  // Counts legacy forum reports, not the Published Reports table (Ayden).
  legacyReportCount: { id: 'fld2exqSN9ftx6mB4', name: 'Published Reports' },
  thematicTags: { id: 'fldXIj9KYq5l9Z3Qv', name: 'Thematic Tags' }
} as const satisfies Record<string, { id: string; name: string }>

type ProfileFieldKey = keyof typeof PROFILE_FIELDS

// The slug becomes a URL segment, so only lowercase ASCII words joined by
// single hyphens. Ayden noted that some slugs may still carry accents.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RECORD_ID_PATTERN = /^rec[A-Za-z0-9]{14}$/
const URL_PROTOCOLS = new Set(['http:', 'https:'])

function isHttpUrl(value: string): boolean {
  return URL.canParse(value) && URL_PROTOCOLS.has(new URL(value).protocol)
}

function isGranteeType(value: unknown): value is GranteeType {
  return GRANTEE_TYPES.some((type) => type === value)
}

// Thematic Tags is a rollup over the grantee's grants, so Airtable sends one
// comma-separated string that repeats a tag once per grant that has it.
export function splitThematicTags(value: unknown): string[] | undefined {
  if (value === undefined) return []
  const parts = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : undefined
  if (!isStringArray(parts)) {
    return undefined
  }
  const tags = parts.map((part) => part.trim()).filter((part) => part !== '')
  return [...new Set(tags)].sort((a, b) => a.localeCompare(b, 'en'))
}

// Same placeholder approach as the report reader: a failed read records the
// problem and returns a value that is never written. A skipped read records a
// warning and returns null, which is written.
function createFieldReader(fields: Record<string, unknown>) {
  const problems: string[] = []
  const warnings: string[] = []
  const describe = (key: ProfileFieldKey, expected: string) => {
    const { name, id } = PROFILE_FIELDS[key]
    return `"${name}": expected ${expected}, got ${describeValue(fields[id])}`
  }
  const fail = <T>(key: ProfileFieldKey, expected: string, placeholder: T) => {
    problems.push(describe(key, expected))
    return placeholder
  }
  const skip = (key: ProfileFieldKey, expected: string): null => {
    warnings.push(`${describe(key, expected)}, left out`)
    return null
  }
  const raw = (key: ProfileFieldKey) => fields[PROFILE_FIELDS[key].id]

  return {
    problems,
    warnings,
    text(key: ProfileFieldKey): string {
      return nonBlankString(raw(key)) ?? fail(key, 'text', '')
    },
    optionalText(key: ProfileFieldKey): string | null {
      const value = raw(key)
      if (value === undefined) return null
      return typeof value === 'string'
        ? (nonBlankString(value) ?? null)
        : skip(key, 'text')
    },
    slug(key: ProfileFieldKey): string {
      const value = raw(key)
      return typeof value === 'string' && SLUG_PATTERN.test(value)
        ? value
        : fail(key, 'lowercase letters, numbers and single hyphens', '')
    },
    granteeType(key: ProfileFieldKey): GranteeType {
      const value = raw(key)
      return isGranteeType(value)
        ? value
        : fail(key, GRANTEE_TYPES.join(' or '), GRANTEE_TYPES[0])
    },
    optionalUrl(key: ProfileFieldKey): string | null {
      const value = raw(key)
      if (value === undefined) return null
      return typeof value === 'string' && isHttpUrl(value.trim())
        ? value.trim()
        : skip(key, 'an http or https URL')
    },
    recordIds(key: ProfileFieldKey): string[] {
      const value = raw(key)
      if (value === undefined) return []
      return Array.isArray(value) &&
        value.every(
          (id) => typeof id === 'string' && RECORD_ID_PATTERN.test(id)
        )
        ? value
        : fail(key, 'linked record IDs', [])
    },
    // Counts and sums are formulas and rollups. A broken one sends an
    // { error } object instead of a number.
    number(key: ProfileFieldKey): number {
      const value = raw(key)
      return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : fail(key, 'a number of 0 or more', 0)
    },
    tags(key: ProfileFieldKey): string[] {
      return splitThematicTags(raw(key)) ?? fail(key, 'a list of tags', [])
    },
    // The name shows next to the logo on the profile, so the logo itself is
    // decorative and has no alt text.
    logo(key: ProfileFieldKey): SyncedImageSource | null {
      const result = readImageField(raw(key), '')
      if (result !== undefined && 'expected' in result) {
        return fail(key, result.expected, null)
      }
      return result ?? null
    }
  }
}

function profileLabel(raw: RawTableRecord): string {
  const name = nonBlankString(raw.fields[PROFILE_FIELDS.name.id])
  return name === undefined ? raw.id : `${name} (ID: ${raw.id})`
}

// Every problem in the record is listed, so programs can fix it in one pass.
export function toGranteeProfile(
  raw: RawTableRecord
): ParsedGranteeProfile | Error {
  const read = createFieldReader(raw.fields)
  const content: GranteeProfileContent = {
    id: raw.id,
    name: read.text('name'),
    slug: read.slug('slug'),
    granteeType: read.granteeType('granteeType'),
    formerlyKnownAs: read.optionalText('formerlyKnownAs'),
    description: read.optionalText('description'),
    country: read.optionalText('country'),
    website: read.optionalUrl('website'),
    twitter: read.optionalUrl('twitter'),
    linkedIn: read.optionalUrl('linkedIn'),
    bluesky: read.optionalUrl('bluesky'),
    grantIds: read.recordIds('grants'),
    grantCount: read.number('grantCount'),
    totalCommitted: read.number('totalCommitted'),
    legacyReportCount: read.number('legacyReportCount'),
    thematicTags: read.tags('thematicTags')
  }
  const logoSource = read.logo('logo')

  const label = `Grantee ${profileLabel(raw)}`
  if (read.problems.length > 0) {
    // The warnings go in too, so programs fix the record in one pass.
    const lines = [...read.problems, ...read.warnings]
    return new Error(`${label}:\n${lines.map((p) => `  - ${p}`).join('\n')}`)
  }
  const warnings = read.warnings.map((warning) => `${label}: ${warning}`)
  return { content, logoSource, warnings }
}

// Two grantees with one slug would build one page for both.
function findDuplicateSlugs(profiles: ParsedGranteeProfile[]): string[] {
  const seen = new Map<string, string[]>()
  for (const { content } of profiles) {
    seen.set(content.slug, [...(seen.get(content.slug) ?? []), content.id])
  }
  return [...seen]
    .filter(([, ids]) => ids.length > 1)
    .map(([slug, ids]) => `Slug "${slug}" is used by ${ids.join(', ')}`)
}

// Shapes every grantee. One bad profile fails the whole set, with every bad
// profile listed. Zero grantees means the table or the token broke, because
// every grantee is public, so it fails too. Sorted by slug for stable diffs.
export function toGranteeProfiles(
  records: RawTableRecord[]
): ParsedGranteeProfile[] | Error {
  if (records.length === 0) {
    return new Error(
      'No grantees in the Grantees table — refusing to write empty profiles'
    )
  }
  const profiles: ParsedGranteeProfile[] = []
  const problems: string[] = []
  for (const result of records.map(toGranteeProfile)) {
    if (result instanceof Error) problems.push(result.message)
    else profiles.push(result)
  }
  problems.push(...findDuplicateSlugs(profiles))
  if (problems.length > 0) {
    // A failed sync logs nothing else, so the warnings of the grantees that
    // passed go in the error too.
    const warnings = profiles.flatMap((profile) => profile.warnings)
    const warningLines =
      warnings.length > 0 ? `\nAlso left out:\n${warnings.join('\n')}` : ''
    return new Error(
      `${problems.length} grantee profile problem(s):\n${problems.join('\n')}${warningLines}`
    )
  }
  return profiles.sort((a, b) => a.content.slug.localeCompare(b.content.slug))
}

// Every Grantees field is public (PRO-371). A field hidden in the view is a
// field programs took off the site, so the sync stops and names it.
export function findHiddenProfileFields(visibleFieldIds: string[]): string[] {
  return Object.values(PROFILE_FIELDS)
    .filter(({ id }) => !visibleFieldIds.includes(id))
    .map(({ name }) => name)
}

export function profileFieldIdsToFetch(): string[] {
  return Object.values(PROFILE_FIELDS).map(({ id }) => id)
}
