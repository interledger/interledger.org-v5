import { describe, expect, it } from 'vitest'
import { serialize as serializeBlockquote } from './blockquote.serializer'
import { serialize as serializeCtaButtons } from './cta-buttons.serializer'
import { serialize as serializeImageBlock } from './image-block.serializer'
import { serialize as serializePdfEmbed } from './pdf-embed.serializer'
import { serialize as serializeQuote } from './quote.serializer'
import { serialize as serializeVideoEmbed } from './video-embed.serializer'

const intro = { heading: 'Heading', description: 'Text.' }
const INTRO_ATTR = 'intro={{"heading":"Heading","description":"Text."}}'

// Blocks that gained an intro with no legacy heading to fall back to.
const cases: Array<[string, (withIntro: boolean) => string]> = [
  [
    'ImageBlock',
    (withIntro) =>
      serializeImageBlock({
        ...(withIntro ? { intro } : {}),
        media: { image: { url: '/uploads/photo.jpg' }, alternativeText: 'A' }
      })
  ],
  [
    'VideoEmbed',
    (withIntro) =>
      serializeVideoEmbed({
        ...(withIntro ? { intro } : {}),
        externalUrl: 'https://youtu.be/x',
        title: 'Play the talk'
      })
  ],
  [
    'PdfEmbed',
    (withIntro) =>
      serializePdfEmbed({
        ...(withIntro ? { intro } : {}),
        externalUrl: 'https://example.com/a.pdf'
      })
  ],
  [
    'Quote',
    (withIntro) =>
      serializeQuote({ ...(withIntro ? { intro } : {}), quote: 'Words.' })
  ],
  [
    'Blockquote',
    (withIntro) =>
      serializeBlockquote({ ...(withIntro ? { intro } : {}), quote: 'Words.' })
  ],
  [
    'CtaButtons',
    (withIntro) =>
      serializeCtaButtons({
        ...(withIntro ? { intro } : {}),
        buttons: [{ text: 'Apply', link: '/apply', style: 'primary' }]
      })
  ]
]

describe('block intro on intro-only blocks', () => {
  it.each(cases)('%s writes the intro as its first attribute', (tag, run) => {
    expect(run(true)).toContain(`<${tag} ${INTRO_ATTR}`)
  })

  it.each(cases)('%s writes no intro when there is none', (_tag, run) => {
    expect(run(false)).not.toContain('intro=')
  })

  it('keeps the VideoEmbed title as the play label', () => {
    expect(cases[1][1](true)).toContain('title="Play the talk"')
  })
})
