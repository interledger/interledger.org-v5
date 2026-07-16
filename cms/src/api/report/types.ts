/**
 * Report-specific types.
 * Used by the report lifecycle and any lifecycle that references reports.
 */

export interface ReportDate {
  publishDate?: string
  lastUpdated?: string
}

export interface ReportBase {
  id?: number
  documentId?: string
  pathSlug: string
  title: string
  heading: string
  section?: 'summit' | 'hackathon' | 'foundation' | null
  description: string
  introParagraph?: string | null
  date?: ReportDate | null
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  locale?: string
  publishedAt?: string
}
