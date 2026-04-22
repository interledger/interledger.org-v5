import { describe, expect, it } from 'vitest'
import { buildUmamiEvent, createMarked, resolvePageLabel } from './umami'

describe('resolvePageLabel', () => {
  it('uses an explicit pageLabel as-is', () => {
    expect(resolvePageLabel({ pageLabel: 'Ambassadors page' })).toBe(
      'Ambassadors page'
    )
  })

  it('treats root as Home page', () => {
    expect(resolvePageLabel({ pathname: '/' })).toBe('Home page')
    expect(resolvePageLabel({})).toBe('Home page')
  })

  it('strips the locale segment', () => {
    expect(resolvePageLabel({ pathname: '/es/ambassadors' })).toBe(
      'Ambassadors page'
    )
  })

  it('converts dashes and underscores to spaces', () => {
    expect(resolvePageLabel({ pathname: '/our_team/press-kit' })).toBe(
      'Our Team Press Kit page'
    )
  })

  it('sanitises unsafe characters', () => {
    expect(resolvePageLabel({ pageLabel: 'Evil <script> page' })).toBe(
      'Evil script page'
    )
  })
})

describe('buildUmamiEvent', () => {
  it('composes "{pageLabel} link - {linkText}"', () => {
    expect(
      buildUmamiEvent({
        pageLabel: 'Ambassadors page',
        linkText: 'Jane Linkedin'
      })
    ).toBe('Ambassadors page link - Jane Linkedin')
  })

  it('falls back to aria-label when text is empty', () => {
    expect(
      buildUmamiEvent({
        pageLabel: 'Home page',
        linkText: '',
        ariaLabel: 'Open menu'
      })
    ).toBe('Home page link - Open menu')
  })

  it('falls back to hostname+path when no text or aria-label', () => {
    expect(
      buildUmamiEvent({
        pageLabel: 'Home page',
        href: 'https://example.com/docs/'
      })
    ).toBe('Home page link - example.com/docs')
  })

  it('falls back to raw href for non-URL values', () => {
    expect(
      buildUmamiEvent({
        pageLabel: 'Home page',
        href: '/internal/path/'
      })
    ).toBe('Home page link - internal/path')
  })

  it('returns "Unknown link" when nothing usable is provided', () => {
    expect(buildUmamiEvent({ pageLabel: 'Home page' })).toBe(
      'Home page link - Unknown link'
    )
  })

  it('sanitises unsafe characters in link text', () => {
    expect(
      buildUmamiEvent({
        pageLabel: 'Home page',
        linkText: 'Click "me"'
      })
    ).toBe('Home page link - Click me')
  })
})

describe('createMarked', () => {
  it('injects data-umami-event on inline links', () => {
    const html = createMarked({ pageLabel: 'Ambassadors page' }).parseInline(
      'See [Jane Linkedin](https://linkedin.com/in/jane) for more.'
    ) as string
    expect(html).toContain(
      'data-umami-event="Ambassadors page link - Jane Linkedin"'
    )
    expect(html).toContain('href="https://linkedin.com/in/jane"')
  })

  it('handles inline markdown inside link text', () => {
    const html = createMarked({ pageLabel: 'Home page' }).parseInline(
      'Try [**bold** link](https://example.com)'
    ) as string
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('data-umami-event="Home page link - bold link"')
  })

  it('falls back to pathname when pageLabel is omitted', async () => {
    const html = await createMarked({ pathname: '/ambassadors' }).parse(
      '[Site](https://example.com)'
    )
    expect(html).toContain('data-umami-event="Ambassadors page link - Site"')
  })

  it('escapes quotes inside event attribute values', async () => {
    const html = await createMarked({ pageLabel: 'Home page' }).parse(
      '[hi](https://example.com "a title with \\"quotes\\"")'
    )
    expect(html).toContain('data-umami-event="Home page link - hi"')
    expect(html).not.toMatch(/data-umami-event="[^"]*"[^>]*"/)
  })

  it('preserves multiple links on the same line', async () => {
    const html = await createMarked({ pageLabel: 'Home page' }).parse(
      '[one](https://a.com) and [two](https://b.com)'
    )
    expect(html.match(/data-umami-event=/g)).toHaveLength(2)
    expect(html).toContain('Home page link - one')
    expect(html).toContain('Home page link - two')
  })
})
