import { defaultLocale, type Locale } from './locales'
import { HOME_CONTENT_SLUG } from './routes'

interface SummitPageLike {
  data: { pathSlug: string; locale: string }
}

export interface SummitHomeResolution {
  contentLocale: Locale
  isFallback: boolean
}

/**
 * Picks the content locale for a fixed summit index route (`/summit/`,
 * `/es/summit/`). A locale without its own home falls back to the default
 * locale's home.
 *
 * Returns an Error when neither exists. These routes are not static paths, so
 * a home the publish gate dropped would still emit a page that redirects to
 * /404, and neither the sitemap nor the link check would notice. The caller
 * decides whether that fails the build.
 */
export function resolveSummitHome(
  pages: SummitPageLike[],
  pageLang: Locale
): SummitHomeResolution | Error {
  const hasHome = (locale: Locale) =>
    pages.some(
      (page) =>
        page.data.pathSlug === HOME_CONTENT_SLUG && page.data.locale === locale
    )

  if (hasHome(pageLang)) return { contentLocale: pageLang, isFallback: false }
  if (hasHome(defaultLocale)) {
    return { contentLocale: defaultLocale, isFallback: true }
  }
  return new Error(
    `The ${pageLang} summit index route has no "${HOME_CONTENT_SLUG}" entry in ${pageLang} or ${defaultLocale}. Production builds drop drafts, so check that the ${defaultLocale} home is not marked as a draft.`
  )
}
