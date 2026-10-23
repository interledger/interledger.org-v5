import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { MdxParserError, ParserErrorCode } from './parserErrors'

// Side-effect import: registers Faq handler
import './faqHandler'

const ctx: ParserContext = { locale: 'en' }

const item = (question: string, answer = 'An answer.') =>
  [`<FaqItem question="${question}">`, answer, '</FaqItem>'].join('\n')

const faq = (items: string[], attrs = '') =>
  [`<Faq${attrs}>`, ...items, '</Faq>'].join('\n')

describe('Faq handler', () => {
  it('parses an intro', async () => {
    const blocks = await parseMdxToBlocks(
      faq(
        [item('What is it?')],
        ' intro={{"heading":"About us","description":"The basics."}}'
      ),
      ctx
    )

    expect(blocks[0]).toMatchObject({
      intro: { heading: 'About us', description: 'The basics.' }
    })
  })

  it('reads a legacy heading as the intro heading', async () => {
    const blocks = await parseMdxToBlocks(
      faq([item('What is it?')], ' heading="About us"'),
      ctx
    )

    expect(blocks).toEqual([
      {
        __component: 'blocks.faq',
        intro: { heading: 'About us' },
        items: [{ question: 'What is it?', answer: 'An answer.' }]
      }
    ])
  })

  it('omits the intro when there is none', async () => {
    const blocks = await parseMdxToBlocks(faq([item('What is it?')]), ctx)

    expect(blocks[0]).not.toHaveProperty('intro')
    expect(blocks[0]).not.toHaveProperty('heading')
    expect(blocks[0]).toMatchObject({
      __component: 'blocks.faq',
      items: [{ question: 'What is it?', answer: 'An answer.' }]
    })
  })

  it('parses multiple questions, preserving order', async () => {
    const blocks = await parseMdxToBlocks(
      faq([item('First'), item('Second'), item('Third')]),
      ctx
    )

    expect(
      (blocks[0] as { items: Array<{ question: string }> }).items.map(
        (i) => i.question
      )
    ).toEqual(['First', 'Second', 'Third'])
  })

  it('keeps a multi-paragraph answer as markdown', async () => {
    const mdx = faq([
      [
        '<FaqItem question="What is it?">',
        'First paragraph.',
        '',
        'Second paragraph.',
        '</FaqItem>'
      ].join('\n')
    ])

    const blocks = await parseMdxToBlocks(mdx, ctx)
    const [first] = (blocks[0] as { items: Array<{ answer: string }> }).items

    expect(first.answer).toContain('First paragraph.')
    expect(first.answer).toContain('Second paragraph.')
  })

  it('keeps markdown links in the answer', async () => {
    const blocks = await parseMdxToBlocks(
      faq([item('Where?', 'See the [grant overview](/grant).')]),
      ctx
    )
    const [first] = (blocks[0] as { items: Array<{ answer: string }> }).items

    expect(first.answer).toContain('[grant overview](/grant)')
  })

  it('errors when the block has no FaqItem children', async () => {
    const result = await parseMdxToBlocks('<Faq heading="About us" />', ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('errors when an FaqItem is missing its question', async () => {
    const mdx = faq(['<FaqItem>\nAn answer.\n</FaqItem>'])

    const result = await parseMdxToBlocks(mdx, ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.MISSING_REQUIRED_PROP
    )
  })

  it('errors when an FaqItem has no answer content', async () => {
    const mdx = faq(['<FaqItem question="What is it?"></FaqItem>'])

    const result = await parseMdxToBlocks(mdx, ctx)

    expect(result).toBeInstanceOf(MdxParserError)
    expect((result as MdxParserError).code).toBe(
      ParserErrorCode.INVALID_PROP_VALUE
    )
  })
})
