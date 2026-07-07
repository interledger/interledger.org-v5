/**
 * MDX generation for the profile-page content type.
 *
 * Kept in utils (not in the api lifecycle file) so it can be unit-tested
 * without Strapi loading a test file from the api directory at runtime.
 */

import matter from 'gray-matter'
import type { MediaFile } from '../../types/shared/types'
import { getImageUrl, defaultLang, MATTER_STRINGIFY_OPTIONS } from './mdx'
import { serializeContent } from '../serializers/blocks'

export interface ProfileMdxCta {
  text?: string
  link?: string
  style?: 'primary' | 'secondary'
  external?: boolean
}

export interface ProfileMdxInput {
  name: string
  pathSlug: string
  section?: 'grant' | 'summit' | 'hackathon' | 'foundation' | null
  description?: string | null
  photo?: MediaFile | null
  category?: string | null
  tagline?: string | null
  role?: string | null
  content?: Array<{ __component: string; [key: string]: unknown }> | null
  cta?: ProfileMdxCta | null
  locale?: string
}

/** Build the frontmatter CTA object, omitting default/empty fields. */
function ctaFrontmatter(cta: ProfileMdxCta | null | undefined) {
  if (!cta?.text || !cta?.link) return undefined
  return {
    text: cta.text,
    link: cta.link,
    ...(cta.style && cta.style !== 'primary' ? { style: cta.style } : {}),
    ...(cta.external ? { external: true } : {})
  }
}

/**
 * Serialize a profile page into MDX (frontmatter + markdown body).
 * For non-default locales, `englishSlug` is written as `localizes`.
 */
export function generateProfileMdx(
  profile: ProfileMdxInput,
  englishSlug?: string
): string {
  const photoUrl = getImageUrl(profile.photo) || null
  const photoAlt = profile.photo?.alternativeText ?? profile.name
  const isLocalized = profile.locale !== defaultLang
  const cta = ctaFrontmatter(profile.cta)

  const frontmatter: Record<string, unknown> = {
    name: profile.name,
    pathSlug: profile.pathSlug,
    ...(profile.section ? { section: profile.section } : {}),
    photo: photoUrl,
    photoAlt,
    category: profile.category ?? null,
    tagline: profile.tagline ?? null,
    ...(profile.description ? { description: profile.description } : {}),
    role: profile.role ?? null,
    ...(cta ? { cta } : {}),
    locale: profile.locale ?? defaultLang,
    ...(isLocalized && englishSlug ? { localizes: englishSlug } : {})
  }

  const blocksBody = profile.content?.length
    ? serializeContent(profile.content)
    : ''
  return matter.stringify(
    blocksBody ? `\n${blocksBody}\n` : '',
    frontmatter,
    MATTER_STRINGIFY_OPTIONS
  )
}
