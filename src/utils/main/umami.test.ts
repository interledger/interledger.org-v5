import { describe, expect, it } from 'vitest'
import {
  buildDeferredUmamiAttrs,
  buildUmamiAttrs,
  extractTitleLabel
} from './umami'

describe('buildUmamiAttrs — preview/QA routes', () => {
  it('emits no attributes at all on a preview pathname', () => {
    expect(
      buildUmamiAttrs({
        label: 'button_cta',
        baseComponent: 'primary_cta',
        pathname: '/preview/ui-components',
        href: '/about-us',
        linkText: 'Learn more'
      })
    ).toEqual({})
  })

  it('emits no attributes on a draft-content preview pathname', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/page-preview'
      })
    ).toEqual({})
  })

  it('buildDeferredUmamiAttrs also emits nothing on a preview pathname', () => {
    expect(
      buildDeferredUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/profile-preview'
      })
    ).toEqual({})
  })
})

describe('buildUmamiAttrs — current_path / current_section', () => {
  it('returns foundation_home for the root path', () => {
    expect(
      buildUmamiAttrs({ label: 'nav', baseComponent: 'menu', pathname: '/' })
    ).toMatchObject({
      'data-umami-event-current-path': 'foundation_home',
      'data-umami-event-current-section': 'foundation'
    })
  })

  it('strips a leading locale segment', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/es/grant/fellowship'
      })
    ).toMatchObject({
      'data-umami-event-current-path': 'grant',
      'data-umami-event-current-section': 'foundation'
    })
  })

  it('classifies summit paths and collapses a bare microsite root to its home', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/summit'
      })
    ).toMatchObject({
      'data-umami-event-current-path': 'summit_home',
      'data-umami-event-current-section': 'summit'
    })
  })

  it('classifies hackathon over summit when both segments are present', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/summit/hackathon/2026/judges/jane-doe'
      })
    ).toMatchObject({
      'data-umami-event-current-path': 'judges',
      'data-umami-event-current-section': 'hackathon'
    })
  })

  it('drops purely numeric/date-shaped segments before grouping', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/summit/2024/speakers/sheena-allen'
      })
    ).toMatchObject({
      'data-umami-event-current-path': 'speakers',
      'data-umami-event-current-section': 'summit'
    })
  })

  it('normalises hyphens and case', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/Policy-And-Advocacy'
      })
    ).toMatchObject({ 'data-umami-event-current-path': 'policy_and_advocacy' })
  })

  it('drops query and hash', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/about-us?utm=x#top'
      })
    ).toMatchObject({ 'data-umami-event-current-path': 'about_us' })
  })

  it('honours a CMS currentPath override for the value only, never the section', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/summit/some-long-slug',
        currentPath: 'custom_page'
      })
    ).toMatchObject({
      'data-umami-event-current-path': 'custom_page',
      'data-umami-event-current-section': 'summit'
    })
  })

  it('normalises a human-readable currentPath override the same way as a derived path', () => {
    // RichTextSection passes its section title, rehypeUmamiLinks passes a
    // CMS-authored `umamiContext` field — both free text — into currentPath.
    // Without normalisation these would land as high-cardinality noise
    // alongside every other, snake_case current_path value.
    expect(
      buildUmamiAttrs({
        label: 'link',
        baseComponent: 'inline_link',
        pathname: '/',
        currentPath: 'The Advantages of Stablecoins (footnotes)'
      })
    ).toMatchObject({
      'data-umami-event-current-path': 'the_advantages_of_stablecoins_footnotes'
    })
  })

  it('treats a whitespace-only currentPath override as absent', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'menu',
        pathname: '/resources',
        currentPath: '   '
      })
    ).toMatchObject({ 'data-umami-event-current-path': 'resources' })
  })
})

describe('buildUmamiAttrs — destination_path / destination_section', () => {
  it('omits destination properties when no href is given', () => {
    const attrs = buildUmamiAttrs({
      label: 'toggle',
      baseComponent: 'faq',
      pathname: '/'
    })
    expect(attrs).not.toHaveProperty('data-umami-event-destination-path')
    expect(attrs).not.toHaveProperty('data-umami-event-destination-section')
  })

  it('groups an internal destination the same way as current_path', () => {
    // Matches the ADR's own examples table: the first remaining segment wins,
    // so /es/grant/fellowship/sheena-allen groups to `grant`, not `fellowship`.
    expect(
      buildUmamiAttrs({
        label: 'button_card',
        baseComponent: 'resource_cards',
        pathname: '/',
        href: '/es/grant/fellowship/sheena-allen'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'grant',
      'data-umami-event-destination-section': 'foundation'
    })
  })

  it('classifies a known external domain', () => {
    expect(
      buildUmamiAttrs({
        label: 'button_cta',
        baseComponent: 'download_button',
        pathname: '/',
        href: 'https://github.com/interledger/rafiki'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'github',
      'data-umami-event-destination-section': 'external'
    })
  })

  it('classifies an unknown external domain as other_external', () => {
    expect(
      buildUmamiAttrs({
        label: 'button_cta',
        baseComponent: 'download_button',
        pathname: '/',
        href: 'https://example.com/whatever'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'other_external',
      'data-umami-event-destination-section': 'external'
    })
  })

  it('treats an absolute same-origin link as internal, not external', () => {
    expect(
      buildUmamiAttrs({
        label: 'button_cta',
        baseComponent: 'primary_cta',
        pathname: '/',
        href: 'https://interledger.org/blog/some-post'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'blog',
      'data-umami-event-destination-section': 'foundation'
    })
    expect(
      buildUmamiAttrs({
        label: 'button_cta',
        baseComponent: 'primary_cta',
        pathname: '/',
        href: 'https://www.interledger.org/'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'foundation_home',
      'data-umami-event-destination-section': 'foundation'
    })
  })

  it('omits destination properties for a hash-only in-page anchor', () => {
    // FaqSectionsNav links to `#section` on the same page — that's not a
    // navigation destination, so it must not collapse to `foundation_home`.
    const attrs = buildUmamiAttrs({
      label: 'nav',
      baseComponent: 'faq_nav',
      pathname: '/faq',
      href: '#pricing'
    })
    expect(attrs).not.toHaveProperty('data-umami-event-destination-path')
    expect(attrs).not.toHaveProperty('data-umami-event-destination-section')
  })

  it('classifies a mailto: link as external instead of a fake internal path', () => {
    expect(
      buildUmamiAttrs({
        label: 'link',
        baseComponent: 'inline_link',
        pathname: '/',
        href: 'mailto:hi@example.com'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'other_external',
      'data-umami-event-destination-section': 'external'
    })
  })

  it('classifies a tel: link as external instead of a fake internal path', () => {
    expect(
      buildUmamiAttrs({
        label: 'link',
        baseComponent: 'inline_link',
        pathname: '/',
        href: 'tel:+15551234567'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'other_external',
      'data-umami-event-destination-section': 'external'
    })
  })

  it('classifies a protocol-relative host as external, grouped by hostname', () => {
    expect(
      buildUmamiAttrs({
        label: 'link',
        baseComponent: 'inline_link',
        pathname: '/',
        href: '//github.com/interledger/rafiki'
      })
    ).toMatchObject({
      'data-umami-event-destination-path': 'github',
      'data-umami-event-destination-section': 'external'
    })
  })
})

describe('buildUmamiAttrs — event name and other properties', () => {
  it('emits just the label as the event name', () => {
    expect(
      buildUmamiAttrs({
        label: 'button_cta',
        baseComponent: 'hero',
        pathname: '/',
        href: '/explore'
      })
    ).toMatchObject({ 'data-umami-event': 'button_cta' })
  })

  it('normalises the base_component value', () => {
    expect(
      buildUmamiAttrs({
        label: 'button_card',
        baseComponent: 'Resource Cards',
        pathname: '/'
      })
    ).toMatchObject({ 'data-umami-event-base-component': 'resource_cards' })
  })

  it('falls back to aria-label when link text is empty', () => {
    expect(
      buildUmamiAttrs({
        label: 'nav',
        baseComponent: 'footer',
        pathname: '/',
        href: 'https://www.linkedin.com/company/x',
        ariaLabel: 'LinkedIn'
      })
    ).toMatchObject({ 'data-umami-event-link-text': 'LinkedIn' })
  })

  it('omits empty optional attributes', () => {
    const attrs = buildUmamiAttrs({
      label: 'toggle',
      baseComponent: 'hamburger_menu',
      pathname: '/'
    })
    expect(attrs).toEqual({
      'data-umami-event': 'toggle',
      'data-umami-event-base-component': 'hamburger_menu',
      'data-umami-event-current-path': 'foundation_home',
      'data-umami-event-current-section': 'foundation'
    })
  })

  it('sanitises unsafe characters in link text', () => {
    expect(
      buildUmamiAttrs({
        label: 'link',
        baseComponent: 'inline_link',
        pathname: '/',
        href: '/x',
        linkText: 'Click "me"'
      })
    ).toMatchObject({ 'data-umami-event-link-text': 'Click me' })
  })
})

describe('buildDeferredUmamiAttrs', () => {
  it('emits the identical event and properties as buildUmamiAttrs, under data-track-event* keys', () => {
    const input = {
      label: 'nav' as const,
      baseComponent: 'menu',
      pathname: '/grant/fellowship',
      href: 'https://www.submittable.com/apply',
      linkText: 'Apply Now',
      lang: 'en'
    }
    expect(buildDeferredUmamiAttrs(input)).toEqual({
      'data-track-event': 'nav',
      'data-track-event-base-component': 'menu',
      'data-track-event-link-text': 'Apply Now',
      'data-track-event-lang': 'en',
      'data-track-event-current-path': 'grant',
      'data-track-event-current-section': 'foundation',
      'data-track-event-destination-path': 'submittable',
      'data-track-event-destination-section': 'external'
    })
  })

  it('omits empty optional attributes', () => {
    expect(
      buildDeferredUmamiAttrs({
        label: 'toggle',
        baseComponent: 'submenu',
        pathname: '/'
      })
    ).toEqual({
      'data-track-event': 'toggle',
      'data-track-event-base-component': 'submenu',
      'data-track-event-current-path': 'foundation_home',
      'data-track-event-current-section': 'foundation'
    })
  })
})

describe('extractTitleLabel', () => {
  it('extracts a label directive and clears the title', () => {
    expect(extractTitleLabel('label:community')).toEqual({
      label: 'community'
    })
  })

  it('returns the title untouched when no directive is present', () => {
    expect(extractTitleLabel('A real title')).toEqual({
      title: 'A real title'
    })
  })

  it('treats an empty-value directive as a regular title', () => {
    expect(extractTitleLabel('label:')).toEqual({ title: 'label:' })
  })

  it('handles missing titles', () => {
    expect(extractTitleLabel(undefined)).toEqual({})
    expect(extractTitleLabel(null)).toEqual({})
  })
})
