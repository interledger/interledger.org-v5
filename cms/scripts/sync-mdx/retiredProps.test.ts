import { describe, expect, it } from 'vitest'
import './faqHandler'
import './splitLayoutHandler'
import { parseMdxToBlocks } from './mdxBlockParser'
import { ParserErrorCode } from './parserErrors'

const ctx = { locale: 'en' }
const FAQ_ITEM = '<FaqItem question="Q">A</FaqItem>'

describe('retired block props', () => {
  it('fails the sync on a legacy block heading', async () => {
    const result = await parseMdxToBlocks(
      `<Faq heading="About">\n  ${FAQ_ITEM}\n</Faq>`,
      ctx
    )
    expect(result).toMatchObject({
      code: ParserErrorCode.UNEXPECTED_PROP,
      component: 'Faq',
      prop: 'heading',
      line: 1
    })
    expect((result as Error).message).toContain('intro={{"heading":"…"}}')
  })

  it('fails on a legacy heading written inline', async () => {
    const result = await parseMdxToBlocks(
      `<Faq heading="About">${FAQ_ITEM}</Faq>`,
      ctx
    )
    expect(result).toMatchObject({ prop: 'heading' })
  })

  it('fails on a legacy heading even beside an intro', async () => {
    const result = await parseMdxToBlocks(
      `<Faq intro={{"heading":"About"}} heading="Old">\n  ${FAQ_ITEM}\n</Faq>`,
      ctx
    )
    expect(result).toMatchObject({ prop: 'heading' })
  })

  it('fails on a legacy split layout cta', async () => {
    const result = await parseMdxToBlocks(
      '<SplitLayout imageSrc="/img/a.png" ctaText="Go">\n\nBody\n\n</SplitLayout>',
      ctx
    )
    expect(result).toMatchObject({
      code: ParserErrorCode.UNEXPECTED_PROP,
      component: 'SplitLayout',
      prop: 'ctaText'
    })
    expect((result as Error).message).toContain('buttons={[')
  })

  it('accepts a block without retired props', async () => {
    const result = await parseMdxToBlocks(
      `<Faq intro={{"heading":"About"}}>\n  ${FAQ_ITEM}\n</Faq>`,
      ctx
    )
    expect(result).toEqual([
      expect.objectContaining({ __component: 'blocks.faq' })
    ])
  })
})
