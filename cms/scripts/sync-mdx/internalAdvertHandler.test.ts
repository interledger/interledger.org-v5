import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers the InternalAdvert handler
import './internalAdvertHandler'

const ctx: ParserContext = {
  locale: 'en',
  resolveMediaUpload: async (url: string) => {
    if (url === '/uploads/wm-logo.svg') return 7
    throw new Error(`Upload "${url}" not found.`)
  }
}

/** Three elements, so it clears the minimum without any extras. */
const MINIMAL =
  '<InternalAdvert helperText="Know more" logoLabel="Web Monetization" headline="A headline" />'

describe('InternalAdvert parser', () => {
  it('parses a full card', async () => {
    const mdx = `<InternalAdvert
  helperText="Know more"
  logo="/uploads/wm-logo.svg"
  logoAlt=""
  logoLabel="Web Monetization"
  headline="Revolutionizing the digital content economy."
  socialLinks={["https://www.linkedin.com/company/web-monetization/", "https://www.instagram.com/webmonetization/"]}
  buttonText="Visit Web Monetization"
  buttonLink="https://webmonetization.org"
  buttonExternal={true}
>

Web Monetization connects publishers and creators.

</InternalAdvert>`

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.internal-advert',
        helperText: 'Know more',
        logo: { image: 7, alternativeText: '' },
        logoLabel: 'Web Monetization',
        headline: 'Revolutionizing the digital content economy.',
        body: 'Web Monetization connects publishers and creators.',
        socialLinks: [
          { url: 'https://www.linkedin.com/company/web-monetization/' },
          { url: 'https://www.instagram.com/webmonetization/' }
        ],
        buttonText: 'Visit Web Monetization',
        buttonLink: 'https://webmonetization.org',
        buttonExternal: true
      }
    ])
  })

  it('omits every absent optional field rather than storing undefined', async () => {
    const blocks = await parseMdxToBlocks(MINIMAL, ctx)

    expect(blocks).toEqual([
      {
        __component: 'blocks.internal-advert',
        helperText: 'Know more',
        logoLabel: 'Web Monetization',
        headline: 'A headline'
      }
    ])
  })

  it('records an omitted logoAlt as null, so the upload alt can win later', async () => {
    const mdx =
      '<InternalAdvert logo="/uploads/wm-logo.svg" logoLabel="WM" headline="A headline" helperText="Know more" />'

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      logo: { image: 7, alternativeText: null }
    })
  })

  it('keeps an explicit empty logoAlt as an empty string', async () => {
    const mdx =
      '<InternalAdvert logo="/uploads/wm-logo.svg" logoAlt="" logoLabel="WM" headline="A headline" helperText="Know more" />'

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).toMatchObject({
      logo: { image: 7, alternativeText: '' }
    })
  })

  it('drops a half-specified button, and its flags with it', async () => {
    const mdx =
      '<InternalAdvert helperText="Know more" logoLabel="WM" headline="A headline" buttonText="Visit" buttonExternal={true} />'

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks[0]).not.toHaveProperty('buttonText')
    expect(blocks[0]).not.toHaveProperty('buttonExternal')
  })

  it('rejects a card with neither headline nor body', async () => {
    const mdx =
      '<InternalAdvert helperText="Know more" logoLabel="WM" buttonText="Visit" buttonLink="/x" />'

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.INVALID_PROP_VALUE,
      prop: 'headline'
    })
  })

  it('rejects a card with fewer than three elements', async () => {
    const result = await parseMdxToBlocks(
      '<InternalAdvert headline="A headline" />',
      ctx
    )

    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      message: expect.stringContaining('at least 3 of its 6 elements')
    })
  })

  it('rejects a button that is both external and a document', async () => {
    const mdx =
      '<InternalAdvert helperText="Know more" logoLabel="WM" headline="A headline" buttonText="Visit" buttonLink="/x" buttonExternal={true} buttonDocument={true} />'

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      message: expect.stringContaining('cannot be both external and document')
    })
  })

  it('rejects a dynamic expression in a prop', async () => {
    const mdx =
      '<InternalAdvert helperText={someVar} logoLabel="WM" headline="A headline" />'

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({ code: ParserErrorCode.DYNAMIC_EXPRESSION })
  })

  it('rejects a dynamic expression in socialLinks', async () => {
    const mdx =
      '<InternalAdvert helperText="Know more" headline="A headline" socialLinks={myLinks} />'

    const result = await parseMdxToBlocks(mdx, ctx)
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.DYNAMIC_EXPRESSION,
      prop: 'socialLinks'
    })
  })

  it('fails when a logo is given but no media resolver is available', async () => {
    const mdx =
      '<InternalAdvert logo="/uploads/wm-logo.svg" logoLabel="WM" headline="A headline" helperText="Know more" />'

    const result = await parseMdxToBlocks(mdx, { locale: 'en' })
    expect(result).toBeInstanceOf(MdxParserError)
    expect(result).toMatchObject({
      code: ParserErrorCode.UNRESOLVED_RELATION
    })
  })

  it('preserves the order of surrounding markdown', async () => {
    const mdx = `Before the card.

${MINIMAL}

After the card.`

    const blocks = await parseMdxToBlocks(mdx, ctx)

    expect(blocks.map((block) => block.__component)).toEqual([
      'blocks.paragraph',
      'blocks.internal-advert',
      'blocks.paragraph'
    ])
  })
})
