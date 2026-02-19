/**
 * Ambassador types shared across Astro components.
 *
 * There are two distinct shapes in the data pipeline:
 *
 *   StrapiAmbassador  →  (block component transforms)  →  AmbassadorData
 *
 * StrapiAmbassador is the raw shape from Strapi (used in live preview block
 * components). It has photo as an object and description as raw markdown.
 *
 * AmbassadorData is the normalised shape ready for the UI. It is used by
 * AmbassadorGrid and Ambassador directly. photo is a flat URL string,
 * description is already rendered HTML, and photoAlt is pre-derived.
 * This shape also matches what the content collection MDX files store,
 * so AmbassadorGrid works the same way whether data comes from Strapi
 * live preview or the static collection.
 */

/**
 * Normalised ambassador data — consumed by AmbassadorGrid and Ambassador.
 * photo is a resolved URL string; description is rendered HTML.
 */
export interface AmbassadorData {
  name: string
  slug: string
  description: string
  photo?: string | null
  photoAlt?: string | null
  linkedinUrl?: string | null
  grantReportUrl?: string | null
}

/**
 * Raw ambassador reference as returned by Strapi relations.
 * Used by AmbassadorBlock and AmbassadorsGridBlock (live preview).
 * photo is a media object; description is raw markdown.
 * Block components transform this into AmbassadorData before rendering.
 */
export interface StrapiAmbassador {
  name: string
  slug: string
  description?: string
  photo?: { url: string; alternativeText?: string } | null
  linkedinUrl?: string | null
  grantReportUrl?: string | null
}
