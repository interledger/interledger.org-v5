import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type {
  GranteeSearchEntry,
  GranteeSearchProject
} from '@/utils/main/granteeDirectory'
import {
  formatGrantCount,
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
const REQUIRED_TEMPLATE_ATTRS = [
  'data-grantee-search-tag-template',
  'data-grantee-search-project-template',
  'data-grantee-search-report-template',
  'data-grantee-search-name',
  'data-grantee-search-meta-wrap',
  'data-grantee-search-country-wrap',
  'data-grantee-search-country',
  'data-grantee-search-date-wrap',
  'data-grantee-search-date-text',
  'data-grantee-search-date',
  'data-grantee-search-tags-wrap',
  'data-grantee-search-grant-count',
  'data-grantee-search-projects',
  'data-grantee-search-program',
  'data-grantee-search-project-name',
  'data-grantee-search-budget',
  'data-grantee-search-no-reports',
  'data-grantee-search-reports',
  'data-grantee-search-report-label',
  'data-grantee-search-report-external',
  'data-grantee-search-report-project',
  'data-grantee-search-report-new-tab'
] as const

function sampleProject(
  overrides: Partial<GranteeSearchProject> = {}
): GranteeSearchProject {
  return {
    id: 'recP1',
    name: 'Wallet pilot',
    program: '',
    year: '2024',
    tags: [],
    budgetLabel: null,
    reports: null,
    ...overrides
  }
}

function sampleSearchEntry(
  overrides: Partial<GranteeSearchEntry> = {}
): GranteeSearchEntry {
  return {
    id: 'rec1',
    name: 'Test',
    country: '',
    startMonth: '',
    startLabel: '',
    tags: [],
    projects: [sampleProject()],
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
    grantCountTemplate: '{count} grants',
    grantCountOneLabel: '1 grant',
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
    for (const attr of REQUIRED_TEMPLATE_ATTRS) {
      expect(source, attr).toContain(attr)
    }
  })
})

describe('formatGrantCount', () => {
  it('uses the singular label for one grant', () => {
    expect(formatGrantCount(1, sampleContext())).toBe('1 grant')
  })

  it('fills the plural template otherwise', () => {
    expect(formatGrantCount(3, sampleContext())).toBe('3 grants')
  })
})

describe('searchResultRowModel', () => {
  it('fills a populated entry and shows every optional section', () => {
    const model = rowModel(
      sampleSearchEntry({
        name: 'Clearing House',
        country: 'Kenya',
        startMonth: '2024-03',
        startLabel: 'March 2024',
        tags: ['Open Payments', 'Education']
      })
    )

    expect(model.name).toBe('Clearing House')
    expect(model.country).toBe('Kenya')
    expect(model.startLabel).toBe('March 2024')
    expect(model.startMonth).toBe('2024-03')
    expect(model.grantCount).toBe('1 grant')

    expect(model.tags.map((tag) => tag.text)).toEqual([
      'Open Payments',
      'Education'
    ])
    expect(model.tags[0].href).toBe(
      '/grant/grantee-directory/2024/tag/open-payments/?q=wallet'
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
      '/grant/grantee-directory/2024/tag/education/?q=wallet'
    )
  })

  it('omits every optional section when those fields are empty', () => {
    const model = rowModel(
      sampleSearchEntry({ name: 'Sparse Org' }),
      sampleContext({ searchQuery: '' })
    )

    expect(model.name).toBe('Sparse Org')
    expect(model.tags).toEqual([])
    expect(model.country).toBeNull()
    expect(model.startLabel).toBeNull()
    expect(model.startMonth).toBeNull()
    expect(model.projects).toEqual([
      { name: 'Wallet pilot', program: null, budgetLabel: null, reports: null }
    ])
  })

  it('keeps country without a date', () => {
    const model = rowModel(
      sampleSearchEntry({ name: 'Country Only', country: 'Brazil' })
    )

    expect(model.country).toBe('Brazil')
    expect(model.startLabel).toBeNull()
    expect(model.startMonth).toBeNull()
  })

  it('links yearless tag pills under /tag/<slug>', () => {
    const model = rowModel(
      sampleSearchEntry({ name: 'All Years', tags: ['Privacy'] }),
      sampleContext({ selectedYear: '', searchQuery: '' })
    )

    expect(model.tags).toHaveLength(1)
    expect(model.tags[0].href).toBe('/grant/grantee-directory/tag/privacy/')
  })

  it('fills each project and links its reports with tracking', () => {
    const href = '/grant/grantees/common-ground/reports/20260504-interim-1/'
    const model = rowModel(
      sampleSearchEntry({
        projects: [
          sampleProject({
            name: 'Wallet pilot',
            program: 'Digital Financial Services',
            budgetLabel: '65 000',
            reports: [
              { id: 'rep1', label: 'Interim report 1', href, external: true }
            ]
          }),
          sampleProject({ id: 'recP2', name: 'Workshops', reports: [] })
        ]
      })
    )

    expect(model.grantCount).toBe('2 grants')
    expect(model.projects[0]).toMatchObject({
      name: 'Wallet pilot',
      program: 'Digital Financial Services',
      budgetLabel: '65 000'
    })
    expect(model.projects[0]?.reports?.[0]).toMatchObject({
      label: 'Interim report 1',
      href,
      external: true
    })
    expect(model.projects[0]?.reports?.[0]?.umami).toMatchObject({
      'data-umami-event': 'button_card',
      'data-umami-event-base-component': 'grantee_cards',
      'data-umami-event-link-text': 'Interim report 1',
      'data-umami-event-lang': 'en'
    })
    // [] shows "No reports published yet"; null (pages hidden) shows nothing.
    expect(model.projects[1]?.reports).toEqual([])
  })
})
