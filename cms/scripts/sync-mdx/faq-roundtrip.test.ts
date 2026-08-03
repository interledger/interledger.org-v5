import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/faq.serializer'

// Side-effect import: registers Faq handler
import './faqHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('Faq round-trip (serialize → parse)', () => {
  it('round-trips a block with a heading and one question (en)', async () => {
    const original = {
      heading: 'About the Interledger Foundation',
      items: [
        {
          question: 'What is the Interledger Foundation?',
          answer: 'A private operating foundation.'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.faq', ...original }])
  })

  it('round-trips a block with a heading and one question (es)', async () => {
    const original = {
      heading: 'Sobre la Fundación Interledger',
      items: [
        {
          question: '¿Qué es la Fundación Interledger?',
          answer: 'Una fundación operativa privada.'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([{ __component: 'blocks.faq', ...original }])
  })

  it('round-trips a block with no heading', async () => {
    const original = {
      items: [{ question: 'Do I need a team?', answer: 'No.' }]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.faq', ...original }])
    expect(blocks[0]).not.toHaveProperty('heading')
  })

  it('round-trips multiple questions, preserving order', async () => {
    const original = {
      heading: 'Attending',
      items: [
        { question: 'Who should attend?', answer: 'Anyone building payments.' },
        { question: 'Are stipends available?', answer: 'A limited number.' },
        { question: 'Is it recorded?', answer: 'Yes.' }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.faq', ...original }])
  })

  it('preserves brace-escaped content through a round-trip', async () => {
    const original = {
      items: [{ question: 'Templating?', answer: 'Use {tokens} wisely.' }]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)
    const [first] = (blocks[0] as { items: Array<{ answer: string }> }).items

    expect(first.answer).toContain('{tokens}')
  })

  it('round-trips attribute values with quotes, ampersands and angle brackets', async () => {
    const original = {
      heading: 'A & B',
      items: [
        {
          question: 'Is it "free" & <open>?',
          answer: 'Yes.'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.faq', ...original }])
  })

  it('round-trips a markdown link in the answer', async () => {
    const original = {
      items: [
        {
          question: 'Where do I apply?',
          answer: 'See the [grant overview](/grant).'
        }
      ]
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.faq', ...original }])
  })
})
