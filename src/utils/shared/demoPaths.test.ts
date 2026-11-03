import { describe, expect, it } from 'vitest'
import {
  isDemoPathSlug,
  isDemoPathname,
  isExcludedFromSitemap,
  isPreviewPathname
} from './demoPaths'

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
    expect(isPreviewPathname('/preview/page-preview')).toBe(true)
    expect(isPreviewPathname('/preview/hackathon-preview')).toBe(true)
  })

  // Prerendered pages pass `Astro.url.pathname` with a trailing slash, and
  // BaseLayout relies on this to suppress hreflang without a per-page prop.
  it('matches a prerendered pathname with a trailing slash', () => {
    expect(isPreviewPathname('/preview/typography/')).toBe(true)
    expect(isPreviewPathname('/page-preview/')).toBe(true)
  })

  it('does not match ordinary paths', () => {
    expect(isPreviewPathname('/about-us')).toBe(false)
    expect(isPreviewPathname('/')).toBe(false)
  })

  it('does not false-positive on unrelated words containing "preview"', () => {
    expect(isPreviewPathname('/previewer')).toBe(false)
  })
})

describe('isExcludedFromSitemap', () => {
  // Both were in the public sitemap: the old filter only matched `/preview`.
  it.each(['/page-preview/', '/profile-preview/'])(
    'excludes the %s preview route',
    (pathname) => {
      expect(isExcludedFromSitemap(pathname)).toBe(true)
    }
  )

  it.each([
    '/preview/page-preview/',
    '/preview/hackathon-preview/',
    '/blog/preview/',
    '/es/blog/preview/',
    '/demo-foundation-page/',
    '/grant/demo-grant-page/'
  ])('still excludes %s', (pathname) => {
    expect(isExcludedFromSitemap(pathname)).toBe(true)
  })

  // Side effect of sharing the preview rule: any segment ending in `-preview`
  // is excluded, not only the preview routes. No page slug ends that way
  // today, but a page like this one would silently leave the sitemap.
  it.each(['/grant/program-preview/', '/es/grant/program-preview/'])(
    'also excludes a content page whose slug ends in -preview: %s',
    (pathname) => {
      expect(isExcludedFromSitemap(pathname)).toBe(true)
    }
  )

  it.each(['/', '/about-us/', '/blog/', '/es/blog/', '/previewer/'])(
    'keeps the public page %s',
    (pathname) => {
      expect(isExcludedFromSitemap(pathname)).toBe(false)
    }
  )
})
