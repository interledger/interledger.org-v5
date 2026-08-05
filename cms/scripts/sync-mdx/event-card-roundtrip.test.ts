import { describe, it, expect } from 'vitest'
import { parseMdxToBlocks, type ParserContext } from './mdxBlockParser'
import { serialize } from '../../src/serializers/blocks/event-card.serializer'

// Side-effect import: registers EventCard handler
import './eventCardHandler'

const enCtx: ParserContext = { locale: 'en' }
const esCtx: ParserContext = { locale: 'es' }

describe('EventCard round-trip (serialize → parse)', () => {
  it('round-trips a full three-column card (en)', async () => {
    const original = {
      when: {
        title: 'When?',
        date: 'November 8–9, 2025',
        time: '24h',
        text: 'Doors open at 8:00 am.'
      },
      where: {
        title: 'Where?',
        location: 'Mexico City',
        text: 'Main auditorium.'
      },
      apply: {
        title: 'Apply',
        primaryCta: {
          text: 'Apply today',
          link: '/grants/apply',
          external: false
        }
      }
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.event-card', ...original }])
  })

  it('round-trips a two-column card without Apply (es)', async () => {
    const original = {
      when: { title: '¿Cuándo?', date: '8–9 de noviembre de 2025' },
      where: { title: '¿Dónde?', location: 'Ciudad de México' }
    }

    const blocks = await parseMdxToBlocks(serialize(original), esCtx)

    expect(blocks).toEqual([{ __component: 'blocks.event-card', ...original }])
    expect(blocks[0]).not.toHaveProperty('apply')
  })

  it('round-trips an external Apply CTA', async () => {
    const original = {
      when: { title: 'When?' },
      where: { title: 'Where?' },
      apply: {
        title: 'Register',
        primaryCta: {
          text: 'Register',
          link: 'https://example.com/register',
          external: true
        }
      }
    }

    const blocks = await parseMdxToBlocks(serialize(original), enCtx)

    expect(blocks).toEqual([{ __component: 'blocks.event-card', ...original }])
  })
})
