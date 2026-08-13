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

const { getNavigation } = await import('./navigation')

describe('getNavigation', () => {
  it('returns the hackathon menu, not the summit one', () => {
    // Compared against the config module rather than a hard-coded label list.
    // These files are synced from Strapi, so an editor adding a nav group is
    // expected content churn, not a regression — pinning the labels made this
    // red when INTORG-1046 added a "Resources" group. The site → config
    // mapping is what's under test, and that still fails loudly if
    // `hackathon` ever resolves to the summit config.
    expect(getNavigation('hackathon', 'en')).toEqual(hackathonEn)
  })

  it('returns the localized config for es', () => {
    const { mainMenu } = getNavigation('hackathon', 'es')
    expect(mainMenu[0].items?.[0]).toMatchObject({
      href: '/es/hackathon/overview'
    })
  })

  it('keeps each site on its own config', () => {
    const summit = getNavigation('summit', 'en').mainMenu.map((g) => g.label)
    const hackathon = getNavigation('hackathon', 'en').mainMenu.map(
      (g) => g.label
    )
    expect(summit).not.toEqual(hackathon)
  })

  it('falls back to the default locale when a site has no config for it', () => {
    // 'fr' is not a configured locale; the cast mirrors what would happen if a
    // locale were added to the Locale union before its nav JSON existed.
    const { mainMenu } = getNavigation('hackathon', 'fr' as Locale)
    expect(mainMenu).toEqual(getNavigation('hackathon', 'en').mainMenu)
  })
})
