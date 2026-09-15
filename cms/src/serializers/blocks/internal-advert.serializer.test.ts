import { describe, it, expect } from 'vitest'
import { serialize } from './internal-advert.serializer'
import { SerializerFieldError } from '../../utils'

/** Three elements, so it clears the minimum without any extras. */
const minimal = {
  helperText: 'Know more',
  headline: 'Revolutionizing the digital content economy.',
  logoLabel: 'Web Monetization'
}

describe('internal-advert serializer', () => {
  it('serializes a full card', () => {
    const result = serialize({
      helperText: 'Know more',
      logo: {
        image: { url: '/uploads/wm-logo.svg' },
        alternativeText: ''
      },
      logoLabel: 'Web Monetization',
      headline: 'Revolutionizing the digital content economy.',
      body: 'Web Monetization connects publishers and creators.',
      socialLinks: [
        { url: 'https://www.linkedin.com/company/web-monetization/' },
        { url: 'https://www.instagram.com/webmonetization/' }
      ],
      buttonText: 'Visit Web Monetization',
      buttonLink: 'https://webmonetization.org',
      buttonExternal: true
    })

    expect(result).toBe(
      '<InternalAdvert helperText="Know more" logo="/uploads/wm-logo.svg" ' +
        'logoAlt="" logoLabel="Web Monetization" ' +
        'headline="Revolutionizing the digital content economy." ' +
        'socialLinks={["https://www.linkedin.com/company/web-monetization/", ' +
        '"https://www.instagram.com/webmonetization/"]} ' +
        'buttonText="Visit Web Monetization" ' +
        'buttonLink="https://webmonetization.org" buttonExternal={true}>' +
        '\n\nWeb Monetization connects publishers and creators.\n\n' +
        '</InternalAdvert>'
    )
  })

  it('self-closes when there is no body', () => {
    const result = serialize(minimal)

    expect(result).toBe(
      '<InternalAdvert helperText="Know more" logoLabel="Web Monetization" ' +
        'headline="Revolutionizing the digital content economy." />'
    )
  })

  it('omits every absent optional field', () => {
    const result = serialize({
      helperText: 'Know more',
      headline: 'A headline',
      logoLabel: 'A label'
    })

    expect(result).not.toContain('logo=')
    expect(result).not.toContain('logoAlt=')
    expect(result).not.toContain('socialLinks=')
    expect(result).not.toContain('buttonText=')
  })

  it('falls back to the upload alternativeText when the component has none', () => {
    const result = serialize({
      ...minimal,
      logo: {
        image: { url: '/uploads/wm-logo.svg', alternativeText: 'Upload alt' }
      }
    })

    expect(result).toContain('logoAlt="Upload alt"')
  })

  it('keeps an explicit empty logo alt over the upload alt', () => {
    const result = serialize({
      ...minimal,
      logo: {
        image: { url: '/uploads/wm-logo.svg', alternativeText: 'Upload alt' },
        alternativeText: ''
      }
    })

    expect(result).toContain('logoAlt=""')
  })

  it('drops a half-specified button, and its flags with it', () => {
    const result = serialize({
      ...minimal,
      buttonText: 'Visit',
      buttonExternal: true
    })

    expect(result).not.toContain('buttonText=')
    expect(result).not.toContain('buttonExternal')
  })

  it('treats a whitespace-only field as empty', () => {
    expect(() =>
      serialize({ helperText: '  ', headline: '  ', logoLabel: '  ' })
    ).toThrow(SerializerFieldError)
  })

  it('rejects a card with neither headline nor body', () => {
    expect(() =>
      serialize({
        helperText: 'Know more',
        logoLabel: 'Web Monetization',
        buttonText: 'Visit',
        buttonLink: '/x'
      })
    ).toThrow(/needs a headline or a body/)
  })

  it('rejects a card with fewer than three elements', () => {
    expect(() => serialize({ headline: 'A headline' })).toThrow(
      /at least 3 of its 6 elements/
    )
  })

  it('counts the logo and its label as one element', () => {
    // Logo + label + headline is two elements, not three.
    expect(() =>
      serialize({
        logo: { image: { url: '/uploads/wm-logo.svg' } },
        logoLabel: 'Web Monetization',
        headline: 'A headline'
      })
    ).toThrow(/at least 3 of its 6 elements/)
  })

  it('reports every broken rule in one throw, so an editor sees them together', () => {
    try {
      serialize({ helperText: 'Know more' })
      expect.unreachable('expected a SerializerFieldError')
    } catch (error) {
      expect(error).toBeInstanceOf(SerializerFieldError)
      expect((error as SerializerFieldError).fieldErrors).toHaveLength(2)
    }
  })

  it('rejects a button that is both external and a document', () => {
    expect(() =>
      serialize({
        ...minimal,
        buttonText: 'Visit',
        buttonLink: '/x',
        buttonExternal: true,
        buttonDocument: true
      })
    ).toThrow(/cannot be both external and document/)
  })

  it('escapes double quotes in attribute values', () => {
    const result = serialize({
      ...minimal,
      headline: 'The "digital" content economy'
    })

    expect(result).toContain(
      'headline="The &quot;digital&quot; content economy"'
    )
  })
})
