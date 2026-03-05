/**
 * Lifecycle callbacks for ambassador content type.
 * Uses createFlatLocaleMdxLifecycle: on any save, fetches every locale from Strapi
 * and writes all locale MDX files in one pass.
 *
 * This avoids the i18n "modified" badge that appeared when createFlatContentLifecycle
 * only wrote the single event.result locale, leaving other locales' MDX stale.
 */

import { getImageUrl } from '../../../../utils/mdx'
import { getContentPath } from '../../../../utils/paths'
import { getTargetRepoRoot } from '../../../../utils/gitSync'
import { createFlatLocaleMdxLifecycle } from '../../../../utils/flatContentLifecycle'
import type { AmbassadorBase } from '../../types'

interface Ambassador extends AmbassadorBase {
  publishedAt?: string
  locale?: string
  documentId?: string
}

/** Serializes a value as a YAML scalar (double-quoted string or null). */
function yamlValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'null'
  return JSON.stringify(value)
}

function generateMdxContent(
  ambassador: Ambassador,
  englishSlug?: string
): string {
  const photoUrl = getImageUrl(ambassador.photo, 'thumbnail') || null
  const photoAlt = ambassador.photo?.alternativeText || ambassador.name
  const locale =
    ambassador.locale && ambassador.locale !== 'en'
      ? ambassador.locale
      : undefined
  const isLocalized = locale !== undefined

  const fields = [
    `name: ${yamlValue(ambassador.name)}`,
    `slug: ${yamlValue(ambassador.slug)}`,
    `description: ${yamlValue(ambassador.description || '')}`,
    `photo: ${yamlValue(photoUrl)}`,
    `photoAlt: ${yamlValue(photoAlt)}`,
    `linkedinUrl: ${yamlValue(ambassador.linkedinUrl ?? null)}`,
    `grantReportUrl: ${yamlValue(ambassador.grantReportUrl ?? null)}`,
    ...(isLocalized && englishSlug
      ? [`localizes: ${yamlValue(englishSlug)}`]
      : []),
    ...(locale ? [`locale: ${yamlValue(locale)}`] : [])
  ]

  return `---\n${fields.join('\n')}\n---\n`
}

export default createFlatLocaleMdxLifecycle<Ambassador>({
  contentTypeUid: 'api::ambassador.ambassador',
  label: 'ambassador',
  getBaseDir: (locale) =>
    getContentPath(getTargetRepoRoot(), 'ambassadors', locale),
  generateContent: generateMdxContent,
  populate: { photo: true }
})
