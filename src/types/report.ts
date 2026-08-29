export const REPORT_TEXT_TYPES = [
  'Paragraph',
  'Disclaimer',
  'References',
  'Button'
] as const
export type ReportTextType = (typeof REPORT_TEXT_TYPES)[number]
