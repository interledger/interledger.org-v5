/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "https://interledger.org/" }
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GranteeSearchEntry } from '@/utils/main/grantee'
import {
  createSearchResultRow,
  hrefFromOriginal,
  hrefWithPreservedSearch,
  type SearchResultContext
} from './grantee-search-result'

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

const ROW_TEMPLATE_HTML = `
<li>
  <h3 data-grantee-search-name></h3>
  <p data-grantee-search-program hidden></p>
  <div data-grantee-search-budget-wrap hidden>
    <span data-grantee-search-budget-amount></span>
  </div>
  <ul data-grantee-search-tags-wrap hidden></ul>
  <ul data-grantee-search-meta-wrap hidden>
    <li data-grantee-search-country-wrap hidden>
      <span data-grantee-search-country></span>
    </li>
    <li data-grantee-search-date-wrap hidden>
      <time data-grantee-search-date>
        <span data-grantee-search-date-text></span>
      </time>
    </li>
  </ul>
  <div data-grantee-search-description-panel hidden>
    <div data-grantee-search-leaders-wrap hidden>
      <span data-grantee-search-leaders></span>
    </div>
    <p data-grantee-search-snippet hidden></p>
  </div>
  <div data-grantee-search-details-wrap hidden>
    <a data-grantee-search-details-link></a>
  </div>
</li>
`

const TAG_TEMPLATE_HTML = `<li><a></a></li>`

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

function makeTemplate(html: string): HTMLTemplateElement {
  const template = document.createElement('template')
  template.innerHTML = html
  return template
}

function renderRow(
  entry: GranteeSearchEntry,
  context: SearchResultContext = sampleContext(),
  rowHtml = ROW_TEMPLATE_HTML,
  tagHtml = TAG_TEMPLATE_HTML
): HTMLLIElement {
  return createSearchResultRow(
    entry,
    makeTemplate(rowHtml),
    makeTemplate(tagHtml),
    context
  )
}

function slot(row: ParentNode, attr: string): HTMLElement {
  const el = row.querySelector(`[${attr}]`)
  expect(el, attr).not.toBeNull()
  return el as HTMLElement
}

describe('hrefWithPreservedSearch', () => {
  const origin = 'https://interledger.org'

  it('returns the href unchanged when the query is empty', () => {
    expect(
      hrefWithPreservedSearch('/grant/grantee-directory/privacy', '', origin)
    ).toBe('/grant/grantee-directory/privacy')
  })

  it('appends ?q= to a same-origin directory href', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/2024/education',
        'open payments',
        origin
      )
    ).toBe('/grant/grantee-directory/2024/education?q=open+payments')
  })

  it('leaves an external href unchanged', () => {
    const href = 'https://community.interledger.org/some-report'
    expect(hrefWithPreservedSearch(href, 'education', origin)).toBe(href)
  })

  it('preserves a hash on a same-origin href', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/privacy#list',
        'education',
        origin
      )
    ).toBe('/grant/grantee-directory/privacy?q=education#list')
  })

  it('keeps an existing q when the query is empty', () => {
    expect(
      hrefWithPreservedSearch(
        '/grant/grantee-directory/2024?q=education',
        '',
        origin
      )
    ).toBe('/grant/grantee-directory/2024?q=education')
  })
})

describe('hrefFromOriginal', () => {
  const origin = 'https://interledger.org'
  const original = '/grant/grantee-directory/2024'

  it('appends q from the original href, then restores it when the query is cleared', () => {
    expect(hrefFromOriginal(original, 'education', origin)).toBe(
      '/grant/grantee-directory/2024?q=education'
    )
    expect(hrefFromOriginal(original, '', origin)).toBe(original)
    expect(hrefFromOriginal(original, '   ', origin)).toBe(original)
  })

  it('replaces a previous query instead of stacking on a mutated href', () => {
    expect(hrefFromOriginal(original, 'open payments', origin)).toBe(
      '/grant/grantee-directory/2024?q=open+payments'
    )
  })
})

describe('createSearchResultRow', () => {
  it('keeps every populate-script slot in GranteeSearchResultTemplate', () => {
    const source = readFileSync(SEARCH_RESULT_TEMPLATE_PATH, 'utf8')
    expect(source).toContain('id="grantee-search-result-template"')
    expect(source).toContain('data-grantee-search-tag-template')
    for (const attr of REQUIRED_ROW_ATTRS) {
      expect(source, attr).toContain(attr)
    }
  })

  it('fills a populated entry and shows every optional section', () => {
    const row = renderRow(
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

    expect(slot(row, 'data-grantee-search-name').textContent).toBe(
      'Clearing House'
    )
    expect(slot(row, 'data-grantee-search-program')).toMatchObject({
      hidden: false,
      textContent: 'Financial Inclusion'
    })
    expect(slot(row, 'data-grantee-search-budget-wrap').hidden).toBe(false)
    expect(slot(row, 'data-grantee-search-budget-amount').textContent).toBe(
      '50,000'
    )

    expect(slot(row, 'data-grantee-search-meta-wrap').hidden).toBe(false)
    expect(slot(row, 'data-grantee-search-country-wrap').hidden).toBe(false)
    expect(slot(row, 'data-grantee-search-country').textContent).toBe('Kenya')
    expect(slot(row, 'data-grantee-search-date-wrap').hidden).toBe(false)
    expect(slot(row, 'data-grantee-search-date-text').textContent).toBe(
      'March 2024'
    )
    expect(
      (slot(row, 'data-grantee-search-date') as HTMLTimeElement).dateTime
    ).toBe('2024-03')

    expect(slot(row, 'data-grantee-search-description-panel').hidden).toBe(
      false
    )
    const leadersWrap = slot(row, 'data-grantee-search-leaders-wrap')
    expect(leadersWrap.hidden).toBe(false)
    expect(leadersWrap.classList.contains('mb-lg')).toBe(true)
    expect(slot(row, 'data-grantee-search-leaders').textContent).toBe(
      'Ada Lovelace, Grace Hopper'
    )
    expect(slot(row, 'data-grantee-search-snippet')).toMatchObject({
      hidden: false,
      textContent: 'A clearing network for community wallets.'
    })

    const detailsWrap = slot(row, 'data-grantee-search-details-wrap')
    const detailsLink = slot(
      row,
      'data-grantee-search-details-link'
    ) as HTMLAnchorElement
    expect(detailsWrap.hidden).toBe(false)
    expect(detailsLink.href).toBe(
      'https://community.interledger.org/some-report'
    )
    expect(detailsLink.getAttribute('data-umami-event')).toBe('button_card')
    expect(detailsLink.getAttribute('data-umami-event-base-component')).toBe(
      'grantee_cards'
    )
    expect(detailsLink.getAttribute('data-umami-event-link-text')).toBe(
      'View details'
    )
    expect(detailsLink.getAttribute('data-umami-event-lang')).toBe('en')
    expect(detailsLink.getAttribute('data-umami-event-current-path')).toBe(
      'grant'
    )
    expect(detailsLink.getAttribute('data-umami-event-current-section')).toBe(
      'foundation'
    )
    expect(detailsLink.getAttribute('data-umami-event-destination-path')).toBe(
      'community_interledger'
    )
    expect(
      detailsLink.getAttribute('data-umami-event-destination-section')
    ).toBe('external')

    const tagsWrap = slot(row, 'data-grantee-search-tags-wrap')
    expect(tagsWrap.hidden).toBe(false)
    const pills = [...tagsWrap.querySelectorAll('a')]
    expect(pills.map((pill) => pill.textContent)).toEqual([
      'Open Payments',
      'Education'
    ])

    expect(pills[0].getAttribute('href')).toBe(
      '/grant/grantee-directory/2024/tag/open-payments?q=wallet'
    )
    expect(pills[0].getAttribute('data-track-event')).toBe('button_ui')
    expect(pills[0].getAttribute('data-track-event-base-component')).toBe(
      'grantee_tag'
    )
    expect(pills[0].getAttribute('data-track-event-link-text')).toBe(
      '#Open Payments'
    )
    expect(pills[0].getAttribute('data-track-event-lang')).toBe('en')
    expect(pills[0].getAttribute('data-track-event-current-path')).toBe('grant')
    expect(pills[0].getAttribute('data-track-event-destination-path')).toBe(
      'grant'
    )
    expect(pills[0].getAttribute('data-umami-event')).toBeNull()

    expect(pills[1].getAttribute('href')).toBe(
      '/grant/grantee-directory/2024/tag/education?q=wallet'
    )
  })

  it('hides every optional section when those fields are empty', () => {
    const row = renderRow(
      sampleSearchEntry({ name: 'Sparse Org' }),
      sampleContext({ searchQuery: '' })
    )

    expect(slot(row, 'data-grantee-search-name').textContent).toBe('Sparse Org')
    expect(slot(row, 'data-grantee-search-program').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-budget-wrap').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-tags-wrap').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-tags-wrap').children).toHaveLength(0)
    expect(slot(row, 'data-grantee-search-meta-wrap').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-country-wrap').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-date-wrap').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-description-panel').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-leaders-wrap').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-snippet').hidden).toBe(true)
    expect(slot(row, 'data-grantee-search-details-wrap').hidden).toBe(true)
  })

  it('shows country meta without unhiding an empty date', () => {
    const row = renderRow(
      sampleSearchEntry({ name: 'Country Only', country: 'Brazil' })
    )

    expect(slot(row, 'data-grantee-search-meta-wrap').hidden).toBe(false)
    expect(slot(row, 'data-grantee-search-country-wrap').hidden).toBe(false)
    expect(slot(row, 'data-grantee-search-country').textContent).toBe('Brazil')
    expect(slot(row, 'data-grantee-search-date-wrap').hidden).toBe(true)
  })

  it('shows leaders without a snippet and does not add the snippet spacer', () => {
    const row = renderRow(
      sampleSearchEntry({ name: 'Leaders Only', leaders: ['Ada'] })
    )

    expect(slot(row, 'data-grantee-search-description-panel').hidden).toBe(
      false
    )
    const leadersWrap = slot(row, 'data-grantee-search-leaders-wrap')
    expect(leadersWrap.hidden).toBe(false)
    expect(leadersWrap.classList.contains('mb-lg')).toBe(false)
    expect(slot(row, 'data-grantee-search-leaders').textContent).toBe('Ada')
    expect(slot(row, 'data-grantee-search-snippet').hidden).toBe(true)
  })

  it('links yearless tag pills under /tag/<slug>', () => {
    const row = renderRow(
      sampleSearchEntry({ name: 'All Years', tags: ['Privacy'] }),
      sampleContext({ selectedYear: '', searchQuery: '' })
    )

    const pill = slot(row, 'data-grantee-search-tags-wrap').querySelector('a')
    expect(pill).not.toBeNull()
    expect(pill!.getAttribute('href')).toBe(
      '/grant/grantee-directory/tag/privacy'
    )
  })

  it('throws when a required slot is missing from the row template', () => {
    expect(() =>
      renderRow(
        sampleSearchEntry({ name: 'Broken' }),
        sampleContext(),
        '<li></li>'
      )
    ).toThrow('Grantee search template missing [data-grantee-search-name]')
  })
})
