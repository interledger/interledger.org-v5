import { describe, expect, it } from 'vitest'
import { parseRedirectConfig, toAstroRedirects } from './redirects'
import { REDIRECT_CATEGORIES, type RedirectConfig } from '../../types/redirects'

function emptyConfig(): RedirectConfig {
  return Object.fromEntries(
    REDIRECT_CATEGORIES.map((category) => [category, []])
  ) as unknown as RedirectConfig
}

describe('parseRedirectConfig', () => {
  it('parses a valid config', () => {
    const rule = { source: '/home', destination: '/', status: 301 }
    const config = parseRedirectConfig({ site_pages: [rule] })
    expect(config).not.toBeInstanceOf(Error)
    expect((config as RedirectConfig)['site_pages']).toEqual([rule])
  })

  it('keeps a note and drops an empty one', () => {
    const config = parseRedirectConfig({
      site_pages: [
        { source: '/a', destination: '/b', status: 301, note: 'why' },
        { source: '/c', destination: '/d', status: 301, note: '' }
      ]
    }) as RedirectConfig
    expect(config['site_pages']).toEqual([
      { source: '/a', destination: '/b', status: 301, note: 'why' },
      { source: '/c', destination: '/d', status: 301 }
    ])
  })

  it('keeps enabled: false and drops enabled: true', () => {
    const config = parseRedirectConfig({
      site_pages: [
        { source: '/a', destination: '/b', status: 301, enabled: false },
        { source: '/c', destination: '/d', status: 301, enabled: true }
      ]
    }) as RedirectConfig
    expect(config.site_pages).toEqual([
      { source: '/a', destination: '/b', status: 301, enabled: false },
      { source: '/c', destination: '/d', status: 301 }
    ])
  })

  it('fills missing categories with empty arrays', () => {
    expect(parseRedirectConfig({})).toEqual(emptyConfig())
  })

  it.each([null, [], 'redirects', 42])(
    'rejects a non-object root (%j)',
    (json) => {
      expect(parseRedirectConfig(json)).toBeInstanceOf(Error)
    }
  )

  it('rejects an unknown category', () => {
    const result = parseRedirectConfig({ 'not-a-category': [] })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('not-a-category')
  })

  it('rejects a category that is not an array', () => {
    expect(parseRedirectConfig({ site_pages: {} })).toBeInstanceOf(Error)
  })

  it.each([
    ['a non-object rule', 'nope'],
    ['a missing source', { destination: '/', status: 301 }],
    ['an empty source', { source: ' ', destination: '/', status: 301 }],
    ['a missing destination', { source: '/a', status: 301 }],
    ['an unsupported status', { source: '/a', destination: '/', status: 307 }],
    ['a string status', { source: '/a', destination: '/', status: '301' }],
    [
      'a non-boolean enabled',
      { source: '/a', destination: '/', status: 301, enabled: 'no' }
    ],
    [
      'a non-string note',
      { source: '/a', destination: '/', status: 301, note: 1 }
    ]
  ])('rejects %s, naming where it is', (_label, rule) => {
    const result = parseRedirectConfig({ hackathon: [rule] })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('hackathon[0]')
  })
})

describe('toAstroRedirects', () => {
  it('returns an empty record for an empty config', () => {
    expect(toAstroRedirects(emptyConfig())).toEqual({})
  })

  it('emits a 301 as a bare destination and a 302 as an object', () => {
    const config = emptyConfig()
    config['site_pages'] = [
      { source: '/home', destination: '/', status: 301 },
      { source: '/promo', destination: '/events', status: 302 }
    ]
    expect(toAstroRedirects(config)).toEqual({
      '/home': '/',
      '/promo': { status: 302, destination: '/events' }
    })
  })

  it('leaves disabled rules out', () => {
    const config = emptyConfig()
    config.site_pages = [
      { source: '/on', destination: '/x', status: 301 },
      { source: '/off', destination: '/y', status: 301, enabled: false }
    ]
    expect(toAstroRedirects(config)).toEqual({ '/on': '/x' })
  })

  it('merges every category', () => {
    const config = emptyConfig()
    config['site_pages'] = [{ source: '/a', destination: '/b', status: 301 }]
    config.hackathon = [{ source: '/c', destination: '/d', status: 301 }]
    expect(toAstroRedirects(config)).toEqual({ '/a': '/b', '/c': '/d' })
  })
})
