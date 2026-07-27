import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/info-card-grid.serializer'

// Side-effect import: registers InfoCards handler
import './infoCardsHandler'

describe('InfoCards round-trip (serialize → parse)', () => {
  it('round-trips a three-column grid', async () => {
    const original = {
      columns: 'Three' as const,
      cards: [
        { heading: 'Why apply', body: '- Point 1\n- Point 2' },
        { heading: 'Eligibility', body: 'Open worldwide.' },
        { heading: 'Timeline', body: '12 months.' }
      ]
    }

    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, { locale: 'en' })

    expect(blocks).toEqual([{ __component: 'blocks.info-card-grid', ...original }])
  })

  it('round-trips a two-column grid', async () => {
    const original = {
      columns: 'Two' as const,
      cards: [
        { heading: 'A', body: 'Alpha' },
        { heading: 'B', body: 'Beta' }
      ]
    }

    const mdx = serialize(original)
    const blocks = await parseMdxToBlocks(mdx, { locale: 'en' })

    expect(blocks).toEqual([{ __component: 'blocks.info-card-grid', ...original }])
  })
})
