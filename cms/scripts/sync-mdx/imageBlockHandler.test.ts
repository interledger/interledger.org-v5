import { describe, it, expect } from 'vitest'
import { MdxParserError, ParserErrorCode } from './parserErrors'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'

// Side-effect import: registers the ImageBlock handler
import './imageBlockHandler'

/** Build a ParserContext with a controllable resolveMediaUpload. */
function ctxWith(uploads: Record<string, number> = {}): ParserContext {
  return {
    locale: 'en',
    resolveMediaUpload: async (url: string) => {
      const id = uploads[url]
      if (!id) {
        throw new MdxParserError({
          code: ParserErrorCode.UNRESOLVED_RELATION,
          message: `Upload "${url}" not found.`,
          component: 'ImageBlock'
        })
      }
      return id
    }
  }
}

describe('ImageBlock handler — happy paths', () => {
  it('resolves src to a media ID and defaults the boolean flags to false', async () => {
    const blocks = await parseMdxToBlocks(
      '<ImageBlock src="/img/diagram.png" />',
      ctxWith({ '/img/diagram.png': 12 })
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.image-block',
        image: 12,
        needsFullView: false,
        needsOutline: false
      }
    ])
  })

  it('maps alt to altText', async () => {
    const blocks = await parseMdxToBlocks(
      '<ImageBlock src="/img/diagram.png" alt="Sequence diagram" />',
      ctxWith({ '/img/diagram.png': 12 })
    )

    expect(blocks[0]).toMatchObject({ altText: 'Sequence diagram' })
  })

  it('omits altText when alt is empty or absent', async () => {
    const blocks = await parseMdxToBlocks(
      '<ImageBlock src="/img/diagram.png" alt="" />',
      ctxWith({ '/img/diagram.png': 12 })
    )

    expect(blocks[0]).not.toHaveProperty('altText')
  })

  it('resolves tablet and mobile variants to their own media IDs', async () => {
    const blocks = await parseMdxToBlocks(
      '<ImageBlock src="/img/d.png" tabletSrc="/img/t.png" mobileSrc="/img/m.png" />',
      ctxWith({ '/img/d.png': 1, '/img/t.png': 2, '/img/m.png': 3 })
    )

    expect(blocks[0]).toMatchObject({
      image: 1,
      tabletImage: 2,
      mobileImage: 3
    })
  })

  it('reads needsFullView and needsOutline boolean expressions', async () => {
    const blocks = await parseMdxToBlocks(
      '<ImageBlock src="/img/d.png" needsFullView={true} needsOutline={true} />',
      ctxWith({ '/img/d.png': 1 })
    )

    expect(blocks[0]).toMatchObject({
      needsFullView: true,
      needsOutline: true
    })
  })
})

describe('ImageBlock handler — errors', () => {
  it('returns MISSING_REQUIRED_PROP when src is missing', async () => {
    const result = await parseMdxToBlocks('<ImageBlock alt="x" />', ctxWith())
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.MISSING_REQUIRED_PROP
    })
  })

  it('returns DYNAMIC_EXPRESSION when src is a dynamic expression', async () => {
    const result = await parseMdxToBlocks(
      '<ImageBlock src={someVar} />',
      ctxWith()
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('returns UNRESOLVED_RELATION when the image is not in Strapi media', async () => {
    const result = await parseMdxToBlocks(
      '<ImageBlock src="/img/missing.png" />',
      ctxWith({})
    )
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })

  it('returns UNRESOLVED_RELATION when resolveMediaUpload is absent', async () => {
    const result = await parseMdxToBlocks('<ImageBlock src="/img/d.png" />', {
      locale: 'en'
    })
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.UNRESOLVED_RELATION })
  })
})

describe('ImageBlock handler — ordering', () => {
  it('preserves document order with surrounding markdown', async () => {
    const mdx = [
      'Here is the architecture:',
      '',
      '<ImageBlock src="/img/arch.png" alt="Architecture" needsFullView={true} />',
      '',
      'As shown above.'
    ].join('\n')

    const blocks = await parseMdxToBlocks(mdx, ctxWith({ '/img/arch.png': 5 }))

    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ __component: 'blocks.paragraph' })
    expect(blocks[1]).toMatchObject({
      __component: 'blocks.image-block',
      image: 5,
      needsFullView: true
    })
    expect(blocks[2]).toMatchObject({ __component: 'blocks.paragraph' })
  })
})
