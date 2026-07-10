/**
 * FaqPage-specific types.
 * Used by the faq-page lifecycle and any lifecycle that references FAQ pages.
 */

export interface FaqPageBase {
  id?: number
  documentId?: string
  pathSlug: string
  title: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  description?: string | null
  heading: string
  introParagraph?: string | null
}
