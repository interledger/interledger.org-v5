import { z } from 'zod'
import type { GrantReport, GrantReportType } from '@/types/airtable'
import { isRecordId } from './airtableFieldValues'
import { SLUG_PATTERN } from './airtableProfiles'
import { PROJECT_ID_PATTERN } from './airtableReports'
import type { Locale } from './i18'
import { syncedImageSchema } from './airtableJsonSchemas'
import { granteeBasePath } from './routes'

// Reads src/data/airtable/grant-reports.json for the report pages. The
// Airtable sync validates every report before it writes the file, so a
// failure here means a hand edit, or the sync and the site disagree on the
// shape. The build fails then, instead of rendering a report with holes in it.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isoDate = z.string().regex(ISO_DATE)
// Programs can leave any of these empty (meeting, 2026-11-10).
const optionalDate = isoDate.nullable()
const markdown = z.string()
const options = z.array(z.string().min(1))

const grantReportSchema = z.object({
  id: z.string().min(1),
  grantId: z.string().refine(isRecordId, 'expected an Airtable record ID'),
  projectId: z.string().regex(PROJECT_ID_PATTERN),
  granteeSlug: z.string().regex(SLUG_PATTERN),
  projectName: z.string().min(1),
  reportType: z.enum(['Interim Report', 'Final Report']),
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
// profiles ship (Sarah, INTORG-1310).
export function grantReportPath(
  report: Pick<
    GrantReport,
    'granteeSlug' | 'projectId' | 'reportType' | 'reportNumber'
  >
): string {
  return `${granteeBasePath(report.granteeSlug)}/reports/${grantReportSegment(report)}`
}

export interface GrantReportRoute {
  params: { slug: string; report: string }
  props: { report: GrantReport; reportPath: string }
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

// One static path per report, or none while the feature gate is on. The
// caller passes the gate in, so this stays a pure function of its input. Two
// reports with one URL fail the build: one of them would never be built.
export function getGrantReportRoutes(
  data: unknown,
  hideReports: boolean
): GrantReportRoute[] | Error {
  if (hideReports) return []
  const reports = parseGrantReports(data)
  if (reports instanceof Error) return reports
  const shared = findSharedReportPaths(reports)
  if (shared.length > 0) {
    return new Error(`Grant report URLs must be unique:\n${shared.join('\n')}`)
  }
  return reports.map((report) => ({
    params: { slug: report.granteeSlug, report: grantReportSegment(report) },
    props: { report, reportPath: grantReportPath(report) }
  }))
}

const REPORT_DATE_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES'
}

// A report date (YYYY-MM-DD) as the page shows it, for example "Nov 15, 2026".
// Formatted in UTC: Airtable dates have no time, and in a zone west of UTC the
// local date of UTC midnight is the day before.
export function formatReportDate(isoDate: string, lang: Locale): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString(REPORT_DATE_LOCALES[lang], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
}
