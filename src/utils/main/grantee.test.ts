import { describe, expect, it } from 'vitest'
import {
  formatBudgetAmount,
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
  'Project Links': 'https://community.interledger.org/example',
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
          'Project Links': 'javascript:alert(1)'
        }),
        record({
          'Project Name': 'Empty link',
          'Project Links': '   '
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.projectUrl).toBeNull()
    expect(result[1]?.projectUrl).toBeNull()
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
