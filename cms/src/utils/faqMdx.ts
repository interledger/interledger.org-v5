/**
 * MDX generation for the faq content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 */

import matter from 'gray-matter'
import { defaultLang, MATTER_STRINGIFY_OPTIONS } from './mdx'
import { serializeContent } from '../serializers/blocks'

export interface FaqMdxInput {
  title: string
  pathSlug: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  heading: string
  description: string
  introParagraph?: string | null
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  locale?: string
}

/**
 * Serialize a FAQ page into MDX (frontmatter + markdown body).
 * For non-default locales, `englishSlug` is written as `localizes`.
 */
export function generateFaqMdx(faq: FaqMdxInput, englishSlug?: string): string {
  const resolvedLocale = faq.locale ?? defaultLang
  const isLocalized = resolvedLocale !== defaultLang

  const frontmatter: Record<string, unknown> = {
    title: faq.title,
    pathSlug: faq.pathSlug,
    ...(faq.section ? { section: faq.section } : {}),
    heading: faq.heading,
    description: faq.description,
    ...(faq.introParagraph ? { introParagraph: faq.introParagraph } : {}),
    locale: resolvedLocale,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  const blocksBody = faq.content?.length ? serializeContent(faq.content) : ''
  return matter.stringify(
    blocksBody ? `\n${blocksBody}\n` : '',
    frontmatter,
    MATTER_STRINGIFY_OPTIONS
  )
}
