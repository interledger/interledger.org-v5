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

const { buildSectionEntryBreadcrumbs } = await import('./breadcrumbs')

describe('buildSectionEntryBreadcrumbs', () => {
  it('builds Home > parents > label for a foundation entry with a nested pathSlug', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/education/on-campus/faq',
      'foundation',
      'FAQ',
      'en',
      'Home'
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Grant', href: '/grant/our-grantmaking' },
      { name: 'Education', href: '/grant/education' },
      { name: 'On Campus', href: '/grant/education/on-campus' },
      { name: 'FAQ', href: '/grant/education/on-campus/faq' }
    ])
  })

  it('builds Home > parent > label for a single-level nested pathSlug', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'policy-and-advocacy/role-stablecoins',
      'foundation',
      'The Role of Stablecoins',
      'en',
      'Home'
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Policy And Advocacy', href: '/policy-and-advocacy' },
      {
        name: 'The Role of Stablecoins',
        href: '/policy-and-advocacy/role-stablecoins'
      }
    ])
  })

  it('does not add a parent crumb for a single-segment pathSlug', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'faq',
      'foundation',
      'FAQ',
      'en',
      'Home'
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'FAQ', href: '/faq' }
    ])
  })

  it('prefixes the section for summit entries', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      '2025/faq',
      'summit',
      'FAQ',
      'en',
      'Home'
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Summit', href: '/summit' },
      { name: '2025', href: '/summit/2025' },
      { name: 'FAQ', href: '/summit/2025/faq' }
    ])
  })

  it('prefixes the section for hackathon entries', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      '2025/judges/jane-doe',
      'hackathon',
      'Jane Doe',
      'en',
      'Home'
    )

    expect(breadcrumbs).toEqual([
      { name: 'Home', href: '/' },
      { name: 'Hackathon', href: '/hackathon/overview' },
      { name: '2025', href: '/hackathon/2025' },
      { name: 'Judges', href: '/hackathon/2025/judges' },
      { name: 'Jane Doe', href: '/hackathon/2025/judges/jane-doe' }
    ])
  })

  it('does not prefix the section for foundation entries', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/fellowship/jane-doe',
      'foundation',
      'Jane Doe',
      'en',
      'Home'
    )

    expect(breadcrumbs[1]).toEqual({
      name: 'Grant',
      href: '/grant/our-grantmaking'
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
      'Inicio'
    )

    expect(breadcrumbs).toEqual([
      { name: 'Inicio', href: '/es' },
      { name: 'Grant', href: '/es/grant/our-grantmaking' },
      { name: 'Fellowship', href: '/es/grant/fellowship' },
      { name: 'Jane Doe', href: '/es/grant/fellowship/jane-doe' }
    ])
  })

  it('rewrites a root crumb only at the start of the path', () => {
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'grant/2025/faq',
      'summit',
      'FAQ',
      'en',
      'Home'
    )

    expect(breadcrumbs.map((crumb) => crumb.href)).toEqual([
      '/',
      '/summit',
      '/summit/grant',
      '/summit/grant/2025',
      '/summit/grant/2025/faq'
    ])
  })

  it('uses the route locale for hrefs, not the content locale', () => {
    // Simulates an ES route falling back to EN content: routeLocale is 'es'
    // even though the rendered entry itself is the English fallback.
    const breadcrumbs = buildSectionEntryBreadcrumbs(
      'faq',
      'foundation',
      'FAQ',
      'es',
      'Inicio'
    )

    expect(breadcrumbs).toEqual([
      { name: 'Inicio', href: '/es' },
      { name: 'FAQ', href: '/es/faq' }
    ])
  })
})
