import { describe, it, expect } from 'vitest'
import { serialize } from '../../src/serializers/blocks/cta-strip.serializer'

describe('cta-strip serializer', () => {
  it('serializes a minimal strip (primary CTA only)', () => {
    const result = serialize({
      heading: 'Stay up to date',
      description: 'Sign up for our newsletter.',
      primaryButtonText: 'Subscribe',
      primaryButtonLink: '/newsletter'
    })

    expect(result).toBe(
      '<CtaStrip heading="Stay up to date" primaryButtonText="Subscribe" primaryButtonLink="/newsletter">\nSign up for our newsletter.\n</CtaStrip>'
    )
  })

  it('includes secondary CTA and colour when present', () => {
    const result = serialize({
      heading: 'Apply now',
      description: 'This is a reminder text.',
      primaryButtonText: 'Stay in touch',
      primaryButtonLink: '/contact',
      secondaryButtonText: 'Get involved',
      secondaryButtonLink: '/get-involved',
      color: 'green'
    })

    expect(result).toContain('secondaryButtonText="Get involved"')
    expect(result).toContain('secondaryButtonLink="/get-involved"')
    expect(result).toContain('color="green"')
  })

  it('omits secondary fields and colour when absent', () => {
    const result = serialize({
      heading: 'H',
      description: 'Body.',
      primaryButtonText: 'P',
      primaryButtonLink: '/p'
    })

    expect(result).not.toContain('secondaryButtonText')
    expect(result).not.toContain('secondaryButtonLink')
    expect(result).not.toContain('color=')
  })

  it('escapes braces in the description', () => {
    const result = serialize({
      heading: 'H',
      description: 'Use {tokens} carefully.',
      primaryButtonText: 'P',
      primaryButtonLink: '/p'
    })

    expect(result).toContain('\\{tokens\\}')
  })

  it('drops an incomplete secondary CTA (only one field set)', () => {
    const result = serialize({
      heading: 'H',
      description: 'Body.',
      primaryButtonText: 'P',
      primaryButtonLink: '/p',
      secondaryButtonText: 'orphaned'
    })

    expect(result).not.toContain('secondaryButtonText')
    expect(result).not.toContain('secondaryButtonLink')
  })

  it('HTML-entity encodes characters that would break a JSX attribute', () => {
    const result = serialize({
      heading: 'The "best" offer & more <here>',
      description: 'Body.',
      primaryButtonText: 'P',
      primaryButtonLink: '/p'
    })

    // Not backslash-escaped (\" breaks MDX parsing); entity-encoded instead.
    expect(result).toContain(
      'heading="The &quot;best&quot; offer &amp; more &lt;here&gt;"'
    )
    expect(result).not.toContain('\\"')
  })
})
