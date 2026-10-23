import { defaultLocale, type Locale } from './i18'
// Summit pages — en-GB format with weekday and time (e.g. "Thu, 19 Jun 2026, 14:00")
export function formatDateTime(iso: string, lang = defaultLocale) {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''

  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-GB'
  }
  const locale = localeMap[lang] ?? localeMap[defaultLocale]

  let formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)

  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1)
  return formatted
}

// Blog pages — en-US format, date only (e.g. "Jun 19, 2026")
export function formatDate(date: Date, lang = defaultLocale) {
  if (isNaN(date.getTime())) return ''

  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-US'
  }
  const locale = localeMap[lang] ?? localeMap[defaultLocale]

  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// Agenda day headings — weekday, month and day, no year (e.g. "Friday,
// October 16"). The date is a calendar day with no time zone, so it is read
// and formatted in UTC: any other zone can shift it to the day before.
export function formatAgendaDate(isoDate: string, lang = defaultLocale) {
  const match = CALENDAR_DATE.exec(isoDate)
  if (!match) return ''

  const [, year, month, day] = match.map(Number)
  // Date rolls an impossible day over (2026-02-30 → March 2, 2026-13-01 →
  // the next January), so check every part survived.
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  )
    return ''

  const localeMap: Record<Locale, string> = {
    es: 'es-ES',
    en: 'en-US'
  }
  const locale = localeMap[lang] ?? localeMap[defaultLocale]

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

export function getDurationInMinutes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
}
