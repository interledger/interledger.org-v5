import { describe, it, expect } from 'vitest'
import { serialize } from './pdf-embed.serializer'

describe('pdf-embed serializer', () => {
  it('uses file.url when file is set', () => {
    const result = serialize({
      file: { url: '/uploads/report.pdf' },
      analyticsEvent: 'report download'
    })

    expect(result).toContain('url="/uploads/report.pdf"')
    expect(result).toContain('analyticsEvent="report download"')
  })

  it('uses externalUrl when file is absent', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf',
      analyticsEvent: 'doc download'
    })

    expect(result).toContain('url="https://example.com/doc.pdf"')
  })

  it('file takes precedence over externalUrl when both are set', () => {
    const result = serialize({
      file: { url: '/uploads/local.pdf' },
      externalUrl: 'https://example.com/external.pdf',
      analyticsEvent: 'download'
    })

    expect(result).toContain('url="/uploads/local.pdf"')
    expect(result).not.toContain('https://example.com/external.pdf')
  })

  it('includes label when present', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf',
      label: 'Download Policy',
      analyticsEvent: 'policy'
    })

    expect(result).toContain('label="Download Policy"')
  })

  it('includes analyticsEvent when present', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf',
      analyticsEvent: '2024 SI report - Summit report'
    })

    expect(result).toContain('analyticsEvent="2024 SI report - Summit report"')
  })

  it('omits label when absent', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf',
      analyticsEvent: 'download'
    })

    expect(result).not.toContain('label=')
  })

  it('always emits analyticsEvent', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf',
      analyticsEvent: 'download'
    })

    expect(result).toContain('analyticsEvent="download"')
  })

  it('throws when neither file nor externalUrl is set', () => {
    expect(() => serialize({ analyticsEvent: 'download' })).toThrow(
      'PdfEmbed block has neither file nor externalUrl'
    )
  })

  it('produces a self-closing PdfEmbed tag', () => {
    const result = serialize({
      externalUrl: 'https://example.com/doc.pdf',
      analyticsEvent: 'download'
    })

    expect(result).toMatch(/^<PdfEmbed .* \/>$/)
  })
})
