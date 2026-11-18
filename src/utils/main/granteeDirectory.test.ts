import type { PaginateFunction } from 'astro'
import { describe, expect, it, vi } from 'vitest'
import type { GrantReport } from '@/types/airtable'
import { ALL_GRANTEE_YEAR_SLUG, matchesGranteeFilters } from './granteeFilters'
import {
  buildGranteeDirectory,
  getGranteeListingData,
  getGranteeSearchIndex,
  paginateGranteesByTag,
  paginateGranteesByYearAndTag,
  uniqueFilterOptions,
  type GranteeDirectoryEntry,
  type GranteeDirectorySources
} from './granteeDirectory'

// `./routes` -> `./locales` reaches Astro's virtual modules for i18n config,
// mocked as in grantReports.test.ts.
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

function project(
  id: string,
  fields: Record<string, string | number | string[]>
) {
  return {
    id,
    createdTime: '2020-01-01T00:00:00.000Z',
    fields: { 'Project Name': `Project ${id}`, ...fields }
  }
}

function profile(
  id: string,
  grantIds: string[],
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    name: `Grantee ${id}`,
    slug: `grantee-${id.slice(-1).toLowerCase()}`,
    granteeType: 'Organisation',
    description: null,
    country: 'Germany',
    grantIds,
    ...overrides
  }
}

function report(
  grantId: string,
  overrides: Partial<GrantReport> = {}
): GrantReport {
  return {
    id: `rep-${grantId}-${overrides.reportType ?? 'Interim Report'}-${overrides.reportNumber ?? 1}`,
    grantId,
    projectId: '20260504',
    granteeSlug: 'grantee-a',
    projectName: 'Wallet pilot',
    reportType: 'Interim Report',
    reportNumber: 1,
    publishedDate: '2026-11-01',
    reportingPeriodStart: null,
    reportingPeriodEnd: null,
    summary: '',
    progressOnObjectives: '',
    whoBenefits: '',
    outputs: '',
    whatsNext: '',
    license: '',
    outputTypes: [],
    interledgerTechnologies: [],
    images: [],
    ...overrides
  }
}

const walletPilot = project('recProject0000001', {
  'Project Name': 'Local merchant wallet pilot',
  'Secondary Grant Program Name': 'Digital Financial Services',
  Year: '2026',
  'Start Month': '2026-10',
  Country: 'Germany',
  'Project Leader': ['Ada Lovelace'],
  'Thematic Tag': ['Financial Services', 'Payments'],
  'Project Description': 'Merchants accept **open** payments.',
  'Total budget approved': 65000
})

const workshops = project('recProject0000002', {
  'Project Name': 'Open payments workshops in Berlin',
  'Secondary Grant Program Name': 'Grant for the Web',
  Year: '2021',
  'Start Month': '2021-03',
  'Thematic Tag': ['Payments', 'Education'],
  'Total budget approved': 9000
})

function withForumReports<T extends { fields: Record<string, unknown> }>(
  entry: T
): T {
  return {
    ...entry,
    fields: {
      ...entry.fields,
      'Project Links': [
        'See attached',
        'https://community.interledger.org/x/wallet-grant-report-1-final-abc ',
        'https://community.interledger.org/x/wallet-grant-report-1-final-abc',
        'https://community.interledger.org/x/wallet-grant-report-2-def',
        'https://community.interledger.org/x/africa-final-report-379a'
      ]
    }
  }
}

const newsroom = project('recProject0000003', {
  'Project Name': 'Reader payments',
  Year: '2025',
  'Start Month': '2025-08',
  'Thematic Tag': ['Publishing']
})

function sources(
  overrides: Partial<GranteeDirectorySources> = {}
): GranteeDirectorySources {
  return {
    projects: [walletPilot, workshops, newsroom],
    profiles: [
      profile('recGrantee000000A', ['recProject0000001', 'recProject0000002'], {
        name: 'Common Ground'
      }),
      profile('recGrantee000000B', ['recProject0000003'], {
        name: 'Open Story Collective',
        country: 'CA'
      })
    ],
    reports: [],
    showReports: true,
    ...overrides
  }
}

function build(
  overrides: Partial<GranteeDirectorySources> = {},
  locale: 'en' | 'es' = 'en'
): GranteeDirectoryEntry[] {
  const result = buildGranteeDirectory(sources(overrides), locale)
  if (result instanceof Error) throw result
  return result
}

describe('buildGranteeDirectory', () => {
  it('groups projects under their grantee, newest project first', () => {
    const [commonGround] = build()
    expect(commonGround?.name).toBe('Common Ground')
    expect(commonGround?.slug).toBe('grantee-a')
    expect(commonGround?.projects.map((p) => p.name)).toEqual([
      'Local merchant wallet pilot',
      'Open payments workshops in Berlin'
    ])
  })

  it('sorts grantees by their newest project, then by name', () => {
    expect(build().map((grantee) => grantee.name)).toEqual([
      'Common Ground',
      'Open Story Collective'
    ])
  })

  it('takes the date from the newest project', () => {
    const [commonGround] = build()
    expect(commonGround?.startMonth).toBe('2026-10')
    expect(commonGround?.startLabel).toBe('October 2026')
  })

  it('collects every project tag once, in project order', () => {
    const [commonGround] = build()
    expect(commonGround?.tags).toEqual([
      'Financial Services',
      'Payments',
      'Education'
    ])
  })

  it('normalizes the profile country and falls back to the project one', () => {
    const [, storyCollective] = build()
    expect(storyCollective?.country).toBe('CA')

    const withoutCountry = build({
      profiles: [
        profile(
          'recGrantee000000A',
          ['recProject0000001', 'recProject0000002'],
          { country: null }
        ),
        profile('recGrantee000000B', ['recProject0000003'], { country: 'usa' })
      ]
    })
    expect(withoutCountry[0]?.country).toBe('Germany')
    expect(withoutCountry[1]?.country).toBe('United States')
  })

  it('leaves out a grantee with no published project', () => {
    const grantees = build({
      profiles: [
        profile('recGrantee000000A', [
          'recProject0000001',
          'recProject0000002',
          'recProject0000003'
        ]),
        profile('recGrantee000000C', ['recUnpublished000'])
      ]
    })
    expect(grantees.map((grantee) => grantee.id)).toEqual(['recGrantee000000A'])
  })

  it('lists a joint project under both grantees', () => {
    const grantees = build({
      profiles: [
        profile('recGrantee000000A', [
          'recProject0000001',
          'recProject0000002'
        ]),
        profile('recGrantee000000B', ['recProject0000003', 'recProject0000001'])
      ]
    })
    expect(grantees.map((grantee) => grantee.projects.length)).toEqual([2, 2])
  })

  it('returns an Error naming a published project with no grantee', () => {
    const result = buildGranteeDirectory(
      sources({
        profiles: [
          profile('recGrantee000000A', [
            'recProject0000001',
            'recProject0000002'
          ])
        ]
      }),
      'en'
    )
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain(
      'Reader payments (recProject0000003)'
    )
  })

  it('returns an Error when the profiles file has the wrong shape', () => {
    const result = buildGranteeDirectory(
      sources({
        profiles: [{ id: 'recGrantee000000A', name: 'No slug', grantIds: [] }]
      }),
      'en'
    )
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('grantee-profiles.json')
  })

  it('returns an Error when the projects file is not an array', () => {
    expect(
      buildGranteeDirectory(sources({ projects: { records: [] } }), 'en')
    ).toBeInstanceOf(Error)
  })

  it('makes the grantee findable by its name and its projects', () => {
    const [commonGround] = build()
    const search = (q: string) =>
      matchesGranteeFilters(commonGround!, { q, year: '', tag: '' })
    expect(search('common ground')).toBe(true)
    expect(search('workshops in berlin')).toBe(true)
    expect(search('ada lovelace')).toBe(true)
    expect(search('reader payments')).toBe(false)
  })
})

describe('buildGranteeDirectory report links', () => {
  it('is null on every project while the report pages are hidden', () => {
    const grantees = build({
      reports: [report('recProject0000001')],
      showReports: false
    })
    const projects = grantees.flatMap((grantee) => grantee.projects)
    expect(projects.every((p) => p.reports === null)).toBe(true)
  })

  it('does not read the reports file while the pages are hidden', () => {
    const result = buildGranteeDirectory(
      sources({ reports: 'not reports', showReports: false }),
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
  })

  it('is empty for a project with no published report and no forum link', () => {
    const [commonGround] = build({ reports: [report('recProject0000001')] })
    expect(commonGround?.projects[1]?.reports).toEqual([])
  })

  it('links the forum reports when the project has no report page', () => {
    const [commonGround] = build({
      projects: [withForumReports(walletPilot), workshops, newsroom]
    })
    expect(commonGround?.projects[0]?.reports).toEqual([
      {
        id: 'https://community.interledger.org/x/wallet-grant-report-1-final-abc',
        label: 'Final report 1',
        href: 'https://community.interledger.org/x/wallet-grant-report-1-final-abc',
        external: true
      },
      {
        id: 'https://community.interledger.org/x/wallet-grant-report-2-def',
        label: 'Report 2',
        href: 'https://community.interledger.org/x/wallet-grant-report-2-def',
        external: true
      },
      {
        id: 'https://community.interledger.org/x/africa-final-report-379a',
        label: 'Final report',
        href: 'https://community.interledger.org/x/africa-final-report-379a',
        external: true
      }
    ])
    expect(commonGround?.projects[1]?.reports).toEqual([])
  })

  it('keeps the report page when the project also has a forum link', () => {
    const [commonGround] = build({
      projects: [withForumReports(walletPilot), workshops, newsroom],
      reports: [report('recProject0000001')]
    })
    expect(commonGround?.projects[0]?.reports).toEqual([
      {
        id: 'rep-recProject0000001-Interim Report-1',
        label: 'Interim report 1',
        href: '/grant/grantees/grantee-a/reports/20260504-interim-1/'
      }
    ])
  })

  it('shows forum reports while the report pages are hidden', () => {
    const grantees = build({
      showReports: false,
      reports: 'not reports',
      projects: [withForumReports(walletPilot), workshops, newsroom]
    })
    expect(grantees[0]?.projects[0]?.reports?.[0]?.href).toBe(
      'https://community.interledger.org/x/wallet-grant-report-1-final-abc'
    )
    expect(grantees[0]?.projects[1]?.reports).toBeNull()
  })

  it('links each report, interim ones first, then by number', () => {
    const [commonGround] = build({
      reports: [
        report('recProject0000001', { reportType: 'Final Report' }),
        report('recProject0000001', { reportNumber: 2 }),
        report('recProject0000001')
      ]
    })
    expect(commonGround?.projects[0]?.reports).toEqual([
      {
        id: 'rep-recProject0000001-Interim Report-1',
        label: 'Interim report 1',
        href: '/grant/grantees/grantee-a/reports/20260504-interim-1/'
      },
      {
        id: 'rep-recProject0000001-Interim Report-2',
        label: 'Interim report 2',
        href: '/grant/grantees/grantee-a/reports/20260504-interim-2/'
      },
      {
        id: 'rep-recProject0000001-Final Report-1',
        label: 'Final report 1',
        href: '/grant/grantees/grantee-a/reports/20260504-final-1/'
      }
    ])
  })

  it('translates the label and localizes the link', () => {
    const [commonGround] = build(
      { reports: [report('recProject0000001')] },
      'es'
    )
    const [link] = commonGround?.projects[0]?.reports ?? []
    expect(link?.href).toBe(
      '/es/grant/grantees/grantee-a/reports/20260504-interim-1/'
    )
    expect(link?.label).toBe('Informe intermedio 1')
  })

  it('ignores a report whose project is not in the directory', () => {
    const grantees = build({ reports: [report('recUnpublished000')] })
    const projects = grantees.flatMap((grantee) => grantee.projects)
    expect(projects.every((p) => p.reports?.length === 0)).toBe(true)
  })

  it('returns an Error when the reports file has the wrong shape', () => {
    expect(
      buildGranteeDirectory(sources({ reports: [{ id: 'x' }] }), 'en')
    ).toBeInstanceOf(Error)
  })
})

describe('uniqueFilterOptions', () => {
  it('collects every project tag once, sorted by label', () => {
    expect(uniqueFilterOptions(build(), 'tag')).toEqual([
      { value: 'education', label: 'Education' },
      { value: 'financial-services', label: 'Financial Services' },
      { value: 'payments', label: 'Payments' },
      { value: 'publishing', label: 'Publishing' }
    ])
  })

  it('collects every project year, newest first', () => {
    expect(uniqueFilterOptions(build(), 'year').map((o) => o.value)).toEqual([
      '2026',
      '2025',
      '2021'
    ])
  })
})

describe('getGranteeListingData', () => {
  it('returns an Error instead of throwing when a file is malformed', () => {
    expect(
      getGranteeListingData(sources({ projects: { records: [] } }), 'en')
    ).toBeInstanceOf(Error)
  })

  it('returns the grantees with their year and tag filter options', () => {
    const listing = getGranteeListingData(sources(), 'en')
    if (listing instanceof Error) throw listing
    expect(listing.grantees).toHaveLength(2)
    expect(listing.years).toHaveLength(3)
    expect(listing.tags).toHaveLength(4)
  })
})

type PaginateCall = {
  entries: GranteeDirectoryEntry[]
  params: Record<string, string>
  props: { selectedYear?: string; selectedTag?: string }
}

function recordingPaginate(calls: PaginateCall[]): PaginateFunction {
  return ((entries: GranteeDirectoryEntry[], options: PaginateCall) => {
    calls.push({ entries, params: options.params, props: options.props })
    return []
  }) as unknown as PaginateFunction
}

function listing(overrides: Partial<GranteeDirectorySources> = {}) {
  const result = getGranteeListingData(sources(overrides), 'en')
  if (result instanceof Error) throw result
  return result
}

describe('paginateGranteesByTag', () => {
  it('emits every tag under params.tag, including reserved slugs', () => {
    const calls: PaginateCall[] = []
    paginateGranteesByTag({
      paginate: recordingPaginate(calls),
      ...listing({
        projects: [
          walletPilot,
          workshops,
          project('recProject0000003', { 'Thematic Tag': ['All', '2024'] })
        ]
      })
    })
    const tags = calls.map((call) => call.params.tag)
    expect(tags).toContain('all')
    expect(tags).toContain('2024')
    expect(tags).toContain('financial-services')
  })

  it('lists a grantee under every tag of any of its projects', () => {
    const calls: PaginateCall[] = []
    paginateGranteesByTag({ paginate: recordingPaginate(calls), ...listing() })
    const education = calls.find((call) => call.params.tag === 'education')
    expect(education?.entries.map((grantee) => grantee.name)).toEqual([
      'Common Ground'
    ])
  })
})

describe('paginateGranteesByYearAndTag', () => {
  it('needs one project with both the year and the tag', () => {
    const calls: PaginateCall[] = []
    paginateGranteesByYearAndTag({
      paginate: recordingPaginate(calls),
      ...listing()
    })
    const entriesFor = (year: string, tag: string) =>
      calls.find((call) => call.params.year === year && call.params.tag === tag)
        ?.entries
    // Common Ground's 2026 project has no Education tag; its 2021 one does.
    expect(entriesFor('2026', 'education')).toEqual([])
    expect(entriesFor('2021', 'education')).toHaveLength(1)
  })

  it('does not emit /all/<tag> pages — those redirect to the tag-only route', () => {
    const calls: PaginateCall[] = []
    paginateGranteesByYearAndTag({
      paginate: recordingPaginate(calls),
      ...listing()
    })
    expect(
      calls.some((call) => call.params.year === ALL_GRANTEE_YEAR_SLUG)
    ).toBe(false)
    expect(
      calls.find(
        (call) => call.params.year === '2026' && call.params.tag === 'payments'
      )?.props
    ).toMatchObject({ selectedYear: '2026', selectedTag: 'payments' })
  })
})

describe('getGranteeSearchIndex', () => {
  function index(
    overrides: Partial<GranteeDirectorySources> = {},
    locale: 'en' | 'es' = 'en'
  ) {
    const result = getGranteeSearchIndex(sources(overrides), locale)
    if (result instanceof Error) throw result
    return result
  }

  it('returns an Error when a file is malformed, matching the listing', () => {
    expect(
      getGranteeSearchIndex(sources({ projects: {} }), 'en')
    ).toBeInstanceOf(Error)
  })

  it('ships each grantee with its projects and report links', () => {
    const [commonGround] = index({ reports: [report('recProject0000001')] })
    expect(commonGround).toMatchObject({
      id: 'recGrantee000000A',
      name: 'Common Ground',
      country: 'Germany',
      startMonth: '2026-10',
      startLabel: 'October 2026',
      tags: ['Financial Services', 'Payments', 'Education']
    })
    expect(commonGround?.projects[0]).toEqual({
      id: 'recProject0000001',
      name: 'Local merchant wallet pilot',
      program: 'Digital Financial Services',
      year: '2026',
      tags: ['Financial Services', 'Payments'],
      budgetLabel: '65 000',
      reports: [
        {
          id: 'rep-recProject0000001-Interim Report-1',
          label: 'Interim report 1',
          href: '/grant/grantees/grantee-a/reports/20260504-interim-1/'
        }
      ]
    })
  })

  it('produces entries matchesGranteeFilters can filter directly', () => {
    const [commonGround] = index()
    expect(
      matchesGranteeFilters(commonGround!, {
        q: 'merchant',
        year: '2026',
        tag: 'payments'
      })
    ).toBe(true)
    expect(
      matchesGranteeFilters(commonGround!, {
        q: 'nonexistent',
        year: '',
        tag: ''
      })
    ).toBe(false)
  })
})
