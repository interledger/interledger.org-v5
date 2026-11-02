import { z } from 'zod'
import type { GrantReport } from '@/types/airtable'
import { isRecordId } from './airtableFieldValues'
import { syncedImageSchema } from './airtableJsonSchemas'

// Reads src/data/airtable/grant-reports.json for the report pages. The
// Airtable sync validates every report before it writes the file, so a
// failure here means a hand edit, or the sync and the site disagree on the
// shape. The build fails then, instead of rendering a report with holes in it.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isoDate = z.string().regex(ISO_DATE)
const markdown = z.string().min(1)
// The sync requires at least one option in each multiple-select field.
const options = z.array(z.string().min(1)).min(1)

const grantReportSchema = z.object({
  id: z.string().min(1),
  grantId: z.string().refine(isRecordId, 'expected an Airtable record ID'),
  projectName: z.string().min(1),
  reportType: z.enum(['Interim Report', 'Final Report']),
  reportNumber: z.number().int().positive(),
  publishedDate: isoDate,
  reportingPeriodStart: isoDate,
  reportingPeriodEnd: isoDate,
  summary: markdown,
  progressOnObjectives: markdown,
  whoBenefits: markdown,
  outputs: markdown,
  whatsNext: markdown,
  license: z.string().min(1),
  outputTypes: options,
  interledgerTechnologies: options,
  images: z.array(syncedImageSchema)
}) satisfies z.ZodType<GrantReport>

const grantReportsSchema = z.array(grantReportSchema)

export function parseGrantReports(data: unknown): GrantReport[] | Error {
  const result = grantReportsSchema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    return new Error(
      `grant-reports.json does not match the report shape at ${issue?.path.join('.') ?? '(root)'}: ${issue?.message ?? 'unknown error'}`
    )
  }
  return result.data
}
