/**
 * Lifecycle callbacks for ambassador content type.
 * Uses createFlatLocaleMdxLifecycle: on any save, fetches every locale from Strapi
 * and writes all locale MDX files in one pass.
 *
 * This avoids the i18n "modified" badge that appeared when createFlatContentLifecycle
 * only wrote the single event.result locale, leaving other locales' MDX stale.
 */

import {
  getImageUrl,
  yamlSingleQuoteScalar,
  getContentPath,
  getTargetRepoRoot,
  createFlatLocaleMdxLifecycle
} from '../../../../utils'
import type { AmbassadorBase } from '../../types'

interface Ambassador extends AmbassadorBase {
  publishedAt?: string
  locale?: string
  documentId?: string
}

function generateMdxContent(
  ambassador: Ambassador,
  englishSlug?: string
): string {
  const photoUrl = getImageUrl(ambassador.photo) || null
  const photoAlt = ambassador.photo?.alternativeText || ambassador.name
  const locale =
    ambassador.locale && ambassador.locale !== 'en'
      ? ambassador.locale
      : undefined
  const isLocalized = locale !== undefined

  const q = yamlSingleQuoteScalar
  const fields = [
    `name: ${q(ambassador.name)}`,
    `pathSlug: ${q(ambassador.pathSlug)}`,
    `photo: ${q(photoUrl)}`,
    `photoAlt: ${q(photoAlt)}`,
    `category: ${q(ambassador.category ?? null)}`,
    `tagline: ${q(ambassador.tagline ?? null)}`,
    `quote: ${q(ambassador.quote ?? null)}`,
    ...(isLocalized && englishSlug ? [`localizes: ${q(englishSlug)}`] : []),
    ...(locale ? [`locale: ${q(locale)}`] : [])
  ]

  const content = ambassador.description ?? ''
  return `---\n${fields.join('\n')}\n---\n\n${content}\n`
}

export default createFlatLocaleMdxLifecycle<Ambassador>({
  contentTypeUid: 'api::ambassador.ambassador',
  label: 'ambassador',
  getBaseDir: (locale) =>
    getContentPath(getTargetRepoRoot(), 'ambassadors', locale),
  generateContent: generateMdxContent,
  populate: { photo: true }
})
