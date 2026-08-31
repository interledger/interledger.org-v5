import { describe, it, expect } from 'vitest'
import { serialize } from './report-section.serializer'
import { SerializerFieldError } from '@/utils'

const validParagraph = {
  textType: 'Paragraph',
  textContent: 'The full report body.'
}
const validDisclaimer = {
  textType: 'Disclaimer',
  textDisclaimer: 'For informational purposes only.'
}
const validReferences = {
  textType: 'References',
  textContent: '- First source.\n- Second source.'
}
const validButton = {
  textType: 'Button',
  buttonCta: { text: 'Download the report', link: '/reports/full.pdf' }
}

describe('report-section serializer', () => {
  it('serializes a block with a heading and a single paragraph content block', () => {
    const result = serialize({
      heading: 'Introduction',
      reportText: [validParagraph]
    })

    expect(result).toContain('<ReportSection>')
    expect(result).toContain('## Introduction')
    expect(result).toContain('<ReportText type="Paragraph">')
    expect(result).toContain('The full report body.')
    expect(result).toContain('</ReportText>')
    expect(result).toContain('</ReportSection>')
  })

  it('serializes a disclaimer content block', () => {
    const result = serialize({
      heading: 'Notes',
      reportText: [validDisclaimer]
    })

    expect(result).toContain('<ReportText type="Disclaimer">')
    expect(result).toContain('For informational purposes only.')
  })

  it('serializes a references content block using textContent, not textDisclaimer', () => {
    const result = serialize({
      heading: 'References',
      reportText: [validReferences]
    })

    expect(result).toContain('<ReportText type="References">')
    expect(result).toContain('- First source.')
  })

  it('serializes a button content block as a self-closing tag with attributes', () => {
    const result = serialize({
      heading: 'Downloads',
      reportText: [validButton]
    })

    expect(result).toContain(
      '<ReportText type="Button" buttonText="Download the report" buttonLink="/reports/full.pdf" />'
    )
  })

  it('serializes a button with a non-default style and document flag', () => {
    const result = serialize({
      heading: 'Downloads',
      reportText: [
        {
          textType: 'Button',
          buttonCta: {
            text: 'Read more',
            link: 'https://example.com',
            style: 'secondary',
            document: true
          }
        }
      ]
    })

    expect(result).toContain('buttonStyle="secondary"')
    expect(result).toContain('buttonDocument={true}')
    expect(result).not.toContain('buttonExternal')
  })

  it('serializes an explicit external:true flag', () => {
    const result = serialize({
      heading: 'Downloads',
      reportText: [
        {
          textType: 'Button',
          buttonCta: {
            text: 'Read more',
            link: 'https://example.com',
            external: true
          }
        }
      ]
    })

    expect(result).toContain('buttonExternal={true}')
  })

  it('serializes an explicit external:false flag rather than omitting it', () => {
    // external:false is not the same as absent: resolveCtaLink only infers
    // external from the URL when the flag is undefined, so dropping an
    // explicit false here would flip an absolute-URL button that an editor
    // deliberately kept same-tab back to opening in a new tab.
    const result = serialize({
      heading: 'Downloads',
      reportText: [
        {
          textType: 'Button',
          buttonCta: {
            text: 'Read more',
            link: 'https://example.com',
            external: false
          }
        }
      ]
    })

    expect(result).toContain('buttonExternal={false}')
  })

  it('throws when a Button block is missing text or link', () => {
    expect(() =>
      serialize({
        heading: 'Downloads',
        reportText: [{ textType: 'Button', buttonCta: { text: '', link: '' } }]
      })
    ).toThrow(SerializerFieldError)
  })

  it('throws when a Button block has conflicting external and document flags', () => {
    expect(() =>
      serialize({
        heading: 'Downloads',
        reportText: [
          {
            textType: 'Button',
            buttonCta: {
              text: 'Read more',
              link: 'https://example.com',
              external: true,
              document: true
            }
          }
        ]
      })
    ).toThrow(SerializerFieldError)
  })

  it('throws when a References block is missing textContent', () => {
    expect(() =>
      serialize({
        heading: 'References',
        reportText: [{ textType: 'References', textContent: '  ' }]
      })
    ).toThrow(SerializerFieldError)
  })

  it('serializes multiple content blocks in order', () => {
    const result = serialize({
      heading: 'Overview',
      reportText: [
        { ...validParagraph, textContent: 'First' },
        { ...validDisclaimer, textDisclaimer: 'Second' }
      ]
    })

    expect(result.indexOf('First')).toBeLessThan(result.indexOf('Second'))
  })

  it('emits the heading as a markdown h2, HTML-entity-escaped', () => {
    const result = serialize({
      heading: 'Q&A "Overview" <2026>',
      reportText: [validParagraph]
    })

    expect(result).toContain('## Q&amp;A &quot;Overview&quot; &lt;2026&gt;')
  })

  it('escapes MDX braces in the content', () => {
    const result = serialize({
      heading: 'Overview',
      reportText: [{ ...validParagraph, textContent: 'Use {tokens} wisely.' }]
    })

    expect(result).toContain('\\{tokens\\}')
  })

  it('converts HTML content to markdown', () => {
    const result = serialize({
      heading: 'Overview',
      reportText: [
        {
          ...validParagraph,
          textContent: '<p>Hello <strong>world</strong></p>'
        }
      ]
    })

    expect(result).toContain('**world**')
    expect(result).not.toContain('<strong>')
  })

  it('throws when the heading is missing', () => {
    expect(() => serialize({ reportText: [validParagraph] })).toThrow(
      SerializerFieldError
    )
  })

  it('throws when reportText is missing or empty', () => {
    expect(() => serialize({ heading: 'Overview' })).toThrow(
      SerializerFieldError
    )
    expect(() => serialize({ heading: 'Overview', reportText: [] })).toThrow(
      SerializerFieldError
    )
  })

  it('throws when a content block has an invalid textType', () => {
    expect(() =>
      serialize({
        heading: 'Overview',
        reportText: [{ textType: 'Quote', textContent: 'x' }]
      })
    ).toThrow(SerializerFieldError)
  })

  it('throws when a Paragraph block is missing textContent', () => {
    expect(() =>
      serialize({
        heading: 'Overview',
        reportText: [{ textType: 'Paragraph', textContent: '  ' }]
      })
    ).toThrow(SerializerFieldError)
  })

  it('throws when a Disclaimer block is missing textDisclaimer', () => {
    expect(() =>
      serialize({
        heading: 'Overview',
        reportText: [{ textType: 'Disclaimer' }]
      })
    ).toThrow(SerializerFieldError)
  })

  it('reports every missing field across every content block at once', () => {
    let caught: SerializerFieldError | undefined
    try {
      serialize({
        reportText: [
          { textType: 'Paragraph', textContent: '' },
          { textType: 'Disclaimer', textDisclaimer: '  ' }
        ]
      })
    } catch (error) {
      caught = error as SerializerFieldError
    }

    expect(caught).toBeInstanceOf(SerializerFieldError)
    expect(caught?.fieldErrors).toEqual([
      expect.objectContaining({ path: ['heading'] }),
      expect.objectContaining({ path: ['reportText', 0, 'textContent'] }),
      expect.objectContaining({ path: ['reportText', 1, 'textDisclaimer'] })
    ])
  })
})
