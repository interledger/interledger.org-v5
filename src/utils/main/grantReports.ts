import { z } from 'zod'
import type { GrantReport, GrantReportType } from '@/types/airtable'
import { isIsoDate, isRecordId } from './airtableFieldValues'
import { SLUG_PATTERN } from './airtableProfiles'
import { PROJECT_ID_PATTERN, REPORT_TYPES } from './airtableReports'
import type { GranteeProject } from './grantee'
import type { Locale, Translate, UiKey } from './i18'
import { syncedImageSchema } from './airtableJsonSchemas'
import { granteeBasePath } from './routes'

// Reads src/data/airtable/grant-reports.json for the report pages. The
// Airtable sync validates every report before it writes the file, so a
// failure here means a hand edit, or the sync and the site disagree on the
// shape. The build fails then, instead of rendering a report with holes in it.

const isoDate = z.string().refine(isIsoDate, 'expected a date (YYYY-MM-DD)')
// Programs can leave any of these empty.
const optionalDate = isoDate.nullable()
const markdown = z.string()
const options = z.array(z.string().min(1))

const grantReportSchema = z.object({
  id: z.string().min(1),
  grantId: z.string().refine(isRecordId, 'expected an Airtable record ID'),
  projectId: z.string().regex(PROJECT_ID_PATTERN),
  granteeSlug: z.string().regex(SLUG_PATTERN),
  projectName: z.string().min(1),
  reportType: z.enum(REPORT_TYPES),
  reportNumber: z.number().int().positive(),
  publishedDate: isoDate,
  reportingPeriodStart: optionalDate,
  reportingPeriodEnd: optionalDate,
  summary: markdown,
  progressOnObjectives: markdown,
  whoBenefits: markdown,
  outputs: markdown,
  whatsNext: markdown,
  license: z.string(),
  outputTypes: options,
  interledgerTechnologies: options,
  images: z.array(syncedImageSchema)
}) satisfies z.ZodType<GrantReport>

const grantReportsSchema = z.array(grantReportSchema)

export function parseGrantReports(data: unknown): GrantReport[] | Error {
  const result = grantReportsSchema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    return new Error(
      `grant-reports.json does not match the report shape at ${issue?.path.join('.') ?? '(root)'}: ${issue?.message ?? 'unknown error'}`
    )
  }
  return result.data
}

const REPORT_TYPE_LABEL_KEYS: Record<GrantReportType, UiKey> = {
  'Interim Report': 'grantReport.type.interim',
  'Final Report': 'grantReport.type.final'
}

// "Interim report 1": the report's name on its page, in the breadcrumbs and
// in the list of the grant's reports.
export function grantReportLabel(
  {
    reportType,
    reportNumber
  }: Pick<GrantReport, 'reportType' | 'reportNumber'>,
  t: Translate
): string {
  return t('grantReport.label', {
    type: t(REPORT_TYPE_LABEL_KEYS[reportType]),
    number: reportNumber
  })
}

const REPORT_TYPE_SEGMENTS: Record<GrantReportType, string> = {
  'Interim Report': 'interim',
  'Final Report': 'final'
}

// <project id>-<report type>-<report number>, for example 20260504-interim-1.
// Interim and final reports can both start at 1, so the type is in the URL.
export function grantReportSegment({
  projectId,
  reportType,
  reportNumber
}: Pick<GrantReport, 'projectId' | 'reportType' | 'reportNumber'>): string {
  return `${projectId}-${REPORT_TYPE_SEGMENTS[reportType]}-${reportNumber}`
}

// The report URL without the locale prefix. Reports sit under their grantee,
// where the profile pages will live, so the URL does not change when the
// profiles ship.
export function grantReportPath(
  report: Pick<
    GrantReport,
    'granteeSlug' | 'projectId' | 'reportType' | 'reportNumber'
  >
): string {
  return `${granteeBasePath(report.granteeSlug)}/reports/${grantReportSegment(report)}`
}

// The facts the sidebar shows about the report's grant. They come from the
// grantee directory, so they exist only while the grant is published there.
export type GrantFacts = Pick<
  GranteeProject,
  'budgetLabel' | 'program' | 'grantPeriodLabel' | 'leaders' | 'country'
>

// Another report of the same grant, for the "Reports for this grant" list.
export interface GrantReportListItem {
  reportType: GrantReportType
  reportNumber: number
  reportPath: string
  isCurrent: boolean
}

export interface GrantReportPageProps {
  report: GrantReport
  reportPath: string
  // Null when the slug is missing from grantee-profiles.json.
  granteeName: string | null
  // Null when the grant is not published in the directory.
  grant: GrantFacts | null
  grantReports: GrantReportListItem[]
}

export interface GrantReportRoute {
  params: { slug: string; report: string }
  props: GrantReportPageProps
}

// What a report page needs from the other Airtable files.
export interface GrantReportSources {
  grantees: readonly GranteeProject[]
  granteeNames: ReadonlyMap<string, string>
}

const granteeNamesSchema = z.array(
  z.object({ slug: z.string().min(1), name: z.string().min(1) })
)

// Grantee name by slug, from grantee-profiles.json.
export function readGranteeNames(data: unknown): Map<string, string> | Error {
  const result = granteeNamesSchema.safeParse(data)
  if (!result.success) {
    return new Error(
      'grantee-profiles.json does not match the shape the report pages read'
    )
  }
  return new Map(result.data.map(({ slug, name }) => [slug, name]))
}

function findSharedReportPaths(reports: readonly GrantReport[]): string[] {
  const idsByPath = new Map<string, string[]>()
  for (const report of reports) {
    const reportPath = grantReportPath(report)
    idsByPath.set(reportPath, [...(idsByPath.get(reportPath) ?? []), report.id])
  }
  return [...idsByPath]
    .filter(([, ids]) => ids.length > 1)
    .map(([reportPath, ids]) => `${reportPath} is used by ${ids.join(', ')}`)
}

function compareListItems(
  a: GrantReportListItem,
  b: GrantReportListItem
): number {
  return (
    REPORT_TYPES.indexOf(a.reportType) - REPORT_TYPES.indexOf(b.reportType) ||
    a.reportNumber - b.reportNumber
  )
}

// Every report of the current report's grant, the current one included:
// interim reports first, then by number.
export function listGrantReports(
  reports: readonly GrantReport[],
  current: GrantReport
): GrantReportListItem[] {
  return reports
    .filter(({ grantId }) => grantId === current.grantId)
    .map((report) => ({
      reportType: report.reportType,
      reportNumber: report.reportNumber,
      reportPath: grantReportPath(report),
      isCurrent: report.id === current.id
    }))
    .sort(compareListItems)
}

function findGrantFacts(
  grantees: readonly GranteeProject[],
  grantId: string
): GrantFacts | null {
  const grant = grantees.find(({ id }) => id === grantId)
  if (!grant) return null
  const { budgetLabel, program, grantPeriodLabel, leaders, country } = grant
  return { budgetLabel, program, grantPeriodLabel, leaders, country }
}

// One static path per report. The caller passes the other files in, so this
// stays a pure function of its input. Two reports with one URL fail the
// build: one of them would never be built.
export function getGrantReportRoutes(
  data: unknown,
  sources: GrantReportSources
): GrantReportRoute[] | Error {
  const reports = parseGrantReports(data)
  if (reports instanceof Error) return reports
  const shared = findSharedReportPaths(reports)
  if (shared.length > 0) {
    return new Error(`Grant report URLs must be unique:\n${shared.join('\n')}`)
  }
  return reports.map((report) => ({
    params: { slug: report.granteeSlug, report: grantReportSegment(report) },
    props: {
      report,
      reportPath: grantReportPath(report),
      granteeName: sources.granteeNames.get(report.granteeSlug) ?? null,
      grant: findGrantFacts(sources.grantees, report.grantId),
      grantReports: listGrantReports(reports, report)
    }
  }))
}

// Interim reports first, then final ones, each by number.
export function compareGrantReports(
  a: Pick<GrantReport, 'reportType' | 'reportNumber'>,
  b: Pick<GrantReport, 'reportType' | 'reportNumber'>
): number {
  const byType =
    REPORT_TYPES.indexOf(a.reportType) - REPORT_TYPES.indexOf(b.reportType)
  return byType || a.reportNumber - b.reportNumber
}

const REPORT_DATE_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES'
}

// A report date (YYYY-MM-DD) as the page shows it: month and year, for
// example "September 2026". Formatted in UTC: Airtable dates have no time, and
// in a zone west of UTC the local date of UTC midnight is the day before.
export function formatReportMonth(isoDate: string, lang: Locale): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString(REPORT_DATE_LOCALES[lang], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })
}
