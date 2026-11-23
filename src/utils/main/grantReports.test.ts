import { describe, expect, it, vi } from 'vitest'
import type { GrantReport } from '@/types/airtable'
import type { GranteeProject } from './grantee'

// `./routes` -> `./locales` reaches Astro's virtual modules for i18n config.
// Only path building runs here, so minimal mocks are enough (as routes.test.ts).
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

const {
  formatReportMonth,
  getGrantReportRoutes,
  grantReportLabel,
  grantReportPath,
  grantReportSegment,
  listGrantReports,
  parseGrantReports,
  readGranteeNames
} = await import('./grantReports')
const { useTranslations } = await import('./i18')

function report(overrides: Partial<GrantReport> = {}): GrantReport {
  return {
    id: 'recReport0000001',
    grantId: 'recUSF6jZiBVoqG01',
    projectId: '20260504',
    granteeSlug: 'gib',
    projectName: 'Gib',
    reportType: 'Interim Report',
    reportNumber: 1,
    publishedDate: '2026-11-15',
    reportingPeriodStart: '2026-05-01',
    reportingPeriodEnd: '2026-10-31',
    summary: 'We built **the thing**.',
    progressOnObjectives: 'On track.',
    whoBenefits: 'Small merchants.',
    outputs: 'A library.',
    whatsNext: 'The final report.',
    license: 'Apache-2.0',
    outputTypes: ['Software'],
    interledgerTechnologies: ['Open Payments'],
    images: [],
    ...overrides
  }
}

describe('parseGrantReports', () => {
  it('accepts reports as the sync writes them', () => {
    const image = {
      path: '/img/grantee-reports/recReport0000001/att1.webp',
      width: 2400,
      height: 1600,
      alt: ''
    }
    const data = [report(), report({ id: 'rec2', images: [image] })]
    expect(parseGrantReports(data)).toEqual(data)
  })

  it('accepts an empty file, as before the first Live report', () => {
    expect(parseGrantReports([])).toEqual([])
  })

  it('fails on a report type the template does not know', () => {
    const result = parseGrantReports([
      { ...report(), reportType: 'Mid-term Report' }
    ])
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('0.reportType')
  })

  it('fails on a date that is not YYYY-MM-DD', () => {
    const result = parseGrantReports([report({ publishedDate: '15/11/2026' })])
    expect((result as Error).message).toContain('0.publishedDate')
  })

  it('fails on a date that does not exist', () => {
    const result = parseGrantReports([report({ publishedDate: '2026-02-30' })])
    expect((result as Error).message).toContain('0.publishedDate')
  })

  it('fails on a grantId that is not a record ID', () => {
    const result = parseGrantReports([report({ grantId: 'Gib 2022' })])
    expect((result as Error).message).toContain('0.grantId')
  })

  it('fails on a grantee slug that cannot be a URL segment', () => {
    const result = parseGrantReports([report({ granteeSlug: 'Café-Gib' })])
    expect((result as Error).message).toContain('0.granteeSlug')
  })

  it('fails on a Project id that is not digits', () => {
    const result = parseGrantReports([report({ projectId: '2026-0504' })])
    expect((result as Error).message).toContain('0.projectId')
  })

  it('accepts a report with every content field empty', () => {
    const empty = report({
      reportingPeriodStart: null,
      reportingPeriodEnd: null,
      summary: '',
      progressOnObjectives: '',
      whoBenefits: '',
      outputs: '',
      whatsNext: '',
      license: '',
      outputTypes: [],
      interledgerTechnologies: []
    })
    expect(parseGrantReports([empty])).toEqual([empty])
  })

  it('fails on an image path that is not site-relative', () => {
    const image = {
      path: 'https://v5.airtableusercontent.com/x',
      width: 1,
      height: 1,
      alt: ''
    }
    expect(parseGrantReports([report({ images: [image] })])).toBeInstanceOf(
      Error
    )
  })

  it('fails on a file that is not a list', () => {
    expect(parseGrantReports({})).toBeInstanceOf(Error)
  })
})

describe('formatReportMonth', () => {
  it('formats month and year in UTC, so the month never moves', () => {
    expect(formatReportMonth('2026-09-30', 'en')).toBe('September 2026')
    expect(formatReportMonth('2026-01-01', 'en')).toBe('January 2026')
  })

  it('formats for the route locale', () => {
    expect(formatReportMonth('2026-11-15', 'es')).toBe('noviembre de 2026')
  })

  it('returns the value as is when it is not a date', () => {
    expect(formatReportMonth('soon', 'en')).toBe('soon')
  })
})

describe('grantReportLabel', () => {
  it('names the report by type and number', () => {
    const t = useTranslations('en')
    expect(grantReportLabel(report(), t)).toBe('Interim report 1')
    expect(
      grantReportLabel(
        report({ reportType: 'Final Report', reportNumber: 2 }),
        t
      )
    ).toBe('Final report 2')
  })
})

describe('grantReportPath', () => {
  it('puts the report under its grantee, keyed by Project id, type and number', () => {
    expect(grantReportSegment(report())).toBe('20260504-interim-1')
    expect(grantReportSegment(report({ reportType: 'Final Report' }))).toBe(
      '20260504-final-1'
    )
    expect(grantReportPath(report())).toBe(
      'grant/grantees/gib/reports/20260504-interim-1'
    )
  })

  it('tells apart two grants of one grantee by their Project id', () => {
    const other = report({ projectId: '20260505' })
    expect(grantReportPath(other)).not.toBe(grantReportPath(report()))
  })
})

const OTHER_GRANT_ID = 'recdUkEFGFR3970nG'

function grantee(overrides: Partial<GranteeProject> = {}): GranteeProject {
  return {
    id: 'recUSF6jZiBVoqG01',
    name: 'Gib',
    program: 'Grant for the Web',
    year: '2026',
    startMonth: '2026-03',
    startLabel: 'March 2026',
    grantPeriodLabel: 'March 2026 – February 2027',
    country: 'India',
    leaders: ['Priya Raman'],
    tags: [],
    budget: 100000,
    budgetLabel: '100 000',
    reportUrls: [],
    searchText: '',
    ...overrides
  }
}

const sources = {
  grantees: [grantee()],
  granteeNames: new Map([['gib', 'Gib Labs']])
}

describe('getGrantReportRoutes', () => {
  it('returns no routes while the gate hides reports', () => {
    expect(getGrantReportRoutes([report()], true, sources)).toEqual([])
  })

  it('does not read the data while the gate hides reports', () => {
    expect(getGrantReportRoutes({}, true, sources)).toEqual([])
  })

  it('builds one route per report, with the page context', () => {
    const routes = getGrantReportRoutes([report()], false, sources)
    expect(routes).toEqual([
      {
        params: { slug: 'gib', report: '20260504-interim-1' },
        props: {
          report: report(),
          reportPath: 'grant/grantees/gib/reports/20260504-interim-1',
          granteeName: 'Gib Labs',
          grant: {
            budgetLabel: '100 000',
            program: 'Grant for the Web',
            grantPeriodLabel: 'March 2026 – February 2027',
            leaders: ['Priya Raman'],
            country: 'India'
          },
          grantReports: [
            {
              reportType: 'Interim Report',
              reportNumber: 1,
              reportPath: 'grant/grantees/gib/reports/20260504-interim-1',
              isCurrent: true
            }
          ]
        }
      }
    ])
  })

  it('has no grant facts for a grant the directory does not publish', () => {
    const routes = getGrantReportRoutes([report()], false, {
      ...sources,
      grantees: []
    })
    expect(routes).not.toBeInstanceOf(Error)
    expect((routes as { props: { grant: unknown } }[])[0]?.props.grant).toBe(
      null
    )
  })

  it('has no grantee name for a slug missing from the profiles', () => {
    const routes = getGrantReportRoutes([report()], false, {
      ...sources,
      granteeNames: new Map()
    })
    expect(
      (routes as { props: { granteeName: unknown } }[])[0]?.props.granteeName
    ).toBe(null)
  })

  it('fails when two reports would share a URL, naming both', () => {
    const result = getGrantReportRoutes(
      [report(), report({ id: 'recReport0000002' })],
      false,
      sources
    )
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain(
      'grant/grantees/gib/reports/20260504-interim-1 is used by recReport0000001, recReport0000002'
    )
  })

  it('returns the parse error for a bad file', () => {
    expect(getGrantReportRoutes({}, false, sources)).toBeInstanceOf(Error)
  })
})

describe('listGrantReports', () => {
  it('lists the reports of the same grant only, interim first, then by number', () => {
    const final1 = report({ id: 'rec3', reportType: 'Final Report' })
    const interim2 = report({ id: 'rec2', reportNumber: 2 })
    const other = report({
      id: 'rec4',
      grantId: OTHER_GRANT_ID,
      projectId: '20260505'
    })
    const current = report()
    const items = listGrantReports([final1, other, interim2, current], interim2)
    expect(
      items.map(({ reportType, reportNumber, isCurrent }) => [
        reportType,
        reportNumber,
        isCurrent
      ])
    ).toEqual([
      ['Interim Report', 1, false],
      ['Interim Report', 2, true],
      ['Final Report', 1, false]
    ])
  })

  it('lists the current report alone when the grant has one report', () => {
    expect(listGrantReports([report()], report())).toHaveLength(1)
  })
})

describe('readGranteeNames', () => {
  it('maps each slug to its grantee name', () => {
    const names = readGranteeNames([
      { slug: 'gib', name: 'Gib Labs', grantIds: [] }
    ])
    expect(names).toEqual(new Map([['gib', 'Gib Labs']]))
  })

  it('fails on a file that is not a list of grantees', () => {
    expect(readGranteeNames({})).toBeInstanceOf(Error)
    expect(readGranteeNames([{ slug: 'gib' }])).toBeInstanceOf(Error)
  })
})
