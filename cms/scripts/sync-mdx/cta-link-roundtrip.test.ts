import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/cta-link.serializer'

// Side-effect import: registers CtaLink handler
import './ctaLinkHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('CtaLink round-trip (serialize → parse)', () => {
  it('round-trips a plain internal link', async () => {
    const original = { text: 'Apply now', link: '/grants/apply' }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'shared.cta-link', ...original }])
  })

  it('round-trips an external link', async () => {
    const original = {
      text: 'Read the standard',
      link: 'https://example.com/spec',
      external: true
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'shared.cta-link', ...original }])
  })

  it('round-trips a document link', async () => {
    const original = {
      text: 'Read the report',
      link: '/docs/report.pdf',
      document: true
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'shared.cta-link', ...original }])
  })

  it('round-trips a secondary document link', async () => {
    const original = {
      text: 'Download the pack',
      link: '/docs/pack.zip',
      style: 'secondary',
      document: true
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'shared.cta-link', ...original }])
  })

  it('round-trips a document link (es)', async () => {
    const original = {
      text: 'Descarga el informe',
      link: '/es/docs/informe.pdf',
      document: true
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([{ __component: 'shared.cta-link', ...original }])
  })
})
