import { describe, expect, it, vi } from 'vitest'
import type { LegacyGrantReport } from '@/types/airtable'

// `./grantReports` -> `./routes` reaches Astro's virtual modules for i18n
// config. Only path building runs here (as grantReports.test.ts).
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z, getCollection: vi.fn().mockResolvedValue([]) }
})

const { buildGrantReportLinks, parseLegacyGrantReports } =
  await import('./grantReportLinks')

const GRANT_ID = 'recUSF6jZiBVoqG01'
const OTHER_GRANT_ID = 'recdUkEFGFR3970nG'
const FORUM = 'https://community.interledger.org/gib'

function legacy(overrides: Partial<LegacyGrantReport> = {}): LegacyGrantReport {
  return {
    grantId: GRANT_ID,
    reportType: 'Interim Report',
    reportNumber: 1,
    url: `${FORUM}/interim-1`,
    ...overrides
  }
}

const page = {
  grantId: GRANT_ID,
  granteeSlug: 'gib',
  projectId: '20260504',
  reportType: 'Interim Report' as const,
  reportNumber: 2
}

describe('parseLegacyGrantReports', () => {
  it('accepts the file as the sync writes it', () => {
    expect(parseLegacyGrantReports([legacy()])).toEqual([legacy()])
    expect(parseLegacyGrantReports([])).toEqual([])
  })

  it('accepts a link to another site', () => {
    const report = legacy({ url: 'https://example.com/report' })
    expect(parseLegacyGrantReports([report])).toEqual([report])
  })

  it('fails on a url that is not a web link', () => {
    const result = parseLegacyGrantReports([legacy({ url: 'javascript:0' })])
    expect((result as Error).message).toContain('0.url')
  })

  it('fails on a grantId that is not a record ID', () => {
    const result = parseLegacyGrantReports([legacy({ grantId: 'Gib' })])
    expect((result as Error).message).toContain('0.grantId')
  })

  it('fails on a file that is not a list', () => {
    expect(parseLegacyGrantReports({})).toBeInstanceOf(Error)
  })
})

describe('buildGrantReportLinks', () => {
  it('links a report page and a legacy post of one grant, in report order', () => {
    const links = buildGrantReportLinks({
      reports: [page],
      legacyReports: [
        legacy({ reportType: 'Final Report', url: `${FORUM}/final-1` }),
        legacy()
      ]
    })
    expect(links.get(GRANT_ID)).toEqual([
      {
        kind: 'legacy',
        reportType: 'Interim Report',
        reportNumber: 1,
        url: `${FORUM}/interim-1`
      },
      {
        kind: 'page',
        reportType: 'Interim Report',
        reportNumber: 2,
        path: 'grant/grantees/gib/reports/20260504-interim-2'
      },
      {
        kind: 'legacy',
        reportType: 'Final Report',
        reportNumber: 1,
        url: `${FORUM}/final-1`
      }
    ])
  })

  it('links the page, not the legacy post, when a report has both', () => {
    const links = buildGrantReportLinks({
      reports: [{ ...page, reportNumber: 1 }],
      legacyReports: [legacy()]
    })
    expect(links.get(GRANT_ID)?.map(({ kind }) => kind)).toEqual(['page'])
  })

  it('falls back to the legacy post while the report pages are hidden', () => {
    const links = buildGrantReportLinks({
      reports: [],
      legacyReports: [legacy()]
    })
    expect(links.get(GRANT_ID)?.map(({ kind }) => kind)).toEqual(['legacy'])
  })

  it('keeps the links of each grant apart, and has no entry for a grant with none', () => {
    const links = buildGrantReportLinks({
      reports: [],
      legacyReports: [legacy(), legacy({ grantId: OTHER_GRANT_ID })]
    })
    expect(links.get(GRANT_ID)).toHaveLength(1)
    expect(links.get(OTHER_GRANT_ID)).toHaveLength(1)
    expect(links.get('recNone0000000000')).toBeUndefined()
  })
})
