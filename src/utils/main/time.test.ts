import { describe, expect, it, vi } from 'vitest'

// West of UTC, so formatting in local time would give the day before.
process.env.TZ = 'America/New_York'

// `./time` -> `./i18` -> `./locales` reaches into Astro's virtual modules for
// i18n config. Mock them with a minimal en/es setup (see breadcrumbs.test.ts).
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z }
})

const { formatAgendaDate } = await import('./time')

describe('formatAgendaDate', () => {
  it('formats a calendar day as weekday, month and day', () => {
    expect(formatAgendaDate('2026-10-16', 'en')).toBe('Friday, October 16')
    expect(formatAgendaDate('2026-10-16', 'es')).toBe('viernes, 16 de octubre')
  })

  it('keeps the day in a zone west of UTC, reading it as UTC', () => {
    // Midnight UTC on the 1st is still October 31st in New York.
    expect(formatAgendaDate('2026-11-01', 'en')).toBe('Sunday, November 1')
  })

  it('returns an empty string for a malformed or impossible date', () => {
    expect(formatAgendaDate('Friday October 16', 'en')).toBe('')
    expect(formatAgendaDate('2026-02-30', 'en')).toBe('')
    expect(formatAgendaDate('2026-13-01', 'en')).toBe('')
    expect(formatAgendaDate('2026-00-15', 'en')).toBe('')
    expect(formatAgendaDate('', 'en')).toBe('')
  })
})
