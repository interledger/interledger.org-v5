import { describe, it, expect, vi } from 'vitest'
import hackathonEn from '@/config/hackathon-navigation.json'
import type { Locale } from './locales'

// `./navigation` -> `./locales` reaches into Astro's virtual modules for
// i18n config. Mock them with a minimal en/es setup so this suite can run
// under plain vitest (see breadcrumbs.test.ts for the same convention).
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

const { getNavigation, isDirectNavLink } = await import('./navigation')

describe('getNavigation', () => {
  it('returns the hackathon menu, not the summit one', () => {
    // Compare against the config module, not against a fixed list of labels.
    // Strapi syncs these files. A new nav group from an editor is therefore
    // expected content, not a regression. A fixed list of labels made this
    // test fail when INTORG-1046 added a "Resources" group. This test checks
    // the site-to-config mapping. It still fails if `hackathon` resolves to
    // the summit config.
    expect(getNavigation('hackathon', 'en')).toEqual(hackathonEn)
  })

  it('returns the localized config for es', () => {
    const { mainMenu } = getNavigation('hackathon', 'es')
    expect(mainMenu[0].items?.[0]).toMatchObject({
      href: '/es/hackathon/overview/'
    })
  })

  it('keeps Spanish past summits on the Spanish site', () => {
    const hrefs = getNavigation('summit', 'es')
      .mainMenu.flatMap((group) => group.items ?? [])
      .map((item) => item.href)
      .filter((href) => /\/summit\/202[234]\/$/.test(href ?? ''))
    expect(hrefs).toEqual([
      '/es/summit/2024/',
      '/es/summit/2023/',
      '/es/summit/2022/'
    ])
  })

  it('keeps each site on its own config', () => {
    const summit = getNavigation('summit', 'en').mainMenu.map((g) => g.label)
    const hackathon = getNavigation('hackathon', 'en').mainMenu.map(
      (g) => g.label
    )
    expect(summit).not.toEqual(hackathon)
  })

  it('treats a childless href as a direct link', () => {
    expect(
      isDirectNavLink({
        label: 'Code of conduct',
        href: '/summit/code-conduct/'
      })
    ).toBe(true)
    expect(isDirectNavLink({ label: 'Summit', items: [] })).toBe(false)
  })

  it('rejects a group that has both an href and children', () => {
    // The JSON is cast to NavigationData, so the MenuGroup union never sees
    // it. An editor can publish both, and the menu would drop the href.
    const sites = ['foundation', 'summit', 'hackathon'] as const
    const locales = ['en', 'es'] as const

    for (const site of sites) {
      for (const locale of locales) {
        const mixed = getNavigation(site, locale).mainMenu.filter(
          (group) =>
            Boolean(group.href) &&
            ((group.items?.length ?? 0) > 0 ||
              (group.subGroups?.length ?? 0) > 0)
        )
        expect(mixed, `${site} ${locale}`).toEqual([])
      }
    }
  })

  it('falls back to the default locale when a site has no config for it', () => {
    // 'fr' is not a configured locale; the cast mirrors what would happen if a
    // locale were added to the Locale union before its nav JSON existed.
    const { mainMenu } = getNavigation('hackathon', 'fr' as Locale)
    expect(mainMenu).toEqual(getNavigation('hackathon', 'en').mainMenu)
  })
})
