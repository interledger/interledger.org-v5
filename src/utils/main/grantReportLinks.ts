import { z } from 'zod'
import type {
  GrantReport,
  GrantReportType,
  LegacyGrantReport
} from '@/types/airtable'
import { isRecordId } from './airtableFieldValues'
import { FORUM_HOSTNAME } from './airtableLegacyReports'
import { REPORT_TYPES } from './airtableReports'
import { grantReportPath } from './grantReports'

// The report links of each grant in the grantee directory. A report can be a
// page on this site (grant-reports.json) or an older post on the community
// forum (legacy-grant-reports.json).

const legacyGrantReportSchema = z.object({
  grantId: z.string().refine(isRecordId, 'expected an Airtable record ID'),
  reportType: z.enum(REPORT_TYPES),
  reportNumber: z.number().int().positive(),
  url: z
    .string()
    .url()
    .refine(
      (url) => new URL(url).hostname === FORUM_HOSTNAME,
      `expected a link to ${FORUM_HOSTNAME}`
    )
}) satisfies z.ZodType<LegacyGrantReport>

// The sync validates every row before it writes the file, so a failure here
// means a hand edit, or the sync and the site disagree on the shape.
export function parseLegacyGrantReports(
  data: unknown
): LegacyGrantReport[] | Error {
  const result = z.array(legacyGrantReportSchema).safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    return new Error(
      `legacy-grant-reports.json does not match the report shape at ${issue?.path.join('.') ?? '(root)'}: ${issue?.message ?? 'unknown error'}`
    )
  }
  return result.data
}

interface ReportLinkBase {
  reportType: GrantReportType
  reportNumber: number
}

// `path` is a site path without the locale prefix; localize it to link.
export type GrantReportLink =
  | (ReportLinkBase & { kind: 'page'; path: string })
  | (ReportLinkBase & { kind: 'forum'; url: string })

export interface GrantReportLinkSources {
  // Pass [] while the report pages are hidden (hideGrantReports()), so the
  // card falls back to the forum links instead of linking to a missing page.
  reports: readonly Pick<
    GrantReport,
    'grantId' | 'granteeSlug' | 'projectId' | 'reportType' | 'reportNumber'
  >[]
  legacyReports: readonly LegacyGrantReport[]
}

function linkKey({ reportType, reportNumber }: ReportLinkBase): string {
  return `${reportType} ${reportNumber}`
}

function compareLinks(a: ReportLinkBase, b: ReportLinkBase): number {
  return (
    REPORT_TYPES.indexOf(a.reportType) - REPORT_TYPES.indexOf(b.reportType) ||
    a.reportNumber - b.reportNumber
  )
}

function groupByGrant<T extends { grantId: string }>(
  items: readonly T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    groups.set(item.grantId, [...(groups.get(item.grantId) ?? []), item])
  }
  return groups
}

// Each grant's report links, interim reports first, then by number. A report
// with a page on this site links there. A report with only a forum post links
// to the forum. Sarah's order, decided per report: a grant can show a page
// for one report and a forum post for another. A grant with no reports has
// no entry.
export function buildGrantReportLinks({
  reports,
  legacyReports
}: GrantReportLinkSources): ReadonlyMap<string, GrantReportLink[]> {
  const pagesByGrant = groupByGrant(reports)
  const forumByGrant = groupByGrant(legacyReports)
  const grantIds = new Set([...pagesByGrant.keys(), ...forumByGrant.keys()])
  const links = new Map<string, GrantReportLink[]>()
  for (const grantId of grantIds) {
    const pages: GrantReportLink[] = (pagesByGrant.get(grantId) ?? []).map(
      (report) => ({
        kind: 'page',
        reportType: report.reportType,
        reportNumber: report.reportNumber,
        path: grantReportPath(report)
      })
    )
    const pageKeys = new Set(pages.map(linkKey))
    const forum: GrantReportLink[] = (forumByGrant.get(grantId) ?? [])
      .filter((report) => !pageKeys.has(linkKey(report)))
      .map(({ reportType, reportNumber, url }) => ({
        kind: 'forum',
        reportType,
        reportNumber,
        url
      }))
    links.set(grantId, [...pages, ...forum].sort(compareLinks))
  }
  return links
}
