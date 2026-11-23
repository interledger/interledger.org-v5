import { describe, expect, it } from 'vitest'
import {
  compareByStartMonth,
  formatBudgetAmount,
  formatGrantPeriod,
  formatStartMonth,
  normalizeCountry,
  parseGranteeRecords
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

describe('formatGrantPeriod', () => {
  it('formats the start and end month as a range', () => {
    expect(formatGrantPeriod('2026-03', '2027-02', 'en')).toBe(
      'March 2026 – February 2027'
    )
  })

  it('formats a grant that starts and ends in one month', () => {
    expect(formatGrantPeriod('2026-03', '2026-03', 'en')).toBe(
      'March 2026 – March 2026'
    )
  })

  it('localizes the month names', () => {
    expect(formatGrantPeriod('2026-03', '2027-02', 'es')).toBe(
      'Marzo de 2026 – febrero de 2027'
    )
  })

  it.each([
    ['no start', '', '2027-02'],
    ['no end', '2026-03', ''],
    ['a start that is not YYYY-MM', '2026', '2027-02'],
    ['an end month out of range', '2026-03', '2027-13'],
    ['an end before the start', '2026-03', '2025-12']
  ])('returns an empty string for %s', (_case, start, end) => {
    expect(formatGrantPeriod(start, end, 'en')).toBe('')
  })
})

describe('parseGranteeRecords', () => {
  it('reads the grant period from Start Month and End Date', () => {
    const result = parseGranteeRecords(
      [record({ ...sample.fields, 'End Date': '2025-08-31' })],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.grantPeriodLabel).toBe('September 2024 – August 2025')
  })

  it.each([
    ['missing', undefined],
    ['not a date', 'soon'],
    ['a month without a day', '2025-08']
  ])('has no grant period when End Date is %s', (_case, endDate) => {
    const fields =
      endDate === undefined
        ? sample.fields
        : { ...sample.fields, 'End Date': endDate }
    const result = parseGranteeRecords([record(fields)], 'en')
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.grantPeriodLabel).toBe('')
  })

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

  it('makes leaders and the description searchable', () => {
    const result = parseGranteeRecords([sample], 'en')
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.searchText).toContain('ada lovelace')
    expect(result[0]?.searchText).toContain('clearing house for open payments')
  })
})

describe('compareByStartMonth', () => {
  it('puts a missing start month last', () => {
    const items = [
      { name: 'Undated', startMonth: '' },
      { name: 'Dated', startMonth: '2021-01' }
    ]
    expect(items.sort(compareByStartMonth).map((item) => item.name)).toEqual([
      'Dated',
      'Undated'
    ])
  })
})

// Airtable omits empty cells and the sync writes only the columns visible in
// the view, so a record can arrive with only a name. Rendering relies on every
// GranteeProject field being an empty default.
describe('sparse grantee records', () => {
  const emptyDefaults = {
    program: '',
    year: '',
    startMonth: '',
    startLabel: '',
    country: '',
    tags: [],
    budget: null,
    budgetLabel: null,
    reportUrls: []
  }

  it('fills every missing field with an empty default', () => {
    const result = parseGranteeRecords(
      [record({ 'Project Name': 'Name Only' })],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]).toMatchObject({ name: 'Name Only', ...emptyDefaults })
  })

  it('treats wrong-typed values as missing instead of throwing', () => {
    const malformed = {
      id: 'rec1',
      createdTime: '2020-01-01T00:00:00.000Z',
      fields: {
        'Project Name': 'Odd Types',
        'Secondary Grant Program Name': { error: '#ERROR!' },
        Year: true,
        Country: { name: 'Kenya' },
        'Start Month': null,
        'Project Leader': [{ id: 'recAda' }],
        'Thematic Tag': [null, { name: 'Payments' }],
        'Project Description': ['not', 'a', 'string'],
        'Project Links': false,
        'Total budget approved': '750000'
      }
    }
    const result = parseGranteeRecords([malformed], 'en')
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]).toMatchObject({ name: 'Odd Types', ...emptyDefaults })
  })

  it('keeps web links from Project Links and drops text that is not a URL', () => {
    const result = parseGranteeRecords(
      [
        record({
          'Project Name': 'With links',
          'Project Links': [
            'See attached',
            'pending',
            'https://community.interledger.org/a/grant-report-1 ',
            'https://community.interledger.org/a/grant-report-1'
          ]
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.reportUrls).toEqual([
      'https://community.interledger.org/a/grant-report-1'
    ])
  })

  it('skips records without a fields object and keeps the rest', () => {
    const result = parseGranteeRecords(
      [{ id: 'recNoFields' }, { id: 'recNull', fields: null }, sample],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.map((g) => g.id)).toEqual(['rec1'])
  })
})

describe('searchText markdown handling', () => {
  it('strips markdown syntax from searchText so raw markers are not required to match', () => {
    const result = parseGranteeRecords(
      [
        record({
          'Project Name': 'Markdown Grantee',
          'Project Description':
            '# Builds **open** [payments](https://example.com) infra for `wallets`.'
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.searchText).toContain(
      'builds open payments infra for wallets'
    )
    expect(result[0]?.searchText).toContain('# builds')
  })

  it('keeps literal C# and A_B so those queries still match', () => {
    const result = parseGranteeRecords(
      [
        record({
          'Project Name': 'Literal Markers',
          'Project Description': 'Built in C# with an A_B fallback.'
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.searchText).toContain('c#')
    expect(result[0]?.searchText).toContain('a_b')
  })
})
