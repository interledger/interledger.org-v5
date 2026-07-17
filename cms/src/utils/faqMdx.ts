/**
 * MDX generation for the faq content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 */

import matter from 'gray-matter'
import { defaultLang, MATTER_STRINGIFY_OPTIONS } from './mdx'

export interface FaqMdxItem {
  question: string
  answer: string
}

export interface FaqMdxSection {
  heading: string
  items: FaqMdxItem[]
}

export interface FaqMdxInput {
  title: string
  pathSlug: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  heading: string
  description: string
  introParagraph?: string | null
  faqSections: FaqMdxSection[]
  locale?: string
}

/**
 * Serialize a FAQ page into MDX (frontmatter only — no body).
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
    faqSections: faq.faqSections,
    locale: resolvedLocale,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  return matter.stringify('', frontmatter, MATTER_STRINGIFY_OPTIONS)
}
