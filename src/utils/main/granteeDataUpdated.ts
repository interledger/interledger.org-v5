import { z } from 'zod'
import { isIsoDate } from './airtableFieldValues'
import type { Locale } from './i18'

// The locale each Airtable date is formatted in.
export const AIRTABLE_DATE_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES'
}

const lastUpdatedSchema = z.object({
  date: z.string().refine(isIsoDate, 'is not a YYYY-MM-DD date')
})

// Reads src/data/airtable/last-updated.json: the day the Airtable sync last
// brought changed data. The sync writes it only when the data changed, so an
// old date tells Programs that the data review has stalled (INTORG-1463).
export function parseGranteeDataLastUpdated(raw: unknown): string | Error {
  const result = lastUpdatedSchema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    return new Error(
      `last-updated.json does not match { date: "YYYY-MM-DD" } at ${issue?.path.join('.') || '(root)'}: ${issue?.message ?? 'unknown error'}`
    )
  }
  return result.data.date
}

// A YYYY-MM-DD date as a full day, for example "November 24, 2026". Formatted
// in UTC: in a zone west of UTC the local date of UTC midnight is the day before.
export function formatAirtableDay(isoDate: string, lang: Locale): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString(AIRTABLE_DATE_LOCALES[lang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })
}
