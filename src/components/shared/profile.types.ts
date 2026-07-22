/**
 * Profile types shared across Astro components.
 *
 * There are two distinct shapes in the data pipeline:
 *
 *   StrapiProfile  →  (block component transforms)  →  ProfileData
 *
 * StrapiProfile is the raw shape from Strapi (used in live preview block
 * components). It has photo as an object and description as raw markdown.
 *
 * ProfileData is the normalised shape ready for the UI. It is used by
 * ProfileGrid, ProfileCard, and ProfileDetailPage directly. photo is a flat
 * URL string, and photoAlt is pre-derived. This shape also matches what the
 * `profiles` content collection MDX files store, so the UI components work
 * the same way whether data comes from Strapi live preview or the static
 * collection.
 */

export interface ProfileCtaData {
  text: string
  link: string
  style?: 'primary' | 'secondary'
  external?: boolean
}

/** Normalised profile data — consumed by ProfileGrid, ProfileCard, and ProfileDetailPage. */
export interface ProfileData {
  name: string
  /** Section-relative path, e.g. 'fellowship/jane-doe'. Combined with `section` to form the full URL. */
  pathSlug: string
  /** Site section — controls the URL prefix (/summit, /hackathon, or empty for foundation). */
  section?: string | null
  photo?: string | null
  photoAlt?: string | null
  tagline?: string | null
  category?: string | null
  cta?: ProfileCtaData | null
}

/**
 * Raw profile-page reference as returned by Strapi relations.
 * Used by ProfileBlock and ProfileGridBlock (live preview).
 * photo is a media object; description is raw markdown.
 * Block components transform this into ProfileData before rendering.
 */
export interface StrapiProfile {
  name: string
  pathSlug: string
  description?: string
  media?: {
    image?: { url: string } | null
    alternativeText?: string
  } | null
  category?: string | null
  tagline?: string | null
}
