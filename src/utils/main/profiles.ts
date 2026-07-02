import { getCollection } from 'astro:content'
import { type ProfileFrontmatterType } from '@/schemas/content'
import {
  type ProfileData,
  type StrapiProfile
} from '@/components/shared/profile.types'
import {
  extractProfileGridPathSlugsFromMdx,
  resolveGridColorIndexes
} from './profileGridColors'

function isProfileFrontmatterType(
  entry: ProfileFrontmatterType | StrapiProfile
): entry is ProfileFrontmatterType {
  return 'photoAlt' in entry
}

/** Normalise a profile page collection entry or raw Strapi relation into UI-ready data. */
export const toProfileData = (
  entry: ProfileFrontmatterType | StrapiProfile
): ProfileData => {
  const photo = isProfileFrontmatterType(entry) ? entry.photo : entry.photo?.url
  const photoAlt = isProfileFrontmatterType(entry)
    ? entry.photoAlt
    : entry.photo?.alternativeText

  return {
    name: entry.name,
    pathSlug: entry.pathSlug,
    photo,
    photoAlt,
    tagline: entry.tagline,
    category: entry.category,
    cta: isProfileFrontmatterType(entry) ? (entry.cta ?? null) : null
  }
}

const PAGE_COLLECTIONS = ['foundation-pages', 'summit-pages'] as const

async function indexPathSlugGridsFromPages(
  locale: string,
  knownPathSlugs: ReadonlySet<string>
): Promise<Map<string, number>> {
  const colorIndexByPathSlug = new Map<string, number>()

  for (const collection of PAGE_COLLECTIONS) {
    const pages = await getCollection(collection)

    for (const page of pages) {
      if (page.data.locale !== locale) continue

      const body = page.body
      if (!body) continue

      for (const pathSlugs of extractProfileGridPathSlugsFromMdx(body)) {
        for (const [pathSlug, index] of resolveGridColorIndexes(
          pathSlugs,
          knownPathSlugs
        )) {
          colorIndexByPathSlug.set(pathSlug, index)
        }
      }
    }
  }

  return colorIndexByPathSlug
}

/**
 * Maps each profile pathSlug to its palette index for the given locale.
 *
 * Manual ProfileGrid `pathSlugs` order takes priority (matches grid render index).
 * Remaining profiles fall back to category mode: sorted by pathSlug within category.
 */
export const getProfileColorIndexMap = async (
  locale: string
): Promise<Map<string, number>> => {
  const all = await getCollection('profiles')
  const knownPathSlugs = new Set(
    all
      .filter((entry) => entry.data.locale === locale)
      .map((entry) => entry.data.pathSlug)
  )

  const colorIndexByPathSlug = await indexPathSlugGridsFromPages(
    locale,
    knownPathSlugs
  )

  const pathSlugsByCategory = new Map<string, string[]>()

  for (const entry of all) {
    if (entry.data.locale !== locale || !entry.data.category) continue
    if (colorIndexByPathSlug.has(entry.data.pathSlug)) continue

    const pathSlugs = pathSlugsByCategory.get(entry.data.category) ?? []
    pathSlugs.push(entry.data.pathSlug)
    pathSlugsByCategory.set(entry.data.category, pathSlugs)
  }

  for (const pathSlugs of pathSlugsByCategory.values()) {
    pathSlugs.sort((a, b) => a.localeCompare(b))
    pathSlugs.forEach((pathSlug, index) =>
      colorIndexByPathSlug.set(pathSlug, index)
    )
  }

  return colorIndexByPathSlug
}

/** Color index for a single profile. Profiles without a category default to 0. */
export const getProfileColorIndex = async (
  pathSlug: string,
  locale: string
): Promise<number> => {
  const colorIndexByPathSlug = await getProfileColorIndexMap(locale)
  return colorIndexByPathSlug.get(pathSlug) ?? 0
}
