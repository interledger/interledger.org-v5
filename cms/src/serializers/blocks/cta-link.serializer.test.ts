import { describe, it, expect } from 'vitest'
import { serialize } from './cta-link.serializer'

describe('cta-link serializer', () => {
  it('serializes text and link only', () => {
    const result = serialize({ text: 'Apply now', link: 'https://example.com' })

    expect(result).toBe('<CtaLink text="Apply now" link="https://example.com" />')
  })

  it('omits style when it is the default "primary"', () => {
    const result = serialize({
      text: 'Apply now',
      link: 'https://example.com',
      style: 'primary'
    })

    expect(result).not.toContain('style=')
  })

  it('includes style when "secondary"', () => {
    const result = serialize({
      text: 'Learn more',
      link: 'https://example.com',
      style: 'secondary'
    })

    expect(result).toContain('style="secondary"')
  })

  it('includes external when true', () => {
    const result = serialize({
      text: 'Apply now',
      link: 'https://example.com',
      external: true
    })

    expect(result).toContain('external={true}')
  })

  it('omits external when false or absent', () => {
    const result = serialize({
      text: 'Apply now',
      link: 'https://example.com',
      external: false
    })

    expect(result).not.toContain('external=')
  })

  it('throws when text is missing', () => {
    expect(() =>
      serialize({ text: '', link: 'https://example.com' })
    ).toThrow('CtaLink block is missing text')
  })

  it('throws when link is missing', () => {
    expect(() => serialize({ text: 'Apply now', link: '' })).toThrow(
      'CtaLink block is missing link'
    )
  })
})
