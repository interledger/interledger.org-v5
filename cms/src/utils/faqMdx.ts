/**
 * MDX generation for the faq content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 */

import matter from 'gray-matter'
import isHtml from 'is-html'
import { defaultLang, MATTER_STRINGIFY_OPTIONS, htmlToMarkdown } from './mdx'

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
/**
 * CKEditor (basicMarkdownPreset) fields are usually already markdown, but
 * defensively convert if Strapi ever hands back HTML (matches
 * generateReportMdx's identical introParagraph handling).
 */
function ckeditorFieldToMarkdown(value: string): string {
  return (isHtml(value) ? htmlToMarkdown(value) : value).trim()
}

export function generateFaqMdx(faq: FaqMdxInput, englishSlug?: string): string {
  const resolvedLocale = faq.locale ?? defaultLang
  const isLocalized = resolvedLocale !== defaultLang

  const introParagraph = faq.introParagraph
    ? ckeditorFieldToMarkdown(faq.introParagraph)
    : null

  // Strapi's populated component rows carry their own internal `id` (and, for
  // items, __component/__pivot metadata) alongside heading/question/answer.
  // Map explicitly rather than passing the row through as-is so none of that
  // Strapi-internal bookkeeping leaks into the MDX frontmatter — matching the
  // explicit-field-mapping convention used elsewhere (e.g. grant page's
  // ctaStrip). These ids serve no round-trip purpose: the frontmatter schema
  // doesn't declare an `id` field, so Zod already strips it back out on
  // MDX -> Strapi import.
  const faqSections = faq.faqSections.map((section) => ({
    heading: section.heading,
    items: section.items.map((item) => ({
      question: item.question,
      answer: ckeditorFieldToMarkdown(item.answer)
    }))
  }))

  const frontmatter: Record<string, unknown> = {
    title: faq.title,
    pathSlug: faq.pathSlug,
    ...(faq.section ? { section: faq.section } : {}),
    heading: faq.heading,
    description: faq.description,
    ...(introParagraph ? { introParagraph } : {}),
    faqSections,
    locale: resolvedLocale,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  return matter.stringify('', frontmatter, MATTER_STRINGIFY_OPTIONS)
}
