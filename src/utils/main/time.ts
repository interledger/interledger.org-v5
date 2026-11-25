import { defaultLocale, type Locale } from './i18'

const SUMMIT_DATE_LOCALES: Record<Locale, string> = {
  es: 'es-ES',
  en: 'en-GB'
}

function summitDateLocale(lang: Locale): string {
  return SUMMIT_DATE_LOCALES[lang] ?? SUMMIT_DATE_LOCALES[defaultLocale]
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const SESSION_DATE_PARTS: Intl.DateTimeFormatPartTypes[] = [
  'weekday',
  'day',
  'month',
  'year'
]

/**
 * A talk's day, e.g. "Wed 5 Nov 2025" or "Mié 5 nov 2025". Sessionize times
 * carry no offset, so they parse and format in the same zone and read as the
 * venue's local time on any build machine.
 */
export function formatSessionDate(iso: string, lang = defaultLocale): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat(summitDateLocale(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).formatToParts(date)
  // Built from the parts, not the formatted string: the punctuation between
  // them (a comma after the weekday in en-GB) varies with the ICU version.
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return capitalize(SESSION_DATE_PARTS.map(part).filter(Boolean).join(' '))
}

/** A talk's start time on the 24-hour clock, e.g. "10:00". */
export function formatSessionTime(iso: string, lang = defaultLocale): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(summitDateLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

// Summit pages — en-GB format with weekday and time (e.g. "Thu, 19 Jun 2026, 14:00")
export function formatDateTime(iso: string, lang = defaultLocale) {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''

  const locale = summitDateLocale(lang)

  let formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)

  formatted = capitalize(formatted)
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

export function getDurationInMinutes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
}
