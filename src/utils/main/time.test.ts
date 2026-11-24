import { describe, expect, it, vi } from 'vitest'

// `./i18` reaches Astro's virtual modules for i18n config.
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

const { formatSessionDate, formatSessionTime, getDurationInMinutes } =
  await import('./time')

// Sessionize format: local venue time, no offset.
const STARTS_AT = '2025-11-05T10:00:00'

describe('formatSessionDate', () => {
  it('gives the weekday, day, month and year without a comma', () => {
    expect(formatSessionDate(STARTS_AT, 'en')).toBe('Wed 5 Nov 2025')
    expect(formatSessionDate(STARTS_AT, 'es')).toBe('Mié 5 nov 2025')
  })

  it('returns an empty string for an unparseable date', () => {
    expect(formatSessionDate('not a date', 'en')).toBe('')
  })
})

describe('formatSessionTime', () => {
  it('uses the 24-hour clock', () => {
    expect(formatSessionTime(STARTS_AT, 'en')).toBe('10:00')
    expect(formatSessionTime('2025-11-05T15:30:00', 'es')).toBe('15:30')
  })

  it('returns an empty string for an unparseable date', () => {
    expect(formatSessionTime('', 'en')).toBe('')
  })
})

describe('getDurationInMinutes', () => {
  it('counts whole minutes between start and end', () => {
    expect(getDurationInMinutes(STARTS_AT, '2025-11-05T11:00:00')).toBe(60)
  })
})
