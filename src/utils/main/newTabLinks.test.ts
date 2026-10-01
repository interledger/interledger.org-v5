import { describe, expect, it } from 'vitest'
import {
  NEW_TAB_LINK_ATTRS,
  buildNewTabLinkHtml,
  getNewTabLinkAttrs,
  getOpensNewTabLabel
} from './newTabLinks'

describe('getNewTabLinkAttrs', () => {
  it.each([
    'https://example.com',
    'http://example.com/path?q=1#frag',
    'HTTPS://EXAMPLE.COM',
    '//cdn.example.com/file.pdf',
    '  https://example.com  ',
    'https://sub.interledger.org'
  ])('opens %s in a new tab', (href) => {
    expect(getNewTabLinkAttrs(href)).toEqual(NEW_TAB_LINK_ATTRS)
  })

  it.each([
    'https://interledger.org/about-us',
    'https://www.interledger.org',
    'HTTPS://WWW.INTERLEDGER.ORG/blog',
    'https://www.interledger.org.',
    '//interledger.org/about-us',
    '/about-us',
    'about-us',
    '#faq',
    'mailto:info@interledger.org',
    'tel:+123456',
    'https://',
    '',
    '   '
  ])('keeps %j in the same tab', (href) => {
    expect(getNewTabLinkAttrs(href)).toEqual({})
  })

  it('keeps null and undefined in the same tab', () => {
    expect(getNewTabLinkAttrs(null)).toEqual({})
    expect(getNewTabLinkAttrs(undefined)).toEqual({})
  })
})

describe('getOpensNewTabLabel', () => {
  it('returns the English label by default', () => {
    expect(getOpensNewTabLabel()).toBe('(opens in a new tab)')
  })

  it('returns the Spanish label for es', () => {
    expect(getOpensNewTabLabel('es')).toBe('(se abre en una pestaña nueva)')
  })

  it('falls back to English for an unknown locale', () => {
    expect(getOpensNewTabLabel('xx')).toBe('(opens in a new tab)')
  })

  it.each(['toString', '__proto__', 'constructor'])(
    'falls back to English for the inherited key %s',
    (lang) => {
      expect(getOpensNewTabLabel(lang)).toBe('(opens in a new tab)')
      expect(() =>
        buildNewTabLinkHtml('https://example.com', lang)
      ).not.toThrow()
    }
  )
})

describe('buildNewTabLinkHtml', () => {
  it('returns target, rel and an sr-only hint for an external link', () => {
    expect(buildNewTabLinkHtml('https://example.com', 'en')).toEqual({
      attrs: ' target="_blank" rel="noopener noreferrer"',
      hint: '<span class="sr-only"> (opens in a new tab)</span>'
    })
  })

  it('localizes the hint', () => {
    expect(buildNewTabLinkHtml('https://example.com', 'es').hint).toContain(
      'se abre en una pestaña nueva'
    )
  })

  it('returns empty fragments for an internal link', () => {
    expect(buildNewTabLinkHtml('/about-us', 'en')).toEqual({
      attrs: '',
      hint: ''
    })
  })
})
