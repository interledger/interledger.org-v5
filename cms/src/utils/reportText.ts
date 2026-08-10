export const REPORT_TEXT_TYPES = ['Paragraph', 'Disclaimer'] as const
export type ReportTextType = (typeof REPORT_TEXT_TYPES)[number]

export function isReportTextType(value: string): value is ReportTextType {
  return REPORT_TEXT_TYPES.includes(value as ReportTextType)
}
