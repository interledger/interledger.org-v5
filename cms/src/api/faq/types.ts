/**
 * Faq-specific types.
 * Used by the faq lifecycle and any lifecycle that references FAQs.
 */

export interface FaqBase {
  id?: number
  documentId?: string
  pathSlug: string
  title: string
  heading: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  description: string
  introParagraph?: string | null
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  locale?: string
  publishedAt?: string
}
