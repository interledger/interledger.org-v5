import { describe, expect, it } from 'vitest'
import { isDemoPathSlug, isDemoPathname, isPreviewPathname } from './demoPaths'

describe('isDemoPathSlug', () => {
  it('matches an exact demo slug', () => {
    expect(isDemoPathSlug('demo')).toBe(true)
  })

  it('matches a demo- prefixed slug', () => {
    expect(isDemoPathSlug('demo-foundation-page')).toBe(true)
  })

  it('matches a nested demo segment', () => {
    expect(isDemoPathSlug('grant/demo-grant-page')).toBe(true)
  })

  it('does not match ordinary slugs', () => {
    expect(isDemoPathSlug('about-us')).toBe(false)
  })

  it('handles missing input', () => {
    expect(isDemoPathSlug(undefined)).toBe(false)
    expect(isDemoPathSlug(null)).toBe(false)
    expect(isDemoPathSlug('')).toBe(false)
  })
})

describe('isDemoPathname', () => {
  it('matches an exact demo segment', () => {
    expect(isDemoPathname('/demo')).toBe(true)
  })

  it('matches a demo- prefixed segment anywhere in the path', () => {
    expect(isDemoPathname('/grant/demo-grant-page')).toBe(true)
  })

  it('does not match ordinary paths', () => {
    expect(isDemoPathname('/about-us')).toBe(false)
  })
})

describe('isPreviewPathname', () => {
  it('matches a bare preview segment', () => {
    expect(isPreviewPathname('/preview/ui-components')).toBe(true)
    expect(isPreviewPathname('/preview/typography')).toBe(true)
    expect(isPreviewPathname('/blog/preview')).toBe(true)
    expect(isPreviewPathname('/es/blog/preview')).toBe(true)
  })

  it('matches a segment ending in -preview', () => {
    expect(isPreviewPathname('/page-preview')).toBe(true)
    expect(isPreviewPathname('/profile-preview')).toBe(true)
  })

  it('does not match ordinary paths', () => {
    expect(isPreviewPathname('/about-us')).toBe(false)
    expect(isPreviewPathname('/')).toBe(false)
  })

  it('does not false-positive on unrelated words containing "preview"', () => {
    expect(isPreviewPathname('/previewer')).toBe(false)
  })
})
