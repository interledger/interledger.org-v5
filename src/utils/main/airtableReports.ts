import type {
  GrantReportContent,
  GrantReportType,
  ParsedGrantReport,
  RawTableRecord,
  SyncedImageSource
} from '@/types/airtable'
import {
  describeValue,
  nonBlankString,
  readImageField
} from './airtableFieldValues'

// Record-shaping helpers for the grant report part of scripts/import-airtable.ts.
// Unlike the grantee directory, a gap is never warned about and skipped: a
// report with a required value missing, or with an image that breaks the rules
// below, fails the whole sync. Programs fix the record, and the next run picks
// it up. The site keeps the last good data in the meantime.

// Only reports with this status reach the site. The view filters on it too,
// but the sync checks again, so a change to the view cannot publish a draft.
export const LIVE_STATUS = 'Live'
export const PUBLICATION_STATUS_FIELD_ID = 'fldOJhHIcLOrM9EYe'

const REPORT_TYPES: readonly GrantReportType[] = [
  'Interim Report',
  'Final Report'
]

// The Published Reports columns the sync reads, by field ID so a rename in
// Airtable changes nothing. Names are for error messages and match Airtable.
// The three lookups come from Submitted Reports through Source Submission, so
// the sync never reads that table and its private fields.
export const REPORT_FIELDS = {
  publishedDate: { id: 'fldoN3aDnVtZlXQ4A', name: 'Published Date' },
  reportingPeriodStart: {
    id: 'flduj37A8KGAhylZJ',
    name: 'Public Reporting Period Start Date'
  },
  reportingPeriodEnd: {
    id: 'flduaIOVGG4VxMfo6',
    name: 'Public Reporting Period End Date'
  },
  summary: { id: 'fld28HOMQQ4a1jiiP', name: 'Public Summary' },
  progressOnObjectives: {
    id: 'fldrpkp7d3RBPP430',
    name: 'Public Progress on Objectives'
  },
  whoBenefits: {
    id: 'fldsqv9LA0a1DcbrH',
    name: 'Public Who Benefits'
  },
  outputs: { id: 'fldDp63OWGlRG5LXs', name: 'Public Outputs' },
  whatsNext: {
    id: 'fldL501vcKXqv2sa3',
    name: "Public What's Next"
  },
  license: { id: 'fldJCnJ59Axvg669R', name: 'Public License' },
  outputTypes: {
    id: 'fldCeozUFvl6wWer1',
    name: 'Public Output Types'
  },
  interledgerTechnologies: {
    id: 'fldx32fxwzwvwOAjV',
    name: 'Public Interledger Technologies Used'
  },
  projectName: {
    id: 'fldcIKU0yVefudlLf',
    name: 'Grantee Project Name'
  },
  reportType: {
    id: 'fldFqBwovEDAd0zEB',
    name: 'Submitted Report Type'
  },
  reportNumber: {
    id: 'fld7cg0Ehni9NEVa8',
    name: 'Submitted Report Num'
  },
  image1: { id: 'fldQY4Dses4064EI3', name: 'Public Image 1' },
  image2: { id: 'fld7WuZSUfppIE3Qs', name: 'Public Image 2' },
  image3: { id: 'fld5bJMgKQXnQ91A4', name: 'Public Image 3' },
  imageDescription1: {
    id: 'fldxrUoNBNENy9IvG',
    name: 'Public Image Description 1'
  },
  imageDescription2: {
    id: 'fld5HLgJxoKiua1xW',
    name: 'Public Image Description 2'
  },
  imageDescription3: {
    id: 'fldpDA5UedHLxTVXP',
    name: 'Public Image Description 3'
  }
} as const satisfies Record<string, { id: string; name: string }>

type ReportFieldKey = keyof typeof REPORT_FIELDS

// Each image field and the description that is its alt text, in page order.
const IMAGE_SLOTS = [
  { image: 'image1', description: 'imageDescription1' },
  { image: 'image2', description: 'imageDescription2' },
  { image: 'image3', description: 'imageDescription3' }
] as const satisfies readonly {
  image: ReportFieldKey
  description: ReportFieldKey
}[]

// Airtable writes a date-only field as YYYY-MM-DD.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function readDate(value: unknown): string | undefined {
  return typeof value === 'string' && DATE_PATTERN.test(value)
    ? value
    : undefined
}

function readOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  return value.every((item) => typeof item === 'string') ? value : undefined
}

// A lookup returns one value per linked record. A report links to exactly one
// submission, so any other count means the link is broken.
function readSingleLookup(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : undefined
}

// Reads the fields of one record. A reader that fails records the problem and
// returns a placeholder, which is safe because toGrantReport discards the
// report when there is any problem.
function createFieldReader(fields: Record<string, unknown>) {
  const problems: string[] = []
  const fail = <T>(key: ReportFieldKey, expected: string, placeholder: T) => {
    const { name, id } = REPORT_FIELDS[key]
    problems.push(
      `"${name}": expected ${expected}, got ${describeValue(fields[id])}`
    )
    return placeholder
  }
  const raw = (key: ReportFieldKey) => fields[REPORT_FIELDS[key].id]

  return {
    problems,
    date(key: ReportFieldKey): string {
      return readDate(raw(key)) ?? fail(key, 'a date', '')
    },
    text(key: ReportFieldKey): string {
      return nonBlankString(raw(key)) ?? fail(key, 'text', '')
    },
    options(key: ReportFieldKey): string[] {
      return readOptions(raw(key)) ?? fail(key, 'at least one option', [])
    },
    lookupText(key: ReportFieldKey): string {
      const value = nonBlankString(readSingleLookup(raw(key)))
      return value ?? fail(key, 'exactly one text value', '')
    },
    lookupNumber(key: ReportFieldKey): number {
      const value = readSingleLookup(raw(key))
      return typeof value === 'number' && Number.isInteger(value) && value > 0
        ? value
        : fail(key, 'exactly one whole number', 0)
    },
    reportType(key: ReportFieldKey): GrantReportType {
      const value = readSingleLookup(raw(key))
      return isReportType(value)
        ? value
        : fail(key, REPORT_TYPES.join(' or '), REPORT_TYPES[0])
    },
    // An empty description is allowed: the image then shows with alt="".
    optionalText(key: ReportFieldKey): string {
      return nonBlankString(raw(key)) ?? ''
    },
    image(key: ReportFieldKey, alt: string): SyncedImageSource | undefined {
      const result = readImageField(raw(key), alt)
      if (result !== undefined && 'expected' in result) {
        return fail(key, result.expected, undefined)
      }
      return result
    }
  }
}

function isReportType(value: unknown): value is GrantReportType {
  return REPORT_TYPES.some((type) => type === value)
}

// The report as programs know it, so a failure names a record they can find.
function reportLabel(raw: RawTableRecord): string {
  const name = nonBlankString(
    readSingleLookup(raw.fields[REPORT_FIELDS.projectName.id])
  )
  const type = readSingleLookup(raw.fields[REPORT_FIELDS.reportType.id])
  const number = readSingleLookup(raw.fields[REPORT_FIELDS.reportNumber.id])
  const parts = [name, type, number].filter((part) => part !== undefined)
  return parts.length === 0 ? raw.id : `${parts.join(' ')} (ID: ${raw.id})`
}

export function isLiveReport(raw: RawTableRecord): boolean {
  return raw.fields[PUBLICATION_STATUS_FIELD_ID] === LIVE_STATUS
}

// Every problem in the record is listed, so programs can fix it in one pass.
export function toGrantReport(raw: RawTableRecord): ParsedGrantReport | Error {
  const read = createFieldReader(raw.fields)
  const content: GrantReportContent = {
    id: raw.id,
    projectName: read.lookupText('projectName'),
    reportType: read.reportType('reportType'),
    reportNumber: read.lookupNumber('reportNumber'),
    publishedDate: read.date('publishedDate'),
    reportingPeriodStart: read.date('reportingPeriodStart'),
    reportingPeriodEnd: read.date('reportingPeriodEnd'),
    summary: read.text('summary'),
    progressOnObjectives: read.text('progressOnObjectives'),
    whoBenefits: read.text('whoBenefits'),
    outputs: read.text('outputs'),
    whatsNext: read.text('whatsNext'),
    license: read.text('license'),
    outputTypes: read.options('outputTypes'),
    interledgerTechnologies: read.options('interledgerTechnologies')
  }
  const imageSources = IMAGE_SLOTS.flatMap(
    ({ image, description }) =>
      read.image(image, read.optionalText(description)) ?? []
  )

  if (read.problems.length === 0) return { content, imageSources }
  return new Error(
    `Report ${reportLabel(raw)}:\n${read.problems.map((p) => `  - ${p}`).join('\n')}`
  )
}

// Sorted by project, then report number, so a change to the view's sort in
// Airtable does not reorder the committed file.
function compareReports(
  { content: a }: ParsedGrantReport,
  { content: b }: ParsedGrantReport
): number {
  return (
    a.projectName.localeCompare(b.projectName, 'en') ||
    a.reportNumber - b.reportNumber ||
    a.id.localeCompare(b.id)
  )
}

// Keeps the Live reports and shapes them. One bad report fails the whole set,
// with every bad report listed. Zero reports is valid: none may be Live yet.
export function toGrantReports(
  records: RawTableRecord[]
): ParsedGrantReport[] | Error {
  const reports: ParsedGrantReport[] = []
  const errors: Error[] = []
  for (const result of records.filter(isLiveReport).map(toGrantReport)) {
    if (result instanceof Error) errors.push(result)
    else reports.push(result)
  }
  if (errors.length > 0) {
    return new Error(
      `${errors.length} grant report(s) cannot be published:\n${errors.map((e) => e.message).join('\n')}`
    )
  }
  return reports.sort(compareReports)
}

// The view decides what is public. A report field hidden there is a field
// programs do not want on the site, but the site needs all of them, so the
// sync stops and names it instead of writing reports without it.
export function findHiddenReportFields(visibleFieldIds: string[]): string[] {
  return Object.values(REPORT_FIELDS)
    .filter(({ id }) => !visibleFieldIds.includes(id))
    .map(({ name }) => name)
}

// The status is read for the Live check only. It is never written.
export function reportFieldIdsToFetch(): string[] {
  return [
    ...Object.values(REPORT_FIELDS).map(({ id }) => id),
    PUBLICATION_STATUS_FIELD_ID
  ]
}
