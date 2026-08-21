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
import { serializeContent } from '../serializers/blocks'
import type { AuthorBio } from './contentTypes'

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
  author_bio?: AuthorBio[] | null
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
 * Build the frontmatter authorBios array, omitting it entirely when no bios
 * are present. Throws when a bio has no author — defense-in-depth mirroring
 * generateBlogMDX's identical check (the primary enforcement point is
 * validateReportAuthorBio in contentValidation.ts, which runs at save time).
 */
function authorBiosFrontmatter(
  bios: AuthorBio[] | null | undefined
): Record<string, unknown>[] | undefined {
  if (!bios || bios.length === 0) return undefined
  return bios.map((bio) => {
    if (!bio.author?.trim()) throw new Error('Author Bio: Name is required')
    const text = bio.profileBio ? ckeditorFieldToMarkdown(bio.profileBio) : null
    return {
      author: bio.author,
      ...(bio.link ? { link: bio.link } : {}),
      ...(text ? { text } : {}),
      ...(bio.media?.image ? { image: bio.media.image.url } : {}),
      ...(bio.media?.image
        ? { imageAlt: bio.media.alternativeText ?? bio.author }
        : {})
    }
  })
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
  const authorBios = authorBiosFrontmatter(report.author_bio)
  const introParagraph = report.introParagraph
    ? ckeditorFieldToMarkdown(report.introParagraph)
    : null

  const frontmatter: Record<string, unknown> = {
    title: report.title,
    pathSlug: report.pathSlug,
    ...(report.section ? { section: report.section } : {}),
    heading: report.heading,
    description: report.description,
    ...(introParagraph ? { introParagraph } : {}),
    ...(date ? { date } : {}),
    ...(authorBios ? { authorBios } : {}),
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
