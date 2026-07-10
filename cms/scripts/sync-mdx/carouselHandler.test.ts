import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers LogoCarousel handler
import './carouselHandler'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ParserContext with controllable upload resolution and alt-text tracking. */
function ctxWith(uploads: Record<string, number> = {}): ParserContext & {
  updatedAlts: Array<{ id: number; alt: string | null }>
} {
  const updatedAlts: Array<{ id: number; alt: string | null }> = []
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message: `Upload "${url}" not found.`,
          component: 'LogoCarousel'
        })
      }
      return id
    },
    updateMediaAlt: async (id: number, alt: string | null) => {
      updatedAlts.push({ id, alt })
    },
    updatedAlts
  }
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('LogoCarousel handler', () => {
  it('parses a single logo with heading and accessibilityLabel', async () => {
    const ctx = ctxWith({ '/img/plata.png': 12 })
    const blocks = await parseMdxToBlocks(
      `<LogoCarousel heading="In partnership with" accessibilityLabel="Our Partners" logos={[{ name: 'Plata', src: '/img/plata.png' }]} />`,
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.carousel',
        heading: 'In partnership with',
        accessibilityLabel: 'Our Partners',
        logos: [12]
      }
    ])
    expect(ctx.updatedAlts).toEqual([{ id: 12, alt: 'Plata' }])
  })

  it('parses multiple logos, including a null name', async () => {
    const ctx = ctxWith({ '/img/a.png': 1, '/img/b.png': 2 })
    const blocks = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'A', src: '/img/a.png' }, { name: null, src: '/img/b.png' }]} />`,
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.carousel',
        accessibilityLabel: 'Our Partners',
        logos: [1, 2]
      }
    ])
    expect(ctx.updatedAlts).toEqual([
      { id: 1, alt: 'A' },
      { id: 2, alt: null }
    ])
  })

  it('omits heading when absent', async () => {
    const ctx = ctxWith({ '/img/a.png': 1 })
    const blocks = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'A', src: '/img/a.png' }]} />`,
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.carousel',
        accessibilityLabel: 'Our Partners',
        logos: [1]
      }
    ])
  })

  it('treats a missing name key the same as null', async () => {
    const ctx = ctxWith({ '/img/a.png': 1 })
    const blocks = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ src: '/img/a.png' }]} />`,
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.carousel',
        accessibilityLabel: 'Our Partners',
        logos: [1]
      }
    ])
    expect(ctx.updatedAlts).toEqual([{ id: 1, alt: null }])
  })

  it('treats an empty string name the same as null', async () => {
    const ctx = ctxWith({ '/img/a.png': 1 })
    const blocks = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: '', src: '/img/a.png' }]} />`,
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.carousel',
        accessibilityLabel: 'Our Partners',
        logos: [1]
      }
    ])
    expect(ctx.updatedAlts).toEqual([{ id: 1, alt: null }])
  })

  it('does not fail when updateMediaAlt is not provided', async () => {
    const blocks = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'A', src: '/img/a.png' }]} />`,
      {
        locale: 'en',
        resolveMediaUpload: async () => 1
      }
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.carousel',
        accessibilityLabel: 'Our Partners',
        logos: [1]
      }
    ])
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('LogoCarousel handler — errors', () => {
  it('returns MISSING_REQUIRED_PROP when logos is missing', async () => {
    const result = await parseMdxToBlocks(
      '<LogoCarousel heading="Partners" accessibilityLabel="Our Partners" />',
      ctxWith()
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns MISSING_REQUIRED_PROP when accessibilityLabel is missing', async () => {
    const result = await parseMdxToBlocks(
      `<LogoCarousel logos={[{ name: 'A', src: '/img/a.png' }]} />`,
      ctxWith({ '/img/a.png': 1 })
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns DYNAMIC_EXPRESSION when logos is a dynamic expression', async () => {
    const result = await parseMdxToBlocks(
      '<LogoCarousel accessibilityLabel="Our Partners" logos={someVar} />',
      ctxWith()
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('returns INVALID_PROP_VALUE when logos is not an array', async () => {
    const result = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={{ name: 'A', src: '/img/a.png' }} />`,
      ctxWith()
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns INVALID_PROP_VALUE when a logo entry is missing src', async () => {
    const result = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'A' }]} />`,
      ctxWith()
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.INVALID_PROP_VALUE })
  })

  it('returns UNRESOLVED_RELATION when resolveMediaUpload is not in context', async () => {
    const result = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'A', src: '/img/a.png' }]} />`,
      { locale: 'en' }
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })

  it('propagates the error when resolveMediaUpload rejects', async () => {
    const result = await parseMdxToBlocks(
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'A', src: '/img/missing.png' }]} />`,
      ctxWith({})
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })
})

// ---------------------------------------------------------------------------
// Integration: mixed markdown + <LogoCarousel> ordering
// ---------------------------------------------------------------------------

describe('LogoCarousel handler — mixed content', () => {
  it('preserves document order with surrounding markdown', async () => {
    const ctx = ctxWith({ '/img/a.png': 1 })
    const mdx = [
      'Our partners:',
      '',
      `<LogoCarousel accessibilityLabel="Our Partners" logos={[{ name: 'A', src: '/img/a.png' }]} />`,
      '',
      'More content after the carousel.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctx)
    if (blocks instanceof MdxParserError) throw blocks

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toEqual({
      __component: 'blocks.carousel',
      accessibilityLabel: 'Our Partners',
      logos: [1]
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
