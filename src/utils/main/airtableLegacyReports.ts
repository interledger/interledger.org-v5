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

// The forum that holds the legacy reports. A link to any other site is
// skipped: the card labels every legacy link as a forum report.
export const FORUM_HOSTNAME = 'community.interledger.org'

const WHITESPACE = /\s/

function isReportType(value: unknown): value is GrantReportType {
  return REPORT_TYPES.some((type) => type === value)
}

// The cell holds one forum link. Two links, or a link with a note, has
// whitespace inside it, and the sync cannot tell which part is the report.
function readForumUrl(value: unknown): string | { expected: string } {
  const text = typeof value === 'string' ? value.trim() : ''
  if (WHITESPACE.test(text)) return { expected: 'one link, got more text' }
  if (!URL.canParse(text)) return { expected: 'a link, got text' }
  const url = new URL(text)
  if (url.protocol !== 'https:' || url.hostname !== FORUM_HOSTNAME) {
    return { expected: `a link to ${FORUM_HOSTNAME}, got ${url.hostname}` }
  }
  return url.href
}

function hasLink(raw: RawTableRecord): boolean {
  const value = raw.fields[LEGACY_REPORT_FIELDS.link.id]
  return typeof value === 'string' && value.trim() !== ''
}

// A row with no link is not a legacy report, so the caller skips it without a
// warning. Every problem of a row with a link is listed. The link itself is
// never printed: the sync log is public.
export function toLegacyGrantReport(
  raw: RawTableRecord
): LegacyGrantReport | Error {
  const { link, projects, reportType, reportNumber } = LEGACY_REPORT_FIELDS
  const problems: string[] = []
  const url = readForumUrl(raw.fields[link.id])
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
    return new Error(formatProblems(`Submitted report ${raw.id}`, problems))
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

// Two rows can hold the same report. With the same link, they are one report.
// With different links, the sync cannot tell which is right, so it skips both
// and names the report, until Programs remove the extra row (INTORG-1436).
function removeDuplicates(reports: readonly LegacyGrantReport[]): {
  reports: LegacyGrantReport[]
  skipped: string[]
} {
  const byKey = new Map<string, LegacyGrantReport[]>()
  for (const report of reports) {
    const key = reportKey(report)
    byKey.set(key, [...(byKey.get(key) ?? []), report])
  }
  const kept: LegacyGrantReport[] = []
  const skipped: string[] = []
  for (const [key, group] of byKey) {
    const urls = new Set(group.map(({ url }) => url))
    const [first] = group
    if (urls.size === 1 && first) kept.push(first)
    else skipped.push(`Grant ${key}: ${urls.size} different links`)
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
}

// Keeps the rows that have a link, one report per grant, type and number,
// sorted so a change to the view's sort does not reorder the committed file.
export function toLegacyGrantReports(
  records: readonly RawTableRecord[]
): LegacyReportsResult {
  const parsed: LegacyGrantReport[] = []
  const skipped: string[] = []
  for (const record of records.filter(hasLink)) {
    const result = toLegacyGrantReport(record)
    if (result instanceof Error) skipped.push(result.message)
    else parsed.push(result)
  }
  const unique = removeDuplicates(parsed)
  return {
    reports: unique.reports.sort(compareLegacyReports),
    skipped: [...skipped, ...unique.skipped]
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
