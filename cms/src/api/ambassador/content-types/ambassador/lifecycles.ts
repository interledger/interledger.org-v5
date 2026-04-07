/**
 * Lifecycle callbacks for ambassador content type.
 * Uses createFlatLocaleMdxLifecycle: on any save, fetches every locale from Strapi
 * and writes all locale MDX files in one pass.
 *
 * This avoids the i18n "modified" badge that appeared when createFlatContentLifecycle
 * only wrote the single event.result locale, leaving other locales' MDX stale.
 */

import { getImageUrl, yamlSingleQuoteScalar } from '../../../../utils/mdx'
import { getContentPath } from '../../../../utils/paths'
import { getTargetRepoRoot } from '../../../../utils/gitSync'
import { createFlatLocaleMdxLifecycle } from '../../../../utils/flatContentLifecycle'
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
    `description: ${q(ambassador.description || '')}`,
    `photo: ${q(photoUrl)}`,
    `photoAlt: ${q(photoAlt)}`,
    `linkedinUrl: ${q(ambassador.linkedinUrl ?? null)}`,
    `grantReportUrl: ${q(ambassador.grantReportUrl ?? null)}`,
    ...(isLocalized && englishSlug ? [`localizes: ${q(englishSlug)}`] : []),
    ...(locale ? [`locale: ${q(locale)}`] : [])
  ]

  return `---\n${fields.join('\n')}\n---\n`
}

export default createFlatLocaleMdxLifecycle<
  Ambassador,
  'api::ambassador.ambassador'
>({
  contentTypeUid: 'api::ambassador.ambassador',
  label: 'ambassador',
  getBaseDir: (locale) =>
    getContentPath(getTargetRepoRoot(), 'ambassadors', locale),
  generateContent: generateMdxContent,
  populate: { photo: true }
})
