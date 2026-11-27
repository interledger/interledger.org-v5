import { describe, it, expect, vi } from 'vitest'

// `./breadcrumbs` -> `./routes` -> `./locales` reaches into Astro's virtual
// modules for i18n config. Mock them with a minimal en/es setup so this
// suite can run under plain vitest (see umami.ts for the same convention).
vi.mock('astro:config/client', () => ({
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' }
}))
vi.mock('astro:i18n', () => ({
  toCodes: (locales: string[]) => locales
}))
vi.mock('astro:content', async () => {
  const { z } = await import('zod')
  return { z }
})

const {
  buildHomeBreadcrumb,
  buildSectionEntryBreadcrumbs,
  buildSummitListingBreadcrumbs
} = await import('./breadcrumbs')
const { YEARS, currentSummitYear } = await import('./sessionize')
const { useTranslations } = await import('./i18')
const { ui } = await import('@/data/ui')

// Same fallback as useTranslations: an empty Spanish string uses the English label.
const translator = (locale: keyof typeof ui) => (key: keyof typeof ui.en) =>
  ui[locale][key] || ui.en[key]

describe('buildHomeBreadcrumb', () => {
  it.each([
    ['en', { name: 'Home', href: '/' }],
    ['es', { name: 'Inicio', href: '/es/' }]
  ] as const)('links %s home', (locale, expected) => {
    expect(buildHomeBreadcrumb(locale, translator(locale))).toEqual(expected)
  })
})

describe('buildSectionEntryBreadcrumbs', () => {
  it('builds Home > parents > label for a foundation entry with a nested pathSlug', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/education/on-campus/faq',
      'foundation',
      'FAQ',
      'en',
      translator('en')
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Grants', href: '/grant/our-grantmaking/' },
      { name: 'Education Grants', href: '/grant/education/' },
      { name: 'On Campus', href: '/grant/education/on-campus/' },
      { name: 'FAQ', href: '/grant/education/on-campus/faq/' }
    ])
  })

  it('builds Home > parent > label for a single-level nested pathSlug', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'policy-and-advocacy/role-stablecoins',
      'foundation',
      'The Role of Stablecoins',
      'en',
      translator('en')
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Policy and Advocacy', href: '/policy-and-advocacy/' },
      {
        name: 'The Role of Stablecoins',
        href: '/policy-and-advocacy/role-stablecoins/'
      }
    ])
  })

  it('does not add a parent crumb for a single-segment pathSlug', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'faq',
      'foundation',
      'FAQ',
      'en',
      translator('en')
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'FAQ', href: '/faq/' }
    ])
  })

  it('prefixes the section for summit entries', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      '2025/faq',
      'summit',
      'FAQ',
      'en',
      translator('en')
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Summit', href: '/summit/' },
      { name: '2025', href: '/summit/2025/' },
      { name: 'FAQ', href: '/summit/2025/faq/' }
    ])
  })

  it('prefixes the section for hackathon entries', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      '2025/judges/jane-doe',
      'hackathon',
      'Jane Doe',
      'en',
      translator('en')
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Hackathons', href: '/hackathon/overview/' },
      { name: '2025', href: '/hackathon/2025/' },
      { name: 'Judges', href: '/hackathon/2025/judges/' },
      { name: 'Jane Doe', href: '/hackathon/2025/judges/jane-doe/' }
    ])
  })

  it('does not prefix the section for foundation entries', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/fellowship/jane-doe',
      'foundation',
      'Jane Doe',
      'en',
      translator('en')
    )

    expect(breadcrumbs[1]).toEqual({
      name: 'Grants',
      href: '/grant/our-grantmaking/'
    })
  })

  // INTORG-1218: `/grant` is a route prefix with no page of its own, so the
  // crumb must point at the hub page instead of a 404.
  it('links the grant root crumb to the grant hub, in every locale', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/fellowship/jane-doe',
      'foundation',
      'Jane Doe',
      'es',
      translator('es')
    )

    expect(breadcrumbs).toEqual([
      { name: 'Inicio', href: '/es/' },
      { name: 'Subvenciones', href: '/es/grant/our-grantmaking/' },
      { name: 'Becas', href: '/es/grant/fellowship/' },
      { name: 'Jane Doe', href: '/es/grant/fellowship/jane-doe/' }
    ])
  })

  it('localizes the grant label and keeps the future money program name', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/future-money/re-simulate',
      'foundation',
      'Re/Simular',
      'es',
      translator('es')
    )

    expect(breadcrumbs.map((crumb) => crumb.name)).toEqual([
      'Inicio',
      'Subvenciones',
      'Future Money',
      'Re/Simular'
    ])
  })

  // INTORG-1399: slug labels gave "Policy And Advocacy" and "Nextgen".
  // The new Spanish strings are empty, so those crumbs use the English label.
  it.each([
    [
      'policy-and-advocacy/informal-economy',
      'foundation',
      ['Policy and Advocacy'],
      ['Policy and Advocacy']
    ],
    [
      'grant/education/nextgen/faq',
      'foundation',
      ['Grants', 'Education Grants', 'NextGen'],
      ['Subvenciones', 'Education Grants', 'NextGen']
    ],
    [
      'grant/call-for-papers/report',
      'foundation',
      ['Grants', 'Call for Papers'],
      ['Subvenciones', 'Call for Papers']
    ],
    ['faq', 'hackathon', ['Hackathons'], ['Hackathons']]
  ] as const)(
    'labels the parents of %s by their page, not their slug',
    (pathSlug, section, english, spanish) => {
      const parentNames = (locale: 'en' | 'es') =>
        buildSectionEntryBreadcrumbs(
          pathSlug,
          section,
          'Page',
          locale,
          translator(locale)
        )
          .slice(1, -1)
          .map((crumb) => crumb.name)

      expect(parentNames('en')).toEqual(english)
      expect(parentNames('es')).toEqual(spanish)
    }
  )

  it('has a Spanish string for every breadcrumb label', () => {
    const breadcrumbKeys = Object.keys(ui.en).filter((key) =>
      key.startsWith('breadcrumb.')
    )

    expect(breadcrumbKeys.filter((key) => !(key in ui.es))).toEqual([])
  })

  it('rewrites a root crumb only at the start of the path', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/2025/faq',
      'summit',
      'FAQ',
      'en',
      translator('en')
    )

    expect(breadcrumbs.map((crumb) => crumb.href)).toEqual([
      '/',
      '/summit/',
      '/summit/grant/',
      '/summit/grant/2025/',
      '/summit/grant/2025/faq/'
    ])
    expect(breadcrumbs[2].name).toBe('Grant')
  })

  it('uses the route locale for hrefs, not the content locale', () => {
    // Simulates an ES route falling back to EN content: routeLocale is 'es'
    // even though the rendered entry itself is the English fallback.
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'faq',
      'foundation',
      'FAQ',
      'es',
      translator('es')
    )

    expect(breadcrumbs).toEqual([
      { name: 'Inicio', href: '/es/' },
      { name: 'FAQ', href: '/es/faq/' }
    ])
  })
})

describe('buildSummitListingBreadcrumbs', () => {
  const pastYear = YEARS[0]
  it('ends at the listing, with no page number', () => {
    expect(
      buildSummitListingBreadcrumbs({
        year: pastYear,
        listingName: 'Sessions',
        basePath: `/summit/${pastYear}/talks`,
        routeLocale: 'en',
        t: useTranslations('en')
      })
    ).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Summit', href: '/summit/' },
      { name: `${pastYear} Summit`, href: `/summit/${pastYear}/` },
      { name: 'Sessions', href: `/summit/${pastYear}/talks/` }
    ])
  })

  it('skips the year crumb for the current summit, whose landing page is /summit/, localized', () => {
    const current = buildSummitListingBreadcrumbs({
      year: currentSummitYear!,
      listingName: 'Sesiones',
      basePath: `/es/summit/${currentSummitYear}/talks/`,
      routeLocale: 'es',
      t: useTranslations('es')
    })
    expect(current).toEqual([
      { name: 'Inicio', href: '/es/' },
      { name: 'Summit', href: '/es/summit/' },
      { name: 'Sesiones', href: `/es/summit/${currentSummitYear}/talks/` }
    ])
  })
})
