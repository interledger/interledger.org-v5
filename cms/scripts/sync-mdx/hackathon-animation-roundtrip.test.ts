import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/hackathon-animation.serializer'

// Side-effect import: registers HackathonAnimation handler
import './hackathonAnimationHandler'

const ctx: ParserContext = { locale: 'en' }

describe('HackathonAnimation round-trip (serialize → parse)', () => {
  it('round-trips the fieldless block', async () => {
    const blocks = await parseMdxToBlocks(serialize(), ctx)

    expect(blocks).toEqual([{ __component: 'blocks.hackathon-animation' }])
  })
})
