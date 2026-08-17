import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'

// Side-effect import: registers HackathonAnimation handler
import './hackathonAnimationHandler'

const ctx: ParserContext = { locale: 'en' }

describe('HackathonAnimation handler', () => {
  it('parses the self-closing tag into a fieldless block', async () => {
    const blocks = await parseMdxToBlocks('<HackathonAnimation />', ctx)

    expect(blocks).toEqual([{ __component: 'blocks.hackathon-animation' }])
  })
})
