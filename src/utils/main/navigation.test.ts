import { describe, it, expect, vi } from 'vitest'
import type { Locale } from './locales'

// `./navigation` -> `./i18` -> `./locales` reaches into Astro's virtual
// modules for i18n config. Mock them with a minimal en/es setup so this
// suite can run under plain vitest (see breadcrumbs.test.ts for the same
// convention).
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
    const { mainMenu } = getNavigation('hackathon', 'en')
    expect(mainMenu.map((group) => group.label)).toEqual(['Hackathon'])
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
