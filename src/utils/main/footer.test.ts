import { describe, it, expect, vi } from 'vitest'

// `./i18` -> `translatePath` -> `translationMapData` reaches into real
// content collections via `getCollection`, which isn't available under
// plain vitest. Mock `./i18` directly instead of the virtual-module chain
// other suites use (see navigation.test.ts) — getFooterOnlyColumn only cares
// that it calls `t`/`translatePath` with the right keys, not how they resolve.
vi.mock('./i18', () => ({
  useTranslations: (lang: string) => (key: string) => `${lang}:${key}`,
  translatePath: (routeBase: string, lang: string, enSlug: string) =>
    `/${lang}/${routeBase}/${enSlug}`
}))

const { getFooterOnlyColumn } = await import('./footer')

describe('getFooterOnlyColumn', () => {
  it('returns null for the hackathon site, whose footer links all live in hackathon-navigation', () => {
    expect(getFooterOnlyColumn('hackathon', 'en')).toBeNull()
  })

  it('returns the Foundation-only column for the foundation site', () => {
    expect(getFooterOnlyColumn('foundation', 'en')).toEqual({
      label: 'en:footer.resources',
      items: [
        {
          label: 'en:footer.terms_service',
          href: '/en/foundation-pages/terms-of-service'
        },
        {
          label: 'en:footer.privacy_policy',
          href: '/en/foundation-pages/privacy-policy'
        },
        {
          label: 'en:footer.press_media',
          href: '/en/foundation-pages/press'
        },
        { label: 'en:footer.faq', href: '/en/foundation-pages/faq' }
      ]
    })
  })

  it('falls back to the Foundation-only column for any other non-hackathon site', () => {
    // SiteFooter only ever renders 'foundation' or 'hackathon' (summit uses
    // MicrositeFooter instead), but the function itself branches on
    // 'hackathon' alone, so any other NavigationSite takes this path too.
    expect(getFooterOnlyColumn('summit', 'en')).toEqual(
      getFooterOnlyColumn('foundation', 'en')
    )
  })

  it('localizes hrefs and labels for a non-default locale', () => {
    const column = getFooterOnlyColumn('foundation', 'es')
    expect(column?.label).toBe('es:footer.resources')
    expect(column?.items?.[0]).toEqual({
      label: 'es:footer.terms_service',
      href: '/es/foundation-pages/terms-of-service'
    })
  })
})
