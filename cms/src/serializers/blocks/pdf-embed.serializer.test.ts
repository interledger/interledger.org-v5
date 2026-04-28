import { describe, it, expect } from 'vitest'
import { serialize } from './pdf-embed.serializer'

describe('pdf-embed serializer', () => {
  it('uses file.url when file is set', () => {
    const result = serialize({
      file: { url: '/uploads/report.pdf' }
    })

    expect(result).toContain('url="/uploads/report.pdf"')
  })

  it('uses externalUrl when file is absent', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf'
    })

    expect(result).toContain('url="https://example.com/doc.pdf"')
  })

  it('file takes precedence over externalUrl when both are set', () => {
    const result = serialize({
      file: { url: '/uploads/local.pdf' },
      externalUrl: 'https://example.com/external.pdf'
    })

    expect(result).toContain('url="/uploads/local.pdf"')
    expect(result).not.toContain('https://example.com/external.pdf')
  })

  it('includes label when present', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf',
      label: 'Download Policy'
    })

    expect(result).toContain('label="Download Policy"')
  })

  it('omits label when absent', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf'
    })

    expect(result).not.toContain('label=')
  })

  it('throws when neither file nor externalUrl is set', () => {
    expect(() => serialize({})).toThrow(
      'PdfEmbed block has neither file nor externalUrl'
    )
  })

  it('produces a self-closing PdfEmbed tag', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf'
    })

    expect(result).toMatch(/^<PdfEmbed .* \/>$/)
  })
})
