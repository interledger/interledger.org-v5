/**
 * MDX generation for the faq-page content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 */

import matter from 'gray-matter'
import { defaultLang, MATTER_STRINGIFY_OPTIONS } from './mdx'

export interface FaqMdxInput {
  title: string
  pathSlug: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  description?: string | null
  heading: string
  introParagraph?: string | null
  locale?: string
}

/**
 * Serialize a FAQ page into MDX (frontmatter only — no body yet).
 * For non-default locales, `englishSlug` is written as `localizes`.
 */
export function generateFaqMdx(faq: FaqMdxInput, englishSlug?: string): string {
  const isLocalized = faq.locale !== defaultLang

  const frontmatter: Record<string, unknown> = {
    title: faq.title,
    pathSlug: faq.pathSlug,
    ...(faq.section ? { section: faq.section } : {}),
    description: faq.description ?? null,
    heading: faq.heading,
    introParagraph: faq.introParagraph ?? null,
    locale: faq.locale ?? defaultLang,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  return matter.stringify('', frontmatter, MATTER_STRINGIFY_OPTIONS)
}
