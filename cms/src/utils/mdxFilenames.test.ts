import { describe, it, expect } from 'vitest'
import {
  mdxRelativePath,
  mdxSubpath,
  pathSlugToMdxFilename,
  resolveFilenameSlug,
  sectionScopedMdxFilename
} from './mdxFilenames'

describe('resolveFilenameSlug', () => {
  it('uses the English slug for a non-English locale when provided', () => {
    expect(
      resolveFilenameSlug('es', 'subvenciones/beca', 'grant/fellowship')
    ).toBe('grant/fellowship')
  })

  it('falls back to its own slug for a non-English locale with no English sibling', () => {
    expect(resolveFilenameSlug('es', 'subvenciones/beca', undefined)).toBe(
      'subvenciones/beca'
    )
  })

  it('always uses its own slug for the English locale, ignoring englishSlug', () => {
    expect(
      resolveFilenameSlug('en', 'grant/fellowship', 'grant/fellowship')
    ).toBe('grant/fellowship')
  })
})

describe('pathSlugToMdxFilename', () => {
  it('flattens nested path slugs to hyphenated filename stems', () => {
    expect(pathSlugToMdxFilename('grant/fellowship/jane-doe')).toBe(
      'grant-fellowship-jane-doe'
    )
    expect(pathSlugToMdxFilename('/summit/2025/speakers/jane-doe/')).toBe(
      'summit-2025-speakers-jane-doe'
    )
  })
})

describe('sectionScopedMdxFilename', () => {
  // The bug in INTORG-1132: both FAQs are pathSlug 'faq', so the stem has to
  // carry the section or the hackathon export overwrites faq.mdx.
  it('gives the two FAQs different filenames', () => {
    expect(sectionScopedMdxFilename('faq', 'foundation')).toBe('faq')
    expect(sectionScopedMdxFilename('faq', 'hackathon')).toBe('hackathon-faq')
  })

  it('leaves foundation entries unprefixed, since they route from the root', () => {
    expect(
      sectionScopedMdxFilename('grant/grantmaking-faq', 'foundation')
    ).toBe('grant-grantmaking-faq')
  })

  it('flattens a nested slug under its section prefix', () => {
    expect(sectionScopedMdxFilename('2025/speakers/jane-doe', 'summit')).toBe(
      'summit-2025-speakers-jane-doe'
    )
  })

  // Leading and trailing slashes must not produce a doubled separator.
  it('normalizes surrounding slashes before prefixing', () => {
    expect(sectionScopedMdxFilename('/faq/', 'hackathon')).toBe('hackathon-faq')
  })

  it('falls back to the bare stem when there is no section', () => {
    expect(sectionScopedMdxFilename('faq')).toBe('faq')
    expect(sectionScopedMdxFilename('faq', null)).toBe('faq')
    expect(sectionScopedMdxFilename('faq', '')).toBe('faq')
  })
})

describe('mdxSubpath', () => {
  it('keeps a page slug as a real path, so the tree mirrors the URL', () => {
    expect(mdxSubpath('page', { pathSlug: 'grant/fellowship' })).toBe(
      'grant/fellowship.mdx'
    )
    expect(mdxSubpath('page', { pathSlug: 'about-us' })).toBe('about-us.mdx')
  })

  it('prefixes a blog filename with the publication date', () => {
    expect(
      mdxSubpath('blog', { pathSlug: 'ilf-and-hsms', date: '2026-05-12' })
    ).toBe('2026-05-12-ilf-and-hsms.mdx')
  })

  // A draft can reach the exporter before an editor sets the date.
  it('drops the date prefix when a blog post has no date', () => {
    expect(mdxSubpath('blog', { pathSlug: 'ilf-and-hsms', date: null })).toBe(
      'ilf-and-hsms.mdx'
    )
  })

  it('flattens a nested slug for a flat collection', () => {
    expect(mdxSubpath('flat', { pathSlug: 'grant/fellowship/jane-doe' })).toBe(
      'grant-fellowship-jane-doe.mdx'
    )
  })

  it('carries the section for a cross-section collection', () => {
    expect(
      mdxSubpath('flat-section', { pathSlug: 'faq', section: 'hackathon' })
    ).toBe('hackathon-faq.mdx')
    expect(
      mdxSubpath('flat-section', { pathSlug: 'faq', section: 'foundation' })
    ).toBe('faq.mdx')
  })

  it('names a localized file after its English counterpart', () => {
    expect(
      mdxSubpath('page', {
        pathSlug: 'subvenciones/beca',
        locale: 'es',
        englishSlug: 'grant/fellowship'
      })
    ).toBe('grant/fellowship.mdx')
  })

  it('ignores englishSlug for the default locale', () => {
    expect(
      mdxSubpath('page', {
        pathSlug: 'grant/fellowship',
        locale: 'en',
        englishSlug: 'something-else'
      })
    ).toBe('grant/fellowship.mdx')
  })

  it('normalizes surrounding slashes on the pathSlug', () => {
    expect(mdxSubpath('page', { pathSlug: '/about-us/' })).toBe('about-us.mdx')
  })

  it('throws when pathSlug is empty, since no filename can be derived', () => {
    expect(() => mdxSubpath('page', { pathSlug: '' })).toThrow(
      'pathSlug is required'
    )
    expect(() => mdxSubpath('page', { pathSlug: '///' })).toThrow(
      'pathSlug is required'
    )
  })
})

describe('mdxRelativePath', () => {
  it('leaves a default-locale file at the collection root', () => {
    expect(mdxRelativePath('page', { pathSlug: 'about-us' })).toBe(
      'about-us.mdx'
    )
  })

  it('puts a localized file under its locale folder', () => {
    expect(
      mdxRelativePath('blog', {
        pathSlug: 'mas-alla-de-open-payments',
        locale: 'es',
        englishSlug: 'go-further-with-open-payments',
        date: '2026-01-22'
      })
    ).toBe('es/2026-01-22-go-further-with-open-payments.mdx')
  })

  // The regression in INTORG-1237: an editor renamed the entry and the file
  // kept the old stem, so the next publish wrote a second file beside it.
  it('derives the name from the entry, never from the file already on disk', () => {
    expect(
      mdxRelativePath('blog', {
        pathSlug: 'simple-rafiki-integration-guide',
        date: '2026-03-26'
      })
    ).toBe('2026-03-26-simple-rafiki-integration-guide.mdx')
  })
})
