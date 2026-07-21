/**
 * Faq-specific types.
 * Used by the faq lifecycle and any lifecycle that references FAQs.
 */

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqSection {
  heading: string
  items: FaqItem[]
}

export interface FaqBase {
  id?: number
  documentId?: string
  pathSlug: string
  title: string
  heading: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  description: string
  introParagraph?: string | null
  faqSections: FaqSection[]
  locale?: string
  publishedAt?: string
}
