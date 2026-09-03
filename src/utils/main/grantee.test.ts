import { describe, expect, it } from 'vitest'
import {
  filterGrantees,
  formatBudgetAmount,
  formatStartMonth,
  getGranteeFilterUrl,
  getGranteeListingData,
  matchesGranteeFilters,
  normalizeCountry,
  parseGranteeRecords,
  uniqueFilterOptions,
  type Grantee
} from './grantee'

function record(
  fields: Record<string, string | number | string[]>,
  id = 'rec1'
) {
  return { id, createdTime: '2020-01-01T00:00:00.000Z', fields }
}

const sample = record({
  'Project Name': 'People’s Clearing House',
  'Secondary Grant Program Name': 'Digital Financial Services',
  Year: '2024',
  'Start Month': '2024-09',
  Country: 'US',
  'Project Leader': ['Ada Lovelace'],
  'Thematic Tag': ['Financial Services', 'OpenSource'],
  'Project Description': 'Building a clearing house for open payments.',
  'Project Links': ['https://community.interledger.org/example'],
  'Total budget approved': 750000
})

describe('normalizeCountry', () => {
  it('maps common US aliases to United States', () => {
    expect(normalizeCountry('US')).toBe('United States')
    expect(normalizeCountry('USA')).toBe('United States')
    expect(normalizeCountry('United States')).toBe('United States')
  })

  it('maps UK and NL aliases', () => {
    expect(normalizeCountry('UK')).toBe('United Kingdom')
    expect(normalizeCountry('NL')).toBe('Netherlands')
    expect(normalizeCountry('The Netherlands')).toBe('Netherlands')
  })

  it('trims stray whitespace without inventing a name', () => {
    expect(normalizeCountry('Jamaica ')).toBe('Jamaica')
  })

  it('leaves multi-country strings alone', () => {
    expect(normalizeCountry('Nigeria, Canada, US')).toBe('Nigeria, Canada, US')
  })
})

describe('formatBudgetAmount', () => {
  it('uses spaces as thousands separators to match the directory mock', () => {
    expect(formatBudgetAmount(750000)).toBe('750 000')
    expect(formatBudgetAmount(1200000)).toBe('1 200 000')
  })

  it('keeps cents when the dump has a fractional amount', () => {
    expect(formatBudgetAmount(93818.42)).toBe('93 818.42')
  })
})

describe('formatStartMonth', () => {
  it('formats YYYY-MM as a long month and year', () => {
    expect(formatStartMonth('2024-09', 'en')).toBe('September 2024')
  })

  it('returns the raw value when the month is not YYYY-MM', () => {
    expect(formatStartMonth('2024', 'en')).toBe('2024')
  })
})

describe('parseGranteeRecords', () => {
  it('returns an Error when the dump is not an array', () => {
    const result = parseGranteeRecords({ records: [] }, 'en')
    expect(result).toBeInstanceOf(Error)
  })

  it('skips records with no project name', () => {
    const result = parseGranteeRecords(
      [record({ Country: 'Canada' }), sample],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('People’s Clearing House')
  })

  it('trims program names and normalizes country for filters', () => {
    const result = parseGranteeRecords(
      [
        record({
          'Project Name': 'Web Monetization Kit',
          'Secondary Grant Program Name': 'Grant for the Web ',
          Country: 'USA',
          Year: '2020',
          'Start Month': '2020-09'
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.program).toBe('Grant for the Web')
    expect(result[0]?.country).toBe('United States')
    expect(result[0]?.programKey).toBe('grant-web')
  })

  it('drops unsafe or empty project links', () => {
    const result = parseGranteeRecords(
      [
        record({
          'Project Name': 'No link',
          'Project Links': ['javascript:alert(1)']
        }),
        record({
          'Project Name': 'Empty link',
          'Project Links': ['   ']
        }),
        record({
          'Project Name': 'No links at all',
          'Project Links': []
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.projectUrls).toEqual([])
    expect(result[1]?.projectUrls).toEqual([])
    expect(result[2]?.projectUrls).toEqual([])
  })

  it('sorts newest start month first, then by name', () => {
    const result = parseGranteeRecords(
      [
        record(
          {
            'Project Name': 'Beta',
            'Start Month': '2024-01'
          },
          'rec-b'
        ),
        record(
          {
            'Project Name': 'Alpha',
            'Start Month': '2024-01'
          },
          'rec-a'
        ),
        record(
          {
            'Project Name': 'Newer',
            'Start Month': '2025-03'
          },
          'rec-c'
        )
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.map((g) => g.name)).toEqual(['Newer', 'Alpha', 'Beta'])
  })
})

describe('uniqueFilterOptions', () => {
  it('dedupes thematic tags and sorts labels', () => {
    const parsed = parseGranteeRecords(
      [
        record(
          {
            'Project Name': 'A',
            'Thematic Tag': ['Financial Services', 'Education']
          },
          'a'
        ),
        record(
          {
            'Project Name': 'B',
            'Thematic Tag': ['Financial Services']
          },
          'b'
        ),
        record(
          {
            'Project Name': 'C',
            'Thematic Tag': ['Privacy']
          },
          'c'
        )
      ],
      'en'
    )
    expect(parsed).not.toBeInstanceOf(Error)
    if (parsed instanceof Error) return
    expect(uniqueFilterOptions(parsed, 'tag')).toEqual([
      { value: 'education', label: 'Education' },
      { value: 'financial-services', label: 'Financial Services' },
      { value: 'privacy', label: 'Privacy' }
    ])
  })

  it('sorts years newest first', () => {
    const parsed = parseGranteeRecords(
      [
        record({ 'Project Name': 'A', Year: '2020' }, 'a'),
        record({ 'Project Name': 'B', Year: '2025' }, 'b')
      ],
      'en'
    )
    expect(parsed).not.toBeInstanceOf(Error)
    if (parsed instanceof Error) return
    expect(uniqueFilterOptions(parsed, 'year').map((o) => o.value)).toEqual([
      '2025',
      '2020'
    ])
  })
})

describe('matchesGranteeFilters', () => {
  const grantee: Grantee = {
    id: 'rec1',
    name: 'People’s Clearing House',
    program: 'Digital Financial Services',
    programKey: 'digital-financial-services',
    year: '2024',
    startMonth: '2024-09',
    startLabel: 'September 2024',
    country: 'Germany',
    countryKey: 'germany',
    leaders: ['Ada Lovelace'],
    tags: ['Privacy'],
    description: 'Open payments clearing house',
    projectUrls: ['https://community.interledger.org/example'],
    budget: 750000,
    budgetLabel: '750 000',
    searchText:
      'people’s clearing house digital financial services 2024 germany ada lovelace privacy open payments clearing house'
  }

  it('matches when no filters are set', () => {
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '',
        tag: ''
      })
    ).toBe(true)
  })

  it('filters by year and thematic tag', () => {
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '2024',
        tag: 'privacy'
      })
    ).toBe(true)
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '2020',
        tag: ''
      })
    ).toBe(false)
    expect(
      matchesGranteeFilters(grantee, {
        q: '',
        year: '',
        tag: 'education'
      })
    ).toBe(false)
  })
})

describe('filterGrantees', () => {
  it('returns only matching records', () => {
    const parsed = parseGranteeRecords(
      [
        sample,
        record(
          {
            'Project Name': 'Campus Lab',
            'Secondary Grant Program Name': 'NextGen Higher Education',
            Year: '2025',
            Country: 'Kenya'
          },
          'rec2'
        )
      ],
      'en'
    )
    expect(parsed).not.toBeInstanceOf(Error)
    if (parsed instanceof Error) return
    const filtered = filterGrantees(parsed, {
      q: '',
      year: '2025',
      tag: ''
    })
    expect(filtered.map((g) => g.name)).toEqual(['Campus Lab'])
  })
})

describe('getGranteeFilterUrl', () => {
  const directory = '/grant/grantee-directory'

  it('returns the directory path when nothing is selected', () => {
    expect(getGranteeFilterUrl(directory)).toBe(directory)
  })

  it('appends the year value', () => {
    expect(getGranteeFilterUrl(directory, '2024')).toBe(
      '/grant/grantee-directory/2024'
    )
  })

  it('uses all/<tag> when only a tag is selected', () => {
    expect(getGranteeFilterUrl(directory, undefined, 'privacy')).toBe(
      '/grant/grantee-directory/all/privacy'
    )
  })

  it('combines year and tag values', () => {
    expect(getGranteeFilterUrl(directory, '2024', 'privacy')).toBe(
      '/grant/grantee-directory/2024/privacy'
    )
  })
})

describe('getGranteeListingData', () => {
  it('returns an Error instead of throwing when the dump is malformed', () => {
    const result = getGranteeListingData({ records: [] }, 'en')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns grantees plus derived year/tag filter options', () => {
    const result = getGranteeListingData([sample], 'en')
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.grantees).toHaveLength(1)
    expect(result.years).toEqual([{ value: '2024', label: '2024' }])
    expect(result.tags.map((t) => t.value)).toEqual([
      'financial-services',
      'opensource'
    ])
  })
})
