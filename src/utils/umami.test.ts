import { describe, expect, it } from 'vitest'
import {
  buildUmamiAttrs,
  createMarked,
  deriveAction,
  deriveLabel,
  derivePage,
  extractTitleLabel
} from './umami'

describe('deriveLabel', () => {
  it('returns foundation_home for the root path', () => {
    expect(deriveLabel('/')).toBe('foundation_home')
    expect(deriveLabel('')).toBe('foundation_home')
  })

  it('strips a leading locale segment', () => {
    expect(deriveLabel('/es/grant/fellowship')).toBe('grant_fellowship')
  })

  it('treats a single microsite segment as its home', () => {
    expect(deriveLabel('/summit')).toBe('summit_home')
    expect(deriveLabel('/hackathon')).toBe('hackathon_home')
  })

  it('treats /summit/hackathon as the hackathon home', () => {
    expect(deriveLabel('/summit/hackathon')).toBe('hackathon_home')
  })

  it('uses the last two segments for deeper paths', () => {
    expect(deriveLabel('/grant/fellowship')).toBe('grant_fellowship')
    expect(deriveLabel('/a/b/c/d')).toBe('c_d')
  })

  it('normalises hyphens, underscores, and case', () => {
    expect(deriveLabel('/Policy-And-Advocacy')).toBe('policy_and_advocacy')
  })

  it('drops query and hash', () => {
    expect(deriveLabel('/about-us?utm=x#top')).toBe('about_us')
  })

  it('special-cases github.com to include org and repo', () => {
    expect(deriveLabel('https://github.com/interledger')).toBe(
      'github_interledger'
    )
    expect(deriveLabel('https://github.com/interledger/rafiki')).toBe(
      'github_interledger_rafiki'
    )
  })

  it('strips www and TLD for other hosts', () => {
    expect(deriveLabel('https://www.submittable.com/apply/123')).toBe(
      'submittable'
    )
    expect(deriveLabel('https://docs.interledger.org/intro')).toBe(
      'docs_interledger'
    )
  })
})

describe('derivePage', () => {
  it('returns foundation_home for the foundation root', () => {
    expect(derivePage({ pathname: '/' })).toBe('foundation_home')
  })

  it('returns home for any microsite root', () => {
    expect(derivePage({ pathname: '/summit' })).toBe('home')
    expect(derivePage({ pathname: '/summit/hackathon' })).toBe('home')
  })

  it('uses the derived label for content pages', () => {
    expect(derivePage({ pathname: '/education' })).toBe('education')
    expect(derivePage({ pathname: '/policy-and-advocacy' })).toBe(
      'policy_and_advocacy'
    )
    expect(derivePage({ pathname: '/grant/fellowship' })).toBe(
      'grant_fellowship'
    )
  })

  it('honours an explicit page override', () => {
    expect(derivePage({ page: 'Foundation', pathname: '/anything' })).toBe(
      'foundation'
    )
  })

  it('falls back to pathname when optional page is omitted (e.g. CMS umamiContext)', () => {
    expect(derivePage({ pathname: '/about-us' })).toBe('about_us')
    expect(derivePage({ page: undefined, pathname: '/about-us' })).toBe(
      'about_us'
    )
  })

  it('treats whitespace-only page override as absent', () => {
    expect(derivePage({ page: '   ', pathname: '/resources' })).toBe(
      'resources'
    )
  })

  it('collapses summit speaker detail pages to summit_speaker', () => {
    expect(
      derivePage({ pathname: '/summit/2022/speakers/sabine-schaller' })
    ).toBe('summit_speaker')
    expect(
      derivePage({ pathname: '/es/summit/2024/speakers/john-doe' })
    ).toBe('summit_speaker')
  })

  it('collapses summit talk detail pages to summit_talk', () => {
    expect(
      derivePage({
        pathname: '/summit/2022/talks/meet-your-new-friend-rafiki'
      })
    ).toBe('summit_talk')
  })

  it('collapses summit speaker/talk listings to summit_speakers/summit_talks', () => {
    expect(derivePage({ pathname: '/summit/2022/speakers' })).toBe(
      'summit_speakers'
    )
    expect(derivePage({ pathname: '/summit/2024/talks' })).toBe('summit_talks')
  })

  it('collapses blog post detail pages to blog_post', () => {
    expect(derivePage({ pathname: '/blog/some-very-long-post-title' })).toBe(
      'blog_post'
    )
    expect(
      derivePage({ pathname: '/es/blog/another-post-with-long-slug' })
    ).toBe('blog_post')
  })

  it('collapses developers blog detail pages to developer_post', () => {
    expect(
      derivePage({
        pathname: '/developers/blog/thoughts-on-scaling-interledger-connectors'
      })
    ).toBe('developer_post')
  })

  it('collapses fellowship detail pages to fellowship', () => {
    expect(derivePage({ pathname: '/grant/fellowship/some-applicant' })).toBe(
      'fellowship'
    )
  })

  it('still uses the generic last-two-segments rule for unmatched paths', () => {
    expect(derivePage({ pathname: '/grant/fellowship' })).toBe(
      'grant_fellowship'
    )
    expect(derivePage({ pathname: '/blog' })).toBe('blog')
    expect(derivePage({ pathname: '/about/team' })).toBe('about_team')
  })
})

describe('deriveAction', () => {
  it('returns home for the foundation root', () => {
    expect(deriveAction('/')).toBe('home')
  })

  it('returns microsite_home for microsite roots when outside that microsite', () => {
    expect(deriveAction('/summit')).toBe('summit_home')
    expect(deriveAction('/hackathon')).toBe('hackathon_home')
  })

  it('returns derived label for content destinations', () => {
    expect(deriveAction('/open-payments')).toBe('open_payments')
    expect(deriveAction('https://github.com/interledger')).toBe(
      'github_interledger'
    )
  })

  it('returns unknown for empty hrefs', () => {
    expect(deriveAction('')).toBe('unknown')
  })
})

describe('buildUmamiAttrs', () => {
  it('emits page:section:action plus link-text and lang', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/grant/fellowship',
        section: 'hero',
        href: 'https://www.submittable.com/apply',
        linkText: 'Apply Now',
        lang: 'en'
      })
    ).toEqual({
      'data-umami-event': 'grant_fellowship:hero:submittable',
      'data-umami-event-link-text': 'Apply Now',
      'data-umami-event-lang': 'en'
    })
  })

  it('emits home:nav:home for a summit logo on the summit microsite', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/summit',
        section: 'nav',
        href: '/summit',
        linkText: 'Interledger Summit',
        lang: 'en'
      })
    ).toEqual({
      'data-umami-event': 'home:nav:home',
      'data-umami-event-link-text': 'Interledger Summit',
      'data-umami-event-lang': 'en'
    })
  })

  it('emits foundation_home:nav:home for the Foundation link on /', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/',
        section: 'nav',
        href: '/',
        linkText: 'Foundation',
        lang: 'en'
      })
    ).toMatchObject({
      'data-umami-event': 'foundation_home:nav:home',
      'data-umami-event-link-text': 'Foundation'
    })
  })

  it('falls back to aria-label when link text is empty', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/',
        section: 'footer',
        href: 'https://www.linkedin.com/company/x',
        ariaLabel: 'LinkedIn',
        lang: 'en'
      })
    ).toMatchObject({
      'data-umami-event': 'foundation_home:footer:linkedin',
      'data-umami-event-link-text': 'LinkedIn'
    })
  })

  it('emits page:link:action by default for inline content links', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/resources',
        section: 'link',
        href: 'https://docs.interledger.org/',
        linkText: 'Open Payments Docs',
        lang: 'en'
      })
    ).toEqual({
      'data-umami-event': 'resources:link:docs_interledger',
      'data-umami-event-link-text': 'Open Payments Docs',
      'data-umami-event-lang': 'en'
    })
  })

  it('uses page:link plus a label when an inline label is provided', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/get-involved',
        section: 'link',
        href: 'https://forum.interledger.org/',
        linkText: 'Community Forum',
        lang: 'en',
        label: 'community'
      })
    ).toEqual({
      'data-umami-event': 'get_involved:link',
      'data-umami-event-link-text': 'Community Forum',
      'data-umami-event-lang': 'en',
      'data-umami-event-label': 'community'
    })
  })

  it('honours an explicit action override (e.g. for menu buttons)', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/',
        section: 'nav',
        action: 'Menu Toggle'
      })
    ).toEqual({ 'data-umami-event': 'foundation_home:nav:menu_toggle' })
  })

  it('omits empty optional attributes', () => {
    const attrs = buildUmamiAttrs({
      pathname: '/',
      section: 'cta',
      href: '/'
    })
    expect(attrs).toEqual({ 'data-umami-event': 'foundation_home:cta:home' })
  })

  it('sanitises unsafe characters in link text and label', () => {
    expect(
      buildUmamiAttrs({
        pathname: '/',
        section: 'link',
        href: '/x',
        linkText: 'Click "me"',
        label: 'evil <script>'
      })
    ).toMatchObject({
      'data-umami-event-link-text': 'Click me',
      'data-umami-event-label': 'evil script'
    })
  })
})

describe('extractTitleLabel', () => {
  it('extracts a label directive and clears the title', () => {
    expect(extractTitleLabel('label:community')).toEqual({ label: 'community' })
  })

  it('returns the title untouched when no directive is present', () => {
    expect(extractTitleLabel('A real title')).toEqual({ title: 'A real title' })
  })

  it('treats an empty-value directive as a regular title', () => {
    expect(extractTitleLabel('label:')).toEqual({ title: 'label:' })
  })

  it('handles missing titles', () => {
    expect(extractTitleLabel(undefined)).toEqual({})
    expect(extractTitleLabel(null)).toEqual({})
  })
})

describe('createMarked', () => {
  it('injects the new attribute set on inline links', () => {
    const html = createMarked({
      pathname: '/resources',
      lang: 'en'
    }).parseInline(
      'See [Open Payments Docs](https://docs.interledger.org/) for more.'
    ) as string
    expect(html).toContain('data-umami-event="resources:link:docs_interledger"')
    expect(html).toContain('data-umami-event-link-text="Open Payments Docs"')
    expect(html).toContain('data-umami-event-lang="en"')
  })

  it('honours a label directive in the link title', () => {
    const html = createMarked({
      pathname: '/get-involved',
      lang: 'en'
    }).parseInline(
      '[Community Forum](https://forum.interledger.org/ "label:community")'
    ) as string
    expect(html).toContain('data-umami-event="get_involved:link"')
    expect(html).toContain('data-umami-event-label="community"')
    expect(html).not.toContain('title="label:community"')
  })

  it('preserves a non-directive title', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      '[hi](https://example.com "real title")'
    )
    expect(html).toContain('title="real title"')
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
  })

  it('handles inline markdown inside link text', () => {
    const html = createMarked({ pathname: '/' }).parseInline(
      'Try [**bold** link](https://example.com)'
    ) as string
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
    expect(html).toContain('data-umami-event-link-text="bold link"')
  })

  it('derives page from pathname when rendering markdown links', async () => {
    const html = await createMarked({ pathname: '/ambassadors' }).parse(
      '[Site](https://example.com)'
    )
    expect(html).toContain('data-umami-event="ambassadors:link:example"')
    expect(html).toContain('data-umami-event-link-text="Site"')
  })

  it('defaults to foundation_home when pathname is omitted', async () => {
    const html = (await createMarked({}).parse(
      '[docs](https://example.com/docs)'
    )) as string
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
    expect(html).toContain('data-umami-event-link-text="docs"')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('data-umami-event=""')
    expect(html.match(/data-umami-event="/g)).toHaveLength(1)
  })

  it('does not use a junk segment when page is explicitly undefined (optional umamiContext)', async () => {
    const html = await createMarked({
      page: undefined,
      pathname: '/education',
      lang: 'en'
    }).parse('[Overview](/policy-and-advocacy)')
    expect(html).toContain(
      'data-umami-event="education:link:policy_and_advocacy"'
    )
    expect(html).not.toMatch(/:undefined|undefined:/)
  })

  it('escapes title attribute values and keeps umami attributes valid', async () => {
    const html = await createMarked({ pathname: '/' }).parse(
      '[hi](https://example.com "a title with \\"quotes\\"")'
    )
    expect(html).toContain('title="a title with &quot;quotes&quot;"')
    expect(html).toContain('data-umami-event="foundation_home:link:example"')
    expect(html).toContain('data-umami-event-link-text="hi"')
    expect(html).not.toContain('data-umami-event=""')
  })

  it('preserves multiple links on the same line', async () => {
    const html = await createMarked({ pathname: '/about-us' }).parse(
      '[one](https://a.com) and [two](https://b.com)'
    )
    expect(html.match(/data-umami-event="/g)).toHaveLength(2)
    expect(html).toContain('data-umami-event-link-text="one"')
    expect(html).toContain('data-umami-event-link-text="two"')
  })
})
