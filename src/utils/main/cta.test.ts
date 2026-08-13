import { describe, it, expect } from 'vitest'
import { resolveCtaLink } from './cta'

describe('resolveCtaLink', () => {
  describe('href', () => {
    it('adds a leading slash to a bare site path', () => {
      expect(resolveCtaLink({ url: 'grants/apply' }).href).toBe('/grants/apply')
    })

    it('leaves an existing leading slash alone', () => {
      expect(resolveCtaLink({ url: '/grants/apply' }).href).toBe(
        '/grants/apply'
      )
    })

    it('leaves an absolute URL alone', () => {
      expect(resolveCtaLink({ url: 'https://example.com/x' }).href).toBe(
        'https://example.com/x'
      )
    })

    it('leaves a mailto link alone rather than making it /mailto:', () => {
      expect(resolveCtaLink({ url: 'mailto:hi@example.com' }).href).toBe(
        'mailto:hi@example.com'
      )
    })

    it('leaves a protocol-relative URL alone', () => {
      expect(resolveCtaLink({ url: '//cdn.example.com/x.pdf' }).href).toBe(
        '//cdn.example.com/x.pdf'
      )
    })
  })

  describe('external', () => {
    it('is false for a site path', () => {
      expect(resolveCtaLink({ url: '/about' }).external).toBe(false)
    })

    it('is true for an absolute http(s) URL even without the flag', () => {
      expect(resolveCtaLink({ url: 'https://example.com' }).external).toBe(true)
    })

    it('honours the flag on a site path', () => {
      expect(resolveCtaLink({ url: '/about', external: true }).external).toBe(
        true
      )
    })

    it('still resolves the href for a flagged site path', () => {
      expect(resolveCtaLink({ url: 'about', external: true }).href).toBe(
        '/about'
      )
    })
  })

  describe('targetAttrs', () => {
    it('opens external links in a new tab with a safe rel', () => {
      expect(
        resolveCtaLink({ url: 'https://example.com' }).targetAttrs
      ).toEqual({ target: '_blank', rel: 'noopener noreferrer' })
    })

    it('is empty for internal links', () => {
      expect(resolveCtaLink({ url: '/about' }).targetAttrs).toEqual({})
    })
  })

  // Cards render the CTA twice: a visible button, and an invisible overlay
  // anchor covering the card. Both spread these, so a document card downloads
  // whether you click the button or the card body (Jonathan, #483).
  describe('downloadAttrs', () => {
    it('is empty when the link is not a document', () => {
      expect(resolveCtaLink({ url: '/about' }).downloadAttrs).toEqual({})
      expect(
        resolveCtaLink({ url: 'https://example.com' }).downloadAttrs
      ).toEqual({})
    })

    it('names the file from the path', () => {
      expect(
        resolveCtaLink({ url: '/documents/guide.pdf', document: true })
          .downloadAttrs
      ).toEqual({ download: 'guide.pdf' })
    })

    it('names the file from an absolute URL', () => {
      expect(
        resolveCtaLink({
          url: 'https://example.com/files/report.pdf',
          document: true
        }).downloadAttrs
      ).toEqual({ download: 'report.pdf' })
    })

    it('ignores a query string', () => {
      expect(
        resolveCtaLink({ url: '/docs/pack.zip?v=2', document: true })
          .downloadAttrs
      ).toEqual({ download: 'pack.zip' })
    })

    it('falls back to an empty name when the path has no filename', () => {
      // An empty string still turns the attribute on. The browser then uses
      // whatever name the URL or the response headers supply.
      expect(
        resolveCtaLink({ url: '/downloads/', document: true }).downloadAttrs
      ).toEqual({ download: '' })
    })
  })

  describe('icon', () => {
    it('is null for a plain internal link by default', () => {
      expect(resolveCtaLink({ url: '/about' }).icon).toBeNull()
    })

    it('uses internalIcon for a plain internal link', () => {
      expect(resolveCtaLink({ url: '/about', internalIcon: 'swap' }).icon).toBe(
        'swap'
      )
    })

    it('is external-link for an external link', () => {
      expect(resolveCtaLink({ url: 'https://example.com' }).icon).toBe(
        'external-link'
      )
    })

    it('is download for a document', () => {
      expect(resolveCtaLink({ url: '/pack.pdf', document: true }).icon).toBe(
        'download'
      )
    })

    it('prefers download over external when both apply', () => {
      expect(
        resolveCtaLink({ url: 'https://example.com/x.pdf', document: true })
          .icon
      ).toBe('download')
    })

    it('prefers download over internalIcon', () => {
      expect(
        resolveCtaLink({
          url: '/pack.pdf',
          document: true,
          internalIcon: 'swap'
        }).icon
      ).toBe('download')
    })

    it('prefers external-link over internalIcon', () => {
      expect(
        resolveCtaLink({ url: '/about', external: true, internalIcon: 'swap' })
          .icon
      ).toBe('external-link')
    })
  })

  it('passes the document flag straight through', () => {
    expect(resolveCtaLink({ url: '/x.pdf', document: true }).document).toBe(
      true
    )
    expect(resolveCtaLink({ url: '/x' }).document).toBe(false)
  })
})
