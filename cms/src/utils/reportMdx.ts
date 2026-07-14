/**
 * MDX generation for the report content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 */

import matter from 'gray-matter'
import { defaultLang, MATTER_STRINGIFY_OPTIONS } from './mdx'
import { serializeContent } from '../serializers/blocks'

export interface ReportMdxDate {
  publishDate?: string
  lastUpdated?: string
}

export interface ReportMdxInput {
  title: string
  pathSlug: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  heading: string
  description: string
  introParagraph?: string | null
  date?: ReportMdxDate | null
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  locale?: string
}

/** Build the frontmatter date object, omitting it entirely when publishDate is absent. */
function dateFrontmatter(
  date: ReportMdxDate | null | undefined
): Record<string, unknown> | undefined {
  if (!date?.publishDate) return undefined
  return {
    publishDate: date.publishDate,
    ...(date.lastUpdated ? { lastUpdated: date.lastUpdated } : {})
  }
}

/**
 * Serialize a report page into MDX (frontmatter + markdown body).
 * For non-default locales, `englishSlug` is written as `localizes`.
 */
export function generateReportMdx(
  report: ReportMdxInput,
  englishSlug?: string
): string {
  const resolvedLocale = report.locale ?? defaultLang
  const isLocalized = resolvedLocale !== defaultLang
  const date = dateFrontmatter(report.date)

  const frontmatter: Record<string, unknown> = {
    title: report.title,
    pathSlug: report.pathSlug,
    ...(report.section ? { section: report.section } : {}),
    heading: report.heading,
    description: report.description,
    ...(report.introParagraph ? { introParagraph: report.introParagraph } : {}),
    ...(date ? { date } : {}),
    locale: resolvedLocale,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  const blocksBody = report.content?.length
    ? serializeContent(report.content)
    : ''
  return matter.stringify(
    blocksBody ? `\n${blocksBody}\n` : '',
    frontmatter,
    MATTER_STRINGIFY_OPTIONS
  )
}
