import { defaultLocale, type Locale } from './i18'
export function formatDate(iso: string, lang = defaultLocale) {
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

export function getDurationInMinutes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
}
