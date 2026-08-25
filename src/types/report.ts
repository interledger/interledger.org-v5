export const REPORT_TEXT_TYPES = [
  'Paragraph',
  'Disclaimer',
  'References'
] as const
export type ReportTextType = (typeof REPORT_TEXT_TYPES)[number]
