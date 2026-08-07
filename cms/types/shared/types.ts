/**
 * Shared CMS types used across multiple content types
 */

export interface MediaFile {
  id: number
  url: string
  alternativeText?: string
  name?: string
  width?: number
  height?: number
  formats?: {
    thumbnail?: { url: string }
    small?: { url: string }
    medium?: { url: string }
    large?: { url: string }
  }
}

/** `shared.cta-link` used inside hero (and elsewhere). */
export interface HeroCta {
  text?: string
  link?: string
  style?: 'primary' | 'secondary'
  external?: boolean
}

/**
 * Populated shape of `shared.hero` after Strapi read/populate.
 * One definition for page lifecycles, podcast MDX, and `heroFrontmatter`.
 */
export interface Hero {
  title?: string
  description?: string
  media?: {
    image?: MediaFile | null
    alternativeText?: string | null
  } | null
  backgroundImageMobile?: MediaFile | null
  hero_call_to_action?: HeroCta | null
}
