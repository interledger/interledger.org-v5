import { describe, it, expect } from 'vitest'
import {
  ensureLeadingSlash,
  normalizePathSegment,
  normalizeRelativeLinksInDocumentData
} from '@/utils'

describe('ensureLeadingSlash', () => {
  it('prefixes a relative path with a leading slash', () => {
    expect(ensureLeadingSlash('grant/our-grantmaking')).toBe(
      '/grant/our-grantmaking'
    )
  })

  it('leaves an already-leading-slash path unchanged', () => {
    expect(ensureLeadingSlash('/grant/our-grantmaking')).toBe(
      '/grant/our-grantmaking'
    )
  })

  it('leaves http/https URLs unchanged', () => {
    expect(ensureLeadingSlash('http://example.com')).toBe('http://example.com')
    expect(ensureLeadingSlash('https://example.com')).toBe(
      'https://example.com'
    )
  })

  it('leaves a protocol-relative URL unchanged', () => {
    expect(ensureLeadingSlash('//example.com')).toBe('//example.com')
  })

  it('leaves a mailto: link unchanged', () => {
    expect(ensureLeadingSlash('mailto:info@interledger.org')).toBe(
      'mailto:info@interledger.org'
    )
  })

  it('leaves a tel: link unchanged', () => {
    expect(ensureLeadingSlash('tel:+123456')).toBe('tel:+123456')
  })

  it('leaves an #anchor link unchanged', () => {
    expect(ensureLeadingSlash('#section')).toBe('#section')
  })

  it('leaves an empty string unchanged', () => {
    expect(ensureLeadingSlash('')).toBe('')
  })
})

describe('normalizePathSegment', () => {
  it('strips a leading slash', () => {
    expect(normalizePathSegment('/our-grantmaking')).toBe('our-grantmaking')
  })

  it('strips a trailing slash', () => {
    expect(normalizePathSegment('our-grantmaking/')).toBe('our-grantmaking')
  })

  it('strips both leading and trailing slashes', () => {
    expect(normalizePathSegment('/our-grantmaking/')).toBe('our-grantmaking')
  })

  it('leaves a value with no surrounding slashes unchanged', () => {
    expect(normalizePathSegment('education/on-campus')).toBe(
      'education/on-campus'
    )
  })

  it('trims surrounding whitespace along with slashes', () => {
    expect(normalizePathSegment(' /our-grantmaking ')).toBe('our-grantmaking')
    expect(normalizePathSegment('our-grantmaking/ ')).toBe('our-grantmaking')
  })
})

describe('normalizeRelativeLinksInDocumentData', () => {
  it('normalizes a top-level pathSlug and href-like field', () => {
    const data = { pathSlug: '/our-grantmaking', link: 'grant/apply' }
    normalizeRelativeLinksInDocumentData(data)
    expect(data).toEqual({
      pathSlug: 'our-grantmaking',
      link: '/grant/apply'
    })
  })

  it('normalizes fields nested inside a single component', () => {
    const data = {
      ctaStrip: {
        primaryButtonLink: 'grant/apply',
        secondaryButtonLink: 'https://example.com'
      }
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.ctaStrip).toEqual({
      primaryButtonLink: '/grant/apply',
      secondaryButtonLink: 'https://example.com'
    })
  })

  it('normalizes fields nested inside a dynamic-zone array', () => {
    const data = {
      content: [
        { __component: 'shared.cta-link', link: 'contact', text: 'Go' },
        { __component: 'blocks.card-link', href: '#section', title: 'Jump' },
        { __component: 'blocks.paragraph', content: 'Unrelated text' }
      ]
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.content).toEqual([
      { __component: 'shared.cta-link', link: '/contact', text: 'Go' },
      { __component: 'blocks.card-link', href: '#section', title: 'Jump' },
      { __component: 'blocks.paragraph', content: 'Unrelated text' }
    ])
  })

  it('normalizes fields nested inside repeatable components', () => {
    const data = {
      mainMenu: [
        { label: 'A', href: 'about-us' },
        { label: 'B', href: 'mailto:info@interledger.org' }
      ]
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data.mainMenu).toEqual([
      { label: 'A', href: '/about-us' },
      { label: 'B', href: 'mailto:info@interledger.org' }
    ])
  })

  it('leaves unrelated fields and non-string values untouched', () => {
    const data = {
      title: 'Hello',
      required: true,
      count: 3,
      media: null
    }
    normalizeRelativeLinksInDocumentData(data)
    expect(data).toEqual({
      title: 'Hello',
      required: true,
      count: 3,
      media: null
    })
  })
})
