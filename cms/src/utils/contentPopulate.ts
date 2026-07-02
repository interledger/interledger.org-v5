/**
 * Shared populate configurations for dynamic zone `content` fields.
 *
 * Used by page and blog lifecycles to ensure all block types
 * and their nested relations are fully populated when fetching from Strapi.
 *
 * Keep these in sync with the component lists in the content-type schemas:
 * - foundation-page/schema.json
 * - summit-page/schema.json
 * - foundation-blog-post/schema.json
 */

/** Blocks shared by all content types. */
const FOUNDATION_PAGE_BLOCKS = {
  'blocks.paragraph': {},
  'blocks.profile': {
    populate: { profile: { populate: { photo: true } } }
  },
  'blocks.profile-grid': {
    populate: { profiles: true }
  },
  'blocks.blockquote': {},
  'blocks.callout-text': {},
  'blocks.cta-strip': {},
  'blocks.pdf-embed': {
    populate: { file: true }
  },
  'blocks.video-embed': {}
} as const

const FOUNDATION_BLOG_BLOCKS = {
  'blocks.paragraph': {},
  'blocks.video-embed': {},
  'blocks.image-block': {
    populate: { image: true, tabletImage: true, mobileImage: true }
  },
  'blocks.code-block': {}
} as const

/** Populate config for profile-page content field (paragraph blocks only). */
export const PROFILE_PAGE_CONTENT_POPULATE = {
  on: {
    'blocks.paragraph': {}
  }
} as const

/** Populate config for foundation-page and summit-page content fields. */
export const FOUNDATION_PAGE_CONTENT_POPULATE = {
  on: { ...FOUNDATION_PAGE_BLOCKS }
} as const

/** Populate config for foundation-blog-post content fields. */
export const BLOG_CONTENT_POPULATE = {
  on: { ...FOUNDATION_BLOG_BLOCKS }
} as const

/** Populate config for grant-page top-level component fields. */
export const GRANT_PAGE_CONTENT_POPULATE = {
  primaryCta: true,
  ctaStrip: true,
  seo: { populate: '*' }
} as const
