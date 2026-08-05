import { describe, expect, it } from 'vitest'
import { isDemoPathSlug, isDemoPathname } from '../shared/demoPaths'

describe('isDemoPathSlug', () => {
  it('matches demo path slugs', () => {
    expect(isDemoPathSlug('demo-foundation-page')).toBe(true)
    expect(isDemoPathSlug('demo-summit-page')).toBe(true)
    expect(isDemoPathSlug('demo-hackathon-page')).toBe(true)
    expect(isDemoPathSlug('demo')).toBe(true)
    expect(isDemoPathSlug('section/demo-page')).toBe(true)
  })

  it('rejects normal path slugs', () => {
    expect(isDemoPathSlug('about-us')).toBe(false)
    expect(isDemoPathSlug('our-grantmaking')).toBe(false)
    expect(isDemoPathSlug('')).toBe(false)
    expect(isDemoPathSlug(null)).toBe(false)
  })
})

describe('isDemoPathname', () => {
  it('matches demo segments in URLs', () => {
    expect(isDemoPathname('/demo-foundation-page/')).toBe(true)
    expect(isDemoPathname('/summit/demo-summit-page/')).toBe(true)
    expect(isDemoPathname('/es/hackathon/demo-hackathon-page/')).toBe(true)
  })

  it('rejects normal paths', () => {
    expect(isDemoPathname('/about-us/')).toBe(false)
    expect(isDemoPathname('/blog/web-isnt-free/')).toBe(false)
  })
})
