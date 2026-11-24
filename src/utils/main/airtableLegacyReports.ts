import type {
  GrantReportType,
  LegacyGrantReport,
  RawTableRecord
} from '@/types/airtable'
import {
  describeValue,
  formatProblems,
  isRecordId
} from './airtableFieldValues'
import { REPORT_TYPES } from './airtableReports'

// Record-shaping helpers for the legacy report part of
// scripts/import-airtable.ts. Legacy reports are the progress reports that
// grantees posted on the community forum before the report pages existed.
// Programs keep their links in Submitted Reports.
//
// The data is older and less clean than Published Reports, so a bad row does
// not fail the sync. The row is skipped and named in a warning, and the card
// shows the grant's other reports.

// The Submitted Reports columns the sync reads, by field ID so a rename in
// Airtable changes nothing. Names are for messages and match Airtable.
export const LEGACY_REPORT_FIELDS = {
  link: { id: 'fldQ4TCd6pswVgajs', name: 'Legacy Public Progress Report' },
  projects: { id: 'fldWRAATuUizgITyO', name: 'Projects' },
  reportType: { id: 'fldk6wRlmxfC9Ka0D', name: 'Report type' },
  reportNumber: { id: 'fld8UYDRTHeshaRSO', name: 'Report Num' }
} as const satisfies Record<string, { id: string; name: string }>

// Most legacy reports are on the community forum, but some are on other
// sites (Jeremiah, PRO-371), so any web link is kept.
const WEB_PROTOCOLS = new Set(['http:', 'https:'])

const WHITESPACE = /\s/

function isReportType(value: unknown): value is GrantReportType {
  return REPORT_TYPES.some((type) => type === value)
}

// The cell holds one link. Two links, or a link with a note, has
// whitespace inside it, and the sync cannot tell which part is the report.
function readReportUrl(value: unknown): string | { expected: string } {
  const text = typeof value === 'string' ? value.trim() : ''
  if (WHITESPACE.test(text)) return { expected: 'one link, got more text' }
  if (!URL.canParse(text)) return { expected: 'a link, got text' }
  const url = new URL(text)
  if (!WEB_PROTOCOLS.has(url.protocol)) {
    return { expected: `a web link, got ${url.protocol}` }
  }
  return url.href
}

// The row as Programs know it: its primary field, Report Id, which reads like
// "Waasabi … 2 Final Report". The record ID follows, for an exact match. Without
// a primary field value, the record ID alone.
function rowLabel(raw: RawTableRecord, labelFieldId?: string): string {
  const value = labelFieldId ? raw.fields[labelFieldId] : undefined
  const name = typeof value === 'string' ? value.trim() : ''
  return name ? `"${name}" (ID: ${raw.id})` : raw.id
}

function hasLink(raw: RawTableRecord): boolean {
  const value = raw.fields[LEGACY_REPORT_FIELDS.link.id]
  return typeof value === 'string' && value.trim() !== ''
}

// A row with no link is not a legacy report, so the caller skips it without a
// warning. Every problem of a row with a link is listed. The link itself is
// never printed: the sync log is public.
export function toLegacyGrantReport(
  raw: RawTableRecord,
  labelFieldId?: string
): LegacyGrantReport | Error {
  const { link, projects, reportType, reportNumber } = LEGACY_REPORT_FIELDS
  const problems: string[] = []
  const url = readReportUrl(raw.fields[link.id])
  if (typeof url !== 'string') {
    problems.push(`"${link.name}": expected ${url.expected}`)
  }
  const projectIds = raw.fields[projects.id]
  const grantId = Array.isArray(projectIds) ? projectIds[0] : undefined
  if (
    !Array.isArray(projectIds) ||
    projectIds.length !== 1 ||
    !isRecordId(grantId)
  ) {
    problems.push(
      `"${projects.name}": expected exactly one linked project, got ${describeValue(projectIds)}`
    )
  }
  const type = raw.fields[reportType.id]
  if (!isReportType(type)) {
    problems.push(
      `"${reportType.name}": expected ${REPORT_TYPES.join(' or ')}, got ${describeValue(type)}`
    )
  }
  const number = raw.fields[reportNumber.id]
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) {
    problems.push(
      `"${reportNumber.name}": expected a whole number, got ${describeValue(number)}`
    )
  }
  if (
    problems.length > 0 ||
    typeof url !== 'string' ||
    !isRecordId(grantId) ||
    !isReportType(type) ||
    typeof number !== 'number'
  ) {
    return new Error(
      formatProblems(
        `Submitted report ${rowLabel(raw, labelFieldId)}`,
        problems
      )
    )
  }
  return { grantId, reportType: type, reportNumber: number, url }
}

function reportKey({
  grantId,
  reportType,
  reportNumber
}: LegacyGrantReport): string {
  return `${grantId} ${reportType} ${reportNumber}`
}

interface LabelledReport {
  report: LegacyGrantReport
  label: string
}

// Two rows can hold the same report. With the same link, they are one report.
// With different links, the sync cannot tell which is right, so it skips both
// and names the report, until Programs remove the extra row (INTORG-1436).
function removeDuplicates(rows: readonly LabelledReport[]): {
  reports: LegacyGrantReport[]
  skipped: string[]
} {
  const byKey = new Map<string, LabelledReport[]>()
  for (const row of rows) {
    const key = reportKey(row.report)
    byKey.set(key, [...(byKey.get(key) ?? []), row])
  }
  const kept: LegacyGrantReport[] = []
  const skipped: string[] = []
  for (const group of byKey.values()) {
    const urls = new Set(group.map(({ report }) => report.url))
    const [first] = group
    if (!first) continue
    if (urls.size === 1) {
      kept.push(first.report)
      continue
    }
    const labels = group.map(({ label }) => label).join(', ')
    skipped.push(`${urls.size} different links for one report: ${labels}`)
  }
  return { reports: kept, skipped }
}

function compareLegacyReports(
  a: LegacyGrantReport,
  b: LegacyGrantReport
): number {
  return (
    a.grantId.localeCompare(b.grantId) ||
    REPORT_TYPES.indexOf(a.reportType) - REPORT_TYPES.indexOf(b.reportType) ||
    a.reportNumber - b.reportNumber
  )
}

export interface LegacyReportsResult {
  reports: LegacyGrantReport[]
  // One message per skipped row or report, for the sync's warning.
  skipped: string[]
  // Rows with a link, kept or skipped. With none kept, the caller fails.
  linkedRows: number
}

// Keeps the rows that have a link, one report per grant, type and number,
// sorted so a change to the view's sort does not reorder the committed file.
// `labelFieldId` is the table's primary field, which names a row in warnings.
export function toLegacyGrantReports(
  records: readonly RawTableRecord[],
  labelFieldId?: string
): LegacyReportsResult {
  const parsed: LabelledReport[] = []
  const skipped: string[] = []
  const linked = records.filter(hasLink)
  for (const record of linked) {
    const result = toLegacyGrantReport(record, labelFieldId)
    if (result instanceof Error) skipped.push(result.message)
    else parsed.push({ report: result, label: rowLabel(record, labelFieldId) })
  }
  const unique = removeDuplicates(parsed)
  return {
    reports: unique.reports.sort(compareLegacyReports),
    skipped: [...skipped, ...unique.skipped],
    linkedRows: linked.length
  }
}

// The view decides what is public. Every field the sync reads must be
// visible there, or the sync stops and names it.
export function findHiddenLegacyReportFields(
  visibleFieldIds: readonly string[]
): string[] {
  return Object.values(LEGACY_REPORT_FIELDS)
    .filter(({ id }) => !visibleFieldIds.includes(id))
    .map(({ name }) => name)
}

export function legacyReportFieldIdsToFetch(): string[] {
  return Object.values(LEGACY_REPORT_FIELDS).map(({ id }) => id)
}
