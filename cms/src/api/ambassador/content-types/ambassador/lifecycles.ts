/**
 * Lifecycle callbacks for ambassador content type.
 * Generates MDX files for the Astro content collection,
 * then commits and pushes to trigger Netlify builds.
 */

import { getImageUrl } from '../../../../utils/mdx'
import { getContentPath, getProjectRoot } from '../../../../utils/paths'
import { createFlatContentLifecycle } from '../../../../utils/flatContentLifecycle'
import type { AmbassadorBase } from '../../types'

interface Ambassador extends AmbassadorBase {
  publishedAt?: string
  locale?: string
}

/** Serializes a value as a YAML scalar (double-quoted string or null). */
function yamlValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'null'
  return JSON.stringify(value)
}

function generateMdxContent(ambassador: Ambassador): string {
  const photoUrl = getImageUrl(ambassador.photo, 'thumbnail') || null
  const photoAlt = ambassador.photo?.alternativeText || ambassador.name
  const locale =
    ambassador.locale && ambassador.locale !== 'en'
      ? ambassador.locale
      : undefined

  const fields = [
    `name: ${yamlValue(ambassador.name)}`,
    `slug: ${yamlValue(ambassador.slug)}`,
    `description: ${yamlValue(ambassador.description || '')}`,
    `photo: ${yamlValue(photoUrl)}`,
    `photoAlt: ${yamlValue(photoAlt)}`,
    `linkedinUrl: ${yamlValue(ambassador.linkedinUrl ?? null)}`,
    `grantReportUrl: ${yamlValue(ambassador.grantReportUrl ?? null)}`,
    ...(locale ? [`locale: ${yamlValue(locale)}`] : [])
  ]

  return `---\n${fields.join('\n')}\n---\n`
}

export default createFlatContentLifecycle<Ambassador>({
  generateContent: generateMdxContent,
  getBaseDir: (locale) => getContentPath(getProjectRoot(), 'ambassadors', locale),
  label: 'ambassador'
})
