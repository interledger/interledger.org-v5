import { describe, expect, it } from 'vitest'
import { ensureAbsoluteUrl, getSocialIconName } from './url'

describe('ensureAbsoluteUrl', () => {
  it('prepends https:// to a bare host', () => {
    expect(ensureAbsoluteUrl('google.com')).toBe('https://google.com')
  })

  it('prepends https:// to a bare host with a path', () => {
    expect(ensureAbsoluteUrl('linkedin.com/in/jane')).toBe(
      'https://linkedin.com/in/jane'
    )
  })

  it('leaves https URLs untouched', () => {
    expect(ensureAbsoluteUrl('https://github.com/jane')).toBe(
      'https://github.com/jane'
    )
  })

  it('leaves http URLs untouched (does not upgrade)', () => {
    expect(ensureAbsoluteUrl('http://example.com')).toBe('http://example.com')
  })

  it('leaves non-http schemes untouched', () => {
    expect(ensureAbsoluteUrl('mailto:jane@example.com')).toBe(
      'mailto:jane@example.com'
    )
    expect(ensureAbsoluteUrl('tel:+15551234567')).toBe('tel:+15551234567')
  })

  it('leaves protocol-relative URLs untouched', () => {
    expect(ensureAbsoluteUrl('//cdn.example.com/a.js')).toBe(
      '//cdn.example.com/a.js'
    )
  })

  it('trims surrounding whitespace before prepending', () => {
    expect(ensureAbsoluteUrl('  example.com  ')).toBe('https://example.com')
  })

  it('returns empty/whitespace-only input unchanged', () => {
    expect(ensureAbsoluteUrl('')).toBe('')
    expect(ensureAbsoluteUrl('   ')).toBe('')
  })

  it('is case-insensitive about the scheme', () => {
    expect(ensureAbsoluteUrl('HTTPS://example.com')).toBe('HTTPS://example.com')
  })
})

describe('getSocialIconName', () => {
  it('maps known platform hosts to their icon', () => {
    expect(getSocialIconName('https://youtube.com/@ilf')).toBe('youtube')
    expect(getSocialIconName('https://youtu.be/abc')).toBe('youtube')
    expect(getSocialIconName('https://interledger.slack.com')).toBe('slack')
    expect(getSocialIconName('https://github.com/jane')).toBe('github')
    expect(getSocialIconName('https://linkedin.com/in/jane')).toBe('linkedin')
    expect(getSocialIconName('https://instagram.com/jane')).toBe('instagram')
  })

  it('maps both twitter.com and x.com to the x icon', () => {
    expect(getSocialIconName('https://twitter.com/jane')).toBe('x')
    expect(getSocialIconName('https://x.com/jane')).toBe('x')
  })

  it('matches subdomains and ignores www.', () => {
    expect(getSocialIconName('https://www.github.com/jane')).toBe('github')
    expect(getSocialIconName('https://gist.github.com/jane')).toBe('github')
  })

  it('detects federated mastodon hosts by substring', () => {
    expect(getSocialIconName('https://mastodon.social/@jane')).toBe('mastodon')
    expect(getSocialIconName('https://hachyderm.io/@jane')).toBe('link-rounded')
  })

  it('normalizes bare hosts before matching', () => {
    expect(getSocialIconName('github.com/jane')).toBe('github')
  })

  it('falls back for unknown hosts', () => {
    expect(getSocialIconName('https://janedoe.dev')).toBe('link-rounded')
  })

  it('falls back for unparseable input', () => {
    expect(getSocialIconName('')).toBe('link-rounded')
    expect(getSocialIconName('   ')).toBe('link-rounded')
  })

  it('does not match lookalike hosts that merely contain a platform name', () => {
    expect(getSocialIconName('https://notgithub.com')).toBe('link-rounded')
    expect(getSocialIconName('https://github.com.evil.test')).toBe(
      'link-rounded'
    )
  })
})
