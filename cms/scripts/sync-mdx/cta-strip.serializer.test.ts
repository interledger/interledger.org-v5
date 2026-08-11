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

  it('omits legacy secondary CTA and colour when present', () => {
    const result = serialize({
      heading: 'Apply now',
      description: 'This is a reminder text.',
      primaryButtonText: 'Stay in touch',
      primaryButtonLink: '/contact',
      secondaryButtonText: 'Get involved',
      secondaryButtonLink: '/get-involved',
      color: 'green'
    })

    expect(result).not.toContain('secondaryButtonText')
    expect(result).not.toContain('secondaryButtonLink')
    expect(result).not.toContain('color=')
  })

  it('omits optional heading, description, secondary fields and colour when absent', () => {
    const result = serialize({
      primaryButtonText: 'P',
      primaryButtonLink: '/p'
    })

    expect(result).toBe(
      '<CtaStrip primaryButtonText="P" primaryButtonLink="/p" />'
    )
    expect(result).not.toContain('heading=')
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

  it('serializes a description containing a link and a mailto link as children', () => {
    const result = serialize({
      heading: 'Before applying',
      description:
        'Check the [Grantmaking FAQs](/grants/faq) to know our approach. For clarifications, reach out to [our team](mailto:programteam@interledger.org).',
      primaryButtonText: 'Apply now',
      primaryButtonLink: '/grants/apply'
    })

    expect(result).toContain('[Grantmaking FAQs](/grants/faq)')
    expect(result).toContain('[our team](mailto:programteam@interledger.org)')
  })

  it('drops an incomplete legacy secondary CTA (only one field set)', () => {
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
