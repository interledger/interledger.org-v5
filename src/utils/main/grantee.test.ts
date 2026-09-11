import { describe, expect, it } from 'vitest'
import { ALL_GRANTEE_YEAR_SLUG, matchesGranteeFilters } from './granteeFilters'
import {
  formatBudgetAmount,
  formatStartMonth,
  getGranteeListingData,
  getGranteeSearchIndex,
  normalizeCountry,
  paginateGranteesByTag,
  paginateGranteesByYearAndTag,
  parseGranteeRecords,
  uniqueFilterOptions
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
        }),
        record({
          'Project Name': 'Note instead of a link',
          'Project Links': ['See attached grant report']
        }),
        record({
          'Project Name': 'Placeholder TBD',
          'Project Links': ['TBD']
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.projectUrls).toEqual([])
    expect(result[1]?.projectUrls).toEqual([])
    expect(result[2]?.projectUrls).toEqual([])
    expect(result[3]?.projectUrls).toEqual([])
  })

  it('keeps a valid link alongside a non-URL note in the same field', () => {
    const result = parseGranteeRecords(
      [
        record({
          'Project Name': 'Note plus a real link',
          'Project Links': [
            'See below',
            'https://community.interledger.org/elenimaltas_176/soul-in-the-horn-final-report-3j3c'
          ]
        })
      ],
      'en'
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result[0]?.projectUrls).toEqual([
      'https://community.interledger.org/elenimaltas_176/soul-in-the-horn-final-report-3j3c'
    ])
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

describe('paginateGranteesByTag', () => {
  it('emits every tag under params.tag, including reserved slugs', () => {
    const colliding = record(
      {
        ...sample.fields,
        'Project Name': 'All-tag project',
        'Thematic Tag': ['All', '2024']
      },
      'rec-collide'
    )
    const listing = getGranteeListingData([sample, colliding], 'en')
    expect(listing).not.toBeInstanceOf(Error)
    if (listing instanceof Error) return

    const params: string[] = []
    const paginate = ((
      _entries: Grantee[],
      options: { params: { tag: string } }
    ) => {
      params.push(options.params.tag)
      return []
    }) as PaginateFunction

    paginateGranteesByTag({ paginate, ...listing })

    expect(params).toContain('all')
    expect(params).toContain('2024')
    expect(params).toContain('financial-services')
  })
})

describe('paginateGranteesByYearAndTag', () => {
  it('emits every tag under the year, including reserved slugs', () => {
    const colliding = record(
      {
        ...sample.fields,
        'Thematic Tag': ['All', '2', 'Financial Services']
      },
      'rec-collide-year'
    )
    const listing = getGranteeListingData([colliding], 'en')
    expect(listing).not.toBeInstanceOf(Error)
    if (listing instanceof Error) return

    const tags: string[] = []
    const paginate = ((
      _entries: Grantee[],
      options: { params: { year: string; tag: string } }
    ) => {
      tags.push(options.params.tag)
      return []
    }) as PaginateFunction

    paginateGranteesByYearAndTag({ paginate, ...listing })

    expect(tags).toContain('financial-services')
    expect(tags).toContain('all')
    expect(tags).toContain('2')
  })

  it('does not emit /all/<tag> pages — those redirect to the tag-only route', () => {
    const listing = getGranteeListingData([sample], 'en')
    expect(listing).not.toBeInstanceOf(Error)
    if (listing instanceof Error) return

    const calls: Array<{
      year: string
      tag: string
      selectedYear: string | undefined
      selectedTag: string | undefined
    }> = []
    const paginate = ((
      _entries: Grantee[],
      options: {
        params: { year: string; tag: string }
        props: { selectedYear?: string; selectedTag?: string }
      }
    ) => {
      calls.push({
        year: options.params.year,
        tag: options.params.tag,
        selectedYear: options.props.selectedYear,
        selectedTag: options.props.selectedTag
      })
      return []
    }) as PaginateFunction

    paginateGranteesByYearAndTag({ paginate, ...listing })

    expect(calls.some((call) => call.year === ALL_GRANTEE_YEAR_SLUG)).toBe(
      false
    )
    expect(calls).toContainEqual({
      year: '2024',
      tag: 'financial-services',
      selectedYear: '2024',
      selectedTag: 'financial-services'
    })
  })
})

describe('getGranteeSearchIndex', () => {
  it('returns an Error when the dump is not an array, matching getGranteeListingData', () => {
    expect(getGranteeSearchIndex({ records: [] }, 'en')).toBeInstanceOf(Error)
  })

  it('maps grantees to slim, searchable entries', () => {
    const index = getGranteeSearchIndex([sample], 'en')
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    expect(index).toHaveLength(1)
    expect(index[0]).toMatchObject({
      id: 'rec1',
      name: 'People’s Clearing House',
      program: 'Digital Financial Services',
      year: '2024',
      country: 'United States',
      startMonth: '2024-09',
      startLabel: 'September 2024',
      tags: ['Financial Services', 'OpenSource'],
      projectUrl: 'https://community.interledger.org/example',
      budgetLabel: '750 000'
    })
    expect(index[0]?.searchText).toContain('clearing house')
  })

  it('strips markdown from snippets without dropping literal C# or A_B', () => {
    const index = getGranteeSearchIndex(
      [
        record({
          'Project Name': 'Snippet Markers',
          'Project Description':
            'A **C#** and A_B toolkit. [docs](https://example.com)'
        })
      ],
      'en'
    )
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    expect(index[0]?.descriptionSnippet).toBe('A C# and A_B toolkit. docs')
  })

  it('truncates a long description into a plain-text snippet', () => {
    const longDescription = 'Building open payments infrastructure. '.repeat(10)
    const index = getGranteeSearchIndex(
      [
        record({
          'Project Name': 'Long Description Grantee',
          'Project Description': longDescription
        })
      ],
      'en'
    )
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    expect(index[0]?.descriptionSnippet).not.toBeNull()
    expect(index[0]?.descriptionSnippet?.length).toBeLessThanOrEqual(160)
    expect(index[0]?.descriptionSnippet?.length).toBeLessThan(
      longDescription.length
    )
    expect(index[0]?.descriptionSnippet?.endsWith('…')).toBe(true)
  })

  it('is null for grantees with no description', () => {
    const index = getGranteeSearchIndex(
      [record({ 'Project Name': 'No Description' })],
      'en'
    )
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    expect(index[0]?.descriptionSnippet).toBeNull()
  })

  it('keeps ATX hashes searchable in precomputed searchText', () => {
    const index = getGranteeSearchIndex(
      [
        record({
          'Project Name': 'Heading Grantee',
          'Project Description': '# Open payments'
        })
      ],
      'en'
    )
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    expect(
      matchesGranteeFilters(index[0]!, { q: '# open', year: '', tag: '' })
    ).toBe(true)
  })

  it('builds snippets from stored descriptionPlain, not a second markdown pass', () => {
    const data = [
      record({
        'Project Name': 'Heading Grantee',
        'Project Description': '# Open payments infrastructure.'
      })
    ]
    const grantees = parseGranteeRecords(data, 'en')
    expect(grantees).not.toBeInstanceOf(Error)
    if (grantees instanceof Error) return

    const index = getGranteeSearchIndex(data, 'en')
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return

    expect(index[0]?.descriptionSnippet).toBe(grantees[0]!.descriptionPlain)
    expect(index[0]?.searchText).toContain('# open payments')
  })

  it('keeps setext underlines and blockquote markers searchable', () => {
    const index = getGranteeSearchIndex(
      [
        record({
          'Project Name': 'Block Markers',
          'Project Description':
            'Open payments\n=============\n\n> wallets first'
        })
      ],
      'en'
    )
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    const grantee = index[0]!
    expect(
      matchesGranteeFilters(grantee, { q: '===', year: '', tag: '' })
    ).toBe(true)
    expect(
      matchesGranteeFilters(grantee, { q: '> wallets', year: '', tag: '' })
    ).toBe(true)
    expect(grantee.descriptionSnippet).not.toMatch(/===|>/)
  })

  it('shows heading and quote prose in the snippet without markdown markers', () => {
    const index = getGranteeSearchIndex(
      [
        record({
          'Project Name': 'Display Snippet',
          'Project Description': '# Open payments\n\n> wallets first'
        })
      ],
      'en'
    )
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    expect(index[0]?.descriptionSnippet).toBe('Open payments wallets first')
    expect(
      matchesGranteeFilters(index[0]!, { q: '# open', year: '', tag: '' })
    ).toBe(true)
  })

  it('produces entries matchesGranteeFilters can filter directly', () => {
    const index = getGranteeSearchIndex([sample], 'en')
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    expect(
      matchesGranteeFilters(index[0]!, { q: 'clearing', year: '', tag: '' })
    ).toBe(true)
    expect(
      matchesGranteeFilters(index[0]!, { q: 'nonexistent', year: '', tag: '' })
    ).toBe(false)
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
    expect(
      matchesGranteeFilters(result[0]!, {
        q: 'builds open payments',
        year: '',
        tag: ''
      })
    ).toBe(true)
    expect(
      matchesGranteeFilters(result[0]!, { q: '# builds', year: '', tag: '' })
    ).toBe(true)
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
    const grantee = result[0]!
    expect(grantee.searchText).toContain('c#')
    expect(grantee.searchText).toContain('a_b')
    expect(matchesGranteeFilters(grantee, { q: 'c#', year: '', tag: '' })).toBe(
      true
    )
    expect(
      matchesGranteeFilters(grantee, { q: 'a_b', year: '', tag: '' })
    ).toBe(true)
  })

  it('keeps setext underlines and blockquote markers searchable', () => {
    const index = getGranteeSearchIndex(
      [
        record({
          'Project Name': 'Block Markers',
          'Project Description':
            'Open payments\n=============\n\n> wallets first'
        })
      ],
      'en'
    )
    expect(index).not.toBeInstanceOf(Error)
    if (index instanceof Error) return
    const grantee = index[0]!
    expect(
      matchesGranteeFilters(grantee, { q: '===', year: '', tag: '' })
    ).toBe(true)
    expect(
      matchesGranteeFilters(grantee, { q: '> wallets', year: '', tag: '' })
    ).toBe(true)
  })
})
