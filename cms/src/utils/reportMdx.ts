/**
 * MDX generation for the report content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 */

import matter from 'gray-matter'
import {
  ckeditorFieldToMarkdown,
  defaultLang,
  MATTER_STRINGIFY_OPTIONS
} from './mdx'
import { escMdxBraces } from '../serializers/shared'
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
    ...(date ? { date } : {}),
    locale: resolvedLocale,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  // Rendered as part of the MDX body (not frontmatter) so it flows through
  // Astro's remark-gfm pipeline along with the rest of the report — this is
  // what gives an intro-authored footnote ([^1]) the same numbering/anchor
  // handling as the report's body sections. See ReportPage.astro.
  const introBlock = report.introParagraph
    ? `<ReportIntro>\n\n${escMdxBraces(ckeditorFieldToMarkdown(report.introParagraph))}\n\n</ReportIntro>`
    : ''
  const blocksBody = report.content?.length
    ? serializeContent(report.content)
    : ''
  const body = [introBlock, blocksBody].filter(Boolean).join('\n\n')

  return matter.stringify(
    body ? `\n${body}\n` : '',
    frontmatter,
    MATTER_STRINGIFY_OPTIONS
  )
}
