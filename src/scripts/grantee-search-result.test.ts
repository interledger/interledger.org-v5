import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GranteeSearchEntry } from '@/utils/main/grantee'
import {
  hrefFromOriginal,
  hrefWithPreservedSearch,
  searchResultRowModel,
  type SearchResultContext
} from './grantee-search-result'

const PAGE_ORIGIN = 'https://interledger.org'

const SEARCH_RESULT_TEMPLATE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../components/grant/GranteeSearchResultTemplate.astro'
)

/** Slots `createSearchResultRow` requires via `requireElement`. */
const REQUIRED_ROW_ATTRS = [
  'data-grantee-search-name',
  'data-grantee-search-program',
  'data-grantee-search-budget-wrap',
  'data-grantee-search-budget-amount',
  'data-grantee-search-tags-wrap',
  'data-grantee-search-meta-wrap',
  'data-grantee-search-country-wrap',
  'data-grantee-search-country',
  'data-grantee-search-date-wrap',
  'data-grantee-search-date-text',
  'data-grantee-search-date',
  'data-grantee-search-description-panel',
  'data-grantee-search-leaders-wrap',
  'data-grantee-search-leaders',
  'data-grantee-search-snippet',
  'data-grantee-search-details-wrap',
  'data-grantee-search-details-link'
] as const

function sampleSearchEntry(
  overrides: Partial<GranteeSearchEntry> = {}
): GranteeSearchEntry {
  return {
    id: 'rec1',
    name: 'Test',
    program: '',
    year: '2024',
    country: '',
    startMonth: '',
    startLabel: '',
    leaders: [],
    tags: [],
    descriptionSnippet: null,
    projectUrl: null,
    budgetLabel: null,
    searchText: 'test',
    ...overrides
  }
}

function sampleContext(
  overrides: Partial<SearchResultContext> = {}
): SearchResultContext {
  return {
    directoryPath: '/grant/grantee-directory',
    selectedYear: '2024',
    searchQuery: 'wallet',
    pathname: '/grant/grantee-directory',
    lang: 'en',
    viewDetailsLabel: 'View details',
    ...overrides
  }
}

function rowModel(
  entry: GranteeSearchEntry,
  context: SearchResultContext = sampleContext()
) {
  return searchResultRowModel(entry, context, PAGE_ORIGIN)
}

describe('hrefWithPreservedSearch', () => {
  it('returns the href unchanged when the query is empty', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/privacy',
        '',
        PAGE_ORIGIN
      )
    ).toBe('/grant/grantee-directory/privacy')
  })

  it('appends ?q= to a same-origin directory href', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/2024/education',
        'open payments',
        PAGE_ORIGIN
      )
    ).toBe('/grant/grantee-directory/2024/education?q=open+payments')
  })

  it('leaves an external href unchanged', () => {
    const href = 'https://community.interledger.org/some-report'
    expect(hrefWithPreservedSearch(href, 'education', PAGE_ORIGIN)).toBe(href)
  })

  it('preserves a hash on a same-origin href', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/privacy#list',
        'education',
        PAGE_ORIGIN
      )
    ).toBe('/grant/grantee-directory/privacy?q=education#list')
  })

  it('keeps an existing q when the query is empty', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/2024?q=education',
        '',
        PAGE_ORIGIN
      )
    ).toBe('/grant/grantee-directory/2024?q=education')
  })
})

describe('hrefFromOriginal', () => {
  const original = '/grant/grantee-directory/2024'

  it('appends q from the original href, then restores it when the query is cleared', () => {
    expect(hrefFromOriginal(original, 'education', PAGE_ORIGIN)).toBe(
      '/grant/grantee-directory/2024?q=education'
    )
    expect(hrefFromOriginal(original, '', PAGE_ORIGIN)).toBe(original)
    expect(hrefFromOriginal(original, '   ', PAGE_ORIGIN)).toBe(original)
  })

  it('replaces a previous query instead of stacking on a mutated href', () => {
    expect(hrefFromOriginal(original, 'open payments', PAGE_ORIGIN)).toBe(
      '/grant/grantee-directory/2024?q=open+payments'
    )
  })
})

describe('GranteeSearchResultTemplate', () => {
  it('keeps every populate-script slot in GranteeSearchResultTemplate', () => {
    const source = readFileSync(SEARCH_RESULT_TEMPLATE_PATH, 'utf8')
    expect(source).toContain('id="grantee-search-result-template"')
    expect(source).toContain('data-grantee-search-tag-template')
    for (const attr of REQUIRED_ROW_ATTRS) {
      expect(source, attr).toContain(attr)
    }
  })
})

describe('searchResultRowModel', () => {
  it('fills a populated entry and shows every optional section', () => {
    const model = rowModel(
      sampleSearchEntry({
        name: 'Clearing House',
        program: 'Financial Inclusion',
        country: 'Kenya',
        startMonth: '2024-03',
        startLabel: 'March 2024',
        leaders: ['Ada Lovelace', 'Grace Hopper'],
        tags: ['Open Payments', 'Education'],
        descriptionSnippet: 'A clearing network for community wallets.',
        projectUrl: 'https://community.interledger.org/some-report',
        budgetLabel: '50,000'
      })
    )

    expect(model.name).toBe('Clearing House')
    expect(model.program).toBe('Financial Inclusion')
    expect(model.budgetLabel).toBe('50,000')
    expect(model.country).toBe('Kenya')
    expect(model.startLabel).toBe('March 2024')
    expect(model.startMonth).toBe('2024-03')
    expect(model.leaders).toBe('Ada Lovelace, Grace Hopper')
    expect(model.leadersHasSnippetSpacer).toBe(true)
    expect(model.descriptionSnippet).toBe(
      'A clearing network for community wallets.'
    )

    expect(model.details).not.toBeNull()
    expect(model.details?.href).toBe(
      'https://community.interledger.org/some-report'
    )
    expect(model.details?.umami).toMatchObject({
      'data-umami-event': 'button_card',
      'data-umami-event-base-component': 'grantee_cards',
      'data-umami-event-link-text': 'View details',
      'data-umami-event-lang': 'en',
      'data-umami-event-current-path': 'grant',
      'data-umami-event-current-section': 'foundation',
      'data-umami-event-destination-path': 'community_interledger',
      'data-umami-event-destination-section': 'external'
    })

    expect(model.tags.map((tag) => tag.text)).toEqual([
      'Open Payments',
      'Education'
    ])
    expect(model.tags[0].href).toBe(
      '/grant/grantee-directory/2024/tag/open-payments?q=wallet'
    )
    expect(model.tags[0].umami).toMatchObject({
      'data-track-event': 'button_ui',
      'data-track-event-base-component': 'grantee_tag',
      'data-track-event-link-text': '#Open Payments',
      'data-track-event-lang': 'en',
      'data-track-event-current-path': 'grant',
      'data-track-event-destination-path': 'grant'
    })
    expect(model.tags[0].umami).not.toHaveProperty('data-umami-event')
    expect(model.tags[1].href).toBe(
      '/grant/grantee-directory/2024/tag/education?q=wallet'
    )
  })

  it('omits every optional section when those fields are empty', () => {
    const model = rowModel(
      sampleSearchEntry({ name: 'Sparse Org' }),
      sampleContext({ searchQuery: '' })
    )

    expect(model.name).toBe('Sparse Org')
    expect(model.program).toBeNull()
    expect(model.budgetLabel).toBeNull()
    expect(model.tags).toEqual([])
    expect(model.country).toBeNull()
    expect(model.startLabel).toBeNull()
    expect(model.startMonth).toBeNull()
    expect(model.leaders).toBeNull()
    expect(model.leadersHasSnippetSpacer).toBe(false)
    expect(model.descriptionSnippet).toBeNull()
    expect(model.details).toBeNull()
  })

  it('keeps country without a date', () => {
    const model = rowModel(
      sampleSearchEntry({ name: 'Country Only', country: 'Brazil' })
    )

    expect(model.country).toBe('Brazil')
    expect(model.startLabel).toBeNull()
    expect(model.startMonth).toBeNull()
  })

  it('keeps leaders without a snippet and does not add the snippet spacer', () => {
    const model = rowModel(
      sampleSearchEntry({ name: 'Leaders Only', leaders: ['Ada'] })
    )

    expect(model.leaders).toBe('Ada')
    expect(model.leadersHasSnippetSpacer).toBe(false)
    expect(model.descriptionSnippet).toBeNull()
  })

  it('links yearless tag pills under /tag/<slug>', () => {
    const model = rowModel(
      sampleSearchEntry({ name: 'All Years', tags: ['Privacy'] }),
      sampleContext({ selectedYear: '', searchQuery: '' })
    )

    expect(model.tags).toHaveLength(1)
    expect(model.tags[0].href).toBe('/grant/grantee-directory/tag/privacy')
  })
})
