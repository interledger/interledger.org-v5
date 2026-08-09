import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers the CtaButtons handler
import './ctaButtonsHandler'

const ctx: ParserContext = { locale: 'en' }

const cta = (buttons: string) => `<CtaButtons buttons={${buttons}} />`

// The parser returns errors as values rather than throwing (see CLAUDE.md,
// "Errors as Values"), so assert on the resolved value.
const expectError = async (mdx: string, code: ParserErrorCode) => {
  const result = await parseMdxToBlocks(mdx, ctx)
  expect(result).toBeInstanceOf(MdxParserError)
  expect(result).toMatchObject({ code })
}

describe('CtaButtons handler', () => {
  it('parses a single button', async () => {
    const blocks = await parseMdxToBlocks(
      cta(`[{ text: 'Apply now', link: '/grants/apply', style: 'primary' }]`),
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.cta-buttons',
        buttons: [
          { text: 'Apply now', link: '/grants/apply', style: 'primary' }
        ]
      }
    ])
  })

  it('parses two buttons, preserving order', async () => {
    const blocks = await parseMdxToBlocks(
      cta(
        `[{ text: 'Apply', link: '/a', style: 'primary' }, { text: 'FAQ', link: '/b', style: 'secondary' }]`
      ),
      ctx
    )

    expect(
      (blocks[0] as { buttons: Array<{ text: string }> }).buttons.map(
        (b) => b.text
      )
    ).toEqual(['Apply', 'FAQ'])
  })

  it('accepts two secondaries', async () => {
    const blocks = await parseMdxToBlocks(
      cta(
        `[{ text: 'A', link: '/a', style: 'secondary' }, { text: 'B', link: '/b', style: 'secondary' }]`
      ),
      ctx
    )

    expect(blocks).toHaveLength(1)
  })

  it('defaults a missing style to primary, matching the Strapi schema', async () => {
    const blocks = await parseMdxToBlocks(
      cta(`[{ text: 'Apply', link: '/a' }]`),
      ctx
    )

    expect(blocks[0]).toMatchObject({
      buttons: [{ text: 'Apply', link: '/a', style: 'primary' }]
    })
  })

  describe('optional flags', () => {
    it('carries external when true', async () => {
      const blocks = await parseMdxToBlocks(
        cta(
          `[{ text: 'Visit', link: 'https://example.com', style: 'secondary', external: true }]`
        ),
        ctx
      )

      expect(blocks[0]).toMatchObject({ buttons: [{ external: true }] })
    })

    it('carries document when true', async () => {
      const blocks = await parseMdxToBlocks(
        cta(
          `[{ text: 'Pack', link: '/p.pdf', style: 'secondary', document: true }]`
        ),
        ctx
      )

      expect(blocks[0]).toMatchObject({ buttons: [{ document: true }] })
    })

    it('rejects external and document on the same button', async () => {
      await expectError(
        cta(
          `[{ text: 'Pack', link: '/p.pdf', style: 'secondary', external: true, document: true }]`
        ),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('omits them when absent', async () => {
      const blocks = await parseMdxToBlocks(
        cta(`[{ text: 'A', link: '/a' }]`),
        ctx
      )
      const button = (blocks[0] as { buttons: object[] }).buttons[0]

      expect(button).not.toHaveProperty('external')
      expect(button).not.toHaveProperty('document')
    })

    it('omits them when explicitly false, so the round-trip stays clean', async () => {
      const blocks = await parseMdxToBlocks(
        cta(`[{ text: 'A', link: '/a', external: false, document: false }]`),
        ctx
      )
      const button = (blocks[0] as { buttons: object[] }).buttons[0]

      expect(button).not.toHaveProperty('external')
      expect(button).not.toHaveProperty('document')
    })
  })

  describe('composition rules', () => {
    it('rejects two primaries', async () => {
      await expectError(
        cta(
          `[{ text: 'A', link: '/a', style: 'primary' }, { text: 'B', link: '/b', style: 'primary' }]`
        ),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('rejects a primary in second position', async () => {
      await expectError(
        cta(
          `[{ text: 'A', link: '/a', style: 'secondary' }, { text: 'B', link: '/b', style: 'primary' }]`
        ),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('rejects three buttons', async () => {
      await expectError(
        cta(
          `[{ text: 'A', link: '/a', style: 'primary' }, { text: 'B', link: '/b', style: 'secondary' }, { text: 'C', link: '/c', style: 'secondary' }]`
        ),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('rejects an empty array', async () => {
      await expectError(cta(`[]`), ParserErrorCode.INVALID_PROP_VALUE)
    })
  })

  describe('invalid input', () => {
    it('rejects a missing buttons prop', async () => {
      await expectError('<CtaButtons />', ParserErrorCode.MISSING_REQUIRED_PROP)
    })

    it('rejects a button with no text', async () => {
      await expectError(
        cta(`[{ link: '/a', style: 'primary' }]`),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('rejects a button with no link', async () => {
      await expectError(
        cta(`[{ text: 'A', style: 'primary' }]`),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('rejects a blank text', async () => {
      await expectError(
        cta(`[{ text: '   ', link: '/a' }]`),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('rejects an unknown style', async () => {
      await expectError(
        cta(`[{ text: 'A', link: '/a', style: 'tertiary' }]`),
        ParserErrorCode.INVALID_PROP_VALUE
      )
    })

    it('rejects a dynamic expression', async () => {
      await expectError(
        '<CtaButtons buttons={someVariable} />',
        ParserErrorCode.DYNAMIC_EXPRESSION
      )
    })
  })

  it('preserves order relative to surrounding markdown', async () => {
    const blocks = await parseMdxToBlocks(
      [
        'Intro paragraph.',
        '',
        cta(`[{ text: 'A', link: '/a' }]`),
        '',
        'Outro.'
      ].join('\n'),
      ctx
    )

    expect(blocks.map((b) => b.__component)).toEqual([
      'blocks.paragraph',
      'blocks.cta-buttons',
      'blocks.paragraph'
    ])
  })
})
