import { describe, expect, it } from 'vitest'
import {
  migrateBlockIntro,
  type BlockIntroMigration
} from './migrateBlockIntro'

function migrate(source: string, fold = false): BlockIntroMigration {
  const result = migrateBlockIntro(source, { fold })
  if (result instanceof Error) throw result
  return result
}

const cards = '<InfoCard heading="Card">Body</InfoCard>'

describe('migrateBlockIntro: legacy headings', () => {
  it('moves a CardGrid title into the intro', () => {
    const source = `<CardGrid title="Upcoming" ariaLabel="Events" variant="Info" columns="Three">\n${cards}\n</CardGrid>\n`
    expect(migrate(source).source).toBe(
      `<CardGrid intro={{"heading":"Upcoming"}} ariaLabel="Events" variant="Info" columns="Three">\n${cards}\n</CardGrid>\n`
    )
  })

  it('moves a Faq heading and a multi-line NumberTiles title', () => {
    const faq = migrate(
      '<Faq heading="FAQs">\n\n<FaqItem question="Q?">\n\nA.\n\n</FaqItem>\n\n</Faq>\n'
    )
    expect(faq.source).toContain('<Faq intro={{"heading":"FAQs"}}>')

    const tiles = migrate(
      '<NumberTiles\n  title="Overview"\n  tiles={[\n    { number: "1", description: "A" },\n    { number: "2", description: "B" }\n  ]}\n/>\n'
    )
    expect(tiles.source).toContain('  intro={{"heading":"Overview"}}\n  tiles=')
  })

  it('decodes entities and keeps quotes and ampersands', () => {
    const source = `<CardGrid title="Say &quot;hi&quot; &amp;amp; Q & A" ariaLabel="x" variant="Info" columns="One">\n${cards}\n</CardGrid>\n`
    expect(migrate(source).source).toContain(
      'intro={{"heading":"Say \\"hi\\" &amp; Q & A"}}'
    )
  })

  it('drops a blank legacy title', () => {
    const source = `<CardGrid title="  " ariaLabel="x" variant="Info" columns="One">\n${cards}\n</CardGrid>\n`
    const result = migrate(source).source
    expect(result).not.toMatch(/title=|intro=/)
  })

  it('leaves a block that already has an intro alone', () => {
    const source = `<CardGrid intro={{"heading":"New"}} title="Old" ariaLabel="x" variant="Info" columns="One">\n${cards}\n</CardGrid>\n`
    expect(migrate(source).source).toBeNull()
  })

  it('ignores frontmatter that is not valid MDX', () => {
    const source = `---\ntitle: 'Join <apply_now>'\n---\n\n<Faq heading="FAQs">\n\n<FaqItem question="Q?">\n\nA.\n\n</FaqItem>\n\n</Faq>\n`
    expect(migrate(source).source).toBe(
      source.replace('heading="FAQs"', 'intro={{"heading":"FAQs"}}')
    )
  })

  it('returns null when nothing changes', () => {
    expect(migrate('# Title\n\nJust text.\n').source).toBeNull()
  })

  it('returns an error for MDX that does not parse', () => {
    expect(migrateBlockIntro('<CardGrid title="x">\n')).toBeInstanceOf(Error)
  })
})

describe('migrateBlockIntro: phase 2a blocks', () => {
  it('moves EventCard, LogoCarousel and ProfileGrid headings', () => {
    const source = [
      '<EventCard title="Upcoming">',
      '<EventWhen title="When?" date="Nov 8" />',
      '<EventWhere title="Where?" location="Online" />',
      '</EventCard>',
      '',
      '<LogoCarousel heading="Partners" accessibilityLabel="Logos" logos={[]} />',
      '',
      '<ProfileGrid heading="Judges" category="Judges" />',
      ''
    ].join('\n')
    const result = migrate(source).source
    expect(result).toContain('<EventCard intro={{"heading":"Upcoming"}}>')
    // Column titles are not block headings.
    expect(result).toContain('<EventWhen title="When?"')
    expect(result).toContain('<LogoCarousel intro={{"heading":"Partners"}}')
    expect(result).toContain('<ProfileGrid intro={{"heading":"Judges"}}')
  })
})

describe('migrateBlockIntro: fake intros', () => {
  const fakeIntro = (
    body: string,
    block = 'CardGrid ariaLabel="x" variant="Info" columns="One"'
  ) =>
    `Intro text.\n\n<Paragraph>\n\n${body}\n\n</Paragraph>\n\n<${block}>\n${cards}\n</CardGrid>\n`

  it('only reports a foldable fake intro without fold', () => {
    const result = migrate(fakeIntro('## Upcoming'))
    expect(result.source).toBeNull()
    expect(result.skipped).toEqual([
      { line: 3, block: 'CardGrid', reason: 'foldable; run with --fold' }
    ])
  })

  it('folds a heading into the intro', () => {
    const result = migrate(fakeIntro('## Upcoming'), true)
    expect(result.source).toBe(
      `Intro text.\n\n<CardGrid intro={{"heading":"Upcoming"}} ariaLabel="x" variant="Info" columns="One">\n${cards}\n</CardGrid>\n`
    )
    expect(result.folded).toEqual([
      { line: 3, block: 'CardGrid', reason: 'folded' }
    ])
  })

  it('folds an h3 as the subheading and keeps description markdown', () => {
    const result = migrate(
      fakeIntro(
        '### Around the world\n\nThe **numbers** show it. See [more](/more/).\n\nSecond line.'
      ),
      true
    )
    expect(result.source).toContain(
      'intro={{"subheading":"Around the world","description":"The **numbers** show it. See [more](/more/).\\n\\nSecond line."}}'
    )
  })

  it.each([
    [
      'content before the heading',
      'Some text.\n\n## Upcoming',
      'content comes before the heading'
    ],
    [
      'a formatted heading',
      '## Upcoming **now**',
      'the heading has formatting or links'
    ],
    [
      'a list in the description',
      '## Upcoming\n\n- one\n- two',
      'the description has a list'
    ]
  ])('leaves a fake intro with %s alone', (_label, body, reason) => {
    const source = fakeIntro(body)
    const result = migrate(source, true)
    expect(result.skipped).toEqual([{ line: 3, block: 'CardGrid', reason }])
    expect(result.source).toBeNull()
  })

  it('does not treat a Paragraph with only an h4 as a fake intro', () => {
    const result = migrate(fakeIntro('#### Upcoming'), true)
    expect(result.skipped).toEqual([])
    expect(result.source).toBeNull()
  })

  it('reports a fake intro before a block that has its own heading', () => {
    const result = migrate(
      fakeIntro(
        '## Upcoming',
        'CardGrid title="October" ariaLabel="x" variant="Info" columns="One"'
      ),
      true
    )
    expect(result.skipped).toEqual([
      { line: 3, block: 'CardGrid', reason: 'the block already has a heading' }
    ])
    // The legacy title still moves into the intro.
    expect(result.source).toContain('intro={{"heading":"October"}}')
    expect(result.source).toContain('<Paragraph>')
  })

  it('ignores a Paragraph that is not directly before a block', () => {
    const source = `<Paragraph>\n\n## Upcoming\n\n</Paragraph>\n\nText between.\n\n<CardGrid ariaLabel="x" variant="Info" columns="One">\n${cards}\n</CardGrid>\n`
    const result = migrate(source, true)
    expect(result.skipped).toEqual([])
    expect(result.source).toBeNull()
  })
})
